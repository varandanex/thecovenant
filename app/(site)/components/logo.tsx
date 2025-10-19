export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-foreground ${className}`}>
      <span className="h-9 w-9 rounded-full border border-primary/60 bg-gradient-to-br from-primary/60 via-primary/30 to-transparent" />
      <span>The Covenant</span>
    </div>
  );
}
