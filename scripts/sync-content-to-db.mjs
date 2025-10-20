#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

const EXPORT_FILENAME = "thecovenant-export-formatted.json";
const prisma = new PrismaClient();

function normalizeImageUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, "_");
    const pathname = urlObj.pathname;

    const match = pathname.match(/\/([^/]+)\.(\w+)$/);
    if (match) {
      const [, filename, ext] = match;
      return `/images/${hostname}/${filename}_${ext}.${ext}`;
    }
  } catch (error) {
    // ignorar y devolver original
  }
  return url;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normaliseSections(entry) {
  const sections = [];

  if (Array.isArray(entry?.sections)) {
    for (const section of entry.sections) {
      if (typeof section === "string") {
        sections.push({ type: "paragraph", text: section });
        continue;
      }

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

      if (section?.type === "heading" && typeof section?.text === "string") {
        sections.push({ type: "heading", text: section.text });
        continue;
      }

      if (section?.type === "paragraph" && typeof section?.text === "string") {
        sections.push({ type: "paragraph", text: section.text });
        continue;
      }

      if (section?.type === "quote" && typeof section?.text === "string") {
        sections.push({ type: "quote", text: section.text });
        continue;
      }

      if ((section?.type === "html" || section?.type === "embed") && typeof section?.html === "string") {
        sections.push({ type: "embed", html: section.html });
        continue;
      }

      if (typeof section?.html === "string") {
        sections.push({ type: "embed", html: section.html });
      }
    }
  }

  if (sections.length === 0 && typeof entry?.content === "string") {
    entry.content
      .split(/\n\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .forEach((paragraph) => sections.push({ type: "paragraph", text: paragraph }));
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

  if (sections.length === 0 && Array.isArray(entry?.paragraphs)) {
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

    entry.paragraphs
      .filter((p) => typeof p === "string" && p.trim().length > 0)
      .forEach((p) => sections.push({ type: "paragraph", text: p }));

    if (Array.isArray(entry?.images) && entry.images.length > 1) {
      entry.images
        .slice(1)
        .filter((img) => img?.src && typeof img.src === "string")
        .forEach((img) => {
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
    sections.push({ type: "paragraph", text: "Contenido no disponible temporalmente." });
  }

  return sections;
}

function normaliseArticle(page) {
  const slugCandidate = page?.slug ?? page?.path ?? page?.url;
  if (!slugCandidate || typeof slugCandidate !== "string") {
    return null;
  }

  const normalisedSlug = slugCandidate.replace(/^https?:\/\/(www\.)?thecovenant\.es\//, "").replace(/^\//, "");

  let coverImage;

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

function buildSiteContent(raw) {
  const pages = Array.isArray(raw?.pages) ? raw.pages : [];
  const articles = pages
    .map((page) => normaliseArticle(page))
    .filter((article) => article && article.slug);

  if (articles.length === 0) {
    return null;
  }

  const featured = Array.isArray(raw?.featuredSlugs)
    ? raw.featuredSlugs
    : articles.slice(0, 4).map((article) => article.slug);
  const highlight = typeof raw?.highlightSlug === "string" ? raw.highlightSlug : featured[0];

  const navigation = {
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

async function loadExportFromFilesystem(explicitPath) {
  const candidates = new Set();

  if (explicitPath) {
    candidates.add(path.resolve(explicitPath));
  }

  const cwd = process.cwd();
  candidates.add(path.join(cwd, "public", EXPORT_FILENAME));
  candidates.add(path.join(cwd, "data", EXPORT_FILENAME));

  for (const candidate of candidates) {
    try {
      const rawTxt = await fs.readFile(candidate, "utf-8");
      return JSON.parse(rawTxt);
    } catch (error) {
      if (error?.code === "ENOENT") {
        continue;
      }
      throw new Error(`No se pudo leer el export desde ${candidate}: ${error.message}`);
    }
  }

  throw new Error(
    `No se encontró el export formateado. Define CONTENT_EXPORT_PATH o coloca ${EXPORT_FILENAME} en public/ o data/.`
  );
}

function computeChecksum(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function syncContent(siteContent) {
  const existingArticles = await prisma.article.findMany({
    select: { id: true, slug: true, contentHash: true }
  });
  const existingBySlug = new Map(existingArticles.map((article) => [article.slug, article]));
  const seenSlugs = new Set();

  for (const article of siteContent.articles) {
    if (!article?.slug) {
      continue;
    }

    let publishedAt = null;
    if (article.publishedAt) {
      const candidate = new Date(article.publishedAt);
      if (!Number.isNaN(candidate.valueOf())) {
        publishedAt = candidate;
      }
    }

    const payload = {
      slug: article.slug,
      title: article.title,
      description: article.description ?? null,
      excerpt: article.excerpt ?? null,
      coverImageUrl: article.coverImage?.url ?? null,
      coverImageAlt: article.coverImage?.alt ?? null,
      category: article.category ?? null,
      tags: JSON.stringify(Array.isArray(article.tags) ? article.tags : []),
      publishedAt,
      readingTime: article.readingTime ?? null,
      sections: JSON.stringify(article.sections),
      escapeRoomGeneralData: article.escapeRoomGeneralData ? JSON.stringify(article.escapeRoomGeneralData) : null,
      escapeRoomScoring: article.escapeRoomScoring ? JSON.stringify(article.escapeRoomScoring) : null
    };
    const revisionPayload = {
      ...payload,
      publishedAt: payload.publishedAt ? payload.publishedAt.toISOString() : null
    };

    const checksum = computeChecksum(revisionPayload);
    const existing = existingBySlug.get(article.slug);

    if (existing && existing.contentHash === checksum) {
      seenSlugs.add(article.slug);
      continue;
    }

    const record = await prisma.article.upsert({
      where: { slug: article.slug },
      update: {
        title: payload.title,
        description: payload.description,
        excerpt: payload.excerpt,
        coverImageUrl: payload.coverImageUrl,
        coverImageAlt: payload.coverImageAlt,
        category: payload.category,
        tags: payload.tags,
        publishedAt: payload.publishedAt,
        readingTime: payload.readingTime,
        sections: payload.sections,
        escapeRoomGeneralData: payload.escapeRoomGeneralData,
        escapeRoomScoring: payload.escapeRoomScoring,
        contentHash: checksum
      },
      create: {
        slug: payload.slug,
        title: payload.title,
        description: payload.description,
        excerpt: payload.excerpt,
        coverImageUrl: payload.coverImageUrl,
        coverImageAlt: payload.coverImageAlt,
        category: payload.category,
        tags: payload.tags,
        publishedAt: payload.publishedAt,
        readingTime: payload.readingTime,
        sections: payload.sections,
        escapeRoomGeneralData: payload.escapeRoomGeneralData,
        escapeRoomScoring: payload.escapeRoomScoring,
        contentHash: checksum
      }
    });

    await prisma.articleRevision.create({
      data: {
        articleId: record.id,
        checksum,
        data: JSON.stringify(revisionPayload)
      }
    });

    seenSlugs.add(article.slug);
  }

  const obsolete = existingArticles
    .map((article) => article.slug)
    .filter((slug) => !seenSlugs.has(slug));

  if (obsolete.length > 0) {
    await prisma.article.deleteMany({ where: { slug: { in: obsolete } } });
  }

  const settingsPayload = {
    hero: JSON.stringify(siteContent.hero),
    highlightSlug: siteContent.highlight,
    featuredSlugs: JSON.stringify(siteContent.featured),
    navigation: JSON.stringify(siteContent.navigation)
  };
  const settingsChecksum = computeChecksum(settingsPayload);
  const existingSettings = await prisma.siteSettings.findUnique({ where: { id: "default" } });

  if (!existingSettings || existingSettings.contentHash !== settingsChecksum) {
    await prisma.siteSettings.upsert({
      where: { id: "default" },
      update: {
        hero: settingsPayload.hero,
        highlightSlug: settingsPayload.highlightSlug,
        featuredSlugs: settingsPayload.featuredSlugs,
        navigation: settingsPayload.navigation,
        contentHash: settingsChecksum
      },
      create: {
        id: "default",
        hero: settingsPayload.hero,
        highlightSlug: settingsPayload.highlightSlug,
        featuredSlugs: settingsPayload.featuredSlugs,
        navigation: settingsPayload.navigation,
        contentHash: settingsChecksum
      }
    });
  }
}

async function main() {
  const explicitPathArg = process.argv.find((arg) => arg.startsWith("--export="));
  const explicitPath = explicitPathArg ? explicitPathArg.split("=").slice(1).join("=") : process.env.CONTENT_EXPORT_PATH;

  const raw = await loadExportFromFilesystem(explicitPath);
  const siteContent = buildSiteContent(raw);

  if (!siteContent) {
    throw new Error("El export no contiene artículos válidos. Nada que sincronizar.");
  }

  await syncContent(siteContent);

  console.log(`Sincronización completada: ${siteContent.articles.length} artículos y navegación actualizada.`);
}

main()
  .catch((error) => {
    console.error("Fallo al sincronizar contenido:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
