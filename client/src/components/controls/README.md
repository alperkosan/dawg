## 🎛️ DAWG Unified Control System

Merkezi, tema-entegreli, performans-optimize edilmiş kontrol kütüphanesi.

### ✨ Özellikler

- **RAF-Optimized**: Tüm kontroller requestAnimationFrame ile throttle edilmiş, stack'lenme yok
- **Theme-Aware**: Otomatik tema entegrasyonu
- **Zero Memory Leaks**: Proper cleanup ve event listener yönetimi
- **Consistent API**: Tüm kontroller aynı prop pattern'ini kullanır
- **Accessible**: ARIA etiketleri ve klavye desteği

### 📦 Temel Kontroller

#### Knob
```jsx
import { Knob } from '@/ui/controls';

<Knob
  label="Cutoff"
  value={1000}
  min={20}
  max={20000}
  onChange={(val) => setFrequency(val)}
  logarithmic
  unit="Hz"
  variant="accent"
/>
```

#### Fader
```jsx
import { Fader } from '@/ui/controls';

<Fader
  label="Volume"
  value={0}
  min={-60}
  max={6}
  onChange={(val) => setVolume(val)}
  unit="dB"
  height={150}
/>
```

#### Slider
```jsx
import { Slider } from '@/ui/controls';

<Slider
  label="Reverb Mix"
  value={50}
  min={0}
  max={100}
  onChange={(val) => setMix(val)}
  unit="%"
  width={200}
/>
```

#### Button
```jsx
import { Button } from '@/ui/controls';

<Button
  label="Bypass"
  active={bypassed}
  onClick={() => toggleBypass()}
  variant="danger"
  size="md"
/>
```

#### Toggle
```jsx
import { Toggle } from '@/ui/controls';

<Toggle
  label="Stereo Link"
  value={linked}
  onChange={(val) => setLinked(val)}
  variant="success"
/>
```

### 🎨 Özel Kontroller

#### XYPad
```jsx
import { XYPad } from '@/ui/controls';

<XYPad
  label="Filter"
  valueX={cutoff}
  valueY={resonance}
  minX={20}
  maxX={20000}
  minY={0}
  maxY={1}
  onChangeX={setCutoff}
  onChangeY={setResonance}
  labelX="Cutoff"
  labelY="Resonance"
  size={200}
/>
```

#### Meter
```jsx
import { Meter } from '@/ui/controls';

<Meter
  value={level}
  peakValue={peak}
  orientation="vertical"
  showPeak
  height={120}
  width={20}
/>
```

#### Display
```jsx
import { Display } from '@/ui/controls';

<Display
  label="BPM"
  value={tempo.toFixed(1)}
  size="lg"
  monospace
  align="center"
/>
```

### 🔥 Plugin-Specific Kontroller

#### SpectrumKnob
```jsx
import { SpectrumKnob } from '@/ui/controls';

<SpectrumKnob
  label="Frequency"
  value={freq}
  onChange={setFreq}
  analyserNode={analyser} // Optional: shows mini spectrum
  logarithmic
/>
```

#### WaveformKnob
```jsx
import { WaveformKnob } from '@/ui/controls';

<WaveformKnob
  label="Drive"
  value={drive}
  onChange={setDrive}
  transferFunction={(input) => Math.tanh(input * drive)} // Shows saturation curve
/>
```

#### StepSequencer
```jsx
import { StepSequencer } from '@/ui/controls';

<StepSequencer
  steps={pattern}
  activeStep={currentStep}
  onStepChange={(newPattern) => setPattern(newPattern)}
  columns={16}
/>
```

### 🎨 Tema Variants

Tüm kontroller şu variant'ları destekler:

- `default` - Tema primary rengi
- `accent` - Tema accent rengi
- `danger` - Kırmızı (delete, bypass vb)
- `success` - Yeşil (enable, confirm vb)

```jsx
<Knob variant="accent" />
<Button variant="danger" />
<Toggle variant="success" />
```

### ⚡ Performans

**RAF Throttling:**
- Tüm mouse event'ler requestAnimationFrame ile throttle edilir
- Maximum 60 update/saniye
- Event listener stack'lenmesi yok
- Closure memory leak'i yok

**Best Practices:**
```jsx
// ✅ İyi - onChange callback stable
const handleChange = useCallback((value) => {
  updateParameter(value);
}, [updateParameter]);

<Knob onChange={handleChange} />

// ❌ Kötü - her render'da yeni fonksiyon
<Knob onChange={(val) => updateParameter(val)} />
```

### 🎯 Migration Guide

**Eski kontrollerden yenilere geçiş:**

```jsx
// Eski
import { ProfessionalKnob } from '@/ui/plugin_system/PluginControls';

// Yeni
import { Knob } from '@/ui/controls';

// Aynı API, daha performanslı!
```

### 📝 Notes

- Tüm kontroller `disabled` prop'unu destekler
- `onChange` + `onChangeEnd` callback'leri var (mouse up'ta onChangeEnd çağrılır)
- Accessibility için ARIA attribute'ları otomatik eklenir
- Theme değişikliği otomatik yansır
