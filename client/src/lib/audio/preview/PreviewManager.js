/**
 * PreviewManager
 * Unified preview system for all instrument types
 * Handles preview in PianoRoll, FileBrowser, Instrument Editor, Channel Rack
 */

import { InstrumentFactory } from '../instruments/index.js';

export class PreviewManager {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.currentInstrument = null;
    this.previewInstrument = null; // BaseInstrument instance
    this.isPlaying = false;
    this.currentNote = null;
    this.fileSource = null; // For file preview

    // ✅ POLYPHONY: Track multiple active notes for keyboard piano
    this.activeNotes = new Map(); // Map<midiNote, { velocity, startTime }>

    // Output routing
    this.output = this.audioContext.createGain();
    this.output.gain.value = 0.7; // Preview volume
    this.output.connect(this.audioContext.destination);
  }

  /**
   * Set current instrument for preview
   * @param {Object} instrumentData - Instrument configuration
   */
  async setInstrument(instrumentData) {
    // Stop current preview
    this.stopPreview();

    // Dispose old instrument
    if (this.previewInstrument) {
      this.previewInstrument.dispose();
      this.previewInstrument = null;
    }

    // Create new preview instrument using factory
    try {
      this.previewInstrument = await InstrumentFactory.createPlaybackInstrument(
        instrumentData,
        this.audioContext,
        { useCache: true } // Share cache with playback
      );

      // Connect to output
      if (this.previewInstrument) {
        this.previewInstrument.connect(this.output);
        this.currentInstrument = instrumentData;
      }
    } catch (error) {
      console.error('PreviewManager: Failed to create instrument:', error);
    }
  }

  /**
   * Preview a note
   * @param {string|number} pitch - MIDI note or pitch string (e.g., "C4")
   * @param {number} velocity - 0-127
   * @param {number} duration - Duration in seconds (null = sustain)
   */
  previewNote(pitch, velocity = 100, duration = null) {
    if (!this.previewInstrument) {
      console.warn('PreviewManager: No instrument loaded');
      return;
    }

    // Convert pitch to MIDI if string
    const midiNote = typeof pitch === 'string'
      ? this.previewInstrument.pitchToMidi(pitch)
      : pitch;

    // ✅ POLYPHONY FIX: Don't stop ALL notes, only stop the SAME note if re-triggering
    if (this.activeNotes.has(midiNote)) {
      this.stopNote(midiNote);
    }

    // Start note
    try {
      this.previewInstrument.noteOn(midiNote, velocity);
      this.isPlaying = true;
      this.currentNote = midiNote;

      // ✅ Track active note for polyphony
      this.activeNotes.set(midiNote, {
        velocity,
        startTime: Date.now()
      });

      // Auto-stop if duration specified
      if (duration !== null) {
        setTimeout(() => {
          this.stopNote(midiNote);
        }, duration * 1000);
      }
    } catch (error) {
      console.error('PreviewManager: Failed to preview note:', error);
    }
  }

  /**
   * Stop a specific note
   * @param {number} midiNote - MIDI note number to stop
   */
  stopNote(midiNote) {
    if (!this.previewInstrument) return;

    try {
      this.previewInstrument.noteOff(midiNote);
      this.activeNotes.delete(midiNote);

      // Update playing state
      if (this.activeNotes.size === 0) {
        this.isPlaying = false;
      }
    } catch (error) {
      // Silent fail - instrument might be disposed
    }
  }

  /**
   * Stop current preview (all notes)
   */
  stopPreview() {
    // Stop instrument preview
    if (this.isPlaying && this.previewInstrument) {
      try {
        // ✅ POLYPHONY FIX: Use stopAll() for emergency stop (cleanup)
        // This is for when changing instruments or disposing
        if (typeof this.previewInstrument.stopAll === 'function') {
          this.previewInstrument.stopAll();
        } else {
          // Fallback: stop all tracked notes
          this.activeNotes.forEach((_, midiNote) => {
            this.previewInstrument.noteOff(midiNote);
          });
        }
      } catch (error) {
        // Silent fail - instrument might be disposed
      }
    }

    // Clear all active notes
    this.activeNotes.clear();

    // Stop file preview
    if (this.fileSource) {
      try {
        this.fileSource.stop();
      } catch (error) {
        // Already stopped
      }
      this.fileSource = null;
    }

    this.isPlaying = false;
    this.currentNote = null;
  }

  /**
   * Preview an audio file (for FileBrowser)
   * @param {string} url - Audio file URL
   */
  async previewFile(url) {
    try {
      // Stop current preview
      this.stopPreview();

      // Fetch and decode audio file
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Create and play buffer source
      this.fileSource = this.audioContext.createBufferSource();
      this.fileSource.buffer = audioBuffer;
      this.fileSource.connect(this.output);
      this.fileSource.start();

      this.isPlaying = true;

      // Auto-stop when finished
      this.fileSource.onended = () => {
        this.isPlaying = false;
        this.fileSource = null;
      };

    } catch (error) {
      console.error('PreviewManager: Failed to preview file:', error);
    }
  }

  /**
   * Set preview volume
   * @param {number} volume - 0-1
   */
  setVolume(volume) {
    this.output.gain.value = Math.max(0, Math.min(1, volume));
  }

  /**
   * Get current volume
   * @returns {number} Current volume (0-1)
   */
  getVolume() {
    return this.output.gain.value;
  }

  /**
   * Check if preview is currently playing
   * @returns {boolean}
   */
  getIsPlaying() {
    return this.isPlaying;
  }

  /**
   * Cleanup and dispose
   */
  dispose() {
    this.stopPreview();

    if (this.previewInstrument) {
      this.previewInstrument.dispose();
      this.previewInstrument = null;
    }

    if (this.output) {
      this.output.disconnect();
    }

    this.currentInstrument = null;
  }
}

// Singleton instance
let previewManagerInstance = null;

/**
 * Get singleton PreviewManager instance
 * @param {AudioContext} audioContext - Web Audio AudioContext
 * @returns {PreviewManager}
 */
export const getPreviewManager = (audioContext) => {
  if (!previewManagerInstance && audioContext) {
    previewManagerInstance = new PreviewManager(audioContext);
  }
  return previewManagerInstance;
};
