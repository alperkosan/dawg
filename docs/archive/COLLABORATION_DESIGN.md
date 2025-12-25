# 🤝 DAWG Collaboration & Community Design

**Date:** 2025-01-XX  
**Version:** 1.0.0  
**Status:** 📋 Design Phase  
**Purpose:** Real-time collaboration, community features ve social platform tasarımı

---

## 📋 Overview

DAWG için collaboration (işbirliği), community building, real-time sessions ve social discovery özellikleri. Beatmaker'lar ve MC'leri birleştiren, öğreticiler ve yayınlayıcıları destekleyen bir platform.

---

## 🎯 Core Features

### 1. Real-Time Collaboration
- ✅ Multiple users editing same project simultaneously
- ✅ Operational Transform (OT) or CRDT for conflict resolution
- ✅ Cursor tracking (who's editing what)
- ✅ Live playback sync
- ✅ Voice chat integration (future)

### 2. Community Features
- ✅ Beatmaker/MC matching system
- ✅ Weekly Top 10 charts
- ✅ Tutorial creators & streamers
- ✅ Discovery feed ("Keşfet")
- ✅ Inspiration search ("İlham ara")
- ✅ User profiles with roles (beatmaker, MC, producer, tutor, streamer)

### 3. Live Sessions
- ✅ Online session hosting
- ✅ Real-time viewer tracking
- ✅ Live chat
- ✅ Session recording
- ✅ DJ radio streaming

### 4. Social Discovery
- ✅ Algorithm-based feed
- ✅ Genre-based discovery
- ✅ Mood-based search
- ✅ Collaboration requests
- ✅ Trending content

---

## 🏗️ Architecture

### Real-Time Collaboration Stack

```
┌─────────────┐                    ┌─────────────┐
│   Client 1  │                    │   Backend   │
└──────┬──────┘                    └──────┬──────┘
       │                                   │
       │ WebSocket Connection              │
       ├──────────────────────────────────>│
       │                                   │
       │ 1. Join project session           │
       │    { projectId, userId }          │
       ├──────────────────────────────────>│
       │                                   │
       │ 2. Broadcast to other clients     │
       │    "user_joined"                  │
       │<──────────────────────────────────┤
       │                                   │
       │ 3. Make change (add note)         │
       │    { type: "note_added", ... }    │
       ├──────────────────────────────────>│
       │                                   │
       │ 4. Apply change to server state   │
       │    Broadcast to all clients      │
       │<──────────────────────────────────┤
       │                                   │
┌──────▼──────┐                    ┌──────┬──────┐
│   Client 2  │                    │   Backend   │
└──────┬──────┘                    └──────┬──────┘
       │                                   │
       │ 5. Receive change                 │
       │    Apply to local state           │
       │<──────────────────────────────────┤
```

### Technology Stack

- **WebSocket Server:** Socket.io veya ws (native)
- **Conflict Resolution:** Yjs (CRDT) veya ShareJS (OT)
- **Presence:** Redis Pub/Sub
- **Session Management:** Redis

---

## 📊 Database Schema

### project_collaborators Table

```sql
CREATE TABLE project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role
  role VARCHAR(50) NOT NULL DEFAULT 'editor',
  -- 'owner', 'editor', 'viewer', 'commenter'
  
  -- Permissions
  can_edit BOOLEAN DEFAULT true,
  can_delete BOOLEAN DEFAULT false,
  can_share BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT true,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_active_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX idx_project_collaborators_user_id ON project_collaborators(user_id);
```

### live_sessions Table

```sql
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Session info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  session_token VARCHAR(64) UNIQUE NOT NULL,
  
  -- Settings
  is_public BOOLEAN DEFAULT true,
  max_viewers INTEGER DEFAULT 100,
  allow_chat BOOLEAN DEFAULT true,
  allow_voice BOOLEAN DEFAULT false,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'live', 'ended', 'archived'
  
  -- Stats
  viewer_count INTEGER DEFAULT 0,
  peak_viewers INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_live_sessions_host_id ON live_sessions(host_id);
CREATE INDEX idx_live_sessions_token ON live_sessions(session_token);
CREATE INDEX idx_live_sessions_status ON live_sessions(status) 
  WHERE status = 'live';
```

### session_viewers Table

```sql
CREATE TABLE session_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- NULL for anonymous viewers
  
  -- Viewer info
  ip_address INET,
  user_agent TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  
  -- Stats
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  watch_duration_seconds INTEGER DEFAULT 0
);

CREATE INDEX idx_session_viewers_session_id ON session_viewers(session_id);
CREATE INDEX idx_session_viewers_user_id ON session_viewers(user_id);
```

### user_roles Table

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role types
  role_type VARCHAR(50) NOT NULL,
  -- 'beatmaker', 'mc', 'producer', 'tutor', 'streamer', 'dj'
  
  -- Role-specific data
  role_data JSONB DEFAULT '{}'::jsonb,
  -- For beatmaker: { genres: [], skills: [] }
  -- For MC: { styles: [], languages: [] }
  -- For tutor: { subjects: [], experience: "..." }
  -- For streamer: { platform: "twitch", schedule: "..." }
  
  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,
  
  -- Stats
  follower_count INTEGER DEFAULT 0,
  collaboration_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, role_type)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_type ON user_roles(role_type);
