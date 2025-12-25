# 🏗️ DAWG Backend Architecture Documentation

**Date:** 2025-01-XX  
**Version:** 1.0.0  
**Status:** 📋 Design Complete

---

## 📚 Dokümantasyon İndeksi

Bu klasör, DAWG projesi için backend sistem tasarımını içerir. Tüm dokümantasyonlar implementation-ready durumdadır.

### 1. [Backend Architecture Design](./BACKEND_ARCHITECTURE_DESIGN.md)
**Genel mimari tasarım ve teknoloji seçimleri**

- ✅ Teknoloji stack analizi (Fastify, PostgreSQL, MinIO/R2, Redis)
- ✅ High-level architecture diagram
- ✅ Veritabanı şeması (Users, Projects, Assets, Shares, Interactions)
- ✅ RESTful API endpoint tasarımı
- ✅ Güvenlik önlemleri
- ✅ Deployment stratejisi

**Önerilen Stack:**
- Backend: Node.js + Fastify
- Database: PostgreSQL (JSONB)
- Storage: MinIO (self-hosted) veya Cloudflare R2
- Cache: Redis
- Auth: JWT + Refresh Tokens

---

### 2. [Project Serialization Design](./PROJECT_SERIALIZATION_DESIGN.md)
**Proje verilerinin serialize/deserialize edilmesi**

