import { parseDbArticle } from "./parse-db-article";
import type { Article, EscapeRoomGeneralData, EscapeRoomScoring } from "./types";

export type EscapeRoomRankingEntry = {
  id: string;
  name: string;
  city: string;
  province: string;
  studio: string;
  rating: number;
  difficultyScore: number;
  difficultyLabel: "Baja" | "Media" | "Alta";
  immersion: number;
  fun: number;
  puzzles: number;
  gameMaster: number;
  durationMinutes: number;
  minPlayers: number;
  maxPlayers: number;
  theme: string;
  tags: string[];
  url?: string;
  description: string;
};

type PrismaInstance = typeof import("./prisma") extends { default: infer Client } ? Client : never;
let prismaClient: PrismaInstance | null = null;

async function getPrismaClient(): Promise<PrismaInstance> {
  if (!prismaClient) {
    const module = await import("./prisma");
    prismaClient = module.default;
  }
  return prismaClient;
}

const rawDbUrl = process.env.DATABASE_URL ?? "";
const isValidDatabaseUrl = rawDbUrl.startsWith("file:") || rawDbUrl.startsWith("postgresql://") || rawDbUrl.startsWith("postgres://");
const contentSource = (process.env.CONTENT_SOURCE ?? "").toLowerCase();
const enableDbFlag = (process.env.ENABLE_DB ?? "").toLowerCase() === "true";
const DATABASE_CONTENT_ENABLED =
  (contentSource === "database" && isValidDatabaseUrl) ||
  (enableDbFlag && isValidDatabaseUrl) ||
  (contentSource !== "file" && process.env.USE_DATABASE_CONTENT === "true" && isValidDatabaseUrl);

