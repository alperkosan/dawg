# Environment Variables Documentation

## Vercel Production Environment Variables

### 🔴 CRITICAL (Required for Production)

#### Database
- **`DATABASE_URL`** (Required)
  - Neon PostgreSQL connection string
  - Format: `postgresql://user:password@host-pooler.region.aws.neon.tech/database?sslmode=require`
  - ✅ **MUST use pooler endpoint** (`-pooler` in hostname) for serverless
  - Alternative: `NEON_DATABASE_URL` (fallback)

#### Authentication & Security
- **`JWT_SECRET`** (Required)
  - Secret key for JWT token signing
  - ⚠️ **MUST be a strong random string** (min 32 characters)
  - Default: `'change-this-secret'` (⚠️ NOT SECURE for production)

- **`COOKIE_SECRET`** (Required)
  - Secret key for cookie signing
  - ⚠️ **MUST be a strong random string** (min 32 characters)
  - Default: `'change-this-secret'` (⚠️ NOT SECURE for production)

### 🟡 IMPORTANT (Recommended for Production)

#### JWT Configuration
- **`JWT_EXPIRES_IN`** (Optional)
  - JWT token expiration time
  - Default: `'15m'` (15 minutes)
  - Format: `'15m'`, `'1h'`, `'7d'`, etc.

- **`REFRESH_TOKEN_EXPIRES_IN`** (Optional)
  - Refresh token expiration time
  - Default: `'7d'` (7 days)

#### CORS
- **`CORS_ORIGIN`** (Optional)
  - Comma-separated list of allowed origins
  - Example: `https://yourdomain.com,https://www.yourdomain.com`
  - Default: Auto-detects Vercel URLs + localhost

#### Client URL
- **`CLIENT_URL`** (Optional)
  - Frontend application URL
  - Default: Auto-detects from `VERCEL_URL`
  - Example: `https://yourdomain.com`

### 🟢 OPTIONAL (Feature-specific)

#### Database Pool Configuration
- **`DB_POOL_MIN`** (Optional)
  - Minimum database connections
  - Default: `0` (serverless-optimized)
  - Recommended: `0` for Neon/Vercel

- **`DB_POOL_MAX`** (Optional)
  - Maximum database connections
  - Default: `5` (Neon free tier limit)
  - ⚠️ Neon free tier: max 5 connections
  - Neon Pro: can increase to 10-20

#### Storage (MinIO/S3)
- **`STORAGE_PROVIDER`** (Optional)
  - Storage provider: `'minio'` | `'s3'` | `'local'`
  - Default: `'minio'`

- **`STORAGE_ENDPOINT`** (Optional)
  - Storage endpoint URL
  - Default: `'localhost:9000'`

- **`STORAGE_ACCESS_KEY`** (Optional)
  - Storage access key
  - Default: `'minioadmin'`

- **`STORAGE_SECRET_KEY`** (Optional)
  - Storage secret key
  - Default: `'minioadmin'`

- **`STORAGE_BUCKET`** (Optional)
  - Storage bucket name
  - Default: `'dawg-audio'`

- **`STORAGE_REGION`** (Optional)
  - Storage region
  - Default: `'us-east-1'`

- **`STORAGE_USE_SSL`** (Optional)
  - Use SSL for storage
  - Default: `false`
  - Set to `'true'` for production

#### CDN (Bunny CDN)
- **`CDN_PROVIDER`** (Optional)
  - CDN provider: `'bunny'` | `'local'`
  - Default: `'bunny'`

- **`CDN_BASE_URL`** (Optional)
  - CDN base URL
  - Default: `'https://dawg.b-cdn.net'`

- **`BUNNY_PULL_ZONE_URL`** (Optional)
  - Bunny CDN pull zone URL
  - Default: `'https://dawg.b-cdn.net'`

- **`BUNNY_STORAGE_ZONE_NAME`** (Optional)
  - Bunny storage zone name
  - Default: `'dawg-storage'`

- **`BUNNY_STORAGE_ZONE_REGION`** (Optional)
  - Bunny storage zone region
  - Default: `'de'`
  - Options: `'de'`, `'ny'`, `'la'`, `'sg'`, etc.

- **`BUNNY_API_KEY`** (Optional)
  - Bunny CDN API key
  - ⚠️ **Contains hardcoded value in config** - should be moved to env

