import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_PATH = path.join(ROOT_DIR, 'data', 'thecovenant-export.json');
const OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'thecovenant-export-formatted.json');
const DEFAULT_EXPORT_DIR = path.join(ROOT_DIR, 'data', 'exports');

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

const EVENT_SLUGS = new Set([
  'the-covenant-cases',
  'games-university',
  'gymkhana-literaria-litcon-madrid'
]);

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function ensureDirForFile(filePath) {
  await ensureDir(path.dirname(filePath));
}

async function writeJsonFile(filePath, payload) {
  await ensureDirForFile(filePath);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function writeNdjsonFile(filePath, records) {
  await ensureDirForFile(filePath);
  if (!Array.isArray(records) || records.length === 0) {
    await writeFile(filePath, '', 'utf8');
    return;
  }
  const lines = records.map(record => JSON.stringify(record));
  await writeFile(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function envFlag(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = raw.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

function envNumber(name, fallback = null) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) ? fallback : value;
}

function envList(name) {
  const raw = process.env[name];
  if (!raw) return null;
  return raw
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.toLowerCase());
}

function resolveOutDir(baseDir, target, fallback = DEFAULT_EXPORT_DIR) {
  if (!target) return fallback;
  return path.isAbsolute(target) ? target : path.resolve(baseDir, target);
}

function parseCliArgs(argv = []) {
  const defaults = {
    outDir: resolveOutDir(ROOT_DIR, process.env.SCRAPE_EXPORT_OUT_DIR, DEFAULT_EXPORT_DIR),
    emitNdjson: envFlag('SCRAPE_EXPORT_NDJSON', false),
    splitJson: envFlag('SCRAPE_EXPORT_SPLIT_JSON', false),
    minWords: envNumber('SCRAPE_EXPORT_MIN_WORDS', 0) ?? 0,
    includeTypes: (() => {
      const list = envList('SCRAPE_EXPORT_TYPES');
      return Array.isArray(list) && list.length ? new Set(list) : null;
    })()
  };

  const options = { ...defaults };

  const setTypes = value => {
    if (!value) {
      options.includeTypes = null;
      return;
    }
    const items = value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => item.toLowerCase());
    options.includeTypes = items.length ? new Set(items) : null;
  };

  const tokens = Array.from(argv ?? []);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.startsWith('--out-dir=')) {
      options.outDir = resolveOutDir(ROOT_DIR, token.split('=')[1]);
      continue;
    }
    if (token === '--out-dir') {
      const value = tokens[index + 1];
      if (value && !value.startsWith('--')) {
        options.outDir = resolveOutDir(ROOT_DIR, value);
        index += 1;
      }
      continue;
    }

    if (token === '--ndjson') {
      options.emitNdjson = true;
      continue;
    }
    if (token === '--no-ndjson') {
      options.emitNdjson = false;
      continue;
    }

    if (token === '--split-json') {
      options.splitJson = true;
      continue;
    }
    if (token === '--no-split-json') {
      options.splitJson = false;
      continue;
    }

    if (token.startsWith('--min-words=')) {
      const value = Number.parseInt(token.split('=')[1], 10);
      if (!Number.isNaN(value)) options.minWords = value;
      continue;
    }
    if (token === '--min-words') {
      const value = Number.parseInt(tokens[index + 1], 10);
      if (!Number.isNaN(value)) options.minWords = value;
      if (tokens[index + 1] && !tokens[index + 1].startsWith('--')) index += 1;
      continue;
    }

    if (token.startsWith('--types=')) {
      setTypes(token.split('=')[1]);
      continue;
    }
    if (token === '--types') {
      const value = tokens[index + 1];
      if (value && !value.startsWith('--')) {
        setTypes(value);
        index += 1;
      } else {
        setTypes('');
      }
      continue;
    }
  }

  if (!options.outDir) {
    options.outDir = DEFAULT_EXPORT_DIR;
  }

  return options;
}

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

const cheerioCache = new WeakMap();
const derivedCache = new WeakMap();

function getDomForPage(page) {
  if (!page || typeof page !== 'object') return null;
  if (cheerioCache.has(page)) return cheerioCache.get(page);
  const rawHtml = typeof page.rawHtml === 'string' ? page.rawHtml : null;
  if (!rawHtml) return null;
  const $ = cheerio.load(rawHtml, { decodeEntities: false });
  cheerioCache.set(page, $);
  return $;
}

