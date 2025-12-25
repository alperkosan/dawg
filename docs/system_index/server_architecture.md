# Server Architecture Report

> 📚 [← Back to System Index](./index.md) | [← Documentation Hub](../README.md)

This report documents the backend services, API structure, and deployment strategies for the DAWG platform.

---

## ⚡ Performance Considerations

| Component | Function | Cost | Notes |
|:---|:---|:---|:---|
| `database.ts` | `testConnection()` | ~5s cold start | Neon connection pooling helps |
| `assets.ts` | `upload` route | I/O bound | Streams to Bunny CDN |
| `projects.ts` | `PUT /projects/:id` | Database write | Uses optimistic locking |

---

## ⚙️ Backend Core (Fastify)

DAWG uses **Fastify** as its primary web framework due to its low overhead and specialized support for high-throughput applications.

### 🏗️ Directory Structure
- **`/src/routes`**: API endpoint definitions (Projects, Assets, Auth).
- **`/src/services`**: Business logic layer (Database interactions, Cloud storage).
- **`/src/plugins`**: Fastify plugins for CORS, Multipart handling, and Authentication.

---

## 🗄️ Persistence & Data Model

- **Primary Database**: PostgreSQL (hosted on Neon with connection pooling).
- **Migration System**: Custom migration runner in `migrate.ts`.
- **Connection**: Managed via `pg` driver with Neon optimizations.

### 🏛️ Key Entities
1.  **Users**: Authentication and profile data.
2.  **Projects**: Metadata, structure, and sharing settings for DAW projects.
3.  **Assets**: Audio samples, IR files (Reverb), and user-uploaded content.

---

## ☁️ Deployment & Infrastructure

### ⚡ Vercel Serverless
The backend is optimized for **Vercel Serverless Functions**.
- **Entry Point**: `/api/index.ts` wraps the Fastify server.
- **Cold Boot Handling**: The global `serverInstance` is cached across invocations.
- **Multipart Support**: Custom handling (using `formidable`) for file uploads.

### 📦 Asset Storage (Bunny CDN)
Audio files and large blobs are stored off-server.
- **Bunny CDN**: High-speed edge distribution.
- **Storage Service**: `server/src/services/storage.ts`.

---

## 🔌 Key API Endpoints

| Method | Path | Description | Service |
|:---|:---|:---|:---|
| `GET` | `/projects` | List user projects | `projects.ts` |
| `GET` | `/projects/:id` | Fetch project state | `projects.ts` |
| `PUT` | `/projects/:id` | Save project state | `projects.ts` |
| `POST` | `/assets/upload` | Upload audio file | `assets.ts` |
| `GET` | `/system-assets` | List system samples | `systemAssets.ts` |

---

**Last Updated:** 2025-12-25
