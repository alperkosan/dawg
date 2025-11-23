-- UP
-- Media Panel Phase 1: Additional tables for feed, interactions, and notifications

-- Project shares table
CREATE TABLE IF NOT EXISTS project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50), -- 'twitter', 'facebook', 'copy_link', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_user_id ON project_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_created_at ON project_shares(created_at DESC);

-- User follows table
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_created_at ON user_follows(created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_project_views_project_id ON project_views(project_id);
CREATE INDEX IF NOT EXISTS idx_project_views_user_id ON project_views(user_id);
CREATE INDEX IF NOT EXISTS idx_project_views_created_at ON project_views(created_at DESC);

-- Project likes table (if not exists in 003_community_features.sql)
-- Check if project_likes exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_likes') THEN
    CREATE TABLE project_likes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(project_id, user_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_project_likes_project_id ON project_likes(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_likes_user_id ON project_likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_project_likes_created_at ON project_likes(created_at DESC);
  END IF;
END $$;

-- DOWN
DROP TABLE IF EXISTS project_views;
DROP TABLE IF EXISTS feed_preferences;
DROP TABLE IF EXISTS user_follows;
DROP TABLE IF EXISTS project_shares;

