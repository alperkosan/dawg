# 🎵 DAWG System Assets Management Design

**Date:** 2025-01-XX  
**Version:** 1.0.0  
**Status:** 📋 Design Phase  
**Purpose:** Sistem assetlerinin (DAWG Library) yönetim ve sunum stratejisi

---

## 📋 Overview

DAWG Library'deki sistem assetlerinin (örnek sesler, loop'lar, sample pack'ler) nasıl organize edileceği, yönetileceği ve sunulacağına dair mimari kararlar.

---

## 🎯 Gereksinimler

### 1. Asset Kategorileri

- **Default Samples**: Temel drum sample'ları (Kick, Snare, Hi-Hat, 808)
- **Premium Packs**: Ücretli/özel sample pack'ler
- **Community Packs**: Topluluk tarafından paylaşılan pack'ler
- **Loop Libraries**: Hazır loop'lar (BPM, key bilgisi ile)
- **One-Shots**: Tek nota sample'ları
- **Multi-Samples**: Velocity/note layer'lı sample'lar

### 2. Özellikler

- ✅ Admin panelinden yönetim
- ✅ Metadata desteği (BPM, key, tags, category)
- ✅ Versioning (asset güncellemeleri)
- ✅ CDN entegrasyonu
- ✅ Arama ve filtreleme
- ✅ Kullanım istatistikleri
- ✅ Preview/streaming
- ✅ Download tracking

---

## 🏗️ Mimari Yaklaşımlar

### Yaklaşım 1: Hibrit Model (ÖNERİLEN) ⭐

**Konsept:** Temel assetler statik, premium/admin assetleri database'de

#### Yapı:

```
System Assets
├── Static Assets (Build-time)
│   ├── Default Samples (/public/audio/samples/)
│   │   ├── drums/
│   │   ├── instruments/
│   │   └── loops/
│   └── Manifest (audio-manifest.json)
│
└── Dynamic Assets (Database)
    ├── Premium Packs
    ├── Community Packs
    ├── Admin-managed Assets
    └── Metadata (BPM, key, tags, etc.)
```

#### Avantajlar:

- ✅ **Performans**: Temel assetler CDN'den hızlı yüklenir
- ✅ **Esneklik**: Admin panelinden yeni pack'ler eklenebilir
- ✅ **Metadata**: Database'de zengin metadata tutulabilir
- ✅ **Versioning**: Asset güncellemeleri kolay
- ✅ **Arama**: Database'de arama/filtreleme yapılabilir
- ✅ **Analytics**: Kullanım istatistikleri toplanabilir

#### Dezavantajlar:

- ⚠️ İki farklı sistem yönetimi gerekiyor
- ⚠️ Statik assetler için build gerekiyor

#### Database Schema:

```sql
-- System Asset Categories
CREATE TABLE system_asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(255),
  parent_id UUID REFERENCES system_asset_categories(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- System Assets (Premium/Admin-managed)
CREATE TABLE system_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES system_asset_categories(id),
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Storage
  storage_key VARCHAR(500) NOT NULL, -- S3/MinIO key
  storage_url VARCHAR(500) NOT NULL,  -- CDN URL
  storage_provider VARCHAR(50) DEFAULT 'minio',
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  -- Metadata
  bpm INTEGER,
  key_signature VARCHAR(10), -- e.g., "C", "Am", "F#m"
  time_signature VARCHAR(10) DEFAULT '4/4',
  tags TEXT[], -- Array of tags
  duration_seconds DECIMAL(10, 3),
  
  -- Audio Properties
  sample_rate INTEGER,
  bit_depth INTEGER,
  channels INTEGER,
  
  -- Organization
  pack_id UUID REFERENCES system_asset_packs(id),
  pack_name VARCHAR(255), -- Denormalized for performance
  sort_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  
  -- Analytics
  download_count INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  
  -- Versioning
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES system_assets(id),
  
  -- Thumbnails/Previews
  thumbnail_url VARCHAR(500),
  waveform_data JSONB, -- Waveform visualization data
  preview_url VARCHAR(500), -- 30-second preview clip
  
  -- Metadata
  metadata JSONB, -- Additional flexible metadata
  created_by UUID REFERENCES users(id), -- Admin who uploaded
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- System Asset Packs (Collections)
CREATE TABLE system_asset_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  cover_image_url VARCHAR(500),
  
  -- Pricing
  is_free BOOLEAN DEFAULT true,
  price DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Organization
  category_id UUID REFERENCES system_asset_categories(id),
  tags TEXT[],
  
  -- Stats
  asset_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- System Asset Usage Tracking
CREATE TABLE system_asset_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES system_assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  usage_type VARCHAR(50), -- 'loaded', 'used_in_project', 'exported'
  usage_count INTEGER DEFAULT 1,
  
  first_used_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(asset_id, user_id, usage_type)
);

-- Indexes
CREATE INDEX idx_system_assets_category ON system_assets(category_id);
CREATE INDEX idx_system_assets_pack ON system_assets(pack_id);
CREATE INDEX idx_system_assets_tags ON system_assets USING GIN(tags);
CREATE INDEX idx_system_assets_active ON system_assets(is_active) WHERE is_active = true;
CREATE INDEX idx_system_assets_featured ON system_assets(is_featured) WHERE is_featured = true;
CREATE INDEX idx_system_assets_search ON system_assets USING GIN(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
);
```

