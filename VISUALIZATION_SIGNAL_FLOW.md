# 🔊 VisualizationEngine Signal Flow

## Overview

VisualizationEngine'a sinyal **iki yolla** götürülüyor:

1. **Audio Data**: MeteringService üzerinden (spectrum, waveform, peak, RMS)
2. **Plugin Parameters**: React props/state üzerinden (drive, mix, tone, vb.)

---

## 🎯 Method 1: Audio Data (Real-time Audio Signal)

### Flow Diagram
```
Audio Source (track/effect output)
    ↓
AudioContextService.createAnalyserNode()
    ↓
AnalyserNode (FFT processing)
    ↓
MeteringService.subscribe(meterId, callback)
    ↓
PluginVisualizerAPI.subscribeToAudioData(pluginId, meterId)
    ↓
entry.params = { ...entry.params, audioData }
    ↓
visualizer.lastParams = entry.params
    ↓
VisualizationEngine.renderLoop()
    ↓
visualizer.render(timestamp, params)
```

### Code Example

#### Step 1: AudioContextService creates AnalyserNode
```javascript
// AudioContextService.js
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;
analyser.smoothingTimeConstant = 0.8;
audioNode.connect(analyser); // Tap signal (non-destructive)
```

#### Step 2: MeteringService polls AnalyserNode
```javascript
// MeteringService.js
const update = () => {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray); // Get spectrum

  const audioData = {
    data: dataArray,
    peak: calculatePeak(dataArray),
    rms: calculateRMS(dataArray)
  };

  // Broadcast to all subscribers
  subscribers.forEach(callback => callback(audioData));
};

setInterval(update, 16); // ~60 Hz polling
```

#### Step 3: PluginVisualizerAPI subscribes
```javascript
// PluginVisualizerAPI.js
subscribeToAudioData(pluginId, meterId, config = {}) {
  const entry = this.visualizers.get(pluginId);

  const unsubscribe = MeteringService.subscribe(
    meterId,
    (audioData) => {
      // Add audio data to params
      entry.params = {
        ...entry.params,
        audioData  // { data: Uint8Array, peak: -12, rms: -18 }
      };
    },
    config
  );
}
```

#### Step 4: VisualizationEngine reads params
```javascript
// VisualizationEngine.js (renderLoop)
const params = viz.instance.lastParams || {};
viz.instance.render?.(timestamp, params);
```

#### Step 5: Visualizer uses audio data
```javascript
// MyVisualizer.js
onRenderCanvas(ctx, timestamp, params) {
  const { audioData } = params;

  if (audioData) {
    const { data, peak, rms } = audioData;

    // Draw spectrum
    data.forEach((value, i) => {
      const x = i * barWidth;
      const y = height - (value / 255) * height;
      ctx.fillRect(x, y, barWidth, height - y);
    });
  }
}
```

---

## 🎛️ Method 2: Plugin Parameters (UI State)

### Flow Diagram
```
React Component (UI state)
    ↓
onChange handler
    ↓
effect.settings updated
    ↓
useEffect (watch settings)
    ↓
PluginVisualizerAPI.updateParams(pluginId, params)
    ↓
entry.params = { ...entry.params, ...params }
    ↓
visualizer.lastParams = entry.params
    ↓
VisualizationEngine.renderLoop()
    ↓
visualizer.render(timestamp, params)
```

### Code Example

#### Step 1: UI updates parameters
```javascript
// SaturatorUI.jsx
const handleDriveChange = (value) => {
  onChange('distortion', value); // Update effect settings
};

<ProfessionalKnob
  value={distortion}
  onChange={handleDriveChange}
/>
```

#### Step 2: useEffect watches params
```javascript
// SaturatorUI.jsx (PluginCanvas wrapper)
useEffect(() => {
  if (visualizerRef.current) {
    PluginVisualizerAPI.updateParams(pluginId, {
      drive: distortion * 100,
      mix: wet,
      tone: 0.5,
      inputLevel
    });
  }
}, [pluginId, distortion, wet, inputLevel]);
```

#### Step 3: PluginVisualizerAPI updates params
```javascript
// PluginVisualizerAPI.js
updateParams(pluginId, params) {
  const entry = this.visualizers.get(pluginId);

  // Merge with existing params
  entry.params = { ...entry.params, ...params };

  // Update visualizer's lastParams
  entry.visualizer.lastParams = entry.params;

  // Request render
  entry.visualizer.requestRender();
}
```

#### Step 4: VisualizationEngine renders
```javascript
// VisualizationEngine.js (renderLoop - 60 FPS)
renderLoop(timestamp) {
  this.renderQueue[priority].forEach(effectId => {
    const viz = this.visualizers.get(effectId);
    const params = viz.instance.lastParams || {};

    viz.instance.render?.(timestamp, params);
  });

  requestAnimationFrame(this.renderLoop);
}
```

#### Step 5: Visualizer uses params
```javascript
// TubeGlowVisualizer.js
onRenderAnimated(ctx, timestamp, deltaTime, params) {
  const { drive, mix, tone, inputLevel } = params;

  // Calculate intensity
  const distortion = drive / 100;
  const normalizedInput = (inputLevel + 60) / 60;
  const intensity = normalizedInput * distortion * mix;

  // Draw glow based on intensity
  this.drawGlow(ctx, intensity);
}
```

---

## 🔥 Saturator Example: Combined Flow

### Saturator Uses BOTH Methods

```javascript
// SaturatorUI.jsx
<PluginCanvas
  pluginId={`${pluginId}-tube-glow`}
  visualizerClass={TubeGlowVisualizer}
  priority="normal"
  params={{
    // Method 2: Plugin parameters
    drive: distortion * 100,
    mix: wet,
    tone: 0.5,

    // Method 1: Audio data (from MeteringService)
    inputLevel  // ← subscribed via useEffect
  }}
/>
```

