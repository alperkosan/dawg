# 📱 Medya Paneli Geliştirme Planı

**Tarih:** 2025-01-XX  
**Durum:** 📋 Planlama Aşaması  
**Öncelik:** Yüksek

---

## 🎯 Genel Bakış

Medya Paneli, DAWG platformunun sosyal ve keşif merkezi olacak. Kullanıcılar projeleri keşfedebilir, birbirleriyle etkileşime geçebilir, bildirimlerini yönetebilir ve topluluk içinde aktif olabilir.

### Temel Özellikler
- 📰 **Feed Sistemi**: Kişiselleştirilmiş içerik akışı
- 💬 **Interaksiyonlar**: Like, comment, share, remix, follow
- 🔔 **Bildirimler**: Real-time ve persistent bildirimler
- 👥 **Sosyal Özellikler**: Takip, keşif, trendler

---

## 📐 Mimari Tasarım

### Panel Yapısı

```
MediaPanel
├── FeedView (Ana görünüm)
│   ├── FeedHeader (Filtreler, sıralama)
│   ├── FeedContent (Proje kartları)
│   └── FeedPagination (Sayfalama)
├── InteractionsView (Etkileşimler)
│   ├── LikesTab
│   ├── CommentsTab
│   ├── SharesTab
│   └── RemixesTab
└── NotificationsView (Bildirimler)
    ├── NotificationList
    ├── NotificationFilters
    └── NotificationSettings
```

### Component Hierarchy

```
MediaPanel/
├── MediaPanel.jsx (Ana container)
├── components/
│   ├── Feed/
│   │   ├── FeedView.jsx
│   │   ├── FeedHeader.jsx
│   │   ├── FeedContent.jsx
│   │   ├── ProjectCard.jsx
│   │   ├── ProjectCardSkeleton.jsx
│   │   └── FeedFilters.jsx
│   ├── Interactions/
│   │   ├── InteractionsView.jsx
│   │   ├── InteractionTabs.jsx
│   │   ├── LikeButton.jsx
│   │   ├── CommentButton.jsx
│   │   ├── ShareButton.jsx
│   │   ├── RemixButton.jsx
│   │   └── FollowButton.jsx
│   └── Notifications/
│       ├── NotificationsView.jsx
│       ├── NotificationList.jsx
│       ├── NotificationItem.jsx
│       ├── NotificationFilters.jsx
│       └── NotificationSettings.jsx
├── hooks/
│   ├── useFeed.js
│   ├── useInteractions.js
│   ├── useNotifications.js
│   └── useMediaPanel.js
└── services/
    ├── feedService.js
    ├── interactionService.js
    └── notificationService.js
```

---

## 🗄️ Database Schema

### Mevcut Tablolar (003_community_features.sql)

```sql
-- Projects (mevcut)
-- Users (mevcut)
-- project_likes
-- project_comments
-- project_remixes
-- notifications
```

### Gerekli Eklemeler

```sql
-- Project shares table
CREATE TABLE IF NOT EXISTS project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50), -- 'twitter', 'facebook', 'copy_link', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX idx_project_shares_user_id ON project_shares(user_id);

-- User follows table
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);

-- Feed preferences (user-specific feed customization)
CREATE TABLE IF NOT EXISTS feed_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  filter_by_genre BOOLEAN DEFAULT true,
  filter_by_following BOOLEAN DEFAULT false,
  sort_by VARCHAR(20) DEFAULT 'recent', -- 'recent', 'popular', 'trending'
  genres TEXT[], -- Array of preferred genres
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Project views (for analytics and trending)
CREATE TABLE IF NOT EXISTS project_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for anonymous
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_project_views_project_id ON project_views(project_id);
CREATE INDEX idx_project_views_created_at ON project_views(created_at DESC);
```

---

## 🔌 Backend API Endpoints

### Feed Endpoints

```typescript
// GET /api/feed
// Query params: page, limit, sort, filter, genre
interface FeedRequest {
  page?: number;
  limit?: number;
  sort?: 'recent' | 'popular' | 'trending';
  filter?: 'all' | 'following' | 'genre';
  genre?: string;
}

interface FeedResponse {
  projects: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// GET /api/feed/trending
// Get trending projects (based on views, likes, comments in last 24h)
interface TrendingResponse {
  projects: Project[];
  period: '24h' | '7d' | '30d';
}
```

### Interaction Endpoints

