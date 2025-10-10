/**
 * SMART WAVEFORM CACHE (v2.0)
 *
 * Production-grade caching layer for WaveformRenderer with:
 * - Width tolerance (+/- 10px reuse)
 * - Debounced cache updates (150ms)
 * - Nearby cache lookup for smooth zoom
 * - Idle-time warm-up
 * - LRU eviction
 * - Performance tracking
 *
 * Solves cache thrashing during zoom animations.
 */

import { createLogger, NAMESPACES } from '@/lib/utils/DebugLogger';
import { WaveformRenderer } from '../core/WaveformRenderer';

const log = createLogger(NAMESPACES.PERFORMANCE);

// Width tolerance for cache reuse (prevents thrashing)
const WIDTH_TOLERANCE = 10; // px

// Debounce delay for cache updates during zoom
const CACHE_UPDATE_DEBOUNCE = 150; // ms

// Idle time before warm-up starts
const IDLE_TIME_THRESHOLD = 500; // ms

export class SmartWaveformCache {
  constructor(options = {}) {
    // Map: clipId -> { canvases: [{ width, height, canvas, cacheKey, lod, timestamp }] }
    this.cache = new Map();

    // Debounce timers: clipId -> timeoutId
    this.debounceTimers = new Map();

    // Performance tracking
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.nearbyCacheHits = 0;
    this.totalRenderTime = 0;
    this.totalBlitTime = 0;

    // Memory limits
    this.maxCacheSize = options.maxCacheSize || 100; // Max clips cached
    this.maxVersionsPerClip = options.maxVersionsPerClip || 3; // Max width versions
    this.accessOrder = []; // LRU tracking

    // Renderer instance (injected or created)
    this.renderer = options.renderer || new WaveformRenderer({
      performanceMonitor: options.performanceMonitor,
      renderQueue: options.renderQueue
    });

    // Idle warm-up state
    this.idleTimer = null;
    this.warmUpQueue = [];
    this.isWarmingUp = false;

    // Zoom state tracking
    this.isZooming = false;
    this.zoomSettleTimer = null;
    this.zoomSettleDelay = 300; // ms - wait for zoom to finish
    this.lastZoomLevel = null;

    log.info('SmartWaveformCache initialized', {
      widthTolerance: WIDTH_TOLERANCE,
      debounceMs: CACHE_UPDATE_DEBOUNCE,
      maxCacheSize: this.maxCacheSize,
      zoomSettleDelay: this.zoomSettleDelay
    });
  }

  /**
   * Generate cache key from clip properties that affect waveform rendering
   */
  getCacheKey(clip, width, height, bpm, lod) {
    const {
      assetId,
      sampleId,
      duration,
      fadeIn = 0,
      fadeOut = 0,
      gain = 0,
      sampleOffset = 0,
      playbackRate = 1.0
    } = clip;

    // Round to avoid float precision issues
    const w = Math.round(width);
    const h = Math.round(height);
    const dur = duration.toFixed(2);
    const fadeInR = fadeIn.toFixed(2);
    const fadeOutR = fadeOut.toFixed(2);
    const gainR = gain.toFixed(1);
    const offsetR = sampleOffset.toFixed(2);
    const rateR = playbackRate.toFixed(2);

    return `${assetId || sampleId}_${w}x${h}_${dur}_${fadeInR}_${fadeOutR}_${gainR}_${offsetR}_${rateR}_${bpm}_lod${lod}`;
  }

