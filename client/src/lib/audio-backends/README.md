# Audio Processor Backends

Abstraction layer for audio processing with multiple backend implementations.

## 🎯 Overview

This module provides a **backend-agnostic** interface for audio processing, allowing seamless switching between different implementations:

| Backend | Performance | Status | Use Case |
|---------|-------------|--------|----------|
| **JavaScript** | 1.0x (baseline) | ✅ Ready | Fallback, compatibility |
| **WebAssembly** | 4-5x faster | 🚧 Coming Soon | Default for modern browsers |
| **Native Extension** | 10-20x faster | 📋 Planned | Power users, heavy projects |

## 📦 Installation

No installation needed - already integrated into the project.

## 🚀 Quick Start

### Basic Usage

```javascript
import { AudioProcessorFactory } from '@/lib/audio-backends';

// Auto-detect and initialize best backend
const backend = await AudioProcessorFactory.createBackend();

// Process audio buffer
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

backend.processBuffer(inputL, inputR, outputL, outputR, params);

// Get backend info
const caps = backend.getCapabilities();
console.log(`Backend: ${caps.type}`);
console.log(`CPU Efficiency: ${caps.cpuEfficiency}x`);
console.log(`SIMD Support: ${caps.supportsSIMD}`);
```

### Forcing a Specific Backend

```javascript
import { AudioProcessorFactory, BackendType } from '@/lib/audio-backends';

// Force JavaScript backend
const jsBackend = await AudioProcessorFactory.createBackend(
    BackendType.JAVASCRIPT,
    48000
);

// Force WASM backend (when available)
const wasmBackend = await AudioProcessorFactory.createBackend(
    BackendType.WASM,
    48000
);
```

### Benchmarking

```javascript
import { AudioProcessorFactory } from '@/lib/audio-backends';

// Benchmark all available backends
const results = await AudioProcessorFactory.benchmarkAllBackends(48000);

results.forEach(result => {
    console.log(`${result.type}: ${result.time.toFixed(2)}ms (${result.speedup.toFixed(2)}x)`);
});

// Example output:
// javascript: 850.25ms (1.00x)
// wasm: 189.12ms (4.50x)
// native: 56.78ms (14.98x)
```

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│    AudioWorklet Processor       │
│   (mixer-processor.js, etc.)    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  AudioProcessorBackend          │
│  (Abstract Interface)           │
│  - initialize()                 │
│  - processBuffer()              │
│  - processSample()              │
│  - getCapabilities()            │
└────────────┬────────────────────┘
             │
    ┌────────┴────────┬───────────┐
    ▼                 ▼           ▼
