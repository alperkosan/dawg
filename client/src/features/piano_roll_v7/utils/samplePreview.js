// Piano Roll v7 Sample-based Preview System
// Uses actual instrument samples for preview instead of synth

class SamplePreview {
    constructor() {
        this.audioContext = null;
        this.currentInstrument = null;
        this.activeSources = new Map(); // pitch -> { source, gainNode }
        this.activeKeyboardSources = new Map(); // key -> { source, gainNode, pitch }

        // Settings
        this.previewVolume = 0.6;
        this.sustainMode = false; // For keyboard hold
        this.maxPreviewDuration = 2000; // Max 2 seconds for preview

        // ✅ Callback for keyboard note changes (for piano roll highlight)
        this.onKeyboardNoteChange = null;
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
        console.log(`🎹 Sample preview instrument set: ${instrumentData.name}`);
    }

    // Convert MIDI pitch to semitone offset from C4 (60)
    pitchToSemitoneOffset(pitch) {
        const midiNoteC4 = 60;
        return pitch - midiNoteC4;
    }

    // Play sample at specific pitch (for mouse hover preview)
    playPitchPreview(pitch, velocity = 100) {
        if (!this.currentInstrument || !this.currentInstrument.buffer) {
            console.warn('No instrument set for preview');
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

            // Calculate pitch shift for sample instruments
            // Always apply pitch shifting for samples in piano roll context
            const semitoneOffset = this.pitchToSemitoneOffset(pitch);
            const pitchOffset = this.currentInstrument.pitchOffset || 0;
            const totalOffset = semitoneOffset + pitchOffset;

            // Apply pitch shift via playback rate
            source.playbackRate.setValueAtTime(
                Math.pow(2, totalOffset / 12),
                startTime
            );

            console.log(`🎵 Pitch shift applied: pitch ${pitch} → offset ${totalOffset} semitones → rate ${Math.pow(2, totalOffset / 12).toFixed(3)}`);

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

            console.log(`🎵 Sample preview: pitch ${pitch}, offset ${this.pitchToSemitoneOffset(pitch)} semitones`);

        } catch (error) {
            console.error('Sample preview error:', error);
            this.stopPitchPreview(pitch);
        }
    }

    // Stop preview for specific pitch
    stopPitchPreview(pitch) {
        const activeSource = this.activeSources.get(pitch);
        if (activeSource) {
            try {
                activeSource.source.stop();
                activeSource.gainNode.disconnect();
            } catch (e) {
                // Already stopped/disconnected
            }
            this.activeSources.delete(pitch);
        }
    }

    // Play and sustain note for keyboard input (key press & hold)
    playKeyboardNote(key, pitch, velocity = 100) {
        if (!this.currentInstrument || !this.currentInstrument.buffer) {
            console.warn('No instrument set for keyboard preview');
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

            // Calculate pitch shift for keyboard input
            const semitoneOffset = this.pitchToSemitoneOffset(pitch);
            const pitchOffset = this.currentInstrument.pitchOffset || 0;
            const totalOffset = semitoneOffset + pitchOffset;

            source.playbackRate.setValueAtTime(
                Math.pow(2, totalOffset / 12),
                startTime
            );

            console.log(`⌨️ Keyboard pitch shift: key ${key} → pitch ${pitch} → offset ${totalOffset} semitones`);

            // Create gain node with envelope
            const gainNode = context.createGain();
            const velocityGain = (velocity / 127) * this.previewVolume;

            // Quick attack envelope
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(velocityGain, startTime + 0.01);

            // Connect nodes
            source.connect(gainNode);
            gainNode.connect(context.destination);

            // Start playing (no auto-stop for keyboard - will be stopped on key release)
            source.start(startTime);

            // Store active source with key mapping
            this.activeKeyboardSources.set(key, { source, gainNode, pitch });

            // ✅ Notify callback of note start
            if (this.onKeyboardNoteChange) {
                this.onKeyboardNoteChange(pitch);
            }

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

            console.log(`⌨️ Keyboard note started: ${key} -> pitch ${pitch}`);

        } catch (error) {
            console.error('Keyboard note error:', error);
            this.stopKeyboardNote(key);
        }
    }

    // Stop keyboard note with release envelope
    stopKeyboardNote(key) {
        const activeSource = this.activeKeyboardSources.get(key);
        if (activeSource) {
            try {
                const context = this.audioContext;
                const now = context.currentTime;
                const releaseTime = 0.1; // 100ms release

                // Apply release envelope
                activeSource.gainNode.gain.cancelScheduledValues(now);
                activeSource.gainNode.gain.setValueAtTime(activeSource.gainNode.gain.value, now);
                activeSource.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

                // Stop source after release
                activeSource.source.stop(now + releaseTime);

                console.log(`⌨️ Keyboard note stopped: ${key} -> pitch ${activeSource.pitch}`);

            } catch (e) {
                // Fallback: immediate stop
                try {
                    activeSource.source.stop();
                } catch (e2) {
                    // Already stopped
                }
            }

            this.activeKeyboardSources.delete(key);

            // ✅ Notify callback of note stop
            if (this.onKeyboardNoteChange) {
                this.onKeyboardNoteChange(null);
            }
        }
    }

    // Stop all previews
    stopAllPreviews() {
        // Stop pitch previews
        for (const [pitch, activeSource] of this.activeSources) {
            try {
                activeSource.source.stop();
                activeSource.gainNode.disconnect();
            } catch (e) {
                // Already stopped
            }
        }
        this.activeSources.clear();

        // Stop keyboard notes
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
        return this.activeKeyboardSources.has(key);
    }

    // Get all currently playing keys
    getPlayingKeys() {
        return Array.from(this.activeKeyboardSources.keys());
    }

    // Configure preview settings
    setSettings({ previewVolume, maxPreviewDuration, sustainMode }) {
        if (previewVolume !== undefined) {
            this.previewVolume = Math.max(0, Math.min(1, previewVolume));
        }
        if (maxPreviewDuration !== undefined) {
            this.maxPreviewDuration = Math.max(100, maxPreviewDuration);
        }
        if (sustainMode !== undefined) {
            this.sustainMode = sustainMode;
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
    }
}

// Singleton instance
export const samplePreview = new SamplePreview();

// Export class for custom instances
export { SamplePreview };