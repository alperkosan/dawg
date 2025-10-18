/**
 * SampleLoader - Centralized audio sample loading with caching
 *
 * Features:
 * - Shared cache between preview and playback
 * - Parallel loading with progress tracking
 * - Error handling and retry logic
 * - Support for multiple audio formats (WAV, OGG, MP3)
 */

export class SampleLoader {
    // Static cache shared across all instances
    static cache = new Map(); // url -> AudioBuffer
    static pendingLoads = new Map(); // url -> Promise
    static loadStats = {
        totalLoaded: 0,
        totalFailed: 0,
        cacheHits: 0,
        cacheMisses: 0
    };

    /**
     * Load a single audio sample
     *
     * @param {string} url - Sample URL
     * @param {AudioContext} audioContext - Web Audio context
     * @param {Object} options - Loading options
     * @returns {Promise<AudioBuffer>}
     */
    static async load(url, audioContext, options = {}) {
        const {
            useCache = true,
            retries = 2,
            onProgress = null
        } = options;

        // Check cache first
        if (useCache && this.cache.has(url)) {
            this.loadStats.cacheHits++;
            console.log(`📦 Cache hit: ${url}`);
            return this.cache.get(url);
        }

        this.loadStats.cacheMisses++;

        // Check if already loading
        if (this.pendingLoads.has(url)) {
            console.log(`⏳ Already loading: ${url}`);
            return this.pendingLoads.get(url);
        }

        // Start loading
        const loadPromise = this._loadWithRetry(url, audioContext, retries, onProgress);

        // Track pending load
        this.pendingLoads.set(url, loadPromise);

        try {
            const buffer = await loadPromise;

            // Cache the result
            if (useCache) {
                this.cache.set(url, buffer);
            }

            this.loadStats.totalLoaded++;
            console.log(`✅ Sample loaded: ${url} (${buffer.duration.toFixed(2)}s, ${buffer.numberOfChannels} ch)`);

            return buffer;

        } catch (error) {
            this.loadStats.totalFailed++;
            throw error;
        } finally {
            // Remove from pending
            this.pendingLoads.delete(url);
        }
    }

    /**
     * Load multiple samples in parallel
     *
     * @param {Array<string>} urls - Array of sample URLs
     * @param {AudioContext} audioContext - Web Audio context
     * @param {Function} onProgress - Progress callback (loaded, total)
     * @returns {Promise<Map<string, AudioBuffer>>}
     */
    static async loadMultiple(urls, audioContext, onProgress = null) {
        const results = new Map();
        let loaded = 0;
        const total = urls.length;

        console.log(`📦 Loading ${total} samples...`);

        // Load all in parallel
        const promises = urls.map(async (url) => {
            try {
                const buffer = await this.load(url, audioContext);
                results.set(url, buffer);
                loaded++;

                if (onProgress) {
                    onProgress(loaded, total, url);
                }

                return { url, buffer, success: true };
            } catch (error) {
                console.error(`❌ Failed to load ${url}:`, error);
                loaded++;

                if (onProgress) {
                    onProgress(loaded, total, url, error);
                }

                return { url, error, success: false };
            }
        });

        const allResults = await Promise.all(promises);

        const successCount = allResults.filter(r => r.success).length;
        const failCount = allResults.filter(r => !r.success).length;

        console.log(`✅ Loaded ${successCount}/${total} samples (${failCount} failed)`);

        return results;
    }

    /**
     * Load with retry logic
     * @private
     */
    static async _loadWithRetry(url, audioContext, retries, onProgress) {
        let lastError;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                if (attempt > 0) {
                    console.log(`🔄 Retry ${attempt}/${retries}: ${url}`);
                }

                return await this._fetchAndDecode(url, audioContext, onProgress);
            } catch (error) {
                lastError = error;

                if (attempt < retries) {
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
                }
            }
        }

        throw new Error(`Failed to load ${url} after ${retries + 1} attempts: ${lastError.message}`);
    }

    /**
     * Fetch and decode audio file
     * @private
     */
    static async _fetchAndDecode(url, audioContext, onProgress) {
        // Fetch audio file
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Get total size for progress
        const contentLength = parseInt(response.headers.get('content-length'), 10);

        // Read response as array buffer
        const arrayBuffer = await this._readResponseWithProgress(
            response,
            contentLength,
            onProgress
        );

        // Decode audio data
        try {
            const buffer = await audioContext.decodeAudioData(arrayBuffer);
            return buffer;
        } catch (error) {
            throw new Error(`Failed to decode audio: ${error.message}`);
        }
    }

    /**
     * Read response with progress tracking
     * @private
     */
    static async _readResponseWithProgress(response, contentLength, onProgress) {
        if (!response.body || !onProgress) {
            // No progress tracking needed
            return response.arrayBuffer();
        }

        const reader = response.body.getReader();
        const chunks = [];
        let receivedLength = 0;

        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            chunks.push(value);
            receivedLength += value.length;

            if (onProgress && contentLength) {
                onProgress(receivedLength, contentLength);
            }
        }

        // Concatenate chunks
        const arrayBuffer = new Uint8Array(receivedLength);
        let position = 0;

        for (const chunk of chunks) {
            arrayBuffer.set(chunk, position);
            position += chunk.length;
        }

        return arrayBuffer.buffer;
    }

    /**
     * Preload samples for an instrument
     *
     * @param {Object} instrumentData - Instrument data with url or multiSamples
     * @param {AudioContext} audioContext - Web Audio context
     * @returns {Promise<Map<string, AudioBuffer>>}
     */
    static async preloadInstrument(instrumentData, audioContext) {
        const urls = [];

        // Single sample instrument
        if (instrumentData.url) {
            urls.push(instrumentData.url);
        }

        // Multi-sampled instrument
        if (instrumentData.multiSamples && Array.isArray(instrumentData.multiSamples)) {
            instrumentData.multiSamples.forEach(sample => {
                if (sample.url) {
                    urls.push(sample.url);
                }
            });
        }

        if (urls.length === 0) {
            console.warn(`No samples to load for ${instrumentData.name}`);
            return new Map();
        }

        console.log(`🎹 Preloading ${urls.length} samples for ${instrumentData.name}...`);

        return this.loadMultiple(urls, audioContext, (loaded, total, url) => {
            console.log(`  ${loaded}/${total}: ${url.split('/').pop()}`);
        });
    }

    /**
     * Clear cache (useful for memory management)
     *
     * @param {string} url - Specific URL to clear (optional)
     */
    static clearCache(url = null) {
        if (url) {
            this.cache.delete(url);
            console.log(`🗑️ Cleared cache for: ${url}`);
        } else {
            const count = this.cache.size;
            this.cache.clear();
            console.log(`🗑️ Cleared entire cache (${count} samples)`);
        }
    }

    /**
     * Get cache statistics
     */
    static getCacheStats() {
        const cachedSamples = Array.from(this.cache.entries()).map(([url, buffer]) => ({
            url,
            duration: buffer.duration,
            channels: buffer.numberOfChannels,
            sampleRate: buffer.sampleRate
        }));

        return {
            ...this.loadStats,
            cachedSamples: this.cache.size,
            pendingLoads: this.pendingLoads.size,
            samples: cachedSamples
        };
    }

    /**
     * Check if sample is cached
     */
    static isCached(url) {
        return this.cache.has(url);
    }

    /**
     * Get cached buffer
     */
    static getCached(url) {
        return this.cache.get(url);
    }
}