export const escapeRoomRanking: EscapeRoomRankingEntry[] = [
  {
    id: "cuervo",
    name: "El Cuervo",
    studio: "Insomnia Corporation",
    city: "Barcelona",
    province: "Barcelona",
    rating: 9.8,
    difficultyScore: 6.5,
    difficultyLabel: "Media",
    immersion: 9.9,
    fun: 9.7,
    puzzles: 9.2,
    gameMaster: 7.5,
    durationMinutes: 120,
    minPlayers: 3,
    maxPlayers: 6,
    theme: "Thriller psicológico",
    tags: ["cinematográfico", "investigación", "experiencia extendida"],
    url: "https://insomniacorporation.com/el-cuervo",
    description:
      "Una investigación guiada por actores en vivo que combina cine interactivo, exploración urbana y puzles no lineales a escala real."
  },
  {
    id: "fortaleza",
    name: "La Fortaleza",
    studio: "Insomnia Corporation",
    city: "Mataró",
    province: "Barcelona",
    rating: 9.7,
    difficultyScore: 6.4,
    difficultyLabel: "Media",
    immersion: 9.8,
    fun: 9.5,
    puzzles: 9.4,
    gameMaster: 8.2,
    durationMinutes: 100,
    minPlayers: 3,
    maxPlayers: 5,
    theme: "Ciencia ficción táctica",
    tags: ["cooperativo", "alto ritmo", "tecnología"],
    url: "https://insomniacorporation.com/la-fortaleza",
    description:
      "Una misión infiltrada con gadgets personalizados, interacción constante con el game master y un tramo final de adrenalina pura."
  },
  {
    id: "tormenta",
    name: "La Tormenta",
    studio: "Mad Mansion",
    city: "Bilbao",
    province: "Bizkaia",
    rating: 9.6,
    difficultyScore: 6.2,
    difficultyLabel: "Media",
    immersion: 9.5,
    fun: 9.4,
    puzzles: 9.3,
    gameMaster: 7.8,
    durationMinutes: 90,
    minPlayers: 2,
    maxPlayers: 5,
    theme: "Steampunk sobrenatural",
    tags: ["multi-espacio", "producción sonora", "final épico"],
    url: "https://madmansion.com/la-tormenta",
    description:
      "Exploración por fases con ambientación steampunk, narrativa ramificada y un clímax cooperativo que deja huella."
  },
  {
    id: "taberna",
    name: "La Última Taberna",
    studio: "Chronologic",
    city: "Madrid",
    province: "Madrid",
    rating: 9.5,
    difficultyScore: 8.1,
    difficultyLabel: "Alta",
    immersion: 9.3,
    fun: 9.2,
    puzzles: 9.6,
    gameMaster: 6.5,
    durationMinutes: 80,
    minPlayers: 2,
    maxPlayers: 5,
    theme: "Aventura histórica",
    tags: ["puzles lógicos", "multifinal", "interacción con objetos"],
    url: "https://chronologic.es/ultima-taberna",
    description:
      "Viaje temporal con capas de resolución paralelas, puzles manipulativos y una recreación artesanal de taberna del Siglo de Oro."
  },
  {
    id: "matriarca",
    name: "La Matriarca",
    studio: "SkpRoom",
    city: "Valencia",
    province: "Valencia",
    rating: 9.4,
    difficultyScore: 6.9,
    difficultyLabel: "Media",
    immersion: 9.6,
    fun: 9.3,
    puzzles: 9.1,
    gameMaster: 8.8,
    durationMinutes: 100,
    minPlayers: 3,
    maxPlayers: 6,
    theme: "Terror psicológico",
    tags: ["actor en vivo", "terror sostenido", "final a elección"],
    url: "https://skproom.es/la-matriarca",
    description:
      "Horror íntimo con un personaje central inolvidable, mecánicas de confianza/desconfianza y una segunda mitad demoledora."
  },
  {
    id: "azotea",
    name: "Azotea 2049",
    studio: "Unreal Room Escape",
    city: "Hospitalet de Llobregat",
    province: "Barcelona",
    rating: 9.3,
    difficultyScore: 6.0,
    difficultyLabel: "Media",
    immersion: 9.1,
    fun: 9.0,
    puzzles: 9.4,
    gameMaster: 7.1,
    durationMinutes: 75,
    minPlayers: 2,
    maxPlayers: 6,
    theme: "Cyberpunk cooperativo",
    tags: ["dual play", "gadget real", "música original"],
    url: "https://unrealroomescape.com/azotea-2049",
    description:
      "Un asalto coordinado en dos alturas que se apoya en comunicación constante, puzles asincrónicos y un tramo final de vértigo."
  },
  {
    id: "naufragio",
    name: "Náufragos del Vanguard",
    studio: "Escape Barcelona",
    city: "Cornellà",
    province: "Barcelona",
    rating: 9.2,
    difficultyScore: 6.3,
    difficultyLabel: "Media",
    immersion: 9.4,
    fun: 9.1,
    puzzles: 9.0,
    gameMaster: 7.9,
    durationMinutes: 80,
    minPlayers: 2,
    maxPlayers: 6,
    theme: "Aventura submarina",
    tags: ["decorado 360", "efectos de agua", "exploración libre"],
    url: "https://escape-barcelona.com/naufragos",
    description:
      "Inmersión acuática con pasarelas móviles, iluminación dinámica y una BSO que responde a las decisiones del equipo."
  },
  {
    id: "residencia",
    name: "Residencia Kovak",
    studio: "Cryptic Tales",
    city: "Sevilla",
    province: "Sevilla",
    rating: 9.1,
    difficultyScore: 6.7,
    difficultyLabel: "Media",
    immersion: 9.3,
    fun: 9.0,
    puzzles: 8.8,
    gameMaster: 8.5,
    durationMinutes: 95,
    minPlayers: 3,
    maxPlayers: 6,
    theme: "Thriller conspiranoico",
    tags: ["investigación", "actor en vivo", "misterio ramificado"],
    url: "https://cryptictales.es/residencia-kovak",
    description:
      "Investigación a contrarreloj con uso magistral de la luz, secretos ocultos y un giro final que deja teorías para rato."
  },
  {
    id: "arca",
    name: "El Arca",
    studio: "Linked Rooms",
    city: "Zaragoza",
    province: "Zaragoza",
    rating: 9.0,
    difficultyScore: 8.5,
    difficultyLabel: "Alta",
    immersion: 8.9,
    fun: 8.7,
    puzzles: 9.2,
    gameMaster: 7.0,
    durationMinutes: 70,
    minPlayers: 2,
    maxPlayers: 5,
    theme: "Puzles mecánicos",
    tags: ["ingeniería", "reto continuo", "cooperación"],
    url: "https://linkedrooms.es/el-arca",
    description:
      "Una máquina imposible llena de mecanismos artesanales, ritmo constante y retos que recompensan la observación fina."
  },
  {
    id: "expedicion",
    name: "Expedición Yurei",
    studio: "Claustrophobia",
    city: "Barcelona",
    province: "Barcelona",
    rating: 8.9,
    difficultyScore: 6.1,
    difficultyLabel: "Media",
    immersion: 9.2,
    fun: 9.0,
    puzzles: 8.7,
    gameMaster: 8.3,
    durationMinutes: 85,
    minPlayers: 2,
    maxPlayers: 5,
    theme: "Terror oriental",
    tags: ["rituales", "espacios cambiantes", "gestión del miedo"],
    url: "https://claustrophobia.es/expedicion-yurei",
    description:
      "Terror atmosférico con un diseño de sonido preciso, dinámicas de valentía y una secuencia final inolvidable."
  },
  {
    id: "oracle",
    name: "The Oracle",
    studio: "Maximum Escape",
    city: "Barcelona",
    province: "Barcelona",
    rating: 8.8,
    difficultyScore: 5.9,
    difficultyLabel: "Media",
    immersion: 8.7,
    fun: 8.5,
    puzzles: 9.1,
    gameMaster: 6.8,
    durationMinutes: 75,
    minPlayers: 2,
    maxPlayers: 4,
    theme: "Fantasía mística",
    tags: ["puzles lógicos", "ambientación monumental", "cooperación"],
    url: "https://maximumescape.com/the-oracle",
    description:
      "Una experiencia elegante donde cada sala introduce un lenguaje simbólico nuevo y el ritmo sube gradualmente hasta el final."
  },
  {
    id: "astral",
    name: "Proyecto Astral",
    studio: "Mystery Lab",
    city: "Málaga",
    province: "Málaga",
    rating: 8.7,
    difficultyScore: 6.4,
    difficultyLabel: "Media",
    immersion: 8.9,
    fun: 8.8,
    puzzles: 8.6,
    gameMaster: 7.6,
    durationMinutes: 80,
    minPlayers: 2,
    maxPlayers: 6,
    theme: "Ciencia paranormal",
    tags: ["cooperación asimétrica", "efectos prácticos", "narrativa documental"],
    url: "https://mysterylablive.com/proyecto-astral",
    description:
      "Un laboratorio clandestino con capas de exploración, uso inteligente de la proyección y decisiones morales en el cierre."
  }
];

