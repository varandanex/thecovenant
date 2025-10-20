# Ranking de Escape Rooms desde Base de Datos

## Cambios realizados

Se ha modificado la página `/ranking-escape-rooms` para que obtenga los datos dinámicamente desde la base de datos en lugar de usar datos hardcoded.

### Archivos modificados

1. **`app/(site)/lib/ranking-data.ts`**
   - Se agregaron imports necesarios para trabajar con la base de datos
   - Se creó la función `articleToRankingEntry()` que convierte un `Article` con datos de escape room en un `EscapeRoomRankingEntry`
   - Se creó la función `loadRankingFromDatabase()` que carga todos los artículos con `escapeRoomScoring` desde la BD
   - Se convirtió `getEscapeRoomRanking()` en una función asíncrona que primero intenta cargar desde la BD y usa el ranking hardcoded como fallback
   - Se mantiene el ranking hardcoded para garantizar que siempre haya contenido disponible

2. **`app/(site)/ranking-escape-rooms/page.tsx`**
   - Se cambió de importar `escapeRoomRanking` directamente a usar `getEscapeRoomRanking()`
   - Se convirtió el componente en `async` para poder usar `await` en la carga de datos
   - Se mantiene toda la lógica de presentación sin cambios

### Cómo funciona

La función `getEscapeRoomRanking()` ahora:

1. Verifica si la base de datos está habilitada mediante las variables de entorno
2. Si está habilitada, consulta todos los artículos que tengan el campo `escapeRoomScoring` no nulo
3. Convierte cada artículo a formato `EscapeRoomRankingEntry` extrayendo:
   - **Nombre**: Del título del artículo (después de los dos puntos)
   - **Estudio**: Del título del artículo (antes de los dos puntos)
   - **Provincia**: De `escapeRoomGeneralData.province`
   - **Ciudad**: De la categoría del artículo
   - **Rating**: De `escapeRoomScoring.global.ratio * 10`
   - **Métricas individuales**: De los campos correspondientes en `escapeRoomScoring`
   - **Dificultad**: Calculada desde `escapeRoomScoring.difficulty.ratio`
   - **Duración y jugadores**: De `escapeRoomGeneralData`
4. Ordena las entradas por rating descendente
5. Si no hay datos en la BD o hay algún error, usa el ranking hardcoded como fallback

### Mapeo de campos

```
Article → EscapeRoomRankingEntry
├─ title → name + studio (parseado)
├─ category → city (última parte) + theme
├─ slug → id
├─ description/excerpt → description
├─ tags → tags
├─ escapeRoomGeneralData
│  ├─ province → province
│  ├─ durationMinutes → durationMinutes
│  ├─ minPlayers → minPlayers
│  ├─ maxPlayers → maxPlayers
│  └─ webLink → url
└─ escapeRoomScoring
   ├─ global.ratio → rating (× 10)
   ├─ immersion.ratio → immersion (× 10)
   ├─ puzzles.ratio → puzzles (× 10)
   ├─ fun.ratio → narrative (× 10)
   ├─ terror.ratio → intensity (× 10)
   └─ difficulty.ratio → difficulty (Baja/Media/Alta)
```

## Cómo activar la base de datos

Para que la página use datos de la base de datos, necesitas configurar las variables de entorno en `.env`:

```bash
# Opción 1: Activar BD manteniendo fallback a archivo
ENABLE_DB=true

# Opción 2: Forzar uso de BD (sin fallback)
CONTENT_SOURCE=database
ENABLE_DB=true
```

## Cómo probar

### 1. Verificar que hay datos en la base de datos

```bash
# Sincronizar datos del scraper a la BD
npm run scrape:sync

# O sincronizar desde el export existente
npm run content:sync
```

### 2. Activar la base de datos

Edita el archivo `.env` y establece:

```bash
ENABLE_DB=true
```

### 3. Iniciar el servidor de desarrollo

```bash
npm run dev
```

### 4. Visitar la página

Abre http://localhost:3000/ranking-escape-rooms en tu navegador.

### 5. Verificar que carga desde BD

Puedes verificar que está usando la BD de varias formas:

- **Revisa los logs del servidor**: Si hay datos en la BD, se cargarán desde ahí
- **Modifica datos en la BD**: Usa Prisma Studio (`npx prisma studio`) para editar un escape room y verifica que los cambios se reflejan en la página
- **Desactiva la BD**: Cambia `ENABLE_DB=false` y verifica que vuelve a usar el ranking hardcoded

## Comportamiento de fallback

Si ocurre algún error al cargar desde la base de datos o si no hay artículos con datos de escape room:

1. Se imprime un warning en la consola del servidor
2. Se usa automáticamente el ranking hardcoded (las 15 salas que ya estaban en el código)
3. La página sigue funcionando normalmente

Esto garantiza que la página **siempre** muestre contenido, incluso si:
- La BD no está configurada
- No hay datos en la BD
- Hay un error de conexión
- Los datos están corruptos

## Ventajas de esta implementación

✅ **Contenido dinámico**: Los datos se actualizan automáticamente cuando se sincroniza nuevo contenido  
✅ **Fallback robusto**: Siempre hay contenido disponible, incluso sin BD  
✅ **Compatibilidad**: Funciona tanto con SQLite local como con PostgreSQL/Supabase  
✅ **Sin cambios visuales**: La UI se mantiene exactamente igual  
✅ **Performance**: Se aprovecha el cache de Next.js para optimizar las consultas  

## Próximos pasos sugeridos

1. **Agregar revalidación**: Considera usar `revalidate` en la página para actualizar el contenido periódicamente:
   ```typescript
   export const revalidate = 3600; // Revalidar cada hora
   ```

2. **Mejorar el parseo**: El parsing del título (`Estudio: Nombre`) asume un formato específico. Considera agregar campos dedicados en el scraper para estudio y nombre del escape room.

3. **Agregar más filtros**: La estructura actual permite agregar filtros más sofisticados usando las capacidades de Prisma (ej: filtrar por provincia, ciudad, rango de valoración, etc.).

4. **Caché adicional**: Considera cachear el resultado de `getEscapeRoomRanking()` en memoria o usar el Data Cache de Next.js para reducir consultas a la BD.
