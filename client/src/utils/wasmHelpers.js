/**
 * WASM Audio Backend Helpers
 *
 * Provides utilities for testing and switching to WASM audio backend
 */

import { AudioProcessorFactory } from '../lib/audio-backends/AudioProcessorFactory.js';

class WasmHelpers {
    constructor() {
        this.wasmBackend = null;
        this.jsBackend = null;
    }

    /**
     * Test WASM backend availability
     */
    async testWasmAvailability() {
        console.log('🔬 Testing WASM backend availability...');

        try {
            const dynamicImport = new Function('path', 'return import(path)');
            const wasmModule = await dynamicImport('/wasm/dawg_audio_dsp.js');
            await wasmModule.default();

            console.log('✅ WASM backend is available');
            return true;
        } catch (error) {
            console.warn('⚠️ WASM backend not available:', error.message);
            return false;
        }
    }

    /**
     * Run quick performance benchmark
     */
    async quickBenchmark() {
        console.log('🏁 Running quick benchmark...\n');

        try {
            const results = await AudioProcessorFactory.benchmarkAllBackends(48000);

            console.log('📊 Benchmark Results:');
            console.table(results);

            const jsResult = results.find(r => r.backend === 'javascript');
            const wasmResult = results.find(r => r.backend === 'wasm');

            if (jsResult && wasmResult) {
                const speedup = (jsResult.time / wasmResult.time).toFixed(2);
                console.log(`\n🚀 WASM is ${speedup}x faster than JavaScript!`);
                console.log(`💡 CPU savings: ${((jsResult.time - wasmResult.time) / jsResult.time * 100).toFixed(1)}%`);
            }

            return results;
        } catch (error) {
            console.error('❌ Benchmark failed:', error);
            return null;
        }
    }

    /**
     * Create WASM backend instance for testing
     */
    async createWasmBackend(sampleRate = 48000) {
        console.log(`🔧 Creating WASM backend (${sampleRate}Hz)...`);

        try {
            this.wasmBackend = await AudioProcessorFactory.createBackend('wasm', sampleRate);
            console.log('✅ WASM backend created:', this.wasmBackend);
            return this.wasmBackend;
        } catch (error) {
            console.error('❌ Failed to create WASM backend:', error);
            return null;
        }
    }

    /**
     * Create JavaScript backend for comparison
     */
    async createJsBackend(sampleRate = 48000) {
        console.log(`🔧 Creating JavaScript backend (${sampleRate}Hz)...`);

        try {
            this.jsBackend = await AudioProcessorFactory.createBackend('javascript', sampleRate);
            console.log('✅ JavaScript backend created:', this.jsBackend);
            return this.jsBackend;
        } catch (error) {
            console.error('❌ Failed to create JavaScript backend:', error);
            return null;
        }
    }

    /**
     * Compare processing speed side-by-side
     */
    async compareBackends(blockSize = 128, iterations = 1000) {
        console.log(`🔬 Comparing backends (${iterations} iterations, ${blockSize} samples/block)...\n`);

        if (!this.jsBackend) {
            await this.createJsBackend();
        }
        if (!this.wasmBackend) {
            await this.createWasmBackend();
        }

        const inputL = new Float32Array(blockSize);
        const inputR = new Float32Array(blockSize);
        const outputL = new Float32Array(blockSize);
        const outputR = new Float32Array(blockSize);

        // Fill test signal
        for (let i = 0; i < blockSize; i++) {
            inputL[i] = Math.sin(2 * Math.PI * 440 * i / 48000);
            inputR[i] = inputL[i];
        }

        const params = {
            eqActive: true,
            compActive: true,
            gain: 0.8,
            threshold: -10,
            ratio: 4
        };

        // JavaScript
        console.log('📊 JavaScript Backend...');
        const jsStart = performance.now();
        for (let i = 0; i < iterations; i++) {
            this.jsBackend.processBuffer(inputL, inputR, outputL, outputR, params);
        }
        const jsTime = performance.now() - jsStart;
        console.log(`   Total: ${jsTime.toFixed(2)}ms`);
        console.log(`   Per block: ${(jsTime/iterations).toFixed(3)}ms`);

        // WASM
        console.log('\n⚡ WASM Backend...');
        const wasmStart = performance.now();
        for (let i = 0; i < iterations; i++) {
            this.wasmBackend.wasmProcessor.process_buffer(
                inputL, inputR, outputL, outputR,
                true, true, 0.8, -10, 4
            );
        }
        const wasmTime = performance.now() - wasmStart;
        console.log(`   Total: ${wasmTime.toFixed(2)}ms`);
        console.log(`   Per block: ${(wasmTime/iterations).toFixed(3)}ms`);

        // Results
        const speedup = (jsTime / wasmTime).toFixed(2);
        const improvement = ((jsTime - wasmTime) / jsTime * 100).toFixed(1);

        console.log('\n' + '='.repeat(50));
        console.log('🏆 RESULTS:');
        console.log('='.repeat(50));
        console.log(`JavaScript: ${jsTime.toFixed(2)}ms`);
        console.log(`WASM:       ${wasmTime.toFixed(2)}ms`);
        console.log(`\n🚀 WASM is ${speedup}x FASTER!`);
        console.log(`💡 Performance improvement: ${improvement}%`);
        console.log('='.repeat(50));

        return { jsTime, wasmTime, speedup, improvement };
    }

    /**
     * Get backend info
     */
    getInfo() {
        console.log('📋 WASM Backend Information:');
        console.log('================================');
        console.log('WASM Files: /wasm/dawg_audio_dsp.js, dawg_audio_dsp_bg.wasm');
        console.log('Rust Version: 1.90.0');
        console.log('wasm-pack: 0.13.1');
        console.log('Build: Optimized (opt-level=3, LTO enabled)');
        console.log('Features: Biquad Filters, 3-Band EQ, Compression');
        console.log('Expected Speedup: 2-5x depending on buffer size');
        console.log('================================');
        console.log('\nAvailable commands:');
        console.log('  window.wasm.testWasmAvailability() - Check if WASM is available');
        console.log('  window.wasm.quickBenchmark()       - Run quick benchmark');
        console.log('  window.wasm.compareBackends()      - Detailed comparison');
        console.log('  window.wasm.createWasmBackend()    - Create WASM backend');
        console.log('  window.wasm.createJsBackend()      - Create JS backend');
    }
}

// Create global instance
const wasmHelpers = new WasmHelpers();

// Expose to window
if (typeof window !== 'undefined') {
    window.wasm = wasmHelpers;
    console.log('⚡ WASM helpers loaded! Try: window.wasm.quickBenchmark()');
}

export default wasmHelpers;
