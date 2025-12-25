/**
 * VoicePool - Pre-allocated voice pool with smart voice stealing
 *
 * Generic voice lifecycle management - works with any BaseVoice subclass
 * Zero GC during playback (all voices pre-allocated)
 *
 * Features:
 * - Pre-allocated voice pool
 * - Smart voice stealing (priority-based)
 * - AudioParam-based cleanup (no setTimeout!)
 * - Release queue management
 */
export class VoicePool {
    constructor(audioContext, VoiceClass, maxVoices = 16) {
        this.context = audioContext;
        this.maxVoices = maxVoices;
        this.VoiceClass = VoiceClass;

        // Pre-allocate all voices at initialization
        this.voices = [];
        for (let i = 0; i < maxVoices; i++) {
            const voice = new VoiceClass(audioContext);
            voice.initialize();
            this.voices.push(voice);
        }

        // Voice tracking
        // ✅ MEMORY LEAK FIX: Support multiple voices per MIDI note (true polyphony)
        this.activeVoices = new Map(); // midiNote → Set<voice> (was: midiNote → voice)
        this.freeVoices = [...this.voices]; // Available voices
        this.releaseQueue = []; // Voices in release phase { voice, endTime }
        
        // ✅ MEMORY LEAK FIX: Track fallback timeouts for ConstantSourceNode
        this.voiceReturnTimeouts = new Map(); // voice → timeoutId

        if (import.meta.env.DEV) {
            console.log(`🎵 VoicePool created: ${VoiceClass.name}, ${maxVoices} voices`);
        }
    }

    /**
     * Allocate a voice for a note
     *
     * @param {number} midiNote - MIDI note number
     * @param {boolean} allowPolyphony - If true, allows multiple voices for same note (default: true)
     * @returns {BaseVoice|null} Allocated voice or null if failed
     */
    allocate(midiNote, allowPolyphony = true) {
        // ✅ CRITICAL FIX: cutItself behavior - stop existing note before allocating new one
        // If polyphony is disabled (cutItself=true), we need to stop the existing note first
        if (!allowPolyphony && this.activeVoices.has(midiNote)) {
            // ✅ FIX: Stop existing voices before re-triggering (cutItself behavior)
            // This ensures oval notes (or any long notes) are properly cut when retriggered
            const voicesSet = this.activeVoices.get(midiNote);
            if (voicesSet && voicesSet.size > 0) {
                // Stop all voices for this note (cutItself)
                const existingVoice = Array.from(voicesSet)[0]; // Get first voice
                const now = this.context.currentTime;
                // ✅ FIX: Quick fade-out to prevent clicks when cutting (especially for drums/808)
                try {
                    if (typeof existingVoice.stop === 'function') {
                        // Use stop() method if available (SampleVoice has stopCurrentSource with fade)
                        existingVoice.stop(now);
                    } else if (typeof existingVoice.noteOff === 'function') {
                        // Quick fade to prevent click
                        existingVoice.noteOff(now);
                    } else if (typeof existingVoice.stopCurrentSource === 'function') {
                        // Direct call to stopCurrentSource (has fade-out)
                        existingVoice.stopCurrentSource();
                    }
                } catch (e) {
                    console.warn('⚠️ Failed to stop existing voice for cutItself:', e);
                }
                // ✅ MEMORY LEAK FIX: Remove from active voices Set
                const voicesSet = this.activeVoices.get(midiNote);
                if (voicesSet) {
                    voicesSet.delete(existingVoice);
                    if (voicesSet.size === 0) {
                        this.activeVoices.delete(midiNote);
                    }
                }
                // Return voice to free pool or reuse it
                if (!this.freeVoices.includes(existingVoice)) {
                    this.freeVoices.push(existingVoice);
                }
            }
        }

        // ✅ POLYPHONY FIX: In poly mode, always allocate a new voice even if same note is playing
        // Try to get a free voice
        let voice = this.freeVoices.pop();

        // No free voices - try to steal one
        if (!voice) {
            voice = this.stealVoice();
        }

        if (!voice) {
            console.warn('🎵 ⚠️ VoicePool: No voices available (pool exhausted)');
            return null;
        }

        // Reset and activate voice
        voice.reset();

        // ✅ MEMORY LEAK FIX: Track multiple voices per MIDI note (true polyphony)
        if (!this.activeVoices.has(midiNote)) {
            this.activeVoices.set(midiNote, new Set());
        }
        this.activeVoices.get(midiNote).add(voice);

        return voice;
    }

