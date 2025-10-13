# Repository Guidelines

## Project Structure & Module Organization
- **`scripts/`**: Node.js ESM utilities. `scrape-thecovenant.mjs` crawls www.thecovenant.es, `format-export.mjs` limpia el dataset capturado y `scrapefull.mjs` orquesta ambas tareas mostrando los exports generados.
- **`data/`**: Raw and formatted exports (`thecovenant-export*.json`) plus scraped assets. Treated as build artefacts, never edited by hand.
- **`tests/`**: Minimal runner (`extract.test.mjs`) and HTML fixtures used to validate extraction helpers.
- **`README.md`**: Architectural vision for the forthcoming Next.js + Supabase stack; align scraper output with this roadmap.

## Build, Test & Development Commands
- `npm run scrape`: Crawls the live site. Use environment overrides like `SCRAPE_START_URL` or `SCRAPE_MAX_PAGES` when staging.
- `npm run scrapefull`: Ejecuta `scrape-thecovenant.mjs`, luego `format-export.mjs` y emite en consola los exports resultantes.
- `npm run format-export`: Normalizes `data/thecovenant-export.json` into the formatted export; run after every scrape.
- `npm test` / `npm run test:unit`: Executes `tests/extract.test.mjs`; exits non-zero on first failure to keep CI feedback tight.

## Coding Style & Naming Conventions
- Prefer modern ESM (`.mjs`) with top-level `import`/`export`. Keep modules small and task-focused under `scripts/`.
- Use two-space indentation, trailing commas omitted, and descriptive camelCase identifiers (`extractEscapeRoomScoring`).
- Guard external calls with clear constants (timeout, concurrency) and surface configuration via `process.env` keys prefixed with `SCRAPE_`.

## Testing Guidelines
- Add new fixtures in `tests/fixtures/` mirroring real HTML edge cases; name using hyphenated English descriptions.
- Extend `tests/extract.test.mjs` with single-function helper assertions. Keep each test self-contained and deterministic.
- Aim for functional coverage of parsing branches (general data only, scoring only, error paths) and update fixtures when site markup shifts.

## Commit & Pull Request Guidelines
- Follow the existing Conventional Commits pattern (`feat:`, `fix:`, `chore:`) seen in `git log` for clarity in changelog generation.
- Reference any tracked tasks/issues in the body. Summarize scraper impacts (new fields, env variables) and include before/after snippets or sample JSON when relevant.
- For pull requests, list test commands executed, attach diffs for regenerated data files, and call out breaking scraper assumptions so reviewers can verify with fresh runs.

## Security & Configuration Notes
- Never commit `.env*` secrets. Document required `SCRAPE_*` variables in PR descriptions when introducing new ones.
- When running the scraper, respect the public robots.txt and limit concurrency via `SCRAPE_CONCURRENCY` before targeting non-production hosts.
