/**
 * PreviewManager
 * Unified preview system for all instrument types
 * Handles preview in PianoRoll, FileBrowser, Instrument Editor, Channel Rack
 * ✅ FX CHAIN SUPPORT: Routes preview through MixerInsert to include FX chain
 */

import { InstrumentFactory } from '../instruments/index.js';

export class PreviewManager {
  constructor(audioContext, audioEngine = null) {
    this.audioContext = audioContext;
    this.audioEngine = audioEngine; // ✅ FX CHAIN: Reference to audioEngine for mixer routing
    this.currentInstrument = null;
    this.previewInstrument = null; // BaseInstrument instance
    this.isInstrumentReady = false;
    this.pendingPreviews = [];
    this.isPlaying = false;
    this.currentNote = null;
    this.fileSource = null; // For file preview

    // ✅ POLYPHONY: Track multiple active notes for keyboard piano
    this.activeNotes = new Map(); // Map<midiNote, { velocity, startTime }>

    // ✅ FX CHAIN: Preview routing (will be set based on instrument's mixerTrackId)
    this.currentMixerInsert = null; // Current MixerInsert for preview routing
    this.fallbackOutput = this.audioContext.createGain(); // Fallback output (direct to destination)
    this.fallbackOutput.gain.value = 0.7; // Preview volume
    this.fallbackOutput.connect(this.audioContext.destination);
  }

  /**
   * Set current instrument for preview
   * ✅ FX CHAIN: Routes preview through MixerInsert to include FX chain
   * @param {Object} instrumentData - Instrument configuration
   */
  async setInstrument(instrumentData) {
    // Stop current preview
    this.stopPreview();
    this.isInstrumentReady = false;
    this.pendingPreviews = [];

    // Dispose old instrument
    if (this.previewInstrument) {
      // ✅ FX CHAIN: Disconnect from previous routing
      if (this.previewInstrument.output) {
        try {
          this.previewInstrument.output.disconnect();
        } catch (e) {
          // Already disconnected
        }
      }
      this.previewInstrument.dispose();
      this.previewInstrument = null;
    }

    // ✅ FX CHAIN: Clear previous mixer insert reference
    this.currentMixerInsert = null;

    // Create new preview instrument using factory
    try {
      this.previewInstrument = await InstrumentFactory.createPlaybackInstrument(
        instrumentData,
        this.audioContext,
        { useCache: true } // Share cache with playback
      );

      // ✅ FX CHAIN: Route preview through MixerInsert (if available)
      if (this.previewInstrument) {
        await this._routePreviewThroughMixer(instrumentData);
        this.currentInstrument = instrumentData;
        this.isInstrumentReady = true;
        this._flushPendingPreviews();
      }
    } catch (error) {
      console.error('PreviewManager: Failed to create instrument:', error);
    }
  }

