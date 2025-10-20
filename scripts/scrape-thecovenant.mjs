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
const PROGRESS_INTERVAL_MS = Number.parseInt(process.env.SCRAPE_PROGRESS_INTERVAL || '', 10) || 5000;
const SUMMARY_EVERY = Number.parseInt(process.env.SCRAPE_SUMMARY_EVERY || '', 10) || 25; // cada N páginas mostrar resumen
const DOWNLOAD_IMAGES = (process.env.SCRAPE_DOWNLOAD_IMAGES || 'true').toLowerCase() !== 'false';
const IMAGE_DIR = process.env.SCRAPE_IMAGE_DIR || path.resolve(process.cwd(), 'data', 'images');
const IMAGE_CONCURRENCY = Number.parseInt(process.env.SCRAPE_IMAGE_CONCURRENCY || '', 10) || 3;
const MAX_IMAGE_BYTES = Number.parseInt(process.env.SCRAPE_MAX_IMAGE_BYTES || '', 10) || 5 * 1024 * 1024; // 5MB límite por imagen
const IMAGE_EXT_WHITELIST = (process.env.SCRAPE_IMAGE_EXTS || 'jpg,jpeg,png,webp,avif,gif').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const DEFAULT_EXTRA_SEEDS = [
  'https://www.thecovenant.es/the-covenant-cases',
  'https://www.thecovenant.es/games-university',
  'https://www.thecovenant.es/gymkhana-literaria-litcon-madrid'
];

function buildExtraSeedList() {
  const rawEnv = process.env.SCRAPE_EXTRA_SEEDS;
  const candidates = new Set(DEFAULT_EXTRA_SEEDS);
  if (typeof rawEnv === 'string' && rawEnv.trim().length > 0) {
    rawEnv
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
      .forEach(entry => candidates.add(entry));
  }

  const normalized = new Set();
  for (const candidate of candidates) {
    const absolute = toAbsoluteUrl(candidate, DEFAULT_START_URL);
    if (!absolute) continue;
    const canonical = normalizeUrl(absolute, DEFAULT_START_URL) || absolute;
    normalized.add(canonical);
  }
  return Array.from(normalized);
}

const EXTRA_SEED_URLS = buildExtraSeedList();

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

// Log inmediato al cargar el script para asegurar feedback en el terminal
console.log(`[Scraper] script cargado. PID=${process.pid} NODE=${process.version}`);

// Manejo silencioso de EPIPE (ocurre al hacer pipe a `head`, `less` que se cierra pronto, etc.)
// Sin esto Node lanza uncaughtException cuando intentamos escribir tras cerrarse la tubería.
function setupSilentPipeErrors(stream) {
  if (!stream || typeof stream.on !== 'function') return;
  stream.on('error', (err) => {
    if (err && err.code === 'EPIPE') {
      // Salida cerrada: finalizamos proceso limpiamente sin stack ruidoso.
      try { clearProgressBar(true); } catch {}
      process.exit(0);
    }
  });
}
setupSilentPipeErrors(process.stdout);
setupSilentPipeErrors(process.stderr);

// Handlers para errores globales para garantizar que el proceso muestre información
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UnhandledRejection] Razón:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException] Error no capturado:', err);
  // Dejar código de salida para que npm/padre sepa que hubo fallo
  process.exitCode = 1;
});

// Verbose HTTP logging activado por defecto (desactivar con SCRAPE_VERBOSE=false o 0)
const VERBOSE_HTTP = (() => {
  const raw = process.env.SCRAPE_VERBOSE;
  if (raw === undefined) return true; // por defecto: verbose activado
  return raw.toLowerCase() === 'true' || raw === '1';
})();
if (VERBOSE_HTTP) {
  axiosClient.interceptors.request.use(cfg => {
    try { console.log(`[HTTP ->] ${String(cfg.method).toUpperCase()} ${cfg.url}`); } catch (e) {}
    return cfg;
  }, e => Promise.reject(e));
  axiosClient.interceptors.response.use(res => {
    try { console.log(`[HTTP <-] ${res.status} ${res.config?.url}`); } catch (e) {}
    return res;
  }, err => {
    try { console.warn(`[HTTP ERR] ${err.config?.url || 'unknown'} -> ${err.message}`); } catch (e) {}
    return Promise.reject(err);
  });
}

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
const allowedHostnameVariants = Array.from(allowedHostnames);

