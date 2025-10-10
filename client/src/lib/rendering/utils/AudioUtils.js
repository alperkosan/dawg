/**
 * AUDIO UTILITIES
 *
 * Core audio processing utilities for waveform rendering:
 * - RMS (Root Mean Square) calculation
 * - Min/Max peak detection
 * - Sample rate conversions
 * - Downsampling strategies
 */

/**
 * Calculate RMS (Root Mean Square) for a window of samples
 * RMS provides a better visual representation at low resolution than min/max
 *
 * @param {Float32Array} channelData - Audio sample data
 * @param {number} startSample - Start sample index
 * @param {number} windowSize - Number of samples to analyze
 * @returns {number} - RMS value (0.0 - 1.0)
 */
export function calculateRMS(channelData, startSample, windowSize) {
  if (!channelData || channelData.length === 0) {
    return 0;
  }

  let sum = 0;
  const endSample = Math.min(startSample + windowSize, channelData.length);
  const actualWindowSize = endSample - startSample;

  if (actualWindowSize <= 0) {
    return 0;
  }

  // Sum of squares
  for (let i = startSample; i < endSample; i++) {
    const sample = channelData[i];
    sum += sample * sample;
  }

  // Square root of mean
  return Math.sqrt(sum / actualWindowSize);
}

/**
 * Find min/max peaks in a window of samples
 * Best for high-resolution waveform display
 *
 * @param {Float32Array} channelData - Audio sample data
 * @param {number} startSample - Start sample index
 * @param {number} samplesPerPixel - Number of samples per pixel
 * @returns {{min: number, max: number}} - Peak values (-1.0 to 1.0)
 */
export function findMinMaxPeak(channelData, startSample, samplesPerPixel) {
  if (!channelData || channelData.length === 0) {
    return { min: 0, max: 0 };
  }

  let min = 1.0;
  let max = -1.0;
  const endSample = Math.min(
    Math.floor(startSample + samplesPerPixel),
    channelData.length
  );

  if (endSample <= startSample) {
    return { min: 0, max: 0 };
  }

  // Find min and max in range
  for (let i = startSample; i < endSample; i++) {
    const sample = channelData[i];
    if (sample < min) min = sample;
    if (sample > max) max = sample;
  }

  return { min, max };
}

/**
 * Apply gain to amplitude value
 * @param {number} amplitude - Input amplitude
 * @param {number} gainDb - Gain in decibels
 * @returns {number} - Scaled amplitude
 */
export function applyGain(amplitude, gainDb) {
  if (gainDb === 0) return amplitude;
  const gainLinear = Math.pow(10, gainDb / 20);
  return amplitude * gainLinear;
}

/**
 * Apply fade envelope to amplitude
 * @param {number} amplitude - Input amplitude
 * @param {number} position - Current position (0.0 - 1.0)
 * @param {number} fadeInDuration - Fade in duration (0.0 - 1.0)
 * @param {number} fadeOutDuration - Fade out duration (0.0 - 1.0)
 * @returns {number} - Faded amplitude
 */
export function applyFade(amplitude, position, fadeInDuration, fadeOutDuration) {
  let fadeMultiplier = 1.0;

  // Fade in
  if (position < fadeInDuration && fadeInDuration > 0) {
    fadeMultiplier = position / fadeInDuration;
  }
  // Fade out
  else if (position > (1.0 - fadeOutDuration) && fadeOutDuration > 0) {
    fadeMultiplier = (1.0 - position) / fadeOutDuration;
  }

  return amplitude * fadeMultiplier;
}

/**
 * Convert beats to seconds
 * @param {number} beats - Time in beats
 * @param {number} bpm - Beats per minute
 * @returns {number} - Time in seconds
 */
export function beatsToSeconds(beats, bpm) {
  return (beats * 60) / bpm;
}

/**
 * Convert seconds to beats
 * @param {number} seconds - Time in seconds
 * @param {number} bpm - Beats per minute
 * @returns {number} - Time in beats
 */
export function secondsToBeats(seconds, bpm) {
  return (seconds * bpm) / 60;
}

/**
 * Calculate samples per pixel for rendering
 * @param {AudioBuffer} audioBuffer - Web Audio API buffer
 * @param {number} clipDuration - Clip duration in seconds
 * @param {number} clipWidth - Clip width in pixels
 * @param {number} playbackRate - Playback rate (time stretch)
 * @returns {number} - Samples per pixel
 */
export function calculateSamplesPerPixel(audioBuffer, clipDuration, clipWidth, playbackRate = 1.0) {
  if (!audioBuffer || clipWidth <= 0) {
    return 1;
  }

  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = Math.floor((clipDuration * sampleRate) / playbackRate);
  const samplesPerPixel = Math.max(1, totalSamples / clipWidth);

  return samplesPerPixel;
}

/**
 * Get audio buffer slice based on clip offset and duration
 * @param {AudioBuffer} audioBuffer - Full audio buffer
 * @param {number} offsetSeconds - Start offset in seconds
 * @param {number} durationSeconds - Duration to extract in seconds
 * @returns {{startSample: number, endSample: number, sampleCount: number}}
 */
export function getBufferSlice(audioBuffer, offsetSeconds, durationSeconds) {
  if (!audioBuffer) {
    return { startSample: 0, endSample: 0, sampleCount: 0 };
  }

  const sampleRate = audioBuffer.sampleRate;
  const startSample = Math.floor(offsetSeconds * sampleRate);
  const endSample = Math.min(
    Math.floor((offsetSeconds + durationSeconds) * sampleRate),
    audioBuffer.length
  );
  const sampleCount = Math.max(0, endSample - startSample);

  return { startSample, endSample, sampleCount };
}

/**
 * Downsample factor based on LOD
 * @param {string} lod - LOD level ('minimal' | 'simple' | 'full')
 * @returns {number} - Downsample factor (1 = no downsampling)
 */
export function getDownsampleFactor(lod) {
  switch (lod) {
    case 'minimal':
      return 1; // Not used (solid bar rendering)
    case 'simple':
      return 4; // Process every 4th pixel
    case 'full':
      return 1; // Process every pixel
    default:
      return 1;
  }
}

/**
 * Validate audio buffer
 * @param {AudioBuffer} audioBuffer - Buffer to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateAudioBuffer(audioBuffer) {
  if (!audioBuffer) {
    return { valid: false, error: 'AudioBuffer is null or undefined' };
  }

  if (audioBuffer.length === 0) {
    return { valid: false, error: 'AudioBuffer is empty' };
  }

  if (audioBuffer.numberOfChannels === 0) {
    return { valid: false, error: 'AudioBuffer has no channels' };
  }

  if (audioBuffer.sampleRate <= 0) {
    return { valid: false, error: 'Invalid sample rate' };
  }

  return { valid: true, error: null };
}

/**
 * Clamp value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
