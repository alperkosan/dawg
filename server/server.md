# 🏗️ DAWG Server Architecture & Status Report

> **Warning**: This document reflects the *actual* state of the codebase, which may differ from the initial design documents in `docs/backend/`. It serves as the source of truth for current implementation and known issues.

## 1. Technology Stack

*   **Runtime**: Node.js 18+
*   **Framework**: Fastify (Performance-focused)
*   **Language**: TypeScript
*   **Database**: PostgreSQL 14+ (using `pg` driver directly, native queries)
*   **Validation**: Zod (Schema validation)
*   **Authentication**: JWT (`@fastify/jwt`)
*   **Storage**: MinIO / S3 Compatible (BunnyCDN integration visible in code)

## 2. Directory Structure

```
server/src/
├── config/          # Environment & Constants
├── routes/          # API Route Definitions (Controller Layer)
├── services/        # Business Logic & DB Queries (Service Layer)
├── middleware/      # Auth & Error Handling
├── utils/           # Helper functions (Logger, Errors)
└── types/           # TypeScript Definitions
```

## 3. Current Architecture Implementation

### A. Database Schema (PostgreSQL)
The application relies heavily on `JSONB` columns for flexibility, storing complex audio engine states.

*   `users`: Core identity.
*   `projects`:
    *   Stores `project_data` as a massive `JSONB` column containing the entire state of Frontend Stores (Arrangement, Mixer, Instruments).
    *   Uses `user_id` for ownership.
*   `project_assets`: Handles external audio files linked to projects.
*   `sessions`: Refresh tokens for JWT rotation.
*   `project_shares`: Sharing capabilities.

### B. Authentication Flow
1.  **Login**: Returns `accessToken` (Short-lived) and sets `refreshToken` (Long-lived, DB persisted).
2.  **Protection**: `authenticate` middleware verifies JWT.
3.  **Context**: Attaches user payload to `request.user`.

### C. API Pattern
*   **Routes**: Define endpoints and request schemas (Zod). Call services.
*   **Services**: Handle business logic and execute raw SQL queries.
    *   *Note:* No ORM is used. Raw SQL with parameterized queries is the standard.

## 4. 🚨 IDENTIFIED CRACKS & VULNERABILITIES (Analysis)

This section highlights discrepancies between design and implementation, and potential security risks found during analysis.

### ✅ RESOLVED: Insecure List Filter Defaults
**Status**: Fixed
**Issue**: Listing endpoints (e.g., `listProjects`) relied on *client-provided* query parameters to filter data.
**Fix Implemented**: The `GET /projects` route now enforces `isPublic=true` for any cross-user queries and defaults to the authenticated user's ID if no filter provided.
**Location**: `server/src/routes/projects.ts`.

### 🟠 Medium: Lack of Automated Authorization Checks
**Issue**: Authorization logic (e.g., `canAccessProject`) exists but is manually invoked in services.
**Risk**: It is easy for a developer to creating a new endpoint and forget to call `canAccessProject`, exposing private data.
**Remediation**: Implement a higher-order function or middleware factory (e.g., `requireProjectAccess(mode: 'read'|'write')`) to wrap route handlers.

### 🟠 Medium: Database cleanup on logical deletion
**Issue**: Projects use `deleted_at` (soft delete).
**Risk**: Related assets (large audio files in S3/MinIO) might not be cleaned up immediately or strictly, leading to "Zombie Assets" increasing storage costs.
**Implementation Check**: `deleteProject` service marks DB usage but needs to ensure storage cleanup trigger is reliable.

### 🟡 Low: JSONB Schema Versioning
**Issue**: The `project_data` JSONB column has no strict schema enforcement in the DB.
**Risk**: If the Frontend Store structure changes (e.g., swapping `useArrangementStore` from V1 to V2), older projects might break upon loading without a migration strategy for the JSON content.

## 5. Security Best Practices (Current vs Missing)

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **HTTPS** | ✅ | Enforced in Prod |
| **JWT Auth** | ✅ | Implemented |
| **Input Validation** | ✅ | Zod is used extensively |
| **SQL Injection** | ✅ | Parameterized queries used |
| **Rate Limiting** | ❓ | Not explicitly seen in core files |
| **Object Level Access** | ❌ | **MISSING** default scope in list endpoints |
| **Data Isolation** | ⚠️ | Relies on correct query params rather than Row Level Security (RLS) or forced service scopes |

## 6. Development Guidelines for Server

1.  **Always scope queries by User**: Never write a `SELECT` for personal resources without `WHERE user_id = $1`.
2.  **Validate Permission Early**: Check `canAccessProject` at the top of any project-specific service.
3.  **Raw SQL**: Use parameterized queries (`$1`, `$2`). Do not concatenate strings.
4.  **Error Handling**: Throw custom errors from `utils/errors.js` (`NotFoundError`, `ForbiddenError`) to ensure correct HTTP status codes.

---
*Last Updated: 2025-12-20*