function isDnsResolutionError(error) {
  if (!error) return false;
  const code = error.code || error.cause?.code;
  if (code && (code === 'ENOTFOUND' || code === 'EAI_AGAIN')) {
    return true;
  }
  const message = error.message || '';
  return /ENOTFOUND|EAI_AGAIN/.test(message);
}

function nextFallbackUrl(currentUrl, triedHosts) {
  try {
    const parsed = new URL(currentUrl);
    triedHosts.add(parsed.hostname);
    for (const hostname of allowedHostnameVariants) {
      if (!triedHosts.has(hostname)) {
        const fallback = new URL(currentUrl);
        fallback.hostname = hostname;
        return fallback.toString();
      }
    }
  } catch {}
  return null;
}

async function axiosGetWithFallback(url, config = {}, triedHosts = new Set()) {
  try {
    return await axiosClient.get(url, config);
  } catch (error) {
    if (isDnsResolutionError(error)) {
      const fallbackUrl = nextFallbackUrl(url, triedHosts);
      if (fallbackUrl) {
        console.warn(`[HTTP Fallback] DNS falló para ${url}; reintentando con ${fallbackUrl}`);
        return axiosGetWithFallback(fallbackUrl, config, triedHosts);
      }
    }
    if (triedHosts.size) {
      error.attemptedHosts = Array.from(triedHosts);
    }
    throw error;
  }
}

const visited = new Set();
const enqueued = new Set();
const crawlResults = [];
const stats = {
  processed: 0,
  failed: 0,
  enqueued: 0,
  imagesDownloaded: 0,
  imagesFailed: 0,
  imagesSkipped: 0,
  imagesSkippedNoSrc: 0,
  imagesSkippedDuplicate: 0,
  imagesSkippedExisting: 0,
  imagesSkippedExt: 0,
  imagesSkippedSize: 0
};

const limit = pLimit(CONCURRENCY);
let progressTimer = null;
let maxPageLimitReachedLog = false;
let startTimestamp = Date.now();
const downloadedImages = new Map(); // url -> localPath
const imageLimit = pLimit(IMAGE_CONCURRENCY);

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

// Extrae meta tags importantes (Open Graph, Twitter Card, etc.)
function extractMetaTags($, pageUrl) {
  const meta = {
    description: $('meta[name="description"]').attr('content') || null,
    keywords: $('meta[name="keywords"]').attr('content') || null,
    author: $('meta[name="author"]').attr('content') || null,
    // Open Graph
    ogTitle: $('meta[property="og:title"]').attr('content') || null,
    ogDescription: $('meta[property="og:description"]').attr('content') || null,
    ogImage: $('meta[property="og:image"]').attr('content') || null,
    ogUrl: $('meta[property="og:url"]').attr('content') || null,
    ogType: $('meta[property="og:type"]').attr('content') || null,
    // Twitter Card
    twitterCard: $('meta[name="twitter:card"]').attr('content') || null,
    twitterTitle: $('meta[name="twitter:title"]').attr('content') || null,
    twitterDescription: $('meta[name="twitter:description"]').attr('content') || null,
    twitterImage: $('meta[name="twitter:image"]').attr('content') || null
  };
  
  // Convertir URLs relativas a absolutas
  if (meta.ogImage) {
    meta.ogImage = toAbsoluteUrl(meta.ogImage, pageUrl);
  }
  if (meta.twitterImage) {
    meta.twitterImage = toAbsoluteUrl(meta.twitterImage, pageUrl);
  }
  
  return meta;
}

