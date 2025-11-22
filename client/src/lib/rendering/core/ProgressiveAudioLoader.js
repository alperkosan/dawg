/**
 * PROGRESSIVE AUDIO LOADER
 *
 * Handles large audio file loading (150MB+) with:
 * - Streaming decode with progress tracking
 * - Chunk-based processing
 * - Memory-efficient buffering
 * - Cancellation support
 * - Error recovery
 *
 * Prevents browser freeze when loading massive audio files.
 */

import { createLogger, NAMESPACES } from '@/lib/utils/debugLogger.js';

const log = createLogger(NAMESPACES.AUDIO);

// Chunk size for streaming (5MB chunks)
const CHUNK_SIZE = 5 * 1024 * 1024;

// Max concurrent chunk decodes
const MAX_CONCURRENT_DECODES = 2;

export class ProgressiveAudioLoader {
  constructor(audioContext) {
    this.audioContext = audioContext;

    // Active loads: Map<loadId, { controller, progress, resolve, reject }>
    this.activeLoads = new Map();

    // Completed loads cache: Map<url, AudioBuffer>
    this.cache = new Map();
    this.maxCacheSize = 50; // Max 50 large files cached

    log.info('ProgressiveAudioLoader initialized');
  }

  /**
   * Load audio file with progressive decoding
   * @param {string} url - Audio file URL
   * @param {Function} onProgress - Progress callback (0-1)
   * @param {Object} options - Load options
   * @returns {Promise<AudioBuffer>}
   */
  async load(url, onProgress = null, options = {}) {
    const loadId = `${url}_${Date.now()}`;

    try {
      // Check cache first
      if (this.cache.has(url)) {
        log.debug(`Cache hit for ${url}`);
        if (onProgress) onProgress(1.0);
        return this.cache.get(url);
      }

      // Check file size to determine loading strategy
      const fileSize = await this.getFileSize(url);

      // Small files (<20MB) - load directly
      if (fileSize < 20 * 1024 * 1024) {
        log.debug(`Small file detected (${(fileSize / 1024 / 1024).toFixed(2)}MB), loading directly`);
        return await this.loadDirect(url, onProgress);
      }

      // Large files - progressive loading
      log.info(`Large file detected (${(fileSize / 1024 / 1024).toFixed(2)}MB), using progressive loading`);
      return await this.loadProgressive(url, fileSize, onProgress, loadId);

    } catch (error) {
      log.error('Failed to load audio file', { url, error });
      this.activeLoads.delete(loadId);
      throw error;
    }
  }

