// src/lib/core/nodes/NativeSamplerNode.js - TONE.JS BAĞIMLILIĞI KALDIRILDI VE DÜZELTME

import { NativeTimeUtils } from '../../utils/NativeTimeUtils';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { EffectFactory } from '../../audio/effects';
import { clampValue, createDefaultSampleChopPattern } from '../../audio/instruments/sample/sampleChopUtils.js';

export class NativeSamplerNode {
    constructor(instrumentData, audioBuffer, audioContext) {
        this.id = instrumentData.id;
        this.name = instrumentData.name;
        this.buffer = audioBuffer;
        this.context = audioContext;
        this.pianoRoll = instrumentData.pianoRoll;
        this.cutItself = instrumentData.cutItself;
        this.pitchOffset = instrumentData.pitchOffset || 0;
        this.baseNote = instrumentData.baseNote || 60; // Default C4 for samples

        // ✅ NEW: Effect chain support
        this.effectChain = [];
        this.effectChainActive = false;
        this.internalOutput = this.context.createGain(); // Direct audio output
        this.output = this.internalOutput; // Public output (may be last effect or internalOutput)

        // ✅ Runtime parameters (UI controlled)
        this.params = {
            // Playback
            gain: 1.0,            // linear
            pan: 0.0,             // -1..1
            pitchOffset: this.pitchOffset || 0, // semitones

            // Sample region
            sampleStart: 0.0,     // 0..1 (normalized)
            sampleEnd: 1.0,       // 0..1
            loop: false,
            loopStart: 0.0,       // 0..1
            loopEnd: 1.0,         // 0..1
            reverse: false,

            // Envelope (ms / percent)
            attack: 0,            // ms
            decay: 0,             // ms
            sustain: 100,         // percent
            release: 50,          // ms

            // Filter
            filterType: 'lowpass',
            filterCutoff: 20000,
            filterResonance: 0,
        };

        // Sample chop state
        this.sampleChop = instrumentData.sampleChop
            ? JSON.parse(JSON.stringify(instrumentData.sampleChop))
            : createDefaultSampleChopPattern();
        this.sampleChopMode = instrumentData.sampleChopMode || 'standard';
        this._chopTimer = null;
        this._chopStartTime = 0;
        this._chopSecondsPerStep = 0;
        this._activeChopSliceId = null;
        this._lastChopStep = -1;
        this._currentChopSource = null;
        this._currentChopGain = null;
        this._chopNoteCount = 0;
        this._chopReleaseTimers = new Set();
        this._chopVelocity = 1;

        // ✅ RAW SIGNAL: No automatic gain reduction
        // Let samples play at their natural level - user controls with faders
        this.polyphonyGainReduction = false; // Disabled - RAW signal philosophy
        this.internalOutput.gain.value = 1.0; // Fixed unity gain

        // ✅ PHASE 4: Track last automation values to avoid redundant updates
        this._lastAutomationValues = {
            volume: null,
            pan: null,
            expression: null
        };

        this.activeSources = new Set();

        // Reverse buffer cache
        this._reversedBuffer = null;

        // ✅ NEW: Initialize effect chain if provided
        if (instrumentData.effectChain && instrumentData.effectChain.length > 0) {
            this.setEffectChain(instrumentData.effectChain);
        }

        console.log(`✅ NativeSamplerNode created: ${this.name}`);
    }

