import { spawn } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

async function runNodeScript(scriptPath, label) {
  const resolvedPath = path.resolve(ROOT_DIR, scriptPath);
  const command = 'node';
  const args = [resolvedPath];

  console.log(`[scrapefull] Ejecutando ${label} -> ${path.relative(ROOT_DIR, resolvedPath)}`);

  const rawMode = (process.env.SCRAPEFULL_RAW_LOGS || 'false').toLowerCase() === 'true';

  function createLineProcessor(prefix) {
    // Patrones que consideramos interesantes en el log limpio
    const keepPatterns = [
      '[Bar]',
      '[Resumen]',
      '[Config]',
      'Export completado',
      '[Imagenes]',
      '[Progreso]',
      '[Limite]',
      '[Cola]',
      '[Crawl] Procesando',
      '[Crawl]',
      'Error',
      'ERROR',
      'UnhandledRejection',
      'UncaughtException',
      '[HTTP ERR]'
    ];

    return (chunk, isErr = false) => {
      if (!chunk) return;
      const text = chunk.toString();
      const lines = text.split(/\r?\n/);
      for (let rawLine of lines) {
        if (!rawLine) continue;
        // En modo crudo mostramos todo
        if (rawMode) {
          const fn = isErr ? console.error : console.log;
          fn(`[${prefix}] ${rawLine}`);
          continue;
        }

        // Filtrar ruido de trazas HTTP normales salvo errores
        if (rawLine.includes('[HTTP ->]') || rawLine.includes('[HTTP <-]')) {
          if (rawLine.includes('[HTTP ERR]') || /error|failed/i.test(rawLine)) {
            const fn = isErr ? console.error : console.log;
            fn(`[${prefix}] ${rawLine}`);
          }
          continue;
        }

        // Truncar líneas muy largas
        const line = rawLine.length > 400 ? `${rawLine.slice(0, 400)}...` : rawLine;

        const interesting = keepPatterns.some(p => line.includes(p));
        if (!interesting) continue;

        const fn = isErr ? console.error : console.log;
        fn(`[${prefix}] ${line}`);
      }
    };
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });

    const proc = createLineProcessor(label);
    child.stdout.on('data', chunk => proc(chunk, false));
    child.stderr.on('data', chunk => proc(chunk, true));

    child.on('error', error => {
      reject(error);
    });

    child.on('exit', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`El script ${label} finalizó con código ${code}`));
      }
    });
  });
}

async function readTextFile(relativePath) {
  const absolutePath = path.resolve(ROOT_DIR, relativePath);
  return readFile(absolutePath, 'utf8');
}

async function emitJson(relativePath, title) {
  try {
    const content = await readTextFile(relativePath);
    console.log(`\n=== ${title} (${relativePath}) ===`);

    // Si se pide ver los exports crudos, imprimimos todo (opción para debug)
    const rawExports = (process.env.SCRAPEFULL_RAW_EXPORTS || 'false').toLowerCase() === 'true';
    if (rawExports) {
      console.log(content.trim());
      return;
    }

    // Intentar parsear JSON y mostrar un resumen útil en lugar del volcado completo
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.pages)) {
        const pages = parsed.pages;
        console.log(`Páginas: ${pages.length}`);
        const sample = pages.slice(0, 5).map(p => ({ url: p.url ?? p.sourceUrl ?? null, title: p.title ?? null, status: p.status ?? null }));
        console.log('Muestra (primeras 5 páginas):');
        sample.forEach((s, i) => console.log(`  ${i + 1}. ${s.url || '<sin url>'} — ${s.title ? JSON.stringify(s.title) : '<no title>'} (status:${s.status ?? '??'})`));
        // Tamaño del JSON
        console.log(`Tamaño archivo: ${Buffer.byteLength(content, 'utf8')} bytes`);
        return;
      }

      // Para objetos con 'entries' (exports genéricos)
      if (Array.isArray(parsed.entries)) {
        console.log(`Entradas: ${parsed.entries.length}`);
        const sample = parsed.entries.slice(0, 5).map(e => ({ type: e.type ?? null, path: e.path ?? null, title: e.title ?? null }));
        console.log('Muestra (primeras 5 entradas):');
        sample.forEach((s, i) => console.log(`  ${i + 1}. ${s.path || '<sin path>'} — ${s.title ? JSON.stringify(s.title) : '<no title>'} (type:${s.type ?? '??'})`));
        console.log(`Tamaño archivo: ${Buffer.byteLength(content, 'utf8')} bytes`);
        return;
      }

      // Para otros JSONs mostramos claves top-level y tamaño
      if (parsed && typeof parsed === 'object') {
        const keys = Object.keys(parsed).slice(0, 20);
        console.log('Claves top-level:', keys.join(', '));
        console.log(`Tamaño archivo: ${Buffer.byteLength(content, 'utf8')} bytes`);
        return;
      }
    } catch (err) {
      // Si no es JSON o fallo de parseo, caemos al fallback
    }

    // Fallback: mostrar sólo las primeras 2000 caracteres para evitar volcar todo
    const snippet = content.slice(0, 2000).trim();
    console.log(snippet + (content.length > 2000 ? '\n... (salto) — establece SCRAPEFULL_RAW_EXPORTS=true para ver todo' : ''));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.warn(`[scrapefull] No se encontró ${relativePath}`);
      return;
    }
    throw error;
  }
}

