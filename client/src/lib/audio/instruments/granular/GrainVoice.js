/**
 * GrainVoice - Single grain playback engine
 *
 * Represents one "grain" - a tiny snippet of audio with:
 * - Envelope (amplitude shaping)
 * - Pitch shifting (playback rate)
 * - Stereo positioning
 * - Reverse playback
 *
 * Inspired by granular synthesis theory (Curtis Roads)
 */

export class GrainVoice {
    constructor(audioContext) {
        this.audioContext = audioContext;

        // Audio nodes
        this.source = null;
        this.envelope = audioContext.createGain();
        this.panner = audioContext.createStereoPanner();
        this.output = audioContext.createGain();

        // Signal chain: source -> envelope -> panner -> output
        this.envelope.connect(this.panner);
        this.panner.connect(this.output);

        // State
        this.isActive = false;
        this.startTime = 0;
        this.endTime = 0;
    }

    /**
     * Trigger a grain
     *
     * @param {AudioBuffer} sampleBuffer - The audio sample to grain
     * @param {Object} params - Grain parameters
     * @param {number} params.position - Position in sample (0-1)
     * @param {number} params.grainSize - Grain duration in seconds
     * @param {number} params.pitch - Pitch shift in semitones
     * @param {number} params.pan - Stereo position (-1 to 1)
     * @param {number} params.gain - Amplitude (0-1)
     * @param {string} params.envelope - Envelope type ('hann', 'triangle', 'gaussian')
     * @param {boolean} params.reverse - Play grain in reverse
     * @param {number} startTime - When to start (AudioContext time)
     */
    trigger(sampleBuffer, params, startTime) {
        if (!sampleBuffer) {
            console.warn('GrainVoice: No sample buffer provided');
            return;
        }

        const {
            position = 0.5,
            grainSize = 0.05,  // 50ms default
            pitch = 0,         // semitones
            pan = 0,           // -1 to 1
            gain = 1.0,        // 0 to 1
            envelope = 'hann',
            reverse = false
        } = params;

        try {
            // Create buffer source
            this.source = this.audioContext.createBufferSource();
            this.source.buffer = sampleBuffer;

            // Calculate playback rate (pitch shift)
            const playbackRate = Math.pow(2, pitch / 12);
            this.source.playbackRate.setValueAtTime(playbackRate, startTime);

            // Calculate grain start position in sample
            const sampleDuration = sampleBuffer.duration;
            let grainStart = position * sampleDuration;

            // Ensure grain doesn't exceed sample bounds
            const actualGrainSize = Math.min(grainSize, sampleDuration - grainStart);

            if (actualGrainSize <= 0) {
                console.warn('GrainVoice: Invalid grain position/size');
                return;
            }

            // Apply envelope
            this._applyEnvelope(envelope, actualGrainSize, gain, startTime);

            // Apply stereo positioning
            this.panner.pan.setValueAtTime(pan, startTime);

            // Connect source to envelope
            this.source.connect(this.envelope);

            // Start playback
            if (reverse) {
                // TODO: Reverse playback requires buffer reversal or worklet
                // For now, just play forward
                this.source.start(startTime, grainStart, actualGrainSize);
            } else {
                this.source.start(startTime, grainStart, actualGrainSize);
            }

            // Schedule stop
            this.source.stop(startTime + actualGrainSize);

            // Update state
            this.isActive = true;
            this.startTime = startTime;
            this.endTime = startTime + actualGrainSize;

            // Auto-cleanup when grain finishes
            this.source.onended = () => {
                this._cleanup();
            };

        } catch (error) {
            console.error('GrainVoice trigger error:', error);
            this._cleanup();
        }
    }

    /**
     * Apply amplitude envelope to grain
     * @private
     */
    _applyEnvelope(type, duration, gain, startTime) {
        const env = this.envelope.gain;

        // Start at 0
        env.setValueAtTime(0, startTime);

        switch (type) {
            case 'hann':
                // Hann window: smooth, bell-shaped (recommended for granular)
                // Formula: 0.5 * (1 - cos(2π * t))
                this._applyHannWindow(env, duration, gain, startTime);
                break;

            case 'triangle':
                // Triangle: linear attack/release
                env.linearRampToValueAtTime(gain, startTime + duration * 0.5);
                env.linearRampToValueAtTime(0, startTime + duration);
                break;

            case 'gaussian':
                // Gaussian: very smooth, natural sounding
                this._applyGaussianWindow(env, duration, gain, startTime);
                break;

            default:
                // Fallback to Hann
                this._applyHannWindow(env, duration, gain, startTime);
        }
    }

    /**
     * Apply Hann window envelope
     * @private
     */
    _applyHannWindow(envParam, duration, gain, startTime) {
        const steps = 32; // Balance between smoothness and CPU

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const hannValue = 0.5 * (1 - Math.cos(2 * Math.PI * t));
            const value = hannValue * gain;
            const time = startTime + duration * t;

            envParam.linearRampToValueAtTime(value, time);
        }
    }

    /**
     * Apply Gaussian window envelope
     * @private
     */
    _applyGaussianWindow(envParam, duration, gain, startTime) {
        const steps = 32;
        const sigma = 0.3; // Standard deviation (controls width)

        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) - 0.5; // Center at 0
            const gaussValue = Math.exp(-(t * t) / (2 * sigma * sigma));
            const value = gaussValue * gain;
            const time = startTime + duration * (i / steps);

            envParam.linearRampToValueAtTime(value, time);
        }
    }

    /**
     * Stop grain immediately
     */
    stop(when = null) {
        const stopTime = when !== null ? when : this.audioContext.currentTime;

        if (this.source && this.isActive) {
            try {
                this.source.stop(stopTime);
            } catch (e) {
                // Already stopped
            }
        }

        this._cleanup();
    }

    /**
     * Cleanup audio nodes
     * @private
     */
    _cleanup() {
        if (this.source) {
            try {
                this.source.disconnect();
            } catch (e) {
                // Already disconnected
            }
            this.source = null;
        }

        this.isActive = false;
    }

    /**
     * Check if grain is currently playing
     */
    isPlaying() {
        return this.isActive && this.audioContext.currentTime < this.endTime;
    }

    /**
     * Get remaining time in seconds
     */
    getRemainingTime() {
        if (!this.isActive) return 0;
        return Math.max(0, this.endTime - this.audioContext.currentTime);
    }

    /**
     * Release resources
     */
    dispose() {
        this.stop();

        try {
            this.envelope.disconnect();
            this.panner.disconnect();
            this.output.disconnect();
        } catch (e) {
            // Already disconnected
        }
    }
}
