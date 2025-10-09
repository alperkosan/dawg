# 🚀 Plugin Development Quickstart Guide

> **Create a new audio plugin in 15 minutes**
>
> **Date:** 2025-10-09
>
> **Prerequisites:** Basic React knowledge, understanding of Web Audio API

---

## 📚 Table of Contents

1. [Quick Start](#quick-start)
2. [Step-by-Step Tutorial](#step-by-step-tutorial)
3. [Template Files](#template-files)
4. [Plugin Registration](#plugin-registration)
5. [Testing Your Plugin](#testing-your-plugin)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)

---

## ⚡ Quick Start

### 1. Copy Template Files

```bash
# UI Component
cp client/src/components/plugins/effects/PluginTemplate.jsx \
   client/src/components/plugins/effects/MyPluginUI.jsx

# Worklet Processor
cp client/public/worklets/effects/template-processor.js \
   client/public/worklets/effects/my-plugin-processor.js

# Styles (optional)
cp client/src/components/plugins/effects/PluginTemplate.css \
   client/src/components/plugins/effects/MyPlugin.css
```

### 2. Update Names

**In `MyPluginUI.jsx`:**
```javascript
// Change component name
export function MyPluginUI({ trackId, effect, onUpdate }) {
  // ... rest of code
}

// Change preset manager instance
const presetManager = createPresetManager('my-plugin', FACTORY_PRESETS);
```

**In `my-plugin-processor.js`:**
```javascript
// Change class name
class MyPluginProcessor extends AudioWorkletProcessor {
  // ... your DSP code
}

// Change registration name
registerProcessor('my-plugin-processor', MyPluginProcessor);
```

### 3. Register Plugin

**In `client/src/config/pluginConfig.jsx`:**
```javascript
import { MyPluginUI } from '@/components/plugins/effects/MyPluginUI.jsx';

// Add to AVAILABLE_EFFECTS array
{
  id: 'myPlugin',
  name: 'My Plugin',
  component: MyPluginUI,
  category: 'Dynamics', // or 'Filter', 'Modulation', 'Utility', etc.
  workletPath: '/worklets/effects/my-plugin-processor.js',
  workletName: 'my-plugin-processor',
  icon: '🎚️',
  description: 'Your plugin description'
}
```

### 4. Implement DSP Logic

**In `my-plugin-processor.js`:**
```javascript
process(inputs, outputs, parameters) {
  const input = inputs[0];
  const output = outputs[0];

  if (!input || input.length === 0) return true;

  const inputLeft = input[0];
  const inputRight = input[1] || input[0];
  const outputLeft = output[0];
  const outputRight = output[1] || output[0];

  for (let i = 0; i < inputLeft.length; i++) {
    // YOUR DSP CODE HERE
    // Example: Simple gain
    outputLeft[i] = inputLeft[i] * this.param1;
    outputRight[i] = inputRight[i] * this.param1;
  }

  return true;
}
```

### 5. Test

1. Load your DAW
2. Add an instrument/track
3. Open Mixer
4. Add your new plugin
5. Adjust parameters and listen!

---

## 📖 Step-by-Step Tutorial

### Step 1: Plan Your Plugin

Before coding, answer these questions:

1. **What does it do?** (e.g., "Adds vintage tape saturation")
2. **What parameters?** (e.g., drive, tone, mix)
3. **What category?** (Dynamics, Filter, Modulation, etc.)
4. **What visualization?** (Waveform, spectrum, meters, etc.)

### Step 2: Create Presets

Define at least 3 presets for your plugin:

```javascript
const FACTORY_PRESETS = [
  {
    id: 'default',
    name: 'Default',
    category: 'Init',
    parameters: {
      drive: 0.5,
      tone: 0.5,
      mix: 1.0
    },
    description: 'Starting point'
  },
  {
    id: 'subtle-warmth',
    name: 'Subtle Warmth',
    category: 'Utility',
    parameters: {
      drive: 0.3,
      tone: 0.6,
      mix: 0.4
    },
    description: 'Gentle analog character'
  },
  {
    id: 'heavy-saturation',
    name: 'Heavy Saturation',
    category: 'Creative',
    parameters: {
      drive: 0.9,
      tone: 0.7,
      mix: 1.0
    },
    description: 'Aggressive tape distortion'
  }
];
```

### Step 3: Implement DSP Algorithm

Common DSP patterns:

#### Pattern 1: Waveshaping/Saturation
```javascript
processSaturation(input, drive) {
  const gain = 1 + drive * 9; // 1x to 10x
  return Math.tanh(input * gain) / Math.tanh(gain);
}
```

#### Pattern 2: Simple Filter
```javascript
processLowPass(input, cutoff) {
  const alpha = Math.min(1.0, cutoff);
  const output = (1 - alpha) * this.y1 + alpha * input;
  this.y1 = output;
  return output;
}
```

#### Pattern 3: Delay/Echo
```javascript
// In constructor:
this.delayBuffer = new Float32Array(sampleRate * 2); // 2 seconds max
this.writePos = 0;

processDelay(input, delayTime, feedback) {
  const delaySamples = Math.floor(delayTime * this.sampleRate);
  const readPos = (this.writePos - delaySamples + this.delayBuffer.length)
                  % this.delayBuffer.length;

  const delayed = this.delayBuffer[readPos];
  this.delayBuffer[this.writePos] = input + delayed * feedback;

  this.writePos = (this.writePos + 1) % this.delayBuffer.length;

  return delayed;
}
```

#### Pattern 4: Envelope Follower
```javascript
// In constructor:
this.envelope = 0;

processEnvelope(input, attack, release) {
  const rectified = Math.abs(input);

  if (rectified > this.envelope) {
    // Attack
    this.envelope += (rectified - this.envelope) * attack;
  } else {
    // Release
    this.envelope += (rectified - this.envelope) * release;
  }

  return this.envelope;
}
```

### Step 4: Customize Visualization

Replace the template visualization with your own:

```javascript
const MyPluginVisualizer = ({ trackId, effectId, drive, tone }) => {
  const { isPlaying, getTimeDomainData, metricsDb } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true
  });

  const drawVisualization = useCallback((ctx, width, height) => {
    // Clear
    ctx.fillStyle = 'rgba(10, 10, 12, 0.95)';
    ctx.fillRect(0, 0, width, height);

    if (!isPlaying) {
      // Idle state
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.font = '12px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Audio Stopped', width / 2, height / 2);
      return;
    }

    // YOUR VISUALIZATION CODE HERE
    // Example: Draw waveform
    const audioData = getTimeDomainData();
    if (audioData) {
      ctx.strokeStyle = `rgba(99, 102, 241, ${0.5 + drive * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < audioData.length; i++) {
        const x = (i / audioData.length) * width;
        const y = ((audioData[i] + 1) / 2) * height;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
    }

    // Display metrics
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '10px "Geist Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`RMS: ${metricsDb.rmsDb.toFixed(1)}dB`, 8, 16);
    ctx.fillText(`PEAK: ${metricsDb.peakDb.toFixed(1)}dB`, 8, 30);

    if (metricsDb.clipping) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.fillText('CLIP!', 8, 44);
    }
  }, [isPlaying, getTimeDomainData, metricsDb, drive, tone]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawVisualization,
    [drive, tone, isPlaying]
  );

  return (
    <div ref={containerRef} className="my-plugin-visualizer">
      <canvas ref={canvasRef} />
    </div>
  );
};
```

### Step 5: Add Custom Parameters

Replace template parameters with your own:

```javascript
export function MyPluginUI({ trackId, effect, onUpdate }) {
  const [params, setParams] = useState({
    drive: effect.parameters?.drive ?? 0.5,
    tone: effect.parameters?.tone ?? 0.5,
    width: effect.parameters?.width ?? 0.5,
    mix: effect.parameters?.mix ?? 1.0
  });

  // Ghost values
  const ghostDrive = useGhostValue(params.drive);
  const ghostTone = useGhostValue(params.tone);
  const ghostWidth = useGhostValue(params.width);

  // Send to worklet
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    audioNode.port.postMessage({
      type: 'setParameters',
      data: params
    });
  }, [params, plugin]);

  const handleParamChange = useCallback((paramName, value) => {
    const newParams = { ...params, [paramName]: value };
    setParams(newParams);
    onUpdate({ ...effect, parameters: newParams });
  }, [params, effect, onUpdate]);

  return (
    <div className="my-plugin-ui">
      {/* ... your UI controls ... */}
    </div>
  );
}
```

---

## 📁 Template Files

### Template Structure

```
client/
├── src/
│   └── components/
│       └── plugins/
│           └── effects/
│               ├── PluginTemplate.jsx      # UI Component Template
│               └── PluginTemplate.css      # Styles Template
└── public/
    └── worklets/
        └── effects/
            └── template-processor.js       # DSP Template
