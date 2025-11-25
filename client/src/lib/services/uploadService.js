/**
 * Unified Upload Service
 * Handles file uploads with client-side direct CDN upload (Bunny CDN) and server-side fallback
 * Supports progress tracking, error handling, and multiple upload types
 */

// Import apiClient dynamically to avoid circular dependencies
let apiClient;
async function getApiClient() {
  if (!apiClient) {
    const module = await import('@/services/api.js');
    apiClient = module.apiClient || module.default;
  }
  return apiClient;
}

/**
 * Upload configuration options
 */
export const UploadType = {
  USER_ASSET: 'user_asset',
  SYSTEM_ASSET: 'system_asset',
  PROJECT_PREVIEW: 'project_preview',
};

/**
 * Upload a file with automatic client-side direct upload (Bunny CDN) or server-side fallback
 * 
 * @param {File|Blob} file - File to upload
 * @param {Object} options - Upload options
 * @param {string} options.type - Upload type (USER_ASSET, SYSTEM_ASSET, PROJECT_PREVIEW)
 * @param {string} options.endpoint - Server endpoint for upload (if not using direct CDN)
 * @param {Object} options.metadata - Additional metadata to send with upload
 * @param {Function} options.onProgress - Progress callback (progress: number 0-100)
 * @param {string} options.folderPath - Folder path (for user assets)
 * @param {string} options.parentFolderId - Parent folder ID (for user assets)
 * @param {string} options.projectId - Project ID (for project preview)
 * @param {number} options.duration - Duration in seconds (for project preview)
 * @returns {Promise<Object>} Upload result
 */
export async function uploadFile(file, options = {}) {
  const {
    type = UploadType.USER_ASSET,
    endpoint,
    metadata = {},
    onProgress,
    folderPath = '/',
    parentFolderId = null,
    projectId,
    duration,
  } = options;

  try {
    // Validate file
    if (!file || !(file instanceof File || file instanceof Blob)) {
      throw new Error('Invalid file provided');
    }

    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`📤 [UPLOAD] Starting upload: ${file.name} (${fileSizeMB.toFixed(2)}MB), type: ${type}`);

    // Handle different upload types
    switch (type) {
      case UploadType.USER_ASSET:
        return await uploadUserAsset(file, { folderPath, parentFolderId, onProgress });
      
      case UploadType.SYSTEM_ASSET:
        return await uploadSystemAsset(file, { metadata, onProgress });
      
      case UploadType.PROJECT_PREVIEW:
        return await uploadProjectPreview(file, { projectId, duration, onProgress });
      
      default:
        throw new Error(`Unknown upload type: ${type}`);
    }
  } catch (error) {
    console.error(`❌ [UPLOAD] Upload failed:`, error);
    throw error;
  }
}

/**
 * Upload user asset (with client-side direct CDN upload support)
 */