/**
 * Convierte un Article con datos de escape room a EscapeRoomRankingEntry.
 */
function articleToRankingEntry(article: Article): EscapeRoomRankingEntry | null {
  const { escapeRoomGeneralData, escapeRoomScoring } = article;

  if (!escapeRoomGeneralData || !escapeRoomScoring) {
    return null;
  }

  // Extraer provincia desde generalData
  const province = escapeRoomGeneralData.province ?? "No especificada";

  // Extraer ciudad desde la categoría (ej: "Escape Room - Barcelona")
  const city = article.category?.split(" - ").pop()?.trim() ?? province;

  // Extraer el estudio desde el título (primera parte antes del guion)
  const studioMatch = article.title.match(/^([^:]+?):/);
  const studio = studioMatch ? studioMatch[1].trim() : "Desconocido";

  // Extraer el nombre del escape room (segunda parte después del guion)
  const nameMatch = article.title.match(/:\s*(.+)/);
  const name = nameMatch ? nameMatch[1].trim() : article.title;

  // Puntuación global
  const rating = escapeRoomScoring.global?.ratio ? escapeRoomScoring.global.ratio * 10 : 0;

  // Dificultad
  const difficultyRatio = escapeRoomScoring.difficulty?.ratio ?? 0;
  const difficultyScore = difficultyRatio * 10;
  let difficultyLabel: "Baja" | "Media" | "Alta" = "Media";
  if (difficultyRatio < 0.4) {
    difficultyLabel = "Baja";
  } else if (difficultyRatio > 0.7) {
    difficultyLabel = "Alta";
  }

  // Métricas individuales
  const immersion = escapeRoomScoring.immersion?.ratio ? escapeRoomScoring.immersion.ratio * 10 : 0;
  const fun = escapeRoomScoring.fun?.ratio ? escapeRoomScoring.fun.ratio * 10 : 0;
  const puzzles = escapeRoomScoring.puzzles?.ratio ? escapeRoomScoring.puzzles.ratio * 10 : 0;
  const gameMaster = escapeRoomScoring.gameMaster?.ratio ? escapeRoomScoring.gameMaster.ratio * 10 : 0;

  // Duración
  const durationMinutes = escapeRoomGeneralData.durationMinutes ?? 60;
  const minPlayers = escapeRoomGeneralData.minPlayers ?? 2;
  const maxPlayers = escapeRoomGeneralData.maxPlayers ?? 6;

  // Tema (usamos la categoría completa o tags)
  const theme = article.category ?? "Experiencia inmersiva";

  // Tags
  const tags = article.tags ?? [];

  // URL
  const url = escapeRoomGeneralData.webLink;

  // Descripción
  const description = article.description ?? article.excerpt ?? "Experiencia inmersiva única.";

  return {
    id: article.slug,
    name,
    city,
    province,
    studio,
    rating,
    difficultyScore,
    difficultyLabel,
    immersion,
    fun,
    puzzles,
    gameMaster,
    durationMinutes,
    minPlayers,
    maxPlayers,
    theme,
    tags,
    url,
    description
  };
}

