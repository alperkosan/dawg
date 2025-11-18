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
import { clampValue, createDefaultSampleChopPattern } from './sampleChopUtils.js';

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

        // Sample chop
        this.sampleChop = instrumentData.sampleChop
            ? JSON.parse(JSON.stringify(instrumentData.sampleChop))
            : createDefaultSampleChopPattern();
        this.sampleChopMode = instrumentData.sampleChopMode || 'standard';
        this.data.sampleChop = this.sampleChop;
        this.data.sampleChopMode = this.sampleChopMode;
        this._chopTimer = null;
        this._chopStartTime = 0;
        this._chopSecondsPerStep = 0;
        this._activeChopSliceId = null;
        this._lastChopStep = -1;
        this._currentChopSource = null;
        this._currentChopGain = null;
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

        const useChop = this._shouldUseSampleChop();
        if (import.meta.env.DEV) {
            console.log(`[SampleChop][Single] noteOn ${this.name}`, {
                midiNote,
                mode: this.sampleChopMode,
                loopEnabled: this.sampleChop?.loopEnabled,
                sliceCount: this.sampleChop?.slices?.length || 0,
                useChop
            });
        }

        if (useChop) {
            this._trackNoteOn(midiNote, velocity, when);
            if (this.activeNotes.size === 1) {
                this._startSampleChopPlayback(when);
            }
            return;
        }

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

            // ✅ PHASE 2: Create filter - apply mod wheel, aftertouch, and key tracking if present
            if (this.data.filterType && this.data.filterCutoff) {
                const filter = this.audioContext.createBiquadFilter();
                filter.type = this.data.filterType || 'lowpass';
                
                // ✅ KEY TRACKING: Get base filter cutoff
                let filterCutoff = this.data.filterCutoff || 20000;
                
                // ✅ KEY TRACKING: Apply key tracking if enabled
                if (this.data.filterKeyTracking !== undefined && this.data.filterKeyTracking > 0) {
                    const keyTrackingAmount = this.data.filterKeyTracking; // 0-1
                    const noteFrequency = 440 * Math.pow(2, (midiNote - 69) / 12);
                    const baseFrequency = 440 * Math.pow(2, (60 - 69) / 12); // C4 as base
                    const frequencyRatio = noteFrequency / baseFrequency;
                    
                    // Calculate key tracking offset
                    // Higher notes = higher frequency = higher cutoff
                    // Range: ±50% of base cutoff based on key tracking amount
                    const keyTrackingOffset = (frequencyRatio - 1) * keyTrackingAmount * filterCutoff * 0.5;
                    filterCutoff = filterCutoff + keyTrackingOffset;
                    filterCutoff = Math.max(20, Math.min(20000, filterCutoff)); // Clamp to valid range
                }
                
                // Apply mod wheel (CC1) to filter cutoff if present
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
     * @param {number|null} releaseVelocity - Note-off velocity (0-127, null = default)
     */
    noteOff(midiNote = null, stopTime = null, releaseVelocity = null) {
        const when = stopTime !== null ? stopTime : this.audioContext.currentTime;

        if (midiNote === null) {
            // Stop all notes
            this.stopAll();
            return;
        }

        if (this._shouldUseSampleChop()) {
            this._trackNoteOff(midiNote);
            if (this.activeNotes.size === 0) {
                this._stopSampleChopPlayback();
            }
            return;
        }

        try {
            const activeSource = this.activeSources.get(midiNote);
            if (activeSource) {
                const { source, gainNode } = activeSource;

                // ✅ RELEASE VELOCITY: Calculate effective release time based on release velocity
                let baseRelease = (this.data.release || 50) / 1000;
                let effectiveRelease = baseRelease;
                
                if (releaseVelocity !== null && releaseVelocity !== undefined) {
                    const velocityNormalized = Math.max(0, Math.min(127, releaseVelocity)) / 127; // 0-1
                    // Map velocity to release time: 0.5x (fast) to 1.0x (normal)
                    const releaseTimeMultiplier = 1.0 - (velocityNormalized * 0.5);
                    effectiveRelease = baseRelease * releaseTimeMultiplier;
                    
                    if (import.meta.env.DEV) {
                        console.log(`🎚️ SingleSample release: velocity=${releaseVelocity}, baseTime=${baseRelease.toFixed(3)}s, effectiveTime=${effectiveRelease.toFixed(3)}s`);
                    }
                }

                // Fade out with effective release time
                gainNode.gain.setValueAtTime(gainNode.gain.value, when);
                gainNode.gain.linearRampToValueAtTime(0, when + effectiveRelease);

                // Stop source after release
                source.stop(when + effectiveRelease);

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
        this._stopSampleChopPlayback();
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

        if (params.sampleChopMode !== undefined) {
            const nextMode = params.sampleChopMode;
            if (nextMode !== this.sampleChopMode) {
                this.sampleChopMode = nextMode;
                this.data.sampleChopMode = nextMode;
                if (nextMode !== 'chop') {
                    this._stopSampleChopPlayback();
                } else if (this.activeNotes.size > 0) {
                    const restartTime = this.audioContext ? this.audioContext.currentTime : undefined;
                    this._startSampleChopPlayback(restartTime);
                }
            }
        }

        if (params.sampleChop !== undefined) {
            this._updateSampleChopPattern(params.sampleChop);
        }

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
        this._stopSampleChopPlayback();

        console.log(`🗑️ SingleSample disposed: ${this.name}`);
    }

    /**
     * ===================== SAMPLE CHOP HELPERS =====================
     */
    _shouldUseSampleChop() {
        const result = Boolean(
            this.sampleChopMode === 'chop' &&
            this.sampleChop &&
            this.sampleChop.loopEnabled &&
            Array.isArray(this.sampleChop.slices) &&
            this.sampleChop.slices.length > 0
        );
        if (import.meta.env.DEV) {
            console.log(`[SampleChop][Single] _shouldUseSampleChop ${this.name}`, {
                mode: this.sampleChopMode,
                loopEnabled: this.sampleChop?.loopEnabled,
                sliceCount: this.sampleChop?.slices?.length || 0,
                result
            });
        }
        return result;
    }

    _updateSampleChopPattern(pattern) {
        this.sampleChop = JSON.parse(JSON.stringify(pattern || createDefaultSampleChopPattern()));
        this.data.sampleChop = this.sampleChop;

        if (this.sampleChopMode === 'chop' && this.sampleChop.loopEnabled && (this._chopTimer || this.activeNotes.size > 0)) {
            const restartTime = this.audioContext ? this.audioContext.currentTime : undefined;
            this._startSampleChopPlayback(restartTime);
        }
    }

    _startSampleChopPlayback(startTime = this.audioContext.currentTime) {
        if (this.sampleChopMode !== 'chop') {
            if (import.meta.env.DEV) {
                console.log(`[SampleChop][Single] start aborted: mode=${this.sampleChopMode}`);
            }
            return;
        }
        if (!this.sampleChop || !this.sampleChop.loopEnabled) {
            if (import.meta.env.DEV) {
                console.log(`[SampleChop][Single] start aborted: loopEnabled=${this.sampleChop?.loopEnabled}`);
            }
            return;
        }

        const hasSlices = Array.isArray(this.sampleChop.slices) && this.sampleChop.slices.length > 0;
        if (!hasSlices) {
            if (import.meta.env.DEV) {
                console.log('[SampleChop][Single] start aborted: no slices');
            }
            return;
        }

        this._stopSampleChopPlayback();

        const tempo = this._getSampleChopTempo();
        const secondsPerStep = (60 / Math.max(tempo, 1)) / 4; // 16th-note grid

        if (import.meta.env.DEV) {
            console.log('[SampleChop][Single] start', {
                tempo,
                secondsPerStep,
                startTime
            });
        }

        this._chopStartTime = startTime || this.audioContext.currentTime;
        this._chopSecondsPerStep = secondsPerStep || 0.125;
        this._lastChopStep = -1;
        this._activeChopSliceId = null;

        this._chopTimer = setInterval(() => {
            try {
                this._applySampleChopFrame();
            } catch (error) {
                console.error('SampleChop playback error (single sample):', error);
            }
        }, 40);

        this._applySampleChopFrame();
    }

    _stopSampleChopPlayback() {
        if (this._chopTimer) {
            clearInterval(this._chopTimer);
            this._chopTimer = null;
        }
        this._chopStartTime = 0;
        this._chopSecondsPerStep = 0;
        this._activeChopSliceId = null;
        this._lastChopStep = -1;
        this._stopActiveChopSource();
    }

    _applySampleChopFrame() {
        if (!this.sampleChop || !this.sampleChop.loopEnabled) {
            return;
        }
        if (!Array.isArray(this.sampleChop.slices) || this.sampleChop.slices.length === 0) {
            return;
        }
        if (!this._chopSecondsPerStep) {
            return;
        }

        const loopDuration = this.sampleChop.length * this._chopSecondsPerStep;
        if (!loopDuration || loopDuration <= 0) {
            if (import.meta.env.DEV) {
                console.log('[SampleChop][Single] invalid loopDuration', {
                    length: this.sampleChop.length,
                    secondsPerStep: this._chopSecondsPerStep
                });
            }
            return;
        }

        const currentTime = this.audioContext.currentTime;
        const elapsed = currentTime - this._chopStartTime;
        const loopPosition = ((elapsed % loopDuration) + loopDuration) % loopDuration;
        const stepFloat = loopPosition / this._chopSecondsPerStep;

        const activeSlice = this._findActiveChopSlice(stepFloat);
        if (import.meta.env.DEV) {
            console.log('[SampleChop][Single] frame', {
                elapsed: elapsed.toFixed(3),
                stepFloat: stepFloat.toFixed(2),
                activeSlice: activeSlice?.id || null
            });
        }

        if (activeSlice?.id !== this._activeChopSliceId) {
            this._activeChopSliceId = activeSlice ? activeSlice.id : null;
            this._playSampleChopSlice(activeSlice);
        }

        this._lastChopStep = stepFloat;
    }

    _findActiveChopSlice(stepFloat) {
        const patternLength = this.sampleChop.length || 0;
        if (!patternLength) {
            return null;
        }

        const normalizedStep = ((stepFloat % patternLength) + patternLength) % patternLength;
        const slices = this.sampleChop.slices || [];

        for (let i = 0; i < slices.length; i += 1) {
            const slice = slices[i];
            const start = slice.startStep ?? 0;
            const end = slice.endStep ?? start;
            if (end <= start) continue;

            if (normalizedStep >= start && normalizedStep < end) {
                return slice;
            }
        }

        return null;
    }

    _getSampleChopTempo() {
        if (this.sampleChop && this.sampleChop.tempo) {
            return this.sampleChop.tempo;
        }
        return 140;
    }

    _stopActiveChopSource() {
        if (this._currentChopSource) {
            try {
                this._currentChopSource.stop();
            } catch (e) {}
            try {
                this._currentChopSource.disconnect();
            } catch (e) {}
            this._currentChopSource = null;
        }

        if (this._currentChopGain) {
            try {
                this._currentChopGain.disconnect();
            } catch (e) {}
            this._currentChopGain = null;
        }
    }

    _playSampleChopSlice(slice) {
        if (!slice) {
            this._stopActiveChopSource();
            return;
        }

        if (import.meta.env.DEV) {
            console.log('[SampleChop][Single] trigger slice', {
                id: slice.id,
                startStep: slice.startStep,
                endStep: slice.endStep,
                startOffset: slice.startOffset,
                endOffset: slice.endOffset,
                gain: slice.gain,
                pitch: slice.pitch,
                loop: slice.loop,
                reverse: slice.reverse
            });
        }

        if (!this.sampleBuffer) {
            console.warn('SampleChop (single sample): No buffer available');
            this._stopActiveChopSource();
            return;
        }

        this._stopActiveChopSource();

        const buffer = this.sampleBuffer;
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.audioContext.createGain();
        const sliceGain = clampValue(slice.gain ?? 1, 0, 2);
        gainNode.gain.setValueAtTime(sliceGain, this.audioContext.currentTime);

        const pitch = slice.pitch ?? 0;
        const playbackRate = Math.pow(2, pitch / 12);

        const startRatio = clampValue(slice.startOffset ?? 0, 0, 0.99);
        const endRatio = clampValue(slice.endOffset ?? 1, startRatio + 0.01, 1);
        const bufferDuration = buffer.duration;
        const sliceStart = startRatio * bufferDuration;
        const sliceEnd = Math.min(bufferDuration, endRatio * bufferDuration);
        const sliceDuration = Math.max(sliceEnd - sliceStart, 0.01);

        const now = this.audioContext.currentTime;
        const isReverse = Boolean(slice.reverse);
        const shouldLoop = Boolean(slice.loop);

        if (shouldLoop) {
            source.loop = true;
            source.loopStart = sliceStart;
            source.loopEnd = sliceEnd;
        } else {
            source.loop = false;
        }

        if (isReverse) {
            if (shouldLoop) {
                console.warn('SampleChop: Reverse looping not supported yet, forcing one-shot');
            }
            source.playbackRate.setValueAtTime(-Math.abs(playbackRate), now);
            const offset = Math.max(0, sliceEnd - 0.0001);
            source.start(now, offset, sliceDuration);
        } else {
            source.playbackRate.setValueAtTime(playbackRate, now);
            if (shouldLoop) {
                source.start(now, sliceStart);
            } else {
                source.start(now, sliceStart, sliceDuration);
            }
        }

        source.connect(gainNode);
        gainNode.connect(this.masterGain);

        this._currentChopSource = source;
        this._currentChopGain = gainNode;

        source.onended = () => {
            if (this._currentChopSource === source) {
                this._currentChopSource = null;
                this._currentChopGain = null;
            }
        };
    }
}