// Extrae información estructurada de la ficha de escape room (tabla DATOS GENERALES)
function extractEscapeRoomGeneralData($, pageUrl) {
  const tables = $('table.tabla-scoring-datos-principales');
  if (!tables.length) return null;
  const normalize = (t) => (t||'').toUpperCase();
  let generalTable = null;
  tables.each((_, t) => {
    const header = $(t).find('thead th').first().text();
    const norm = normalize(header);
    if (norm.includes('DATOS GENERALES') && norm.includes('ESCAPE ROOM')) {
      generalTable = $(t);
      return false;
    }
  });
  if (!generalTable) return null;
  let rows = generalTable.find('tbody tr');
  if (!rows.length) rows = generalTable.find('tr');
  if (!rows.length) return null;
  const info = {
    raw: null,
    category: null,
    province: null,
    durationText: null,
    durationMinutes: null,
    playersText: null,
    minPlayers: null,
    maxPlayers: null,
    webLink: null,
    extractionDebug: {
      rowCount: rows.length,
      tablesTotal: tables.length
    }
  };
  rows.each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.find('td');
    if (cells.length < 2) return;
    const labelRaw = cells.eq(0).text();
    const label = labelRaw.replace(/\s+/g, ' ').trim();
    const labelNorm = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const valueCell = cells.eq(1);
    const valueText = valueCell.text().replace(/\s+/g, ' ').trim();
    if (!label) return;
    if (labelNorm.includes('categoria') || labelNorm.includes('categoría')) {
      info.category = valueText || null;
    } else if (labelNorm.includes('provincia')) {
      info.province = valueText || null;
    } else if (labelNorm.includes('duracion') || labelNorm.includes('duración')) {
      info.durationText = valueText || null;
      const txt = (valueText || '').toLowerCase();
      // Buscar horas y minutos o sólo número
      const durMatch = txt.match(/(\d+)\s*(hora|horas)/);
      if (durMatch) {
        const num = parseInt(durMatch[1], 10);
        info.durationMinutes = num * 60;
      } else {
        const minMatch = txt.match(/(\d+)\s*(minuto|minutos|min)/);
        if (minMatch) {
          info.durationMinutes = parseInt(minMatch[1], 10);
        } else {
          // si sólo hay un número, asumimos minutos
          const onlyNum = txt.match(/(?:^|\D)(\d+)(?:\D|$)/);
          if (onlyNum) info.durationMinutes = parseInt(onlyNum[1], 10);
        }
      }
    } else if (labelNorm.includes('jugadores')) {
      info.playersText = valueText || null;
      const rangeMatch = valueText.toLowerCase().match(/(\d+)\s*-\s*(\d+)/);
      if (rangeMatch) {
        info.minPlayers = parseInt(rangeMatch[1], 10);
        info.maxPlayers = parseInt(rangeMatch[2], 10);
      } else {
        const single = valueText.match(/(\d+)/);
        if (single) {
          info.minPlayers = parseInt(single[1], 10);
          info.maxPlayers = info.minPlayers;
        }
      }
    } else if (labelNorm.startsWith('web')) {
      const a = valueCell.find('a[href]').first();
      if (a.length) {
        info.webLink = toAbsoluteUrl(a.attr('href'), pageUrl);
      }
    }
  });
  info.raw = generalTable.html();
  const meaningful = info.category || info.province || info.durationText || info.playersText || info.webLink;
  return meaningful ? info : null;
}

