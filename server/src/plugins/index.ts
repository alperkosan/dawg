/**
 * Register Fastify plugins
 */

import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import fastifyMultipart from '@fastify/multipart';
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
  // ✅ FIX: @fastify/multipart v8 API
  await server.register(fastifyMultipart, {
    limits: {
      fileSize: 1073741824, // 1GB max file size
    },
    // ✅ FIX: attachFieldsToBody can be true, false, or 'keyValues'
    // 'keyValues' attaches form fields as key-value pairs to request.body
    // Files are NOT attached to body (use request.file() to access files)
    attachFieldsToBody: 'keyValues',
  });
  
  // Auth middleware
  await registerAuthMiddleware(server);
}

