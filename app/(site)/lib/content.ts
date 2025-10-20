import fs from "node:fs/promises";
import path from "node:path";
import prisma from "./prisma";
import { parseDbArticle } from "./parse-db-article";
import type {
  Article,
  ContentSection,
  EscapeRoomGeneralData,
  EscapeRoomScoring,
  Navigation,
  SiteContent
} from "./types";

const EXPORT_FILENAME = "thecovenant-export-formatted.json";
const CONTENT_EXPORT_URL = process.env.CONTENT_EXPORT_URL ?? process.env.NEXT_PUBLIC_CONTENT_EXPORT_URL ?? null;
const CONTENT_EXPORT_BASE_URL =
  process.env.CONTENT_EXPORT_BASE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
const LOCAL_EXPORT_PATHS = Array.from(
  new Set(
    [process.env.CONTENT_EXPORT_PATH, path.join(process.cwd(), "public", EXPORT_FILENAME), path.join(process.cwd(), "data", EXPORT_FILENAME)]
      .filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0)
  )
);

let cachedContent: SiteContent | null = null;
let loadedOnce = false;

const contentSource = (process.env.CONTENT_SOURCE ?? "").toLowerCase();
// Consideramos la URL de base de datos válida si respeta los protocolos soportados
const rawDbUrl = process.env.DATABASE_URL ?? "";
const isValidDatabaseUrl = rawDbUrl.startsWith("file:") || rawDbUrl.startsWith("postgresql://") || rawDbUrl.startsWith("postgres://");
// Para evitar activar Prisma sólo por tener DATABASE_URL definida, exigimos flag explícito
// - CONTENT_SOURCE=database (fuerza uso BD)
// - USE_DATABASE_CONTENT=true (activa BD siempre que la URL sea válida)
// Si CONTENT_SOURCE=file se fuerza el fallback a export JSON aunque haya URL.
const enableDbFlag = (process.env.ENABLE_DB ?? "").toLowerCase() === "true";
const DATABASE_CONTENT_ENABLED =
  (contentSource === "database" && isValidDatabaseUrl) ||
  (enableDbFlag && isValidDatabaseUrl) ||
  (contentSource !== "file" && process.env.USE_DATABASE_CONTENT === "true" && isValidDatabaseUrl);

// Contenido mínimo por defecto para evitar nulls durante el arranque
const fallbackContent: SiteContent = {
  hero: {
    title: "Relatos ocultos, experiencias imposibles",
    description: "La hermandad de The Covenant recopila investigaciones, crónicas y proyectos de narrativa inmersiva.",
    cta: { label: "Explorar relatos", href: "/cronicas" }
  },
  highlight: "",
  articles: [],
  featured: [],
  navigation: {
    primary: [
      { label: "Crónicas", href: "/cronicas" },
      { label: "Experiencias", href: "/experiencias" },
      { label: "Noticias", href: "/noticias" },
      { label: "Podcast", href: "/podcast" }
    ],
    secondary: [
      { label: "Newsletter", href: "/newsletter" },
      { label: "Contacto", href: "/contacto" },
      { label: "Colabora", href: "/colabora" }
    ]
  }
};

/**
 * Convierte URLs de imágenes externas a rutas locales si la imagen fue descargada.
 * Ejemplo: https://www.thecovenant.es/storage/app/uploads/public/5ff/2eb/50d/5ff2eb50d2fef191568579.jpg
 * -> /images/www_thecovenant_es/5ff2eb50d2fef191568579_jpg.jpg
 */
function normalizeImageUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, "_");
    const pathname = urlObj.pathname;
    
    // Extraer el nombre del archivo y extensión
    const match = pathname.match(/\/([^/]+)\.(\w+)$/);
    if (match) {
      const [, filename, ext] = match;
      const localPath = `/images/${hostname}/${filename}_${ext}.${ext}`;
      return localPath;
    }
  } catch (e) {
    // Si no es una URL válida, devolver tal cual
  }
  return url;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normaliseSections(entry: any): ContentSection[] {
  const sections: ContentSection[] = [];

  if (Array.isArray(entry?.sections)) {
    for (const section of entry.sections) {
      // Si es un string, crear un párrafo
      if (typeof section === "string") {
        sections.push({ type: "paragraph", text: section });
        continue;
      }
      
      // Si tiene type="image" con url o src
      if (section?.type === "image") {
        const imageUrl = section?.url ?? section?.src;
        if (typeof imageUrl === "string") {
          sections.push({ 
            type: "image", 
            url: normalizeImageUrl(imageUrl), 
            alt: section.alt, 
            caption: section.caption 
          });
        }
        continue;
      }
      
      // Si tiene type="heading"
      if (section?.type === "heading" && typeof section?.text === "string") {
        sections.push({ type: "heading", text: section.text });
        continue;
      }
      
      // Si tiene type="paragraph"
      if (section?.type === "paragraph" && typeof section?.text === "string") {
        sections.push({ type: "paragraph", text: section.text });
        continue;
      }
      
      // Si tiene type="quote"
      if (section?.type === "quote" && typeof section?.text === "string") {
        sections.push({ type: "quote", text: section.text });
        continue;
      }
      
      // Si tiene type="html" o "embed"
      if ((section?.type === "html" || section?.type === "embed") && typeof section?.html === "string") {
        sections.push({ type: "embed", html: section.html });
        continue;
      }
      
      // Si tiene html pero no type, asumir embed
      if (typeof section?.html === "string") {
        sections.push({ type: "embed", html: section.html });
      }
    }
  }

  if (sections.length === 0 && typeof entry?.content === "string") {
    entry.content
      .split(/\n\n+/)
      .map((paragraph: string) => paragraph.trim())
      .filter(Boolean)
      .forEach((paragraph: string) => sections.push({ type: "paragraph", text: paragraph }));
  }

  if (sections.length === 0 && Array.isArray(entry?.content)) {
    for (const block of entry.content) {
      if (typeof block === "string") {
        sections.push({ type: "paragraph", text: block });
      } else if (block?.type === "image" && block?.url) {
        sections.push({ type: "image", url: normalizeImageUrl(block.url), alt: block.alt, caption: block.caption });
      } else if (block?.type === "quote") {
        sections.push({ type: "quote", text: block.text ?? "" });
      }
    }
  }

  if (sections.length === 0 && typeof entry?.html === "string") {
    sections.push({ type: "embed", html: entry.html });
  }

  // Fallback: procesar campos `paragraphs`, `headings` e `images` generados por format-export.mjs
  if (sections.length === 0 && Array.isArray(entry?.paragraphs)) {
    // Añadir primera imagen destacada al inicio si existe
    if (Array.isArray(entry?.images) && entry.images.length > 0) {
      const firstImg = entry.images[0];
      if (firstImg?.src && typeof firstImg.src === "string") {
        sections.push({
          type: "image",
          url: normalizeImageUrl(firstImg.src),
          alt: firstImg.alt,
          caption: firstImg.caption
        });
      }
    }

    // Añadir párrafos del export
    entry.paragraphs
      .filter((p: any) => typeof p === "string" && p.trim().length > 0)
      .forEach((p: string) => sections.push({ type: "paragraph", text: p }));

    // Añadir resto de imágenes al final si hay más
    if (Array.isArray(entry?.images) && entry.images.length > 1) {
      entry.images
        .slice(1)
        .filter((img: any) => img?.src && typeof img.src === "string")
        .forEach((img: any) => {
          sections.push({
            type: "image",
            url: normalizeImageUrl(img.src),
            alt: img.alt,
            caption: img.caption
          });
        });
    }
  }

  if (sections.length === 0) {
    sections.push({
      type: "paragraph",
      text: "Contenido no disponible temporalmente."
    });
  }

  return sections;
}

function normaliseArticle(page: any): Article | null {
  const slugCandidate = page?.slug ?? page?.path ?? page?.url;
  if (!slugCandidate || typeof slugCandidate !== "string") {
    return null;
  }

  const normalisedSlug = slugCandidate.replace(/^https?:\/\/(www\.)?thecovenant\.es\//, "").replace(/^\//, "");

  // Normalizar coverImage desde múltiples fuentes posibles
  let coverImage: { url: string; alt?: string } | undefined = undefined;
  
  if (page?.heroImage) {
    const imageUrl = page.heroImage?.url ?? page.heroImage?.src;
    if (imageUrl) {
      coverImage = { 
        url: normalizeImageUrl(imageUrl), 
        alt: page.heroImage?.alt ?? undefined 
      };
    }
  } else if (page?.coverImage) {
    const imageUrl = page.coverImage?.url ?? page.coverImage?.src;
    if (imageUrl) {
      coverImage = { 
        url: normalizeImageUrl(imageUrl), 
        alt: page.coverImage?.alt ?? undefined 
      };
    }
  }

  return {
    slug: normalisedSlug.length === 0 ? "" : normalisedSlug,
    title: page?.title ?? page?.metaTitle ?? "Sin título",
    description: page?.description ?? page?.excerpt,
    excerpt: page?.excerpt ?? page?.description,
    coverImage,
    category: page?.category ?? page?.section ?? undefined,
    tags: Array.isArray(page?.tags) ? page.tags : undefined,
    publishedAt: page?.publishedAt ?? page?.date ?? undefined,
    readingTime: page?.readingTime ?? page?.meta?.readingTime ?? undefined,
    sections: normaliseSections(page),
    escapeRoomGeneralData: page?.escapeRoomGeneralData ?? undefined,
    escapeRoomScoring: page?.escapeRoomScoring ?? undefined
  };
}

async function loadExportFromUrl(url: string): Promise<any | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      console.warn(`No se pudo obtener el export externo (${response.status} ${response.statusText}).`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn("Fallo al solicitar el export externo:", error);
    return null;
  }
}

