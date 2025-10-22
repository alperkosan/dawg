# 🎛️ UnifiedMixer (MegaMixer) Test Guide

**Date:** October 22, 2025
**Status:** ✅ Ready for Testing
**Expected Performance:** 11x faster (168% CPU → 15% CPU)

---

## 🎯 What is UnifiedMixer?

The UnifiedMixer (a.k.a. MegaMixer) is a revolutionary WASM-powered audio mixer that processes all 32 channels in a single AudioWorkletNode, eliminating the massive overhead of having 45+ separate AudioNodes in the graph.

### Architecture Comparison:

**OLD SYSTEM:**
```
Instrument → Track Worklet → Master Worklet → Native Nodes → Output
   (20x)         (20x)            (1x)           (3x)
= 45 AudioNodes = 4.5ms overhead = 168% CPU waste
```

**NEW SYSTEM (MegaMixer):**
```
Instrument 1-32 → WASM MegaMixer → Native Limiter → Output
                     (single node)      (1x)
= 4 AudioNodes = 0.4ms overhead = 15% CPU ✅
```

---

## 🚀 Quick Start

1. **Open Browser Console** (F12)
2. **Load the app** - The demo is auto-loaded in development mode
3. **You should see:**
   ```
   🚀 Performance helpers loaded! Try: window.performanceHelpers.runPerformanceTest()
   ⚡ WASM helpers loaded! Try: window.wasm.quickBenchmark()
   🎛️ UnifiedMixer demo loaded! Try: demo.help()
   ```

---

## 📚 Test Suite

### Test 0: Get Help
```javascript
demo.help()
```
Shows all available commands.

---

### Test 1: Initialize Demo Environment
```javascript
await demo.initialize()
```

**Expected output:**
```
🚀 Initializing UnifiedMixer demo...
🚀 Initializing UnifiedMixerNode...
✅ WASM module loaded
✅ UnifiedMixerWorklet created: 32 inputs
✅ WASM UnifiedMixerProcessor initialized in AudioWorklet
✅ UnifiedMixerNode initialized successfully
✅ UnifiedMixer demo initialized
```

**What it does:**
- Creates AudioContext
- Loads WASM module
- Creates UnifiedMixerWorklet with 32 input channels
- Initializes WASM processor inside AudioWorklet
- Connects to audio output

---

### Test 2: Single Channel Test
```javascript
await demo.testSingleChannel()
```

**Expected output:**
```
🧪 Test 1: Single channel with sine wave
✅ Playing 440Hz sine on channel 0
💡 Run demo.stopAll() to stop
```

**What it does:**
- Creates single oscillator (440Hz sine wave)
- Connects to channel 0 of UnifiedMixer
- Sets channel parameters (gain, pan, mute/solo, EQ/comp)
- You should hear a pure tone

**To stop:**
```javascript
demo.stopAll()
```

---

### Test 3: Multiple Channels Test
```javascript
await demo.testMultipleChannels(8)
```

**Expected output:**
```
🧪 Test 2: 8 channels with different frequencies
✅ Playing 8 channels (C major chord with panning)
💡 Run demo.stopAll() to stop
```

**What it does:**
- Creates 8 oscillators with different frequencies (C major chord)
- Each channel panned differently (-1 to +1)
- Tests multi-channel mixing
- You should hear a rich chord with spatial distribution

**Parameters:**
- `numChannels` (default: 8) - Can test up to 32 channels

---

### Test 4: EQ Test
```javascript
await demo.testChannelEQ()
```

**What it does:**
- Applies EQ to channel 0
- Low band: +6dB boost
- High band: -6dB cut
- You should hear the tone become warmer/darker

**Note:** Run `testSingleChannel()` or `testMultipleChannels()` first!

---

### Test 5: Solo/Mute Test
```javascript
await demo.testSoloMute()
```

**What it does:**
- Mutes channel 0 for 2 seconds
- Solos channel 1 for 2 seconds
- Returns to normal after 6 seconds
- Tests solo/mute functionality

**Note:** Run `testMultipleChannels()` first for best results!

---

### Test 6: Performance Benchmark 🏁
```javascript
await demo.benchmark(32, 5000)
```

**Parameters:**
- `numChannels` (default: 32) - Number of channels to test
- `duration` (default: 5000ms) - How long to run

**Expected output:**
```
🏁 Benchmark: 32 channels for 5000ms
✅ Playing 32 channels with EQ and compression...

📊 Benchmark Results:
┌─────────────────────┬───────────┐
│ Samples Processed   │ 960000    │
│ Average Time (ms)   │ 0.150     │
│ Peak Time (ms)      │ 0.250     │
│ Process Count       │ 7500      │
│ Channels            │ 32        │
└─────────────────────┴───────────┘

💡 CPU Usage: 5.62%
💡 Efficiency: 94.38% headroom
🚀 EXCELLENT: Graph overhead < 15% (target achieved!)
```

**What it tests:**
- Maximum channel count (32)
- All channels with EQ and compression active
- Real processing load
- Measures actual CPU overhead

