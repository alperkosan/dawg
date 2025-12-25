# Database Schema & API Reference

This document maps the PostgreSQL schema and the corresponding API endpoints managed by Fastify.

## 🗄️ Database Schema (PostgreSQL/Neon)

### `users`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, Default: `gen_random_uuid()` | Unique User ID |
| `email` | TEXT | UNIQUE, NOT NULL | User login email |
| `password_hash` | TEXT | NOT NULL | Argon2 hash |
| `created_at` | TIMESTAMPTZ | Default: `NOW()` | Registration time |

### `projects`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Project ID |
| `owner_id` | UUID | FK -> `users.id` | Project owner |
| `name` | TEXT | NOT NULL | Project title |
| `data` | JSONB | Default: `{}` | **The DAW State** (Tracks, Notes, Patterns) |
| `is_public` | BOOLEAN | Default: `false` | Visibility flag |
| `version` | INTEGER | Default: 1 | Optimistic locking version |

### `assets`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Asset ID |
| `user_id` | UUID | FK -> `users.id` | Uploader |
| `url` | TEXT | NOT NULL | Bunny CDN URL |
| `mime_type` | TEXT | NOT NULL | e.g. `audio/wav` |
| `metadata` | JSONB | | Audio analysis data (bpm, key) |

## 🔌 API Endpoints (`/api`)

### Projects
- **`GET /projects`**: List user's projects (Pagination: `limit`, `offset`).
- **`GET /projects/:id`**: Fetch full project state (`JSONB`).
- **`POST /projects`**: Create new project.
    - Body: `{ name: string, template?: string }`
- **`PUT /projects/:id`**: Save project state.
    - Body: `{ data: ProjectState, version: number }`
    - **Note**: Triggers automatic version increment.

### Assets
- **`POST /assets/upload`**: Multipart upload.
    - **Limit**: 10MB (Client-side check required).
    - **Flow**: Upload -> Validate -> Stream to Bunny CDN -> Insert DB Record.

## 🔄 Migration Workflow
Migrations are stored in `/server/migrations`.
1.  **Create**: `npm run migrate:create -- <name>`
2.  **Run**: `npm run migrate` (Runs on server cold-start in Vercel)
