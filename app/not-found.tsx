import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-32 text-center">
      <span className="text-xs uppercase tracking-[0.4em] text-primary">404</span>
      <h1 className="font-heading text-4xl text-foreground">No hemos encontrado ese contenido</h1>
      <p className="max-w-lg text-muted-foreground">
        Puede que la URL haya cambiado durante el rediseño. Regresa al archivo principal y continúa explorando las crónicas.
      </p>
      <Link
        href="/"
        className="rounded-full border border-primary/40 bg-primary/20 px-6 py-3 text-sm font-medium uppercase tracking-[0.3em] text-primary transition hover:border-primary hover:bg-primary/30"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
