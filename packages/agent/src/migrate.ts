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
 * The Neon HTTP endpoint takes one query per call, so we split the file into
 * separate statements. That works because migrations are plain DDL — should a
 * function in a $$ ... $$ block ever appear, this split has to be rewritten.
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

  // The migration registry has to exist before we check what has already run.
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
    console.log("No migration files in", SQL_DIR);
    return;
  }

  let appliedNow = 0;

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");

    if (applied.has(version)) {
      console.log(`- ${version} — already applied, skipping`);
      continue;
    }

    const statements = splitStatements(await readFile(path.join(SQL_DIR, file), "utf8"));
    console.log(`> ${version} — ${statements.length} statements`);

    // The whole migration runs in one transaction: either it goes through
    // completely, or the database stays as it was before it.
    await sql.transaction([
      ...statements.map((statement) => sql.query(statement)),
      sql.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]),
    ]);

    appliedNow += 1;
    console.log(`  ${version} — OK`);
  }

  console.log(
    appliedNow === 0
      ? "The database is up to date — nothing to do."
      : `Applied ${appliedNow} migration(s).`,
  );
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
