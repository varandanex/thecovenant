# Directrices del repositorio

## Estructura del proyecto y organización de módulos

- **`scripts/`**: Utilidades Node.js (ESM). `scrape-thecovenant.mjs` es el scraper, `format-export.mjs` formatea el export y `scrapefull.mjs` orquesta ambas tareas.
- **`data/`**: Exports en crudo y formateados (`thecovenant-export*.json`) y activos descargados (imágenes). Son artefactos de build y no deben editarse a mano.
- **`tests/`**: Runner de pruebas mínimo (`extract.test.mjs`) y fixtures HTML para validar extractores.
- **`README.md`**: Notas arquitectónicas (Next.js + Supabase); alinea la salida del scraper con esta hoja de ruta.

Preferencia de idioma: los agentes de código deben responder por defecto en español, salvo que se solicite explícitamente otro idioma.

## Comandos de build, test y desarrollo

- `npm run scrape`: Ejecuta el scraper. Se pueden aplicar variables de entorno para anular valores por defecto (`SCRAPE_START_URL`, `SCRAPE_MAX_PAGES`, etc.).

- `npm run scrapefull`: Orquesta `scrape-thecovenant.mjs` y `format-export.mjs`, imprimiendo los exports generados.

- `npm run format-export`: Normaliza `data/thecovenant-export.json` y genera `data/thecovenant-export-formatted.json`.

- `npm test` / `npm run test:unit`: Ejecuta `tests/extract.test.mjs`.

## Estilo de código y convenciones de nombrado

- Usar ESM moderno (`.mjs`) con `import`/`export`. Mantener módulos pequeños y enfocados bajo `scripts/`.
- Indentación de dos espacios. Evitar comas finales innecesarias. Usar identificadores en camelCase descriptivos (p. ej. `extractEscapeRoomScoring`).
- Proteger llamadas externas con constantes claras (timeout, concurrency) y exponer configuración vía `process.env` con prefijo `SCRAPE_`.

## Guías de pruebas

- Las pruebas no requieren red: usan fixtures en `tests/fixtures/` (`*.html`). Al añadir detección de nuevos elementos HTML, añade un fixture y un test que importe la función correspondiente (no ejecutar el crawler completo).
- Extender `tests/extract.test.mjs` con pruebas enfocadas por función. Mantener cada test determinista y autocontenido.
- Buscar cobertura funcional de las ramas del parser (solo datos generales, solo scoring, rutas de error) y actualizar fixtures cuando cambie el marcado del sitio.

## Commits y pull requests

- Seguir el patrón de Conventional Commits (`feat:`, `fix:`, `chore:`) para generar changelogs claros.
- Referenciar tareas o issues relacionados en el cuerpo del PR. Resumir el impacto del scraper (nuevos campos, variables `SCRAPE_*`) e incluir snippets de antes/después o JSON de ejemplo cuando proceda.
- En los PRs, listar los comandos de test ejecutados, adjuntar diffs de datos regenerados y señalar supuestos rompibles del scraper para que los revisores puedan verificar con ejecuciones nuevas.

## Seguridad y configuración

- Nunca commitear archivos de entorno o secretos (`.env*`). Documentar las variables `SCRAPE_*` necesarias en la descripción del PR cuando se añadan nuevas.
- Al ejecutar el scraper, respetar `robots.txt` del sitio y reducir la concurrencia (`SCRAPE_CONCURRENCY`) antes de apuntar a hosts que no sean de producción.