    /**
     * Release a voice (start release envelope)
     *
     * @param {number} midiNote - MIDI note number
     * @param {number} time - AudioContext time to release
     * @param {number|null} releaseVelocity - Note-off velocity (0-127, null = default)
     * @param {number|null} fadeTime - Optional fade-out time in seconds (for loop restart, overrides release envelope)
     */
    release(midiNote, time, releaseVelocity = null, fadeTime = null) {
        // ✅ MEMORY LEAK FIX: Get first voice from Set (or all voices if needed)
        const voicesSet = this.activeVoices.get(midiNote);
        if (!voicesSet || voicesSet.size === 0) return;
        
        // Release first voice (most common case: single voice per note)
        // TODO: Support releasing all voices for same note if needed
        const voice = Array.from(voicesSet)[0];

        // ✅ RELEASE VELOCITY: Start release phase with release velocity
        // ✅ NEW: Use fadeTime if provided (for loop restart), otherwise use release velocity
        const releaseDuration = fadeTime !== null 
            ? voice.release(time, null, fadeTime) // Use fadeTime if provided
            : voice.release(time, releaseVelocity); // Otherwise use release velocity

        // ✅ MEMORY LEAK FIX: Remove voice from Set
        voicesSet.delete(voice);
        if (voicesSet.size === 0) {
            this.activeVoices.delete(midiNote);
        }

        // Add to release queue
        this.releaseQueue.push({
            voice,
            endTime: time + releaseDuration
        });

        // Schedule return to free pool using AudioParam (NO setTimeout!)
        this.scheduleVoiceReturn(voice, time, releaseDuration);
    }

    /**
     * Smart voice stealing algorithm
     *
     * Priority order:
     * 1. Voices in release phase (already fading out)
     * 2. Lowest priority active voice (calculated by voice.updatePriority())
     * 3. Oldest voice (fallback)
     *
     * @returns {BaseVoice|null} Stolen voice or null
     */
    stealVoice() {
        // 1. Prefer voices in release phase (already fading)
        if (this.releaseQueue.length > 0) {
            // Find the quietest releasing voice
            let quietest = this.releaseQueue[0];
            let lowestAmp = quietest.voice.getAmplitude();

            for (let i = 1; i < this.releaseQueue.length; i++) {
                const amp = this.releaseQueue[i].voice.getAmplitude();
                if (amp < lowestAmp) {
                    lowestAmp = amp;
                    quietest = this.releaseQueue[i];
                }
            }

            // Remove from release queue
            const index = this.releaseQueue.indexOf(quietest);
            this.releaseQueue.splice(index, 1);

            if (import.meta.env.DEV) {
                console.log('🎵 Voice stolen from release queue');
            }
            return quietest.voice;
        }

        // 2. Find lowest priority active voice
        if (this.activeVoices.size > 0) {
            let candidate = null;
            let lowestPriority = Infinity;
            let candidateNote = null;

            // ✅ MEMORY LEAK FIX: Iterate over Set of voices per note
            this.activeVoices.forEach((voicesSet, note) => {
                voicesSet.forEach(voice => {
                    const priority = voice.updatePriority();
                    if (priority < lowestPriority) {
                        lowestPriority = priority;
                        candidate = voice;
                        candidateNote = note;
                    }
                });
            });

            if (candidate) {
                // ✅ MEMORY LEAK FIX: Remove voice from Set
                const voicesSet = this.activeVoices.get(candidateNote);
                if (voicesSet) {
                    voicesSet.delete(candidate);
                    if (voicesSet.size === 0) {
                        this.activeVoices.delete(candidateNote);
                    }
                }
                if (import.meta.env.DEV) {
                    console.log(`🎵 Voice stolen: note ${candidateNote}, priority ${lowestPriority.toFixed(1)}`);
                }
                return candidate;
            }
        }

        // 3. No voices available at all
        return null;
    }

