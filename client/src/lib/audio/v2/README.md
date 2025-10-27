# 🎹 VASynth v2 - Advanced Virtual Analog Synthesizer

Modern DAW seviyesinde ses üretimi ve manipülasyon sistemi.

## 📋 Özellikler

### ✅ Tamamlanmış (Faz 1)

#### Core Infrastructure
- ✅ **ParameterRegistry** - Merkezi parametre kayıt sistemi
  - Tip-güvenli parameter ID'ler
  - Metadata (min, max, default, unit, curve)
  - Semantic grouping (Tonal, Filter, Dynamics, Spatial, Timbre, Temporal)
  - Search & discovery

- ✅ **ParameterSchema** - Zod ile runtime validation
  - VASynth config validation
  - Parameter update validation
  - Default config tanımları

- ✅ **ParameterController** - Performance optimized update system
  - Batch parameter updates (16ms window)
  - Dirty flagging
  - Parameter scheduling (linear/exponential ramps)
  - Automation recording hazırlığı

- ✅ **Smart History Store** - Zustand ile optimize edilmiş state management
  - Sadece değişen path'leri takip eder (memory efficient)
  - Undo/Redo stack
  - A/B comparison slots
  - 100 adımlık history limit

- ✅ **VoiceAllocator v2** - Gelişmiş voice management
  - Multiple stealing strategies (Oldest, Quietest, Round-Robin, Lowest, Highest)
  - Mono/Poly/Legato modes
  - Sustain pedal support
  - Note priority stack

- ✅ **ADSR+ Envelope** - Gelişmiş envelope generator
  - 6 stage: Delay → Attack → Hold → Decay → Sustain → Release
  - Curve types per stage (Linear, Exponential, Logarithmic)
  - Velocity sensitivity

- ✅ **VASynthVoice** - Unison destekli voice
  - 3 oscillators with independent unison
  - 2-8 voice unison stack
  - Detune spread (0-50 cents)
  - Pan spread (stereo width)
  - Phase randomization

- ✅ **VASynthInstrument** - Ana synthesizer engine
  - Voice pool (16 voices)
  - Parameter batching
  - Preset loading
  - Performance metrics

### 🚧 Planlanan (Faz 2+)

- ⏳ **Modulation System**
  - LFO 1-4 (multi-waveform, tempo sync)
  - Envelope routing
  - 16 modulation slots
  - Modulation visualization

- ⏳ **Effects Chain**
  - Instrument-level effects (8 slots)
  - Distortion, Chorus, Phaser, Flanger
  - Delay, Reverb, EQ, Compressor

- ⏳ **Advanced Filters**
  - Ladder filter (Moog-style)
  - State Variable Filter
  - Comb filter
  - Formant filter

- ⏳ **UI Components**
  - VASynthEditor v2
  - Real-time preview
  - Spectrum analyzer
  - Oscilloscope
  - ModulationMatrix panel

---

## 🚀 Kullanım

### Temel Kullanım

```javascript
import { VASynthInstrument } from './lib/audio/v2/synth/VASynthInstrument.js';
import { ParameterID } from './lib/audio/v2/core/ParameterRegistry.js';

// AudioContext oluştur
const audioContext = new AudioContext();

// VASynth instance oluştur
const synth = new VASynthInstrument(audioContext, {
  id: 'my-synth-1',
  name: 'Sub Bass',
});

// Master output'a bağla
synth.connect(audioContext.destination);

// Nota çal
synth.noteOn(60, 100); // C4, velocity 100

// 1 saniye sonra bırak
setTimeout(() => {
  synth.noteOff(60);
}, 1000);
```

### Parameter Güncelleme

```javascript
// Tek parametre güncelleme
synth.setParameter(ParameterID.FILTER_CUTOFF, 2000);

// Çoklu parametre güncelleme
synth.setParameters({
  [ParameterID.OSC_1_LEVEL]: 0.8,
  [ParameterID.OSC_1_DETUNE]: 10,
  [ParameterID.FILTER_RESONANCE]: 5,
});

// Ramp ile güncelleme (smooth transition)
synth.setParameter(ParameterID.FILTER_CUTOFF, 500, {
  ramp: 'exponential',
  duration: 2.0, // 2 saniye
});
```

### Unison Mode

```javascript
// Oscillator 1 için unison enable
synth.setParameters({
  [ParameterID.OSC_1_UNISON_ENABLED]: 1,
  [ParameterID.OSC_1_UNISON_VOICES]: 6,
  [ParameterID.OSC_1_UNISON_DETUNE]: 15, // 15 cents spread
  [ParameterID.OSC_1_UNISON_PAN]: 80, // 80% stereo width
});
```

### Preset Loading

