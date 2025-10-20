import type { EscapeRoomGeneralData } from "../lib/types";

type Props = {
  data: EscapeRoomGeneralData;
};

export function EscapeRoomInfo({ data }: Props) {
  const rows = [
    {
      icon: "☰",
      label: "Categoría",
      value: data.category
    },
    {
      icon: "📍",
      label: "Provincia",
      value: data.province
    },
    {
      icon: "⏰",
      label: "Duración",
      value: data.durationText
    },
    {
      icon: "👥",
      label: "Jugadores",
      value: data.playersText || (data.minPlayers && data.maxPlayers ? `${data.minPlayers}-${data.maxPlayers} jugadores` : null)
    },
    {
      icon: "🌐",
      label: "Web",
      value: data.webLink,
      isLink: true
    }
  ].filter(row => row.value);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/80">
      <div className="border-b border-white/10 bg-zinc-800/60 px-8 py-5">
        <h2 className="text-center font-heading text-xl font-bold tracking-tight text-foreground">
          DATOS GENERALES
          <br />
          ESCAPE ROOM
        </h2>
      </div>
      <div>
        {rows.map((row, idx) => (
          <div 
            key={idx} 
            className={`grid grid-cols-[1fr_1fr] px-8 py-5 ${
              idx % 2 === 0 ? 'bg-zinc-800/40' : 'bg-zinc-900/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl opacity-80">{row.icon}</span>
              <span className="font-bold text-foreground">{row.label}</span>
            </div>
            <div className="flex items-center text-foreground">
              {row.isLink && row.value ? (
                <a
                  href={row.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Acceder
                </a>
              ) : (
                <span>{row.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
