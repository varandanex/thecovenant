import type { EscapeRoomScoring } from "../lib/types";

type Props = {
  scoring: EscapeRoomScoring;
};

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  const percentage = (value / max) * 100;
  
  return (
    <div className="flex items-center gap-1">
      <div className="relative flex">
        {/* Estrellas de fondo (grises) */}
        <div className="flex text-white/20">
          {Array.from({ length: max }).map((_, i) => (
            <span key={i} className="text-2xl">★</span>
          ))}
        </div>
        {/* Estrellas rellenas (color primario) */}
        <div 
          className="absolute left-0 top-0 flex overflow-hidden text-primary"
          style={{ width: `${percentage}%` }}
        >
          {Array.from({ length: max }).map((_, i) => (
            <span key={i} className="text-2xl">★</span>
          ))}
        </div>
      </div>
      <span className="ml-2 text-sm text-muted-foreground">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function EscapeRoomScoring({ scoring }: Props) {
  const scores = [
    { key: "difficulty", icon: "🧠", label: "Dificultad", data: scoring.difficulty },
    { key: "terror", icon: "👻", label: "Terror", data: scoring.terror },
    { key: "immersion", icon: "👁️", label: "Inmersión", data: scoring.immersion },
    { key: "fun", icon: "😊", label: "Diversión", data: scoring.fun },
    { key: "puzzles", icon: "🧩", label: "Puzzles", data: scoring.puzzles },
    { key: "gameMaster", icon: "📢", label: "G.Master", data: scoring.gameMaster }
  ].filter(score => score.data);

  const global = scoring.global;

  if (scores.length === 0 && !global) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/80">
      <div className="border-b border-white/10 bg-zinc-800/60 px-8 py-5">
        <h2 className="text-center font-heading text-xl font-bold tracking-tight text-foreground">
          PUNTUACION ESCAPE ROOM
        </h2>
      </div>
      <div>
        {scores.map((score, idx) => (
          <div 
            key={score.key} 
            className={`grid grid-cols-[1fr_1fr] px-8 py-5 ${
              idx % 2 === 0 ? 'bg-zinc-800/40' : 'bg-zinc-900/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl opacity-80">{score.icon}</span>
              <span className="text-foreground">{score.label}</span>
            </div>
            <div className="flex items-center">
              <StarRating value={score.data!.value} max={score.data!.max} />
            </div>
          </div>
        ))}
        {global && (
          <div className={`grid grid-cols-[1fr_1fr] px-8 py-5 ${
            scores.length % 2 === 0 ? 'bg-zinc-800/40' : 'bg-zinc-900/40'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <span className="font-bold text-lg text-foreground">GLOBAL</span>
            </div>
            <div className="flex items-center">
              <StarRating value={global.value} max={global.max} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
