-- UP
-- Preset Library: Universal preset sharing for all instruments and effects
-- Integrates with existing users table

-- Presets table
CREATE TABLE IF NOT EXISTS presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Type & Category
  preset_type VARCHAR(50) NOT NULL CHECK (preset_type IN ('instrument', 'effect')),
  engine_type VARCHAR(50) NOT NULL, -- 'zenith', 'vasynth', 'reverb', 'eq', 'compressor', etc.
  category VARCHAR(50), -- 'bass', 'lead', 'pad', 'fx', 'keys', etc.
  
  -- Preset Data (JSONB for flexible schema)
  preset_data JSONB NOT NULL,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  genre VARCHAR(50), -- 'edm', 'hiphop', 'ambient', 'cinematic', etc.
  
  -- Stats
  downloads_count INTEGER DEFAULT 0,
  rating_avg DECIMAL(3,2) DEFAULT 0.0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  rating_count INTEGER DEFAULT 0,
  
  -- Visibility
  is_public BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- Moderation
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for presets
CREATE INDEX idx_presets_user_id ON presets(user_id);
CREATE INDEX idx_presets_engine_type ON presets(engine_type);
CREATE INDEX idx_presets_category ON presets(category);
CREATE INDEX idx_presets_preset_type ON presets(preset_type);
CREATE INDEX idx_presets_tags ON presets USING GIN(tags);
CREATE INDEX idx_presets_rating ON presets(rating_avg DESC, rating_count DESC);
CREATE INDEX idx_presets_downloads ON presets(downloads_count DESC);
CREATE INDEX idx_presets_created_at ON presets(created_at DESC);
CREATE INDEX idx_presets_public ON presets(is_public) WHERE is_public = true;
CREATE INDEX idx_presets_featured ON presets(is_featured) WHERE is_featured = true;

-- Full-text search index
CREATE INDEX idx_presets_search ON presets USING GIN(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
);

-- Preset ratings table
CREATE TABLE IF NOT EXISTS preset_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- One rating per user per preset
  UNIQUE(preset_id, user_id)
);

CREATE INDEX idx_preset_ratings_preset_id ON preset_ratings(preset_id);
CREATE INDEX idx_preset_ratings_user_id ON preset_ratings(user_id);

-- User preset downloads (track what user downloaded)
CREATE TABLE IF NOT EXISTS user_preset_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP DEFAULT NOW(),
  
  -- One download record per user per preset
  UNIQUE(user_id, preset_id)
);

CREATE INDEX idx_user_preset_downloads_user_id ON user_preset_downloads(user_id);
CREATE INDEX idx_user_preset_downloads_preset_id ON user_preset_downloads(preset_id);
CREATE INDEX idx_user_preset_downloads_downloaded_at ON user_preset_downloads(downloaded_at DESC);

-- Preset collections (curated preset packs)
CREATE TABLE IF NOT EXISTS preset_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Collection info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  
  -- Preset IDs (array of UUIDs)
  preset_ids UUID[] DEFAULT '{}',
  
  -- Visibility
  is_public BOOLEAN DEFAULT false,
  
  -- Stats
  downloads_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_preset_collections_user_id ON preset_collections(user_id);
CREATE INDEX idx_preset_collections_public ON preset_collections(is_public) WHERE is_public = true;
CREATE INDEX idx_preset_collections_downloads ON preset_collections(downloads_count DESC);

-- Trigger to update preset rating average
CREATE OR REPLACE FUNCTION update_preset_rating_avg()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE presets
  SET 
    rating_avg = (
      SELECT COALESCE(AVG(rating), 0)
      FROM preset_ratings
      WHERE preset_id = NEW.preset_id
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM preset_ratings
      WHERE preset_id = NEW.preset_id
    ),
    updated_at = NOW()
  WHERE id = NEW.preset_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_preset_rating_avg
AFTER INSERT OR UPDATE OR DELETE ON preset_ratings
FOR EACH ROW
EXECUTE FUNCTION update_preset_rating_avg();

-- Trigger to increment download count
CREATE OR REPLACE FUNCTION increment_preset_downloads()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE presets
  SET 
    downloads_count = downloads_count + 1,
    updated_at = NOW()
  WHERE id = NEW.preset_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_preset_downloads
AFTER INSERT ON user_preset_downloads
FOR EACH ROW
EXECUTE FUNCTION increment_preset_downloads();

-- DOWN
DROP TRIGGER IF EXISTS trigger_increment_preset_downloads ON user_preset_downloads;
DROP TRIGGER IF EXISTS trigger_update_preset_rating_avg ON preset_ratings;
DROP FUNCTION IF EXISTS increment_preset_downloads();
DROP FUNCTION IF EXISTS update_preset_rating_avg();
DROP TABLE IF EXISTS preset_collections;
DROP TABLE IF EXISTS user_preset_downloads;
DROP TABLE IF EXISTS preset_ratings;
DROP TABLE IF EXISTS presets;
