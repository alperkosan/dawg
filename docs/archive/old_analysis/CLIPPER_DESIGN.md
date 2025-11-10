# CLIPPER - The Hard Edge

## 🎯 Plugin Overview

**Category:** The Texture Lab
**Purpose:** Aggressive peak shaping with harmonic generation
**Inspired By:** K-Clip, StandardClip, GClip, Saturator plugins

---

## 🎨 Visual Design

### Color Identity
- **Primary:** Neon Orange (#FF6B35)
- **Warning:** Red (#E63946) when clipping hard
- **Background:** Dark gradient (#212529 → #343a40)
- **Accent:** Yellow (#FFD60A) for harmonics

### Layout (950x650px)

```
┌─────────────────────────────────────────────────────────────┐
│  CLIPPER - The Hard Edge                [Preset ▾] [?]     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ⚡ CLIPPING VISUALIZATION                            │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  ━━━━━━━━━━ ← Ceiling (+0dB)                    │ │ │
│  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ ← Input waveform              │ │ │
│  │  │  ████████████████████ ← Clipped output (flat top)│ │ │
│  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                               │ │ │
│  │  │  ━━━━━━━━━━                                      │ │ │
│  │  │  Input (orange) | Output (red = clipping)        │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  CLIPPING: 🔴 23% of samples | Harmonics: +12dB     │ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  MODE: [HARD][SOFT][TUBE][DIODE][FOLDBACK][BITCRUSH]      │
│                                                              │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │   CEILING    │   HARDNESS   │      HARMONICS           │ │
│  │   ╭─────╮   │   ╭─────╮   │      ╭─────╮            │ │
│  │   │  ◉  │   │   │  ◉  │   │      │  ◉  │            │ │
│  │   ╰─────╯   │   ╰─────╯   │      ╰─────╯            │ │
│  │    0.0 dB    │     100%     │       50%               │ │
│  └──────────────┴──────────────┴──────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  📊 HARMONIC SPECTRUM (FFT Analysis)                  │ │
│  │  ▓                                                     │ │
│  │  ▓▓       ← Fundamental                               │ │
│  │  ▓▓▓▓                                                  │ │
│  │  ▓▓▓▓▓▓   ← 2nd harmonic (even)                       │ │
│  │  ▓▓▓▓▓▓▓                                               │ │
│  │  ▓▓▓▓▓▓▓▓  ← 3rd harmonic (odd)                       │ │
│  │  ────────────────────────────────────                 │ │
│  │  Frequency →                                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SHAPE CURVE (Input → Output Transfer Function)     │  │
│  │  │                     ┌───                          │  │
│  │  │                 ┌───│  ← Hard clipping           │  │
│  │  │             ┌───    │                            │  │
│  │  │         ┌───        │                            │  │
│  │  │     ┌───            │                            │  │
│  │  │ ┌───                │                            │  │
│  │  └──────────────────────                            │  │
│  │  Input dB →            Output dB ↑                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────── ADVANCED ──────────────────────────┐ │
│  │ OVERSAMPLE: [OFF][2x][4x][8x]    DC FILTER [◉]       │ │
│  │ PRE-GAIN:   [━━━━━●─────] +6dB                        │ │
│  │ POST-GAIN:  [━━━━━●─────] -6dB (auto-compensate)     │ │
│  │ MIX:        [━━━━━━━━━●─] 100%                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  STATS: Clipped: 23% | THD: 12.4% | Crest Factor: 3.2dB    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎛️ Parameters

### Main Controls

| Parameter | Range | Default | Unit | Description |
|-----------|-------|---------|------|-------------|
| **ceiling** | -10 to +3 | 0.0 | dB | Clipping threshold |
| **hardness** | 0 to 100 | 100 | % | Knee softness (0=soft, 100=hard) |
| **harmonics** | 0 to 100 | 50 | % | Harmonic generation amount |
| **preGain** | -12 to +12 | 0 | dB | Input gain before clipping |

### Advanced Controls

| Parameter | Range | Default | Unit | Description |
|-----------|-------|---------|------|-------------|
| **oversample** | 1x/2x/4x/8x | 2x | - | Anti-aliasing oversample |
| **postGain** | -12 to +12 | 0 | dB | Output gain compensation |
| **dcFilter** | ON/OFF | ON | - | Remove DC offset |
| **mix** | 0 to 100 | 100 | % | Dry/wet blend |
| **mode** | 0-5 | 0 | - | Clipping algorithm type |

---

## 🎨 Clipping Modes

### 1. HARD
**Algorithm:** `y = clamp(x, -ceiling, +ceiling)`
**Character:** Digital brick wall
**Use Case:** Maximum loudness, aggressive
```javascript
{
  knee: 0,
  saturation: 0,
  evenHarmonics: 0.1,
  oddHarmonics: 0.3,
  character: 'Pure digital clipping'
}
```

### 2. SOFT
**Algorithm:** `y = tanh(x * drive) / tanh(drive)`
**Character:** Smooth saturation
**Use Case:** Gentle limiting, warmth
```javascript
{
  knee: 1.0,
  saturation: 0.3,
  evenHarmonics: 0.6,
  oddHarmonics: 0.2,
  character: 'Soft saturation curve'
}
```

### 3. TUBE
**Algorithm:** Asymmetric soft clipping
**Character:** Tube amplifier emulation
**Use Case:** Analog warmth, vintage
```javascript
{
  knee: 0.8,
  saturation: 0.5,
  evenHarmonics: 0.8,  // Tube = even harmonics
  oddHarmonics: 0.3,
  asymmetry: 0.15,
  character: 'Vacuum tube saturation'
}
```

### 4. DIODE
**Algorithm:** Exponential clipping
**Character:** Transistor/diode clipping
**Use Case:** Guitar distortion, grit
```javascript
{
  knee: 0.6,
  saturation: 0.7,
  evenHarmonics: 0.5,
  oddHarmonics: 0.7,
  asymmetry: 0.3,
  character: 'Diode/transistor clipping'
}
```

### 5. FOLDBACK
**Algorithm:** Wave folding
**Character:** Extreme distortion
**Use Case:** Sound design, synths
```javascript
{
  knee: 0,
  saturation: 0,
  evenHarmonics: 0.4,
  oddHarmonics: 0.8,
  foldback: true,
  character: 'Wave folding distortion'
}
```

### 6. BITCRUSH
**Algorithm:** Bit depth + sample rate reduction
**Character:** Digital lo-fi
**Use Case:** Lo-fi, retro, glitch
```javascript
{
  knee: 0,
  saturation: 0,
  bitDepth: 8,
  sampleRateDiv: 4,
  evenHarmonics: 0.3,
  oddHarmonics: 0.6,
  character: 'Digital bit crushing'
}
```

---

## 🔊 DSP Architecture

```
INPUT
  ↓
PRE-GAIN (-12 to +12dB)
  ↓
OVERSAMPLE (optional 2x/4x/8x upsample)
  ↓
MODE SELECTION
  ├─ Hard Clip
  ├─ Soft Clip (tanh)
  ├─ Tube (asymmetric)
  ├─ Diode (exponential)
  ├─ Foldback (wave fold)
  └─ Bitcrush (quantize)
  ↓
HARMONIC GENERATION
  ├─ Even harmonics (2nd, 4th, 6th...)
  └─ Odd harmonics (3rd, 5th, 7th...)
  ↓
DC FILTER (optional high-pass)
  ↓
DOWNSAMPLE (if oversampled)
  ↓
POST-GAIN (-12 to +12dB, auto-compensate)
  ↓
DRY/WET MIX (0-100%)
  ↓
OUTPUT
  ↓
ANALYSIS (FFT, THD, Crest Factor)
```

---

## 📊 Clipping Algorithms (Code Examples)

### Hard Clip
```javascript
function hardClip(x, ceiling) {
  return Math.max(-ceiling, Math.min(ceiling, x));
}
```

### Soft Clip (Tanh)
```javascript
function softClip(x, ceiling, hardness) {
  const drive = 1 + hardness * 10;
  return (Math.tanh(x * drive) / Math.tanh(drive)) * ceiling;
}
```

### Tube (Asymmetric)
```javascript
function tubeClip(x, ceiling, asymmetry) {
  if (x > 0) {
    return Math.tanh(x * (1 + asymmetry)) * ceiling;
  } else {
    return Math.tanh(x * (1 - asymmetry)) * ceiling;
  }
}
```

### Diode (Exponential)
```javascript
function diodeClip(x, ceiling) {
  const sign = x >= 0 ? 1 : -1;
  const abs = Math.abs(x);
  return sign * ceiling * (1 - Math.exp(-abs / ceiling));
}
```

### Foldback
```javascript
function foldbackClip(x, ceiling) {
  let y = x;
  while (Math.abs(y) > ceiling) {
    if (y > ceiling) {
      y = 2 * ceiling - y;
    } else if (y < -ceiling) {
      y = -2 * ceiling - y;
    }
  }
  return y;
}
```

### Bitcrush
```javascript
function bitcrush(x, bitDepth) {
  const levels = Math.pow(2, bitDepth);
  const step = 2.0 / levels;
  return Math.round(x / step) * step;
}
```

---

## 📊 Features

### Core Features
- ✅ 6 clipping algorithms (Hard, Soft, Tube, Diode, Foldback, Bitcrush)
- ✅ Adjustable hardness/knee
- ✅ Harmonic generation control
- ✅ Pre/post gain controls
- ✅ Auto-gain compensation
- ✅ Oversampling (2x/4x/8x) for anti-aliasing
- ✅ DC filter

### Visualization Features
- ✅ Real-time waveform (input vs output)
- ✅ Harmonic spectrum (FFT analysis)
- ✅ Transfer curve display
- ✅ Clipping percentage indicator
- ✅ THD meter

### Analysis Features
- ✅ THD (Total Harmonic Distortion) %
- ✅ Crest factor (peak/RMS ratio)
- ✅ Clipped sample percentage
- ✅ Even/odd harmonic balance

---

## 💡 Use Cases

1. **Mastering:** Final loudness boost
2. **Drums:** Punch and aggression
3. **Bass:** Sustain and power
4. **Synths:** Harmonic richness
5. **Mix Bus:** Glue and cohesion
6. **Creative:** Distortion effects

---

## 🎯 Quality Targets

| Metric | Target | Notes |
|--------|--------|-------|
| CPU Usage | <3% | Very efficient |
| Latency | <5ms | Low latency |
| Oversample Quality | >90dB SNR | Anti-aliasing |
| THD Range | 0-50% | Adjustable |
| Harmonic Accuracy | ±1dB | Precise control |

---

## 🔊 Harmonic Character

### Even Harmonics (Tube-like)
- 2nd harmonic: +6dB (octave up)
- 4th harmonic: +3dB (two octaves up)
- 6th harmonic: +1dB
- **Character:** Warm, pleasant, musical

### Odd Harmonics (Transistor-like)
- 3rd harmonic: +6dB (octave + fifth)
- 5th harmonic: +3dB
- 7th harmonic: +1dB
- **Character:** Harsh, aggressive, edgy

### Adjustable Balance
```javascript
harmonics: 0-100%
  0% = Clean (minimal harmonics)
  50% = Balanced (even + odd)
  100% = Maximum (rich harmonics)
```

---

## 🚀 Implementation Priority

**Phase 1:** Core clipping
- Hard/Soft algorithms
- Pre/post gain
- Basic meters

**Phase 2:** Advanced modes
- Tube/Diode/Foldback
- Oversampling
- DC filter

**Phase 3:** Visualization
- Waveform display
- Harmonic spectrum
- Transfer curve
- THD analysis

---

## 🎚️ Comparison: Limiter vs Clipper

| Feature | Limiter | Clipper |
|---------|---------|---------|
| **Purpose** | Transparent loudness | Aggressive shaping |
| **Artifacts** | Minimal | Intentional |
| **Harmonics** | None | Rich harmonics |
| **CPU** | Medium | Low |
| **Latency** | 5-10ms (lookahead) | <1ms |
| **Use Case** | Mastering | Creative effect |
| **Character** | Clean | Colored |

---

## 💡 When to Use

**Use Limiter:**
- ✅ Mastering final stage
- ✅ Transparent loudness
- ✅ Broadcasting/streaming
- ✅ No distortion wanted

**Use Clipper:**
- ✅ Maximum loudness (louder than limiter)
- ✅ Harmonic excitement
- ✅ Drum punch
- ✅ Creative distortion
- ✅ Mix glue

**Use Both:**
1. Clipper first (add harmonics, shape peaks)
2. Limiter second (final ceiling, true peak safety)

This is the pro mastering chain!
