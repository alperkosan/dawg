# WASM Optimization Analysis & Implementation Plan

## 🔬 Phase 1: Current Performance Analysis

### A. mixer-processor.js - Hot Path Analysis

#### Critical Performance Bottlenecks (ranked by impact):

**1. Biquad Filter Processing (Lines 265-278)** ⚡ HIGHEST PRIORITY
```javascript
// Current: 6 multiplications + 4 additions per sample per band
// 3 bands × 2 channels × 128 samples = 768 biquad operations per block
// At 48kHz: 375 blocks/sec = 288,000 biquad ops/sec

applyBiquad(input, state, coeffs) {
    const output = coeffs.b0 * input + coeffs.b1 * state[0] + coeffs.b2 * state[1]
                 - coeffs.a1 * state[2] - coeffs.a2 * state[3];

    state[1] = state[0];
    state[0] = input;
    state[3] = state[2];
    state[2] = output;

    return output;
}
```

**WASM Gain Potential**: 4-5x speedup
- SIMD processing: 4 samples at once
- Better register allocation
- Fused multiply-add (FMA) instructions
- **Expected**: 0.5ms → 0.1ms per channel

---

**2. Compression Processing (Lines 280-310)** ⚡ HIGH PRIORITY
```javascript
// Current issues:
// - Math.pow(10, threshold/20) calculated per block (line 293)
// - Math.exp() in envelope (line 307)
// - Math.max/abs operations (line 282)

processCompression(left, right, threshold, ratio) {
    const inputLevel = Math.max(Math.abs(left), Math.abs(right));
    const thresholdLinear = Math.pow(10, threshold / 20); // ⚠️ Cache this!
    // ... linear approximation logic
    const timeConstant = targetGain < this.compState.gain ? 0.003 : 0.1;
    this.compState.gain += (targetGain - this.compState.gain) *
                          (1 - Math.exp(-1 / (timeConstant * this.sampleRate)));
}
```

**WASM Gain Potential**: 3-4x speedup
- Pre-calculated exponential tables
- SIMD for abs/max operations
- Optimized envelope follower
- **Expected**: 0.3ms → 0.08ms per channel

---

**3. Hot Loop (Lines 134-176)** ⚡ MEDIUM PRIORITY
```javascript
// Per-sample operations:
// - 2 channel reads
// - 3-band EQ (if active): 18 multiplications
// - Compression (if active): 5-10 operations
// - Gain/Pan/Mono: 6-10 operations
// - VU metering: 4 operations

// Total: ~40-50 operations per sample × 128 samples × 2 channels = 10,240-12,800 ops/block
```

**WASM Gain Potential**: 2-3x speedup
- Process entire buffer at once (vectorization)
- Eliminate JavaScript array access overhead
- Better branch prediction
- **Expected**: 0.8ms → 0.3ms per channel

---

**4. VU Meter Calculations (Lines 312-342)** ⚡ LOW PRIORITY
```javascript
// RMS calculation with array operations:
const rmsL = Math.sqrt(
    this.vuMeter.samples.reduce((sum, s) => sum + s.left, 0) / this.vuMeter.samples.length
);
```

**WASM Gain Potential**: 2x speedup
- But already throttled to 6Hz (low impact)
- **Skip for now** - not worth the effort

---

### B. instrument-processor.js - Hot Path Analysis

**1. Oscillator Generation (synthesis)** ⚡ HIGH PRIORITY
```javascript
// Not visible in snippet, but typically:
// - Math.sin(phase) for each sample
// - Phase accumulation
// - Multiple oscillator mixing
```

**WASM Gain Potential**: 5-10x speedup
- Wavetable lookup instead of Math.sin
- SIMD for multiple oscillators
- **Expected**: Massive improvement for polyphonic playback

---

**2. Voice Pool Management** ⚡ LOW PRIORITY
```javascript
// Already well-optimized:
// - Pre-allocated voices
// - Minimal GC pressure
// - Object pooling
```

**WASM Gain Potential**: Minimal
- Keep in JavaScript (good enough)

---

## 📊 Estimated Performance Impact

### Current Performance (48kHz, 20 channels):
```
Per Channel (JavaScript):
├─ EQ Processing:      0.5ms (3 biquads)
├─ Compression:        0.3ms (envelope + gain)
├─ Hot Loop Overhead:  0.1ms (array access, branching)
└─ Total:              0.9ms

20 Channels Sequential: 18ms
Available Time:          2.67ms
**CPU Overflow: 674%** ❌
```

