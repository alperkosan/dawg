/**
 * Authentication service
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDatabase } from './database.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { User } from '../types/index.js';

const SALT_ROUNDS = 12;

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomUUID();
}

/**
 * Create user
 */
export async function createUser(data: {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}): Promise<User> {
  const db = getDatabase();
  const passwordHash = await hashPassword(data.password);

  const result = await db.query<User>(
    `INSERT INTO users (email, username, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, username, display_name, avatar_url, bio, is_verified, 
               is_active, created_at, updated_at, last_login, settings`,
    [data.email, data.username, passwordHash, data.displayName || data.username]
  );

  return result.rows[0];
}

/**
 * Find user by email (with password hash for login)
 */
export async function findUserByEmail(email: string, includePassword: boolean = false): Promise<(User & { password_hash?: string }) | null> {
  const db = getDatabase();
  const passwordField = includePassword ? 'password_hash,' : '';
  const result = await db.query(
    `SELECT id, email, username, display_name, avatar_url, bio, is_verified,
            is_active, ${passwordField} created_at, updated_at, last_login, settings
     FROM users
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] || null;
}

/**
 * Find user by username
 */
export async function findUserByUsername(username: string): Promise<User | null> {
  const db = getDatabase();
  const result = await db.query<User>(
    `SELECT id, email, username, display_name, avatar_url, bio, is_verified,
            is_active, password_hash, created_at, updated_at, last_login, settings
     FROM users
     WHERE username = $1`,
    [username]
  );

  return result.rows[0] || null;
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<User | null> {
  const db = getDatabase();
  const result = await db.query<User>(
    `SELECT id, email, username, display_name, avatar_url, bio, is_verified,
            is_active, created_at, updated_at, last_login, settings
     FROM users
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Create session (refresh token)
 */
export async function createSession(data: {
  userId: string;
  refreshToken: string;
  deviceInfo?: Record<string, any>;
  ipAddress?: string;
  expiresAt: Date;
}): Promise<void> {
  const db = getDatabase();
  await db.query(
    `INSERT INTO sessions (user_id, refresh_token, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [data.userId, data.refreshToken, data.deviceInfo || {}, data.ipAddress, data.expiresAt]
  );
}

/**
 * Find session by refresh token
 */
export async function findSessionByToken(refreshToken: string): Promise<{
  id: string;
  userId: string;
  expiresAt: Date;
} | null> {
  const db = getDatabase();
  const result = await db.query(
    `SELECT id, user_id, expires_at
     FROM sessions
     WHERE refresh_token = $1 AND expires_at > NOW()`,
    [refreshToken]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    id: result.rows[0].id,
    userId: result.rows[0].user_id,
    expiresAt: result.rows[0].expires_at,
  };
}

/**
 * Update session last used
 */
export async function updateSessionLastUsed(sessionId: string): Promise<void> {
  const db = getDatabase();
  await db.query(
    `UPDATE sessions SET last_used_at = NOW() WHERE id = $1`,
    [sessionId]
  );
}

/**
 * Delete session
 */
export async function deleteSession(refreshToken: string): Promise<void> {
  const db = getDatabase();
  await db.query(
    `DELETE FROM sessions WHERE refresh_token = $1`,
    [refreshToken]
  );
}

/**
 * Delete all user sessions
 */
export async function deleteAllUserSessions(userId: string, excludeSessionId?: string): Promise<void> {
  const db = getDatabase();
  if (excludeSessionId) {
    await db.query(
      `DELETE FROM sessions WHERE user_id = $1 AND id != $2`,
      [userId, excludeSessionId]
    );
  } else {
    await db.query(
      `DELETE FROM sessions WHERE user_id = $1`,
      [userId]
    );
  }
}

/**
 * Update user last login
 */
export async function updateUserLastLogin(userId: string): Promise<void> {
  const db = getDatabase();
  await db.query(
    `UPDATE users SET last_login = NOW() WHERE id = $1`,
    [userId]
  );
}

/**
 * Check if email exists
 */
export async function emailExists(email: string): Promise<boolean> {
  const db = getDatabase();
  const result = await db.query(
    `SELECT 1 FROM users WHERE email = $1`,
    [email]
  );
  return result.rows.length > 0;
}

/**
 * Check if username exists
 */
export async function usernameExists(username: string): Promise<boolean> {
  const db = getDatabase();
  const result = await db.query(
    `SELECT 1 FROM users WHERE username = $1`,
    [username]
  );
  return result.rows.length > 0;
}

