# 🏗️ DAWG Backend Server

> 📚 [← Back to Documentation Hub](../docs/README.md)

Fastify-based backend server for the DAW collaboration platform.

---

## ⚡ Quick Start

```bash
cd server
npm install
npm run migrate
npm run dev
# Server runs at http://localhost:3000
```

---

## 📋 Prerequisites

| Requirement | Version | Notes |
|:---|:---|:---|
| **Node.js** | 18+ | Runtime environment |
| **PostgreSQL** | 14+ | Database (local or Neon) |
| **npm** | 8+ | Package manager |

---

## 🗄️ Database Setup

### Option 1: Neon (Cloud - Recommended for Production)

1.  Create a project at [console.neon.tech](https://console.neon.tech).
2.  Copy the **Pooler Connection String** (ends with `-pooler`).
3.  Set `DATABASE_URL` in your `.env` file.

```bash
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

### Option 2: Local PostgreSQL (Development)

**macOS (Postgres.app):**
```bash
# Download from https://postgresapp.com
# Open app → Initialize
/Applications/Postgres.app/Contents/Versions/latest/bin/createdb dawg
```

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
createdb dawg
```

**Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb dawg
```

### Run Migrations
```bash
cd server
npm run migrate
```

---

## 🔧 Environment Variables

Create a `.env` file (or copy from `.env.example`):

```env
# Database
DATABASE_URL=postgresql://localhost:5432/dawg

# Server
PORT=3000
NODE_ENV=development

# Auth
JWT_SECRET=your-secret-key

# CORS
CORS_ORIGIN=http://localhost:5173

# Storage (Bunny CDN)
BUNNY_STORAGE_URL=https://storage.bunnycdn.com/your-zone
BUNNY_API_KEY=your-api-key
```

---

## 📁 Project Structure

```
server/
├── src/
│   ├── index.ts          # Entry point
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic (database, storage)
│   ├── middleware/       # Auth, validation
│   ├── utils/            # Helpers
│   └── types/            # TypeScript types
├── migrations/           # SQL migrations
├── api/                  # Vercel serverless entry
└── scripts/              # Utility scripts
```

---

## 🔌 API Endpoints

### Authentication
| Method | Path | Description |
|:---|:---|:---|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/auth/me` | Get current user |

### Projects
| Method | Path | Description |
|:---|:---|:---|
| `GET` | `/api/projects` | List user projects |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/:id` | Get project |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Delete project |

### Assets
| Method | Path | Description |
|:---|:---|:---|
| `POST` | `/api/assets/upload` | Upload audio file |
| `GET` | `/api/system-assets` | List system samples |

---

## ⚡ Performance Notes

| Component | Cost | Notes |
|:---|:---|:---|
| `database.ts: testConnection()` | ~5s cold start | Use connection pooling (Neon) |
| `assets.ts: upload` | I/O bound | Streams directly to Bunny CDN |
| `projects.ts: PUT` | DB write | Uses optimistic locking |

---

## 🧪 Testing

```bash
npm test
```

---

## � Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
brew services list  # macOS
sudo systemctl status postgresql  # Linux

# Test connection
psql -d dawg -c "SELECT version();"
```

### Port Already in Use
Change `PORT` in `.env` and update `CORS_ORIGIN`.

---

## 📚 Related Documentation

- [Database Schema](../docs/system_index/server/02_database_schema.md)
- [Bunny CDN Setup](./BUNNY_CDN_SETUP.md)

---

**Last Updated:** 2025-12-25
