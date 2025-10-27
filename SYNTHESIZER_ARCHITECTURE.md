# 🎹 Synthesizer Architecture

Modern DAW'larla rekabet edebilecek 2-katmanlı sentezleyici sistemi.

## 📋 Genel Bakış

DAWG'da 2 ana sentezleyici kategorisi vardır:

### 1. **Sample-Based Synthesizers** 🎵
Audio dosyalarını kullanarak ses üretir:
- **SingleSampleInstrument** - Tek sample (kick, snare, vb.)
- **MultiSampleInstrument** - Çoklu sample (piano, chromatic)
- **GranularSamplerInstrument** - Granular synthesis

### 2. **Signal-Based Synthesizers** 🎛️
Sinyal işleme ile ses sentezler:
- **VASynth** - Virtual Analog Synthesizer (Native Web Audio)
- **ForgeSynth** - Legacy synthesizer (deprecated)

---

## 🎛️ VASynth (Virtual Analog Synthesizer)

### Mimari
```
VASynth
  ├── 3x Oscillators (Sawtooth, Square, Triangle, Sine)
  ├── Multi-mode Filter (Lowpass, Highpass, Bandpass)
  ├── Filter Envelope (ADSR)
  ├── Amplitude Envelope (ADSR)
  ├── LFO (Modulation)
  └── Voice Modes (Mono, Poly)
```

### Özellikler
- ✅ **3 Oscillator** - Bağımsız waveform, tuning, level
- ✅ **Multi-mode Filter** - Cutoff, Resonance, Envelope
- ✅ **Dual ADSR** - Filter & Amplitude envelopes
- ✅ **LFO Modulation** - Vibrato, tremolo
- ✅ **Voice Modes** - Polyphonic / Monophonic
- ✅ **Portamento** - Glide between notes
- ✅ **Legato Mode** - Smooth note transitions

### Preset Kategorileri

#### 🎹 Keys (Tuşlu Çalgılar)
- **Piano** - Akustik piyano simülasyonu
- **E. Piano** - Elektrik piyano (Rhodes tarzı)
- **Organ** - Hammond organ tarzı

#### 🔊 Bass (Bas Sesleri)
- **Bass** - Klasik synth bass
- **808 Bass** - TR-808 stil bas
- **Sub Bass** - Ultra-low frequency sub bass
- **Reese Bass** - Detuned saw wave bass (DnB classic)

#### 🎸 Lead (Melodi Sesleri)
- **Classic Lead** - Moog-style lead
- **Pluck** - Kısa, keskin lead
- **Supersaw Lead** - Detuned saw stack (trance)
- **Acid Lead** - TB-303 stil acid lead

#### 🌊 Pad (Atmosferik Sesler)
- **Warm Pad** - Yumuşak, ılık pad
- **Strings** - String ensemble
- **Lush Pad** - Geniş, zengin pad
- **Analog Pad** - Vintage analog pad

#### 🔔 Other
- **Bell Synth** - Çan sesi

---

## 🥁 Sample-Based Instruments

### SingleSampleInstrument
Tek audio sample ile çalışır (one-shot).

**Özellikler:**
- Pitch shifting (playbackRate)
- Velocity sensitivity
- Pan control
- Loop support (start/end points)
- Sample trimming
- ADSR envelope
- Filter (lowpass/highpass/bandpass)

**Kullanım:**
```javascript
{
  type: 'sample',
  url: '/audio/samples/drums/kick.wav',
  baseNote: 60,
  pitch: 0,
  gain: 1.0,
  pan: 0,
  loop: false,
  attack: 0.01,
  decay: 0.1,
  sustain: 1.0,
  release: 0.3
}
```

### MultiSampleInstrument
Birden fazla sample kullanarak chromatic çalar (piano, strings vb.)

**Özellikler:**
- Automatic sample mapping
- Nearest-sample selection
- Pitch shifting per note
- Velocity layering (gelecek)

**Kullanım:**
```javascript
{
  type: 'sample',
  multiSamples: [
    { url: '/audio/piano/C1.ogg', note: 'C1', midiNote: 24 },
    { url: '/audio/piano/C2.ogg', note: 'C2', midiNote: 36 },
    // ... more samples
  ]
}
```

---

## 🎨 Preset Sistemi

### Preset Yapısı

Her preset şu bilgileri içerir:
```javascript
{
  id: 'subbass',           // Unique identifier
  name: 'Sub Bass',        // Display name
  presetName: 'Sub Bass',  // VASynth preset ref
  color: '#4B0082'         // Channel color
}
```

