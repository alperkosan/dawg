# 🎵 Project Audio Preview Feature

**Tarih:** 2025-01-XX  
**Durum:** 📋 Planlama  
**Öncelik:** Yüksek

---

## 🎯 Genel Bakış

Feed'deki projeler için audio preview özelliği. Kullanıcılar projeleri dinleyebilir, böylece:
- **Keşif deneyimi** artar
- **Engagement** artar
- **Sample paylaşımı** teşvik edilir
- **Sosyal etkileşim** güçlenir

---

## 🎨 Kullanım Senaryoları

### Senaryo 1: Proje Paylaşımı
```
1. Kullanıcı projeyi "Public" yapar veya "Share" butonuna basar
2. Backend otomatik olarak audio render eder (background job)
3. Render edilen audio CDN'e yüklenir
4. Project model'ine previewAudioUrl eklenir
5. Feed'de preview player görünür
```

### Senaryo 2: Feed'de Dinleme
```
1. Kullanıcı feed'de bir proje görür
2. ProjectCard'da play butonuna basar
3. Preview audio çalar (30s veya full track)
4. Waveform görselleştirme gösterilir
```

---

## 📐 Mimari Tasarım

### Render Stratejisi

**Seçenek 1: Pre-render (Önerilen) ✅**
- Proje public/share edildiğinde otomatik render
- Background job ile async render
- CDN'e yükle
- Avantaj: Hızlı, kullanıcı deneyimi iyi
- Dezavantaj: Storage maliyeti

**Seçenek 2: On-demand Render**
- Play butonuna basıldığında render
- Cache'le (ilk render sonrası)
- Avantaj: Sadece dinlenen projeler render edilir
- Dezavantaj: İlk dinlemede gecikme

**Seçenek 3: Hybrid**
- Public projeler: Pre-render
- Unlisted projeler: On-demand
- En iyi denge

### Önerilen: **Hybrid Approach**

---

## 🗄️ Database Schema

### Project Model Güncellemesi

```sql
-- Add preview audio fields to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS preview_audio_url TEXT,
ADD COLUMN IF NOT EXISTS preview_audio_duration INTEGER, -- seconds
ADD COLUMN IF NOT EXISTS preview_audio_rendered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS preview_audio_status VARCHAR(20) DEFAULT 'pending'; -- 'pending', 'rendering', 'ready', 'failed'

CREATE INDEX IF NOT EXISTS idx_projects_preview_status ON projects(preview_audio_status) WHERE preview_audio_status = 'ready';
```

---

## 🔌 Backend API

### Yeni Endpoints

```typescript
// POST /api/projects/:projectId/render-preview
// Trigger preview audio render (admin or project owner)
interface RenderPreviewRequest {
  force?: boolean; // Force re-render even if exists
}

interface RenderPreviewResponse {
  status: 'queued' | 'rendering' | 'ready' | 'failed';
  previewAudioUrl?: string;
  estimatedTime?: number; // seconds
}

// GET /api/projects/:projectId/preview-status
// Get preview render status
interface PreviewStatusResponse {
  status: 'pending' | 'rendering' | 'ready' | 'failed';
  previewAudioUrl?: string;
  progress?: number; // 0-100
  error?: string;
}
```

### Render Trigger Logic

```typescript
// When project is made public or shared
async function onProjectShared(projectId: string) {
  const project = await findProjectById(projectId);
  
  // Only render if public and preview doesn't exist
  if (project.isPublic && !project.preview_audio_url) {
    await queuePreviewRender(projectId);
  }
}

// Background job
async function renderProjectPreview(projectId: string) {
  // 1. Update status to 'rendering'
  await updateProject(projectId, { preview_audio_status: 'rendering' });
  
  // 2. Load project data
  const project = await findProjectById(projectId);
  
  // 3. Render audio (use existing export logic)
  const audioBuffer = await renderProjectAudio(project.projectData);
  
  // 4. Export to WAV/MP3
  const audioFile = await exportAudioBuffer(audioBuffer, {
    format: 'mp3',
    bitrate: 128, // Lower bitrate for preview
    duration: 30, // 30s preview (or full track)
  });
  
  // 5. Upload to CDN
  const previewUrl = await uploadToCDN(audioFile, {
    path: `project-previews/${projectId}.mp3`,
    public: true,
  });
  
  // 6. Update project
  await updateProject(projectId, {
    preview_audio_url: previewUrl,
    preview_audio_duration: audioBuffer.duration,
    preview_audio_rendered_at: new Date(),
    preview_audio_status: 'ready',
  });
}
```

---

## 🎨 Frontend Implementation

### ProjectCard Enhancement

