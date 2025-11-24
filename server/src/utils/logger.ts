/**
 * Logger utility
 */

import pino from 'pino';

// ✅ FIX: Pino v8+ uses default export, but TypeScript may need explicit call
// Check if pino is a function or has default property
const createLogger = (typeof pino === 'function' ? pino : (pino as any).default || pino);

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

