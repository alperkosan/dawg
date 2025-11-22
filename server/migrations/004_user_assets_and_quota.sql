-- UP
-- User assets table for file browser
-- Stores user-uploaded audio files with quota management

-- User storage quota table
CREATE TABLE IF NOT EXISTS user_storage_quota (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  quota_bytes BIGINT NOT NULL DEFAULT 1073741824, -- 1GB default
  used_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_storage_quota_user_id ON user_storage_quota(user_id);

-- User assets table (separate from project_assets)
-- These are files uploaded to file browser, not tied to specific projects
CREATE TABLE IF NOT EXISTS user_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- File info
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  duration_seconds DECIMAL(10, 2),
  
  -- Storage
  storage_key TEXT NOT NULL, -- S3/MinIO key: "user-assets/{user_id}/{asset_id}.wav"
  storage_url TEXT NOT NULL, -- CDN URL or presigned URL
  storage_provider VARCHAR(50) DEFAULT 'minio',
  storage_bucket VARCHAR(100) DEFAULT 'dawg-audio',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  -- {
  --   sampleRate: 44100,
  --   bitDepth: 16,
  --   channels: 2,
  --   format: "wav",
  --   codec: "PCM"
  -- }
  
  -- File browser organization
  folder_path TEXT DEFAULT '/', -- Virtual folder path in file browser
  parent_folder_id UUID REFERENCES user_assets(id) ON DELETE SET NULL, -- For folder structure
  
  -- Processing
  is_processed BOOLEAN DEFAULT false,
  processing_status VARCHAR(50) DEFAULT 'pending',
  -- 'pending', 'uploading', 'processing', 'completed', 'failed'
  processing_error TEXT,
  
  -- Thumbnail
  thumbnail_url TEXT,
  waveform_data JSONB, -- Waveform points for visualization
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_user_assets_user_id ON user_assets(user_id);
CREATE INDEX idx_user_assets_folder_path ON user_assets(user_id, folder_path);
CREATE INDEX idx_user_assets_parent_folder_id ON user_assets(parent_folder_id);
CREATE INDEX idx_user_assets_created_at ON user_assets(created_at DESC);

-- Function to update user quota when asset is created/deleted
CREATE OR REPLACE FUNCTION update_user_storage_quota()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Add to used_bytes
    INSERT INTO user_storage_quota (user_id, quota_bytes, used_bytes)
    VALUES (NEW.user_id, 1073741824, NEW.file_size)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      used_bytes = user_storage_quota.used_bytes + NEW.file_size,
      updated_at = NOW();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Subtract from used_bytes
    UPDATE user_storage_quota
    SET used_bytes = GREATEST(0, used_bytes - OLD.file_size),
        updated_at = NOW()
    WHERE user_id = OLD.user_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle file size changes
    IF OLD.file_size != NEW.file_size THEN
      UPDATE user_storage_quota
      SET used_bytes = GREATEST(0, used_bytes - OLD.file_size + NEW.file_size),
          updated_at = NOW()
      WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update quota
CREATE TRIGGER trigger_update_user_storage_quota
  AFTER INSERT OR UPDATE OR DELETE ON user_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_user_storage_quota();

-- Initialize quota for existing users
INSERT INTO user_storage_quota (user_id, quota_bytes, used_bytes)
SELECT id, 1073741824, 0
FROM users
ON CONFLICT (user_id) DO NOTHING;