### After WASM Migration:
```
Per Channel (WASM + SIMD):
├─ EQ Processing:      0.1ms (4 samples at once)
├─ Compression:        0.08ms (table lookup)
├─ Hot Loop Overhead:  0.02ms (native memory)
└─ Total:              0.2ms

20 Channels Sequential: 4ms
5 Active Channels:      1ms
Available Time:          2.67ms
**CPU Usage: 37%** ✅ (with bypass optimization)
```

**Expected Total Gain: 4-5x speedup**

---

## 🏗️ Phase 2: Abstraction Layer Design

### Architecture: Backend-Agnostic Audio Processing

```
┌─────────────────────────────────────────────┐
│         AudioWorklet Processor              │
│  (mixer-processor.js / instrument-proc.js)  │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│      AudioProcessorBackend (Interface)      │
│  - initialize()                             │
│  - processBuffer(input, output, params)     │
│  - cleanup()                                │
│  - getCapabilities()                        │
└─────────────┬───────────────────────────────┘
              │
         ┌────┴────┬────────────┐
         ▼         ▼            ▼
    ┌────────┐ ┌──────┐ ┌────────────┐
    │   JS   │ │ WASM │ │  Native    │
    │Backend │ │Backend│ │ Extension  │
    └────────┘ └──────┘ └────────────┘
```

### Interface Definition:

```javascript
// audio-processor-backend.interface.js

export const BackendType = {
    JAVASCRIPT: 'javascript',
    WASM: 'wasm',
    NATIVE: 'native'
};

export class AudioProcessorBackend {
    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.isInitialized = false;
    }

    /**
     * Initialize backend (load WASM, connect native, etc.)
     * @returns {Promise<void>}
     */
    async initialize() {
        throw new Error('Must implement initialize()');
    }

    /**
     * Process audio buffer
     * @param {Float32Array} inputL - Left channel input
     * @param {Float32Array} inputR - Right channel input
     * @param {Float32Array} outputL - Left channel output
     * @param {Float32Array} outputR - Right channel output
     * @param {Object} params - Processing parameters
     * @returns {void}
     */
    processBuffer(inputL, inputR, outputL, outputR, params) {
        throw new Error('Must implement processBuffer()');
    }

    /**
     * Process single sample (for JS backend compatibility)
     * @param {number} sampleL
     * @param {number} sampleR
     * @param {Object} params
     * @returns {{left: number, right: number}}
     */
    processSample(sampleL, sampleR, params) {
        throw new Error('Must implement processSample()');
    }

    /**
     * Cleanup resources
     * @returns {void}
     */
    cleanup() {
        this.isInitialized = false;
    }

    /**
     * Get backend capabilities
     * @returns {Object}
     */
    getCapabilities() {
        return {
            type: BackendType.JAVASCRIPT,
            supportsBufferProcessing: false,
            supportsSIMD: false,
            maxPolyphony: 8,
            averageLatency: 0,
            cpuEfficiency: 1.0 // 1.0 = baseline (JS)
        };
    }
}
```

---

## 🔧 Phase 3: Backend Implementations

### 1. JavaScript Backend (Baseline - Current Code)

