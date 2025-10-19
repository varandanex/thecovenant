import Image from "next/image";
import Link from "next/link";
import type { Article } from "../lib/types";

export function ArticleCard({ article, variant = "default" }: { article: Article; variant?: "default" | "highlight" }) {
  const href = article.slug ? `/${article.slug}` : "/";

  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/5 bg-accent/60 p-6 transition hover:border-primary/40 hover:bg-accent`}
    >
      <div className="absolute inset-0 -z-10 bg-grid-fade opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {article.coverImage?.url ? (
        <div className="relative mb-6 aspect-[16/10] w-full overflow-hidden rounded-2xl">
          <Image
            src={article.coverImage.url}
            alt={article.coverImage.alt ?? article.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {article.category ? <span>{article.category}</span> : null}
          {article.publishedAt ? <span>{new Date(article.publishedAt).toLocaleDateString("es-ES")}</span> : null}
          {article.readingTime ? <span>{article.readingTime}</span> : null}
        </div>
        <h3 className={`font-heading text-2xl tracking-tight text-foreground ${variant === "highlight" ? "text-3xl" : ""}`}>
          {article.title}
        </h3>
        <p className="text-sm text-muted-foreground">{article.excerpt ?? article.description}</p>
        <div className="mt-auto flex items-center gap-2 text-sm font-medium text-primary">
          <span>Leer historia</span>
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
