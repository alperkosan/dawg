-- UP
-- Migration: System Assets Management
-- Description: Tables for managing system assets (DAWG Library) with metadata, packs, and categories
-- Date: 2025-01-XX

-- System Asset Categories (hierarchical)
CREATE TABLE IF NOT EXISTS system_asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(255),
  parent_id UUID REFERENCES system_asset_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- System Asset Packs (Collections)
CREATE TABLE IF NOT EXISTS system_asset_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  cover_image_url VARCHAR(500),
  
  -- Pricing
  is_free BOOLEAN DEFAULT true,
  price DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Organization
  category_id UUID REFERENCES system_asset_categories(id) ON DELETE SET NULL,
  tags TEXT[],
  
  -- Stats
  asset_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- System Assets (Premium/Admin-managed)
CREATE TABLE IF NOT EXISTS system_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES system_asset_categories(id) ON DELETE SET NULL,
  
  -- Basic Info
  name VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Storage
  storage_key VARCHAR(500) NOT NULL, -- S3/MinIO key
  storage_url VARCHAR(500) NOT NULL,  -- CDN URL
  storage_provider VARCHAR(50) DEFAULT 'minio',
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  
  -- Metadata
  bpm INTEGER,
  key_signature VARCHAR(10), -- e.g., "C", "Am", "F#m"
  time_signature VARCHAR(10) DEFAULT '4/4',
  tags TEXT[], -- Array of tags
  duration_seconds DECIMAL(10, 3),
  
  -- Audio Properties
  sample_rate INTEGER,
  bit_depth INTEGER,
  channels INTEGER,
  
  -- Organization
  pack_id UUID REFERENCES system_asset_packs(id) ON DELETE SET NULL,
  pack_name VARCHAR(255), -- Denormalized for performance
  sort_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  
  -- Analytics
  download_count INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  
  -- Versioning
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES system_assets(id) ON DELETE SET NULL,
  
  -- Thumbnails/Previews
  thumbnail_url VARCHAR(500),
  waveform_data JSONB, -- Waveform visualization data
  preview_url VARCHAR(500), -- 30-second preview clip
  
  -- Metadata
  metadata JSONB, -- Additional flexible metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin who uploaded
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- System Asset Usage Tracking
CREATE TABLE IF NOT EXISTS system_asset_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES system_assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  usage_type VARCHAR(50), -- 'loaded', 'used_in_project', 'exported'
  usage_count INTEGER DEFAULT 1,
  
  first_used_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(asset_id, user_id, usage_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_assets_category ON system_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_system_assets_pack ON system_assets(pack_id);
CREATE INDEX IF NOT EXISTS idx_system_assets_tags ON system_assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_system_assets_active ON system_assets(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_system_assets_featured ON system_assets(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_system_assets_bpm ON system_assets(bpm) WHERE bpm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_assets_key ON system_assets(key_signature) WHERE key_signature IS NOT NULL;

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_system_assets_search ON system_assets USING GIN(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
);

-- Indexes for packs
CREATE INDEX IF NOT EXISTS idx_system_asset_packs_category ON system_asset_packs(category_id);
CREATE INDEX IF NOT EXISTS idx_system_asset_packs_active ON system_asset_packs(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_system_asset_packs_featured ON system_asset_packs(is_featured) WHERE is_featured = true;

-- Indexes for categories
CREATE INDEX IF NOT EXISTS idx_system_asset_categories_parent ON system_asset_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_system_asset_categories_slug ON system_asset_categories(slug);

-- Indexes for usage tracking
CREATE INDEX IF NOT EXISTS idx_system_asset_usage_asset ON system_asset_usage(asset_id);
CREATE INDEX IF NOT EXISTS idx_system_asset_usage_user ON system_asset_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_system_asset_usage_project ON system_asset_usage(project_id);

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_system_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_assets_updated_at
  BEFORE UPDATE ON system_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_system_assets_updated_at();

CREATE TRIGGER trigger_update_system_asset_packs_updated_at
  BEFORE UPDATE ON system_asset_packs
  FOR EACH ROW
  EXECUTE FUNCTION update_system_assets_updated_at();

CREATE TRIGGER trigger_update_system_asset_categories_updated_at
  BEFORE UPDATE ON system_asset_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_system_assets_updated_at();

-- Function to update pack asset count
CREATE OR REPLACE FUNCTION update_pack_asset_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE system_asset_packs
    SET asset_count = asset_count + 1
    WHERE id = NEW.pack_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE system_asset_packs
    SET asset_count = GREATEST(0, asset_count - 1)
    WHERE id = OLD.pack_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.pack_id != NEW.pack_id THEN
      -- Decrease old pack count
      UPDATE system_asset_packs
      SET asset_count = GREATEST(0, asset_count - 1)
      WHERE id = OLD.pack_id;
      -- Increase new pack count
      UPDATE system_asset_packs
      SET asset_count = asset_count + 1
      WHERE id = NEW.pack_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pack_asset_count
  AFTER INSERT OR UPDATE OR DELETE ON system_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_pack_asset_count();

-- Insert default categories
INSERT INTO system_asset_categories (name, slug, description, sort_order) VALUES
  ('Drums', 'drums', 'Drum samples and one-shots', 1),
  ('Instruments', 'instruments', 'Musical instrument samples', 2),
  ('Loops', 'loops', 'Pre-made audio loops', 3),
  ('Vocals', 'vocals', 'Vocal samples and phrases', 4),
  ('FX', 'fx', 'Sound effects and risers', 5),
  ('Percussion', 'percussion', 'Percussion samples', 6)
ON CONFLICT (slug) DO NOTHING;

-- Insert default free pack
INSERT INTO system_asset_packs (name, slug, description, is_free, is_active, is_featured)
VALUES ('DAWG Default Pack', 'dawg-default', 'Default free sample pack included with DAWG', true, true, true)
ON CONFLICT (slug) DO NOTHING;

