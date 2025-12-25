/**
 * Preset service
 * Handles CRUD operations for community preset library
 */

import { getDatabase } from './database.js';
import { logger } from '../utils/logger.js';

export interface Preset {
    id: string;
    user_id: string;
    userName?: string; // Author's display name or username
    name: string;
    description: string | null;
    preset_type: 'instrument' | 'effect';
    engine_type: string;
    category: string | null;
    preset_data: Record<string, any>;
    tags: string[];
    genre: string | null;
    downloads_count: number;
    rating_avg: number;
    rating_count: number;
    is_public: boolean;
    is_featured: boolean;
    is_flagged: boolean;
    flag_reason: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface PresetRating {
    id: string;
    preset_id: string;
    user_id: string;
    rating: number;
    created_at: Date;
}

/**
 * Create preset
 */
export async function createPreset(data: {
    userId: string;
    name: string;
    description?: string;
    presetType: 'instrument' | 'effect';
    engineType: string;
    category?: string;
    presetData: Record<string, any>;
    tags?: string[];
    genre?: string;
    isPublic?: boolean;
}): Promise<Preset> {
    const db = getDatabase();

    const result = await db.query<Preset>(
        `INSERT INTO presets (
      user_id, name, description, preset_type, engine_type, category,
      preset_data, tags, genre, is_public
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
        [
            data.userId,
            data.name,
            data.description || null,
            data.presetType,
            data.engineType,
            data.category || null,
            JSON.stringify(data.presetData),
            data.tags || [],
            data.genre || null,
            data.isPublic !== undefined ? data.isPublic : true,
        ]
    );

    logger.info(`✅ Preset created: ${result.rows[0].id} by user ${data.userId}`);
    return result.rows[0];
}

/**
 * Find preset by ID
 */
export async function findPresetById(id: string): Promise<Preset | null> {
    const db = getDatabase();

    const result = await db.query<Preset>(
        `SELECT p.*, COALESCE(u.display_name, u.username) as "userName"
         FROM presets p
         LEFT JOIN users u ON u.id = p.user_id
         WHERE p.id = $1`,
        [id]
    );

    return result.rows[0] || null;
}

/**
 * Update preset
 */
export async function updatePreset(
    id: string,
    data: {
        name?: string;
        description?: string;
        category?: string;
        presetData?: Record<string, any>;
        tags?: string[];
        genre?: string;
        isPublic?: boolean;
    }
): Promise<Preset> {
    const db = getDatabase();

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
    }
    if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
    }
    if (data.category !== undefined) {
        updates.push(`category = $${paramIndex++}`);
        values.push(data.category);
    }
    if (data.presetData !== undefined) {
        updates.push(`preset_data = $${paramIndex++}`);
        values.push(JSON.stringify(data.presetData));
    }
    if (data.tags !== undefined) {
        updates.push(`tags = $${paramIndex++}`);
        values.push(data.tags);
    }
    if (data.genre !== undefined) {
        updates.push(`genre = $${paramIndex++}`);
        values.push(data.genre);
    }
    if (data.isPublic !== undefined) {
        updates.push(`is_public = $${paramIndex++}`);
        values.push(data.isPublic);
    }

    if (updates.length === 0) {
        throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query<Preset>(
        `UPDATE presets
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
        values
    );

    if (result.rows.length === 0) {
        throw new Error('Preset not found');
    }

    return result.rows[0];
}

/**
 * Delete preset
 */
export async function deletePreset(id: string): Promise<void> {
    const db = getDatabase();

    const result = await db.query(
        `DELETE FROM presets WHERE id = $1`,
        [id]
    );

    if (result.rowCount === 0) {
        throw new Error('Preset not found');
    }

    logger.info(`🗑️ Preset deleted: ${id}`);
}

/**
 * List presets with filters
 */
export async function listPresets(options: {
    userId?: string;
    presetType?: 'instrument' | 'effect';
    engineType?: string;
    category?: string;
    tags?: string[];
    genre?: string;
    search?: string;
    isPublic?: boolean;
    isFeatured?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'created_at' | 'downloads_count' | 'rating_avg';
    sortOrder?: 'asc' | 'desc';
}): Promise<{ presets: Preset[]; total: number }> {
    const db = getDatabase();

    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100); // Max 100 per page
    const offset = (page - 1) * limit;
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = options.sortOrder || 'desc';

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.userId) {
        conditions.push(`user_id = $${paramIndex++}`);
        values.push(options.userId);
    }

    if (options.presetType) {
        conditions.push(`preset_type = $${paramIndex++}`);
        values.push(options.presetType);
    }

    if (options.engineType) {
        conditions.push(`engine_type = $${paramIndex++}`);
        values.push(options.engineType);
    }

    if (options.category) {
        conditions.push(`category = $${paramIndex++}`);
        values.push(options.category);
    }

    if (options.tags && options.tags.length > 0) {
        conditions.push(`tags && $${paramIndex++}`);
        values.push(options.tags);
    }

    if (options.genre) {
        conditions.push(`genre = $${paramIndex++}`);
        values.push(options.genre);
    }

    if (options.search) {
        conditions.push(`(
      to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $${paramIndex})
    )`);
        values.push(options.search);
        paramIndex++;
    }

    if (options.isPublic !== undefined) {
        conditions.push(`is_public = $${paramIndex++}`);
        values.push(options.isPublic);
    }

    if (options.isFeatured !== undefined) {
        conditions.push(`is_featured = $${paramIndex++}`);
        values.push(options.isFeatured);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
        `SELECT COUNT(*) as total FROM presets ${whereClause}`,
        values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get presets
    const presetsResult = await db.query<Preset>(
        `SELECT p.*, COALESCE(u.display_name, u.username) as "userName"
     FROM presets p
     LEFT JOIN users u ON u.id = p.user_id
     ${whereClause}
     ORDER BY p.${sortBy} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset]
    );

    return {
        presets: presetsResult.rows,
        total,
    };
}

/**
 * Search presets (full-text search)
 */
export async function searchPresets(query: string, options: {
    presetType?: 'instrument' | 'effect';
    engineType?: string;
    limit?: number;
}): Promise<Preset[]> {
    const db = getDatabase();

    const limit = Math.min(options.limit || 20, 100);
    const conditions: string[] = [
        `to_tsvector('english', name || ' ' || COALESCE(description, '')) @@ plainto_tsquery('english', $1)`,
        `is_public = true`
    ];
    const values: any[] = [query];
    let paramIndex = 2;

    if (options.presetType) {
        conditions.push(`preset_type = $${paramIndex++}`);
        values.push(options.presetType);
    }

    if (options.engineType) {
        conditions.push(`engine_type = $${paramIndex++}`);
        values.push(options.engineType);
    }

    const result = await db.query<Preset>(
        `SELECT * FROM presets
     WHERE ${conditions.join(' AND ')}
     ORDER BY rating_avg DESC, downloads_count DESC
     LIMIT $${paramIndex}`,
        [...values, limit]
    );

    return result.rows;
}

/**
 * Rate preset
 */
export async function ratePreset(data: {
    presetId: string;
    userId: string;
    rating: number;
}): Promise<PresetRating> {
    const db = getDatabase();

    if (data.rating < 1 || data.rating > 5) {
        throw new Error('Rating must be between 1 and 5');
    }

    const result = await db.query<PresetRating>(
        `INSERT INTO preset_ratings (preset_id, user_id, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (preset_id, user_id)
     DO UPDATE SET rating = $3, created_at = NOW()
     RETURNING *`,
        [data.presetId, data.userId, data.rating]
    );

    logger.info(`⭐ Preset rated: ${data.presetId} by user ${data.userId} (${data.rating}/5)`);
    return result.rows[0];
}

/**
 * Download preset (track download)
 */
export async function downloadPreset(data: {
    presetId: string;
    userId: string;
}): Promise<void> {
    const db = getDatabase();

    await db.query(
        `INSERT INTO user_preset_downloads (user_id, preset_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, preset_id) DO NOTHING`,
        [data.userId, data.presetId]
    );

    logger.info(`⬇️ Preset downloaded: ${data.presetId} by user ${data.userId}`);
}

/**
 * Get user's downloaded presets
 */
export async function getUserDownloads(userId: string, options: {
    page?: number;
    limit?: number;
    presetType?: 'instrument' | 'effect';
    engineType?: string;
}): Promise<{ presets: Preset[]; total: number }> {
    const db = getDatabase();

    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [`upd.user_id = $1`];
    const values: any[] = [userId];
    let paramIndex = 2;

    if (options.presetType) {
        conditions.push(`p.preset_type = $${paramIndex++}`);
        values.push(options.presetType);
    }

    if (options.engineType) {
        conditions.push(`p.engine_type = $${paramIndex++}`);
        values.push(options.engineType);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Get total count
    const countResult = await db.query(
        `SELECT COUNT(*) as total 
     FROM user_preset_downloads upd
     JOIN presets p ON p.id = upd.preset_id
     ${whereClause}`,
        values
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get presets
    const result = await db.query<Preset>(
        `SELECT p.*, COALESCE(u.display_name, u.username) as "userName"
     FROM user_preset_downloads upd
     JOIN presets p ON p.id = upd.preset_id
     LEFT JOIN users u ON u.id = p.user_id
     ${whereClause}
     ORDER BY upd.downloaded_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset]
    );

    return {
        presets: result.rows,
        total,
    };
}

