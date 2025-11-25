/**
 * System Assets Routes
 * Public and admin endpoints for system assets (DAWG Library)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Readable } from 'stream';
import crypto from 'crypto';
import path from 'path';
import { systemAssetsService } from '../services/systemAssets.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/errors.js';
import { storageService } from '../services/storage.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

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

const systemAssetUploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().int().positive().max(1073741824), // 1GB max
  mimeType: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  packId: z.string().uuid().optional(),
});

const systemAssetUploadCompleteSchema = z.object({
  assetId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  packId: z.string().uuid().optional(),
  bpm: z.number().int().positive().optional(),
  keySignature: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPremium: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

function buildSystemAssetStorageKey(assetId: string, filename: string, categorySlug: string, packSlug: string): string {
  const fileExtension = path.extname(filename) || '.wav';
  const storageFilename = `${assetId}${fileExtension}`;
  return `system-assets/${categorySlug}/${packSlug}/${assetId}/${storageFilename}`;
}

async function resolveCategoryAndPackSlugs(categoryId?: string, packId?: string) {
  let categorySlug = 'uncategorized';
  let packSlug = 'default';

  if (categoryId) {
    const category = await systemAssetsService.getCategoryById(categoryId);
    if (!category) {
      throw new BadRequestError('Category not found');
    }
    categorySlug = category.slug || 'uncategorized';
  }

  if (packId) {
    const pack = await systemAssetsService.getPackById(packId);
    if (!pack) {
      throw new BadRequestError('Pack not found');
    }
    packSlug = pack.slug || 'default';
  }

  return { categorySlug, packSlug };
}

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
          
          // ✅ FIX: Remove charset parameter from audio MIME types (audio files don't have charset)
          if (contentType.includes(';')) {
            contentType = contentType.split(';')[0].trim();
          }
          
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
          
          // ✅ FIX: Ensure contentType doesn't have charset (double-check)
          if (contentType.includes(';')) {
            contentType = contentType.split(';')[0].trim();
          }
          const contentLength = cdnResponse.headers.get('content-length');
          const contentRange = cdnResponse.headers.get('content-range');
          const acceptRanges = cdnResponse.headers.get('accept-ranges');
          
          // ✅ FIX: Always use buffer approach (stream conversion causes encoding issues)
          // Readable.fromWeb() can cause byte corruption in binary data
          // Use arrayBuffer() which is more reliable for binary data
          logger.info(`📦 [PROXY] Using buffer approach, Status: ${cdnResponse.status}, Range: ${rangeHeader || 'none'}`);
          const arrayBuffer = await cdnResponse.arrayBuffer();
          
          if (arrayBuffer.byteLength === 0) {
            logger.error(`❌ [PROXY] CDN returned empty response`);
            throw new NotFoundError('File is empty on CDN');
          }
          
          // ✅ FIX: Convert ArrayBuffer to Buffer using direct memory copy
          // Create Uint8Array view first, then convert to Buffer
          const uint8Array = new Uint8Array(arrayBuffer);
          const buffer = Buffer.from(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
          
          // ✅ FIX: Basic validation - check if it starts with audio file signatures
          const bufferView = new Uint8Array(buffer);
          const isAudioFile = bufferView.length > 4 && (
            // WAV: "RIFF"
            (bufferView[0] === 0x52 && bufferView[1] === 0x49 && bufferView[2] === 0x46 && bufferView[3] === 0x46) ||
            // MP3: ID3 tag or MPEG header
            (bufferView[0] === 0x49 && bufferView[1] === 0x44 && bufferView[2] === 0x33) ||
            (bufferView[0] === 0xFF && (bufferView[1] & 0xE0) === 0xE0) ||
            // OGG: "OggS"
            (bufferView[0] === 0x4F && bufferView[1] === 0x67 && bufferView[2] === 0x67 && bufferView[3] === 0x53)
          );
          
          if (!isAudioFile && bufferView.length > 100) {
            // Check if it's HTML (error page)
            const textDecoder = new TextDecoder();
            const textStart = textDecoder.decode(bufferView.slice(0, 100));
            if (textStart.includes('<html') || textStart.includes('<!DOCTYPE')) {
              logger.error(`❌ [PROXY] CDN returned HTML instead of audio file`);
              logger.error(`❌ [PROXY] Response preview: ${textStart.substring(0, 200)}`);
              throw new NotFoundError('CDN returned error page instead of audio file');
            }
          }
          
          // ✅ FIX: Validate WAV structure more thoroughly
          if (isAudioFile && bufferView.length >= 12) {
            const waveBytes = [bufferView[8], bufferView[9], bufferView[10], bufferView[11]];
            const waveCheck = String.fromCharCode(...waveBytes);
            if (waveCheck !== 'WAVE') {
              logger.warn(`⚠️ [PROXY] WAV file structure issue: RIFF header found but WAVE chunk is '${waveCheck}' instead of 'WAVE'`);
              logger.warn(`⚠️ [PROXY] Bytes 8-11: ${waveBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
              logger.warn(`⚠️ [PROXY] Byte values: ${waveBytes.join(', ')}`);
            }
          }
          
          logger.info(`✅ [PROXY] CDN proxy successful: ${buffer.byteLength} bytes, Content-Type: ${contentType}, Status: ${cdnResponse.status}, Range: ${rangeHeader || 'none'}`);
          
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
          
          // ✅ FIX: Send buffer directly (Fastify handles Buffer correctly)
          return reply.send(buffer);
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

  // Request direct upload for system asset (admin)
  fastify.post(
    '/admin/system/assets/upload/request',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Body: z.infer<typeof systemAssetUploadRequestSchema> }>, reply: FastifyReply) => {
      const body = systemAssetUploadRequestSchema.parse(request.body);

      if (config.cdn.provider !== 'bunny' || !config.cdn.bunny.storageZoneName || !config.cdn.bunny.storageApiKey) {
        throw new NotFoundError('Direct upload not available');
      }

      const assetId = crypto.randomUUID();
      const { categorySlug, packSlug } = await resolveCategoryAndPackSlugs(body.categoryId, body.packId);
      const storageKey = buildSystemAssetStorageKey(assetId, body.filename, categorySlug, packSlug);
      const uploadUrl = `https://storage.bunnycdn.com/${config.cdn.bunny.storageZoneName}/${storageKey}`;
      const storageUrl = storageService.getCDNUrl(storageKey, assetId);

      return reply.send({
        assetId,
        storageKey,
        uploadUrl,
        storageUrl,
        accessKey: config.cdn.bunny.storageApiKey,
        categorySlug,
        packSlug,
      });
    }
  );

  // Complete direct upload (admin)
  fastify.post(
    '/admin/system/assets/upload/complete',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Body: z.infer<typeof systemAssetUploadCompleteSchema> }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const body = systemAssetUploadCompleteSchema.parse(request.body);

      const { categorySlug, packSlug } = await resolveCategoryAndPackSlugs(body.categoryId, body.packId);
      const storageKey = buildSystemAssetStorageKey(body.assetId, body.filename, categorySlug, packSlug);
      const storageUrl = storageService.getCDNUrl(storageKey, body.assetId);

      const asset = await systemAssetsService.createAsset(userId, {
        id: body.assetId,
        name: body.name,
        filename: body.filename,
        description: body.description,
        categoryId: body.categoryId,
        packId: body.packId,
        bpm: body.bpm,
        keySignature: body.keySignature,
        tags: body.tags,
        isPremium: body.isPremium || false,
        isFeatured: body.isFeatured || false,
        isActive: body.isActive !== undefined ? body.isActive : true,
        storageKey,
        storageUrl,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
      });

      return reply.send(asset);
    }
  );

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
      let uploadBuffer: Buffer | null = null;
      let uploadFilename: string | undefined;
      let uploadMimeType: string | undefined;
      const contentType = request.headers['content-type'] || '';
      const body = request.body as any;

      const processField = (fieldName: string, fieldValue?: string) => {
        if (fieldValue === undefined || fieldValue === null) {
          return;
        }
        if (fieldName === 'tags') {
          try {
            formData[fieldName] = JSON.parse(fieldValue);
          } catch {
            formData[fieldName] = fieldValue
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean);
          }
        } else if (fieldName === 'bpm') {
          formData[fieldName] = fieldValue ? parseInt(fieldValue) : undefined;
        } else if (fieldName === 'isPremium' || fieldName === 'isFeatured' || fieldName === 'isActive') {
          formData[fieldName] = fieldValue === 'true' || fieldValue === true;
        } else {
          formData[fieldName] = fieldValue || undefined;
        }
      };

      const hasPreParsedMultipart =
        body &&
        typeof body === 'object' &&
        'fields' in body &&
        'files' in body &&
        contentType.includes('application/json');
      
      try {
        logger.info('📋 Parsing multipart data (fields first, then file)...');

        if (hasPreParsedMultipart) {
          logger.info('✅ Detected pre-parsed multipart payload (Vercel)');
          const parsedData = body as {
            fields: Record<string, string | string[]>;
            files: Record<string, { bufferBase64?: string; buffer?: Buffer | { data: number[] }; filename?: string; mimetype?: string; filepath?: string }>;
          };

          Object.entries(parsedData.fields || {}).forEach(([fieldName, value]) => {
            const normalizedValue = Array.isArray(value) ? value[0] : value;
            logger.info(`📝 Field: ${fieldName} = ${normalizedValue?.toString().substring(0, 50) || 'empty'}...`);
            processField(fieldName, normalizedValue as string);
          });

          const fileKeys = Object.keys(parsedData.files || {});
          if (fileKeys.length === 0) {
            logger.error('❌ No file provided in pre-parsed multipart payload');
            throw new BadRequestError('No file provided');
          }
          const fileInfo = parsedData.files[fileKeys[0]];
          logger.info(`📁 File (pre-parsed): ${fileInfo.filename || 'unknown'}, mimetype: ${fileInfo.mimetype || 'unknown'}`);

          if (fileInfo.bufferBase64) {
            uploadBuffer = Buffer.from(fileInfo.bufferBase64, 'base64');
          } else if (fileInfo.buffer) {
            uploadBuffer = Buffer.isBuffer(fileInfo.buffer)
              ? (fileInfo.buffer as Buffer)
              : Buffer.from((fileInfo.buffer as any).data || fileInfo.buffer);
          } else if (fileInfo.filepath) {
            const fs = await import('fs/promises');
            uploadBuffer = await fs.readFile(fileInfo.filepath);
          }

          if (!uploadBuffer) {
            throw new BadRequestError('Failed to read uploaded file');
          }

          uploadFilename = fileInfo.filename;
          uploadMimeType = fileInfo.mimetype;
        } else {
          // Read all parts - fields come first, then file
          for await (const part of request.parts()) {
            if (part.type === 'field') {
              const field = part as any;
              const fieldValue = field.value;
              logger.info(`📝 Field: ${field.fieldname} = ${fieldValue?.substring(0, 50) || 'empty'}...`);
              processField(field.fieldname, fieldValue);
            } else if (part.type === 'file') {
              fileData = part;
              logger.info(`📁 File part found: ${(part as any).filename || 'unknown'}`);
              logger.info(`🔄 Consuming file stream to unblock loop...`);
              const buffer = await fileData.toBuffer();
              logger.info(`✅ Buffer created: ${buffer.length} bytes`);
              (fileData as any).buffer = buffer;
              uploadBuffer = buffer;
              uploadFilename = (fileData as any).filename;
              uploadMimeType = (fileData as any).mimetype;
            }
          }
        }
        
        logger.info(`✅ Loop completed`);
        
        const fileFound = hasPreParsedMultipart ? !!uploadBuffer : !!fileData;
        if (!fileFound || !uploadBuffer) {
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

      if (!uploadBuffer) {
        logger.error('❌ No file data buffer available');
        throw new BadRequestError('No file provided');
      }

      if (!formData.name) {
        logger.error('❌ No name provided');
        throw new BadRequestError('Name is required');
      }

      // Use the buffer we already created in the try block
      const buffer = uploadBuffer;
      const assetId = crypto.randomUUID();
      const filename = formData.filename || uploadFilename || 'asset.wav';
      
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
        mimeType: uploadMimeType || 'audio/wav',
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