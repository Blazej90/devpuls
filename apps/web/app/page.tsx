export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">DevPuls</h1>
        <p className="text-muted-foreground text-balance">
          Nowinki z TypeScript, Reacta, JS, fullstacku i AI — przefiltrowane pod kątem
          trafności i streszczone po polsku, prosto na Twój ekran.
        </p>
      </header>

      <section className="border-border bg-card text-card-foreground rounded-lg border p-6">
        <h2 className="font-medium">Nic tu jeszcze nie ma</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Pipeline pobierania źródeł i powiadomienia Web Push są w budowie. Lista
          dostarczonych newsów pojawi się tutaj.
        </p>
      </section>
    </main>
  );
}
