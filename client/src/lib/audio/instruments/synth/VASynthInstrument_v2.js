/**
 * VASynthInstrument (v2) - Voice pool based architecture
 *
 * Professional DAW-standard implementation:
 * - Pre-allocated voice pool (zero GC)
 * - Smart voice stealing
 * - Mono/poly mode with portamento/legato
 * - Clean separation of concerns
 *
 * This is the NEW architecture - will replace VASynthInstrument.js
 */

import { BaseInstrument } from '../base/BaseInstrument.js';
import { VoicePool } from '../base/VoicePool.js';
import { VoiceAllocator } from '../base/VoiceAllocator.js';
import { VASynthVoice } from '../../synth/VASynthVoice.js';
import { getPreset } from '../../synth/presets.js';

export class VASynthInstrument_v2 extends BaseInstrument {
    constructor(instrumentData, audioContext) {
        super(instrumentData, audioContext);

        this.presetName = instrumentData.presetName;
        this.preset = getPreset(this.presetName);

        if (!this.preset) {
            throw new Error(`VASynth preset not found: ${this.presetName}`);
        }

        // Extract voice mode configuration from preset
        const voiceConfig = {
            mode: this.preset.voiceMode || 'poly',
            portamento: this.preset.portamento || 0,
            legato: this.preset.legato || false
        };

        // Create voice pool (pre-allocate all voices)
        // ⚡ OPTIMIZED: Reduced default from 16 to 8 voices (AudioNode optimization)
        this.voicePool = new VoicePool(
            audioContext,
            VASynthVoice,
            this.preset.maxVoices || 8
        );

        // Create voice allocator (handles mono/poly logic)
        this.allocator = new VoiceAllocator(this.voicePool, voiceConfig);

        // Master output
        this.masterGain = audioContext.createGain();
        this.masterGain.gain.setValueAtTime(
            this.preset.masterVolume || 0.7,
            audioContext.currentTime
        );
        this.output = this.masterGain;

        // Connect all voices to master
        this.voicePool.voices.forEach(voice => {
            voice.output.connect(this.masterGain);
        });

        // Load preset into all voices
        this.loadPreset(this.preset);

        console.log(`✅ VASynthInstrument_v2 created: ${this.name} (${this.presetName})`);
        console.log(`   Mode: ${voiceConfig.mode}, Portamento: ${voiceConfig.portamento}s, Voices: ${this.voicePool.voices.length}`);
    }

    /**
     * Initialize instrument
     */
    async initialize() {
        // Voices are already initialized in pool constructor
        this._isInitialized = true;
        return Promise.resolve();
    }

    /**
     * Play a note
     */
    noteOn(midiNote, velocity = 100, startTime = null) {
        if (!this._isInitialized) {
            console.warn(`${this.name}: Not initialized`);
            return;
        }

        const time = startTime !== null ? startTime : this.audioContext.currentTime;

        try {
            // Allocate and trigger voice (mono/poly logic handled by allocator)
            const voice = this.allocator.noteOn(midiNote, velocity, time);

            if (voice) {
                this._trackNoteOn(midiNote, velocity, time);
            }

        } catch (error) {
            console.error(`❌ VASynthInstrument_v2 noteOn failed:`, error);
        }
    }

    /**
     * Release a note
     */
    noteOff(midiNote = null, stopTime = null) {
        if (!this._isInitialized) {
            return;
        }

        const time = stopTime !== null ? stopTime : this.audioContext.currentTime;

        try {
            if (midiNote !== null) {
                this.allocator.noteOff(midiNote, time);
                this._trackNoteOff(midiNote);
            } else {
                // Release all notes
                this.allocator.releaseAll(time);
                this.activeNotes.clear();
                this._isPlaying = false;
            }

        } catch (error) {
            console.error(`❌ VASynthInstrument_v2 noteOff failed:`, error);
        }
    }

    /**
     * Release all notes gracefully (for pause)
     */
    allNotesOff(time = null) {
        if (!this._isInitialized) return;

        const stopTime = time !== null ? time : this.audioContext.currentTime;

        console.log(`🎹 VASynthInstrument_v2 allNotesOff: ${this.name}`);

        this.allocator.releaseAll(stopTime);
        this.activeNotes.clear();
        this._isPlaying = false;
    }

    /**
     * Emergency stop (instant silence, no release)
     */
    stopAll() {
        if (!this._isInitialized) return;

        console.log(`🛑 VASynthInstrument_v2 stopAll: ${this.name}`);

        this.allocator.stopAll();
        this.activeNotes.clear();
        this._isPlaying = false;
    }

    /**
     * Load preset
     */
    loadPreset(preset) {
        if (!preset) return;

        this.preset = preset;

        // Load preset into all voices
        this.voicePool.voices.forEach(voice => {
            voice.loadPreset(preset);
        });

        // Update allocator configuration
        if (preset.voiceMode || preset.portamento !== undefined || preset.legato !== undefined) {
            this.allocator.configure({
                mode: preset.voiceMode || this.allocator.mode,
                portamento: preset.portamento !== undefined ? preset.portamento : this.allocator.portamento,
                legato: preset.legato !== undefined ? preset.legato : this.allocator.legato
            });
        }

        // Update master volume
        if (preset.masterVolume !== undefined) {
            this.masterGain.gain.setValueAtTime(
                preset.masterVolume,
                this.audioContext.currentTime
            );
        }

        console.log(`🎼 Preset loaded: ${preset.name || 'Unnamed'}`);
    }

    /**
     * Set master volume
     */
    setVolume(volume) {
        if (!this.masterGain) return;

        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.masterGain.gain.setValueAtTime(
            clampedVolume,
            this.audioContext.currentTime
        );
    }

    /**
     * Get voice pool statistics (for debugging/UI)
     */
    getVoiceStats() {
        return {
            allocator: this.allocator.getStats(),
            pool: this.voicePool.getStats()
        };
    }

    /**
     * Cleanup
     */
    dispose() {
        // Dispose voice pool (disposes all voices)
        if (this.voicePool) {
            this.voicePool.dispose();
        }

        // Disconnect master gain
        if (this.masterGain) {
            try {
                this.masterGain.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }

        super.dispose();

        console.log(`🗑️ VASynthInstrument_v2 disposed: ${this.name}`);
    }

    /**
     * Get capabilities
     */
    get capabilities() {
        return {
            supportsPolyphony: true,
            supportsPitchBend: false, // TODO: Add pitch bend
            supportsVelocity: true,
            supportsAftertouch: false, // TODO: Add aftertouch
            supportsPresetChange: true,
            supportsParameterAutomation: false, // TODO: Add automation
            maxVoices: this.voicePool.maxVoices,
            currentMode: this.allocator.mode,
            hasPortamento: this.allocator.portamento > 0,
            hasLegato: this.allocator.legato
        };
    }

    /**
     * Get debug info
     */
    getState() {
        return {
            ...this.getDebugInfo(),
            preset: this.presetName,
            voiceStats: this.getVoiceStats(),
            capabilities: this.capabilities
        };
    }
}
