# 🎵 Feed Sample Integration Feature

**Tarih:** 2025-01-XX  
**Durum:** 📋 Planlama  
**Öncelik:** Yüksek

---

## 🎯 Genel Bakış

Kullanıcılar feed'deki projelerden sample'ları kendi projelerine dahil edebilecek. Bu özellik:
- **Sosyal etkileşimi** artırır
- **Sample paylaşımını** teşvik eder
- **Kullanıcılara bildirim** gönderir (sample kullanıldığında)
- **Yaratıcı işbirliğini** destekler

---

## 📐 Mimari Tasarım

### User Flow

```
1. Kullanıcı feed'de bir proje görür
2. Proje kartında "Samples" butonu/sekmesi görür
3. Sample'ları görüntüler (preview, download, drag & drop)
4. Sample'ı channel rack'e sürükler veya "Add to Project" butonuna tıklar
5. Sample projeye eklenir
6. Orijinal proje sahibine bildirim gider
```

### Component Structure

```
ProjectCard/
├── ProjectCard.jsx (mevcut)
│   ├── ProjectCardHeader
│   ├── ProjectCardThumbnail
│   ├── ProjectCardContent
│   └── ProjectCardSamples (YENİ) ← Sample listesi
│       ├── SampleItem
│       │   ├── SamplePreview
│       │   ├── SampleInfo
│       │   └── SampleActions (Add, Preview, Download)
│       └── SampleList
└── ProjectCard.css
```

---

## 🗄️ Database Schema

### Yeni Tablolar

```sql
-- Sample usage tracking (hangi kullanıcı hangi sample'ı kullandı)
CREATE TABLE IF NOT EXISTS sample_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id UUID NOT NULL, -- Sample'ın asset ID'si
  source_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  used_in_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  used_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Prevent duplicate usage tracking
  UNIQUE(source_project_id, used_in_project_id, sample_id)
);

CREATE INDEX idx_sample_usage_source_project ON sample_usage(source_project_id);
CREATE INDEX idx_sample_usage_used_in_project ON sample_usage(used_in_project_id);
CREATE INDEX idx_sample_usage_user ON sample_usage(used_by_user_id);
CREATE INDEX idx_sample_usage_created_at ON sample_usage(created_at DESC);

-- Project samples metadata (projede hangi sample'lar var)
-- Note: Bu zaten var olabilir, kontrol et
```

---

## 🔌 Backend API Endpoints

### Yeni Endpoints

```typescript
// GET /api/projects/:projectId/samples
// Get samples from a project
interface ProjectSamplesResponse {
  samples: Sample[];
  project: {
    id: string;
    title: string;
    author: User;
  };
}

// POST /api/projects/:projectId/samples/:sampleId/use
// Track sample usage and send notification
interface UseSampleRequest {
  usedInProjectId: string; // Current user's project ID
}

interface UseSampleResponse {
  success: boolean;
  notificationSent: boolean;
}

// GET /api/projects/:projectId/samples/usage
// Get usage statistics for project samples
interface SampleUsageStats {
  sampleId: string;
  usageCount: number;
  usedByUsers: User[];
  lastUsedAt: Date;
}
```

---

## 🎨 UI/UX Tasarım

### ProjectCard Enhancement

```
┌─────────────────────────────────┐
│  [Thumbnail]                    │
│                                 │
├─────────────────────────────────┤
│  Project Title                  │
│  Author: @username              │
│  [Like] [Comment] [Share]       │
├─────────────────────────────────┤
│  📊 Stats: 1.2k views, 45 likes │
│                                 │
│  🎵 Samples (3) ▼              │ ← YENİ: Expandable section
│  ┌───────────────────────────┐ │
│  │ 🎹 Kick 808.wav           │ │
│  │    2.3s | Drag to add     │ │
│  │    [▶ Preview] [➕ Add]   │ │
│  ├───────────────────────────┤ │
│  │ 🎹 Snare.wav              │ │
│  │    1.8s | Drag to add     │ │
│  │    [▶ Preview] [➕ Add]   │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
```

### Sample Item Design

- **Preview Button**: 30s preview (range request)
- **Add Button**: Sample'ı projeye ekle
- **Drag Handle**: Drag & drop için
- **Sample Info**: Duration, format, size
- **Usage Badge**: "Used by 12 producers" (opsiyonel)

---

## ⚡ Implementation Details

### Frontend

#### 1. ProjectCard Enhancement

```jsx
// ProjectCard.jsx
const [showSamples, setShowSamples] = useState(false);
const [samples, setSamples] = useState([]);
const [loadingSamples, setLoadingSamples] = useState(false);

// Fetch samples when expanded
useEffect(() => {
  if (showSamples && samples.length === 0) {
    loadProjectSamples();
  }
}, [showSamples]);

const handleAddSample = async (sample) => {
  // Track usage
  await apiClient.useSample(project.id, sample.id, {
    usedInProjectId: currentProjectId
  });
  
  // Add to channel rack
  handleAddSampleToProject(sample);
};
```

#### 2. Sample Drag & Drop