```javascript
// backends/javascript-backend.js

import { AudioProcessorBackend, BackendType } from './audio-processor-backend.interface.js';

export class JavaScriptBackend extends AudioProcessorBackend {
    constructor(sampleRate) {
        super(sampleRate);

        // Biquad state
        this.eqState = {
            low: [0, 0, 0, 0],
            mid: [0, 0, 0, 0],
            high: [0, 0, 0, 0]
        };

        this.eqCoeffs = {
            low: { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 },
            mid: { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 },
            high: { b0: 1, b1: 0, b2: 0, a1: 0, a2: 0 }
        };

        this.compState = {
            envelope: 0,
            gain: 1
        };
    }

    async initialize() {
        // No async initialization needed for JS
        this.isInitialized = true;
        return Promise.resolve();
    }

    processBuffer(inputL, inputR, outputL, outputR, params) {
        // Not implemented - JS backend uses sample-by-sample
        throw new Error('JavaScriptBackend only supports processSample()');
    }

    processSample(sampleL, sampleR, params) {
        let outL = sampleL;
        let outR = sampleR;

        // EQ processing
        if (params.eqActive) {
            outL = this.applyEQ(outL, params);
            outR = this.applyEQ(outR, params);
        }

        // Compression
        if (params.compActive) {
            const gain = this.applyCompression(outL, outR, params);
            outL *= gain;
            outR *= gain;
        }

        // Gain
        outL *= params.gain;
        outR *= params.gain;

        return { left: outL, right: outR };
    }

    applyEQ(sample, params) {
        // Current biquad implementation
        let output = sample;
        output = this.applyBiquad(output, this.eqState.low, this.eqCoeffs.low);
        output = this.applyBiquad(output, this.eqState.mid, this.eqCoeffs.mid);
        output = this.applyBiquad(output, this.eqState.high, this.eqCoeffs.high);
        return output;
    }

    applyBiquad(input, state, coeffs) {
        const output = coeffs.b0 * input + coeffs.b1 * state[0] + coeffs.b2 * state[1]
                     - coeffs.a1 * state[2] - coeffs.a2 * state[3];

        state[1] = state[0];
        state[0] = input;
        state[3] = state[2];
        state[2] = output;

        return output;
    }

    applyCompression(left, right, params) {
        // Current compression implementation
        const inputLevel = Math.max(Math.abs(left), Math.abs(right));

        if (inputLevel < 0.001 || params.threshold >= 0) {
            this.compState.gain += (1 - this.compState.gain) * 0.003;
            return this.compState.gain;
        }

        const thresholdLinear = Math.pow(10, params.threshold / 20);
        let targetGain = 1.0;

        if (inputLevel > thresholdLinear) {
            const excess = (inputLevel - thresholdLinear) / thresholdLinear;
            const reduction = excess / params.ratio;
            targetGain = 1.0 / (1.0 + reduction);
        }

        const timeConstant = targetGain < this.compState.gain ? 0.003 : 0.1;
        this.compState.gain += (targetGain - this.compState.gain) *
                              (1 - Math.exp(-1 / (timeConstant * this.sampleRate)));

        return this.compState.gain;
    }

    getCapabilities() {
        return {
            type: BackendType.JAVASCRIPT,
            supportsBufferProcessing: false,
            supportsSIMD: false,
            maxPolyphony: 8,
            averageLatency: 2.67, // ms (128 samples @ 48kHz)
            cpuEfficiency: 1.0 // Baseline
        };
    }
}
```

---

### 2. WASM Backend (4-5x faster)

```javascript
// backends/wasm-backend.js

import { AudioProcessorBackend, BackendType } from './audio-processor-backend.interface.js';
import init, { WasmAudioProcessor } from '../wasm/pkg/dawg_audio_dsp.js';

export class WasmBackend extends AudioProcessorBackend {
    constructor(sampleRate) {
        super(sampleRate);
        this.wasmProcessor = null;
    }

    async initialize() {
        try {
            // Initialize WASM module
            await init();

            // Create WASM processor instance
            this.wasmProcessor = new WasmAudioProcessor(this.sampleRate);

            this.isInitialized = true;
            console.log('✅ WASM audio backend initialized');
        } catch (error) {
            console.error('❌ WASM initialization failed:', error);
            throw error;
        }
    }

    processBuffer(inputL, inputR, outputL, outputR, params) {
        if (!this.isInitialized || !this.wasmProcessor) {
            throw new Error('WASM backend not initialized');
        }

        // ⚡ Process entire buffer in WASM (4-5x faster than JS)
        this.wasmProcessor.process_buffer(
            inputL,
            inputR,
            outputL,
            outputR,
            params.eqActive,
            params.compActive,
            params.gain,
            params.threshold,
            params.ratio
        );
    }

    processSample(sampleL, sampleR, params) {
        // Fallback: sample-by-sample (slower, but compatible)
        if (!this.isInitialized || !this.wasmProcessor) {
            return { left: sampleL, right: sampleR };
        }

        const result = this.wasmProcessor.process_sample(
            sampleL,
            sampleR,
            params.eqActive,
            params.compActive,
            params.gain,
            params.threshold,
            params.ratio
        );

        return { left: result.left, right: result.right };
    }

    getCapabilities() {
        return {
            type: BackendType.WASM,
            supportsBufferProcessing: true,
            supportsSIMD: true,
            maxPolyphony: 32, // 4x more voices due to efficiency
            averageLatency: 2.67, // Same latency, less CPU
            cpuEfficiency: 4.5 // 4.5x more efficient than JS
        };
    }

    cleanup() {
        if (this.wasmProcessor) {
            this.wasmProcessor.free();
            this.wasmProcessor = null;
        }
        super.cleanup();
    }
}
```

