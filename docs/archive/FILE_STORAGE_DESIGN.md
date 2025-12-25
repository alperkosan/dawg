# 📁 DAWG File Storage Design

**Date:** 2025-01-XX  
**Version:** 1.0.0  
**Status:** 📋 Design Phase  
**Purpose:** Ses dosyası depolama, yükleme ve yönetim stratejisi

---

## 📋 Overview

DAW projeleri için büyük ses dosyalarını (WAV, MP3, OGG, FLAC, AIFF) verimli şekilde depolama, yükleme ve dağıtma sistemi. Presigned URL'ler ile direct S3 upload, CDN entegrasyonu ve transcoding desteği.

---

## 🎯 Gereksinimler

### 1. Dosya Tipleri

- **Audio Samples:** Kullanıcı yüklediği ses dosyaları
- **Frozen Patterns:** Pattern'lerden export edilen audio
- **Stems:** Mixer kanallarından export edilen audio
- **Bounces:** Master output'tan export edilen audio
- **Thumbnails:** Audio waveform preview'ları

### 2. Özellikler

- ✅ Büyük dosya desteği (100MB+)
- ✅ Resumable uploads
- ✅ Progress tracking
- ✅ Direct S3 upload (server bypass)
- ✅ CDN entegrasyonu
- ✅ Transcoding (format conversion)
- ✅ Compression (storage optimization)
- ✅ Thumbnail generation
- ✅ Metadata extraction

---

## 🏗️ Storage Architecture

### High-Level Flow

```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Backend   │
└──────┬──────┘                    └──────┬──────┘
       │                                   │
       │ 1. POST /api/assets/upload        │
       │    { filename, size, mimeType }   │
       ├──────────────────────────────────>│
       │                                   │
       │ 2. Generate presigned URL         │
       │    Create asset record            │
       │                                   │
       │ 3. Response                       │
       │    {                              │
       │      uploadId: "uuid",            │
       │      presignedUrl: "https://...", │
       │      assetId: "uuid"              │
       │    }                              │
       │<──────────────────────────────────┤
       │                                   │
       │ 4. Direct upload to S3            │
       │    (Progress tracking)            │
       ├──────────────────────────────────>│
       │         (S3/MinIO)                │
       │                                   │
       │ 5. Upload complete                │
       │    S3 webhook → Backend           │
       │<──────────────────────────────────┤
       │                                   │
       │ 6. Process file                   │
       │    - Extract metadata             │
       │    - Generate thumbnail           │
       │    - Transcode (optional)         │
       │                                   │
       │ 7. Update asset record            │
       │    Mark as processed              │
```

### Storage Providers

#### Option 1: MinIO (Self-hosted)

**Pros:**
- ✅ S3-compatible API
- ✅ Zero egress costs
- ✅ Full control
- ✅ High performance (local network)
- ✅ Open source

**Cons:**
- ⚠️ Operational overhead (backup, scaling)
- ⚠️ Requires infrastructure

**Use Case:** Development, small-scale production

#### Option 2: Cloudflare R2

**Pros:**
- ✅ S3-compatible API
- ✅ Zero egress costs
- ✅ Built-in CDN
- ✅ Managed service
- ✅ Low cost ($0.015/GB/month)

**Cons:**
- ⚠️ Vendor lock-in
- ⚠️ Less control

**Use Case:** Production, scale-out

#### Option 3: AWS S3

**Pros:**
- ✅ Industry standard
- ✅ Mature ecosystem
- ✅ Global infrastructure

**Cons:**
- ⚠️ Egress costs
- ⚠️ Higher cost

**Use Case:** Enterprise, high-scale

**Öneri:** Başlangıç için **MinIO**, scale için **Cloudflare R2** migration.

---

## 📤 Upload Strategy

### Presigned URL Upload

