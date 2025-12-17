/**
 * Sympathetic Resonance System
 * Simulates how piano strings vibrate sympathetically when other notes are played
 * Creates a more realistic and rich piano sound
 */

export class SympatheticResonance {
    constructor(audioContext, instrument) {
        this.audioContext = audioContext;
        this.instrument = instrument;

        // Resonance settings
        this.enabled = true;
        this.gain = 0.08; // Very subtle (0-1)
        this.attack = 0.3; // Slow attack for natural resonance
        this.decay = 1.5; // Long decay
        this.sustain = 0.2; // Low sustain level
        this.release = 3.0; // Very long release

        // Active resonances (midiNote -> { voices: [], startTime: number })
        this.activeResonances = new Map();

        // Harmonic series configuration
        this.harmonicSeries = [
            { interval: 12, gain: 0.35 },  // Octave (strongest)
            { interval: 19, gain: 0.20 },  // Perfect fifth (1 octave up)
            { interval: 24, gain: 0.15 },  // Double octave
            { interval: 28, gain: 0.10 },  // Major third (2 octaves up)
            { interval: 31, gain: 0.08 },  // Perfect fifth (2 octaves up)
            { interval: 36, gain: 0.05 },  // Triple octave
        ];

        // Subharmonics (lower resonances)
        this.subharmonics = [
            { interval: -12, gain: 0.15 }, // Octave below
            { interval: -19, gain: 0.08 }, // Fifth below
        ];
    }

    /**
     * Trigger sympathetic resonance for a played note
     * @param {number} fundamentalNote - The MIDI note that was played
     * @param {number} velocity - The velocity of the played note
     * @param {number} startTime - When to start the resonance
     */
    trigger(fundamentalNote, velocity, startTime = null) {
        if (!this.enabled || !this.instrument) return;

        const time = startTime || this.audioContext.currentTime;

        // Calculate which harmonics to trigger
        const harmonicsToTrigger = this._calculateHarmonics(fundamentalNote, velocity);

        // Trigger each harmonic
        harmonicsToTrigger.forEach(({ note, gain }) => {
            this._triggerResonance(note, gain, time);
        });
    }

    /**
     * Calculate which harmonics should resonate
     * @private
     */
    _calculateHarmonics(fundamentalNote, velocity) {
        const harmonics = [];
        const velocityFactor = velocity / 127;

        // Upper harmonics
        this.harmonicSeries.forEach(({ interval, gain }) => {
            const harmonicNote = fundamentalNote + interval;

            // Only trigger if note is in valid MIDI range
            if (harmonicNote >= 21 && harmonicNote <= 108) {
                // Check if we have a sample for this note
                if (this._hasSampleForNote(harmonicNote)) {
                    harmonics.push({
                        note: harmonicNote,
                        gain: gain * this.gain * velocityFactor
                    });
                }
            }
        });

        // Subharmonics (only for higher notes)
        if (fundamentalNote > 60) { // Middle C and above
            this.subharmonics.forEach(({ interval, gain }) => {
                const subharmonicNote = fundamentalNote + interval;

                if (subharmonicNote >= 21 && subharmonicNote <= 108) {
                    if (this._hasSampleForNote(subharmonicNote)) {
                        harmonics.push({
                            note: subharmonicNote,
                            gain: gain * this.gain * velocityFactor * 0.5 // Subharmonics are quieter
                        });
                    }
                }
            });
        }

        return harmonics;
    }

    /**
     * Check if instrument has a sample for a note
     * @private
     */
    _hasSampleForNote(midiNote) {
        if (!this.instrument || !this.instrument.sampleMap) return false;
        return this.instrument.sampleMap.has(midiNote);
    }

