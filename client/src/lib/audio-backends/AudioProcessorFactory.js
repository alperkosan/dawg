/**
 * Audio Processor Factory
 *
 * Automatically selects and initializes the best available audio backend:
 * 1. Try Native Extension (if installed) - 10-20x performance
 * 2. Try WebAssembly (if available) - 4-5x performance
 * 3. Fallback to JavaScript - baseline performance
 */

import { JavaScriptBackend } from './JavaScriptBackend.js';
import { WasmBackend } from './WasmBackend.js';
import { BackendType } from './AudioProcessorBackend.js';

export class AudioProcessorFactory {
    /**
     * Create the best available audio backend
     * @param {string|null} preferredType - Preferred backend type (or null for auto-detect)
     * @param {number} sampleRate - Sample rate in Hz
     * @returns {Promise<AudioProcessorBackend>}
     */
    static async createBackend(preferredType = null, sampleRate = 48000) {
        console.log('🔍 Detecting best audio backend...');

        // Auto-detect if no preference specified
        if (!preferredType) {
            preferredType = await AudioProcessorFactory.detectBestBackend();
            console.log(`📊 Auto-detected backend: ${preferredType}`);
        }

        let backend = null;

        // Try backends in order of preference, falling back if initialization fails
        switch (preferredType) {
            case BackendType.NATIVE:
                try {
                    // TODO: Implement NativeBackend in Phase 4
                    // backend = new NativeBackend(sampleRate);
                    // await backend.initialize();
                    // console.log('🔥 Using NATIVE audio backend (15x performance)');
                    // return backend;
                    throw new Error('Native backend not yet implemented');
                } catch (error) {
                    console.warn('⚠️ Native backend unavailable, falling back to WASM');
                    preferredType = BackendType.WASM;
                }
                // Fallthrough to WASM

            case BackendType.WASM:
                try {
                    backend = new WasmBackend(sampleRate);
                    await backend.initialize();
                    console.log('⚡ Using WASM audio backend (4.5x performance)');
                    return backend;
                } catch (error) {
                    console.warn('⚠️ WASM backend unavailable:', error.message);
                    console.warn('⚠️ Falling back to JavaScript backend');
                    preferredType = BackendType.JAVASCRIPT;
                }
                // Fallthrough to JavaScript

            case BackendType.JAVASCRIPT:
            default:
                backend = new JavaScriptBackend(sampleRate);
                await backend.initialize();
                console.log('📦 Using JavaScript audio backend (baseline performance)');
                return backend;
        }
    }

    /**
     * Auto-detect the best available backend
     * @returns {Promise<string>} - Backend type
     */
    static async detectBestBackend() {
        // 1. Check for Native Extension (Phase 4 - not yet implemented)
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            try {
                // Test native connection
                // const port = chrome.runtime.connectNative('com.dawg.audio_host');
                // port.disconnect();
                // return BackendType.NATIVE;
            } catch (e) {
                // Native not available
            }
        }

        // 2. Check for WebAssembly support
        if (typeof WebAssembly !== 'undefined') {
            try {
                // Test basic WASM instantiation
                await WebAssembly.instantiate(
                    new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])
                );

                // Check for SIMD support (optional, but desired)
                const simdSupported = typeof WebAssembly.validate === 'function' &&
                    WebAssembly.validate(new Uint8Array([
                        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0
                    ]));

                if (simdSupported) {
                    console.log('✅ WASM with SIMD support detected');
                } else {
                    console.log('✅ WASM detected (no SIMD)');
                }

