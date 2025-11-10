# Real Audio Visualization Architecture

## Overview

DAWG's visualization system now connects directly to **real audio signals** from effects via Web Audio API AnalyserNodes, eliminating all fake simulation.

## Architecture

```
Effect AudioWorkletNode
       ↓
   [tap connection]
       ↓
  AnalyserNode (FFT analysis)
       ↓
VisualizationEngine.getAnalyser()
       ↓
PluginVisualizerAPI.register()
       ↓
TubeGlowVisualizer.analyser
       ↓
getAudioLevel() → RMS calculation
       ↓
Real-time visual intensity
```

## Key Components

### 1. AudioContextService
**File:** `client/src/lib/services/AudioContextService.js`

New methods:
```javascript
// Get effect's audio node for visualization
static getEffectAudioNode(trackId, effectId)

// Get channel's output node
static getChannelAudioNode(trackId)
```

### 2. VisualizationEngine
**File:** `client/src/lib/visualization/VisualizationEngine.js`

```javascript
getAnalyser(effectId, audioNode, type = 'spectrum') {
  // Creates AnalyserNode if not exists
  // Connects: audioNode → analyser (tap, doesn't affect signal)
  // Pools analyser nodes for efficiency
  // Tracks memory usage
}
```

**Analyser Configs:**
- `spectrum`: FFT 2048, smoothing 0.8 (frequency analysis)
- `waveform`: FFT 1024, smoothing 0.3 (time-domain, used for Saturator)
- `meter`: FFT 512, smoothing 0.5 (level metering)

### 3. PluginVisualizerAPI
**File:** `client/src/lib/visualization/PluginVisualizerAPI.js`

Connects analyser when registering visualizer:
```javascript
register(pluginId, config) {
  const { audioNode, ... } = config;

  // 🎵 Connect audio analyser if audioNode provided
  if (audioNode) {
    const analyser = visualizationEngine.getAnalyser(
      pluginId,
      audioNode,
      'waveform'
    );
    visualizerInstance.analyser = analyser;
  }
}
```

### 4. TubeGlowVisualizer
**File:** `client/src/lib/visualization/plugin-visualizers/TubeGlowVisualizer.js`

Real-time audio level calculation:
```javascript
getAudioLevel() {
  if (!this.analyser) return -60;

  // Get time-domain samples
  this.analyser.getFloatTimeDomainData(this.audioBuffer);

  // Calculate RMS (Root Mean Square)
  let sum = 0;
  for (let i = 0; i < this.audioBuffer.length; i++) {
    sum += this.audioBuffer[i] * this.audioBuffer[i];
  }
  const rms = Math.sqrt(sum / this.audioBuffer.length);

  // Convert to dB scale (-60 to 0)
  const db = 20 * Math.log10(Math.max(rms, 0.00001));
  return Math.max(-60, Math.min(0, db));
}

onRenderAnimated(ctx, timestamp, deltaTime, params) {
  const realInputLevel = this.getAudioLevel(); // -60 to 0 dB
  const normalizedInput = (realInputLevel + 60) / 60; // 0 to 1

  // Combine input level with drive for visual intensity
  const baseIntensity = Math.max(distortion * 0.3, normalizedInput);
  const intensity = baseIntensity * distortion * mix;

  // ... render with real audio intensity
}
```

### 5. PluginCanvas Component
**File:** `client/src/components/plugins/common/PluginCanvas.jsx`

Now accepts `audioNode` prop:
```javascript
export const PluginCanvas = React.memo(({
  pluginId,
  visualizerClass,
  params,
  priority = 'normal',
  audioNode = null // ← NEW
}) => {
  // Pass audioNode to PluginVisualizerAPI
  const visualizer = PluginVisualizerAPI.register(pluginId, {
    canvas: canvasRef.current,
    visualizer: visualizerClass,
    priority,
    params,
    audioNode // ← Pass through
  });
});
```

### 6. SaturatorUI Integration
**File:** `client/src/components/plugins/effects/SaturatorUI.jsx`

```javascript
export const SaturatorUI = ({ trackId, effect, onChange }) => {
  // 🎵 Get audio node for real-time visualization
  const audioNode = useMemo(() => {
    return AudioContextService.getEffectAudioNode(trackId, effect.id);
  }, [trackId, effect.id]);

  return (
    <PluginCanvas
      pluginId={`${pluginId}-tube-glow`}
      visualizerClass={TubeGlowVisualizer}
      priority="normal"
      params={tubeGlowParams}
      audioNode={audioNode} // ← Pass real audio node
    />
  );
};
```

