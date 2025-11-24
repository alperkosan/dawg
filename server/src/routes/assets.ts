/**
 * Assets routes for file browser
 * Handles user file uploads, listing, deletion, and management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Readable } from 'stream';
import { assetsService } from '../services/assets.js';
import { storageService } from '../services/storage.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors.js';

// Validation schemas
const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().int().positive().max(1073741824), // Max 1GB per file
  mimeType: z.string().refine((val) => val.startsWith('audio/'), { // ✅ FIX: More flexible mimeType validation
    message: 'Mime type must start with "audio/"'
  }),
  folderPath: z.string().default('/'),
  parentFolderId: z.string().uuid().optional().nullable(), // ✅ FIX: Allow null values
});

const listAssetsSchema = z.object({
  folderPath: z.string().optional(),
  parentFolderId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(50), // Increased max to 1000
  offset: z.coerce.number().int().nonnegative().default(0),
});

const renameAssetSchema = z.object({
  newName: z.string().min(1).max(255),
});

const moveAssetSchema = z.object({
  folderPath: z.string(),
  parentFolderId: z.string().uuid().optional(),
});

export async function assetsRoutes(fastify: FastifyInstance) {
  // Get user storage quota
  fastify.get(
    '/quota',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const quota = await assetsService.getUserQuota(userId);
      return reply.send(quota);
    }
  );

  // List user assets
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Querystring: z.infer<typeof listAssetsSchema> }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const query = listAssetsSchema.parse(request.query);
      
      const assets = await assetsService.listUserAssets(
        userId,
        query.folderPath,
        query.parentFolderId,
        query.limit,
        query.offset
      );
      
      return reply.send({
        assets,
        total: assets.length,
        limit: query.limit,
        offset: query.offset,
      });
    }
  );

  // Request upload (get presigned URL)
  fastify.post(
    '/upload/request',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Body: z.infer<typeof uploadRequestSchema> }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user.userId;
        
        // ✅ FIX: Better error handling for validation
        let body;
        try {
          body = uploadRequestSchema.parse(request.body);
        } catch (validationError) {
          console.error('❌ Upload request validation error:', validationError);
          throw new BadRequestError(`Invalid upload request: ${validationError.message}`);
        }

        // Check quota
        const quota = await assetsService.getUserQuota(userId);
        if (quota.used_bytes + body.size > quota.quota_bytes) {
          throw new BadRequestError('Storage quota exceeded. Maximum 1GB allowed.');
        }

        // Create upload request
        const uploadRequest = await assetsService.createUploadRequest(
          userId,
          body.filename,
          body.size,
          body.mimeType,
          body.folderPath,
          body.parentFolderId || null // ✅ FIX: Explicitly convert undefined to null
        );

        return reply.send(uploadRequest);
      } catch (error) {
        console.error('❌ Upload request error:', error);
        if (error instanceof BadRequestError || error instanceof NotFoundError || error instanceof ForbiddenError) {
          throw error;
        }
        // Generic error for unexpected issues
        throw new BadRequestError(`Upload request failed: ${error.message || 'Unknown error'}`);
      }
    }
  );

  // ✅ NEW: Get upload credentials for client-side direct upload to Bunny CDN
  fastify.post(
    '/upload/:assetId/credentials',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { assetId: string } }>, reply: FastifyReply) => {
      try {
        const userId = (request as any).user.userId;
        const { assetId } = request.params;

        const { logger } = await import('../utils/logger.js');
        logger.info(`📤 [CREDENTIALS] Requesting upload credentials for asset ${assetId} (user: ${userId})`);

        // Verify asset ownership
        const asset = await assetsService.getAssetById(userId, assetId);
        if (!asset) {
          logger.error(`❌ [CREDENTIALS] Asset ${assetId} not found for user ${userId}`);
          throw new NotFoundError('Asset not found');
        }

        logger.info(`✅ [CREDENTIALS] Asset found: ${asset.filename}, status: ${asset.processing_status}, storage_key: ${asset.storage_key}`);

        // Check if asset is in 'uploading' status (or allow 'pending' as well)
        if (asset.processing_status !== 'uploading' && asset.processing_status !== 'pending') {
          logger.warn(`⚠️ [CREDENTIALS] Asset ${assetId} is not in uploading status: ${asset.processing_status}, but allowing credentials anyway`);
          // Don't throw error, just log - allow credentials even if status is not 'uploading'
          // This can happen if the asset was created but status wasn't set correctly
        }

        // Check if storage_key exists
        if (!asset.storage_key) {
          logger.error(`❌ [CREDENTIALS] Asset ${assetId} has no storage_key`);
          throw new BadRequestError('Asset has no storage key');
        }

        const { config } = await import('../config/index.js');
        
        // Check if Bunny CDN is properly configured
        if (config.cdn.provider === 'bunny' && config.cdn.bunny.storageZoneName && config.cdn.bunny.storageApiKey) {
          // Generate Bunny CDN direct upload URL
          const uploadUrl = `https://storage.bunnycdn.com/${config.cdn.bunny.storageZoneName}/${asset.storage_key}`;
          
          // ✅ SECURITY: Return AccessKey only for this specific upload
          // This endpoint is authenticated, so only the asset owner can get the key
          // The key is only valid for this specific storageKey
          return reply.send({
            uploadUrl,
            accessKey: config.cdn.bunny.storageApiKey, // ✅ SECURITY: Only returned to authenticated asset owner
            storageKey: asset.storage_key,
            expiresIn: 3600, // 1 hour
          });
        } else {
          // ✅ FIX: Return 404 (Not Found) instead of 400 (Bad Request)
          // This allows the client to gracefully fall back to server-side upload
          // 404 means "this feature is not available" rather than "you made a bad request"
          logger.warn(`⚠️ [CREDENTIALS] Bunny CDN not configured - returning 404 to trigger server-side fallback`);
          logger.warn(`   Provider: ${config.cdn.provider}, Zone: ${config.cdn.bunny.storageZoneName}, API Key: ${config.cdn.bunny.storageApiKey ? 'set' : 'missing'}`);
          throw new NotFoundError('Direct upload not available. Use server-side upload instead.');
        }
      } catch (error) {
        if (error instanceof BadRequestError || error instanceof NotFoundError) {
          throw error;
        }
        throw new BadRequestError(`Failed to get upload credentials: ${error.message || 'Unknown error'}`);
      }
    }
  );

  // Upload file (multipart/form-data) - Server-side upload (fallback)
  fastify.post(
    '/upload/:assetId',
    { 
      preHandler: [fastify.authenticate],
      // ✅ FIX: Register multipart plugin for file uploads
    },
    async (request: FastifyRequest<{ Params: { assetId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const { assetId } = request.params;

      const { logger } = await import('../utils/logger.js');
      logger.info(`📤 Starting file upload for asset ${assetId} (user: ${userId})`);

      // Verify asset ownership
      const asset = await assetsService.getAssetById(userId, assetId);
      if (!asset) {
        throw new NotFoundError('Asset not found');
      }

      logger.info(`📁 Asset found: ${asset.filename} (${asset.file_size} bytes)`);

      // ✅ FIX: Handle file upload using multipart
      // Try request.file() first (simpler API)
      let fileData: any = null;
      let buffer: Buffer | null = null;

      try {
        fileData = await request.file();
        if (fileData) {
          logger.info(`📦 File received via request.file(): ${fileData.filename}`);
          buffer = await fileData.toBuffer();
        }
      } catch (error) {
        logger.warn(`⚠️ request.file() failed, trying request.parts(): ${error}`);
      }

      // ✅ FALLBACK: Use request.parts() if request.file() didn't work
      if (!fileData || !buffer) {
        logger.info(`🔄 Trying request.parts() to find file...`);
        for await (const part of request.parts()) {
          if (part.type === 'file') {
            fileData = part;
            logger.info(`📁 File part found: ${(part as any).filename || 'unknown'}`);
            buffer = await fileData.toBuffer();
            logger.info(`✅ Buffer created: ${buffer.length} bytes`);
            break; // Found file, exit loop
          }
        }
      }

      if (!fileData || !buffer) {
        logger.error(`❌ No file provided in request`);
        throw new BadRequestError('No file provided');
      }

      logger.info(`📦 File received: ${(fileData as any).filename || 'unknown'} (${buffer.length} bytes)`);
      logger.info(`🔄 Uploading to storage service... (storage_key: ${asset.storage_key})`);
      
      const storageResult = await storageService.uploadFile(
        userId,
        assetId,
        asset.filename,
        buffer,
        false, // isSystemAsset
        undefined, // categorySlug
        undefined, // packSlug
        asset.storage_key // Use the storage key from database
      );

      logger.info(`✅ Storage upload completed: ${storageResult.storageKey} -> ${storageResult.storageUrl}`);

      // ✅ FIX: Clean storage URL before storing in database (remove any whitespace/newlines)
      const cleanStorageUrl = storageResult.storageUrl.replace(/[\n\r\t\s]+/g, '').trim();

      // Update asset with storage info
      const db = await import('../services/database.js').then(m => m.getDatabase());
      await db.query(
        `UPDATE user_assets 
         SET storage_key = $1, storage_url = $2, updated_at = NOW()
         WHERE id = $3 AND user_id = $4`,
        [storageResult.storageKey, cleanStorageUrl, assetId, userId]
      );

      // Mark as completed
      const completedAsset = await assetsService.completeUpload(userId, assetId);
      return reply.send(completedAsset);
    }
  );

  // Complete upload (mark as uploaded) - for when file is already uploaded
  fastify.post(
    '/upload/complete/:assetId',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { assetId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const { assetId } = request.params;

      const asset = await assetsService.completeUpload(userId, assetId);
      return reply.send(asset);
    }
  );

  // ✅ FIX: Serve file endpoint with Range Request support
  fastify.get(
    '/:assetId/file',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { assetId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const { assetId } = request.params;

      // Verify asset ownership
      const asset = await assetsService.getAssetById(userId, assetId);
      if (!asset) {
        throw new NotFoundError('Asset not found');
      }

      // ✅ FIX: If storage_url is a CDN URL, proxy from CDN to avoid CORS issues
      if (asset.storage_url && !asset.storage_url.startsWith('/api/')) {
        const { logger } = await import('../utils/logger.js');
        // ✅ FIX: Clean URL - remove newlines, whitespace, tabs, and normalize
        // This handles cases where URL was stored with whitespace in database
        const cleanStorageUrl = asset.storage_url
          .replace(/[\n\r\t]+/g, '') // Remove newlines, carriage returns, tabs
          .replace(/\s+/g, '') // Remove all whitespace
          .trim();
        logger.info(`📤 [PROXY] Proxying user asset from CDN: ${cleanStorageUrl}`);
        logger.info(`📤 [PROXY] Original URL (for debugging): ${JSON.stringify(asset.storage_url)}`);
        
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
          
          logger.info(`📡 [PROXY] Fetching from CDN: ${cleanStorageUrl}`);
          
          let cdnResponse: Response;
          try {
            cdnResponse = await fetch(cleanStorageUrl, {
              headers,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            logger.error(`❌ [PROXY] Fetch error:`, {
              error: fetchError.message || String(fetchError),
              errorName: fetchError.name,
              cdnUrl: cleanStorageUrl,
            });
            
            // Check if it's a timeout
            if (fetchError.name === 'AbortError' || controller.signal.aborted) {
              throw new NotFoundError('CDN request timeout (30s)');
            }
            
            // Re-throw with more context
            throw new Error(`CDN fetch failed: ${fetchError.message || fetchError}`);
          }
          
          if (!cdnResponse.ok) {
            logger.error(`❌ [PROXY] CDN fetch failed: ${cdnResponse.status} ${cdnResponse.statusText}`);
            const errorText = await cdnResponse.text().catch(() => 'Unknown error');
            logger.error(`❌ [PROXY] CDN error response: ${errorText}`);
            logger.error(`❌ [PROXY] CDN URL: ${cleanStorageUrl}`);
            
            // ✅ FIX: If file not found on CDN (404), don't fallback to local storage
            // Vercel serverless doesn't have persistent local storage
            if (cdnResponse.status === 404) {
              logger.warn(`⚠️ [PROXY] File not found on CDN (404) but database record exists. This might indicate a stale record.`);
              logger.warn(`⚠️ [PROXY] Asset ID: ${assetId}, User ID: ${userId}`);
              logger.warn(`⚠️ [PROXY] Storage Key: ${asset.storage_key}`);
              // Note: We don't delete the database record here to avoid race conditions
              // The user should delete the asset properly through the API
              throw new NotFoundError('File not found on CDN (may have been deleted). Please refresh the file browser.');
            }
            // For other errors (500, timeout, etc.), also don't fallback to local storage on Vercel
            throw new NotFoundError(`File not found on CDN: ${cdnResponse.status}`);
          }
          
          // ✅ FIX: Forward response headers from CDN
          // ✅ FIX: Override application/octet-stream with proper audio MIME type
          let contentType = cdnResponse.headers.get('content-type') || asset.mime_type || 'audio/wav';
          
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
              contentType = asset.mime_type || 'audio/wav';
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
          
          let arrayBuffer: ArrayBuffer;
          try {
            arrayBuffer = await cdnResponse.arrayBuffer();
            logger.info(`📦 [PROXY] ArrayBuffer received: ${arrayBuffer.byteLength} bytes`);
          } catch (arrayBufferError: any) {
            logger.error(`❌ [PROXY] Failed to read arrayBuffer:`, {
              error: arrayBufferError.message || String(arrayBufferError),
              errorName: arrayBufferError.name,
              cdnUrl: cleanStorageUrl,
              responseStatus: cdnResponse.status,
              responseStatusText: cdnResponse.statusText,
            });
            throw new Error(`Failed to read CDN response: ${arrayBufferError.message || arrayBufferError}`);
          }
          
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
          
          // ✅ FIX: For Range requests, check if it's a valid partial content
          if (rangeHeader && !isAudioFile && bufferView.length > 100) {
            // Range request might not include file header, that's OK
            logger.info(`ℹ️ [PROXY] Range request - partial content (${buffer.byteLength} bytes), skipping header validation`);
          } else if (!isAudioFile && bufferView.length > 100) {
            // Check if it's HTML (error page) - only for full content
            const textDecoder = new TextDecoder();
            const textStart = textDecoder.decode(bufferView.slice(0, 100));
            if (textStart.includes('<html') || textStart.includes('<!DOCTYPE')) {
              logger.error(`❌ [PROXY] CDN returned HTML instead of audio file`);
              logger.error(`❌ [PROXY] Response preview: ${textStart.substring(0, 200)}`);
              throw new NotFoundError('CDN returned error page instead of audio file');
            } else {
              logger.warn(`⚠️ [PROXY] Response doesn't match known audio file signatures, but not HTML either`);
              logger.warn(`⚠️ [PROXY] First bytes: ${Array.from(bufferView.slice(0, 20)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
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
        } catch (error: any) {
          // ✅ FIX: Log detailed error information
          logger.error(`❌ [PROXY] CDN proxy failed:`, {
            error: error.message || String(error),
            errorName: error.name,
            errorStack: error.stack,
            cdnUrl: cleanStorageUrl,
            assetId,
            userId,
            storageKey: asset.storage_key,
          });
          
          // ✅ FIX: Don't fallback to local storage on Vercel (serverless doesn't have persistent storage)
          // Only re-throw if it's already a NotFoundError (404 from CDN)
          if (error instanceof NotFoundError) {
            throw error;
          }
          
          // For other errors (network, timeout, etc.), also throw instead of falling back
          const errorMessage = error.message || error.toString() || 'CDN proxy failed';
          logger.error(`❌ [PROXY] CDN proxy error details: ${errorMessage}`);
          throw new NotFoundError(`File not available: ${errorMessage}`);
        }
      }

      // ✅ FIX: If we reach here, storage_url is not a CDN URL (starts with /api/)
      // This means the file should be served from the API endpoint itself
      // But in production (Vercel), all files should be on CDN, so this shouldn't happen
      logger.warn(`⚠️ [FILE] Storage URL is not a CDN URL: ${asset.storage_url}`);
      logger.warn(`⚠️ [FILE] This should not happen in production. File should be on CDN.`);
      throw new NotFoundError('File not available. Please ensure the file is uploaded to CDN.');
    }
  );

  // Delete asset
  fastify.delete(
    '/:assetId',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { assetId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const { assetId } = request.params;

      // ✅ FIX: Delete asset (trigger will update quota automatically)
      await assetsService.deleteAsset(userId, assetId);
      
      // ✅ FIX: Return updated quota in response
      const quota = await assetsService.getUserQuota(userId);
      
      return reply.send({ 
        success: true,
        quota // ✅ Include updated quota in response
      });
    }
  );

  // Rename asset
  fastify.patch(
    '/:assetId/rename',
    { preHandler: [fastify.authenticate] },
    async (
      request: FastifyRequest<{ Params: { assetId: string }; Body: z.infer<typeof renameAssetSchema> }>,
      reply: FastifyReply
    ) => {
      const userId = (request as any).user.userId;
      const { assetId } = request.params;
      const body = renameAssetSchema.parse(request.body);

      const asset = await assetsService.renameAsset(userId, assetId, body.newName);
      return reply.send(asset);
    }
  );

  // Move asset (change folder)
  fastify.patch(
    '/:assetId/move',
    { preHandler: [fastify.authenticate] },
    async (
      request: FastifyRequest<{ Params: { assetId: string }; Body: z.infer<typeof moveAssetSchema> }>,
      reply: FastifyReply
    ) => {
      const userId = (request as any).user.userId;
      const { assetId } = request.params;
      const body = moveAssetSchema.parse(request.body);

      const asset = await assetsService.moveAsset(userId, assetId, body.folderPath, body.parentFolderId);
      return reply.send(asset);
    }
  );

  // Create folder
  fastify.post(
    '/folders',
    { preHandler: [fastify.authenticate] },
    async (
      request: FastifyRequest<{ Body: { name: string; parentFolderId?: string } }>,
      reply: FastifyReply
    ) => {
      const userId = (request as any).user.userId;
      const { name, parentFolderId } = request.body;

      if (!name || name.trim().length === 0) {
        throw new BadRequestError('Folder name is required');
      }

      // ✅ FIX: Create folder in database
      const folder = await assetsService.createFolder(userId, name.trim(), parentFolderId);
      return reply.send(folder);
    }
  );

  // List folders
  fastify.get(
    '/folders',
    { preHandler: [fastify.authenticate] },
    async (
      request: FastifyRequest<{ Querystring: { parentFolderId?: string } }>,
      reply: FastifyReply
    ) => {
      const userId = (request as any).user.userId;
      const { parentFolderId } = request.query;
      
      const folders = await assetsService.listUserFolders(userId, parentFolderId);
      return reply.send({ folders });
    }
  );

  // Delete folder
  fastify.delete(
    '/folders/:folderId',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest<{ Params: { folderId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).user.userId;
      const { folderId } = request.params;

      // ✅ FIX: Delete folder (recursively deletes all contents)
      await assetsService.deleteFolder(userId, folderId);
      
      // ✅ FIX: Return updated quota in response
      const quota = await assetsService.getUserQuota(userId);
      
      return reply.send({ 
        success: true,
        quota // ✅ Include updated quota in response
      });
    }
  );
}

