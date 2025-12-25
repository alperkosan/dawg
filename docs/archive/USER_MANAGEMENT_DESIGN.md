# 👤 DAWG User Management & Authentication Design

**Date:** 2025-01-XX  
**Version:** 1.0.0  
**Status:** 📋 Design Phase  
**Purpose:** Kullanıcı yönetimi ve authentication sistemi tasarımı

---

## 📋 Overview

DAWG için güvenli, scalable ve kullanıcı dostu bir authentication ve user management sistemi. JWT tabanlı stateless authentication ile refresh token rotation desteği.

---

## 🔐 Authentication Strategy

### JWT + Refresh Token Pattern

```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Backend   │
└──────┬──────┘                    └──────┬──────┘
       │                                   │
       │ 1. POST /api/auth/login           │
       │    { email, password }            │
       ├──────────────────────────────────>│
       │                                   │
       │ 2. Verify credentials             │
       │    Generate JWT + Refresh Token   │
       │                                   │
       │ 3. Response                       │
       │    {                              │
       │      accessToken: "jwt...",       │
       │      refreshToken: "uuid...",    │
       │      expiresIn: 900               │
       │    }                              │
       │<──────────────────────────────────┤
       │                                   │
       │ 4. Store tokens                   │
       │    - accessToken: memory          │
       │    - refreshToken: httpOnly cookie│
       │                                   │
       │ 5. API Requests                   │
       │    Authorization: Bearer <token> │
       ├──────────────────────────────────>│
       │                                   │
       │ 6. Validate JWT                   │
       │    Return data                    │
       │<──────────────────────────────────┤
       │                                   │
       │ 7. Token expired?                 │
       │    POST /api/auth/refresh         │
       │    Cookie: refreshToken=...       │
       ├──────────────────────────────────>│
       │                                   │
       │ 8. Validate refresh token         │
       │    Generate new tokens            │
       │    Rotate refresh token           │
       │                                   │
       │ 9. New tokens                     │
       │<──────────────────────────────────┤
```

### Token Structure

#### Access Token (JWT)

```typescript
interface AccessTokenPayload {
  userId: string; // UUID
  email: string;
  username: string;
  iat: number; // Issued at
  exp: number; // Expiration (15 minutes)
  type: 'access';
}
```

**Properties:**
- **Expiration:** 15 minutes
- **Storage:** Memory (client-side) or localStorage (less secure)
- **Usage:** Every API request
- **Revocation:** Not possible (short-lived, rely on expiration)

#### Refresh Token

```typescript
interface RefreshToken {
  id: string; // UUID
  userId: string; // UUID
  token: string; // Random UUID
  deviceInfo: {
    userAgent: string;
    ipAddress: string;
    deviceType: string;
  };
  expiresAt: Date; // 7 days
  createdAt: Date;
  lastUsedAt: Date;
}
```

**Properties:**
- **Expiration:** 7 days
- **Storage:** HTTP-only cookie (secure, not accessible via JavaScript)
- **Usage:** Only for token refresh
- **Revocation:** Yes (stored in database, can be invalidated)

---

## 🔒 Security Measures

### 1. Password Hashing

```typescript
import bcrypt from 'bcrypt';

// Hash password
const saltRounds = 12;
const passwordHash = await bcrypt.hash(password, saltRounds);

// Verify password
const isValid = await bcrypt.compare(password, passwordHash);
```

**Best Practices:**
- Use bcrypt with 12+ salt rounds
- Never store plain text passwords
- Use constant-time comparison

### 2. JWT Signing

```typescript
import jwt from 'jsonwebtoken';

const accessToken = jwt.sign(
  { userId, email, username, type: 'access' },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);
```

**Best Practices:**
- Use strong secret (32+ characters, random)
- Store secret in environment variables
- Use RS256 for production (asymmetric keys)

### 3. Refresh Token Rotation

```typescript
// When refreshing token:
// 1. Validate old refresh token
// 2. Generate new access token
// 3. Generate new refresh token
// 4. Invalidate old refresh token
// 5. Store new refresh token
// 6. Return new tokens
```