    /**
     * Schedule voice return to free pool after release
     * Uses AudioParam automation instead of setTimeout for precise timing
     *
     * @param {BaseVoice} voice - Voice to return
     * @param {number} startTime - Release start time
     * @param {number} duration - Release duration
     */
    scheduleVoiceReturn(voice, startTime, duration) {
        // Create a dummy ConstantSourceNode for timing
        // This triggers onended callback at exact audio time
        const timer = this.context.createConstantSource();

        let voiceReturned = false;
        const returnVoice = () => {
            if (voiceReturned) return; // Prevent double return
            voiceReturned = true;

            // Clear fallback timeout
            const timeoutId = this.voiceReturnTimeouts.get(voice);
            if (timeoutId) {
                clearTimeout(timeoutId);
                this.voiceReturnTimeouts.delete(voice);
            }

            // Return voice to free pool
            if (!this.freeVoices.includes(voice)) {
                this.freeVoices.push(voice);
            }

            // Remove from release queue
            const index = this.releaseQueue.findIndex(item => item.voice === voice);
            if (index !== -1) {
                this.releaseQueue.splice(index, 1);
            }
        };

        timer.onended = returnVoice;

        timer.start(startTime);
        timer.stop(startTime + duration);

        // ✅ MEMORY LEAK FIX: Fallback timeout in case onended doesn't fire
        // Add 1 second buffer to account for timing variations
        const fallbackTimeout = setTimeout(() => {
            if (!voiceReturned) {
                console.warn(`⚠️ Voice return fallback triggered for voice (onended didn't fire)`);
                returnVoice();
            }
        }, (duration * 1000) + 1000); // duration in ms + 1s buffer
        
        this.voiceReturnTimeouts.set(voice, fallbackTimeout);
    }

    /**
     * Release all active voices
     *
     * @param {number} time - AudioContext time to release
     */
    releaseAll(time, releaseVelocity = null) {
        // Copy keys to avoid modification during iteration
        const notes = Array.from(this.activeVoices.keys());

        notes.forEach(note => {
            this.release(note, time, releaseVelocity);
        });
    }

    /**
     * Emergency stop - instant silence, no release
     * Used for panic/stop button
     */
    stopAll() {
        // Clear release queue (cancel scheduled returns)
        this.releaseQueue = [];

        // Reset all voices immediately
        this.voices.forEach(voice => {
            voice.reset();
        });

        // Return all to free pool
        this.activeVoices.clear();
        this.freeVoices = [...this.voices];

        if (import.meta.env.DEV) {
            console.log('🛑 VoicePool: Emergency stop');
        }
    }

    /**
     * Get pool statistics (for debugging)
     */
    getStats() {
        return {
            total: this.voices.length,
            active: this.activeVoices.size,
            free: this.freeVoices.length,
            releasing: this.releaseQueue.length
        };
    }

    /**
     * Dispose entire voice pool
     * Called only when destroying instrument
     */
    dispose() {
        // ✅ MEMORY LEAK FIX: Clear all fallback timeouts
        this.voiceReturnTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.voiceReturnTimeouts.clear();

        // Stop all voices
        this.stopAll();

        // Dispose all voice instances
        this.voices.forEach(voice => {
            voice.dispose();
        });

        // Clear references
        this.voices = [];
        this.activeVoices.clear();
        this.freeVoices = [];
        this.releaseQueue = [];

        if (import.meta.env.DEV) {
            console.log('🗑️ VoicePool disposed');
            console.trace('📍 Disposal stack trace:');
        }
    }
}
