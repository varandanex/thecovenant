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

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: process.env
    });

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
    console.log(content.trim());
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

  await emitJson(path.join('data', 'thecovenant-export.json'), 'Export crudo');
  await emitJson(path.join('data', 'thecovenant-export-formatted.json'), 'Export formateado');
  await emitExportsDirectory(path.join('data', 'exports'));
}

main().catch(error => {
  console.error('[scrapefull] Error durante la ejecución:', error);
  process.exitCode = 1;
});
