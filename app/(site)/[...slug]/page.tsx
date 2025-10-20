import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleCard } from "../components/article-card";
import { RichContent } from "../components/rich-content";
import { EscapeRoomInfo } from "../components/escape-room-info";
import { EscapeRoomScoring } from "../components/escape-room-scoring";
import { getAllArticlesAsync, getArticleBySlugAsync } from "../lib/content";

export async function generateStaticParams() {
  const articles = await getAllArticlesAsync();
  return articles
    .filter((article) => article.slug.length > 0)
    .map((article) => ({ slug: article.slug.split("/") }));
}

export async function generateMetadata({ params }: { params: { slug?: string[] } }): Promise<Metadata> {
  const slugPath = params.slug?.join("/") ?? "";
  const article = await getArticleBySlugAsync(slugPath);
  if (!article) {
    return {
      title: "Contenido no encontrado"
    };
  }

  return {
    title: article.title,
    description: article.description ?? article.excerpt,
    openGraph: {
      title: article.title,
      description: article.description ?? article.excerpt,
      images: article.coverImage?.url ? [{ url: article.coverImage.url, alt: article.coverImage.alt ?? article.title }] : undefined
    }
  };
}

export default async function ArticlePage({ params }: { params: { slug?: string[] } }) {
  const slugPath = params.slug?.join("/") ?? "";
  const article = await getArticleBySlugAsync(slugPath);

  if (!article) {
    notFound();
  }

  const related = (await getAllArticlesAsync()).filter((entry) => entry.slug !== article.slug).slice(0, 3);

  return (
    <div className="space-y-16">
      <header className="space-y-6 rounded-3xl border border-white/5 bg-accent/60 p-10">
        <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {article.category ? <span>{article.category}</span> : null}
          {article.publishedAt ? <span>{new Date(article.publishedAt).toLocaleDateString("es-ES")}</span> : null}
          {article.readingTime ? <span>{article.readingTime}</span> : null}
        </div>
        <h1 className="font-heading text-4xl tracking-tight text-foreground md:text-5xl">{article.title}</h1>
        <p className="text-muted-foreground">{article.description ?? article.excerpt}</p>
        {article.tags ? (
          <div className="flex flex-wrap gap-3">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs uppercase tracking-[0.3em] text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </header>
      {article.coverImage ? (
        <figure className="overflow-hidden rounded-3xl">
          <img
            src={article.coverImage.url}
            alt={article.coverImage.alt ?? article.title}
            className="h-auto w-full object-cover"
          />
        </figure>
      ) : null}
      {article.escapeRoomGeneralData ? (
        <EscapeRoomInfo data={article.escapeRoomGeneralData} />
      ) : null}
      <RichContent sections={article.sections} />
      {article.escapeRoomScoring ? (
        <EscapeRoomScoring scoring={article.escapeRoomScoring} />
      ) : null}
      {related.length ? (
        <aside className="space-y-8">
          <div>
            <span className="text-xs uppercase tracking-[0.4em] text-primary/80">Continuar explorando</span>
            <h2 className="mt-2 font-heading text-3xl text-foreground">Artículos relacionados</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {related.map((entry) => (
              <ArticleCard key={entry.slug} article={entry} />
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