async function uploadUserAsset(file, { folderPath, parentFolderId, onProgress }) {
  const api = await getApiClient();
  const mimeType = file.type || 'audio/wav';
  
  // Request upload
  const uploadRequest = await api.requestUpload({
    filename: file.name,
    size: file.size,
    mimeType: mimeType.startsWith('audio/') ? mimeType : 'audio/wav',
    folderPath,
    parentFolderId: parentFolderId || null,
  });

  // Try client-side direct upload to Bunny CDN first (bypasses Vercel 4.5MB limit)
  if (uploadRequest.uploadUrl) {
    try {
      console.log(`📤 [CLIENT_UPLOAD] Attempting direct upload to Bunny CDN...`);
      
      // Get upload credentials from server
      const credentialsResponse = await fetch(`${api.baseURL}/assets/upload/${uploadRequest.assetId}/credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api.getToken()}`,
        },
      });

      // ✅ FIX: 404 means Bunny CDN is not configured - gracefully fall back to server upload
      if (credentialsResponse.status === 404) {
        console.log(`ℹ️ [CLIENT_UPLOAD] Direct upload not available (Bunny CDN not configured), using server upload`);
        throw new Error('DIRECT_UPLOAD_NOT_AVAILABLE'); // Special error code for graceful fallback
      }

      if (!credentialsResponse.ok) {
        throw new Error('Failed to get upload credentials');
      }

      const credentials = await credentialsResponse.json();
      
      // Upload directly to Bunny CDN with progress tracking
      const uploadResponse = await uploadToBunnyCDN(
        credentials.uploadUrl,
        credentials.accessKey,
        file,
        onProgress
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Bunny CDN upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      console.log(`✅ [CLIENT_UPLOAD] Direct upload to Bunny CDN successful`);
      
      // ✅ FIX: Get the CDN URL from storage service
      // The CDN URL is constructed as: pullZoneUrl/storageKey
      const { storageService } = await import('@/services/storage.js');
      const cdnUrl = storageService.getCDNUrl(credentials.storageKey || uploadRequest.storageKey, uploadRequest.assetId);
      console.log(`🌐 [CLIENT_UPLOAD] CDN URL: ${cdnUrl}`);
      
      // Mark upload as completed (this will also update storage_url with the CDN URL)
      const completedAsset = await api.completeUpload(uploadRequest.assetId);
      
      // ✅ FIX: Ensure storage_url is set to the full CDN URL
      if (completedAsset.storage_url && !completedAsset.storage_url.startsWith('http')) {
        // If storage_url is not a full URL, update it
        const updatedAsset = await api.updateAsset(uploadRequest.assetId, {
          storage_url: cdnUrl
        });
        return updatedAsset;
      }
      
      return completedAsset;
    } catch (clientUploadError) {
      // ✅ FIX: Don't show error for graceful fallback (Bunny CDN not configured)
      if (clientUploadError.message === 'DIRECT_UPLOAD_NOT_AVAILABLE') {
        console.log(`ℹ️ [CLIENT_UPLOAD] Using server-side upload (direct upload not available)`);
      } else {
        console.warn(`⚠️ [CLIENT_UPLOAD] Direct upload failed, falling back to server upload:`, clientUploadError);
      }
      // Fall through to server-side upload
    }
  }

  // Fallback: Server-side upload (multipart/form-data)
  const formData = new FormData();
  formData.append('file', file);
  
  return await uploadToServer(
    `${api.baseURL}/assets/upload/${uploadRequest.assetId}`,
    formData,
    { onProgress }
  );
}

/**
 * Upload system asset (admin panel)
 */
async function uploadSystemAsset(file, { metadata, onProgress }) {
  const formData = new FormData();
  
  // Add metadata fields first
  if (metadata.name) formData.append('name', metadata.name);
  if (metadata.filename) formData.append('filename', metadata.filename);
  if (metadata.description) formData.append('description', metadata.description);
  if (metadata.categoryId) formData.append('categoryId', metadata.categoryId);
  if (metadata.packId) formData.append('packId', metadata.packId);
  if (metadata.bpm) formData.append('bpm', metadata.bpm.toString());
  if (metadata.keySignature) formData.append('keySignature', metadata.keySignature);
  if (metadata.tags) formData.append('tags', JSON.stringify(metadata.tags));
  if (metadata.isPremium !== undefined) formData.append('isPremium', metadata.isPremium ? 'true' : 'false');
  if (metadata.isFeatured !== undefined) formData.append('isFeatured', metadata.isFeatured ? 'true' : 'false');
  if (metadata.isActive !== undefined) formData.append('isActive', metadata.isActive ? 'true' : 'false');
  
  // Add file last
  formData.append('file', file);

  const api = await getApiClient();
  return await uploadToServer(
    `${api.baseURL}/admin/system/assets`,
    formData,
    { onProgress, method: 'POST' }
  );
}

/**
 * Upload project preview (with client-side direct CDN upload support)
 */
