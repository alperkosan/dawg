# 🎨 Plugin SDK - Visualization Architecture Design

## 🎯 Hedef

Kullanıcıların kendi pluginlerini yaratabilmesi için **scalable, performant, merkezi** visualization sistemi.

---

## 🚨 Sorun: Mevcut SignalVisualizer

### Şu Anki Durum (14 plugin)
```javascript
// Her plugin kendi RAF loop
<SignalVisualizer meterId="fx-1" />  // RAF loop #1
<SignalVisualizer meterId="fx-2" />  // RAF loop #2
<SignalVisualizer meterId="fx-3" />  // RAF loop #3
// ... 14 RAF loop

// 14 plugin × 16.67ms = 233ms/frame → CRASH!
```

### Kullanıcı 50 Custom Plugin Açarsa
```
50 RAF loop × avg 3ms = 150ms/frame
Target: 16.67ms/frame (60 FPS)
Result: 10 FPS → kullanılamaz!
```

---

## ✅ Çözüm: VisualizationEngine + Plugin API

### Merkezi Render Loop
```javascript
// Tek RAF loop tüm pluginler için
visualizationEngine.renderLoop() {
  // Priority-based rendering
  critical plugins:  60 FPS (focused)
  normal plugins:    30 FPS (visible)
  low plugins:       15 FPS (background)
}

// 50 plugin × 0.5ms = 25ms/frame
// Budget aşımı → auto-throttle → 60 FPS korunur
```

---

## 🏗️ Yeni Mimari

```
┌─────────────────────────────────────────────────────────┐
│                    PLUGIN SDK                            │
│                                                          │
│  User Custom Plugin:                                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  class MyPlugin {                                │   │
│  │    createVisualizer() {                          │   │
│  │      return new PluginVisualizer({               │   │
│  │        meterId: this.id,                         │   │
│  │        type: 'spectrum',                         │   │
│  │        priority: 'normal',                       │   │
│  │        drawMode: 'webgl',  // or 'canvas'       │   │
│  │        onRender: (ctx, data) => { /* custom */ } │   │
│  │      });                                         │   │
│  │    }                                             │   │
│  │  }                                               │   │
│  └─────────────────────────────────────────────────┘   │
│                        │                                 │
│                        ▼                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │         PluginVisualizerAPI                      │   │
│  │  - register(pluginId, config)                   │   │
│  │  - unregister(pluginId)                         │   │
│  │  - setPriority(pluginId, priority)              │   │
│  │  - getStats()                                    │   │
│  └─────────────────────────────────────────────────┘   │
│                        │                                 │
└────────────────────────┼─────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              VisualizationEngine (Core)                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Single RAF Loop                                 │   │
│  │  - Priority queue (critical/normal/low)         │   │
│  │  - Budget system (16.67ms target)               │   │
│  │  - Auto-throttling (CPU spike handling)         │   │
│  │  - Canvas pool (memory management)              │   │
│  │  - AnalyserNode pool (shared analysers)         │   │
│  └─────────────────────────────────────────────────┘   │
│                        │                                 │
│                        ▼                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Visualizer Implementations                      │   │
│  │  - BaseVisualizer (abstract)                    │   │
│  │  - CanvasVisualizer (2D)                        │   │
│  │  - WebGLVisualizer (3D/complex)                 │   │
│  │  - CustomVisualizer (user-defined)              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               MeteringService (Data)                     │
│  - Audio data streaming                                  │
│  - Subscribe/unsubscribe                                 │
│  - FFT, waveform, peak, RMS                             │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Plugin Visualizer API

### Basit Kullanım (Wrapper)
```javascript
// Built-in preset types
import { PluginVisualizer } from '@dawg/plugin-sdk';

