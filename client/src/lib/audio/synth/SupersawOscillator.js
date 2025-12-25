/**
 * SupersawOscillator - Professional-grade supersaw implementation
 * 
 * Features:
 * - 1-7 unison voices
 * - Serum-style exponential detune
 * - Stereo spread
 * - Phase-coherent mixing
 * 
 * Based on:
 * - Roland JP-8000 supersaw
 * - Serum supersaw algorithm
 * - Sylenth1 unison
 */

export class SupersawOscillator {
    /**
     * Create a supersaw oscillator
     * @param {AudioContext} audioContext - Web Audio context
     * @param {number} baseFrequency - Base frequency in Hz
     * @param {Object} options - Configuration options
     */
    constructor(audioContext, baseFrequency, options = {}) {
        this.context = audioContext;
        this.baseFrequency = baseFrequency;

        // Unison settings
        this.voices = options.voices || 7;           // 1-7 voices
        this.detune = options.detune || 50;          // 0-100 cents
        this.spread = options.spread || 50;          // 0-100 stereo width

        // Audio nodes
        this.oscillators = [];
        this.gains = [];
        this.panners = [];

        // Output node
        this.output = audioContext.createGain();
        this.output.gain.value = 1.0;

        // State
        this.isStarted = false;
        this.startTime = null;
    }

    /**
     * Start the supersaw oscillator
     * @param {number} time - Start time in AudioContext time
     */
    start(time = null) {
        if (this.isStarted) {
            console.warn('SupersawOscillator already started');
            return;
        }

        const startTime = time !== null ? time : this.context.currentTime;
        this.startTime = startTime;

        // Create voices
        for (let i = 0; i < this.voices; i++) {
            this._createVoice(i, startTime);
        }

        this.isStarted = true;

        console.log(`🎵 Supersaw started: ${this.voices} voices, detune: ${this.detune}, spread: ${this.spread}`);
    }

    /**
     * Create a single voice
     * @private
     */
    _createVoice(voiceIndex, time) {
        // Create oscillator
        const osc = this.context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = this.baseFrequency;

        // ✅ DETUNE: Serum-style exponential algorithm
        const detuneAmount = this._calculateDetune(voiceIndex);
        osc.detune.value = detuneAmount;

        // ✅ STEREO SPREAD: Pan voices across stereo field
        const panner = this.context.createStereoPanner();
        const panAmount = this._calculatePan(voiceIndex);
        panner.pan.value = panAmount;

        // ✅ GAIN: Compensate for multiple voices
        const gain = this.context.createGain();
        // Use sqrt for power-compensated mixing
        gain.gain.value = Math.sqrt(1 / this.voices);

        // Connect: Osc → Panner → Gain → Output
        osc.connect(panner);
        panner.connect(gain);
        gain.connect(this.output);

        // Start oscillator
        osc.start(time);

        // Store references
        this.oscillators.push(osc);
        this.panners.push(panner);
        this.gains.push(gain);
    }

    /**
     * Calculate detune for a voice using Serum-style algorithm
     * @private
     */
    _calculateDetune(voiceIndex) {
        if (this.voices === 1) {
            return 0; // No detune for single voice
        }

        // ✅ SERUM ALGORITHM: Symmetric detune around center
        const center = (this.voices - 1) / 2;
        const offset = voiceIndex - center;

        // Exponential curve for more natural spread
        // Center voice (offset = 0) has no detune
        // Outer voices have maximum detune
        const normalizedOffset = offset / center; // -1 to +1

        // Apply exponential curve for better phase coherence
        // y = x^1.5 gives a nice curve between linear and quadratic
        const sign = Math.sign(normalizedOffset);
        const curve = Math.pow(Math.abs(normalizedOffset), 1.5);
        const curvedOffset = sign * curve;

        // Scale by detune amount
        const detuneCents = curvedOffset * this.detune;

        return detuneCents;
    }

    /**
     * Calculate stereo pan for a voice
     * @private
     */
    _calculatePan(voiceIndex) {
        if (this.voices === 1) {
            return 0; // Center for single voice
        }

        // ✅ STEREO SPREAD: Linear spread across stereo field
        const normalizedIndex = voiceIndex / (this.voices - 1); // 0 to 1
        const panPosition = (normalizedIndex - 0.5) * 2; // -1 to +1

        // Scale by spread amount (0-100 → 0-1)
        return panPosition * (this.spread / 100);
    }

    /**
     * Stop the supersaw oscillator
     * @param {number} time - Stop time in AudioContext time
     */
    stop(time = null) {
        if (!this.isStarted) {
            return;
        }

        const stopTime = time !== null ? time : this.context.currentTime;

        // Stop all oscillators
        this.oscillators.forEach((osc, i) => {
            try {
                osc.stop(stopTime);
            } catch (e) {
                console.warn(`Failed to stop oscillator ${i}:`, e);
            }
        });

        this.isStarted = false;
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        // Disconnect all nodes
        this.oscillators.forEach(osc => {
            try {
                osc.disconnect();
            } catch (e) {
                // Already disconnected
            }
        });

        this.panners.forEach(panner => {
            try {
                panner.disconnect();
            } catch (e) {
                // Already disconnected
            }
        });

        this.gains.forEach(gain => {
            try {
                gain.disconnect();
            } catch (e) {
                // Already disconnected
            }
        });

        try {
            this.output.disconnect();
        } catch (e) {
            // Already disconnected
        }

        // Clear arrays
        this.oscillators = [];
        this.panners = [];
        this.gains = [];
    }

    /**
     * Update detune amount in real-time
     * @param {number} detune - New detune amount (0-100 cents)
     */
    setDetune(detune) {
        this.detune = Math.max(0, Math.min(100, detune));

        // Update all oscillators
        this.oscillators.forEach((osc, i) => {
            const detuneAmount = this._calculateDetune(i);
            osc.detune.setValueAtTime(detuneAmount, this.context.currentTime);
        });
    }

    /**
     * Update stereo spread in real-time
     * @param {number} spread - New spread amount (0-100)
     */
    setSpread(spread) {
        this.spread = Math.max(0, Math.min(100, spread));

        // Update all panners
        this.panners.forEach((panner, i) => {
            const panAmount = this._calculatePan(i);
            panner.pan.setValueAtTime(panAmount, this.context.currentTime);
        });
    }

    /**
     * Update frequency (for portamento/glide)
     * @param {number} frequency - New frequency in Hz
     * @param {number} time - Time to reach new frequency
     * @param {number} glideTime - Glide duration in seconds
     */
    setFrequency(frequency, time = null, glideTime = 0) {
        const when = time !== null ? time : this.context.currentTime;
        this.baseFrequency = frequency;

        this.oscillators.forEach(osc => {
            if (glideTime > 0.001) {
                // Smooth glide
                osc.frequency.cancelScheduledValues(when);
                osc.frequency.setValueAtTime(osc.frequency.value, when);
                osc.frequency.exponentialRampToValueAtTime(frequency, when + glideTime);
            } else {
                // Instant change
                osc.frequency.setValueAtTime(frequency, when);
            }
        });
    }

    /**
     * Get current settings
     */
    getSettings() {
        return {
            voices: this.voices,
            detune: this.detune,
            spread: this.spread,
            baseFrequency: this.baseFrequency,
            isStarted: this.isStarted
        };
    }
}

export default SupersawOscillator;
