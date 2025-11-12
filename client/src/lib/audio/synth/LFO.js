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
        
        // ✅ TEMPO SYNC: Tempo sync settings
        this.tempoSync = false; // Enable tempo sync
        this.tempoSyncRate = '1/4'; // Rate division (1/64, 1/32, 1/16, 1/8, 1/4, 1/2, 1, 2, 4)
        this.bpm = 120; // Current BPM (updated from transport)

        // Connections
        this.connectedParams = new Set();
        this.depthGainNodes = new Map(); // param -> depthGain node (for proper disconnect)
        
        // ✅ MODULATION MATRIX: For reading current LFO value analytically
        this.currentValue = 0; // Cached current value with depth (-1 to 1)
        this.currentRawValue = 0; // Cached raw waveform value (-1 to 1)
        this.phase = 0;
        this.lastUpdateTime = null;
        this.valueUpdateRAF = null;
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

        // Connect oscillator to gain
        this.oscillator.connect(this.gainNode);

        // ✅ MODULATION MATRIX: Reset phase and start value updates
        this.phase = 0;
        this.lastUpdateTime = time;
        this._startValueUpdates();

        // Start oscillator
        this.oscillator.start(time);
        this.isRunning = true;
    }
    
    /**
     * ✅ MODULATION MATRIX: Get current LFO value (-1 to 1)
     * @returns {number} Current LFO output value
     */
    getCurrentValue() {
        if (!this.isRunning) {
            return 0;
        }
        return this.currentValue;
    }
    
    /**
     * ✅ MODULATION MATRIX: Get raw waveform value (-1 to 1) independent of depth
     * @returns {number} Current raw LFO output
     */
    getRawValue() {
        if (!this.isRunning) {
            return 0;
        }
        return this.currentRawValue;
    }
    
    /**
     * ✅ MODULATION MATRIX: Start periodic value updates (analytic)
     */
    _startValueUpdates() {
        const raf = (typeof window !== 'undefined' && window.requestAnimationFrame)
            ? window.requestAnimationFrame.bind(window)
            : (cb) => setTimeout(cb, 16);
        const cancelRaf = (typeof window !== 'undefined' && window.cancelAnimationFrame)
            ? window.cancelAnimationFrame.bind(window)
            : clearTimeout;
        
        const updateValue = () => {
            if (!this.isRunning) {
                this.valueUpdateRAF = null;
                return;
            }
            
            const currentTime = this.context.currentTime;
            if (this.lastUpdateTime === null) {
                this.lastUpdateTime = currentTime;
            }
            const deltaTime = Math.max(0, currentTime - this.lastUpdateTime);
            this.lastUpdateTime = currentTime;
            
            // Advance phase
            this.phase += 2 * Math.PI * this.frequency * deltaTime;
            this.phase %= (2 * Math.PI);
            
            // Compute waveform sample (-1 to 1)
            let rawValue = 0;
            const phaseNorm = this.phase / (2 * Math.PI); // 0..1
            switch (this.waveform) {
                case 'square':
                    rawValue = this.phase < Math.PI ? 1 : -1;
                    break;
                case 'sawtooth':
                    rawValue = 2 * (phaseNorm - Math.floor(phaseNorm + 0.5));
                    break;
                case 'triangle': {
                    const saw = 2 * (phaseNorm - Math.floor(phaseNorm + 0.5));
                    rawValue = Math.abs(saw) * 2 - 1;
                    break;
                }
                case 'sine':
                default:
                    rawValue = Math.sin(this.phase);
                    break;
            }
            
            // Cache values
            this.currentRawValue = rawValue;
            this.currentValue = rawValue * this.depth;
            
            this.valueUpdateRAF = raf(updateValue);
        };
        
        if (this.valueUpdateRAF) {
            cancelRaf(this.valueUpdateRAF);
        }
        this.valueUpdateRAF = raf(updateValue);
    }
    
    /**
     * ✅ MODULATION MATRIX: Stop periodic value updates
     */
    _stopValueUpdates() {
        const cancelRaf = (typeof window !== 'undefined' && window.cancelAnimationFrame)
            ? window.cancelAnimationFrame.bind(window)
            : clearTimeout;
        
        if (this.valueUpdateRAF) {
            cancelRaf(this.valueUpdateRAF);
            this.valueUpdateRAF = null;
        }
        this.lastUpdateTime = null;
        this.currentRawValue = 0;
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
                // ✅ LFO PLAYBACK: Use tracked depthGain nodes for proper disconnect
                const depthGain = this.depthGainNodes.get(param);
                if (depthGain) {
                    this.gainNode.disconnect(depthGain);
                    depthGain.disconnect(param);
                } else {
                    this.gainNode.disconnect(param);
                }
            } catch (e) {
                // Already disconnected
            }
        });

        this.connectedParams.clear();
        this.depthGainNodes.clear();
        this.oscillator = null;
        this.gainNode = null;
        this._stopValueUpdates();
        this.currentValue = 0;
        this.currentRawValue = 0;
        this.phase = 0;
        this.lastUpdateTime = null;
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

        // ✅ LFO PLAYBACK: Check if already connected to avoid duplicate connections
        if (this.connectedParams.has(param)) {
            // Already connected - disconnect first to reconnect with new amount
            this.disconnect(param);
        }

        // Adjust depth for this specific connection
        const depthGain = this.context.createGain();
        depthGain.gain.setValueAtTime(amount, this.context.currentTime);

        this.gainNode.connect(depthGain);
        depthGain.connect(param);

        // ✅ LFO PLAYBACK: Track depthGain node for proper disconnect
        this.connectedParams.add(param);
        this.depthGainNodes.set(param, depthGain);
    }

    /**
     * Disconnect from a specific AudioParam
     * ✅ LFO PLAYBACK: Improved disconnect to handle depthGain nodes
     */
    disconnect(param) {
        if (!this.gainNode) return;

        try {
            // ✅ LFO PLAYBACK: Disconnect specific depthGain node if tracked
            const depthGain = this.depthGainNodes.get(param);
            if (depthGain) {
                this.gainNode.disconnect(depthGain);
                depthGain.disconnect(param);
                this.depthGainNodes.delete(param);
            } else {
                // Fallback: Try direct disconnect
                this.gainNode.disconnect(param);
            }
            
            this.connectedParams.delete(param);
        } catch (e) {
            // Not connected or already disconnected
        }
    }

    /**
     * Calculate frequency from tempo sync rate
     * @param {number} bpm - Current BPM
     * @param {string} rate - Rate division (e.g., '1/4', '1/8', '2')
     * @returns {number} Calculated frequency in Hz
     */
    calculateTempoSyncFrequency(bpm, rate) {
        // Parse rate: '1/64', '1/32', '1/16', '1/8', '1/4', '1/2', '1', '2', '4'
        let beatsPerCycle = 1;
        
        if (rate.includes('/')) {
            const [numerator, denominator] = rate.split('/').map(Number);
            beatsPerCycle = numerator / denominator;
        } else {
            beatsPerCycle = Number(rate);
        }
        
        // Convert to cycles per second (Hz)
        // 1 beat = 60/BPM seconds
        // 1 cycle = beatsPerCycle * (60/BPM) seconds
        // Frequency = 1 / cycle duration = BPM / (60 * beatsPerCycle)
        const frequency = bpm / (60 * beatsPerCycle);
        
        return Math.max(0.01, Math.min(20, frequency));
    }

    /**
     * Set LFO frequency (manual or tempo sync)
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
     * ✅ TEMPO SYNC: Set tempo sync enabled
     */
    setTempoSync(enabled, bpm = null, rate = null) {
        this.tempoSync = enabled;
        
        if (bpm !== null) {
            this.bpm = bpm;
        }
        
        if (rate !== null) {
            this.tempoSyncRate = rate;
        }
        
        // ✅ TEMPO SYNC: Recalculate frequency if tempo sync is enabled
        if (this.tempoSync) {
            const calculatedFreq = this.calculateTempoSyncFrequency(this.bpm, this.tempoSyncRate);
            this.setFrequency(calculatedFreq);
        }
    }
    
    /**
     * ✅ TEMPO SYNC: Update BPM (called when transport BPM changes)
     */
    updateBPM(bpm) {
        this.bpm = bpm;
        
        // ✅ TEMPO SYNC: Recalculate frequency if tempo sync is enabled
        if (this.tempoSync) {
            const calculatedFreq = this.calculateTempoSyncFrequency(this.bpm, this.tempoSyncRate);
            this.setFrequency(calculatedFreq);
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
            isRunning: this.isRunning,
            tempoSync: this.tempoSync, // ✅ TEMPO SYNC
            tempoSyncRate: this.tempoSyncRate, // ✅ TEMPO SYNC
            bpm: this.bpm // ✅ TEMPO SYNC
        };
    }

    /**
     * Set multiple settings at once
     */
    setSettings({ frequency, depth, waveform, tempoSync, tempoSyncRate, bpm }) {
        if (frequency !== undefined) this.setFrequency(frequency);
        if (depth !== undefined) this.setDepth(depth);
        if (waveform !== undefined) this.setWaveform(waveform);
        
        // ✅ TEMPO SYNC: Handle tempo sync settings
        if (tempoSync !== undefined || tempoSyncRate !== undefined || bpm !== undefined) {
            this.setTempoSync(
                tempoSync !== undefined ? tempoSync : this.tempoSync,
                bpm !== undefined ? bpm : this.bpm,
                tempoSyncRate !== undefined ? tempoSyncRate : this.tempoSyncRate
            );
        }
    }

    /**
     * Cleanup
     */
    dispose() {
        this.stop();
        this.connectedParams.clear();
        this._stopValueUpdates();
        this.currentValue = 0;
        this.currentRawValue = 0;
    }
}