## Signal Flow

### Before (Fake Simulation)
```
User changes drive knob
       ↓
inputLevel = Math.random() * drive / 100
       ↓
Visual intensity (not related to actual audio)
```

### After (Real Audio)
```
Audio flows through effect AudioWorkletNode
       ↓
AnalyserNode taps signal (doesn't affect audio path)
       ↓
getFloatTimeDomainData() → samples
       ↓
RMS calculation → dB level
       ↓
Visual intensity (responsive to actual audio signal)
```

## Performance Characteristics

### Zero Audio Latency
- AnalyserNode is a **tap connection** (doesn't affect audio path)
- Signal flows: Effect → Output (unchanged)
- Analyser reads in parallel (no processing delay)

### Efficient Memory Usage
- Analyser nodes are **pooled** (1 per effect)
- FFT 1024 for waveform = ~4KB per analyser
- Grace period caching prevents duplicate nodes in React StrictMode

### Visual Responsiveness
- 60fps animation loop via requestAnimationFrame
- Real-time RMS calculation every frame
- Smooth intensity transitions via drive/mix parameters

## Testing

### How to Test Real Audio Connection

1. **Open Saturator on a track:**
   ```
   Mixer → Track → Effects Rack → Add Saturator
   ```

2. **Play audio and observe:**
   - Tube glow should pulse with actual audio intensity
   - No audio = dim glow (only drive base intensity)
   - Loud audio = bright glow (driven by RMS level)

3. **Check console logs:**
   ```
   🔊 Created analyser: saturator-track-1-tube-glow (FFT: 1024, 0.00MB)
   🎨 VisualizationEngine initialized
   📊 Registered visualizer: saturator-track-1-tube-glow (normal)
   ```

4. **Verify analyser connection:**
   - Open browser DevTools → Console
   - Type: `window.visualizationEngine.analyserPool`
   - Should see Map with analyser nodes

### Expected Behavior

✅ **Working correctly:**
- Glow intensity increases with louder audio
- Glow dims during silence
- Drive knob sets minimum base intensity
- Mix knob affects overall intensity

❌ **Not working (old fake simulation):**
- Glow doesn't respond to audio
- Intensity only changes with knob adjustments
- Random flickering unrelated to signal

## No MeteringService Dependency

**Design Decision:** VisualizationEngine is **self-contained** with no external dependencies.

### Why Separate from MeteringService?

1. **Different Use Cases:**
   - MeteringService: UI feedback (mixer VU meters, peak indicators)
   - VisualizationEngine: Plugin graphics (artistic visualizations)

2. **Different Update Rates:**
   - MeteringService: ~20-30fps (UI meters)
   - VisualizationEngine: 60fps (smooth animations)

3. **Different Data Needs:**
   - MeteringService: RMS, peak levels (simple)
   - VisualizationEngine: FFT, waveforms, custom analysis (complex)

4. **Independence:**
   - Each plugin creates its own analyser via VisualizationEngine
   - No centralized publish/subscribe overhead
   - Direct connection to effect audio nodes

### Architecture Separation

```
                    AudioEngine
                         |
        +----------------+----------------+
        ↓                                 ↓
   MixerChannels                    Effect Nodes
        ↓                                 ↓
  MeteringService              VisualizationEngine
  (publish levels)             (create analysers)
        ↓                                 ↓
   UI Meters                    Plugin Visualizers
```

## Next Steps

1. **Apply to Other Plugins:**
   - Compressor: Gain reduction visualization
   - EQ: Frequency spectrum analyzer
   - Reverb: Impulse response display
   - Delay: Echo visualization

2. **Advanced Visualizations:**
   - Spectrum analyzer (frequency domain)
   - Oscilloscope (time domain)
   - Lissajous curves (stereo phase)
   - Vectorscope (stereo imaging)

3. **Performance Optimizations:**
   - Offscreen canvas for complex rendering
   - WebGL for particle effects
   - Adaptive quality scaling based on CPU load

## Summary

✅ **Achieved:**
- Direct audio connection via AnalyserNodes
- Real-time RMS calculation for visual intensity
- Zero-latency tap connection (doesn't affect audio)
- Efficient memory pooling
- React StrictMode compatibility
- Complete separation from MeteringService

🎯 **Result:**
Plugin visualizations now respond to **actual audio signals** in real-time, providing accurate visual feedback that reflects the true sonic character of the effect.
