/**
 * ZenithSynth - Premium Virtual Analog Synthesizer
 * 
 * Features:
 * - 4 Oscillators (VA waveforms + PWM + Supersaw + Noise)
 * - Advanced Filter (10+ types, drive, key tracking)
 * - 4 LFOs (tempo-synced)
 * - Modulation Matrix (16 slots)
 * - DAHDSR Envelopes (Filter + Amplitude)
 * - Built-in Effects
 */

import { ADSREnvelope } from './ADSREnvelope.js';
import { LFO } from './LFO.js';
import { ModulationEngine, ModulationSourceType } from './modulation/ModulationEngine.js';
import { SupersawOscillator } from './SupersawOscillator.js';

export class ZenithSynth {
    constructor(audioContext, bpm = 120) {
        this.context = audioContext;
        this.isPlaying = false;
        this.bpm = bpm;

        // Audio nodes
        this.oscillators = [null, null, null, null]; // 4 oscillators
        this.oscillatorGains = [];
        this.filter = null;
        this.filterDrive = null;
        this.amplitudeGain = null;

        // Master gain
        this.masterGain = this.context.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.context.currentTime);

        // Envelopes (DAHDSR)
        this.filterEnvelope = new ADSREnvelope(audioContext);
        this.amplitudeEnvelope = new ADSREnvelope(audioContext);

        // 4 LFOs
        this.lfos = [
            new LFO(audioContext),
            new LFO(audioContext),
            new LFO(audioContext),
            new LFO(audioContext)
        ];

        // Modulation Matrix
        this.modulationEngine = new ModulationEngine(audioContext, 16);
        this.modulationTargets = new Map();

        // Setup modulation callback
        this.modulationEngine.onModulationUpdate = (modulationMap) => {
            this._applyModulation(modulationMap);
        };

        // ✅ MODULATION MATRIX: Register sources
        this.modulationEngine.setLFOs(this.lfos);
        this.modulationEngine.setEnvelopes(this.filterEnvelope, this.amplitudeEnvelope);

        // Synth parameters
        this.masterVolume = 0.7;
        this._cleanupTimer = null;

        // Voice mode
        this.voiceMode = 'poly'; // 'mono' or 'poly'
        this.portamento = 0.0;
        this.legato = false;
        this.lastPlayedFreq = null;

