/**
 * VASynthVoice - Single voice for Virtual Analog Synthesizer
 *
 * Extends BaseVoice - designed for voice pooling
 * NO polyphony logic - just sound generation
 *
 * Features:
 * - 3 Oscillators (already running, controlled via gain)
 * - Multi-mode filter with envelope
 * - ADSR amplitude envelope
 * - LFO modulation
 * - Portamento/glide support
 */

import { BaseVoice } from '../instruments/base/BaseVoice.js';
import { ADSREnvelope } from './ADSREnvelope.js';
import { LFO } from './LFO.js';

export class VASynthVoice extends BaseVoice {
    constructor(audioContext) {
        super(audioContext);

        // Audio nodes (created in initialize())
        this.oscillators = [null, null, null];
        this.oscillatorGains = [];
        this.filter = null;
        this.amplitudeGain = null;

        // Envelopes
        this.filterEnvelope = new ADSREnvelope(audioContext);
        this.amplitudeEnvelope = new ADSREnvelope(audioContext);

        // LFO
        this.lfo = new LFO(audioContext);

        // Voice parameters (loaded from preset)
        this.oscillatorSettings = [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.33,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -7,
                octave: 0,
                level: 0.33,
                pulseWidth: 0.5
            },
            {
                enabled: false,
                waveform: 'square',
                detune: 0,
                octave: -1,
                level: 0.33,
                pulseWidth: 0.5
            }
        ];