function getDerivedStore(page) {
  if (!page || typeof page !== 'object') return null;
  let store = derivedCache.get(page);
  if (!store) {
    store = {};
    derivedCache.set(page, store);
  }
  return store;
}

function toAbsoluteUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;
  try {
    if (baseUrl) {
      return new URL(rawUrl, baseUrl).toString();
    }
    return new URL(rawUrl).toString();
  } catch {
    return null;
  }
}

function extractOutlineFromDom($, rootSelector) {
  if (!$) return [];
  const headings = [];
  const root = rootSelector ? $(rootSelector) : $('body');
  root.find('h1, h2, h3, h4, h5, h6').each((_, element) => {
    const tagName = element.tagName?.toLowerCase();
    if (!tagName) return;
    const level = Number.parseInt(tagName.replace('h', ''), 10);
    const $element = $(element);
    headings.push({
      level,
      text: $element.text().replace(/\s+/g, ' ').trim(),
      id: element.attribs?.id || null,
      html: $element.html() || null
    });
  });
  const outline = [];
  const stack = [];
  for (const heading of headings) {
    const node = { ...heading, children: [] };
    while (stack.length && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      outline.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return outline;
}

function extractSectionsFromDom($) {
  if (!$) return [];
  const sections = [];
  $('section').each((_, element) => {
    const attribs = element.attribs || {};
    const $element = $(element);
    sections.push({
      id: attribs.id || null,
      className: attribs.class || null,
      html: $element.html() || null,
      text: $element.text().replace(/\s+/g, ' ').trim() || null
    });
  });
  return sections;
}

function extractContentBlocksFromDom($, pageUrl) {
  if (!$) return [];
  const root = $('article').first().length ? $('article').first() : $('main').first().length ? $('main').first() : $('body');
  const blocks = [];
  const selector = 'h1, h2, h3, h4, h5, h6, p, blockquote, pre, code, ul, ol, figure, table';
  root.find(selector).each((_, element) => {
    const tagName = element.tagName?.toLowerCase();
    if (!tagName) return;
    const $element = $(element);
    const text = $element.text().replace(/\s+/g, ' ').trim();
    const block = {
      tag: tagName,
      text: text || null,
      html: $element.html() || null
    };
    if (tagName === 'ul' || tagName === 'ol') {
      block.items = $element.find('> li').map((_, li) => $(li).text().replace(/\s+/g, ' ').trim()).get();
    }
    if (tagName === 'figure') {
      block.caption = $element.find('figcaption').text().trim() || null;
      const img = $element.find('img').first();
      if (img.length) {
        block.image = {
          src: toAbsoluteUrl(img.attr('src'), pageUrl),
          alt: img.attr('alt') || null,
          title: img.attr('title') || null
        };
      }
    }
    if (tagName === 'table') {
      const rows = [];
      $element.find('tr').each((_, row) => {
        const $row = $(row);
        rows.push($row.find('th, td').map((_, cell) => $(cell).text().replace(/\s+/g, ' ').trim()).get());
      });
      block.rows = rows;
    }
    blocks.push(block);
  });
  return blocks;
}

function getLanguageFromPage(page) {
  if (!page || typeof page !== 'object') return null;
  if (typeof page.language === 'string') {
    const normalized = normalizeWhitespace(page.language);
    if (normalized) return normalized;
  }
  const store = getDerivedStore(page);
  if (store && Object.prototype.hasOwnProperty.call(store, 'language')) {
    return store.language ?? null;
  }
  const $ = getDomForPage(page);
  const lang = $ ? normalizeWhitespace($('html').attr('lang') || null) : null;
  if (store) store.language = lang ?? null;
  return lang ?? null;
}

function getTextContentFromPage(page) {
  if (!page || typeof page !== 'object') return null;
  if (typeof page.textContent === 'string') {
    const normalized = page.textContent.replace(/\s+/g, ' ').trim();
    if (normalized) return normalized;
  }
  const store = getDerivedStore(page);
  if (store && Object.prototype.hasOwnProperty.call(store, 'textContent')) {
    return store.textContent ?? null;
  }
  const $ = getDomForPage(page);
  const text = $ ? $('body').text().replace(/\s+/g, ' ').trim() || null : null;
  if (store) store.textContent = text ?? null;
  return text ?? null;
}

function getSectionsFromPage(page) {
  if (!page || typeof page !== 'object') return [];
  if (Array.isArray(page.sections) && page.sections.length) {
    return page.sections;
  }
  const store = getDerivedStore(page);
  if (store && Object.prototype.hasOwnProperty.call(store, 'sections')) {
    return store.sections ?? [];
  }
  const $ = getDomForPage(page);
  const sections = extractSectionsFromDom($);
  if (store) store.sections = sections;
  return sections;
}

function getOutlineFromPage(page) {
  if (!page || typeof page !== 'object') return [];
  if (Array.isArray(page.outline) && page.outline.length) {
    return page.outline;
  }
  const store = getDerivedStore(page);
  if (store && Object.prototype.hasOwnProperty.call(store, 'outline')) {
    return store.outline ?? [];
  }
  const $ = getDomForPage(page);
  const outline = extractOutlineFromDom($);
  if (store) store.outline = outline;
  return outline;
}

function getJsonLdFromPage(page) {
  if (!page || typeof page !== 'object') return [];
  if (Array.isArray(page.jsonLd) && page.jsonLd.length) {
    return page.jsonLd;
  }
  const store = getDerivedStore(page);
  if (store && Object.prototype.hasOwnProperty.call(store, 'jsonLd')) {
    return store.jsonLd ?? [];
  }
  const $ = getDomForPage(page);
  const items = [];
  if ($) {
    $('script[type="application/ld+json"]').each((_, element) => {
      const $element = $(element);
      const jsonText = $element.html()?.trim();
      if (!jsonText) return;
      try {
        const data = JSON.parse(jsonText);
        items.push(data);
      } catch (error) {
        items.push({ error: 'Invalid JSON-LD', raw: jsonText });
      }
    });
  }
  if (store) store.jsonLd = items;
  return items;
}

function getContentBlocksFromPage(page) {
  if (!page || typeof page !== 'object') return [];
  if (Array.isArray(page.contentBlocks) && page.contentBlocks.length) {
    return page.contentBlocks;
  }
  const store = getDerivedStore(page);
  if (store && Object.prototype.hasOwnProperty.call(store, 'contentBlocks')) {
    return store.contentBlocks ?? [];
  }
  const $ = getDomForPage(page);
  const blocks = extractContentBlocksFromDom($, page?.url ?? null);
  if (store) store.contentBlocks = blocks;
  return blocks;
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

function extractPathPartsFromUrl(urlString) {
  if (!urlString) return [];
  try {
    const parsed = new URL(urlString);
    return parsed.pathname.split('/').filter(Boolean);
  } catch {
    return urlString.split('/').filter(Boolean);
  }
}

function slugifySegment(segment) {
  if (!segment) return null;
  const cleaned = segment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || null;
}

function deriveSlugFromUrl(urlString) {
  const parts = extractPathPartsFromUrl(urlString);
  if (parts.length === 0) return 'home';
  const explicit = slugifySegment(parts[parts.length - 1]);
  if (explicit) return explicit;
  const combined = parts
    .map(part => slugifySegment(part))
    .filter(Boolean)
    .join('-');
  return combined || 'page';
}

function buildPathFromParts(parts = []) {
  if (!Array.isArray(parts) || parts.length === 0) return '/';
  return `/${parts.join('/')}`;
}

function collectJsonLdTypes(jsonLd = []) {
  const types = new Set();
  for (const entry of jsonLd) {
    const rawType = entry?.type;
    if (!rawType) continue;
    String(rawType)
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean)
      .forEach(item => types.add(item));
  }
  return types;
}

function inferPageType(page) {
  const url = page?.url ?? page?.sourceUrl ?? null;
  const parts = extractPathPartsFromUrl(url).map(part => part.toLowerCase());
  const title = (page?.title ?? '').toLowerCase();
  const types = collectJsonLdTypes(page?.jsonLd ?? []);

  if (page?.isEscapeRoomReview || page?.escapeRoomScoring) return 'escapeRoomReview';
  if (page?.escapeRoomGeneralData) return 'escapeRoomProfile';

  if (types.has('review') || types.has('criticreview')) return 'review';
  if (types.has('blogposting')) return parts.length > 1 ? 'blogPost' : 'article';
  if (types.has('article')) return parts.length > 1 ? 'article' : 'page';

  if (parts.length > 0 && EVENT_SLUGS.has(parts[0])) return 'event';

  if (parts.length === 0) return 'landing';

  if (parts[0] === 'blog') {
    return parts.length === 1 ? 'blogIndex' : 'blogPost';
  }

  if (title.includes('review escape room') || title.includes('escape room')) {
    return 'escapeRoomReview';
  }

  if (parts.includes('ranking')) return 'ranking';

  return parts.length === 1 ? 'page' : 'section';
}

function deriveTags(page, type, pathParts) {
  const tags = new Set();
  if (type === 'blogPost' || type === 'blogIndex') tags.add('blog');
  if (type === 'escapeRoomReview' || type === 'review') tags.add('review');
  if (page?.escapeRoomScoring || type === 'escapeRoomReview') tags.add('escape-room');
  if (type === 'event') {
    tags.add('eventos');
    tags.add('event');
  }
  if (Array.isArray(pathParts) && pathParts.length > 1) {
    pathParts.slice(0, -1).forEach(part => {
      const slug = slugifySegment(part);
      if (slug) tags.add(slug);
    });
  }

  if (Array.isArray(page?.headings)) {
    const prominent = page.headings
      .slice(0, 3)
      .map(heading => heading?.text ?? '')
      .filter(Boolean);
    for (const heading of prominent) {
      const slug = slugifySegment(heading);
      if (slug) tags.add(slug);
    }
  }

  for (const entry of page?.jsonLd ?? []) {
    const rawType = entry?.type;
    if (!rawType) continue;
    String(rawType)
      .split(',')
      .map(item => slugifySegment(item))
      .filter(Boolean)
      .forEach(item => tags.add(item));
  }

  const categorySlug = slugifySegment(page?.escapeRoomGeneralData?.category);
  if (categorySlug) tags.add(categorySlug);

  return Array.from(tags);
}

function selectImages(images = [], metaTags = {}) {
  // Priorizar imagen de Twitter Card sobre Open Graph (suele ser la imagen original completa)
  // Open Graph a veces usa versiones recortadas optimizadas para Facebook
  let featuredImageUrl = null;
  let featuredImageAlt = null;
  
  if (metaTags?.twitterImage) {
    featuredImageUrl = metaTags.twitterImage;
    featuredImageAlt = metaTags.twitterTitle || metaTags.description || null;
  } else if (metaTags?.ogImage) {
    featuredImageUrl = metaTags.ogImage;
    featuredImageAlt = metaTags.ogTitle || metaTags.description || null;
  }
  
  // Si encontramos imagen en meta tags, buscarla en el array de imágenes para obtener más datos
  let featuredImage = null;
  if (featuredImageUrl) {
    const matchingImage = Array.isArray(images) 
      ? images.find(img => img?.src === featuredImageUrl)
      : null;
    
    if (matchingImage) {
      featuredImage = {
        url: matchingImage.src,
        alt: matchingImage.alt || featuredImageAlt
      };
    } else {
      // Usar la imagen de meta tags aunque no esté en el array de imágenes
      featuredImage = {
        url: featuredImageUrl,
        alt: featuredImageAlt
      };
    }
  }
  
  // Si no hay imagen en meta tags, usar la primera imagen del array
  if (!featuredImage) {
    const valid = Array.isArray(images) ? images.filter(image => image?.src) : [];
    if (valid.length) {
      const first = valid[0];
      featuredImage = {
        url: first.src,
        alt: first.alt ?? null
      };
    }
  }
  
  // Para gallery, usar todas las imágenes excepto la featured
  const valid = Array.isArray(images) ? images.filter(image => image?.src) : [];
  const gallery = featuredImage 
    ? valid.filter(img => img.src !== featuredImage.url)
    : valid.slice(1); // Si no hay featured, usar todas menos la primera
  
  return {
    featuredImage: pruneEmpty(featuredImage),
    gallery: gallery.length ? gallery : null
  };
}

function buildEscapeRoomProfile(general = {}) {
  if (!general || typeof general !== 'object') return null;
  const profile = {
    category: normalizeWhitespace(general.category),
    province: normalizeWhitespace(general.province),
    durationMinutes: typeof general.durationMinutes === 'number' ? general.durationMinutes : null,
    durationText: normalizeWhitespace(general.durationText),
    playersText: normalizeWhitespace(general.playersText),
    minPlayers: typeof general.minPlayers === 'number' ? general.minPlayers : null,
    maxPlayers: typeof general.maxPlayers === 'number' ? general.maxPlayers : null,
    webUrl: general.webLink ?? null,
    rawHtml: typeof general.raw === 'string' ? general.raw : null
  };
  const cleaned = pruneEmpty(profile);
  return Object.keys(cleaned).length ? cleaned : null;
}

function toRatingNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const num = Number.parseFloat(normalized);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function buildEscapeRoomScores(scoring = {}) {
  if (!scoring || typeof scoring !== 'object') return null;

  const categories = [];
  let overall = null;

  for (const [key, value] of Object.entries(scoring)) {
    if (!value || typeof value !== 'object') continue;
    if (key === 'rawHtml' || key === 'extractionDebug') continue;

    const label = normalizeWhitespace(value.label) || key;
    const score = {
      id: slugifySegment(key) ?? key,
      label,
      value: toRatingNumber(value.value),
      max: toRatingNumber(value.max),
      ratio: toRatingNumber(value.ratio)
    };

    const cleaned = pruneEmpty(score);
    if (!Object.keys(cleaned).length) continue;

    const labelNorm = normalizeForComparison(label) || '';
    if (!overall && labelNorm.includes('global')) {
      overall = cleaned;
    }

    categories.push(cleaned);
  }

  categories.sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));

  const result = {
    categories: categories.length ? categories : null,
    overall: overall || null,
    rawHtml: typeof scoring.rawHtml === 'string' ? scoring.rawHtml : null
  };

  const cleaned = pruneEmpty(result);
  return Object.keys(cleaned).length ? cleaned : null;
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

function buildContentSections(blocks = [], pageUrl = null) {
  const sections = [];
  
  for (const block of blocks) {
    const tag = typeof block?.tag === 'string' ? block.tag.toLowerCase() : null;
    
    // Skip breadcrumbs
    if (isBreadcrumbBlock(block)) continue;
    
    // Skip blocks we want to stop at
    if (shouldStopAtBlock(block)) break;
    
    // Headings (h1-h6)
    if (isHeadingTag(tag)) {
      const text = normalizeWhitespace(block?.text);
      if (text) {
        sections.push({
          type: 'heading',
          text
        });
      }
      continue;
    }
    
    // Check if paragraph contains an image (common pattern: <p><img .../>caption text</p>)
    if (tag === 'p' && block?.html) {
      const imgMatch = /<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/i.exec(block.html);
      if (imgMatch) {
        const imageUrl = toAbsoluteUrl(imgMatch[1], pageUrl);
        const alt = imgMatch[2] || null;
        // Extract caption text (text after the img tag)
        const captionMatch = block.html.replace(/<img[^>]*>/i, '').trim();
        const caption = normalizeWhitespace(stripHtml(captionMatch)) || null;
        
        if (imageUrl) {
          sections.push(pruneEmpty({
            type: 'image',
            url: imageUrl,
            alt: normalizeWhitespace(alt) || null,
            caption
          }));
          continue;
        }
      }
    }
    
    // Paragraphs (p, blockquote)
    if ((tag === 'p' || tag === 'blockquote') && block?.text) {
      const text = normalizeWhitespace(block.text);
      if (text) {
        sections.push({
          type: tag === 'blockquote' ? 'quote' : 'paragraph',
          text
        });
      }
      continue;
    }
    
    // Images (figure or img)
    if (tag === 'figure' && block?.image) {
      const imageUrl = toAbsoluteUrl(block.image.src, pageUrl);
      if (imageUrl) {
        sections.push(pruneEmpty({
          type: 'image',
          url: imageUrl,
          alt: normalizeWhitespace(block.image.alt) || null,
          caption: normalizeWhitespace(block.caption) || null
        }));
      }
      continue;
    }
    
    // Lists as paragraphs
    if ((tag === 'ul' || tag === 'ol') && Array.isArray(block?.items)) {
      for (const item of block.items) {
        const text = normalizeWhitespace(item);
        if (text) {
          sections.push({
            type: 'paragraph',
            text
          });
        }
      }
    }
  }
  
  return sections;
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
  const blocks = getContentBlocksFromPage(page);
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
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return record;
  }
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
    paragraphs = splitTextContent(getTextContentFromPage(page) ?? '');
  }

  const contentHtml = buildHtmlFromBlocks(mainBlocks);
  const filteredImages = filterImagesForBlocks(page?.images ?? [], contentHtml);
  const filteredLinks = filterLinksForBlocks(page?.links ?? [], contentHtml);

  const wordCount = paragraphs.reduce((total, paragraph) => total + paragraph.split(/\s+/).filter(Boolean).length, 0);
  const { url, sourceUrl } = normalizePageUrl(page, options.primaryUrl);
  const slugParts = extractPathPartsFromUrl(url ?? sourceUrl ?? '').map(part => part.toLowerCase());

  const headings = flattenOutline(getOutlineFromPage(page));
  const metaDescription = normalizeWhitespace(page?.metaDescription);
  const leadParagraph = paragraphs[0] ?? null;
  const description = metaDescription ?? leadParagraph ?? null;
  const excerpt = leadParagraph ?? metaDescription ?? null;
  
  // Select cover image BEFORE simplifying images to have access to full src URLs
  const { featuredImage, gallery } = selectImages(filteredImages, page?.meta);
  
  const images = simplifyImages(filteredImages);
  const links = categorizeLinks(filteredLinks);
  const jsonLd = summarizeJsonLd(getJsonLdFromPage(page));
  
  // Generate content sections from blocks (paragraphs, headings, images, etc.)
  const contentSections = buildContentSections(mainBlocks, url);
  
  // Keep legacy sections for compatibility
  const legacySections = simplifySections(getSectionsFromPage(page));

  const payload = {
    url,
    sourceUrl,
    status: page?.status ?? null,
    fetchedAt: page?.fetchedAt ?? null,
    contentType: page?.contentType ?? null,
    title: normalizeWhitespace(page?.title),
    metaDescription,
    description,
    excerpt,
    language: getLanguageFromPage(page),
    wordCount: wordCount || null,
    readingTimeMinutes: estimateReadingTime(wordCount),
    coverImage: featuredImage,
    contentHtml,
    headings,
    sections: contentSections.length > 0 ? contentSections : legacySections,
    paragraphs,
    images,
    links,
    jsonLd,
    escapeRoomGeneralData: page?.escapeRoomGeneralData ?? null,
    escapeRoomScoring: page?.escapeRoomScoring ?? null,
    isEscapeRoomReview: page?.isEscapeRoomReview ?? null,
    meta: page?.meta ?? null
  };

  if (slugParts.length > 0 && EVENT_SLUGS.has(slugParts[0])) {
    payload.category = 'Eventos';
    payload.section = 'Eventos';
    const eventTags = new Set(Array.isArray(payload.tags) ? payload.tags : []);
    eventTags.add('eventos');
    eventTags.add('event');
    payload.tags = Array.from(eventTags);
  }

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
    title: normalizeWhitespace(page?.title)
  };
  return pruneEmpty(payload);
}

