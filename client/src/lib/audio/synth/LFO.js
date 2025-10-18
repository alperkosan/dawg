/**
 * LFO (Low Frequency Oscillator) - Native Web Audio implementation
 * For modulation of synth parameters (vibrato, tremolo, filter sweep, etc.)
 */
export class LFO {
    constructor(audioContext) {
        this.context = audioContext;
        this.oscillator = null;
        this.gainNode = null;

        // LFO settings
        this.frequency = 4; // Hz
        this.depth = 0.5;   // 0-1
        this.waveform = 'sine'; // sine, square, sawtooth, triangle
        this.isRunning = false;

        // Connections
        this.connectedParams = new Set();
    }

    /**
     * Start the LFO
     */
    start(startTime = null) {
        if (this.isRunning) return;

        const time = startTime !== null ? startTime : this.context.currentTime;

        // Create oscillator
        this.oscillator = this.context.createOscillator();
        this.oscillator.type = this.waveform;
        this.oscillator.frequency.setValueAtTime(this.frequency, time);

        // Create gain node for depth control
        this.gainNode = this.context.createGain();
        this.gainNode.gain.setValueAtTime(this.depth, time);

        // Connect
        this.oscillator.connect(this.gainNode);

        // Start oscillator
        this.oscillator.start(time);
        this.isRunning = true;
    }

    /**
     * Stop the LFO
     */
    stop(stopTime = null) {
        if (!this.isRunning || !this.oscillator) return;

        const time = stopTime !== null ? stopTime : this.context.currentTime;

        try {
            this.oscillator.stop(time);
        } catch (e) {
            // Already stopped
        }

        // Disconnect all
        this.connectedParams.forEach(param => {
            try {
                this.gainNode.disconnect(param);
            } catch (e) {
                // Already disconnected
            }
        });

        this.connectedParams.clear();
        this.oscillator = null;
        this.gainNode = null;
        this.isRunning = false;
    }

    /**
     * Connect LFO to an AudioParam
     * @param {AudioParam} param - Parameter to modulate (e.g., filter frequency)
     * @param {number} amount - Modulation amount (depth multiplier)
     */
    connect(param, amount = 1) {
        if (!this.isRunning) {
            console.warn('LFO must be started before connecting');
            return;
        }

        // Adjust depth for this specific connection
        const depthGain = this.context.createGain();
        depthGain.gain.setValueAtTime(amount, this.context.currentTime);

        this.gainNode.connect(depthGain);
        depthGain.connect(param);

        this.connectedParams.add(param);
    }

    /**
     * Disconnect from a specific AudioParam
     */
    disconnect(param) {
        if (!this.gainNode) return;

        try {
            this.gainNode.disconnect(param);
            this.connectedParams.delete(param);
        } catch (e) {
            // Not connected
        }
    }

    /**
     * Set LFO frequency
     */
    setFrequency(frequency) {
        this.frequency = Math.max(0.01, Math.min(20, frequency));

        if (this.oscillator) {
            this.oscillator.frequency.setValueAtTime(
                this.frequency,
                this.context.currentTime
            );
        }
    }

    /**
     * Set LFO depth
     */
    setDepth(depth) {
        this.depth = Math.max(0, Math.min(1, depth));

        if (this.gainNode) {
            this.gainNode.gain.setValueAtTime(
                this.depth,
                this.context.currentTime
            );
        }
    }

    /**
     * Set LFO waveform
     */
    setWaveform(waveform) {
        const validWaveforms = ['sine', 'square', 'sawtooth', 'triangle'];
        if (!validWaveforms.includes(waveform)) {
            console.warn('Invalid waveform:', waveform);
            return;
        }

        this.waveform = waveform;

        if (this.oscillator) {
            this.oscillator.type = waveform;
        }
    }

    /**
     * Sync LFO phase to a specific time
     */
    syncPhase(phase = 0) {
        // Phase sync requires recreating the oscillator
        // Store current state
        const wasRunning = this.isRunning;
        const currentFreq = this.frequency;
        const currentDepth = this.depth;
        const currentWaveform = this.waveform;

        if (wasRunning) {
            this.stop();
        }

        // Restart with phase offset
        // Note: Web Audio doesn't support phase directly,
        // so we use a delay to simulate phase offset
        const phaseDelay = phase / (2 * Math.PI * this.frequency);

        if (wasRunning) {
            this.start(this.context.currentTime + phaseDelay);
        }
    }

    /**
     * Get current settings
     */
    getSettings() {
        return {
            frequency: this.frequency,
            depth: this.depth,
            waveform: this.waveform,
            isRunning: this.isRunning
        };
    }

    /**
     * Set multiple settings at once
     */
    setSettings({ frequency, depth, waveform }) {
        if (frequency !== undefined) this.setFrequency(frequency);
        if (depth !== undefined) this.setDepth(depth);
        if (waveform !== undefined) this.setWaveform(waveform);
    }

    /**
     * Cleanup
     */
    dispose() {
        this.stop();
        this.connectedParams.clear();
    }
}
