# 🎨 WebGL Visualization System - Kullanım Kılavuzu

## 📚 İçindekiler
1. [Hızlı Başlangıç](#hızlı-başlangıç)
2. [Adım Adım Plugin Entegrasyonu](#adım-adım-plugin-entegrasyonu)
3. [Mevcut Visualizer'lar](#mevcut-visualizerlar)
4. [Performance İpuçları](#performance-ipuçları)
5. [Sorun Giderme](#sorun-giderme)

---

## 🚀 Hızlı Başlangıç

### 1. VisualizationEngine'i başlat (SADECE BİR KEZ)

```javascript
// App.js veya ana bileşende
import { visualizationEngine } from './lib/visualization/VisualizationEngine';

// AudioContext hazır olduğunda
useEffect(() => {
  if (audioContext) {
    visualizationEngine.init(audioContext);
  }
}, [audioContext]);
```

### 2. Plugin'e visualizer ekle

```javascript
import { SaturatorVisualizer } from './ui/plugin_uis/visualizers/SaturatorVisualizer';

function MyPluginUI({ effectNode, distortion, wet }) {
  return (
    <div>
      {/* Diğer UI elementleri */}

      {/* Visualization alanı */}
      <SaturatorVisualizer
        effectNode={effectNode}  // AudioWorkletNode
        distortion={distortion}  // 0-1.5
        wet={wet}               // 0-1
      />
    </div>
  );
}
```

**ÖNEMLİ:** `effectNode` prop'u AudioWorkletNode olmalı (NativeEffect.node)

---

## 📖 Adım Adım Plugin Entegrasyonu

### Senaryo: Compressor plugin'ine visualizer eklemek

#### Adım 1: Compressor için özel visualizer oluştur

```javascript
// /ui/plugin_uis/visualizers/CompressorVisualizer.jsx

import React, { useEffect, useRef } from 'react';
import { visualizationEngine } from '../../../lib/visualization/VisualizationEngine';
import { WebGLSpectrumAnalyzer } from '../../../lib/visualization/visualizers/WebGLSpectrumAnalyzer';

export const CompressorVisualizer = ({ effectNode, threshold, ratio }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!effectNode || !canvasRef.current) return;

    // 1. Analyser al
    const analyser = visualizationEngine.getAnalyser(
      'compressor_viz',
      effectNode,
      'spectrum'
    );

    // 2. Visualizer oluştur
    const viz = new WebGLSpectrumAnalyzer(canvasRef.current, analyser, {
      barCount: 32,
      peakHold: true
    });

    viz.start();

    // 3. Engine'e kaydet
    visualizationEngine.registerVisualizer('compressor_viz', viz, 'normal');

    // 4. Cleanup
    return () => {
      visualizationEngine.unregisterVisualizer('compressor_viz');
      viz.destroy();
    };
  }, [effectNode]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={200}
      style={{ width: '100%', height: '200px' }}
    />
  );
};
```

#### Adım 2: CompressorUI'a ekle

```javascript
// CompressorUI.jsx

import { CompressorVisualizer } from './visualizers/CompressorVisualizer';

export const CompressorUI = ({ trackId, effect, effectNode, onChange }) => {
  const { threshold, ratio, attack, release } = effect.settings;

  return (
    <div className="compressor-ui">
      {/* Visualization */}
      <CompressorVisualizer
        effectNode={effectNode}
        threshold={threshold}
        ratio={ratio}
      />

      {/* Controls */}
      <KnobGroup>
        <Knob label="Threshold" value={threshold} onChange={...} />
        <Knob label="Ratio" value={ratio} onChange={...} />
        {/* ... */}
      </KnobGroup>
    </div>
  );
};
```

#### Adım 3: effectNode'u plugin'e geçir

```javascript
// MixerChannel.jsx veya EffectRack.jsx

<CompressorUI
  trackId={trackId}
  effect={effect}
  effectNode={effect.node}  // ← NativeEffect instance'ın .node property'si
  onChange={handleChange}
/>
```

---

## 🎨 Mevcut Visualizer'lar

### 1. **WebGLSpectrumAnalyzer** (Frekans Spektrumu)

```javascript
import { WebGLSpectrumAnalyzer } from './lib/visualization/visualizers/WebGLSpectrumAnalyzer';

const viz = new WebGLSpectrumAnalyzer(canvas, analyser, {
  barCount: 64,          // Bar sayısı (16-128)
  peakHold: true,        // Peak göstergeleri
  peakDecay: 0.95,       // Peak düşme hızı (0.9-0.99)
  logScale: true,        // Logaritmik frekans ölçeği
  gradientStart: [0, 1, 0.53, 1],  // Başlangıç rengi (RGBA)
  gradientEnd: [0.91, 0.3, 0.24, 1] // Bitiş rengi
});
```

**Kullanım alanları:** EQ, Filter, Spectrum effects

---

### 2. **WebGLWaveform** (Dalga Formu)

```javascript
import { WebGLWaveform } from './lib/visualization/visualizers/WebGLWaveform';

const viz = new WebGLWaveform(canvas, analyser, {
  lineWidth: 2,          // Çizgi kalınlığı
  glowIntensity: 0.5,    // Işıltı efekti (0-1)
  color: [0, 1, 0.53, 1] // Renk (RGBA)
});
```

**Kullanım alanları:** Saturation, Distortion, Waveshaping effects

---

### 3. **WebGLOscilloscope** (XY Mod)

```javascript
import { WebGLOscilloscope } from './lib/visualization/visualizers/WebGLOscilloscope';

const viz = new WebGLOscilloscope(canvas, analyser, {
  trailLength: 100,      // İz uzunluğu
  pointSize: 2,          // Nokta boyutu
  persistence: 0.95,     // İz kalıcılığı (0-1)
  glowIntensity: 0.7     // Işıltı
});
```

**Kullanım alanları:** Stereo effects, Phase correlation, Reverb

---

## ⚡ Performance İpuçları

### Priority Sistemi

```javascript
// Critical (60fps) - Focused/active plugin
visualizationEngine.registerVisualizer(id, viz, 'critical');

// Normal (30fps) - Visible plugin
visualizationEngine.registerVisualizer(id, viz, 'normal');

// Low (15fps) - Background plugin
visualizationEngine.registerVisualizer(id, viz, 'low');
```

### Canvas Boyutları

```javascript
// ✅ İyi - Logical size
<canvas width={600} height={200} style={{ width: '100%', height: '200px' }} />

// ❌ Kötü - Çok büyük
<canvas width={3000} height={1000} />
```

### Memory Management

```javascript
// useEffect cleanup'ta MUTLAKA unregister et
useEffect(() => {
  // ... visualizer setup

  return () => {
    visualizationEngine.unregisterVisualizer(id); // ← ÖNEMLİ!
    viz.destroy();
  };
}, []);
```

---

## 🔧 Sorun Giderme

### Problem: Visualizer görünmüyor

**Çözüm 1:** Engine başlatıldı mı kontrol et
```javascript
console.log(visualizationEngine.initialized); // true olmalı
```

**Çözüm 2:** effectNode doğru mu?
```javascript
console.log(effectNode); // AudioWorkletNode olmalı
console.log(effectNode instanceof AudioWorkletNode); // true
```

**Çözüm 3:** Canvas boyutu sıfır mı?
```javascript
console.log(canvas.width, canvas.height); // 0 olmamalı
```

---

### Problem: Performance düşük / Takılma

**Çözüm 1:** Priority düşür
```javascript
visualizationEngine.setPriority(id, 'low');
```

**Çözüm 2:** Bar count azalt
```javascript
new WebGLSpectrumAnalyzer(canvas, analyser, {
  barCount: 32 // 64 yerine 32
});
```

**Çözüm 3:** Debug monitor'u kontrol et
```javascript
import { VisualizationDebugMonitor } from './components/VisualizationDebugMonitor';

// App'e ekle
<VisualizationDebugMonitor />
```

---

### Problem: "WebGL not supported" hatası

**Çözüm:** Fallback to Canvas 2D
```javascript
import { WaveformVisualizer } from './lib/visualization/visualizers/WaveformVisualizer';

// WebGL yerine Canvas 2D kullan
const viz = new WaveformVisualizer(canvas, analyser);
```

---

## 📊 Debug Monitor

Performance'ı izlemek için:

```javascript
import { VisualizationDebugMonitor } from './components/VisualizationDebugMonitor';

function App() {
  return (
    <>
      {/* App content */}
      <VisualizationDebugMonitor />  {/* Sağ üstte butona tıkla */}
    </>
  );
}
```

**Gösterilen metrikler:**
- FPS
- Frame time
- Budget utilization
- Active visualizers
- Memory usage
- Queue sizes

---

## 🎯 Örnek: Tam Entegrasyon

```javascript
// ReverbUI.jsx - Tam örnek

import React, { useEffect, useRef } from 'react';
import { visualizationEngine } from '../../lib/visualization/VisualizationEngine';
import { WebGLOscilloscope } from '../../lib/visualization/visualizers/WebGLOscilloscope';

export const ReverbUI = ({ effect, effectNode, onChange }) => {
  const canvasRef = useRef(null);
  const { decay, preDelay, wet } = effect.settings;

  useEffect(() => {
    if (!effectNode || !canvasRef.current) return;

    const analyser = visualizationEngine.getAnalyser(
      'reverb_xy',
      effectNode,
      'waveform'
    );

    const viz = new WebGLOscilloscope(canvasRef.current, analyser, {
      trailLength: decay * 20, // Decay'e göre trail uzunluğu
      persistence: wet,         // Wet'e göre kalıcılık
      pointSize: 3
    });

    viz.start();
    visualizationEngine.registerVisualizer('reverb_xy', viz, 'normal');

    return () => {
      visualizationEngine.unregisterVisualizer('reverb_xy');
      viz.destroy();
    };
  }, [effectNode]);

  // Parametrelere göre güncelle
  useEffect(() => {
    const viz = visualizationEngine.visualizers.get('reverb_xy')?.instance;
    if (viz) {
      viz.setTrailLength(decay * 20);
      viz.setPersistence(wet);
    }
  }, [decay, wet]);

  return (
    <div className="reverb-ui">
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="w-full h-64"
      />

      <div className="controls">
        {/* Knobs... */}
      </div>
    </div>
  );
};
```

---

## ✅ Checklist

Plugin'e visualizer eklerken:

- [ ] VisualizationEngine.init() çağrıldı
- [ ] effectNode prop'u AudioWorkletNode
- [ ] Canvas ref'i doğru bağlandı
- [ ] useEffect cleanup'ta unregister yapılıyor
- [ ] Canvas boyutu mantıklı (width/height)
- [ ] Priority doğru seçildi
- [ ] Memory leak yok (useEffect deps doğru)

---

## 🚀 İleri Seviye

### Custom Visualizer Oluşturma

```javascript
import { WebGLVisualizer } from './lib/visualization/visualizers/WebGLVisualizer';

class MyCustomVisualizer extends WebGLVisualizer {
  initShaders() {
    const vertexShader = `...`;
    const fragmentShader = `...`;
    this.program = this.createProgram(vertexShader, fragmentShader);
  }

  render(timestamp) {
    // Custom rendering logic
    this.analyser.getByteFrequencyData(this.dataArray);
    // ... GPU rendering
  }
}
```

---

**Sorular için:** `VISUALIZATION_USAGE_GUIDE.md`

**Test için:** `WebGLVisualizationTest.jsx` bileşenine bakın
