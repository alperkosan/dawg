/**
 * AUDIO ASSET MANAGER
 *
 * Centralized audio asset loading and caching system
 * - Loads audio files and decodes to AudioBuffer
 * - Caches buffers for reuse
 * - Supports both instrument samples and arrangement audio clips
 * - Extensible for future export/import features
 */

class AudioAssetManager {
  constructor() {
    this.assets = new Map(); // Map<assetId, { buffer, url, metadata }>
    this.loadingPromises = new Map(); // Map<assetId, Promise>
    this.audioContext = null;
    this.listeners = new Set(); // Set of callback functions
  }

  /**
   * Initialize with AudioContext
   */
  setAudioContext(audioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Generate consistent asset ID from URL
   */
  generateAssetId(url) {
    return `asset-${url.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }

  /**
   * Load audio asset and return AudioBuffer
   * @param {string} url - Audio file URL
   * @param {object} metadata - Optional metadata (name, type, etc.)
   * @returns {Promise<AudioBuffer>}
   */
  async loadAsset(url, metadata = {}) {
    const assetId = this.generateAssetId(url);

    // Return cached asset if available
    if (this.assets.has(assetId)) {
      return this.assets.get(assetId).buffer;
    }

    // Return ongoing loading promise if already loading
    if (this.loadingPromises.has(assetId)) {
      return this.loadingPromises.get(assetId);
    }

    // Start loading
    const loadingPromise = this._loadAudioFile(url, assetId, metadata);
    this.loadingPromises.set(assetId, loadingPromise);

    try {
      const buffer = await loadingPromise;
      this.loadingPromises.delete(assetId);
      return buffer;
    } catch (error) {
      this.loadingPromises.delete(assetId);
      throw error;
    }
  }

  /**
   * Internal: Load and decode audio file
   */
  async _loadAudioFile(url, assetId, metadata) {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized. Call setAudioContext first.');
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Cache the asset
      this.assets.set(assetId, {
        buffer: audioBuffer,
        url,
        metadata: {
          ...metadata,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
          loadedAt: Date.now()
        }
      });

      console.log(`✅ Audio asset loaded: ${assetId}`, metadata);

      // Notify listeners that asset was loaded
      this._notifyListeners(assetId, audioBuffer);

      return audioBuffer;
    } catch (error) {
      console.error(`❌ Failed to load audio asset: ${url}`, error);
      throw error;
    }
  }

  /**
   * Get cached asset by ID
   */
  getAsset(assetId) {
    return this.assets.get(assetId);
  }

  /**
   * Get asset by URL
   */
  getAssetByUrl(url) {
    const assetId = this.generateAssetId(url);
    return this.assets.get(assetId);
  }

  /**
   * Check if asset is loaded
   */
  isLoaded(assetId) {
    return this.assets.has(assetId);
  }

  /**
   * Clear specific asset from cache
   */
  clearAsset(assetId) {
    this.assets.delete(assetId);
  }

  /**
   * Clear all cached assets
   */
  clearAll() {
    this.assets.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get all loaded assets
   */
  getAllAssets() {
    return Array.from(this.assets.entries()).map(([id, asset]) => ({
      id,
      ...asset.metadata
    }));
  }

  /**
   * Subscribe to asset load events
   * @param {Function} callback - Called when asset is loaded (assetId, buffer)
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  _notifyListeners(assetId, buffer) {
    this.listeners.forEach(listener => {
      try {
        listener(assetId, buffer);
      } catch (error) {
        console.error('Error in AudioAssetManager listener:', error);
      }
    });
  }
}

// Export singleton instance
export const audioAssetManager = new AudioAssetManager();
