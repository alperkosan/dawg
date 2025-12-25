# Neon Database Setup Guide

Bu dokümantasyon, Neon database'i Vercel'de kullanmak için gerekli adımları içerir.

## Neon Database Nedir?

Neon, serverless PostgreSQL servisidir ve Vercel ile mükemmel entegre çalışır:
- **Serverless**: Otomatik scaling
- **Branching**: Database branch'leri (Git gibi)
- **Connection Pooling**: Built-in connection pooler
- **Free Tier**: Ücretsiz başlangıç planı

## Vercel'de Neon Integration

### 1. Vercel Dashboard'dan Neon Ekleme

1. Vercel Dashboard → Project → Settings → **Integrations**
2. **Neon** integration'ını bulun ve **Add** butonuna tıklayın
3. Yeni bir Neon database oluşturun veya mevcut bir database'i bağlayın
4. Vercel otomatik olarak `DATABASE_URL` environment variable'ını ekler

### 2. Manuel Neon Database Oluşturma

1. [Neon Console](https://console.neon.tech) → **Create Project**
2. Project adı ve region seçin
3. Database oluşturulduktan sonra **Connection Details**'dan connection string'i kopyalayın

## Connection String Format

### Direct Connection (Development - pgbouncer olmadan)
```
postgresql://neondb_owner:npg_vNYLEDgzTr54@ep-lingering-truth-agv32bfq.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

### Pooler Connection (Production - Önerilen)
```
postgresql://neondb_owner:npg_vNYLEDgzTr54@ep-lingering-truth-agv32bfq-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

**Önemli**: 
- ✅ Production'da **pooler endpoint** kullanın (`-pooler` ile biten) - daha iyi performance ve connection management
- ✅ Region: `c-2.eu-central-1.aws` (Frankfurt, Germany)
- ✅ Database: `neondb`
- ✅ User: `neondb_owner`

## Environment Variables

Vercel Dashboard → Project → Settings → **Environment Variables**:

### ✅ Önerilen Konfigürasyon (Pooler Connection)

```bash
# ✅ Recommended for most uses - Pooler endpoint (önerilen)
DATABASE_URL=postgresql://neondb_owner:npg_vNYLEDgzTr54@ep-lingering-truth-agv32bfq-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require

# Connection Pool Settings (optional - defaults optimized for Neon)
DB_POOL_MIN=0      # Serverless için 0 (connection'ları açık tutmaz)
DB_POOL_MAX=5      # Neon free tier: 5 connections
```

### Direct Connection (pgbouncer olmadan)

```bash
# For uses requiring a connection without pgbouncer
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:npg_vNYLEDgzTr54@ep-lingering-truth-agv32bfq.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

### Vercel Postgres Template Variables (Opsiyonel)

```bash
# Vercel Postgres template variables (kullanılıyorsa)
POSTGRES_URL=postgresql://neondb_owner:npg_vNYLEDgzTr54@ep-lingering-truth-agv32bfq-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://neondb_owner:npg_vNYLEDgzTr54@ep-lingering-truth-agv32bfq.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_USER=neondb_owner
POSTGRES_HOST=ep-lingering-truth-agv32bfq-pooler.c-2.eu-central-1.aws.neon.tech
POSTGRES_PASSWORD=npg_vNYLEDgzTr54
POSTGRES_DATABASE=neondb
```

### Neon Auth Variables (Next.js için - Opsiyonel)

```bash
# Neon Auth environment variables (Next.js için, bizim projede kullanılmıyor)
NEXT_PUBLIC_STACK_PROJECT_ID=d1a8b6a6-038d-4e0e-8aee-cbaf544819e7
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=pck_3eptdqb360hb4qe5htv0p9d675j7sepsr1ecj21jw4aqg
STACK_SECRET_SERVER_KEY=ssk_rjdyx3ycvyf3yyt63v85y6ndg39rf59578bdr2menea9g
```

**Önemli Notlar:**
- ✅ **Production'da her zaman pooler endpoint kullanın** (`-pooler` ile biten)
- ✅ **SSL zorunlu**: `?sslmode=require` parametresi eklenmeli
- ✅ **Vercel integration otomatik ekler**: Manuel eklemeye gerek yok
- ⚠️ **Credentials güvenli tutulmalı**: Bu dosyada örnek olarak gösterilmiştir

## Database Migrations

### Local Development

```bash
# .env dosyasına Neon connection string ekleyin
DATABASE_URL=postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/database?sslmode=require

# Migrations çalıştırın
cd server
npm run migrate
```

### Vercel Production

Migrations otomatik olarak cold start'ta çalışır (`server/api/index.ts`). 

Manuel migration için:

```bash
# Vercel CLI ile environment variables'ı çekin
vercel env pull .env.local

# Migrations çalıştırın
cd server
npm run migrate
```

## Connection Pooling

Neon'un kendi connection pooler'ı var, ancak `pg.Pool` da kullanılabilir. Kod otomatik olarak:

1. **Neon connection string** algılar
2. **SSL** ayarlarını yapılandırır
3. **Serverless-optimized** pool ayarlarını uygular:
   - `min: 0` - Connection'ları açık tutmaz (serverless için)
   - `max: 5` - Neon free tier limit
   - `idleTimeoutMillis: 10000` - Hızlı cleanup

## Neon Free Tier Limits

- **5 concurrent connections**
- **512 MB storage**
- **Branching**: Unlimited
- **Compute time**: Pay-as-you-go

Production için **Pro plan** önerilir (daha fazla connection ve storage).

## Troubleshooting

### Connection Timeout

```bash
# Connection string'de pooler endpoint kullanın
# ep-xxx-xxx-pooler.region.aws.neon.tech (pooler var)
```

### SSL Error

```bash
# Connection string'e ?sslmode=require ekleyin
DATABASE_URL=postgresql://...?sslmode=require
```

### Too Many Connections

```bash
# DB_POOL_MAX değerini düşürün (max 5 for free tier)
DB_POOL_MAX=3
```

### Migration Errors

```bash
# Local'de test edin
vercel env pull .env.local
cd server
npm run migrate

# Vercel logs kontrol edin
vercel logs
```

## Best Practices

1. **Pooler Endpoint Kullanın**: Production'da her zaman pooler endpoint kullanın
2. **Connection Limits**: Free tier'da max 5 connection, Pro'da daha fazla
3. **SSL**: Her zaman SSL kullanın (`?sslmode=require`)
4. **Environment Variables**: Vercel integration otomatik ekler, manuel eklemeyin
5. **Migrations**: Local'de test edin, sonra production'a deploy edin

## Neon Console Features

- **Database Branching**: Git gibi branch'ler oluşturun
- **Time Travel**: Database'i geçmiş bir noktaya geri alın
- **Metrics**: Connection, query performance metrikleri
- **Logs**: Query logs ve error logs

## Daha Fazla Bilgi

- [Neon Documentation](https://neon.tech/docs)
- [Vercel + Neon Integration](https://vercel.com/integrations/neon)
- [Neon Connection Pooling](https://neon.tech/docs/connect/connection-pooling)
- [Neon Serverless Guide](https://neon.tech/docs/serverless/serverless-driver)

