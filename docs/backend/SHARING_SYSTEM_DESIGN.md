# 🔗 DAWG Project Sharing System Design

**Date:** 2025-01-XX  
**Version:** 1.0.0  
**Status:** 📋 Design Phase  
**Purpose:** Proje paylaşımı, remix ve etkileşim sistemi tasarımı

---

## 📋 Overview

DAWG projelerinin paylaşılması, remix edilmesi ve kullanıcılar arası etkileşim (like, comment, play) sistemi. Sadece kendi medya platformları içinde paylaşım.

---

## 🎯 Gereksinimler

### 1. Paylaşım Tipleri

- **Public:** Herkes görebilir, arama sonuçlarında görünür
- **Unlisted:** Link ile erişilebilir, arama sonuçlarında görünmez
- **Private:** Sadece sahibi görebilir
- **Shared:** Belirli kullanıcılarla paylaşılmış

### 2. Paylaşım İzinleri

- **View:** Projeyi görüntüleme, dinleme
- **Remix:** Projeyi klonlayıp düzenleme
- **Edit:** Orijinal projeyi düzenleme (sadece owner)

### 3. Etkileşimler

- **Like:** Projeyi beğenme
- **Comment:** Yorum yapma
- **Play:** Dinleme (analytics)
- **Remix:** Projeyi klonlama
- **Follow:** Kullanıcıyı takip etme

---

## 🏗️ Architecture

### Sharing Flow

```
┌─────────────┐                    ┌─────────────┐
│   Owner     │                    │   Backend   │
└──────┬──────┘                    └──────┬──────┘
       │                                   │
       │ 1. Create share                   │
       │    POST /api/projects/:id/shares  │
       │    { accessLevel: "remix" }       │
       ├──────────────────────────────────>│
       │                                   │
       │ 2. Generate share token            │
       │    Create share record            │
       │                                   │
       │ 3. Response                       │
       │    {                              │
       │      shareToken: "abc123",        │
       │      shareUrl: "dawg.com/s/abc123"│
       │    }                              │
       │<──────────────────────────────────┤
       │                                   │
       │ 4. Share link                     │
       │    (Copy to clipboard, share)    │
       │                                   │
┌──────▼──────┐                    ┌──────┬──────┐
│   Viewer    │                    │   Backend   │
└──────┬──────┘                    └──────┬──────┘
       │                                   │
       │ 5. Open share link                 │
       │    GET /api/shares/abc123          │
       ├──────────────────────────────────>│
       │                                   │
       │ 6. Validate token                 │
       │    Check permissions              │
       │                                   │
       │ 7. Return project data            │
       │    (Public data only)             │
       │<──────────────────────────────────┤
       │                                   │
       │ 8. Like/Comment/Remix             │
       │    POST /api/projects/:id/like    │
       ├──────────────────────────────────>│
```

---

## 📊 Database Schema

### project_shares Table

```sql
CREATE TABLE project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Share settings
  share_token VARCHAR(64) UNIQUE NOT NULL,
  access_level VARCHAR(50) DEFAULT 'view',
  -- 'view', 'remix', 'edit'
  
  -- Visibility
  is_public BOOLEAN DEFAULT false,
  is_unlisted BOOLEAN DEFAULT false,
  -- If both false, then private
  
  -- Expiration
  expires_at TIMESTAMP,
  
  -- Password protection (optional)
  password_hash VARCHAR(255),
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  remix_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX idx_project_shares_token ON project_shares(share_token);
CREATE INDEX idx_project_shares_public ON project_shares(is_public) 
  WHERE is_public = true;
```

### project_interactions Table

```sql
CREATE TABLE project_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Interaction type
  interaction_type VARCHAR(50) NOT NULL,
  -- 'like', 'remix', 'play', 'comment'
  
  -- Data (JSONB for flexibility)
  data JSONB DEFAULT '{}'::jsonb,
  -- For comments: { text: "...", parent_id: "..." }
  -- For remix: { original_project_id: "...", changes: "..." }
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint: one like per user per project
  UNIQUE(project_id, user_id, interaction_type)
);

CREATE INDEX idx_project_interactions_project_id ON project_interactions(project_id);
CREATE INDEX idx_project_interactions_user_id ON project_interactions(user_id);
CREATE INDEX idx_project_interactions_type ON project_interactions(interaction_type);
CREATE INDEX idx_project_interactions_created_at ON project_interactions(created_at DESC);
```

### project_comments Table (Alternative to interactions)

