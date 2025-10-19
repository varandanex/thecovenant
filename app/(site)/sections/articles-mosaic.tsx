import { getAllArticles } from "../lib/content";
import { ArticleCard } from "../components/article-card";

export function ArticlesMosaic() {
  const articles = getAllArticles();
  const grouped = articles.reduce<Record<string, typeof articles>>((acc, article) => {
    const key = article.category ?? "Archivo";
    acc[key] = acc[key] ?? [];
    acc[key].push(article);
    return acc;
  }, {});

  return (
    <section className="space-y-16">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-8">
          <div>
            <span className="text-xs uppercase tracking-[0.4em] text-primary/80">{category}</span>
            <h2 className="mt-2 font-heading text-3xl text-foreground">Últimas historias</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
