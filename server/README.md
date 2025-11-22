# 🏗️ DAWG Backend Server

Fastify-based backend server for DAW collaboration platform.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for caching)
- MinIO or S3-compatible storage (optional, for file storage)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
```

### Development

```bash
# Start development server
npm run dev

# Server will run on http://localhost:3000
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

## 📁 Project Structure

```
server/
├── src/
│   ├── config/          # Configuration
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── middleware/       # Middleware
│   ├── utils/            # Utilities
│   ├── types/            # TypeScript types
│   └── index.ts          # Entry point
├── migrations/           # Database migrations
├── tests/                # Tests
└── package.json
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Users
- `GET /api/users/:id` - Get user
- `PUT /api/users/me` - Update current user

## 🔧 Configuration

See `.env.example` for all configuration options.

Key settings:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret
- `STORAGE_PROVIDER` - Storage provider (minio, s3, r2)
- `CORS_ORIGIN` - Allowed CORS origins

## 📚 Documentation

Full backend architecture documentation is in `/docs/backend/`:
- [Backend Architecture Design](../../docs/backend/BACKEND_ARCHITECTURE_DESIGN.md)
- [User Management Design](../../docs/backend/USER_MANAGEMENT_DESIGN.md)
- [File Storage Design](../../docs/backend/FILE_STORAGE_DESIGN.md)
- [Sharing System Design](../../docs/backend/SHARING_SYSTEM_DESIGN.md)
- [Collaboration Design](../../docs/backend/COLLABORATION_DESIGN.md)

## 🧪 Testing

```bash
npm test
```

## 📝 TODO

- [ ] Database setup and migrations
- [ ] Authentication implementation
- [ ] Project CRUD implementation
- [ ] File upload (presigned URLs)
- [ ] WebSocket for real-time collaboration
- [ ] Redis caching
- [ ] Background job queue

## 📄 License

MIT

