/**
 * Project routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createProject,
  findProjectById,
  findProjectByShareToken,
  updateProject,
  deleteProject,
  listProjects,
  canAccessProject,
  canEditProject,
  duplicateProject,
  incrementPlayCount,
} from '../services/projects.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { JWTPayload } from '../middleware/auth.js';

const CreateProjectSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  thumbnailUrl: z.string().url().optional(),
  bpm: z.number().int().min(1).max(300).optional(),
  keySignature: z.string().optional(),
  timeSignature: z.string().optional(),
  projectData: z.record(z.any()),
  isPublic: z.boolean().optional(),
  isUnlisted: z.boolean().optional(),
});

const UpdateProjectSchema = CreateProjectSchema.partial();

export async function projectRoutes(server: FastifyInstance) {
  // Get all projects
  server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as {
        userId?: string;
        public?: string;
        search?: string;
        page?: string;
        limit?: string;
        sortBy?: string;
        sortOrder?: string;
      };
      
      const result = await listProjects({
        userId: query.userId,
        isPublic: query.public === 'true' ? true : query.public === 'false' ? false : undefined,
        search: query.search,
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        sortBy: query.sortBy as any,
        sortOrder: query.sortOrder as 'asc' | 'desc',
      });
      
      return {
        projects: result.projects.map(p => ({
          id: p.id,
          userId: p.user_id,
          title: p.title,
          description: p.description,
          thumbnailUrl: p.thumbnail_url,
          bpm: p.bpm,
          keySignature: p.key_signature,
          timeSignature: p.time_signature,
          version: p.version,
          isPublic: p.is_public,
          isUnlisted: p.is_unlisted,
          playCount: p.play_count,
          likeCount: p.like_count,
          remixCount: p.remix_count,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          publishedAt: p.published_at,
          previewAudioUrl: p.preview_audio_url,
          previewAudioDuration: p.preview_audio_duration,
          previewAudioRenderedAt: p.preview_audio_rendered_at,
          previewAudioStatus: p.preview_audio_status,
        })),
        pagination: {
          page: query.page ? parseInt(query.page, 10) : 1,
          limit: query.limit ? parseInt(query.limit, 10) : 20,
          total: result.total,
          totalPages: Math.ceil(result.total / (query.limit ? parseInt(query.limit, 10) : 20)),
        },
      };
    } catch (error: any) {
      throw error;
    }
  });
  
  // Create project
  server.post('/', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        throw new ForbiddenError('Authentication required');
      }
      
      const body = CreateProjectSchema.parse(request.body);
      
      const project = await createProject({
        userId: request.user.userId,
        title: body.title,
        description: body.description,
        thumbnailUrl: body.thumbnailUrl,
        bpm: body.bpm,
        keySignature: body.keySignature,
        timeSignature: body.timeSignature,
        projectData: body.projectData,
      });
      
      // Update public/unlisted if provided
      if (body.isPublic !== undefined || body.isUnlisted !== undefined) {
        await updateProject(project.id, {
          isPublic: body.isPublic,
          isUnlisted: body.isUnlisted,
        });
      }
      
      reply.code(201);
      
      return {
        project: {
          id: project.id,
          userId: project.user_id,
          title: project.title,
          description: project.description,
          thumbnailUrl: project.thumbnail_url,
          bpm: project.bpm,
          keySignature: project.key_signature,
          timeSignature: project.time_signature,
          projectData: project.project_data,
          version: project.version,
          isPublic: project.is_public,
          isUnlisted: project.is_unlisted,
          playCount: project.play_count,
          likeCount: project.like_count,
          remixCount: project.remix_count,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        },
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new BadRequestError('Validation failed', error.errors);
      }
      throw error;
    }
  });
  
  // Get project by ID (optional auth - public projects can be accessed without login)
  server.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      
      // Try to get userId from token (optional authentication)
      let userId: string | null = null;
      try {
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const decoded = await server.jwt.verify<JWTPayload>(token);
          // ✅ FIX: Type-safe JWT payload access
          if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded) {
            userId = (decoded as JWTPayload).userId;
          }
        }
      } catch (error) {
        // Ignore auth errors - user will be treated as anonymous
      }
      
      const project = await findProjectById(id);
      if (!project) {
        throw new NotFoundError('Project not found');
      }
      
      // Check access
      const hasAccess = await canAccessProject(userId, id);
      if (!hasAccess) {
        throw new ForbiddenError('Access denied');
      }
      
      // Increment play count if not owner
      if (userId && userId !== project.user_id) {
        await incrementPlayCount(id);
      }
      
      return {
        project: {
          id: project.id,
          userId: project.user_id,
          title: project.title,
          description: project.description,
          thumbnailUrl: project.thumbnail_url,
          bpm: project.bpm,
          keySignature: project.key_signature,
          timeSignature: project.time_signature,
          projectData: project.project_data,
          version: project.version,
          isPublic: project.is_public,
          isUnlisted: project.is_unlisted,
          shareToken: project.share_token,
          playCount: project.play_count,
          likeCount: project.like_count,
          remixCount: project.remix_count,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
          publishedAt: project.published_at,
        },
      };
    } catch (error: any) {
      throw error;
    }
  });
  
  // Update project
  server.put('/:id', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        throw new ForbiddenError('Authentication required');
      }
      
      const { id } = request.params as { id: string };
      const body = UpdateProjectSchema.parse(request.body);
      
      // Check if user can edit
      const canEdit = await canEditProject(request.user.userId, id);
      if (!canEdit) {
        throw new ForbiddenError('You do not have permission to edit this project');
      }
      
      const project = await updateProject(id, {
        title: body.title,
        description: body.description,
        thumbnailUrl: body.thumbnailUrl,
        bpm: body.bpm,
        keySignature: body.keySignature,
        timeSignature: body.timeSignature,
        projectData: body.projectData,
        isPublic: body.isPublic,
        isUnlisted: body.isUnlisted,
      });
      
      return {
        project: {
          id: project.id,
          userId: project.user_id,
          title: project.title,
          description: project.description,
          thumbnailUrl: project.thumbnail_url,
          bpm: project.bpm,
          keySignature: project.key_signature,
          timeSignature: project.time_signature,
          projectData: project.project_data,
          version: project.version,
          isPublic: project.is_public,
          isUnlisted: project.is_unlisted,
          playCount: project.play_count,
          likeCount: project.like_count,
          remixCount: project.remix_count,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        },
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new BadRequestError('Validation failed', error.errors);
      }
      throw error;
    }
  });
  
  // Delete project
  server.delete('/:id', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        throw new ForbiddenError('Authentication required');
      }
      
      const { id } = request.params as { id: string };
      
      // Check if user owns project
      const project = await findProjectById(id);
      if (!project) {
        throw new NotFoundError('Project not found');
      }
      
      if (project.user_id !== request.user.userId) {
        // Check if user can delete (collaborator with can_delete permission)
        const canEdit = await canEditProject(request.user.userId, id);
        if (!canEdit) {
          throw new ForbiddenError('You do not have permission to delete this project');
        }
        
        // Check collaborator delete permission
        const db = (await import('../services/database.js')).getDatabase();
        const collaboratorResult = await db.query(
          `SELECT can_delete FROM project_collaborators
           WHERE project_id = $1 AND user_id = $2 AND is_active = true`,
          [id, request.user.userId]
        );
        
        if (collaboratorResult.rows.length === 0 || !collaboratorResult.rows[0].can_delete) {
          throw new ForbiddenError('You do not have permission to delete this project');
        }
      }
      
      await deleteProject(id);
      
      return {
        message: 'Project deleted successfully',
      };
    } catch (error: any) {
      throw error;
    }
  });
  
  // Render project preview
  server.post('/:id/render-preview', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        throw new ForbiddenError('Authentication required');
      }
      
      const { id } = request.params as { id: string };
      
      // Check if user can edit
      const canEdit = await canEditProject(request.user.userId, id);
      if (!canEdit) {
        throw new ForbiddenError('You do not have permission to render this project');
      }
      
      // Trigger render (async, don't wait)
      const { getAudioRenderService } = await import('../services/audioRender.js');
      const renderService = getAudioRenderService();
      
      // Initialize if needed
      await renderService.initialize();
      
      // Start render in background
      renderService.renderProjectPreview(id).catch((error) => {
        logger.error(`Failed to render preview for project ${id}:`, error);
      });
      
      return {
        message: 'Render started',
        status: 'queued',
      };
    } catch (error: any) {
      throw error;
    }
  });
  
  // Upload client-side rendered preview audio
  // ✅ FIX: Support both base64 (legacy) and multipart/form-data (streaming) uploads
  server.post('/:id/upload-preview', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        throw new ForbiddenError('Authentication required');
      }
      const { id } = request.params as { id: string };

      const project = await findProjectById(id);
      if (!project) {
        throw new NotFoundError('Project not found');
      }

      // Only owner can upload preview
      if (project.user_id !== request.user.userId) {
        throw new ForbiddenError('You do not have permission to upload preview for this project');
      }

      const contentType = request.headers['content-type'] || '';
      let audioBuffer: Buffer | null = null;
      let duration: number;

      // ✅ NEW: Support multipart/form-data (streaming upload, no base64 overhead)
      if (contentType.includes('multipart/form-data')) {
        logger.info(`📦 [UPLOAD_PREVIEW] Starting multipart parsing...`);
        logger.info(`📦 [UPLOAD_PREVIEW] Content-Type: ${contentType}`);
        logger.info(`📦 [UPLOAD_PREVIEW] Request body type: ${typeof request.body}`);
        logger.info(`📦 [UPLOAD_PREVIEW] Request body keys: ${request.body ? Object.keys(request.body as any) : 'null'}`);

        const body = request.body as any;
        
        // ✅ FIX: Check if multipart data was pre-parsed by Vercel handler (busboy)
        if (body && typeof body === 'object' && 'fields' in body && 'files' in body) {
          logger.info(`✅ [UPLOAD_PREVIEW] Using pre-parsed multipart data from Vercel handler`);
          const parsedData = body as { fields: Record<string, string>; files: Record<string, { buffer: Buffer; filename: string; mimetype: string }> };
          
          // Get duration from fields
          const durationValue = parsedData.fields['duration'];
          if (!durationValue) {
            throw new BadRequestError('duration field is required');
          }
          
          // Get file from files (accept any file field name)
          const fileKeys = Object.keys(parsedData.files);
          if (fileKeys.length === 0) {
            throw new BadRequestError('No file provided in multipart form');
          }
          
          const fileKey = fileKeys[0]; // Use first file
          const fileInfo = parsedData.files[fileKey];
          audioBuffer = fileInfo.buffer;
          duration = parseFloat(durationValue);
          
          logger.info(`📁 [UPLOAD_PREVIEW] File received: ${fileInfo.filename}, size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`);
          logger.info(`📤 [UPLOAD_PREVIEW] Multipart upload completed: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB, duration: ${duration}s`);
        } else {
          // ✅ FALLBACK: Try request.parts() if pre-parsed data not available
          let fileData: any = null;
          let durationValue: string | null = null;

          // Try request.body first (if attachFieldsToBody works)
          if (body && typeof body === 'object' && 'duration' in body) {
            durationValue = body.duration;
            logger.info(`📝 [UPLOAD_PREVIEW] Duration from request.body: ${durationValue}`);
          }

          // Use request.parts() to parse multipart data
          try {
            logger.info(`🔄 [UPLOAD_PREVIEW] Calling request.parts()...`);
            let partCount = 0;
            for await (const part of request.parts()) {
              partCount++;
              logger.info(`📦 [UPLOAD_PREVIEW] Part ${partCount}: type=${part.type}, fieldname=${(part as any).fieldname || 'N/A'}`);
              
              if (part.type === 'field') {
                const field = part as any;
                logger.info(`📝 [UPLOAD_PREVIEW] Field: ${field.fieldname} = ${field.value?.substring(0, 50) || 'empty'}...`);
                if (field.fieldname === 'duration') {
                  durationValue = field.value;
                  logger.info(`✅ [UPLOAD_PREVIEW] Duration from parts(): ${durationValue}`);
                }
              } else if (part.type === 'file') {
                fileData = part;
                logger.info(`📁 [UPLOAD_PREVIEW] File part found: ${(fileData as any).filename || 'unknown'}`);
                audioBuffer = await fileData.toBuffer();
                logger.info(`✅ [UPLOAD_PREVIEW] File buffer created: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`);
              }
            }
            logger.info(`✅ [UPLOAD_PREVIEW] Parts loop completed. Total parts: ${partCount}`);
          } catch (error: any) {
            logger.error(`❌ [UPLOAD_PREVIEW] Error parsing multipart: ${error.message}`);
            logger.error(`❌ [UPLOAD_PREVIEW] Error stack: ${error.stack}`);
            // Fallback: try request.file() if parts() fails
            if (!fileData) {
              logger.info(`🔄 [UPLOAD_PREVIEW] Trying fallback: request.file()...`);
              try {
                const fallbackFile = await request.file();
                if (fallbackFile) {
                  fileData = fallbackFile;
                  audioBuffer = await fileData.toBuffer();
                  logger.info(`✅ [UPLOAD_PREVIEW] File received via fallback: ${fileData.filename || 'unknown'}, size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`);
                } else {
                  logger.error(`❌ [UPLOAD_PREVIEW] request.file() also returned null`);
                }
              } catch (fallbackError: any) {
                logger.error(`❌ [UPLOAD_PREVIEW] Fallback request.file() also failed: ${fallbackError.message}`);
              }
            }
          }

          if (!fileData || !audioBuffer) {
            logger.error('❌ [UPLOAD_PREVIEW] No file received in multipart form');
            logger.error('❌ [UPLOAD_PREVIEW] Content-Type:', contentType);
            logger.error('❌ [UPLOAD_PREVIEW] Request body keys:', Object.keys(body || {}));
            logger.error('❌ [UPLOAD_PREVIEW] Request headers:', JSON.stringify(request.headers, null, 2));
            throw new BadRequestError('No file provided in multipart form');
          }

          if (!durationValue) {
            logger.error('❌ [UPLOAD_PREVIEW] Duration not found in request.body or parts()');
            logger.error('❌ [UPLOAD_PREVIEW] Request body:', JSON.stringify(body, null, 2));
            throw new BadRequestError('duration field is required');
          }

          duration = parseFloat(durationValue);
          logger.info(`📤 [UPLOAD_PREVIEW] Multipart upload completed: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB, duration: ${duration}s`);
        }
      } else {
        // ✅ LEGACY: Support base64 JSON (for backward compatibility)
        const body = request.body as { audioBuffer: string; duration: number };
        if (!body.audioBuffer || !body.duration) {
          throw new BadRequestError('audioBuffer and duration are required');
        }

        // Decode base64 to buffer
        audioBuffer = Buffer.from(body.audioBuffer, 'base64');
        duration = body.duration;

        logger.info(`📤 [UPLOAD_PREVIEW] Base64 upload: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      }

      if (!audioBuffer) {
        throw new BadRequestError('No audio data provided');
      }

      const filename = `${id}-preview.wav`;
      const storageKey = `project-previews/${id}/${filename}`;

      // Upload to CDN
      logger.info(`📤 [UPLOAD_PREVIEW] Starting CDN upload for project ${id}...`);
      const cdnUploadStartTime = Date.now();
      const { storageService } = await import('../services/storage.js');
      const storageResult = await storageService.uploadFile(
        project.user_id,
        id, // assetId
        filename,
        audioBuffer,
        false, // not system asset
        undefined,
        undefined,
        storageKey
      );
      const cdnUploadTime = Date.now() - cdnUploadStartTime;
      logger.info(`✅ [UPLOAD_PREVIEW] CDN upload completed in ${cdnUploadTime}ms: ${storageResult.storageUrl}`);

      // Update project with preview URL
      logger.info(`💾 [UPLOAD_PREVIEW] Updating project ${id} with preview URL...`);
      await updateProject(id, {
        previewAudioUrl: storageResult.storageUrl,
        previewAudioDuration: Math.round(duration),
        previewAudioRenderedAt: new Date(),
        previewAudioStatus: 'ready',
      });
      logger.info(`✅ [UPLOAD_PREVIEW] Project ${id} updated successfully`);

      return {
        message: 'Preview uploaded successfully',
        previewAudioUrl: storageResult.storageUrl,
        duration: Math.round(duration),
      };
    } catch (error: any) {
      logger.error(`[UPLOAD_PREVIEW] Error uploading preview for project:`, error);
      throw error;
    }
  });

  // Duplicate project
  server.post('/:id/duplicate', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        throw new ForbiddenError('Authentication required');
      }
      
      const { id } = request.params as { id: string };
      const body = request.body as { title?: string } | undefined;
      
      const newProject = await duplicateProject(id, request.user.userId, body?.title);
      
      reply.code(201);
      
      return {
        project: {
          id: newProject.id,
          userId: newProject.user_id,
          title: newProject.title,
          description: newProject.description,
          thumbnailUrl: newProject.thumbnail_url,
          bpm: newProject.bpm,
          keySignature: newProject.key_signature,
          timeSignature: newProject.time_signature,
          projectData: newProject.project_data,
          version: newProject.version,
          isPublic: newProject.is_public,
          isUnlisted: newProject.is_unlisted,
          playCount: newProject.play_count,
          likeCount: newProject.like_count,
          remixCount: newProject.remix_count,
          createdAt: newProject.created_at,
          updatedAt: newProject.updated_at,
        },
      };
    } catch (error: any) {
      throw error;
    }
  });
}