class MyReverbPlugin extends Plugin {
  createUI() {
    return (
      <PluginVisualizer
        pluginId={this.id}
        type="spectrum"           // preset: scope, spectrum, meter
        priority="normal"         // critical, normal, low
        color="#00E5B5"
        config={{ showGrid: true }}
      />
    );
  }
}
```

### Gelişmiş Kullanım (Custom Render)
```javascript
// Custom drawing function
class MyCustomPlugin extends Plugin {
  createVisualizer() {
    return new CustomVisualizer({
      pluginId: this.id,
      meterId: this.audioNode.id,
      priority: 'normal',

      // Canvas mode
      renderMode: 'canvas', // or 'webgl'

      // Custom draw function
      onRender: (ctx, audioData, timestamp) => {
        const { spectrum, waveform, peak, rms } = audioData;

        // Your custom visualization
        ctx.fillStyle = '#00E5B5';
        spectrum.forEach((value, index) => {
          const x = index * 5;
          const y = 100 - value;
          ctx.fillRect(x, y, 4, value);
        });
      },

      // WebGL mode (advanced)
      onRenderWebGL: (gl, audioData, timestamp) => {
        // Your custom WebGL shaders
        gl.useProgram(this.shaderProgram);
        // ... WebGL rendering
      }
    });
  }
}
```

---

## 🎯 VisualizationEngine Geliştirme Planı

### Phase 1: Backend Ready (Mevcut) ✅
- [x] VisualizationEngine core
- [x] Canvas pool
- [x] AnalyserNode pool
- [x] Priority queue
- [x] Budget system
- [x] Auto-throttling

### Phase 2: Plugin API Wrapper (YENİ)
```javascript
// lib/visualization/PluginVisualizerAPI.js
export class PluginVisualizerAPI {
  /**
   * Register plugin visualizer
   * @param {string} pluginId - Unique plugin ID
   * @param {object} config - Visualizer config
   */
  static register(pluginId, config) {
    const visualizer = this.createVisualizer(config);
    visualizationEngine.registerVisualizer(pluginId, visualizer, config.priority);
    return visualizer;
  }

  static unregister(pluginId) {
    visualizationEngine.unregisterVisualizer(pluginId);
  }

  static setPriority(pluginId, priority) {
    visualizationEngine.setPriority(pluginId, priority);
  }

  static getStats() {
    return visualizationEngine.getStats();
  }

  // Factory method
  static createVisualizer(config) {
    const { type, renderMode, onRender, onRenderWebGL } = config;

    // Preset types
    if (type === 'spectrum') {
      return new SpectrumVisualizer(config);
    } else if (type === 'scope') {
      return new ScopeVisualizer(config);
    } else if (type === 'meter') {
      return new MeterVisualizer(config);
    }

    // Custom visualizer
    if (renderMode === 'webgl') {
      return new CustomWebGLVisualizer(config);
    } else {
      return new CustomCanvasVisualizer(config);
    }
  }
}
```

### Phase 3: React Component Wrapper
```javascript
// components/common/PluginVisualizer.jsx
import { useEffect, useRef } from 'react';
import { PluginVisualizerAPI } from '@/lib/visualization/PluginVisualizerAPI';

