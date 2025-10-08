# 🔌 4 Modernized Plugin Analizi

## 🎯 Hedef
4 yenilenmiş plugin'i (Saturator, ModernReverb, ModernDelay, MultiBandEQ) yeni VisualizationEngine sistemine geçirmek ve paketlenebilir plugin haline getirmek.

---

## 📊 Plugin Envanter

### 1. **Saturator** 🔥
**UI**: `components/plugins/effects/SaturatorUI.jsx`
**Worklet**: `public/worklets/effects/saturator-processor.js`
**Visualization**: Custom canvas-based (TubeGlowVisualizer + HarmonicAnalyzer)

**Parametreler**:
```javascript
{
  drive: 0-100 (distortion amount),
  mix: 0-1 (wet/dry),
  tone: 0-1 (filter cutoff),
  type: 'tube' | 'tape' | 'transistor'
}
```

**Visualizer Özellikleri**:
- **TubeGlowVisualizer**: Tube glow animation (custom RAF loop)
  - Distortion intensity-based glow
  - 3 filament rendering
  - Flicker effect
- **HarmonicAnalyzer**: Harmonic content bars (static)
  - 6 harmonics visualization
  - Distortion-based amplitude

**Durum**: ⚠️ 2 custom RAF loop (TubeGlow, HarmonicAnalyzer)

---

### 2. **ModernReverb** 🌊
**UI**: `components/plugins/effects/ModernReverbUI.jsx`
**Worklet**: `public/worklets/effects/reverb-processor.js`
**Visualization**: Custom canvas + SignalVisualizer

**Parametreler**:
```javascript
{
  decay: 0.1-10 (reverb time),
  damping: 0-1 (high freq damping),
  earlyLateMix: 0-1 (early/late reflection mix),
  size: 0-1 (room size),
  stereoWidth: 0-1 (stereo spread),
  mix: 0-1 (wet/dry)
}
```

**Visualizer Özellikleri**:
- **DecayEnvelopeVisualizer**: Decay envelope curve (custom RAF loop)
  - Early reflections markers
  - Decay + damping curve
  - Pulse animation
- **SignalVisualizer**: Reverb spectrum (MeteringService)

**Durum**: ⚠️ 1 custom RAF loop + 1 SignalVisualizer RAF

---

### 3. **ModernDelay** ⏱️
**UI**: `components/plugins/effects/ModernDelayUI.jsx`
**Worklet**: `public/worklets/effects/delay-processor.js`
**Visualization**: Custom canvas + SignalVisualizer

**Parametreler**:
```javascript
{
  timeLeft: 0-2 (left delay time in seconds),
  timeRight: 0-2 (right delay time in seconds),
  feedbackLeft: 0-0.95 (left feedback),
  feedbackRight: 0-0.95 (right feedback),
  pingPong: 0-1 (ping-pong amount),
  filterFreq: 20-20000 (filter cutoff),
  saturation: 0-1 (feedback saturation),
  modDepth: 0-1 (modulation depth),
  modRate: 0-10 (modulation rate),
  mix: 0-1 (wet/dry)
}
```

**Visualizer Özellikleri**:
- **PingPongVisualizer**: Stereo delay lines (custom RAF loop)
  - Left/right delay visualization
  - Ping-pong arrows
  - Feedback decay animation
- **SignalVisualizer**: Delay output spectrum

**Durum**: ⚠️ 1 custom RAF loop + 1 SignalVisualizer RAF

---

### 4. **MultiBandEQ** 🎚️
**UI**: `components/plugins/effects/AdvancedEQUI.jsx`
**Worklet**: `public/worklets/effects/multiband-eq-processor-v2.js`
**Visualization**: Custom canvas (EQ curve + nodes)

**Parametreler**:
```javascript
{
  bands: [
    {
      id: 'band-1',
      type: 'peaking' | 'lowshelf' | 'highshelf' | 'notch' | 'lowpass' | 'highpass',
      frequency: 20-20000,
      gain: -24 to +24,
      q: 0.1-18,
      active: boolean
    }
    // ... dynamic 1-8 bands
  ],
  wet: 0-1,
  output: 0-2
}
```

**Visualizer Özellikleri**:
- **EQ Canvas**: Interactive EQ curve (custom RAF loop)
  - Frequency response curve
  - Draggable band nodes
  - Grid overlay
  - Keyboard shortcuts (Shift, Alt)
  - Mousewheel support
  - Boundary constraints