**Benefits:**
- Prevents token reuse attacks
- Detects token theft (if old token is used, revoke all)
- Limits damage window

### 4. Rate Limiting

```typescript
// Login attempts: 5 per 15 minutes per IP
// Token refresh: 10 per hour per token
// Password reset: 3 per hour per email
```

### 5. CSRF Protection

```typescript
// For state-changing operations:
// 1. Generate CSRF token on login
// 2. Store in httpOnly cookie
// 3. Include in request header
// 4. Validate on server
```

### 6. Input Validation

```typescript
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  displayName: z.string().min(1).max(100).optional(),
});
```

---

## 📊 Database Schema

### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  settings JSONB DEFAULT '{}'::jsonb,
  -- Settings: { theme, notifications, privacy, etc. }
  
  -- Indexes
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_username_unique UNIQUE (username)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

### Sessions Table (Refresh Tokens)

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(255) UNIQUE NOT NULL,
  device_info JSONB,
  -- { userAgent, ipAddress, deviceType, os, browser }
  ip_address INET,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  
  -- Indexes
  CONSTRAINT sessions_refresh_token_unique UNIQUE (refresh_token)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_active ON sessions(user_id, revoked_at) 
  WHERE revoked_at IS NULL;
```

### Password Reset Tokens

```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
```

---

## 🔌 API Endpoints

### Authentication

#### POST /api/auth/register

```typescript
// Request
{
  email: string;
  username: string;
  password: string;
  displayName?: string;
}

// Response (201)
{
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}
```

#### POST /api/auth/login

```typescript
// Request
{
  email: string; // or username
  password: string;
}

// Response (200)
{
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
  };
  accessToken: string;
  refreshToken: string; // Set as httpOnly cookie
  expiresIn: number;
}
```

#### POST /api/auth/refresh

```typescript
// Request
// Cookie: refreshToken=<token>
// No body needed

// Response (200)
{
  accessToken: string;
  refreshToken: string; // New token (rotated)
  expiresIn: number;
}
```

#### POST /api/auth/logout

```typescript
// Request
// Authorization: Bearer <accessToken>
// Cookie: refreshToken=<token>

// Response (200)
{
  message: "Logged out successfully"
}
```

#### GET /api/auth/me

```typescript
// Request
// Authorization: Bearer <accessToken>

// Response (200)
{
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    bio: string;
    isVerified: boolean;
    createdAt: string;
    settings: object;
  }
}
```

### User Management

#### PUT /api/auth/me

```typescript
// Request
// Authorization: Bearer <accessToken>
{
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  settings?: object;
}

// Response (200)
{
  user: UserData;
}
```

#### PUT /api/auth/me/password

```typescript
// Request
// Authorization: Bearer <accessToken>
{
  currentPassword: string;
  newPassword: string;
}

// Response (200)
{
  message: "Password updated successfully"
}
```

#### POST /api/auth/forgot-password

```typescript
// Request
{
  email: string;
}

// Response (200)
{
  message: "Password reset email sent"
}
```

#### POST /api/auth/reset-password

```typescript
// Request
{
  token: string; // From email link
  newPassword: string;
}

// Response (200)
{
  message: "Password reset successfully"
}
```

#### GET /api/users/:id

```typescript
// Request
// Authorization: Bearer <accessToken> (optional for public profiles)

// Response (200)
{
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    bio: string;
    isVerified: boolean;
    createdAt: string;
    stats: {
      projectCount: number;
      followerCount: number;
      followingCount: number;
    }
  }
}
```

---

## 🛡️ Authorization (RBAC)

### Roles

```typescript
enum UserRole {
  USER = 'user',           // Regular user
  PREMIUM = 'premium',     // Premium user (future)
  MODERATOR = 'moderator', // Content moderator
  ADMIN = 'admin',         // System administrator
}
```

### Permissions

```typescript
interface Permissions {
  // Project permissions
  'project:create': boolean;
  'project:read': boolean;
  'project:update': boolean;
  'project:delete': boolean;
  'project:share': boolean;
  
  // User permissions
  'user:read': boolean;
  'user:update': boolean;
  'user:delete': boolean;
  
