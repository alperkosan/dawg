-- UP
-- Collaboration and community features tables

-- Project collaborators table
CREATE TABLE IF NOT EXISTS project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role
  role VARCHAR(50) NOT NULL DEFAULT 'editor',
  
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

-- Live sessions table
CREATE TABLE IF NOT EXISTS live_sessions (
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
CREATE INDEX idx_live_sessions_status ON live_sessions(status) WHERE status = 'live';

-- Session viewers table
CREATE TABLE IF NOT EXISTS session_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
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

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role types
  role_type VARCHAR(50) NOT NULL,
  
  -- Role-specific data
  role_data JSONB DEFAULT '{}'::jsonb,
  
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
CREATE INDEX idx_user_roles_verified ON user_roles(role_type, is_verified) WHERE is_verified = true;

-- Collaboration requests table
CREATE TABLE IF NOT EXISTS collaboration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Request info
  message TEXT,
  requested_role VARCHAR(50) DEFAULT 'editor',
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_collaboration_requests_from_user ON collaboration_requests(from_user_id);
CREATE INDEX idx_collaboration_requests_to_user ON collaboration_requests(to_user_id);
CREATE INDEX idx_collaboration_requests_status ON collaboration_requests(status);

-- DOWN
DROP TABLE IF EXISTS collaboration_requests;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS session_viewers;
DROP TABLE IF EXISTS live_sessions;
DROP TABLE IF EXISTS project_collaborators;

