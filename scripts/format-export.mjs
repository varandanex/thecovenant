import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(ROOT_DIR, 'data', 'thecovenant-export.json');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'thecovenant-export-formatted.json');

const WORDS_PER_MINUTE = 180;
const STOP_HEADING_PATTERNS = [
  'ultimos posts',
  'contacta',
  'suscribete',
  'newsletter',
  'instagram',
  'facebook',
  'twitter',
  'youtube',
  'twitch'
];

function normalizeWhitespace(value) {
  if (typeof value !== 'string') return value ?? null;
  return value.replace(/\s+/g, ' ').trim() || null;
}

function normalizeForComparison(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripHtml(html) {
  if (typeof html !== 'string') return html ?? null;
  const withoutTags = html.replace(/<[^>]+>/g, ' ');
  return decodeEntities(withoutTags);
}

function decodeEntities(text) {
  if (typeof text !== 'string') return text ?? null;
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>'
  };
  return text.replace(/&(nbsp|amp|quot|#39|lt|gt);/g, match => entities[match] ?? match);
}

function flattenOutline(outline = []) {
  const result = [];

  const visit = (nodes = []) => {
    for (const node of nodes) {
      const text = normalizeWhitespace(node?.text);
      if (text) {
        result.push({ level: node.level ?? null, text });
      }
      if (node?.children?.length) {
        visit(node.children);
      }
    }
  };

  visit(outline);
  return result;
}

function splitTextContent(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/\n+/)
    .map(chunk => normalizeWhitespace(decodeEntities(chunk)))
    .filter(Boolean);
}

function simplifyImages(images = []) {
  const seen = new Set();
  const result = [];

  for (const image of images) {
    const src = image?.src ?? null;
    if (!src || seen.has(src)) continue;
    seen.add(src);

    const payload = {
      src,
      alt: normalizeWhitespace(image?.alt),
      title: normalizeWhitespace(image?.title)
    };

    result.push(pruneEmpty(payload));
  }

  return result;
}

function categorizeLinks(links = []) {
  const internal = [];
  const external = [];
  const seen = new Set();

  for (const link of links) {
    const payload = {
      href: link?.href ?? link?.normalizedHref ?? null,
      text: normalizeWhitespace(link?.text) ?? null,
      title: normalizeWhitespace(link?.title) ?? null
    };

    if (!payload.href) continue;

    const dedupeKey = `${payload.href}::${payload.text ?? ''}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    if (link?.internal === false || /^https?:\/\//i.test(payload.href) && !payload.href.includes('thecovenant.es')) {
      external.push(payload);
    } else {
      internal.push(payload);
    }
  }

  return { internal, external };
}

function summarizeJsonLd(jsonLd = []) {
  return jsonLd
    .map(entry => {
      const type = Array.isArray(entry?.['@type']) ? entry['@type'].join(', ') : entry?.['@type'] ?? null;
      const name = normalizeWhitespace(entry?.name ?? entry?.headline);
      const description = normalizeWhitespace(entry?.description);
      const url = entry?.url ?? entry?.['@id'] ?? null;

      const summary = { type, name, description, url };
      return pruneEmpty(summary);
    })
    .filter(item => Object.keys(item).length > 0);
}

function simplifySections(sections = []) {
  return sections
    .map(section => {
      const text = normalizeWhitespace(section?.text) ?? normalizeWhitespace(stripHtml(section?.html ?? '')) ?? null;
      const images = extractImageSources(section?.html ?? '');
      const data = {
        id: section?.id ?? null,
        className: section?.className ?? null,
        text,
        images: images.length ? images : null
      };
      return pruneEmpty(data);
    })
    .filter(section => Object.keys(section).length > 0);
}

function isHeadingTag(tag) {
  if (typeof tag !== 'string') return false;
  return /^h[1-6]$/i.test(tag);
}

function isBreadcrumbBlock(block) {
  const tag = typeof block?.tag === 'string' ? block.tag.toLowerCase() : null;
  if (tag !== 'ul') return false;
  const text = normalizeForComparison(block?.text ?? '');
  if (!text) return false;
  return text.startsWith('home /');
}

function shouldStopAtBlock(block) {
  if (!isHeadingTag(block?.tag)) return false;
  const normalized = normalizeForComparison(block?.text);
  if (!normalized) return false;
  return STOP_HEADING_PATTERNS.some(pattern => normalized.includes(pattern));
}

function extractMainContentBlocks(page) {
  const blocks = Array.isArray(page?.contentBlocks) ? page.contentBlocks : [];
  if (blocks.length === 0) return [];

  let startIndex = blocks.findIndex(block => isHeadingTag(block?.tag) && normalizeWhitespace(block?.text));
  if (startIndex === -1) {
    startIndex = blocks.findIndex(block => normalizeWhitespace(block?.text));
    if (startIndex === -1) return [];
  }

  const sliced = blocks.slice(startIndex);
  let endIndex = sliced.length;

  for (let index = 1; index < sliced.length; index += 1) {
    if (shouldStopAtBlock(sliced[index])) {
      endIndex = index;
      break;
    }
  }

  return sliced.slice(0, endIndex);
}

function buildHtmlFromBlocks(blocks = []) {
  return blocks
    .filter(block => !isBreadcrumbBlock(block))
    .map(block => block?.html ?? '')
    .filter(Boolean)
    .join('\n');
}

function extractParagraphsFromBlocks(blocks = []) {
  const paragraphs = [];

  for (const block of blocks) {
    const tag = typeof block?.tag === 'string' ? block.tag.toLowerCase() : null;
    if (isHeadingTag(tag)) continue;
    if (isBreadcrumbBlock(block)) continue;

    if ((tag === 'p' || tag === 'blockquote' || tag === 'pre') && block?.text) {
      const normalized = normalizeWhitespace(block.text);
      if (normalized) paragraphs.push(normalized);
      continue;
    }

    if ((tag === 'ul' || tag === 'ol') && Array.isArray(block?.items)) {
      for (const item of block.items) {
        const normalized = normalizeWhitespace(item);
        if (normalized) paragraphs.push(normalized);
      }
    }
  }

  return paragraphs;
}

function buildHtmlSearchTokens(value) {
  if (!value) return [];

  const tokens = new Set();
  tokens.add(value);

  const escaped = value.replace(/&/g, '&amp;');
  tokens.add(escaped);

  const addUrlVariants = raw => {
    if (!raw) return;
    tokens.add(raw);
    tokens.add(raw.replace(/&/g, '&amp;'));
    try {
      const decoded = decodeURIComponent(raw);
      tokens.add(decoded);
      tokens.add(decoded.replace(/&/g, '&amp;'));
    } catch {
      // ignore malformed URI sequences
    }
  };

  if (/^https?:/i.test(value)) {
    try {
      const url = new URL(value);
      const pathWithQuery = url.pathname + (url.search || '');
      addUrlVariants(pathWithQuery);
      addUrlVariants(`${url.origin}${pathWithQuery}`);
    } catch {
      // ignore invalid URLs
    }
  } else if (value.startsWith('//')) {
    try {
      const url = new URL(`https:${value}`);
      const pathWithQuery = url.pathname + (url.search || '');
      addUrlVariants(pathWithQuery);
      addUrlVariants(`${url.origin}${pathWithQuery}`);
    } catch {
      // ignore invalid protocol-relative URLs
    }
  } else if (value.startsWith('/')) {
    addUrlVariants(value);
  }

  return Array.from(tokens);
}

function attributeValueInHtml(html, attribute, value) {
  if (!html || !attribute || !value) return false;
  const tokens = buildHtmlSearchTokens(value);

  return tokens.some(token => {
    if (!token) return false;
    return html.includes(`${attribute}="${token}"`) || html.includes(`${attribute}='${token}'`);
  });
}

function filterImagesForBlocks(images = [], contentHtml = '') {
  if (!images.length || !contentHtml) return [];
  return images.filter(image => attributeValueInHtml(contentHtml, 'src', image?.src ?? image?.dataSrc ?? null));
}

function filterLinksForBlocks(links = [], contentHtml = '') {
  if (!links.length || !contentHtml) return [];
  return links.filter(link => attributeValueInHtml(contentHtml, 'href', link?.href ?? link?.normalizedHref ?? null));
}

function normalizePageUrl(page, primaryUrl) {
  const rawUrl = page?.canonicalUrl ?? page?.url ?? null;
  const fallbackUrl = page?.url ?? null;

  if (!rawUrl && !fallbackUrl) {
    return { url: null, sourceUrl: null };
  }

  const primary = (() => {
    try {
      return primaryUrl ? new URL(primaryUrl) : null;
    } catch {
      return null;
    }
  })();

  const resolve = (value) => {
    try {
      if (primary) {
        return new URL(value, primary.toString());
      }
      if (fallbackUrl && /^https?:/i.test(fallbackUrl)) {
        return new URL(value, fallbackUrl);
      }
      return new URL(value);
    } catch {
      return null;
    }
  };

  const resolved = resolve(rawUrl ?? fallbackUrl);
  if (!resolved) {
    return {
      url: rawUrl ?? fallbackUrl ?? null,
      sourceUrl: null
    };
  }

  if (primary && resolved.hostname.replace(/^www\./, '') === primary.hostname.replace(/^www\./, '')) {
    resolved.protocol = primary.protocol;
    resolved.hostname = primary.hostname;
  }

  const normalizedUrl = resolved.toString();
  const sourceUrl = fallbackUrl && fallbackUrl !== normalizedUrl ? fallbackUrl : null;

  return { url: normalizedUrl, sourceUrl };
}

function pagePreferenceScore(page, primaryHost) {
  const url = typeof page?.url === 'string' ? page.url : '';
  let score = 0;

  if (url.startsWith('https://')) score += 2;
  if (url.startsWith('http://')) score += 1;
  if (url.includes('www.')) score += 1;

  if (primaryHost) {
    try {
      const hostname = new URL(url).hostname;
      if (hostname.replace(/^www\./, '') === primaryHost.replace(/^www\./, '')) {
        score += 1;
      }
    } catch {
      // ignore invalid URLs
    }
  }

  if (page?.status === 200) score += 1;

  return score;
}

function extractImageSources(html) {
  if (typeof html !== 'string' || !html.includes('<img')) return [];
  const regex = /<img[^>]*src=["']([^"'>]+)["'][^>]*>/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

function pruneEmpty(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.length > 0;
      return true;
    })
  );
}

function estimateReadingTime(wordCount) {
  if (!wordCount) return null;
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

function formatPage(page, options = {}) {
  const mainBlocks = extractMainContentBlocks(page);
  let paragraphs = extractParagraphsFromBlocks(mainBlocks);

  if (paragraphs.length === 0) {
    paragraphs = splitTextContent(page?.textContent ?? '');
  }

  const contentHtml = buildHtmlFromBlocks(mainBlocks);
  const filteredImages = filterImagesForBlocks(page?.images ?? [], contentHtml);
  const filteredLinks = filterLinksForBlocks(page?.links ?? [], contentHtml);

  const wordCount = paragraphs.reduce((total, paragraph) => total + paragraph.split(/\s+/).filter(Boolean).length, 0);
  const { url, sourceUrl } = normalizePageUrl(page, options.primaryUrl);

  const headings = flattenOutline(page?.outline ?? []);
  const images = simplifyImages(filteredImages);
  const links = categorizeLinks(filteredLinks);
  const jsonLd = summarizeJsonLd(page?.jsonLd ?? []);
  const sections = simplifySections(page?.sections ?? []);

  const payload = {
    url,
    sourceUrl,
    status: page?.status ?? null,
    fetchedAt: page?.fetchedAt ?? null,
    contentType: page?.contentType ?? null,
    title: normalizeWhitespace(page?.title),
    metaDescription: normalizeWhitespace(page?.metaDescription),
    language: normalizeWhitespace(page?.language),
    wordCount: wordCount || null,
    readingTimeMinutes: estimateReadingTime(wordCount),
    headings,
    sections,
    paragraphs,
    images,
    links,
    jsonLd
  };

  return pruneEmpty(payload);
}

function formatAsset(page, options = {}) {
  const { url, sourceUrl } = normalizePageUrl(page, options.primaryUrl);
  const payload = {
    url,
    sourceUrl,
    status: page?.status ?? null,
    fetchedAt: page?.fetchedAt ?? null,
    contentType: page?.contentType ?? null,
    contentLength: page?.contentLength ?? null,
    title: normalizeWhitespace(page?.title)
  };
  return pruneEmpty(payload);
}

async function run() {
  try {
    const raw = await readFile(INPUT_PATH, 'utf8');
    const exportData = JSON.parse(raw);

    if (!Array.isArray(exportData?.pages)) {
      throw new Error('El archivo de exportación no contiene la propiedad "pages".');
    }

    const primaryUrl = exportData.startUrl ?? null;
    const primaryHost = (() => {
      try {
        return primaryUrl ? new URL(primaryUrl).hostname : null;
      } catch {
        return null;
      }
    })();
    const assetPages = [];
    const documentPages = [];

    for (const page of exportData.pages) {
      const contentType = typeof page?.contentType === 'string' ? page.contentType.toLowerCase() : '';
      if (contentType.startsWith('image/')) {
        assetPages.push(page);
      } else {
        documentPages.push(page);
      }
    }

    documentPages.sort((a, b) => pagePreferenceScore(b, primaryHost) - pagePreferenceScore(a, primaryHost));

    const dedupedPages = [];
    const pageByUrl = new Map();

    for (const page of documentPages) {
      const formatted = formatPage(page, { primaryUrl });
      const normalizedUrl = formatted.url ?? null;
      const rawUrl = typeof page?.url === 'string' ? page.url : null;

      const variantSources = new Set();
      if (formatted.sourceUrl && formatted.sourceUrl !== normalizedUrl) {
        variantSources.add(formatted.sourceUrl);
      }
      if (rawUrl && rawUrl !== normalizedUrl) {
        variantSources.add(rawUrl);
      }

      if (!normalizedUrl) {
        delete formatted.sourceUrl;
        if (variantSources.size > 0) {
          formatted.sourceUrls = Array.from(variantSources);
        }
        dedupedPages.push(formatted);
        continue;
      }

      const existing = pageByUrl.get(normalizedUrl);
      if (!existing) {
        delete formatted.sourceUrl;
        if (variantSources.size > 0) {
          formatted.sourceUrls = Array.from(variantSources);
        }
        dedupedPages.push(formatted);
        pageByUrl.set(normalizedUrl, formatted);
        continue;
      }

      const existingSources = new Set(existing.sourceUrls ?? []);
      for (const source of variantSources) {
        existingSources.add(source);
      }

      const candidate = { ...formatted };
      delete candidate.sourceUrl;
      if (existingSources.size > 0) {
        candidate.sourceUrls = Array.from(existingSources);
      }

      const existingStatus = existing.status ?? 0;
      const candidateStatus = candidate.status ?? 0;
      const existingWordCount = existing.wordCount ?? 0;
      const candidateWordCount = candidate.wordCount ?? 0;

      const shouldReplace =
        (existingStatus !== 200 && candidateStatus === 200) ||
        (candidateWordCount > existingWordCount);

      if (shouldReplace) {
        Object.assign(existing, candidate);
      } else if (existingSources.size > 0) {
        existing.sourceUrls = Array.from(existingSources);
      }
    }

    const formattedPages = dedupedPages;
    const formattedAssets = assetPages.map(page => formatAsset(page, { primaryUrl }));

    const formatted = {
      source: {
        startUrl: exportData.startUrl ?? null,
        crawledAt: exportData.crawledAt ?? null,
        totalPages: exportData.totalPages ?? null,
        settings: exportData.settings ?? null
      },
      generatedAt: new Date().toISOString(),
      pages: formattedPages
    };

    if (formattedAssets.length > 0) {
      formatted.assets = formattedAssets;
    }

    const cleaned = {
      ...formatted,
      source: pruneEmpty(formatted.source)
    };

    await writeFile(OUTPUT_PATH, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf8');
    console.log(`Export formateado guardado en ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
  } catch (error) {
    console.error('No se pudo formatear el export:', error.message);
    process.exitCode = 1;
  }
}

run();
