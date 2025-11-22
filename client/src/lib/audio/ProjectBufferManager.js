/**
 * Project Buffer Manager
 * Manages audio buffers for samples used in the project
 * 
 * Strategy:
 * - Projede kullanılan sample'ların buffer'larını tutar
 * - Proje serialize edilirken buffer'lar serialize edilmez (çok büyük)
 * - Proje deserialize edilirken buffer'ları akıllıca yükler
 * - Bir kere yüklenen buffer tekrar yüklenmez
 */

import { decodeAudioData } from '@/lib/utils/audioUtils';

class ProjectBufferManager {
  constructor() {
    // Projede kullanılan sample'ların buffer'ları
    // Map<url, AudioBuffer>
    this.projectBuffers = new Map();
    
    // Yüklenen buffer'ların metadata'sı
    // Map<url, { buffer, loadedAt, size }>
    this.bufferMetadata = new Map();
    
    // Aktif yüklemeler (duplicate yüklemeyi önlemek için)
    // Map<url, Promise<AudioBuffer>>
    this.loadingPromises = new Map();
  }

  /**
   * Projede kullanılan sample'ın buffer'ını al
   * @param {string} url - Sample URL
   * @param {AudioContext} audioContext - Web Audio context
   * @returns {Promise<AudioBuffer>}
   */
  async getBuffer(url, audioContext) {
    if (!url) {
      throw new Error('URL is required');
    }

    // Cache'te var mı?
    if (this.projectBuffers.has(url)) {
      const buffer = this.projectBuffers.get(url);
      // Metadata güncelle
      if (this.bufferMetadata.has(url)) {
        this.bufferMetadata.get(url).lastAccess = Date.now();
      }
      return buffer;
    }

    // Zaten yükleniyor mu?
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url);
    }

    // Yükle
    const loadPromise = this._loadBuffer(url, audioContext);
    this.loadingPromises.set(url, loadPromise);

    try {
      const buffer = await loadPromise;
      this.loadingPromises.delete(url);
      return buffer;
    } catch (error) {
      this.loadingPromises.delete(url);
      throw error;
    }
  }

  /**
   * Buffer yükle
   * @private
   */
  async _loadBuffer(url, audioContext) {
    try {
      // Authorization header ekle (API endpoints için)
      const headers = {};
      if (url.includes('/api/assets/')) {
        const { useAuthStore } = await import('@/store/useAuthStore.js');
        const token = useAuthStore.getState().accessToken;
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = await decodeAudioData(arrayBuffer);

      // Cache'e ekle
      this.projectBuffers.set(url, buffer);
      this.bufferMetadata.set(url, {
        buffer,
        loadedAt: Date.now(),
        lastAccess: Date.now(),
        size: buffer.length * buffer.numberOfChannels * 4, // 32-bit float
        url
      });

      console.log(`[ProjectBuffer] Loaded: ${url} (${(buffer.duration).toFixed(2)}s)`);
      return buffer;
    } catch (error) {
      console.error(`[ProjectBuffer] Failed to load: ${url}`, error);
      throw error;
    }
  }

  /**
   * Buffer'ı cache'e ekle (zaten yüklenmişse)
   * @param {string} url - Sample URL
   * @param {AudioBuffer} buffer - Audio buffer
   */
  addBuffer(url, buffer) {
    if (!url || !buffer) {
      return;
    }

    this.projectBuffers.set(url, buffer);
    this.bufferMetadata.set(url, {
      buffer,
      loadedAt: Date.now(),
      lastAccess: Date.now(),
      size: buffer.length * buffer.numberOfChannels * 4,
      url
    });

    console.log(`[ProjectBuffer] Added: ${url}`);
  }

  /**
   * Buffer'ı cache'ten kaldır
   * @param {string} url - Sample URL
   */
  removeBuffer(url) {
    this.projectBuffers.delete(url);
    this.bufferMetadata.delete(url);
    console.log(`[ProjectBuffer] Removed: ${url}`);
  }

  /**
   * Tüm buffer'ları temizle
   */
  clear() {
    this.projectBuffers.clear();
    this.bufferMetadata.clear();
    this.loadingPromises.clear();
    console.log('[ProjectBuffer] Cleared all buffers');
  }

  /**
   * Cache istatistiklerini al
   */
  getStats() {
    let totalSize = 0;
    for (const metadata of this.bufferMetadata.values()) {
      totalSize += metadata.size;
    }

    return {
      count: this.projectBuffers.size,
      totalSize,
      totalMB: (totalSize / 1024 / 1024).toFixed(2),
      urls: Array.from(this.projectBuffers.keys())
    };
  }

  /**
   * Projede kullanılan sample URL'lerini topla
   * @param {Object} projectData - Project data
   * @returns {Set<string>} - Sample URLs used in project
   */
  collectProjectSampleUrls(projectData) {
    const urls = new Set();

    // Instruments'dan sample URL'leri topla
    if (projectData.instruments) {
      for (const instrument of projectData.instruments) {
        if (instrument.url && (instrument.type === 'sample' || instrument.audioBuffer)) {
          urls.add(instrument.url);
        }
      }
    }

    // Arrangement clips'lerden sample URL'leri topla
    if (projectData.arrangement && projectData.arrangement.clips) {
      for (const clip of projectData.arrangement.clips) {
        if (clip.sampleId) {
          // Sample ID'den URL bul (instruments store'dan)
          const instrument = projectData.instruments?.find(inst => inst.id === clip.sampleId);
          if (instrument?.url) {
            urls.add(instrument.url);
          }
        }
      }
    }

    return urls;
  }

  /**
   * Proje sample'larını preload et
   * @param {Object} projectData - Project data
   * @param {AudioContext} audioContext - Web Audio context
   * @param {Function} onProgress - Progress callback (url, index, total)
   */
  async preloadProjectSamples(projectData, audioContext, onProgress) {
    const urls = this.collectProjectSampleUrls(projectData);
    const urlArray = Array.from(urls);
    const total = urlArray.length;

    console.log(`[ProjectBuffer] Preloading ${total} project samples...`);

    const loadPromises = urlArray.map(async (url, index) => {
      try {
        // Zaten cache'te varsa skip et
        if (this.projectBuffers.has(url)) {
          if (onProgress) onProgress(url, index + 1, total);
          return;
        }

        // Yükle
        await this.getBuffer(url, audioContext);
        if (onProgress) onProgress(url, index + 1, total);
      } catch (error) {
        console.error(`[ProjectBuffer] Failed to preload: ${url}`, error);
        // Continue with other samples
      }
    });

    await Promise.allSettled(loadPromises);
    console.log(`[ProjectBuffer] Preloaded ${this.projectBuffers.size} samples`);
  }
}

// Singleton instance
let instance = null;

export function getProjectBufferManager() {
  if (!instance) {
    instance = new ProjectBufferManager();
  }
  return instance;
}

export default getProjectBufferManager;

