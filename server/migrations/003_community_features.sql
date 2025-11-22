-- UP
-- Community features: charts, discovery, comments, remixes

-- Weekly charts table
CREATE TABLE IF NOT EXISTS weekly_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Chart data
  chart_data JSONB NOT NULL,
  
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

-- Discovery feed table
CREATE TABLE IF NOT EXISTS discovery_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Feed type
  feed_type VARCHAR(50) NOT NULL,
  
  -- Feed data
  feed_items JSONB NOT NULL,
  
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

-- Project comments table
CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES project_comments(id) ON DELETE CASCADE,
  
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

-- Project remixes table
CREATE TABLE IF NOT EXISTS project_remixes (
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

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- DOWN
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS project_remixes;
DROP TABLE IF EXISTS project_comments;
DROP TABLE IF EXISTS discovery_feed;
DROP TABLE IF EXISTS weekly_charts;

