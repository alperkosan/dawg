# 🎵 Backend Headless Audio Render Plan

**Tarih:** 2025-01-XX  
**Durum:** 📋 Planlama  
**Öncelik:** Yüksek

---

## 🎯 Genel Bakış

Proje publish edildiğinde, backend'de headless browser kullanarak arrangement'ı mixer efektleriyle birlikte render edip CDN'e yüklemek.

**Gereksinim:** Projenin arrangement panelindeki son durumu, arrangement tracklerin mix kanallarındaki efektleriyle beraber, proje içinde nasıl duyuluyorsa export edildiğinde de aynı şekilde duyulması.

---

## 📐 Mimari Tasarım

### Render Pipeline

```
1. Project Publish Trigger
   ↓
2. Backend: Queue render job
   ↓
3. Puppeteer: Launch headless browser
   ↓
4. Load project data in browser
   ↓
5. Initialize audio engine (same as client)
   ↓
6. Render arrangement with mixer effects
   ↓
7. Export to audio buffer
   ↓
8. Encode to MP3 (128kbps for preview)
   ↓
9. Upload to CDN
   ↓
10. Update project record with preview_audio_url
```

### Teknoloji Stack

- **Puppeteer**: Headless Chrome/Chromium
- **Client-side Audio Engine**: Mevcut `NativeAudioEngine` kodu
- **FFmpeg** (opsiyonel): Audio encoding için
- **Background Job Queue**: BullMQ veya benzeri

---

## 🗄️ Database Schema

```sql
-- Already in migration 006_project_preview_audio.sql
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS preview_audio_url TEXT,
ADD COLUMN IF NOT EXISTS preview_audio_duration INTEGER,
ADD COLUMN IF NOT EXISTS preview_audio_rendered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS preview_audio_status VARCHAR(20) DEFAULT 'pending';
```

---

## 🔌 Backend Implementation

### 1. Render Service

```typescript
// server/src/services/audioRender.ts
import puppeteer from 'puppeteer';
import { storageService } from './storage.js';
import { findProjectById, updateProject } from './projects.js';
import { logger } from '../utils/logger.js';

export class AudioRenderService {
  private browser: Browser | null = null;

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async renderProjectPreview(projectId: string): Promise<string> {
    // 1. Load project data
    const project = await findProjectById(projectId);
    if (!project) throw new Error('Project not found');

    // 2. Launch page
    const page = await this.browser!.newPage();
    
    // 3. Load render page (special endpoint that only renders)
    await page.goto(`${config.clientUrl}/render?projectId=${projectId}`, {
      waitUntil: 'networkidle0',
    });

    // 4. Wait for render to complete
    const audioBuffer = await page.evaluate(async () => {
      // Client-side render code runs here
      // Returns audio buffer as base64
      return await window.renderProject();
    });

    // 5. Encode to MP3
    const mp3Buffer = await this.encodeToMP3(audioBuffer);

    // 6. Upload to CDN
    const storageResult = await storageService.uploadFile(
      project.user_id,
      `${projectId}-preview.mp3`,
      mp3Buffer,
      false, // not system asset
      undefined,
      undefined,
      `project-previews/${projectId}/preview.mp3`
    );

    // 7. Update project
    await updateProject(projectId, {
      preview_audio_url: storageResult.storageUrl,
      preview_audio_duration: this.calculateDuration(audioBuffer),
      preview_audio_rendered_at: new Date(),
      preview_audio_status: 'ready',
    });

    await page.close();
    return storageResult.storageUrl;
  }

  private async encodeToMP3(audioBuffer: Buffer): Promise<Buffer> {
    // Use FFmpeg or lame encoder
    // For now, return as-is (WAV format)
    return audioBuffer;
  }
}
```

### 2. Render Trigger

```typescript
// server/src/services/projects.ts
export async function updateProject(id: string, data: {...}) {
  const project = await updateProjectInternal(id, data);
  
  // ✅ Trigger render if project is made public
  if (data.isPublic === true) {
    const previousProject = await findProjectById(id);
    if (previousProject && !previousProject.is_public) {
      // Project just became public - trigger render
      await queuePreviewRender(id);
    }
  }
  
  return project;
}
```

### 3. Background Job Queue

```typescript
// server/src/services/jobQueue.ts
import Bull from 'bull';

const renderQueue = new Bull('audio-render', {
  redis: { host: 'localhost', port: 6379 },
});

renderQueue.process(async (job) => {
  const { projectId } = job.data;
  const renderService = new AudioRenderService();
  await renderService.renderProjectPreview(projectId);
});
```

