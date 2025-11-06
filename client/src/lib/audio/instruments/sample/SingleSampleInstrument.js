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
    noteOn(midiNote, velocity = 100, startTime = null, extendedParams = null) {
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
            // ✅ CUT ITSELF: Stop existing note at same pitch if enabled
            const cutItself = this.data.cutItself !== undefined ? this.data.cutItself : true; // Default true for single samples (drums)
            if (cutItself && this.activeSources.has(midiNote)) {
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
            
            // ✅ PHASE 2: Apply initial pitch bend if present
            let initialPitchBend = 0;
            if (extendedParams?.pitchBend && Array.isArray(extendedParams.pitchBend) && extendedParams.pitchBend.length > 0) {
                const firstPoint = extendedParams.pitchBend[0];
                initialPitchBend = (firstPoint.value / 8192) * 2; // ±2 semitones range
            }
            
            const totalPitchShift = baseShift + pitchParam + initialPitchBend;
            const playbackRate = Math.pow(2, totalPitchShift / 12);

            // ✅ EXTRA DEBUG: Log pitch math to diagnose wrong pitch issues
            console.log(`🎯 ${this.name}.pitchCalc:`, {
                midiNote,
                baseNote: this.baseNote,
                baseShift,
                pitchParam,
                totalPitchShift,
                playbackRate: Number.isFinite(playbackRate) ? playbackRate.toFixed(4) : playbackRate
            });
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

            // ✅ PHASE 2: Create panner - use note pan if available, otherwise instrument pan
            let lastNode = gainNode;
            const panValue = extendedParams?.pan !== undefined ? extendedParams.pan : (this.data.pan || 0);
            if (panValue !== 0) {
                const panner = this.audioContext.createStereoPanner();
                panner.pan.setValueAtTime(panValue, when);
                gainNode.connect(panner);
                lastNode = panner;
            }

            // ✅ PHASE 2: Create filter - apply mod wheel and aftertouch if present
            if (this.data.filterType && this.data.filterCutoff) {
                const filter = this.audioContext.createBiquadFilter();
                filter.type = this.data.filterType || 'lowpass';
                
                // Apply mod wheel (CC1) to filter cutoff if present
                let filterCutoff = this.data.filterCutoff || 20000;
                if (extendedParams?.modWheel !== undefined) {
                    const modWheelNormalized = extendedParams.modWheel / 127; // 0-1
                    const cutoffRange = filterCutoff * 0.5; // ±50% modulation
                    filterCutoff = filterCutoff + (modWheelNormalized - 0.5) * cutoffRange * 2;
                    filterCutoff = Math.max(20, Math.min(20000, filterCutoff)); // Clamp
                }
                filter.frequency.setValueAtTime(filterCutoff, when);
                
                // Apply aftertouch to filter Q if present
                let filterQ = this.data.filterResonance || 1;
                if (extendedParams?.aftertouch !== undefined) {
                    const aftertouchNormalized = extendedParams.aftertouch / 127; // 0-1
                    filterQ = filterQ + aftertouchNormalized * 10; // Add up to 10 Q
                    filterQ = Math.max(0, Math.min(30, filterQ)); // Clamp Q
                }
                filter.Q.setValueAtTime(filterQ, when);

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
