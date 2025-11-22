/**
 * Project service
 */

import { getDatabase } from './database.js';
import { logger } from '../utils/logger.js';
import type { Project } from '../types/index.js';
import crypto from 'crypto';

/**
 * Generate share token
 */
export function generateShareToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Create project
 */
export async function createProject(data: {
  userId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  bpm?: number;
  keySignature?: string;
  timeSignature?: string;
  projectData: Record<string, any>;
}): Promise<Project> {
  const db = getDatabase();
  
  const result = await db.query<Project>(
    `INSERT INTO projects (
      user_id, title, description, thumbnail_url, bpm, key_signature,
      time_signature, project_data, version, is_public, is_unlisted
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, user_id, title, description, thumbnail_url, bpm, key_signature,
              time_signature, project_data, version, is_public, is_unlisted,
              share_token, play_count, like_count, remix_count, created_at,
              updated_at, published_at, deleted_at`,
    [
      data.userId,
      data.title,
      data.description || null,
      data.thumbnailUrl || null,
      data.bpm || 120,
      data.keySignature || null,
      data.timeSignature || '4/4',
      JSON.stringify(data.projectData),
      1,
      false,
      false,
    ]
  );

  const project = result.rows[0];
  
  // Add owner as collaborator
  await db.query(
    `INSERT INTO project_collaborators (project_id, user_id, role, can_edit, can_delete, can_share, can_export)
     VALUES ($1, $2, 'owner', true, true, true, true)
     ON CONFLICT (project_id, user_id) DO NOTHING`,
    [project.id, data.userId]
  );

  return project;
}

/**
 * Find project by ID
 */
export async function findProjectById(id: string, includeDeleted: boolean = false): Promise<Project | null> {
  const db = getDatabase();
  
  let query = `
    SELECT id, user_id, title, description, thumbnail_url, bpm, key_signature,
           time_signature, project_data, version, is_public, is_unlisted,
           share_token, play_count, like_count, remix_count, created_at,
           updated_at, published_at, deleted_at
    FROM projects
    WHERE id = $1
  `;
  
  if (!includeDeleted) {
    query += ' AND deleted_at IS NULL';
  }
  
  const result = await db.query<Project>(query, [id]);
  return result.rows[0] || null;
}

/**
 * Find project by share token
 */
export async function findProjectByShareToken(token: string): Promise<Project | null> {
  const db = getDatabase();
  
  const result = await db.query<Project>(
    `SELECT id, user_id, title, description, thumbnail_url, bpm, key_signature,
            time_signature, project_data, version, is_public, is_unlisted,
            share_token, play_count, like_count, remix_count, created_at,
            updated_at, published_at, deleted_at
     FROM projects
     WHERE share_token = $1 AND deleted_at IS NULL`,
    [token]
  );
  
  return result.rows[0] || null;
}

/**
 * Update project
 */
export async function updateProject(
  id: string,
  data: {
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    bpm?: number;
    keySignature?: string;
    timeSignature?: string;
    projectData?: Record<string, any>;
    isPublic?: boolean;
    isUnlisted?: boolean;
  }
): Promise<Project> {
  const db = getDatabase();
  
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (data.title !== undefined) {
    updates.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.thumbnailUrl !== undefined) {
    updates.push(`thumbnail_url = $${paramIndex++}`);
    values.push(data.thumbnailUrl);
  }
  if (data.bpm !== undefined) {
    updates.push(`bpm = $${paramIndex++}`);
    values.push(data.bpm);
  }
  if (data.keySignature !== undefined) {
    updates.push(`key_signature = $${paramIndex++}`);
    values.push(data.keySignature);
  }
  if (data.timeSignature !== undefined) {
    updates.push(`time_signature = $${paramIndex++}`);
    values.push(data.timeSignature);
  }
  if (data.projectData !== undefined) {
    updates.push(`project_data = $${paramIndex++}`);
    values.push(JSON.stringify(data.projectData));
    updates.push(`version = version + 1`);
  }
  if (data.isPublic !== undefined) {
    updates.push(`is_public = $${paramIndex++}`);
    values.push(data.isPublic);
  }
  if (data.isUnlisted !== undefined) {
    updates.push(`is_unlisted = $${paramIndex++}`);
    values.push(data.isUnlisted);
  }
  
  if (updates.length === 0) {
    throw new Error('No fields to update');
  }
  
  updates.push(`updated_at = NOW()`);
  values.push(id);
  
  const result = await db.query<Project>(
    `UPDATE projects
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex} AND deleted_at IS NULL
     RETURNING id, user_id, title, description, thumbnail_url, bpm, key_signature,
               time_signature, project_data, version, is_public, is_unlisted,
               share_token, play_count, like_count, remix_count, created_at,
               updated_at, published_at, deleted_at`,
    values
  );
  
  if (result.rows.length === 0) {
    throw new Error('Project not found');
  }
  
  return result.rows[0];
}

