# The Covenant – Next.js + Supabase Stack

Proyecto moderno para relanzar [www.thecovenant.es](https://www.thecovenant.es/) con un stack centrado en contenido, rapidez y control total sobre la experiencia editorial.

## Stack principal
- **Next.js 14 (App Router)**: renderizado híbrido (SSG/ISR/SSR), manejo de rutas anidadas y soporte para acciones del servidor.
- **Supabase**: Postgres gestionado, autenticación, almacenamiento de archivos y funciones serverless.
- **Tailwind CSS + shadcn/ui**: sistema de diseño consistente, componentes accesibles y personalizables en React.

## Filosofía de arquitectura
- **Contenido en Supabase**: tablas para posts, autores, etiquetas y revisiones, protegidas con Row Level Security.
- **Panel admin propio**: área `/admin` en Next.js usando Supabase Auth y componentes shadcn/ui para formularios y listados.
- **Sitio público rápido**: páginas del blog generadas de forma estática con revalidación (`revalidatePath`, `revalidateTag`) tras publicar contenido nuevo.
- **Media y assets**: almacenamiento en Supabase Storage, con URLs firmadas para contenido privado cuando sea necesario.

## Próximos pasos sugeridos
1. Inicializar el proyecto con `npx create-next-app@latest` (TypeScript, App Router, Tailwind).
2. Añadir dependencias clave: `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`, `tailwindcss`, `class-variance-authority`, `lucide-react`.
3. Configurar Tailwind y ejecutar el script de instalación de shadcn/ui para generar el theme base.
4. Crear clientes Supabase para server/client y middleware de protección de rutas (`middleware.ts`).
5. Definir el esquema en Supabase (SQL o migraciones) y aplicar políticas RLS.
6. Construir las primeras páginas públicas (`/`, `/blog/[slug]`) y el dashboard editorial mínimo.

## Entorno y despliegue
- **Desarrollo local**: variables en `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Usa `supabase start` para correr una instancia local si quieres emular el backend.
- **Producción**: Vercel para el frontend (con `NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY` gestionada como secret) y Supabase Cloud para la base de datos.
- **Automatización**: configurar webhooks de Supabase (o scripts administrativos) para disparar revalidaciones en la ruta `/api/revalidate` cuando se publique contenido.

## Recursos útiles

## Nota: mejorar tiempos de arranque en desarrollo

Si `npm run dev` tarda mucho en arrancar es probablemente por dos motivos comunes en este repo:

- La app carga un export JSON grande (`data/thecovenant-export-formatted.json`) y/o Next/webpack inspecciona la carpeta `data/images/` con cientos de archivos. Eso provoca mucho file-walking y watchers que ralentizan el inicio.
- Lecturas sincrónicas desde el filesystem durante el import (p.ej. `fs.readFileSync`) bloquean el proceso de servidor.

Qué hicimos aquí y recomendaciones:

- Evita que el dev server vigile carpetas de artefactos: en `next.config.mjs` incluimos `webpackDevMiddleware.watchOptions.ignored = ['**/data/**']`.
- Carga datos pesados de forma asíncrona y bajo demanda (ahora `app/(site)/lib/content.ts` expone `get*Async()` que leen el JSON cuando se necesita desde server components).
- Considera mover assets grandes a un host (CDN/Supabase Storage) o a `public/` y mantener `data/images/` fuera del árbol que Next vigila.

Para medir: ejecuta `time npm run dev` antes y después de los cambios y compara. Si quieres, podemos automatizar una prueba simple que arranque Next y mida el tiempo de ready.
> Este README se irá actualizando conforme se añadan módulos (CMS interno, editor rich text, despliegues automatizados, etc.).

## Herramientas de scraping y limpieza
- `npm run scrapefull`: ejecuta la orquestación completa (`scrape-thecovenant.mjs` + `format-export.mjs`) y vuelca en consola los exports JSON generados.
- `npm run scrape`: ejecuta el scraper original que descarga el contenido del sitio.
- `npm run format-export`: toma `data/thecovenant-export.json`, simplifica el contenido extraído (textos, encabezados, imágenes, enlaces, schema.org) y genera `data/thecovenant-export-formatted.json` con una estructura más legible. El resultado incluye:
  - metadatos en `source` sobre la sesión de crawling;
  - cada página dentro de `pages`, con una lista `sourceUrls` que conserva las variantes originales de la URL;
  - un bloque `assets` con ficheros descargados (por ejemplo imágenes) y sus cabeceras HTTP cuando hay material disponible.