    triggerNote(pitch, velocity, time, duration, extendedParams = null) {
        const startTime = time || this.context.currentTime;
        const normalizedVelocity = velocity ?? 1;
        const useChop = this._shouldUseSampleChop();

        if (import.meta.env?.DEV) {
            console.log(`[SampleChop][Native] noteOn ${this.name}`, {
                pitch,
                velocity: normalizedVelocity,
                mode: this.sampleChopMode,
                loopEnabled: this.sampleChop?.loopEnabled,
                sliceCount: this.sampleChop?.slices?.length || 0,
                useChop
            });
        }

        if (useChop) {
            this._chopVelocity = normalizedVelocity;
            this._handleChopNoteOn(startTime);

            const durationSeconds = this._resolveDurationSeconds(duration);
            if (durationSeconds) {
                this._scheduleChopRelease(durationSeconds);
            }
            return;
        }

        // ✅ DEBUG: Log kick triggers
        if (this.id === 'inst-1') {
            console.log('🥁 Kick triggerNote!', { pitch, velocity: normalizedVelocity, hasBuffer: !!this.buffer });
        }

        // ✅ DÜZELTME: cutItself özelliği
        if (this.cutItself) {
            this.stopAll(startTime);
        }

        const source = this.context.createBufferSource();
        const useReverse = !!this.params.reverse;
        const bufferToPlay = useReverse ? (this._getReversedBuffer() || this.buffer) : this.buffer;
        if (!bufferToPlay) {
            console.warn(`[NativeSamplerNode] No buffer for ${this.name}; skipping trigger`);
            return;
        }
        source.buffer = bufferToPlay;

        // ✅ Pitch handling: always honor incoming pitch relative to baseNote
        const targetMidi = this.pitchToMidi(pitch ?? 60);
        let semitoneShift = targetMidi - (this.baseNote || 60);

        // Add pitch offset if set
        if (this.pitchOffset) {
            semitoneShift += this.pitchOffset;
        }

        // ✅ PHASE 2: Apply initial pitch bend if present
        let initialPitchBend = 0;
        if (extendedParams?.pitchBend && Array.isArray(extendedParams.pitchBend) && extendedParams.pitchBend.length > 0) {
            // Use first pitch bend point as initial value
            const firstPoint = extendedParams.pitchBend[0];
            // Pitch bend range: -8192 to 8191 (MIDI standard), convert to semitones
            // Standard pitch bend range is ±2 semitones (some synths use ±12)
            initialPitchBend = (firstPoint.value / 8192) * 2; // ±2 semitones range
        }

        const playbackRate = Math.pow(2, (semitoneShift + initialPitchBend) / 12);

        // 🔧 DEBUG: Log pitch math for diagnostics
        console.log(`🎯 ${this.name || 'Sample'}.pitchCalc:`, {
            pitch,
            targetMidi,
            baseNote: this.baseNote || 60,
            semitoneShift,
            pitchOffset: this.pitchOffset || 0,
            playbackRate: Number.isFinite(playbackRate) ? playbackRate.toFixed(4) : playbackRate
        });

        // Apply playback rate (guard against invalid values)
        if (Number.isFinite(playbackRate) && playbackRate > 0) {
            source.playbackRate.setValueAtTime(playbackRate, startTime);
            
            // ✅ PHASE 2: Schedule pitch bend automation if present
            if (extendedParams?.pitchBend && Array.isArray(extendedParams.pitchBend) && extendedParams.pitchBend.length > 1) {
                // Schedule pitch bend changes over time
                // For pitch bend automation, we'll use the note duration in seconds
                const noteDurationSec = duration || bufferToPlay.duration || 1;
                
                extendedParams.pitchBend.forEach((point, index) => {
                    if (index === 0) return; // Skip first point (already applied as initial)
                    
                    // Convert point.time (0-1 normalized or absolute steps) to seconds
                    let pointTime;
                    if (point.time <= 1 && point.time >= 0) {
                        // Normalized time (0-1) - multiply by note duration
                        pointTime = startTime + (point.time * noteDurationSec);
                    } else {
                        // Absolute time in steps - estimate conversion (4 steps per beat, 120 BPM default)
                        const stepsPerBeat = 4;
                        const bpm = 120; // Default, will be refined if transport available
                        const secondsPerStep = (60 / bpm) / stepsPerBeat;
                        pointTime = startTime + (point.time * secondsPerStep);
                    }
                    
                    // Calculate new playback rate with pitch bend
                    const pitchBendSemitones = (point.value / 8192) * 2; // ±2 semitones
                    const newPlaybackRate = Math.pow(2, (semitoneShift + pitchBendSemitones) / 12);
                    
                    if (Number.isFinite(newPlaybackRate) && newPlaybackRate > 0 && pointTime > startTime) {
                        source.playbackRate.setValueAtTime(newPlaybackRate, pointTime);
                    }
                });
            }
        }

        // =====================
        // Gain / Envelope / Filter / Pan chain
        // =====================

        // Envelope gain (per-note)
        const envelopeGain = this.context.createGain();
        const sustainLinear = Math.max(0, Math.min(1, (this.params.sustain ?? 100) / 100));
        const attackSec = Math.max(0, (this.params.attack || 0) / 1000);
        const decaySec = Math.max(0, (this.params.decay || 0) / 1000);
        const releaseSec = Math.max(0.005, (this.params.release || 50) / 1000);

        // Backward-compatible behavior: if ADSR is effectively neutral (A=0,D=0,S=100),
        // don't impose an envelope ramp; keep unity pass-through.
        const envelopeNeutral = attackSec === 0 && decaySec === 0 && Math.abs(sustainLinear - 1.0) < 1e-6;
        if (envelopeNeutral) {
            envelopeGain.gain.setValueAtTime(1.0, startTime);
        } else {
            // Start at 0, ramp to peak, then decay to sustain
            const peak = 1.0;
            envelopeGain.gain.setValueAtTime(0, startTime);
            if (attackSec > 0) {
                envelopeGain.gain.linearRampToValueAtTime(peak, startTime + attackSec);
            } else {
                envelopeGain.gain.setValueAtTime(peak, startTime);
            }
            if (decaySec > 0) {
                envelopeGain.gain.linearRampToValueAtTime(peak * sustainLinear, startTime + attackSec + decaySec);
            } else {
                envelopeGain.gain.setValueAtTime(peak * sustainLinear, startTime + attackSec);
            }
        }

        // Filter (optional)
        let lastNode = envelopeGain;
        let filterNode = null;
        if (this.params.filterCutoff !== undefined || this.params.filterResonance !== undefined) {
            filterNode = this.context.createBiquadFilter();
            filterNode.type = this.params.filterType || 'lowpass';
            
            // ✅ PHASE 2: Apply mod wheel (CC1) to filter cutoff if present
            let filterCutoff = this.params.filterCutoff || 20000;
            if (extendedParams?.modWheel !== undefined) {
                // Mod wheel (0-127) modulates filter cutoff
                // Map mod wheel to ±50% of cutoff range
                const modWheelNormalized = extendedParams.modWheel / 127; // 0-1
                const cutoffRange = filterCutoff * 0.5; // ±50% modulation
                filterCutoff = filterCutoff + (modWheelNormalized - 0.5) * cutoffRange * 2;
                filterCutoff = Math.max(20, Math.min(20000, filterCutoff)); // Clamp to audible range
            }
            
            filterNode.frequency.setValueAtTime(filterCutoff, startTime);
            
            // ✅ PHASE 2: Apply aftertouch to filter Q (resonance) if present
            let filterQ = this.params.filterResonance || 0;
            if (extendedParams?.aftertouch !== undefined) {
                // Aftertouch (0-127) modulates filter Q
                const aftertouchNormalized = extendedParams.aftertouch / 127; // 0-1
                filterQ = filterQ + aftertouchNormalized * 10; // Add up to 10 Q
                filterQ = Math.max(0, Math.min(30, filterQ)); // Clamp Q
            }
            
            filterNode.Q.setValueAtTime(filterQ, startTime);
            lastNode.connect(filterNode);
            lastNode = filterNode;
        }

        // ✅ PHASE 2: Panner - use note pan if available, otherwise instrument pan
        const panner = this.context.createStereoPanner();
        const panValue = extendedParams?.pan !== undefined ? extendedParams.pan : (this.params.pan || 0);
        panner.pan.setValueAtTime(panValue, startTime);
        lastNode.connect(panner);
        lastNode = panner;

        const gainNode = this.context.createGain();

        // ✅ RAW SIGNAL: Direct velocity to gain mapping (no reduction!)
        // MIDI velocity 0-127 → Audio gain 0-1.0
        // User controls final level with mixer faders - this is professional DAW standard
        let velocityValue = normalizedVelocity;
        if (velocityValue === undefined || velocityValue === null) {
            velocityValue = 100;
        }
        if (velocityValue > 1) {
            // Direct MIDI to linear: 0-127 → 0-1.0
            velocityValue = velocityValue / 127;
        }
        const velocityGainLinear = velocityValue * 1.0;

        // 🔧 FIX: Add headroom for samples with pre-existing clipping
        // Sample analysis showed some samples have clipped peaks (>100%)
        // Apply gentle reduction to prevent output clipping
        const sampleHeadroom = 0.85;  // -1.4dB safety headroom
        const finalGain = velocityGainLinear * sampleHeadroom * (this.params.gain || 1.0);
        gainNode.gain.setValueAtTime(finalGain, startTime);
        if (!Number.isFinite(finalGain) || finalGain <= 0) {
            console.warn(`⚠️ ${this.name} finalGain invalid:`, { velocityValue, velocityGainLinear, finalGain });
        }

        // Connect chain: source -> envelope -> (filter) -> panner -> gain -> output
        source.connect(envelopeGain);
        lastNode.connect(gainNode);
        gainNode.connect(this.internalOutput);

        // =====================
        // Loop / region / reverse handling
        // =====================
        const durationSec = bufferToPlay?.duration || 0;
        const regionStart = Math.max(0, Math.min(1, this.params.sampleStart ?? 0)) * durationSec;
        const regionEndNorm = (this.params.sampleEnd === undefined ? 1 : this.params.sampleEnd);
        const regionEnd = Math.max(0, Math.min(1, regionEndNorm)) * durationSec;
        const regionLength = Math.max(0.001, Math.max(0, regionEnd - regionStart));

        console.log(`🎬 ${this.name} start region:`, {
            durationSec: Number(durationSec.toFixed ? durationSec.toFixed(3) : durationSec),
            regionStart: Number(regionStart.toFixed ? regionStart.toFixed(3) : regionStart),
            regionEnd: Number(regionEnd.toFixed ? regionEnd.toFixed(3) : regionEnd),
            regionLength: Number(regionLength.toFixed ? regionLength.toFixed(3) : regionLength),
            loop: !!this.params.loop,
            loopStart: this.params.loopStart,
            loopEnd: this.params.loopEnd
        });

        if (this.params.loop) {
            source.loop = true;
            source.loopStart = Math.max(0, Math.min(1, this.params.loopStart || 0)) * durationSec;
            source.loopEnd = Math.max(0, Math.min(1, this.params.loopEnd === undefined ? 1 : this.params.loopEnd)) * durationSec;
        }

        // Start with region trimming
        source.start(startTime, regionStart, this.params.loop ? undefined : regionLength);
        
        // ✅ DÜZELTME: Duration handling with Native Time Utils
        if (duration) {
            try {
                let durationInSeconds;
                if (typeof duration === 'number' && isFinite(duration)) {
                    durationInSeconds = duration;
                } else {
                    const currentBpm = usePlaybackStore.getState().bpm;
                    durationInSeconds = NativeTimeUtils.parseTime(duration, currentBpm);
                }
                
                if (isFinite(durationInSeconds) && durationInSeconds > 0) {
                    // Release envelope before stop if envelope is active
                    const stopAt = startTime + durationInSeconds;
                    if (envelopeNeutral) {
                        source.stop(stopAt);
                    } else {
                        const currentGain = gainNode.gain.value;
                        gainNode.gain.setValueAtTime(currentGain, stopAt);
                        gainNode.gain.linearRampToValueAtTime(0, stopAt + releaseSec);
                        source.stop(stopAt + releaseSec);
                    }
                }
            } catch (e) { 
                console.warn(`[NativeSamplerNode] Geçersiz süre formatı: ${duration}`, e);
                // Default 1 saniye duration
                const stopAt = startTime + 1;
                if (envelopeNeutral) {
                    source.stop(stopAt);
                } else {
                    gainNode.gain.setValueAtTime(gainNode.gain.value, stopAt);
                    gainNode.gain.linearRampToValueAtTime(0, stopAt + releaseSec);
                    source.stop(stopAt + releaseSec);
                }
            }
        }

        this.activeSources.add(source);

        source.onended = () => {
            this.activeSources.delete(source);
            gainNode.disconnect();
            source.disconnect();
        };
    }

