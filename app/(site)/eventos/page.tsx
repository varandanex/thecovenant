import type { Metadata } from "next";
import Link from "next/link";
import { ArticleCard } from "../components/article-card";
import { getAllArticlesAsync } from "../lib/content";

export const metadata: Metadata = {
  title: "Eventos | The Covenant",
  description:
    "Explora los eventos inmersivos ideados por The Covenant: experiencias híbridas de rol, investigación y terror."
};

export default async function EventsPage() {
  const articles = await getAllArticlesAsync();
  const events = articles.filter((article) => article.category?.toLowerCase() === "eventos");

  if (events.length === 0) {
    return (
      <div className="space-y-8">
        <header className="space-y-4 rounded-3xl border border-white/5 bg-accent/60 p-10 text-center">
          <span className="text-xs uppercase tracking-[0.4em] text-primary/80">Eventos</span>
          <h1 className="font-heading text-4xl text-foreground md:text-5xl">No hay eventos disponibles</h1>
          <p className="text-muted-foreground">
            Todavía no hemos sincronizado actividades presenciales desde el archivo original. Ejecuta el scraper o
            revisa la base de datos para importar las fichas de eventos.
          </p>
        </header>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-primary/40 bg-primary/10 px-5 py-2 text-sm font-medium text-primary transition hover:border-primary/60 hover:bg-primary/20"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  const [featured, ...rest] = events;

  return (
    <div className="space-y-16">
      <header className="space-y-6 rounded-3xl border border-white/5 bg-accent/60 p-10">
        <span className="text-xs uppercase tracking-[0.4em] text-primary/80">Eventos</span>
        <h1 className="font-heading text-4xl text-foreground md:text-5xl">Agenda inmersiva de The Covenant</h1>
        <p className="max-w-3xl text-muted-foreground">
          Recuperamos los dossiers originales de la web clásica y los presentamos con el nuevo diseño. Cada evento reúne
          relato, desafíos e investigación en primera persona para grupos que buscan mucho más que un escape room.
        </p>
      </header>
      <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <ArticleCard article={featured} variant="highlight" />
        {rest.length ? (
          <div className="grid gap-6">
            {rest.map((event) => (
              <ArticleCard key={event.slug} article={event} />
            ))}
          </div>
        ) : null}
      </section>
      {rest.length ? null : (
        <div className="rounded-3xl border border-white/5 bg-accent/40 p-8 text-sm text-muted-foreground">
          Ya estás viendo la única ficha de evento disponible. A medida que importemos nuevas experiencias aparecerán en
          este listado automáticamente.
        </div>
      )}
    </div>
  );
}
