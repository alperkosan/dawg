// Piano Roll v7 Pitch Preview Utility
// Simple Web Audio API based pitch previewing for pencil mode

class PitchPreview {
    constructor() {
        this.audioContext = null;
        this.oscillatorNode = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.currentPitch = null;
        this.playTimeout = null;

        // Preview settings
        this.volume = 0.3;
        this.attackTime = 0.01; // 10ms attack
        this.releaseTime = 0.1; // 100ms release
        this.waveType = 'sine'; // sine, square, sawtooth, triangle
        this.playDuration = 200; // ms - how long to play each preview
    }

    // Initialize audio context (called on first use)
    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Resume if suspended (required for user interaction)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        return this.audioContext;
    }

    // Convert MIDI pitch to frequency
    pitchToFrequency(pitch) {
        // MIDI note 69 (A4) = 440 Hz
        return 440 * Math.pow(2, (pitch - 69) / 12);
    }

    // Play a pitch preview
    playPitch(pitch, velocity = 100) {
        try {
            // Skip if same pitch is already playing
            if (this.isPlaying && this.currentPitch === pitch) {
                return;
            }

            // Stop any current sound
            this.stopPreview();

            // Initialize audio context
            const context = this.initAudioContext();

            // Create oscillator and gain nodes
            this.oscillatorNode = context.createOscillator();
            this.gainNode = context.createGain();

            // Configure oscillator
            const frequency = this.pitchToFrequency(pitch);
            this.oscillatorNode.frequency.setValueAtTime(frequency, context.currentTime);
            this.oscillatorNode.type = this.waveType;

            // Configure gain with attack/release envelope
            const velocityGain = (velocity / 127) * this.volume;
            this.gainNode.gain.setValueAtTime(0, context.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(velocityGain, context.currentTime + this.attackTime);

            // Connect nodes: oscillator -> gain -> destination
            this.oscillatorNode.connect(this.gainNode);
            this.gainNode.connect(context.destination);

            // Start playing
            this.oscillatorNode.start(context.currentTime);
            this.isPlaying = true;
            this.currentPitch = pitch;

            // Auto-stop after duration with release envelope
            this.playTimeout = setTimeout(() => {
                this.stopPreviewWithRelease();
            }, this.playDuration);

            console.log(`🎵 Playing pitch preview: ${pitch} (${frequency.toFixed(1)}Hz)`);

        } catch (error) {
            console.error('Pitch preview error:', error);
            this.stopPreview();
        }
    }

    // Stop preview with release envelope
    stopPreviewWithRelease() {
        if (this.isPlaying && this.gainNode && this.audioContext) {
            try {
                const now = this.audioContext.currentTime;

                // Release envelope
                this.gainNode.gain.cancelScheduledValues(now);
                this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
                this.gainNode.gain.linearRampToValueAtTime(0, now + this.releaseTime);

                // Stop oscillator after release
                if (this.oscillatorNode) {
                    this.oscillatorNode.stop(now + this.releaseTime);
                }

                // Clean up after release time
                setTimeout(() => {
                    this.cleanupNodes();
                }, (this.releaseTime * 1000) + 10);

            } catch (error) {
                console.error('Error during pitch preview release:', error);
                this.cleanupNodes();
            }
        }
    }

    // Immediate stop without release
    stopPreview() {
        if (this.playTimeout) {
            clearTimeout(this.playTimeout);
            this.playTimeout = null;
        }

        if (this.oscillatorNode) {
            try {
                this.oscillatorNode.stop();
            } catch (error) {
                // Oscillator might already be stopped
            }
        }

        this.cleanupNodes();
    }

    // Clean up audio nodes
    cleanupNodes() {
        if (this.oscillatorNode) {
            try {
                this.oscillatorNode.disconnect();
            } catch (error) {
                // Node might already be disconnected
            }
            this.oscillatorNode = null;
        }

        if (this.gainNode) {
            try {
                this.gainNode.disconnect();
            } catch (error) {
                // Node might already be disconnected
            }
            this.gainNode = null;
        }

        this.isPlaying = false;
        this.currentPitch = null;
    }

    // Configure preview settings
    setSettings({ volume, waveType, playDuration, attackTime, releaseTime }) {
        if (volume !== undefined) this.volume = Math.max(0, Math.min(1, volume));
        if (waveType !== undefined) this.waveType = waveType;
        if (playDuration !== undefined) this.playDuration = Math.max(50, playDuration);
        if (attackTime !== undefined) this.attackTime = Math.max(0.001, attackTime);
        if (releaseTime !== undefined) this.releaseTime = Math.max(0.001, releaseTime);
    }

    // Get current settings
    getSettings() {
        return {
            volume: this.volume,
            waveType: this.waveType,
            playDuration: this.playDuration,
            attackTime: this.attackTime,
            releaseTime: this.releaseTime
        };
    }

    // Clean up on destroy
    destroy() {
        this.stopPreview();
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        this.audioContext = null;
    }
}

// Singleton instance for the piano roll
export const pitchPreview = new PitchPreview();

// Export class for custom instances if needed
export { PitchPreview };