import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { extractEscapeRoomGeneralData, extractEscapeRoomScoring } from '../scripts/scrape-thecovenant.mjs';

function loadFixture(name) {
  return fs.readFileSync(path.resolve(process.cwd(), 'tests', 'fixtures', name), 'utf8');
}

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name} -> ${err.message}`);
    process.exitCode = 1;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- Tests ---

// 1. Review con ambas tablas
 test('extrae datos generales y puntuación cuando ambas tablas están presentes', () => {
  const html = loadFixture('review-with-tables.html');
  const $ = cheerio.load(html);
  const general = extractEscapeRoomGeneralData($, 'https://example.com/review');
  const scoring = extractEscapeRoomScoring($);
  assert(general && scoring, 'general o scoring nulo');
  assert(general.category === 'Terror', 'categoria incorrecta');
  assert(general.durationMinutes === 80, 'duracion minutos incorrecta');
  assert(scoring.terror.value === 4, 'valor terror incorrecto');
  assert(scoring.global.value === 4.5, 'valor global incorrecto');
});

// 2. Sólo datos generales
 test('solo datos generales sin puntuación', () => {
  const html = loadFixture('review-with-only-general.html');
  const $ = cheerio.load(html);
  const general = extractEscapeRoomGeneralData($, 'https://example.com/review');
  const scoring = extractEscapeRoomScoring($);
  assert(general, 'general debe existir');
  assert(!scoring, 'scoring no debe existir');
});

// 3. Sólo puntuación
 test('solo puntuacion sin datos generales', () => {
  const html = loadFixture('review-with-only-scoring.html');
  const $ = cheerio.load(html);
  const general = extractEscapeRoomGeneralData($, 'https://example.com/review');
  const scoring = extractEscapeRoomScoring($);
  assert(!general, 'general no debe existir');
  assert(scoring, 'scoring debe existir');
  assert(scoring.difficulty.value === 2, 'dificultad incorrecta');
});

// 4. No review
 test('no review: no extrae nada', () => {
  const html = loadFixture('non-review.html');
  const $ = cheerio.load(html);
  const general = extractEscapeRoomGeneralData($, 'https://example.com/article');
  const scoring = extractEscapeRoomScoring($);
  assert(!general && !scoring, 'no debe haber datos');
});

// 5. Robustez: valores decimales y ratio
 test('ratio calculado correctamente', () => {
  const html = loadFixture('review-with-tables.html');
  const $ = cheerio.load(html);
  const scoring = extractEscapeRoomScoring($);
  assert(scoring.fun.value === 4.5, 'valor diversión');
  assert(Math.abs(scoring.fun.ratio - 0.9) < 1e-6, 'ratio diversión incorrecto');
});