    // ✅ Release all notes gracefully (for pause)
    allNotesOff(time = null) {
        const stopTime = time !== null ? time : this.context.currentTime;
        console.log(`🎹 NativeSampler allNotesOff: ${this.name} (${this.activeSources.size} active)`);

        // For samples, allNotesOff is same as stopAll (no release envelope)
        this.activeSources.forEach(source => {
            try {
                source.stop(stopTime);
            } catch(e) {
                // Already stopped, ignore error
            }
        });
        this.activeSources.clear();
        this._stopSampleChopPlayback();
    }

    // ✅ PANIC: Instant stop (for emergency stop button)
    stopAll(time = 0) {
        const stopTime = time || this.context.currentTime;
        console.log(`🛑 NativeSampler stopAll: ${this.name} (${this.activeSources.size} active)`);

        this.activeSources.forEach(source => {
            try {
                source.stop(stopTime);
            } catch(e) {
                // Already stopped, ignore error
            }
        });
        this.activeSources.clear();
        this._stopSampleChopPlayback();
    }

    // ✅ DÜZELTME: Pitch to MIDI conversion
    pitchToMidi(pitch) {
        // Support numeric MIDI directly
        if (typeof pitch === 'number' && Number.isFinite(pitch)) {
            const midi = Math.round(pitch);
            return Math.max(0, Math.min(127, midi));
        }

        if (!pitch) return 60;

        const noteNames = {
            C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
            'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
        };

        const match = String(pitch).match(/^([A-G][#b]?)(-?\d+)$/);
        if (!match) {
            console.warn(`Invalid pitch format: ${pitch}, using C4`);
            return 60;
        }

        const noteName = match[1];
        const octave = parseInt(match[2], 10);
        const noteValue = noteNames[noteName];
        if (noteValue === undefined) {
            console.warn(`Unknown note name: ${noteName}, using C4`);
            return 60;
        }

        const midiNumber = (octave + 1) * 12 + noteValue;
        return Math.max(0, Math.min(127, midiNumber));
    }

    // Sample için releaseNote boş (trigger-based playback)
    // ✅ PHASE 2: Added releaseVelocity parameter for consistency
    releaseNote(pitch = null, time = null, releaseVelocity = null) {
        if (this._chopNoteCount > 0) {
            this._handleChopNoteOff();
        }
        // Samples are usually trigger-based, no additional release handling needed for standard playback
    }

    /**
     * ✅ POLYPHONY GAIN COMPENSATION
     * Dynamically reduce gain based on active voice count to prevent clipping
     * Professional sampler behavior: more voices = lower per-voice gain
     */
    _updatePolyphonyGain() {
        if (!this.polyphonyGainReduction) return;

        const voiceCount = this.activeSources.size;

        // Calculate polyphonic gain reduction
        // Target: Total output should NOT exceed 1.0 even with max velocity
        // Max per-voice velocity = 0.7, so we need: 0.7 * polyphonyGain * voiceCount <= 1.0
        // Therefore: polyphonyGain = 1.0 / (0.7 * voiceCount) for safety
        // But we use sqrt for more musical/natural reduction
        let polyphonyGain = 1.0;
        if (voiceCount > 1) {
            // Conservative approach: gain = 0.8 / voiceCount
            // 2 voices = 0.4 each (-8dB) → total 0.8
            // 4 voices = 0.2 each (-14dB) → total 0.8
            // 8 voices = 0.1 each (-20dB) → total 0.8
            polyphonyGain = Math.max(0.05, 0.8 / voiceCount);
        }

        // Smooth gain change to avoid clicks
        this.internalOutput.gain.setTargetAtTime(
            polyphonyGain,
            this.context.currentTime,
            0.01 // 10ms time constant
        );
    }

    // ✅ EKLENEN: Dispose metodu
    dispose() {
        this.stopAll();
        if (this.output) {
            this.output.disconnect();
        }
        console.log(`🗑️ NativeSamplerNode disposed: ${this.name}`);
    }

    // ✅ EKLENEN: Voice count for debugging
    getActiveVoiceCount() {
        return this.activeSources.size;
    }

    // ✅ EKLENEN: Parameter update for real-time control
    updateParameters(params) {
        console.log(`🎛️ NativeSamplerNode.updateParameters:`, this.name, params);

        if (params.volume !== undefined) {
            // Update main volume
            if (this.output) {
                const linearValue = this.dbToLinear(params.volume);
                this.output.gain.setTargetAtTime(linearValue, this.context.currentTime, 0.02);
                console.log(`🔊 Updated sampler volume: ${params.volume}dB → ${linearValue.toFixed(3)}`);
            }
        }

        if (params.pitchOffset !== undefined) {
            // Store pitch offset for new notes (can't change existing notes)
            this.pitchOffset = params.pitchOffset;
            console.log(`🎵 Updated sampler pitch offset: ${params.pitchOffset} semitones`);
        }

        if (params.cutItself !== undefined) {
            this.cutItself = params.cutItself;
            console.log(`✂️ Updated cutItself: ${params.cutItself}`);
        }

        // Map UI fields
        if (params.gain !== undefined && this.output) {
            this.params.gain = Math.max(0, params.gain);
        }
        if (params.pan !== undefined) this.params.pan = Math.max(-1, Math.min(1, params.pan));
        if (params.pitch !== undefined) this.pitchOffset = params.pitch || 0;

        if (params.sampleStart !== undefined) this.params.sampleStart = params.sampleStart;
        if (params.sampleEnd !== undefined) this.params.sampleEnd = params.sampleEnd;
        if (params.loop !== undefined) this.params.loop = !!params.loop;
        if (params.loopStart !== undefined) this.params.loopStart = params.loopStart;
        if (params.loopEnd !== undefined) this.params.loopEnd = params.loopEnd;
        if (params.reverse !== undefined) {
            this.params.reverse = !!params.reverse;
            // Rebuild reverse buffer lazily next trigger
            if (this.params.reverse && !this._reversedBuffer) {
                this._buildReversedBuffer();
            }
        }

        if (params.attack !== undefined) this.params.attack = params.attack;
        if (params.decay !== undefined) this.params.decay = params.decay;
        if (params.sustain !== undefined) this.params.sustain = params.sustain;
        if (params.release !== undefined) this.params.release = params.release;

        if (params.filterType !== undefined) this.params.filterType = params.filterType;
        if (params.filterCutoff !== undefined) this.params.filterCutoff = params.filterCutoff;
        if (params.filterResonance !== undefined) this.params.filterResonance = params.filterResonance;

        if (params.sampleChopMode !== undefined) {
            const nextMode = params.sampleChopMode;
            if (nextMode !== this.sampleChopMode) {
                this.sampleChopMode = nextMode;
                if (nextMode !== 'chop') {
                    this._stopSampleChopPlayback();
                } else if (this._chopNoteCount > 0) {
                    this._startSampleChopPlayback();
                }
            }
        }

        if (params.sampleChop !== undefined) {
            try {
                this.sampleChop = JSON.parse(JSON.stringify(params.sampleChop || createDefaultSampleChopPattern()));
            } catch {
                this.sampleChop = createDefaultSampleChopPattern();
            }

            if (this._chopNoteCount > 0 && this._shouldUseSampleChop()) {
                this._startSampleChopPlayback();
            }
        }
    }

    // ✅ UTILITY: Convert dB to linear
    dbToLinear(db) {
        return Math.pow(10, db / 20);
    }

    // ✅ PHASE 4: Apply automation (compatible with AutomationScheduler)
    /**
     * Apply automation parameters (volume, pan, expression, etc.)
     * @param {Object} params - Automation parameters
     * @param {number} [params.volume] - Volume (0-1 normalized)
     * @param {number} [params.pan] - Pan (-1 to 1)
     * @param {number} [params.expression] - Expression (0-1 normalized)
     * @param {number} [params.filterCutoff] - Filter cutoff (0-127)
     * @param {number} [params.filterResonance] - Filter resonance (0-127)
     * @param {number} [time] - AudioContext time to apply (optional)
     */
    applyAutomation(params, time = null) {
        const now = time !== null ? time : this.context.currentTime;

        // Volume automation (0-1 normalized to gain)
        if (params.volume !== undefined) {
            const clampedVolume = Math.max(0, Math.min(1, params.volume));
            
            // ✅ OPTIMIZATION: Skip update if value hasn't changed (within tolerance)
            const tolerance = 0.001; // 0.1% tolerance to avoid floating point issues
            const lastVolume = this._lastAutomationValues.volume;
            const volumeChanged = lastVolume === null || Math.abs(clampedVolume - lastVolume) >= tolerance;
            
            if (volumeChanged && this.internalOutput) {
                // Smooth transition to avoid clicks
                this.internalOutput.gain.cancelScheduledValues(now);
                this.internalOutput.gain.setTargetAtTime(clampedVolume, now, 0.01);
                
                // Update last value
                this._lastAutomationValues.volume = clampedVolume;
                
                // ✅ DEBUG: Log volume automation (always for sample-based instruments, occasionally for others)
                const isSampleBased = this.id.includes('hihat') || this.id.includes('snare') || this.id.includes('808') || this.id.includes('kick');
                if (isSampleBased || Math.random() < 0.05) { // Always log for sample-based instruments, 5% chance for others
                    console.log(`🎚️ NativeSamplerNode.applyAutomation [${this.id}]: volume=${clampedVolume.toFixed(3)}`);
                }
            }
        }

        // Pan automation (-1 to 1)
        if (params.pan !== undefined) {
            this.params.pan = Math.max(-1, Math.min(1, params.pan));
            // Note: Pan is applied per-voice in triggerNote, not here
        }

        // Expression automation (0-1 normalized, similar to volume)
        if (params.expression !== undefined) {
            // Expression affects volume multiplicatively
            const clampedExpression = Math.max(0, Math.min(1, params.expression));
            if (this.internalOutput && params.volume === undefined) {
                // Only apply expression if volume wasn't already set
                this.internalOutput.gain.cancelScheduledValues(now);
                this.internalOutput.gain.setTargetAtTime(clampedExpression, now, 0.01);
            }
        }

        // Filter automation
        if (params.filterCutoff !== undefined) {
            this.params.filterCutoff = Math.max(20, Math.min(20000, params.filterCutoff));
        }
        if (params.filterResonance !== undefined) {
            this.params.filterResonance = Math.max(0, Math.min(40, params.filterResonance));
        }
    }

    // =====================
    // Reverse buffer helpers
    // =====================
    _buildReversedBuffer() {
        if (!this.buffer) return null;
        const channels = this.buffer.numberOfChannels;
        const length = this.buffer.length;
        const sampleRate = this.buffer.sampleRate;
        const rev = this.context.createBuffer(channels, length, sampleRate);
        for (let ch = 0; ch < channels; ch++) {
            const src = this.buffer.getChannelData(ch);
            const dst = rev.getChannelData(ch);
            for (let i = 0, j = length - 1; i < length; i++, j--) {
                dst[i] = src[j];
            }
        }
        this._reversedBuffer = rev;
        return rev;
    }

    _getReversedBuffer() {
        if (this._reversedBuffer) return this._reversedBuffer;
        return this._buildReversedBuffer();
    }

    /**
     * ===================== SAMPLE CHOP HELPERS =====================
     */
    _shouldUseSampleChop() {
        return Boolean(
            this.sampleChopMode === 'chop' &&
            this.sampleChop &&
            this.sampleChop.loopEnabled &&
            Array.isArray(this.sampleChop.slices) &&
            this.sampleChop.slices.length > 0
        );
    }

    _handleChopNoteOn(startTime = this.context.currentTime) {
        this._chopNoteCount += 1;
        if (this._chopNoteCount === 1) {
            this._startSampleChopPlayback(startTime);
        }
    }

    _handleChopNoteOff() {
        if (this._chopNoteCount > 0) {
            this._chopNoteCount -= 1;
        }
        if (this._chopNoteCount === 0) {
            this._stopSampleChopPlayback();
        }
    }

    _resolveDurationSeconds(duration) {
        if (duration === undefined || duration === null) {
            return null;
        }
        if (typeof duration === 'number' && Number.isFinite(duration)) {
            return duration;
        }
        try {
            const currentBpm = usePlaybackStore.getState().bpm;
            const seconds = NativeTimeUtils.parseTime(duration, currentBpm);
            return Number.isFinite(seconds) ? seconds : null;
        } catch (error) {
            console.warn('[SampleChop][Native] Failed to parse duration', duration, error);
            return null;
        }
    }

    _scheduleChopRelease(durationSeconds) {
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
            return;
        }
        const timer = setTimeout(() => {
            this._chopReleaseTimers.delete(timer);
            this._handleChopNoteOff();
        }, durationSeconds * 1000);
        this._chopReleaseTimers.add(timer);
    }

    _startSampleChopPlayback(startTime = this.context.currentTime) {
        if (this.sampleChopMode !== 'chop') {
            return;
        }
        if (!this.sampleChop || !this.sampleChop.loopEnabled) {
            return;
        }

        const hasSlices = Array.isArray(this.sampleChop.slices) && this.sampleChop.slices.length > 0;
        if (!hasSlices) {
            return;
        }

        this._stopSampleChopPlayback();

        const tempo = this._getSampleChopTempo();
        const secondsPerStep = (60 / Math.max(tempo, 1)) / 4; // 16th grid

        this._chopStartTime = startTime || this.context.currentTime;
        this._chopSecondsPerStep = secondsPerStep || 0.125;
        this._lastChopStep = -1;
        this._activeChopSliceId = null;

        this._chopTimer = setInterval(() => {
            try {
                this._applySampleChopFrame();
            } catch (error) {
                console.error('SampleChop playback error (native sampler):', error);
            }
        }, 40);

        this._applySampleChopFrame();
    }

    _stopSampleChopPlayback() {
        if (this._chopTimer) {
            clearInterval(this._chopTimer);
            this._chopTimer = null;
        }
        for (const timer of this._chopReleaseTimers) {
            clearTimeout(timer);
        }
        this._chopReleaseTimers.clear();
        this._chopStartTime = 0;
        this._chopSecondsPerStep = 0;
        this._activeChopSliceId = null;
        this._lastChopStep = -1;
        this._chopNoteCount = 0;
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
            return;
        }

        const currentTime = this.context.currentTime;
        const elapsed = currentTime - this._chopStartTime;
        const loopPosition = ((elapsed % loopDuration) + loopDuration) % loopDuration;
        const stepFloat = loopPosition / this._chopSecondsPerStep;

        const activeSlice = this._findActiveChopSlice(stepFloat);

        if (activeSlice?.id !== this._activeChopSliceId) {
            this._activeChopSliceId = activeSlice ? activeSlice.id : null;
            this._triggerSampleChopSlice(activeSlice);
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
            this.activeSources.delete(this._currentChopSource);
            this._currentChopSource = null;
        }

        if (this._currentChopGain) {
            try {
                this._currentChopGain.disconnect();
            } catch (e) {}
            this._currentChopGain = null;
        }
    }

    _triggerSampleChopSlice(slice) {
        if (!slice) {
            this._stopActiveChopSource();
            return;
        }

        if (!this.buffer) {
            console.warn('SampleChop (native sampler): No buffer available');
            this._stopActiveChopSource();
            return;
        }

        this._stopActiveChopSource();

        const buffer = this.buffer;
        const instrumentGain = this.params.gain || 1;
        const sliceGain = clampValue(slice.gain ?? 1, 0, 2);
        let velocityValue = this._chopVelocity ?? 1;
        if (velocityValue > 1) {
            velocityValue = velocityValue / 127;
        }
        velocityValue = clampValue(velocityValue, 0, 1);
        const totalGain = instrumentGain * sliceGain * velocityValue;

        const startRatio = clampValue(slice.startOffset ?? 0, 0, 0.99);
        const endRatio = clampValue(slice.endOffset ?? 1, startRatio + 0.01, 1);
        const bufferDuration = buffer.duration;
        const sliceStart = startRatio * bufferDuration;
        const sliceEnd = Math.min(bufferDuration, endRatio * bufferDuration);
        const sliceDuration = Math.max(sliceEnd - sliceStart, 0.01);

        const isReverse = Boolean(slice.reverse);
        const shouldLoop = Boolean(slice.loop);
        const playbackRate = Math.pow(2, (slice.pitch ?? 0) / 12);

        const playSliceInstance = () => {
            const source = this.context.createBufferSource();
            source.buffer = buffer;

            const gainNode = this.context.createGain();
            gainNode.gain.setValueAtTime(totalGain, this.context.currentTime);

            let lastNode = gainNode;

            if ((this.params.pan || 0) !== 0) {
                const panner = this.context.createStereoPanner();
                panner.pan.setValueAtTime(this.params.pan || 0, this.context.currentTime);
                gainNode.connect(panner);
                lastNode = panner;
            }

            if (this.params.filterType && this.params.filterCutoff) {
                const filter = this.context.createBiquadFilter();
                filter.type = this.params.filterType || 'lowpass';
                filter.frequency.setValueAtTime(this.params.filterCutoff || 20000, this.context.currentTime);
                filter.Q.setValueAtTime(this.params.filterResonance || 0, this.context.currentTime);
                lastNode.connect(filter);
                lastNode = filter;
            }

            source.connect(gainNode);
            lastNode.connect(this.internalOutput);

            if (isReverse) {
                source.loop = false;
                source.playbackRate.setValueAtTime(-Math.abs(playbackRate), this.context.currentTime);
                const offset = Math.max(0, sliceEnd - 0.0001);
                source.start(this.context.currentTime, offset, sliceDuration);
            } else {
                source.playbackRate.setValueAtTime(playbackRate, this.context.currentTime);
                if (shouldLoop) {
                    source.loop = true;
                    source.loopStart = sliceStart;
                    source.loopEnd = sliceEnd;
                    source.start(this.context.currentTime, sliceStart);
                } else {
                    source.loop = false;
                    source.start(this.context.currentTime, sliceStart, sliceDuration);
                }
            }

            this._currentChopSource = source;
            this._currentChopGain = gainNode;
            this.activeSources.add(source);

            source.onended = () => {
                if (this._currentChopSource === source) {
                    this._currentChopSource = null;
                    this._currentChopGain = null;
                }
                if (this.activeSources.has(source)) {
                    this.activeSources.delete(source);
                }
                try {
                    gainNode.disconnect();
                } catch (e) {}
                try {
                    source.disconnect();
                } catch (e) {}

                if (
                    isReverse &&
                    shouldLoop &&
                    this._activeChopSliceId === slice.id &&
                    this.sampleChopMode === 'chop' &&
                    this.sampleChop?.loopEnabled
                ) {
                    playSliceInstance();
                }
            };
        };

        playSliceInstance();
    }

    // ✅ NEW: Set or update effect chain
    setEffectChain(effectChainData) {
        console.log(`🎛️ NativeSamplerNode.setEffectChain:`, this.name, effectChainData);

        // Disconnect old effect chain
        if (this.effectChain.length > 0) {
            this.effectChain.forEach(effect => {
                try {
                    effect.disconnect();
                } catch (e) {
                    console.warn('Error disconnecting effect:', e);
                }
            });
            this.effectChain = [];
        }

        // Reset to direct connection
        this.internalOutput.disconnect();

        if (!effectChainData || effectChainData.length === 0) {
            // No effects, connect directly to output
            this.output = this.internalOutput;
            this.effectChainActive = false;
            return;
        }

        // Build effect chain
        let currentNode = this.internalOutput;

        for (const effectData of effectChainData) {
            try {
                const effect = EffectFactory.deserialize(effectData, this.context);
                if (!effect) {
                    console.warn(`Failed to create effect: ${effectData.type}`);
                    continue;
                }

                // Connect current node to effect input
                currentNode.connect(effect.inputNode);
                currentNode = effect.outputNode;

                this.effectChain.push(effect);
                console.log(`🎛️ Added effect: ${effect.name} (${effect.type})`);
            } catch (error) {
                console.error(`Error creating effect ${effectData.type}:`, error);
            }
        }

        // Final output is the last effect's output
        this.output = currentNode;
        this.effectChainActive = true;
        console.log(`✅ Effect chain set for ${this.name}: ${this.effectChain.length} effects`);
    }
}