    /**
     * Trigger a single resonance voice
     * @private
     */
    _triggerResonance(midiNote, gain, startTime) {
        try {
            // Get sample mapping for this note
            const mapping = this.instrument._getSampleMapping(midiNote, 64); // Medium velocity

            if (!mapping || !mapping.buffer) {
                return;
            }

            // Create audio nodes
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            const filterNode = this.audioContext.createBiquadFilter();

            // Configure source
            source.buffer = mapping.buffer;

            // Calculate playback rate for pitch shifting
            const pitchShift = mapping.pitchShift || 0;
            const playbackRate = Math.pow(2, pitchShift / 12);
            source.playbackRate.value = playbackRate;

            // Configure filter (lowpass to make it more subtle)
            filterNode.type = 'lowpass';
            filterNode.frequency.value = 2000; // Cut high frequencies
            filterNode.Q.value = 0.5;

            // Configure gain envelope (ADSR)
            const attackTime = startTime + this.attack;
            const decayTime = attackTime + this.decay;
            const peakGain = gain;
            const sustainGain = gain * this.sustain;

            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(peakGain, attackTime);
            gainNode.gain.linearRampToValueAtTime(sustainGain, decayTime);

            // Connect nodes
            source.connect(filterNode);
            filterNode.connect(gainNode);
            gainNode.connect(this.instrument.masterGain);

            // Start playback
            source.start(startTime);

            // Schedule stop after a reasonable time (don't let it play forever)
            const stopTime = decayTime + 5.0; // 5 seconds after decay
            source.stop(stopTime);

            // Track this resonance
            if (!this.activeResonances.has(midiNote)) {
                this.activeResonances.set(midiNote, { voices: [], startTime });
            }

            this.activeResonances.get(midiNote).voices.push({
                source,
                gainNode,
                filterNode,
                stopTime
            });

            // Cleanup after stop
            source.onended = () => {
                this._cleanupResonance(midiNote, source);
            };

        } catch (error) {
            console.warn('Sympathetic resonance trigger failed:', error);
        }
    }

    /**
     * Release resonances for a note
     * @param {number} midiNote - The fundamental note that was released
     * @param {number} releaseTime - When to start the release
     */
    release(midiNote, releaseTime = null) {
        if (!this.enabled) return;

        const time = releaseTime || this.audioContext.currentTime;

        // Calculate harmonics that should be released
        const harmonicsToRelease = this._calculateHarmonics(midiNote, 100);

        harmonicsToRelease.forEach(({ note }) => {
            this._releaseResonance(note, time);
        });
    }

    /**
     * Release a single resonance voice
     * @private
     */
    _releaseResonance(midiNote, releaseTime) {
        const resonance = this.activeResonances.get(midiNote);
        if (!resonance) return;

        const releaseEndTime = releaseTime + this.release;

        resonance.voices.forEach(({ gainNode, source, stopTime }) => {
            try {
                // Cancel any scheduled changes
                gainNode.gain.cancelScheduledValues(releaseTime);

                // Get current gain value
                const currentGain = gainNode.gain.value;

                // Fade out
                gainNode.gain.setValueAtTime(currentGain, releaseTime);
                gainNode.gain.linearRampToValueAtTime(0, releaseEndTime);

                // Update stop time if needed
                if (stopTime > releaseEndTime) {
                    source.stop(releaseEndTime);
                }
            } catch (error) {
                // Already stopped or released
            }
        });
    }

    /**
     * Cleanup finished resonance
     * @private
     */
    _cleanupResonance(midiNote, source) {
        const resonance = this.activeResonances.get(midiNote);
        if (!resonance) return;

        // Remove this voice from the list
        resonance.voices = resonance.voices.filter(v => v.source !== source);

        // If no more voices, remove the resonance entry
        if (resonance.voices.length === 0) {
            this.activeResonances.delete(midiNote);
        }
    }

    /**
     * Stop all resonances immediately
     */
    stopAll() {
        const now = this.audioContext.currentTime;

        this.activeResonances.forEach((resonance, midiNote) => {
            resonance.voices.forEach(({ source, gainNode }) => {
                try {
                    gainNode.gain.cancelScheduledValues(now);
                    gainNode.gain.setValueAtTime(0, now);
                    source.stop(now);
                } catch (error) {
                    // Already stopped
                }
            });
        });

        this.activeResonances.clear();
    }

    /**
     * Update resonance settings
     */
    updateSettings(settings) {
        if (settings.enabled !== undefined) this.enabled = settings.enabled;
        if (settings.gain !== undefined) this.gain = Math.max(0, Math.min(1, settings.gain));
        if (settings.attack !== undefined) this.attack = settings.attack;
        if (settings.decay !== undefined) this.decay = settings.decay;
        if (settings.sustain !== undefined) this.sustain = settings.sustain;
        if (settings.release !== undefined) this.release = settings.release;
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        this.stopAll();
        this.activeResonances.clear();
    }
}
