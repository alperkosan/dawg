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

  // ✅ FIX: Vercel/serverless ortamında pino-pretty kullanma
  // pino-pretty development tool'u, serverless'te sorun yaratır
  const isVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
  const isDev = process.env.NODE_ENV === 'development' && !isVercel;
  
  const server = Fastify({
    logger: isDev ? {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    } : false, // Vercel'de logger'ı kapat, console.log kullan
    requestIdLogLabel: 'reqId',
    genReqId: () => crypto.randomUUID(),
    // ✅ Vercel: Disable request logging (console.log kullanıyoruz)
    disableRequestLogging: true,
  });

  try {
    // Test database connection
    if (!isInitialized) {
      console.log('🔵 Step 1: Testing database connection...');
      try {
        const dbConnected = await testConnection();
        if (!dbConnected) {
          console.error('❌ Database connection test returned false');
          throw new Error('Database connection failed');
        }
        console.log('✅ Database connection successful');
      } catch (dbError) {
        console.error('❌ Database connection error:', dbError);
        console.error('Database URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
        console.error('Neon URL:', process.env.NEON_DATABASE_URL ? 'SET' : 'NOT SET');
        throw dbError;
      }
      
      // Run migrations (only once on cold start)
      console.log('🔵 Step 2: Running database migrations...');
      try {
        await runMigrations();
        console.log('✅ Migrations completed');
      } catch (migrationError) {
        console.error('❌ Migration error:', migrationError);
        throw migrationError;
      }
      
      isInitialized = true;
    }
    
    // Register plugins
    console.log('🔵 Step 3: Registering plugins...');
    try {
      await registerPlugins(server);
      console.log('✅ Plugins registered');
    } catch (pluginError) {
      console.error('❌ Plugin registration error:', pluginError);
      throw pluginError;
    }
    
    // Register routes
    console.log('🔵 Step 4: Registering routes...');
    try {
      await registerRoutes(server);
      console.log('✅ Routes registered');
    } catch (routeError) {
      console.error('❌ Route registration error:', routeError);
      throw routeError;
    }
    
    // Health check
    server.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Prepare server (don't listen, we're in serverless mode)
    console.log('🔵 Step 5: Preparing server...');
    try {
      await server.ready();
      console.log('✅ Server ready');
    } catch (readyError) {
      console.error('❌ Server ready error:', readyError);
      throw readyError;
    }

    serverInstance = server;
    console.log('✅ Server instance created successfully');
    return server;
  } catch (error) {
    console.error('❌ Failed to create server:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    // Don't use logger here, it might fail too
    throw error;
  }
}

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // ✅ DEBUG: Log incoming request (always log, not just in dev)
    console.log('🔵 Vercel request received:', {
      method: req.method,
      url: req.url,
      headers: Object.keys(req.headers),
      hasBody: !!req.body,
      bodyType: typeof req.body,
      query: req.query,
    });
    
    logger.info('Vercel request received:', {
      method: req.method,
      url: req.url,
      headers: Object.keys(req.headers),
      hasBody: !!req.body,
      bodyType: typeof req.body,
      query: req.query,
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
    
    console.log('🟢 Processing request:', {
      method: req.method,
      url: url,
      payloadSize: payload ? JSON.stringify(payload).length : 0,
    });
    
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

    console.log('🟡 Fastify response:', {
      statusCode: response.statusCode,
      headers: Object.keys(response.headers),
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
    // ✅ Enhanced error logging (console.log for visibility)
    console.error('❌ Serverless function error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    
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