```typescript
// POST /api/projects/:projectId/like
// Toggle like on project
interface LikeRequest {
  projectId: string;
}

interface LikeResponse {
  liked: boolean;
  likeCount: number;
}

// POST /api/projects/:projectId/comments
// Add comment to project
interface CommentRequest {
  projectId: string;
  content: string;
  parentId?: string; // For replies
}

interface CommentResponse {
  comment: Comment;
  commentCount: number;
}

// GET /api/projects/:projectId/comments
// Get comments for project
interface CommentsResponse {
  comments: Comment[];
  pagination: Pagination;
}

// POST /api/projects/:projectId/share
// Share project
interface ShareRequest {
  projectId: string;
  platform?: string; // 'twitter', 'facebook', 'copy_link'
}

// POST /api/projects/:projectId/remix
// Create remix of project
interface RemixRequest {
  projectId: string;
  changesSummary?: string;
  credits?: string;
}

interface RemixResponse {
  remixProject: Project;
  originalProject: Project;
}

// POST /api/users/:userId/follow
// Follow/unfollow user
interface FollowRequest {
  userId: string;
}

interface FollowResponse {
  following: boolean;
  followerCount: number;
  followingCount: number;
}
```

### Notification Endpoints

```typescript
// GET /api/notifications
// Get user notifications
interface NotificationsRequest {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: Pagination;
}

// PUT /api/notifications/:notificationId/read
// Mark notification as read
interface MarkReadResponse {
  notification: Notification;
}

// PUT /api/notifications/read-all
// Mark all notifications as read

// DELETE /api/notifications/:notificationId
// Delete notification

// GET /api/notifications/settings
// Get notification preferences
interface NotificationSettings {
  emailOnLike: boolean;
  emailOnComment: boolean;
  emailOnFollow: boolean;
  emailOnRemix: boolean;
  pushEnabled: boolean;
}

// PUT /api/notifications/settings
// Update notification preferences
```

---

## 🎨 UI/UX Tasarım

### Feed View

#### Layout
```
┌─────────────────────────────────────────────────┐
│  Feed Header                                    │
│  [All] [Following] [Trending] [Genre ▼]       │
│  [Recent ▼] [Popular] [Trending]               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐  ┌─────────────┐             │
│  │ Project     │  │ Project     │             │
│  │ Card        │  │ Card        │             │
│  │             │  │             │             │
│  │ [Like] [💬] │  │ [Like] [💬] │             │
│  └─────────────┘  └─────────────┘             │
│                                                 │
│  ┌─────────────┐  ┌─────────────┐             │
│  │ Project     │  │ Project     │             │
│  │ Card        │  │ Card        │             │
│  └─────────────┘  └─────────────┘             │
│                                                 │
│  [Load More]                                    │
└─────────────────────────────────────────────────┘
```

#### Project Card Design
- **Thumbnail**: Project cover image veya waveform visualization
- **Title**: Project name
- **Author**: User avatar + name
- **Stats**: Views, likes, comments, remixes
- **Actions**: Like, Comment, Share, Remix, Follow
- **Metadata**: Genre, BPM, duration, created date
- **Preview**: Play button (30s preview)

### Interactions View

#### Tabs
- **Likes**: Projects you've liked
- **Comments**: Your comments and replies
- **Shares**: Projects you've shared
- **Remixes**: Your remixes and remixes of your projects

### Notifications View

#### Notification Types
- **Like**: "User X liked your project Y"
- **Comment**: "User X commented on your project Y"
- **Reply**: "User X replied to your comment"
- **Follow**: "User X started following you"
- **Remix**: "User X remixed your project Y"
- **Mention**: "User X mentioned you in a comment"
- **Collaboration**: "User X invited you to collaborate"

#### Notification Item Design
- **Avatar**: User avatar
- **Icon**: Type-specific icon (heart, comment, follow, etc.)
- **Message**: Formatted notification text
- **Timestamp**: Relative time (2h ago, yesterday)
- **Action Button**: "View Project", "Reply", etc.
- **Unread Indicator**: Blue dot

---

## ⚡ Real-time Özellikler

### WebSocket Events

```typescript
// Client → Server
interface ClientEvents {
  'notifications:subscribe': { userId: string };
  'notifications:unsubscribe': { userId: string };
  'feed:subscribe': { userId: string, filters: FeedFilters };
}

// Server → Client
interface ServerEvents {
  'notification:new': Notification;
  'notification:read': { notificationId: string };
  'project:liked': { projectId: string, likeCount: number };
  'project:commented': { projectId: string, commentCount: number };
  'user:followed': { userId: string, followerCount: number };
}
```

### WebSocket Implementation

```typescript
// client/src/services/websocketService.js
class WebSocketService {
  connect(userId: string) {
    this.socket = io(WS_URL, {
      auth: { userId },
      transports: ['websocket']
    });
    
    this.socket.on('notification:new', (notification) => {
      this.handleNewNotification(notification);
    });
  }
  
  subscribeToNotifications(userId: string) {
    this.socket.emit('notifications:subscribe', { userId });
  }
}
```

