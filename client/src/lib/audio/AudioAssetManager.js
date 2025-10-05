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
      const cachedAsset = this.assets.get(assetId);

      // If loading from file browser but not yet added to instruments, add it now
      if (metadata.source === 'file-browser') {
        this._addToInstrumentsStore(assetId, cachedAsset.buffer, metadata);
      }

      return cachedAsset.buffer;
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
    // If AudioContext not set, try to get it from AudioContextService
    if (!this.audioContext) {
      const { AudioContextService } = await import('../services/AudioContextService');
      const engine = AudioContextService.getAudioEngine();
      if (engine?.audioContext) {
        this.audioContext = engine.audioContext;
        console.log('📦 AudioContext initialized from AudioContextService');
      } else {
        throw new Error('AudioContext not initialized. Call setAudioContext first or ensure AudioContextService is running.');
      }
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

      // Add to instruments store if loaded from file browser
      console.log('🔍 Checking if should add to instruments:', { source: metadata.source, shouldAdd: metadata.source === 'file-browser' });
      if (metadata.source === 'file-browser') {
        console.log('🎹 Calling _addToInstrumentsStore');
        this._addToInstrumentsStore(assetId, audioBuffer, metadata);
      }

      // Notify listeners that asset was loaded
      this._notifyListeners(assetId, audioBuffer);

      return audioBuffer;
    } catch (error) {
      console.error(`❌ Failed to load audio asset: ${url}`, error);
      throw error;
    }
  }

  /**
   * Add pre-loaded asset (e.g., from pattern export)
   * @param {object} assetData - { id, name, buffer, url, type, metadata }
   */
  async addAsset(assetData) {
    const { id, name, buffer, url, type, metadata } = assetData;

    if (!buffer) {
      throw new Error('AudioBuffer is required');
    }

    // Store asset
    this.assets.set(id, {
      buffer: buffer,
      url: url || null,
      metadata: {
        name: name || 'Audio Asset',
        type: type || 'audio',
        ...metadata
      }
    });

    console.log(`📦 Added asset ${id} to cache`);

    // Add to instruments store if needed
    if (metadata?.addToInstruments !== false) {
      await this._addToInstrumentsStore(id, buffer, { name, ...metadata });
    }

    // Notify listeners
    this._notifyListeners(id, buffer);

    return id;
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

  /**
   * Add loaded audio to instruments store (for Samples panel)
   */
  async _addToInstrumentsStore(assetId, audioBuffer, metadata) {
    try {
      // Dynamically import to avoid circular dependencies
      const { useInstrumentsStore } = await import('../../store/useInstrumentsStore');

      const store = useInstrumentsStore.getState();

      // Check if already exists by assetId or URL
      const asset = this.getAsset(assetId);
      if (!asset) {
        console.warn(`🎹 Asset ${assetId} not found in cache`);
        return;
      }

      // For frozen patterns or generated audio, use assetId. For file-based audio, use URL
      const identifier = asset.url || assetId;

      const existingInstrument = store.instruments.find(inst =>
        inst.url === identifier || inst.assetId === assetId
      );
      if (existingInstrument) {
        console.log(`🎹 Instrument already exists for ${identifier}`);
        return;
      }

      // Create sample object for handleAddNewInstrument
      const sampleData = {
        name: metadata.name || asset.metadata?.name || 'Audio Sample',
        url: identifier,
        assetId: assetId, // Include assetId for frozen patterns
        audioBuffer: audioBuffer // Include buffer directly for frozen patterns without URL
      };

      // Use existing handleAddNewInstrument function
      store.handleAddNewInstrument(sampleData);

      console.log(`🎹 Added instrument for "${sampleData.name}" to Samples panel`);
    } catch (error) {
      console.error('Failed to add instrument to store:', error);
    }
  }
}

// Export singleton instance
export const audioAssetManager = new AudioAssetManager();