```javascript
const bassPreset = {
  oscillators: [
    {
      enabled: true,
      waveform: 'sawtooth',
      level: 0.7,
      detune: 0,
      octave: 0,
      unison: {
        enabled: true,
        voices: 4,
        detune: 12,
        pan: 60,
      },
    },
    {
      enabled: true,
      waveform: 'square',
      level: 0.5,
      detune: 0,
      octave: -1,
      unison: {
        enabled: false,
        voices: 1,
        detune: 0,
        pan: 0,
      },
    },
    {
      enabled: false,
      waveform: 'sine',
      level: 0,
      detune: 0,
      octave: 0,
      unison: { enabled: false, voices: 1, detune: 0, pan: 0 },
    },
  ],
  filter: {
    type: 'lowpass',
    cutoff: 400,
    resonance: 4.5,
    envelopeAmount: 2000,
    drive: 1,
  },
  filterEnvelope: {
    delay: 0,
    attack: 0.01,
    hold: 0,
    decay: 0.3,
    sustain: 0.2,
    release: 0.4,
  },
  amplitudeEnvelope: {
    delay: 0,
    attack: 0.005,
    hold: 0,
    decay: 0.2,
    sustain: 0.8,
    release: 0.3,
  },
  masterVolume: 0.85,
  voiceMode: 'mono',
  portamentoTime: 0.05,
  legato: true,
};

synth.loadPreset(bassPreset);
```

### Performance Metrics

```javascript
const metrics = synth.getMetrics();

console.log('Active voices:', metrics.activeVoices);
console.log('Total parameter updates:', metrics.parameterController.totalUpdates);
console.log('Average batch size:', metrics.parameterController.averageBatchSize);
```

---

## 🏗️ Mimari

### Klasör Yapısı

```
/client/src/lib/audio/v2/
├── core/
│   ├── ParameterRegistry.js       # Parameter tanımları ve metadata
│   ├── ParameterSchema.js         # Zod validation schemas
│   ├── ParameterController.js     # Batching ve scheduling
│   └── VoiceAllocator.js          # Voice management
├── synth/
│   ├── ADSRPlusEnvelope.js        # ADSR+ envelope generator
│   ├── VASynthVoice.js            # Unison destekli voice
│   └── VASynthInstrument.js       # Ana synth engine
├── modulation/                    # (Faz 2)
│   ├── ModulationEngine.js
│   ├── LFO.js
│   └── ModulationRouter.js
├── effects/                       # (Faz 2)
│   ├── Effect.js
│   ├── DistortionEffect.js
│   └── ...
└── filters/                       # (Faz 2)
    ├── LadderFilter.js
    └── StateVariableFilter.js

/client/src/features/instrument_editor_v2/
├── components/
│   ├── editors/
│   │   └── VASynthEditor.jsx      # (Faz 3)
│   ├── controls/
│   │   ├── Knob.jsx
│   │   └── Slider.jsx
│   └── panels/
│       ├── ModulationMatrix.jsx   # (Faz 2)
│       └── EffectsPanel.jsx       # (Faz 2)
├── store/
│   └── useInstrumentEditorStore.js # Smart history store
└── hooks/
    └── useParameter.js            # (Faz 3)
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Component                              │
│  (Knob, Slider, VASynthEditor)                              │
└────────────────────┬────────────────────────────────────────┘
                     │ setParameter(id, value)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│         ParameterController (Batching Layer)                │
│  - Collect updates in 16ms window                           │
│  - Apply dirty flagging                                     │
│  - Schedule ramps                                           │
└────────────────────┬────────────────────────────────────────┘
                     │ flush() → updateParameter()
                     ↓
┌─────────────────────────────────────────────────────────────┐
│         VASynthInstrument (Parameter Router)                │
│  - Route to appropriate audio nodes                         │
│  - Apply AudioParam scheduling                              │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┬───────────────┐
         ↓                       ↓               ↓
┌─────────────────┐   ┌──────────────────┐   ┌─────────────┐
│  VoiceAllocator │   │  VASynthVoice    │   │ Master Gain │
│  - Voice pool   │   │  - Oscillators   │   │ - Pan       │
│  - Note on/off  │   │  - Filter        │   │             │
│  - Stealing     │   │  - Envelopes     │   │             │
└─────────────────┘   └──────────────────┘   └─────────────┘
```

---

## 🧪 Test

Test dosyasını tarayıcıda aç:

```bash
open client/src/lib/audio/v2/test/test_vasynth.html
```

veya development server ile:

```bash
npm run dev
# http://localhost:5173/src/lib/audio/v2/test/test_vasynth.html
```

---

## 📊 Performance

### Optimization Highlights

1. **Parameter Batching** - 16ms window içinde tüm updates tek batch'te
2. **Dirty Flagging** - Sadece değişen parametreler engine'e gönderilir
3. **Smart History** - Full clone yerine sadece değişen path'ler kaydedilir
4. **Voice Pooling** - Pre-allocated voices, no runtime allocation
5. **Unison Optimization** - Gain compensation for multiple voices

### Benchmarks (Target)

- Batch size: ~3-5 parameters per flush
- History memory: <10MB for 100 steps
- Voice allocation: <1ms per note on
- Parameter update: <0.1ms per parameter

---

## 🎯 Roadmap

### Faz 1 ✅ TAMAMLANDI
- ✅ Parameter system
- ✅ Voice allocation
- ✅ ADSR+ envelopes
- ✅ Unison mode
- ✅ Smart history

