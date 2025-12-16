/**
 * WasmSingleSampleInstrument - Adapter for Wasm-based sample playback
 * 
 * Replaces SingleSampleInstrument when Wasm engine is active.
 * Uses WasmSamplerNode for high-performance playback.
 */

import { BaseInstrument } from '../base/BaseInstrument.js';
import { WasmSamplerNode } from '../../../core/nodes/WasmSamplerNode.js';

export class WasmSingleSampleInstrument extends BaseInstrument {
    constructor(instrumentData, audioContext, sampleBuffer) {
        super(instrumentData, audioContext);

        this.sampleBuffer = sampleBuffer;
        this.wasmNode = null;
        this.masterGain = null;
        this._isInitialized = false;
    }

    async initialize() {
        try {
            // Create Master Gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = this.data.gain || 1.0;

            // Create Stereo Panner
            this.panner = this.audioContext.createStereoPanner();
            this.panner.pan.value = this.data.pan || 0;

            this.output = this.masterGain;

            // Create Wasm Node
            // Pass instrumentData to get ID and baseNote
            this.wasmNode = new WasmSamplerNode(this.data, this.sampleBuffer, this.audioContext);

            // Connect: WasmNode -> Panner -> MasterGain
            this.wasmNode.output.connect(this.panner);
            this.panner.connect(this.masterGain);

            // ✅ Wait for WASM initialization with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('WASM instrument initialization timeout')), 10000);
            });

            await Promise.race([
                this.wasmNode.initializationPromise,
                timeoutPromise
            ]);

            this._isInitialized = true;
            console.log(`🥁 WasmSingleSample initialized: ${this.name}`);

        } catch (error) {
            console.error(`❌ WasmSingleSample init failed for ${this.name}:`, error);
            this._isInitialized = false;
            throw error;
        }
    }

    /**
     * Play a note
     */
    noteOn(midiNote, velocity = 100, startTime = null, extendedParams = null) {
        if (!this._isInitialized || !this.wasmNode) {
            return;
        }

        // WasmSamplerNode handles speed calc and triggering
        const when = startTime || this.audioContext.currentTime;
        // Calculate duration if we have gate... for now 0 (one-shot) or simple release
        const duration = 0;

        // Handle Cut Itself (Monophonic behavior)
        if (this.data.cutItself) {
            // Release previous notes immediately (fast fade out), forcing even if envelope disabled
            this.wasmNode.releaseNote(null, when, true);
        }

        this.wasmNode.triggerNote(midiNote, velocity, when, duration);

        this.activeNotes.set(midiNote, { startTime: when, velocity });
        this._isPlaying = true;
    }

    /**
     * Stop a note
     */
    noteOff(midiNote = null, stopTime = null) {
        const when = stopTime || this.audioContext.currentTime;

        // If one-shot, we might not need to do anything, 
        // unless we want to choke/stop early.
        // For drums, usually we let it play. 
        // WasmSamplerNode.releaseNote() stops *all* voices currently (in my simple impl).

        if (midiNote === null) {
            this.wasmNode.releaseNote(); // Stops all
            this.activeNotes.clear();
            this._isPlaying = false;
        } else {
            this.activeNotes.delete(midiNote);
            if (this.activeNotes.size === 0) {
                this._isPlaying = false;
            }
        }
    }

    updateParameters(params) {
        // Handle gain updates
        if (params.gain !== undefined && this.masterGain) {
            this.masterGain.gain.setTargetAtTime(params.gain, this.audioContext.currentTime, 0.01);
        }

        // Handle Pan updates
        if (params.pan !== undefined && this.panner) {
            this.panner.pan.setTargetAtTime(params.pan, this.audioContext.currentTime, 0.01);
        }

        // Pass playback parameters to WasmNode
        // Calculate speed with Reverse support
        if (this.wasmNode) {
            // Check params or fallback to current data
            // Pitch is in semitones (e.g. -12 to +12, default 0)
            const pitch = params.pitch !== undefined ? params.pitch : (this.data.pitch || 0);
            const reverse = params.reverse !== undefined ? params.reverse : (this.data.reverse || false);

            // Convert semitones to rate: rate = 2^(pitch/12)
            const rate = Math.pow(2, pitch / 12.0);

            // Negative speed = Reverse playback
            const playbackRate = rate * (reverse ? -1 : 1);

            // Forward all params (ADSR, Trim) AND calculated playbackRate
            this.wasmNode.updateParameters({
                ...params,
                playbackRate: playbackRate,
                baseNote: params.baseNote
            });
        }

        // Update internal data state
        Object.assign(this.data, params);
    }

    /**
     * Set instrument volume for automation
     * @param {number} volume - Volume (0-1)
     * @param {number} time - AudioContext time (optional)
     */
    setVolume(volume, time = null) {
        if (!this.masterGain) return;
        const now = time !== null ? time : this.audioContext.currentTime;
        // Use setTargetAtTime for smooth automation (10ms time constant)
        this.masterGain.gain.setTargetAtTime(Math.max(0, volume), now, 0.01);
    }

    /**
     * Update the audio buffer (e.g. after destructive editing)
     * @param {AudioBuffer} buffer 
     */
    setBuffer(buffer) {
        if (!buffer || !this.wasmNode) return;
        this.sampleBuffer = buffer;
        this.wasmNode.loadBuffer(buffer);
    }

    /**
     * Set instrument pan for automation
     * @param {number} pan - Pan (-1 to 1)
     * @param {number} time - AudioContext time (optional)
     */
    setPan(pan, time = null) {
        if (!this.panner) return;
        const now = time !== null ? time : this.audioContext.currentTime;
        // Clamp to valid range
        const safePan = Math.max(-1, Math.min(1, pan));
        this.panner.pan.setTargetAtTime(safePan, now, 0.01);
    }

    dispose() {
        if (this.wasmNode) {
            this.wasmNode.output.disconnect();
            this.wasmNode.dispose();
            this.wasmNode = null;
        }
        if (this.masterGain) {
            this.masterGain.disconnect();
        }
    }
}
