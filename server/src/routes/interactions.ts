/**
 * Interaction routes for media panel
 * Handles likes, comments, shares, remixes, and follows
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDatabase } from '../services/database.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { createNotification } from '../services/notifications.js';

const LikeProjectSchema = z.object({
  projectId: z.string().uuid(),
});

const CommentProjectSchema = z.object({
  projectId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  parentId: z.string().uuid().optional(),
});

const ShareProjectSchema = z.object({
  projectId: z.string().uuid(),
  platform: z.enum(['twitter', 'facebook', 'copy_link']).optional(),
});

const RemixProjectSchema = z.object({
  projectId: z.string().uuid(),
  changesSummary: z.string().max(1000).optional(),
  credits: z.string().max(500).optional(),
});

const FollowUserSchema = z.object({
  userId: z.string().uuid(),
});

export async function interactionRoutes(server: FastifyInstance) {
  // POST /api/interactions/projects/:projectId/like - Toggle like on project
  server.post('/projects/:projectId/like', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const userId = request.user!.userId;
      const db = getDatabase();

      // Check if project exists
      const projectResult = await db.query('SELECT id, user_id, title FROM projects WHERE id = $1', [projectId]);
      if (projectResult.rows.length === 0) {
        throw new NotFoundError('Project not found');
      }

      const project = projectResult.rows[0];

      // Check if already liked
      const likeResult = await db.query(
        'SELECT id FROM project_likes WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );

      let liked = false;
      if (likeResult.rows.length > 0) {
        // Unlike
        await db.query('DELETE FROM project_likes WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
      } else {
        // Like
        await db.query('INSERT INTO project_likes (project_id, user_id) VALUES ($1, $2)', [projectId, userId]);
        liked = true;

        // Create notification for project owner (if not self-like)
        if (project.user_id !== userId) {
          const db = getDb();
          await createNotification(db, {
            userId: project.user_id,
            type: 'project_liked',
            data: {
              projectId,
              projectTitle: project.title,
              likedByUserId: userId,
            },
          });
        }
      }

      // Get updated like count
      const countResult = await db.query(
        'SELECT COUNT(*) as count FROM project_likes WHERE project_id = $1',
        [projectId]
      );
      const likeCount = parseInt(countResult.rows[0]?.count || '0', 10);

      return reply.send({
        liked,
        likeCount,
      });
    } catch (error) {
      logger.error('Error toggling like:', error);
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/interactions/projects/:projectId/comments - Add comment
  server.post('/projects/:projectId/comments', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const body = CommentProjectSchema.parse(request.body);
      const userId = request.user!.userId;
      const db = getDatabase();

      // Check if project exists
      const projectResult = await db.query('SELECT id, user_id, title FROM projects WHERE id = $1', [projectId]);
      if (projectResult.rows.length === 0) {
        throw new NotFoundError('Project not found');
      }

      const project = projectResult.rows[0];

      // If parentId provided, check if parent comment exists
      if (body.parentId) {
        const parentResult = await db.query('SELECT id FROM project_comments WHERE id = $1 AND project_id = $2', [body.parentId, projectId]);
        if (parentResult.rows.length === 0) {
          throw new NotFoundError('Parent comment not found');
        }
      }

      // Insert comment
      const result = await db.query(
        `INSERT INTO project_comments (project_id, user_id, parent_id, text)
         VALUES ($1, $2, $3, $4)
         RETURNING id, project_id, user_id, parent_id, text, like_count, created_at, updated_at`,
        [projectId, userId, body.parentId || null, body.content]
      );

      const comment = result.rows[0];

      // Get comment author info
      const userResult = await db.query('SELECT id, username, avatar_url FROM users WHERE id = $1', [userId]);
      const author = userResult.rows[0];

      // Get updated comment count
      const countResult = await db.query(
        'SELECT COUNT(*) as count FROM project_comments WHERE project_id = $1 AND is_deleted = false',
        [projectId]
      );
      const commentCount = parseInt(countResult.rows[0]?.count || '0', 10);

      // Create notification for project owner (if not self-comment)
      if (project.user_id !== userId) {
        await createNotification(db, {
          userId: project.user_id,
          type: 'project_commented',
          data: {
            projectId,
            projectTitle: project.title,
            commentId: comment.id,
            commentedByUserId: userId,
            commentedByUsername: author.username,
          },
        });
      }

      // If replying to a comment, notify the parent comment author
      if (body.parentId) {
        const parentCommentResult = await db.query('SELECT user_id FROM project_comments WHERE id = $1', [body.parentId]);
        const parentCommentAuthorId = parentCommentResult.rows[0]?.user_id;
        if (parentCommentAuthorId && parentCommentAuthorId !== userId && parentCommentAuthorId !== project.user_id) {
          await createNotification(db, {
            userId: parentCommentAuthorId,
            type: 'comment_replied',
            data: {
              projectId,
              projectTitle: project.title,
              commentId: comment.id,
              parentCommentId: body.parentId,
              repliedByUserId: userId,
              repliedByUsername: author.username,
            },
          });
        }
      }

      return reply.send({
        comment: {
          id: comment.id,
          projectId: comment.project_id,
          userId: comment.user_id,
          parentId: comment.parent_id,
          text: comment.text,
          likeCount: parseInt(comment.like_count || '0', 10),
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
          author: {
            id: author.id,
            username: author.username,
            avatarUrl: author.avatar_url,
          },
        },
        commentCount,
      });
    } catch (error) {
      logger.error('Error adding comment:', error);
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request body', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/interactions/projects/:projectId/comments - Get comments
  server.get('/projects/:projectId/comments', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const query = z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      }).parse(request.query);
      const db = getDatabase();

      // Check if project exists
      const projectResult = await db.query('SELECT id FROM projects WHERE id = $1', [projectId]);
      if (projectResult.rows.length === 0) {
        throw new NotFoundError('Project not found');
      }

      const offset = (query.page - 1) * query.limit;

      // Get comments (top-level only, sorted by created_at)
      const result = await db.query(
        `SELECT 
          c.id,
          c.project_id,
          c.user_id,
          c.parent_id,
          c.text,
          c.like_count,
          c.created_at,
          c.updated_at,
          u.username,
          u.avatar_url
        FROM project_comments c
        INNER JOIN users u ON c.user_id = u.id
        WHERE c.project_id = $1 AND c.is_deleted = false AND c.parent_id IS NULL
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3`,
        [projectId, query.limit, offset]
      );

      // Get replies for each comment
      const comments = await Promise.all(result.rows.map(async (row) => {
        const repliesResult = await db.query(
          `SELECT 
            c.id,
            c.project_id,
            c.user_id,
            c.parent_id,
            c.text,
            c.like_count,
            c.created_at,
            c.updated_at,
            u.username,
            u.avatar_url
          FROM project_comments c
          INNER JOIN users u ON c.user_id = u.id
          WHERE c.parent_id = $1 AND c.is_deleted = false
          ORDER BY c.created_at ASC
          LIMIT 10`,
          [row.id]
        );

        return {
          id: row.id,
          projectId: row.project_id,
          userId: row.user_id,
          parentId: row.parent_id,
          text: row.text,
          likeCount: parseInt(row.like_count || '0', 10),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          author: {
            id: row.user_id,
            username: row.username,
            avatarUrl: row.avatar_url,
          },
          replies: repliesResult.rows.map((reply) => ({
            id: reply.id,
            projectId: reply.project_id,
            userId: reply.user_id,
            parentId: reply.parent_id,
            text: reply.text,
            likeCount: parseInt(reply.like_count || '0', 10),
            createdAt: reply.created_at,
            updatedAt: reply.updated_at,
            author: {
              id: reply.user_id,
              username: reply.username,
              avatarUrl: reply.avatar_url,
            },
          })),
        };
      }));

      // Get total count
      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM project_comments WHERE project_id = $1 AND is_deleted = false AND parent_id IS NULL',
        [projectId]
      );
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      return reply.send({
        comments,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          hasMore: offset + comments.length < total,
        },
      });
    } catch (error) {
      logger.error('Error fetching comments:', error);
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid query parameters', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/interactions/projects/:projectId/share - Share project
  server.post('/projects/:projectId/share', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const body = ShareProjectSchema.parse(request.body);
      const userId = request.user!.userId;
      const db = getDatabase();

      // Check if project exists
      const projectResult = await db.query('SELECT id, user_id, title FROM projects WHERE id = $1', [projectId]);
      if (projectResult.rows.length === 0) {
        throw new NotFoundError('Project not found');
      }

      // Record share
      await db.query(
        'INSERT INTO project_shares (project_id, user_id, platform) VALUES ($1, $2, $3)',
        [projectId, userId, body.platform || 'copy_link']
      );

      return reply.send({
        success: true,
        message: 'Project shared successfully',
      });
    } catch (error) {
      logger.error('Error sharing project:', error);
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request body', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/interactions/projects/:projectId/remix - Create remix
  server.post('/projects/:projectId/remix', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const body = RemixProjectSchema.parse(request.body);
      const userId = request.user!.userId;
      const db = getDatabase();

      // Check if project exists and is public
      const projectResult = await db.query('SELECT id, user_id, title, project_data FROM projects WHERE id = $1 AND is_public = true', [projectId]);
      if (projectResult.rows.length === 0) {
        throw new NotFoundError('Project not found or not public');
      }

      const originalProject = projectResult.rows[0];

      // Check if user already remixed this project
      const existingRemixResult = await db.query(
        'SELECT remix_project_id FROM project_remixes WHERE original_project_id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (existingRemixResult.rows.length > 0) {
        // Return existing remix
        const remixProjectId = existingRemixResult.rows[0].remix_project_id;
        const remixProjectResult = await db.query('SELECT * FROM projects WHERE id = $1', [remixProjectId]);
        return reply.send({
          remixProject: remixProjectResult.rows[0],
          originalProject,
          isNew: false,
        });
      }

      // Create remix project (duplicate original project)
      const remixProjectResult = await db.query(
        `INSERT INTO projects (
          user_id, title, description, project_data, version, is_public, is_unlisted
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          userId,
          `${originalProject.title} (Remix)`,
          body.changesSummary || `Remix of ${originalProject.title}`,
          originalProject.project_data,
          '1.0.0',
          false, // Remixes are private by default
          false,
        ]
      );

      const remixProject = remixProjectResult.rows[0];

      // Create remix record
      await db.query(
        'INSERT INTO project_remixes (original_project_id, remix_project_id, user_id, changes_summary, credits) VALUES ($1, $2, $3, $4, $5)',
        [projectId, remixProject.id, userId, body.changesSummary || null, body.credits || null]
      );

      // Create notification for original project owner
      if (originalProject.user_id !== userId) {
        await createNotification(db, {
          userId: originalProject.user_id,
          type: 'project_remixed',
          data: {
            originalProjectId: projectId,
            originalProjectTitle: originalProject.title,
            remixProjectId: remixProject.id,
            remixProjectTitle: remixProject.title,
            remixedByUserId: userId,
          },
        });
      }

      return reply.send({
        remixProject,
        originalProject,
        isNew: true,
      });
    } catch (error) {
      logger.error('Error creating remix:', error);
      if (error instanceof NotFoundError) {
        return reply.code(404).send({ error: error.message });
      }
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Invalid request body', details: error.errors });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/interactions/users/:userId/follow - Follow/unfollow user
  server.post('/users/:userId/follow', { preHandler: [server.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId: targetUserId } = request.params as { userId: string };
      const userId = request.user!.userId;
      const db = getDatabase();

      if (targetUserId === userId) {
        throw new BadRequestError('Cannot follow yourself');
      }

      // Check if user exists
      const userResult = await db.query('SELECT id, username FROM users WHERE id = $1', [targetUserId]);
      if (userResult.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      const targetUser = userResult.rows[0];

      // Check if already following
      const followResult = await db.query(
        'SELECT id FROM user_follows WHERE follower_id = $1 AND following_id = $2',
        [userId, targetUserId]
      );

      let following = false;
      if (followResult.rows.length > 0) {
        // Unfollow
        await db.query('DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2', [userId, targetUserId]);
      } else {
        // Follow
        await db.query('INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)', [userId, targetUserId]);
        following = true;

        // Create notification
        await createNotification(db, {
          userId: targetUserId,
          type: 'new_follower',
          data: {
            followerUserId: userId,
            followerUsername: request.user!.username,
          },
        });
      }

      // Get updated follower/following counts
      const followerCountResult = await db.query(
        'SELECT COUNT(*) as count FROM user_follows WHERE following_id = $1',
        [targetUserId]
      );
      const followerCount = parseInt(followerCountResult.rows[0]?.count || '0', 10);

      const followingCountResult = await db.query(
        'SELECT COUNT(*) as count FROM user_follows WHERE follower_id = $1',
        [targetUserId]
      );
      const followingCount = parseInt(followingCountResult.rows[0]?.count || '0', 10);

      return reply.send({
        following,
        followerCount,
        followingCount,
      });
    } catch (error) {
      logger.error('Error toggling follow:', error);
      if (error instanceof NotFoundError || error instanceof BadRequestError) {
        return reply.code(error instanceof NotFoundError ? 404 : 400).send({ error: error.message });
      }
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}

