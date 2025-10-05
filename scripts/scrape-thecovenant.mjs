import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import pLimit from 'p-limit';

const DEFAULT_START_URL = process.env.SCRAPE_START_URL || 'https://www.thecovenant.es/';
const OUTPUT_FILE = process.env.SCRAPE_OUTPUT || path.resolve(process.cwd(), 'data', 'thecovenant-export.json');
const MAX_PAGES = Number.parseInt(process.env.SCRAPE_MAX_PAGES || '', 10) || 2000;
const CONCURRENCY = Number.parseInt(process.env.SCRAPE_CONCURRENCY || '', 10) || 5;
const REQUEST_TIMEOUT = Number.parseInt(process.env.SCRAPE_TIMEOUT || '', 10) || 20000;
const INCLUDE_SITEMAPS = (process.env.SCRAPE_INCLUDE_SITEMAPS || 'true').toLowerCase() !== 'false';

const axiosClient = axios.create({
  timeout: REQUEST_TIMEOUT,
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
  },
  responseType: 'text',
  maxRedirects: 5,
  validateStatus: status => status >= 200 && status < 400
});

function createAllowedHostnames(startUrl) {
  const url = new URL(startUrl);
  const hostnames = new Set([url.hostname]);
  if (url.hostname.startsWith('www.')) {
    hostnames.add(url.hostname.slice(4));
  } else {
    hostnames.add(`www.${url.hostname}`);
  }
  return hostnames;
}

const allowedHostnames = createAllowedHostnames(DEFAULT_START_URL);

const visited = new Set();
const enqueued = new Set();
const crawlResults = [];

const limit = pLimit(CONCURRENCY);

function normalizeUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;
  try {
    const resolved = new URL(rawUrl, baseUrl);
    if (!['http:', 'https:'].includes(resolved.protocol)) {
      return null;
    }
    if (!allowedHostnames.has(resolved.hostname)) {
      return null;
    }
    resolved.hash = '';
    const searchParams = Array.from(resolved.searchParams.keys()).sort();
    const normalizedSearch = new URLSearchParams();
    for (const key of searchParams) {
      for (const value of resolved.searchParams.getAll(key)) {
        if (value !== undefined && value !== null) {
          normalizedSearch.append(key, value);
        }
      }
    }
    const normalizedQuery = normalizedSearch.toString();
    resolved.search = normalizedQuery ? `?${normalizedQuery}` : '';
    if (resolved.pathname !== '/' && resolved.pathname.endsWith('/')) {
      resolved.pathname = resolved.pathname.replace(/\/+/g, '/').replace(/\/$/, '');
    }
    return resolved.toString();
  } catch (error) {
    return null;
  }
}

function toAbsoluteUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;
  try {
    const resolved = new URL(rawUrl, baseUrl);
    resolved.hash = '';
    return resolved.toString();
  } catch (error) {
    return null;
  }
}

function extractMetaTags($) {
  const meta = [];
  $('meta').each((_, element) => {
    const attribs = element.attribs || {};
    meta.push({
      name: attribs.name || null,
      property: attribs.property || null,
      content: attribs.content || null,
      charset: attribs.charset || null,
      httpEquiv: attribs['http-equiv'] || null
    });
  });
  return meta;
}

function extractLinkTags($, pageUrl) {
  const links = [];
  $('a[href]').each((_, element) => {
    const attribs = element.attribs || {};
    const rawHref = attribs.href;
    const absoluteHref = toAbsoluteUrl(rawHref, pageUrl);
    let normalizedHref = null;
    let internal = false;
    if (absoluteHref) {
      const parsed = new URL(absoluteHref);
      internal = allowedHostnames.has(parsed.hostname);
      if (internal) {
        normalizedHref = normalizeUrl(absoluteHref, pageUrl);
      }
    }
    const $element = $(element);
    links.push({
      text: $element.text().replace(/\s+/g, ' ').trim() || null,
      html: $element.html() || null,
      href: absoluteHref,
      title: attribs.title || null,
      rel: attribs.rel || null,
      target: attribs.target || null,
      internal,
      normalizedHref
    });
  });
  return links;
}

