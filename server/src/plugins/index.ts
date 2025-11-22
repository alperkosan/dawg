/**
 * Register Fastify plugins
 */

import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { config } from '../config/index.js';
import { registerAuthMiddleware } from '../middleware/auth.js';
import { registerErrorHandler } from './error-handler.js';

export async function registerPlugins(server: FastifyInstance) {
  // Error handler (register first)
  await registerErrorHandler(server);
  
  // CORS
  await server.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });
  
  // Cookie
  await server.register(cookie, {
    secret: config.cookie.secret,
    parseOptions: {},
  });
  
  // JWT
  await server.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });
  
  // Rate Limiting
  await server.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
  });
  
  // WebSocket (for real-time collaboration)
  await server.register(websocket);
  
  // Multipart (for file uploads)
  await server.register(multipart, {
    limits: {
      fileSize: 1073741824, // 1GB max file size
    },
    // ✅ FIX: Add fields to request.body for easier access
    // This allows reading fields from request.body while file is in request.file()
    addToBody: true,
    // ✅ FIX: Don't add file to body (we'll use request.file() for that)
    attachFieldsToBody: false,
  });
  
  // Auth middleware
  await registerAuthMiddleware(server);
}

