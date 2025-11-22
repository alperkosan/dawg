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
      return reply.code(400).send({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      });
    }

    // Handle Fastify validation errors
    if (error.validation) {
      return reply.code(400).send({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors: error.validation,
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

