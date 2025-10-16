# AudioWorklet Best Practices

> Guidelines learned from fixing VortexPhaser and other effect processors

**Last Updated:** 2025-10-16

## 🎯 Parameter Management

### The Parameter Index Bug

**CRITICAL:** AudioWorklet parameters are **per-block**, not per-sample!

```javascript
// ❌ WRONG - Using sample index to read parameters
process(inputs, outputs, parameters) {
  for (let i = 0; i < 128; i++) {
    const rate = parameters.rate[i];  // ❌ Only index 0 exists!
  }
}

// ✅ CORRECT - Always use index 0
process(inputs, outputs, parameters) {
  const rate = parameters.rate[0];  // ✅ Read once per block
  for (let i = 0; i < 128; i++) {
    // Use rate for all samples in block
  }
}
```

**Why:** AudioParam values are sent once per 128-sample block, not per sample.

### Parameter Definition Consistency

Parameters must match across 3 locations:

1. **Worklet Processor** (`parameterDescriptors()`)
2. **EffectRegistry** (`parameters` array)
3. **EffectFactory** (`params` object with UI metadata)

```javascript
// 1. Worklet Processor
static get parameterDescriptors() {
  return [
    { name: 'rate', defaultValue: 0.5, minValue: 0.01, maxValue: 10 },
    { name: 'depth', defaultValue: 0.7, minValue: 0, maxValue: 1 },
    { name: 'stages', defaultValue: 4, minValue: 2, maxValue: 12 },  // Must exist!
  ];
}

// 2. EffectRegistry
this.register('VortexPhaser', {
  parameters: [
    { name: 'rate', defaultValue: 0.5, minValue: 0.01, maxValue: 10 },
    { name: 'depth', defaultValue: 0.7, minValue: 0, maxValue: 1 },
    { name: 'stages', defaultValue: 4, minValue: 2, maxValue: 12 },  // Must match!
  ]
});

// 3. EffectFactory
'vortex-phaser': {
  params: {
    rate: { label: 'Rate', defaultValue: 0.5, min: 0.01, max: 10, unit: ' Hz' },
    depth: { label: 'Depth', defaultValue: 0.7, min: 0, max: 1, unit: '' },
    stages: { label: 'Stages', defaultValue: 4, min: 2, max: 12, unit: '' },  // Must exist!
  }
}
```

**Missing any parameter in EffectFactory = AudioWorkletNode creation failure!**

## 🛡️ Stability and Safety

### Input Validation

Always validate input samples before processing:

```javascript
processEffect(sample, channel, parameters) {
  // ✅ Validate input
  if (!isFinite(sample) || Math.abs(sample) > 100) {
    return 0;  // Return silence on invalid input
  }

  // Process...
}
```

### State Protection

Filter state variables can grow exponentially if not clamped:

```javascript
processAllpass(sample, state, coefficient) {
  // ✅ Reset corrupted state
  if (!isFinite(state.x1) || Math.abs(state.x1) > 10) {
    state.x1 = 0;
  }
  if (!isFinite(state.y1) || Math.abs(state.y1) > 10) {
    state.y1 = 0;
  }

  // Process...
  const output = coefficient * (sample - state.y1) + state.x1;

  // ✅ Clamp output before storing
  if (!isFinite(output) || Math.abs(output) > 10) {
    state.x1 = 0;
    state.y1 = 0;
    return 0;
  }

  state.x1 = sample;
  state.y1 = output;
  return output;
}
```

### Feedback Clamping

Feedback coefficients > 1.0 cause exponential growth:

```javascript
// ✅ Always clamp feedback
const feedback = Math.min(0.95, getParam(parameters.feedback, 0) || 0.5);
```

**Why 0.95?** Leaves safety margin below 1.0 for numerical stability.

## 🔧 Common DSP Patterns

### All-Pass Filter (Phaser, Flanger)

```javascript
// Standard first-order all-pass
// H(z) = (a + z^-1) / (1 + a*z^-1)
processAllpass(sample, state, coefficient) {
  // Difference equation: y[n] = a*(x[n] - y[n-1]) + x[n-1]
  const output = coefficient * (sample - state.y1) + state.x1;

  state.x1 = sample;
  state.y1 = output;

  return output;
}
```

**Coefficient range:** `-1 < a < 1` for stability

### Delay Line (Chorus, Echo)

```javascript
constructor() {
  super();
  const maxDelayMs = 50;
  this.bufferSize = Math.ceil((maxDelayMs / 1000) * sampleRate);
  this.buffer = new Float32Array(this.bufferSize);
  this.writeIndex = 0;
}

processDelay(sample, delayInSamples) {
  // Write current sample
  this.buffer[this.writeIndex] = sample;

  // Calculate read position
  let readIndex = this.writeIndex - delayInSamples;
  if (readIndex < 0) readIndex += this.bufferSize;

  // Read delayed sample
  const delayed = this.buffer[Math.floor(readIndex)];

  // Advance write index
  this.writeIndex = (this.writeIndex + 1) % this.bufferSize;

  return delayed;
}
```