async function emitExportsDirectory(relativeDir) {
  const directoryPath = path.resolve(ROOT_DIR, relativeDir);
  let entries;

  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.warn(`[scrapefull] No existe el directorio ${relativeDir}; no hay exports adicionales.`);
      return;
    }
    throw error;
  }

  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    console.log(`[scrapefull] El directorio ${relativeDir} está vacío.`);
    return;
  }

  for (const fileName of files) {
    const relativePath = path.join(relativeDir, fileName);
    await emitJson(relativePath, `Export ${fileName}`);
  }
}

async function main() {
  await runNodeScript(path.join('scripts', 'scrape-thecovenant.mjs'), 'scrape-thecovenant');
  await runNodeScript(path.join('scripts', 'format-export.mjs'), 'format-export');

  // Sincronizar a base de datos si está habilitado
  const syncToDb = (process.env.SCRAPE_SYNC_TO_DB || 'false').toLowerCase() === 'true';
  if (syncToDb) {
    console.log('[scrapefull] Sincronizando contenido a base de datos...');
    await runNodeScript(path.join('scripts', 'sync-content-to-db.mjs'), 'sync-content-to-db');
  }

  // Mostrar los JSONs generados (comportamiento previo)
  await emitJson(path.join('data', 'thecovenant-export.json'), 'Export crudo');
  await emitJson(path.join('data', 'thecovenant-export-formatted.json'), 'Export formateado');
  await emitExportsDirectory(path.join('data', 'exports'));

  // Resumen final limpio: leer el export crudo y mostrar métricas relevantes
  try {
    const raw = await readFile(path.join(ROOT_DIR, 'data', 'thecovenant-export.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
    const totalPages = pages.length;
    const errors = pages.filter(p => p && (p.error || (p.status && p.status >= 400))).length;
    const imageStats = parsed.settings?.imageStats || null;

    // Contar tipos de contentType y hosts más frecuentes
    const typeCounts = new Map();
    const hostCounts = new Map();
    for (const p of pages) {
      const ct = (p && p.contentType) ? String(p.contentType).split(';')[0].trim().toLowerCase() : 'unknown';
      typeCounts.set(ct, (typeCounts.get(ct) || 0) + 1);
      try {
        const u = new URL(p.url || p.sourceUrl || '');
        const h = u.hostname.replace(/^www\./, '');
        hostCounts.set(h, (hostCounts.get(h) || 0) + 1);
      } catch {}
    }

    const sortedTypes = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const sortedHosts = Array.from(hostCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

    console.log('\n=== Resumen final limpio ===');
    console.log(`Páginas crawleadas: ${totalPages}`);
    console.log(`Errores detectados: ${errors}`);
    if (imageStats) {
      console.log(`Imágenes descargadas: ${imageStats.downloaded} | fallidas: ${imageStats.failed} | skipped: ${imageStats.skipped}`);
    }
    if (parsed.crawledAt) console.log(`Fecha de crawleo: ${parsed.crawledAt}`);
    if (sortedTypes.length) {
      console.log('Top content-types:');
      sortedTypes.forEach(([t, c]) => console.log(`  ${t} — ${c}`));
    }
    if (sortedHosts.length) {
      console.log('Top hosts crawleados:');
      sortedHosts.forEach(([h, c]) => console.log(`  ${h} — ${c}`));
    }

    console.log('Para ver logs completos durante la ejecución o exports crudos, exporta SCRAPEFULL_RAW_LOGS=true o SCRAPEFULL_RAW_EXPORTS=true');
  } catch (err) {
    console.warn('[scrapefull] No se pudo generar el resumen final:', err.message);
  }
}

main().catch(error => {
  console.error('[scrapefull] Error durante la ejecución:', error);
  process.exitCode = 1;
});
