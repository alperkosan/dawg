/**
 * Audio Backend Demo & Testing
 *
 * This file demonstrates how to use the audio backend system
 * and provides utility functions for testing and benchmarking.
 *
 * Usage in browser console:
 * ```
 * import { runBackendDemo, benchmarkBackends } from '@/lib/audio-backends/demo';
 * await runBackendDemo();
 * ```
 */

import { AudioProcessorFactory, BackendType } from './index.js';

/**
 * Demo: Auto-select and test backend
 */
export async function runBackendDemo() {
    console.log('🎵 Audio Backend Demo');
    console.log('='.repeat(50));

    // 1. Detect available backends
    console.log('\n📊 Detecting available backends...');
    const available = await AudioProcessorFactory.getAvailableBackends();
    console.log('Available backends:', available);

    // 2. Create backend (auto-select)
    console.log('\n🔍 Creating backend (auto-select)...');
    const backend = await AudioProcessorFactory.createBackend(null, 48000);

    // 3. Show capabilities
    const caps = backend.getCapabilities();
    console.log('\n✅ Backend initialized:');
    console.log(`   Type: ${caps.type}`);
    console.log(`   Buffer processing: ${caps.supportsBufferProcessing}`);
    console.log(`   SIMD: ${caps.supportsSIMD}`);
    console.log(`   Multi-threading: ${caps.supportsMultiThreading}`);
    console.log(`   Max polyphony: ${caps.maxPolyphony}`);
    console.log(`   CPU efficiency: ${caps.cpuEfficiency}x`);

    // 4. Process test signal
    console.log('\n🎹 Processing test signal...');
    const blockSize = 128;
    const inputL = new Float32Array(blockSize);
    const inputR = new Float32Array(blockSize);
    const outputL = new Float32Array(blockSize);
    const outputR = new Float32Array(blockSize);

    // Generate 440Hz sine wave
    for (let i = 0; i < blockSize; i++) {
        const sample = Math.sin(2 * Math.PI * 440 * i / 48000);
        inputL[i] = sample * 0.5;
        inputR[i] = sample * 0.5;
    }

    // Test parameters
    const params = {
        eqActive: true,
        compActive: true,
        gain: 0.8,
        pan: 0,
        mono: 0,
        lowGain: 1.2,
        midGain: 1.0,
        highGain: 1.1,
        lowFreq: 200,
        highFreq: 3000,
        threshold: -12,
        ratio: 4
    };

    // Update EQ coefficients
    backend.updateEQCoefficients(
        params.lowGain,
        params.midGain,
        params.highGain,
        params.lowFreq,
        params.highFreq
    );

    // Process 100 blocks
    const startTime = performance.now();
    for (let i = 0; i < 100; i++) {
        backend.processBuffer(inputL, inputR, outputL, outputR, params);
    }
    const endTime = performance.now();

    console.log(`   Processed 100 blocks in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`   Average per block: ${((endTime - startTime) / 100).toFixed(4)}ms`);

    // 5. Show statistics
    const stats = backend.getStats();
    console.log('\n📈 Processing statistics:');
    console.log(`   Samples processed: ${stats.samplesProcessed}`);
    console.log(`   Average time: ${stats.averageProcessingTime.toFixed(4)}ms`);
    console.log(`   Peak time: ${stats.peakProcessingTime.toFixed(4)}ms`);
    console.log(`   CPU usage: ${stats.cpuUsage.toFixed(1)}%`);

    // 6. Cleanup
    backend.cleanup();
    console.log('\n✅ Demo complete!');
}

/**
 * Benchmark all available backends
 */
export async function benchmarkBackends() {
    console.log('🔬 Benchmarking Audio Backends');
    console.log('='.repeat(50));

    const results = await AudioProcessorFactory.benchmarkAllBackends(48000);

    console.log('\n📊 Benchmark Results:');
    console.log('─'.repeat(50));

    const baseline = results.find(r => r.type === BackendType.JAVASCRIPT)?.time || 0;

    results.forEach(result => {
        const speedup = baseline > 0 ? baseline / result.time : 1.0;
        const bar = '█'.repeat(Math.round(speedup * 10));

        console.log(`${result.type.padEnd(12)} ${result.time.toFixed(2)}ms  ${speedup.toFixed(2)}x  ${bar}`);
    });

    console.log('─'.repeat(50));
    console.log('✅ Benchmark complete!');

    return results;
}

/**
 * Test backend switching
 */
export async function testBackendSwitching() {
    console.log('🔄 Testing Backend Switching');
    console.log('='.repeat(50));

    const backends = [
        BackendType.JAVASCRIPT,
        BackendType.WASM,
        BackendType.NATIVE
    ];

    for (const type of backends) {
        console.log(`\n📦 Testing ${type} backend...`);

        try {
            const backend = await AudioProcessorFactory.createBackend(type, 48000);
            const caps = backend.getCapabilities();

            console.log(`   ✅ ${type} backend initialized`);
            console.log(`   CPU efficiency: ${caps.cpuEfficiency}x`);

            backend.cleanup();
        } catch (error) {
            console.log(`   ❌ ${type} backend not available: ${error.message}`);
        }
    }

    console.log('\n✅ Switching test complete!');
}

/**
 * Stress test: Process many channels
 */
export async function stressTest(numChannels = 20) {
    console.log(`🔥 Stress Test: ${numChannels} Channels`);
    console.log('='.repeat(50));

    const backend = await AudioProcessorFactory.createBackend();
    const caps = backend.getCapabilities();

    console.log(`\n📦 Using ${caps.type} backend (${caps.cpuEfficiency}x efficiency)`);

    const blockSize = 128;
    const iterations = 100;

    // Create buffers for all channels
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push({
            inputL: new Float32Array(blockSize),
            inputR: new Float32Array(blockSize),
            outputL: new Float32Array(blockSize),
            outputR: new Float32Array(blockSize)
        });

        // Fill with random signal
        for (let j = 0; j < blockSize; j++) {
            channels[i].inputL[j] = (Math.random() - 0.5) * 0.5;
            channels[i].inputR[j] = (Math.random() - 0.5) * 0.5;
        }
    }

    const params = {
        eqActive: true,
        compActive: true,
        gain: 0.8,
        pan: 0,
        mono: 0,
        lowGain: 1.1,
        midGain: 1.0,
        highGain: 1.05,
        lowFreq: 200,
        highFreq: 3000,
        threshold: -12,
        ratio: 4
    };

    backend.updateEQCoefficients(
        params.lowGain,
        params.midGain,
        params.highGain,
        params.lowFreq,
        params.highFreq
    );

    console.log(`\n🎹 Processing ${numChannels} channels × ${iterations} blocks...`);

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const channel = channels[ch];
            backend.processBuffer(
                channel.inputL,
                channel.inputR,
                channel.outputL,
                channel.outputR,
                params
            );
        }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerBlock = totalTime / iterations;
    const idealBlockTime = (blockSize / 48000) * 1000; // 2.67ms @ 48kHz
    const cpuUsage = (avgTimePerBlock / idealBlockTime) * 100;

    console.log('\n📊 Results:');
    console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`   Avg per block: ${avgTimePerBlock.toFixed(4)}ms`);
    console.log(`   Ideal block time: ${idealBlockTime.toFixed(4)}ms`);
    console.log(`   CPU usage: ${cpuUsage.toFixed(1)}%`);

    if (cpuUsage < 100) {
        console.log(`   ✅ PASS - CPU usage within limits`);
    } else {
        console.log(`   ❌ FAIL - CPU overflow (${cpuUsage.toFixed(1)}%)`);
    }

    backend.cleanup();
    console.log('\n✅ Stress test complete!');

    return {
        numChannels,
        totalTime,
        avgTimePerBlock,
        cpuUsage,
        passed: cpuUsage < 100
    };
}

/**
 * Compare backends side-by-side
 */
export async function compareBackends() {
    console.log('⚖️  Backend Comparison');
    console.log('='.repeat(50));

    const results = await AudioProcessorFactory.benchmarkAllBackends(48000);

    console.log('\n📊 Comparison Table:');
    console.log('─'.repeat(80));
    console.log('Backend      Time (ms)   Speedup   CPU Eff   SIMD   Buffer   Max Poly');
    console.log('─'.repeat(80));

    for (const result of results) {
        try {
            const backend = await AudioProcessorFactory.createBackend(result.type, 48000);
            const caps = backend.getCapabilities();

            console.log(
                `${result.type.padEnd(12)} ` +
                `${result.time.toFixed(2).padEnd(10)} ` +
                `${result.speedup.toFixed(2)}x     ` +
                `${caps.cpuEfficiency.toFixed(1)}x     ` +
                `${caps.supportsSIMD ? '✅' : '❌'}    ` +
                `${caps.supportsBufferProcessing ? '✅' : '❌'}      ` +
                `${caps.maxPolyphony}`
            );

            backend.cleanup();
        } catch (e) {
            console.log(`${result.type.padEnd(12)} Not available`);
        }
    }

    console.log('─'.repeat(80));
    console.log('✅ Comparison complete!');
}

// Export all demo functions
export default {
    runBackendDemo,
    benchmarkBackends,
    testBackendSwitching,
    stressTest,
    compareBackends
};

// Make available in browser console
if (typeof window !== 'undefined') {
    window.audioBackendDemo = {
        runDemo: runBackendDemo,
        benchmark: benchmarkBackends,
        testSwitching: testBackendSwitching,
        stressTest: stressTest,
        compare: compareBackends
    };

    console.log('💡 Audio Backend Demo loaded!');
    console.log('   Usage: window.audioBackendDemo.runDemo()');
    console.log('   Usage: window.audioBackendDemo.benchmark()');
    console.log('   Usage: window.audioBackendDemo.compare()');
    console.log('   Usage: window.audioBackendDemo.stressTest(20)');
}