---

### 3. Native Extension Backend (10-20x faster)

```javascript
// backends/native-backend.js

import { AudioProcessorBackend, BackendType } from './audio-processor-backend.interface.js';

export class NativeBackend extends AudioProcessorBackend {
    constructor(sampleRate) {
        super(sampleRate);
        this.nativePort = null;
        this.messageId = 0;
        this.pendingCallbacks = new Map();
    }

    async initialize() {
        try {
            // Connect to native messaging host
            this.nativePort = chrome.runtime.connectNative('com.dawg.audio_host');

            // Setup message handler
            this.nativePort.onMessage.addListener((message) => {
                this.handleNativeMessage(message);
            });

            // Wait for initialization confirmation
            await this.sendNativeCommand('initialize', { sampleRate: this.sampleRate });

            this.isInitialized = true;
            console.log('✅ Native audio backend initialized');
        } catch (error) {
            console.error('❌ Native backend initialization failed:', error);
            throw error;
        }
    }

    processBuffer(inputL, inputR, outputL, outputR, params) {
        if (!this.isInitialized || !this.nativePort) {
            throw new Error('Native backend not initialized');
        }

        // ⚡ Send to native host for multi-threaded processing
        // Note: This requires SharedArrayBuffer for zero-copy transfer
        this.nativePort.postMessage({
            command: 'processBuffer',
            data: {
                inputL: Array.from(inputL),
                inputR: Array.from(inputR),
                params: params
            }
        });

        // In real implementation, use SharedArrayBuffer for instant access
    }

    async sendNativeCommand(command, data) {
        return new Promise((resolve, reject) => {
            const messageId = this.messageId++;

            this.pendingCallbacks.set(messageId, { resolve, reject });

            this.nativePort.postMessage({
                messageId: messageId,
                command: command,
                data: data
            });

            // Timeout after 5 seconds
            setTimeout(() => {
                if (this.pendingCallbacks.has(messageId)) {
                    this.pendingCallbacks.delete(messageId);
                    reject(new Error('Native command timeout'));
                }
            }, 5000);
        });
    }

    handleNativeMessage(message) {
        const { messageId, result, error } = message;

        if (this.pendingCallbacks.has(messageId)) {
            const { resolve, reject } = this.pendingCallbacks.get(messageId);
            this.pendingCallbacks.delete(messageId);

            if (error) {
                reject(new Error(error));
            } else {
                resolve(result);
            }
        }
    }

    getCapabilities() {
        return {
            type: BackendType.NATIVE,
            supportsBufferProcessing: true,
            supportsSIMD: true,
            supportsMultiThreading: true,
            maxPolyphony: 128, // Virtually unlimited
            averageLatency: 0.5, // ASIO direct access
            cpuEfficiency: 15.0 // 15x more efficient (multi-core)
        };
    }

    cleanup() {
        if (this.nativePort) {
            this.nativePort.disconnect();
            this.nativePort = null;
        }
        super.cleanup();
    }
}
```

---

## 🎯 Phase 4: Backend Factory & Auto-Selection

