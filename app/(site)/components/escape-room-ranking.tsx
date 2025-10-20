"use client";

import { useMemo, useState } from "react";
import type { EscapeRoomRankingEntry } from "../lib/ranking-data";

type SortOption = {
  value: "rating" | "immersion" | "puzzles" | "narrative" | "intensity";
  label: string;
  helper: string;
};

const sortOptions: SortOption[] = [
  { value: "rating", label: "Mejor valoración global", helper: "Ordena por la media ponderada de cada experiencia." },
  { value: "immersion", label: "Mayor inmersión", helper: "Prioriza salas con ambientación y dirección actoral destacada." },
  { value: "puzzles", label: "Puzles más afinados", helper: "Muestra primero las salas con retos lógicos más sólidos." },
  { value: "narrative", label: "Narrativa más memorable", helper: "Ordena según la fuerza del guion y su progresión." },
  { value: "intensity", label: "Mayor intensidad", helper: "Favorece salas con ritmo elevado y carga emocional." }
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
      <div className="overflow-hidden rounded-3xl border border-white/5 bg-background/80">
        <table className="min-w-full divide-y divide-white/5 text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-6 py-4 text-left">Pos.</th>
              <th scope="col" className="px-6 py-4 text-left">Experiencia</th>
              <th scope="col" className="px-6 py-4 text-left">Ubicación</th>
              <th scope="col" className="px-6 py-4 text-left">Valoración</th>
              <th scope="col" className="px-6 py-4 text-left">Duración</th>
              <th scope="col" className="px-6 py-4 text-left">Jugadores</th>
              <th scope="col" className="px-6 py-4 text-left">Temática</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                  No hemos encontrado experiencias que coincidan con la búsqueda. Ajusta filtros o limpia el término introducido.
                </td>
              </tr>
            ) : (
              filteredEntries.map(({ entry, position }) => (
                <tr key={entry.id} className="transition-colors hover:bg-white/5">
                  <td className="px-6 py-4 font-semibold text-primary">#{position}</td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-base text-foreground">{entry.name}</span>
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-[10px] uppercase tracking-[0.3em] text-primary">
                          {entry.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      {entry.url ? (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs font-medium text-primary transition-opacity hover:opacity-80"
                        >
                          Reservar o saber más
                          <span aria-hidden="true">→</span>
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-foreground">{entry.city}</div>
                    <div className="text-xs text-muted-foreground">{entry.province} · {entry.studio}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-foreground">{entry.rating.toFixed(1)}</div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Inmersión</dt>
                        <dd className="font-medium text-foreground">{entry.immersion.toFixed(1)}</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Puzles</dt>
                        <dd className="font-medium text-foreground">{entry.puzzles.toFixed(1)}</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Narrativa</dt>
                        <dd className="font-medium text-foreground">{entry.narrative.toFixed(1)}</dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-[0.3em]">Intensidad</dt>
                        <dd className="font-medium text-foreground">{entry.intensity.toFixed(1)}</dd>
                      </div>
                    </dl>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-foreground">{entry.durationMinutes} min</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-foreground">
                      {entry.minPlayers} - {entry.maxPlayers}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">{entry.theme}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
