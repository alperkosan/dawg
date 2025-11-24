/**
 * DAWG Backend Server
 * 
 * Fastify-based backend for DAW collaboration platform
 */

import Fastify from 'fastify';
import { config } from './config/index.js';
import { registerPlugins } from './plugins/index.js';
import { registerRoutes } from './routes/index.js';
import { logger } from './utils/logger.js';
import { testConnection } from './services/database.js';
import { runMigrations } from './migrate.js';

const server = Fastify({
  logger: logger,
  requestIdLogLabel: 'reqId',
  genReqId: () => crypto.randomUUID(),
  // ✅ FIX: Increase body size limit to 10MB for file uploads
  bodyLimit: 10 * 1024 * 1024, // 10MB
});

async function start() {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    
    // Run migrations
    logger.info('Running database migrations...');
    await runMigrations();
    
    // Register plugins
    await registerPlugins(server);
    
    // Register routes
    await registerRoutes(server);
    
    // Health check
    server.get('/health', async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });
    
    // Start server
    const address = await server.listen({
      port: config.port,
      host: config.host,
    });
    
    logger.info(`🚀 Server listening on ${address}`);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await server.close();
  process.exit(0);
});

start();

