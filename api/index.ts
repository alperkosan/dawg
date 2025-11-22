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
    // ✅ DEBUG: Log incoming request
    logger.info('Vercel request received:', {
      method: req.method,
      url: req.url,
      headers: Object.keys(req.headers),
      hasBody: !!req.body,
      bodyType: typeof req.body,
    });

    const server = await createServer();
    
    // ✅ FIX: Vercel rewrite sonrası URL'yi doğru al
    // Vercel'de rewrite kullanırken, req.url orijinal path'i içerir
    // Örnek: /api/auth/login isteği -> req.url = '/api/auth/login' (orijinal path korunur)
    let url = req.url || '/';
    
    // ✅ FIX: Vercel rewrite sonrası req.url zaten doğru path'i içerir
    // Ama bazen query string ile geliyor, onu temizle
    if (url.includes('?')) {
      url = url.split('?')[0];
    }
    
    // ✅ FIX: URL'yi normalize et (başında / olmalı)
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    
    // ✅ FIX: Parse request body correctly
    let payload = req.body;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      // If body is already parsed (JSON), use it directly
      // If it's a string, try to parse it
      if (typeof payload === 'string' && payload.length > 0) {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          // If parsing fails, use as is (might be form data)
          logger.warn('Failed to parse body as JSON, using as string:', e);
        }
      }
    }
    
    logger.info('Processing request:', {
      method: req.method,
      url: url,
      payloadSize: payload ? JSON.stringify(payload).length : 0,
    });
    
    // Use Fastify's inject method for serverless
    const response = await server.inject({
      method: req.method || 'GET',
      url: url,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, string>,
      payload: payload,
    });

    logger.info('Fastify response:', {
      statusCode: response.statusCode,
      headers: Object.keys(response.headers),
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
    // ✅ Enhanced error logging
    logger.error('Serverless function error:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
      },
    });
    
    // Send detailed error in development
    const errorResponse: any = {
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    };
    
    if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development') {
      errorResponse.error.details = error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : String(error);
    }
    
    res.status(500).json(errorResponse);
  }
}