// Extrae la tabla/cuadro de puntuación (estrellas) "PUNTUACION ESCAPE ROOM"
// Devuelve un objeto con cada categoría y su valor numérico (estrellas llenas) y el máximo detectado.
function extractEscapeRoomScoring($) {
  // Tablas candidatas por clase
  const tables = $('table.tabla-scoring-datos-principales');
  if (!tables.length) return null;

  const normalize = (t) => (t||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  let scoringTable = null;
  tables.each((_, t) => {
    const header = $(t).find('thead th').first().text();
    const norm = normalize(header);
    if (norm.includes('puntuacion escape room') || norm.includes('puntuación escape room')) {
      scoringTable = $(t);
      return false; // break
    }
  });
  // Fallback: buscar tabla con muchas spans Stars y que no sea la de datos generales
  if (!scoringTable) {
    tables.each((_, t) => {
      const $t = $(t);
      const starsCount = $t.find('span.Stars[style*="--rating"]').length;
      const headerNorm = normalize($t.find('thead th').first().text());
      if (starsCount >= 3 && !headerNorm.includes('datos generales')) {
        scoringTable = $t;
        return false;
      }
    });
  }
  if (!scoringTable) return null;

  function normalizeLabel(label) {
    return label
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
      .replace(/[^a-z0-9\.]/g, '') // quitar espacios y símbolos salvo punto
      .trim();
  }

  const categoriesMap = {
    'dificultad': 'difficulty',
    'terror': 'terror',
    'inmersion': 'immersion',
    'diversion': 'fun',
    'puzzles': 'puzzles',
    'g.master': 'gameMaster',
    'gmaster': 'gameMaster',
    'global': 'global'
  };

  const scoring = {
    difficulty: null,
    terror: null,
    immersion: null,
    fun: null,
    puzzles: null,
    gameMaster: null,
    global: null,
    rawHtml: scoringTable.html(),
    extractionDebug: { rowsTried: 0, tableCount: tables.length, selectedStars: scoringTable.find('span.Stars[style*="--rating"]').length }
  };

  const rows = scoringTable.find('tbody tr');
  rows.each((_, tr) => {
    const $tr = $(tr);
    const tds = $tr.find('td');
    if (tds.length < 2) return;
    const labelRaw = tds.eq(0).text().replace(/\s+/g, ' ').trim();
    const labelNorm = normalizeLabel(labelRaw);
    let key = null;
    // Buscar mejor match: algunos labels como "gmaster" pueden venir "g.master"
    if (categoriesMap[labelNorm]) {
      key = categoriesMap[labelNorm];
    } else {
      // intentar aproximación por contiene
      for (const mapKey in categoriesMap) {
        if (labelNorm.includes(mapKey.replace(/\./g,''))) {
          key = categoriesMap[mapKey];
          break;
        }
      }
    }
    if (!key) return;
  const ratingEl = tds.eq(1).find('span.Stars[style*="--rating"]').first();
    if (!ratingEl.length) return;
    const styleAttr = ratingEl.attr('style') || '';
    // Parsear --rating: número (puede ser decimal)
    const match = styleAttr.match(/--rating:\s*([0-9]+(?:\.[0-9]+)?)/);
    const value = match ? parseFloat(match[1]) : null;
    if (value == null) return;
    // Asumimos 5 como máximo estándar de estrellas
    scoring[key] = {
      value,
      max: 5,
      ratio: value / 5,
      label: labelRaw,
      style: styleAttr
    };
    scoring.extractionDebug.rowsTried += 1;
  });

  const hasAny = Object.values(scoring).some(v => v && typeof v === 'object' && v.value != null);
  return hasAny ? scoring : null;
}

// Exportar funciones para tests (sin ejecutar crawler al importar)
export { extractEscapeRoomGeneralData, extractEscapeRoomScoring };

async function fetchPage(url) {
  try {
    const response = await axiosGetWithFallback(url);
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
  console.log(`[Crawl] Procesando ${url}`);
  const pageResult = await fetchPage(url);
  if (!pageResult.success) {
    stats.failed += 1;
    stats.processed += 1;
    console.warn(`[Crawl] Error en ${url} -> ${pageResult.status ?? 'sin respuesta'}${pageResult.error ? ` (${pageResult.error})` : ''}`);
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
  console.log(`[Crawl] ${url} respondió ${pageResult.status}`);
  const $ = cheerio.load(html, { decodeEntities: false });
  
  // Extraer meta tags (incluido og:image para imagen destacada)
  const metaTags = extractMetaTags($, url);
  
  const pageInfo = {
    url,
    status: pageResult.status,
    fetchedAt: new Date().toISOString(),
    contentType: pageResult.headers?.['content-type'] || null,
    title: $('title').first().text().trim() || null,
    metaDescription: metaTags.description,
    meta: metaTags,
    links: extractLinkTags($, url),
    images: extractImages($, url),
    rawHtml: html
  };

  // Extraer datos generales y puntuaciones
  const generalData = extractEscapeRoomGeneralData($, url);
  if (generalData) {
    pageInfo.escapeRoomGeneralData = generalData;
    // Backward compat: mantener campo antiguo si existía en consumidores previos
    pageInfo.escapeRoomInfo = generalData;
  }
  // Añadir puntuaciones de escape room si existe
  const escapeScoring = extractEscapeRoomScoring($);
  if (escapeScoring) {
    pageInfo.escapeRoomScoring = escapeScoring;
  }
  // Flag sólo si ambas tablas presentes
  if (generalData && escapeScoring) {
    pageInfo.isEscapeRoomReview = true;
  }

  crawlResults.push(pageInfo);
  stats.processed += 1;
  console.log(`[Crawl] ${url} procesado (links: ${pageInfo.links.length}, imágenes: ${pageInfo.images.length})`);
  if (DOWNLOAD_IMAGES && pageInfo.images.length) {
    await Promise.all(pageInfo.images.map(img => imageLimit(() => downloadAndAttachImage(img))));
  }
  if (SUMMARY_EVERY > 0 && stats.processed % SUMMARY_EVERY === 0) {
    const elapsedSec = (Date.now() - startTimestamp) / 1000;
    const rate = stats.processed / (elapsedSec || 1);
    const percent = MAX_PAGES ? (stats.processed / MAX_PAGES) : 0;
    let eta = 'ETA --';
    if (percent > 0 && percent < 1) {
      const remainingSec = elapsedSec * (1 / percent - 1);
      const m = Math.floor(remainingSec / 60);
      const s = Math.round(remainingSec % 60);
      eta = `ETA ${m}m${s}s`;
    }
    console.log(`[Resumen] ${stats.processed}/${MAX_PAGES} (${(percent*100).toFixed(1)}%) | errores=${stats.failed} | velocidad=${rate.toFixed(2)} p/s | ${eta}`);
  }

  const discoveredLinks = new Set();
  for (const link of pageInfo.links) {
    if (link.internal && link.normalizedHref) {
      discoveredLinks.add(link.normalizedHref);
    }
  }
  if (discoveredLinks.size > 0) {
    console.log(`[Crawl] ${url} descubrió ${discoveredLinks.size} enlaces internos nuevos`);
  }

  for (const nextUrl of discoveredLinks) {
    enqueue(nextUrl);
  }
}

async function parseSitemap(sitemapUrl) {
  try {
    const response = await axiosGetWithFallback(sitemapUrl);
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
    console.log(`[Sitemap] ${sitemapUrl} devolvió ${urls.size} URLs`);
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
  for (const extraSeed of EXTRA_SEED_URLS) {
    const normalized = normalizeUrl(extraSeed, startUrl);
    if (normalized) {
      pageSeeds.add(normalized);
    }
  }
  if (!INCLUDE_SITEMAPS) {
    return { pageSeeds: Array.from(pageSeeds), sitemapSeeds: [] };
  }
  const sitemapSeeds = new Set();
  const robotsUrl = `${start.origin}/robots.txt`;
  try {
    const response = await axiosGetWithFallback(robotsUrl);
    console.log(`[Seeds] robots.txt obtenido de ${robotsUrl}`);
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
    if (!maxPageLimitReachedLog) {
      console.log(`[Limite] Máximo de ${MAX_PAGES} páginas alcanzado; se omiten nuevas URLs.`);
      maxPageLimitReachedLog = true;
    }
    return;
  }
  enqueued.add(url);
  stats.enqueued += 1;
  if (stats.enqueued <= 20 || stats.enqueued % 50 === 0) {
    console.log(`[Cola] URL encolada (${stats.enqueued} total, pendientes: ${queue.length + 1}): ${url}`);
  }
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

const USE_PROGRESS_BAR = (process.env.SCRAPE_PROGRESS_BAR || 'true').toLowerCase() !== 'false';
let lastBar = '';
function renderProgressBar() {
  const total = MAX_PAGES;
  const done = stats.processed + enqueued.size; // aproximación a avance
  const percent = Math.min(1, total ? done / total : 0);
  const width = Math.min(40, process.stdout.columns ? Math.max(20, process.stdout.columns - 80) : 40);
  const filled = Math.round(width * percent);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const elapsedMs = Date.now() - startTimestamp;
  const elapsedSec = elapsedMs / 1000;
  let etaStr = 'ETA: --';
  if (percent > 0 && percent < 1) {
    const remainingSec = elapsedSec * (1 / percent - 1);
    const etaMin = Math.floor(remainingSec / 60);
    const etaSec = Math.round(remainingSec % 60);
    etaStr = `ETA: ${etaMin}m${etaSec}s`;
  } else if (percent >= 1 && total) {
    etaStr = `Fin (~${elapsedSec.toFixed(1)}s)`;
  }
  const rate = stats.processed > 0 ? (stats.processed / elapsedSec) : 0;
  const line = `[Bar] ${bar} ${(percent * 100).toFixed(1)}% | proc=${stats.processed} err=${stats.failed} act=${activeCount} cola=${queue.length} enq=${stats.enqueued}/${MAX_PAGES} | imgs ok=${stats.imagesDownloaded} fail=${stats.imagesFailed} skip=${stats.imagesSkipped} | ${etaStr} @${rate.toFixed(2)} p/s`;
  if (process.stdout.isTTY) {
    if (lastBar !== line) {
      process.stdout.write(`\r${line.padEnd(process.stdout.columns || (line.length + 2))}`);
      lastBar = line;
    }
  } else {
    // si no hay TTY, imprimir líneas independientes periódicamente
    if (lastBar !== line) {
      console.log(line);
      lastBar = line;
    }
  }
}

function clearProgressBar(final = false) {
  if (process.stdout.isTTY) {
    process.stdout.write('\r');
    if (final && lastBar) {
      process.stdout.write(`${lastBar}\n`);
    } else if (!final) {
      process.stdout.write(' '.repeat(process.stdout.columns || 0) + '\r');
    }
  }
  lastBar = '';
}

function startProgressLogs() {
  if (PROGRESS_INTERVAL_MS <= 0) {
    return;
  }
  progressTimer = setInterval(() => {
    if (USE_PROGRESS_BAR) {
      renderProgressBar();
    } else {
      console.log(`[Progreso] Procesadas: ${stats.processed} (errores: ${stats.failed}) | Activas: ${activeCount} | En cola: ${queue.length} | Encoladas: ${stats.enqueued}`);
    }
  }, PROGRESS_INTERVAL_MS);
  // Snapshot inmediato
  if (USE_PROGRESS_BAR) {
    renderProgressBar();
  } else {
    console.log(`[Progreso] (inicio) Procesadas: ${stats.processed} (errores: ${stats.failed}) | Activas: ${activeCount} | En cola: ${queue.length} | Encoladas: ${stats.enqueued}`);
  }
  if (typeof progressTimer.unref === 'function') {
    progressTimer.unref();
  }
}

function stopProgressLogs() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
  if (USE_PROGRESS_BAR) {
    clearProgressBar(true);
  }
}

async function run() {
  console.log('[Config] Iniciando scraping con:');
  console.log(`          startUrl=${DEFAULT_START_URL}`);
  console.log(`          maxPages=${MAX_PAGES} | concurrency=${CONCURRENCY} | includeSitemaps=${INCLUDE_SITEMAPS}`);
  console.log(`          downloadImages=${DOWNLOAD_IMAGES} | imageDir=${IMAGE_DIR} | imageConcurrency=${IMAGE_CONCURRENCY}`);
  const startTime = Date.now();
  startTimestamp = startTime;
  startProgressLogs();
  console.log('Descubriendo URLs iniciales...');
  const { pageSeeds, sitemapSeeds } = await discoverSeedUrls(DEFAULT_START_URL);
  console.log(`[Seeds] URLs iniciales detectadas: ${pageSeeds.length} | Sitemaps pendientes: ${sitemapSeeds.length}`);
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
  stopProgressLogs();

  const exportData = {
    crawledAt: new Date().toISOString(),
    startUrl: DEFAULT_START_URL,
    totalPages: crawlResults.length,
    settings: {
      maxPages: MAX_PAGES,
      concurrency: CONCURRENCY,
      includeSitemaps: INCLUDE_SITEMAPS,
      downloadImages: DOWNLOAD_IMAGES,
      imageDir: IMAGE_DIR,
      imageConcurrency: IMAGE_CONCURRENCY,
      imageStats: {
        downloaded: stats.imagesDownloaded,
        failed: stats.imagesFailed,
        skipped: stats.imagesSkipped,
        skippedNoSrc: stats.imagesSkippedNoSrc,
        skippedDuplicate: stats.imagesSkippedDuplicate,
        skippedExisting: stats.imagesSkippedExisting,
        skippedExt: stats.imagesSkippedExt,
        skippedSize: stats.imagesSkippedSize
      }
    },
    pages: crawlResults
  };

  const outputDir = path.dirname(OUTPUT_FILE);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(exportData, null, 2), 'utf8');
  const durationMs = Date.now() - startTime;
  console.log(`Export completado. ${crawlResults.length} páginas guardadas en ${OUTPUT_FILE} (${(durationMs / 1000).toFixed(1)}s, ${stats.failed} errores).`);
  if (DOWNLOAD_IMAGES) {
    console.log(`[Imagenes] Descargadas: ${stats.imagesDownloaded} | Fallidas: ${stats.imagesFailed} | Skipped: ${stats.imagesSkipped}`);
    console.log(`[Imagenes] Breakdown skips -> noSrc=${stats.imagesSkippedNoSrc} duplicate=${stats.imagesSkippedDuplicate} existing=${stats.imagesSkippedExisting} ext=${stats.imagesSkippedExt} size=${stats.imagesSkippedSize}`);
  }
}

// Ejecutar sólo si el script es el entrypoint principal (evita side-effects en tests)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
// Ejecutar sólo si el script es el entrypoint principal.
// Usar comparación de rutas resueltas para ser robusto en entornos como npm test
try {
  const invokedAsScript = typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === path.resolve(__filename);
  if (invokedAsScript) {
    run().catch(error => {
      stopProgressLogs();
      console.error('El proceso de scraping falló:', error);
      process.exitCode = 1;
    });
  }
} catch (err) {
  // En caso de cualquier inconsistencia en el entorno, no ejecutar el crawler al importar.
}

// --- Descarga de imágenes ---
async function downloadAndAttachImage(img) {
  const url = img.src;
  if (!url) {
    stats.imagesSkipped += 1;
    stats.imagesSkippedNoSrc += 1;
    img.skipReason = 'no-src';
    return;
  }
  if (downloadedImages.has(url)) {
    img.localPath = downloadedImages.get(url);
    stats.imagesSkipped += 1;
    stats.imagesSkippedDuplicate += 1;
    img.skipReason = 'duplicate-session';
    return;
  }
  try {
    const u = new URL(url);
    const extMatch = u.pathname.split('.').pop()?.toLowerCase().split(/[#?]/)[0];
    const ext = extMatch && extMatch.length <= 5 ? extMatch : 'bin';
    if (IMAGE_EXT_WHITELIST.length && ext !== 'bin' && !IMAGE_EXT_WHITELIST.includes(ext)) {
      stats.imagesSkipped += 1;
      stats.imagesSkippedExt += 1;
      img.skipReason = `ext-not-whitelisted:${ext}`;
      return;
    }
    const fileNameBase = u.pathname.replace(/\/+$/,'').split('/').filter(Boolean).slice(-1)[0] || 'image';
    const safeBase = fileNameBase.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80) || 'image';
    const fileName = `${safeBase}.${ext}`;
    const subDir = u.hostname.replace(/[^a-zA-Z0-9-_]/g,'_');
    const finalDir = path.join(IMAGE_DIR, subDir);
    await fs.mkdir(finalDir, { recursive: true });
    const finalPath = path.join(finalDir, fileName);
    // Si ya existe el archivo, no lo descargamos
    try {
      await fs.access(finalPath);
      img.localPath = finalPath;
      downloadedImages.set(url, finalPath);
      stats.imagesSkipped += 1;
      stats.imagesSkippedExisting += 1;
      img.skipReason = 'existing-disk';
      return;
    } catch {}
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: REQUEST_TIMEOUT, validateStatus: s => s >= 200 && s < 400 });
    const contentLength = Number.parseInt(response.headers['content-length'] || '0', 10);
    if (contentLength && contentLength > MAX_IMAGE_BYTES) {
      stats.imagesSkipped += 1;
      stats.imagesSkippedSize += 1;
      img.skipReason = `size-header>${MAX_IMAGE_BYTES}`;
      return;
    }
    if (response.data.byteLength > MAX_IMAGE_BYTES) {
      stats.imagesSkipped += 1;
      stats.imagesSkippedSize += 1;
      img.skipReason = `size-body>${MAX_IMAGE_BYTES}`;
      return;
    }
    await fs.writeFile(finalPath, response.data);
    img.localPath = finalPath;
    downloadedImages.set(url, finalPath);
    stats.imagesDownloaded += 1;
  } catch (err) {
    stats.imagesFailed += 1;
    img.downloadError = err.message;
    img.skipReason = undefined;
  }
}