function extractImages($, pageUrl) {
  const images = [];
  $('img[src]').each((_, element) => {
    const attribs = element.attribs || {};
    const absoluteSrc = toAbsoluteUrl(attribs.src, pageUrl);
    images.push({
      src: absoluteSrc,
      srcset: attribs.srcset || null,
      dataSrc: attribs['data-src'] || null,
      alt: attribs.alt || null,
      title: attribs.title || null,
      width: attribs.width || null,
      height: attribs.height || null,
      loading: attribs.loading || null
    });
  });
  return images;
}

function extractMedia($, pageUrl) {
  const media = { videos: [], audio: [], iframes: [] };
  $('video').each((_, element) => {
    const attribs = element.attribs || {};
    const sources = [];
    const $element = $(element);
    $element.find('source[src]').each((_, source) => {
      const $source = $(source);
      sources.push({
        src: toAbsoluteUrl($source.attr('src'), pageUrl),
        type: $source.attr('type') || null
      });
    });
    media.videos.push({
      poster: toAbsoluteUrl(attribs.poster, pageUrl),
      controls: attribs.controls !== undefined,
      autoplay: attribs.autoplay !== undefined,
      loop: attribs.loop !== undefined,
      muted: attribs.muted !== undefined,
      sources
    });
  });
  $('audio').each((_, element) => {
    const attribs = element.attribs || {};
    const sources = [];
    const $element = $(element);
    $element.find('source[src]').each((_, source) => {
      const $source = $(source);
      sources.push({
        src: toAbsoluteUrl($source.attr('src'), pageUrl),
        type: $source.attr('type') || null
      });
    });
    media.audio.push({
      controls: attribs.controls !== undefined,
      autoplay: attribs.autoplay !== undefined,
      loop: attribs.loop !== undefined,
      muted: attribs.muted !== undefined,
      sources
    });
  });
  $('iframe[src]').each((_, element) => {
    const attribs = element.attribs || {};
    media.iframes.push({
      src: toAbsoluteUrl(attribs.src, pageUrl),
      title: attribs.title || null,
      allow: attribs.allow || null,
      width: attribs.width || null,
      height: attribs.height || null,
      loading: attribs.loading || null
    });
  });
  return media;
}

function extractJsonLd($) {
  const scripts = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const $element = $(element);
    const jsonText = $element.html()?.trim();
    if (!jsonText) return;
    try {
      const data = JSON.parse(jsonText);
      scripts.push(data);
    } catch (error) {
      scripts.push({ error: 'Invalid JSON-LD', raw: jsonText });
    }
  });
  return scripts;
}

