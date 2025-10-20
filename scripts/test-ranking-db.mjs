#!/usr/bin/env node
/**
 * Script de prueba para verificar que la función getEscapeRoomRanking
 * carga correctamente los datos desde la base de datos.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurar variables de entorno para la prueba
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
process.env.ENABLE_DB = "true";
process.env.CONTENT_SOURCE = "database";

async function testRanking() {
  console.log("🔍 Probando carga de ranking desde base de datos...\n");

  try {
    // Importar la función después de configurar las variables de entorno
    const { getEscapeRoomRanking, getRankingStats } = await import("../app/(site)/lib/ranking-data.ts");

    console.log("⏳ Cargando ranking...");
    const ranking = await getEscapeRoomRanking();

    console.log(`\n✅ Ranking cargado exitosamente!`);
    console.log(`📊 Total de escape rooms: ${ranking.length}\n`);

    if (ranking.length > 0) {
      const stats = getRankingStats(ranking);
      
      console.log("📈 Estadísticas del ranking:");
      console.log(`  - Total de salas: ${stats.totalRooms}`);
      console.log(`  - Provincias: ${stats.provinces}`);
      console.log(`  - Estudios: ${stats.studios}`);
      console.log(`  - Valoración media: ${stats.averageRating.toFixed(2)}`);
      console.log(`  - Duración media: ${Math.round(stats.averageDuration)} min\n`);

      console.log("🏆 Top 5 escape rooms:");
      ranking.slice(0, 5).forEach((entry, index) => {
        console.log(`  ${index + 1}. ${entry.name} (${entry.studio})`);
        console.log(`     📍 ${entry.city}, ${entry.province}`);
        console.log(`     ⭐ Rating: ${entry.rating.toFixed(1)} | Inmersión: ${entry.immersion.toFixed(1)} | Puzles: ${entry.puzzles.toFixed(1)}`);
        console.log(`     🕐 ${entry.durationMinutes} min | ${entry.minPlayers}-${entry.maxPlayers} jugadores`);
        console.log("");
      });
    } else {
      console.log("⚠️  El ranking está vacío. Puede que no haya artículos con datos de escape room en la BD.");
      console.log("💡 Ejecuta `npm run scrape:sync` para sincronizar datos a la base de datos.");
    }

  } catch (error) {
    console.error("❌ Error al cargar el ranking:", error);
    process.exit(1);
  }
}

testRanking();
