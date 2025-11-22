/**
 * Vercel Serverless Function Entry Point
 * Wraps Fastify server for Vercel deployment
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import { config } from '../server/src/config/index.js';
import { registerPlugins } from '../server/src/plugins/index.js';
import { registerRoutes } from '../server/src/routes/index.js';
import { logger } from '../server/src/utils/logger.js';
import { testConnection } from '../server/src/services/database.js';
import { runMigrations } from '../server/src/migrate.js';

// Global server instance (reused across invocations for better performance)
let serverInstance: FastifyInstance | null = null;
let isInitialized = false;

async function createServer() {
  if (serverInstance && isInitialized) {
    return serverInstance;
  }

  const server = Fastify({
    logger: process.env.NODE_ENV === 'development' ? logger : false,
    requestIdLogLabel: 'reqId',
    genReqId: () => crypto.randomUUID(),
    // ✅ Vercel: Disable request logging in production for performance
    disableRequestLogging: process.env.NODE_ENV === 'production',
  });

  try {
    // Test database connection
    if (!isInitialized) {
      logger.info('Testing database connection...');
      const dbConnected = await testConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }
      
      // Run migrations (only once on cold start)
      logger.info('Running database migrations...');
      await runMigrations();
      
      isInitialized = true;
    }
    
    // Register plugins
    await registerPlugins(server);
    
    // Register routes
    await registerRoutes(server);
    
    // Health check
    server.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Prepare server (don't listen, we're in serverless mode)
    await server.ready();

    serverInstance = server;
    return server;
  } catch (error) {
    logger.error('Failed to create server:', error);
    throw error;
  }
}

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const server = await createServer();
    
    // ✅ FIX: Vercel rewrite sonrası URL'yi doğru al
    // Vercel rewrite: /api/(.*) -> /api/index?path=$1
    // req.url orijinal path'i içerir, ama query'den de alabiliriz
    let url = req.url || '/';
    
    // ✅ FIX: Query'den path varsa kullan (rewrite sonrası)
    if (req.query && typeof req.query.path === 'string') {
      url = req.query.path;
      // Query'den path alındıysa, query'den path'i çıkar
      const { path, ...restQuery } = req.query;
      req.query = restQuery;
    }
    
    // ✅ FIX: URL'yi normalize et (başında / olmalı, /api/ prefix'i olmalı)
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    
    // ✅ FIX: Eğer URL /api ile başlamıyorsa, /api ekle
    if (!url.startsWith('/api/') && url !== '/api') {
      // Query'den gelen path zaten /api/auth/login formatında olmalı
      // Ama emin olmak için kontrol edelim
      if (url.startsWith('/auth/') || url.startsWith('/users/') || url.startsWith('/projects/')) {
        url = '/api' + url;
      }
    }
    
    // Use Fastify's inject method for serverless
    const response = await server.inject({
      method: req.method || 'GET',
      url: url,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, string>,
      payload: req.body,
    });

    // Set response headers
    Object.keys(response.headers).forEach(key => {
      const value = response.headers[key];
      if (value !== undefined) {
        res.setHeader(key, value);
      }
    });

    // Set status code
    res.status(response.statusCode);

    // Send response
    res.send(response.payload);
  } catch (error) {
    logger.error('Serverless function error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }
}