        this.filterSettings = {
            type: 'lowpass',
            cutoff: 2000,
            resonance: 1,
            envelopeAmount: 2000,
            velocitySensitivity: 0.5
        };
    }

    /**
     * Initialize voice - create permanent audio node graph
     * Oscillators start immediately but silent (controlled via amplitude gain)
     */
    initialize() {
        // Create oscillators (start immediately, always running)
        this.oscillatorSettings.forEach((settings, i) => {
            const osc = this.context.createOscillator();
            osc.type = settings.waveform;
            osc.frequency.setValueAtTime(440, this.context.currentTime); // Default A4
            osc.detune.setValueAtTime(settings.detune, this.context.currentTime);

            const oscGain = this.context.createGain();
            oscGain.gain.setValueAtTime(settings.enabled ? settings.level : 0, this.context.currentTime);

            osc.connect(oscGain);
            osc.start(0); // Start now, control via gain

            this.oscillators[i] = osc;
            this.oscillatorGains[i] = oscGain;
        });

        // Create filter
        this.filter = this.context.createBiquadFilter();
        this.filter.type = this.filterSettings.type;
        this.filter.frequency.setValueAtTime(this.filterSettings.cutoff, this.context.currentTime);
        this.filter.Q.setValueAtTime(this.filterSettings.resonance, this.context.currentTime);

        // Create amplitude gain (envelope control)
        this.amplitudeGain = this.context.createGain();
        this.amplitudeGain.gain.setValueAtTime(0, this.context.currentTime);

        // Create master output
        this.output = this.context.createGain();
        this.output.gain.setValueAtTime(0.7, this.context.currentTime);

        // Connect graph: oscillators → filter → ampGain → output
        this.oscillatorGains.forEach(oscGain => {
            oscGain.connect(this.filter);
        });

        this.filter.connect(this.amplitudeGain);
        this.amplitudeGain.connect(this.output);

        console.log('🎹 VASynthVoice initialized');
    }

    /**
     * Trigger note - start envelopes and set frequencies
     */
    trigger(midiNote, velocity, frequency, time) {
        this.isActive = true;
        this.currentNote = midiNote;
        this.currentVelocity = velocity;
        this.startTime = time;

        // Set oscillator frequencies
        this.oscillators.forEach((osc, i) => {
            if (!osc) return;

            const settings = this.oscillatorSettings[i];
            if (!settings.enabled) return;

            const octaveMultiplier = Math.pow(2, settings.octave);
            const targetFreq = frequency * octaveMultiplier;

            osc.frequency.setValueAtTime(targetFreq, time);
        });

        // Trigger filter envelope
        const baseCutoff = this.filterSettings.cutoff;
        const filterEnvAmount = this.filterSettings.envelopeAmount;

        this.filterEnvelope.triggerExponential(
            this.filter.frequency,
            time,
            baseCutoff,
            baseCutoff + filterEnvAmount,
            velocity
        );

        // Trigger amplitude envelope
        this.amplitudeEnvelope.trigger(
            this.amplitudeGain.gain,
            time,
            1.0,
            velocity
        );

        // Start LFO if enabled
        if (this.lfo && !this.lfo.isRunning) {
            this.lfo.start(time);
        }
    }

    /**
     * Release note - start envelope release phase
     * @returns {number} Release duration in seconds
     */
    release(time) {
        this.isActive = false;

        // Release envelopes
        if (this.filterEnvelope && this.filter) {
            this.filterEnvelope.release(this.filter.frequency, time);
        }

        let releaseEnd = time + 0.5; // Default

        if (this.amplitudeEnvelope && this.amplitudeGain) {
            releaseEnd = this.amplitudeEnvelope.release(this.amplitudeGain.gain, time);
        }

        // Return release duration
        return Math.max(0, releaseEnd - time);
    }

    /**
     * Reset voice to silent state (for voice pool reuse)
     * NO disposal - nodes persist!
     */
    reset() {
        super.reset();

        const now = this.context.currentTime;

        // Silence amplitude immediately
        if (this.amplitudeGain) {
            this.amplitudeGain.gain.cancelScheduledValues(now);
            this.amplitudeGain.gain.setValueAtTime(0, now);
        }

        // Reset filter
        if (this.filter) {
            this.filter.frequency.cancelScheduledValues(now);
            this.filter.frequency.setValueAtTime(this.filterSettings.cutoff, now);
        }

        // Stop LFO
        if (this.lfo && this.lfo.isRunning) {
            this.lfo.stop();
        }
    }

    /**
     * Dispose voice - cleanup audio nodes
     * Only called when destroying voice pool
     */
    dispose() {
        // Stop oscillators
        this.oscillators.forEach(osc => {
            if (osc) {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {
                    // Already stopped
                }
            }
        });

        // Disconnect nodes
        [
            ...this.oscillatorGains,
            this.filter,
            this.amplitudeGain,
            this.output
        ].forEach(node => {
            if (node) {
                try {
                    node.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            }
        });

        // Dispose LFO
        if (this.lfo) {
            this.lfo.dispose();
        }

        super.dispose();
    }

    /**
     * Get current amplitude (for voice stealing)
     */
    getAmplitude() {
        return this.amplitudeGain ? this.amplitudeGain.gain.value : 0;
    }

    /**
     * Glide to new frequency (portamento support)
     */
    glideToFrequency(fromFreq, toFreq, time, duration) {
        this.oscillators.forEach((osc, i) => {
            if (!osc) return;

            const settings = this.oscillatorSettings[i];
            if (!settings.enabled) return;

            const octaveMultiplier = Math.pow(2, settings.octave);
            const targetFreq = toFreq * octaveMultiplier;

            osc.frequency.cancelScheduledValues(time);
            osc.frequency.setValueAtTime(osc.frequency.value, time);
            osc.frequency.exponentialRampToValueAtTime(targetFreq, time + duration);
        });
    }

    /**
     * Load preset parameters into voice
     */
    loadPreset(preset) {
        if (preset.oscillators) {
            preset.oscillators.forEach((osc, i) => {
                if (i < this.oscillatorSettings.length) {
                    this.oscillatorSettings[i] = { ...this.oscillatorSettings[i], ...osc };

                    // Update oscillator if already created
                    if (this.oscillators[i]) {
                        this.oscillators[i].type = osc.waveform || this.oscillatorSettings[i].waveform;
                        this.oscillators[i].detune.setValueAtTime(
                            osc.detune !== undefined ? osc.detune : this.oscillatorSettings[i].detune,
                            this.context.currentTime
                        );

                        if (this.oscillatorGains[i]) {
                            const level = osc.enabled !== false ? (osc.level !== undefined ? osc.level : this.oscillatorSettings[i].level) : 0;
                            this.oscillatorGains[i].gain.setValueAtTime(level, this.context.currentTime);
                        }
                    }
                }
            });
        }

        if (preset.filter) {
            this.filterSettings = { ...this.filterSettings, ...preset.filter };

            if (this.filter) {
                this.filter.type = this.filterSettings.type;
                this.filter.frequency.setValueAtTime(this.filterSettings.cutoff, this.context.currentTime);
                this.filter.Q.setValueAtTime(this.filterSettings.resonance, this.context.currentTime);
            }
        }

        if (preset.filterEnvelope) {
            this.filterEnvelope.setParams(preset.filterEnvelope);
        }

        if (preset.amplitudeEnvelope) {
            this.amplitudeEnvelope.setParams(preset.amplitudeEnvelope);
        }

        if (preset.lfo && this.lfo) {
            this.lfo.setSettings(preset.lfo);
        }
    }
}