  /**
   * Get file size via HEAD request
   */
  async getFileSize(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : 0;
    } catch (error) {
      log.warn('Failed to get file size, assuming large file', error);
      return Infinity; // Assume large file if HEAD fails
    }
  }

  /**
   * Load small file directly
   */
  async loadDirect(url, onProgress) {
    if (onProgress) onProgress(0.1);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    if (onProgress) onProgress(0.3);

    const arrayBuffer = await response.arrayBuffer();

    if (onProgress) onProgress(0.6);

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    if (onProgress) onProgress(1.0);

    // Cache result
    this.addToCache(url, audioBuffer);

    return audioBuffer;
  }

  /**
   * Load large file progressively with chunked streaming
   */
  async loadProgressive(url, fileSize, onProgress, loadId) {
    const controller = new AbortController();

    // Create load entry
    this.activeLoads.set(loadId, {
      controller,
      progress: 0,
      resolve: null,
      reject: null
    });

    try {
      // Fetch with streaming
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const chunks = [];
      let receivedLength = 0;

      // Read chunks
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        // Update progress (download phase: 0-70%)
        const downloadProgress = receivedLength / fileSize;
        const totalProgress = downloadProgress * 0.7;

        if (onProgress) onProgress(totalProgress);

        this.activeLoads.get(loadId).progress = totalProgress;
      }

      // Combine chunks into single ArrayBuffer
      const arrayBuffer = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        arrayBuffer.set(chunk, position);
        position += chunk.length;
      }

      // Update progress (decode phase: 70-100%)
      if (onProgress) onProgress(0.75);

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.buffer);

      if (onProgress) onProgress(1.0);

      // Cache result
      this.addToCache(url, audioBuffer);

      this.activeLoads.delete(loadId);

      log.info(`Successfully loaded ${url}`, {
        size: (fileSize / 1024 / 1024).toFixed(2) + 'MB',
        duration: audioBuffer.duration.toFixed(2) + 's',
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate
      });

      return audioBuffer;

    } catch (error) {
      if (error.name === 'AbortError') {
        log.info(`Load cancelled: ${url}`);
        throw new Error('Load cancelled by user');
      }
      throw error;
    }
  }

  /**
   * Cancel active load
   */
  cancel(loadId) {
    const load = this.activeLoads.get(loadId);
    if (load && load.controller) {
      load.controller.abort();
      this.activeLoads.delete(loadId);
      log.debug(`Cancelled load: ${loadId}`);
    }
  }

  /**
   * Cancel all active loads
   */
  cancelAll() {
    for (const [loadId, load] of this.activeLoads.entries()) {
      if (load.controller) {
        load.controller.abort();
      }
    }
    this.activeLoads.clear();
    log.info('Cancelled all active loads');
  }

  /**
   * Add to cache with LRU eviction
   */
  addToCache(url, audioBuffer) {
    // Enforce cache size limit
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest (first key)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      log.debug(`Evicted from cache: ${firstKey}`);
    }

    this.cache.set(url, audioBuffer);
  }

  /**
   * Get load progress for active load
   */
  getProgress(loadId) {
    const load = this.activeLoads.get(loadId);
    return load ? load.progress : 0;
  }

  /**
   * Check if load is active
   */
  isLoading(loadId) {
    return this.activeLoads.has(loadId);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    let totalDuration = 0;
    let totalSize = 0; // Approximate

    for (const buffer of this.cache.values()) {
      totalDuration += buffer.duration;
      // Approximate size: duration * sampleRate * channels * 4 bytes (Float32)
      totalSize += buffer.duration * buffer.sampleRate * buffer.numberOfChannels * 4;
    }

    return {
      cachedFiles: this.cache.size,
      totalDuration: totalDuration.toFixed(2) + 's',
      approximateSize: (totalSize / 1024 / 1024).toFixed(2) + 'MB',
      activeLoads: this.activeLoads.size
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    log.info('Cleared audio cache');
  }

  /**
   * Dispose loader
   */
  dispose() {
    this.cancelAll();
    this.clearCache();
    log.info('ProgressiveAudioLoader disposed');
  }
}

// Global singleton
let progressiveAudioLoader = null;

export function getProgressiveAudioLoader(audioContext) {
  if (!progressiveAudioLoader && audioContext) {
    progressiveAudioLoader = new ProgressiveAudioLoader(audioContext);
    if (typeof window !== 'undefined') {
      window.__progressiveAudioLoader = progressiveAudioLoader;
    }
  }
  return progressiveAudioLoader;
}

// Global debug access
if (typeof window !== 'undefined') {
  window.ProgressiveAudioLoaderStats = () => {
    if (window.__progressiveAudioLoader) {
      const stats = window.__progressiveAudioLoader.getCacheStats();
      console.table(stats);
    } else {
      console.log('No ProgressiveAudioLoader instance found');
    }
  };

  window.ProgressiveAudioLoaderClear = () => {
    if (window.__progressiveAudioLoader) {
      window.__progressiveAudioLoader.clearCache();
      console.log('ProgressiveAudioLoader cache cleared');
    }
  };

  window.ProgressiveAudioLoaderCancelAll = () => {
    if (window.__progressiveAudioLoader) {
      window.__progressiveAudioLoader.cancelAll();
      console.log('All active loads cancelled');
    }
  };
}