CREATE INDEX idx_user_roles_verified ON user_roles(role_type, is_verified) 
  WHERE is_verified = true;
```

### collaboration_requests Table

```sql
CREATE TABLE collaboration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Request info
  message TEXT,
  requested_role VARCHAR(50) DEFAULT 'editor',
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'accepted', 'rejected', 'cancelled'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_collaboration_requests_from_user ON collaboration_requests(from_user_id);
CREATE INDEX idx_collaboration_requests_to_user ON collaboration_requests(to_user_id);
CREATE INDEX idx_collaboration_requests_status ON collaboration_requests(status);
```

### weekly_charts Table

```sql
CREATE TABLE weekly_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Chart data
  chart_data JSONB NOT NULL,
  -- {
  --   "top10": [
  --     { projectId: "...", rank: 1, score: 1000 },
  --     ...
  --   ],
  --   "genres": {
  --     "hip-hop": [...],
  --     "electronic": [...]
  --   }
  -- }
  
  -- Stats
  total_plays INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_remixes INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(week_start)
);

CREATE INDEX idx_weekly_charts_week_start ON weekly_charts(week_start DESC);
```

### discovery_feed Table

```sql
CREATE TABLE discovery_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- NULL for global feed
  
  -- Feed type
  feed_type VARCHAR(50) NOT NULL,
  -- 'discover', 'inspiration', 'trending', 'following', 'genre', 'mood'
  
  -- Feed data
  feed_items JSONB NOT NULL,
  -- Array of project IDs with scores
  
  -- Algorithm
  algorithm_version VARCHAR(50) DEFAULT '1.0',
  algorithm_params JSONB DEFAULT '{}'::jsonb,
  
  -- Cache
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  UNIQUE(user_id, feed_type)
);

CREATE INDEX idx_discovery_feed_user_id ON discovery_feed(user_id);
CREATE INDEX idx_discovery_feed_type ON discovery_feed(feed_type);
```

---

## 🔌 API Endpoints

### Collaboration

#### GET /api/projects/:id/collaborators

```typescript
// Response (200)
{
  collaborators: [
    {
      id: string;
      user: UserData;
      role: 'owner' | 'editor' | 'viewer' | 'commenter';
      permissions: {
        canEdit: boolean;
        canDelete: boolean;
        canShare: boolean;
        canExport: boolean;
      };
      isActive: boolean;
      lastActiveAt: string;
    }
  ];
  owner: UserData;
}
```

#### POST /api/projects/:id/collaborators

```typescript
// Request
{
  userId: string;
  role: 'editor' | 'viewer' | 'commenter';
  permissions?: {
    canEdit?: boolean;
    canDelete?: boolean;
    canShare?: boolean;
    canExport?: boolean;
  };
}

// Response (201)
{
  collaborator: CollaboratorData;
}
```

#### DELETE /api/projects/:id/collaborators/:userId

```typescript
// Response (200)
{
  message: "Collaborator removed"
}
```

#### POST /api/collaboration/requests

```typescript
// Request
{
  projectId: string;
  toUserId: string;
  message?: string;
  requestedRole: 'editor' | 'viewer';
}

// Response (201)
{
  request: {
    id: string;
    project: ProjectData;
    fromUser: UserData;
    toUser: UserData;
    message: string;
    status: 'pending';
    createdAt: string;
  };
}
```

### Live Sessions

#### POST /api/sessions

```typescript
// Request
{
  projectId?: string;
  title: string;
  description?: string;
  isPublic?: boolean;
  maxViewers?: number;
  allowChat?: boolean;
}

