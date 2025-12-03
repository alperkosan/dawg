/**
 * SampleVoice - Single voice for sample-based instruments
 *
 * Designed for voice pooling with MultiSampleInstrument
 * Uses BufferSource (one-shot playback) with envelope
 *
 * Features:
 * - Pre-allocated gain nodes (reused across triggers)
 * - Fast envelope (attack/release only)
 * - Pitch shifting via playback rate
 * - Voice stealing priority support
 */

import { BaseVoice } from '../base/BaseVoice.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class SampleVoice extends BaseVoice {
    constructor(audioContext) {
        super(audioContext);

        // Audio nodes (persistent - reused across triggers)
        this.gainNode = null;
        this.envelopeGain = null;

        // Current playback state
        this.currentSource = null; // BufferSource (recreated each trigger)
        this.currentBuffer = null;
        this.releaseTime = 0.15; // Default release time

        // Envelope tracking (for voice stealing priority)
        this.currentAmplitude = 0;
        this.envelopePhase = 'idle'; // 'idle' | 'attack' | 'sustain' | 'release'

        // ✅ TIME STRETCH: Time stretcher instance (injected from instrument)
        this.timeStretcher = null;
        this.timeStretchEnabled = false;
        
        // ✅ TIME STRETCH: Cache for stretched buffers
        // Map<cacheKey, { promise, buffer }> - buffer is set when promise resolves
        this.stretchedBufferCache = new Map();

        // ✅ MEMORY LEAK FIX: Track all timers for proper cleanup
        this.activeTimers = new Set(); // Set of timer IDs (setTimeout/setInterval)

        // ✅ MEMORY LEAK FIX: Track dynamic filter/panner nodes for disposal
        this.dynamicFilterNode = null;
        this.dynamicPannerNode = null;
    }

    /**
     * Initialize voice (create persistent audio nodes)
     * Called once during voice pool creation
     */
    initialize() {
        // Create persistent gain nodes
        this.envelopeGain = this.context.createGain();
        this.envelopeGain.gain.setValueAtTime(0, this.context.currentTime);

        this.gainNode = this.context.createGain();
        this.gainNode.gain.setValueAtTime(1, this.context.currentTime);

        // ✅ PHASE 2: Don't connect here - connections will be made dynamically in trigger()
        // to support filter/panner chain based on extendedParams
        this.output = this.gainNode;
    }

    /**
     * Start playing a note
     *
     * @param {number} midiNote - MIDI note number
     * @param {number} velocity - Note velocity (0-127)
     * @param {number} frequency - Target frequency (for pitch calculation)
     * @param {number} time - AudioContext time
     * @param {Object} sampleData - { buffer, baseNote, pitchShift }
     * @param {Object} instrumentData - Instrument parameters (ADSR, etc.)
     */
    trigger(midiNote, velocity, frequency, time, sampleData = null, instrumentData = null, extendedParams = null) {
        if (!sampleData || !sampleData.buffer) {
            console.warn('SampleVoice: No sample data provided');
            return;
        }

        // Stop current source if playing
        this.stopCurrentSource();

        // Calculate playback rate for pitch shifting
        // Formula: playbackRate = 2^(semitones/12)
        const pitchShift = sampleData.pitchShift || 0;
        
        const sliceParams = extendedParams?.sampleSlice || null;
        const slicePitchOffset = sliceParams?.pitch ?? 0;

        // ✅ PHASE 2: Apply initial pitch bend if present
        let initialPitchBend = 0;
        if (extendedParams?.pitchBend && Array.isArray(extendedParams.pitchBend) && extendedParams.pitchBend.length > 0) {
            const firstPoint = extendedParams.pitchBend[0];
            initialPitchBend = (firstPoint.value / 8192) * 2; // ±2 semitones range
        }
        
        const totalPitchShift = pitchShift + initialPitchBend + slicePitchOffset;
        const playbackRate = Math.pow(2, totalPitchShift / 12);

        // ✅ TIME STRETCH: Use time stretcher if enabled and pitch shift is significant
        let bufferToUse = sampleData.buffer;
        let useTimeStretch = this.timeStretchEnabled && 
                              this.timeStretcher && 
                              Math.abs(totalPitchShift) > 0.1; // Only use if pitch shift > 0.1 semitones

        if (useTimeStretch) {
            // Generate cache key
            const bufferId = `${sampleData.buffer.duration.toFixed(6)}_${sampleData.buffer.sampleRate}_${sampleData.buffer.numberOfChannels}`;
            const cacheKey = `${bufferId}_${totalPitchShift.toFixed(2)}`;

            // Check if already cached
            if (this.stretchedBufferCache.has(cacheKey)) {
                const cacheEntry = this.stretchedBufferCache.get(cacheKey);
                
                // If buffer is already resolved, use it
                if (cacheEntry.buffer) {
                    bufferToUse = cacheEntry.buffer;
                    console.log(`✅ TimeStretcher: Using cached buffer (${totalPitchShift.toFixed(2)} semitones)`);
                    // useTimeStretch stays true - we'll use playbackRate = 1.0
                } else {
                    // Promise is still pending - use playbackRate for this playback
                    // Next time this buffer is used, it will be cached and ready
                    console.log(`⏳ TimeStretcher: Buffer still stretching, using playbackRate for now`);
                    useTimeStretch = false; // Fallback for this playback
                }
            } else {
                // Start async stretching (background - don't wait)
                const stretchPromise = this.timeStretcher.getPitchShiftedBuffer(
                    sampleData.buffer, 
                    totalPitchShift
                );
                
                // Cache the promise (buffer will be set when resolved)
                this.stretchedBufferCache.set(cacheKey, {
                    promise: stretchPromise,
                    buffer: null
                });
                
                // For this playback, use playbackRate (fallback)
                // Next time this buffer is used, it will be cached and ready
                console.log(`⏳ TimeStretcher: Stretching buffer (${totalPitchShift.toFixed(2)} semitones), using playbackRate for now`);
                useTimeStretch = false; // Fallback for this playback
                
                // Handle promise resolution in background
                stretchPromise.then(buffer => {
                    // Update cache entry with resolved buffer
                    const cacheEntry = this.stretchedBufferCache.get(cacheKey);
                    if (cacheEntry) {
                        cacheEntry.buffer = buffer;
                    }
                    console.log(`✅ TimeStretcher: Buffer cached (${totalPitchShift.toFixed(2)} semitones)`);
                }).catch(error => {
                    console.warn('⚠️ TimeStretcher error:', error);
                    this.stretchedBufferCache.delete(cacheKey);
                });
            }
        }

        // Create new buffer source (one-shot)
        this.currentSource = this.context.createBufferSource();
        this.currentSource.buffer = bufferToUse;
        this.currentBuffer = bufferToUse;

        // 🔧 TEMP DEBUG: Log extreme pitch shifts that might cause aliasing
        if (Math.abs(totalPitchShift) > 12) {
            console.warn(`⚠️ Extreme pitch shift: ${totalPitchShift} semitones (${playbackRate.toFixed(2)}x)`);
        }

        // ✅ TIME STRETCH: If using stretched buffer, playbackRate should be 1.0
        // (pitch is already shifted in the buffer)
        const finalPlaybackRate = useTimeStretch ? 1.0 : playbackRate;

        const isReverseSlice = Boolean(sliceParams?.reverse);

        // ✅ FL Studio-style slide - handle slide pitch glide
        if (!isReverseSlice &&
            extendedParams?.slideEnabled === true && 
            extendedParams?.slideTargetPitch !== undefined && 
            extendedParams?.slideTargetPitch !== null &&
            extendedParams?.slideDuration) {
            
            // Ensure targetPitch is a number
            const targetPitch = typeof extendedParams.slideTargetPitch === 'number' 
                ? extendedParams.slideTargetPitch 
                : parseInt(extendedParams.slideTargetPitch);
            
            if (!isNaN(targetPitch) && targetPitch >= 0 && targetPitch <= 127) {
                const sourcePitch = midiNote;
                const slideDuration = extendedParams.slideDuration;
                
                // ✅ TIME STRETCH: For slide with time stretch, we need to handle differently
                // For now, slide still uses playbackRate (time stretch doesn't support dynamic pitch changes)
                if (useTimeStretch) {
                    console.warn('⚠️ Slide with time stretch not fully supported, using playbackRate for slide');
                }
                
                // Calculate playback rates relative to sample's base note
                const sourcePlaybackRate = useTimeStretch ? 1.0 : Math.pow(2, (sourcePitch - sampleData.baseNote) / 12);
                const targetPlaybackRate = useTimeStretch ? 1.0 : Math.pow(2, (targetPitch - sampleData.baseNote) / 12);
                
                // ✅ FL Studio-style: Note starts at its own pitch, then glides to target pitch
                // Slide starts immediately when note starts, glides over slideDuration
                this.currentSource.playbackRate.setValueAtTime(sourcePlaybackRate, time);
                this.currentSource.playbackRate.exponentialRampToValueAtTime(
                    targetPlaybackRate,
                    time + slideDuration
                );
                
                console.log('🎚️ SampleVoice slide applied:', {
                    sourcePitch,
                    targetPitch,
                    slideDuration: slideDuration.toFixed(3) + 's',
                    sourceRate: sourcePlaybackRate.toFixed(3),
                    targetRate: targetPlaybackRate.toFixed(3),
                    timeStretch: useTimeStretch
                });
            } else {
                console.warn('⚠️ Invalid slideTargetPitch:', extendedParams.slideTargetPitch);
                // Fallback to normal playback
                this.currentSource.playbackRate.setValueAtTime(finalPlaybackRate, time);
            }
        } else {
            // Normal playback - no slide
            const rateSign = isReverseSlice ? -1 : 1;
            this.currentSource.playbackRate.setValueAtTime(rateSign * finalPlaybackRate, time);
        }
        
        // ✅ PHASE 2: Schedule pitch bend automation if present (non-slide pitch bend)
        if (!isReverseSlice && extendedParams?.pitchBend && Array.isArray(extendedParams.pitchBend) && extendedParams.pitchBend.length > 1) {
            const noteDurationSec = sampleData.buffer.duration || 1;
            extendedParams.pitchBend.forEach((point, index) => {
                if (index === 0) return; // Skip first point (already applied)
                
                let pointTime;
                if (point.time <= 1 && point.time >= 0) {
                    // Normalized time (0-1)
                    pointTime = time + (point.time * noteDurationSec);
                } else {
                    // Absolute time in steps - estimate conversion
                    const stepsPerBeat = 4;
                    const bpm = 120;
                    const secondsPerStep = (60 / bpm) / stepsPerBeat;
                    pointTime = time + (point.time * secondsPerStep);
                }
                
                const pitchBendSemitones = (point.value / 8192) * 2;
                const newPlaybackRate = Math.pow(2, (pitchShift + pitchBendSemitones) / 12);
                
                if (Number.isFinite(newPlaybackRate) && newPlaybackRate > 0 && pointTime > time) {
                    this.currentSource.playbackRate.setValueAtTime(newPlaybackRate, pointTime);
                }
            });
        } else if (isReverseSlice && extendedParams?.pitchBend) {
            console.warn('SampleVoice: Pitch bend automation disabled for reverse slices');
        }

        // Connect source to envelope
        this.currentSource.connect(this.envelopeGain);

        // ✅ PHASE 2: Create filter if mod wheel, aftertouch, or key tracking present
        let lastNode = this.envelopeGain;
        let filterNode = null;
        const needsFilter = extendedParams?.modWheel !== undefined || 
                           extendedParams?.aftertouch !== undefined ||
                           (instrumentData?.filterKeyTracking !== undefined && instrumentData.filterKeyTracking > 0);
        
        if (needsFilter) {
            // ✅ MEMORY LEAK FIX: Clear previous filter node
            if (this.dynamicFilterNode) {
                try {
                    this.dynamicFilterNode.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            }
            filterNode = this.context.createBiquadFilter();
            this.dynamicFilterNode = filterNode; // Track for disposal
            filterNode.type = 'lowpass';
            
            // ✅ KEY TRACKING: Get base filter cutoff from instrument data or default
            let filterCutoff = instrumentData?.filterCutoff || 20000; // Default high cutoff
            
            // ✅ KEY TRACKING: Apply key tracking if enabled
            if (instrumentData?.filterKeyTracking !== undefined && instrumentData.filterKeyTracking > 0) {
                const keyTrackingAmount = instrumentData.filterKeyTracking; // 0-1
                const noteFrequency = this.midiToFrequency(midiNote);
                const baseFrequency = this.midiToFrequency(60); // C4 as base
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
            filterNode.frequency.setValueAtTime(filterCutoff, time);
            
            // Apply aftertouch to filter Q if present
            let filterQ = instrumentData?.filterResonance || 1;
            if (extendedParams?.aftertouch !== undefined) {
                const aftertouchNormalized = extendedParams.aftertouch / 127; // 0-1
                filterQ = filterQ + aftertouchNormalized * 10; // Add up to 10 Q
                filterQ = Math.max(0, Math.min(30, filterQ)); // Clamp Q
            }
            filterNode.Q.setValueAtTime(filterQ, time);
            
            this.envelopeGain.connect(filterNode);
            lastNode = filterNode;
        }

        // ✅ PHASE 2: Create panner if pan present
        let pannerNode = null;
        if (extendedParams?.pan !== undefined && extendedParams.pan !== 0) {
            // ✅ MEMORY LEAK FIX: Clear previous panner node
            if (this.dynamicPannerNode) {
                try {
                    this.dynamicPannerNode.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            }
            pannerNode = this.context.createStereoPanner();
            this.dynamicPannerNode = pannerNode; // Track for disposal
            pannerNode.pan.setValueAtTime(extendedParams.pan, time);
            lastNode.connect(pannerNode);
            lastNode = pannerNode;
        }

        // Connect lastNode to gainNode
        lastNode.connect(this.gainNode);

        // Set velocity gain
        const velocityGain = (velocity / 127) * 0.8;

        // 🔧 FIX: Add headroom for samples with pre-existing clipping
        // Sample analysis showed some samples have clipped peaks
        const sampleHeadroom = 0.85;  // -1.4dB safety headroom
        const sliceGainMultiplier = sliceParams ? clamp(sliceParams.gain ?? 1, 0, 2) : 1;
        const finalGain = velocityGain * sampleHeadroom * sliceGainMultiplier;

        this.gainNode.gain.setValueAtTime(finalGain, time);
        
        // Update output reference if panner/filter was added
        if (pannerNode) {
            this.output = pannerNode;
        } else if (filterNode) {
            this.output = filterNode;
        } else {
            this.output = this.gainNode;
        }

        // ✅ ADSR Envelope from instrument data
        let attack = instrumentData?.attack !== undefined ? instrumentData.attack / 1000 : 0.005; // Default 5ms
        const decay = instrumentData?.decay !== undefined ? instrumentData.decay / 1000 : 0;
        const sustain = instrumentData?.sustain !== undefined ? instrumentData.sustain / 100 : 1; // 0-100% to 0-1
        const useADSR = instrumentData && (instrumentData.attack !== undefined || instrumentData.decay !== undefined || instrumentData.sustain !== undefined);

        // ✅ FIX: Minimum attack time to prevent clicks (especially for drums/808)
        // Even if attack is 0, use at least 1ms to prevent buffer start clicks
        const minAttackTime = 0.001; // 1ms minimum
        attack = Math.max(attack, minAttackTime);

        // Store release time for later use
        if (instrumentData?.release !== undefined) {
            this.releaseTime = instrumentData.release / 1000;
        }

        this.envelopeGain.gain.cancelScheduledValues(time);
        // ✅ FIX: Start from very small value instead of 0 to prevent click
        this.envelopeGain.gain.setValueAtTime(0.0001, time);

        if (useADSR) {
            // Full ADSR envelope
            // Attack: 0.0001 -> 1 (with minimum attack time to prevent clicks)
            this.envelopeGain.gain.linearRampToValueAtTime(1, time + attack);

            // Decay: 1 -> sustain level
            if (decay > 0) {
                this.envelopeGain.gain.linearRampToValueAtTime(sustain, time + attack + decay);
                this.envelopePhase = 'decay';
            } else {
                this.envelopePhase = 'sustain';
            }
        } else {
            // Simple attack envelope (legacy behavior)
            // ✅ FIX: Use minimum attack time even for legacy mode
            this.envelopeGain.gain.linearRampToValueAtTime(1, time + attack);
            this.envelopePhase = 'attack';
        }

        // ✅ SAMPLE START MODULATION: Calculate sample start offset
        // Support both static offset and LFO/envelope modulation
        let sampleStartOffset = 0; // In seconds
        
        // Static sample start offset from instrument data
        if (instrumentData?.sampleStart !== undefined) {
            const sampleStartNormalized = instrumentData.sampleStart; // 0-1 (normalized)
            sampleStartOffset = sampleStartNormalized * (sampleData.buffer.duration || 1);
            
            // 🔧 DEBUG: Log sample start offset
            if (import.meta.env.DEV && sampleStartOffset > 0.001) {
                console.log(`🎚️ SampleVoice: sampleStart=${sampleStartNormalized.toFixed(3)} (${(sampleStartNormalized * 100).toFixed(1)}%), offset=${sampleStartOffset.toFixed(3)}s, bufferDuration=${(sampleData.buffer.duration || 0).toFixed(3)}s`);
            }
        }
        
        // ✅ SAMPLE START MODULATION: Apply LFO/envelope modulation if enabled
        // For now, we'll use a simple approach: velocity-based or random modulation
        // LFO modulation will be added in a future update
        if (instrumentData?.sampleStartModulation?.enabled) {
            const modulationDepth = instrumentData.sampleStartModulation.depth || 0; // 0-1
            const modulationSource = instrumentData.sampleStartModulation.source || 'envelope'; // 'envelope' | 'lfo'
            
            if (modulationSource === 'envelope') {
                // ✅ FIX: Use velocity to simulate envelope-based modulation
                // Higher velocity = higher envelope = more modulation
                // This creates variation in sample start position per note
                const velocityNormalized = velocity / 127; // 0-1
                const modulationAmount = velocityNormalized * modulationDepth * (sampleData.buffer.duration || 1) * 0.2; // Max 20% of sample
                sampleStartOffset += modulationAmount;
                
                // 🔧 DEBUG: Log modulation
                if (import.meta.env.DEV && modulationAmount > 0.001) {
                    console.log(`🎚️ SampleVoice modulation: velocity=${velocity}, depth=${modulationDepth.toFixed(2)}, amount=${modulationAmount.toFixed(3)}s`);
                }
            }
            // TODO: LFO modulation will be added later
        }
        
        // Clamp offset to valid range
        const bufferDuration = sampleData.buffer.duration || 1;
        const maxOffset = bufferDuration - 0.001; // Leave at least 1ms
        sampleStartOffset = Math.max(0, Math.min(maxOffset, sampleStartOffset));

        let playbackOffset = sampleStartOffset;
        let playbackDuration = Math.max(0.01, bufferDuration - playbackOffset);
        let playbackLoop = false;
        let playbackLoopStart = playbackOffset;
        let playbackLoopEnd = Math.min(bufferDuration, playbackOffset + playbackDuration);
        let playbackReverse = isReverseSlice;

        if (sliceParams) {
            const sliceStartRatio = clamp(sliceParams.startOffset ?? 0, 0, 0.99);
            const sliceEndRatio = clamp(sliceParams.endOffset ?? 1, sliceStartRatio + 0.01, 1);
            playbackOffset = sliceStartRatio * bufferDuration;
            playbackDuration = Math.max(0.01, (sliceEndRatio - sliceStartRatio) * bufferDuration);
            playbackLoop = Boolean(sliceParams.loop);
            playbackLoopStart = playbackOffset;
            playbackLoopEnd = Math.min(bufferDuration, playbackOffset + playbackDuration);
            playbackReverse = Boolean(sliceParams.reverse);
        }

        if (playbackLoop) {
            this.currentSource.loop = true;
            this.currentSource.loopStart = playbackLoopStart;
            this.currentSource.loopEnd = playbackLoopEnd;
        } else {
            this.currentSource.loop = false;
        }

        if (playbackReverse) {
            if (playbackLoop) {
                console.warn('SampleVoice: Reverse looping not supported yet, forcing one-shot');
            }
            const sliceEnd = Math.min(bufferDuration, playbackLoopEnd);
            this.currentSource.loop = false;
            this.currentSource.start(time, sliceEnd, playbackDuration);
        } else if (playbackLoop) {
            this.currentSource.start(time, playbackOffset);
        } else if (playbackOffset > 0.001) {
            this.currentSource.start(time, playbackOffset, playbackDuration);
        } else {
            this.currentSource.start(time);
        }

        // Update state
        this.isActive = true;
        this.currentNote = midiNote;
        this.currentVelocity = velocity;
        this.startTime = time;
        this.currentAmplitude = velocityGain;

        // Track envelope phase changes
        const envelopeEndTime = useADSR ? attack + decay : attack;
        // ✅ MEMORY LEAK FIX: Track setTimeout
        const timeoutId = setTimeout(() => {
            if (this.envelopePhase === 'attack' || this.envelopePhase === 'decay') {
                this.envelopePhase = 'sustain';
            }
            this.activeTimers.delete(timeoutId);
        }, envelopeEndTime * 1000);
        this.activeTimers.add(timeoutId);

        // Auto-cleanup when sample finishes naturally
        this.currentSource.onended = () => {
            if (this.currentSource) {
                this.currentAmplitude = 0;
                this.envelopePhase = 'idle';
                // Don't reset isActive here - let release() or reset() handle it
            }
        };
    }

    /**
     * Release note (start release envelope)
     *
     * @param {number} time - AudioContext time
     * @param {number|null} releaseVelocity - Note-off velocity (0-127, null = default)
     * @param {number|null} fadeTime - Optional fade-out time in seconds (for loop restart, overrides release velocity calculation)
     * @returns {number} Release duration in seconds
     */
    release(time, releaseVelocity = null, fadeTime = null) {
        if (!this.currentSource || !this.isActive) {
            return 0;
        }

        // ✅ NEW: Use fadeTime if provided (for loop restart), otherwise calculate from release velocity
        let effectiveReleaseTime;
        
        if (fadeTime !== null && fadeTime > 0) {
            // ✅ LOOP RESTART: Use provided fadeTime for smooth transition
            effectiveReleaseTime = fadeTime;
        } else {
            // ✅ RELEASE VELOCITY: Calculate effective release time based on release velocity
            // Higher release velocity = faster release (shorter time)
            // Lower release velocity = slower release (longer time)
            // Formula: effectiveReleaseTime = baseReleaseTime * (1 - releaseVelocity / 127 * 0.5)
            // - releaseVelocity = 127 → effectiveReleaseTime = baseReleaseTime * 0.5 (50% faster)
            // - releaseVelocity = 0 → effectiveReleaseTime = baseReleaseTime * 1.0 (normal)
            // - releaseVelocity = 64 → effectiveReleaseTime = baseReleaseTime * 0.75 (25% faster)
            effectiveReleaseTime = this.releaseTime;
            
            if (releaseVelocity !== null && releaseVelocity !== undefined) {
                const velocityNormalized = Math.max(0, Math.min(127, releaseVelocity)) / 127; // 0-1
                // Map velocity to release time: 0.5x (fast) to 1.0x (normal)
                const releaseTimeMultiplier = 1.0 - (velocityNormalized * 0.5);
                effectiveReleaseTime = this.releaseTime * releaseTimeMultiplier;
                
                if (import.meta.env.DEV) {
                    console.log(`🎚️ SampleVoice release: velocity=${releaseVelocity}, baseTime=${this.releaseTime.toFixed(3)}s, effectiveTime=${effectiveReleaseTime.toFixed(3)}s`);
                }
            }
        }

        // Apply release envelope with effective release time
        this.envelopeGain.gain.cancelScheduledValues(time);
        this.envelopeGain.gain.setValueAtTime(this.envelopeGain.gain.value, time);
        this.envelopeGain.gain.linearRampToValueAtTime(0, time + effectiveReleaseTime);

        // Stop source after release
        try {
            this.currentSource.stop(time + effectiveReleaseTime);
        } catch (e) {
            // Already stopped or scheduled
        }

        // Update state
        this.envelopePhase = 'release';

        // Track amplitude decay
        const startAmp = this.currentAmplitude;
        const decayRate = startAmp / effectiveReleaseTime;
        const updateInterval = 50; // Update every 50ms

        // ✅ MEMORY LEAK FIX: Track setInterval and store ID
        const decayInterval = setInterval(() => {
            this.currentAmplitude = Math.max(0, this.currentAmplitude - (decayRate * updateInterval / 1000));

            if (this.currentAmplitude <= 0) {
                clearInterval(decayInterval);
                this.activeTimers.delete(decayInterval);
                this.envelopePhase = 'idle';
            }
        }, updateInterval);
        this.activeTimers.add(decayInterval);
        this.decayIntervalId = decayInterval; // Store for reset()

        return effectiveReleaseTime;
    }

    /**
     * Reset voice to initial state
     * Called when voice is returned to pool
     */
    reset() {
        super.reset();

        // ✅ MEMORY LEAK FIX: Clear all active timers
        this.activeTimers.forEach(timerId => {
            clearTimeout(timerId);
            clearInterval(timerId);
        });
        this.activeTimers.clear();
        this.decayIntervalId = null;

        // ✅ MEMORY LEAK FIX: Dispose dynamic filter/panner nodes
        if (this.dynamicFilterNode) {
            try {
                this.dynamicFilterNode.disconnect();
            } catch (e) {
                // Already disconnected
            }
            this.dynamicFilterNode = null;
        }
        if (this.dynamicPannerNode) {
            try {
                this.dynamicPannerNode.disconnect();
            } catch (e) {
                // Already disconnected
            }
            this.dynamicPannerNode = null;
        }

        // Stop current source
        this.stopCurrentSource();

        // Reset envelope
        const now = this.context.currentTime;
        this.envelopeGain.gain.cancelScheduledValues(now);
        this.envelopeGain.gain.setValueAtTime(0, now);

        // Reset state
        this.currentBuffer = null;
        this.currentAmplitude = 0;
        this.envelopePhase = 'idle';
    }

    /**
     * Stop voice immediately (with quick fade-out to prevent clicks)
     * Called when cutting/retriggering (cutItself behavior)
     * 
     * @param {number} time - AudioContext time (optional, defaults to now)
     */
    stop(time = null) {
        if (!this.isActive || !this.currentSource) {
            return;
        }

        const now = time || this.context.currentTime;
        const fadeTime = 0.002; // 2ms quick fade to prevent click
        
        try {
            // Quick fade-out on envelope gain before stopping source
            if (this.envelopeGain && this.envelopeGain.gain) {
                const currentGain = this.envelopeGain.gain.value;
                if (currentGain > 0.0001) {
                    this.envelopeGain.gain.cancelScheduledValues(now);
                    this.envelopeGain.gain.setValueAtTime(currentGain, now);
                    this.envelopeGain.gain.linearRampToValueAtTime(0.0001, now + fadeTime);
                }
            }
            
            // Stop source after fade
            this.currentSource.stop(now + fadeTime);
            this.currentSource.disconnect();
        } catch (e) {
            // Already stopped or scheduled
        }
        
        this.currentSource = null;
        this.isActive = false;
        this.envelopePhase = 'idle';
        this.currentAmplitude = 0;
    }

    /**
     * Stop current buffer source (internal helper)
     * ✅ FIX: Quick fade-out to prevent clicks when cutting/retriggering
     */
    stopCurrentSource() {
        if (this.currentSource) {
            try {
                const now = this.context.currentTime;
                const fadeTime = 0.002; // 2ms quick fade to prevent click
                
                // Quick fade-out on envelope gain before stopping source
                if (this.envelopeGain && this.envelopeGain.gain) {
                    const currentGain = this.envelopeGain.gain.value;
                    if (currentGain > 0.0001) {
                        this.envelopeGain.gain.cancelScheduledValues(now);
                        this.envelopeGain.gain.setValueAtTime(currentGain, now);
                        this.envelopeGain.gain.linearRampToValueAtTime(0.0001, now + fadeTime);
                    }
                }
                
                // Stop source after fade
                this.currentSource.stop(now + fadeTime);
                this.currentSource.disconnect();
            } catch (e) {
                // Already stopped or scheduled
            }
            this.currentSource = null;
        }
    }

    /**
     * Get current amplitude (for voice stealing priority)
     *
     * @returns {number} Current amplitude (0-1)
     */
    getAmplitude() {
        // Factor in envelope phase
        if (this.envelopePhase === 'idle') return 0;
        if (this.envelopePhase === 'attack') return this.currentAmplitude * 1.5; // Higher priority
        if (this.envelopePhase === 'sustain') return this.currentAmplitude;
        if (this.envelopePhase === 'release') return this.currentAmplitude * 0.5; // Lower priority

        return this.currentAmplitude;
    }

    /**
     * Dispose voice (cleanup)
     * Called only when destroying voice pool
     */
    dispose() {
        // ✅ MEMORY LEAK FIX: Clear all active timers
        this.activeTimers.forEach(timerId => {
            clearTimeout(timerId);
            clearInterval(timerId);
        });
        this.activeTimers.clear();

        // ✅ MEMORY LEAK FIX: Dispose dynamic filter/panner nodes
        if (this.dynamicFilterNode) {
            try {
                this.dynamicFilterNode.disconnect();
            } catch (e) {
                // Already disconnected
            }
            this.dynamicFilterNode = null;
        }
        if (this.dynamicPannerNode) {
            try {
                this.dynamicPannerNode.disconnect();
            } catch (e) {
                // Already disconnected
            }
            this.dynamicPannerNode = null;
        }

        this.stopCurrentSource();

        if (this.envelopeGain) {
            this.envelopeGain.disconnect();
            this.envelopeGain = null;
        }

        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }

        super.dispose();
    }

    /**
     * Update voice priority for stealing algorithm
     *
     * @returns {number} Priority score (higher = less likely to steal)
     */
    updatePriority() {
        let priority = super.updatePriority();

        // Bonus priority based on envelope phase
        if (this.envelopePhase === 'attack') {
            priority += 50; // Don't steal during attack
        } else if (this.envelopePhase === 'sustain') {
            priority += 30; // Prefer not to steal sustain
        } else if (this.envelopePhase === 'release') {
            priority -= 30; // OK to steal during release
        }

        this.priority = priority;
        return priority;
    }
}