---

## 🎯 Geliştirme Aşamaları

### Phase 1: Temel Altyapı (1-2 hafta)
- [ ] Database schema eklemeleri
- [ ] Backend API endpoints (Feed, Interactions, Notifications)
- [ ] Basic authentication & authorization
- [ ] WebSocket server setup

### Phase 2: Feed Sistemi (2-3 hafta)
- [ ] FeedView component
- [ ] ProjectCard component
- [ ] Feed filtering & sorting
- [ ] Pagination
- [ ] Infinite scroll
- [ ] Feed preferences

### Phase 3: Interaksiyonlar (2-3 hafta)
- [ ] Like functionality
- [ ] Comment system (nested comments)
- [ ] Share functionality
- [ ] Remix functionality
- [ ] Follow/unfollow
- [ ] Interaction counters

### Phase 4: Bildirimler (2-3 hafta)
- [ ] Notification system backend
- [ ] NotificationList component
- [ ] NotificationItem component
- [ ] Real-time notifications (WebSocket)
- [ ] Notification filters
- [ ] Notification settings
- [ ] Mark as read/unread

### Phase 5: Gelişmiş Özellikler (2-3 hafta)
- [ ] Trending algorithm
- [ ] Feed personalization
- [ ] Search functionality
- [ ] Analytics (views, engagement)
- [ ] Moderation tools
- [ ] Report/flag content

### Phase 6: Optimizasyon & Polish (1-2 hafta)
- [ ] Performance optimization
- [ ] Caching strategy
- [ ] Image optimization
- [ ] Loading states
- [ ] Error handling
- [ ] Accessibility
- [ ] Mobile responsiveness

---

## 🔧 Teknik Detaylar

### State Management

```typescript
// client/src/store/useMediaPanelStore.js
interface MediaPanelState {
  // Feed
  feed: {
    projects: Project[];
    loading: boolean;
    error: string | null;
    filters: FeedFilters;
    pagination: Pagination;
  };
  
  // Interactions
  interactions: {
    likes: Project[];
    comments: Comment[];
    shares: Project[];
    remixes: Project[];
  };
  
  // Notifications
  notifications: {
    items: Notification[];
    unreadCount: number;
    loading: boolean;
    filters: NotificationFilters;
  };
}
```

### API Service

```typescript
// client/src/services/mediaPanelService.js
class MediaPanelService {
  async getFeed(filters: FeedFilters): Promise<FeedResponse> {
    return apiClient.get('/api/feed', { params: filters });
  }
  
  async likeProject(projectId: string): Promise<LikeResponse> {
    return apiClient.post(`/api/projects/${projectId}/like`);
  }
  
  async commentProject(projectId: string, content: string): Promise<CommentResponse> {
    return apiClient.post(`/api/projects/${projectId}/comments`, { content });
  }
  
  async getNotifications(filters: NotificationFilters): Promise<NotificationsResponse> {
    return apiClient.get('/api/notifications', { params: filters });
  }
}
```

### Performance Optimizations

1. **Virtual Scrolling**: Feed için react-window veya react-virtual
2. **Image Lazy Loading**: Intersection Observer API
3. **Caching**: React Query veya SWR
4. **Debouncing**: Search ve filter inputs
5. **Optimistic Updates**: Like, follow gibi hızlı işlemler

---

## 📊 Analytics & Metrics

### Track Edilecek Metrikler

- Feed engagement rate
- Like/comment/share rates
- Notification open rate
- User retention
- Trending project performance
- Time spent in feed

### Analytics Events

```typescript
analytics.track('feed_viewed', { filter: 'trending' });
analytics.track('project_liked', { projectId, userId });
analytics.track('notification_clicked', { notificationType });
analytics.track('remix_created', { originalProjectId, remixProjectId });
```

---

## 🚀 Deployment Checklist

- [ ] Database migrations
- [ ] Environment variables
- [ ] WebSocket server configuration
- [ ] CDN for images
- [ ] Rate limiting
- [ ] CORS configuration
- [ ] Error monitoring (Sentry)
- [ ] Performance monitoring
- [ ] Security audit

---

## 📝 Notlar

- **Privacy**: Kullanıcılar feed'lerini özelleştirebilmeli
- **Moderation**: İçerik raporlama ve moderasyon sistemi
- **Accessibility**: WCAG 2.1 AA uyumluluğu
- **Internationalization**: Çoklu dil desteği (gelecek)
- **Mobile**: Responsive design, touch gestures

---

**Son Güncelleme:** 2025-01-XX  
**Hazırlayan:** AI Assistant  
**Durum:** 📋 Planlama Tamamlandı - Geliştirmeye Hazır