function extractOutline($, rootSelector) {
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
      html: $element.html()
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

function extractContentBlocks($, pageUrl) {
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

function extractSections($) {
  const sections = [];
  $('section').each((_, element) => {
    const attribs = element.attribs || {};
    const $element = $(element);
    sections.push({
      id: attribs.id || null,
      className: attribs.class || null,
      html: $element.html(),
      text: $element.text().replace(/\s+/g, ' ').trim() || null
    });
  });
  return sections;
}

function extractFeeds($, pageUrl) {
  const feeds = [];
  $('link[rel="alternate"]').each((_, element) => {
    const attribs = element.attribs || {};
    const type = attribs.type || '';
    if (type.includes('xml') || type.includes('rss') || type.includes('atom') || type.includes('json')) {
      feeds.push({
        type,
        title: attribs.title || null,
        href: toAbsoluteUrl(attribs.href, pageUrl)
      });
    }
  });
  return feeds;
}

async function fetchPage(url) {
  try {
    const response = await axiosClient.get(url);
    return { success: true, status: response.status, data: response.data, headers: response.headers };
  } catch (error) {
    if (error.response) {
      return { success: false, status: error.response.status, data: error.response.data, headers: error.response.headers };
    }
    return { success: false, status: null, error: error.message };
  }
}

async function processUrl(url) {
  if (visited.has(url)) {
    return;
  }
  visited.add(url);
  console.log(`Crawling: ${url}`);
  const pageResult = await fetchPage(url);
  if (!pageResult.success) {
    crawlResults.push({
      url,
      status: pageResult.status,
      error: pageResult.error || `Failed to fetch resource (${pageResult.status})`,
      fetchedAt: new Date().toISOString(),
      contentType: pageResult.headers?.['content-type'] || null,
      rawHtml: typeof pageResult.data === 'string' ? pageResult.data : null
    });
    return;
  }
  const html = pageResult.data;
  const $ = cheerio.load(html, { decodeEntities: false });
  const pageInfo = {
    url,
    status: pageResult.status,
    fetchedAt: new Date().toISOString(),
    contentType: pageResult.headers?.['content-type'] || null,
    contentLength: pageResult.headers?.['content-length'] || null,
    title: $('title').first().text().trim() || null,
    language: $('html').attr('lang') || null,
    metaDescription: $('meta[name="description"]').attr('content') || null,
    canonicalUrl: toAbsoluteUrl($('link[rel="canonical"]').attr('href'), url),
    meta: extractMetaTags($),
    feeds: extractFeeds($, url),
    links: extractLinkTags($, url),
    images: extractImages($, url),
    media: extractMedia($, url),
    outline: extractOutline($),
    sections: extractSections($),
    contentBlocks: extractContentBlocks($, url),
    textContent: $('body').text().replace(/\s+/g, ' ').trim() || null,
    jsonLd: extractJsonLd($),
    stylesheets: $('link[rel="stylesheet"]').map((_, el) => toAbsoluteUrl(el.attribs?.href, url)).get(),
    inlineStyles: $('style').map((_, el) => ($(el).html() || '').trim()).get(),
    scripts: $('script[src]').map((_, el) => toAbsoluteUrl(el.attribs?.src, url)).get(),
    inlineScripts: $('script:not([src])').map((_, el) => ($(el).html() || '').trim()).get(),
    rawHtml: html
  };

  crawlResults.push(pageInfo);

  const discoveredLinks = new Set();
  for (const link of pageInfo.links) {
    if (link.internal && link.normalizedHref) {
      discoveredLinks.add(link.normalizedHref);
    }
  }

  for (const nextUrl of discoveredLinks) {
    enqueue(nextUrl);
  }
}

async function parseSitemap(sitemapUrl) {
  try {
    const response = await axiosClient.get(sitemapUrl);
    const parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true });
    const data = parser.parse(response.data);
    const urls = new Set();

    function extractUrls(node) {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(extractUrls);
        return;
      }
      if (node.loc) {
        if (typeof node.loc === 'string') {
          const normalized = normalizeUrl(node.loc, sitemapUrl);
          if (normalized) {
            urls.add(normalized);
          }
        } else if (Array.isArray(node.loc)) {
          node.loc.forEach(value => {
            const normalized = normalizeUrl(value, sitemapUrl);
            if (normalized) {
              urls.add(normalized);
            }
          });
        }
      }
      if (node.url) {
        extractUrls(node.url);
      }
      if (node.sitemap) {
        const sitemapNodes = Array.isArray(node.sitemap) ? node.sitemap : [node.sitemap];
        for (const sitemapNode of sitemapNodes) {
          if (sitemapNode.loc) {
            const nestedUrl = Array.isArray(sitemapNode.loc) ? sitemapNode.loc[0] : sitemapNode.loc;
            const normalized = normalizeUrl(nestedUrl, sitemapUrl);
            if (normalized) {
              urls.add(normalized);
            }
          }
        }
      }
      for (const value of Object.values(node)) {
        if (typeof value === 'object') {
          extractUrls(value);
        }
      }
    }

    extractUrls(data);
    return urls;
  } catch (error) {
    console.warn(`Unable to parse sitemap ${sitemapUrl}: ${error.message}`);
    return new Set();
  }
}

