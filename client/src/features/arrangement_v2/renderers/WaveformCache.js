/**
 * 🎵 WAVEFORM CACHE - ARRANGEMENT V2
 *
 * Simple caching system for rendered waveforms
 * - Reduces redundant waveform calculations
 * - Uses LRU cache with size limit
 * - Keyed by clip ID + dimensions + LOD
 */

// ============================================================================
// WAVEFORM CACHE
// ============================================================================

class WaveformCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Generate cache key from clip properties
   */
  _getCacheKey(clipId, width, height, lod) {
    return `${clipId}-${width}-${height}-${lod}`;
  }

  /**
   * Get cached waveform canvas
   */
  get(clipId, clip, width, height, bpm, lod) {
    const key = this._getCacheKey(clipId, width, height, lod);
    const cached = this.cache.get(key);

    if (cached) {
      // Move to end (LRU)
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }

    return null;
  }

  /**
   * Store waveform canvas in cache
   */
  set(clipId, clip, width, height, bpm, lod, canvas) {
    const key = this._getCacheKey(clipId, width, height, lod);

    // Remove oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, canvas);
  }

  /**
   * Render waveform to offscreen canvas
   */
  renderWaveform(audioBuffer, clip, width, height, bpm, lod, styles = {}) {
    if (!audioBuffer || width <= 0 || height <= 0) {
      return null;
    }

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Get audio data
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Calculate visible portion based on clip offset
    const { sampleOffset = 0 } = clip;
    const startSample = Math.floor(sampleOffset * sampleRate);
    const secondsPerBeat = 60 / bpm;
    const clipDurationSeconds = clip.duration * secondsPerBeat;
    const samplesNeeded = Math.floor(clipDurationSeconds * sampleRate);
    const endSample = Math.min(startSample + samplesNeeded, channelData.length);

    // Calculate samples per pixel based on LOD
    let samplesPerPixel;
    switch (lod) {
      case 0: // Low detail - more samples per pixel
        samplesPerPixel = Math.max(1, Math.floor((endSample - startSample) / width / 2));
        break;
      case 1: // Medium detail
        samplesPerPixel = Math.max(1, Math.floor((endSample - startSample) / width));
        break;
      case 2: // High detail - fewer samples per pixel
      default:
        samplesPerPixel = Math.max(1, Math.floor((endSample - startSample) / width * 0.5));
        break;
    }

    // Draw waveform
    ctx.fillStyle = styles.waveformColor || 'rgba(167, 139, 250, 0.9)';
    ctx.strokeStyle = styles.waveformColor || 'rgba(167, 139, 250, 0.9)';
    ctx.lineWidth = 1;

    const centerY = height / 2;
    const amplitudeScale = height * 0.4; // Use 80% of height

    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const sampleIndex = startSample + Math.floor(x * samplesPerPixel);

      if (sampleIndex >= endSample) break;

      // Find min/max in this pixel's sample range
      let min = 1;
      let max = -1;

      for (let s = 0; s < samplesPerPixel && sampleIndex + s < endSample; s++) {
        const sample = channelData[sampleIndex + s] || 0;
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }

      // Draw vertical line from min to max
      const y1 = centerY - min * amplitudeScale;
      const y2 = centerY - max * amplitudeScale;

      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }

    ctx.stroke();

    return canvas;
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Clear cache for specific clip
   */
  clearClip(clipId) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${clipId}-`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let cacheInstance = null;

export function getWaveformCache() {
  if (!cacheInstance) {
    cacheInstance = new WaveformCache(100);
  }
  return cacheInstance;
}

export function clearWaveformCache() {
  if (cacheInstance) {
    cacheInstance.clear();
  }
}