                // WASM is available, but our module isn't ready yet
                // For now, return JavaScript until WASM is implemented
                // return BackendType.WASM; // Uncomment when WASM is ready
            } catch (e) {
                console.warn('⚠️ WASM detection failed:', e);
            }
        }

        // 3. Fallback to JavaScript
        return BackendType.JAVASCRIPT;
    }

    /**
     * Benchmark all available backends
     * @param {number} sampleRate - Sample rate
     * @returns {Promise<Array>} - Array of benchmark results
     */
    static async benchmarkAllBackends(sampleRate = 48000) {
        console.log('🔬 Starting audio backend benchmark...');
        const results = [];

        // Test JavaScript
        try {
            const jsBackend = new JavaScriptBackend(sampleRate);
            await jsBackend.initialize();
            const jsTime = await AudioProcessorFactory.benchmarkBackend(jsBackend, 'JavaScript');
            results.push({
                type: BackendType.JAVASCRIPT,
                time: jsTime,
                speedup: 1.0
            });
            jsBackend.cleanup();
        } catch (e) {
            console.error('❌ JavaScript benchmark failed:', e);
        }

        // Test WASM (if available)
        try {
            const wasmBackend = new WasmBackend(sampleRate);
            await wasmBackend.initialize();
            const wasmTime = await AudioProcessorFactory.benchmarkBackend(wasmBackend, 'WASM');
            const jsTime = results.find(r => r.type === BackendType.JAVASCRIPT)?.time || wasmTime;
            results.push({
                type: BackendType.WASM,
                time: wasmTime,
                speedup: jsTime / wasmTime
            });
            wasmBackend.cleanup();
        } catch (e) {
            console.warn('⚠️ WASM benchmark skipped:', e.message);
        }

        // Test Native (Phase 4 - not yet implemented)
        // ...

        console.log('✅ Benchmark complete:', results);
        return results;
    }

    /**
     * Benchmark a single backend
     * @param {AudioProcessorBackend} backend - Backend to benchmark
     * @param {string} name - Backend name for logging
     * @returns {Promise<number>} - Total processing time in ms
     */
    static async benchmarkBackend(backend, name) {
        const blockSize = 128;
        const iterations = 1000; // 1000 blocks
        const sampleRate = backend.sampleRate || 48000;

        // Create test buffers
        const inputL = new Float32Array(blockSize);
        const inputR = new Float32Array(blockSize);
        const outputL = new Float32Array(blockSize);
        const outputR = new Float32Array(blockSize);

        // Fill with test signal (440Hz sine wave)
        for (let i = 0; i < blockSize; i++) {
            const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate);
            inputL[i] = sample;
            inputR[i] = sample;
        }

        // Test parameters (realistic settings)
        const params = {
            eqActive: true,
            compActive: true,
            gain: 0.8,
            pan: 0,
            mono: 0,
            lowGain: 1.2,
            midGain: 0.9,
            highGain: 1.1,
            lowFreq: 200,
            highFreq: 3000,
            threshold: -12,
            ratio: 4
        };

        // Update EQ coefficients before test
        backend.updateEQCoefficients(
            params.lowGain,
            params.midGain,
            params.highGain,
            params.lowFreq,
            params.highFreq
        );

        console.log(`🔬 Benchmarking ${name} backend (${iterations} blocks)...`);
        const startTime = performance.now();

        if (backend.getCapabilities().supportsBufferProcessing) {
            // Buffer processing
            for (let i = 0; i < iterations; i++) {
                backend.processBuffer(inputL, inputR, outputL, outputR, params);
            }
        } else {
            // Sample-by-sample processing
            for (let i = 0; i < iterations; i++) {
                for (let j = 0; j < blockSize; j++) {
                    const result = backend.processSample(inputL[j], inputR[j], params);
                    outputL[j] = result.left;
                    outputR[j] = result.right;
                }
            }
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        const avgTimePerBlock = totalTime / iterations;
        const idealBlockTime = (blockSize / sampleRate) * 1000; // 2.67ms @ 48kHz
        const cpuUsage = (avgTimePerBlock / idealBlockTime) * 100;

        console.log(`✅ ${name} benchmark complete:`);
        console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
        console.log(`   Avg per block: ${avgTimePerBlock.toFixed(4)}ms`);
        console.log(`   CPU usage: ${cpuUsage.toFixed(1)}%`);
        console.log(`   Max channels: ${Math.floor(idealBlockTime / avgTimePerBlock)}`);

        return totalTime;
    }

    /**
     * Get info about all available backends
     * @returns {Promise<Object>}
     */
    static async getAvailableBackends() {
        const available = {
            javascript: true,  // Always available
            wasm: false,
            native: false
        };

        // Check WASM
        if (typeof WebAssembly !== 'undefined') {
            try {
                const wasmBackend = new WasmBackend(48000);
                await wasmBackend.initialize();
                available.wasm = true;
                wasmBackend.cleanup();
            } catch (e) {
                // WASM module not loaded yet
            }
        }

        // Check Native (Phase 4)
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            // TODO: Test native connection
        }

        return available;
    }
}

// Export factory as default
export default AudioProcessorFactory;
