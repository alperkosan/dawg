/**
 * UnifiedMixerWorklet - WASM-Powered MegaMixer
 * Uses fetch + WebAssembly.instantiate for maximum compatibility
 */

// Global WASM module reference (loaded once, shared across instances)
let wasmModuleCache = null;
let wasmLoadingPromise = null;

class UnifiedMixerWorklet extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.numChannels = options.processorOptions?.numChannels || 32;
        this.sampleRate = sampleRate;
        this.wasmProcessor = null;
        this.isInitialized = false;
        this.interleavedInputs = new Float32Array(128 * this.numChannels * 2);
        this.outputL = new Float32Array(128);
        this.outputR = new Float32Array(128);
        this.stats = { samplesProcessed: 0, totalTime: 0, peakTime: 0, processCount: 0 };
        this.port.onmessage = this.handleMessage.bind(this);
        console.log(`🚀 UnifiedMixerWorklet initialized: ${this.numChannels} channels @ ${this.sampleRate}Hz`);
    }

    handleMessage(event) {
        const { type, data } = event.data;
        switch (type) {
            case 'init-wasm': this.initializeWasm(data.wasmArrayBuffer); break;
            case 'set-channel-params': this.updateChannelParams(data); break;
            case 'set-channel-eq': this.updateChannelEQ(data); break;
            case 'reset': this.reset(); break;
            case 'get-stats': this.sendStats(); break;
        }
    }

    async initializeWasm(wasmArrayBuffer) {
        try {
            console.log('⏳ Loading WASM in AudioWorklet...');

            // Load WASM from ArrayBuffer passed from main thread
            if (!wasmModuleCache) {
                if (!wasmLoadingPromise) {
                    wasmLoadingPromise = (async () => {
                        // Create imports matching wasm-bindgen structure
                        // Based on __wbg_get_imports() from dawg_audio_dsp.js
                        const imports = {
                            wbg: {
                                __wbg_wbindgencopytotypedarray_d105febdb9374ca3: (arg0, arg1, arg2) => {
                                    // Copy typed array stub (not used in our case)
                                },
                                __wbg_wbindgenthrow_451ec1a8469d7eb6: (arg0, arg1) => {
                                    // Throw error stub
                                    throw new Error('WASM error');
                                },
                                __wbindgen_init_externref_table: () => {
                                    // Externref table initialization (not needed in worklet)
                                }
                            }
                        };

                        // Instantiate WASM from ArrayBuffer
                        const wasmModule = await WebAssembly.instantiate(wasmArrayBuffer, imports);
                        wasmModuleCache = wasmModule.instance.exports;

                        console.log('✅ WASM binary loaded in worklet');
                        return wasmModuleCache;
                    })();
                }
                await wasmLoadingPromise;
            }
            
            // Create UnifiedMixerProcessor instance
            // wasm-bindgen pattern: unifiedmixerprocessor_new (not __wbg_...)
            const constructorFunc = wasmModuleCache.unifiedmixerprocessor_new;

            if (!constructorFunc) {
                console.error('Available WASM exports:', Object.keys(wasmModuleCache));
                throw new Error('UnifiedMixerProcessor constructor not found in WASM exports');
            }

            const processorPtr = constructorFunc(this.sampleRate, this.numChannels);
            console.log(`✅ UnifiedMixerProcessor created: ptr=${processorPtr}`);

            // Create wrapper that mimics wasm-bindgen class
            this.wasmProcessor = {
                ptr: processorPtr,

                process_mix: (interleavedInputs, outputL, outputR, blockSize, numChannels) => {
                    try {
                        // Helper to pass Float32Array to WASM (mimics passArrayF32ToWasm0)
                        let WASM_VECTOR_LEN = 0;
                        const passArrayF32ToWasm = (arr) => {
                            const ptr = wasmModuleCache.__wbindgen_malloc(arr.length * 4, 4) >>> 0;
                            const wasmMem = new Float32Array(wasmModuleCache.memory.buffer);
                            wasmMem.set(arr, ptr / 4);
                            WASM_VECTOR_LEN = arr.length;
                            return ptr;
                        };

                        // Pass arrays to WASM using the helper
                        const ptr0 = passArrayF32ToWasm(interleavedInputs);
                        const len0 = WASM_VECTOR_LEN;

                        const ptr1 = passArrayF32ToWasm(outputL);
                        const len1 = WASM_VECTOR_LEN;

                        const ptr2 = passArrayF32ToWasm(outputR);
                        const len2 = WASM_VECTOR_LEN;

                        // Call WASM function with correct wasm-bindgen signature (11 params!)
                        // Signature: (ptr, input_ptr, input_len, outL_ptr, outL_len, outL_buf, outR_ptr, outR_len, outR_buf, blockSize, numChannels)
                        const processFunc = wasmModuleCache.unifiedmixerprocessor_process_mix;
                        if (!processFunc) {
                            throw new Error('process_mix function not found');
                        }

                        processFunc(
                            processorPtr,           // this.__wbg_ptr
                            ptr0, len0,            // input: pointer + length
                            ptr1, len1, outputL,   // output_l: pointer + length + buffer object
                            ptr2, len2, outputR,   // output_r: pointer + length + buffer object
                            blockSize,             // block_size
                            numChannels            // num_channels
                        );

                        // Copy output from WASM memory back to our buffers
                        const wasmMemory = new Float32Array(wasmModuleCache.memory.buffer);
                        outputL.set(wasmMemory.subarray(ptr1 / 4, ptr1 / 4 + blockSize));
                        outputR.set(wasmMemory.subarray(ptr2 / 4, ptr2 / 4 + blockSize));

                        // DEBUG: Uncomment to check output signal
                        // const hasSignal = outputL.some(v => Math.abs(v) > 0.0001) || outputR.some(v => Math.abs(v) > 0.0001);
                        // if (!hasSignal && Math.random() < 0.001) {
                        //     console.warn('⚠️ WASM output is silent!', 'L:', outputL.slice(0, 4), 'R:', outputR.slice(0, 4));
                        // }

                    } catch (error) {
                        console.error('❌ WASM process_mix error:', error);
                        // Zero output on error
                        outputL.fill(0);
                        outputR.fill(0);
                    }
                },

                set_channel_params: (idx, gain, pan, mute, solo, eqActive, compActive) => {
                    const func = wasmModuleCache.unifiedmixerprocessor_set_channel_params;
                    if (func) {
                        func(processorPtr, idx, gain, pan, mute ? 1 : 0, solo ? 1 : 0, eqActive ? 1 : 0, compActive ? 1 : 0);
                    }
                },

                set_channel_eq: (idx, lowGain, midGain, highGain, lowFreq, highFreq) => {
                    const func = wasmModuleCache.unifiedmixerprocessor_set_channel_eq;
                    if (func) {
                        func(processorPtr, idx, lowGain, midGain, highGain, lowFreq, highFreq);
                    }
                },

                reset: () => {
                    const func = wasmModuleCache.unifiedmixerprocessor_reset;
                    if (func) {
                        func(processorPtr);
                    }
                }
            };
            
            this.isInitialized = true;
            this.port.postMessage({ type: 'wasm-initialized', success: true });
            console.log('✅ WASM UnifiedMixerProcessor initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize WASM:', error);
            
            // Fallback: Use JavaScript implementation
            console.log('⚠️ Falling back to JavaScript implementation');
            this.wasmProcessor = this.createJavaScriptFallback();
            this.isInitialized = true;
            this.port.postMessage({ type: 'wasm-initialized', success: true, fallback: true });
        }
    }

    createJavaScriptFallback() {
        // Simple JavaScript mixer fallback
        return {
            process_mix: (inputBuf, outL, outR, blockSize, numCh) => {
                outL.fill(0);
                outR.fill(0);
                
                // Simple mix: sum all inputs
                for (let s = 0; s < blockSize; s++) {
                    for (let ch = 0; ch < numCh; ch++) {
                        const idx = s * numCh * 2 + ch * 2;
                        outL[s] += inputBuf[idx] * 0.1;     // Gain down to avoid clipping
                        outR[s] += inputBuf[idx + 1] * 0.1;
                    }
                }
            },
            set_channel_params: () => {},
            set_channel_eq: () => {},
            reset: () => {}
        };
    }

    updateChannelParams(data) {
        const { channelIdx } = data;
        if (this.isInitialized && channelIdx < this.numChannels) {
            const { gain, pan, mute, solo, eqActive, compActive } = data;
            this.wasmProcessor.set_channel_params?.(
                channelIdx, gain ?? 1.0, pan ?? 0.0, mute ?? false, 
                solo ?? false, eqActive ?? false, compActive ?? false
            );
        }
    }

    updateChannelEQ(data) {
        const { channelIdx, lowGain, midGain, highGain, lowFreq, highFreq } = data;
        if (this.isInitialized && channelIdx < this.numChannels) {
            this.wasmProcessor.set_channel_eq?.(channelIdx, lowGain, midGain, highGain, lowFreq, highFreq);
        }
    }

    reset() {
        if (this.isInitialized) this.wasmProcessor.reset?.();
        this.stats = { samplesProcessed: 0, totalTime: 0, peakTime: 0, processCount: 0 };
    }

    sendStats() {
        const avgTime = this.stats.processCount > 0 ? this.stats.totalTime / this.stats.processCount : 0;
        this.port.postMessage({ type: 'stats', data: {
            samplesProcessed: this.stats.samplesProcessed, averageTime: avgTime,
            peakTime: this.stats.peakTime, processCount: this.stats.processCount
        }});
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const blockSize = output[0].length;
        
        if (!this.isInitialized || !this.wasmProcessor) {
            output[0].fill(0);
            output[1].fill(0);
            return true;
        }
        
        const startTime = currentTime;
        
        // Interleave inputs
        let writeIdx = 0;
        let hasInputSignal = false;
        for (let sampleIdx = 0; sampleIdx < blockSize; sampleIdx++) {
            for (let channelIdx = 0; channelIdx < this.numChannels; channelIdx++) {
                if (inputs[channelIdx] && inputs[channelIdx].length >= 2) {
                    const l = inputs[channelIdx][0][sampleIdx] || 0.0;
                    const r = inputs[channelIdx][1][sampleIdx] || 0.0;
                    this.interleavedInputs[writeIdx++] = l;
                    this.interleavedInputs[writeIdx++] = r;
                    if (Math.abs(l) > 0.0001 || Math.abs(r) > 0.0001) hasInputSignal = true;
                } else {
                    this.interleavedInputs[writeIdx++] = 0.0;
                    this.interleavedInputs[writeIdx++] = 0.0;
                }
            }
        }

        // DEBUG: Uncomment to check input signal
        // if (!hasInputSignal && Math.random() < 0.001) {
        //     console.warn('⚠️ No input signal! inputs.length:', inputs.length);
        // }
        
        // Process
        this.wasmProcessor.process_mix(this.interleavedInputs, this.outputL, this.outputR, blockSize, this.numChannels);
        
        // Copy output
        output[0].set(this.outputL.subarray(0, blockSize));
        output[1].set(this.outputR.subarray(0, blockSize));
        
        // Stats
        const processingTime = currentTime - startTime;
        this.stats.totalTime += processingTime;
        this.stats.peakTime = Math.max(this.stats.peakTime, processingTime);
        this.stats.processCount++;
        this.stats.samplesProcessed += blockSize;
        
        return true;
    }
}

registerProcessor('unified-mixer-worklet', UnifiedMixerWorklet);