### LFO (Low Frequency Oscillator)

```javascript
constructor() {
  super();
  this.lfoPhase = 0;
}

processWithLFO(sample, rate, depth) {
  // Update phase
  const lfoIncrement = (rate / this.sampleRate) * 2 * Math.PI;
  this.lfoPhase += lfoIncrement;

  // Wrap phase
  if (this.lfoPhase > 2 * Math.PI) {
    this.lfoPhase -= 2 * Math.PI;
  }

  // Generate LFO value (0 to 1)
  const lfoValue = (Math.sin(this.lfoPhase) + 1) / 2;

  // Modulate parameter
  const modulated = minValue + (maxValue - minValue) * lfoValue * depth;

  return modulated;
}
```

## 🐛 Debugging Strategies

### 1. Bypass Mode Testing

```javascript
const FORCE_BYPASS = true;  // Test if DSP is the issue

if (this.bypassed || FORCE_BYPASS) {
  // Pass through unprocessed
  output[channel].set(input[channel]);
  return true;
}
```

**If bypass works but processing doesn't → DSP bug**
**If bypass also fails → Worklet initialization bug**

### 2. Value Logging

```javascript
if (this.processCallCount < 3 && channel === 0) {
  console.log('First process call:', {
    inputMax: Math.max(...input[0]),
    outputMax: Math.max(...output[0]),
    parameters: {
      rate: parameters.rate[0],
      depth: parameters.depth[0]
    }
  });
}
```

**Log once per channel to avoid spam!**

### 3. NaN/Infinity Detection

```javascript
if (!isFinite(processedSample)) {
  console.error('❌ Invalid sample:', processedSample, 'at stage', stageIndex);
  // Return safe fallback
  return sample;
}
```

## ⚡ Performance Tips

### 1. Pre-compute Constants

```javascript
// ❌ Computed every sample
for (let i = 0; i < 128; i++) {
  const coeff = (Math.tan(freq / sampleRate) - 1) / (Math.tan(freq / sampleRate) + 1);
}

// ✅ Computed once per block
const coeff = (Math.tan(freq / sampleRate) - 1) / (Math.tan(freq / sampleRate) + 1);
for (let i = 0; i < 128; i++) {
  // Use coeff
}
```

### 2. Avoid Array Allocations

```javascript
// ❌ Creates garbage
for (let i = 0; i < 128; i++) {
  const temp = [sample, sample * 2];
}

// ✅ Reuse state
this.tempBuffer[0] = sample;
this.tempBuffer[1] = sample * 2;
```

### 3. Branch Prediction

```javascript
// ✅ Likely path first
if (isFinite(output)) {
  // Normal processing (99.9% of time)
  return output;
} else {
  // Error handling (rare)
  return 0;
}
```

## 📋 Testing Checklist

Before deploying an AudioWorklet effect:

- [ ] Parameters match across all 3 locations
- [ ] Default values are sensible
- [ ] Min/max ranges prevent instability
- [ ] Feedback coefficients < 1.0
- [ ] State variables are initialized
- [ ] NaN/Infinity checks in place
- [ ] Bypass mode works
- [ ] No console errors
- [ ] CPU usage reasonable (< 5% per instance)
- [ ] No audio dropouts at 128-sample buffer

## 🔬 Mathematical Stability

### Coefficient Calculation Safety

```javascript
// Tan approaches infinity at π/2
const wc = 2 * Math.PI * freq / sampleRate;

// ❌ Unstable at high frequencies
const coeff = (Math.tan(wc / 2) - 1) / (Math.tan(wc / 2) + 1);

// ✅ Clamp to safe range
const clampedWc = Math.min(wc / 2, Math.PI / 2 - 0.01);
const coeff = (Math.tan(clampedWc) - 1) / (Math.tan(clampedWc) + 1);
```

### Numerical Precision

For 32-bit float audio:
- **Typical range:** -1.0 to 1.0
- **Safe working range:** -10.0 to 10.0
- **Danger zone:** > ±100 (likely overflow)
- **Invalid:** NaN, Infinity

## 🎓 Learning Resources

### Understanding AudioWorklet
- MDN: AudioWorkletProcessor
- Web Audio API specification
- Real-time audio processing theory

### DSP Fundamentals
- Digital filter design
- Z-transform and transfer functions
- Stability criteria (poles inside unit circle)

### Effect-Specific
- Phaser: All-pass filter networks
- Chorus: Modulated delay lines
- Compressor: Envelope followers and gain reduction

## 📝 Related Documents

- [VORTEX_PHASER_FIX.md](../bugs/VORTEX_PHASER_FIX.md) - Real-world example of all these principles
- [BUG_TRACKER.md](../bugs/BUG_TRACKER.md) - Other AudioWorklet issues
- [WORKLET_OPTIMIZATION_REPORT.md](../../client/docs/WORKLET_OPTIMIZATION_REPORT.md) - Performance tuning

---

**Remember:** In audio programming, numerical stability isn't optional—it's mandatory. One bad sample can crash the entire audio engine.