#### API Endpoints:

```typescript
// Admin Endpoints
POST   /api/admin/assets              // Upload new system asset
PUT    /api/admin/assets/:id          // Update asset metadata
DELETE /api/admin/assets/:id          // Delete asset
POST   /api/admin/assets/:id/upload   // Upload file for asset
GET    /api/admin/assets              // List all assets (admin)

// Public Endpoints
GET    /api/assets/system             // List system assets (filtered)
GET    /api/assets/system/:id         // Get asset details
GET    /api/assets/system/:id/file    // Serve asset file
GET    /api/assets/system/:id/preview // Serve preview clip
GET    /api/assets/packs              // List asset packs
GET    /api/assets/packs/:id          // Get pack details
GET    /api/assets/search             // Search assets (name, tags, BPM, key)
```

---

### Yaklaşım 2: Tam Database Model

**Konsept:** Tüm sistem assetleri database'de, hiç statik dosya yok

#### Avantajlar:

- ✅ Tek sistem, tutarlı yönetim
- ✅ Tüm assetler admin panelinden yönetilebilir
- ✅ Metadata zenginliği
- ✅ Arama/filtreleme kolay

#### Dezavantajlar:

- ⚠️ Tüm assetler için database query gerekiyor
- ⚠️ CDN cache stratejisi daha karmaşık
- ⚠️ İlk yükleme daha yavaş olabilir

---

### Yaklaşım 3: Statik + Metadata Database

**Konsept:** Dosyalar statik, metadata database'de

#### Avantajlar:

- ✅ Dosyalar CDN'den hızlı
- ✅ Metadata yönetilebilir

#### Dezavantajlar:

- ⚠️ Dosya ve metadata senkronizasyonu zor
- ⚠️ Yeni dosya eklemek için build gerekiyor

---

## 🎨 Admin Panel Özellikleri

### 1. Asset Management

- **Upload**: Drag & drop veya file picker
- **Bulk Upload**: Çoklu dosya yükleme
- **Metadata Editor**: BPM, key, tags, description
- **Preview**: Waveform görüntüleme, audio preview
- **Organization**: Kategori, pack atama
- **Versioning**: Asset güncellemeleri
- **Analytics**: Kullanım istatistikleri

### 2. Pack Management

- **Pack Creation**: Yeni pack oluşturma
- **Asset Assignment**: Pack'e asset ekleme/çıkarma
- **Pricing**: Ücretsiz/premium belirleme
- **Cover Image**: Pack görseli yükleme

### 3. Category Management

- **Hierarchical Categories**: Kategori hiyerarşisi
- **Custom Icons**: Kategori ikonları
- **Sorting**: Kategori sıralaması

### 4. Analytics Dashboard

- **Popular Assets**: En çok kullanılan assetler
- **Download Stats**: İndirme istatistikleri
- **Usage Trends**: Kullanım trendleri
- **User Engagement**: Kullanıcı etkileşimleri

---

## 🔄 Migration Strategy

### Phase 1: Database Schema
1. Create tables for system assets
2. Migrate existing static assets metadata to database
3. Keep static files for now

### Phase 2: Admin Panel
1. Build admin UI for asset management
2. Implement upload functionality
3. Add metadata editing

### Phase 3: API Integration
1. Create API endpoints
2. Update frontend to use API
3. Implement search/filter functionality

### Phase 4: CDN Migration
1. Move static assets to CDN
2. Update storage URLs
3. Remove static files from public folder

---

## 📊 Önerilen Yaklaşım: Hibrit Model

**Neden Hibrit Model?**

1. **Performans**: Temel assetler (drums, basic samples) statik kalır, hızlı yüklenir
2. **Esneklik**: Premium/admin assetleri database'de, kolay yönetilir
3. **Scalability**: Büyük pack'ler database'de organize edilir
4. **Metadata**: Database'de zengin metadata tutulabilir
5. **Analytics**: Kullanım takibi yapılabilir

**Uygulama:**

- **Static**: `/public/audio/samples/drums/` → Build-time manifest
- **Dynamic**: Database'deki system_assets → API'den yüklenir
- **Frontend**: İki kaynağı birleştirerek gösterir

---

## 🚀 Implementation Plan

### Step 1: Database Schema ✅
- [ ] Create `system_asset_categories` table
- [ ] Create `system_assets` table
- [ ] Create `system_asset_packs` table
- [ ] Create `system_asset_usage` table
- [ ] Add indexes

### Step 2: Backend API
- [ ] Admin asset upload endpoint
- [ ] Public asset listing endpoint
- [ ] Asset search/filter endpoint
- [ ] Asset file serving endpoint

### Step 3: Admin Panel
- [ ] Asset upload UI
- [ ] Metadata editor
- [ ] Pack management
- [ ] Category management

### Step 4: Frontend Integration
- [ ] Update FileBrowser to load from API
- [ ] Merge static + dynamic assets
- [ ] Add search/filter UI
- [ ] Add asset preview

---

## 📝 Notes

- Static assets için manifest sistemi korunabilir (backward compatibility)
- Database assetleri için CDN URL'leri kullanılmalı
- Metadata extraction (BPM, key) için audio analysis gerekebilir
- Preview generation için 30-saniyelik clip'ler oluşturulmalı



