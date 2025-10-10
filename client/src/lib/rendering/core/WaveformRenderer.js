/**
 * WAVEFORM RENDERER (Base Class)
 *
 * Production-grade waveform rendering with:
 * - Error handling & graceful degradation
 * - 3-Tier LOD system
 * - Performance monitoring integration
 * - Render queue integration
 */

import { createLogger, NAMESPACES } from '@/lib/utils/DebugLogger';
import {
  calculateRMS,
  findMinMaxPeak,
  applyGain,
  applyFade,
  beatsToSeconds,
  calculateSamplesPerPixel,
  getBufferSlice,
  getDownsampleFactor,
  validateAudioBuffer
} from '../utils/AudioUtils';

const log = createLogger(NAMESPACES.RENDER);

const PIXELS_PER_BEAT = 32; // Match arrangement renderer constant

export class WaveformRenderer {
  constructor(options = {}) {
    // LOD thresholds (pixels)
    this.lodThresholds = {
      minimal: 50,    // Below this: solid color bar
      simple: 300,    // Below this: RMS downsampled
      full: Infinity  // Above 300: full detail min/max peaks
    };

    // Performance monitor (injected)
    this.performanceMonitor = options.performanceMonitor || null;

    // Render queue (injected)
    this.renderQueue = options.renderQueue || null;

    // Stereo/multi-channel options
    this.stereoMode = options.stereoMode || 'merged'; // 'merged' | 'split' | 'left' | 'right'
    this.stereoChannelHeight = options.stereoChannelHeight || 0.45; // % of total height per channel

    log.info('WaveformRenderer initialized', {
      lodThresholds: this.lodThresholds,
      stereoMode: this.stereoMode
    });
  }

  /**
   * Main render entry point with error handling
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {AudioBuffer} audioBuffer - Web Audio API buffer
   * @param {Object} clip - Clip data
   * @param {Object} dimensions - {x, y, width, height}
   * @param {Object} viewport - Viewport state
   * @returns {boolean} - Success/failure
   */
  render(ctx, audioBuffer, clip, dimensions, viewport) {
    const startTime = performance.now();

    try {
      // Validate inputs
      this.validateInputs(ctx, audioBuffer, clip, dimensions);

      // Calculate LOD level
      const lod = this.calculateLOD(dimensions.width);

      // Render based on LOD
      let success = false;
      switch (lod) {
        case 'minimal':
          success = this.renderMinimal(ctx, clip, dimensions);
          break;
        case 'simple':
          success = this.renderSimple(ctx, audioBuffer, clip, dimensions, viewport);
          break;
        case 'full':
          success = this.renderFull(ctx, audioBuffer, clip, dimensions, viewport);
          break;
        default:
          throw new Error(`Unknown LOD level: ${lod}`);
      }

      // Record performance
      const renderTime = performance.now() - startTime;
      if (this.performanceMonitor) {
        this.performanceMonitor.recordClipRender(clip.id, renderTime);
      }

      log.debug(`Rendered clip ${clip.id}`, {
        lod,
        renderTime: renderTime.toFixed(2) + 'ms',
        width: dimensions.width
      });

      return success;

    } catch (error) {
      // Graceful degradation: Show error placeholder
      log.error('Render failed, showing placeholder', error);
      return this.renderPlaceholder(ctx, clip, dimensions, {
        error: true,
        message: error.message
      });
    }
  }

  /**
   * Validate render inputs
   */
  validateInputs(ctx, audioBuffer, clip, dimensions) {
    if (!ctx) {
      throw new Error('Canvas context is required');
    }

    if (!clip || !clip.id) {
      throw new Error('Valid clip with id is required');
    }

    if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
      throw new Error('Valid dimensions are required');
    }

