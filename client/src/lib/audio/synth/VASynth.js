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
    constructor(audioContext) {
        this.context = audioContext;
        this.isPlaying = false;

        // Audio nodes
        this.oscillators = [null, null, null];
        this.oscillatorGains = [];
        this.filter = null;
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
            velocitySensitivity: 0.5 // 0-1
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
    noteOn(midiNote, velocity = 100, startTime = null) {
        const time = startTime !== null ? startTime : this.context.currentTime;
        const baseFrequency = this.midiToFrequency(midiNote);

        // ✅ Monophonic Mode with Portamento
        if (this.isPlaying && this.voiceMode === 'mono') {
            // Already playing - just glide to new frequency
            const glideTime = this.portamento;

            this.oscillators.forEach((osc, i) => {
                if (!osc) return;

                const settings = this.oscillatorSettings[i];
                const octaveMultiplier = Math.pow(2, settings.octave);
                const targetFreq = baseFrequency * octaveMultiplier;

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

            const osc = this.context.createOscillator();
            osc.type = settings.waveform;

            // Calculate frequency with octave offset
            const octaveMultiplier = Math.pow(2, settings.octave);
            const frequency = baseFrequency * octaveMultiplier;
            osc.frequency.setValueAtTime(frequency, time);

            // Apply detune
            osc.detune.setValueAtTime(settings.detune, time);

            // Create gain node for this oscillator
            const oscGain = this.context.createGain();
            oscGain.gain.setValueAtTime(settings.level, time);

            osc.connect(oscGain);

            this.oscillators[i] = osc;
            this.oscillatorGains[i] = oscGain;
        });

        // Create filter
        this.filter = this.context.createBiquadFilter();
        this.filter.type = this.filterSettings.type;
        this.filter.Q.setValueAtTime(this.filterSettings.resonance, time);

        // Base filter cutoff
        const baseCutoff = this.filterSettings.cutoff;
        this.filter.frequency.setValueAtTime(baseCutoff, time);

        // Create gain node for filter envelope modulation
        this.filterEnvGain = this.context.createGain();
        this.filterEnvGain.gain.setValueAtTime(0, time);

        // Create amplitude gain (controlled by amplitude envelope)
        this.amplitudeGain = this.context.createGain();
        this.amplitudeGain.gain.setValueAtTime(0, time);

        // Connect oscillators to filter
        this.oscillatorGains.forEach(oscGain => {
            if (oscGain) {
                oscGain.connect(this.filter);
            }
        });

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

        // Start LFO if enabled
        if (this.lfo.isRunning) {
            this.lfo.stop();
        }
        this.lfo.start(time);

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
                        osc.stop(stopAt); // Add small buffer after release
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

        // Disconnect other nodes
        [this.filter, this.filterEnvGain, this.amplitudeGain, this.masterGain].forEach(node => {
            if (node) {
                try {
                    node.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            }
        });

        // Stop LFO
        if (this.lfo.isRunning) {
            this.lfo.stop();
        }

        // Reset references (except masterGain which is persistent)
        this.oscillators = [null, null, null];
        this.oscillatorGains = [];
        this.filter = null;
        this.filterEnvGain = null;
        this.amplitudeGain = null;
        // ✅ Don't null masterGain - it's created in constructor and reused
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
     */
    setFilter(settings) {
        this.filterSettings = {
            ...this.filterSettings,
            ...settings
        };

        // Apply to current filter if playing
        if (this.isPlaying && this.filter) {
            if (settings.type !== undefined) {
                this.filter.type = settings.type;
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
     * Dispose synth
     */
    dispose() {
        this.noteOff();
        this.cleanup();
        this.lfo.dispose();
    }
}
