/**
 * UnifiedMixerWorklet - WASM-Powered MegaMixer
 * Uses fetch + WebAssembly.instantiate for maximum compatibility
 */

// Global WASM module reference (loaded once, shared across instances)
let wasmModuleCache = null;
let wasmLoadingPromise = null;

// Polyfill helpers for Wasm-Bindgen
const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
let cachedUint8Memory = null;

function getUint8Memory() {
    if (!cachedUint8Memory || cachedUint8Memory.byteLength === 0) {
        if (!wasmModuleCache || !wasmModuleCache.memory) return null;
        cachedUint8Memory = new Uint8Array(wasmModuleCache.memory.buffer);
    }
    return cachedUint8Memory;
}

function getStringFromWasm(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getUint8Memory();
    if (!mem) return "";
    return textDecoder.decode(mem.subarray(ptr, ptr + len));
}

class UnifiedMixerWorklet extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.numChannels = options.processorOptions?.numChannels || 32;
        this.sampleRate = sampleRate;
        this.wasmProcessor = null;
        this.isInitialized = false;
        const MAX_BLOCK_SIZE = 4096;
        this.interleavedInputs = new Float32Array(MAX_BLOCK_SIZE * this.numChannels * 2);
        this.outputL = new Float32Array(MAX_BLOCK_SIZE);
        this.outputR = new Float32Array(MAX_BLOCK_SIZE);
        this.stats = { samplesProcessed: 0, totalTime: 0, peakTime: 0, processCount: 0 };

        // State tracking to prevent parameter resets
        this.channelStates = new Array(this.numChannels).fill(0).map(() => ({
            gain: 1.0, pan: 0.0, mute: false, solo: false, eqActive: false, compActive: false
        }));

        this.port.onmessage = this.handleMessage.bind(this);
        console.log(`🚀 UnifiedMixerWorklet initialized: ${this.numChannels} channels @ ${this.sampleRate}Hz`);
    }

    handleMessage(event) {
        const { type, data } = event.data;
        switch (type) {
            case 'init-wasm': this.initializeWasm(data.wasmArrayBuffer); break;
            case 'set-channel-params': this.updateChannelParams(data); break;
            case 'set-channel-eq': this.updateChannelEQ(data); break;
            case 'add-channel-effect': this.addChannelEffect(data); break;
            case 'reset': this.reset(); break;
            case 'get-stats': this.sendStats(); break;

            // ✅ NEW: Receive Shared Array Buffer from Main Thread
            case 'set-shared-state':
                // Note: NativeTransportSystem sends { type: 'set-shared-state', sharedState... }
                // So sharedState is on event.data directly if we didn't destructure.
                // But we destructured 'data' from event.data above.
                // Check if 'sharedState' is on event.data or event.data.data
                const sab = event.data.sharedState || (data && data.sharedState);

                if (sab && sab instanceof SharedArrayBuffer) {
                    this.sharedStateBuffer = sab;
                    this.sharedStateView = new Float32Array(this.sharedStateBuffer);
                    console.log('🔗 AudioWorklet: Shared State Buffer connected');
                }
                break;
        }
    }

    async initializeWasm(wasmArrayBuffer) {
        try {
            console.log('⏳ Loading WASM in AudioWorklet...');

            // Load WASM from ArrayBuffer passed from main thread
            if (!wasmModuleCache) {
                if (!wasmLoadingPromise) {
                    wasmLoadingPromise = (async () => {
                        const imports = {
                            './dawg-utils.js': {
                                host_log: (ptr, len) => {
                                    const msg = getStringFromWasm(ptr, len);
                                    console.log('[Rust] ' + msg);
                                }
                            },
                            wbg: {
                                __wbg_wbindgencopytotypedarray_d105febdb9374ca3: (arg0, arg1, arg2) => {
                                    // Copy typed array stub (not used in our case)
                                },
                                __wbg_wbindgenthrow_451ec1a8469d7eb6: (arg0, arg1) => {
                                    const msg = getStringFromWasm(arg0, arg1);
                                    throw new Error(msg);
                                },
                                __wbindgen_init_externref_table: () => { },
                                __wbindgen_cast_2241b6af4c4b2941: (arg0, arg1) => {
                                    return getStringFromWasm(arg0, arg1);
                                },
                                // Polyfills for Wasm logging (if needed in future)
                                // but we are switching to raw imports for robustness
                                __wbg_new_1f3a344cf3123716: () => new Array(),
                                __wbg_push_330b2eb93e4e1212: (arg0, arg1) => arg0.push(arg1),
                                __wbg_log_77195989eb27ffe5: (arg0) => console.log(...arg0),
                            }
                        };

                        return await WebAssembly.instantiate(wasmArrayBuffer, imports);
                    })();
                }
                wasmModuleCache = (await wasmLoadingPromise).instance.exports;
            }

            // Create UnifiedMixerProcessor instance
            if (wasmModuleCache.set_panic_hook) {
                wasmModuleCache.set_panic_hook();
            }

            const { UnifiedMixerProcessor, allocate_f32_array } = wasmModuleCache;

            // Create Rust Processor
            // NOTE: We are using raw WASM exports, so 'UnifiedMixerProcessor' class doesn't exist.
            // We must call the 'new' function directly. export name is usually 'unifiedmixerprocessor_new'.

            this.wasmExports = wasmModuleCache;

            // Instantiate Processor (Rust: UnifiedMixerProcessor::new(sample_rate, num_channels))
            if (this.wasmExports.unifiedmixerprocessor_new) {
                this.processorPtr = this.wasmExports.unifiedmixerprocessor_new(this.sampleRate, this.numChannels);
            } else {
                throw new Error("Export 'unifiedmixerprocessor_new' not found in WASM module");
            }

            // ✅ NEW: Allocate Shared State Memory in Wasm
            const STATE_SIZE = 32; // Defined in lib.rs
            this.statePtr = allocate_f32_array(STATE_SIZE);

            // Rust: processor.set_shared_state_buffer(ptr)
            if (this.wasmExports.unifiedmixerprocessor_set_shared_state_buffer) {
                this.wasmExports.unifiedmixerprocessor_set_shared_state_buffer(this.processorPtr, this.statePtr);
            }

            console.log(`🧠 Shared State Memory allocated at ptr: ${this.statePtr}`);

            // Allocate Mixing Buffers (once)
            const MAX_BLOCK_SIZE = 4096;
            this.inputPtr = allocate_f32_array(MAX_BLOCK_SIZE * this.numChannels * 2);
            this.outputLPtr = allocate_f32_array(MAX_BLOCK_SIZE);
            this.outputRPtr = allocate_f32_array(MAX_BLOCK_SIZE);
            this.levelsPtr = allocate_f32_array(this.numChannels * 2); // For metering

            // ✅ CRITICAL: Set wasmProcessor object so process() knows we are ready
            // (Used to be the bindgen class instance, now a plain object with pointers)
            this.wasmProcessor = {
                ptr: this.processorPtr,
                levelsPtr: this.levelsPtr
            };

            this.isInitialized = true;
            this.port.postMessage({ type: 'wasm-initialized', success: true });
            console.log('✅ WASM Mixer fully operational.');

        } catch (error) {
            console.error('❌ Failed to initialize WASM:', error);

            // Fallback: Use JavaScript implementation
            console.log('⚠️ Falling back to JavaScript implementation');
            this.createJavaScriptFallback(); // Sets this.fallbackProcessor
            this.isInitialized = true;
            this.isFallback = true; // Flag to indicate fallback mode
            this.port.postMessage({ type: 'wasm-initialized', success: true, fallback: true });
        }
    }

    createJavaScriptFallback() {
        // Simple JavaScript mixer fallback
        this.fallbackProcessor = {
            process_mix: (inputBuf, outL, outR, blockSize, numCh) => {
                outL.fill(0);
                outR.fill(0);
                // Simple mix: sum all inputs
                for (let s = 0; s < blockSize; s++) {
                    for (let ch = 0; ch < numCh; ch++) {
                        const idx = s * numCh * 2 + ch * 2;
                        if (idx + 1 < inputBuf.length) {
                            outL[s] += inputBuf[idx] * 0.1;
                            outR[s] += inputBuf[idx + 1] * 0.1;
                        }
                    }
                }
            },
            set_channel_params: () => { },
            set_channel_eq: () => { },
            reset: () => { }
        };
    }

    updateChannelParams(data) {
        const { channelIdx } = data;
        if (!this.isInitialized) return;

        // State tracking
        const state = this.channelStates[channelIdx] || {}; // Fallback if undefined
        this.channelStates[channelIdx] = state; // Ensure stored

        if (channelIdx >= this.numChannels) return;

        // Update state with provided data
        if (data.gain !== undefined) state.gain = data.gain;
        if (data.pan !== undefined) state.pan = data.pan;
        if (data.mute !== undefined) state.mute = data.mute;
        if (data.solo !== undefined) state.solo = data.solo;
        if (data.eqActive !== undefined) state.eqActive = data.eqActive;
        if (data.compActive !== undefined) state.compActive = data.compActive;

        if (this.isFallback) return;

        // Rust: processor.set_channel_params(idx, gain, pan, mute, solo, eq, comp)
        if (this.wasmExports.unifiedmixerprocessor_set_channel_params) {
            this.wasmExports.unifiedmixerprocessor_set_channel_params(
                this.processorPtr,
                channelIdx,
                state.gain,
                state.pan,
                state.mute ? 1 : 0,
                state.solo ? 1 : 0,
                state.eqActive ? 1 : 0,
                state.compActive ? 1 : 0
            );
        }
    }

    updateChannelEQ(data) {
        if (!this.isInitialized || this.isFallback) return;
        const { channelIdx, lowGain, midGain, highGain, lowFreq, highFreq } = data;

        if (this.wasmExports.unifiedmixerprocessor_set_channel_eq) {
            this.wasmExports.unifiedmixerprocessor_set_channel_eq(
                this.processorPtr,
                channelIdx,
                lowGain, midGain, highGain,
                lowFreq, highFreq
            );
        }
    }

    addChannelEffect(data) {
        if (!this.isInitialized || this.isFallback) return;
        const { channelIdx, effectType } = data;

        if (this.wasmExports.unifiedmixerprocessor_add_effect) {
            this.wasmExports.unifiedmixerprocessor_add_effect(this.processorPtr, channelIdx, effectType);
            console.log(`➕ Wasm Ch ${channelIdx}: Added Effect Type ${effectType}`);
        }
    }

    reset() {
        this.stats = { samplesProcessed: 0, totalTime: 0, peakTime: 0, processCount: 0 };
        if (this.isInitialized && !this.isFallback && this.wasmExports.unifiedmixerprocessor_reset) {
            this.wasmExports.unifiedmixerprocessor_reset(this.processorPtr);
        }
    }

    sendStats() {
        const avgTime = this.stats.processCount > 0 ? this.stats.totalTime / this.stats.processCount : 0;
        this.port.postMessage({
            type: 'stats', data: {
                samplesProcessed: this.stats.samplesProcessed, averageTime: avgTime,
                peakTime: this.stats.peakTime, processCount: this.stats.processCount
            }
        });
    }

    process(inputs, outputs, parameters) {
        if (!this.isInitialized || !this.wasmProcessor) {
            return true;
        }

        const output = outputs[0];
        // Safety check for empty outputs
        if (!output || output.length === 0) return true;

        const blockSize = output[0].length;

        // 🔧 SYNC: Copy JS SAB -> Wasm Memory (Commands)
        if (this.sharedStateView && this.statePtr) {
            const wasmMem = new Float32Array(wasmModuleCache.memory.buffer);
            wasmMem.set(this.sharedStateView, this.statePtr / 4);
        }

        // 1. Prepare Inputs (Interleave directly into WASM memory)
        let wasmFloat32 = new Float32Array(wasmModuleCache.memory.buffer);

        // Safety check: ensure memory hasn't grown/invalidated pointers (rare in Worklet, but good practice)
        // If we needed to handle resize, we'd check offsets. For now assumes fixed.

        let inputOffset = this.inputPtr / 4;
        let ptr = 0;

        for (let s = 0; s < blockSize; s++) {
            for (let c = 0; c < this.numChannels; c++) {
                let l = 0, r = 0;
                if (c < inputs.length && inputs[c].length > 0) {
                    const chData = inputs[c];
                    l = chData[0][s] || 0;
                    if (chData.length > 1) r = chData[1][s] || 0;
                    else r = l;
                }
                wasmFloat32[inputOffset + ptr++] = l;
                wasmFloat32[inputOffset + ptr++] = r;
            }
        }

        // 2. Process (Wasm or Fallback)
        if (this.isFallback) {
            // Fallback needs a JS array
            // We can read back from wasmFloat32 or just use the old logic if fallback is active.
            // For simplicity, if fallback, we should probably just use the old logic.
            // But let's assume WASM mode is primary.

            // If fallback, we need to populate interleavedInputs (JS array)
            // Rerunning the loop for fallback is expensive but safe.
            ptr = 0;
            for (let s = 0; s < blockSize; s++) {
                for (let c = 0; c < this.numChannels; c++) {
                    let l = 0, r = 0;
                    if (c < inputs.length && inputs[c].length > 0) {
                        const chData = inputs[c];
                        l = chData[0][s] || 0;
                        if (chData.length > 1) r = chData[1][s] || 0;
                        else r = l;
                    }
                    this.interleavedInputs[ptr++] = l;
                    this.interleavedInputs[ptr++] = r;
                }
            }

            this.fallbackProcessor.process_mix(
                this.interleavedInputs,
                this.outputL,
                this.outputR,
                blockSize,
                this.numChannels
            );
        } else if (this.wasmExports && this.wasmExports.unifiedmixerprocessor_process_mix) {
            // Rust: processor.process_mix(interleaved_ptr, input_len, out_l_ptr, out_r_ptr, block_size)
            this.wasmExports.unifiedmixerprocessor_process_mix(
                this.processorPtr,
                this.inputPtr,
                blockSize * this.numChannels * 2, // input_len (total samples)
                this.outputLPtr,
                this.outputRPtr,
                blockSize
            );
        }

        // 3. Copy Output
        if (this.isFallback) {
            output[0].set(this.outputL.subarray(0, blockSize));
            if (output.length > 1) output[1].set(this.outputR.subarray(0, blockSize));
        } else {
            // Read from WASM memory
            // create views on fresh buffer in case of growth
            wasmFloat32 = new Float32Array(wasmModuleCache.memory.buffer);
            const outL = wasmFloat32.subarray(this.outputLPtr / 4, (this.outputLPtr / 4) + blockSize);
            const outR = wasmFloat32.subarray(this.outputRPtr / 4, (this.outputRPtr / 4) + blockSize);

            output[0].set(outL);
            if (output.length > 1) output[1].set(outR);
        }

        // 🔧 SYNC: Copy Wasm Memory -> JS SAB (Position)
        if (this.sharedStateView && this.statePtr) {
            const currentWasmMem = new Float32Array(wasmModuleCache.memory.buffer);
            const wasmState = currentWasmMem.subarray(this.statePtr / 4, (this.statePtr / 4) + 32);
            this.sharedStateView.set(wasmState);
        }

        // Stats
        this.stats.samplesProcessed += blockSize;
        this.stats.processCount++;

        // Metering Polling (~60Hz)
        if (this.wasmProcessor.levelsPtr) {
            this.framesSinceLastMeter++;
            if (this.framesSinceLastMeter >= 5) {
                this.framesSinceLastMeter = 0;

                if (this.wasmExports && this.wasmExports.unifiedmixerprocessor_get_channel_levels) {
                    this.wasmExports.unifiedmixerprocessor_get_channel_levels(
                        this.processorPtr,
                        this.levelsPtr,
                        this.numChannels * 2
                    );
                }

                if (wasmModuleCache.memory) {
                    const levelsView = new Float32Array(wasmModuleCache.memory.buffer, this.wasmProcessor.levelsPtr, this.numChannels * 2);
                    const levelsCopy = new Float32Array(levelsView);
                    this.port.postMessage({ type: 'set-levels', levels: levelsCopy });
                }
            }
        }

        return true;
    }
}

registerProcessor('unified-mixer-worklet', UnifiedMixerWorklet);