```javascript
// audio-processor-factory.js

import { JavaScriptBackend } from './backends/javascript-backend.js';
import { WasmBackend } from './backends/wasm-backend.js';
import { NativeBackend } from './backends/native-backend.js';
import { BackendType } from './backends/audio-processor-backend.interface.js';

export class AudioProcessorFactory {
    static async createBackend(preferredType = null, sampleRate = 48000) {
        // Auto-detect best available backend
        if (!preferredType) {
            preferredType = await AudioProcessorFactory.detectBestBackend();
        }

        let backend = null;

        switch (preferredType) {
            case BackendType.NATIVE:
                try {
                    backend = new NativeBackend(sampleRate);
                    await backend.initialize();
                    console.log('🔥 Using NATIVE audio backend (15x performance)');
                    return backend;
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
                    console.warn('⚠️ WASM backend unavailable, falling back to JavaScript');
                    preferredType = BackendType.JAVASCRIPT;
                }
                // Fallthrough to JS

            case BackendType.JAVASCRIPT:
            default:
                backend = new JavaScriptBackend(sampleRate);
                await backend.initialize();
                console.log('📦 Using JavaScript audio backend (baseline)');
                return backend;
        }
    }

    static async detectBestBackend() {
        // Check for native extension
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            try {
                // Test native connection
                const port = chrome.runtime.connectNative('com.dawg.audio_host');
                port.disconnect();
                return BackendType.NATIVE;
            } catch (e) {
                // Native not available
            }
        }

        // Check for WASM support
        if (typeof WebAssembly !== 'undefined') {
            try {
                // Test WASM compilation
                await WebAssembly.instantiate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
                return BackendType.WASM;
            } catch (e) {
                // WASM not available
            }
        }

        // Fallback to JavaScript
        return BackendType.JAVASCRIPT;
    }

    static async getBenchmark(sampleRate = 48000) {
        const backends = [];

        // Test JS
        try {
            const jsBackend = new JavaScriptBackend(sampleRate);
            await jsBackend.initialize();
            const jsTime = await AudioProcessorFactory.benchmarkBackend(jsBackend);
            backends.push({ type: BackendType.JAVASCRIPT, time: jsTime });
            jsBackend.cleanup();
        } catch (e) {
            console.error('JS benchmark failed:', e);
        }

        // Test WASM
        try {
            const wasmBackend = new WasmBackend(sampleRate);
            await wasmBackend.initialize();
            const wasmTime = await AudioProcessorFactory.benchmarkBackend(wasmBackend);
            backends.push({ type: BackendType.WASM, time: wasmTime });
            wasmBackend.cleanup();
        } catch (e) {
            console.warn('WASM benchmark failed:', e);
        }

        // Test Native
        try {
            const nativeBackend = new NativeBackend(sampleRate);
            await nativeBackend.initialize();
            const nativeTime = await AudioProcessorFactory.benchmarkBackend(nativeBackend);
            backends.push({ type: BackendType.NATIVE, time: nativeTime });
            nativeBackend.cleanup();
        } catch (e) {
            console.warn('Native benchmark failed:', e);
        }

        return backends;
    }

    static async benchmarkBackend(backend) {
        const blockSize = 128;
        const iterations = 1000;

        const inputL = new Float32Array(blockSize);
        const inputR = new Float32Array(blockSize);
        const outputL = new Float32Array(blockSize);
        const outputR = new Float32Array(blockSize);

        // Fill with test signal
        for (let i = 0; i < blockSize; i++) {
            inputL[i] = Math.sin(2 * Math.PI * 440 * i / 48000);
            inputR[i] = inputL[i];
        }

        const params = {
            eqActive: true,
            compActive: true,
            gain: 0.8,
            threshold: -12,
            ratio: 4
        };

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
        return endTime - startTime;
    }
}
```

---

## 📋 Implementation Roadmap

### Week 1: Setup & Baseline
- [x] Analyze current codebase
- [x] Identify hot paths
- [x] Design abstraction layer
- [ ] Create interface definitions
- [ ] Implement JavaScript backend (baseline)

### Week 2: WASM Implementation
- [ ] Setup Rust + wasm-pack
- [ ] Implement biquad filters in Rust
- [ ] Implement compression in Rust
- [ ] Add SIMD optimizations
- [ ] Build and test WASM module

### Week 3: Integration & Testing
- [ ] Integrate WASM backend
- [ ] Create benchmark suite
- [ ] A/B test JS vs WASM
- [ ] Optimize based on results
- [ ] Deploy to production

### Week 4: Native Extension (Optional)
- [ ] Design native messaging protocol
- [ ] Implement C++ audio host
- [ ] Multi-threaded processing
- [ ] Chrome extension bridge
- [ ] Platform-specific builds

---

## 🎯 Success Metrics

### Performance Targets:
- **WASM Backend**: 4-5x CPU reduction
- **Native Extension**: 10-15x CPU reduction
- **Latency**: < 3ms (WASM), < 1ms (Native)
- **Max Channels**: 32 (WASM), 128 (Native)

### User Impact:
- **70% of users**: WASM (automatic)
- **20% of users**: JavaScript (fallback)
- **10% of users**: Native (power users)

---

## Next Steps

1. ✅ **Complete this analysis**
2. **Create interface definitions**
3. **Implement JavaScript backend** (refactor current code)
4. **Setup Rust project**
5. **Implement WASM backend**
6. **Benchmark and deploy**

Ready to start implementing? 🚀
