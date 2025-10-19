/**
 * SingleSampleInstrument - Simple one-shot sample player
 *
 * For instruments with a single audio file (kick, snare, hi-hat, etc.)
 * Supports:
 * - Polyphonic playback
 * - Pitch shifting (playbackRate)
 * - Velocity (gain)
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
            console.warn(`SingleSample not ready: ${this.name}`);
            return;
        }

        const when = startTime !== null ? startTime : this.audioContext.currentTime;

        try {
            // Stop existing note at same pitch (re-trigger)
            if (this.activeSources.has(midiNote)) {
                this.noteOff(midiNote, when);
            }

            // Create buffer source
            const source = this.audioContext.createBufferSource();
            source.buffer = this.sampleBuffer;

            // Calculate pitch shift (playback rate)
            const pitchShift = midiNote - this.baseNote; // semitones
            const playbackRate = Math.pow(2, pitchShift / 12);
            source.playbackRate.setValueAtTime(playbackRate, when);

            // Create gain node for velocity
            const gainNode = this.audioContext.createGain();
            const gainValue = Math.max(0, Math.min(1, velocity / 127));
            gainNode.gain.setValueAtTime(gainValue, when);

            // Connect: source -> gain -> master
            source.connect(gainNode);
            gainNode.connect(this.masterGain);

            // Start playback
            source.start(when);

            // Track active source
            this.activeSources.set(midiNote, {
                source,
                gainNode,
                startTime: when
            });

            // Auto-cleanup when finished
            source.onended = () => {
                if (this.activeSources.get(midiNote)?.source === source) {
                    this.activeSources.delete(midiNote);
                    gainNode.disconnect();
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

                // Quick fade out to avoid clicks
                gainNode.gain.setValueAtTime(gainNode.gain.value, when);
                gainNode.gain.linearRampToValueAtTime(0, when + 0.01);

                // Stop source
                source.stop(when + 0.01);

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

        for (const [midiNote, { source, gainNode }] of this.activeSources) {
            try {
                gainNode.gain.setValueAtTime(gainNode.gain.value, now);
                gainNode.gain.linearRampToValueAtTime(0, now + 0.01);
                source.stop(now + 0.01);
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
