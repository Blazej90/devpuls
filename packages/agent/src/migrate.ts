import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { neon } from "@neondatabase/serverless";

import { requireEnv } from "@/config.js";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const SQL_DIR = path.join(packageRoot, "sql");

/**
 * Endpoint HTTP Neona przyjmuje jedno zapytanie na wywołanie, więc plik
 * rozbijamy na osobne instrukcje. Działa, bo migracje to czysty DDL — gdyby
 * kiedyś pojawiła się funkcja w bloku $$ ... $$, ten split trzeba przepisać.
 */
function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*$/m)
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

async function main(): Promise<void> {
  const sql = neon(requireEnv("DATABASE_URL"));

  // Rejestr migracji musi istnieć, zanim sprawdzimy, co już poszło.
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied = new Set(
    ((await sql`SELECT version FROM schema_migrations`) as { version: string }[]).map(
      (row) => row.version,
    ),
  );

  const files = (await readdir(SQL_DIR))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("Brak plików migracji w", SQL_DIR);
    return;
  }

  let appliedNow = 0;

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");

    if (applied.has(version)) {
      console.log(`- ${version} — już zastosowana, pomijam`);
      continue;
    }

    const statements = splitStatements(await readFile(path.join(SQL_DIR, file), "utf8"));
    console.log(`> ${version} — ${statements.length} instrukcji`);

    // Cała migracja idzie jedną transakcją: albo przejdzie w całości,
    // albo baza zostaje w stanie sprzed niej.
    await sql.transaction([
      ...statements.map((statement) => sql.query(statement)),
      sql.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]),
    ]);

    appliedNow += 1;
    console.log(`  ${version} — OK`);
  }

  console.log(
    appliedNow === 0
      ? "Baza jest aktualna — nic do zrobienia."
      : `Zastosowano ${appliedNow} migracji.`,
  );
}

main().catch((error: unknown) => {
  console.error("Migracja nieudana:", error);
  process.exitCode = 1;
});
