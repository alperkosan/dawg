/**
 * Authentication middleware
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      email: string;
      username: string;
    };
  }
  
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function registerAuthMiddleware(server: FastifyInstance) {
  server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get token from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      
      const token = authHeader.substring(7);
      
      // Verify JWT
      const decoded = await server.jwt.verify(token);
      
      // Attach user to request
      request.user = {
        userId: decoded.userId as string,
        email: decoded.email as string,
        username: decoded.username as string,
      };
    } catch (error) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}

