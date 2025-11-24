/**
 * Configuration
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ✅ FIX: Get correct path for .env file (works with ESM modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

// Load .env file from server root directory
dotenv.config({ path: envPath });

export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  clientUrl: process.env.CLIENT_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:5173',
  
  // Database
  database: {
    // ✅ Neon: Use DATABASE_URL from Vercel/Neon integration
    // Format: postgresql://user:password@host/database?sslmode=require
    // Or with pooler: postgresql://user:password@host-pooler/database?sslmode=require
    // ✅ FIX: Support both DATABASE_URL and dawg_DATABASE_URL (Vercel Neon integration prefix)
    url: process.env.DATABASE_URL 
      || process.env.NEON_DATABASE_URL 
      || process.env.dawg_DATABASE_URL  // Vercel Neon integration uses prefix
      || 'postgresql://user:password@localhost:5432/dawg',
    poolMin: parseInt(process.env.DB_POOL_MIN || '0', 10), // ✅ Serverless: 0 for Neon
    poolMax: parseInt(process.env.DB_POOL_MAX || '5', 10), // ✅ Neon free tier: 5 connections
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  },
  
  // Refresh Token
  refreshToken: {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  
  // Cookie
  cookie: {
    secret: process.env.COOKIE_SECRET || 'change-this-secret',
  },
  
  // Storage
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'minio',
    endpoint: process.env.STORAGE_ENDPOINT || 'localhost:9000',
    accessKey: process.env.STORAGE_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.STORAGE_SECRET_KEY || 'minioadmin',
    bucket: process.env.STORAGE_BUCKET || 'dawg-audio',
    region: process.env.STORAGE_REGION || 'us-east-1',
    useSSL: process.env.STORAGE_USE_SSL === 'true',
  },
  
  // CDN (Bunny CDN)
  cdn: {
    provider: process.env.CDN_PROVIDER || 'bunny', // 'bunny' | 'local'
    baseUrl: process.env.CDN_BASE_URL || 'https://dawg.b-cdn.net',
    // Bunny CDN specific
    bunny: {
      pullZoneUrl: process.env.BUNNY_PULL_ZONE_URL || 'https://dawg.b-cdn.net',
      storageZoneName: process.env.BUNNY_STORAGE_ZONE_NAME || 'dawg-storage',
      storageZoneRegion: process.env.BUNNY_STORAGE_ZONE_REGION || 'de', // de, ny, la, sg, etc.
      // ✅ FIX: Require API keys from environment (no hardcoded secrets)
      apiKey: process.env.BUNNY_API_KEY || (() => {
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️ BUNNY_API_KEY not set in production!');
        }
        return '';
      })(),
      storageApiKey: process.env.BUNNY_STORAGE_API_KEY || (() => {
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️ BUNNY_STORAGE_API_KEY not set in production!');
        }
        return '';
      })(),
    },
  },
  
  // Redis (optional)
  redis: {
    url: process.env.REDIS_URL,
  },
  
  // CORS
  cors: {
    // ✅ Production: Support Vercel preview deployments and production domain
    // Development: localhost origins
    origin: (() => {
      // If CORS_ORIGIN is explicitly set, use it
      if (process.env.CORS_ORIGIN) {
        return process.env.CORS_ORIGIN.split(',').map(o => o.trim());
      }
      
      // Default origins for development
      const defaultOrigins = [
        'http://localhost:5173', 
        'http://localhost:5174',
      ];
      
      // ✅ Production: Add Vercel URL if available
      if (process.env.VERCEL_URL) {
        defaultOrigins.push(`https://${process.env.VERCEL_URL}`);
      }
      
      // ✅ Production: Support all Vercel preview deployments (wildcard)
      // Fastify CORS supports regex patterns as strings
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
        // ✅ FIX: Use string pattern instead of RegExp for CORS origin
        defaultOrigins.push('https://*.vercel.app');
      }
      
      return defaultOrigins;
    })(),
  },
  
  // Rate Limiting
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_TIME_WINDOW || '60000', 10),
  },
} as const;

