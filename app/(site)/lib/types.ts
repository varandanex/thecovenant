export type ContentSection =
  | {
      type: "paragraph" | "heading" | "quote";
      text: string;
    }
  | {
      type: "image";
      url: string;
      alt?: string;
      caption?: string;
    }
  | {
      type: "embed";
      html: string;
    };

export type EscapeRoomGeneralData = {
  category?: string;
  province?: string;
  durationText?: string;
  durationMinutes?: number;
  playersText?: string;
  minPlayers?: number;
  maxPlayers?: number;
  webLink?: string;
};

export type EscapeRoomScore = {
  value: number;
  max: number;
  ratio: number;
  label: string;
};

export type EscapeRoomScoring = {
  difficulty?: EscapeRoomScore;
  terror?: EscapeRoomScore;
  immersion?: EscapeRoomScore;
  fun?: EscapeRoomScore;
  puzzles?: EscapeRoomScore;
  gameMaster?: EscapeRoomScore;
  global?: EscapeRoomScore;
};

export type Article = {
  slug: string;
  title: string;
  description?: string;
  excerpt?: string;
  coverImage?: {
    url: string;
    alt?: string;
  };
  category?: string;
  tags?: string[];
  publishedAt?: string;
  readingTime?: string;
  sections: ContentSection[];
  escapeRoomGeneralData?: EscapeRoomGeneralData;
  escapeRoomScoring?: EscapeRoomScoring;
};

export type Navigation = {
  primary: Array<{ label: string; href: string }>;
  secondary: Array<{ label: string; href: string }>;
};

export type SiteContent = {
  hero: {
    title: string;
    description: string;
    cta?: { label: string; href: string };
  };
  highlight: string;
  articles: Article[];
  featured: string[];
  navigation: Navigation;
};
