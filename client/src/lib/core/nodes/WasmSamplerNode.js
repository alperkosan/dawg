// src/lib/core/nodes/WasmSamplerNode.js

import { WasmModuleCache } from '../WasmModuleCache.js';

export class WasmSamplerNode {
    constructor(instrumentData, audioBuffer, audioContext) {
        this.id = instrumentData.id;
        this.context = audioContext;
        this.workletNode = null;
        this.output = this.context.createGain(); // Public output
        this.isDisposed = false; // ✅ Disposal guard

        // Persistent Internal State
        // Helper to ensure defaults
        this.data = {
            baseNote: 60,
            playbackRate: 1.0,
            sampleStart: 0.0,
            sampleEnd: 1.0,
            ...instrumentData
        };

        this.buffer = null; // AudioBuffer reference

        // ✅ Track initialization promise
        this.initializationPromise = this.initialize(audioBuffer);
    }

    async initialize(audioBuffer) {
        if (audioBuffer) {
            this.buffer = audioBuffer;
        }

        try {
            // Ensure worklet module is loaded
            this.workletNode = new AudioWorkletNode(this.context, 'wasm-sampler-processor', {
                processorOptions: {
                    sampleRate: this.context.sampleRate
                }
            });

            // ✅ PERFORMANCE: Use cached WASM module instead of fetching each time
            const bytes = await WasmModuleCache.getWasmBytes();

            // Guard against disposal during await
            if (this.isDisposed || !this.workletNode) {
                console.warn(`⚠️ WasmSamplerNode ${this.id} disposed during WASM fetch`);
                return;
            }

            // ✅ Create initialization promise with timeout
            const initPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`WASM initialization timeout for ${this.id}`));
                }, 5000); // 5 second timeout

                this.workletNode.port.onmessage = (event) => {
                    const { type } = event.data;
                    if (type === 'initialized') {
                        clearTimeout(timeout);
                        console.log(`✅ WasmSamplerNode initialized for ${this.id}`);
                        if (this.buffer && !this.isDisposed) {
                            this.loadBuffer(this.buffer);
                        }
                        resolve();
                    } else if (type === 'error') {
                        clearTimeout(timeout);
                        console.error(`❌ WasmSamplerNode Worklet error:`, event.data.error);
                        reject(new Error(event.data.error));
                    }
                };
            });

            // ✅ Send WASM bytes immediately (no setTimeout delay)
            if (this.isDisposed || !this.workletNode) {
                console.warn(`⚠️ WasmSamplerNode ${this.id} disposed before sending WASM bytes`);
                return;
            }

            this.workletNode.port.postMessage({
                type: 'init-wasm',
                data: { wasmBytes: bytes }
            }, [bytes]);

            this.workletNode.connect(this.output);

            // Wait for initialization to complete
            await initPromise;

        } catch (error) {
            console.error(`❌ WasmSamplerNode initialization failed for ${this.id}:`, error);
            throw error; // Re-throw so caller can handle
        }
    }

    /**
     * Standard parameter update method
     * @param {Object} params - Partial instrument data
     */
    updateParameters(params) {
        // Merge into persistent state
        Object.assign(this.data, params);

        // ✅ REAL-TIME UPDATE: Send new params to Worklet for active voices
        if (this.isDisposed || !this.workletNode) return;

        const updatePayload = {};

        // Prepare ADSR update
        // Note: If envelope is disabled, we enforce the "Gate" defaults ensuring tight response
        if (this.data.envelopeEnabled) {
            updatePayload.adsr = {
                attack: this.data.attack || 0.001,
                decay: this.data.decay || 0.1,
                sustain: this.data.sustain !== undefined ? this.data.sustain : 1.0,
                release: this.data.release || 0.1
            };
        } else {
            updatePayload.adsr = {
                attack: 0.0,
                decay: 0.0,
                sustain: 1.0,
                release: 0.01 // 10ms de-click
            };
        }

        // ✅ TRIM UPDATE
        if (params.sampleStart !== undefined || params.sampleEnd !== undefined) {
            const bufferLen = this.buffer ? this.buffer.length : 0;
            if (bufferLen > 0) {
                const sStart = this.data.sampleStart !== undefined ? this.data.sampleStart : 0.0;
                const sEnd = this.data.sampleEnd !== undefined ? this.data.sampleEnd : 1.0;

                const startIdx = Math.floor(Math.max(0, Math.min(1, sStart)) * bufferLen);
                const endIdx = Math.floor(Math.max(0, Math.min(1, sEnd)) * bufferLen);

                updatePayload.range = { start: startIdx, end: endIdx };
            }
        }

        // ✅ FILTER UPDATE
        if (params.filterCutoff !== undefined || params.filterResonance !== undefined || params.filterType !== undefined || params.filterEnabled !== undefined) {
            const cutoff = this.data.filterCutoff || 20000;
            const res = this.data.filterResonance || 0;
            const typeStr = this.data.filterType || 'lowpass';
            const enabled = !!this.data.filterEnabled;

            let typeIdx = 0;
            if (typeStr === 'highpass') typeIdx = 1;
            else if (typeStr === 'bandpass') typeIdx = 2;
            else if (typeStr === 'notch') typeIdx = 3;

            // Map Resonance (0.0 - 1.0) to Q (0.707 - 10.0)
            const q = 0.707 + (res * 9.3);

            updatePayload.filter = {
                cutoff: cutoff,
                q: q,
                type: typeIdx,
                enabled: enabled
            };
        }

        // ✅ BASS BOOST UPDATE
        if (params.bassBoost !== undefined) {
            updatePayload.bassBoost = params.bassBoost / 100.0;
        }

        this.workletNode.port.postMessage({
            type: 'update-params',
            data: updatePayload
        });
    }

    // Alias for compatibility
    setParameters(params) {
        this.updateParameters(params);
    }

    loadBuffer(audioBuffer) {
        if (!audioBuffer || this.isDisposed) return;

        this.buffer = audioBuffer;

        // Extract channels
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.numberOfChannels > 1
            ? audioBuffer.getChannelData(1)
            : new Float32Array(0); // Send empty if mono

        if (this.workletNode) {
            this.workletNode.port.postMessage({
                type: 'load-sample',
                data: {
                    left: left,
                    right: right
                }
            });
        }
    }

    triggerNote(midiNote, velocity = 100, time = 0, duration = 0) {
        if (this.isDisposed || !this.workletNode) return;

        // Calculate pitch ratio
        const baseNote = this.data.baseNote || 60;
        const semitones = midiNote - baseNote;
        const pitchRatio = Math.pow(2, semitones / 12);

        // Calculate Sample Rate Ratio (Correction)
        const srRatio = (this.buffer && this.buffer.sampleRate)
            ? (this.buffer.sampleRate / this.context.sampleRate)
            : 1.0;

        // Final Speed calculation
        // Check for 'reverse' flag in data? WasmSingleSampleInstrument calculates neg speed.
        // But WasmSamplerNode should support 'data.reverse' if passed.
        // However, WasmSingleSampleInstrument sends 'playbackRate' which already includes direction.
        // We will trust 'data.playbackRate' as the authoritative speed multiplier.

        const speed = pitchRatio * (this.data.playbackRate || 1.0) * srRatio;

        // Normalize velocity
        const gain = velocity / 127;

        // Calculate Trim Range (Indices)
        const bufferLen = this.buffer ? this.buffer.length : 0;
        let startIdx = 0;
        let endIdx = bufferLen;

        if (bufferLen > 0) {
            const sStart = this.data.sampleStart !== undefined ? this.data.sampleStart : 0.0;
            const sEnd = this.data.sampleEnd !== undefined ? this.data.sampleEnd : 1.0;

            startIdx = Math.floor(Math.max(0, Math.min(1, sStart)) * bufferLen);
            endIdx = Math.floor(Math.max(0, Math.min(1, sEnd)) * bufferLen);
        }

        // Prepare ADSR
        let adsr = null;
        if (this.data.envelopeEnabled) {
            adsr = {
                attack: this.data.attack || 0.001,
                decay: this.data.decay || 0.1,
                sustain: this.data.sustain !== undefined ? this.data.sustain : 1.0,
                release: this.data.release || 0.1
            };
        } else {
            // - But for Drums (one shot), we often want full sample duration.
            // - Let's stick to a safe default that mimics "raw playback" with click protection.
            adsr = {
                attack: 0.0, // Instant attack for punchy drums
                decay: 0.0,
                sustain: 1.0,
                release: 0.01 // 10ms de-click
            };
        }

        // Prepare Filter
        let filterParams = { cutoff: 20000, q: 0.707, type: 0, enabled: false };

        if (this.data.filterEnabled) {
            const cutoff = this.data.filterCutoff || 20000;
            const res = this.data.filterResonance || 0;
            const typeStr = this.data.filterType || 'lowpass';

            let typeIdx = 0;
            if (typeStr === 'highpass') typeIdx = 1;
            else if (typeStr === 'bandpass') typeIdx = 2;
            else if (typeStr === 'notch') typeIdx = 3;

            const q = 0.707 + (res * 9.3);

            filterParams = {
                cutoff: cutoff,
                q: q,
                type: typeIdx,
                enabled: true
            };
        }

        this.workletNode.port.postMessage({
            type: 'play',
            data: {
                speed: speed,
                velocity: gain,
                start: startIdx,
                end: endIdx,
                adsr: adsr,
                filter: filterParams,
                bassBoost: (this.data.bassBoost || 0) / 100.0,
                startTime: time // AudioContext time
            }
        });
    }

    releaseNote() {
        if (this.isDisposed || !this.workletNode) return;
        this.workletNode.port.postMessage({ type: 'release' });
    }

    dispose() {
        this.isDisposed = true; // ✅ Set disposal flag first

        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'dispose' }); // Let processor clean wasm memory
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        if (this.output) {
            this.output.disconnect();
        }
        this.buffer = null;
        this.data = null;
    }
}
