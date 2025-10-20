import type { Metadata } from "next";
import { EscapeRoomRankingExplorer } from "../components/escape-room-ranking-explorer";
import { getEscapeRoomRanking } from "../lib/escape-room-ranking";

export const metadata: Metadata = {
  title: "Ranking de escape rooms imprescindibles",
  description:
    "Explora la clasificación de escape rooms analizados por The Covenant: buscador por provincia, temática, nivel de terror y valoración global.",
  openGraph: {
    title: "Ranking de escape rooms imprescindibles",
    description:
      "Consulta el ranking actualizado de The Covenant con filtros avanzados para encontrar tu próxima experiencia inmersiva.",
    url: "https://thecovenant.es/ranking-escape-rooms"
  }
};

export default function RankingEscapeRoomsPage() {
  const ranking = [...getEscapeRoomRanking()].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-16">
      <header className="space-y-6 rounded-3xl border border-white/5 bg-accent/60 p-10">
        <span className="text-xs uppercase tracking-[0.4em] text-primary/80">Ranking oficial</span>
        <h1 className="font-heading text-4xl tracking-tight text-foreground md:text-5xl">Escape rooms imprescindibles</h1>
        <p className="max-w-3xl text-muted-foreground">
          Una guía curada con las investigaciones más recientes de la hermandad. Filtra por provincia, temática o intensidad para
          descubrir experiencias a tu medida y reserva directamente desde la ficha de cada sala.
        </p>
        <p className="text-sm text-muted-foreground/80">
          Actualizado trimestralmente. Si quieres proponer una sala para ser evaluada, escríbenos a ranking@thecovenant.es.
        </p>
      </header>

      <EscapeRoomRankingExplorer entries={ranking} />
    </div>
  );
}