/**
 * Carga el ranking de escape rooms desde la base de datos.
 * Retorna null si no hay BD disponible o no hay artículos con datos de escape room.
 */
async function loadRankingFromDatabase(): Promise<EscapeRoomRankingEntry[] | null> {
  if (!DATABASE_CONTENT_ENABLED) {
    return null;
  }

  try {
    const prisma = await getPrismaClient();

    // Obtener todos los artículos que tengan escapeRoomScoring
    const articles = await prisma.article.findMany({
      where: {
        escapeRoomScoring: {
          not: null
        }
      },
      orderBy: [
        { publishedAt: "desc" },
        { createdAt: "desc" }
      ]
    });

    if (articles.length === 0) {
      return null;
    }

    // Convertir los artículos de Prisma a Article y luego a EscapeRoomRankingEntry
    const rankingEntries: EscapeRoomRankingEntry[] = articles
      .map((article) => {
        const parsedArticle = parseDbArticle(article);
        return articleToRankingEntry(parsedArticle);
      })
      .filter((entry): entry is EscapeRoomRankingEntry => entry !== null);

    // Ordenar por rating descendente
    rankingEntries.sort((a, b) => b.rating - a.rating);

    return rankingEntries.length > 0 ? rankingEntries : null;
  } catch (error) {
    console.warn("No se pudo cargar el ranking desde la base de datos:", error);
    return null;
  }
}

/**
 * Obtiene el ranking de escape rooms. Primero intenta cargar desde la BD,
 * si no está disponible usa el ranking hardcoded.
 */
export async function getEscapeRoomRanking(): Promise<EscapeRoomRankingEntry[]> {
  const dbRanking = await loadRankingFromDatabase();
  return dbRanking ?? escapeRoomRanking;
}

export function getRankingStats(entries: EscapeRoomRankingEntry[]) {
  const totalRooms = entries.length;
  const uniqueProvinces = new Set(entries.map((entry) => entry.province));
  const uniqueStudios = new Set(entries.map((entry) => entry.studio));
  const averageRating =
    entries.reduce((sum, entry) => sum + entry.rating, 0) / Math.max(entries.length, 1);
  const averageDuration =
    entries.reduce((sum, entry) => sum + entry.durationMinutes, 0) / Math.max(entries.length, 1);

  return {
    totalRooms,
    provinces: uniqueProvinces.size,
    studios: uniqueStudios.size,
    averageRating,
    averageDuration
  };
}
