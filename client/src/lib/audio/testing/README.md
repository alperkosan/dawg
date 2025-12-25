# 🔬 Effect Benchmark Framework

**Status:** Day 3 Complete  
**Purpose:** Measure CPU, memory, and audio quality for JS vs WASM effects

## Features

✅ **CPU Usage** - Render time vs audio length  
✅ **Memory Consumption** - Heap size tracking  
✅ **Audio Quality** - RMS, Peak, Crest Factor, THD+N  
✅ **JS vs WASM Comparison** - Side-by-side performance  
✅ **Exportable Reports** - JSON export for analysis  
✅ **Batch Testing** - Test multiple effects  

## Quick Start

```javascript
import { quickBenchmark } from '@/lib/audio/testing/EffectBenchmark';

// Compare JS vs WASM for single effect
const result = await quickBenchmark('compressor');
console.log(`CPU Improvement: ${result.renderTimeImprovement}%`);
console.log(`Speedup: ${result.speedup}x`);
```

## Usage

### Single Effect Benchmark

```javascript
import { EffectBenchmark } from '@/lib/audio/testing/EffectBenchmark';

const benchmark = new EffectBenchmark();

// Test worklet implementation
const jsResult = await benchmark.benchmarkEffect('saturator', 'worklet');

// Test WASM implementation
const wasmResult = await benchmark.benchmarkEffect('saturator', 'wasm');

// Results include:
// - renderTime: milliseconds to process 10s of audio
// - cpuEfficiency: (audioLength / renderTime) * 100
// - realTimeFactor: how many CPUs needed for real-time
// - memoryDelta: heap size change in MB
// - rmsLevel, peakLevel: audio quality metrics
```

### Compare Implementations

```javascript
const benchmark = new EffectBenchmark();

// Automatic JS vs WASM comparison
const comparison = await benchmark.compareImplementations('compressor');

// Results:
console.log(comparison.renderTimeImprovement); // e.g., 50.6%
console.log(comparison.speedup);               // e.g., 2.02x
console.log(comparison.memorySaved);           // e.g., 0.5 MB
console.log(comparison.qualityMatch);          // '✅ Identical' or '⚠️ Different'
console.log(comparison.worthMigrating);        // true if >10% improvement
```

### Batch Testing

```javascript
const benchmark = new EffectBenchmark();

const effects = [
  'compressor',
  'saturator',
  'modern-reverb',
  'modern-delay',
  'limiter'
];

// Test all effects (JS vs WASM)
const results = await benchmark.benchmarkAll(effects, true);

// Prints summary:
// ✨ Average CPU Improvement: 48.3%
// ⚡ Average Speedup: 1.94x
// 💾 Total Memory Saved: 2.1 MB
```

### Custom Presets

```javascript
const benchmark = new EffectBenchmark();

// Test with specific settings
const result = await benchmark.benchmarkEffect('saturator', 'worklet', {
  distortion: 1.5,  // Max drive
  multiband: 1,     // Enable multiband
  wet: 1.0
});

console.log(`Saturator @ Max Drive: ${result.realTimeFactor}x`);
```

### Export Results

```javascript
const benchmark = new EffectBenchmark();

// Run tests...
await benchmark.benchmarkAll([...]);

// Export as JSON
const report = benchmark.exportResults();

// report contains:
// - timestamp
// - results: all benchmark data
// - system: browser info, CPU cores, memory
// - testConfig: duration, sample rate
```

## Metrics Explained

### renderTime
Time in milliseconds to process the audio.  
**Lower is better.**

Example: 85.2 ms to process 10 seconds of audio

### cpuEfficiency
Percentage of real-time processing speed.  
`(audioLength / renderTime) * 100`

**Higher is better.**

Example: 11730% = can process audio 117x faster than real-time

### realTimeFactor
How many CPUs needed for real-time processing.  
`renderTime / audioLength`

**Lower is better.**

Example: 0.009x = needs less than 1% of one CPU

### memoryDelta
Change in heap size (MB) during processing.

**Lower is better.**

Example: 2.3 MB allocated during processing

### rmsLevel
Root Mean Square level (average volume).  
Used to verify audio isn't clipping or silent.

### peakLevel
Maximum sample value.  
Should be ≤ 1.0 to avoid clipping.

### Quality Difference
When comparing JS vs WASM, measures how different the outputs are.

**Closer to 0 is better.**

Example: 0.000123 = essentially identical

## Output Example

```
🔬 Benchmarking: compressor (worklet)
┌─────────────────┬──────────┐
│  Render Time    │  85.2 ms │
│  Audio Length   │ 10000 ms │
│  CPU Efficiency │  11730%  │
│  Real-Time Fact │  0.009x  │
│  Memory Delta   │  2.3 MB  │
└─────────────────┴──────────┘

🔬 Benchmarking: compressor (wasm)
┌─────────────────┬──────────┐
│  Render Time    │  42.1 ms │  ⬅️ 2x faster!
│  CPU Efficiency │  23750%  │
│  Real-Time Fact │  0.004x  │
│  Memory Delta   │  1.8 MB  │
└─────────────────┴──────────┘

⚖️  Comparison Summary
├─ CPU Improvement: 50.6%
├─ Speedup: 2.02x
├─ Memory Saved: 0.5 MB
└─ Quality: ✅ Identical
```

## Test Signal

The benchmark uses a complex multi-frequency test signal:
- Kick drum (60 Hz)
- Snare (noise burst)
- Hi-hat (8 kHz filtered noise)
- Bass (110 Hz)
- Melody (440 Hz with vibrato)

This simulates realistic music content.

## Quality Analysis

### RMS (Root Mean Square)
Average volume level. Used to verify effect isn't silent.

### Peak Level
Maximum value. Should be ≤ 1.0 to avoid clipping.

### Crest Factor
Peak / RMS ratio. Indicates dynamic range.

### THD+N
Total Harmonic Distortion + Noise.  
Measures how much the effect changes the signal.

### Buffer Comparison
Correlation coefficient between JS and WASM outputs.  
1.0 = identical, 0.0 = completely different.

## Performance Expectations

Based on initial projections:

| Effect | JS (ms) | WASM (ms) | Improvement |
|:---|---:|---:|---:|
| Modern Reverb | 157 | 68 | 56.2% |
| Saturator | 123 | 42 | 51.8% |
| Compressor | 85 | 32 | 50.6% |
| Modern Delay | 92 | 38 | 47.1% |
| Limiter | 71 | 29 | 43.5% |

**Average:** ~50% CPU reduction

## Real-Time Capability

**realTimeFactor < 1.0** = Can run in real-time  
**realTimeFactor > 1.0** = Cannot run in real-time

Example:
- 0.009x = 111x headroom (excellent!)
- 0.5x = 2x headroom (good)
- 1.2x = Needs 1.2 CPUs (won't run in real-time)

## Next Steps

After benchmarking:
1. Prioritize effects with >40% improvement
2. Migrate high-impact effects first
3. Re-benchmark after WASM implementation
4. Compare actual vs projected gains

## Files

- `EffectBenchmark.js` - Main framework
- `test-benchmark.js` - Usage examples
- `README.md` - This file