async function loadExportFromFilesystem(): Promise<any | null> {
  for (const candidate of LOCAL_EXPORT_PATHS) {
    try {
      const rawTxt = await fs.readFile(candidate, "utf-8");
      return JSON.parse(rawTxt);
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        continue;
      }
      console.warn(`No se pudo leer el export desde ${candidate}:`, error);
    }
  }
  return null;
}

function buildSiteContent(raw: any): SiteContent | null {
  const pages = Array.isArray(raw?.pages) ? raw.pages : [];
  const articles = pages
    .map((page: any) => normaliseArticle(page))
    .filter((article: Article | null): article is Article => Boolean(article?.slug));

  if (articles.length === 0) {
    return null;
  }

  const featured = Array.isArray(raw?.featuredSlugs)
    ? raw.featuredSlugs
    : articles.slice(0, 4).map((article: Article) => article.slug);
  const highlight = typeof raw?.highlightSlug === "string" ? raw.highlightSlug : featured[0];

  const navigation: Navigation = {
    primary: Array.isArray(raw?.navigation?.primary)
      ? raw.navigation.primary
      : [
          { label: "Crónicas", href: "/cronicas" },
          { label: "Experiencias", href: "/experiencias" },
          { label: "Noticias", href: "/noticias" },
          { label: "Podcast", href: "/podcast" }
        ],
    secondary: Array.isArray(raw?.navigation?.secondary)
      ? raw.navigation.secondary
      : [
          { label: "Newsletter", href: "/newsletter" },
          { label: "Contacto", href: "/contacto" },
          { label: "Colabora", href: "/colabora" }
        ]
  };

  return {
    hero: {
      title: raw?.hero?.title ?? "Relatos ocultos, experiencias imposibles",
      description:
        raw?.hero?.description ??
        "La hermandad de The Covenant recopila investigaciones, crónicas y proyectos de narrativa inmersiva.",
      cta: raw?.hero?.cta ?? { label: "Explorar relatos", href: "/cronicas" }
    },
    highlight: highlight ?? articles[0].slug,
    articles,
    featured,
    navigation
  };
}

async function loadContentFromDatabase(): Promise<SiteContent | null> {
  if (!DATABASE_CONTENT_ENABLED) {
    return null;
  }

  try {
    const [settings, articles] = await Promise.all([
      prisma.siteSettings.findUnique({ where: { id: "default" } }),
      prisma.article.findMany({
        orderBy: [
          { publishedAt: "desc" },
          { createdAt: "desc" }
        ]
      })
    ]);

    if (!settings || articles.length === 0) {
      return null;
    }

    const heroCandidate = settings.hero as any;
    const hero =
      isRecord(heroCandidate) && typeof heroCandidate.title === "string" && typeof heroCandidate.description === "string"
        ? {
            title: heroCandidate.title,
            description: heroCandidate.description,
            cta:
              isRecord(heroCandidate.cta) &&
              typeof heroCandidate.cta.label === "string" &&
              typeof heroCandidate.cta.href === "string"
                ? { label: heroCandidate.cta.label, href: heroCandidate.cta.href }
                : undefined
          }
        : fallbackContent.hero;

    const navigationCandidate = settings.navigation as any;
    const buildNavigationGroup = (group: any): Array<{ label: string; href: string }> => {
      if (!Array.isArray(group)) {
        return [];
      }

      return group
        .filter((item: unknown): item is { label: string; href: string } =>
          isRecord(item) && typeof item.label === "string" && typeof item.href === "string"
        )
        .map((item) => ({ label: item.label, href: item.href }));
    };

    const navigation: Navigation = {
      primary: buildNavigationGroup(navigationCandidate?.primary),
      secondary: buildNavigationGroup(navigationCandidate?.secondary)
    };

    if (navigation.primary.length === 0) {
      navigation.primary = [...fallbackContent.navigation.primary];
    }
    if (navigation.secondary.length === 0) {
      navigation.secondary = [...fallbackContent.navigation.secondary];
    }

    const normalisedArticles: Article[] = articles.map((article) => parseDbArticle(article));

    if (normalisedArticles.length === 0) {
      return null;
    }

    let featured = settings.featuredSlugs.length > 0
      ? [...settings.featuredSlugs]
      : normalisedArticles.slice(0, 4).map((article) => article.slug);
    const highlight = settings.highlightSlug ?? featured[0] ?? normalisedArticles[0].slug;

    if (highlight && !featured.includes(highlight)) {
      featured = [highlight, ...featured];
    }

    return {
      hero,
      highlight,
      articles: normalisedArticles,
      featured,
      navigation
    };
  } catch (error) {
    console.warn("No se pudo cargar contenido desde la base de datos:", error);
    return null;
  }
}

