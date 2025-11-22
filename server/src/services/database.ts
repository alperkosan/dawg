/**
 * Database connection service
 * ✅ Optimized for Neon (serverless PostgreSQL) and Vercel
 */

import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Check if using Neon database (by connection string)
 */
function isNeonDatabase(url: string): boolean {
  return url.includes('neon.tech') || url.includes('neon') || url.includes('pooler');
}

/**
 * Get optimized pool configuration for Neon/serverless
 */
function getPoolConfig() {
  const isNeon = isNeonDatabase(config.database.url);
  const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
  
  const baseConfig: pg.PoolConfig = {
    connectionString: config.database.url,
    // ✅ Neon: SSL is required
    ssl: isNeon ? { rejectUnauthorized: false } : undefined,
  };

  if (isServerless || isNeon) {
    // ✅ Serverless/Neon: Optimize for serverless environment
    // - Lower min connections (serverless functions are stateless)
    // - Lower max connections (Neon has connection limits)
    // - Shorter idle timeout
    return {
      ...baseConfig,
      min: 0, // Don't keep connections open in serverless
      max: isNeon ? 5 : config.database.poolMax, // Neon free tier: 5 connections
      idleTimeoutMillis: 10000, // Close idle connections faster
      connectionTimeoutMillis: 5000, // Faster timeout for serverless
      // ✅ Neon: Enable connection pooling mode
      ...(isNeon && {
        // Neon connection string already includes pooler endpoint
        // Just ensure SSL is enabled
        ssl: { rejectUnauthorized: false },
      }),
    };
  }

  // ✅ Traditional server: Use configured pool settings
  return {
    ...baseConfig,
    min: config.database.poolMin,
    max: config.database.poolMax,
  };
}

export function getDatabase(): pg.Pool {
  if (!pool) {
    const poolConfig = getPoolConfig();
    
    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      logger.error('Unexpected database error', err);
    });

    pool.on('connect', () => {
      logger.info('Database connection established');
    });

    // ✅ Log pool configuration
    if (isNeonDatabase(config.database.url)) {
      logger.info('Using Neon database with optimized serverless configuration');
    }
  }

  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection closed');
  }
}

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT NOW()');
    logger.info('Database connection test successful', result.rows[0]);
    return true;
  } catch (error) {
    logger.error('Database connection test failed', error);
    return false;
  }
}

