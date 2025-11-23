/**
 * Authentication routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { config } from '../config/index.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  createSession,
  findSessionByToken,
  updateSessionLastUsed,
  deleteSession,
  updateUserLastLogin,
  emailExists,
  usernameExists,
  generateRefreshToken,
} from '../services/auth.js';
import { BadRequestError, UnauthorizedError, ConflictError } from '../utils/errors.js';

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  displayName: z.string().min(1).max(100).optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export async function authRoutes(server: FastifyInstance) {
  // Register
  server.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = RegisterSchema.parse(request.body);
      
      // Check if email already exists
      if (await emailExists(body.email)) {
        throw new ConflictError('Email already registered');
      }
      
      // Check if username already exists
      if (await usernameExists(body.username)) {
        throw new ConflictError('Username already taken');
      }
      
      // Create user
      const user = await createUser({
        email: body.email,
        username: body.username,
        password: body.password,
        displayName: body.displayName,
      });
      
      // Generate tokens
      const accessToken = server.jwt.sign({
        userId: user.id,
        email: user.email,
        username: user.username,
        type: 'access',
      });
      
      const refreshToken = generateRefreshToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
      
      // Create session
      await createSession({
        userId: user.id,
        refreshToken,
        deviceInfo: {
          userAgent: request.headers['user-agent'],
        },
        ipAddress: request.ip,
        expiresAt,
      });
      
      // Set refresh token cookie
      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
        path: '/api/auth',
      });
      
      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name || user.displayName,
          avatarUrl: user.avatar_url || user.avatarUrl,
          isVerified: user.is_verified || user.isVerified || false,
          createdAt: user.created_at || user.createdAt,
        },
        accessToken,
        expiresIn: 900, // 15 minutes in seconds
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        // ✅ FIX: Create user-friendly error message from Zod errors
        const errorMessages = error.errors.map(e => {
          const field = e.path.join('.') || 'field';
          return `${field}: ${e.message}`;
        });
        const mainMessage = errorMessages.length === 1 
          ? errorMessages[0] 
          : `Validation failed: ${errorMessages.join(', ')}`;
        throw new BadRequestError(mainMessage, 'VALIDATION_ERROR');
      }
      throw error;
    }
  });
  
  // Login
  server.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = LoginSchema.parse(request.body);
      
      // Find user
      const user = await findUserByEmail(body.email);
      if (!user) {
        throw new UnauthorizedError('Invalid email or password');
      }
      
      // Check if user is active
      if (!user.is_active && !user.isActive) {
        throw new UnauthorizedError('Account is deactivated');
      }
      
      // Verify password (need to get user with password_hash)
      const userWithPassword = await findUserByEmail(body.email, true);
      if (!userWithPassword || !userWithPassword.password_hash) {
        throw new UnauthorizedError('Invalid email or password');
      }
      
      const isValid = await verifyPassword(body.password, userWithPassword.password_hash);
      if (!isValid) {
        throw new UnauthorizedError('Invalid email or password');
      }
      
      // Update last login
      await updateUserLastLogin(user.id);
      
      // Generate tokens
      const accessToken = server.jwt.sign({
        userId: user.id,
        email: user.email,
        username: user.username,
        type: 'access',
      });
      
      const refreshToken = generateRefreshToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
      
      // Create session
      await createSession({
        userId: user.id,
        refreshToken,
        deviceInfo: {
          userAgent: request.headers['user-agent'],
        },
        ipAddress: request.ip,
        expiresAt,
      });
      
      // Set refresh token cookie
      reply.setCookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
        path: '/api/auth',
      });
      
      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name || user.displayName,
          avatarUrl: user.avatar_url || user.avatarUrl,
          isVerified: user.is_verified || user.isVerified || false,
        },
        accessToken,
        expiresIn: 900, // 15 minutes in seconds
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new BadRequestError('Validation failed', error.errors);
      }
      throw error;
    }
  });
  
  // Refresh token
  server.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const refreshToken = request.cookies.refreshToken;
      
      if (!refreshToken) {
        throw new UnauthorizedError('Refresh token not provided');
      }
      
      // Find session
      const session = await findSessionByToken(refreshToken);
      if (!session) {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }
      
      // Get user
      const user = await findUserById(session.userId);
      if (!user || (!user.is_active && !user.isActive)) {
        throw new UnauthorizedError('User not found or inactive');
      }
      
      // Update session last used
      await updateSessionLastUsed(session.id);
      
      // Generate new tokens
      const accessToken = server.jwt.sign({
        userId: user.id,
        email: user.email,
        username: user.username,
        type: 'access',
      });
      
      // Rotate refresh token (optional - for security)
      const newRefreshToken = generateRefreshToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      // Delete old session
      await deleteSession(refreshToken);
      
      // Create new session
      await createSession({
        userId: user.id,
        refreshToken: newRefreshToken,
        deviceInfo: {
          userAgent: request.headers['user-agent'],
        },
        ipAddress: request.ip,
        expiresAt,
      });
      
      // Set new refresh token cookie
      reply.setCookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
        path: '/api/auth',
      });
      
      return {
        accessToken,
        expiresIn: 900,
      };
    } catch (error: any) {
      throw error;
    }
  });
  
  // Logout
  server.post('/logout', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies.refreshToken;
    
    if (refreshToken) {
      await deleteSession(refreshToken);
    }
    
    // Clear cookie
    reply.clearCookie('refreshToken', {
      path: '/api/auth',
    });
    
    return {
      message: 'Logged out successfully',
    };
  });
  
  // Get current user
  server.get('/me', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    
    const user = await findUserById(request.user.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name || user.displayName,
        avatarUrl: user.avatar_url || user.avatarUrl,
        bio: user.bio,
        isVerified: user.is_verified || user.isVerified || false,
        createdAt: user.created_at || user.createdAt,
        updatedAt: user.updated_at || user.updatedAt,
        lastLogin: user.last_login || user.lastLogin,
        settings: user.settings,
      },
    };
  });
}
