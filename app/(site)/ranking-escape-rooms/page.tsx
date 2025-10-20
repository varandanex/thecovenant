import type { Metadata } from "next";
import { EscapeRoomRanking } from "../components/escape-room-ranking";
import { escapeRoomRanking, getRankingStats } from "../lib/ranking-data";

export const metadata: Metadata = {
  title: "Ranking de escape rooms en España | The Covenant",
  description:
    "Selección editorial de experiencias inmersivas con filtros interactivos, métricas comparables y una metodología transparente para elegir tu próxima sala.",
  openGraph: {
    title: "Ranking de escape rooms en España",
    description:
      "Explora las mejores experiencias inmersivas con valoración global, métricas de inmersión, narrativa y puzles. Filtra por provincia o estudio y encuentra tu próxima misión.",
    type: "website"
  }
};

export default function RankingEscapeRoomsPage() {
  const stats = getRankingStats(escapeRoomRanking);
  const topThree = [...escapeRoomRanking].sort((a, b) => b.rating - a.rating).slice(0, 3);

  return (
    <div className="space-y-16">
      <section className="space-y-6 rounded-3xl border border-white/5 bg-accent/60 p-10 text-foreground">
        <p className="text-xs uppercase tracking-[0.4em] text-primary/80">Ranking vivo</p>
        <h1 className="font-heading text-4xl tracking-tight md:text-5xl">
          Las experiencias inmersivas más destacadas del momento
        </h1>
        <p className="max-w-3xl text-lg text-muted-foreground">
          Este ranking nace de nuestras visitas presenciales, entrevistas con creativos y feedback de la comunidad de jugadores.
          Ajusta filtros, explora las métricas que más te interesan y reserva directamente desde la ficha de cada escape room.
        </p>
        <ul className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[11px] font-semibold text-primary">
              1
            </span>
            <span>Actualizamos trimestralmente con nuevas aperturas y revisiones de salas existentes.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[11px] font-semibold text-primary">
              2
            </span>
            <span>Valoramos narrativa, inmersión, diseño de puzles, intensidad y atención del game master.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[11px] font-semibold text-primary">
              3
            </span>
            <span>Las puntuaciones combinan visitas de la hermandad con media ponderada de reseñas expertas.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[11px] font-semibold text-primary">
              4
            </span>
            <span>Si gestionas una sala y quieres aparecer, escríbenos con tu dossier y disponibilidad para prensa.</span>
          </li>
        </ul>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-white/5 bg-background/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Experiencias analizadas</p>
          <p className="mt-3 font-heading text-4xl text-foreground">{stats.totalRooms}</p>
          <p className="mt-1 text-sm text-muted-foreground">Selección curada y visitada por el equipo editorial.</p>
        </div>
        <div className="rounded-3xl border border-white/5 bg-background/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Estudios representados</p>
          <p className="mt-3 font-heading text-4xl text-foreground">{stats.studios}</p>
          <p className="mt-1 text-sm text-muted-foreground">Diversidad creativa: independientes, franquicias y laboratorios.</p>
        </div>
        <div className="rounded-3xl border border-white/5 bg-background/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Puntuación media</p>
          <p className="mt-3 font-heading text-4xl text-foreground">{stats.averageRating.toFixed(1)}</p>
          <p className="mt-1 text-sm text-muted-foreground">La media general de la lista se mantiene por encima del notable alto.</p>
        </div>
        <div className="rounded-3xl border border-white/5 bg-background/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Duración media</p>
          <p className="mt-3 font-heading text-4xl text-foreground">{Math.round(stats.averageDuration)}&nbsp;min</p>
          <p className="mt-1 text-sm text-muted-foreground">Tiempo medio de juego, ideal para planificar escapadas y viajes.</p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-primary/80">Selección destacada</span>
            <h2 className="mt-2 font-heading text-3xl text-foreground">Los imprescindibles del trimestre</h2>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            ¿Primera vez planificando una ruta? Empieza por estas tres experiencias: combinan innovación tecnológica, narrativas potentes y un trato exquisito del game master.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {topThree.map((entry, index) => (
            <article
              key={entry.id}
              className="group flex flex-col justify-between gap-6 rounded-3xl border border-white/5 bg-background/80 p-6 transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
                  Top {index + 1}
                </span>
                <h3 className="font-heading text-2xl text-foreground">{entry.name}</h3>
                <p className="text-sm text-muted-foreground">{entry.description}</p>
              </div>
              <dl className="grid gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-2 text-foreground">
                  <dt>Valoración global</dt>
                  <dd className="font-heading text-xl">{entry.rating.toFixed(1)}</dd>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-2 text-foreground">
                  <dt>Ciudad</dt>
                  <dd className="font-medium normal-case">{entry.city}</dd>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-2 text-foreground">
                  <dt>Duración</dt>
                  <dd className="font-medium normal-case">{entry.durationMinutes} min</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.3em] text-primary/80">Explora y filtra</span>
          <h2 className="mt-2 font-heading text-3xl text-foreground">Encuentra la sala perfecta para tu equipo</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Usa el buscador para localizar experiencias por ciudad, temática o estudio. Cambia la métrica de ordenación para descubrir qué salas destacan por inmersión, puzles o intensidad narrativa.
          </p>
        </div>
        <EscapeRoomRanking entries={escapeRoomRanking} />
      </section>

      <section className="space-y-4 rounded-3xl border border-white/5 bg-background/80 p-8 text-sm text-muted-foreground">
        <h2 className="font-heading text-2xl text-foreground">Metodología y cómo sugerir cambios</h2>
        <p>
          Nuestro equipo revisa cada sala de manera anónima y completa una rúbrica con más de 40 indicadores. La puntuación final
          se calcula mezclando esa rúbrica, la coherencia narrativa y el feedback contrastado de otras comunidades especializadas.
        </p>
        <p>
          ¿Quieres proponernos una nueva sala o indicarnos cambios en las existentes? Escríbenos a
          <a href="mailto:hola@thecovenant.es" className="ml-2 text-primary underline">hola@thecovenant.es</a>
          y adjunta referencias, dossier de prensa o vídeos del montaje. Actualizamos los listados al cierre de cada trimestre.
        </p>
      </section>
    </div>
  );
}