```

### What's Included

✅ **PluginTemplate.jsx**
- Complete UI with preset management
- Parameter controls with ghost values
- Canvas visualization setup
- Standardized hooks integration

✅ **template-processor.js**
- AudioWorklet boilerplate
- Parameter message handling
- Example DSP functions
- Performance optimizations

✅ **PluginTemplate.css**
- Zenith design system integration
- Responsive layout
- Accessibility features
- Dark mode support

---

## 🔌 Plugin Registration

### pluginConfig.jsx

```javascript
export const AVAILABLE_EFFECTS = [
  // ... other plugins ...

  {
    id: 'myPlugin',              // Unique ID (camelCase)
    name: 'My Plugin',           // Display name
    component: MyPluginUI,       // React component
    category: 'Dynamics',        // Category for grouping
    workletPath: '/worklets/effects/my-plugin-processor.js',
    workletName: 'my-plugin-processor',
    icon: '🎚️',                 // Emoji or icon
    description: 'Does amazing things to your audio',
    tags: ['creative', 'distortion'],  // Optional search tags
    version: '1.0.0',           // Optional version
    author: 'Your Name'         // Optional author
  }
];
```

### Categories

- `Dynamics` - Compressors, limiters, gates
- `Filter` - EQ, filters, tone shapers
- `Modulation` - Chorus, flanger, phaser
- `Delay` - Delays, echoes, reverbs
- `Distortion` - Saturation, overdrive, bitcrush
- `Utility` - Gain, pan, phase, analysis
- `Creative` - Experimental effects

---

## 🧪 Testing Your Plugin

### 1. Visual Testing

1. Open the plugin UI
2. Check all parameters respond smoothly
3. Verify visualization updates in real-time
4. Test preset loading/saving
5. Check responsive layout

### 2. Audio Testing

1. **Bypass Test**: Compare processed vs unprocessed audio
2. **Extreme Values**: Test parameters at 0% and 100%
3. **Silence Test**: Ensure no noise when input is silent
4. **Clipping Test**: Verify no unexpected distortion
5. **Latency Test**: Check for sync issues

### 3. Performance Testing

```javascript
// Add to your processor for debugging
let processCalls = 0;
let totalTime = 0;

