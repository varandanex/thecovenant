import fs from "node:fs/promises";
import path from "node:path";
import type { Article, ContentSection, Navigation, SiteContent } from "./types";

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

function normaliseSections(entry: any): ContentSection[] {
  const sections: ContentSection[] = [];

  if (Array.isArray(entry?.sections)) {
    for (const section of entry.sections) {
      if (typeof section === "string") {
        sections.push({ type: "paragraph", text: section });
      } else if (section?.type === "image" && typeof section?.src === "string") {
        sections.push({ type: "image", url: section.src, alt: section.alt, caption: section.caption });
      } else if (section?.type === "heading" && typeof section?.text === "string") {
        sections.push({ type: "heading", text: section.text });
      } else if (section?.type === "quote" && typeof section?.text === "string") {
        sections.push({ type: "quote", text: section.text });
      } else if (section?.type === "html" && typeof section?.html === "string") {
        sections.push({ type: "embed", html: section.html });
      } else if (typeof section?.html === "string") {
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
        sections.push({ type: "image", url: block.url, alt: block.alt, caption: block.caption });
      } else if (block?.type === "quote") {
        sections.push({ type: "quote", text: block.text ?? "" });
      }
    }
  }

  if (sections.length === 0 && typeof entry?.html === "string") {
    sections.push({ type: "embed", html: entry.html });
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

  return {
    slug: normalisedSlug.length === 0 ? "" : normalisedSlug,
    title: page?.title ?? page?.metaTitle ?? "Sin título",
    description: page?.description ?? page?.excerpt,
    excerpt: page?.excerpt ?? page?.description,
    coverImage: page?.heroImage
      ? { url: page.heroImage?.url ?? page.heroImage?.src ?? "", alt: page.heroImage?.alt ?? undefined }
      : page?.coverImage
        ? { url: page.coverImage?.url ?? "", alt: page.coverImage?.alt ?? undefined }
        : undefined,
    category: page?.category ?? page?.section ?? undefined,
    tags: Array.isArray(page?.tags) ? page.tags : undefined,
    publishedAt: page?.publishedAt ?? page?.date ?? undefined,
    readingTime: page?.readingTime ?? page?.meta?.readingTime ?? undefined,
    sections: normaliseSections(page)
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

async function loadExternalContentAsync(): Promise<SiteContent | null> {
  try {
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

const fallbackContent: SiteContent = {
  hero: {
    title: "Una nueva era para The Covenant",
    description:
      "Reimaginamos el archivo oscuro del colectivo con un diseño minimalista, inspirado en la estética original y enfocado en la lectura.",
    cta: { label: "Entrar al archivo", href: "/cronicas" }
  },
  highlight: "cronicas/el-umbral",
  featured: ["cronicas/el-umbral", "experiencias/la-llamada", "noticias/aniversario", "podcast/episodio-ritual"],
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
  },
  articles: [
    {
      slug: "cronicas/el-umbral",
      title: "Crónica: El Umbral",
      description: "Los susurros que se filtran desde la habitación sellada del convento abandonado.",
      excerpt:
        "La noche en que abrimos El Umbral aprendimos que algunos acertijos no quieren ser resueltos. Esta es la bitácora de aquella incursión.",
      coverImage: {
        url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        alt: "Pasillo oscuro iluminado por luces violetas"
      },
      category: "Crónicas",
      tags: ["investigación", "horror"],
      publishedAt: "2023-10-12",
      readingTime: "8 min",
      sections: [
        {
          type: "paragraph",
          text: "Entramos pasada la medianoche. Las cámaras infrarrojas revelaban siluetas que no debían estar allí y las claves encontradas en el archivo antiguo se reordenaban solas sobre la mesa."
        },
        {
          type: "quote",
          text: "El Umbral no es una puerta, es un trato."
        },
        {
          type: "paragraph",
          text: "Documentamos cada paso con grabadoras analógicas y un mapa trazado a mano. Los símbolos coincidían con los de la web original, confirmando la conexión con los relatos de The Covenant."
        }
      ]
    },
    {
      slug: "experiencias/la-llamada",
      title: "Experiencia: La llamada",
      description: "Un recorrido telefónico por voces que no pertenecen a nuestro tiempo.",
      excerpt:
        "Durante 45 minutos respondemos a una serie de llamadas que reconstruyen la desaparición de un iniciad@. Cada llamada abre una capa más profunda de la historia.",
      coverImage: {
        url: "https://images.unsplash.com/photo-1526378722484-bd91ca387e72?auto=format&fit=crop&w=1200&q=80",
        alt: "Cabina telefónica iluminada en morado"
      },
      category: "Experiencias",
      tags: ["juego", "audio"],
      publishedAt: "2024-02-05",
      readingTime: "6 min",
      sections: [
        {
          type: "paragraph",
          text: "Los participantes reciben instrucciones codificadas en la web original. Cada llamada desbloquea fragmentos de audio y pistas que deben interpretar en tiempo real."
        },
        {
          type: "paragraph",
          text: "El rediseño del front permite destacar la cronología, mostrar mapas interactivos y facilitar la suscripción a futuras sesiones." 
        }
      ]
    },
    {
      slug: "noticias/aniversario",
      title: "Noticias: Séptimo aniversario",
      description: "Celebramos siete años de investigaciones colectivas.",
      excerpt:
        "Lanzamos nuevo archivo digital, calendario de eventos híbridos y un repositorio para colaboradores internacionales.",
      coverImage: {
        url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80",
        alt: "Grupo celebrando en un espacio oscuro"
      },
      category: "Noticias",
      tags: ["evento", "comunidad"],
      publishedAt: "2024-06-01",
      readingTime: "4 min",
      sections: [
        {
          type: "paragraph",
          text: "El aniversario se celebrará con una transmisión en directo desde el sancta sanctorum del colectivo. Se presentará el nuevo front construido con Next.js, inspirado en el diseño original."
        },
        {
          type: "paragraph",
          text: "La comunidad podrá descargar recursos, acceder a la agenda y colaborar en futuros proyectos cross-media." 
        }
      ]
    },
    {
      slug: "podcast/episodio-ritual",
      title: "Podcast: Ritual de apertura",
      description: "Primer episodio del podcast con testimonios del equipo de campo.",
      excerpt:
        "Rescatamos grabaciones inéditas de la investigación sobre el monasterio en ruinas. Disponible en todas las plataformas.",
      coverImage: {
        url: "https://images.unsplash.com/photo-1453873531674-2151bcd01707?auto=format&fit=crop&w=1200&q=80",
        alt: "Grabadora antigua con luces moradas"
      },
      category: "Podcast",
      tags: ["audio", "entrevista"],
      publishedAt: "2024-04-18",
      readingTime: "5 min",
      sections: [
        {
          type: "paragraph",
          text: "El episodio combina paisajes sonoros originales con entrevistas a los guardianes de archivos. El rediseño destaca los reproductores embebidos y las notas del episodio."
        }
      ]
    }
  ]
};

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
