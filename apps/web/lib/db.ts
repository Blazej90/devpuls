import { neon } from "@neondatabase/serverless";

/**
 * Klient Neona po stronie serwera Next.js. Używany wyłącznie przez route
 * handlery — nigdy w komponentach klienckich.
 *
 * Tworzony leniwie, żeby brak `DATABASE_URL` wywalał się dopiero przy
 * faktycznym zapytaniu, a nie przy imporcie modułu (co psułoby build).
 */
let client: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("Brak zmiennej środowiskowej DATABASE_URL");
    }
    client = neon(url);
  }
  return client;
}
