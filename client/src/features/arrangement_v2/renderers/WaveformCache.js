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
   * KEY INSIGHT: Width IS part of the key because canvas size matters
   * But we also need zoom/ppb to ensure correct time-scale rendering
   */
  _getCacheKey(clipId, width, height, lod, sampleOffset = 0, zoomX = 1, pixelsPerBeat = 48) {
    // Round values to avoid cache misses from floating point errors
    const roundedOffset = Math.round(sampleOffset * 1000) / 1000;
    const roundedZoom = Math.round(zoomX * 1000) / 1000;
    const roundedPPB = Math.round(pixelsPerBeat * 10) / 10;
    return `${clipId}-w${width}-h${height}-lod${lod}-off${roundedOffset}-z${roundedZoom}-ppb${roundedPPB}`;
  }

  /**
   * Get cached waveform canvas
   */
  get(clipId, clip, width, height, bpm, lod, pixelsPerBeat, zoomX) {
    const key = this._getCacheKey(clipId, width, height, lod, clip.sampleOffset, zoomX, pixelsPerBeat);
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
  set(clipId, clip, width, height, bpm, lod, canvas, pixelsPerBeat, zoomX) {
    const key = this._getCacheKey(clipId, width, height, lod, clip.sampleOffset, zoomX, pixelsPerBeat);

    // Remove oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, canvas);
  }

  /**
   * Render waveform to offscreen canvas
   * Waveform is rendered based on TIME SCALE (pixels per beat), not clip duration
   * This ensures waveform doesn't stretch when resizing - it shows the actual audio at that time
   */
  renderWaveform(audioBuffer, clip, width, height, bpm, lod, styles = {}, pixelsPerBeat = 48, zoomX = 1) {
    // ✅ FIX: Add more robust validation for canvas dimensions
    if (!audioBuffer) {
      console.warn('⚠️ renderWaveform: audioBuffer is null');
      return null;
    }

    if (width <= 0 || height <= 0) {
      console.warn('⚠️ renderWaveform: invalid dimensions', { width, height });
      return null;
    }

    // ✅ FIX: Clamp canvas dimensions to prevent issues with very small or very large canvases
    const MIN_CANVAS_WIDTH = 1;
    const MAX_CANVAS_WIDTH = 32767; // Max canvas dimension in most browsers
    const MIN_CANVAS_HEIGHT = 1;
    const MAX_CANVAS_HEIGHT = 32767;

    const clampedWidth = Math.max(MIN_CANVAS_WIDTH, Math.min(MAX_CANVAS_WIDTH, Math.floor(width)));
    const clampedHeight = Math.max(MIN_CANVAS_HEIGHT, Math.min(MAX_CANVAS_HEIGHT, Math.floor(height)));

    // ✅ FIX: Only warn if clamping changed value significantly (not just rounding)
    const widthDiff = Math.abs(clampedWidth - width);
    const heightDiff = Math.abs(clampedHeight - height);

    if (widthDiff > 1 || heightDiff > 1) {
      console.warn('⚠️ renderWaveform: clamped dimensions', {
        original: { width, height },
        clamped: { width: clampedWidth, height: clampedHeight }
      });
    }

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = clampedWidth;
    canvas.height = clampedHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      console.error('❌ renderWaveform: failed to get canvas context');
      return null;
    }

    // Get audio data
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const sampleRate = audioBuffer.sampleRate;

    // Calculate visible portion based on clip offset and TIME SCALE
    const { sampleOffset = 0 } = clip;
    const startSample = Math.floor(sampleOffset * sampleRate);

    // ✅ CRITICAL FIX: Validate sample offset to prevent out-of-bounds access
    if (startSample < 0 || startSample >= channelData.length) {
      console.warn('⚠️ renderWaveform: invalid sample offset', {
        sampleOffset,
        startSample,
        channelLength: channelData.length
      });
      return null;
    }

    // ✅ FIX: Calculate audio duration from PIXEL WIDTH and TIME SCALE (not clip.duration)
    // This ensures waveform represents actual time, not stretched to fit clip
    const secondsPerBeat = 60 / bpm;
    const totalPixelsPerBeat = pixelsPerBeat * zoomX;
    const secondsPerPixel = secondsPerBeat / totalPixelsPerBeat;
    const clipDurationSeconds = clampedWidth * secondsPerPixel; // Use clamped width

    // ✅ FIX: Add safety checks for calculation results
    if (!isFinite(secondsPerPixel) || secondsPerPixel <= 0) {
      console.warn('⚠️ renderWaveform: invalid time scale calculation', {
        bpm,
        pixelsPerBeat,
        zoomX,
        secondsPerPixel
      });
      return null;
    }

    const samplesNeeded = Math.floor(clipDurationSeconds * sampleRate);
    const endSample = Math.min(startSample + samplesNeeded, channelData.length);

    // ✅ FIX: Ensure we have samples to render
    if (endSample <= startSample) {
      console.warn('⚠️ renderWaveform: no samples to render', {
        startSample,
        endSample,
        channelLength: channelData.length
      });
      return null;
    }

    // ✅ REMOVED: Too verbose for normal operation
    // Only log in debug mode if needed

    // ✅ CRITICAL FIX: Calculate samples per pixel based on TIME SCALE, not clip width!
    // Each pixel represents a fixed amount of time (secondsPerPixel)
    // So samplesPerPixel = secondsPerPixel * sampleRate
    const baseSamplesPerPixel = secondsPerPixel * sampleRate;

    // ✅ FIX: Validate base samples per pixel
    if (!isFinite(baseSamplesPerPixel) || baseSamplesPerPixel <= 0) {
      console.warn('⚠️ renderWaveform: invalid baseSamplesPerPixel', {
        baseSamplesPerPixel,
        secondsPerPixel,
        sampleRate
      });
      return null;
    }

    // Apply LOD multiplier (more detail when zoomed in)
    let samplesPerPixel;
    switch (lod) {
      case 0: // Low detail - more samples per pixel (zoomed out)
        samplesPerPixel = Math.max(1, Math.floor(baseSamplesPerPixel * 2));
        break;
      case 1: // Medium detail
        samplesPerPixel = Math.max(1, Math.floor(baseSamplesPerPixel));
        break;
      case 2: // High detail - fewer samples per pixel (zoomed in)
      default:
        samplesPerPixel = Math.max(1, Math.floor(baseSamplesPerPixel * 0.5));
        break;
    }

    // ✅ REMOVED: Too verbose for normal operation

    // Draw waveform
    ctx.fillStyle = styles.waveformColor || 'rgba(167, 139, 250, 0.9)';
    ctx.strokeStyle = styles.waveformColor || 'rgba(167, 139, 250, 0.9)';
    ctx.lineWidth = 1;

    const centerY = clampedHeight / 2;
    const amplitudeScale = clampedHeight * 0.4; // Use 80% of height

    ctx.beginPath();

    // ✅ FIX: Use clamped width for loop
    for (let x = 0; x < clampedWidth; x++) {
      const sampleIndex = startSample + Math.floor(x * samplesPerPixel);

      // ✅ FIX: Add bounds checking for sample index
      if (sampleIndex >= endSample || sampleIndex < 0 || sampleIndex >= channelData.length) {
        break;
      }

      // Find min/max in this pixel's sample range
      let min = 1;
      let max = -1;

      for (let s = 0; s < samplesPerPixel && sampleIndex + s < endSample; s++) {
        // ✅ FIX: Additional bounds check inside inner loop
        if (sampleIndex + s < channelData.length) {
          const sample = channelData[sampleIndex + s] || 0;
          if (sample < min) min = sample;
          if (sample > max) max = sample;
        }
      }

      // ✅ FIX: Skip drawing if no valid samples were found
      if (min > max) {
        continue;
      }

      // Draw vertical line from min to max
      const y1 = centerY - min * amplitudeScale;
      const y2 = centerY - max * amplitudeScale;

      // ✅ FIX: Validate y coordinates before drawing
      if (isFinite(y1) && isFinite(y2)) {
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
      }
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