- **SignalVisualizer**: Spectrum overlay (optional)

**Durum**: ⚠️ 1 custom RAF loop + 1 optional SignalVisualizer RAF

---

## 🚨 Mevcut Problemler

### 1. **RAF Loop Proliferation**
```
Saturator:     2 RAF loops (TubeGlow + Harmonic)
ModernReverb:  2 RAF loops (DecayEnvelope + SignalViz)
ModernDelay:   2 RAF loops (PingPong + SignalViz)
MultiBandEQ:   1-2 RAF loops (EQCanvas + optional SignalViz)
───────────────────────────────────────────────
TOPLAM:        7-8 RAF loops (sadece 4 plugin için!)
```

**Sonuç**: 50 plugin açıldığında **87-100 RAF loop** = FPS crash

### 2. **No Priority System**
- Focused plugin = 60 FPS
- Background plugin = 60 FPS (gereksiz)
- CPU waste

### 3. **No Memory Management**
- Her plugin kendi canvas'ını yönetiyor
- Canvas leak riski
- Memory tracking yok

### 4. **No Package Structure**
- Plugin UI, worklet, parameters hepsi ayrı dosyalarda
- Import path karmaşık
- SDK ready değil

---

## ✅ Hedef Mimari (Plugin SDK)

```
plugins/
├── saturator/
│   ├── index.js                    (plugin manifest)
│   ├── SaturatorPlugin.jsx         (plugin class)
│   ├── saturator-processor.js      (worklet)
│   ├── visualizers/
│   │   ├── TubeGlowVisualizer.js   (VisualizationEngine-based)
│   │   └── HarmonicVisualizer.js   (VisualizationEngine-based)
│   └── README.md                   (plugin docs)
│
├── modern-reverb/
│   ├── index.js
│   ├── ModernReverbPlugin.jsx
│   ├── reverb-processor.js
│   ├── visualizers/
│   │   └── DecayEnvelopeVisualizer.js
│   └── README.md
│
├── modern-delay/
│   ├── index.js
│   ├── ModernDelayPlugin.jsx
│   ├── delay-processor.js
│   ├── visualizers/
│   │   └── PingPongVisualizer.js
│   └── README.md
│
└── multiband-eq/
    ├── index.js
    ├── MultiBandEQPlugin.jsx
    ├── multiband-eq-processor-v2.js
    ├── visualizers/
    │   └── EQCurveVisualizer.js
    └── README.md
```

---

## 🏗️ Plugin Manifest Örneği

```javascript
// plugins/saturator/index.js
export default {
  id: 'saturator',
  name: 'Saturator',
  version: '1.0.0',
  author: 'DAWG Audio',
  category: 'distortion',

  // Worklet
  worklet: {
    path: '/worklets/effects/saturator-processor.js',
    processorName: 'saturator-processor'
  },

  // Parameters
  parameters: [
    { name: 'drive', defaultValue: 50, minValue: 0, maxValue: 100, unit: '%' },
    { name: 'mix', defaultValue: 1, minValue: 0, maxValue: 1, unit: 'ratio' },
    { name: 'tone', defaultValue: 0.5, minValue: 0, maxValue: 1, unit: 'ratio' },
    { name: 'type', defaultValue: 'tube', options: ['tube', 'tape', 'transistor'] }
  ],

  // UI Component
  ui: SaturatorPlugin,

  // Visualizers
  visualizers: [
    {
      id: 'tube-glow',
      type: 'custom',
      priority: 'normal',
      component: TubeGlowVisualizer
    },
    {
      id: 'harmonic',
      type: 'custom',
      priority: 'low',
      component: HarmonicVisualizer
    }
  ],

  // Presets
  presets: [
    { name: 'Warm Tube', drive: 30, mix: 0.7, tone: 0.6, type: 'tube' },
    { name: 'Tape Crush', drive: 70, mix: 0.9, tone: 0.4, type: 'tape' },
    { name: 'Hard Clip', drive: 100, mix: 1.0, tone: 0.8, type: 'transistor' }
  ]
};
```

---

## 🎯 Migration Stratejisi

