/**
 * Error handling plugin
 */

import { FastifyInstance, FastifyError } from 'fastify';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

export async function registerErrorHandler(server: FastifyInstance) {
  server.setErrorHandler((error: FastifyError, request, reply) => {
    // Log error
    logger.error({
      err: error,
      url: request.url,
      method: request.method,
    }, 'Request error');

    // Handle known errors
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          message: error.message,
          code: error.code,
        },
      });
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      // ✅ FIX: Create user-friendly error message from Zod errors
      const errorMessages = error.errors.map(e => {
        const field = e.path.join('.') || 'field';
        return `${field}: ${e.message}`;
      });
      const mainMessage = errorMessages.length === 1 
        ? errorMessages[0] 
        : `Validation failed: ${errorMessages.join(', ')}`;
      
      return reply.code(400).send({
        error: {
          message: mainMessage,
          code: 'VALIDATION_ERROR',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }

    // Handle Fastify validation errors
    if (error.validation) {
      const errorMessages = error.validation.map((v: any) => {
        const field = v.instancePath || v.params?.missingProperty || 'field';
        return `${field}: ${v.message || 'Invalid value'}`;
      });
      const mainMessage = errorMessages.length === 1 
        ? errorMessages[0] 
        : `Validation failed: ${errorMessages.join(', ')}`;
      
      return reply.code(400).send({
        error: {
          message: mainMessage,
          code: 'VALIDATION_ERROR',
          details: error.validation,
        },
      });
    }
    
    // ✅ FIX: Handle 413 Payload Too Large (Vercel limit: 4.5MB for request body)
    // Note: With base64 encoding, a 3.5MB file becomes ~4.7MB, so we allow up to 10MB in Fastify
    // but Vercel's limit is still 4.5MB
    if (error.statusCode === 413 || error.code === 'FST_ERR_REQ_ENTITY_TOO_LARGE' || error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({
        error: {
          message: 'File too large. Maximum file size is ~3.5MB for direct upload (Vercel limit: 4.5MB with base64 encoding). For larger files, please use chunked upload or a different method.',
          code: 'FILE_TOO_LARGE',
          maxSize: '~3.5MB (raw file)',
          vercelLimit: '4.5MB (with encoding)',
        },
      });
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return reply.code(401).send({
        error: {
          message: 'Invalid or expired token',
          code: 'JWT_ERROR',
        },
      });
    }

    // Default error response
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 ? 'Internal server error' : error.message;

    return reply.code(statusCode).send({
      error: {
        message,
        code: 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
    });
  });
}

