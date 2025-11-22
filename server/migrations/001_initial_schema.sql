-- UP
-- Initial database schema
-- Creates core tables: users, sessions, projects, project_assets, project_shares, project_interactions

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  settings JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Sessions table (Refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(255) UNIQUE NOT NULL,
  device_info JSONB,
  ip_address INET,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  bpm INTEGER DEFAULT 120,
  key_signature VARCHAR(10),
  time_signature VARCHAR(10) DEFAULT '4/4',
  
  -- Project state (JSONB for flexible schema)
  project_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Metadata
  version INTEGER DEFAULT 1,
  is_public BOOLEAN DEFAULT false,
  is_unlisted BOOLEAN DEFAULT false,
  share_token VARCHAR(64) UNIQUE,
  
  -- Stats
  play_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  remix_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  
  -- Soft delete
  deleted_at TIMESTAMP
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_share_token ON projects(share_token);
CREATE INDEX idx_projects_public ON projects(is_public) WHERE is_public = true;
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_projects_project_data ON projects USING GIN (project_data);

-- Project assets table
CREATE TABLE IF NOT EXISTS project_assets (
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
  storage_key TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  storage_provider VARCHAR(50) DEFAULT 'minio',
  storage_bucket VARCHAR(100) DEFAULT 'dawg-audio',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Processing
  is_processed BOOLEAN DEFAULT false,
  processing_status VARCHAR(50) DEFAULT 'pending',
  processing_error TEXT,
  
  -- Thumbnail
  thumbnail_url TEXT,
  waveform_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_project_assets_project_id ON project_assets(project_id);
CREATE INDEX idx_project_assets_user_id ON project_assets(user_id);
CREATE INDEX idx_project_assets_storage_key ON project_assets(storage_key);
CREATE INDEX idx_project_assets_processing_status ON project_assets(processing_status);

-- Project shares table
CREATE TABLE IF NOT EXISTS project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Share settings
  share_token VARCHAR(64) UNIQUE NOT NULL,
  access_level VARCHAR(50) DEFAULT 'view',
  
  -- Visibility
  is_public BOOLEAN DEFAULT false,
  is_unlisted BOOLEAN DEFAULT false,
  
  -- Expiration
  expires_at TIMESTAMP,
  
  -- Password protection
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
CREATE INDEX idx_project_shares_public ON project_shares(is_public) WHERE is_public = true;

-- Project interactions table
CREATE TABLE IF NOT EXISTS project_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Interaction type
  interaction_type VARCHAR(50) NOT NULL,
  
  -- Data
  data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint: one like per user per project
  UNIQUE(project_id, user_id, interaction_type)
);

CREATE INDEX idx_project_interactions_project_id ON project_interactions(project_id);
CREATE INDEX idx_project_interactions_user_id ON project_interactions(user_id);
CREATE INDEX idx_project_interactions_type ON project_interactions(interaction_type);
CREATE INDEX idx_project_interactions_created_at ON project_interactions(created_at DESC);

-- DOWN
DROP TABLE IF EXISTS project_interactions;
DROP TABLE IF EXISTS project_shares;
DROP TABLE IF EXISTS project_assets;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