    // audioBuffer can be null for minimal LOD
  }

  /**
   * Calculate LOD level based on clip width
   */
  calculateLOD(clipWidth) {
    if (clipWidth < this.lodThresholds.minimal) {
      return 'minimal';
    }

    if (clipWidth < this.lodThresholds.simple) {
      return 'simple';
    }

    return 'full';
  }

  /**
   * Determine channel configuration for rendering
   * @param {AudioBuffer} audioBuffer
   * @returns {Array<number>} - Channel indices to render
   */
  getChannelsToRender(audioBuffer) {
    if (!audioBuffer) return [0];

    const numChannels = audioBuffer.numberOfChannels;

    switch (this.stereoMode) {
      case 'left':
        return [0];
      case 'right':
        return numChannels > 1 ? [1] : [0];
      case 'split':
        return numChannels > 1 ? [0, 1] : [0];
      case 'merged':
      default:
        // Render all channels merged
        return Array.from({ length: numChannels }, (_, i) => i);
    }
  }

  /**
   * Get merged channel data (average of all channels)
   * @param {AudioBuffer} audioBuffer
   * @returns {Float32Array} - Merged channel data
   */
  getMergedChannelData(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    if (numChannels === 1) {
      return audioBuffer.getChannelData(0);
    }

    // Average all channels
    const length = audioBuffer.length;
    const merged = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        sum += audioBuffer.getChannelData(ch)[i];
      }
      merged[i] = sum / numChannels;
    }

    return merged;
  }

  /**
   * Render minimal LOD (solid gradient bar, no waveform calculation)
   * Used for extreme zoom out (<50px width)
   */
  renderMinimal(ctx, clip, dimensions) {
    const { x, y, width, height } = dimensions;

    // Create gradient simulating waveform presence
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);

    // Center line for reference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + height / 2);
    ctx.lineTo(x + width, y + height / 2);
    ctx.stroke();

    return true;
  }

  /**
   * Render simple LOD (RMS downsampled)
   * Used for medium zoom (50-300px width)
   */
  renderSimple(ctx, audioBuffer, clip, dimensions, viewport) {
    // Validate audio buffer
    const validation = validateAudioBuffer(audioBuffer);
    if (!validation.valid) {
      log.warn('Invalid audio buffer for simple render:', validation.error);
      return this.renderPlaceholder(ctx, clip, dimensions, { error: true, message: validation.error });
    }

    const { x, y, width, height } = dimensions;
    const bpm = viewport?.bpm || 140;

    // Get audio data (merged if stereo/multi-channel)
    const channelData = this.stereoMode === 'merged' || audioBuffer.numberOfChannels === 1
      ? this.getMergedChannelData(audioBuffer)
      : audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Clip properties
    const gainDb = clip.gain || 0;
    const fadeIn = clip.fadeIn || 0;
    const fadeOut = clip.fadeOut || 0;
    const clipDuration = clip.duration;
    const sampleOffset = clip.sampleOffset || 0;
    const playbackRate = clip.playbackRate || 1.0;

    // Calculate rendering parameters
    const clipDurationSeconds = beatsToSeconds(clipDuration, bpm);
    const offsetSeconds = beatsToSeconds(sampleOffset, bpm);
    const { startSample } = getBufferSlice(audioBuffer, offsetSeconds, clipDurationSeconds);

    const downsampleFactor = getDownsampleFactor('simple'); // 4
    const samplesPerPixel = calculateSamplesPerPixel(audioBuffer, clipDurationSeconds, width, playbackRate);
    const rmsWindowSize = Math.max(512, Math.floor(samplesPerPixel));

    // Draw RMS-based waveform
    ctx.save();
    ctx.beginPath();

    const waveformY = y + height / 2;

    // Top half (positive RMS)
    let firstPoint = true;
    for (let i = 0; i < width; i += downsampleFactor) {
      const sampleIndex = startSample + Math.floor(i * samplesPerPixel);
      const rms = calculateRMS(channelData, sampleIndex, rmsWindowSize);

      // Apply gain
      let amplitude = applyGain(rms, gainDb);

      // Apply fade envelope
      const position = i / width;
      const fadeInNorm = fadeIn / clipDuration;
      const fadeOutNorm = fadeOut / clipDuration;
      amplitude = applyFade(amplitude, position, fadeInNorm, fadeOutNorm);

      const amplitudeY = waveformY - (amplitude * height / 2);

      if (firstPoint) {
        ctx.moveTo(x + i, amplitudeY);
        firstPoint = false;
      } else {
        ctx.lineTo(x + i, amplitudeY);
      }
    }

    // Bottom half (mirror)
    for (let i = Math.floor((width - 1) / downsampleFactor) * downsampleFactor; i >= 0; i -= downsampleFactor) {
      const sampleIndex = startSample + Math.floor(i * samplesPerPixel);
      const rms = calculateRMS(channelData, sampleIndex, rmsWindowSize);

      let amplitude = applyGain(rms, gainDb);
      const position = i / width;
      const fadeInNorm = fadeIn / clipDuration;
      const fadeOutNorm = fadeOut / clipDuration;
      amplitude = applyFade(amplitude, position, fadeInNorm, fadeOutNorm);

      const amplitudeY = waveformY + (amplitude * height / 2);
      ctx.lineTo(x + i, amplitudeY);
    }

    ctx.closePath();

    // Fill with gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, waveformY);
    ctx.lineTo(x + width, waveformY);
    ctx.stroke();

    ctx.restore();
    return true;
  }

  /**
   * Render full LOD (min/max peaks)
   * Used for close zoom (>300px width)
   */
  renderFull(ctx, audioBuffer, clip, dimensions, viewport) {
    // Validate audio buffer
    const validation = validateAudioBuffer(audioBuffer);
    if (!validation.valid) {
      log.warn('Invalid audio buffer for full render:', validation.error);
      return this.renderPlaceholder(ctx, clip, dimensions, { error: true, message: validation.error });
    }

    const { x, y, width, height } = dimensions;
    const bpm = viewport?.bpm || 140;

    // Get audio data (merged if stereo/multi-channel)
    const channelData = this.stereoMode === 'merged' || audioBuffer.numberOfChannels === 1
      ? this.getMergedChannelData(audioBuffer)
      : audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Clip properties
    const gainDb = clip.gain || 0;
    const fadeIn = clip.fadeIn || 0;
    const fadeOut = clip.fadeOut || 0;
    const clipDuration = clip.duration;
    const sampleOffset = clip.sampleOffset || 0;
    const playbackRate = clip.playbackRate || 1.0;

    // Calculate rendering parameters
    const clipDurationSeconds = beatsToSeconds(clipDuration, bpm);
    const offsetSeconds = beatsToSeconds(sampleOffset, bpm);
    const { startSample } = getBufferSlice(audioBuffer, offsetSeconds, clipDurationSeconds);

    const samplesPerPixel = calculateSamplesPerPixel(audioBuffer, clipDurationSeconds, width, playbackRate);

    // Draw min/max peak waveform
    ctx.save();
    ctx.beginPath();

    const waveformY = y + height / 2;

    // Top half (max peaks)
    for (let i = 0; i < width; i++) {
      const sampleIndex = startSample + Math.floor(i * samplesPerPixel);
      const { min, max } = findMinMaxPeak(channelData, sampleIndex, samplesPerPixel);

      // Apply gain
      let maxVal = applyGain(max, gainDb);

      // Apply fade envelope
      const position = i / width;
      const fadeInNorm = fadeIn / clipDuration;
      const fadeOutNorm = fadeOut / clipDuration;
      maxVal = applyFade(maxVal, position, fadeInNorm, fadeOutNorm);

      const maxY = waveformY - (maxVal * height / 2);

      if (i === 0) {
        ctx.moveTo(x + i, maxY);
      } else {
        ctx.lineTo(x + i, maxY);
      }
    }

    // Bottom half (min peaks, reverse)
    for (let i = width - 1; i >= 0; i--) {
      const sampleIndex = startSample + Math.floor(i * samplesPerPixel);
      const { min, max } = findMinMaxPeak(channelData, sampleIndex, samplesPerPixel);

      let minVal = applyGain(min, gainDb);
      const position = i / width;
      const fadeInNorm = fadeIn / clipDuration;
      const fadeOutNorm = fadeOut / clipDuration;
      minVal = applyFade(minVal, position, fadeInNorm, fadeOutNorm);

      const minY = waveformY - (minVal * height / 2);
      ctx.lineTo(x + i, minY);
    }

    ctx.closePath();

    // Fill with gradient
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, waveformY);
    ctx.lineTo(x + width, waveformY);
    ctx.stroke();

    ctx.restore();
    return true;
  }

  /**
   * Render placeholder (loading or error state)
   */
  renderPlaceholder(ctx, clip, dimensions, options = {}) {
    const { x, y, width, height } = dimensions;

    // Always succeed - show SOMETHING
    try {
      if (options.error) {
        // Error state - red warning
        ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
        ctx.fillRect(x, y, width, height);

        ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);

        // Error icon and message
        if (width > 80 && height > 30) {
          ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
          ctx.font = '12px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚠️ Render Error', x + width / 2, y + height / 2);

          if (options.message && height > 50) {
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillStyle = 'rgba(255, 100, 100, 0.7)';
            ctx.fillText(options.message, x + width / 2, y + height / 2 + 15);
          }
        }
      } else {
        // Loading state - subtle gray
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, y, width, height);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        // Loading text
        if (width > 60 && height > 20) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.font = '11px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Loading...', x + width / 2, y + height / 2);
        }
      }

      return true;
    } catch (error) {
      // Even placeholder failed - just draw a red box
      log.error('Placeholder render failed', error);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fillRect(x, y, width, height);
      return false;
    }
  }

  /**
   * Dispose renderer
   */
  dispose() {
    this.performanceMonitor = null;
    this.renderQueue = null;
    log.info('WaveformRenderer disposed');
  }
}
