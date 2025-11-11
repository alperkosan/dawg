/**
 * VASynth (Virtual Analog Synthesizer) - Native Web Audio implementation
 * Based on Minimogue VA architecture:
 * - 3 Oscillators with independent waveform, tuning, and level
 * - Multi-mode filter with cutoff, resonance, envelope
 * - Filter envelope (ADSR)
 * - Amplitude envelope (ADSR)
 * - LFO modulation routing
 * - Built-in effects (overdrive, delay)
 */

import { ADSREnvelope } from './ADSREnvelope.js';
import { LFO } from './LFO.js';

export class VASynth {
    constructor(audioContext, bpm = 120) {
        this.context = audioContext;
        this.isPlaying = false;
        this.bpm = bpm; // ✅ TEMPO SYNC: Store BPM for tempo sync calculations

        // Audio nodes
        this.oscillators = [null, null, null];
        this.oscillatorGains = [];
        this.filter = null;
        this.filterDrive = null; // ✅ FILTER DRIVE: WaveShaperNode for saturation
        this.filterEnvGain = null;
        this.amplitudeGain = null;

        // ✅ Create master gain in constructor (not in noteOn)
        this.masterGain = this.context.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.context.currentTime);

        // Envelopes
        this.filterEnvelope = new ADSREnvelope(audioContext);
        this.amplitudeEnvelope = new ADSREnvelope(audioContext);

        // LFO
        this.lfo = new LFO(audioContext);
        this.lfoTarget = 'filter.cutoff'; // ✅ LFO TARGET: Default target

        // Synth parameters
        this.masterVolume = 0.7;

        // ✅ DAW-Standard Voice Mode Settings
        this.voiceMode = 'poly'; // 'mono' or 'poly'
        this.portamento = 0.0; // Glide time in seconds (0-2)
        this.legato = false; // Mono legato mode (don't retrigger envelopes)
        this.unison = 1; // Number of voices per note (1-4)
        this.unisonDetune = 10; // Detune amount in cents
        this.unisonSpread = 0.5; // Stereo spread 0-1
        this.lastPlayedFreq = null; // For portamento

