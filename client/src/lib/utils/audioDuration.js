/**
 * AUDIO DURATION UTILITIES
 *
 * Centralized utilities for converting between time formats in the DAW:
 * - Seconds (AudioBuffer duration)
 * - Beats (arrangement timeline)
 * - Bars (musical structure)
 */

/**
 * Convert seconds to beats based on BPM
 * @param {number} seconds - Duration in seconds
 * @param {number} bpm - Beats per minute
 * @returns {number} Duration in beats
 */
export function secondsToBeats(seconds, bpm) {
  const secondsPerBeat = 60 / bpm;
  return seconds / secondsPerBeat;
}

/**
 * Convert beats to seconds based on BPM
 * @param {number} beats - Duration in beats
 * @param {number} bpm - Beats per minute
 * @returns {number} Duration in seconds
 */
export function beatsToSeconds(beats, bpm) {
  const secondsPerBeat = 60 / bpm;
  return beats * secondsPerBeat;
}

/**
 * Convert bars to beats (assuming 4/4 time signature)
 * @param {number} bars - Number of bars
 * @param {number} beatsPerBar - Beats per bar (default: 4 for 4/4 time)
 * @returns {number} Duration in beats
 */
export function barsToBeats(bars, beatsPerBar = 4) {
  return bars * beatsPerBar;
}

/**
 * Convert beats to bars (assuming 4/4 time signature)
 * @param {number} beats - Duration in beats
 * @param {number} beatsPerBar - Beats per bar (default: 4 for 4/4 time)
 * @returns {number} Number of bars
 */
export function beatsToBars(beats, beatsPerBar = 4) {
  return beats / beatsPerBar;
}

/**
 * Get audio clip duration in beats
 * Handles both frozen samples (with pre-calculated duration) and regular audio
 *
 * @param {AudioBuffer} buffer - Audio buffer
 * @param {object} metadata - Asset metadata (may contain durationBeats for frozen samples)
 * @param {number} bpm - Current project BPM
 * @returns {number} Duration in beats
 */
export function getAudioClipDurationBeats(buffer, metadata = {}, bpm) {
  // Priority 1: Use pre-calculated beat duration from frozen/exported samples
  if (metadata.frozen && typeof metadata.durationBeats === 'number') {
    console.log(`📏 Using pre-calculated duration: ${metadata.durationBeats} beats (frozen sample)`);
    return metadata.durationBeats;
  }

  // Priority 2: Calculate from buffer duration using current BPM
  if (buffer && buffer.duration) {
    const beats = secondsToBeats(buffer.duration, bpm);
    console.log(`📏 Calculated duration: ${beats.toFixed(2)} beats (${buffer.duration.toFixed(2)}s at ${bpm} BPM)`);
    return beats;
  }

  // Fallback: Return default duration
  console.warn('⚠️ Could not determine audio duration, using default 4 beats');
  return 4;
}

/**
 * Format duration for display
 * @param {number} beats - Duration in beats
 * @param {boolean} showBars - Show in bars:beats format
 * @returns {string} Formatted duration string
 */
export function formatDuration(beats, showBars = true) {
  if (showBars) {
    const bars = Math.floor(beats / 4);
    const remainingBeats = (beats % 4).toFixed(2);
    return `${bars}:${remainingBeats}`;
  }
  return `${beats.toFixed(2)} beats`;
}