/**
 * Check if user owns preset
 */
export async function isPresetOwner(presetId: string, userId: string): Promise<boolean> {
    const preset = await findPresetById(presetId);
    return preset?.user_id === userId;
}

/**
 * Get popular presets
 */
export async function getPopularPresets(options: {
    presetType?: 'instrument' | 'effect';
    engineType?: string;
    limit?: number;
}): Promise<Preset[]> {
    const db = getDatabase();

    const limit = Math.min(options.limit || 10, 50);
    const conditions: string[] = ['is_public = true'];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.presetType) {
        conditions.push(`preset_type = $${paramIndex++}`);
        values.push(options.presetType);
    }

    if (options.engineType) {
        conditions.push(`engine_type = $${paramIndex++}`);
        values.push(options.engineType);
    }

    const result = await db.query<Preset>(
        `SELECT * FROM presets
     WHERE ${conditions.join(' AND ')}
     ORDER BY downloads_count DESC, rating_avg DESC
     LIMIT $${paramIndex}`,
        [...values, limit]
    );

    return result.rows;
}

/**
 * Get featured presets
 */
export async function getFeaturedPresets(limit: number = 10): Promise<Preset[]> {
    const db = getDatabase();

    const result = await db.query<Preset>(
        `SELECT * FROM presets
     WHERE is_featured = true AND is_public = true
     ORDER BY created_at DESC
     LIMIT $1`,
        [Math.min(limit, 50)]
    );

    return result.rows;
}
