import Link from "next/link";
import { getAllArticlesAsync } from "../lib/content";
import { ArticleCard } from "../components/article-card";

export async function EventsShowcase() {
  const articles = await getAllArticlesAsync();
  const events = articles.filter((article) => article.category?.toLowerCase() === "eventos");

  if (events.length === 0) {
    return null;
  }

  const [featured, ...rest] = events;

  return (
    <section className="space-y-10">
      <header className="space-y-3">
        <span className="text-xs uppercase tracking-[0.4em] text-primary/80">Eventos</span>
        <h2 className="font-heading text-3xl text-foreground md:text-4xl">Experiencias inmersivas de la hermandad</h2>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
          Trasladamos las quedadas y casos especiales de nuestro blog clásico a este nuevo archivo digital. Descubre
          propuestas híbridas de rol, investigación y terror que mezclan escape rooms con narrativa en vivo.
        </p>
      </header>
      <div className={rest.length ? "grid gap-6 lg:grid-cols-[2fr_1fr]" : "grid gap-6"}>
        <ArticleCard article={featured} variant="highlight" />
        {rest.length ? (
          <div className="grid gap-6">
            {rest.map((event) => (
              <ArticleCard key={event.slug} article={event} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Link
          href="/eventos"
          className="group inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-2 text-sm font-medium text-primary transition hover:border-primary/60 hover:bg-primary/20"
        >
          Ver todos los eventos
          <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </section>
  );
}