### Phase 1: VisualizationEngine API (Dün yaptık)
- [x] PluginVisualizerAPI wrapper
- [x] Priority system entegrasyonu
- [x] Budget control

### Phase 2: Base Visualizer Classes (Şimdi)
- [ ] BasePluginVisualizer (abstract class)
- [ ] CanvasPluginVisualizer (2D base)
- [ ] WebGLPluginVisualizer (3D base)
- [ ] AnimatedPluginVisualizer (RAF-managed)

### Phase 3: Migrate 4 Plugins (Sırayla)
- [ ] **Saturator**: 2 custom visualizer → VisualizationEngine
- [ ] **ModernReverb**: 1 custom + 1 SignalViz → VisualizationEngine
- [ ] **ModernDelay**: 1 custom + 1 SignalViz → VisualizationEngine
- [ ] **MultiBandEQ**: 1 custom + 1 optional SignalViz → VisualizationEngine

### Phase 4: Plugin Packaging
- [ ] Create plugin manifest structure
- [ ] Move to `plugins/` folder
- [ ] Update import paths
- [ ] Create plugin registry

### Phase 5: Documentation
- [ ] Plugin development guide
- [ ] Visualizer API docs
- [ ] Migration examples

---

## 📝 Detaylı Plugin Analizi

### Saturator - Özel Dikkat Noktaları

**Visualizer 1: TubeGlowVisualizer**
- **Animasyon**: Filament flicker (sin wave)
- **Input**: `distortion`, `inputLevel`, `wet`
- **RAF Loop**: Custom (kendi time tracking)
- **Canvas**: Dynamic resize
- **Performance**: ~2-3ms/frame

**Migration Stratejisi**:
```javascript
class TubeGlowVisualizer extends AnimatedPluginVisualizer {
  constructor(config) {
    super({
      ...config,
      priority: 'normal',
      targetFPS: 60
    });
    this.time = 0;
  }

  onRender(ctx, timestamp, params) {
    const { distortion, inputLevel, wet } = params;
    // Mevcut çizim kodu buraya
    // RAF loop VisualizationEngine tarafından yönetilir
  }
}
```

**Visualizer 2: HarmonicAnalyzer**
- **Animasyon**: Yok (statik bars)
- **Input**: `distortion`
- **RAF Loop**: Gereksiz (sadece param değişince güncelle)
- **Canvas**: Static

**Migration Stratejisi**:
```javascript
class HarmonicVisualizer extends CanvasPluginVisualizer {
  onParameterChange(param, value) {
    if (param === 'distortion') {
      this.requestRender(); // Sadece distortion değişince render
    }
  }

  onRender(ctx, params) {
    const { distortion } = params;
    // Mevcut harmonic bar çizimi
  }
}
```

---

### ModernReverb - Özel Dikkat Noktaları

**Visualizer: DecayEnvelopeVisualizer**
- **Animasyon**: Pulse effect (subtle)
- **Input**: `decay`, `damping`, `earlyLateMix`, `size`
- **RAF Loop**: Custom (pulse animation)
- **Canvas**: Dynamic resize
- **Performance**: ~1-2ms/frame

**Özel Özellikler**:
- Early reflection markers (8 adet)
- Decay curve calculation (exponential)
- Damping factor (frequency-dependent simulation)

**Migration Stratejisi**:
```javascript
class DecayEnvelopeVisualizer extends AnimatedPluginVisualizer {
  constructor(config) {
    super({
      ...config,
      priority: 'normal',
      targetFPS: 30 // Pulse animation 30fps yeterli
    });
  }

  onRender(ctx, timestamp, params) {
    const { decay, damping, earlyLateMix, size } = params;
    this.drawDecayCurve(ctx, decay, damping);
    this.drawEarlyReflections(ctx, earlyLateMix);
    // Pulse effect timestamp-based
  }
}
```

---

### ModernDelay - Özel Dikkat Noktaları

**Visualizer: PingPongVisualizer**
- **Animasyon**: Delay tap animation (moving dots)
- **Input**: `timeLeft`, `timeRight`, `feedbackLeft`, `feedbackRight`, `pingPong`, `wet`
- **RAF Loop**: Custom (tap animation)
- **Canvas**: Dynamic resize
- **Performance**: ~2ms/frame

