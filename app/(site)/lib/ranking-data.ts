export type EscapeRoomRankingEntry = {
  id: string;
  name: string;
  city: string;
  province: string;
  studio: string;
  rating: number;
  immersion: number;
  puzzles: number;
  narrative: number;
  intensity: number;
  difficulty: "Baja" | "Media" | "Alta";
  durationMinutes: number;
  minPlayers: number;
  maxPlayers: number;
  theme: string;
  tags: string[];
  url?: string;
  description: string;
};

export const escapeRoomRanking: EscapeRoomRankingEntry[] = [
  {
    id: "cuervo",
    name: "El Cuervo",
    studio: "Insomnia Corporation",
    city: "Barcelona",
    province: "Barcelona",
    rating: 9.8,
    immersion: 9.9,
    puzzles: 9.2,
    narrative: 9.7,
    intensity: 7.5,
    difficulty: "Media",
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
    immersion: 9.8,
    puzzles: 9.4,
    narrative: 9.5,
    intensity: 8.2,
    difficulty: "Media",
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
    immersion: 9.5,
    puzzles: 9.3,
    narrative: 9.4,
    intensity: 7.8,
    difficulty: "Media",
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
    immersion: 9.3,
    puzzles: 9.6,
    narrative: 9.2,
    intensity: 6.5,
    difficulty: "Alta",
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
    immersion: 9.6,
    puzzles: 9.1,
    narrative: 9.3,
    intensity: 8.8,
    difficulty: "Media",
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
    immersion: 9.1,
    puzzles: 9.4,
    narrative: 9.0,
    intensity: 7.1,
    difficulty: "Media",
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
    immersion: 9.4,
    puzzles: 9.0,
    narrative: 9.1,
    intensity: 7.9,
    difficulty: "Media",
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
    immersion: 9.3,
    puzzles: 8.8,
    narrative: 9.0,
    intensity: 8.5,
    difficulty: "Media",
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
    immersion: 8.9,
    puzzles: 9.2,
    narrative: 8.7,
    intensity: 7.0,
    difficulty: "Alta",
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
    immersion: 9.2,
    puzzles: 8.7,
    narrative: 9.0,
    intensity: 8.3,
    difficulty: "Media",
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
    immersion: 8.7,
    puzzles: 9.1,
    narrative: 8.5,
    intensity: 6.8,
    difficulty: "Media",
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
    immersion: 8.9,
    puzzles: 8.6,
    narrative: 8.8,
    intensity: 7.6,
    difficulty: "Media",
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