async function uploadProjectPreview(file, { projectId, duration, onProgress }) {
  if (!projectId || !duration) {
    throw new Error('Project ID and duration are required for project preview upload');
  }

  const api = await getApiClient();
  const mimeType = file.type || 'audio/wav';
  
  // ✅ FIX: Try client-side direct upload to Bunny CDN first (bypasses Vercel 4.5MB limit)
  // Create a temporary user asset for the preview, then update project with the URL
  try {
    // Request upload as user asset (we'll use it for project preview)
    const uploadRequest = await api.requestUpload({
      filename: `${projectId}-preview.wav`,
      size: file.size,
      mimeType: mimeType.startsWith('audio/') ? mimeType : 'audio/wav',
      folderPath: '/',
      parentFolderId: null,
    });

    // Try client-side direct upload to Bunny CDN
    if (uploadRequest.uploadUrl) {
      try {
        console.log(`📤 [CLIENT_UPLOAD] Attempting direct upload to Bunny CDN for project preview...`);
        
        // Get upload credentials from server
        const credentialsResponse = await fetch(`${api.baseURL}/assets/upload/${uploadRequest.assetId}/credentials`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${api.getToken()}`,
          },
        });

        // ✅ FIX: 404 means Bunny CDN is not configured - gracefully fall back to server upload
        if (credentialsResponse.status === 404) {
          console.log(`ℹ️ [CLIENT_UPLOAD] Direct upload not available (Bunny CDN not configured), using server upload`);
          throw new Error('DIRECT_UPLOAD_NOT_AVAILABLE'); // Special error code for graceful fallback
        }

        if (!credentialsResponse.ok) {
          throw new Error('Failed to get upload credentials');
        }

        const credentials = await credentialsResponse.json();
        
        // Upload directly to Bunny CDN with progress tracking
        const uploadResponse = await uploadToBunnyCDN(
          credentials.uploadUrl,
          credentials.accessKey,
          file,
          onProgress
        );

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          throw new Error(`Bunny CDN upload failed: ${uploadResponse.status} - ${errorText}`);
        }

        console.log(`✅ [CLIENT_UPLOAD] Direct upload to Bunny CDN successful for project preview`);
        
        // Mark upload as completed
        const completedAsset = await api.completeUpload(uploadRequest.assetId);
        
        // ✅ FIX: Update project with preview URL and duration
        // Use the storage URL from the completed asset
        const previewUrl = completedAsset.storage_url || completedAsset.storageUrl;
        
        if (!previewUrl) {
          throw new Error('Preview URL not found in completed asset');
        }

        // Update project with preview URL
        await api.updateProject(projectId, {
          previewAudioUrl: previewUrl,
          previewAudioDuration: Math.round(duration),
          previewAudioRenderedAt: new Date().toISOString(),
          previewAudioStatus: 'ready',
        });

        return {
          previewAudioUrl: previewUrl,
          previewAudioDuration: Math.round(duration),
        };
      } catch (clientUploadError) {
        // ✅ FIX: Don't show error for graceful fallback (Bunny CDN not configured)
        if (clientUploadError.message === 'DIRECT_UPLOAD_NOT_AVAILABLE') {
          console.log(`ℹ️ [CLIENT_UPLOAD] Using server-side upload for project preview (direct upload not available)`);
        } else {
          console.warn(`⚠️ [CLIENT_UPLOAD] Direct upload failed for project preview, falling back to server upload:`, clientUploadError);
        }
        // Fall through to server-side upload
      }
    }
  } catch (error) {
    console.warn(`⚠️ [CLIENT_UPLOAD] Failed to setup client-side upload for project preview, using server upload:`, error);
    // Fall through to server-side upload
  }

  // Fallback: Server-side upload (multipart/form-data)
  const formData = new FormData();
  formData.append('duration', duration.toString());
  formData.append('file', file, `${projectId}-preview.wav`);

  return await uploadToServer(
    `${api.baseURL}/projects/${projectId}/upload-preview`,
    formData,
    { onProgress, method: 'POST' }
  );
}

/**
 * Upload directly to Bunny CDN with progress tracking
 */
async function uploadToBunnyCDN(uploadUrl, accessKey, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          ok: true,
          status: xhr.status,
          statusText: xhr.statusText,
        });
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('AccessKey', accessKey);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

/**
 * Upload to server with progress tracking
 */
async function uploadToServer(endpoint, body, { onProgress, method = 'POST' } = {}) {
  const api = await getApiClient();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          resolve(response);
        } catch (error) {
          resolve({ success: true });
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          const errorMessage = error.error?.message || error.message || `Upload failed: ${xhr.statusText}`;
          reject(new Error(errorMessage));
        } catch {
          // Better error messages for common status codes
          let errorMessage = `Upload failed: ${xhr.status} ${xhr.statusText}`;
          if (xhr.status === 415) {
            errorMessage = 'Unsupported Media Type: Server expects multipart/form-data';
          } else if (xhr.status === 413) {
            errorMessage = 'File too large: Maximum file size exceeded';
          } else if (xhr.status === 400) {
            errorMessage = `Bad Request: ${xhr.responseText || xhr.statusText}`;
          }
          reject(new Error(errorMessage));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.open(method, endpoint);
    xhr.setRequestHeader('Authorization', `Bearer ${api.getToken()}`);
    xhr.send(body);
  });
}

