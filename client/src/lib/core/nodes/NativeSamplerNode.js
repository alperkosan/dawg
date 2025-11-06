// src/lib/core/nodes/NativeSamplerNode.js - TONE.JS BAĞIMLILIĞI KALDIRILDI VE DÜZELTME

import { NativeTimeUtils } from '../../utils/NativeTimeUtils';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { EffectFactory } from '../../audio/effects';

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

        // ✅ RAW SIGNAL: No automatic gain reduction
        // Let samples play at their natural level - user controls with faders
        this.polyphonyGainReduction = false; // Disabled - RAW signal philosophy
        this.internalOutput.gain.value = 1.0; // Fixed unity gain

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

        // ✅ DEBUG: Log kick triggers
        if (this.id === 'inst-1') {
            console.log('🥁 Kick triggerNote!', { pitch, velocity, hasBuffer: !!this.buffer });
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
        let normalizedVelocity = velocity || 100;
        if (normalizedVelocity > 1) {
            // Direct MIDI to linear: 0-127 → 0-1.0
            normalizedVelocity = normalizedVelocity / 127;
        }
        const velocityGainLinear = normalizedVelocity * 1.0;

        // 🔧 FIX: Add headroom for samples with pre-existing clipping
        // Sample analysis showed some samples have clipped peaks (>100%)
        // Apply gentle reduction to prevent output clipping
        const sampleHeadroom = 0.85;  // -1.4dB safety headroom
        const finalGain = velocityGainLinear * sampleHeadroom * (this.params.gain || 1.0);
        gainNode.gain.setValueAtTime(finalGain, startTime);
        if (!Number.isFinite(finalGain) || finalGain <= 0) {
            console.warn(`⚠️ ${this.name} finalGain invalid:`, { normalizedVelocity, velocityGainLinear, finalGain });
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
        // Samples are usually trigger-based, no release needed
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
    }

    // ✅ UTILITY: Convert dB to linear
    dbToLinear(db) {
        return Math.pow(10, db / 20);
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