**Target Performance:**
- ✅ CPU Usage < 15% = EXCELLENT (target achieved)
- ✅ CPU Usage < 50% = GOOD
- ⚠️ CPU Usage > 50% = WARNING (investigate)

---

## 🔍 Detailed Performance Analysis

### Understanding the Numbers:

1. **Average Time**: Time to process one 128-sample block
   - Ideal time @ 48kHz: 2.67ms (100% CPU)
   - Target time: < 0.4ms (15% CPU)

2. **Peak Time**: Maximum processing time seen
   - Should be < 1.0ms for safety margin

3. **CPU Usage**: (Average Time / Ideal Time) × 100
   - < 15% = Target achieved! 🚀
   - < 50% = Good performance ✅
   - > 50% = High overhead ⚠️

4. **Efficiency**: 100% - CPU Usage
   - Represents how much headroom you have
   - Higher = better (more room for other processing)

---

## 🆚 Comparison Tests

### Compare Old vs New Mixer:

1. **Old System Overhead (from previous analysis):**
   - 45 AudioNodes
   - 4.5ms overhead per 128 samples
   - 168% CPU usage (not enough headroom!)

2. **New System (MegaMixer):**
   - 4 AudioNodes
   - 0.4ms overhead per 128 samples (expected)
   - 15% CPU usage (94% headroom!)

3. **Expected Improvement:**
   - **11x faster graph processing**
   - **From 168% → 15% CPU overhead**
   - **10x more efficient!**

---

## 🐛 Troubleshooting

### Problem: "demo is not defined"
**Solution:** Wait for app to load fully. Check console for:
```
🎛️ UnifiedMixer demo loaded! Try: demo.help()
```

### Problem: "UnifiedMixerNode not initialized"
**Solution:** Run `await demo.initialize()` first

### Problem: No sound
**Checklist:**
1. Check browser volume
2. Check system volume
3. Try clicking page first (autoplay policy)
4. Check console for errors
5. Run `demo.stopAll()` then try again

### Problem: WASM module not loading
**Solution:**
```javascript
// Check WASM availability
window.wasm.testWasmAvailability()

// Check file exists
fetch('/wasm/dawg_audio_dsp.js')
  .then(r => console.log('✅ WASM file found:', r.status))
  .catch(e => console.error('❌ WASM file missing:', e))
```

### Problem: High CPU usage in benchmark
**Check:**
1. Close other tabs/applications
2. Check browser task manager
3. Try fewer channels: `demo.benchmark(16, 5000)`
4. Check console for errors

---

## 📊 Expected Results Summary

| Test | Metric | Expected | Status |
|------|--------|----------|--------|
| Single Channel | Works | Yes | ✅ |
| 8 Channels | Works | Yes | ✅ |
| 32 Channels | Works | Yes | ✅ |
| EQ Active | Works | Yes | ✅ |
| Compression | Works | Yes | ✅ |
| Solo/Mute | Works | Yes | ✅ |
| CPU @ 32ch | < 15% | 5-10% | ✅ |
| Peak Time | < 1ms | 0.2-0.5ms | ✅ |
| Headroom | > 85% | 90-95% | ✅ |

---

## 🎓 Technical Details

### WASM Module Exports:
```rust
UnifiedMixerProcessor::new(sample_rate, num_channels)
UnifiedMixerProcessor::process_mix(inputs, output_l, output_r, block_size, num_channels)
UnifiedMixerProcessor::set_channel_params(idx, gain, pan, mute, solo, eq_active, comp_active)
UnifiedMixerProcessor::set_channel_eq(idx, low_gain, mid_gain, high_gain, low_freq, high_freq)
UnifiedMixerProcessor::reset()
```

### Input Format:
Interleaved stereo: `[ch0_L, ch0_R, ch1_L, ch1_R, ..., chN_L, chN_R]` per sample

### Processing Pipeline:
1. **Interleave inputs** (JavaScript)
2. **Process all channels** (WASM) - Single call!
3. **Copy to output** (JavaScript)

---

## 🚀 Next Steps

After successful testing:

1. ✅ **Verify all tests pass**
2. ✅ **Confirm CPU usage < 15%**
3. ⏭️ **Integrate into NativeAudioEngine** (Phase 3.2)
4. ⏭️ **Compare with old mixer system** (Phase 3.3)
5. ⏭️ **Document final results** (Phase 3.4)

---

## 📞 Quick Reference

```javascript
// Initialize
await demo.initialize()

// Basic tests
await demo.testSingleChannel()
await demo.testMultipleChannels(8)
await demo.testChannelEQ()
await demo.testSoloMute()

// Performance
await demo.benchmark(32, 5000)

// Control
demo.stopAll()
demo.cleanup()
demo.help()

// WASM tests
window.wasm.testWasmAvailability()
window.wasm.quickBenchmark()
```

---

**🎉 Ready to test the future of web audio mixing!**

Run `demo.help()` in the console to get started.
