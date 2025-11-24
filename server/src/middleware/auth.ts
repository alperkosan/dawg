/**
 * Authentication middleware
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ✅ FIX: JWT Payload type definition (exported for use in other files)
export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

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
      const decoded = await server.jwt.verify<JWTPayload>(token);
      
      // ✅ FIX: Type assertion for JWT payload
      if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded) {
        const payload = decoded as JWTPayload;
      // Attach user to request
      request.user = {
          userId: payload.userId,
          email: payload.email,
          username: payload.username,
      };
      } else {
        throw new Error('Invalid JWT payload');
      }
    } catch (error) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}

