/**
 * Feed routes for media panel
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../services/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const FeedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['recent', 'popular', 'trending']).default('recent'),
  filter: z.enum(['all', 'following', 'genre']).default('all'),
  genre: z.string().optional(),
});

export async function feedRoutes(server: FastifyInstance) {
  // GET /api/feed - Get feed projects
  server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = FeedQuerySchema.parse(request.query);
      const db = getDatabase();
      const userId = request.user?.userId;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Filter: only public projects for non-owners
      if (!userId || !query.filter.includes('following')) {
        conditions.push(`p.is_public = true`);
      }

      // Filter by following
      if (query.filter === 'following' && userId) {
        conditions.push(`p.user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $${paramIndex})`);
        params.push(userId);
        paramIndex++;
      }

      // Build is_liked subquery
      const isLikedQuery = userId 
        ? `EXISTS(SELECT 1 FROM project_likes pl2 WHERE pl2.project_id = p.id AND pl2.user_id = $${paramIndex})`
        : 'false';
      
      if (userId) {
        params.push(userId);
        paramIndex++;
      }

      let projectsQuery = `
        SELECT 
          p.id,
          p.title,
          p.description,
          p.thumbnail_url,
          p.bpm,
          p.key_signature,
          p.time_signature,
          p.is_public,
          p.is_unlisted,
          p.created_at,
          p.updated_at,
          u.id as user_id,
          u.username,
          u.avatar_url,
          COUNT(DISTINCT pl.id) as like_count,
          COUNT(DISTINCT pc.id) as comment_count,
          COUNT(DISTINCT pr.id) as remix_count,
          COUNT(DISTINCT pv.id) as view_count,
          ${isLikedQuery} as is_liked
        FROM projects p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN project_likes pl ON pl.project_id = p.id
        LEFT JOIN project_comments pc ON pc.project_id = p.id AND pc.is_deleted = false
        LEFT JOIN project_remixes pr ON pr.original_project_id = p.id
        LEFT JOIN project_views pv ON pv.project_id = p.id
      `;

      // Filter by genre (if projects table has genre column)
      if (query.genre) {
        // Note: Assuming projects table might have genre column in the future
        // For now, we'll skip this filter
        logger.warn('Genre filter not yet implemented - projects table needs genre column');
      }

      if (conditions.length > 0) {
        projectsQuery += ` WHERE ${conditions.join(' AND ')}`;
      }

      projectsQuery += ` GROUP BY p.id, u.id, u.username, u.avatar_url`;

      // Sorting
      switch (query.sort) {
        case 'popular':
          projectsQuery += ` ORDER BY like_count DESC, view_count DESC, p.created_at DESC`;
          break;
        case 'trending':
          // Trending: projects with high engagement in last 24 hours
          // Rebuild query for trending with proper param indexing
          const trendingIsLikedQuery = userId 
            ? `EXISTS(SELECT 1 FROM project_likes pl2 WHERE pl2.project_id = p.id AND pl2.user_id = $${paramIndex - 1})`
            : 'false';
          
          projectsQuery = `
            SELECT 
              p.id,
              p.title,
              p.description,
              p.thumbnail_url,
              p.bpm,
              p.key_signature,
              p.time_signature,
              p.is_public,
              p.is_unlisted,
              p.created_at,
              p.updated_at,
              u.id as user_id,
              u.username,
              u.avatar_url,
              COUNT(DISTINCT pl.id) as like_count,
              COUNT(DISTINCT pc.id) as comment_count,
              COUNT(DISTINCT pr.id) as remix_count,
              COUNT(DISTINCT pv.id) as view_count,
              ${trendingIsLikedQuery} as is_liked,
              (
                COUNT(DISTINCT CASE WHEN pl.created_at > NOW() - INTERVAL '24 hours' THEN pl.id END) +
                COUNT(DISTINCT CASE WHEN pc.created_at > NOW() - INTERVAL '24 hours' THEN pc.id END) * 2 +
                COUNT(DISTINCT CASE WHEN pv.created_at > NOW() - INTERVAL '24 hours' THEN pv.id END) * 0.5
              ) as trending_score
            FROM projects p
            INNER JOIN users u ON p.user_id = u.id
            LEFT JOIN project_likes pl ON pl.project_id = p.id
            LEFT JOIN project_comments pc ON pc.project_id = p.id AND pc.is_deleted = false
            LEFT JOIN project_remixes pr ON pr.original_project_id = p.id
            LEFT JOIN project_views pv ON pv.project_id = p.id
            ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
            GROUP BY p.id, u.id, u.username, u.avatar_url
            ORDER BY trending_score DESC, p.created_at DESC
          `;
          break;
        case 'recent':
        default:
          projectsQuery += ` ORDER BY p.created_at DESC`;
          break;
      }

      // Pagination
      const offset = (query.page - 1) * query.limit;
      projectsQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(query.limit, offset);

      const result = await db.query(projectsQuery, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM projects p
        ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      `;
      const countParams = params.slice(0, paramIndex - 1); // Remove limit and offset
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      const projects = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        thumbnailUrl: row.thumbnail_url,
        bpm: row.bpm,
        keySignature: row.key_signature,
        timeSignature: row.time_signature,
        isPublic: row.is_public,
        isUnlisted: row.is_unlisted,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: {
          id: row.user_id,
          username: row.username,
          avatarUrl: row.avatar_url,
        },
        stats: {
          likes: parseInt(row.like_count || '0', 10),
          comments: parseInt(row.comment_count || '0', 10),
          remixes: parseInt(row.remix_count || '0', 10),
          views: parseInt(row.view_count || '0', 10),
        },
        isLiked: Boolean(row.is_liked) || false,
      }));

      return reply.send({
        projects,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          hasMore: offset + projects.length < total,
        },
      });
    } catch (error) {
      logger.error('Error fetching feed:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid query parameters', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/feed/trending - Get trending projects
  server.get('/trending', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = z.object({
        period: z.enum(['24h', '7d', '30d']).default('24h'),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }).parse(request.query);

      const db = getDatabase();
      const userId = request.user?.userId;

      const periodHours = query.period === '24h' ? 24 : query.period === '7d' ? 168 : 720;

      const result = await db.query(`
        SELECT 
          p.id,
          p.title,
          p.description,
          p.thumbnail_url,
          p.bpm,
          p.key_signature,
          p.time_signature,
          p.is_public,
          p.is_unlisted,
          p.created_at,
          p.updated_at,
          u.id as user_id,
          u.username,
          u.avatar_url,
          COUNT(DISTINCT pl.id) as like_count,
          COUNT(DISTINCT pc.id) as comment_count,
          COUNT(DISTINCT pr.id) as remix_count,
          COUNT(DISTINCT pv.id) as view_count,
          ${userId ? `EXISTS(SELECT 1 FROM project_likes pl2 WHERE pl2.project_id = p.id AND pl2.user_id = $1) as is_liked` : 'false as is_liked'},
          (
            COUNT(DISTINCT CASE WHEN pl.created_at > NOW() - INTERVAL '${periodHours} hours' THEN pl.id END) +
            COUNT(DISTINCT CASE WHEN pc.created_at > NOW() - INTERVAL '${periodHours} hours' THEN pc.id END) * 2 +
            COUNT(DISTINCT CASE WHEN pv.created_at > NOW() - INTERVAL '${periodHours} hours' THEN pv.id END) * 0.5
          ) as trending_score
        FROM projects p
        INNER JOIN users u ON p.user_id = u.id
        LEFT JOIN project_likes pl ON pl.project_id = p.id
        LEFT JOIN project_comments pc ON pc.project_id = p.id AND pc.is_deleted = false
        LEFT JOIN project_remixes pr ON pr.original_project_id = p.id
        LEFT JOIN project_views pv ON pv.project_id = p.id
        WHERE p.is_public = true
        GROUP BY p.id, u.id, u.username, u.avatar_url
        HAVING trending_score > 0
        ORDER BY trending_score DESC, p.created_at DESC
        LIMIT $${userId ? 2 : 1}
      `, userId ? [userId, query.limit] : [query.limit]);

      const projects = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        thumbnailUrl: row.thumbnail_url,
        bpm: row.bpm,
        keySignature: row.key_signature,
        timeSignature: row.time_signature,
        isPublic: row.is_public,
        isUnlisted: row.is_unlisted,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: {
          id: row.user_id,
          username: row.username,
          avatarUrl: row.avatar_url,
        },
        stats: {
          likes: parseInt(row.like_count || '0', 10),
          comments: parseInt(row.comment_count || '0', 10),
          remixes: parseInt(row.remix_count || '0', 10),
          views: parseInt(row.view_count || '0', 10),
        },
        isLiked: Boolean(row.is_liked) || false,
        trendingScore: parseFloat(row.trending_score || '0'),
      }));

      return reply.send({
        projects,
        period: query.period,
      });
    } catch (error) {
      logger.error('Error fetching trending projects:', error);
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid query parameters', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

