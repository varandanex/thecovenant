import { readFile } from 'node:fs/promises';
import * as cheerio from 'cheerio';

// Normalización (copiado del scraper principal)
function normalizeWhitespace(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\s+/g, ' ').trim();
}

function toAbsoluteUrl(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

// Función de extracción (copiada del scraper con las correcciones)
function extractEscapeRoomGeneralData($, pageUrl) {
  const tables = $('table.tabla-scoring-datos-principales');
  if (!tables.length) return null;
  let generalTable = null;
  tables.each((_, table) => {
    const $table = $(table);
    const headerText = $table.find('thead th').text().toLowerCase();
    if (headerText.includes('datos generales') && headerText.includes('escape room')) {
      generalTable = $table;
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
    console.log('  Row:', { label, labelNorm, valueText });
    if (!label) return;
    if (labelNorm.includes('categoria') || labelNorm.includes('categoría')) {
      info.category = valueText || null;
    } else if (labelNorm.includes('provincia')) {
      info.province = valueText || null;
    } else if (labelNorm.includes('duracion') || labelNorm.includes('duración')) {
      info.durationText = valueText || null;
      const txt = (valueText || '').toLowerCase();
      const durMatch = txt.match(/(\d+)\s*(hora|horas)/);
      if (durMatch) {
        const num = parseInt(durMatch[1], 10);
        info.durationMinutes = num * 60;
      } else {
        const minMatch = txt.match(/(\d+)\s*(minuto|minutos|min)/);
        if (minMatch) {
          info.durationMinutes = parseInt(minMatch[1], 10);
        } else {
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

// Cargar fixture de prueba
const fixtureHtml = await readFile('tests/fixtures/review-with-tables.html', 'utf-8');
const $ = cheerio.load(fixtureHtml);
const result = extractEscapeRoomGeneralData($, 'https://www.thecovenant.es/');

console.log('\n=== Resultado de extracción ===');
console.log(JSON.stringify(result, null, 2));
