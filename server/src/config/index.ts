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
  
  // Database
  database: {
    // ✅ Neon: Use DATABASE_URL from Vercel/Neon integration
    // Format: postgresql://user:password@host/database?sslmode=require
    // Or with pooler: postgresql://user:password@host-pooler/database?sslmode=require
    url: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || 'postgresql://user:password@localhost:5432/dawg',
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
      apiKey: process.env.BUNNY_API_KEY || '4cd141b1-7536-4c1d-a271-cdcfb9b7c188164396e2-e980-449e-807a-944dca1017c7',
      storageApiKey: process.env.BUNNY_STORAGE_API_KEY || 'c15a4aa9-6755-4330-a3db4237abd4-8697-45b1', // Storage zone API key
    },
  },
  
  // Redis (optional)
  redis: {
    url: process.env.REDIS_URL,
  },
  
  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:5174'],
  },
  
  // Rate Limiting
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_TIME_WINDOW || '60000', 10),
  },
} as const;

