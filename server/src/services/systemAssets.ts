/**
 * System Assets Service
 * Manages system assets (DAWG Library) - premium packs, admin-managed assets
 */

import { getDatabase } from './database.js';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError } from '../utils/errors.js';
import { storageService } from './storage.js';
import { logger } from '../utils/logger.js';
import type { SystemAsset, SystemAssetPack, SystemAssetCategory, SystemAssetUsage } from '../types/index.js';
import crypto from 'crypto';

export const systemAssetsService = {
  /**
   * List system assets with filters
   */
  async listAssets(params: {
    categoryId?: string;
    packId?: string;
    tags?: string[];
    bpm?: number;
    keySignature?: string;
    isActive?: boolean;
    isPremium?: boolean;
    isFeatured?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ assets: SystemAsset[]; total: number }> {
    const db = getDatabase();
    const {
      categoryId,
      packId,
      tags,
      bpm,
      keySignature,
      isActive, // ✅ FIX: Remove default value - let caller decide
      isPremium,
      isFeatured,
      search,
      limit = 50,
      offset = 0,
    } = params;

    logger.info(`🔍 listAssets called with params: ${JSON.stringify({ isActive, limit, offset, categoryId, packId })}`);

    let query = `
      SELECT 
        id, category_id, name, filename, description,
        storage_key, storage_url, storage_provider,
        file_size, mime_type, bpm, key_signature, time_signature,
        tags, duration_seconds, sample_rate, bit_depth, channels,
        pack_id, pack_name, sort_order,
        is_active, is_premium, is_featured,
        download_count, usage_count, last_used_at,
        version, previous_version_id,
        thumbnail_url, waveform_data, preview_url,
        metadata, created_by, created_at, updated_at
      FROM system_assets
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    // ✅ FIX: Only filter by isActive if explicitly provided
    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      queryParams.push(isActive);
      paramIndex++;
      logger.info(`✅ Added isActive filter: ${isActive}`);
    } else {
      logger.info(`ℹ️ No isActive filter (showing all assets)`);
    }

    if (categoryId) {
      query += ` AND category_id = $${paramIndex}`;
      queryParams.push(categoryId);
      paramIndex++;
    }

    if (packId) {
      query += ` AND pack_id = $${paramIndex}`;
      queryParams.push(packId);
      paramIndex++;
    }

    if (tags && tags.length > 0) {
      query += ` AND tags && $${paramIndex}::text[]`;
      queryParams.push(tags);
      paramIndex++;
    }

    if (bpm) {
      query += ` AND bpm = $${paramIndex}`;
      queryParams.push(bpm);
      paramIndex++;
    }

    if (keySignature) {
      query += ` AND key_signature = $${paramIndex}`;
      queryParams.push(keySignature);
      paramIndex++;
    }

    if (isPremium !== undefined) {
      query += ` AND is_premium = $${paramIndex}`;
      queryParams.push(isPremium);
      paramIndex++;
    }

    if (isFeatured !== undefined) {
      query += ` AND is_featured = $${paramIndex}`;
      queryParams.push(isFeatured);
      paramIndex++;
    }

    if (search) {
      query += ` AND (
        to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $${paramIndex})
        OR name ILIKE $${paramIndex + 1}
      )`;
      queryParams.push(search, `%${search}%`);
      paramIndex += 2;
    }

    // Get total count - build WHERE clause separately
    let countWhereClause = 'WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;
    
    if (isActive !== undefined) {
      countWhereClause += ` AND is_active = $${countParamIndex}`;
      countParams.push(isActive);
      countParamIndex++;
    }
    if (categoryId) {
      countWhereClause += ` AND category_id = $${countParamIndex}`;
      countParams.push(categoryId);
      countParamIndex++;
    }
    if (packId) {
      countWhereClause += ` AND pack_id = $${countParamIndex}`;
      countParams.push(packId);
      countParamIndex++;
    }
    if (tags && tags.length > 0) {
      countWhereClause += ` AND tags && $${countParamIndex}::text[]`;
      countParams.push(tags);
      countParamIndex++;
    }
    if (bpm) {
      countWhereClause += ` AND bpm = $${countParamIndex}`;
      countParams.push(bpm);
      countParamIndex++;
    }
    if (keySignature) {
      countWhereClause += ` AND key_signature = $${countParamIndex}`;
      countParams.push(keySignature);
      countParamIndex++;
    }
    if (isPremium !== undefined) {
      countWhereClause += ` AND is_premium = $${countParamIndex}`;
      countParams.push(isPremium);
      countParamIndex++;
    }
    if (isFeatured !== undefined) {
      countWhereClause += ` AND is_featured = $${countParamIndex}`;
      countParams.push(isFeatured);
      countParamIndex++;
    }
    if (search) {
      countWhereClause += ` AND (
        to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $${countParamIndex})
        OR name ILIKE $${countParamIndex + 1}
      )`;
      countParams.push(search, `%${search}%`);
      countParamIndex += 2;
    }
    
    const countQuery = `SELECT COUNT(*) as count FROM system_assets ${countWhereClause}`;
    const countResult = await db.query(countQuery, countParams);
    const total = countResult.rows && countResult.rows.length > 0 && countResult.rows[0]?.count
      ? parseInt(countResult.rows[0].count, 10)
      : 0;

    // Add ordering and pagination
    query += ` ORDER BY sort_order ASC, name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    logger.info(`📊 Executing query with ${queryParams.length} params`);
    logger.info(`📊 Query: ${query.substring(0, 200)}...`);
    
    const result = await db.query(query, queryParams);
    
    logger.info(`📊 Query result: ${result.rows.length} rows returned`);

    const assets: SystemAsset[] = result.rows.map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      filename: row.filename,
      description: row.description,
      storageKey: row.storage_key,
      storageUrl: row.storage_url,
      storageProvider: row.storage_provider,
      fileSize: parseInt(row.file_size),
      mimeType: row.mime_type,
      bpm: row.bpm ? parseInt(row.bpm) : undefined,
      keySignature: row.key_signature,
      timeSignature: row.time_signature || '4/4',
      tags: row.tags || [],
      durationSeconds: row.duration_seconds ? parseFloat(row.duration_seconds) : undefined,
      sampleRate: row.sample_rate ? parseInt(row.sample_rate) : undefined,
      bitDepth: row.bit_depth ? parseInt(row.bit_depth) : undefined,
      channels: row.channels ? parseInt(row.channels) : undefined,
      packId: row.pack_id,
      packName: row.pack_name,
      sortOrder: row.sort_order || 0,
      isActive: row.is_active,
      isPremium: row.is_premium,
      isFeatured: row.is_featured,
      downloadCount: parseInt(row.download_count) || 0,
      usageCount: parseInt(row.usage_count) || 0,
      lastUsedAt: row.last_used_at,
      version: parseInt(row.version) || 1,
      previousVersionId: row.previous_version_id,
      thumbnailUrl: row.thumbnail_url,
      waveformData: row.waveform_data,
      previewUrl: row.preview_url,
      metadata: row.metadata || {},
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { assets, total };
  },

  /**
   * Get asset by ID
   */
  async getAssetById(assetId: string): Promise<SystemAsset> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT 
        id, category_id, name, filename, description,
        storage_key, storage_url, storage_provider,
        file_size, mime_type, bpm, key_signature, time_signature,
        tags, duration_seconds, sample_rate, bit_depth, channels,
        pack_id, pack_name, sort_order,
        is_active, is_premium, is_featured,
        download_count, usage_count, last_used_at,
        version, previous_version_id,
        thumbnail_url, waveform_data, preview_url,
        metadata, created_by, created_at, updated_at
      FROM system_assets
      WHERE id = $1`,
      [assetId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('System asset not found');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      filename: row.filename,
      description: row.description,
      storageKey: row.storage_key,
      storageUrl: row.storage_url,
      storageProvider: row.storage_provider,
      fileSize: parseInt(row.file_size),
      mimeType: row.mime_type,
      bpm: row.bpm ? parseInt(row.bpm) : undefined,
      keySignature: row.key_signature,
      timeSignature: row.time_signature || '4/4',
      tags: row.tags || [],
      durationSeconds: row.duration_seconds ? parseFloat(row.duration_seconds) : undefined,
      sampleRate: row.sample_rate ? parseInt(row.sample_rate) : undefined,
      bitDepth: row.bit_depth ? parseInt(row.bit_depth) : undefined,
      channels: row.channels ? parseInt(row.channels) : undefined,
      packId: row.pack_id,
      packName: row.pack_name,
      sortOrder: row.sort_order || 0,
      isActive: row.is_active,
      isPremium: row.is_premium,
      isFeatured: row.is_featured,
      downloadCount: parseInt(row.download_count) || 0,
      usageCount: parseInt(row.usage_count) || 0,
      lastUsedAt: row.last_used_at,
      version: parseInt(row.version) || 1,
      previousVersionId: row.previous_version_id,
      thumbnailUrl: row.thumbnail_url,
      waveformData: row.waveform_data,
      previewUrl: row.preview_url,
      metadata: row.metadata || {},
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  /**
   * List asset packs
   */
  async listPacks(params: {
    categoryId?: string;
    isFree?: boolean;
    isActive?: boolean; // ✅ FIX: undefined = show all, true/false = filter
    isFeatured?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ packs: SystemAssetPack[]; total: number }> {
    const db = getDatabase();
    const { categoryId, isFree, isActive, isFeatured, limit = 50, offset = 0 } = params;
    // ✅ FIX: Don't default isActive to true - if undefined, show all packs

    logger.info({ categoryId, isFree, isActive, isFeatured, limit, offset }, '📦 [SERVICE] listPacks called with params');

    let query = `
      SELECT 
        id, name, slug, description, cover_image_url,
        is_free, price, currency, category_id, tags,
        asset_count, download_count,
        is_active, is_featured, created_by, created_at, updated_at
      FROM system_asset_packs
      WHERE 1=1
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      queryParams.push(isActive);
      logger.info({ isActive }, '📦 [SERVICE] Added isActive filter');
      paramIndex++;
    } else {
      logger.info('📦 [SERVICE] No isActive filter - showing all packs');
    }

    if (categoryId) {
      query += ` AND category_id = $${paramIndex}`;
      queryParams.push(categoryId);
      paramIndex++;
    }

    if (isFree !== undefined) {
      query += ` AND is_free = $${paramIndex}`;
      queryParams.push(isFree);
      paramIndex++;
    }

    if (isFeatured !== undefined) {
      query += ` AND is_featured = $${paramIndex}`;
      queryParams.push(isFeatured);
      paramIndex++;
    }

    // ✅ FIX: Get total count with proper WHERE clause
    let countQuery = `SELECT COUNT(*) as count FROM system_asset_packs WHERE 1=1`;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (isActive !== undefined) {
      countQuery += ` AND is_active = $${countParamIndex}`;
      countParams.push(isActive);
      countParamIndex++;
    }

    if (categoryId) {
      countQuery += ` AND category_id = $${countParamIndex}`;
      countParams.push(categoryId);
      countParamIndex++;
    }

    if (isFree !== undefined) {
      countQuery += ` AND is_free = $${countParamIndex}`;
      countParams.push(isFree);
      countParamIndex++;
    }

    if (isFeatured !== undefined) {
      countQuery += ` AND is_featured = $${countParamIndex}`;
      countParams.push(isFeatured);
      countParamIndex++;
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    query += ` ORDER BY is_featured DESC, download_count DESC, name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    logger.info({ query, queryParams }, '📦 [SERVICE] Executing query');
    
    const result = await db.query(query, queryParams);
    
    logger.info({ 
      rowCount: result.rows.length, 
      total: result.rows.length,
      sampleRows: result.rows.slice(0, 3).map(r => ({ id: r.id, name: r.name, isActive: r.is_active })) 
    }, '📦 [SERVICE] Query result');

    const packs: SystemAssetPack[] = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      coverImageUrl: row.cover_image_url,
      isFree: row.is_free,
      price: row.price ? parseFloat(row.price) : undefined,
      currency: row.currency || 'USD',
      categoryId: row.category_id,
      tags: row.tags || [],
      assetCount: parseInt(row.asset_count) || 0,
      downloadCount: parseInt(row.download_count) || 0,
      isActive: row.is_active,
      isFeatured: row.is_featured,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { packs, total };
  },

  /**
   * Get category by ID
   */
  async getCategoryById(categoryId: string): Promise<SystemAssetCategory | null> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, name, slug, description, icon, parent_id, sort_order, created_at, updated_at
       FROM system_asset_categories
       WHERE id = $1`,
      [categoryId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      icon: row.icon,
      parentId: row.parent_id,
      sortOrder: row.sort_order || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  /**
   * Get pack by ID
   */
  async getPackById(packId: string): Promise<SystemAssetPack | null> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, name, slug, description, cover_image_url,
              is_free, price, currency, category_id, tags,
              asset_count, download_count,
              is_active, is_featured, created_by, created_at, updated_at
       FROM system_asset_packs
       WHERE id = $1`,
      [packId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      coverImageUrl: row.cover_image_url,
      isFree: row.is_free,
      price: row.price ? parseFloat(row.price) : undefined,
      currency: row.currency || 'USD',
      categoryId: row.category_id,
      tags: row.tags || [],
      assetCount: parseInt(row.asset_count) || 0,
      downloadCount: parseInt(row.download_count) || 0,
      isActive: row.is_active,
      isFeatured: row.is_featured,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  /**
   * List categories
   */
  async listCategories(): Promise<SystemAssetCategory[]> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, name, slug, description, icon, parent_id, sort_order, created_at, updated_at
       FROM system_asset_categories
       ORDER BY sort_order ASC, name ASC`
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      icon: row.icon,
      parentId: row.parent_id,
      sortOrder: row.sort_order || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  /**
   * Track asset usage
   */
  async trackUsage(
    assetId: string,
    userId: string,
    usageType: 'loaded' | 'used_in_project' | 'exported',
    projectId?: string
  ): Promise<void> {
    const db = getDatabase();

    // Upsert usage record
    await db.query(
      `INSERT INTO system_asset_usage (asset_id, user_id, project_id, usage_type, usage_count, first_used_at, last_used_at)
       VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
       ON CONFLICT (asset_id, user_id, usage_type)
       DO UPDATE SET
         usage_count = system_asset_usage.usage_count + 1,
         last_used_at = NOW(),
         project_id = COALESCE(EXCLUDED.project_id, system_asset_usage.project_id)`,
      [assetId, userId, projectId || null, usageType]
    );

    // Update asset usage count
    await db.query(
      `UPDATE system_assets
       SET usage_count = usage_count + 1,
           last_used_at = NOW()
       WHERE id = $1`,
      [assetId]
    );
  },

  /**
   * Create system asset (admin)
   */
  async createAsset(
    userId: string,
    assetData: {
      id?: string;
      name: string;
      filename: string;
      description?: string;
      categoryId?: string;
      packId?: string;
      bpm?: number;
      keySignature?: string;
      tags?: string[];
      isPremium?: boolean;
      isFeatured?: boolean;
      isActive?: boolean;
      storageKey: string;
      storageUrl: string;
      fileSize: number;
      mimeType: string;
      durationSeconds?: number;
      sampleRate?: number;
      bitDepth?: number;
      channels?: number;
    }
  ): Promise<SystemAsset> {
    const db = getDatabase();
    const assetId = assetData.id || crypto.randomUUID();

    // Get pack name if packId provided
    let packName: string | undefined;
    if (assetData.packId) {
      const packResult = await db.query('SELECT name FROM system_asset_packs WHERE id = $1', [assetData.packId]);
      packName = packResult.rows[0]?.name;
    }

    await db.query(
      `INSERT INTO system_assets (
        id, category_id, name, filename, description,
        storage_key, storage_url, storage_provider, file_size, mime_type,
        bpm, key_signature, time_signature, tags,
        duration_seconds, sample_rate, bit_depth, channels,
        pack_id, pack_name, sort_order,
        is_active, is_premium, is_featured,
        created_by, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)`,
      [
        assetId,
        assetData.categoryId || null,
        assetData.name,
        assetData.filename,
        assetData.description || null,
        assetData.storageKey,
        assetData.storageUrl,
        'bunny', // Storage provider (Bunny CDN)
        assetData.fileSize,
        assetData.mimeType,
        assetData.bpm || null,
        assetData.keySignature || null,
        '4/4', // Default time signature
        assetData.tags || [],
        assetData.durationSeconds || null,
        assetData.sampleRate || null,
        assetData.bitDepth || null,
        assetData.channels || null,
        assetData.packId || null,
        packName || null,
        0, // Default sort order
        assetData.isActive !== undefined ? assetData.isActive : true, // is_active (default: true)
        assetData.isPremium || false,
        assetData.isFeatured || false,
        userId,
        1, // version
      ]
    );

    return this.getAssetById(assetId);
  },

  /**
   * Update system asset (admin)
   */
  async updateAsset(
    assetId: string,
    updates: {
      name?: string;
      description?: string;
      categoryId?: string;
      packId?: string;
      bpm?: number;
      keySignature?: string;
      tags?: string[];
      isActive?: boolean;
      isPremium?: boolean;
      isFeatured?: boolean;
      sortOrder?: number;
    }
  ): Promise<SystemAsset> {
    const db = getDatabase();

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(updates.name);
      paramIndex++;
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(updates.description);
      paramIndex++;
    }
    if (updates.categoryId !== undefined) {
      updateFields.push(`category_id = $${paramIndex}`);
      updateValues.push(updates.categoryId || null);
      paramIndex++;
    }
    if (updates.packId !== undefined) {
      updateFields.push(`pack_id = $${paramIndex}`);
      updateValues.push(updates.packId || null);
      paramIndex++;
      
      // Update pack_name if packId changed
      if (updates.packId) {
        const packResult = await db.query('SELECT name FROM system_asset_packs WHERE id = $1', [updates.packId]);
        const packName = packResult.rows[0]?.name;
        if (packName) {
          updateFields.push(`pack_name = $${paramIndex}`);
          updateValues.push(packName);
          paramIndex++;
        }
      } else {
        updateFields.push(`pack_name = $${paramIndex}`);
        updateValues.push(null);
        paramIndex++;
      }
    }
    if (updates.bpm !== undefined) {
      updateFields.push(`bpm = $${paramIndex}`);
      updateValues.push(updates.bpm || null);
      paramIndex++;
    }
    if (updates.keySignature !== undefined) {
      updateFields.push(`key_signature = $${paramIndex}`);
      updateValues.push(updates.keySignature || null);
      paramIndex++;
    }
    if (updates.tags !== undefined) {
      updateFields.push(`tags = $${paramIndex}`);
      updateValues.push(updates.tags);
      paramIndex++;
    }
    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      updateValues.push(updates.isActive);
      paramIndex++;
    }
    if (updates.isPremium !== undefined) {
      updateFields.push(`is_premium = $${paramIndex}`);
      updateValues.push(updates.isPremium);
      paramIndex++;
    }
    if (updates.isFeatured !== undefined) {
      updateFields.push(`is_featured = $${paramIndex}`);
      updateValues.push(updates.isFeatured);
      paramIndex++;
    }
    if (updates.sortOrder !== undefined) {
      updateFields.push(`sort_order = $${paramIndex}`);
      updateValues.push(updates.sortOrder);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return this.getAssetById(assetId);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(assetId);

    await db.query(
      `UPDATE system_assets SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
      updateValues
    );

    return this.getAssetById(assetId);
  },

  /**
   * Delete system asset (admin)
   */
  async deleteAsset(assetId: string): Promise<void> {
    const db = getDatabase();
    const asset = await this.getAssetById(assetId);

    // Delete from storage
    try {
      await storageService.deleteFile(asset.storageKey);
    } catch (error) {
      console.warn(`⚠️ Failed to delete file from storage: ${error.message}`);
    }

    // Delete from database
    await db.query('DELETE FROM system_assets WHERE id = $1', [assetId]);
  },

  /**
   * Create pack (admin)
   */
  async createPack(
    userId: string,
    packData: {
      name: string;
      slug: string;
      description?: string;
      coverImageUrl?: string;
      isFree?: boolean;
      price?: number;
      currency?: string;
      categoryId?: string;
      tags?: string[];
      isFeatured?: boolean;
    }
  ): Promise<SystemAssetPack> {
    const db = getDatabase();
    
    // ✅ FIX: Check if slug already exists (case-insensitive)
    const existingPack = await db.query(
      'SELECT id FROM system_asset_packs WHERE LOWER(slug) = LOWER($1)',
      [packData.slug]
    );
    
    if (existingPack.rows.length > 0) {
      throw new ConflictError(`Pack with slug "${packData.slug}" already exists. Please use a different slug.`);
    }
    
    const packId = crypto.randomUUID();

    try {
      await db.query(
        `INSERT INTO system_asset_packs (
          id, name, slug, description, cover_image_url,
          is_free, price, currency, category_id, tags,
          is_active, is_featured, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          packId,
          packData.name,
          packData.slug,
          packData.description || null,
          packData.coverImageUrl || null,
          packData.isFree !== undefined ? packData.isFree : true,
          // ✅ FIX: Ensure isActive defaults to true for new packs
          packData.price || null,
          packData.currency || 'USD',
          packData.categoryId || null,
          packData.tags || [],
          true, // is_active
          packData.isFeatured || false,
          userId,
        ]
      );
    } catch (error: any) {
      // ✅ FIX: Handle unique constraint violation (fallback if pre-check missed it)
      if (error.code === '23505' && (error.constraint === 'system_asset_packs_slug_key' || error.constraint?.includes('slug'))) {
        throw new ConflictError(`Pack with slug "${packData.slug}" already exists. Please use a different slug.`);
      }
      throw error;
    }

    const result = await db.query('SELECT * FROM system_asset_packs WHERE id = $1', [packId]);
    const row = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      coverImageUrl: row.cover_image_url,
      isFree: row.is_free,
      price: row.price ? parseFloat(row.price) : undefined,
      currency: row.currency || 'USD',
      categoryId: row.category_id,
      tags: row.tags || [],
      assetCount: 0,
      downloadCount: parseInt(row.download_count) || 0,
      isActive: row.is_active,
      isFeatured: row.is_featured,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  /**
   * Update pack (admin)
   */
  async updatePack(
    packId: string,
    updates: {
      name?: string;
      description?: string;
      coverImageUrl?: string;
      isFree?: boolean;
      price?: number;
      currency?: string;
      categoryId?: string;
      tags?: string[];
      isActive?: boolean;
      isFeatured?: boolean;
    }
  ): Promise<SystemAssetPack> {
    const db = getDatabase();

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(updates.name);
      paramIndex++;
    }
    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(updates.description);
      paramIndex++;
    }
    if (updates.coverImageUrl !== undefined) {
      updateFields.push(`cover_image_url = $${paramIndex}`);
      updateValues.push(updates.coverImageUrl);
      paramIndex++;
    }
    if (updates.isFree !== undefined) {
      updateFields.push(`is_free = $${paramIndex}`);
      updateValues.push(updates.isFree);
      paramIndex++;
    }
    if (updates.price !== undefined) {
      updateFields.push(`price = $${paramIndex}`);
      updateValues.push(updates.price);
      paramIndex++;
    }
    if (updates.currency !== undefined) {
      updateFields.push(`currency = $${paramIndex}`);
      updateValues.push(updates.currency);
      paramIndex++;
    }
    if (updates.categoryId !== undefined) {
      updateFields.push(`category_id = $${paramIndex}`);
      updateValues.push(updates.categoryId || null);
      paramIndex++;
    }
    if (updates.tags !== undefined) {
      updateFields.push(`tags = $${paramIndex}`);
      updateValues.push(updates.tags);
      paramIndex++;
    }
    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      updateValues.push(updates.isActive);
      paramIndex++;
    }
    if (updates.isFeatured !== undefined) {
      updateFields.push(`is_featured = $${paramIndex}`);
      updateValues.push(updates.isFeatured);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      const result = await db.query('SELECT * FROM system_asset_packs WHERE id = $1', [packId]);
      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        coverImageUrl: row.cover_image_url,
        isFree: row.is_free,
        price: row.price ? parseFloat(row.price) : undefined,
        currency: row.currency || 'USD',
        categoryId: row.category_id,
        tags: row.tags || [],
        assetCount: parseInt(row.asset_count) || 0,
        downloadCount: parseInt(row.download_count) || 0,
        isActive: row.is_active,
        isFeatured: row.is_featured,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(packId);

    await db.query(
      `UPDATE system_asset_packs SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
      updateValues
    );

    const result = await db.query('SELECT * FROM system_asset_packs WHERE id = $1', [packId]);
    const row = result.rows[0];

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      coverImageUrl: row.cover_image_url,
      isFree: row.is_free,
      price: row.price ? parseFloat(row.price) : undefined,
      currency: row.currency || 'USD',
      categoryId: row.category_id,
      tags: row.tags || [],
      assetCount: parseInt(row.asset_count) || 0,
      downloadCount: parseInt(row.download_count) || 0,
      isActive: row.is_active,
      isFeatured: row.is_featured,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  /**
   * Delete pack (admin)
   */
  async deletePack(packId: string): Promise<void> {
    const db = getDatabase();

    // Check if pack has assets
    const assetsResult = await db.query('SELECT COUNT(*) FROM system_assets WHERE pack_id = $1', [packId]);
    const assetCount = parseInt(assetsResult.rows[0].count);

    if (assetCount > 0) {
      throw new BadRequestError(`Cannot delete pack with ${assetCount} assets. Remove assets first.`);
    }

    await db.query('DELETE FROM system_asset_packs WHERE id = $1', [packId]);
  },
};