  /**
   * Find cached waveform with width tolerance
   * First tries exact match, then nearby match within tolerance
   */
  get(clipId, clip, width, height, bpm, viewport) {
    const lod = this.renderer.calculateLOD(width);
    const cacheKey = this.getCacheKey(clip, width, height, bpm, lod);
    const cached = this.cache.get(clipId);

    if (!cached || !cached.canvases || cached.canvases.length === 0) {
      this.cacheMisses++;
      return null;
    }

    // Try exact match first
    const exactMatch = cached.canvases.find(c => c.cacheKey === cacheKey);
    if (exactMatch) {
      this.updateAccessOrder(clipId);
      this.cacheHits++;
      return {
        canvas: exactMatch.canvas,
        exact: true,
        lod: exactMatch.lod
      };
    }

    // Try nearby match with width tolerance (same height, LOD, and clip properties)
    const nearbyMatch = this.findNearbyCache(cached.canvases, width, height, lod, clip, bpm);
    if (nearbyMatch) {
      this.updateAccessOrder(clipId);
      this.nearbyCacheHits++;
      log.debug(`Nearby cache hit for clip ${clipId}`, {
        requested: width,
        found: nearbyMatch.width,
        diff: Math.abs(width - nearbyMatch.width)
      });
      return {
        canvas: nearbyMatch.canvas,
        exact: false,
        lod: nearbyMatch.lod,
        widthDiff: Math.abs(width - nearbyMatch.width)
      };
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Find nearby cached waveform within width tolerance
   */
  findNearbyCache(canvases, targetWidth, targetHeight, targetLod, clip, bpm) {
    const roundedHeight = Math.round(targetHeight);

    // Filter candidates: same height, LOD, and clip properties (except width)
    const candidates = canvases.filter(c => {
      // Check if height and LOD match
      if (c.height !== roundedHeight || c.lod !== targetLod) return false;

      // Check if width is within tolerance
      const widthDiff = Math.abs(c.width - targetWidth);
      if (widthDiff > WIDTH_TOLERANCE) return false;

      // Check if other properties match (extract from cacheKey)
      const targetKeyWithoutWidth = this.getCacheKey(clip, 0, targetHeight, bpm, targetLod)
        .split('_')
        .slice(1) // Remove assetId_widthxheight
        .join('_');

      const cachedKeyWithoutWidth = c.cacheKey
        .split('_')
        .slice(1)
        .join('_');

      return targetKeyWithoutWidth === cachedKeyWithoutWidth;
    });

    // Return closest width match
    if (candidates.length === 0) return null;

    return candidates.reduce((closest, current) => {
      const closestDiff = Math.abs(closest.width - targetWidth);
      const currentDiff = Math.abs(current.width - targetWidth);
      return currentDiff < closestDiff ? current : closest;
    });
  }

  /**
   * Notify cache about zoom level change
   * Detects zoom and triggers settle timer
   */
  notifyZoomChange(zoomX) {
    const zoomChanged = this.lastZoomLevel !== null && Math.abs(zoomX - this.lastZoomLevel) > 0.01;

    if (zoomChanged) {
      this.isZooming = true;

      // Clear existing settle timer
      if (this.zoomSettleTimer) {
        clearTimeout(this.zoomSettleTimer);
      }

      // Set new settle timer
      this.zoomSettleTimer = setTimeout(() => {
        this.isZooming = false;
        log.debug('Zoom settled, resuming full quality rendering');
      }, this.zoomSettleDelay);
    }

    this.lastZoomLevel = zoomX;
  }

  /**
   * Render placeholder (fast) during zoom
   * Just draws a colored rectangle, no audio processing
   */
  renderPlaceholder(ctx, dimensions, clip) {
    const { x, y, width, height } = dimensions;

    // Simple gradient fill
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, 'rgba(150, 150, 150, 0.3)');
    gradient.addColorStop(0.5, 'rgba(180, 180, 180, 0.5)');
    gradient.addColorStop(1, 'rgba(150, 150, 150, 0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);

    // Center line
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + height / 2);
    ctx.lineTo(x + width, y + height / 2);
    ctx.stroke();

    return true;
  }

  /**
   * Render and cache waveform with debouncing and zoom awareness
   * During zoom: renders fast placeholder
   * After zoom: renders full quality
   */
  async renderAndCache(ctx, audioBuffer, clip, dimensions, viewport, immediate = false) {
    const clipId = clip.id;
    const { width, height } = dimensions;
    const bpm = viewport?.bpm || 140;
    const zoomX = viewport?.zoomX || 1.0;

    // Update zoom state (for debugging/stats only - not affecting rendering)
    this.notifyZoomChange(zoomX);

    // DISABLED: Placeholder rendering during zoom (caused waveform issues)
    // Instead, rely on CSS blur + debouncing for smooth zoom
    // if (this.isZooming && !immediate) { ... }

    // Normal rendering - Try to get cached version first
    const cached = this.get(clipId, clip, width, height, bpm, viewport);

    if (cached) {
      // Use cached version (exact or nearby)
      const blitStart = performance.now();
      ctx.drawImage(cached.canvas, dimensions.x, dimensions.y);
      const blitTime = performance.now() - blitStart;
      this.totalBlitTime += blitTime;

      // If not exact match, schedule debounced update for exact size
      if (!cached.exact && !immediate) {
        this.scheduleDebounced(clipId, () => {
          this.renderExact(audioBuffer, clip, width, height, bpm, viewport);
        });
      }

      return true;
    }

    // No cache available - render immediately
    return this.renderExact(audioBuffer, clip, width, height, bpm, viewport);
  }

  /**
   * Render exact waveform and store in cache
   */
  renderExact(audioBuffer, clip, width, height, bpm, viewport) {
    const clipId = clip.id;

    // Validate dimensions (OffscreenCanvas requires positive integers)
    const validWidth = Math.max(1, Math.round(width));
    const validHeight = Math.max(1, Math.round(height));

    if (!isFinite(validWidth) || !isFinite(validHeight) || validWidth <= 0 || validHeight <= 0) {
      log.warn(`Invalid dimensions for clip ${clipId}: ${width}x${height}`);
      return false;
    }

    const lod = this.renderer.calculateLOD(validWidth);

    // Create offscreen canvas
    let canvas, ctx;
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(validWidth, validHeight);
        ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
      } else {
        canvas = document.createElement('canvas');
        canvas.width = validWidth;
        canvas.height = validHeight;
        ctx = canvas.getContext('2d', { alpha: true });
      }
    } catch (error) {
      log.error(`Failed to create canvas for clip ${clipId}:`, error, { width: validWidth, height: validHeight });
      return false;
    }