export function PluginVisualizer({
  pluginId,
  meterId,
  type = 'spectrum',
  priority = 'normal',
  color = '#00E5B5',
  config = {},
  onRender
}) {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Register visualizer
    visualizerRef.current = PluginVisualizerAPI.register(pluginId, {
      canvas: canvasRef.current,
      meterId,
      type,
      priority,
      color,
      config,
      onRender
    });

    // Cleanup
    return () => {
      PluginVisualizerAPI.unregister(pluginId);
    };
  }, [pluginId, meterId, type, priority]);

  // Priority değişince update
  useEffect(() => {
    if (visualizerRef.current) {
      PluginVisualizerAPI.setPriority(pluginId, priority);
    }
  }, [priority, pluginId]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
```

### Phase 4: SignalVisualizer Migration
```javascript
// SignalVisualizer → PluginVisualizer wrapper
// Backward compatibility için
export function SignalVisualizer({ meterId, type, color, config }) {
  return (
    <PluginVisualizer
      pluginId={meterId}
      meterId={meterId}
      type={type}
      color={color}
      config={config}
    />
  );
}

// 14 dosyada değişiklik GEREKMEZ!
// Eski API çalışmaya devam eder
```

---

## 🚀 Migration Stratejisi

### Step 1: API Katmanı (2-3 saat)
- [ ] `PluginVisualizerAPI.js` yarat
- [ ] Preset visualizer'lar (spectrum, scope, meter)
- [ ] Custom visualizer support

### Step 2: React Wrapper (1-2 saat)
- [ ] `PluginVisualizer.jsx` component
- [ ] SignalVisualizer compatibility wrapper
- [ ] Test 1 plugin'de

### Step 3: Backward Compatibility (1 saat)
- [ ] SignalVisualizer → PluginVisualizer redirect
- [ ] Eski API korunur
- [ ] Build & test

### Step 4: Gradual Migration (opsiyonel)
- [ ] Yeni pluginler: `PluginVisualizer` kullanır
- [ ] Eski pluginler: `SignalVisualizer` çalışmaya devam eder
- [ ] Zamanla migrate et

**Toplam tahmini**: **4-6 saat**

---

## 📊 Performance Karşılaştırma

### Senaryo: 50 Custom Plugin Açık

#### SignalVisualizer (Mevcut)
```
50 plugin × 3ms average = 150ms/frame
Target: 16.67ms (60 FPS)
Result: 11 FPS 💥 CRASH
```

#### VisualizationEngine (Yeni)
```
Single RAF loop:
- Critical (5 plugin @ 60fps): 10ms
- Normal (20 plugin @ 30fps):  5ms
- Low (25 plugin @ 15fps):     1ms
Total: 16ms/frame
Result: 60 FPS ✅ SMOOTH
```

---

## 🎯 Plugin SDK Özellikleri

### 1. Priority System (Otomatik)
```javascript
// Plugin focus aldığında
onPluginFocus(pluginId) {
  PluginVisualizerAPI.setPriority(pluginId, 'critical'); // 60 FPS
}

// Plugin blur aldığında
onPluginBlur(pluginId) {
  PluginVisualizerAPI.setPriority(pluginId, 'normal'); // 30 FPS
}

// Plugin minimize
onPluginMinimize(pluginId) {
  PluginVisualizerAPI.setPriority(pluginId, 'low'); // 15 FPS
}
```

### 2. Budget Control (Otomatik)
```javascript
// CPU spike durumunda
if (frameTime > 16.67ms) {
  // Auto-throttle: normal → low
  // Kullanıcı fark etmez, FPS stabil kalır
}
```

### 3. Memory Management (Otomatik)
```javascript
// Canvas pool: Max 50 canvas
// Eskiler otomatik release
// Memory leak yok
```

### 4. WebGL Support
```javascript
// Gelişmiş visualizer için
class MyWebGLPlugin extends Plugin {
  createVisualizer() {
    return new CustomVisualizer({
      renderMode: 'webgl',
      onRenderWebGL: (gl, audioData) => {
        // 3D spektrum, shader effects, etc.
      }
    });
  }
}
```

---

## 📝 Plugin Developer Experience

### Basit Plugin (5 dakika)
```javascript
import { Plugin, PluginVisualizer } from '@dawg/plugin-sdk';

export class MySimplePlugin extends Plugin {
  render() {
    return (
      <div>
        <h3>My Plugin</h3>
        <PluginVisualizer
          pluginId={this.id}
          type="spectrum"
          color="#FF00FF"
        />
      </div>
    );
  }
}
```

### Gelişmiş Plugin (30 dakika)
```javascript
import { Plugin, CustomVisualizer } from '@dawg/plugin-sdk';

export class MyAdvancedPlugin extends Plugin {
  createVisualizer() {
    return new CustomVisualizer({
      pluginId: this.id,
      meterId: this.audioNode.id,
      priority: 'normal',
      onRender: (ctx, { spectrum, waveform, peak, rms }, timestamp) => {
        // Custom 2D visualization
        this.drawCustomSpectrum(ctx, spectrum);
      }
    });
  }

  drawCustomSpectrum(ctx, spectrum) {
    // Your creative visualization
    spectrum.forEach((value, i) => {
      const hue = (i / spectrum.length) * 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(i * 5, 100 - value, 4, value);
    });
  }
}
```

---

## ✅ Karar: VisualizationEngine + Plugin API

**Sebep**:
1. ✅ **Scalability**: 50+ plugin destekler
2. ✅ **Performance**: Tek RAF loop, budget control
3. ✅ **Plugin SDK ready**: API katmanı ile kullanıcılar custom viz yapabilir
4. ✅ **Backward compatible**: SignalVisualizer çalışmaya devam eder
5. ✅ **Future-proof**: WebGL, 3D, shader support

**Tahmini iş**: 4-6 saat
**Return**: Sınırsız plugin scalability

---

## 🎯 Sonraki Adımlar

1. **PluginVisualizerAPI.js** yarat (2-3 saat)
2. **PluginVisualizer.jsx** wrapper (1-2 saat)
3. **SignalVisualizer compatibility** (1 saat)
4. **Test & document** (1 saat)

**Başlayalım mı?** 🚀
