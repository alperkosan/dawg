/**
 * Storage Service
 * Handles file storage and CDN URL generation
 * Supports local storage (development), Bunny CDN, and S3/MinIO (production)
 */

import { config } from '../config/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

export interface StorageResult {
  storageKey: string;
  storageUrl: string; // CDN URL or direct storage URL
  localPath?: string; // Local file path (for development)
}

export const storageService = {
  /**
   * Upload file to storage (Bunny CDN or local)
   * ✅ Organized folder structure for easy maintenance
   */
  async uploadFile(
    userId: string,
    assetId: string,
    filename: string,
    buffer: Buffer,
    isSystemAsset: boolean = false,
    categorySlug?: string, // For system assets: category slug (e.g., 'drums', 'instruments')
    packSlug?: string, // For system assets: pack slug (e.g., 'dawg-starter-pack')
    providedStorageKey?: string // Optional: use provided storage key (from createUploadRequest)
  ): Promise<StorageResult> {
    // ✅ Organized folder structure for easy maintenance
    // Use provided storage key if available, otherwise generate one
    let storageKey: string;
    
    if (providedStorageKey) {
      storageKey = providedStorageKey;
    } else if (isSystemAsset) {
      // System assets: system-assets/{category}/{pack}/{assetId}/{filename}
      // Example: system-assets/drums/dawg-starter-pack/{assetId}/kick.wav
      const category = categorySlug || 'uncategorized';
      const pack = packSlug || 'default';
      storageKey = `system-assets/${category}/${pack}/${assetId}/${filename}`;
    } else {
      // User assets: user-assets/{userId}/{year-month}/{assetId}/{filename}
      // Example: user-assets/{userId}/2025-01/{assetId}/sample.wav
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      storageKey = `user-assets/${userId}/${yearMonth}/${assetId}/${filename}`;
    }
    
    // ✅ Bunny CDN Upload - Lokalden CDN bağlantısı kurulabilir
    if (config.cdn.provider === 'bunny' && config.cdn.bunny.storageZoneName && config.cdn.bunny.storageApiKey) {
      try {
        const bunnyUrl = `https://storage.bunnycdn.com/${config.cdn.bunny.storageZoneName}/${storageKey}`;
        
        logger.info(`📤 Uploading to Bunny CDN: ${bunnyUrl}`);
        logger.info(`📦 Storage Zone: ${config.cdn.bunny.storageZoneName}`);
        logger.info(`🔑 API Key: ${config.cdn.bunny.storageApiKey ? 'SET (length: ' + config.cdn.bunny.storageApiKey.length + ')' : 'NOT SET'}`);
        logger.info(`📊 Buffer size: ${buffer.length} bytes`);
        
        // Bunny CDN Storage API uses AccessKey header for authentication
        // ✅ Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        try {
          const response = await fetch(bunnyUrl, {
            method: 'PUT',
            headers: {
              'AccessKey': config.cdn.bunny.storageApiKey,
              'Content-Type': 'application/octet-stream',
            },
            body: buffer,
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            logger.error(`❌ Bunny CDN upload failed: ${response.status} ${errorText}`);
            throw new Error(`Bunny CDN upload failed: ${response.status} - ${errorText}`);
          }

          // Generate CDN URL using pull zone
          // ✅ FIX: Remove trailing slashes, /n/ prefix, and any whitespace/newlines
          let pullZoneUrl = config.cdn.bunny.pullZoneUrl
            ?.replace(/[\n\r\t\s]+/g, '') // Remove all whitespace, newlines, tabs
            .replace(/\/+$/, '') // Remove trailing slashes
            .trim() || '';
          // Remove /n/ prefix if present (Bunny CDN pull zone URL should not include this)
          pullZoneUrl = pullZoneUrl.replace(/\/n\/?$/, '');
          const cleanStorageKey = storageKey.replace(/^\/+/, ''); // Remove leading slashes from storageKey
          const storageUrl = pullZoneUrl 
            ? `${pullZoneUrl}/${cleanStorageKey}`.replace(/[\n\r\t\s]+/g, '').trim() // Final cleanup
            : `/api/assets/${assetId}/file`; // Fallback to API endpoint

          logger.info(`✅ File uploaded to Bunny CDN: ${storageKey}`);
          logger.info(`🌐 CDN URL: ${storageUrl}`);
          
          return {
            storageKey,
            storageUrl,
          };
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            logger.error('❌ Bunny CDN upload timeout (60s)');
            throw new Error('CDN upload timeout - file too large or network issue');
          }
          throw fetchError;
        }
      } catch (error) {
        logger.error('❌ Bunny CDN upload error:', error);
        logger.error('❌ Error details:', error instanceof Error ? error.message : String(error));
        logger.warn('⚠️ Falling back to local storage...');
        // Continue to local storage fallback
        // Note: In production, you might want to throw the error instead of falling back silently
      }
    } else {
      logger.warn('⚠️ Bunny CDN not configured, using local storage');
      logger.warn(`   Provider: ${config.cdn.provider}`);
      logger.warn(`   Storage Zone: ${config.cdn.bunny.storageZoneName || 'NOT SET'}`);
      logger.warn(`   API Key: ${config.cdn.bunny.storageApiKey ? 'SET' : 'NOT SET'}`);
    }
    
    // ✅ Local storage (development fallback)
    const uploadsDir = path.join(process.cwd(), 'uploads', isSystemAsset ? 'system' : userId);
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const fileExtension = path.extname(filename) || '.wav';
    const localPath = path.join(uploadsDir, `${assetId}${fileExtension}`);
    await fs.writeFile(localPath, buffer);
    
    // Use API endpoint for local storage
    const storageUrl = `/api/assets/${assetId}/file`;
    
    return {
      storageKey,
      storageUrl,
      localPath,
    };
  },

  /**
   * Get file from storage
   */
  async getFile(storageKey: string, localPath?: string): Promise<Buffer> {
    // If local path is provided, use it
    if (localPath) {
      return await fs.readFile(localPath);
    }
    
    // Otherwise, try to construct local path from storage key
    const localFilePath = path.join(process.cwd(), 'uploads', storageKey);
    try {
      return await fs.readFile(localFilePath);
    } catch (error) {
      throw new Error(`File not found: ${storageKey}`);
    }
  },

  /**
   * Delete file from storage (Bunny CDN or local)
   */
  async deleteFile(storageKey: string, localPath?: string): Promise<void> {
    // ✅ Bunny CDN Delete
    if (config.cdn.provider === 'bunny' && config.cdn.bunny.storageZoneName && config.cdn.bunny.storageApiKey) {
      try {
        const bunnyUrl = `https://storage.bunnycdn.com/${config.cdn.bunny.storageZoneName}/${storageKey}`;
        
        const response = await fetch(bunnyUrl, {
          method: 'DELETE',
          headers: {
            'AccessKey': config.cdn.bunny.storageApiKey,
          },
        });

        if (!response.ok && response.status !== 404) {
          console.error(`❌ Bunny CDN delete failed: ${response.status}`);
        } else {
          console.log(`✅ File deleted from Bunny CDN: ${storageKey}`);
        }
      } catch (error) {
        console.error('❌ Bunny CDN delete error:', error);
        // Continue to local delete as fallback
      }
    }
    
    // ✅ Local storage delete (fallback)
    if (localPath) {
      try {
        await fs.unlink(localPath);
      } catch (error) {
        // File might not exist, ignore
      }
    }
  },

  /**
   * Generate CDN URL for a storage key
   * ✅ Bunny CDN: Use pull zone URL if configured
   */
  getCDNUrl(storageKey: string, assetId?: string): string {
    // ✅ Bunny CDN: Use pull zone URL
    if (config.cdn.provider === 'bunny' && config.cdn.bunny.pullZoneUrl) {
      // ✅ FIX: Remove trailing slashes, /n/ prefix, and any whitespace/newlines
      let pullZoneUrl = config.cdn.bunny.pullZoneUrl
        .replace(/[\n\r\t\s]+/g, '') // Remove all whitespace, newlines, tabs
        .replace(/\/+$/, '') // Remove trailing slashes
        .trim();
      // Remove /n/ prefix if present (Bunny CDN pull zone URL should not include this)
      pullZoneUrl = pullZoneUrl.replace(/\/n\/?$/, '');
      const cleanStorageKey = storageKey.replace(/^\/+/, ''); // Remove leading slashes from storageKey
      const url = `${pullZoneUrl}/${cleanStorageKey}`;
      // ✅ FIX: Final cleanup - ensure no newlines or whitespace in final URL
      return url.replace(/[\n\r\t\s]+/g, '').trim();
    }
    
    // ✅ Fallback: Use API endpoint
    const extractedAssetId = assetId || (() => {
      const parts = storageKey.split('/');
      return parts.length >= 3 ? parts[2] : storageKey;
    })();
    
    return `/api/assets/${extractedAssetId}/file`;
  },
};

