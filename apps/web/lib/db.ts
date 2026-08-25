import { neon } from "@neondatabase/serverless";

/**
 * The Neon client on the Next.js server. Used exclusively by route handlers —
 * never in client components.
 *
 * Created lazily so a missing `DATABASE_URL` blows up on the first actual query
 * rather than at module import (which would break the build).
 */
let client: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("Missing DATABASE_URL environment variable");
    }
    client = neon(url);
  }
  return client;
}