**Özel Özellikler**:
- Stereo delay lines (L/R visualization)
- Ping-pong arrows (animated)
- Feedback decay circles (expanding)
- Tempo sync marks (optional)

**Migration Stratejisi**:
```javascript
class PingPongVisualizer extends AnimatedPluginVisualizer {
  constructor(config) {
    super({
      ...config,
      priority: 'normal',
      targetFPS: 60 // Animation smooth olmalı
    });
    this.delayTaps = { left: [], right: [] };
  }

  onRender(ctx, timestamp, params) {
    const { timeLeft, timeRight, feedbackLeft, feedbackRight, pingPong, wet } = params;
    this.updateDelayTaps(timestamp, params);
    this.drawDelayLines(ctx, params);
    this.drawPingPongArrows(ctx, pingPong);
    this.drawFeedbackCircles(ctx, timestamp);
  }
}
```

---

### MultiBandEQ - Özel Dikkat Noktaları

**Visualizer: EQ Canvas**
- **Animasyon**: Minimal (sadece interaction feedback)
- **Input**: `bands` (dynamic array), `wet`, `output`
- **RAF Loop**: Custom (continuous redraw)
- **Canvas**: Interactive (mouse events)
- **Performance**: ~3-5ms/frame (complex curve calculation)

**Özel Özellikler**:
- **Interactive**: Drag, mousewheel, keyboard shortcuts
- **Complex calculations**: EQ response curve (6 filter types)
- **Dynamic band count**: 1-8 bands
- **State management**: Active band, hover, drag modes

**Migration Stratejisi**:
```javascript
class EQCurveVisualizer extends CanvasPluginVisualizer {
  constructor(config) {
    super({
      ...config,
      priority: 'critical', // Interactive = always 60fps
      interactive: true     // Mouse event support
    });
    this.activeBand = null;
    this.dragState = null;
  }

  onRender(ctx, params) {
    const { bands } = params;
    this.drawGrid(ctx);
    this.drawResponseCurve(ctx, bands);
    this.drawBandNodes(ctx, bands, this.activeBand);
  }

  onMouseDown(e) {
    // Handle band selection & drag start
  }

  onMouseMove(e) {
    // Handle drag or hover
    if (this.dragState) {
      this.updateBandPosition(e);
      this.requestRender(); // Immediate render on interaction
    }
  }

  onWheel(e) {
    // Handle mousewheel fine-tuning
    this.adjustBandParameter(e);
  }
}
```

---

## ⚡ Performance Hedefleri

### Mevcut (4 plugin, 7-8 RAF loops)
```
Frame budget: 16.67ms (60 FPS)
Saturator:     2-3ms × 2 visualizers = 4-6ms
ModernReverb:  1-2ms + 1-2ms = 2-4ms
ModernDelay:   2ms + 1-2ms = 3-4ms
MultiBandEQ:   3-5ms + 1-2ms = 4-7ms
──────────────────────────────────────
TOPLAM:        13-21ms (over budget!)
Result:        47-60 FPS (dalgalı)
```

### Hedef (4 plugin, VisualizationEngine)
```
Frame budget: 16.67ms (60 FPS)
VisualizationEngine overhead: 0.5ms
─ Critical priority (focused plugin):
  MultiBandEQ: 3-5ms (interactive)
─ Normal priority (visible plugins):
  Saturator:   2-3ms (tube glow)
  ModernReverb: 1-2ms (decay envelope)
  ModernDelay: 2ms (ping-pong)
─ Low priority (background):
  HarmonicAnalyzer: 0.5ms (static bars)
──────────────────────────────────────
TOPLAM:        9-13.5ms (under budget)
Result:        60 FPS (stable) ✅
```

**İyileşme**: +20% performance, stable 60 FPS

---

## 🎯 Sonraki Adımlar

1. **PluginVisualizerAPI.js** oluştur (wrapper layer)
2. **Base visualizer classes** yarat (BasePluginVisualizer, CanvasPluginVisualizer, AnimatedPluginVisualizer)
3. **Saturator migrate et** (first plugin, test case)
4. **ModernReverb migrate et**
5. **ModernDelay migrate et**
6. **MultiBandEQ migrate et** (en kompleks, son)
7. **Plugin packaging** yap (manifest + folder structure)
8. **Documentation** yaz

**Tahmini**: 8-12 saat toplam

**Başlıyoruz! 🚀**
