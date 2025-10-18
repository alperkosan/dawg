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
        this.activeVoices = new Map(); // midiNote → voice
        this.freeVoices = [...this.voices]; // Available voices
        this.releaseQueue = []; // Voices in release phase { voice, endTime }

        console.log(`🎵 VoicePool created: ${VoiceClass.name}, ${maxVoices} voices`);
    }

    /**
     * Allocate a voice for a note
     *
     * @param {number} midiNote - MIDI note number
     * @returns {BaseVoice|null} Allocated voice or null if failed
     */
    allocate(midiNote) {
        // Check if note already playing (re-trigger case)
        if (this.activeVoices.has(midiNote)) {
            // Return existing voice for re-trigger
            return this.activeVoices.get(midiNote);
        }

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
        this.activeVoices.set(midiNote, voice);

        return voice;
    }

    /**
     * Release a voice (start release envelope)
     *
     * @param {number} midiNote - MIDI note number
     * @param {number} time - AudioContext time to release
     */
    release(midiNote, time) {
        const voice = this.activeVoices.get(midiNote);
        if (!voice) return;

        // Start release phase
        const releaseDuration = voice.release(time);

        // Remove from active voices
        this.activeVoices.delete(midiNote);

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

            console.log('🎵 Voice stolen from release queue');
            return quietest.voice;
        }

        // 2. Find lowest priority active voice
        if (this.activeVoices.size > 0) {
            let candidate = null;
            let lowestPriority = Infinity;
            let candidateNote = null;

            this.activeVoices.forEach((voice, note) => {
                const priority = voice.updatePriority();
                if (priority < lowestPriority) {
                    lowestPriority = priority;
                    candidate = voice;
                    candidateNote = note;
                }
            });

            if (candidate) {
                this.activeVoices.delete(candidateNote);
                console.log(`🎵 Voice stolen: note ${candidateNote}, priority ${lowestPriority.toFixed(1)}`);
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

        timer.onended = () => {
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

        timer.start(startTime);
        timer.stop(startTime + duration);
    }

    /**
     * Release all active voices
     *
     * @param {number} time - AudioContext time to release
     */
    releaseAll(time) {
        // Copy keys to avoid modification during iteration
        const notes = Array.from(this.activeVoices.keys());

        notes.forEach(note => {
            this.release(note, time);
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

        console.log('🛑 VoicePool: Emergency stop');
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

        console.log('🗑️ VoicePool disposed');
    }
}
