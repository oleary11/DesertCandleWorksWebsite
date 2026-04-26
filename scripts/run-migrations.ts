/**
 * Database Migration Runner
 *
 * Reads all .sql files from the drizzle/ folder in alphanumeric order,
 * tracks which have been applied in a __migrations table, and runs any
 * that haven't been applied yet.
 */

import fs from 'fs';
import path from 'path';
import { sql } from '../src/lib/db/client';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'drizzle');

async function ensureMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS __migrations (
      id         serial PRIMARY KEY,
      filename   varchar(255) NOT NULL UNIQUE,
      applied_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `;
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const rows = await sql`SELECT filename FROM __migrations`;
  return new Set(rows.map((r: { filename: string }) => r.filename));
}

async function runMigration(filename: string, filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Drizzle migration files use "--> statement-breakpoint" as a delimiter
  const statements = raw
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.unsafe(statement);
  }

  await sql`INSERT INTO __migrations (filename) VALUES (${filename})`;
}

async function main() {
  console.log('🗄️  Desert Candle Works — Database Migrations\n');

  const allFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // alphanumeric order matches the 0000_, 0001_, ... naming

  if (allFiles.length === 0) {
    console.log('No migration files found in drizzle/');
    return;
  }

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const pending = allFiles.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log('✅ All migrations already applied — nothing to do.');
    return;
  }

  console.log(`Found ${pending.length} pending migration(s):\n`);

  for (const filename of pending) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    process.stdout.write(`  Running ${filename} ... `);
    try {
      await runMigration(filename, filePath);
      console.log('✅ done');
    } catch (err) {
      console.log('❌ FAILED');
      console.error(`\nError in ${filename}:`, err);
      process.exit(1);
    }
  }

  console.log(`\n✨ ${pending.length} migration(s) applied successfully.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