```sql
CREATE TABLE project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES project_comments(id) ON DELETE CASCADE,
  -- For nested comments/replies
  
  -- Content
  text TEXT NOT NULL,
  edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP,
  
  -- Moderation
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  
  -- Stats
  like_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_comments_project_id ON project_comments(project_id);
CREATE INDEX idx_project_comments_user_id ON project_comments(user_id);
CREATE INDEX idx_project_comments_parent_id ON project_comments(parent_id);
CREATE INDEX idx_project_comments_created_at ON project_comments(created_at DESC);
```

### project_remixes Table

```sql
CREATE TABLE project_remixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  remix_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Remix metadata
  changes_summary TEXT,
  credits TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_remixes_original ON project_remixes(original_project_id);
CREATE INDEX idx_project_remixes_remix ON project_remixes(remix_project_id);
CREATE INDEX idx_project_remixes_user ON project_remixes(user_id);
```

---

## 🔌 API Endpoints

### Sharing

#### POST /api/projects/:id/shares

```typescript
// Request
{
  accessLevel: 'view' | 'remix' | 'edit';
  isPublic?: boolean;
  isUnlisted?: boolean;
  expiresAt?: string; // ISO timestamp
  password?: string; // Optional password protection
}

// Response (201)
{
  share: {
    id: string;
    shareToken: string;
    shareUrl: string; // "https://dawg.com/s/abc123"
    accessLevel: string;
    isPublic: boolean;
    isUnlisted: boolean;
    expiresAt: string | null;
    createdAt: string;
  }
}
```

#### GET /api/projects/:id/shares

```typescript
// Response (200)
{
  shares: ShareData[];
}
```

#### PUT /api/shares/:token

```typescript
// Request
{
  accessLevel?: 'view' | 'remix' | 'edit';
  isPublic?: boolean;
  isUnlisted?: boolean;
  expiresAt?: string;
  password?: string;
}

// Response (200)
{
  share: ShareData;
}
```

#### DELETE /api/shares/:token

```typescript
// Response (200)
{
  message: "Share deleted successfully"
}
```

#### GET /api/shares/:token

```typescript
// Public endpoint (no auth required)
// Response (200)
{
  project: {
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    bpm: number;
    duration: number;
    // Public project data only
  };
  share: {
    accessLevel: string;
    isPublic: boolean;
    viewCount: number;
  };
  owner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
}
```

### Interactions

#### POST /api/projects/:id/like

```typescript
// Toggle like
// Response (200)
{
  liked: boolean;
  likeCount: number;
}
```

#### GET /api/projects/:id/interactions

```typescript
// Response (200)
{
  interactions: {
    likes: {
      count: number;
      users: UserData[]; // First 10 users
      hasLiked: boolean; // Current user
    };
    comments: {
      count: number;
      comments: CommentData[];
    };
    remixes: {
      count: number;
      remixes: RemixData[];
    };
    plays: {
      count: number;
    };
  }
}
```

#### POST /api/projects/:id/comments

```typescript
// Request
{
  text: string;
  parentId?: string; // For replies
}

// Response (201)
{
  comment: {
    id: string;
    text: string;
    user: UserData;
    parentId: string | null;
    likeCount: number;
    createdAt: string;
  }
}
```

#### DELETE /api/comments/:id

```typescript
// Response (200)
{
  message: "Comment deleted successfully"
}
```

#### POST /api/projects/:id/remix

```typescript
// Request
{
  title?: string; // New project title
  changesSummary?: string;
  credits?: string;
}

// Response (201)
{
  remix: {
    id: string;
    originalProjectId: string;
    remixProjectId: string;
    createdAt: string;
  };
  project: {
    id: string;
    title: string;
    // New remix project data
  };
}
```

---

## 🔄 Remix Flow

### Remix Process

```typescript
// 1. User clicks "Remix" on shared project
POST /api/projects/:id/remix

// 2. Backend creates new project
// - Clone project data
// - Set original_project_id reference
// - Set new owner
// - Mark as remix

// 3. Return new project
{
  project: {
    id: "new-uuid",
    title: "Original Title (Remix)",
    originalProjectId: "original-uuid",
    isRemix: true,
  }
}

// 4. Client loads new project
// - All data is editable
// - Original project link shown
// - Credits section visible
```

### Remix Data Structure

