import Link from "next/link";
import { getFeaturedArticlesAsync, getHeroAsync, getHighlightArticleAsync } from "../lib/content";
import { ArticleCard } from "../components/article-card";

export async function HeroSection() {
  const hero = await getHeroAsync();
  const highlight = await getHighlightArticleAsync();
  const featured = (await getFeaturedArticlesAsync()).filter((article) => article.slug !== highlight?.slug);

  return (
    <section className="grid gap-12 lg:grid-cols-[1.1fr_1fr]">
      <div className="flex flex-col justify-center gap-8 rounded-3xl border border-white/5 bg-accent/60 p-12 shadow-soft">
        <span className="text-xs uppercase tracking-[0.5em] text-primary">Archivo oficial</span>
        <h1 className="font-heading text-4xl leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
          {hero.title}
        </h1>
        <p className="text-base text-muted-foreground md:text-lg">{hero.description}</p>
        {hero.cta ? (
          <Link
            href={hero.cta.href}
            className="inline-flex w-fit items-center gap-3 rounded-full border border-primary/40 bg-primary/20 px-6 py-3 text-sm font-medium tracking-[0.3em] uppercase text-primary transition hover:border-primary hover:bg-primary/30"
          >
            {hero.cta.label}
            <span aria-hidden>→</span>
          </Link>
        ) : null}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="rounded-full border border-white/10 px-3 py-1">Next.js 14 + App Router</span>
          <span className="rounded-full border border-white/10 px-3 py-1">Tailwind minimalista</span>
          <span className="rounded-full border border-white/10 px-3 py-1">Supabase ready</span>
        </div>
      </div>
      <div className="grid gap-6">
        {highlight ? <ArticleCard article={highlight} variant="highlight" /> : null}
        <div className="grid gap-6 sm:grid-cols-2">
          {featured.slice(0, 2).map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
}