async function loadExternalContentAsync(): Promise<SiteContent | null> {
  try {
    const databaseContent = await loadContentFromDatabase();
    if (databaseContent) {
      return databaseContent;
    }

    const resolvedUrl = resolveExportUrl(CONTENT_EXPORT_URL);
    const raw =
      (resolvedUrl ? await loadExportFromUrl(resolvedUrl) : null) ?? (await loadExportFromFilesystem());

    if (!raw) {
      return null;
    }

    return buildSiteContent(raw);
  } catch (error) {
    console.error("No se pudo cargar el export del scraper:", error);
    return null;
  }
}

function resolveExportUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    if (CONTENT_EXPORT_BASE_URL) {
      try {
        return new URL(url, CONTENT_EXPORT_BASE_URL).toString();
      } catch (error) {
        console.warn("No se pudo resolver CONTENT_EXPORT_URL relativo:", error);
        return null;
      }
    }
    console.warn("Define CONTENT_EXPORT_BASE_URL o NEXT_PUBLIC_SITE_URL para usar CONTENT_EXPORT_URL relativo.");
    return null;
  }

  try {
    return new URL(url).toString();
  } catch (error) {
    console.warn("CONTENT_EXPORT_URL no es una URL válida:", error);
    return null;
  }
}

/**
 * Async getter that loads external content once and caches it.
 */
async function getContentAsync(): Promise<SiteContent> {
  if (cachedContent) return cachedContent;
  if (!loadedOnce) {
    const loaded = await loadExternalContentAsync();
    cachedContent = loaded ?? fallbackContent;
    loadedOnce = true;
  }
  return cachedContent ?? fallbackContent;
}

function getContent(): SiteContent {
  if (cachedContent) {
    return cachedContent;
  }

  // If external content wasn't loaded yet, return fallback synchronously to avoid blocking imports.
  // Server components should call the async getters when they need fresh content.
  return fallbackContent;
}

export function getSiteContent(): SiteContent {
  return getContent();
}

export function getNavigation(): Navigation {
  return getContent().navigation;
}

export function getHero() {
  return getContent().hero;
}

export function getHighlightArticle(): Article | undefined {
  const content = getContent();
  return content.articles.find((article) => article.slug === content.highlight);
}

export function getFeaturedArticles(): Article[] {
  const content = getContent();
  const bySlug = new Map(content.articles.map((article) => [article.slug, article]));
  return content.featured
    .map((slug) => bySlug.get(slug))
    .filter((article: Article | undefined): article is Article => Boolean(article));
}

export function getAllArticles(): Article[] {
  return getContent().articles;
}

export function getArticleBySlug(slug: string): Article | undefined {
  const normalised = slug.replace(/^\//, "");
  return getContent().articles.find((article) => article.slug === normalised);
}

// Async equivalents - prefer these in server components to avoid sync FS reads during import
export async function getSiteContentAsync(): Promise<SiteContent> {
  return await getContentAsync();
}

export async function getNavigationAsync(): Promise<Navigation> {
  return (await getContentAsync()).navigation;
}

export async function getHeroAsync() {
  return (await getContentAsync()).hero;
}

export async function getHighlightArticleAsync(): Promise<Article | undefined> {
  const content = await getContentAsync();
  return content.articles.find((article) => article.slug === content.highlight);
}

export async function getFeaturedArticlesAsync(): Promise<Article[]> {
  const content = await getContentAsync();
  const bySlug = new Map(content.articles.map((article) => [article.slug, article]));
  return content.featured
    .map((slug) => bySlug.get(slug))
    .filter((article: Article | undefined): article is Article => Boolean(article));
}

export async function getAllArticlesAsync(): Promise<Article[]> {
  return (await getContentAsync()).articles;
}

export async function getArticleBySlugAsync(slug: string): Promise<Article | undefined> {
  const normalised = slug.replace(/^\//, "");
  return (await getContentAsync()).articles.find((article) => article.slug === normalised);
}
