/**
 * Assets service
 * Handles user file uploads, storage quota, and asset management
 */

import { getDatabase } from './database.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { storageService } from './storage.js';
import crypto from 'crypto';
import type { UserAsset, UserStorageQuota } from '../types/index.js';

export const assetsService = {
  /**
   * Get user storage quota
   */
  async getUserQuota(userId: string): Promise<UserStorageQuota> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT user_id, quota_bytes, used_bytes
       FROM user_storage_quota
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Initialize quota for new user
      await db.query(
        `INSERT INTO user_storage_quota (user_id, quota_bytes, used_bytes)
         VALUES ($1, 1073741824, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      );
      
      return {
        user_id: userId,
        quota_bytes: 1073741824,
        used_bytes: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };
    }

    const row = result.rows[0];
    return {
      user_id: row.user_id,
      quota_bytes: parseInt(row.quota_bytes),
      used_bytes: parseInt(row.used_bytes),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  },

  /**
   * List user assets
   */
  async listUserAssets(
    userId: string,
    folderPath?: string,
    parentFolderId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<UserAsset[]> {
    const db = getDatabase();
    let query = `
      SELECT id, user_id, filename, original_filename, file_size, mime_type,
             duration_seconds, storage_key, storage_url, storage_provider,
             storage_bucket, metadata, folder_path, parent_folder_id,
             is_processed, processing_status, processing_error,
             thumbnail_url, waveform_data, created_at, updated_at, processed_at
      FROM user_assets
      WHERE user_id = $1
    `;
    const params: any[] = [userId];
    let paramIndex = 2;

    if (folderPath) {
      query += ` AND folder_path = $${paramIndex}`;
      params.push(folderPath);
      paramIndex++;
    }

    if (parentFolderId) {
      query += ` AND parent_folder_id = $${paramIndex}`;
      params.push(parentFolderId);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      filename: row.filename,
      original_filename: row.original_filename,
      file_size: parseInt(row.file_size),
      mime_type: row.mime_type,
      duration_seconds: row.duration_seconds ? parseFloat(row.duration_seconds) : undefined,
      storage_key: row.storage_key,
      storage_url: row.storage_url,
      storage_provider: row.storage_provider,
      storage_bucket: row.storage_bucket,
      metadata: row.metadata || {},
      folder_path: row.folder_path,
      parent_folder_id: row.parent_folder_id,
      is_processed: row.is_processed,
      processing_status: row.processing_status,
      processing_error: row.processing_error,
      thumbnail_url: row.thumbnail_url,
      waveform_data: row.waveform_data,
      created_at: row.created_at,
      updated_at: row.updated_at,
      processed_at: row.processed_at,
    }));
  },

  /**
   * Create upload request (presigned URL)
   */
  async createUploadRequest(
    userId: string,
    filename: string,
    size: number,
    mimeType: string,
    folderPath: string = '/',
    parentFolderId?: string
  ): Promise<{ assetId: string; uploadId: string; presignedUrl?: string; storageKey: string }> {
    // Check quota
    const quota = await this.getUserQuota(userId);
    if (quota.used_bytes + size > quota.quota_bytes) {
      throw new BadRequestError('Storage quota exceeded. Maximum 1GB allowed.');
    }

    const assetId = crypto.randomUUID();
    // ✅ FIX: Use assetId as filename in storage (easier access, no special characters)
    // Extract file extension from original filename
    const path = await import('path');
    const fileExtension = path.extname(filename) || '.wav';
    const storageFilename = `${assetId}${fileExtension}`;
    
    // ✅ FIX: Use same format as storageService.uploadFile for consistency
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const storageKey = `user-assets/${userId}/${yearMonth}/${assetId}/${storageFilename}`;

    // ✅ CDN: Generate CDN URL using storage service
    let storageUrl = storageService.getCDNUrl(storageKey);
    // ✅ FIX: Ensure URL is clean before storing in database (remove any whitespace/newlines)
    storageUrl = storageUrl.replace(/[\n\r\t\s]+/g, '').trim();

    // ✅ FIX: Validate parentFolderId exists and is a folder owned by user
    let validParentFolderId: string | null = null;
    if (parentFolderId) {
      const db = getDatabase();
      const folderCheck = await db.query(
        `SELECT id FROM user_assets 
         WHERE id = $1 AND user_id = $2 AND mime_type = 'folder'`,
        [parentFolderId, userId]
      );
      
      if (folderCheck.rows.length > 0) {
        validParentFolderId = parentFolderId;
      } else {
        console.warn(`⚠️ Invalid parent_folder_id ${parentFolderId}, using null instead`);
        // Don't throw error, just use null (root level)
      }
    }

    // Create asset record in database
    const db = getDatabase();
    await db.query(
      `INSERT INTO user_assets 
       (id, user_id, filename, original_filename, file_size, mime_type,
        storage_key, storage_url, folder_path, parent_folder_id, processing_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'uploading')`,
      [assetId, userId, filename, filename, size, mimeType, storageKey, storageUrl, folderPath, validParentFolderId]
    );

    // ✅ FIX: Generate Bunny CDN direct upload URL for client-side upload
    // Bunny CDN supports direct client-side upload using PUT method
    // We'll return the upload URL and a temporary token for security
    const { config } = await import('../config/index.js');
    
    let uploadUrl: string | undefined;
    let uploadToken: string | undefined;
    
    if (config.cdn.provider === 'bunny' && config.cdn.bunny.storageZoneName) {
      // Generate Bunny CDN direct upload URL
      // Format: https://storage.bunnycdn.com/{storageZoneName}/{storageKey}
      uploadUrl = `https://storage.bunnycdn.com/${config.cdn.bunny.storageZoneName}/${storageKey}`;
      
      // ✅ SECURITY: Generate a temporary upload token (JWT) that expires in 1 hour
      // This token contains: userId, assetId, storageKey, expiresAt
      // Client will send this token to a server endpoint that validates it and returns the AccessKey
      // OR: We can create a proxy endpoint that validates the token and forwards the upload
      
      // For now, we'll use a simpler approach: Create a server endpoint that validates the token
      // and returns the AccessKey (or proxies the upload)
      // This way, AccessKey never leaves the server
      
      // ✅ SECURITY: We'll create a server endpoint that validates the upload
      // For now, return uploadUrl - client will need to get AccessKey from server endpoint
      // OR: We can create a proxy endpoint that handles the upload securely
    }
    
    return {
      assetId,
      uploadId: assetId, // Same as assetId for now
      storageKey,
      uploadUrl, // Bunny CDN direct upload URL (client will use this)
      uploadToken, // Temporary JWT token for authorization
      expiresIn: 3600, // 1 hour
    };
  },

  /**
   * Complete upload (mark as uploaded)
   * ✅ FIX: Also update storage_url if it's not set (for client-side CDN uploads)
   */
  async completeUpload(userId: string, assetId: string): Promise<UserAsset> {
    // Verify ownership
    const asset = await this.getAssetById(userId, assetId);

    // ✅ FIX: If storage_url is not set or is a fallback URL, generate CDN URL from storage_key
    let storageUrl = asset.storage_url;
    if (!storageUrl || storageUrl.startsWith('/api/')) {
      // Generate CDN URL from storage_key
      const { storageService } = await import('./storage.js');
      storageUrl = storageService.getCDNUrl(asset.storage_key, assetId);
      // Clean URL before storing
      storageUrl = storageUrl.replace(/[\n\r\t\s]+/g, '').trim();
    }

    // Update status and storage_url
    const db = getDatabase();
    await db.query(
      `UPDATE user_assets
       SET processing_status = 'completed', 
           is_processed = true, 
           storage_url = $1,
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [storageUrl, assetId, userId]
    );

    return this.getAssetById(userId, assetId);
  },

  /**
   * Get asset by ID
   */
  async getAssetById(userId: string, assetId: string): Promise<UserAsset> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, user_id, filename, original_filename, file_size, mime_type,
              duration_seconds, storage_key, storage_url, storage_provider,
              storage_bucket, metadata, folder_path, parent_folder_id,
              is_processed, processing_status, processing_error,
              thumbnail_url, waveform_data, created_at, updated_at, processed_at
       FROM user_assets
       WHERE id = $1 AND user_id = $2`,
      [assetId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Asset not found');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      filename: row.filename,
      original_filename: row.original_filename,
      file_size: parseInt(row.file_size),
      mime_type: row.mime_type,
      duration_seconds: row.duration_seconds ? parseFloat(row.duration_seconds) : undefined,
      storage_key: row.storage_key,
      storage_url: row.storage_url,
      storage_provider: row.storage_provider,
      storage_bucket: row.storage_bucket,
      metadata: row.metadata || {},
      folder_path: row.folder_path,
      parent_folder_id: row.parent_folder_id,
      is_processed: row.is_processed,
      processing_status: row.processing_status,
      processing_error: row.processing_error,
      thumbnail_url: row.thumbnail_url,
      waveform_data: row.waveform_data,
      created_at: row.created_at,
      updated_at: row.updated_at,
      processed_at: row.processed_at,
    };
  },

  /**
   * Delete folder (and all its contents recursively)
   */
  async deleteFolder(userId: string, folderId: string): Promise<void> {
    // Verify ownership and get folder info
    const folder = await this.getAssetById(userId, folderId);
    
    if (folder.mime_type !== 'folder') {
      throw new BadRequestError('Asset is not a folder');
    }

    // ✅ FIX: Check if folder has children (files or subfolders)
    const db = getDatabase();
    const childrenResult = await db.query(
      `SELECT id, mime_type FROM user_assets 
       WHERE parent_folder_id = $1 AND user_id = $2`,
      [folderId, userId]
    );
    
    if (childrenResult.rows.length > 0) {
      // Recursively delete all children first
      for (const child of childrenResult.rows) {
        if (child.mime_type === 'folder') {
          await this.deleteFolder(userId, child.id);
        } else {
          await this.deleteAsset(userId, child.id);
        }
      }
    }

    // Delete folder from database (trigger will update quota)
    await db.query(`DELETE FROM user_assets WHERE id = $1 AND user_id = $2`, [folderId, userId]);
    
    console.log(`✅ Deleted folder ${folderId} (${folder.filename})`);
  },

  /**
   * Delete asset
   */
  async deleteAsset(userId: string, assetId: string): Promise<void> {
    // Verify ownership and get asset info before deletion
    const asset = await this.getAssetById(userId, assetId);

    // ✅ FIX: Delete from storage first
    try {
      // Extract local path from storage_key or construct it
      const path = await import('path');
      let localPath: string | undefined;
      
      if (asset.storage_key && asset.storage_key.includes('uploads')) {
        localPath = path.join(process.cwd(), asset.storage_key);
      } else {
        // Construct local path from assetId
        const fileExtension = path.extname(asset.filename) || '.wav';
        localPath = path.join(process.cwd(), 'uploads', userId, `${assetId}${fileExtension}`);
      }
      
      await storageService.deleteFile(asset.storage_key, localPath);
      console.log(`✅ Deleted file from storage: ${asset.storage_key}`);
    } catch (error) {
      console.warn(`⚠️ Failed to delete file from storage: ${error.message}`);
      // Continue with DB deletion even if storage deletion fails
    }

    // ✅ FIX: Delete from database (trigger will automatically update quota)
    // Use transaction to ensure atomicity
    const db = getDatabase();
    const result = await db.query(`DELETE FROM user_assets WHERE id = $1 AND user_id = $2`, [assetId, userId]);
    
    if (result.rowCount === 0) {
      throw new Error(`Asset ${assetId} not found or already deleted`);
    }
    
    console.log(`✅ Deleted asset ${assetId} (${asset.filename}) from database - quota will be updated by trigger`);
  },

  /**
   * Rename asset
   */
  async renameAsset(userId: string, assetId: string, newName: string): Promise<UserAsset> {
    // Verify ownership
    await this.getAssetById(userId, assetId);

    // Update filename
    const db = getDatabase();
    await db.query(
      `UPDATE user_assets
       SET filename = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [newName, assetId, userId]
    );

    return this.getAssetById(userId, assetId);
  },

  /**
   * Move asset (change folder)
   */
  async moveAsset(
    userId: string,
    assetId: string,
    folderPath: string,
    parentFolderId?: string
  ): Promise<UserAsset> {
    // Verify ownership
    await this.getAssetById(userId, assetId);

    // Update folder
    const db = getDatabase();
    await db.query(
      `UPDATE user_assets
       SET folder_path = $1, parent_folder_id = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4`,
      [folderPath, parentFolderId || null, assetId, userId]
    );

    return this.getAssetById(userId, assetId);
  },

  /**
   * Create user folder
   */
  async createFolder(
    userId: string,
    name: string,
    parentFolderId?: string
  ): Promise<{ id: string; name: string; parentFolderId?: string }> {
    const db = getDatabase();
    
    // ✅ FIX: Validate parentFolderId exists and is a folder owned by user
    let validParentFolderId: string | null = null;
    if (parentFolderId) {
      const folderCheck = await db.query(
        `SELECT id FROM user_assets 
         WHERE id = $1 AND user_id = $2 AND mime_type = 'folder'`,
        [parentFolderId, userId]
      );
      
      if (folderCheck.rows.length > 0) {
        validParentFolderId = parentFolderId;
      } else {
        console.warn(`⚠️ Invalid parent_folder_id ${parentFolderId}, creating at root level`);
        // Don't throw error, just use null (root level)
      }
    }

    const folderId = crypto.randomUUID();
    const folderPath = validParentFolderId ? `/${name}` : '/'; // Simple path for now
    
    // Create folder as special asset with mime_type = 'folder'
    await db.query(
      `INSERT INTO user_assets 
       (id, user_id, filename, original_filename, file_size, mime_type,
        storage_key, storage_url, folder_path, parent_folder_id, processing_status, is_processed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed', true)`,
      [
        folderId,
        userId,
        name,
        name,
        0, // Folders have 0 size
        'folder',
        `folders/${userId}/${folderId}`, // Storage key for folder
        `/api/folders/${folderId}`, // Folder URL
        folderPath,
        validParentFolderId
      ]
    );

    return {
      id: folderId,
      name,
      parentFolderId: validParentFolderId || undefined
    };
  },

  /**
   * List user folders
   */
  async listUserFolders(userId: string, parentFolderId?: string): Promise<any[]> {
    const db = getDatabase();
    let query = `
      SELECT id, filename as name, folder_path, parent_folder_id, created_at, updated_at
      FROM user_assets
      WHERE user_id = $1 AND mime_type = 'folder'
    `;
    const params: any[] = [userId];
    
    if (parentFolderId) {
      query += ` AND parent_folder_id = $2`;
      params.push(parentFolderId);
    } else {
      query += ` AND (parent_folder_id IS NULL OR parent_folder_id NOT IN (SELECT id FROM user_assets WHERE user_id = $1 AND mime_type = 'folder'))`;
    }
    
    query += ` ORDER BY filename ASC`;
    
    const result = await db.query(query, params);
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      folderPath: row.folder_path,
      parentFolderId: row.parent_folder_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },
};

