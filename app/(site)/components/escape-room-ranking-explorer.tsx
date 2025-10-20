"use client";

import { useMemo, useState } from "react";
import type { EscapeRoomRankingEntry } from "../lib/escape-room-ranking";

type Props = {
  entries: EscapeRoomRankingEntry[];
};

type SortKey = "position" | "rating" | "immersion" | "fear" | "puzzles" | "difficulty";

type SortOption = {
  key: SortKey;
  label: string;
  description: string;
};

const sortOptions: SortOption[] = [
  { key: "position", label: "Ranking oficial", description: "Orden por la posición establecida por la hermandad." },
  { key: "rating", label: "Puntuación global", description: "De mayor a menor valoración global." },
  { key: "immersion", label: "Inmersión", description: "Experiencias que destacan por su ambientación." },
  { key: "fear", label: "Terror", description: "Elige las salas más intensas y oscuras." },
  { key: "puzzles", label: "Puzzles", description: "Prioriza los desafíos más ingeniosos." },
  { key: "difficulty", label: "Dificultad", description: "Escala del 1 al 5 según nivel de exigencia." }
];

const difficultyLabels: Record<number, string> = {
  1: "Muy accesible",
  2: "Accesible",
  3: "Intermedia",
  4: "Exigente",
  5: "Experta"
};

function formatScore(value: number): string {
  return `${(value / 10).toFixed(1)} / 10`;
}

function formatDuration(minutes: number): string {
  return `${minutes} min`;
}

const sorters: Record<SortKey, (a: EscapeRoomRankingEntry, b: EscapeRoomRankingEntry) => number> = {
  position: (a, b) => a.position - b.position,
  rating: (a, b) => (b.rating !== a.rating ? b.rating - a.rating : a.position - b.position),
  immersion: (a, b) => (b.immersion !== a.immersion ? b.immersion - a.immersion : a.position - b.position),
  fear: (a, b) => (b.fear !== a.fear ? b.fear - a.fear : a.position - b.position),
  puzzles: (a, b) => (b.puzzles !== a.puzzles ? b.puzzles - a.puzzles : a.position - b.position),
  difficulty: (a, b) => (b.difficulty !== a.difficulty ? b.difficulty - a.difficulty : a.position - b.position)
};

