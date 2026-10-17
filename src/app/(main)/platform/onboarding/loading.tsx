export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-5" aria-busy="true">
      <h1 className="font-semibold text-3xl">Onboarding</h1>
      <p className="text-muted-foreground">Cargando registros…</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-56 animate-pulse rounded-2xl border bg-card" />
        ))}
      </div>
    </main>
  );
}
