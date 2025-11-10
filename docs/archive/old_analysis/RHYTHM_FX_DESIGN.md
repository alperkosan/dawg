# RHYTHM FX - The Groove Sculptor

## 🎯 Plugin Overview

**Category:** The Rhythm Forge
**Purpose:** Infinite rhythmic possibilities - stutter, gate, glitch, repeat, reverse
**Inspired By:** Fruity Gross Beat, Stutter Edit, Artillery, Portal, dBlue Glitch

---

## 🎨 Visual Design

### Color Identity
- **Primary:** Electric Purple (#8B5CF6)
- **Accent:** Neon Cyan (#06B6D4)
- **Gate Active:** Bright Green (#10B981)
- **Muted:** Dark Red (#EF4444)
- **Background:** Dark gradient (#1E1B4B → #1F2937)

### Layout (1000x700px)

```
┌────────────────────────────────────────────────────────────────┐
│  RHYTHM FX - The Groove Sculptor        [Preset ▾] [SYNC][?]  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🎵 STEP SEQUENCER (16 steps)                          │  │
│  │  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐                     │  │
│  │  │█│ │█│ │█│█│ │█│ │█│█│ │█│ │█│█│  ← Gate Pattern    │  │
│  │  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘                     │  │
│  │  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐                     │  │
│  │  │ │▓│ │▓│ │ │▓│ │ │▓│ │▓│ │▓│ │ │  ← Stutter Pattern │  │
│  │  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘                     │  │
│  │  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐                     │  │
│  │  │ │ │▼│ │ │▼│ │ │ │ │▼│ │ │▼│ │ │  ← Reverse Pattern │  │
│  │  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘                     │  │
│  │  [Step 9/16] BPM: 128 | 1/16                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  MODE: [GATE][STUTTER][REPEAT][REVERSE][GLITCH][TAPE STOP]   │
│                                                                 │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐  │
│  │   DIVISION   │    CHANCE    │   INTENSITY  │   SWING     │  │
│  │   ╭─────╮   │   ╭─────╮   │   ╭─────╮   │  ╭─────╮   │  │
│  │   │  ◉  │   │   │  ◉  │   │   │  ◉  │   │  │  ◉  │   │  │
│  │   ╰─────╯   │   ╰─────╯   │   ╰─────╯   │  ╰─────╯   │  │
│  │    1/16      │     75%      │     100%     │    50%      │  │
│  └──────────────┴──────────────┴──────────────┴─────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🎛️ GENERATOR MODES (Infinite Patterns)                 │  │
│  │  • EUCLIDEAN: [Steps: 16] [Pulses: 7] [Rotation: 3]    │  │
│  │  • RANDOM: [Density: 50%] [Seed: 1234]                  │  │
│  │  • POLYRHYTHM: [Pattern A: 3] [Pattern B: 4]            │  │
│  │  • HUMAN: [Swing: 60%] [Velocity Var: 30%]              │  │
│  │  • CUSTOM: Draw your own pattern ✏️                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ⚙️ ADVANCED                                             │  │
│  │  BUFFER SIZE: [━━━━━●────] 500ms                        │  │
│  │  FADE TIME:   [━━●────────] 10ms (anti-click)           │  │
│  │  GLITCH AMT:  [━━━━━━●────] 60%                         │  │
│  │  TAPE SPEED:  [━━━━●──────] 50% (pitch follows)         │  │
│  │  ☑ HOST SYNC  ☑ QUANTIZE  ☐ PITCH SHIFT               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  STATS: Active: Step 9 | Pattern: Custom | CPU: 2.1%          │
└────────────────────────────────────────────────────────────────┘
```

---

## 🎛️ Parameters

### Main Controls

| Parameter | Range | Default | Unit | Description |
|-----------|-------|---------|------|-------------|
| **division** | 1/32 to 2 bars | 1/16 | - | Note division for steps |
| **chance** | 0 to 100 | 100 | % | Probability of step triggering |
| **intensity** | 0 to 100 | 100 | % | Effect depth per step |
| **swing** | 0 to 100 | 50 | % | Groove/shuffle amount |

### Pattern Parameters

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| **steps** | 1 to 32 | 16 | Number of steps in pattern |
| **pulses** | 1 to 32 | 8 | Euclidean pulses (if euclidean mode) |
| **rotation** | 0 to 31 | 0 | Pattern rotation offset |
| **density** | 0 to 100 | 50 | Random pattern density |
| **seed** | 0 to 9999 | 1234 | Random seed for reproducibility |

### Effect Controls

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| **bufferSize** | 10 to 2000 | 500 | ms | Stutter buffer length |
| **fadeTime** | 1 to 50 | 10 | ms | Crossfade to prevent clicks |
| **glitchAmount** | 0 to 100 | 50 | % | Glitch intensity |
| **tapeSpeed** | -200 to 200 | 100 | % | Tape stop/speed effect |
| **mode** | 0-5 | 0 | - | Effect mode type |

---

## 🎨 Effect Modes

### 1. GATE 🚪
**Algorithm:** Mute/unmute based on pattern
```javascript
{
  type: 'gate',
  attack: 1,    // Fast gate open
  release: 10,  // Smooth gate close
  smooth: true  // Anti-click
}
```

### 2. STUTTER 🔁
**Algorithm:** Repeat tiny buffer slices
```javascript
{
  type: 'stutter',
  bufferSize: 100,  // 100ms repeats
  repeats: 4,       // Repeat 4 times
  fadeTime: 5       // 5ms crossfade
}
```

### 3. REPEAT 🔄
**Algorithm:** Loop larger sections
```javascript
{
  type: 'repeat',
  bufferSize: 500,  // Half second loop
  beatSync: true,   // Sync to BPM
  fadeLoop: true    // Smooth loop
}
```

### 4. REVERSE ⏪
**Algorithm:** Play backwards
```javascript
{
  type: 'reverse',
  bufferSize: 250,
  crossfade: 10,
  pitchShift: 0     // Optional pitch shift
}
```

### 5. GLITCH 🎭
**Algorithm:** Random slice rearrangement
```javascript
{
  type: 'glitch',
  sliceSize: 50,    // Slice into 50ms chunks
  randomize: 0.8,   // 80% randomness
  stutter: 0.3      // 30% stutter mix
}
```

### 6. TAPE STOP ⏹️
**Algorithm:** Vinyl/tape slowdown
```javascript
{
  type: 'tapeStop',
  stopTime: 500,    // Stop over 500ms
  curve: 2.0,       // Exponential curve
  pitchFollow: true // Pitch drops as it slows
}
```

---

## 🎵 Pattern Generators

### EUCLIDEAN
Generate mathematical patterns using Bjorklund's algorithm
```javascript
euclidean(steps: 16, pulses: 7, rotation: 0)
// Example: [1,0,1,0,1,0,1,1,0,1,0,1,0,1,1,0]
// Creates evenly distributed rhythms
```

**Use Cases:**
- `euclidean(16, 4, 0)` = Four-on-floor kick pattern
- `euclidean(16, 7, 3)` = Complex polyrhythmic pattern
- `euclidean(8, 3, 1)` = Son clave rhythm

### RANDOM
Controlled randomness with seed
```javascript
random(density: 50, seed: 1234)
// Same seed = same pattern (reproducible)
```

### POLYRHYTHM
Layer multiple rhythms
```javascript
polyrhythm(patternA: 3, patternB: 4)
// Combines 3-against-4 rhythms
// Creates complex evolving patterns
```

### HUMAN
Add human feel
```javascript
human(swing: 60, velocityVariation: 30, timing: 5)
// Swing: shuffle amount
// Velocity: dynamic variation
// Timing: slight timing imperfections
```

### CUSTOM
Draw your own pattern with mouse/touch
```javascript
// Click steps to toggle on/off
// Right-click for half intensity
// Drag to paint
```

---

## 🔊 DSP Architecture

```
INPUT AUDIO
  ↓
CIRCULAR BUFFER (2000ms max)
  ↓
PATTERN SEQUENCER (sync to BPM)
  ↓
STEP PROCESSOR (for each active step):
  ├─ GATE: Volume envelope
  ├─ STUTTER: Buffer repeat
  ├─ REPEAT: Loop playback
  ├─ REVERSE: Backwards playback
  ├─ GLITCH: Slice randomization
  └─ TAPE STOP: Speed ramp
  ↓
CROSSFADE ENGINE (anti-click)
  ↓
SWING/HUMANIZE (timing offset)
  ↓
INTENSITY/CHANCE (probability)
  ↓
DRY/WET MIX
  ↓
OUTPUT
```

---

## 📊 Advanced Features

### Host Sync
- Automatically sync to DAW/transport BPM
- Quantize pattern changes to bar boundaries
- Follow tempo changes in real-time

### Pattern Chaining
- Chain up to 8 patterns in sequence
- Create evolving rhythmic structures
- A-B-C-D pattern morphing

### MIDI Trigger
- Trigger patterns via MIDI notes
- C4 = Pattern 1, D4 = Pattern 2, etc.
- Velocity controls intensity

### Probability Per Step
- Each step has individual chance %
- Create dynamic, evolving patterns
- Never sounds exactly the same twice

### Multi-Lane
- 3 independent pattern lanes:
  - Lane 1: Gate pattern
  - Lane 2: Stutter pattern
  - Lane 3: Reverse pattern
- Combine multiple effects simultaneously

---

## 🎨 Preset Categories

### DRUMS
- "Trap Hi-Hat Rolls" - Fast stutter on 16ths
- "EDM Build Gate" - Progressive gate pattern
- "Breakbeat Glitch" - Random slice rearrangement
- "Dubstep Wobble" - Rhythmic gating

### MELODIC
- "Trance Gate" - Classic 1/16 gate pattern
- "Ambient Stutter" - Slow, spacious repeats
- "Vocal Chop" - Rhythmic vocal slicing
- "Synth Glitch" - Glitchy arpeggios

### CREATIVE
- "Tape Rewind" - Reverse build-up
- "Glitch Mayhem" - Maximum randomness
- "Polyrhythm 5/7" - Complex poly pattern
- "Euclidean Dream" - Mathematical beauty

### EXPERIMENTAL
- "Granular Chaos" - Tiny grain stutters
- "Time Freeze" - Long buffer loops
- "Reverse Reverb" - Backwards ambience
- "Random Walk" - Evolving random pattern

---

## 💡 Implementation Priority

**Phase 1: Core Engine**
- Circular buffer system
- Basic gate pattern
- Host sync
- 16-step sequencer

**Phase 2: Effects**
- Stutter
- Repeat
- Reverse
- Basic glitch

**Phase 3: Generators**
- Euclidean generator
- Random with seed
- Custom drawing

**Phase 4: Polish**
- Multi-lane
- Pattern chaining
- MIDI trigger
- Advanced glitch

---

## 🎯 Key Differentiators

**vs. Gross Beat:**
- More pattern generators (Euclidean!)
- Better visual feedback
- Multi-lane patterns
- Probability per step

**vs. Stutter Edit:**
- Simpler, more intuitive
- Real-time pattern drawing
- Better CPU efficiency
- More musical presets

**vs. Artillery:**
- Lighter CPU usage
- Better for live performance
- Easier learning curve
- More creative modes

---

## 🎚️ Use Cases

1. **Build-ups:** Increasing stutter rate before drop
2. **Breakdowns:** Tape stop into silence
3. **Fills:** Quick glitch bursts between sections
4. **Texture:** Ambient stutter for atmosphere
5. **Drums:** Hi-hat rolls and percussion gates
6. **Vocals:** Rhythmic chopping
7. **Live Performance:** Pattern switching on the fly
8. **Sound Design:** Glitchy textures

---

## 📊 Technical Specs

| Metric | Target |
|--------|--------|
| Max Steps | 32 |
| Max Buffer | 2000ms |
| Max Patterns | 8 chained |
| CPU Usage | <5% |
| Latency | <10ms |
| Pattern Lanes | 3 simultaneous |

---

## 🚀 Future Enhancements

- **Sidechain Input:** Gate based on external audio
- **LFO Modulation:** Modulate parameters rhythmically
- **Envelope Follower:** Dynamic intensity
- **MIDI Output:** Trigger other instruments
- **Pattern Library:** Share/import community patterns
- **Morph Mode:** Blend between two patterns

This is THE rhythmic powerhouse! 🎵⚡