```jsx
// ProjectCard.jsx
const [isPlaying, setIsPlaying] = useState(false);
const [audioElement, setAudioElement] = useState(null);

const handlePlay = async () => {
  if (!project.previewAudioUrl) {
    // Trigger render if not exists
    await apiClient.renderPreview(project.id);
    return;
  }
  
  if (isPlaying) {
    audioElement?.pause();
    setIsPlaying(false);
  } else {
    const audio = new Audio(project.previewAudioUrl);
    audio.addEventListener('ended', () => setIsPlaying(false));
    audio.play();
    setAudioElement(audio);
    setIsPlaying(true);
  }
};
```

### Preview Player Component

```jsx
// ProjectPreviewPlayer.jsx
- Play/Pause button
- Progress bar
- Waveform visualization (optional)
- Duration display
- Volume control
```

---

## ⚡ Render Implementation

### Audio Export Service

```typescript
// server/src/services/audioExport.ts
export async function renderProjectAudio(projectData: ProjectData): Promise<AudioBuffer> {
  // 1. Initialize audio engine (headless)
  const engine = new HeadlessAudioEngine();
  
  // 2. Load project data
  await engine.loadProject(projectData);
  
  // 3. Render to buffer
  const duration = calculateProjectDuration(projectData);
  const audioBuffer = await engine.render(duration);
  
  // 4. Cleanup
  await engine.cleanup();
  
  return audioBuffer;
}

export async function exportAudioBuffer(
  buffer: AudioBuffer,
  options: {
    format: 'wav' | 'mp3';
    bitrate?: number;
    duration?: number; // Limit duration for preview
  }
): Promise<Buffer> {
  // Use audio encoding library (e.g., lame, ffmpeg)
  // Convert AudioBuffer to file format
  return encodedBuffer;
}
```

---

## 🚀 Implementation Phases

### Phase 1: Basic Preview (1 hafta)
- [ ] Database schema update
- [ ] Render trigger on project share
- [ ] Basic audio export service
- [ ] CDN upload
- [ ] ProjectCard play button

### Phase 2: Enhanced Player (3-4 gün)
- [ ] Preview player component
- [ ] Progress bar
- [ ] Waveform visualization
- [ ] Volume control

### Phase 3: Optimization (2-3 gün)
- [ ] Background job queue
- [ ] Render caching
- [ ] Progress tracking
- [ ] Error handling

### Phase 4: Advanced Features (1 hafta)
- [ ] 30s preview vs full track toggle
- [ ] Multiple preview formats
- [ ] Render priority queue
- [ ] Analytics

---

## 🎯 Teknik Detaylar

### Audio Format

- **Format**: MP3 (daha küçük dosya)
- **Bitrate**: 128 kbps (preview için yeterli)
- **Duration**: 
  - Preview: 30 saniye (ilk 30s)
  - Full: Tüm track (opsiyonel)
- **Sample Rate**: 44.1 kHz

### Render Performance

- **Background Job**: BullMQ veya benzeri
- **Concurrent Renders**: Max 2-3 (server kaynaklarına göre)
- **Timeout**: 5 dakika (uzun projeler için)
- **Retry**: 3 kez (başarısız render için)

### CDN Storage

- **Path**: `project-previews/{projectId}.mp3`
- **Public Access**: Evet (feed'de dinlenebilmeli)
- **CORS**: Evet (cross-origin için)
- **Cache**: Long-term (değişmez)

---

## 📊 Alternatives Considered

### Alternative 1: Client-side Render
- ❌ Güvenlik riski (proje data'sı expose)
- ❌ Performance sorunları
- ❌ Browser compatibility

### Alternative 2: Streaming Render
- ❌ Karmaşık implementasyon
- ❌ Latency sorunları
- ❌ Server load

### Alternative 3: Pre-render (Seçilen) ✅
- ✅ Güvenli
- ✅ Hızlı
- ✅ Scalable
- ✅ Cache-friendly

---

## 🔔 Notifications

### Render Status Updates

```typescript
// WebSocket event
{
  type: 'preview:render:complete',
  data: {
    projectId: string;
    previewAudioUrl: string;
    status: 'ready';
  }
}
```

---

## 📝 Notes

- **Storage Cost**: Her public proje için ~1-2MB (30s MP3)
- **Render Time**: Ortalama 10-30 saniye (proje uzunluğuna göre)
- **CDN Bandwidth**: Preview'lar için ekstra bandwidth
- **Privacy**: Sadece public projeler render edilmeli

---

**Son Güncelleme:** 2025-01-XX  
**Hazırlayan:** AI Assistant  
**Durum:** 📋 Planlama Tamamlandı - Implementation'a Hazır

