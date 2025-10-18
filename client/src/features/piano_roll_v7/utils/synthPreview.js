// Piano Roll v7 Synth Preview System
// Handles both sample-based and synth-based preview playback

import { VASynth } from '@/lib/audio/synth/VASynth';
import { getPreset } from '@/lib/audio/synth/presets';

class SynthPreview {
    constructor() {
        this.audioContext = null;
        this.currentInstrument = null;
        this.currentPreset = null;

        // Active synth voices (for synth instruments)
        this.activeSynths = new Map(); // pitch -> VASynth instance
        this.activeKeyboardSynths = new Map(); // key -> { synth, pitch }

        // Active sample sources (for sample instruments)
        this.activeSources = new Map(); // pitch -> { source, gainNode }
        this.activeKeyboardSources = new Map(); // key -> { source, gainNode, pitch }

        // Settings
        this.previewVolume = 0.6;
        this.maxPreviewDuration = 2000;
    }

    // Initialize audio context
    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        return this.audioContext;
    }

    // Set current instrument for preview
    setInstrument(instrumentData, audioBuffer) {
        this.stopAllPreviews();

        this.currentInstrument = {
            ...instrumentData,
            buffer: audioBuffer
        };

        // Load synth preset if it's a synth instrument
        if (instrumentData.type === 'synth' && instrumentData.presetName) {
            this.currentPreset = getPreset(instrumentData.presetName);
            console.log(`🎹 Synth preview preset loaded: ${instrumentData.presetName}`);
        } else {
            this.currentPreset = null;
            console.log(`🎹 Sample preview instrument set: ${instrumentData.name}`);
        }
    }

    // Check if current instrument is a synth
    isSynthInstrument() {
        return this.currentInstrument?.type === 'synth' && this.currentPreset !== null;
    }

    // Convert MIDI pitch to semitone offset from C4 (60)
    pitchToSemitoneOffset(pitch) {
        return pitch - 60;
    }

    // Play preview (works for both samples and synth)
    playPitchPreview(pitch, velocity = 100) {
        if (!this.currentInstrument) {
            console.warn('No instrument set for preview');
            return;
        }

        if (this.isSynthInstrument()) {
            this.playSynthPreview(pitch, velocity);
        } else {
            this.playSamplePreview(pitch, velocity);
        }
    }

    // Play synth preview
    playSynthPreview(pitch, velocity = 100) {
        // Stop existing preview for this pitch
        this.stopPitchPreview(pitch);

        try {
            const context = this.initAudioContext();

            // Create synth voice
            const synth = new VASynth(context);

            // Load preset
            if (this.currentPreset) {
                synth.loadPreset(this.currentPreset);
            }

            // Adjust master volume
            synth.setMasterVolume(this.previewVolume);

            // Play note
            synth.noteOn(pitch, velocity);

            // Auto-stop after max duration
            setTimeout(() => {
                synth.noteOff();
                this.activeSynths.delete(pitch);
            }, this.maxPreviewDuration);

            // Store active synth
            this.activeSynths.set(pitch, synth);

            console.log(`🎵 Synth preview: pitch ${pitch}, velocity ${velocity}`);

        } catch (error) {
            console.error('Synth preview error:', error);
            this.stopPitchPreview(pitch);
        }
    }

    // Play sample preview
    playSamplePreview(pitch, velocity = 100) {
        if (!this.currentInstrument.buffer) {
            console.warn('No audio buffer for sample instrument');
            return;
        }

        // Stop existing preview for this pitch
        this.stopPitchPreview(pitch);

        try {
            const context = this.initAudioContext();
            const startTime = context.currentTime;

            // Create buffer source
            const source = context.createBufferSource();
            source.buffer = this.currentInstrument.buffer;

            // Calculate pitch shift
            const semitoneOffset = this.pitchToSemitoneOffset(pitch);
            const pitchOffset = this.currentInstrument.pitchOffset || 0;
            const totalOffset = semitoneOffset + pitchOffset;

            source.playbackRate.setValueAtTime(
                Math.pow(2, totalOffset / 12),
                startTime
            );

            // Create gain node
            const gainNode = context.createGain();
            const velocityGain = (velocity / 127) * this.previewVolume;
            gainNode.gain.setValueAtTime(velocityGain, startTime);

            // Connect nodes
            source.connect(gainNode);
            gainNode.connect(context.destination);

            // Start playing
            source.start(startTime);

            // Auto-stop after max duration
            const stopTime = startTime + (this.maxPreviewDuration / 1000);
            source.stop(stopTime);

            // Store active source
            this.activeSources.set(pitch, { source, gainNode });

            // Cleanup when ended
            source.onended = () => {
                if (this.activeSources.get(pitch)?.source === source) {
                    this.activeSources.delete(pitch);
                }
                try {
                    gainNode.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            };

            console.log(`🎵 Sample preview: pitch ${pitch}, offset ${totalOffset} semitones`);

        } catch (error) {
            console.error('Sample preview error:', error);
            this.stopPitchPreview(pitch);
        }
    }

    // Stop preview for specific pitch
    stopPitchPreview(pitch) {
        // Stop synth
        const activeSynth = this.activeSynths.get(pitch);
        if (activeSynth) {
            activeSynth.noteOff();
            activeSynth.dispose();
            this.activeSynths.delete(pitch);
        }

        // Stop sample
        const activeSource = this.activeSources.get(pitch);
        if (activeSource) {
            try {
                activeSource.source.stop();
                activeSource.gainNode.disconnect();
            } catch (e) {
                // Already stopped
            }
            this.activeSources.delete(pitch);
        }
    }

    // Play keyboard note (with sustain)
    playKeyboardNote(key, pitch, velocity = 100) {
        if (!this.currentInstrument) {
            console.warn('No instrument set for keyboard preview');
            return;
        }

        if (this.isSynthInstrument()) {
            this.playKeyboardSynthNote(key, pitch, velocity);
        } else {
            this.playKeyboardSampleNote(key, pitch, velocity);
        }
    }

    // Play keyboard synth note
    playKeyboardSynthNote(key, pitch, velocity = 100) {
        // Stop existing note for this key
        this.stopKeyboardNote(key);

        try {
            const context = this.initAudioContext();

            // Create synth voice
            const synth = new VASynth(context);

            // Load preset
            if (this.currentPreset) {
                synth.loadPreset(this.currentPreset);
            }

            // Adjust master volume
            synth.setMasterVolume(this.previewVolume);

            // Play note (no auto-stop for keyboard)
            synth.noteOn(pitch, velocity);

            // Store active synth
            this.activeKeyboardSynths.set(key, { synth, pitch });

            console.log(`⌨️ Keyboard synth note started: ${key} -> pitch ${pitch}`);

        } catch (error) {
            console.error('Keyboard synth note error:', error);
            this.stopKeyboardNote(key);
        }
    }

    // Play keyboard sample note
    playKeyboardSampleNote(key, pitch, velocity = 100) {
        if (!this.currentInstrument.buffer) {
            console.warn('No audio buffer for sample instrument');
            return;
        }

        // Stop existing note for this key
        this.stopKeyboardNote(key);

        try {
            const context = this.initAudioContext();
            const startTime = context.currentTime;

            // Create buffer source
            const source = context.createBufferSource();
            source.buffer = this.currentInstrument.buffer;

            // Calculate pitch shift
            const semitoneOffset = this.pitchToSemitoneOffset(pitch);
            const pitchOffset = this.currentInstrument.pitchOffset || 0;
            const totalOffset = semitoneOffset + pitchOffset;

            source.playbackRate.setValueAtTime(
                Math.pow(2, totalOffset / 12),
                startTime
            );

            // Create gain node with envelope
            const gainNode = context.createGain();
            const velocityGain = (velocity / 127) * this.previewVolume;

            // Quick attack envelope
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(velocityGain, startTime + 0.01);

            // Connect nodes
            source.connect(gainNode);
            gainNode.connect(context.destination);

            // Start playing (no auto-stop)
            source.start(startTime);

            // Store active source
            this.activeKeyboardSources.set(key, { source, gainNode, pitch });

            // Cleanup when ended
            source.onended = () => {
                if (this.activeKeyboardSources.get(key)?.source === source) {
                    this.activeKeyboardSources.delete(key);
                }
                try {
                    gainNode.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            };

            console.log(`⌨️ Keyboard sample note started: ${key} -> pitch ${pitch}`);

        } catch (error) {
            console.error('Keyboard sample note error:', error);
            this.stopKeyboardNote(key);
        }
    }

    // Stop keyboard note
    stopKeyboardNote(key) {
        // Stop synth
        const activeSynth = this.activeKeyboardSynths.get(key);
        if (activeSynth) {
            activeSynth.synth.noteOff();
            console.log(`⌨️ Keyboard synth note stopped: ${key} -> pitch ${activeSynth.pitch}`);
            this.activeKeyboardSynths.delete(key);
        }

        // Stop sample
        const activeSource = this.activeKeyboardSources.get(key);
        if (activeSource) {
            try {
                const context = this.audioContext;
                const now = context.currentTime;
                const releaseTime = 0.1;

                // Apply release envelope
                activeSource.gainNode.gain.cancelScheduledValues(now);
                activeSource.gainNode.gain.setValueAtTime(activeSource.gainNode.gain.value, now);
                activeSource.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

                // Stop source after release
                activeSource.source.stop(now + releaseTime);

                console.log(`⌨️ Keyboard sample note stopped: ${key} -> pitch ${activeSource.pitch}`);

            } catch (e) {
                // Fallback: immediate stop
                try {
                    activeSource.source.stop();
                } catch (e2) {
                    // Already stopped
                }
            }

            this.activeKeyboardSources.delete(key);
        }
    }

    // Stop all previews
    stopAllPreviews() {
        // Stop synth previews
        for (const [pitch, synth] of this.activeSynths) {
            try {
                synth.noteOff();
                synth.dispose();
            } catch (e) {
                // Already stopped
            }
        }
        this.activeSynths.clear();

        // Stop sample previews
        for (const [pitch, activeSource] of this.activeSources) {
            try {
                activeSource.source.stop();
                activeSource.gainNode.disconnect();
            } catch (e) {
                // Already stopped
            }
        }
        this.activeSources.clear();

        // Stop keyboard synths
        for (const [key, activeSynth] of this.activeKeyboardSynths) {
            try {
                activeSynth.synth.noteOff();
                activeSynth.synth.dispose();
            } catch (e) {
                // Already stopped
            }
        }
        this.activeKeyboardSynths.clear();

        // Stop keyboard samples
        for (const [key, activeSource] of this.activeKeyboardSources) {
            try {
                activeSource.source.stop();
                activeSource.gainNode.disconnect();
            } catch (e) {
                // Already stopped
            }
        }
        this.activeKeyboardSources.clear();
    }

    // Check if a key is currently playing
    isKeyPlaying(key) {
        return this.activeKeyboardSynths.has(key) || this.activeKeyboardSources.has(key);
    }

    // Get all currently playing keys
    getPlayingKeys() {
        const synthKeys = Array.from(this.activeKeyboardSynths.keys());
        const sampleKeys = Array.from(this.activeKeyboardSources.keys());
        return [...synthKeys, ...sampleKeys];
    }

    // Configure preview settings
    setSettings({ previewVolume, maxPreviewDuration }) {
        if (previewVolume !== undefined) {
            this.previewVolume = Math.max(0, Math.min(1, previewVolume));
        }
        if (maxPreviewDuration !== undefined) {
            this.maxPreviewDuration = Math.max(100, maxPreviewDuration);
        }
    }

    // Cleanup
    destroy() {
        this.stopAllPreviews();
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        this.audioContext = null;
        this.currentInstrument = null;
        this.currentPreset = null;
    }
}

// Singleton instance
export const synthPreview = new SynthPreview();

// Export class for custom instances
export { SynthPreview };
