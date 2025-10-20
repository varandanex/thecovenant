# Scraping y sincronización automática a base de datos

## Resumen

Ya no necesitas ejecutar comandos separados para importar contenido. El sistema ahora soporta **scraping directo a base de datos** con actualización inteligente (upsert) que evita duplicados.

## ¿Cómo funciona?

El sistema usa la operación `upsert` de Prisma que:
- **Actualiza** el artículo si ya existe (basándose en el `slug`)
- **Crea** un nuevo artículo si no existe
- **Nunca duplica** entradas

Además:
- Calcula un checksum del contenido para detectar cambios reales
- Solo actualiza si el contenido ha cambiado
- Crea revisiones automáticas en `article_revisions` para trazabilidad
- Elimina artículos obsoletos que ya no están en el export

## Comando principal

```bash
npm run scrape:sync
```

Este comando ejecuta en secuencia:
1. **Scraping** → descarga contenido del sitio web
2. **Formateo** → transforma el JSON a formato normalizado
3. **Sincronización** → guarda/actualiza en Supabase automáticamente

## Variables de entorno relevantes

Todas las variables `SCRAPE_*` funcionan normalmente:

Además, para controlar la fuente de contenido en la aplicación:

- `CONTENT_SOURCE=database` fuerza a leer de la base de datos si es válida.
- `USE_DATABASE_CONTENT=true` permite que la app intente BD salvo que `CONTENT_SOURCE=file`.
- `ENABLE_DB=true` fuerza lectura desde BD siempre que `DATABASE_URL` tenga protocolo válido (`file:` o `postgresql://`). Tiene prioridad sobre `USE_DATABASE_CONTENT` y es el flag recomendado para despliegues donde se quiere asegurar que Prisma es la fuente principal.

```bash
# Ejemplo: scraping limitado con sync a BD
SCRAPE_MAX_PAGES=50 SCRAPE_CONCURRENCY=3 npm run scrape:sync

# Ejemplo: scraping verboso con sync
SCRAPE_VERBOSE=true npm run scrape:sync

# Ejemplo: scraping desde URL específica
SCRAPE_START_URL=https://www.thecovenant.es/categoria/cronicas npm run scrape:sync
```

## Comandos alternativos

Si prefieres control manual del proceso:

```bash
# 1. Solo scraping y formateo (sin BD)
npm run scrapefull

# 2. Solo sincronizar a BD (sin scraping previo)
npm run content:sync

# 3. Scraping básico
npm run scrape
```

## Modo avanzado: activar sync en `scrapefull`

Si usas `npm run scrapefull` y quieres activar la sincronización:

```bash
SCRAPE_SYNC_TO_DB=true npm run scrapefull
```

## Estructura de datos en Supabase

### Tabla `articles`
- `slug` (único) — identificador del artículo
- `title`, `description`, `excerpt`
- `coverImageUrl`, `coverImageAlt`
- `category`, `tags` (JSON)
- `publishedAt`, `readingTime`
- `sections` (JSON) — contenido estructurado
- `escapeRoomGeneralData`, `escapeRoomScoring` (JSON opcional)
- `contentHash` — checksum para detectar cambios
- `createdAt`, `updatedAt`

### Tabla `article_revisions`
- Guarda el historial completo de cada actualización
- Referencia al artículo padre
- Contiene snapshot del contenido en cada cambio

### Tabla `site_settings`
- Configuración global del sitio
- Hero, navigation, featured posts, etc.

## Verificación

Después de ejecutar `npm run scrape:sync`:

1. Revisa los logs: verás mensajes como:
   ```
   [sync-content-to-db] Sincronización completada: 42 artículos y navegación actualizada.
   ```

2. Consulta directamente en Supabase o usando Prisma Studio:
   ```bash
   npx prisma studio
   ```

3. Verifica que no hay duplicados:
   ```sql
   SELECT slug, COUNT(*) as count 
   FROM articles 
   GROUP BY slug 
   HAVING COUNT(*) > 1;
   ```
   (Debería devolver 0 filas)

## Solución de problemas

### Error: "DATABASE_URL no está configurado"
Asegúrate de tener `.env` o `.env.local` con:
```
DATABASE_URL="postgresql://..."

Si usas SQLite local:
```
DATABASE_URL="file:./dev.db"
```
Y activa con:
```
ENABLE_DB=true
```
```

### Los artículos no se actualizan
El sistema solo actualiza si el `contentHash` cambia. Para forzar actualización:
1. Modifica el contenido en el sitio original
2. Vuelve a ejecutar `npm run scrape:sync`
3. O elimina manualmente los registros y vuelve a importar

### Quiero borrar todo y empezar de cero
```bash
# Borra todos los artículos
npx prisma db push --force-reset

# Vuelve a importar
npm run scrape:sync
```

## Mejores prácticas

1. **Desarrollo**: usa límites para scraping rápido
   ```bash
   SCRAPE_MAX_PAGES=20 npm run scrape:sync
   ```

2. **Producción**: scraping completo en segundo plano
   ```bash
   npm run scrape:sync > scrape.log 2>&1 &
   ```

3. **CI/CD**: añade el comando a tu pipeline
   ```yaml
   - name: Update content
     run: npm run scrape:sync
     env:
       DATABASE_URL: ${{ secrets.DATABASE_URL }}
   ```

4. **Monitoreo**: guarda logs y revisa métricas de artículos sincronizados

## Roadmap futuro

- [ ] Sincronización incremental (solo URLs modificadas)
- [ ] Webhooks para notificar actualizaciones
- [ ] Panel admin para revisar revisiones
- [ ] Rollback a versiones anteriores
- [ ] Programación de scraping (cron jobs)
