# LIMITER - The Ceiling Guardian

## 🎯 Plugin Overview

**Category:** The Dynamics Forge
**Purpose:** Loudness maximization with transparent peak limiting
**Inspired By:** FabFilter Pro-L 2, Waves L2, iZotope Ozone Maximizer

---

## 🎨 Visual Design

### Color Identity
- **Primary:** Steel Blue (#4A90E2)
- **Warning:** Red (#E74C3C) when limiting active
- **Background:** Dark gray gradient (#1a1a2e → #16213e)
- **Accent:** Cyan (#00D9FF) for metering

### Layout (1100x720px)

```
┌─────────────────────────────────────────────────────────────┐
│  LIMITER - The Ceiling Guardian          [Preset ▾] [?]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  🧱 BRICK WALL VISUALIZATION (Real-time Waveform)     │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━ ← Ceiling (-0.1dB)   │ │ │
│  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                              │ │ │
│  │  │  ████████████████████    ← Input (red=clipping) │ │ │
│  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                              │ │ │
│  │  │  ━━━━━━━━━━━━━━━━━━━━━━━━                       │ │ │
│  │  │  Time → (scrolling right)                        │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │  STATUS: 🔴 LIMITING | GR: -3.2dB peak              │ │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  MODE: [TRANSPARENT][PUNCHY][AGGRESSIVE][MODERN][VINTAGE]  │
│                                                              │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │   CEILING    │   RELEASE    │      TRUE PEAK           │ │
│  │   ╭─────╮   │   ╭─────╮   │      ╭─────╮            │ │
│  │   │  ◉  │   │   │  ◉  │   │      │ ON  │            │ │
│  │   ╰─────╯   │   ╰─────╯   │      ╰─────╯            │ │
│  │   -0.1 dB    │    100 ms    │      4x OSR             │ │
│  └──────────────┴──────────────┴──────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  📊 GAIN REDUCTION HISTORY (Last 10s)                 │ │
│  │  ▓▓▓▓▓▓▒▒▒░░░░░░   -6dB peak                         │ │
│  │  ▓▓▓▓▒▒▒░░░░░░░░   -3dB                              │ │
│  │  ▓▓▒▒░░░░░░░░░░░   -1dB                              │ │
│  │  ▒░░░░░░░░░░░░░░    0dB (no GR)                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  METERS                                              │  │
│  │  INPUT:  [━━━━━━━━━━●───────] -3.2 dB               │  │
│  │  OUTPUT: [━━━━━━━━━━━━━━━━●─] -0.1 dB               │  │
│  │  GR:     [────────●──────────] -3.1 dB               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────── ADVANCED ──────────────────────────┐ │
│  │ LOOKAHEAD: [●───] 5ms    KNEE: [BRICK][SOFT]         │ │
│  │ ISP MODE:  [OFF][2x][4x][8x]    AUTO-GAIN [◉]       │ │
│  │ STEREO LINK: [━━━━━━━━●─] 100%                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  STATS: Attack: <1ms | GR Peak: -3.2dB | GR Avg: -1.8dB    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎛️ Parameters

### Main Controls

| Parameter | Range | Default | Unit | Description |
|-----------|-------|---------|------|-------------|
| **ceiling** | -10 to 0 | -0.1 | dB | Output ceiling level |
| **release** | 10 to 1000 | 100 | ms | Recovery time |
| **truePeak** | ON/OFF | ON | - | Enable ISP detection |
| **oversample** | 1x/2x/4x/8x | 4x | - | ISP oversampling rate |

### Advanced Controls

| Parameter | Range | Default | Unit | Description |
|-----------|-------|---------|------|-------------|
| **lookahead** | 0 to 10 | 5 | ms | Preview buffer time |
| **knee** | Brick/Soft | Brick | - | Limiting curve shape |
| **autoGain** | ON/OFF | OFF | - | Auto input gain |
| **stereoLink** | 0 to 100 | 100 | % | L/R channel linking |
| **attack** | 0.01 to 10 | 0.1 | ms | Envelope attack |

---

## 🎨 Mode Profiles

### 1. TRANSPARENT
**Use Case:** Mastering, invisible limiting
**Character:** Clean, no coloration
```javascript
{
  attack: 0.1,
  release: 500,
  knee: 'soft',
  lookahead: 10,
  character: 'Pristine, transparent limiting'
}
```

### 2. PUNCHY
**Use Case:** Drums, percussive material
**Character:** Preserves transients
```javascript
{
  attack: 1,
  release: 100,
  knee: 'brick',
  lookahead: 5,
  transientPreserve: 0.8,
  character: 'Fast, preserves punch'
}
```

### 3. AGGRESSIVE
**Use Case:** Maximum loudness
**Character:** Fast, loud
```javascript
{
  attack: 0.01,
  release: 50,
  knee: 'brick',
  lookahead: 2,
  character: 'Maximum loudness, fast recovery'
}
```

### 4. MODERN
**Use Case:** Streaming (Spotify, Apple Music)
**Character:** LUFS-optimized
```javascript
{
  attack: 0.5,
  release: 200,
  knee: 'soft',
  lookahead: 8,
  truePeakTarget: -1.0,
  character: 'Streaming-ready, -1dB TP'
}
```

### 5. VINTAGE
**Use Case:** Analog-style limiting
**Character:** Soft, warm
```javascript
{
  attack: 5,
  release: 300,
  knee: 'soft',
  lookahead: 0,
  saturation: 0.15,
  character: 'Analog-style soft limiting'
}
```

---

## 🔊 DSP Architecture

```
INPUT
  ↓
LOOKAHEAD BUFFER (0-10ms delay)
  ↓
TRUE PEAK DETECTION (optional 2x/4x/8x oversample)
  ↓
ENVELOPE FOLLOWER
  ├─ Attack (0.01-10ms)
  └─ Release (10-1000ms)
  ↓
GAIN COMPUTER
  ├─ Ceiling (-10 to 0dB)
  ├─ Knee (Brick / Soft)
  └─ Stereo Link (0-100%)
  ↓
GAIN REDUCTION
  ↓
OUTPUT (at ceiling)
  ↓
METERS & VISUALIZATION
```

---

## 📊 Features

### Core Features
- ✅ True Peak limiting (prevents inter-sample clipping)
- ✅ Lookahead buffer (artifact-free limiting)
- ✅ Multiple oversampling modes (2x/4x/8x)
- ✅ Brick wall / Soft knee
- ✅ Independent L/R or linked stereo
- ✅ Auto-gain compensation

### Visualization Features
- ✅ Real-time waveform display with ceiling
- ✅ GR history graph (10 seconds)
- ✅ Input/Output/GR meters
- ✅ Peak hold indicators
- ✅ Clipping detection (red flash)

### Metering
- ✅ Peak + RMS meters
- ✅ True Peak detection
- ✅ LUFS measurement (integrated)
- ✅ GR peak/average display

---

## 💡 Use Cases

1. **Mastering:** Final loudness control
2. **Mixing:** Bus limiting
3. **Live Performance:** Safety limiting
4. **Streaming:** LUFS compliance (-14 LUFS, -1dB TP)
5. **Broadcast:** EBU R128 compliance

---

## 🎯 Quality Targets

| Metric | Target | Professional Standard |
|--------|--------|----------------------|
| THD+N | <0.001% | FabFilter Pro-L 2: 0.0005% |
| Latency | <10ms | Industry: 5-15ms |
| CPU Usage | <5% | Acceptable: <10% |
| True Peak Accuracy | ±0.1dB | Industry: ±0.2dB |
| Release Smoothness | No pumping | Critical |

---

## 🚀 Implementation Priority

**Phase 1:** Core limiting engine
- True peak detection
- Lookahead buffer
- Gain computer
- Basic meters

**Phase 2:** Visualization
- Waveform display
- GR history
- Advanced meters

**Phase 3:** Advanced features
- Mode profiles
- Auto-gain
- LUFS metering