```typescript
// 1. Client requests upload
POST /api/assets/upload
{
  filename: "kick.wav",
  size: 5242880, // 5MB
  mimeType: "audio/wav",
  projectId: "uuid" // Optional
}

// 2. Backend generates presigned URL
{
  uploadId: "uuid",
  assetId: "uuid",
  presignedUrl: "https://storage.dawg.com/bucket/audio/uuid.wav?X-Amz-Algorithm=...",
  expiresIn: 3600, // 1 hour
  fields: { // For POST form data
    "Content-Type": "audio/wav",
    "x-amz-server-side-encryption": "AES256"
  }
}

// 3. Client uploads directly to S3
PUT <presignedUrl>
Content-Type: audio/wav
Body: <file data>

// 4. S3 webhook notifies backend
POST /api/assets/webhook
{
  bucket: "dawg-audio",
  key: "audio/uuid.wav",
  event: "s3:ObjectCreated:Put"
}
```

### Resumable Upload (Multipart)

```typescript
// For files > 100MB, use multipart upload

// 1. Initiate multipart upload
POST /api/assets/upload/multipart
{
  filename: "long-track.wav",
  size: 104857600, // 100MB
  mimeType: "audio/wav"
}

// Response
{
  uploadId: "uuid",
  assetId: "uuid",
  uploadKey: "audio/uuid.wav",
  partSize: 5242880, // 5MB chunks
  parts: [] // Array of presigned URLs for each part
}

// 2. Upload parts in parallel
PUT <partUrl1> // Part 1
PUT <partUrl2> // Part 2
PUT <partUrl3> // Part 3
...

// 3. Complete multipart upload
POST /api/assets/upload/multipart/:uploadId/complete
{
  parts: [
    { partNumber: 1, etag: "..." },
    { partNumber: 2, etag: "..." },
    ...
  ]
}
```

---

## 🗄️ Database Schema

### project_assets Table

```sql
CREATE TABLE project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- File info
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  duration_seconds DECIMAL(10, 2),
  
  -- Storage
  storage_key TEXT NOT NULL, -- S3/MinIO key: "audio/{user_id}/{asset_id}.wav"
  storage_url TEXT NOT NULL, -- CDN URL
  storage_provider VARCHAR(50) DEFAULT 'minio', -- 'minio', 's3', 'r2'
  storage_bucket VARCHAR(100) DEFAULT 'dawg-audio',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  -- {
  --   sampleRate: 44100,
  --   bitDepth: 16,
  --   channels: 2,
  --   format: "wav",
  --   codec: "PCM"
  -- }
  
  -- Processing
  is_processed BOOLEAN DEFAULT false,
  processing_status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'uploading', 'processing', 'completed', 'failed'
  processing_error TEXT,
  
  -- Thumbnail
  thumbnail_url TEXT,
  waveform_data JSONB, -- Waveform points for visualization
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_project_assets_project_id ON project_assets(project_id);
CREATE INDEX idx_project_assets_user_id ON project_assets(user_id);
CREATE INDEX idx_project_assets_storage_key ON project_assets(storage_key);
CREATE INDEX idx_project_assets_processing_status ON project_assets(processing_status);
CREATE INDEX idx_project_assets_created_at ON project_assets(created_at DESC);
```

### upload_sessions Table (Multipart)

```sql
CREATE TABLE upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES project_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Upload info
  upload_key TEXT NOT NULL, -- S3 key
  total_size BIGINT NOT NULL,
  part_size BIGINT NOT NULL,
  total_parts INTEGER NOT NULL,
  completed_parts INTEGER DEFAULT 0,
  
  -- S3 multipart upload ID
  s3_upload_id VARCHAR(255),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'uploading', 'completed', 'failed', 'aborted'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL -- Cleanup incomplete uploads
);

CREATE INDEX idx_upload_sessions_asset_id ON upload_sessions(asset_id);
CREATE INDEX idx_upload_sessions_user_id ON upload_sessions(user_id);
CREATE INDEX idx_upload_sessions_expires_at ON upload_sessions(expires_at);
```

---

## 🔌 API Endpoints

### File Upload

#### POST /api/assets/upload

```typescript
// Request
{
  filename: string;
  size: number;
  mimeType: string;
  projectId?: string;
}

// Response (200)
{
  uploadId: string;
  assetId: string;
  presignedUrl: string;
  expiresIn: number;
  fields?: Record<string, string>; // For POST form data
}
```