```jsx
// SampleItem.jsx
const handleDragStart = (e) => {
  e.dataTransfer.setData('application/x-dawg-feed-sample', JSON.stringify({
    sampleId: sample.id,
    projectId: project.id,
    url: sample.url,
    name: sample.name
  }));
  e.dataTransfer.effectAllowed = 'copy';
};
```

#### 3. Channel Rack Integration

```jsx
// ChannelRack.jsx - handleNativeDrop enhancement
const feedSampleData = e.dataTransfer.getData('application/x-dawg-feed-sample');
if (feedSampleData) {
  const sample = JSON.parse(feedSampleData);
  // Track usage
  await apiClient.useSample(sample.projectId, sample.sampleId, {
    usedInProjectId: currentProjectId
  });
  // Add to project
  handleAddNewInstrument({
    name: sample.name,
    url: sample.url,
    type: 'sample',
    sourceProjectId: sample.projectId, // Track source
    sourceSampleId: sample.sampleId
  });
}
```

### Backend

#### 1. Get Project Samples

```typescript
// GET /api/projects/:projectId/samples
server.get('/projects/:projectId/samples', async (request, reply) => {
  const { projectId } = request.params;
  
  // Get project
  const project = await findProjectById(projectId);
  if (!project || !project.isPublic) {
    throw new NotFoundError('Project not found');
  }
  
  // Extract samples from project data
  const samples = extractSamplesFromProject(project.projectData);
  
  return reply.send({
    samples,
    project: {
      id: project.id,
      title: project.title,
      author: await getUserById(project.user_id)
    }
  });
});
```

#### 2. Track Sample Usage

```typescript
// POST /api/projects/:projectId/samples/:sampleId/use
server.post('/projects/:projectId/samples/:sampleId/use', 
  { preHandler: [server.authenticate] },
  async (request, reply) => {
    const { projectId, sampleId } = request.params;
    const { usedInProjectId } = request.body;
    const userId = request.user!.userId;
    
    // Check if already tracked
    const existing = await db.query(
      'SELECT id FROM sample_usage WHERE source_project_id = $1 AND used_in_project_id = $2 AND sample_id = $3',
      [projectId, usedInProjectId, sampleId]
    );
    
    if (existing.rows.length > 0) {
      return reply.send({ success: true, notificationSent: false });
    }
    
    // Track usage
    await db.query(
      'INSERT INTO sample_usage (source_project_id, used_in_project_id, used_by_user_id, sample_id) VALUES ($1, $2, $3, $4)',
      [projectId, usedInProjectId, userId, sampleId]
    );
    
    // Get source project owner
    const sourceProject = await findProjectById(projectId);
    
    // Send notification
    await createNotification(db, {
      userId: sourceProject.user_id,
      type: 'sample_used',
      data: {
        sampleId,
        sampleName: sampleName,
        sourceProjectId: projectId,
        sourceProjectTitle: sourceProject.title,
        usedInProjectId,
        usedByUserId: userId,
        usedByUsername: request.user!.username
      }
    });
    
    return reply.send({ success: true, notificationSent: true });
  }
);
```

---

## 🔔 Notification Types

### Yeni Notification Type

```typescript
enum NotificationType {
  // ... existing types
  SAMPLE_USED = 'sample_used',
}

// Notification data structure
interface SampleUsedNotification {
  sampleId: string;
  sampleName: string;
  sourceProjectId: string;
  sourceProjectTitle: string;
  usedInProjectId: string;
  usedByUserId: string;
  usedByUsername: string;
}
```

### Notification Message

```
"@username used your sample 'Kick 808.wav' in their project 'My New Beat'"
```

---

## 📊 Analytics & Tracking

### Track Edilecek Metrikler

- Sample usage count per project
- Most used samples
- Sample usage over time
- User engagement (who uses whose samples)

### Sample Usage Stats

```typescript
// GET /api/projects/:projectId/samples/usage
// Returns usage statistics for all samples in project
interface SampleUsageResponse {
  samples: Array<{
    sampleId: string;
    sampleName: string;
    usageCount: number;
    usedByUsers: User[];
    lastUsedAt: Date;
  }>;
}
```

---

## 🚀 Implementation Phases

### Phase 1: Basic Integration (1 hafta)
- [ ] ProjectCard'da sample listesi gösterimi
- [ ] Sample'ları fetch etme API
- [ ] Sample'ı projeye ekleme (buton)
- [ ] Basic usage tracking

### Phase 2: Drag & Drop (3-4 gün)
- [ ] Sample drag & drop
- [ ] Channel rack'e entegrasyon
- [ ] Visual feedback

### Phase 3: Notifications (2-3 gün)
- [ ] Sample usage notification
- [ ] Notification UI
- [ ] Real-time updates

### Phase 4: Enhanced Features (1 hafta)
- [ ] Sample preview
- [ ] Usage statistics
- [ ] Sample search/filter
- [ ] Popular samples badge

---

## 🎯 Success Metrics

- Sample usage rate
- User engagement (sample sharing)
- Notification open rate
- Cross-project collaboration

---

**Son Güncelleme:** 2025-01-XX  
**Hazırlayan:** AI Assistant  
**Durum:** 📋 Planlama Tamamlandı - Implementation'a Hazır

