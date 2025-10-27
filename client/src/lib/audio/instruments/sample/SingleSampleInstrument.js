/**
 * SingleSampleInstrument - Advanced one-shot sample player
 *
 * For instruments with a single audio file (kick, snare, hi-hat, etc.)
 * Supports:
 * - Polyphonic playback
 * - Pitch shifting (playbackRate + pitch parameter)
 * - Velocity + instrument gain
 * - Pan (stereo positioning)
 * - Loop with start/end points
 * - Sample trim (start/end)
 * - ADSR envelope
 * - Filter (lowpass/highpass/bandpass)
 */

import { BaseInstrument } from '../base/BaseInstrument.js';

export class SingleSampleInstrument extends BaseInstrument {
    constructor(instrumentData, audioContext, sampleBuffer) {
        super(instrumentData, audioContext);

        // Sample data
        this.url = instrumentData.url;
        this.sampleBuffer = sampleBuffer; // AudioBuffer
        this.baseNote = instrumentData.baseNote || 60; // C4 by default

        // Playback settings
        this.maxPolyphony = 32;
        this.activeSources = new Map(); // midiNote -> { source, gainNode, startTime }

        // Master output
        this.masterGain = null;
    }

    /**
     * Initialize instrument
     */
    async initialize() {
        try {
            // Create master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.setValueAtTime(0.8, this.audioContext.currentTime);
            this.output = this.masterGain;

            this._isInitialized = true;

            console.log(`🥁 SingleSample initialized: ${this.name}`);

        } catch (error) {
            console.error(`❌ SingleSample init failed: ${this.name}:`, error);
            throw error;
        }
    }

    /**
     * Play a note
     * @param {number} midiNote - MIDI note number (0-127)
     * @param {number} velocity - MIDI velocity (0-127)
     * @param {number} startTime - When to start (AudioContext time)
     */
    noteOn(midiNote, velocity = 100, startTime = null) {
        if (!this._isInitialized || !this.sampleBuffer) {
            console.warn(`❌ SingleSample not ready: ${this.name}`, {
                isInitialized: this._isInitialized,
                hasSampleBuffer: !!this.sampleBuffer
            });
            return;
        }

        const when = startTime !== null ? startTime : this.audioContext.currentTime;

        console.log(`🥁 ${this.name}.noteOn:`, {
            midiNote,
            velocity,
            when: when.toFixed(3) + 's',
            params: {
                pitch: this.data.pitch || 0,
                gain: this.data.gain || 1,
                pan: this.data.pan || 0,
                loop: this.data.loop,
                loopStart: this.data.loopStart,
                loopEnd: this.data.loopEnd
            }
        });

        try {
            // Stop existing note at same pitch (re-trigger)
            if (this.activeSources.has(midiNote)) {
                this.noteOff(midiNote, when);
            }

            // Create buffer source
            const source = this.audioContext.createBufferSource();
            source.buffer = this.sampleBuffer;

            // Apply loop settings
            if (this.data.loop) {
                source.loop = true;
                const duration = this.sampleBuffer.duration;
                source.loopStart = (this.data.loopStart || 0) * duration;
                source.loopEnd = (this.data.loopEnd || 1) * duration;
                console.log(`🔁 Loop enabled: ${source.loopStart.toFixed(3)}s - ${source.loopEnd.toFixed(3)}s`);
            }

            // Calculate pitch shift (combine base note shift + pitch parameter)
            const baseShift = midiNote - this.baseNote; // semitones
            const pitchParam = this.data.pitch || 0; // additional pitch shift from UI
            const totalPitchShift = baseShift + pitchParam;
            const playbackRate = Math.pow(2, totalPitchShift / 12);
            source.playbackRate.setValueAtTime(playbackRate, when);

            // Create gain node for velocity + instrument gain
            const gainNode = this.audioContext.createGain();
            const velocityGain = Math.max(0, Math.min(1, velocity / 127));
            const instrumentGain = this.data.gain || 1;
            const totalGain = velocityGain * instrumentGain;
            gainNode.gain.setValueAtTime(totalGain, when);

            // Apply ADSR envelope if defined
            if (this.data.attack || this.data.decay || this.data.sustain !== undefined || this.data.release) {
                const attack = (this.data.attack || 0) / 1000; // ms to seconds
                const decay = (this.data.decay || 0) / 1000;
                const sustain = this.data.sustain !== undefined ? this.data.sustain / 100 : 1;
                const release = (this.data.release || 50) / 1000;

                // Attack
                gainNode.gain.setValueAtTime(0, when);
                gainNode.gain.linearRampToValueAtTime(totalGain, when + attack);

                // Decay to sustain
                if (decay > 0) {
                    gainNode.gain.linearRampToValueAtTime(totalGain * sustain, when + attack + decay);
                }
            }

            // Create panner for stereo positioning
            let lastNode = gainNode;
            if (this.data.pan !== undefined && this.data.pan !== 0) {
                const panner = this.audioContext.createStereoPanner();
                panner.pan.setValueAtTime(this.data.pan, when);
                gainNode.connect(panner);
                lastNode = panner;
            }

            // Create filter if defined
            if (this.data.filterType && this.data.filterCutoff) {
                const filter = this.audioContext.createBiquadFilter();
                filter.type = this.data.filterType || 'lowpass';
                filter.frequency.setValueAtTime(this.data.filterCutoff || 20000, when);
                filter.Q.setValueAtTime(this.data.filterResonance || 1, when);

                lastNode.connect(filter);
                lastNode = filter;
            }

            // Connect: source -> gain (-> envelope) (-> pan) (-> filter) -> master
            source.connect(gainNode);
            lastNode.connect(this.masterGain);

            // Apply sample start/end (trim)
            const sampleStart = (this.data.sampleStart || 0) * this.sampleBuffer.duration;
            const sampleEnd = (this.data.sampleEnd || 1) * this.sampleBuffer.duration;
            const offset = sampleStart;
            const duration = sampleEnd - sampleStart;

            // Start playback with offset and duration
            if (this.data.loop) {
                source.start(when, offset); // Loop indefinitely
            } else {
                source.start(when, offset, duration); // One-shot with trim
            }

            // Track active source
            this.activeSources.set(midiNote, {
                source,
                gainNode,
                startTime: when,
                panner: lastNode !== gainNode ? lastNode : null
            });

            // Auto-cleanup when finished
            source.onended = () => {
                if (this.activeSources.get(midiNote)?.source === source) {
                    this.activeSources.delete(midiNote);
                    gainNode.disconnect();
                    if (lastNode !== gainNode) {
                        lastNode.disconnect();
                    }
                }
            };

            this._isPlaying = true;
            this.activeNotes.set(midiNote, { startTime: when, velocity });

        } catch (error) {
            console.error(`❌ SingleSample noteOn failed: ${this.name}:`, error);
        }
    }