### Faz 2 (Sonraki)
- Modulation engine
- LFO system
- ModulationMatrix UI

### Faz 3
- Effects chain
- Advanced filters
- UI components

### Faz 4
- MIDI learn
- Automation system
- Preset management

---

## 💡 Örnek Kullanım Senaryoları

### 1. Sub Bass (Mono, Unison)

```javascript
const subBass = new VASynthInstrument(audioContext);

subBass.loadPreset({
  oscillators: [
    {
      enabled: true,
      waveform: 'sawtooth',
      level: 0.7,
      detune: 0,
      octave: 0,
      unison: { enabled: true, voices: 6, detune: 12, pan: 70 },
    },
    {
      enabled: true,
      waveform: 'square',
      level: 0.5,
      detune: 0,
      octave: -1,
      unison: { enabled: false, voices: 1, detune: 0, pan: 0 },
    },
    {
      enabled: false,
      waveform: 'sine',
      level: 0,
      detune: 0,
      octave: 0,
      unison: { enabled: false, voices: 1, detune: 0, pan: 0 },
    },
  ],
  filter: {
    type: 'lowpass',
    cutoff: 300,
    resonance: 5,
    envelopeAmount: 1500,
  },
  filterEnvelope: {
    delay: 0,
    attack: 0.01,
    hold: 0,
    decay: 0.25,
    sustain: 0.15,
    release: 0.3,
  },
  amplitudeEnvelope: {
    delay: 0,
    attack: 0.005,
    hold: 0,
    decay: 0.2,
    sustain: 0.8,
    release: 0.25,
  },
  voiceMode: 'mono',
  portamentoTime: 0.03,
  legato: true,
  masterVolume: 0.85,
});

subBass.connect(audioContext.destination);
```

### 2. Supersaw Lead (Poly, Heavy Unison)

```javascript
const supersawLead = new VASynthInstrument(audioContext);

supersawLead.loadPreset({
  oscillators: [
    {
      enabled: true,
      waveform: 'sawtooth',
      level: 0.8,
      detune: 0,
      octave: 0,
      unison: { enabled: true, voices: 8, detune: 25, pan: 100 },
    },
    {
      enabled: true,
      waveform: 'sawtooth',
      level: 0.6,
      detune: 7,
      octave: 0,
      unison: { enabled: true, voices: 6, detune: 20, pan: 90 },
    },
    {
      enabled: false,
      waveform: 'sine',
      level: 0,
      detune: 0,
      octave: 0,
      unison: { enabled: false, voices: 1, detune: 0, pan: 0 },
    },
  ],
  filter: {
    type: 'lowpass',
    cutoff: 4000,
    resonance: 2.5,
    envelopeAmount: 3000,
  },
  filterEnvelope: {
    delay: 0,
    attack: 0.02,
    hold: 0.05,
    decay: 0.4,
    sustain: 0.4,
    release: 0.6,
  },
  amplitudeEnvelope: {
    delay: 0,
    attack: 0.015,
    hold: 0,
    decay: 0.3,
    sustain: 0.7,
    release: 0.5,
  },
  voiceMode: 'poly',
  portamentoTime: 0,
  legato: false,
  masterVolume: 0.7,
});

supersawLead.connect(audioContext.destination);
```

### 3. Warm Pad (Poly, Subtle Unison)

```javascript
const warmPad = new VASynthInstrument(audioContext);

warmPad.loadPreset({
  oscillators: [
    {
      enabled: true,
      waveform: 'sawtooth',
      level: 0.5,
      detune: 0,
      octave: 0,
      unison: { enabled: true, voices: 4, detune: 8, pan: 50 },
    },
    {
      enabled: true,
      waveform: 'square',
      level: 0.4,
      detune: 5,
      octave: 0,
      unison: { enabled: true, voices: 3, detune: 6, pan: 40 },
    },
    {
      enabled: true,
      waveform: 'triangle',
      level: 0.3,
      detune: -7,
      octave: -1,
      unison: { enabled: false, voices: 1, detune: 0, pan: 0 },
    },
  ],
  filter: {
    type: 'lowpass',
    cutoff: 2000,
    resonance: 1.5,
    envelopeAmount: 800,
  },
  filterEnvelope: {
    delay: 0.1,
    attack: 0.5,
    hold: 0.2,
    decay: 1.0,
    sustain: 0.6,
    release: 1.5,
  },
  amplitudeEnvelope: {
    delay: 0.05,
    attack: 0.8,
    hold: 0.1,
    decay: 0.5,
    sustain: 0.85,
    release: 1.2,
  },
  voiceMode: 'poly',
  portamentoTime: 0,
  legato: false,
  masterVolume: 0.6,
});

warmPad.connect(audioContext.destination);
```

---

## 📝 Notlar

- **Browser Compatibility:** Modern browsers (Chrome, Firefox, Safari, Edge)
- **Web Audio API:** Required
- **Zod:** Parameter validation için dependency
- **Zustand:** State management için dependency

---

**Geliştirici:** Claude
**Tarih:** 2025-01-25
**Versiyon:** 2.0.0
**Durum:** Faz 1 Tamamlandı ✅