  /**
   * ✅ FX CHAIN: Route preview through MixerInsert to include FX chain
   * @param {Object} instrumentData - Instrument configuration
   * @private
   */
  async _routePreviewThroughMixer(instrumentData) {
    if (!this.previewInstrument || !this.previewInstrument.output) {
      console.warn('⚠️ PreviewManager: No preview instrument output available');
      return;
    }

    // ✅ FX CHAIN: Try to get audioEngine if not set
    if (!this.audioEngine) {
      try {
        const { AudioContextService } = await import('../../services/AudioContextService.js');
        this.audioEngine = AudioContextService.getAudioEngine();
      } catch (error) {
        console.warn('⚠️ PreviewManager: Could not access AudioContextService:', error);
      }
    }

    // ✅ FX CHAIN: Get mixerTrackId from instrumentData
    const mixerTrackId = instrumentData.mixerTrackId;

    if (mixerTrackId && this.audioEngine && this.audioEngine.mixerInserts) {
      const mixerInsert = this.audioEngine.mixerInserts.get(mixerTrackId);

      if (mixerInsert && mixerInsert.input) {
        // ✅ FX CHAIN: Route preview through MixerInsert (includes FX chain)
        try {
          this.previewInstrument.connect(mixerInsert.input);
          this.currentMixerInsert = mixerInsert;
          console.log(`🎛️ PreviewManager: Routed preview through MixerInsert ${mixerTrackId} (FX chain included)`);
          return;
        } catch (error) {
          console.warn(`⚠️ PreviewManager: Failed to route through MixerInsert ${mixerTrackId}:`, error);
        }
      } else {
        console.warn(`⚠️ PreviewManager: MixerInsert ${mixerTrackId} not found, using fallback routing`);
      }
    } else {
      if (!mixerTrackId) {
        console.warn('⚠️ PreviewManager: No mixerTrackId in instrumentData, using fallback routing (FX chain not included)');
      } else if (!this.audioEngine) {
        console.warn('⚠️ PreviewManager: AudioEngine not available, using fallback routing (FX chain not included)');
      } else if (!this.audioEngine.mixerInserts) {
        console.warn('⚠️ PreviewManager: MixerInserts not available, using fallback routing (FX chain not included)');
      }
    }

    // ✅ FALLBACK: Route directly to destination (no FX chain)
    try {
      this.previewInstrument.connect(this.fallbackOutput);
      console.log('⚠️ PreviewManager: Using fallback routing (direct to destination, FX chain NOT included)');
    } catch (error) {
      console.error('❌ PreviewManager: Failed to connect preview instrument:', error);
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

    if (!this.isInstrumentReady) {
      this.pendingPreviews.push({ pitch, velocity, duration });
      return;
    }

    this._playPreviewNow(pitch, velocity, duration);
  }

  _playPreviewNow(pitch, velocity = 100, duration = null) {
    if (!this.previewInstrument) {
      return;
    }

    const midiNote = typeof pitch === 'string'
      ? this.previewInstrument.pitchToMidi(pitch)
      : pitch;

    if (this.activeNotes.has(midiNote)) {
      this.stopNote(midiNote);
    }

    try {
      this.previewInstrument.noteOn(midiNote, velocity);
      this.isPlaying = true;
      this.currentNote = midiNote;

      this.activeNotes.set(midiNote, {
        velocity,
        startTime: Date.now()
      });

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
    if (this.pendingPreviews.length) {
      this.pendingPreviews = this.pendingPreviews.filter(({ pitch }) => {
        if (typeof pitch === 'string') {
          if (this.previewInstrument?.pitchToMidi) {
            return this.previewInstrument.pitchToMidi(pitch) !== midiNote;
          }
          return true;
        }
        return pitch !== midiNote;
      });
    }

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
    this.pendingPreviews = [];
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

  _flushPendingPreviews() {
    if (!this.isInstrumentReady || !this.previewInstrument || this.pendingPreviews.length === 0) {
      return;
    }

    const queued = [...this.pendingPreviews];
    this.pendingPreviews.length = 0;

    queued.forEach(({ pitch, velocity, duration }) => {
      this._playPreviewNow(pitch, velocity, duration);
    });
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
      // ✅ FX CHAIN: File preview uses fallback output (no mixer routing)
      // Note: File preview is for FileBrowser, not instrument preview, so no FX chain needed
      this.fileSource.connect(this.fallbackOutput);
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
   * ✅ FX CHAIN: Updates fallback output volume (MixerInsert volume is controlled by mixer)
   * @param {number} volume - 0-1
   */
  setVolume(volume) {
    this.fallbackOutput.gain.value = Math.max(0, Math.min(1, volume));
    // Note: If routed through MixerInsert, volume is controlled by mixer insert gain
    // This only affects fallback routing (direct to destination)
  }

  /**
   * Get current volume
   * ✅ FX CHAIN: Returns fallback output volume (MixerInsert volume is controlled by mixer)
   * @returns {number} Current volume (0-1)
   */
  getVolume() {
    return this.fallbackOutput.gain.value;
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
   * ✅ FX CHAIN: Cleans up mixer routing
   */
  dispose() {
    this.stopPreview();
    this.isInstrumentReady = false;
    this.pendingPreviews = [];

    if (this.previewInstrument) {
      // ✅ FX CHAIN: Disconnect from mixer routing
      if (this.previewInstrument.output) {
        try {
          this.previewInstrument.output.disconnect();
        } catch (e) {
          // Already disconnected
        }
      }
      this.previewInstrument.dispose();
      this.previewInstrument = null;
    }

    // ✅ FX CHAIN: Clear mixer insert reference
    this.currentMixerInsert = null;

    if (this.fallbackOutput) {
      this.fallbackOutput.disconnect();
    }

    this.currentInstrument = null;
  }
}

// Singleton instance
let previewManagerInstance = null;

/**
 * Get singleton PreviewManager instance
 * ✅ FX CHAIN: Accepts audioEngine parameter for mixer routing
 * @param {AudioContext} audioContext - Web Audio AudioContext
 * @param {NativeAudioEngine} audioEngine - Audio engine instance (optional, for FX chain support)
 * @returns {PreviewManager}
 */
export const getPreviewManager = (audioContext, audioEngine = null) => {
  if (!previewManagerInstance && audioContext) {
    previewManagerInstance = new PreviewManager(audioContext, audioEngine);
  } else if (previewManagerInstance && audioEngine && !previewManagerInstance.audioEngine) {
    // ✅ FX CHAIN: Update audioEngine reference if not set
    previewManagerInstance.audioEngine = audioEngine;
  }
  return previewManagerInstance;
};
