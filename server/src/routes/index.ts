/**
 * Register all routes
 */

import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { projectRoutes } from './projects.js';
import { userRoutes } from './users.js';
import { assetsRoutes } from './assets.js';
import { systemAssetsRoutes } from './systemAssets.js';
import { feedRoutes } from './feed.js';
import { interactionRoutes } from './interactions.js';
import { notificationRoutes } from './notifications.js';
import { registerWebSocketRoutes } from './websocket.js';

export async function registerRoutes(server: FastifyInstance) {
  // Health check is in index.ts
  
  // API routes
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(userRoutes, { prefix: '/api/users' });
  await server.register(projectRoutes, { prefix: '/api/projects' });
  await server.register(assetsRoutes, { prefix: '/api/assets' });
  
  // System assets routes: public endpoints under /api/assets, admin endpoints under /api/admin
  // Register twice: once for public endpoints, once for admin endpoints
  await server.register(systemAssetsRoutes, { prefix: '/api/assets' }); // Public: /api/assets/system
  await server.register(systemAssetsRoutes, { prefix: '/api' }); // Admin: /api/admin/system/assets
  
  // WebSocket routes
  await registerWebSocketRoutes(server);
}