process(inputs, outputs, parameters) {
  const startTime = performance.now();

  // ... your processing code ...

  const endTime = performance.now();
  totalTime += endTime - startTime;
  processCalls++;

  if (processCalls % 1000 === 0) {
    console.log(`Avg process time: ${(totalTime / processCalls).toFixed(3)}ms`);
  }

  return true;
}
```

**Target:** < 0.5ms per process() call (at 128 samples)

### 4. Memory Testing

```javascript
// Check for memory leaks
constructor() {
  super();
  console.log('Processor created');
  this.processCount = 0;
}

process() {
  this.processCount++;
  if (this.processCount % 10000 === 0) {
    console.log(`Still alive after ${this.processCount} calls`);
  }
  return true;
}
```

---

## 🎯 Common Patterns

### Pattern: Parameter Smoothing

Prevent zipper noise when parameters change:

```javascript
class MyProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetParam = 0.5;
    this.currentParam = 0.5;
    this.smoothingFactor = 0.001; // Adjust for smoothness
  }

  process(inputs, outputs) {
    // Smooth parameter changes
    this.currentParam += (this.targetParam - this.currentParam) * this.smoothingFactor;

    // Use currentParam in processing
    for (let i = 0; i < inputLeft.length; i++) {
      outputLeft[i] = inputLeft[i] * this.currentParam;
    }

    return true;
  }
}
```

### Pattern: Stereo Processing

```javascript
process(inputs, outputs) {
  const inputLeft = input[0];
  const inputRight = input[1] || input[0]; // Mono fallback

  for (let i = 0; i < inputLeft.length; i++) {
    // Process left and right independently
    const processedL = this.processChannel(inputLeft[i], 'left');
    const processedR = this.processChannel(inputRight[i], 'right');

    outputLeft[i] = processedL;
    outputRight[i] = processedR;
  }

  return true;
}
```

### Pattern: Metering to UI

```javascript
// In processor
let frameCount = 0;