```typescript
interface RemixProjectData extends ProjectData {
  metadata: {
    ...ProjectData.metadata,
    originalProjectId: string;
    isRemix: true;
    remixChain: string[]; // Array of project IDs in remix chain
    credits: {
      originalAuthor: string;
      originalTitle: string;
      changesSummary: string;
    };
  };
}
```

---

## 🔍 Search & Discovery

### Public Projects Feed

```typescript
// GET /api/projects/public
// Query params:
// - page: number
// - limit: number (default: 20)
// - sort: 'newest' | 'popular' | 'trending'
// - genre: string
// - bpm: number
// - search: string

// Response
{
  projects: ProjectData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
```

### Trending Algorithm

```typescript
// Score = (likes * 2) + (plays * 0.1) + (remixes * 3) + (recent_factor)
// recent_factor = 1.0 if created < 7 days ago, else 0.5

function calculateTrendingScore(project: Project) {
  const daysSinceCreation = (Date.now() - project.createdAt) / (1000 * 60 * 60 * 24);
  const recentFactor = daysSinceCreation < 7 ? 1.0 : 0.5;
  
  return (
    project.likeCount * 2 +
    project.playCount * 0.1 +
    project.remixCount * 3
  ) * recentFactor;
}
```

---

## 🔒 Privacy & Security

### 1. Access Control

```typescript
async function canAccessProject(userId: string | null, project: Project) {
  // Owner can always access
  if (project.userId === userId) return true;
  
  // Public projects
  if (project.isPublic) return true;
  
  // Unlisted projects (via share token)
  if (project.isUnlisted) {
    // Check if accessed via valid share token
    return await validateShareToken(project.id, shareToken);
  }
  
  // Private projects
  return false;
}
```

### 2. Share Token Security

```typescript
// Generate secure random token
function generateShareToken(): string {
  return crypto.randomBytes(32).toString('base64url');
  // Example: "abc123xyz456..."
}

// Validate share token
async function validateShareToken(projectId: string, token: string) {
  const share = await db.shares.findOne({ projectId, shareToken: token });
  
  if (!share) return false;
  if (share.expiresAt && share.expiresAt < new Date()) return false;
  
  return true;
}
```

### 3. Password Protection

```typescript
// Optional password protection for shares
async function createPasswordProtectedShare(
  projectId: string,
  password: string
) {
  const passwordHash = await bcrypt.hash(password, 12);
  
  return await db.shares.insert({
    projectId,
    shareToken: generateShareToken(),
    passwordHash,
    accessLevel: 'view',
  });
}

// Validate password
async function validateSharePassword(shareToken: string, password: string) {
  const share = await db.shares.findOne({ shareToken });
  if (!share || !share.passwordHash) return false;
  
  return await bcrypt.compare(password, share.passwordHash);
}
```

---

## 📊 Analytics

### Project Stats

```typescript
interface ProjectStats {
  views: number;
  likes: number;
  comments: number;
  remixes: number;
  plays: number;
  shares: number;
  followers: number; // Users following this project
}
```

### User Stats

```typescript
interface UserStats {
  totalProjects: number;
  totalLikes: number;
  totalPlays: number;
  totalRemixes: number;
  followers: number;
  following: number;
}
```

---

## 🎨 UI Features

### Share Modal

```typescript
// Share options
- Copy link
- Share to social media (if integrated)
- Set access level (view/remix/edit)
- Set visibility (public/unlisted/private)
- Set expiration
- Password protection
- View share stats
```

### Project Card (Public Feed)

```typescript
// Display:
- Thumbnail
- Title
- Owner info
- Stats (likes, plays, remixes)
- Duration
- BPM
- Genre tags
- Like button
- Remix button
- Share button
```

### Remix Credits

```typescript
// Show in project:
- "Remix of: [Original Title] by [Original Author]"
- Link to original project
- Remix chain (if remix of remix)
- Changes summary
```

---

## 📝 Implementation Notes

### 1. Share URL Format

```
Public: https://dawg.com/projects/{projectId}
Unlisted: https://dawg.com/s/{shareToken}
Private: (no public URL, only via share token)
```

### 2. Remix Attribution

- Always show original author
- Link to original project
- Show remix chain
- Optional credits section

### 3. Moderation

- Report system for inappropriate content
- Comment moderation
- Auto-hide spam
- Admin tools for content management

### 4. Notifications

- New like notification
- New comment notification
- New remix notification
- New follower notification

---

**Son Güncelleme:** 2025-01-XX  
**Hazırlayan:** AI Assistant  
**Durum:** 📋 Design Complete

