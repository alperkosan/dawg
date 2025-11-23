-- UP
-- Add preview audio fields to projects table

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS preview_audio_url TEXT,
ADD COLUMN IF NOT EXISTS preview_audio_duration INTEGER, -- seconds
ADD COLUMN IF NOT EXISTS preview_audio_rendered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS preview_audio_status VARCHAR(20) DEFAULT 'pending'; -- 'pending', 'rendering', 'ready', 'failed'

CREATE INDEX IF NOT EXISTS idx_projects_preview_status ON projects(preview_audio_status) WHERE preview_audio_status = 'ready';
CREATE INDEX IF NOT EXISTS idx_projects_preview_ready ON projects(id) WHERE preview_audio_status = 'ready' AND is_public = true;

-- DOWN
-- ALTER TABLE projects 
-- DROP COLUMN IF EXISTS preview_audio_url,
-- DROP COLUMN IF EXISTS preview_audio_duration,
-- DROP COLUMN IF EXISTS preview_audio_rendered_at,
-- DROP COLUMN IF EXISTS preview_audio_status;

-- DROP INDEX IF EXISTS idx_projects_preview_status;
-- DROP INDEX IF EXISTS idx_projects_preview_ready;

