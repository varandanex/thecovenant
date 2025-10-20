import Link from "next/link";
import { Logo } from "./logo";
import { getAllArticlesAsync, getNavigationAsync } from "../lib/content";

export async function SiteHeader() {
  const [navigation, articles] = await Promise.all([getNavigationAsync(), getAllArticlesAsync()]);
  const eventArticles = articles.filter((article) => article.category?.toLowerCase() === "eventos");

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="container-bleed flex h-20 items-center justify-between">
        <Link href="/" className="transition-opacity hover:opacity-80" aria-label="Inicio The Covenant">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {navigation.primary.map((item) => {
            const isEvents = item.href === "/eventos" || item.label.toLowerCase() === "eventos";
            if (!isEvents) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group relative transition-colors hover:text-foreground"
                >
                  <span>{item.label}</span>
                  <span className="absolute -bottom-2 left-0 h-px w-full scale-x-0 bg-primary transition-transform duration-200 ease-out group-hover:scale-x-100" />
                </Link>
              );
            }

            return (
              <div key={item.href} className="group relative">
                <Link
                  href={item.href}
                  className="relative flex items-center gap-2 transition-colors hover:text-foreground"
                  aria-haspopup="true"
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-primary/80 transition-transform group-hover:-translate-y-0.5">
                    ●
                  </span>
                  <span className="pointer-events-none absolute -bottom-2 left-0 h-px w-full scale-x-0 bg-primary transition-transform duration-200 ease-out group-hover:scale-x-100" />
                </Link>
                {eventArticles.length > 0 ? (
                  <div className="pointer-events-none absolute left-1/2 top-full mt-4 hidden w-80 -translate-x-1/2 flex-col gap-2 rounded-3xl border border-white/10 bg-background/95 p-4 text-left shadow-2xl backdrop-blur transition duration-150 group-hover:pointer-events-auto group-hover:flex group-focus-within:pointer-events-auto group-focus-within:flex">
                    {eventArticles.map((event) => (
                      <Link
                        key={event.slug}
                        href={`/${event.slug}`}
                        className="rounded-2xl border border-transparent bg-accent/30 px-4 py-3 transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <span className="block text-sm font-semibold text-foreground">{event.title}</span>
                        {event.excerpt ? (
                          <span className="mt-1 block text-xs text-muted-foreground/80">{event.excerpt}</span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <Link
          href="/newsletter"
          className="hidden rounded-full border border-primary/40 bg-primary/10 px-5 py-2 text-sm font-medium text-primary md:inline-flex"
        >
          Newsletter
        </Link>
      </div>
    </header>
  );
}
