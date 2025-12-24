/**
 * Postgres database client using Neon serverless
 */

import { neon, Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleWs } from 'drizzle-orm/neon-serverless';

// For Node.js scripts, try to load .env.local
if (typeof window === 'undefined' && !process.env.DATABASE_URL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dotenv = require('dotenv');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  } catch {
    // Ignore if dotenv not available
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for Postgres connection');
}

// Use WebSocket connection for transaction support in edge runtime
// Falls back to WebSocket pooling if not in Edge
if (typeof WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = WebSocket;
} else {
  // In Node.js environment, use ws package
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ws = require('ws');
  neonConfig.webSocketConstructor = ws;
}

// Create Pool for WebSocket connection (supports transactions)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create Drizzle ORM instance with WebSocket driver (supports transactions)
export const db = drizzleWs(pool);

// Create HTTP SQL client for simple queries (faster, no transactions)
const sql = neon(process.env.DATABASE_URL);
export const dbHttp = drizzleHttp(sql);

// Export raw SQL for complex queries
export { sql };