    /**
     * Stop a note
     * @param {number} midiNote - MIDI note to stop (null = stop all)
     * @param {number} stopTime - When to stop (AudioContext time)
     */
    noteOff(midiNote = null, stopTime = null) {
        const when = stopTime !== null ? stopTime : this.audioContext.currentTime;

        if (midiNote === null) {
            // Stop all notes
            this.stopAll();
            return;
        }

        try {
            const activeSource = this.activeSources.get(midiNote);
            if (activeSource) {
                const { source, gainNode } = activeSource;

                // Apply release envelope if defined
                const release = (this.data.release || 50) / 1000;

                // Fade out with release time
                gainNode.gain.setValueAtTime(gainNode.gain.value, when);
                gainNode.gain.linearRampToValueAtTime(0, when + release);

                // Stop source after release
                source.stop(when + release);

                // Cleanup
                this.activeSources.delete(midiNote);
                this.activeNotes.delete(midiNote);

                if (this.activeSources.size === 0) {
                    this._isPlaying = false;
                }
            }

        } catch (error) {
            // Source might already be stopped, ignore
        }
    }

    /**
     * Stop all playing notes
     */
    stopAll() {
        const now = this.audioContext.currentTime;
        const release = (this.data.release || 50) / 1000;

        for (const [midiNote, { source, gainNode }] of this.activeSources) {
            try {
                gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                gainNode.gain.linearRampToValueAtTime(0, now + release);
                source.stop(now + release);
            } catch (error) {
                // Already stopped
            }
        }

        this.activeSources.clear();
        this.activeNotes.clear();
        this._isPlaying = false;
    }

    /**
     * Connect to destination
     */
    connect(destination) {
        if (this.masterGain) {
            this.masterGain.connect(destination);
        }
    }

    /**
     * Disconnect
     */
    disconnect() {
        if (this.masterGain) {
            this.masterGain.disconnect();
        }
    }

    /**
     * Update parameters in real-time
     * Called when user changes parameters in the editor
     */
    updateParameters(params) {
        console.log(`🎛️ SingleSampleInstrument.updateParameters (${this.name}):`, params);

        // Update internal data
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined) {
                this.data[key] = params[key];
            }
        });

        // Update master gain if volume/gain changed
        if (params.gain !== undefined && this.masterGain) {
            this.masterGain.gain.setValueAtTime(
                params.gain,
                this.audioContext.currentTime
            );
        }

        console.log(`✅ Parameters updated for ${this.name}`);
    }

    /**
     * Cleanup
     */
    dispose() {
        this.stopAll();

        if (this.masterGain) {
            this.masterGain.disconnect();
            this.masterGain = null;
        }

        this.sampleBuffer = null;
        this.activeSources.clear();
        this.activeNotes.clear();

        console.log(`🗑️ SingleSample disposed: ${this.name}`);
    }
}