### Preset Kategorileri

Presetler kullanım amacına göre gruplandırılmıştır:

- **Keys** - Piano, E.Piano, Organ
- **Bass** - Bass, 808 Bass, Sub Bass, Reese Bass
- **Lead** - Classic Lead, Pluck, Supersaw Lead, Acid Lead
- **Pad** - Warm Pad, Strings, Lush Pad, Analog Pad
- **Other** - Bell Synth

### InstrumentPicker UI

Kullanıcılar Channel Rack'te "+" butonuna tıklayarak:

1. **Kategori seçer** (Sampler / Multi-Sampler / VA Synth)
2. **Grup seçer** (Keys / Bass / Lead / Pad)
3. **Preset seçer** (Piano, Sub Bass, Supersaw Lead, vb.)
4. **Instrument oluşturulur** ve mixer track'e atanır

---

## 🎯 Tasarım Felsefesi

### "Hızlı Başlangıç, Derinlemesine Kontrol"

Modern DAW'lar (FL Studio, Ableton) gibi:
- ✅ **Presetlerle hızlı erişim** - "Sub Bass" istiyorsan 2 tıkla al
- ✅ **Sonra tweaklayabilirsin** - InstrumentEditor'da tüm parametreler açık
- ✅ **Tahmine dayalı değil** - "Drum" vs "Melodic" yerine "Sample" vs "Synth"
- ✅ **Dışarıdan sample eklenebilir** - FileBrowser drag & drop

### Workflow

```
User Flow:
1. Channel Rack'te + tıkla
2. VA Synthesizer > Bass > Sub Bass seç
3. Nota ekle, çal
4. (Opsiyonel) InstrumentEditor'da ADSR, filter tweakle
5. (Opsiyonel) Mixer'da efekt ekle
```

---

## 📂 Dosya Yapısı

```
/client/src/
├── lib/audio/
│   ├── synth/
│   │   ├── VASynth.js                  # Core synth engine
│   │   ├── VASynthVoice.js             # Voice management
│   │   ├── ADSREnvelope.js             # Envelope generator
│   │   ├── LFO.js                      # Low-frequency oscillator
│   │   └── presets.js                  # 🎹 VASynth presets
│   └── instruments/
│       ├── sample/
│       │   ├── SingleSampleInstrument.js   # One-shot sampler
│       │   └── MultiSampleInstrument.js    # Chromatic sampler
│       └── synth/
│           └── VASynthInstrument_v2.js     # VASynth wrapper
├── config/
│   ├── constants.js                    # INSTRUMENT_TYPES
│   └── instrumentCategories.js         # 🎨 Preset organizasyonu
└── features/
    ├── channel_rack/
    │   └── InstrumentPicker.jsx        # Preset browser UI
    └── instrument_editor/
        └── VASynthEditor.jsx           # Parameter editor

```

---

## 🚀 Gelecek Geliştirmeler

### Kısa Vadeli
- [ ] Daha fazla VASynth preset (FX, Arp, Pluck variations)
- [ ] Preset preview (mouse hover ile dinle)
- [ ] User preset save/load

### Orta Vadeli
- [ ] Wavetable oscillator ekleme
- [ ] FM synthesis desteği
- [ ] Modulation matrix (LFO -> Filter, Env -> Pitch vb.)

### Uzun Vadeli
- [ ] Granular Synth preset sistemi
- [ ] Sample library integration
- [ ] Cloud preset sharing

---

## 💡 Örnekler

### Bass Preset Oluşturma
```javascript
// presets.js
'My Custom Bass': {
  oscillators: [
    { enabled: true, waveform: 'sawtooth', detune: 0, octave: 0, level: 0.6 },
    { enabled: true, waveform: 'square', detune: 0, octave: -1, level: 0.8 }
  ],
  filter: {
    type: 'lowpass',
    cutoff: 300,
    resonance: 3.5,
    envelopeAmount: 1200
  },
  filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.15, release: 0.25 },
  amplitudeEnvelope: { attack: 0.003, decay: 0.15, sustain: 0.7, release: 0.2 },
  voiceMode: 'mono',
  portamento: 0.02,
  legato: true,
  masterVolume: 0.85
}
```

### InstrumentPicker'a Ekleme
```javascript
// instrumentCategories.js
bass: {
  name: 'Bass',
  presets: [
    { id: 'mycustombass', name: 'My Custom Bass', presetName: 'My Custom Bass', color: '#FF0000' }
  ]
}
```

---

**Hazırlayan:** Claude
**Tarih:** 2025
**Versiyon:** 1.0
