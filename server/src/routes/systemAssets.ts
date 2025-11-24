/**
 * System Assets Routes
 * Public and admin endpoints for system assets (DAWG Library)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Readable } from 'stream';
import crypto from 'crypto';
import { systemAssetsService } from '../services/systemAssets.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { storageService } from '../services/storage.js';
import { logger } from '../utils/logger.js';

// Validation schemas
const listAssetsSchema = z.object({
  categoryId: z.string().uuid().optional(),
  packId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  bpm: z.coerce.number().int().positive().optional(),
  keySignature: z.string().optional(),
  isActive: z.coerce.boolean().optional(), // ✅ FIX: Use coerce.boolean() like listPacksSchema
  isPremium: z.coerce.boolean().optional(), // ✅ FIX: Use coerce.boolean() like listPacksSchema
  isFeatured: z.coerce.boolean().optional(), // ✅ FIX: Use coerce.boolean() like listPacksSchema
  search: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const listPacksSchema = z.object({
  categoryId: z.string().uuid().optional(),
  isFree: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export async function systemAssetsRoutes(fastify: FastifyInstance) {
  // ==================== PUBLIC ENDPOINTS ====================

  // List system assets (public)
  fastify.get(
    '/system',
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof listAssetsSchema> }>,
      reply: FastifyReply
    ) => {
      const query = listAssetsSchema.parse(request.query);
      
      // ✅ FIX: Check authentication for admin view
      let isAuthenticated = false;
      const authHeader = request.headers.authorization;
      logger.info(`🔐 Auth header present: ${!!authHeader}`);
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = await fastify.jwt.verify(token);
          isAuthenticated = !!decoded;
          logger.info(`✅ Authentication successful: ${isAuthenticated}`);
        } catch (error) {
          isAuthenticated = false;
          logger.warn(`❌ Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        logger.info(`❌ No auth header or not Bearer token`);
      }
      
      // ✅ FIX: Admin users see all assets (unless explicitly filtered)
      // Public users see only active assets
      const isActiveFilter = query.isActive !== undefined 
        ? query.isActive 
        : (isAuthenticated ? undefined : true); // Admin sees all, public sees only active
      
      logger.info(`📋 Query params: limit=${query.limit}, isActive=${isActiveFilter}, isAuthenticated=${isAuthenticated}`);
      
      const result = await systemAssetsService.listAssets({
        ...query,
        isActive: isActiveFilter,
        // Only show premium assets if user is authenticated
        isPremium: isAuthenticated ? query.isPremium : false,
      });
      
      logger.info(`📦 Assets found: ${result.assets.length}, total: ${result.total}`);

      return reply.send({
        assets: result.assets,
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      });
    }
  );

  // Get asset by ID (public)
  fastify.get(
    '/system/:assetId',
    async (request: FastifyRequest<{ Params: { assetId: string } }>, reply: FastifyReply) => {
      const { assetId } = request.params;
      const asset = await systemAssetsService.getAssetById(assetId);
      
      // ✅ FIX: Check if premium asset requires authentication
      const { isAuthenticated } = (request as any).user || {};
      if (asset.isPremium && !isAuthenticated) {
        throw new BadRequestError('Premium assets require authentication');
      }

      return reply.send(asset);
    }
  );

  // Serve asset file (public) with Range Request support
  fastify.get(
    '/system/:assetId/file',
    async (request: FastifyRequest<{ Params: { assetId: string } }>, reply: FastifyReply) => {
      const { assetId } = request.params;
      const asset = await systemAssetsService.getAssetById(assetId);

      // ✅ FIX: Check if premium asset requires authentication
      const { isAuthenticated } = (request as any).user || {};
      if (asset.isPremium && !isAuthenticated) {
        throw new BadRequestError('Premium assets require authentication');
      }

      // ✅ FIX: If storage_url is a CDN URL, proxy from CDN to avoid CORS issues
      if (asset.storageUrl && !asset.storageUrl.startsWith('/api/')) {
        const { logger } = await import('../utils/logger.js');
        logger.info(`📤 [PROXY] Proxying system asset from CDN: ${asset.storageUrl}`);
        
        try {
          // ✅ FIX: Fetch from CDN and proxy to client (avoids CORS)
        const rangeHeader = request.headers.range;
          const headers: Record<string, string> = {};
          
          // Pass Range header to CDN if present
        if (rangeHeader) {
            headers['Range'] = rangeHeader;
          }
          
          // ✅ FIX: Add timeout to prevent hanging
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          const cdnResponse = await fetch(asset.storageUrl, {
            headers,
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (!cdnResponse.ok) {
            logger.error(`❌ [PROXY] CDN fetch failed: ${cdnResponse.status} ${cdnResponse.statusText}`);
            const errorText = await cdnResponse.text().catch(() => 'Unknown error');
            logger.error(`❌ [PROXY] CDN error response: ${errorText}`);
            throw new NotFoundError('File not found on CDN');
          }
          
          // ✅ FIX: Forward response headers from CDN
          // ✅ FIX: Override application/octet-stream with proper audio MIME type
          let contentType = cdnResponse.headers.get('content-type') || asset.mimeType || 'audio/wav';
          if (contentType === 'application/octet-stream' || !contentType.startsWith('audio/')) {
            // Determine MIME type from filename or use default
            const filename = asset.filename || '';
            if (filename.endsWith('.wav')) {
              contentType = 'audio/wav';
            } else if (filename.endsWith('.mp3')) {
              contentType = 'audio/mpeg';
            } else if (filename.endsWith('.ogg')) {
              contentType = 'audio/ogg';
            } else if (filename.endsWith('.m4a')) {
              contentType = 'audio/mp4';
            } else {
              contentType = asset.mimeType || 'audio/wav';
            }
            logger.info(`🔧 [PROXY] Overriding Content-Type from '${cdnResponse.headers.get('content-type')}' to '${contentType}'`);
          }
          const contentLength = cdnResponse.headers.get('content-length');
          const contentRange = cdnResponse.headers.get('content-range');
          const acceptRanges = cdnResponse.headers.get('accept-ranges');
          
          // ✅ FIX: Stream response directly from CDN to avoid encoding issues
          // Convert Web ReadableStream to Node.js Readable stream
          if (!cdnResponse.body) {
            throw new NotFoundError('CDN response has no body');
          }
          
          // ✅ FIX: Convert Web ReadableStream to Node.js Readable
          // This avoids any encoding/decoding issues with arrayBuffer() conversion
          const nodeStream = Readable.fromWeb(cdnResponse.body as any);
          
          logger.info(`📦 [PROXY] Streaming CDN response, Status: ${cdnResponse.status}, Range: ${rangeHeader || 'none'}`);
          
          // ✅ FIX: Set headers before streaming
          reply.header('Content-Type', contentType);
          if (contentLength) {
            reply.header('Content-Length', contentLength);
          }
          if (contentRange) {
            reply.header('Content-Range', contentRange);
            reply.code(206); // Partial Content
          } else {
            reply.code(200);
          }
          if (acceptRanges) {
            reply.header('Accept-Ranges', acceptRanges);
          }
          reply.header('Cache-Control', 'public, max-age=31536000');
          reply.header('Access-Control-Allow-Origin', '*'); // ✅ FIX: Allow CORS
          reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          reply.header('Access-Control-Allow-Headers', 'Range, Content-Type');
          
          // ✅ FIX: Stream directly to client (avoids buffer encoding issues)
          return reply.send(nodeStream);
        } catch (error) {
          logger.error(`❌ [PROXY] CDN proxy failed:`, error);
          // Fall through to local storage
        }
      }

      // ✅ CDN: Otherwise, serve from local storage with Range Request support
      try {
        const fileBuffer = await storageService.getFile(asset.storageKey);
        const fileSize = fileBuffer.length;
        
        // ✅ NEW: Handle Range Request
        const rangeHeader = request.headers.range;
        if (rangeHeader) {
          // Parse Range header (e.g., "bytes=0-176399")
          const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
          if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;
            
            // Validate range
            if (start >= fileSize || end >= fileSize || start > end) {
              reply.code(416).header('Content-Range', `bytes */${fileSize}`);
              return reply.send();
            }
            
            // Extract range from buffer
            const chunk = fileBuffer.slice(start, end + 1);
            
            // Set Range Response headers
            reply.code(206); // Partial Content
            reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            reply.header('Content-Length', chunkSize);
            reply.header('Content-Type', asset.mimeType || 'audio/wav');
            reply.header('Accept-Ranges', 'bytes');
            reply.header('Cache-Control', 'public, max-age=31536000');
            
            return reply.send(chunk);
          }
        }
        
        // No Range Request - send full file
        reply.header('Content-Type', asset.mimeType || 'audio/wav');
        reply.header('Content-Length', fileSize);
        reply.header('Content-Disposition', `inline; filename="${asset.filename}"`);
        reply.header('Accept-Ranges', 'bytes'); // ✅ NEW: Indicate Range Request support
        reply.header('Cache-Control', 'public, max-age=31536000');
        
        return reply.send(fileBuffer);
      } catch (error) {
        console.error(`❌ Failed to read system asset file ${asset.storageKey}:`, error);
        throw new NotFoundError('File not found on server');
      }
    }
  );

  // List asset packs (public, but checks auth for admin view)
  // ✅ Single Source of Truth: Backend determines what to show based on authentication
  fastify.get(
    '/system/packs',
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof listPacksSchema> }>,
      reply: FastifyReply
    ) => {
      const query = listPacksSchema.parse(request.query);
      
      // ✅ Check authentication (silently - don't fail if not authenticated)
      let isAuthenticated = false;
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = await fastify.jwt.verify(token);
          isAuthenticated = !!decoded;
          logger.info({ userId: (decoded as any)?.userId }, '✅ [PACK LISTING] User authenticated');
          isAuthenticated = true;
        } catch (error: any) {
          // Not authenticated, continue as public
          isAuthenticated = false;
          logger.warn({ error: error.message }, '⚠️ [PACK LISTING] JWT verification failed');
        }
      } else {
        logger.warn('⚠️ [PACK LISTING] No Bearer token in Authorization header');
      }
      
      // ✅ Single Source of Truth: Backend decides filter based on authentication
      // Authenticated users (admin) see all packs unless explicitly filtered
      // Public users see only active packs
      const isActiveFilter = query.isActive !== undefined 
        ? query.isActive 
        : (isAuthenticated ? undefined : true);
      
      logger.info({ 
        isAuthenticated, 
        queryIsActive: query.isActive, 
        isActiveFilter,
        limit: query.limit 
      }, '📦 [PACK LISTING] Filter params');
      
      const result = await systemAssetsService.listPacks({
        ...query,
        isActive: isActiveFilter,
      });

      logger.info({ 
        total: result.total, 
        packsCount: result.packs.length 
      }, '📦 [PACK LISTING] Result');

      return reply.send({
        packs: result.packs,
        total: result.total,
        limit: query.limit,
        offset: query.offset,
      });
    }
  );

  // Get pack by ID (public)
  fastify.get(
    '/system/packs/:packId',
    async (request: FastifyRequest<{ Params: { packId: string } }>, reply: FastifyReply) => {
      const { packId } = request.params;
      const { packs } = await systemAssetsService.listPacks({});
      const pack = packs.find((p) => p.id === packId);

      if (!pack) {
        throw new NotFoundError('Pack not found');
      }

      return reply.send(pack);
    }
  );

  // List categories (public)
  fastify.get('/system/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    const categories = await systemAssetsService.listCategories();
    return reply.send({ categories });
  });

  // Track asset usage (requires authentication)
  fastify.post(
    '/system/:assetId/usage',
    { preHandler: [fastify.authenticate] },
    async (
      request: FastifyRequest<{
        Params: { assetId: string };
        Body: { usageType: 'loaded' | 'used_in_project' | 'exported'; projectId?: string };
      }>,
      reply: FastifyReply
    ) => {
      const userId = (request as any).user.userId;
      const { assetId } = request.params;
      const { usageType, projectId } = request.body;

      await systemAssetsService.trackUsage(assetId, userId, usageType, projectId);

      return reply.send({ success: true });
    }
  );

  // ==================== ADMIN ENDPOINTS ====================
  // Note: For now, all authenticated users can access admin endpoints
  // TODO: Add role-based access control (isAdmin check)

  // Upload system asset (admin)
  fastify.post(
    '/admin/system/assets',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      
      logger.info('📤 Starting asset upload...');

      // ✅ FIX: Use request.parts() to read both file and fields
      // Field'lar file'dan önce gönderildiği için önce field'lar okunacak
      let fileData: any = null;
      const formData: any = {};
      
      try {
        logger.info('📋 Parsing multipart data (fields first, then file)...');
        
        // Read all parts - fields come first, then file
        for await (const part of request.parts()) {
          if (part.type === 'field') {
            const field = part as any;
            const fieldValue = field.value;
            logger.info(`📝 Field: ${field.fieldname} = ${fieldValue?.substring(0, 50) || 'empty'}...`);
            
            // Process field value
            if (field.fieldname === 'tags') {
              try {
                formData[field.fieldname] = JSON.parse(fieldValue);
              } catch {
                formData[field.fieldname] = fieldValue.split(',').map((t: string) => t.trim()).filter(Boolean);
              }
            } else if (field.fieldname === 'bpm') {
              formData[field.fieldname] = fieldValue ? parseInt(fieldValue) : undefined;
            } else if (field.fieldname === 'isPremium' || field.fieldname === 'isFeatured' || field.fieldname === 'isActive') {
              formData[field.fieldname] = fieldValue === 'true';
            } else {
              formData[field.fieldname] = fieldValue || undefined;
            }
          } else if (part.type === 'file') {
            fileData = part;
            logger.info(`📁 File part found: ${(part as any).filename || 'unknown'}`);
            // ⚠️ CRITICAL: In Fastify multipart, file part stream MUST be consumed
            // to continue the loop. We need to consume it NOW to unblock.
            // This will read the entire file into memory, but it's necessary
            logger.info(`🔄 Consuming file stream to unblock loop...`);
            // Consume the stream immediately to unblock the loop
            const buffer = await fileData.toBuffer();
            logger.info(`✅ Buffer created: ${buffer.length} bytes`);
            // Store buffer for later use
            (fileData as any).buffer = buffer;
            // Now the loop can continue (though there should be no more parts after file)
          }
        }
        
        logger.info(`✅ Loop completed`);
        
        if (!fileData) {
          logger.error('❌ No file part found');
          throw new BadRequestError('No file provided');
        }
        
        logger.info(`✅ Multipart parsing completed`);
        logger.info(`📋 Form data keys: ${Object.keys(formData).join(', ')}`);
      } catch (error) {
        logger.error('❌ Error parsing multipart data:', error);
        logger.error('❌ Error details:', error instanceof Error ? error.message : String(error));
        logger.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        throw new BadRequestError(`Failed to parse upload data: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (!fileData) {
        logger.error('❌ No file data found');
        throw new BadRequestError('No file provided');
      }

      if (!formData.name) {
        logger.error('❌ No name provided');
        throw new BadRequestError('Name is required');
      }

      // Use the buffer we already created in the try block
      const buffer = (fileData as any).buffer;
      if (!buffer) {
        logger.error('❌ No buffer found - this should not happen');
        throw new BadRequestError('Failed to read file');
      }
      const assetId = crypto.randomUUID();
      const filename = formData.filename || (fileData as any).filename || 'asset.wav';
      
      logger.info(`🆔 Asset ID: ${assetId}`);
      logger.info(`📝 Filename: ${filename}`);
      logger.info(`📝 Name: ${formData.name}`);
      
      // ✅ Get category and pack slugs for organized folder structure
      let categorySlug = 'uncategorized';
      let packSlug = 'default';
      
      if (formData.categoryId) {
        logger.info(`📂 Fetching category: ${formData.categoryId}`);
        const category = await systemAssetsService.getCategoryById(formData.categoryId);
        categorySlug = category?.slug || 'uncategorized';
        logger.info(`📂 Category slug: ${categorySlug}`);
      }
      
      if (formData.packId) {
        logger.info(`📦 Fetching pack: ${formData.packId}`);
        const pack = await systemAssetsService.getPackById(formData.packId);
        packSlug = pack?.slug || 'default';
        logger.info(`📦 Pack slug: ${packSlug}`);
      }

      // ✅ CDN: Upload to storage (Bunny CDN or local) with organized folder structure
      logger.info('☁️ Starting storage upload...');
      const storageResult = await storageService.uploadFile(
        'system', // System assets don't belong to a user
        assetId,
        filename,
        buffer,
        true, // isSystemAsset = true
        categorySlug, // Category slug for folder organization
        packSlug // Pack slug for folder organization
      );

      // Extract audio metadata (basic - can be enhanced later)
      const fileSize = buffer.length;
      logger.info(`✅ Storage upload completed: ${storageResult.storageKey}`);

      // Create asset record
      logger.info('💾 Creating asset record in database...');
      logger.info(`📋 Asset data: name=${formData.name}, categoryId=${formData.categoryId}, packId=${formData.packId}`);
      
      const asset = await systemAssetsService.createAsset(userId, {
        name: formData.name,
        filename,
        description: formData.description,
        categoryId: formData.categoryId,
        packId: formData.packId,
        bpm: formData.bpm,
        keySignature: formData.keySignature,
        tags: formData.tags,
        isPremium: formData.isPremium || false,
        isFeatured: formData.isFeatured || false,
        isActive: formData.isActive !== undefined ? formData.isActive : true, // ✅ FIX: Add isActive support
        storageKey: storageResult.storageKey,
        storageUrl: storageResult.storageUrl,
        fileSize,
        mimeType: (fileData as any).mimetype || 'audio/wav',
      });

      logger.info(`✅ Asset created successfully: ${asset.id}`);
      logger.info(`📋 Created asset: ${JSON.stringify({ id: asset.id, name: asset.name, isActive: asset.isActive })}`);
      return reply.send(asset);
    }
  );

  // Update system asset (admin)
  fastify.put(
    '/admin/system/assets/:assetId',
    { preHandler: [fastify.authenticate] },
    async (
      request: FastifyRequest<{
        Params: { assetId: string };
        Body: {
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
        };
      }>,
      reply: FastifyReply
    ) => {
      const { assetId } = request.params;
      const updates = request.body;

      const asset = await systemAssetsService.updateAsset(assetId, updates);
      return reply.send(asset);
    }
  );

  // Delete system asset (admin)
  fastify.delete(
    '/admin/system/assets/:assetId',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { assetId: string } }>, reply: FastifyReply) => {
      const { assetId } = request.params;

      await systemAssetsService.deleteAsset(assetId);
      return reply.send({ success: true });
    }
  );

  // Create pack (admin)
  fastify.post(
    '/admin/system/packs',
    { preHandler: [fastify.authenticate] },
    async (
      request: FastifyRequest<{
        Body: {
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
        };
      }>,
      reply: FastifyReply
    ) => {
      const userId = (request as any).user.userId;
      const packData = request.body;

      try {
        const pack = await systemAssetsService.createPack(userId, packData);
        return reply.send({
          ...pack,
          message: 'Pack created successfully', // ✅ FIX: Add success message for toast
        });
      } catch (error: any) {
        // ✅ FIX: Re-throw ConflictError and BadRequestError as-is
        if (error instanceof ConflictError || error instanceof BadRequestError) {
          throw error;
        }
        // ✅ FIX: Handle duplicate slug error from service
        if (error.message?.includes('already exists')) {
          throw new ConflictError(error.message);
        }
        throw error;
      }
    }
  );

  // Update pack (admin)
  fastify.put(
    '/admin/system/packs/:packId',
    { preHandler: [fastify.authenticate] },
    async (
      request: FastifyRequest<{
        Params: { packId: string };
        Body: {
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
        };
      }>,
      reply: FastifyReply
    ) => {
      const { packId } = request.params;
      const updates = request.body;

      const pack = await systemAssetsService.updatePack(packId, updates);
      return reply.send(pack);
    }
  );

  // Delete pack (admin)
  fastify.delete(
    '/admin/system/packs/:packId',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { packId: string } }>, reply: FastifyReply) => {
      const { packId } = request.params;

      await systemAssetsService.deletePack(packId);
      return reply.send({ success: true });
    }
  );
}