        // Oscillator settings
        this.oscillatorSettings = [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,        // cents (-1200 to +1200)
                octave: 0,        // -2, -1, 0, +1, +2
                level: 0.33,      // 0-1
                pulseWidth: 0.5   // For future PWM implementation
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -7,       // Slight detune for richness
                octave: 0,
                level: 0.33,
                pulseWidth: 0.5
            },
            {
                enabled: false,
                waveform: 'square',
                detune: 0,
                octave: -1,       // Sub oscillator
                level: 0.33,
                pulseWidth: 0.5
            }
        ];

        // Filter settings
        this.filterSettings = {
            type: 'lowpass',      // lowpass, highpass, bandpass, notch
            cutoff: 2000,         // Hz (20-20000)
            resonance: 1,         // Q factor (0.0001-30)
            envelopeAmount: 2000, // How much envelope affects cutoff
            velocitySensitivity: 0.5, // 0-1
            keyTracking: 0,       // ✅ KEY TRACKING: 0-1 (0 = off, 1 = full tracking)
            drive: 0              // ✅ FILTER DRIVE: 0-1 (0 = no drive, 1 = maximum saturation)
        };

        // Effects settings
        this.effectsSettings = {
            overdrive: {
                enabled: false,
                amount: 0.5    // 0-1
            },
            delay: {
                enabled: false,
                time: 0.25,    // seconds
                feedback: 0.3, // 0-1
                mix: 0.3       // 0-1 (dry/wet)
            }
        };

        // Current note info
        this.currentNote = null;
        this.currentVelocity = 100;
    }

    /**
     * Calculate frequency from MIDI note number
     */
    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    /**
     * Start playing a note
     */
    noteOn(midiNote, velocity = 100, startTime = null, extendedParams = null) {
        const time = startTime !== null ? startTime : this.context.currentTime;
        
        // ✅ PHASE 2: Apply initial pitch bend if present
        let pitchBendSemitones = 0;
        if (extendedParams?.pitchBend && Array.isArray(extendedParams.pitchBend) && extendedParams.pitchBend.length > 0) {
            const firstPoint = extendedParams.pitchBend[0];
            pitchBendSemitones = (firstPoint.value / 8192) * 2; // ±2 semitones range
        }
        
        const baseFrequency = this.midiToFrequency(midiNote + pitchBendSemitones);

        // ✅ Monophonic Mode with Portamento
        if (this.isPlaying && this.voiceMode === 'mono') {
            // Already playing - just glide to new frequency
            const glideTime = this.portamento;

            this.oscillators.forEach((osc, i) => {
                if (!osc) return;

                const settings = this.oscillatorSettings[i];
                const octaveMultiplier = Math.pow(2, settings.octave);
                const targetFreq = baseFrequency * octaveMultiplier;

                // ✅ PWM: Handle array of oscillators (PWM mode)
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
                } else {
                    // Normal single oscillator
                    if (glideTime > 0.001) {
                        // Portamento: smooth glide
                        osc.frequency.cancelScheduledValues(time);
                        osc.frequency.setValueAtTime(osc.frequency.value, time);
                        osc.frequency.exponentialRampToValueAtTime(
                            targetFreq,
                            time + glideTime
                        );
                    } else {
                        // No portamento: instant jump
                        osc.frequency.setValueAtTime(targetFreq, time);
                    }
                }
            });

            // Legato mode: don't retrigger envelopes
            if (!this.legato) {
                // Retrigger envelopes for new note
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

        // ✅ Polyphonic Mode or First Note in Mono Mode
        if (this.isPlaying) {
            this.noteOff();
        }

        this.currentNote = midiNote;
        this.currentVelocity = velocity;
        this.lastPlayedFreq = baseFrequency;

        // Create oscillators
        this.oscillatorSettings.forEach((settings, i) => {
            if (!settings.enabled) return;

            // Calculate frequency with octave offset
            const octaveMultiplier = Math.pow(2, settings.octave);
            const frequency = baseFrequency * octaveMultiplier;

            // ✅ PWM: For square wave with pulse width, use two oscillators
            if (settings.waveform === 'square' && settings.pulseWidth !== undefined && settings.pulseWidth !== 0.5) {
                // ✅ PWM: Create two square wave oscillators for pulse width modulation
                const osc1 = this.context.createOscillator();
                const osc2 = this.context.createOscillator();
                osc1.type = 'square';
                osc2.type = 'square';

                // Set frequencies
                osc1.frequency.setValueAtTime(frequency, time);
                osc2.frequency.setValueAtTime(frequency, time);

                // Apply detune
                osc1.detune.setValueAtTime(settings.detune, time);
                osc2.detune.setValueAtTime(settings.detune, time);

                // ✅ PWM: Phase offset for second oscillator (180 degrees = inverted)
                // Pulse width 0.5 = 50% duty cycle (normal square)
                // Pulse width < 0.5 = narrower pulse (more high, less low)
                // Pulse width > 0.5 = wider pulse (less high, more low)
                const pulseWidth = Math.max(0.01, Math.min(0.99, settings.pulseWidth)); // Clamp 0.01-0.99
                const phaseOffset = (pulseWidth - 0.5) * Math.PI * 2; // Convert to phase offset
                
                // Create gain nodes for mixing
                const gain1 = this.context.createGain();
                const gain2 = this.context.createGain();
                const mixGain = this.context.createGain();

                // ✅ PWM: Mix oscillators based on pulse width
                // At 0.5 pulse width: equal mix (normal square)
                // At < 0.5: more of osc1 (narrower pulse)
                // At > 0.5: more of osc2 (wider pulse)
                const mix1 = pulseWidth;
                const mix2 = 1 - pulseWidth;

                gain1.gain.setValueAtTime(mix1 * settings.level, time);
                gain2.gain.setValueAtTime(mix2 * settings.level, time);
                mixGain.gain.setValueAtTime(1.0, time);

                // Connect: osc1 -> gain1 -> mixGain
                //         osc2 -> gain2 -> mixGain
                osc1.connect(gain1);
                osc2.connect(gain2);
                gain1.connect(mixGain);
                gain2.connect(mixGain);

                // Start both oscillators
                osc1.start(time);
                osc2.start(time);

                // Store references
                this.oscillators[i] = [osc1, osc2]; // Store array for PWM
                this.oscillatorGains[i] = mixGain;
            } else {
                // ✅ NORMAL: Standard oscillator (non-square or square with 0.5 pulse width)
                const osc = this.context.createOscillator();
                osc.type = settings.waveform;
                osc.frequency.setValueAtTime(frequency, time);
                osc.detune.setValueAtTime(settings.detune, time);

                // Create gain node for this oscillator
                const oscGain = this.context.createGain();
                oscGain.gain.setValueAtTime(settings.level, time);

                osc.connect(oscGain);

                this.oscillators[i] = osc;
                this.oscillatorGains[i] = oscGain;
            }
        });

        // Create filter
        this.filter = this.context.createBiquadFilter();
        this.filter.type = this.filterSettings.type;
        this.filter.Q.setValueAtTime(this.filterSettings.resonance, time);

        // ✅ PHASE 2: Base filter cutoff with mod wheel modulation
        // ✅ KEY TRACKING: Apply key tracking if enabled
        let baseCutoff = this.filterSettings.cutoff;
        
        // ✅ KEY TRACKING: Apply key tracking if enabled
        const keyTrackingAmount = this.filterSettings.keyTracking || 0; // 0-1
        if (keyTrackingAmount > 0) {
            const noteFrequency = this.midiToFrequency(midiNote);
            const baseFrequency = this.midiToFrequency(60); // C4 as base
            const frequencyRatio = noteFrequency / baseFrequency;
            
            // Calculate key tracking offset
            // Higher notes = higher frequency = higher cutoff
            // Range: ±50% of base cutoff based on key tracking amount
            const keyTrackingOffset = (frequencyRatio - 1) * keyTrackingAmount * baseCutoff * 0.5;
            baseCutoff = baseCutoff + keyTrackingOffset;
            baseCutoff = Math.max(20, Math.min(20000, baseCutoff)); // Clamp to valid range
        }
        
        if (extendedParams?.modWheel !== undefined) {
            const modWheelNormalized = extendedParams.modWheel / 127; // 0-1
            const cutoffRange = baseCutoff * 0.5; // ±50% modulation
            baseCutoff = baseCutoff + (modWheelNormalized - 0.5) * cutoffRange * 2;
            baseCutoff = Math.max(20, Math.min(20000, baseCutoff)); // Clamp
        }
        this.filter.frequency.setValueAtTime(baseCutoff, time);
        
        // ✅ PHASE 2: Apply aftertouch to filter Q
        let filterQ = this.filterSettings.resonance;
        if (extendedParams?.aftertouch !== undefined) {
            const aftertouchNormalized = extendedParams.aftertouch / 127; // 0-1
            filterQ = filterQ + aftertouchNormalized * 10; // Add up to 10 Q
            filterQ = Math.max(0, Math.min(30, filterQ)); // Clamp Q
        }
        this.filter.Q.setValueAtTime(filterQ, time);

        // Create gain node for filter envelope modulation
        this.filterEnvGain = this.context.createGain();
        this.filterEnvGain.gain.setValueAtTime(0, time);

        // Create amplitude gain (controlled by amplitude envelope)
        this.amplitudeGain = this.context.createGain();
        this.amplitudeGain.gain.setValueAtTime(0, time);

        // ✅ FILTER DRIVE: Create drive node if drive > 0
        if (this.filterSettings.drive > 0.001) {
            this.filterDrive = this.context.createWaveShaper();
            this.filterDrive.curve = this._createDriveCurve(this.filterSettings.drive);
            this.filterDrive.oversample = '4x'; // Reduce aliasing
            
            // Connect: Oscillators → Filter Drive → Filter → Amplitude Gain → Master Gain
            this.oscillatorGains.forEach(oscGain => {
                if (oscGain) {
                    oscGain.connect(this.filterDrive);
                }
            });
            this.filterDrive.connect(this.filter);
        } else {
            // Connect: Oscillators → Filter → Amplitude Gain → Master Gain
            this.oscillatorGains.forEach(oscGain => {
                if (oscGain) {
                    oscGain.connect(this.filter);
                }
            });
        }

        // Connect: Filter → Amplitude Gain → Master Gain
        // Note: masterGain is already created in constructor
        this.filter.connect(this.amplitudeGain);
        this.amplitudeGain.connect(this.masterGain);

        // ✅ Don't auto-connect to destination - let VASynthInstrument handle routing

        // Start oscillators
        this.oscillators.forEach(osc => {
            if (osc) {
                osc.start(time);
            }
        });

        // Trigger filter envelope
        const filterEnvAmount = this.filterSettings.envelopeAmount;

        // Apply filter envelope to cutoff frequency
        // Base cutoff -> Peak (base + envelope amount) -> Sustain
        this.filterEnvelope.triggerExponential(
            this.filter.frequency,
            time,
            baseCutoff,                      // Start from base cutoff
            baseCutoff + filterEnvAmount,    // Peak at base + envelope amount
            velocity
        );

        // Trigger amplitude envelope
        this.amplitudeEnvelope.trigger(
            this.amplitudeGain.gain,
            time,
            1.0,
            velocity
        );

        // ✅ LFO PLAYBACK: Start LFO and connect to target parameter
        if (this.lfo && this.lfo.frequency > 0 && this.lfo.depth > 0) {
            if (this.lfo.isRunning) {
                this.lfo.stop();
            }
            
            // ✅ TEMPO SYNC: Update BPM before starting (if tempo sync is enabled)
            if (this.lfo.tempoSync && this.bpm) {
                this.lfo.updateBPM(this.bpm);
            }
            
            this.lfo.start(time);
            
            // ✅ LFO TARGET: Connect LFO to target parameter based on lfoTarget
            const target = this.lfoTarget || 'filter.cutoff';
            let targetParam = null;
            let modulationAmount = 0;
            
            switch (target) {
                case 'filter.cutoff':
                    targetParam = this.filter.frequency;
                    const baseCutoff = this.filterSettings.cutoff;
                    modulationAmount = this.lfo.depth * baseCutoff * 0.5; // ±50% of cutoff
                    break;
                    
                case 'filter.resonance':
                    targetParam = this.filter.Q;
                    const baseResonance = this.filterSettings.resonance;
                    modulationAmount = this.lfo.depth * baseResonance * 0.5; // ±50% of resonance
                    break;
                    
                case 'osc.level':
                    // ✅ LFO TARGET: Modulate first oscillator level
                    if (this.oscillatorGains[0]) {
                        targetParam = this.oscillatorGains[0].gain;
                        modulationAmount = this.lfo.depth * 0.5; // ±50% of level
                    }
                    break;
                    
                case 'osc.detune':
                    // ✅ LFO TARGET: Modulate first oscillator detune
                    if (this.oscillators[0] && !Array.isArray(this.oscillators[0])) {
                        targetParam = this.oscillators[0].detune;
                        modulationAmount = this.lfo.depth * 50; // ±50 cents
                    }
                    break;
                    
                case 'osc.pitch':
                    // ✅ LFO TARGET: Modulate first oscillator frequency (pitch)
                    if (this.oscillators[0] && !Array.isArray(this.oscillators[0])) {
                        targetParam = this.oscillators[0].frequency;
                        const baseFreq = this.oscillators[0].frequency.value;
                        modulationAmount = this.lfo.depth * baseFreq * 0.1; // ±10% of frequency (vibrato)
                    }
                    break;
                    
                default:
                    // Fallback to filter cutoff
                    targetParam = this.filter.frequency;
                    const fallbackCutoff = this.filterSettings.cutoff;
                    modulationAmount = this.lfo.depth * fallbackCutoff * 0.5;
                    break;
            }
            
            if (targetParam) {
                this.lfo.connect(targetParam, modulationAmount);
            }
        }

        this.isPlaying = true;
    }

    /**
     * Stop playing the current note
     */
    noteOff(stopTime = null) {
        if (!this.isPlaying) return;

        const time = stopTime !== null ? stopTime : this.context.currentTime;

        try {
            // Trigger release phase of envelopes
            // Check if envelopes and nodes exist before calling release
            if (this.filterEnvelope && this.filter && this.filter.frequency) {
                this.filterEnvelope.release(this.filter.frequency, time);
            }

            let releaseEnd = time + 0.5; // Default release time

            if (this.amplitudeEnvelope && this.amplitudeGain && this.amplitudeGain.gain) {
                releaseEnd = this.amplitudeEnvelope.release(this.amplitudeGain.gain, time);
            }

            console.log(`🎹 VASynth noteOff:`, {
                stopTime,
                currentTime: this.context.currentTime,
                time,
                releaseEnd,
                releaseDuration: releaseEnd - time,
                oscillatorCount: this.oscillators.length,
                hasAmplitudeEnvelope: !!this.amplitudeEnvelope,
                hasAmplitudeGain: !!this.amplitudeGain
            });

            // ✅ FIX: Stop oscillators at release end time (works for offline rendering)
            // This is critical for OfflineAudioContext where setTimeout doesn't work
            this.oscillators.forEach((osc, i) => {
                if (osc) {
                    try {
                        const stopAt = releaseEnd + 0.1;
                        // ✅ PWM: Handle array of oscillators (PWM mode)
                        if (Array.isArray(osc)) {
                            osc.forEach(o => {
                                if (o) {
                                    o.stop(stopAt);
                                }
                            });
                        } else {
                            osc.stop(stopAt); // Add small buffer after release
                        }
                        console.log(`🎹 Scheduled oscillator ${i} stop at ${stopAt.toFixed(3)}s`);
                    } catch (e) {
                        console.warn(`🎹 Failed to stop oscillator ${i}:`, e.message);
                    }
                }
            });

            // Stop and cleanup after release (for real-time playback)
            // Note: This won't work in offline rendering, but oscillator.stop() above will
            setTimeout(() => {
                this.cleanup();
            }, Math.max(0, (releaseEnd - this.context.currentTime + 0.1) * 1000));

            this.isPlaying = false;

        } catch (error) {
            // Silently handle - defensive checks should prevent most errors
            this.cleanup();
            this.isPlaying = false;
        }
    }

    /**
     * Cleanup audio nodes
     */
    cleanup() {
        // ✅ Minimal cleanup - let release envelopes finish naturally
        const now = this.context.currentTime;

        // Stop oscillators
        this.oscillators.forEach(osc => {
            if (osc) {
                try {
                    // ✅ PWM: Handle array of oscillators (PWM mode)
                    if (Array.isArray(osc)) {
                        osc.forEach(o => {
                            if (o && o.context && o.context.state !== 'closed') {
                                o.stop(now);
                            }
                            if (o) {
                                o.disconnect();
                            }
                        });
                    } else {
                        // Normal single oscillator
                        if (osc.context && osc.context.state !== 'closed') {
                            osc.stop(now);
                        }
                        osc.disconnect();
                    }
                } catch (e) {
                    // Already stopped - ignore
                }
            }
        });

        // Disconnect gains
        this.oscillatorGains.forEach(gain => {
            if (gain) {
                try {
                    gain.disconnect();
                } catch (e) { /* ignore */ }
            }
        });

        // Disconnect filter chain
        [this.filter, this.filterEnvGain, this.amplitudeGain, this.masterGain].forEach(node => {
            if (node) {
                try {
                    node.disconnect();
                } catch (e) { /* ignore */ }
            }
        });

        // Stop LFO
        if (this.lfo && this.lfo.isRunning) {
            this.lfo.stop();
        }

        // Reset references (except masterGain which is persistent)
        this.oscillators = [null, null, null];
        this.oscillatorGains = [];
        this.filter = null;
        this.filterEnvGain = null;
        this.amplitudeGain = null;
    }

    /**
     * Update oscillator settings
     */
    setOscillator(index, settings) {
        if (index < 0 || index > 2) return;

        this.oscillatorSettings[index] = {
            ...this.oscillatorSettings[index],
            ...settings
        };

        // If currently playing, restart note to apply changes
        if (this.isPlaying && this.currentNote !== null) {
            const note = this.currentNote;
            const vel = this.currentVelocity;
            this.noteOff();
            this.noteOn(note, vel);
        }
    }

    /**
     * Update filter settings
     * ✅ KEY TRACKING: Key tracking is applied per-note in noteOn(), not here
     */
    setFilter(settings) {
        const driveChanged = settings.drive !== undefined && 
                            settings.drive !== this.filterSettings.drive;
        
        this.filterSettings = {
            ...this.filterSettings,
            ...settings
        };

        // ✅ FILTER DRIVE: Update drive curve if drive changed
        if (driveChanged && this.filterDrive && this.filterSettings.drive > 0.001) {
            this.filterDrive.curve = this._createDriveCurve(this.filterSettings.drive);
        }

        // Apply to current filter if playing
        // Note: Key tracking is note-specific, so it's not applied here
        // It will be applied on next noteOn() call
        if (this.isPlaying && this.filter) {
            if (settings.type !== undefined) {
                this.filter.type = settings.type;
            }
            if (settings.cutoff !== undefined) {
                // ✅ KEY TRACKING: Don't apply cutoff directly if key tracking is enabled
                // Key tracking modifies cutoff per-note, so we can't set a global value
                if (this.filterSettings.keyTracking === 0 || this.filterSettings.keyTracking === undefined) {
                    this.filter.frequency.setValueAtTime(
                        settings.cutoff,
                        this.context.currentTime
                    );
                }
            }
            if (settings.resonance !== undefined) {
                this.filter.Q.setValueAtTime(
                    settings.resonance,
                    this.context.currentTime
                );
            }
            
            // ✅ FILTER DRIVE: If drive changed significantly, restart note to apply drive node
            // Drive node is created in noteOn(), so we need to restart to apply changes
            if (driveChanged && this.currentNote !== null) {
                const note = this.currentNote;
                const vel = this.currentVelocity;
                this.noteOff();
                this.noteOn(note, vel);
            }
        }
    }

    /**
     * Update filter envelope
     */
    setFilterEnvelope(params) {
        this.filterEnvelope.setParams(params);
    }

    /**
     * Update amplitude envelope
     */
    setAmplitudeEnvelope(params) {
        this.amplitudeEnvelope.setParams(params);
    }

    /**
     * Update LFO settings
     */
    setLFO(settings) {
        this.lfo.setSettings(settings);
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
     * Get current settings as preset
     */
    getPreset() {
        return {
            oscillators: this.oscillatorSettings,
            filter: this.filterSettings,
            filterEnvelope: this.filterEnvelope.getSettings(),
            amplitudeEnvelope: this.amplitudeEnvelope.getSettings(),
            lfo: this.lfo.getSettings(),
            lfoTarget: this.lfoTarget, // ✅ LFO TARGET: Save target in preset
            masterVolume: this.masterVolume
        };
    }

    /**
     * Load preset
     */
    loadPreset(preset) {
        if (preset.oscillators) {
            preset.oscillators.forEach((osc, i) => {
                this.setOscillator(i, osc);
            });
        }

        if (preset.filter) {
            this.setFilter(preset.filter);
        }

        if (preset.filterEnvelope) {
            this.setFilterEnvelope(preset.filterEnvelope);
        }

        if (preset.amplitudeEnvelope) {
            this.setAmplitudeEnvelope(preset.amplitudeEnvelope);
        }

        if (preset.lfo) {
            this.setLFO(preset.lfo);
        }
        
        // ✅ LFO TARGET: Load LFO target from preset
        if (preset.lfoTarget !== undefined) {
            this.lfoTarget = preset.lfoTarget;
        }

        if (preset.masterVolume !== undefined) {
            this.setMasterVolume(preset.masterVolume);
        }

        // ✅ Load voice mode settings
        if (preset.voiceMode !== undefined) {
            this.voiceMode = preset.voiceMode;
        }

        if (preset.portamento !== undefined) {
            this.portamento = preset.portamento;
        }

        if (preset.legato !== undefined) {
            this.legato = preset.legato;
        }

        if (preset.unison !== undefined) {
            this.unison = preset.unison;
        }

        if (preset.unisonDetune !== undefined) {
            this.unisonDetune = preset.unisonDetune;
        }

        if (preset.unisonSpread !== undefined) {
            this.unisonSpread = preset.unisonSpread;
        }
    }

    /**
     * Update parameters in real-time
     * Called when user changes parameters in the editor
     */
    updateParameters(params) {
        console.log('🎹 VASynth.updateParameters:', params);

        // Update filter envelope
        if (params.filterEnvelope) {
            this.setFilterEnvelope(params.filterEnvelope);
        }

        // Update amplitude envelope
        if (params.amplitudeEnvelope) {
            this.setAmplitudeEnvelope(params.amplitudeEnvelope);
        }

        // Update oscillator settings
        if (params.oscillatorSettings) {
            this.oscillatorSettings = params.oscillatorSettings;
        }

        // Update filter settings
        if (params.filterSettings) {
            this.setFilter(params.filterSettings);
        }

        // ✅ LFO PLAYBACK: Update LFO settings
        if (params.lfo1) {
            // ✅ TEMPO SYNC: Include BPM in LFO settings if tempo sync is enabled
            const lfoSettings = { ...params.lfo1 };
            if (lfoSettings.tempoSync && this.bpm) {
                lfoSettings.bpm = this.bpm;
            }
            
            this.setLFO(lfoSettings);
            
            // ✅ LFO TARGET: Update LFO target if provided
            if (params.lfo1.target !== undefined) {
                this.lfoTarget = params.lfo1.target;
            }
            
            // ✅ LFO PLAYBACK: Reconnect LFO if playing (with new target)
            if (this.isPlaying && this.lfo && this.lfo.isRunning) {
                // Disconnect all old connections
                this.lfo.connectedParams.forEach(param => {
                    this.lfo.disconnect(param);
                });
                
                // Reconnect with new target and settings
                if (this.lfo.frequency > 0 && this.lfo.depth > 0) {
                    const target = this.lfoTarget || 'filter.cutoff';
                    let targetParam = null;
                    let modulationAmount = 0;
                    
                    switch (target) {
                        case 'filter.cutoff':
                            if (this.filter) {
                                targetParam = this.filter.frequency;
                                const baseCutoff = this.filterSettings.cutoff;
                                modulationAmount = this.lfo.depth * baseCutoff * 0.5;
                            }
                            break;
                            
                        case 'filter.resonance':
                            if (this.filter) {
                                targetParam = this.filter.Q;
                                const baseResonance = this.filterSettings.resonance;
                                modulationAmount = this.lfo.depth * baseResonance * 0.5;
                            }
                            break;
                            
                        case 'osc.level':
                            if (this.oscillatorGains[0]) {
                                targetParam = this.oscillatorGains[0].gain;
                                modulationAmount = this.lfo.depth * 0.5;
                            }
                            break;
                            
                        case 'osc.detune':
                            if (this.oscillators[0] && !Array.isArray(this.oscillators[0])) {
                                targetParam = this.oscillators[0].detune;
                                modulationAmount = this.lfo.depth * 50;
                            }
                            break;
                            
                        case 'osc.pitch':
                            if (this.oscillators[0] && !Array.isArray(this.oscillators[0])) {
                                targetParam = this.oscillators[0].frequency;
                                const baseFreq = this.oscillators[0].frequency.value;
                                modulationAmount = this.lfo.depth * baseFreq * 0.1;
                            }
                            break;
                    }
                    
                    if (targetParam) {
                        this.lfo.connect(targetParam, modulationAmount);
                    }
                }
            }
        }

        // Update master volume
        if (params.masterVolume !== undefined) {
            this.masterVolume = params.masterVolume;
            if (this.masterGain) {
                this.masterGain.gain.setValueAtTime(
                    params.masterVolume,
                    this.context.currentTime
                );
            }
        }

        // Update voice mode settings
        if (params.voiceMode !== undefined) {
            this.voiceMode = params.voiceMode;
        }

        if (params.portamento !== undefined) {
            this.portamento = params.portamento;
        }

        if (params.legato !== undefined) {
            this.legato = params.legato;
        }
    }

    /**
     * ✅ FILTER DRIVE: Create waveshaping curve for saturation
     * 
     * @param {number} drive - Drive amount (0-1)
     * @returns {Float32Array} WaveShaper curve
     */
    _createDriveCurve(drive) {
        const samples = 4096;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        // Soft saturation curve (tanh-like)
        // Drive controls the amount of saturation
        // Higher drive = more distortion
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1; // -1 to 1
            const driveAmount = drive * 3; // Scale drive (0-3)
            
            // Soft saturation using tanh
            // Drive amount controls how much saturation is applied
            const saturated = Math.tanh(x * (1 + driveAmount));
            
            // Mix between original and saturated signal
            const mix = drive; // 0 = original, 1 = fully saturated
            curve[i] = x * (1 - mix) + saturated * mix;
        }
        
        return curve;
    }

    /**
     * Dispose synth - IMMEDIATE cleanup (no release envelope)
     */
    dispose() {
        // ✅ CRITICAL FIX: Direct cleanup without noteOff to prevent stuck notes
        // noteOff() uses setTimeout which delays cleanup - we need IMMEDIATE stop
        this.cleanup(); // Stop oscillators NOW
        this.lfo.dispose();
        this.isPlaying = false;
    }
}
