## Contexto rápido

Repositorio de herramientas y datos para el relanzamiento de www.thecovenant.es. Contiene:
- `scripts/` : scraper (`scrape-thecovenant.mjs`) y formateador (`format-export.mjs`).
- `data/` : exports JSON y carpetas de imágenes (`data/thecovenant-export.json`, `data/thecovenant-export-formatted.json`, `data/images/`).
- `tests/` : pruebas unitarias pequeñas que usan fixtures HTML.

Los scripts son módulos ESM (import/export) y están pensados para ejecutarse con Node.js (sin bundler). Evitar efectos colaterales al importar módulos: el crawler usa una comprobación `invokedAsScript` para no ejecutarse durante imports.

## Qué necesita saber un agente para ser productivo

- Comandos importantes:
  - `npm run scrape` — ejecuta el scraper y luego el formateador (produce `data/thecovenant-export.json`).
  - `npm run format-export` — transforma `data/thecovenant-export.json` a `data/thecovenant-export-formatted.json`.
  - `npm test` / `npm run test:unit` — ejecuta `tests/extract.test.mjs`.

- Variables de entorno relevantes para el scraper (`scripts/scrape-thecovenant.mjs`):
  - `SCRAPE_START_URL` (por defecto `https://www.thecovenant.es/`)
  - `SCRAPE_OUTPUT` (ruta de salida JSON)
  - `SCRAPE_MAX_PAGES`, `SCRAPE_CONCURRENCY`, `SCRAPE_TIMEOUT`
  - `SCRAPE_INCLUDE_SITEMAPS` (true/false)
  - `SCRAPE_DOWNLOAD_IMAGES`, `SCRAPE_IMAGE_DIR`, `SCRAPE_IMAGE_CONCURRENCY`, `SCRAPE_MAX_IMAGE_BYTES`
  - `SCRAPE_VERBOSE` (imprime trazas HTTP)
  - `SCRAPE_PROGRESS_BAR` (activar/desactivar barra de progreso)

- Salidas clave y formato: el export es un objeto con `pages` (array). Cada página contiene campos detectados por el scraper: `url`, `title`, `meta`, `links`, `images`, `outline`, `contentBlocks`, `rawHtml`, `jsonLd`, etc. El formateador extrae: `headings`, `paragraphs`, `images`, `links`, `wordCount`, `readingTimeMinutes` y guarda en `data/thecovenant-export-formatted.json`.

## Patrones y convensiones del código

- Scripts están escritos como ESM (p. ej. `import axios from 'axios'`). Mantener esa modalidad en nuevas utilidades.
- Evitar ejecutar tareas largas en tiempo de import: proteger el `run()` con la comprobación de entrypoint (ya presente en `scrape-thecovenant.mjs`).
- Exportar funciones puras para facilitar pruebas. Ejemplo: `extractEscapeRoomGeneralData` y `extractEscapeRoomScoring` se exportan para testearlos desde `tests/extract.test.mjs`.
- Normalización: URLs son normalizadas con `normalizeUrl` (quita hash, ordena query params, normaliza barras finales). Tenlo en cuenta cuando añadas comparaciones de URLs o deduplicación.
- Textos: normalización de espacios y eliminación de diacríticos (`normalizeWhitespace`, `normalizeForComparison`) se usan en formateador; réplicalo si añades lógica de texto.

## Pruebas y fixtures

- Las pruebas no requieren red: usan `tests/fixtures/*.html`. Al añadir detección de nuevos elementos HTML, añade un fixture y un test que importe la función (no ejecutar el crawler completo).
- Ejecuta `npm test` tras cambios en parser/extractors.

## Depuración y workflow local

- Para debug rápido del scraper:
  - Habilita trazas HTTP: `SCRAPE_VERBOSE=true npm run scrape`.
  - Desactivar barra si piped: `SCRAPE_PROGRESS_BAR=false`.
  - Limita páginas: `SCRAPE_MAX_PAGES=50` y reduce concurrencia para reproducibilidad.
- El scraper guarda imágenes en `data/images/<hostname>/` y evita re-descargas si el fichero ya existe.

## Compatibilidad e intervención humana

- Mantener compatibilidad hacia atrás en el shape de salida si hay consumidores externos: `format-export.mjs` conserva `escapeRoomInfo` como alias cuando existe `escapeRoomGeneralData`.
- Si cambias la estructura de `data/...-formatted.json`, actualiza README y añade un script de migración o nota en `README.md`.

## Cuando pidas un cambio al agente

- Prioriza pequeñas PRs enfocadas (ej: "añadir extracción de meta X"), incluye:
  1. Tests con fixtures nuevos o actualizados.
  2. Cambio en el parser (`scripts/*.mjs`) y en el formateador si cambia shape.
  3. Verificación: `npm test` + `npm run format-export` sobre un export de prueba.

Si algo no es evidente (por ejemplo, qué URLs deben considerarse internas/external), pide permiso antes de cambiar la lógica de normalización de URLs.

---
Por favor revisa este borrador y dime si quieres que añada ejemplos concretos de env vars en comandos, o que incluya una sección de "preguntas frecuentes" para agentes (p. ej. límites de tiempo por request, manejo de robots.txt). 