### Input Level Subscription
```javascript
// SaturatorUI.jsx
const [inputLevel, setInputLevel] = useState(-60);

useEffect(() => {
  const meterId = `${trackId}-input`;

  const handleLevel = (data) => {
    setInputLevel(data.peak || -60);
  };

  const unsubscribe = MeteringService.subscribe(meterId, handleLevel);
  return unsubscribe;
}, [trackId]);
```

### TubeGlowVisualizer Rendering
```javascript
// TubeGlowVisualizer.js
onRenderAnimated(ctx, timestamp, deltaTime, params) {
  const { drive, mix, tone, inputLevel } = params;

  // Combine plugin params + audio data
  const distortion = drive / 100;           // ← Plugin param
  const normalizedInput = (inputLevel + 60) / 60;  // ← Audio data
  const intensity = normalizedInput * distortion * mix;

  // Draw animated tube glow
  const pulse = this.getSineWave(0.05); // ← Animation helper
  this.drawFilaments(ctx, intensity, pulse);
}
```

---

## 🎨 Complete Signal Flow (Saturator Example)

```
┌─────────────────────────────────────────────────────────────┐
│  TRACK AUDIO OUTPUT                                         │
│  (kick drum playing)                                        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ├─────────────────────────────────────────┐
                   │                                         │
                   ▼                                         ▼
    ┌──────────────────────────┐           ┌────────────────────────┐
    │  Saturator Effect        │           │  AnalyserNode          │
    │  (distortion processing) │           │  (FFT analysis)        │
    └──────────────┬───────────┘           └─────────┬──────────────┘
                   │                                  │
                   ▼                                  ▼
    ┌──────────────────────────┐           ┌────────────────────────┐
    │  AUDIO OUTPUT            │           │  MeteringService       │
    │  (to mixer/speakers)     │           │  - getByteFrequencyData│
    └──────────────────────────┘           │  - Calculate peak/RMS  │
                                            └─────────┬──────────────┘
                                                      │
                   ┌──────────────────────────────────┤
                   │                                  │
                   ▼                                  ▼
    ┌──────────────────────────┐           ┌────────────────────────┐
    │  UI State (React)        │           │  Audio Data Callback   │
    │  - drive: 0.4            │           │  { peak: -12,          │
    │  - mix: 1.0              │           │    rms: -18,           │
    │  - tone: 0.5             │           │    data: Uint8Array }  │
    └──────────────┬───────────┘           └─────────┬──────────────┘
                   │                                  │
                   └──────────────┬───────────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────────┐
                   │  PluginVisualizerAPI            │
                   │  updateParams(pluginId, {       │
                   │    drive: 40,                   │
                   │    mix: 1.0,                    │
                   │    tone: 0.5,                   │
                   │    inputLevel: -12  ← audio data│
                   │  })                             │
                   └──────────────┬──────────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────────┐
                   │  Visualizer.lastParams          │
                   │  { drive: 40, mix: 1.0,         │
                   │    tone: 0.5, inputLevel: -12 } │
                   └──────────────┬──────────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────────┐
                   │  VisualizationEngine            │
                   │  RAF Loop (60 FPS)              │
                   │  renderLoop(timestamp) {        │
                   │    params = viz.lastParams;     │
                   │    viz.render(timestamp, params)│
                   │  }                              │
                   └──────────────┬──────────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────────┐
                   │  TubeGlowVisualizer             │
                   │  onRenderAnimated(ctx, ts, params) │
                   │  {                              │
                   │    intensity = params.inputLevel│
                   │              * params.drive     │
                   │              * params.mix;      │
                   │    drawGlow(ctx, intensity);    │
                   │  }                              │
                   └──────────────┬──────────────────┘
                                  │
                                  ▼
                   ┌─────────────────────────────────┐
                   │  CANVAS DISPLAY                 │
                   │  🔥 Animated tube glow          │
                   │  - Intensity from audio         │
                   │  - Drive from knob              │
                   │  - Flicker animation (sine)     │
                   └─────────────────────────────────┘
```

---

## 📊 Performance: Why This is Efficient

### Old System (Per-Plugin RAF)
```javascript
// Every plugin has its own RAF loop
useEffect(() => {
  let animationId;

  const animate = () => {
    // Draw logic
    animationId = requestAnimationFrame(animate);
  };

  animate();
  return () => cancelAnimationFrame(animationId);
}, [params]);

// Problem: 10 plugins = 10 RAF loops = 10x overhead
```

### New System (Centralized RAF)
```javascript
// VisualizationEngine: Single RAF loop for ALL plugins
renderLoop(timestamp) {
  // Critical priority (focused plugin): render every frame
  // Normal priority: render every 2 frames (30 FPS)
  // Low priority: render only on param change

  this.visualizers.forEach(viz => {
    if (shouldRender(viz, timestamp)) {
      const params = viz.instance.lastParams;
      viz.instance.render(timestamp, params);
    }
  });

  requestAnimationFrame(this.renderLoop);
}

// Benefit: 10 plugins = 1 RAF loop = 90% less overhead
```

---

## 🎯 Key Takeaways

1. **Audio Data**: MeteringService → PluginVisualizerAPI → params
2. **UI State**: React → PluginVisualizerAPI → params
3. **Both Merged**: `entry.params = { ...uiParams, ...audioData }`
4. **Centralized Render**: VisualizationEngine single RAF loop
5. **Priority System**: Critical (60fps), Normal (30fps), Low (on-demand)

**Result**: Scalable, performant visualization system that can handle 50+ plugins without FPS drop! 🚀
