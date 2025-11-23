/**
 * Database migration runner
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './services/database.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

// ✅ FIX: Get migrations directory relative to this file
// Works both in local dev (server/src/migrate.ts) and Vercel (api/index.ts imports from server/src/migrate.ts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// From server/src/migrate.ts -> server/migrations
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

interface Migration {
  filename: string;
  version: string;
  up: string;
  down?: string;
}

async function loadMigrations(): Promise<Migration[]> {
  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

  const migrations: Migration[] = [];

  for (const file of sqlFiles) {
    const content = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
    const parts = content.split('-- DOWN');
    
    migrations.push({
      filename: file,
      version: file.replace('.sql', ''),
      up: parts[0].replace('-- UP', '').trim(),
      down: parts[1]?.trim(),
    });
  }

  return migrations;
}

async function ensureMigrationsTable() {
  const db = getDatabase();
  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) UNIQUE NOT NULL,
      filename VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<string[]> {
  const db = getDatabase();
  const result = await db.query('SELECT version FROM migrations ORDER BY id');
  return result.rows.map(r => r.version);
}

async function applyMigration(migration: Migration) {
  const db = getDatabase();
  
  logger.info(`Applying migration: ${migration.version}`);
  
  await db.query('BEGIN');
  try {
    await db.query(migration.up);
    await db.query(
      'INSERT INTO migrations (version, filename) VALUES ($1, $2)',
      [migration.version, migration.filename]
    );
    await db.query('COMMIT');
    logger.info(`Migration ${migration.version} applied successfully`);
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error(`Migration ${migration.version} failed:`, error);
    throw error;
  }
}

async function rollbackMigration(migration: Migration) {
  const db = getDatabase();
  
  if (!migration.down) {
    logger.warn(`No rollback script for migration: ${migration.version}`);
    return;
  }

  logger.info(`Rolling back migration: ${migration.version}`);
  
  await db.query('BEGIN');
  try {
    await db.query(migration.down);
    await db.query('DELETE FROM migrations WHERE version = $1', [migration.version]);
    await db.query('COMMIT');
    logger.info(`Migration ${migration.version} rolled back successfully`);
  } catch (error) {
    await db.query('ROLLBACK');
    logger.error(`Rollback ${migration.version} failed:`, error);
    throw error;
  }
}

export async function runMigrations() {
  logger.info('Starting database migrations...');
  
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const migrations = await loadMigrations();
  
  const pending = migrations.filter(m => !applied.includes(m.version));
  
  if (pending.length === 0) {
    logger.info('No pending migrations');
    return;
  }

  logger.info(`Found ${pending.length} pending migration(s)`);

  for (const migration of pending) {
    await applyMigration(migration);
  }

  logger.info('All migrations completed');
}

export async function rollbackLastMigration() {
  logger.info('Rolling back last migration...');
  
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const migrations = await loadMigrations();
  
  const lastApplied = applied[applied.length - 1];
  const migration = migrations.find(m => m.version === lastApplied);
  
  if (!migration) {
    logger.warn('No migration to rollback');
    return;
  }

  await rollbackMigration(migration);
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === 'up') {
    runMigrations().then(() => process.exit(0)).catch(err => {
      logger.error(err);
      process.exit(1);
    });
  } else if (command === 'down') {
    rollbackLastMigration().then(() => process.exit(0)).catch(err => {
      logger.error(err);
      process.exit(1);
    });
  } else {
    console.log('Usage: npm run migrate [up|down]');
    process.exit(1);
  }
}

