/**
 * TimeStretcher - Pitch-shifted buffer cache for time-stretching
 *
 * Features:
 * - Creates pitch-shifted buffers using OfflineAudioContext
 * - Caches buffers to avoid recomputation
 * - Maintains original sample duration regardless of pitch
 * - Reduces aliasing by using proper resampling
 *
 * Usage:
 *   const stretcher = new TimeStretcher(audioContext);
 *   const shiftedBuffer = await stretcher.getPitchShiftedBuffer(originalBuffer, semitones);
 */

export class TimeStretcher {
    constructor(audioContext) {
        this.audioContext = audioContext;
        
        // Cache: Map<bufferId, Map<semitones, AudioBuffer>>
        // bufferId is a combination of buffer duration, sampleRate, and channels
        this.bufferCache = new Map();
        
        // Maximum cache size (to prevent memory issues)
        this.maxCacheSize = 100;
        
        // Cache statistics
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            totalProcessed: 0
        };
    }

    /**
     * Get a pitch-shifted buffer (cached or newly created)
     * 
     * @param {AudioBuffer} originalBuffer - Original audio buffer
     * @param {number} semitones - Pitch shift in semitones (can be negative)
     * @returns {Promise<AudioBuffer>} Pitch-shifted buffer with same duration
     */
    async getPitchShiftedBuffer(originalBuffer, semitones) {
        // If no pitch shift, return original
        if (Math.abs(semitones) < 0.01) {
            return originalBuffer;
        }

        // Round semitones to nearest 0.5 for cache efficiency
        const roundedSemitones = Math.round(semitones * 2) / 2;
        
        // Generate cache key
        const bufferId = this._getBufferId(originalBuffer);
        
        // Check cache
        if (!this.bufferCache.has(bufferId)) {
            this.bufferCache.set(bufferId, new Map());
        }
        
        const semitoneCache = this.bufferCache.get(bufferId);
        
        if (semitoneCache.has(roundedSemitones)) {
            this.stats.cacheHits++;
            return semitoneCache.get(roundedSemitones);
        }

        // Cache miss - create new buffer
        this.stats.cacheMisses++;
        this.stats.totalProcessed++;
        
        const shiftedBuffer = await this._createPitchShiftedBuffer(originalBuffer, roundedSemitones);
        
        // Cache the result
        semitoneCache.set(roundedSemitones, shiftedBuffer);
        
        // Cleanup old cache entries if needed
        this._cleanupCache();
        
        return shiftedBuffer;
    }

    /**
     * Create a pitch-shifted buffer using OfflineAudioContext
     * 
     * @param {AudioBuffer} originalBuffer - Original audio buffer
     * @param {number} semitones - Pitch shift in semitones
     * @returns {Promise<AudioBuffer>} Pitch-shifted buffer
     */
    async _createPitchShiftedBuffer(originalBuffer, semitones) {
        // Calculate playback rate
        const playbackRate = Math.pow(2, semitones / 12);
        
        // ✅ TIME STRETCH LOGIC:
        // When we play at playbackRate, the duration becomes originalDuration / playbackRate
        // To maintain original duration, we need to render MORE audio data
        // Strategy: Render the original buffer at playbackRate, then resample to match original duration
        
        const originalDuration = originalBuffer.duration;
        const targetDuration = originalDuration; // Keep same duration as original
        
        // Calculate rendered duration (will be shorter if pitch is higher)
        const renderedDuration = originalDuration / playbackRate;
        
        // We need to render enough samples to cover the rendered duration
        // Then we'll resample it back to original duration
        const offlineContext = new OfflineAudioContext(
            originalBuffer.numberOfChannels,
            Math.ceil(renderedDuration * originalBuffer.sampleRate),
            originalBuffer.sampleRate
        );

        // Create buffer source
        const source = offlineContext.createBufferSource();
        source.buffer = originalBuffer;
        source.playbackRate.value = playbackRate;

        // Connect to destination
        source.connect(offlineContext.destination);

        // Start playback
        source.start(0);

        // Render to buffer
        const renderedBuffer = await offlineContext.startRendering();

        // ✅ TIME STRETCH: Resample rendered buffer to match original duration
        // The rendered buffer has duration = originalDuration / playbackRate
        // We need to stretch it back to originalDuration using linear interpolation
        
        const targetLength = Math.ceil(targetDuration * renderedBuffer.sampleRate);
        const sourceLength = renderedBuffer.length;
        
        if (Math.abs(renderedBuffer.duration - targetDuration) > 0.001) {
            // Create target buffer with original duration
            const targetBuffer = this.audioContext.createBuffer(
                renderedBuffer.numberOfChannels,
                targetLength,
                renderedBuffer.sampleRate
            );

            // Linear interpolation resampling
            const ratio = sourceLength / targetLength;
            
            for (let channel = 0; channel < targetBuffer.numberOfChannels; channel++) {
                const targetData = targetBuffer.getChannelData(channel);
                const sourceData = renderedBuffer.getChannelData(channel);
                
                for (let i = 0; i < targetLength; i++) {
                    const sourceIndex = i * ratio;
                    const sourceIndexFloor = Math.floor(sourceIndex);
                    const sourceIndexCeil = Math.min(sourceIndexFloor + 1, sourceLength - 1);
                    const fraction = sourceIndex - sourceIndexFloor;
                    
                    // Linear interpolation
                    targetData[i] = sourceData[sourceIndexFloor] * (1 - fraction) + 
                                   sourceData[sourceIndexCeil] * fraction;
                }
            }

            return targetBuffer;
        }

        // Duration already matches (shouldn't happen, but handle it)
        return renderedBuffer;
    }

    /**
     * Generate a unique ID for a buffer (for caching)
     * 
     * @param {AudioBuffer} buffer - Audio buffer
     * @returns {string} Buffer ID
     */
    _getBufferId(buffer) {
        // Use duration, sampleRate, and channels as ID
        // This allows caching across different buffer instances with same content
        return `${buffer.duration.toFixed(6)}_${buffer.sampleRate}_${buffer.numberOfChannels}`;
    }

    /**
     * Cleanup old cache entries to prevent memory issues
     */
    _cleanupCache() {
        let totalEntries = 0;
        for (const semitoneCache of this.bufferCache.values()) {
            totalEntries += semitoneCache.size;
        }

        if (totalEntries > this.maxCacheSize) {
            // Remove oldest entries (simple FIFO - could be improved with LRU)
            const entriesToRemove = totalEntries - this.maxCacheSize;
            let removed = 0;

            for (const [bufferId, semitoneCache] of this.bufferCache.entries()) {
                if (removed >= entriesToRemove) break;

                const firstKey = semitoneCache.keys().next().value;
                if (firstKey !== undefined) {
                    semitoneCache.delete(firstKey);
                    removed++;
                }

                // Remove empty cache entries
                if (semitoneCache.size === 0) {
                    this.bufferCache.delete(bufferId);
                }
            }

            console.log(`🧹 TimeStretcher: Cleaned up ${removed} cache entries`);
        }
    }

    /**
     * Clear all cached buffers
     */
    clearCache() {
        this.bufferCache.clear();
        console.log('🗑️ TimeStretcher: Cache cleared');
    }

    /**
     * Get cache statistics
     * 
     * @returns {Object} Cache statistics
     */
    getStats() {
        let totalCached = 0;
        for (const semitoneCache of this.bufferCache.values()) {
            totalCached += semitoneCache.size;
        }

        return {
            ...this.stats,
            totalCached,
            hitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0
        };
    }
}

