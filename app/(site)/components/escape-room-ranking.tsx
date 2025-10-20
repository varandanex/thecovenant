"use client";

import { useMemo, useState } from "react";
import type { EscapeRoomRankingEntry } from "../lib/ranking-data";

type SortOption = {
  value: "rating" | "immersion" | "fun" | "puzzles" | "gameMaster" | "difficultyScore";
  label: string;
  helper: string;
};

const sortOptions: SortOption[] = [
  { value: "rating", label: "Mejor valoración global", helper: "Ordena por la media ponderada de cada experiencia." },
  { value: "immersion", label: "Mayor inmersión", helper: "Prioriza salas con ambientación y dirección actoral destacada." },
  { value: "fun", label: "Más diversión", helper: "Resalta salas con ritmo, variedad y sorpresa constantes." },
  { value: "puzzles", label: "Puzles más afinados", helper: "Muestra primero las salas con retos lógicos más sólidos." },
  { value: "gameMaster", label: "Game master top", helper: "Favorece experiencias con dirección actoral memorable." },
  { value: "difficultyScore", label: "Reto más exigente", helper: "Ordena por la dificultad percibida en la sesión." }
];

function normalise(text: string) {
  return text.normalize("NFD").replace(/[^\w\s]/g, "").toLowerCase();
}

export function EscapeRoomRanking({ entries }: { entries: EscapeRoomRankingEntry[] }) {
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("todas");
  const [sortKey, setSortKey] = useState<SortOption["value"]>("rating");

  const provinceOptions = useMemo(() => {
    const unique = new Set(entries.map((entry) => entry.province));
    return ["todas", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalisedQuery = normalise(query.trim());

    return entries
      .filter((entry) => {
        if (province !== "todas" && entry.province !== province) {
          return false;
        }
        if (normalisedQuery.length === 0) {
          return true;
        }
        const haystack = normalise(
          [entry.name, entry.studio, entry.city, entry.theme, entry.tags.join(" ")].join(" ")
        );
        return haystack.includes(normalisedQuery);
      })
      .sort((a, b) => b[sortKey] - a[sortKey])
      .map((entry, index) => ({
        position: index + 1,
        entry
      }));
  }, [entries, province, query, sortKey]);

  const activeSortOption = sortOptions.find((option) => option.value === sortKey) ?? sortOptions[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-3xl border border-white/5 bg-background/80 p-6 shadow-lg shadow-primary/5 md:grid-cols-5">
        <label className="md:col-span-2">
          <span className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">Buscar</span>
          <div className="mt-2 flex items-center gap-3 rounded-full border border-white/10 bg-background/60 px-4 py-2 focus-within:border-primary/60">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4 text-muted-foreground"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M13.5 12a5.5 5.5 0 1 0-1.5 1.5l3.62 3.63a1 1 0 0 0 1.42-1.42Zm-8-.5a4 4 0 1 1 4 4a4 4 0 0 1-4-4"
              />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Nombre, ciudad, estudio..."
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        </label>
        <label className="md:col-span-1">
          <span className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">Provincia</span>
          <div className="mt-2 rounded-full border border-white/10 bg-background/60 px-4 py-2">
            <select
              value={province}
              onChange={(event) => setProvince(event.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none"
            >
              {provinceOptions.map((option) => (
                <option key={option} value={option} className="bg-background">
                  {option === "todas" ? "Todas las provincias" : option}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="md:col-span-2">
          <span className="block text-xs uppercase tracking-[0.3em] text-muted-foreground">Ordenar por</span>
          <div className="mt-2 rounded-2xl border border-white/10 bg-background/60">
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortOption["value"])}
              className="w-full rounded-2xl bg-transparent px-4 py-2 text-sm text-foreground outline-none"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-background">
                  {option.label}
                </option>
              ))}
            </select>
            <p className="border-t border-white/5 px-4 py-2 text-xs text-muted-foreground">{activeSortOption.helper}</p>
          </div>
        </label>
      </div>
      <div className="space-y-4">
        {filteredEntries.length === 0 ? (
          <div className="rounded-3xl border border-white/5 bg-background/80 px-6 py-12 text-center text-muted-foreground">
            No hemos encontrado experiencias que coincidan con la búsqueda. Ajusta filtros o limpia el término introducido.
          </div>
        ) : (
          filteredEntries.map(({ entry, position }) => (
            <article
              key={entry.id}
              className="group rounded-3xl border border-white/5 bg-background/80 p-6 transition-all hover:border-white/10 hover:bg-background/90 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="grid gap-6 lg:grid-cols-[auto_1fr_auto]">
                {/* Posición */}
                <div className="flex items-start lg:items-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 font-heading text-2xl font-bold text-primary">
                    #{position}
                  </span>
                </div>

                {/* Contenido principal */}
                <div className="space-y-4">
                  {/* Header */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-heading text-xl font-semibold text-foreground lg:text-2xl">
                        {entry.name}
                      </h3>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
                        {entry.difficultyLabel}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.description}</p>
                  </div>

                  {/* Info adicional */}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-foreground">{entry.city}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{entry.province}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-muted-foreground">{entry.studio}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-foreground">{entry.durationMinutes} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-foreground">{entry.minPlayers} - {entry.maxPlayers}</span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Valoraciones */}
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      {[
                        {
                          key: "difficulty",
                          label: "Dificultad",
                          value: entry.difficultyScore > 0 ? entry.difficultyScore.toFixed(1) : "—"
                        },
                        {
                          key: "immersion",
                          label: "Inmersión",
                          value: entry.immersion > 0 ? entry.immersion.toFixed(1) : "—"
                        },
                        {
                          key: "fun",
                          label: "Diversión",
                          value: entry.fun > 0 ? entry.fun.toFixed(1) : "—"
                        },
                        {
                          key: "puzzles",
                          label: "Puzzles",
                          value: entry.puzzles > 0 ? entry.puzzles.toFixed(1) : "—"
                        },
                        {
                          key: "gameMaster",
                          label: "G.Master",
                          value: entry.gameMaster > 0 ? entry.gameMaster.toFixed(1) : "—"
                        },
                        {
                          key: "global",
                          label: "GLOBAL",
                          value: entry.rating > 0 ? entry.rating.toFixed(1) : "—"
                        }
                      ].map((metric) => (
                        <div
                          key={metric.key}
                          className={`rounded-xl border p-3 text-center transition-all ${
                            metric.key === "global"
                              ? "border-primary/40 bg-primary/10 shadow-sm shadow-primary/20"
                              : "border-white/10 bg-white/[0.04]"
                          }`}
                        >
                          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {metric.label}
                          </dt>
                          <dd
                            className={`mt-1 font-bold tabular-nums ${
                              metric.key === "global"
                                ? "text-2xl text-primary lg:text-3xl"
                                : "text-lg text-foreground lg:text-xl"
                            }`}
                          >
                            {metric.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  {/* Link */}
                  {entry.url ? (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-opacity hover:opacity-80"
                    >
                      Reservar o saber más
                      <span aria-hidden="true">→</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