  // Admin permissions
  'admin:users': boolean;
  'admin:projects': boolean;
  'admin:system': boolean;
}
```

### Authorization Middleware

```typescript
// Check if user owns resource
function requireOwnership(userId: string, resourceUserId: string) {
  if (userId !== resourceUserId) {
    throw new ForbiddenError('You do not have permission to access this resource');
  }
}

// Check if user has permission
function requirePermission(user: User, permission: string) {
  if (!user.permissions.includes(permission)) {
    throw new ForbiddenError('Insufficient permissions');
  }
}

// Check if resource is public or user owns it
function requireAccess(userId: string | null, resource: Project) {
  if (resource.isPublic) return;
  if (resource.userId === userId) return;
  throw new ForbiddenError('Project is private');
}
```

---

## 🔄 Session Management

### Active Sessions

```typescript
// GET /api/auth/sessions
// List all active sessions for current user
{
  sessions: [
    {
      id: string;
      deviceInfo: {
        userAgent: string;
        deviceType: string;
        os: string;
        browser: string;
      };
      ipAddress: string;
      lastUsedAt: string;
      createdAt: string;
      isCurrent: boolean; // Current session
    }
  ]
}
```

### Revoke Session

```typescript
// DELETE /api/auth/sessions/:id
// Revoke a specific session
```

### Revoke All Sessions

```typescript
// DELETE /api/auth/sessions
// Revoke all sessions except current
```

---

## 📧 Email Verification

### Flow

```
1. User registers
2. Backend sends verification email
3. User clicks link: /verify-email?token=<token>
4. Backend verifies token
5. User is marked as verified
```

### Database

```sql
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🚨 Security Best Practices

1. **Password Requirements:**
   - Minimum 8 characters
   - At least one uppercase, lowercase, and number
   - Common passwords blacklist
   - Password strength meter

2. **Rate Limiting:**
   - Login: 5 attempts per 15 minutes per IP
   - Registration: 3 per hour per IP
   - Password reset: 3 per hour per email
   - Token refresh: 10 per hour per token

3. **Token Security:**
   - Short-lived access tokens (15 min)
   - Long-lived refresh tokens (7 days)
   - Refresh token rotation
   - HTTP-only cookies for refresh tokens
   - Secure flag (HTTPS only)
   - SameSite attribute (CSRF protection)

4. **Input Validation:**
   - All inputs validated with Zod
   - SQL injection prevention (parameterized queries)
   - XSS prevention (sanitize user input)
   - Email format validation

5. **Monitoring:**
   - Log failed login attempts
   - Alert on suspicious activity
   - Track token usage patterns
   - Monitor session anomalies

---

## 📝 Implementation Example

### Fastify Plugin

```typescript
// plugins/auth.ts
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // JWT plugin
  await fastify.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET,
  });

  // Cookie plugin
  await fastify.register(require('@fastify/cookie'), {
    secret: process.env.COOKIE_SECRET,
  });

  // Auth decorator
  fastify.decorate('authenticate', async (request, reply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new Error('No token provided');
      }

      const decoded = fastify.jwt.verify(token);
      request.user = decoded;
    } catch (error) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
};

export default fp(authPlugin);
```

### Login Route

```typescript
// routes/auth/login.ts
import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function loginRoute(fastify: FastifyInstance) {
  fastify.post('/auth/login', async (request, reply) => {
    // Validate input
    const { email, password } = LoginSchema.parse(request.body);

    // Find user
    const user = await fastify.db.users.findOne({ email });
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = fastify.jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      { expiresIn: '15m' }
    );

    const refreshToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store refresh token
    await fastify.db.sessions.insert({
      userId: user.id,
      refreshToken,
      deviceInfo: {
        userAgent: request.headers['user-agent'],
        ipAddress: request.ip,
      },
      expiresAt,
    });

    // Set refresh token cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/api/auth',
    });

    // Update last login
    await fastify.db.users.update(user.id, { lastLogin: new Date() });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
      accessToken,
      expiresIn: 900, // 15 minutes
    };
  });
}
```

---

**Son Güncelleme:** 2025-01-XX  
**Hazırlayan:** AI Assistant  
**Durum:** 📋 Design Complete

