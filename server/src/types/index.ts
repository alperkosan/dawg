/**
 * TypeScript type definitions
 */

export interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  displayName?: string; // Alias for display_name
  avatar_url?: string;
  avatarUrl?: string; // Alias for avatar_url
  bio?: string;
  is_verified: boolean;
  isVerified?: boolean; // Alias
  is_active: boolean;
  isActive?: boolean; // Alias
  password_hash?: string; // Only included when needed
  created_at: Date;
  createdAt?: Date; // Alias
  updated_at: Date;
  updatedAt?: Date; // Alias
  last_login?: Date;
  lastLogin?: Date; // Alias
  settings?: Record<string, any>;
}

export interface Project {
  id: string;
  user_id: string;
  userId?: string; // Alias
  title: string;
  description?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string; // Alias
  bpm: number;
  key_signature?: string;
  keySignature?: string; // Alias
  time_signature: string;
  timeSignature?: string; // Alias
  project_data: Record<string, any>; // Serialized project state
  projectData?: Record<string, any>; // Alias
  version: number;
  is_public: boolean;
  isPublic?: boolean; // Alias
  is_unlisted: boolean;
  isUnlisted?: boolean; // Alias
  share_token?: string;
  shareToken?: string; // Alias
  play_count: number;
  playCount?: number; // Alias
  like_count: number;
  likeCount?: number; // Alias
  remix_count: number;
  remixCount?: number; // Alias
  created_at: Date;
  createdAt?: Date; // Alias
  updated_at: Date;
  updatedAt?: Date; // Alias
  published_at?: Date;
  publishedAt?: Date; // Alias
  deleted_at?: Date;
  deletedAt?: Date; // Alias
  preview_audio_url?: string;
  previewAudioUrl?: string; // Alias
  preview_audio_duration?: number;
  previewAudioDuration?: number; // Alias
  preview_audio_rendered_at?: Date;
  previewAudioRenderedAt?: Date; // Alias
  preview_audio_status?: 'pending' | 'rendering' | 'ready' | 'failed';
  previewAudioStatus?: 'pending' | 'rendering' | 'ready' | 'failed'; // Alias
}

export interface ProjectAsset {
  id: string;
  projectId?: string;
  userId: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  durationSeconds?: number;
  storageKey: string;
  storageUrl: string;
  storageProvider: string;
  metadata: Record<string, any>;
  isProcessed: boolean;
  processingStatus: string;
  thumbnailUrl?: string;
  waveformData?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectShare {
  id: string;
  projectId: string;
  userId: string;
  shareToken: string;
  accessLevel: 'view' | 'remix' | 'edit';
  isPublic: boolean;
  isUnlisted: boolean;
  expiresAt?: Date;
  passwordHash?: string;
  viewCount: number;
  remixCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectInteraction {
  id: string;
  projectId: string;
  userId: string;
  interactionType: 'like' | 'remix' | 'play' | 'comment';
  data: Record<string, any>;
  createdAt: Date;
}

export interface LiveSession {
  id: string;
  projectId?: string;
  hostId: string;
  title: string;
  description?: string;
  sessionToken: string;
  isPublic: boolean;
  maxViewers: number;
  allowChat: boolean;
  allowVoice: boolean;
  status: 'pending' | 'live' | 'ended' | 'archived';
  viewerCount: number;
  peakViewers: number;
  durationSeconds: number;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCollaborator {
  id: string;
  projectId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer' | 'commenter';
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canExport: boolean;
  isActive: boolean;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// System Assets Types
export interface SystemAssetCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parentId?: string;
  parent_id?: string; // Alias
  sortOrder: number;
  sort_order?: number; // Alias
  createdAt: Date;
  created_at?: Date; // Alias
  updatedAt: Date;
  updated_at?: Date; // Alias
}

export interface SystemAssetPack {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverImageUrl?: string;
  cover_image_url?: string; // Alias
  isFree: boolean;
  is_free?: boolean; // Alias
  price?: number;
  currency: string;
  categoryId?: string;
  category_id?: string; // Alias
  tags?: string[];
  assetCount: number;
  asset_count?: number; // Alias
  downloadCount: number;
  download_count?: number; // Alias
  isActive: boolean;
  is_active?: boolean; // Alias
  isFeatured: boolean;
  is_featured?: boolean; // Alias
  createdBy?: string;
  created_by?: string; // Alias
  createdAt: Date;
  created_at?: Date; // Alias
  updatedAt: Date;
  updated_at?: Date; // Alias
}

export interface SystemAsset {
  id: string;
  categoryId?: string;
  category_id?: string; // Alias
  name: string;
  filename: string;
  description?: string;
  storageKey: string;
  storage_key?: string; // Alias
  storageUrl: string;
  storage_url?: string; // Alias
  storageProvider: string;
  storage_provider?: string; // Alias
  fileSize: number;
  file_size?: number; // Alias
  mimeType: string;
  mime_type?: string; // Alias
  bpm?: number;
  keySignature?: string;
  key_signature?: string; // Alias
  timeSignature: string;
  time_signature?: string; // Alias
  tags?: string[];
  durationSeconds?: number;
  duration_seconds?: number; // Alias
  sampleRate?: number;
  sample_rate?: number; // Alias
  bitDepth?: number;
  bit_depth?: number; // Alias
  channels?: number;
  packId?: string;
  pack_id?: string; // Alias
  packName?: string;
  pack_name?: string; // Alias
  sortOrder: number;
  sort_order?: number; // Alias
  isActive: boolean;
  is_active?: boolean; // Alias
  isPremium: boolean;
  is_premium?: boolean; // Alias
  isFeatured: boolean;
  is_featured?: boolean; // Alias
  downloadCount: number;
  download_count?: number; // Alias
  usageCount: number;
  usage_count?: number; // Alias
  lastUsedAt?: Date;
  last_used_at?: Date; // Alias
  version: number;
  previousVersionId?: string;
  previous_version_id?: string; // Alias
  thumbnailUrl?: string;
  thumbnail_url?: string; // Alias
  waveformData?: Record<string, any>;
  waveform_data?: Record<string, any>; // Alias
  previewUrl?: string;
  preview_url?: string; // Alias
  metadata?: Record<string, any>;
  createdBy?: string;
  created_by?: string; // Alias
  createdAt: Date;
  created_at?: Date; // Alias
  updatedAt: Date;
  updated_at?: Date; // Alias
}

export interface SystemAssetUsage {
  id: string;
  assetId: string;
  asset_id?: string; // Alias
  userId: string;
  user_id?: string; // Alias
  projectId?: string;
  project_id?: string; // Alias
  usageType: 'loaded' | 'used_in_project' | 'exported';
  usage_type?: 'loaded' | 'used_in_project' | 'exported'; // Alias
  usageCount: number;
  usage_count?: number; // Alias
  firstUsedAt: Date;
  first_used_at?: Date; // Alias
  lastUsedAt: Date;
  last_used_at?: Date; // Alias
}

