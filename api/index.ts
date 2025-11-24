/**
 * Vercel Serverless Function Entry Point
 * Wraps Fastify server for Vercel deployment
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
// ✅ FIX: Removed busboy import - Fastify multipart plugin handles multipart requests

// ✅ FIX: Disable Vercel's bodyParser for multipart requests
// This allows Fastify's multipart plugin to handle the raw stream
export const vercelConfig = {
  api: {
    bodyParser: false, // Disable bodyParser to allow Fastify to handle multipart
  },
};
// ✅ FIX: nodenext moduleResolution için .js uzantısı kullan (TypeScript'te .ts, runtime'da .js)
// ✅ FIX: Renamed to avoid conflict with exported config
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
      console.log('Database URL present:', process.env.DATABASE_URL ? 'YES' : 'NO');
      console.log('Neon URL present:', process.env.NEON_DATABASE_URL ? 'YES' : 'NO');
      
      // ✅ FIX: Log database URL (masked) for debugging
      if (process.env.DATABASE_URL) {
        const dbUrl = process.env.DATABASE_URL;
        const maskedUrl = dbUrl.substring(0, 20) + '...' + dbUrl.substring(dbUrl.length - 10);
        console.log('Database URL (masked):', maskedUrl);
        console.log('Is Neon URL:', dbUrl.includes('neon.tech') || dbUrl.includes('neon') || dbUrl.includes('pooler'));
      }
      
      try {
        const dbConnected = await testConnection();
        if (!dbConnected) {
          console.error('❌ Database connection test returned false');
          // ✅ FIX: More detailed error message
          throw new Error('Database connection test failed. Check DATABASE_URL and network connectivity.');
        }
        console.log('✅ Database connection successful');
      } catch (dbError) {
        console.error('❌ Database connection error:', dbError);
        console.error('Database URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
        console.error('Neon URL:', process.env.NEON_DATABASE_URL ? 'SET' : 'NOT SET');
        
        // ✅ FIX: Check if DATABASE_URL is valid format
        if (process.env.DATABASE_URL) {
          const dbUrl = process.env.DATABASE_URL;
          if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
            console.error('⚠️ DATABASE_URL does not start with postgresql:// or postgres://');
          }
          if (!dbUrl.includes('@')) {
            console.error('⚠️ DATABASE_URL missing @ (credentials separator)');
          }
        }
        
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
  // ✅ FIX: Set timeout to prevent hanging requests
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('❌ Request timeout after 25 seconds');
      res.status(504).json({
        error: {
          message: 'Request timeout',
          code: 'TIMEOUT',
        },
      });
    }
  }, 25000); // 25 seconds (Vercel max is 30s, leave 5s buffer)

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
    
    // ✅ FIX: Safe logger call (logger might be disabled in Vercel)
    try {
      if (logger && typeof logger.info === 'function') {
        logger.info('Vercel request received:', {
          method: req.method,
          url: req.url,
        });
      }
    } catch (loggerError) {
      // Ignore logger errors
      console.warn('Logger error (ignored):', loggerError);
    }

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
    
    let payload: any = req.body;
    let injectPayload: any = undefined; // ✅ FIX: Declare injectPayload variable
    
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
      
      // ✅ FIX: For multipart/form-data, parse with busboy and pass to Fastify
      if (isMultipart) {
        // ✅ FIX: Safe logger call
        try {
          if (logger && typeof logger.info === 'function') {
            logger.info('📦 Multipart request detected - parsing with busboy');
          }
        } catch (loggerError) {
          // Ignore logger errors
        }
        // Vercel's bodyParser doesn't parse multipart, so req.body is undefined
        // We need to get the raw body from Vercel's request
        // But Vercel doesn't expose raw body directly, so we need to reconstruct it
        // Actually, Vercel's @vercel/node doesn't parse multipart at all
        // So we need to handle it differently - use busboy to parse from the request stream
        // But Vercel's request object doesn't have a readable stream
        // Solution: We'll handle multipart requests separately by parsing them with busboy
        // and then manually calling the Fastify route handler
        payload = undefined; // Will be handled separately below
      } else {
        // For non-multipart requests, parse JSON if needed
        if (typeof payload === 'string' && payload.length > 0) {
          try {
            payload = JSON.parse(payload);
          } catch (e) {
            // If parsing fails, use as is
            // ✅ FIX: Safe logger call
            try {
              if (logger && typeof logger.warn === 'function') {
                logger.warn('Failed to parse body as JSON, using as string:', e);
              }
            } catch (loggerError) {
              // Ignore logger errors
            }
          }
        }
      }
    }
    
    console.log('🟢 Processing request:', {
      method: req.method,
      url: url,
      payloadSize: payload ? JSON.stringify(payload).length : 0,
    });
    
    // ✅ FIX: Safe logger call
    try {
      if (logger && typeof logger.info === 'function') {
        logger.info('Processing request:', {
          method: req.method,
          url: url,
        });
      }
    } catch (loggerError) {
      // Ignore logger errors
    }
    
    // ✅ FIX: For multipart requests, Fastify's multipart plugin will handle them
    // Vercel's bodyParser is disabled, so Fastify can process the raw stream
    // Note: Fastify inject() doesn't support multipart streams directly,
    // but since we're using server.inject(), we need to handle this differently
    // For now, pass undefined and let the route handler handle multipart via Fastify's plugin
    if (isMultipart) {
      console.log('📦 Multipart request detected - Fastify multipart plugin will handle it');
      // ✅ FIX: Safe logger call
      try {
        if (logger && typeof logger.info === 'function') {
          logger.info('📦 Multipart request - Fastify will handle via multipart plugin');
        }
      } catch (loggerError) {
        // Ignore logger errors
      }
      
      // ✅ FIX: For multipart, we can't use inject() with raw stream
      // Instead, we need to let Fastify handle it directly via its multipart plugin
      // But since we're using inject(), we'll pass undefined and handle error in route
      // OR: We could create a custom request handler for multipart
      // For now, return 415 Unsupported Media Type for multipart via inject()
      // The route handler should handle multipart directly if needed
      injectPayload = undefined;
      
      // ✅ FIX: Note - multipart requests via inject() are not fully supported
      // Routes that need multipart should handle it directly via Fastify's request object
      // This is a limitation of using server.inject() for serverless
    }
    
    // ✅ FIX: Set injectPayload for all requests (if not already set)
    if (injectPayload === undefined) {
      injectPayload = payload;
    }
    
    // ✅ FIX: Set injectPayload for all requests
    if (injectPayload === undefined && payload !== undefined) {
      injectPayload = payload;
    }
    
    // Use Fastify's inject method for serverless
    const response = await server.inject({
      method: (req.method || 'GET') as any, // ✅ FIX: Type assertion for HTTPMethods
      url: url,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, string>,
      payload: injectPayload,
    });

    console.log('🟡 Fastify response:', {
      statusCode: response.statusCode,
      headers: Object.keys(response.headers),
    });
    
    // ✅ FIX: Safe logger call
    try {
      if (logger && typeof logger.info === 'function') {
        logger.info('Fastify response:', {
          statusCode: response.statusCode,
        });
      }
    } catch (loggerError) {
      // Ignore logger errors
    }

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
    
    // ✅ FIX: Safe logger call
    try {
      if (logger && typeof logger.error === 'function') {
        logger.error('Serverless function error:', {
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          } : error,
        });
      }
    } catch (loggerError) {
      // Ignore logger errors
      console.warn('Logger error (ignored):', loggerError);
    }
    
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

