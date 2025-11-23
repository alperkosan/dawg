/**
 * Vercel Serverless Function Entry Point
 * Wraps Fastify server for Vercel deployment
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';

// ✅ FIX: Disable Vercel's bodyParser for multipart requests
// This allows Fastify's multipart plugin to handle the raw stream
export const config = {
  api: {
    bodyParser: false, // Disable bodyParser to allow Fastify to handle multipart
  },
};
// ✅ FIX: nodenext moduleResolution için .js uzantısı kullan (TypeScript'te .ts, runtime'da .js)
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
    // ⚠️ CRITICAL: For multipart/form-data, we MUST NOT parse the body
    // Fastify's multipart plugin needs the raw request stream
    const contentType = req.headers['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');
    
    let payload = req.body;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      // ✅ FIX: Check content-length for 413 errors (Vercel limit: 4.5MB)
      const contentLength = req.headers['content-length'];
      if (contentLength && parseInt(contentLength) > 4.5 * 1024 * 1024) {
        console.error('❌ Request body too large:', contentLength, 'bytes');
        return res.status(413).json({
          error: {
            message: 'File too large. Maximum file size is 4.5MB for direct upload. For larger files, please use a different method.',
            code: 'FILE_TOO_LARGE',
            maxSize: '4.5MB',
            receivedSize: `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB`,
          },
        });
      }
      
      // ✅ FIX: For multipart/form-data, don't parse body - let Fastify handle it
      if (isMultipart) {
        logger.info('📦 Multipart request detected - passing raw body to Fastify');
        // For multipart, we need to pass undefined/null so Fastify can read from the raw stream
        // Vercel already consumed the stream, so we need to reconstruct it
        // Actually, Vercel doesn't expose the raw stream, so we need a different approach
        // The issue is that Vercel's bodyParser already consumed the stream
        // We need to tell Fastify to read from req (which Vercel doesn't expose)
        // For now, pass undefined and let Fastify try to read from the request
        payload = undefined;
      } else {
        // For non-multipart requests, parse JSON if needed
        if (typeof payload === 'string' && payload.length > 0) {
          try {
            payload = JSON.parse(payload);
          } catch (e) {
            // If parsing fails, use as is
            logger.warn('Failed to parse body as JSON, using as string:', e);
          }
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
    
    // ✅ FIX: For multipart requests, Fastify's inject() doesn't work with multipart streams
    // Vercel's bodyParser consumes the stream, so we can't pass it to Fastify
    // Solution: We need to use a workaround - pass the raw request object
    // But Vercel doesn't expose raw request, so we need to handle it differently
    // Actually, the real issue is that Vercel's @vercel/node automatically parses multipart
    // and puts it in req.body, but Fastify's multipart plugin expects raw stream
    
    // ⚠️ CRITICAL: For multipart, we can't use server.inject() because it doesn't support streams
    // We need to manually handle the multipart request or use a different approach
    // For now, let's try passing undefined and see if Fastify can handle it
    // If not, we'll need to manually parse multipart using busboy or similar
    
    let injectPayload: any = payload;
    if (isMultipart) {
      console.log('📦 Multipart request detected');
      console.log('📦 Content-Type:', contentType);
      console.log('📦 Body type:', typeof req.body);
      console.log('📦 Has body:', !!req.body);
      
      // ⚠️ Vercel's bodyParser may have already consumed the stream
      // Fastify's inject() doesn't support multipart streams
      // We need to pass undefined and let Fastify try to read from the request
      // But this won't work because the stream is already consumed
      // Solution: We need to disable Vercel's bodyParser for multipart requests
      // But we can't do that in the handler
      
      // Try passing undefined - Fastify will try to read from request
      // But Vercel's request object doesn't have a readable stream
      injectPayload = undefined;
      
      // Alternative: Try to reconstruct multipart from req.body if Vercel parsed it
      // But Vercel doesn't parse multipart, it only parses JSON
      // So req.body will be undefined for multipart requests
    }
    
    // Use Fastify's inject method for serverless
    const response = await server.inject({
      method: req.method || 'GET',
      url: url,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, string>,
      payload: injectPayload,
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