- ✅ Store consolidation (tüm Zustand store'ları tek JSON formatına)
- ✅ Project data schema (TypeScript interfaces)
- ✅ Serialization/deserialization implementation
- ✅ Asset reference resolution
- ✅ Version migration support
- ✅ Compression (gzip)

**Key Features:**
- Tüm proje state'ini tek bir JSON objesine serialize
- Audio asset referansları (URL'ler, asset ID'ler)
- Version migration desteği
- Schema validation (Zod)

---

### 3. [User Management & Authentication Design](./USER_MANAGEMENT_DESIGN.md)
**Kullanıcı yönetimi ve authentication sistemi**

- ✅ JWT + Refresh Token pattern
- ✅ Password hashing (bcrypt)
- ✅ Session management
- ✅ Email verification
- ✅ Password reset flow
- ✅ RBAC (Role-Based Access Control)
- ✅ Security best practices

**Security Features:**
- Short-lived access tokens (15 min)
- Long-lived refresh tokens (7 days)
- Refresh token rotation
- HTTP-only cookies
- CSRF protection
- Rate limiting

---

### 4. [File Storage Design](./FILE_STORAGE_DESIGN.md)
**Ses dosyası depolama ve yönetim stratejisi**

- ✅ Presigned URL upload (direct S3)
- ✅ Resumable uploads (multipart)
- ✅ Background processing (metadata, thumbnails, transcoding)
- ✅ CDN entegrasyonu
- ✅ Storage optimization
- ✅ Access control

**Key Features:**
- Direct S3 upload (server bypass)
- Multipart upload (büyük dosyalar için)
- Automatic metadata extraction
- Waveform thumbnail generation
- Format transcoding (WAV → MP3)
- CDN caching

---

### 5. [Sharing System Design](./SHARING_SYSTEM_DESIGN.md)
**Proje paylaşımı, remix ve etkileşim sistemi**

- ✅ Paylaşım tipleri (public, unlisted, private)
- ✅ Paylaşım izinleri (view, remix, edit)
- ✅ Etkileşimler (like, comment, play, remix)
- ✅ Remix flow ve attribution
- ✅ Search & discovery
- ✅ Privacy & security

**Key Features:**
- Share token system
- Remix with attribution
- Comment system (nested replies)
- Trending algorithm
- Password-protected shares
- Analytics

---

## 🚀 Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Fastify setup
- [ ] PostgreSQL schema migration
- [ ] Authentication system (JWT + Refresh Tokens)
- [ ] Basic project CRUD API
- [ ] Project serialization/deserialization

### Phase 2: File Management (Week 3-4)
- [ ] MinIO/S3 setup
- [ ] Presigned URL upload
- [ ] Asset management API
- [ ] Background job queue (Bull/BullMQ)
- [ ] Metadata extraction
- [ ] Thumbnail generation
- [ ] CDN integration

### Phase 3: Sharing & Social (Week 5-6)
- [ ] Share system (tokens, permissions)
- [ ] Interactions API (likes, comments)
- [ ] Remix functionality
- [ ] Search & discovery
- [ ] Public feed
- [ ] Trending algorithm

### Phase 4: Optimization & Polish (Week 7-8)
- [ ] Caching layer (Redis)
- [ ] Performance tuning
- [ ] Monitoring & analytics
- [ ] Error handling improvements
- [ ] Documentation
- [ ] Testing

---

## 📊 Database Schema Overview

### Core Tables

```
users
├── id (UUID)
├── email (VARCHAR)
├── username (VARCHAR)
├── password_hash (VARCHAR)
└── settings (JSONB)

projects
├── id (UUID)
├── user_id (UUID → users)
├── title (VARCHAR)
├── project_data (JSONB) ← Tüm proje state'i
├── is_public (BOOLEAN)
└── share_token (VARCHAR)

project_assets
├── id (UUID)
├── project_id (UUID → projects)
├── user_id (UUID → users)
├── storage_key (TEXT) ← S3/MinIO key
├── storage_url (TEXT) ← CDN URL
└── metadata (JSONB)

project_shares
├── id (UUID)
├── project_id (UUID → projects)
├── share_token (VARCHAR)
├── access_level (VARCHAR)
└── is_public (BOOLEAN)

project_interactions
├── id (UUID)
├── project_id (UUID → projects)
├── user_id (UUID → users)
├── interaction_type (VARCHAR) ← 'like', 'comment', 'remix', 'play'
└── data (JSONB)

sessions
├── id (UUID)
├── user_id (UUID → users)
├── refresh_token (VARCHAR)
└── expires_at (TIMESTAMP)
```

---

## 🔌 API Endpoints Summary

### Authentication
- `POST /api/auth/register` - Kullanıcı kaydı
- `POST /api/auth/login` - Giriş
- `POST /api/auth/refresh` - Token yenileme
- `POST /api/auth/logout` - Çıkış
- `GET /api/auth/me` - Kullanıcı bilgisi

### Projects
- `GET /api/projects` - Proje listesi
- `POST /api/projects` - Yeni proje
- `GET /api/projects/:id` - Proje detayı
- `PUT /api/projects/:id` - Proje güncelleme
- `DELETE /api/projects/:id` - Proje silme
- `POST /api/projects/:id/duplicate` - Proje klonlama

### Assets
- `POST /api/assets/upload` - Upload request (presigned URL)
- `GET /api/assets/:id` - Asset detayı
- `DELETE /api/assets/:id` - Asset silme
- `GET /api/projects/:id/assets` - Proje asset'leri

### Shares
- `POST /api/projects/:id/shares` - Paylaşım oluştur
- `GET /api/shares/:token` - Paylaşım detayı (public)
- `PUT /api/shares/:token` - Paylaşım güncelleme
- `DELETE /api/shares/:token` - Paylaşım silme

### Interactions
- `POST /api/projects/:id/like` - Like/unlike
- `POST /api/projects/:id/comments` - Yorum ekle
- `GET /api/projects/:id/comments` - Yorum listesi
- `POST /api/projects/:id/remix` - Remix oluştur

---

## 🔒 Security Checklist

- [x] JWT with short expiration (15 min)
- [x] Refresh token rotation
- [x] HTTP-only cookies
- [x] CSRF protection
- [x] Rate limiting
- [x] Input validation (Zod)
- [x] SQL injection prevention
- [x] XSS prevention
- [x] Password hashing (bcrypt)
- [x] Presigned URL expiration
- [x] Access control (RBAC)
- [x] File type validation
- [x] File size limits

---

## 📈 Performance Optimizations

- **Database:**
  - JSONB indexes for project_data queries
  - Connection pooling
  - Read replicas (future)

- **Caching:**
  - Redis for frequently accessed data
  - Project metadata cache
  - User session cache
  - Search result cache

- **File Storage:**
  - CDN for audio files
  - Compression (gzip for JSON, transcoding for audio)
  - Lazy loading
  - Progressive download

- **API:**
  - Response compression
  - Pagination
  - Field selection
  - Batch operations

---

## 🧪 Testing Strategy

- **Unit Tests:**
  - Business logic
  - Serialization/deserialization
  - Validation

- **Integration Tests:**
  - API endpoints
  - Database operations
  - File upload/download

- **E2E Tests:**
  - User flows
  - Project save/load
  - Share functionality

---

## 📝 Next Steps

1. **Review & Approval:** Tüm tasarımları gözden geçir
2. **Environment Setup:** Development ortamı kurulumu
3. **Implementation:** Phase 1'den başla
4. **Testing:** Her phase'de test et
5. **Deployment:** Production'a deploy et

---

## 📞 Questions & Support

Tasarımla ilgili sorularınız için:
- Dokümantasyonları inceleyin
- Implementation sırasında güncellemeler yapılabilir
- Best practices'e uygun şekilde geliştirin

---

**Son Güncelleme:** 2025-01-XX  
**Hazırlayan:** AI Assistant  
**Durum:** ✅ Design Complete - Ready for Implementation

