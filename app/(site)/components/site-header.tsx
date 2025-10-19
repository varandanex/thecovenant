import Link from "next/link";
import { Logo } from "./logo";
import { getNavigation } from "../lib/content";

const navigation = getNavigation();

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="container-bleed flex h-20 items-center justify-between">
        <Link href="/" className="transition-opacity hover:opacity-80" aria-label="Inicio The Covenant">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {navigation.primary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative transition-colors hover:text-foreground"
            >
              <span>{item.label}</span>
              <span className="absolute -bottom-2 left-0 h-px w-full scale-x-0 bg-primary transition-transform duration-200 ease-out group-hover:scale-x-100" />
            </Link>
          ))}
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