    // Render using WaveformRenderer
    const renderStart = performance.now();
    const dimensions = { x: 0, y: 0, width: validWidth, height: validHeight };
    const success = this.renderer.render(ctx, audioBuffer, clip, dimensions, viewport);
    const renderTime = performance.now() - renderStart;

    if (!success) {
      log.warn(`Failed to render waveform for clip ${clipId}`);
      return false;
    }

    this.totalRenderTime += renderTime;

    // Store in cache (use validated dimensions)
    this.set(clipId, clip, validWidth, validHeight, bpm, lod, canvas);

    log.debug(`Rendered and cached clip ${clipId}`, {
      width: validWidth,
      height: validHeight,
      lod,
      renderTime: renderTime.toFixed(2) + 'ms'
    });

    return true;
  }

  /**
   * Store rendered waveform in cache (with version management)
   */
  set(clipId, clip, width, height, bpm, lod, canvas) {
    const cacheKey = this.getCacheKey(clip, width, height, bpm, lod);

    // Get or create cache entry for this clip
    if (!this.cache.has(clipId)) {
      // Enforce global cache size limit (LRU eviction)
      if (this.cache.size >= this.maxCacheSize) {
        const oldestClipId = this.accessOrder.shift();
        this.cache.delete(oldestClipId);
        log.debug(`Evicted oldest clip from cache: ${oldestClipId}`);
      }

      this.cache.set(clipId, { canvases: [] });
    }

    const cached = this.cache.get(clipId);

    // Check if this exact version already exists
    const existingIndex = cached.canvases.findIndex(c => c.cacheKey === cacheKey);
    if (existingIndex >= 0) {
      // Update existing
      cached.canvases[existingIndex] = {
        width: Math.round(width),
        height: Math.round(height),
        canvas,
        cacheKey,
        lod,
        timestamp: Date.now()
      };
    } else {
      // Add new version
      cached.canvases.push({
        width: Math.round(width),
        height: Math.round(height),
        canvas,
        cacheKey,
        lod,
        timestamp: Date.now()
      });

      // Enforce per-clip version limit (evict oldest)
      if (cached.canvases.length > this.maxVersionsPerClip) {
        cached.canvases.sort((a, b) => b.timestamp - a.timestamp);
        cached.canvases.length = this.maxVersionsPerClip;
      }
    }

    this.updateAccessOrder(clipId);
  }

  /**
   * Schedule debounced function execution
   */
  scheduleDebounced(clipId, fn) {
    // Clear existing timer
    if (this.debounceTimers.has(clipId)) {
      clearTimeout(this.debounceTimers.get(clipId));
    }

    // Schedule new timer
    const timerId = setTimeout(() => {
      fn();
      this.debounceTimers.delete(clipId);
    }, CACHE_UPDATE_DEBOUNCE);

    this.debounceTimers.set(clipId, timerId);
  }

  /**
   * Update LRU access order
   */
  updateAccessOrder(clipId) {
    // Remove if exists
    const index = this.accessOrder.indexOf(clipId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    // Add to end (most recent)
    this.accessOrder.push(clipId);
  }

  /**
   * Schedule idle-time cache warm-up
   * Pre-renders visible clips at multiple zoom levels
   */
  scheduleWarmUp(visibleClips, audioBuffers, viewport) {
    // Clear existing idle timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      if (this.isWarmingUp) return;

      this.warmUpQueue = visibleClips.map(clip => ({
        clip,
        audioBuffer: audioBuffers.get(clip.assetId || clip.sampleId),
        viewport
      }));

      this.processWarmUpQueue();
    }, IDLE_TIME_THRESHOLD);
  }

  /**
   * Process warm-up queue (one clip at a time)
   */
  async processWarmUpQueue() {
    if (this.warmUpQueue.length === 0) {
      this.isWarmingUp = false;
      return;
    }

    this.isWarmingUp = true;

    const { clip, audioBuffer, viewport } = this.warmUpQueue.shift();

    if (!audioBuffer) {
      // Skip if audio not loaded
      return this.processWarmUpQueue();
    }

    // Render at common zoom levels (estimate width from duration)
    const widths = [100, 200, 400, 800];
    const height = 60; // Standard clip height

    for (const width of widths) {
      // Check if already cached
      const cached = this.get(clip.id, clip, width, height, viewport.bpm, viewport);
      if (cached?.exact) continue; // Skip if exact match exists

      // Render and cache
      await this.renderExact(audioBuffer, clip, width, height, viewport.bpm, viewport);

      // Yield to main thread
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Process next clip
    this.processWarmUpQueue();
  }

  /**
   * Cancel all pending operations
   */
  cancelPending() {
    // Clear debounce timers
    for (const timerId of this.debounceTimers.values()) {
      clearTimeout(timerId);
    }
    this.debounceTimers.clear();

    // Clear idle timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    // Clear warm-up queue
    this.warmUpQueue = [];
    this.isWarmingUp = false;
  }

  /**
   * Invalidate specific clip cache
   */
  invalidate(clipId) {
    if (this.cache.has(clipId)) {
      this.cache.delete(clipId);
      const index = this.accessOrder.indexOf(clipId);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }

      // Cancel pending operations for this clip
      if (this.debounceTimers.has(clipId)) {
        clearTimeout(this.debounceTimers.get(clipId));
        this.debounceTimers.delete(clipId);
      }

      log.debug(`Invalidated waveform cache for clip ${clipId}`);
    }
  }

  /**
   * Clear all cached waveforms
   */
  clear() {
    this.cancelPending();
    this.cache.clear();
    this.accessOrder = [];
    log.info('Cleared all waveform caches');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.cacheHits + this.nearbyCacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0
      ? ((this.cacheHits + this.nearbyCacheHits) / totalRequests) * 100
      : 0;
    const exactHitRate = totalRequests > 0
      ? (this.cacheHits / totalRequests) * 100
      : 0;

    // Calculate total cached versions
    let totalVersions = 0;
    for (const cached of this.cache.values()) {
      totalVersions += cached.canvases?.length || 0;
    }

    return {
      clips: this.cache.size,
      versions: totalVersions,
      exactHits: this.cacheHits,
      nearbyHits: this.nearbyCacheHits,
      misses: this.cacheMisses,
      hitRate: hitRate.toFixed(1) + '%',
      exactHitRate: exactHitRate.toFixed(1) + '%',
      avgRenderTime: this.cacheMisses > 0
        ? (this.totalRenderTime / this.cacheMisses).toFixed(2) + 'ms'
        : '0ms',
      avgBlitTime: (this.cacheHits + this.nearbyCacheHits) > 0
        ? (this.totalBlitTime / (this.cacheHits + this.nearbyCacheHits)).toFixed(2) + 'ms'
        : '0ms',
      speedup: this.cacheMisses > 0 && (this.cacheHits + this.nearbyCacheHits) > 0
        ? ((this.totalRenderTime / this.cacheMisses) /
           (this.totalBlitTime / (this.cacheHits + this.nearbyCacheHits))).toFixed(1) + 'x'
        : 'N/A'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.nearbyCacheHits = 0;
    this.totalRenderTime = 0;
    this.totalBlitTime = 0;
    log.debug('SmartWaveformCache stats reset');
  }

  /**
   * Log statistics
   */
  logStats() {
    const stats = this.getStats();
    log.info('SmartWaveformCache Stats:', stats);
    console.table(stats);
  }

  /**
   * Dispose cache and free memory
   */
  dispose() {
    this.cancelPending();
    this.clear();
    if (this.renderer) {
      this.renderer.dispose();
    }
    log.info('SmartWaveformCache disposed');
  }
}

// Global singleton
let smartWaveformCache = null;

export function getSmartWaveformCache(options = {}) {
  if (!smartWaveformCache) {
    smartWaveformCache = new SmartWaveformCache(options);
    if (typeof window !== 'undefined') {
      window.__smartWaveformCache = smartWaveformCache;
    }
  }
  return smartWaveformCache;
}

// Global debug access
if (typeof window !== 'undefined') {
  window.SmartWaveformCacheStats = () => {
    if (window.__smartWaveformCache) {
      window.__smartWaveformCache.logStats();
    } else {
      console.log('No SmartWaveformCache instance found');
    }
  };

  window.SmartWaveformCacheReset = () => {
    if (window.__smartWaveformCache) {
      window.__smartWaveformCache.resetStats();
      console.log('SmartWaveformCache stats reset');
    }
  };

  window.SmartWaveformCacheClear = () => {
    if (window.__smartWaveformCache) {
      window.__smartWaveformCache.clear();
      console.log('SmartWaveformCache cleared');
    }
  };
}
