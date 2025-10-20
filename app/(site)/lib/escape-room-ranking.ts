export type EscapeRoomRankingEntry = {
  id: string;
  position: number;
  name: string;
  city: string;
  province: string;
  studio: string;
  theme: string;
  description: string;
  rating: number;
  difficulty: number;
  immersion: number;
  fear: number;
  puzzles: number;
  durationMinutes: number;
  players: string;
  website?: string;
  tags: string[];
  newEntry?: boolean;
  featuredQuote?: string;
  lastReview: string;
};

export function getEscapeRoomRanking(): EscapeRoomRankingEntry[] {
  return rankingData;
}

const rankingData: EscapeRoomRankingEntry[] = [
  {
    id: "ultima-profecia",
    position: 1,
    name: "La Última Profecía",
    city: "Madrid",
    province: "Madrid",
    studio: "Secretum",
    theme: "Horror ritual",
    description:
      "Una investigación cargada de simbolismo arcano que culmina en un clímax cooperativo inolvidable. Combina exploración no lineal con un ritmo de tensión creciente.",
    rating: 96,
    difficulty: 3,
    immersion: 5,
    fear: 4,
    puzzles: 5,
    durationMinutes: 80,
    players: "2-5 jugadores",
    website: "https://secretum.example/ultima-profecia",
    tags: ["terror", "narrativa", "cooperativo"],
    featuredQuote: "Una de las pocas salas capaces de sorprender incluso a jugadores veteranos.",
    lastReview: "2024-01"
  },
  {
    id: "archivo-babel",
    position: 2,
    name: "El Archivo de Babel",
    city: "Barcelona",
    province: "Barcelona",
    studio: "Cronistas del Caos",
    theme: "Ficción especulativa",
    description:
      "Bibliotecas infinitas, inteligencias artificiales y un misterio que se resuelve a múltiples niveles de lectura. Destaca por su uso creativo de la iluminación y los espacios ocultos.",
    rating: 94,
    difficulty: 4,
    immersion: 5,
    fear: 2,
    puzzles: 5,
    durationMinutes: 90,
    players: "3-6 jugadores",
    website: "https://cronistas.example/archivo-babel",
    tags: ["ciencia ficción", "exploración", "tecnología"],
    lastReview: "2023-12"
  },
  {
    id: "agonia-lazarus",
    position: 3,
    name: "La Agonía de Lazarus",
    city: "Valencia",
    province: "Valencia",
    studio: "La Orden",
    theme: "Thriller psicológico",
    description:
      "Un descenso a la mente fragmentada de un médium. Jugabilidad basada en decisiones que alteran el recorrido y la aparición de escenas dinámicas.",
    rating: 92,
    difficulty: 4,
    immersion: 5,
    fear: 3,
    puzzles: 4,
    durationMinutes: 75,
    players: "2-4 jugadores",
    website: "https://laorden.example/agonia-lazarus",
    tags: ["psicológico", "replayable", "narrativa"],
    lastReview: "2023-11"
  },
  {
    id: "mina-espectral",
    position: 4,
    name: "La Mina Espectral",
    city: "Bilbao",
    province: "Bizkaia",
    studio: "Grieta Norte",
    theme: "Misterio industrial",
    description:
      "Una excavación minera abandonada deja pistas en diferentes planos: físico y espiritual. Su sistema de pistas diegético es de los más elegantes de la escena.",
    rating: 90,
    difficulty: 3,
    immersion: 4,
    fear: 3,
    puzzles: 5,
    durationMinutes: 70,
    players: "2-6 jugadores",
    tags: ["investigación", "multiespacio", "ambientación"],
    lastReview: "2023-10"
  },
  {
    id: "oraculo-temporal",
    position: 5,
    name: "Oráculo Temporal",
    city: "Sevilla",
    province: "Sevilla",
    studio: "Horizonte 13",
    theme: "Viajes en el tiempo",
    description:
      "Equilibrio perfecto entre puzzles lógicos, coordinación de equipo y un relato coral que evoluciona según el orden en el que se resuelven las salas temporales.",
    rating: 89,
    difficulty: 5,
    immersion: 4,
    fear: 1,
    puzzles: 5,
    durationMinutes: 85,
    players: "3-5 jugadores",
    tags: ["coordinación", "alta dificultad", "no lineal"],
    lastReview: "2023-12"
  },
  {
    id: "convento-azabache",
    position: 6,
    name: "Convento Azabache",
    city: "Santander",
    province: "Cantabria",
    studio: "Códice Oculto",
    theme: "Fantasmal",
    description:
      "Claustros laberínticos, cánticos binaurales y decisiones morales. Ideal para grupos que buscan un terror elegante y guiado por la historia.",
    rating: 88,
    difficulty: 3,
    immersion: 4,
    fear: 4,
    puzzles: 4,
    durationMinutes: 80,
    players: "2-5 jugadores",
    tags: ["terror", "histórico", "decisiones"],
    lastReview: "2024-02"
  },
  {
    id: "operacion-atlas",
    position: 7,
    name: "Operación Atlas",
    city: "Zaragoza",
    province: "Zaragoza",
    studio: "Vector 9",
    theme: "Espionaje",
    description:
      "Un asalto coordinado a un centro de datos con gadgets personalizables y un tramo final cronometrado. La sala se adapta a distintos tamaños de grupo.",
    rating: 87,
    difficulty: 4,
    immersion: 4,
    fear: 1,
    puzzles: 4,
    durationMinutes: 70,
    players: "3-6 jugadores",
    tags: ["acción", "gadgets", "versátil"],
    newEntry: true,
    lastReview: "2024-03"
  },
  {
    id: "catedral-inversa",
    position: 8,
    name: "La Catedral Inversa",
    city: "Granada",
    province: "Granada",
    studio: "Lux Immersive",
    theme: "Misticismo",
    description:
      "Un viaje simbólico por arquitecturas imposibles. Utiliza espejos, proyecciones y voces en off personalizadas según la interacción del grupo.",
    rating: 86,
    difficulty: 2,
    immersion: 5,
    fear: 2,
    puzzles: 3,
    durationMinutes: 65,
    players: "2-4 jugadores",
    tags: ["artes visuales", "atmósfera", "experiencial"],
    lastReview: "2023-09"
  },
  {
    id: "ultimatum-abyss",
    position: 9,
    name: "Ultimátum Abyss",
    city: "A Coruña",
    province: "A Coruña",
    studio: "Sinestra Labs",
    theme: "Terror cósmico",
    description:
      "Investigación marina con proyecciones 360º, efectos físicos y un uso magistral del sonido direccional. Ideal para grupos que buscan adrenalina.",
    rating: 85,
    difficulty: 3,
    immersion: 4,
    fear: 5,
    puzzles: 3,
    durationMinutes: 75,
    players: "3-5 jugadores",
    tags: ["terror", "efectos especiales", "sonido"],
    lastReview: "2024-01"
  },
  {
    id: "jaque-al-augur",
    position: 10,
    name: "Jaque al Augur",
    city: "Murcia",
    province: "Murcia",
    studio: "El Catalejo",
    theme: "Misterio detectivesco",
    description:
      "Una investigación modular con personajes recurrentes y puzzles inspirados en juegos de mesa. Recomendado para grupos que disfrutan de la deducción.",
    rating: 84,
    difficulty: 4,
    immersion: 3,
    fear: 1,
    puzzles: 5,
    durationMinutes: 70,
    players: "2-4 jugadores",
    tags: ["investigación", "rejugable", "analítico"],
    newEntry: true,
    lastReview: "2024-02"
  },
  {
    id: "cancion-durante",
    position: 11,
    name: "Canción de Durante",
    city: "Valladolid",
    province: "Valladolid",
    studio: "Archivo del Amanecer",
    theme: "Realismo mágico",
    description:
      "Trenzado de historias familiares y rituales musicales. Los puzzles musicales exigen coordinación, pero la sala ofrece modos adaptativos para equipos novatos.",
    rating: 83,
    difficulty: 2,
    immersion: 4,
    fear: 1,
    puzzles: 4,
    durationMinutes: 60,
    players: "2-5 jugadores",
    tags: ["musical", "emocional", "adaptativo"],
    lastReview: "2023-08"
  },
  {
    id: "anexo-helion",
    position: 12,
    name: "Anexo Helion",
    city: "Pamplona",
    province: "Navarra",
    studio: "Helix Labs",
    theme: "Biotecnología",
    description:
      "Un laboratorio de investigación que responde a las decisiones del equipo con eventos en tiempo real. Combina sensores biométricos con puzzles de laboratorio.",
    rating: 82,
    difficulty: 5,
    immersion: 3,
    fear: 2,
    puzzles: 4,
    durationMinutes: 80,
    players: "3-6 jugadores",
    tags: ["tecnología", "presión", "intenso"],
    lastReview: "2024-01"
  }
];