---

## 🎨 Frontend Render Page

```typescript
// client/src/pages/RenderPage.jsx
// Special page that only renders audio (no UI)
export default function RenderPage() {
  useEffect(() => {
    const projectId = new URLSearchParams(window.location.search).get('projectId');
    if (projectId) {
      renderProject(projectId);
    }
  }, []);

  async function renderProject(projectId: string) {
    // 1. Load project data
    const project = await apiClient.getProject(projectId);
    
    // 2. Initialize audio engine
    const audioEngine = await AudioContextService.initialize();
    
    // 3. Load project into engine
    await ProjectSerializer.deserialize(project.projectData, audioEngine);
    
    // 4. Render arrangement
    const audioBuffer = await exportManager.exportArrangement({
      format: 'wav',
      includeEffects: true,
      normalize: true,
    });
    
    // 5. Return as base64
    window.renderResult = audioBufferToBase64(audioBuffer);
  }

  return null; // No UI
}
```

---

## ⚡ Alternative: Simplified Approach

Eğer Puppeteer çok karmaşık gelirse, **Hybrid Approach**:

1. **Publish Trigger**: Frontend'de publish edildiğinde otomatik render başlat
2. **Background Render**: Render işlemi background'da devam eder
3. **CDN Upload**: Render tamamlandığında CDN'e yüklenir
4. **Status Update**: Backend'e status güncellenir

Bu yaklaşımda:
- Kullanıcı publish butonuna basar
- Render başlar (kullanıcı beklemez, toast gösterilir)
- Render tamamlandığında CDN'e yüklenir
- Feed'de preview hazır olur

---

## 🚀 Implementation Phases

### Phase 1: Database & Basic Structure (1 gün)
- [ ] Run migration 006
- [ ] Add preview_audio fields to Project type
- [ ] Create render service skeleton

### Phase 2: Puppeteer Setup (1-2 gün)
- [ ] Install Puppeteer
- [ ] Create render page endpoint
- [ ] Test headless browser rendering

### Phase 3: Audio Render Integration (2-3 gün)
- [ ] Create render page (client-side)
- [ ] Integrate audio engine in render page
- [ ] Export arrangement with mixer effects
- [ ] Encode to MP3

### Phase 4: CDN Upload & Update (1 gün)
- [ ] Upload rendered audio to CDN
- [ ] Update project record
- [ ] Error handling

### Phase 5: Trigger & Queue (1-2 gün)
- [ ] Add render trigger on publish
- [ ] Background job queue
- [ ] Status tracking

### Phase 6: Frontend Integration (1 gün)
- [ ] Update ProjectCard to show preview player
- [ ] Loading states
- [ ] Error handling

---

## 🔧 Technical Challenges

### Challenge 1: Audio Engine in Headless Browser
- **Solution**: Puppeteer ile client-side kod çalıştır
- **Risk**: Memory usage, timeout issues

### Challenge 2: Audio Encoding
- **Solution**: FFmpeg veya lame encoder
- **Alternative**: Browser'da encode (daha yavaş)

### Challenge 3: Sample Loading
- **Solution**: CDN'den sample'ları yükle
- **Risk**: Network latency

### Challenge 4: Performance
- **Solution**: Render timeout (5 dakika)
- **Optimization**: Cache rendered audio

---

## 📊 Alternatives Considered

### Alternative 1: Client-side Render + Upload ✅ (Simpler)
- Frontend'de render
- CDN'e yükle
- Avantaj: Basit, mevcut kod
- Dezavantaj: Kullanıcı beklemeli

### Alternative 2: Puppeteer (Seçilen) ✅
- Backend'de headless browser
- Avantaj: Kullanıcı beklemez, scalable
- Dezavantaj: Karmaşık, resource intensive

### Alternative 3: FFmpeg Only
- Audio dosyalarını birleştir
- Avantaj: Hızlı
- Dezavantaj: Effects uygulanamaz, sadece audio clips

---

## 📝 Notes

- **Memory**: Puppeteer her render için ~200-500MB RAM
- **Timeout**: 5 dakika max render time
- **Concurrent Renders**: Max 2-3 (server kaynaklarına göre)
- **Retry**: 3 kez başarısız render için

---

**Son Güncelleme:** 2025-01-XX  
**Hazırlayan:** AI Assistant  
**Durum:** 📋 Planlama Tamamlandı - Implementation'a Hazır