// Response (201)
{
  session: {
    id: string;
    sessionToken: string;
    sessionUrl: string; // "https://dawg.com/live/abc123"
    title: string;
    status: 'pending';
    createdAt: string;
  };
}
```

#### POST /api/sessions/:id/start

```typescript
// Response (200)
{
  session: {
    id: string;
    status: 'live';
    startedAt: string;
  };
}
```

#### POST /api/sessions/:id/end

```typescript
// Response (200)
{
  session: {
    id: string;
    status: 'ended';
    endedAt: string;
    durationSeconds: number;
    peakViewers: number;
  };
}
```

#### GET /api/sessions/:token

```typescript
// Public endpoint
// Response (200)
{
  session: {
    id: string;
    title: string;
    host: UserData;
    project: ProjectData | null;
    status: 'live' | 'ended';
    viewerCount: number;
    allowChat: boolean;
    startedAt: string;
  };
}
```

#### GET /api/sessions/live

```typescript
// Get all live sessions
// Response (200)
{
  sessions: LiveSessionData[];
  total: number;
}
```

### Discovery & Feed

#### GET /api/feed/discover

```typescript
// Query params: page, limit, genre, mood, sort
// Response (200)
{
  projects: ProjectData[];
  pagination: PaginationData;
}
```

#### GET /api/feed/inspiration

```typescript
// Query params: mood, genre, bpm, key
// Response (200)
{
  projects: ProjectData[];
  suggestions: {
    similarProjects: ProjectData[];
    recommendedCollaborators: UserData[];
    trendingGenres: string[];
  };
}
```

#### GET /api/charts/weekly

```typescript
// Response (200)
{
  chart: {
    weekStart: string;
    weekEnd: string;
    top10: Array<{
      rank: number;
      project: ProjectData;
      score: number;
      change: number; // Rank change from last week
    }>;
    genres: {
      [genre: string]: ProjectData[];
    };
    stats: {
      totalPlays: number;
      totalLikes: number;
      totalRemixes: number;
    };
  };
}
```

#### GET /api/charts/weekly/:weekStart

```typescript
// Get specific week's chart
// Response (200)
{
  chart: WeeklyChartData;
}
```

### User Roles & Matching

#### PUT /api/users/me/roles

```typescript
// Request
{
  roles: Array<{
    type: 'beatmaker' | 'mc' | 'producer' | 'tutor' | 'streamer' | 'dj';
    data: {
      genres?: string[];
      skills?: string[];
      styles?: string[];
      languages?: string[];
      subjects?: string[];
      experience?: string;
      platform?: string;
      schedule?: string;
    };
  }>;
}

// Response (200)
{
  roles: UserRoleData[];
}
```

#### GET /api/matching/beatmaker-mc

```typescript
// Find matching beatmakers and MCs
// Query params: genre, style, location
// Response (200)
{
  matches: Array<{
    beatmaker: UserData;
    mc: UserData;
    compatibilityScore: number;
    reasons: string[]; // Why they match
  }>;
}
```

#### GET /api/matching/collaborators

```typescript
// Find potential collaborators for a project
// Query params: projectId, role, skills
// Response (200)
{
  collaborators: Array<{
    user: UserData;
    role: string;
    matchScore: number;
    reasons: string[];
  }>;
}
```

---

## 🔄 WebSocket Events

### Connection

```typescript
// Client connects
ws://api.dawg.com/ws?token=<jwt>

// Server confirms
{
  type: 'connected',
  userId: string,
  timestamp: number
}
```

### Collaboration Events

```typescript
// Join project session
{
  type: 'collaboration:join',
  projectId: string
}

// User joined
{
  type: 'collaboration:user_joined',
  userId: string,
  user: UserData,
  cursor: { trackId: string, position: number }
}

// User left
{
  type: 'collaboration:user_left',
  userId: string
}

// Cursor moved
{
  type: 'collaboration:cursor_moved',
  userId: string,
  cursor: { trackId: string, position: number, tool: string }
}

// Change made (note added, pattern changed, etc.)
{
  type: 'collaboration:change',
  userId: string,
  change: {
    type: 'note_added' | 'note_removed' | 'pattern_changed' | 'mixer_updated',
    data: object
  },
  timestamp: number
}

// Change acknowledged
{
  type: 'collaboration:change_ack',
  changeId: string,
  applied: boolean
}
```

### Live Session Events

```typescript
// Join session
{
  type: 'session:join',
  sessionToken: string
}

// Session started
{
  type: 'session:started',
  session: LiveSessionData
}

// Viewer joined
{
  type: 'session:viewer_joined',
  viewerCount: number,
  user: UserData | null // null if anonymous
}

// Viewer left
{
  type: 'session:viewer_left',
  viewerCount: number
}

// Host action (play, pause, seek, etc.)
{
  type: 'session:host_action',
  action: 'play' | 'pause' | 'seek' | 'change_pattern',
  data: object
}

// Chat message
{
  type: 'session:chat',
  userId: string,
  user: UserData,
  message: string,
  timestamp: number
}
```

---

## 🧮 Conflict Resolution

### Strategy: CRDT (Yjs)

```typescript
// Use Yjs for conflict-free collaborative editing
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Client-side
const ydoc = new Y.Doc();
const yarray = ydoc.getArray('notes');
const provider = new WebsocketProvider('ws://api.dawg.com/ws', projectId, ydoc);