/**
 * Delete project (soft delete)
 */
export async function deleteProject(id: string): Promise<void> {
  const db = getDatabase();
  
  const result = await db.query(
    `UPDATE projects
     SET deleted_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  
  if (result.rowCount === 0) {
    throw new Error('Project not found');
  }
}

/**
 * List projects
 */
export async function listProjects(options: {
  userId?: string;
  isPublic?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'updated_at' | 'play_count' | 'like_count';
  sortOrder?: 'asc' | 'desc';
}): Promise<{ projects: Project[]; total: number }> {
  const db = getDatabase();
  
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;
  const sortBy = options.sortBy || 'created_at';
  const sortOrder = options.sortOrder || 'desc';
  
  const conditions: string[] = ['deleted_at IS NULL'];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (options.userId) {
    conditions.push(`user_id = $${paramIndex++}`);
    values.push(options.userId);
  }
  
  if (options.isPublic !== undefined) {
    conditions.push(`is_public = $${paramIndex++}`);
    values.push(options.isPublic);
  }
  
  if (options.search) {
    conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    values.push(`%${options.search}%`);
    paramIndex++;
  }
  
  const whereClause = conditions.join(' AND ');
  
  // Get total count
  const countResult = await db.query(
    `SELECT COUNT(*) as total FROM projects WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].total, 10);
  
  // Get projects
  const projectsResult = await db.query<Project>(
    `SELECT id, user_id, title, description, thumbnail_url, bpm, key_signature,
            time_signature, project_data, version, is_public, is_unlisted,
            share_token, play_count, like_count, remix_count, created_at,
            updated_at, published_at, deleted_at
     FROM projects
     WHERE ${whereClause}
     ORDER BY ${sortBy} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limit, offset]
  );
  
  return {
    projects: projectsResult.rows,
    total,
  };
}

/**
 * Check if user can access project
 */
export async function canAccessProject(userId: string | null, projectId: string): Promise<boolean> {
  const db = getDatabase();
  
  const project = await findProjectById(projectId);
  if (!project) {
    return false;
  }
  
  // Owner can always access
  if (project.user_id === userId) {
    return true;
  }
  
  // Public projects
  if (project.is_public) {
    return true;
  }
  
  // Check if user is collaborator
  if (userId) {
    const collaboratorResult = await db.query(
      `SELECT 1 FROM project_collaborators
       WHERE project_id = $1 AND user_id = $2 AND is_active = true`,
      [projectId, userId]
    );
    
    if (collaboratorResult.rows.length > 0) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if user can edit project
 */
export async function canEditProject(userId: string, projectId: string): Promise<boolean> {
  const db = getDatabase();
  
  const project = await findProjectById(projectId);
  if (!project) {
    return false;
  }
  
  // Owner can always edit
  if (project.user_id === userId) {
    return true;
  }
  
  // Check collaborator permissions
  const collaboratorResult = await db.query(
    `SELECT can_edit FROM project_collaborators
     WHERE project_id = $1 AND user_id = $2 AND is_active = true`,
    [projectId, userId]
  );
  
  if (collaboratorResult.rows.length > 0) {
    return collaboratorResult.rows[0].can_edit;
  }
  
  return false;
}

/**
 * Duplicate project
 */
export async function duplicateProject(projectId: string, userId: string, newTitle?: string): Promise<Project> {
  const db = getDatabase();
  
  const original = await findProjectById(projectId);
  if (!original) {
    throw new Error('Project not found');
  }
  
  // Check access
  const hasAccess = await canAccessProject(userId, projectId);
  if (!hasAccess) {
    throw new Error('Access denied');
  }
  
  // Create new project
  const newProject = await createProject({
    userId,
    title: newTitle || `${original.title} (Copy)`,
    description: original.description || undefined,
    thumbnailUrl: original.thumbnail_url || undefined,
    bpm: original.bpm || undefined,
    keySignature: original.key_signature || undefined,
    timeSignature: original.time_signature || undefined,
    projectData: original.project_data as Record<string, any>,
  });
  
  return newProject;
}

/**
 * Increment play count
 */
export async function incrementPlayCount(projectId: string): Promise<void> {
  const db = getDatabase();
  await db.query(
    `UPDATE projects SET play_count = play_count + 1 WHERE id = $1`,
    [projectId]
  );
}

