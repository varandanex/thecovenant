#!/usr/bin/env node
/**
 * Script de validación para verificar la configuración del sistema de sincronización
 * Uso: node scripts/validate-sync-setup.mjs
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const prisma = new PrismaClient();

async function checkDatabaseConnection() {
  console.log("✓ Verificando conexión a base de datos...");
  try {
    await prisma.$connect();
    console.log("  ✅ Conexión exitosa");
    return true;
  } catch (error) {
    console.error("  ❌ Error de conexión:", error.message);
    console.error("  💡 Verifica que DATABASE_URL esté configurado en .env");
    return false;
  }
}

async function checkExportFiles() {
  console.log("\n✓ Verificando archivos de export...");
  const files = [
    "data/thecovenant-export.json",
    "data/thecovenant-export-formatted.json"
  ];
  
  let allExist = true;
  for (const file of files) {
    try {
      await fs.access(file);
      const stats = await fs.stat(file);
      console.log(`  ✅ ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    } catch (error) {
      console.warn(`  ⚠️  ${file} no encontrado`);
      allExist = false;
    }
  }
  
  return allExist;
}

async function checkDatabaseSchema() {
  console.log("\n✓ Verificando esquema de base de datos...");
  try {
    // Verificar que existen las tablas necesarias
    const articlesCount = await prisma.article.count();
    const revisionsCount = await prisma.articleRevision.count();
    const settingsCount = await prisma.siteSettings.count();
    
    console.log("  ✅ Tabla 'articles' existe");
    console.log(`     - ${articlesCount} artículos en base de datos`);
    console.log("  ✅ Tabla 'article_revisions' existe");
    console.log(`     - ${revisionsCount} revisiones guardadas`);
    console.log("  ✅ Tabla 'site_settings' existe");
    console.log(`     - ${settingsCount} configuración(es) guardada(s)`);
    
    return true;
  } catch (error) {
    console.error("  ❌ Error al verificar esquema:", error.message);
    console.error("  💡 Ejecuta: npm run db:push");
    return false;
  }
}

async function checkForDuplicates() {
  console.log("\n✓ Verificando duplicados en base de datos...");
  try {
    const duplicates = await prisma.$queryRaw`
      SELECT slug, COUNT(*) as count 
      FROM articles 
      GROUP BY slug 
      HAVING COUNT(*) > 1
    `;
    
    if (duplicates.length === 0) {
      console.log("  ✅ No se encontraron duplicados");
      return true;
    } else {
      console.error("  ❌ Se encontraron slugs duplicados:");
      duplicates.forEach(dup => {
        console.error(`     - "${dup.slug}": ${dup.count} entradas`);
      });
      return false;
    }
  } catch (error) {
    console.warn("  ⚠️  No se pudo verificar duplicados:", error.message);
    return false;
  }
}

async function showSampleArticles() {
  console.log("\n✓ Muestra de artículos en base de datos...");
  try {
    const sample = await prisma.article.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: {
        slug: true,
        title: true,
        category: true,
        publishedAt: true,
        updatedAt: true
      }
    });
    
    if (sample.length === 0) {
      console.log("  ℹ️  No hay artículos en la base de datos");
      console.log("  💡 Ejecuta: npm run scrape:sync");
    } else {
      console.log("  📄 Últimos artículos actualizados:");
      sample.forEach((article, i) => {
        console.log(`     ${i + 1}. ${article.title}`);
        console.log(`        slug: ${article.slug}`);
        console.log(`        categoría: ${article.category || 'sin categoría'}`);
        console.log(`        actualizado: ${article.updatedAt.toISOString()}`);
      });
    }
    
    return true;
  } catch (error) {
    console.error("  ❌ Error al obtener muestra:", error.message);
    return false;
  }
}

async function main() {
  console.log("🔍 Validación del sistema de sincronización\n");
  console.log("=".repeat(60));
  
  const results = {
    database: await checkDatabaseConnection(),
    exports: await checkExportFiles(),
    schema: false,
    duplicates: false,
    sample: false
  };
  
  // Solo continuar si la conexión fue exitosa
  if (results.database) {
    results.schema = await checkDatabaseSchema();
    results.duplicates = await checkForDuplicates();
    results.sample = await showSampleArticles();
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 Resumen de validación:");
  console.log(`   Conexión BD:        ${results.database ? '✅' : '❌'}`);
  console.log(`   Archivos export:    ${results.exports ? '✅' : '⚠️'}`);
  console.log(`   Esquema BD:         ${results.schema ? '✅' : '❌'}`);
  console.log(`   Sin duplicados:     ${results.duplicates ? '✅' : '❌'}`);
  
  const allGood = results.database && results.schema && results.duplicates;
  
  if (allGood) {
    console.log("\n✨ ¡Todo en orden! El sistema está listo para usar.");
    console.log("\n💡 Comandos útiles:");
    console.log("   npm run scrape:sync    # Scraping + sync a BD");
    console.log("   npm run content:sync   # Solo sync (sin scraping)");
    console.log("   npx prisma studio      # Explorar base de datos");
  } else {
    console.log("\n⚠️  Hay problemas que resolver antes de continuar.");
    if (!results.database) {
      console.log("\n📝 Pasos sugeridos:");
      console.log("   1. Verifica tu archivo .env con DATABASE_URL");
      console.log("   2. Asegúrate que la base de datos esté accesible");
    }
    if (!results.schema) {
      console.log("   3. Ejecuta: npm run db:push");
    }
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("\n❌ Error fatal durante validación:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