#### POST /api/assets/upload/multipart

```typescript
// Request
{
  filename: string;
  size: number;
  mimeType: string;
  projectId?: string;
}

// Response (200)
{
  uploadId: string;
  assetId: string;
  uploadKey: string;
  partSize: number;
  parts: Array<{
    partNumber: number;
    presignedUrl: string;
    expiresIn: number;
  }>;
}
```

#### POST /api/assets/upload/multipart/:uploadId/complete

```typescript
// Request
{
  parts: Array<{
    partNumber: number;
    etag: string;
  }>;
}

// Response (200)
{
  assetId: string;
  storageUrl: string;
}
```

### Asset Management

#### GET /api/assets/:id

```typescript
// Response (200)
{
  asset: {
    id: string;
    filename: string;
    size: number;
    duration: number;
    storageUrl: string;
    thumbnailUrl: string;
    metadata: object;
    isProcessed: boolean;
    createdAt: string;
  }
}
```

#### GET /api/projects/:projectId/assets

```typescript
// Response (200)
{
  assets: AssetData[];
  total: number;
}
```

#### DELETE /api/assets/:id

```typescript
// Response (200)
{
  message: "Asset deleted successfully"
}
```

#### GET /api/assets/:id/download

```typescript
// Response: Redirect to presigned download URL or stream file
```

---

## 🔄 Processing Pipeline

### Background Job Queue (Bull/BullMQ)

```typescript
// jobs/processAsset.ts
import { Job } from 'bull';
import { extractMetadata } from './audio/metadata';
import { generateThumbnail } from './audio/thumbnail';
import { transcodeAudio } from './audio/transcode';

export async function processAsset(job: Job) {
  const { assetId } = job.data;

  // 1. Update status
  await db.assets.update(assetId, { 
    processingStatus: 'processing' 
  });

  try {
    // 2. Download from S3
    const fileBuffer = await s3.getObject(asset.storageKey);

    // 3. Extract metadata
    const metadata = await extractMetadata(fileBuffer);
    // { sampleRate, bitDepth, channels, duration, format }

    // 4. Generate thumbnail (waveform)
    const thumbnail = await generateThumbnail(fileBuffer);
    const thumbnailUrl = await s3.upload(thumbnail, `thumbnails/${assetId}.png`);

    // 5. Generate waveform data
    const waveformData = await generateWaveform(fileBuffer);

    // 6. Optional: Transcode to optimized format
    if (shouldTranscode(asset)) {
      const transcoded = await transcodeAudio(fileBuffer, {
        format: 'mp3',
        bitrate: '192k',
      });
      await s3.upload(transcoded, `optimized/${assetId}.mp3`);
    }

    // 7. Update asset record
    await db.assets.update(assetId, {
      isProcessed: true,
      processingStatus: 'completed',
      metadata,
      thumbnailUrl,
      waveformData,
      processedAt: new Date(),
    });

  } catch (error) {
    await db.assets.update(assetId, {
      processingStatus: 'failed',
      processingError: error.message,
    });
    throw error;
  }
}
```

### Metadata Extraction

```typescript
// Use music-metadata or similar library
import { parseBuffer } from 'music-metadata';

async function extractMetadata(fileBuffer: Buffer) {
  const metadata = await parseBuffer(fileBuffer);
  
  return {
    sampleRate: metadata.format.sampleRate,
    bitDepth: metadata.format.bitsPerSample,
    channels: metadata.format.numberOfChannels,
    duration: metadata.format.duration,
    format: metadata.format.container,
    codec: metadata.format.codec,
    bitrate: metadata.format.bitrate,
    title: metadata.common.title,
    artist: metadata.common.artist,
    album: metadata.common.album,
  };
}
```

### Thumbnail Generation

```typescript
// Generate waveform thumbnail
import { Waveform } from 'waveform';

async function generateThumbnail(fileBuffer: Buffer) {
  const waveform = new Waveform(fileBuffer, {
    width: 800,
    height: 200,
    color: '#4ECDC4',
  });
  
  return waveform.toPNG();
}
```