function buildGenericEntry(page, options = {}) {
  if (!page) return null;

  const pathParts = extractPathPartsFromUrl(page.url ?? page.sourceUrl ?? '');
  const type = inferPageType(page);
  const normalizedType = typeof type === 'string' ? type.toLowerCase() : 'page';

  if (options.includeTypes && !options.includeTypes.has(normalizedType)) {
    return null;
  }

  const slug = deriveSlugFromUrl(page.url ?? page.sourceUrl ?? '');
  const pathValue = buildPathFromParts(pathParts);
  const summary = page.metaDescription ?? (Array.isArray(page.paragraphs) ? page.paragraphs[0] ?? null : null);
  const bodyText = Array.isArray(page.paragraphs) ? page.paragraphs.join('\n\n') || null : null;
  const bodyHtml = page.contentHtml ?? null;
  
  // Use coverImage already calculated in formatPage (which uses Open Graph meta tags)
  const featuredImage = page.coverImage ?? null;
  // Build gallery from remaining images
  const gallery = Array.isArray(page.images) && page.images.length > 0 ? page.images : null;
  
  const tags = deriveTags(page, type, pathParts).map(tag => tag.toLowerCase());
  const profile = buildEscapeRoomProfile(page.escapeRoomGeneralData);
  const scores = buildEscapeRoomScores(page.escapeRoomScoring);

  if (scores && !tags.includes('escape-room')) {
    tags.push('escape-room');
  }

  const meta = pruneEmpty({
    originalUrl: page.url ?? null,
    sourceUrls: Array.isArray(page.sourceUrls) && page.sourceUrls.length ? page.sourceUrls : null,
    wordCount: page.wordCount ?? null,
    readingTimeMinutes: page.readingTimeMinutes ?? null,
    fetchedAt: page.fetchedAt ?? null,
    status: page.status ?? null,
    contentType: page.contentType ?? null
  });

  const entry = {
    type,
    slug,
    path: pathValue,
    title: page.title ?? null,
    summary: summary ? normalizeWhitespace(summary) : null,
    bodyHtml,
    bodyText,
    tags: tags.length ? Array.from(new Set(tags)) : null,
    featuredImage,
    gallery,
    profile,
    scores,
    meta: Object.keys(meta).length ? meta : null
  };

  return pruneEmpty(entry);
}