export function EscapeRoomRankingExplorer({ entries }: Props) {
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("");
  const [theme, setTheme] = useState("");
  const [tag, setTag] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("position");

  const stats = useMemo(() => {
    const total = entries.length;
    const provinces = new Set(entries.map((entry) => entry.province));
    const newEntries = entries.filter((entry) => entry.newEntry).length;
    const average = entries.reduce((acc, entry) => acc + entry.rating, 0) / total;

    return {
      total,
      provinces: provinces.size,
      newEntries,
      average: (average / 10).toFixed(1)
    };
  }, [entries]);

  const provinces = useMemo(() => {
    return Array.from(new Set(entries.map((entry) => entry.province))).sort((a, b) => a.localeCompare(b, "es"));
  }, [entries]);

  const themes = useMemo(() => {
    return Array.from(new Set(entries.map((entry) => entry.theme))).sort((a, b) => a.localeCompare(b, "es"));
  }, [entries]);

  const tags = useMemo(() => {
    return Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort((a, b) => a.localeCompare(b, "es"));
  }, [entries]);

  const highlighted = useMemo(() => {
    return [...entries].sort(sorters.position).slice(0, 3);
  }, [entries]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entries
      .filter((entry) => {
        if (!normalizedQuery) {
          return true;
        }
        const haystack = [
          entry.name,
          entry.city,
          entry.province,
          entry.theme,
          entry.studio,
          entry.tags.join(" "),
          entry.description
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .filter((entry) => (province ? entry.province === province : true))
      .filter((entry) => (theme ? entry.theme === theme : true))
      .filter((entry) => (tag ? entry.tags.includes(tag) : true))
      .sort(sorters[sortKey]);
  }, [entries, query, province, theme, tag, sortKey]);

  const resetFilters = () => {
    setProvince("");
    setTheme("");
    setTag("");
    setSortKey("position");
  };

  return (
    <section className="space-y-12">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-primary/40 bg-primary/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-primary/70">Salas analizadas</p>
          <p className="mt-2 text-3xl font-semibold text-primary">{stats.total}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Ranking actualizado mensualmente con las investigaciones más recientes de la hermandad.
          </p>
        </div>
        <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/70">Media global</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{stats.average}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Valoración media sobre 10 teniendo en cuenta narrativa, puzzles, game mastering e inmersión.
          </p>
        </div>
        <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/70">Cobertura</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{stats.provinces} provincias</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {stats.newEntries > 0
              ? `Incluye ${stats.newEntries} novedades destacadas en la última revisión.`
              : "Sin variaciones respecto al mes anterior."}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-zinc-900/60 p-8">
        <div className="grid gap-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <label className="md:col-span-1 md:col-start-1">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Buscar</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, ciudad, temática o estudio"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </label>
          <label>
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Provincia</span>
            <select
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Todas</option>
              {provinces.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Temática</span>
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Todas</option>
              {themes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Etiqueta</span>
            <select
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-background/60 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">Todas</option>
              {tags.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setSortKey(option.key)}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] transition-colors ${
                  sortKey === option.key
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
                type="button"
                aria-pressed={sortKey === option.key}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs uppercase tracking-[0.3em] text-primary transition-colors hover:text-primary/80"
          >
            Reiniciar filtros
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {sortOptions.find((option) => option.key === sortKey)?.description}
        </p>
      </div>

      <div className="space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.4em] text-primary/80">Top 3 destacado</span>
          <h2 className="mt-2 font-heading text-3xl text-foreground">Experiencias imprescindibles</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {highlighted.map((entry) => (
            <article key={entry.id} className="flex h-full flex-col justify-between rounded-3xl border border-primary/30 bg-primary/10 p-6">
              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-primary">#{entry.position}</span>
                  <h3 className="font-heading text-2xl text-foreground">{entry.name}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {entry.city} · {entry.province} · {entry.theme}
                </p>
                <p className="text-sm text-foreground/80">{entry.featuredQuote ?? entry.description}</p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em] text-primary/80">
                <span>{formatScore(entry.rating)}</span>
                <span>Inmersión {entry.immersion}/5</span>
                <span>Dificultad {difficultyLabels[entry.difficulty]}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-primary/80">Resultados</span>
            <h2 className="mt-2 font-heading text-3xl text-foreground">{filtered.length} salas encontradas</h2>
          </div>
          {query || province || theme || tag || sortKey !== "position" ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs uppercase tracking-[0.3em] text-primary">
              Vista personalizada
            </span>
          ) : null}
        </div>
        <ul className="space-y-4">
          {filtered.map((entry) => (
            <li key={entry.id} className="rounded-3xl border border-white/5 bg-zinc-900/60 p-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="space-y-3">
                  <div className="flex items-baseline gap-4">
                    <span className="text-3xl font-bold text-primary">#{entry.position}</span>
                    <div>
                      <h3 className="font-heading text-2xl text-foreground">{entry.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {entry.city} · {entry.province} · {entry.theme}
                      </p>
                    </div>
                  </div>
                  <p className="max-w-2xl text-sm text-foreground/80">{entry.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground/70">
                    <span className="rounded-full border border-white/10 px-3 py-1">{formatScore(entry.rating)}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Dificultad {difficultyLabels[entry.difficulty]}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Inmersión {entry.immersion}/5</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Terror {entry.fear}/5</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Puzzles {entry.puzzles}/5</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Duración {formatDuration(entry.durationMinutes)}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">{entry.players}</span>
                    <span className="rounded-full border border-white/10 px-3 py-1">Última revisión {entry.lastReview}</span>
                    {entry.newEntry ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">Nueva entrada</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-primary/80">
                    {entry.tags.map((item) => (
                      <span key={item} className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1">
                        #{item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 text-right">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Estudio</p>
                    <p className="text-sm font-medium text-foreground">{entry.studio}</p>
                  </div>
                  {entry.website ? (
                    <a
                      href={entry.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-primary transition-colors hover:border-primary/60 hover:bg-primary/20"
                    >
                      Reservar
                      <span aria-hidden>↗</span>
                    </a>
                  ) : (
                    <span className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      Reserva privada
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-zinc-900/40 p-10 text-center">
            <p className="text-xl font-heading text-foreground">Ninguna sala coincide con tu búsqueda</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Ajusta los filtros o elimina la búsqueda para volver al ranking completo.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