process(inputs, outputs) {
  // ... processing ...

  frameCount++;
  if (frameCount % 512 === 0) { // ~10ms at 48kHz
    this.port.postMessage({
      type: 'metering',
      data: {
        inputLevel: this.calculateRMS(inputLeft),
        outputLevel: this.calculateRMS(outputLeft),
        gainReduction: this.currentGR
      }
    });
  }

  return true;
}

// In UI
useEffect(() => {
  const audioNode = plugin?.audioNode?.workletNode;
  if (!audioNode?.port) return;

  audioNode.port.onmessage = (event) => {
    if (event.data.type === 'metering') {
      setMeterValues(event.data.data);
    }
  };

  return () => {
    if (audioNode?.port) audioNode.port.onmessage = null;
  };
}, [plugin]);
```

---

## 🐛 Troubleshooting

### Issue: No Audio Output

**Check:**
1. Worklet loaded? (Check console for errors)
2. `return true` at end of process()?
3. Input connected? (`inputs[0]` not empty?)
4. Mix parameter not at 0?

**Debug:**
```javascript
process(inputs, outputs) {
  console.log('Input:', inputs[0]?.[0]?.[0]); // First sample
  console.log('Output:', outputs[0]?.[0]?.[0]);
  // ... processing ...
}
```

### Issue: Parameters Not Updating

**Check:**
1. Message port connected?
2. Correct message format?
3. Parameter stored in processor?

**Debug:**
```javascript
// In processor
this.port.onmessage = (event) => {
  console.log('Received:', event.data);
  // ... handle message ...
};

// In UI
audioNode.port.postMessage({ type: 'test', data: 'hello' });
```

### Issue: Visualization Not Updating

**Check:**
1. `isPlaying` true?
2. Dependencies array correct?
3. Canvas size > 0?

**Debug:**
```javascript
const drawVisualization = useCallback((ctx, width, height) => {
  console.log('Draw called', { width, height, isPlaying });
  // ... drawing code ...
}, [isPlaying, /* ... */]);
```

### Issue: Performance Problems

**Check:**
1. Avoid allocations in process()
2. Use pre-allocated buffers
3. Minimize Math operations
4. Profile with performance.now()

**Fix:**
```javascript
// ❌ Bad: Allocates every call
process(inputs, outputs) {
  const buffer = new Float32Array(128); // BAD!
  // ...
}

// ✅ Good: Pre-allocated
constructor() {
  super();
  this.buffer = new Float32Array(128); // GOOD!
}

process(inputs, outputs) {
  // Use this.buffer
}
```

---

## 📚 Next Steps

1. Read [PLUGIN_STANDARDIZATION_GUIDE.md](./PLUGIN_STANDARDIZATION_GUIDE.md) for architecture details
2. Study existing plugins (Compressor, Saturator, OTT)
3. Experiment with DSP algorithms
4. Share your plugin with the community!

---

## 💡 Tips

- **Start simple**: Get basic parameter control working first
- **Test frequently**: Check audio output after each change
- **Use presets**: They help you understand parameter ranges
- **Optimize later**: Get it working, then make it fast
- **Learn from examples**: Study existing plugins in the codebase

---

## 🆘 Getting Help

- Check console for errors
- Review [Web Audio API docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- Study template comments
- Ask in project discussions

---

**Happy Plugin Development! 🎉**