- **`BUNNY_STORAGE_API_KEY`** (Optional)
  - Bunny storage API key
  - ⚠️ **Contains hardcoded value in config** - should be moved to env

#### Redis (Optional)
- **`REDIS_URL`** (Optional)
  - Redis connection URL
  - Format: `redis://user:password@host:port`
  - Not required if not using Redis

#### Rate Limiting
- **`RATE_LIMIT_MAX`** (Optional)
  - Maximum requests per time window
  - Default: `100`

- **`RATE_LIMIT_TIME_WINDOW`** (Optional)
  - Time window in milliseconds
  - Default: `60000` (1 minute)

#### Logging
- **`LOG_LEVEL`** (Optional)
  - Log level: `'error'` | `'warn'` | `'info'` | `'debug'`
  - Default: `'info'`

#### Server Configuration
- **`NODE_ENV`** (Auto-set by Vercel)
  - Environment: `'development'` | `'production'`
  - Vercel automatically sets this

- **`PORT`** (Optional)
  - Server port
  - Default: `3000`
  - ⚠️ Not used in Vercel (serverless)

- **`HOST`** (Optional)
  - Server host
  - Default: `'0.0.0.0'`
  - ⚠️ Not used in Vercel (serverless)

### 🔵 Vercel Auto-Set Variables

These are automatically set by Vercel (don't set manually):

- **`VERCEL`** - Set to `'1'` when running on Vercel
- **`VERCEL_URL`** - Current deployment URL (e.g., `dawg-xxx.vercel.app`)
- **`VERCEL_ENV`** - Environment: `'production'` | `'preview'` | `'development'`

---

## Client-Side Environment Variables (Vite)

### Required
- **`VITE_API_URL`** (Optional)
  - Backend API URL
  - Default: Auto-detects from current origin
  - Example: `https://yourdomain.com/api`

### Optional
- **`VITE_APP_VERSION`** (Optional)
  - Application version
  - Default: `'0.0.0'`

---

## Security Checklist for Vercel

### ✅ Must Set in Vercel Dashboard

1. **`DATABASE_URL`** - Neon connection string (with pooler)
2. **`JWT_SECRET`** - Strong random string (32+ chars)
3. **`COOKIE_SECRET`** - Strong random string (32+ chars)
4. **`BUNNY_API_KEY`** - Move from hardcoded value
5. **`BUNNY_STORAGE_API_KEY`** - Move from hardcoded value

### ⚠️ Security Issues Found

1. **Hardcoded Secrets in Config**
   - `BUNNY_API_KEY` has hardcoded value in `server/src/config/index.ts:72`
   - `BUNNY_STORAGE_API_KEY` has hardcoded value in `server/src/config/index.ts:73`
   - **Action Required**: Remove hardcoded values, require env vars

2. **Weak Default Secrets**
   - `JWT_SECRET` default: `'change-this-secret'`
   - `COOKIE_SECRET` default: `'change-this-secret'`
   - **Action Required**: Ensure production uses strong secrets

---

## How to Set Environment Variables in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable for:
   - **Production** (required)
   - **Preview** (optional, for testing)
   - **Development** (optional, for local dev)

3. After adding variables, **redeploy** your project:
   ```bash
   vercel --prod
   ```

---

## Testing Environment Variables

### Check if variables are set:
```bash
# In Vercel function logs
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
```

### Local testing:
```bash
# Create .env file in project root
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-here
COOKIE_SECRET=your-secret-here
```

---

## Recommended Production Values

```env
# Database
DATABASE_URL=postgresql://user:pass@host-pooler.region.aws.neon.tech/db?sslmode=require
DB_POOL_MIN=0
DB_POOL_MAX=5

# Security
JWT_SECRET=<generate-strong-random-32-chars>
COOKIE_SECRET=<generate-strong-random-32-chars>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# CDN
CDN_PROVIDER=bunny
CDN_BASE_URL=https://dawg.b-cdn.net
BUNNY_API_KEY=<your-bunny-api-key>
BUNNY_STORAGE_API_KEY=<your-bunny-storage-api-key>

# CORS (if custom domain)
CORS_ORIGIN=https://yourdomain.com

# Client
CLIENT_URL=https://yourdomain.com
```

---

## Generate Strong Secrets

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate COOKIE_SECRET
openssl rand -base64 32
```