// Changes automatically sync across all clients
yarray.push([{ note: 'C4', time: 0 }]);
```

**Benefits:**
- ✅ No conflicts (CRDT guarantees)
- ✅ Offline support
- ✅ Real-time sync
- ✅ Undo/redo support

---

## 📈 Discovery Algorithm

### Feed Generation

```typescript
interface FeedAlgorithm {
  // Factors
  recency: number; // How recent
  popularity: number; // Likes, plays, remixes
  relevance: number; // User preferences, genre match
  diversity: number; // Avoid repetition
  collaboration: number; // Collaboration potential
}

function calculateFeedScore(project: Project, user: User): number {
  const recency = calculateRecency(project.createdAt);
  const popularity = calculatePopularity(project);
  const relevance = calculateRelevance(project, user);
  const diversity = calculateDiversity(project, user.feedHistory);
  const collaboration = calculateCollaborationPotential(project, user);
  
  return (
    recency * 0.2 +
    popularity * 0.3 +
    relevance * 0.3 +
    diversity * 0.1 +
    collaboration * 0.1
  );
}
```

### Inspiration Search

```typescript
// Mood-based search
interface MoodSearch {
  mood: 'energetic' | 'chill' | 'dark' | 'uplifting' | 'melancholic';
  genre?: string;
  bpm?: { min: number; max: number };
  key?: string;
  instruments?: string[];
}

// Find projects matching mood
function findInspiration(search: MoodSearch): Project[] {
  // Analyze project metadata, tags, audio features
  // Return matching projects sorted by relevance
}
```

---

## 🎤 DJ Radio Streaming

### Architecture

```typescript
// DJ starts radio session
POST /api/radio/sessions
{
  title: string;
  genre: string;
  isPublic: boolean;
}

// Response
{
  session: {
    id: string;
    streamUrl: string; // RTMP endpoint
    listenUrl: string; // HLS/DASH endpoint
    chatEnabled: boolean;
  };
}

// DJ streams audio to RTMP endpoint
// Backend transcodes to HLS/DASH
// Listeners connect to HLS/DASH endpoint
```

### Streaming Stack

- **Input:** RTMP (DJ stream)
- **Transcoding:** FFmpeg
- **Output:** HLS/DASH (listeners)
- **CDN:** Cloudflare Stream or similar

---

## 📊 Weekly Charts Algorithm

### Score Calculation

```typescript
function calculateChartScore(project: Project, week: Week): number {
  const plays = project.playCount;
  const likes = project.likeCount;
  const remixes = project.remixCount;
  const comments = project.commentCount;
  const shares = project.shareCount;
  
  // Weighted scoring
  const score = (
    plays * 0.1 +
    likes * 2 +
    remixes * 3 +
    comments * 0.5 +
    shares * 1
  );
  
  // Time decay (recent activity weighted more)
  const timeDecay = calculateTimeDecay(project.lastActivity, week);
  
  return score * timeDecay;
}
```

### Chart Generation

```typescript
// Run weekly (cron job)
async function generateWeeklyChart(weekStart: Date) {
  const weekEnd = addDays(weekStart, 7);
  
  // Get all projects with activity in this week
  const projects = await db.projects.find({
    updatedAt: { $gte: weekStart, $lt: weekEnd },
    isPublic: true,
  });
  
  // Calculate scores
  const scored = projects.map(p => ({
    project: p,
    score: calculateChartScore(p, { start: weekStart, end: weekEnd }),
  }));
  
  // Sort and get top 10
  const top10 = scored.sort((a, b) => b.score - a.score).slice(0, 10);
  
  // Group by genre
  const byGenre = groupByGenre(scored);
  
  // Save chart
  await db.weeklyCharts.insert({
    weekStart,
    weekEnd,
    chartData: {
      top10: top10.map((item, index) => ({
        rank: index + 1,
        projectId: item.project.id,
        score: item.score,
      })),
      genres: byGenre,
    },
  });
}
```

---

## 🔔 Notifications

### Notification Types

```typescript
enum NotificationType {
  COLLABORATION_REQUEST = 'collaboration_request',
  COLLABORATION_ACCEPTED = 'collaboration_accepted',
  PROJECT_LIKED = 'project_liked',
  PROJECT_COMMENTED = 'project_commented',
  PROJECT_REMIXED = 'project_remixed',
  CHART_ENTRY = 'chart_entry',
  NEW_FOLLOWER = 'new_follower',
  SESSION_STARTED = 'session_started',
}
```

### Notification System

```typescript
// Real-time notifications via WebSocket
// Persistent notifications in database

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

**Son Güncelleme:** 2025-01-XX  
**Hazırlayan:** AI Assistant  
**Durum:** 📋 Design Complete

