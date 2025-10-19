import Link from "next/link";
import { Logo } from "./logo";
import { getNavigation } from "../lib/content";

const navigation = getNavigation();

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-background/80 py-16 backdrop-blur-xl">
      <div className="container-bleed grid gap-12 md:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Logo />
          <p className="max-w-xl text-sm text-muted-foreground">
            Crónicas, guías y ficciones interactivas creadas por The Covenant. Un espacio para las experiencias inmersivas, los
            rompecabezas y la comunidad oculta que las rodea.
          </p>
          <div className="flex gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground/70">
            <span>© {new Date().getFullYear()} The Covenant</span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">Todos los derechos reservados</span>
          </div>
        </div>
        <div className="grid gap-10 sm:grid-cols-2">
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Secciones</span>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {navigation.primary.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Comunidad</span>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {navigation.secondary.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="transition-colors hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
