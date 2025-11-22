# Vercel Deployment Guide

Bu dokümantasyon, DAWG backend server'ını Vercel'de deploy etmek için gerekli adımları içerir.

## Ön Gereksinimler

1. **Vercel Hesabı**: [vercel.com](https://vercel.com) üzerinde bir hesap oluşturun
2. **Vercel CLI**: `npm i -g vercel` ile Vercel CLI'yi yükleyin
3. **PostgreSQL Database**: 
   - **Neon** (Önerilen): [neon.tech](https://neon.tech) - Serverless PostgreSQL, Vercel ile entegre
   - Vercel Postgres
   - Supabase
   - Diğer PostgreSQL servisleri

> 💡 **Neon Önerilir**: Vercel ile mükemmel entegre çalışır, serverless-optimized, ve ücretsiz başlangıç planı var. Detaylar için `NEON_SETUP.md` dosyasına bakın.

## Yapılandırma

### 1. Environment Variables (Çevre Değişkenleri)

Vercel dashboard'unda veya `vercel.json` ile aşağıdaki environment variable'ları ayarlayın:

```bash
# Database (Neon - Önerilen)
# Vercel Neon integration otomatik olarak ekler, manuel eklemeyin
DATABASE_URL=postgresql://user:password@ep-xxx-xxx-pooler.region.aws.neon.tech/database?sslmode=require

# Veya diğer PostgreSQL servisleri için
# DATABASE_URL=postgresql://user:password@host:5432/database

# JWT
JWT_SECRET=your-secret-key-here

# Cookie
COOKIE_SECRET=your-cookie-secret-here

# CORS
CORS_ORIGIN=https://your-frontend-domain.vercel.app

# Storage (Bunny CDN)
CDN_BUNNY_STORAGE_API_KEY=your-bunny-api-key
CDN_BUNNY_STORAGE_ZONE=your-storage-zone
CDN_BUNNY_PULL_ZONE=your-pull-zone

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

### 2. Vercel CLI ile Deploy

```bash
# Vercel'e login olun
vercel login

# Projeyi deploy edin
vercel

# Production'a deploy edin
vercel --prod
```

### 3. GitHub Integration (Önerilen)

1. GitHub repository'nizi Vercel'e bağlayın
2. Vercel otomatik olarak her push'ta deploy yapacak
3. Pull request'ler için preview deployment'lar oluşturulacak

## Yapılandırma Dosyaları

### `vercel.json`

Vercel yapılandırma dosyası root dizinde bulunur. Bu dosya:
- Serverless function'ları tanımlar (`functions`)
- Route'ları yapılandırır (`rewrites`)
- Function timeout ve memory limit'lerini ayarlar

⚠️ **Önemli**: `builds` ve `functions` birlikte kullanılamaz. Modern Vercel'de sadece `functions` kullanılır. `builds` kaldırılmıştır.

### `server/api/index.ts`

Vercel serverless function entry point'i. Fastify server'ını Vercel'in serverless ortamına adapte eder.

## Önemli Notlar

### Database Migrations

- Migrations cold start'ta otomatik olarak çalışır
- İlk deploy'da migrations'ın tamamlanması biraz zaman alabilir
- Production'da migrations'ı manuel olarak çalıştırmak için Vercel CLI kullanabilirsiniz:

```bash
vercel env pull .env.local
cd server
npm run migrate
```

### WebSocket Support

⚠️ **Not**: Vercel serverless functions WebSocket'i desteklemez. WebSocket özellikleri için ayrı bir servis (ör. Railway, Render) kullanmanız gerekebilir.

### File Uploads

- Multipart file uploads desteklenir
- Max file size: 1GB (Vercel limit: 4.5MB request body, ancak streaming ile daha büyük dosyalar işlenebilir)
- Büyük dosyalar için doğrudan CDN'e upload önerilir

### Performance

- Cold start: İlk request ~2-5 saniye sürebilir
- Warm start: Sonraki request'ler çok daha hızlıdır
- Server instance'ı request'ler arasında cache'lenir (aynı serverless function instance'ı kullanılırsa)

## Troubleshooting

### Database Connection Issues

```bash
# Database URL'ini kontrol edin
vercel env ls

# Local'de test edin
vercel dev
```

### Build Errors

```bash
# Build loglarını kontrol edin
vercel logs

# Local build test edin
cd server
npm run build
```

### Function Timeout

`vercel.json`'da `maxDuration` değerini artırın (max 60 saniye).

## Monitoring

Vercel dashboard'unda:
- Function execution time
- Error rates
- Request counts
- Logs

gibi metrikleri görebilirsiniz.

## Production Checklist

- [ ] Environment variables ayarlandı
- [ ] Database migrations çalıştırıldı
- [ ] CORS origin doğru yapılandırıldı
- [ ] JWT secret güvenli bir değer
- [ ] Cookie secret güvenli bir değer
- [ ] CDN credentials doğru
- [ ] Health check endpoint çalışıyor (`/health`)
- [ ] Logs kontrol edildi

## Daha Fazla Bilgi

- [Vercel Documentation](https://vercel.com/docs)
- [Fastify on Vercel](https://www.fastify.io/docs/latest/Guides/Serverless/)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)