┌─────────┐    ┌──────────┐  ┌──────────┐
│   JS    │    │   WASM   │  │  Native  │
│ Backend │    │  Backend │  │ Extension│
│  1.0x   │    │  4-5x    │  │ 10-20x   │
└─────────┘    └──────────┘  └──────────┘
```

## 📊 Performance Comparison

### Current (JavaScript Only)

```
20 mixer channels × 0.9ms = 18ms per block
Available time: 2.67ms (128 samples @ 48kHz)
CPU overflow: 674%! ❌
```

### With WASM Backend

```
20 channels × 0.2ms = 4ms per block
5 active channels × 0.2ms = 1ms per block
Available time: 2.67ms
CPU usage: 37% ✅
```

### With Native Extension

```
20 channels / 8 threads = 2.5 channels per thread
2.5 × 0.1ms = 0.25ms per thread (parallel)
Total time: 0.25ms
CPU usage: 9% ✅✅✅
```

## 🔧 API Reference

### AudioProcessorBackend (Abstract Class)

Base class for all backend implementations.

#### Methods

##### `async initialize()`
Initialize the backend (load WASM, connect native extension, etc.)

##### `processBuffer(inputL, inputR, outputL, outputR, params)`
Process entire audio buffer (most efficient).

**Parameters:**
- `inputL` (Float32Array): Left channel input
- `inputR` (Float32Array): Right channel input
- `outputL` (Float32Array): Left channel output
- `outputR` (Float32Array): Right channel output
- `params` (Object): Processing parameters

##### `processSample(sampleL, sampleR, params)`
Process single sample (fallback for compatibility).

**Returns:** `{left: number, right: number}`

##### `updateEQCoefficients(lowGain, midGain, highGain, lowFreq, highFreq)`
Update EQ filter coefficients (called when parameters change).

##### `reset()`
Reset internal state (filters, envelopes, etc.)

##### `cleanup()`
Free resources (WASM memory, native connections, etc.)

##### `getCapabilities()`
Get backend capabilities and performance characteristics.

**Returns:**
```javascript
{
    type: 'javascript' | 'wasm' | 'native',
    supportsBufferProcessing: boolean,
    supportsSIMD: boolean,
    supportsMultiThreading: boolean,
    maxPolyphony: number,
    averageLatency: number,
    cpuEfficiency: number
}
```

##### `getStats()`
Get current processing statistics.

**Returns:**
```javascript
{
    samplesProcessed: number,
    averageProcessingTime: number,
    peakProcessingTime: number,
    cpuUsage: number
}
```

### AudioProcessorFactory

Factory for creating and benchmarking backends.

#### Static Methods

##### `async createBackend(preferredType, sampleRate)`
Create best available backend (auto-fallback).

**Parameters:**
- `preferredType` (string|null): Preferred backend type or null for auto-detect
- `sampleRate` (number): Sample rate in Hz (default: 48000)

**Returns:** `Promise<AudioProcessorBackend>`

##### `async detectBestBackend()`
Auto-detect the best available backend.

**Returns:** `Promise<string>` - Backend type

##### `async benchmarkAllBackends(sampleRate)`
Benchmark all available backends.

**Returns:** `Promise<Array>` - Benchmark results

##### `async benchmarkBackend(backend, name)`
Benchmark a single backend.

**Returns:** `Promise<number>` - Total processing time in ms

##### `async getAvailableBackends()`
Check which backends are available.

**Returns:**
```javascript
{
    javascript: boolean,
    wasm: boolean,
    native: boolean
}
```

## 📝 Processing Parameters

```javascript
{
    // EQ & Compression switches
    eqActive: boolean,      // Enable/disable 3-band EQ
    compActive: boolean,    // Enable/disable compression

    // Output controls
    gain: number,           // Output gain (0-2)
    pan: number,            // Pan position (-1 to 1)
    mono: number,           // Mono collapse (0-1)

    // EQ parameters (3-band)
    lowGain: number,        // Low shelf gain (0-3)
    midGain: number,        // Mid peak gain (0-3)
    highGain: number,       // High shelf gain (0-3)
    lowFreq: number,        // Low shelf frequency (20-500Hz)
    highFreq: number,       // High shelf frequency (1000-8000Hz)

    // Compression parameters
    threshold: number,      // Threshold in dB (-40 to 0)
    ratio: number          // Compression ratio (1-20)
}
```

## 🛠️ Development

### Adding a New Backend

1. Create backend class extending `AudioProcessorBackend`
2. Implement required methods
3. Register in factory
4. Add fallback logic

Example:

```javascript
import { AudioProcessorBackend, BackendType } from './AudioProcessorBackend.js';

export class MyCustomBackend extends AudioProcessorBackend {
    async initialize() {
        // Initialize your backend
        this.isInitialized = true;
    }

    processBuffer(inputL, inputR, outputL, outputR, params) {
        // Process audio
    }

    getCapabilities() {
        return {
            type: 'custom',
            supportsBufferProcessing: true,
            supportsSIMD: false,
            supportsMultiThreading: false,
            maxPolyphony: 16,
            averageLatency: 2.67,
            cpuEfficiency: 2.0
        };
    }
}
```

## 🗺️ Roadmap

### ✅ Phase 1: Analysis & Design (Completed)
- [x] Analyze current performance bottlenecks
- [x] Design abstraction layer
- [x] Create interface definitions
- [x] Implement JavaScript backend

### 🚧 Phase 2: WebAssembly (In Progress)
- [ ] Setup Rust + wasm-pack
- [ ] Implement biquad filters in Rust
- [ ] Implement compression in Rust
- [ ] Add SIMD optimizations
- [ ] Build and integrate WASM module

### 📋 Phase 3: Integration & Testing
- [ ] A/B testing JS vs WASM
- [ ] Performance validation
- [ ] Production deployment

### 📋 Phase 4: Native Extension (Future)
- [ ] Design native messaging protocol
- [ ] Implement C++ audio host
- [ ] Multi-threaded processing
- [ ] Chrome extension bridge

## 🐛 Troubleshooting

### Backend Not Initializing

```javascript
try {
    const backend = await AudioProcessorFactory.createBackend();
} catch (error) {
    console.error('Backend initialization failed:', error);
    // Factory will automatically fallback to JavaScript
}
```

### WASM Module Not Found

WASM backend is not yet implemented. The factory will automatically fallback to JavaScript backend.

### Performance Issues

Check which backend is active:

```javascript
const caps = backend.getCapabilities();
console.log('Active backend:', caps.type);
console.log('CPU efficiency:', caps.cpuEfficiency);

const stats = backend.getStats();
console.log('CPU usage:', stats.cpuUsage.toFixed(1) + '%');
```

## 📚 Additional Resources

- [WebAssembly Documentation](https://webassembly.org/)
- [Rust + wasm-pack Guide](https://rustwasm.github.io/wasm-pack/)
- [Web Audio API Spec](https://webaudio.github.io/web-audio-api/)
- [Chrome Native Messaging](https://developer.chrome.com/docs/apps/nativeMessaging/)

## 📄 License

Same as project license.