---

## 🌐 CDN Integration

### Cloudflare CDN

```typescript
// Storage URL structure
// Production: https://cdn.dawg.com/audio/{user_id}/{asset_id}.wav
// Development: http://localhost:9000/dawg-audio/audio/{user_id}/{asset_id}.wav

// CDN configuration
const CDN_CONFIG = {
  baseUrl: process.env.CDN_BASE_URL || 'https://cdn.dawg.com',
  cacheControl: 'public, max-age=31536000', // 1 year
  cors: {
    allowedOrigins: ['https://dawg.com'],
    allowedMethods: ['GET', 'HEAD'],
  },
};
```

### Cache Strategy

- **Audio files:** Long cache (1 year) - immutable
- **Thumbnails:** Long cache (1 year) - immutable
- **Metadata:** Short cache (1 hour) - may change

---

## 🔒 Security

### 1. Presigned URL Security

```typescript
// Generate presigned URL with restrictions
const presignedUrl = s3.getSignedUrl('putObject', {
  Bucket: 'dawg-audio',
  Key: storageKey,
  Expires: 3600, // 1 hour
  Conditions: [
    ['content-length-range', 0, 100 * 1024 * 1024], // Max 100MB
    ['starts-with', '$Content-Type', 'audio/'], // Only audio files
  ],
  Metadata: {
    userId: user.id,
    assetId: asset.id,
  },
});
```

### 2. Access Control

```typescript
// Check if user can access asset
async function canAccessAsset(userId: string, assetId: string) {
  const asset = await db.assets.findOne(assetId);
  
  // Owner can always access
  if (asset.userId === userId) return true;
  
  // Check if asset is in a shared project
  if (asset.projectId) {
    const project = await db.projects.findOne(asset.projectId);
    if (project.isPublic) return true;
    if (project.userId === userId) return true;
    // Check share permissions
    const share = await db.shares.findOne({ projectId: project.id, userId });
    if (share) return true;
  }
  
  return false;
}
```

### 3. File Validation

```typescript
// Validate file before processing
const ALLOWED_MIME_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/ogg',
  'audio/flac',
  'audio/aiff',
  'audio/x-wav',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function validateFile(file: { mimeType: string; size: number }) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
    throw new Error('Invalid file type');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }
}
```

---

## 📊 Storage Optimization

### 1. Compression

```typescript
// Transcode large WAV files to MP3 for storage
async function optimizeStorage(asset: Asset) {
  if (asset.mimeType === 'audio/wav' && asset.fileSize > 10 * 1024 * 1024) {
    // Transcode to MP3 (192kbps)
    const mp3Buffer = await transcodeAudio(asset.storageKey, {
      format: 'mp3',
      bitrate: '192k',
    });
    
    // Store optimized version
    await s3.upload(mp3Buffer, `optimized/${asset.id}.mp3`);
    
    // Keep original for download, use optimized for streaming
    asset.optimizedUrl = `optimized/${asset.id}.mp3`;
  }
}
```

### 2. Lifecycle Policies

```typescript
// S3/MinIO lifecycle rules
// - Delete incomplete uploads after 7 days
// - Archive old assets after 1 year of inactivity
// - Delete assets when project is deleted
```

### 3. Deduplication

```typescript
// Check if file already exists (hash-based)
async function checkDuplicate(fileHash: string) {
  const existing = await db.assets.findOne({ fileHash });
  if (existing) {
    // Return existing asset instead of uploading new
    return existing;
  }
}
```

---

## 📈 Monitoring & Analytics

### Metrics

- Upload success rate
- Average upload time
- Storage usage per user
- CDN bandwidth usage
- Processing queue length
- Failed processing rate

### Alerts

- Storage quota exceeded
- Processing queue backlog
- CDN errors
- Upload failures

---

**Son Güncelleme:** 2025-01-XX  
**Hazırlayan:** AI Assistant  
**Durum:** 📋 Design Complete

