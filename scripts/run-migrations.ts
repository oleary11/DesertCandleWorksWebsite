/**
 * Database Migration Runner
 *
 * Reads all .sql files from the drizzle/ folder in alphanumeric order,
 * tracks which have been applied in a __migrations table, and runs any
 * that haven't been applied yet.
 *
 * Usage:
 *   pnpm db:migrate              — run pending migrations
 *   pnpm db:migrate --redo 0008  — remove a migration record and re-run it
 */

import fs from 'fs';
import path from 'path';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Load .env.local in Node.js scripts
if (!process.env.DATABASE_URL) {
  try {
    const dotenv = require('dotenv');
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  } catch { /* ignore */ }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run `vercel env pull .env.local` first.');
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'drizzle');

async function query(sql: string, params: unknown[] = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id         serial PRIMARY KEY,
      filename   varchar(255) NOT NULL UNIQUE,
      applied_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query('SELECT filename FROM __migrations');
  return new Set(result.rows.map((r: { filename: string }) => r.filename));
}

async function runMigration(filename: string, filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Drizzle migration files use "--> statement-breakpoint" as a delimiter
  const statements = raw
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await query(statement);
  }

  await query('INSERT INTO __migrations (filename) VALUES ($1)', [filename]);
}

async function main() {
  console.log('🗄️  Desert Candle Works — Database Migrations\n');

  const args = process.argv.slice(2);
  const redoIndex = args.indexOf('--redo');
  const redoFile = redoIndex !== -1 ? args[redoIndex + 1] : null;

  const allFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (allFiles.length === 0) {
    console.log('No migration files found in drizzle/');
    return;
  }

  await ensureMigrationsTable();

  // --redo: remove a migration record so it gets re-run
  if (redoFile) {
    const match = allFiles.find((f) => f.includes(redoFile));
    if (!match) {
      console.error(`No migration file matching "${redoFile}" found.`);
      process.exit(1);
    }
    await query('DELETE FROM __migrations WHERE filename = $1', [match]);
    console.log(`Removed "${match}" from applied list — will re-run it.\n`);
  }

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
  .then(() => { pool.end(); process.exit(0); })
  .catch((err) => {
    console.error('Fatal error:', err);
    pool.end();
    process.exit(1);
  });
