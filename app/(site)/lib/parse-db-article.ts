import type { Article, ContentSection, EscapeRoomGeneralData, EscapeRoomScoring } from "./types";
function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeImageUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, "_");
    const pathname = urlObj.pathname;
    const match = pathname.match(/\/([^/]+)\.(\w+)$/);
    if (match) {
      const [, filename, ext] = match;
      return `/images/${hostname}/${filename}_${ext}.${ext}`;
    }
  } catch {}
  return url;
}

/**
 * Parsea un registro de la tabla Article (Prisma) a la forma Article del sitio.
 * Acepta strings JSON en campos sections, tags, escapeRoomGeneralData, escapeRoomScoring.
 */
export function parseDbArticle(article: any): Article {
  let sections: ContentSection[] = [];
  if (Array.isArray(article.sections)) {
    sections = article.sections as ContentSection[];
  } else if (typeof article.sections === "string") {
    try {
      const parsed = JSON.parse(article.sections);
      if (Array.isArray(parsed)) sections = parsed as ContentSection[];
    } catch {}
  }
  if (sections.length === 0) {
    sections = [{ type: "paragraph", text: "Contenido no disponible temporalmente." }];
  }

  let tags: string[] | undefined = undefined;
  if (Array.isArray(article.tags)) {
    tags = article.tags.filter((t: any) => typeof t === "string");
  } else if (typeof article.tags === "string" && article.tags.trim().length > 0) {
    try {
      const parsedTags = JSON.parse(article.tags);
      if (Array.isArray(parsedTags)) {
        tags = parsedTags.filter((t) => typeof t === "string");
      }
    } catch {}
  }

  let escapeRoomGeneralData: EscapeRoomGeneralData | undefined = undefined;
  if (isRecord(article.escapeRoomGeneralData)) {
    escapeRoomGeneralData = article.escapeRoomGeneralData as EscapeRoomGeneralData;
  } else if (typeof article.escapeRoomGeneralData === "string") {
    try {
      const parsed = JSON.parse(article.escapeRoomGeneralData);
      if (isRecord(parsed)) escapeRoomGeneralData = parsed as EscapeRoomGeneralData;
    } catch {}
  }

  let escapeRoomScoring: EscapeRoomScoring | undefined = undefined;
  if (isRecord(article.escapeRoomScoring)) {
    escapeRoomScoring = article.escapeRoomScoring as EscapeRoomScoring;
  } else if (typeof article.escapeRoomScoring === "string") {
    try {
      const parsed = JSON.parse(article.escapeRoomScoring);
      if (isRecord(parsed)) escapeRoomScoring = parsed as EscapeRoomScoring;
    } catch {}
  }

  return {
    slug: article.slug,
    title: article.title,
    description: article.description ?? undefined,
    excerpt: article.excerpt ?? undefined,
    coverImage: article.coverImageUrl
      ? {
          url: normalizeImageUrl(article.coverImageUrl),
          alt: article.coverImageAlt ?? undefined
        }
      : undefined,
    category: article.category ?? undefined,
    tags,
    publishedAt: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
    readingTime: article.readingTime ?? undefined,
    sections,
    escapeRoomGeneralData,
    escapeRoomScoring
  };
}