async function discoverSeedUrls(startUrl) {
  const start = new URL(startUrl);
  const normalizedStart = normalizeUrl(startUrl, startUrl);
  const pageSeeds = new Set();
  if (normalizedStart) {
    pageSeeds.add(normalizedStart);
  }
  if (!INCLUDE_SITEMAPS) {
    return { pageSeeds: Array.from(pageSeeds), sitemapSeeds: [] };
  }
  const sitemapSeeds = new Set();
  const robotsUrl = `${start.origin}/robots.txt`;
  try {
    const response = await axiosClient.get(robotsUrl);
    const lines = response.data.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().startsWith('sitemap:')) {
        const sitemapUrl = trimmed.slice('sitemap:'.length).trim();
        const absolute = toAbsoluteUrl(sitemapUrl, robotsUrl);
        if (absolute) {
          sitemapSeeds.add(absolute);
        }
      }
    }
  } catch (error) {
    console.warn(`Unable to fetch robots.txt (${robotsUrl}): ${error.message}`);
  }

  sitemapSeeds.add(`${start.origin}/sitemap.xml`);
  sitemapSeeds.add(`${start.origin}/sitemap_index.xml`);

  return {
    pageSeeds: Array.from(pageSeeds),
    sitemapSeeds: Array.from(sitemapSeeds)
  };
}

async function hydrateSitemap(sitemapUrl, visitedSitemaps) {
  const absolute = toAbsoluteUrl(sitemapUrl, DEFAULT_START_URL);
  if (!absolute) {
    return;
  }
  const canonical = normalizeUrl(absolute, DEFAULT_START_URL) || absolute;
  if (!allowedHostnames.has(new URL(canonical).hostname)) {
    return;
  }
  if (visitedSitemaps.has(canonical)) {
    return;
  }
  visitedSitemaps.add(canonical);
  const urls = await parseSitemap(canonical);
  for (const url of urls) {
    if (url.endsWith('.xml')) {
      await hydrateSitemap(url, visitedSitemaps);
    } else {
      enqueue(url);
    }
  }
}

function enqueue(url) {
  if (!url) return;
  if (visited.has(url) || enqueued.has(url)) {
    return;
  }
  if (crawlResults.length + enqueued.size >= MAX_PAGES) {
    return;
  }
  enqueued.add(url);
  queue.push(url);
  scheduleNext();
}

const queue = [];
let activeCount = 0;
let resolveIdle = null;
const idlePromise = new Promise(resolve => {
  resolveIdle = resolve;
});

function scheduleNext() {
  if (queue.length === 0 && activeCount === 0) {
    resolveIdle?.();
    return;
  }
  while (activeCount < CONCURRENCY && queue.length > 0) {
    const nextUrl = queue.shift();
    if (!nextUrl) {
      continue;
    }
    activeCount += 1;
    limit(() => processUrl(nextUrl)).catch(error => {
      console.error(`Error processing ${nextUrl}:`, error.message);
    }).finally(() => {
      enqueued.delete(nextUrl);
      activeCount -= 1;
      scheduleNext();
    });
  }
}

async function run() {
  console.log('Descubriendo URLs iniciales...');
  const { pageSeeds, sitemapSeeds } = await discoverSeedUrls(DEFAULT_START_URL);
  if (pageSeeds.length === 0) {
    enqueue(DEFAULT_START_URL);
  } else {
    for (const seed of pageSeeds) {
      enqueue(seed);
    }
  }
  if (INCLUDE_SITEMAPS) {
    const visitedSitemaps = new Set();
    for (const sitemapUrl of sitemapSeeds) {
      const normalized = toAbsoluteUrl(sitemapUrl, DEFAULT_START_URL);
      if (normalized && allowedHostnames.has(new URL(normalized).hostname)) {
        await hydrateSitemap(normalized, visitedSitemaps);
      }
    }
  }
  if (queue.length === 0) {
    enqueue(DEFAULT_START_URL);
  }
  await idlePromise;

  const exportData = {
    crawledAt: new Date().toISOString(),
    startUrl: DEFAULT_START_URL,
    totalPages: crawlResults.length,
    settings: {
      maxPages: MAX_PAGES,
      concurrency: CONCURRENCY,
      includeSitemaps: INCLUDE_SITEMAPS
    },
    pages: crawlResults
  };

  const outputDir = path.dirname(OUTPUT_FILE);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(exportData, null, 2), 'utf8');
  console.log(`Export completado. ${crawlResults.length} páginas guardadas en ${OUTPUT_FILE}`);
}

run().catch(error => {
  console.error('El proceso de scraping falló:', error);
  process.exitCode = 1;
});