function groupEntriesByType(entries = []) {
  const groups = new Map();
  for (const entry of entries) {
    const key = typeof entry?.type === 'string' && entry.type.trim() ? entry.type.trim() : 'unknown';
    const normalized = key.toLowerCase();
    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized).push(entry);
  }
  return groups;
}

async function writeGenericExports(entries, metadata, options) {
  const outDir = options.outDir ?? DEFAULT_EXPORT_DIR;
  const relativeOutDir = path.relative(ROOT_DIR, outDir);
  await ensureDir(outDir);

  const basePayload = {
    generatedAt: metadata.generatedAt,
    source: metadata.source,
    total: entries.length
  };

  const mainPayload = {
    ...basePayload,
    entries
  };

  const mainPath = path.join(outDir, 'generic.json');
  await writeJsonFile(mainPath, mainPayload);
  console.log(`Colección genérica exportada (${entries.length} entradas) en ${path.join(relativeOutDir || '.', 'generic.json')}`);

  if (options.splitJson) {
    const groups = groupEntriesByType(entries);
    for (const [type, items] of groups.entries()) {
      const payload = {
        ...basePayload,
        total: items.length,
        entries: items
      };
      const filePath = path.join(outDir, `${type}.json`);
      await writeJsonFile(filePath, payload);
      console.log(`Colección ${type} exportada (${items.length} entradas) en ${path.join(relativeOutDir || '.', `${type}.json`)}`);
    }
  }

  if (options.emitNdjson) {
    const groups = groupEntriesByType(entries);
    for (const [type, items] of groups.entries()) {
      const filePath = path.join(outDir, `${type}.ndjson`);
      await writeNdjsonFile(filePath, items);
      console.log(`Colección ${type} exportada en formato NDJSON (${items.length} líneas) en ${path.join(relativeOutDir || '.', `${type}.ndjson`)}`);
    }
  }
}

async function run(cliOptions) {
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

    const filteredPages = cliOptions.minWords > 0
      ? formattedPages.filter(page => (page.wordCount ?? 0) >= cliOptions.minWords)
      : formattedPages;

    const genericEntries = filteredPages
      .map(page => buildGenericEntry(page, { includeTypes: cliOptions.includeTypes }))
      .filter(Boolean)
      .sort((a, b) => {
        const pathA = a.path ?? '';
        const pathB = b.path ?? '';
        if (pathA !== pathB) return pathA.localeCompare(pathB);
        const slugA = a.slug ?? '';
        const slugB = b.slug ?? '';
        if (slugA !== slugB) return slugA.localeCompare(slugB);
        const typeA = a.type ?? '';
        const typeB = b.type ?? '';
        return typeA.localeCompare(typeB);
      });

    await writeGenericExports(genericEntries, {
      generatedAt: cleaned.generatedAt,
      source: cleaned.source
    }, cliOptions);
  } catch (error) {
    console.error('No se pudo formatear el export:', error.message);
    console.error('Stack trace:', error.stack);
    process.exitCode = 1;
  }
}

const cliOptions = parseCliArgs(process.argv.slice(2));
run(cliOptions);