        // 4 Oscillator settings
        this.oscillatorSettings = [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -7,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'square',
                detune: 0,
                octave: -1,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            }
        ];

        // Advanced Filter settings
        this.filterSettings = {
            type: 'lowpass',      // lowpass, highpass, bandpass, notch, lowpass24, highpass24
            cutoff: 2000,
            resonance: 1,
            envelopeAmount: 2000,
            velocitySensitivity: 0.5,
            keyTracking: 0,       // 0-1
            drive: 0              // 0-1
        };

        // Current note info
        this.currentNote = null;
        this.currentVelocity = 100;
        this.currentBaseFrequency = 0;
    }

    /**
     * Calculate frequency from MIDI note
     */
    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    /**
     * Start playing a note
     */
    noteOn(midiNote, velocity = 100, startTime = null, extendedParams = null) {
        const time = startTime !== null ? startTime : this.context.currentTime;
        this._cancelCleanupTimer();

        // Update MIDI sources
        let aftertouch = 0;
        let modWheel = 0;
        if (extendedParams) {
            aftertouch = extendedParams.aftertouch || 0;
            modWheel = extendedParams.modWheel || 0;
        }
        if (this.modulationEngine) {
            this.modulationEngine.setMIDISources(velocity, aftertouch, modWheel);
        }

        const baseFrequency = this.midiToFrequency(midiNote);
        this.currentBaseFrequency = baseFrequency;

        // Check if in cleanup phase
        const isInCleanupPhase = !this.isPlaying &&
            this.oscillators &&
            this.oscillators.some(osc => osc !== null && osc !== undefined);

        // Monophonic mode with portamento
        if (this.isPlaying && this.voiceMode === 'mono' && !isInCleanupPhase) {
            const glideTime = this.portamento;

            this.oscillators.forEach((osc, i) => {
                if (!osc) return;

                const settings = this.oscillatorSettings[i];
                const octaveMultiplier = Math.pow(2, settings.octave);
                const targetFreq = baseFrequency * octaveMultiplier;

                if (Array.isArray(osc)) {
                    osc.forEach(o => {
                        if (glideTime > 0.001) {
                            o.frequency.cancelScheduledValues(time);
                            o.frequency.setValueAtTime(o.frequency.value, time);
                            o.frequency.exponentialRampToValueAtTime(targetFreq, time + glideTime);
                        } else {
                            o.frequency.setValueAtTime(targetFreq, time);
                        }
                    });
                } else if (osc.setFrequency) {
                    // Supersaw oscillator
                    osc.setFrequency(targetFreq, glideTime > 0.001 ? time + glideTime : time);
                } else {
                    if (glideTime > 0.001) {
                        osc.frequency.cancelScheduledValues(time);
                        osc.frequency.setValueAtTime(osc.frequency.value, time);
                        osc.frequency.exponentialRampToValueAtTime(targetFreq, time + glideTime);
                    } else {
                        osc.frequency.setValueAtTime(targetFreq, time);
                    }
                }
            });

            // Retrigger envelopes if not legato UNLESS they are already in release phase
            // (e.g. after a loop restart or rapid retrigger where the voice was previously released)
            const shouldRetrigger = !this.legato || (this.amplitudeEnvelope && this.amplitudeEnvelope.isReleased);

            if (shouldRetrigger) {
                if (import.meta.env.DEV && this.legato && this.amplitudeEnvelope.isReleased) {
                    console.log(`🎹 ZenithSynth: Legato retrigger enforced because envelope was released.`);
                }
                const baseCutoff = this.filterSettings.cutoff;
                const filterEnvAmount = this.filterSettings.envelopeAmount;

                this.filterEnvelope.triggerExponential(
                    this.filter.frequency,
                    time,
                    baseCutoff,
                    baseCutoff + filterEnvAmount,
                    velocity
                );

                this.amplitudeEnvelope.trigger(
                    this.amplitudeGain.gain,
                    time,
                    1.0,
                    velocity
                );
            }

            this.currentNote = midiNote;
            this.currentVelocity = velocity;
            this.lastPlayedFreq = baseFrequency;
            return;
        }

        // Polyphonic mode or first note
        if (isInCleanupPhase) {
            if (import.meta.env.DEV) console.log(`🎹 ZenithSynth: In cleanup phase, performing cleanup before new note.`);
            this.cleanup();
        } else if (this.isPlaying) {
            if (import.meta.env.DEV) console.log(`🎹 ZenithSynth: Polyphonic mode, stopping previous note before new note.`);
            this.noteOff(time);
            this._cancelCleanupTimer();
        } else {
            if (import.meta.env.DEV) console.log(`🎹 ZenithSynth: First note or polyphonic mode, creating new voice.`);
        }

        this.currentNote = midiNote;
        this.currentVelocity = velocity;
        this.lastPlayedFreq = baseFrequency;

        // Create oscillators
        this.oscillatorSettings.forEach((settings, i) => {
            if (!settings.enabled) {
                if (import.meta.env.DEV) console.log(`🎹 ZenithSynth: Oscillator ${i} disabled.`);
                return;
            }

            const octaveMultiplier = Math.pow(2, settings.octave);
            const frequency = baseFrequency * octaveMultiplier;

            if (import.meta.env.DEV) console.log(`🎹 ZenithSynth: Creating oscillator ${i} (waveform: ${settings.waveform}, freq: ${frequency.toFixed(2)} Hz, detune: ${settings.detune}).`);

            // PWM (Pulse Width Modulation)
            if (settings.waveform === 'square' && settings.pulseWidth !== undefined && settings.pulseWidth !== 0.5) {
                const osc1 = this.context.createOscillator();
                const osc2 = this.context.createOscillator();
                osc1.type = 'square';
                osc2.type = 'square';

                osc1.frequency.setValueAtTime(frequency, time);
                osc2.frequency.setValueAtTime(frequency, time);

                osc1.detune.setValueAtTime(settings.detune, time);
                osc2.detune.setValueAtTime(settings.detune, time);

                const pulseWidth = Math.max(0.01, Math.min(0.99, settings.pulseWidth));
                const mix1 = pulseWidth;
                const mix2 = 1 - pulseWidth;

                const gain1 = this.context.createGain();
                const gain2 = this.context.createGain();
                const mixGain = this.context.createGain();

                gain1.gain.setValueAtTime(mix1 * settings.level, time);
                gain2.gain.setValueAtTime(mix2 * settings.level, time);
                mixGain.gain.setValueAtTime(1.0, time);

                osc1.connect(gain1);
                osc2.connect(gain2);
                gain1.connect(mixGain);
                gain2.connect(mixGain);

                osc1.start(time);
                osc2.start(time);

                this.oscillators[i] = [osc1, osc2];
                this.oscillatorGains[i] = mixGain;
            }
            // Supersaw
            else if (settings.waveform === 'supersaw') {
                const supersaw = new SupersawOscillator(
                    this.context,
                    frequency,
                    {
                        voices: settings.unisonVoices || 7,
                        detune: settings.unisonDetune || 50,
                        spread: settings.unisonSpread || 50
                    }
                );

                const oscGain = this.context.createGain();
                oscGain.gain.setValueAtTime(settings.level, time);

                supersaw.output.connect(oscGain);
                supersaw.start(time);

                this.oscillators[i] = supersaw;
                this.oscillatorGains[i] = oscGain;
            }
            // Noise
            else if (settings.waveform === 'noise') {
                const noiseBuffer = this._createNoiseBuffer();
                const noiseSource = this.context.createBufferSource();
                noiseSource.buffer = noiseBuffer;
                noiseSource.loop = true;

                const oscGain = this.context.createGain();
                oscGain.gain.setValueAtTime(settings.level, time);

                noiseSource.connect(oscGain);
                noiseSource.start(time);

                this.oscillators[i] = noiseSource;
                this.oscillatorGains[i] = oscGain;
            }
            // Standard oscillator
            else {
                const osc = this.context.createOscillator();
                osc.type = settings.waveform;
                osc.frequency.setValueAtTime(frequency, time);
                osc.detune.setValueAtTime(settings.detune, time);

                const oscGain = this.context.createGain();
                oscGain.gain.setValueAtTime(settings.level, time);

                osc.connect(oscGain);
                osc.start(time);

                this.oscillators[i] = osc;
                this.oscillatorGains[i] = oscGain;
            }
        });
        if (import.meta.env.DEV) console.log(`🎹 ZenithSynth: All oscillators created.`);

        // Create filter
        this.filter = this.context.createBiquadFilter();
        this.filter.type = this.filterSettings.type.includes('24') ?
            this.filterSettings.type.replace('24', '') :
            this.filterSettings.type;
        this.filter.Q.setValueAtTime(this.filterSettings.resonance, time);

        // Apply key tracking
        let baseCutoff = this.filterSettings.cutoff;
        const keyTrackingAmount = this.filterSettings.keyTracking || 0;
        if (keyTrackingAmount > 0) {
            const noteFrequency = this.midiToFrequency(midiNote);
            const baseFrequency = this.midiToFrequency(60); // C4
            const frequencyRatio = noteFrequency / baseFrequency;
            const keyTrackingOffset = (frequencyRatio - 1) * keyTrackingAmount * baseCutoff * 0.5;
            baseCutoff = Math.max(20, Math.min(20000, baseCutoff + keyTrackingOffset));
        }

        this.filter.frequency.setValueAtTime(baseCutoff, time);

        // Create amplitude gain
        this.amplitudeGain = this.context.createGain();
        this.amplitudeGain.gain.setValueAtTime(0, time);

        // Filter drive
        if (this.filterSettings.drive > 0.001) {
            this.filterDrive = this.context.createWaveShaper();
            this.filterDrive.curve = this._createDriveCurve(this.filterSettings.drive);
            this.filterDrive.oversample = '4x';

            this.oscillatorGains.forEach(oscGain => {
                if (oscGain) oscGain.connect(this.filterDrive);
            });
            this.filterDrive.connect(this.filter);
        } else {
            this.oscillatorGains.forEach(oscGain => {
                if (oscGain) oscGain.connect(this.filter);
            });
        }

        this.filter.connect(this.amplitudeGain);
        this.amplitudeGain.connect(this.masterGain);
        if (import.meta.env.DEV) console.log(`🎹 ZenithSynth: Final connections made: Filter -> AmplitudeGain -> MasterGain.`);

        // Trigger envelopes
        const filterEnvAmount = this.filterSettings.envelopeAmount;
        const peakCutoff = Math.max(20, Math.min(24000, baseCutoff + filterEnvAmount));

        this.filterEnvelope.triggerExponential(
            this.filter.frequency,
            time,
            baseCutoff,
            peakCutoff,
            velocity
        );

        this.amplitudeEnvelope.trigger(
            this.amplitudeGain.gain,
            time,
            1.0,
            velocity
        );

        // Start LFOs
        this.lfos.forEach((lfo, index) => {
            if (lfo.frequency > 0 && lfo.depth > 0) {
                if (lfo.isRunning) lfo.stop();
                if (lfo.tempoSync && this.bpm) {
                    lfo.updateBPM(this.bpm);
                }
                lfo.start(time);
            }
        });

        // Register modulation targets
        this._registerModulationTargets();

        // Start modulation updates
        if (this.modulationEngine && !this.modulationEngine.updateInterval) {
            this.modulationEngine.startUpdates();
        }

        this.isPlaying = true;
    }

    /**
     * Stop playing
     */
    noteOff(stopTime = null) {
        if (!this.isPlaying) return;

        const time = stopTime !== null ? stopTime : this.context.currentTime;

        try {
            if (this.filterEnvelope && this.filter && this.filter.frequency) {
                this.filterEnvelope.release(this.filter.frequency, time);
            }

            let releaseEnd = time + 0.5;
            if (this.amplitudeEnvelope && this.amplitudeGain && this.amplitudeGain.gain) {
                releaseEnd = this.amplitudeEnvelope.release(this.amplitudeGain.gain, time);
            }

            // Stop oscillators
            this.oscillators.forEach((osc, i) => {
                if (osc) {
                    try {
                        const stopAt = releaseEnd + 0.1;
                        if (Array.isArray(osc)) {
                            osc.forEach(o => o && o.stop(stopAt));
                        } else if (osc.stop) {
                            osc.stop(stopAt);
                        }
                    } catch (e) {
                        // Already stopped
                    }
                }
            });

            // Stop LFOs
            this.lfos.forEach(lfo => {
                if (lfo.isRunning) lfo.stop();
            });

            // ✅ OFFLINE RENDER FIX: Don't use setTimeout for cleanup in offline context
            // The virtual clock moves too fast, causing premature cleanup/silence.
            if (this.context instanceof (window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
                this.isPlaying = false;
                return;
            }

            // Schedule cleanup for real-time
            this._cancelCleanupTimer();
            const cleanupDelay = Math.max(0, (releaseEnd - this.context.currentTime + 0.2) * 1000);
            this._cleanupTimer = setTimeout(() => {
                if (!this.isPlaying) {
                    this.cleanup();
                }
            }, cleanupDelay);

            this.isPlaying = false;
        } catch (error) {
            this._cancelCleanupTimer();
            this.cleanup();
            this.isPlaying = false;
        }
    }

    /**
     * ✅ LOOP CONTINUITY: Handle loop restart by cancelling cleanup and maintaining mono state
     * This is called by ZenithSynthInstrument.onLoopRestart()
     */
    onLoopRestart(loopStartTime) {
        // 1. Prevent cleanup! The loop restarted, so this voice should stay alive
        this._cancelCleanupTimer();

        // 2. Resume playing state for mono voices to allow subsequent noteOn/noteOff calls
        // to work correctly on the same voice instance during the handshake
        if (this.voiceMode === 'mono' && this.oscillators.some(osc => !!osc)) {
            this.isPlaying = true;
        }

        if (import.meta.env.DEV) {
            console.log(`🎹 ZenithSynth.onLoopRestart: cleanup cancelled, isPlaying=${this.isPlaying}`);
        }
    }

    /**
     * Cleanup audio nodes
     */
    cleanup() {
        this._cancelCleanupTimer();

        // Disconnect and stop oscillators
        this.oscillators.forEach((osc, i) => {
            if (osc) {
                try {
                    // ✅ SAFETY: Explicitly stop oscillators in cleanup
                    // Just disconnecting might leave them running in background
                    if (Array.isArray(osc)) {
                        osc.forEach(o => {
                            if (o) {
                                try { o.disconnect(); } catch (e) { }
                                try { o.stop(); } catch (e) { }
                            }
                        });
                    } else {
                        try { osc.disconnect(); } catch (e) { }
                        if (osc.stop) {
                            try { osc.stop(); } catch (e) { }
                        }
                    }
                } catch (e) {
                    // Already stopped/disconnected
                }
            }
        });

        // Disconnect gains
        this.oscillatorGains.forEach(gain => {
            if (gain) {
                try {
                    gain.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            }
        });

        // Disconnect filter
        if (this.filter) {
            try {
                this.filter.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }

        if (this.filterDrive) {
            try {
                this.filterDrive.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }

        if (this.amplitudeGain) {
            try {
                this.amplitudeGain.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }

        // Clear references
        this.oscillators = [null, null, null, null];
        this.oscillatorGains = [];
        this.filter = null;
        this.filterDrive = null;
        this.amplitudeGain = null;
    }

    /**
     * Cancel cleanup timer
     */
    _cancelCleanupTimer() {
        if (this._cleanupTimer) {
            clearTimeout(this._cleanupTimer);
            this._cleanupTimer = null;
        }
    }

    /**
     * Create drive curve for filter saturation
     */
    _createDriveCurve(amount) {
        const samples = 1024;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        const k = amount * 100;

        for (let i = 0; i < samples; i++) {
            const x = (i * 2 / samples) - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }

        return curve;
    }

    /**
     * Create noise buffer (white noise)
     */
    _createNoiseBuffer() {
        const bufferSize = this.context.sampleRate * 2;
        const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
        const output = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        return buffer;
    }

    /**
     * Register modulation targets
     */
    _registerModulationTargets() {
        this.modulationTargets.clear();
        if (!this.filter || !this.amplitudeGain) return;

        // Filter cutoff
        this.modulationTargets.set('filter.cutoff', {
            param: this.filter.frequency,
            apply: (value) => {
                this.filter.frequency.cancelScheduledValues(this.context.currentTime);
                this.filter.frequency.setValueAtTime(value, this.context.currentTime);
            },
            getBaseValue: () => this.filterSettings.cutoff,
            getRange: () => 20000 - 20,
            min: 20,
            max: 20000
        });

        // Filter resonance
        this.modulationTargets.set('filter.resonance', {
            param: this.filter.Q,
            apply: (value) => {
                this.filter.Q.cancelScheduledValues(this.context.currentTime);
                this.filter.Q.setValueAtTime(value, this.context.currentTime);
            },
            getBaseValue: () => this.filterSettings.resonance,
            getRange: () => 30 - 0.0001,
            min: 0.0001,
            max: 30
        });

        // Filter drive
        this.modulationTargets.set('filter.drive', {
            apply: (value) => {
                if (this.filterDrive) {
                    this.filterDrive.curve = this._createDriveCurve(Math.max(0, Math.min(1, value)));
                }
            },
            getBaseValue: () => this.filterSettings.drive,
            getRange: () => 1,
            min: 0,
            max: 1
        });

        // Oscillator levels and detune
        this.oscillatorGains.forEach((gain, i) => {
            if (gain) {
                this.modulationTargets.set(`osc.${i + 1}.level`, {
                    param: gain.gain,
                    apply: (value) => {
                        gain.gain.cancelScheduledValues(this.context.currentTime);
                        gain.gain.setValueAtTime(value, this.context.currentTime);
                    },
                    getBaseValue: () => this.oscillatorSettings[i].level,
                    getRange: () => 1,
                    min: 0,
                    max: 1
                });

                // detune for non-array oscillators
                const osc = this.oscillators[i];
                if (osc && !Array.isArray(osc)) {
                    if (osc.detune) {
                        // Standard oscillator
                        this.modulationTargets.set(`osc.${i + 1}.detune`, {
                            param: osc.detune,
                            apply: (value) => {
                                osc.detune.cancelScheduledValues(this.context.currentTime);
                                osc.detune.setValueAtTime(value, this.context.currentTime);
                            },
                            getBaseValue: () => this.oscillatorSettings[i].detune,
                            getRange: () => 2400, // ± 1 octave
                            min: -1200,
                            max: 1200
                        });
                    } else if (osc.setDetune) {
                        // Supersaw oscillator
                        this.modulationTargets.set(`osc.${i + 1}.detune`, {
                            apply: (value) => {
                                // Map -1200..1200 cents to 0..100 supersaw detune param
                                const normalized = (value + 1200) / 24; // 0..100
                                osc.setDetune(normalized);
                            },
                            getBaseValue: () => (this.oscillatorSettings[i].unisonDetune || 50) * 24 - 1200,
                            getRange: () => 2400,
                            min: -1200,
                            max: 1200
                        });
                    }
                }
            }
        });

        // LFO rates
        this.lfos.forEach((lfo, i) => {
            this.modulationTargets.set(`lfo.${i + 1}.rate`, {
                apply: (value) => {
                    lfo.setFrequency(value);
                },
                getBaseValue: () => lfo.frequency,
                getRange: () => 19.99,
                min: 0.01,
                max: 20
            });
        });
    }

    /**
     * Apply modulation
     */
    _applyModulation(modulationMap) {
        const time = this.context.currentTime;

        for (const [destination, modulationValue] of modulationMap.entries()) {
            const target = this.modulationTargets.get(destination);
            if (!target) continue;

            const baseValue = target.getBaseValue ? target.getBaseValue() : target.param?.value;
            const range = target.getRange ? target.getRange() : (target.max - target.min);

            if (baseValue === undefined || range === undefined) continue;

            const modulationOffset = modulationValue * (range / 2);
            let newValue = baseValue + modulationOffset;

            const min = target.min !== undefined ? target.min : -Infinity;
            const max = target.max !== undefined ? target.max : Infinity;
            newValue = Math.max(min, Math.min(max, newValue));

            try {
                if (target.apply) {
                    target.apply(newValue, time);
                } else if (target.param) {
                    target.param.setValueAtTime(newValue, time);
                }
            } catch (e) {
                // Failed to apply modulation
            }
        }
    }

    /**
     * Set oscillator parameters
     */
    setOscillator(index, settings) {
        if (index < 0 || index >= 4) return;

        Object.assign(this.oscillatorSettings[index], settings);
    }

    /**
     * Set filter parameters
     */
    setFilter(settings) {
        Object.assign(this.filterSettings, settings);

        if (this.filter) {
            if (settings.type !== undefined) {
                this.filter.type = settings.type.includes('24') ?
                    settings.type.replace('24', '') :
                    settings.type;
            }
            if (settings.cutoff !== undefined) {
                this.filter.frequency.setValueAtTime(
                    settings.cutoff,
                    this.context.currentTime
                );
            }
            if (settings.resonance !== undefined) {
                this.filter.Q.setValueAtTime(
                    settings.resonance,
                    this.context.currentTime
                );
            }
        }
    }

    /**
     * Set filter envelope
     */
    setFilterEnvelope(params) {
        this.filterEnvelope.setParams(params);
    }

    /**
     * Set amplitude envelope
     */
    setAmplitudeEnvelope(params) {
        this.amplitudeEnvelope.setParams(params);
    }

    /**
     * Set LFO parameters
     */
    setLFO(index, settings) {
        if (index < 0 || index >= 4) return;
        this.lfos[index].setSettings(settings);
    }

    /**
     * Set master volume
     */
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(
                this.masterVolume,
                this.context.currentTime
            );
        }
    }

    /**
     * Update BPM
     */
    updateBPM(bpm) {
        this.bpm = bpm;
        this.lfos.forEach(lfo => {
            if (lfo.tempoSync) {
                lfo.updateBPM(bpm);
            }
        });
    }

    /**
     * Load preset
     */
    loadPreset(preset) {
        // Set oscillators
        if (preset.oscillators && Array.isArray(preset.oscillators)) {
            preset.oscillators.forEach((oscSettings, index) => {
                if (index < 4) {
                    this.setOscillator(index, oscSettings);
                }
            });
        }

        // Set filter
        if (preset.filter) {
            this.setFilter(preset.filter);
        }

        // Set envelopes
        if (preset.filterEnvelope) {
            this.setFilterEnvelope(preset.filterEnvelope);
        }

        if (preset.amplitudeEnvelope) {
            this.setAmplitudeEnvelope(preset.amplitudeEnvelope);
        }

        // Set LFOs
        if (preset.lfos && Array.isArray(preset.lfos)) {
            preset.lfos.forEach((lfoSettings, index) => {
                if (index < 4) {
                    this.setLFO(index, lfoSettings);
                }
            });
        }

        // Set voice mode
        if (preset.voiceMode !== undefined) {
            this.voiceMode = preset.voiceMode;
        }

        if (preset.portamento !== undefined) {
            this.portamento = preset.portamento;
        }

        if (preset.legato !== undefined) {
            this.legato = preset.legato;
        }

        // Set modulation matrix slots
        if (preset.modulation && Array.isArray(preset.modulation)) {
            this._updateModulationSlots(preset.modulation);
        } else if (preset.modSlots && Array.isArray(preset.modSlots)) {
            this._updateModulationSlots(preset.modSlots);
        }

        // Set master volume
        if (preset.masterVolume !== undefined) {
            this.setMasterVolume(preset.masterVolume);
        }
    }

    updateParameters(params) {
        if (!params) return;
        if (params.oscillatorSettings) {
            params.oscillatorSettings.forEach((osc, index) => {
                if (index < this.oscillatorSettings.length) {
                    this.oscillatorSettings[index] = { ...this.oscillatorSettings[index], ...osc };
                }
            });
        }
        if (params.filterSettings) {
            this.filterSettings = { ...this.filterSettings, ...params.filterSettings };
        }
        if (params.filterEnvelope) {
            this.filterEnvelope.setParams(params.filterEnvelope);
        }
        if (params.amplitudeEnvelope) {
            this.amplitudeEnvelope.setParams(params.amplitudeEnvelope);
        }
        if (params.lfos) {
            params.lfos.forEach((lfo, index) => {
                if (index < 4) {
                    this.setLFO(index, lfo);
                    if (index === 0) this.modulationEngine.setLFO(this.lfos[0]);
                }
            });
        }
        if (params.modSlots) {
            this._updateModulationSlots(params.modSlots);
        }
    }

    _updateModulationSlots(slots) {
        if (!Array.isArray(slots)) return;
        this.modulationEngine.clear();
        slots.forEach((slot, index) => {
            if (slot.enabled && slot.source && slot.destination && slot.amount !== 0) {
                this.modulationEngine.updateSlot(`mod_${index}`, {
                    enabled: true,
                    source: slot.source,
                    destination: slot.destination,
                    amount: slot.amount,
                    curve: slot.curve || 'linear'
                });
            }
        });
        const hasActiveSlots = slots.some(s => s.enabled && s.source && s.destination);
        if (hasActiveSlots) {
            this.modulationEngine.startUpdates();
        } else {
            this.modulationEngine.stopUpdates();
        }
    }

    /**
     * Export current synth settings as JSON preset
     * @returns {Object} Preset data object
     */
    exportPreset() {
        return {
            oscillators: this.oscillatorSettings.map(osc => ({ ...osc })),
            filter: { ...this.filterSettings },
            filterEnvelope: {
                delay: this.filterEnvelope.delay,
                attack: this.filterEnvelope.attack,
                hold: this.filterEnvelope.hold,
                decay: this.filterEnvelope.decay,
                sustain: this.filterEnvelope.sustain,
                release: this.filterEnvelope.release,
                velocitySensitivity: this.filterEnvelope.velocitySensitivity
            },
            amplitudeEnvelope: {
                delay: this.amplitudeEnvelope.delay,
                attack: this.amplitudeEnvelope.attack,
                hold: this.amplitudeEnvelope.hold,
                decay: this.amplitudeEnvelope.decay,
                sustain: this.amplitudeEnvelope.sustain,
                release: this.amplitudeEnvelope.release,
                velocitySensitivity: this.amplitudeEnvelope.velocitySensitivity
            },
            lfos: this.lfos.map(lfo => ({
                waveform: lfo.waveform,
                rate: lfo.rate,
                depth: lfo.depth,
                tempoSync: lfo.tempoSync,
                syncValue: lfo.syncValue
            })),
            modulation: this.modulationEngine.slots.map(slot => ({
                enabled: slot.enabled,
                source: slot.source,
                destination: slot.destination,
                amount: slot.amount,
                curve: slot.curve
            })),
            voiceMode: this.voiceMode,
            portamento: this.portamento,
            legato: this.legato,
            masterVolume: this.masterVolume
        };
    }

    /**
     * Import preset data and apply to synth
     * @param {Object} presetData - Preset data object
     */
    importPreset(presetData) {
        if (!presetData) return;

        // Apply oscillators
        if (presetData.oscillators) {
            presetData.oscillators.forEach((osc, i) => {
                if (i < this.oscillatorSettings.length) {
                    this.oscillatorSettings[i] = { ...osc };
                }
            });
        }

        // Apply filter
        if (presetData.filter) {
            this.filterSettings = { ...presetData.filter };
        }

        // Apply envelopes
        if (presetData.filterEnvelope) {
            Object.assign(this.filterEnvelope, presetData.filterEnvelope);
        }
        if (presetData.amplitudeEnvelope) {
            Object.assign(this.amplitudeEnvelope, presetData.amplitudeEnvelope);
        }

        // Apply LFOs
        if (presetData.lfos) {
            presetData.lfos.forEach((lfoData, i) => {
                if (i < this.lfos.length) {
                    const lfo = this.lfos[i];
                    lfo.waveform = lfoData.waveform || 'sine';
                    lfo.rate = lfoData.rate || 1;
                    lfo.depth = lfoData.depth || 0;
                    lfo.tempoSync = lfoData.tempoSync !== undefined ? lfoData.tempoSync : false;
                    lfo.syncValue = lfoData.syncValue || '1/4';
                }
            });
        }

        // Apply modulation
        if (presetData.modulation) {
            presetData.modulation.forEach((slotData, i) => {
                if (i < this.modulationEngine.slots.length) {
                    const slot = this.modulationEngine.slots[i];
                    slot.enabled = slotData.enabled !== undefined ? slotData.enabled : false;
                    slot.source = slotData.source || null;
                    slot.destination = slotData.destination || null;
                    slot.amount = slotData.amount || 0;
                    slot.curve = slotData.curve || 'linear';
                }
            });
        }

        // Apply voice settings
        if (presetData.voiceMode) this.voiceMode = presetData.voiceMode;
        if (presetData.portamento !== undefined) this.portamento = presetData.portamento;
        if (presetData.legato !== undefined) this.legato = presetData.legato;
        if (presetData.masterVolume !== undefined) {
            this.masterVolume = presetData.masterVolume;
            this.masterGain.gain.setValueAtTime(presetData.masterVolume, this.context.currentTime);
        }

        console.log('✅ ZenithSynth preset imported');
    }

    /**
     * Dispose
     */
    dispose() {
        this.cleanup();
        this.lfos.forEach(lfo => lfo.dispose());
        if (this.modulationEngine) {
            this.modulationEngine.stopUpdates();
        }
        if (this.masterGain) {
            try {
                this.masterGain.disconnect();
            } catch (e) {
                // Already disconnected
            }
        }
    }
}
