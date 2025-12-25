# Instrument System Architecture

## Current State Analysis (18 Ekim 2025)

### Instrument Types

```
INSTRUMENT_TYPES = {
  SAMPLE: 'sample',       // Audio buffer playback
  SYNTH: 'synth',        // ForgeSynth (legacy worklet-based)
  VASYNTH: 'vasynth'     // VASynth (native Web Audio)
}
```

### Current Systems (Fragmented)

#### 1. NativeAudioEngine (Playback)
**Location:** `/lib/core/NativeAudioEngine.js`
**Responsibility:** Pattern playback, sequencing
**Supports:**
- ✅ SAMPLE (via NativeSamplerNode)
- ✅ SYNTH (via NativeSynthInstrument)
- ⚠️ VASYNTH (placeholder only)

#### 2. SamplePreview (Preview - Legacy)
**Location:** `/features/piano_roll_v7/utils/samplePreview.js`
**Responsibility:** Keyboard piano preview
**Supports:**
- ✅ SAMPLE only

#### 3. SynthPreview (Preview - New)
**Location:** `/features/piano_roll_v7/utils/synthPreview.js`
**Responsibility:** Unified preview (sample + synth)
**Supports:**
- ✅ SAMPLE
- ✅ VASYNTH (via VASynth.js)
- ❌ SYNTH (ForgeSynth)

#### 4. VASynth Engine
**Location:** `/lib/audio/synth/VASynth.js`
**Responsibility:** Real-time synth synthesis
**Status:** ✅ Complete, not integrated

---

## Problem: Fragmented Architecture

### Issues:
1. **Multiple Preview Systems** - samplePreview.js vs synthPreview.js
2. **Incomplete Playback Support** - VASynth only works in preview
3. **No Multi-Sampling** - Sample instruments can't use multiple samples
4. **Duplicate Logic** - Sample loading logic repeated in multiple places

---

## Proposed Architecture: Centralized Instrument System

### Core Principle
**Single Source of Truth:** One factory creates all instruments for both playback and preview.

### New Structure

```
/lib/audio/
├── instruments/                    # 🆕 Central instrument system
│   ├── InstrumentFactory.js       # Factory pattern - creates all instrument types
│   ├── base/
│   │   └── BaseInstrument.js      # Base class with common interface
│   ├── sample/
│   │   ├── SampleInstrument.js    # Single-sample playback
│   │   └── MultiSampleInstrument.js # Multi-sampled instruments
│   ├── synth/
│   │   ├── VASynthInstrument.js   # VASynth wrapper
│   │   └── ForgeSynthInstrument.js # Legacy ForgeSynth wrapper
│   └── loaders/
│       ├── SampleLoader.js        # Centralized sample loading
│       └── MultiSampleLoader.js   # Multi-sample loading logic
│
├── synth/
│   ├── VASynth.js                 # ✅ Existing - synth engine
│   ├── ADSREnvelope.js            # ✅ Existing
│   ├── LFO.js                     # ✅ Existing
│   └── presets.js                 # ✅ Existing
│
└── preview/                        # 🆕 Unified preview system
    └── PreviewManager.js          # Single preview manager for all types
```

---

## InstrumentFactory Pattern

### Interface

```javascript
class InstrumentFactory {
  // Create instrument for playback (NativeAudioEngine)
  static createPlaybackInstrument(instrumentData, audioContext, options)

  // Create instrument for preview (keyboard piano, hover)
  static createPreviewInstrument(instrumentData, audioContext, options)

  // Load samples (with caching)
  static async loadSamples(instrumentData, audioContext)

  // Get instrument capabilities
  static getCapabilities(instrumentType)
}
```

### Usage

```javascript
// In NativeAudioEngine.js
const instrument = await InstrumentFactory.createPlaybackInstrument(
  instrumentData,
  this.audioContext,
  { mixerChannel: channelId }
);

// In PreviewManager.js
const previewInst = await InstrumentFactory.createPreviewInstrument(
  instrumentData,
  this.audioContext,
  { mode: 'keyboard' }
);
```

---

## BaseInstrument Interface

All instruments implement:

```javascript
class BaseInstrument {
  constructor(data, audioContext) {}

  // Lifecycle
  async initialize()
  dispose()

  // Playback
  noteOn(midiNote, velocity, startTime)
  noteOff(stopTime)

  // Routing
  connect(destination)
  disconnect()

  // State
  get isPlaying()
  get type()
  get id()
}
```

---

## Multi-Sample Architecture

### Problem
Current: Piano (Sampled) has 8 samples but no logic to select correct sample per note.

### Solution: MultiSampleInstrument

```javascript
class MultiSampleInstrument extends BaseInstrument {
  constructor(data, audioContext, sampleBuffers) {
    this.multiSamples = data.multiSamples; // Array of { midiNote, url, buffer }
    this.sampleMap = this.buildSampleMap();
  }

  buildSampleMap() {
    // Map MIDI notes to nearest samples
    // Example: MIDI 60 (C4) -> piano_c4.ogg
    //          MIDI 61 (C#4) -> piano_c4.ogg (pitch shifted +1 semitone)
  }

  noteOn(midiNote, velocity, startTime) {
    const { buffer, pitchShift } = this.findNearestSample(midiNote);
    // Play buffer with pitch shift
  }
}
```

---

## Sample Loading Strategy

### Current Issues:
- Samples loaded in NativeAudioEngine.js
- No caching between preview and playback
- No progress tracking

### New: SampleLoader (Centralized)

```javascript
class SampleLoader {
  static cache = new Map(); // Shared cache

  static async load(url, audioContext) {
    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    // Load and decode
    const buffer = await this.fetchAndDecode(url, audioContext);

    // Cache
    this.cache.set(url, buffer);

    return buffer;
  }

  static async loadMultiple(urls, audioContext, onProgress) {
    // Parallel loading with progress
  }
}
```

---

## VASynth Integration

### VASynthInstrument Wrapper

```javascript
class VASynthInstrument extends BaseInstrument {
  constructor(data, audioContext) {
    super(data, audioContext);
    this.engine = new VASynth(audioContext);
    this.preset = getPreset(data.presetName);
  }

  async initialize() {
    this.engine.loadPreset(this.preset);
  }

  noteOn(midiNote, velocity, startTime) {
    this.engine.noteOn(midiNote, velocity, startTime);
  }

  noteOff(stopTime) {
    this.engine.noteOff(stopTime);
  }

  connect(destination) {
    // VASynth connects its masterGain to destination
  }
}
```

---

## Preview System Unification

### PreviewManager (Single Manager)

```javascript
class PreviewManager {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.activeInstruments = new Map(); // key -> instrument instance
  }

  async setInstrument(instrumentData) {
    // Use InstrumentFactory
    const inst = await InstrumentFactory.createPreviewInstrument(
      instrumentData,
      this.audioContext
    );

    this.currentInstrument = inst;
  }

  playNote(key, midiNote, velocity) {
    this.currentInstrument.noteOn(midiNote, velocity);
  }

  stopNote(key) {
    this.currentInstrument.noteOff();
  }
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure ✅
- [x] VASynth engine (VASynth.js, ADSREnvelope.js, LFO.js)
- [x] Presets (presets.js)
- [x] Constants (INSTRUMENT_TYPES.VASYNTH)

### Phase 2: Centralized System (Current)
- [ ] Create BaseInstrument interface
- [ ] Create InstrumentFactory
- [ ] Create SampleLoader with caching
- [ ] Create MultiSampleInstrument
- [ ] Create VASynthInstrument wrapper

### Phase 3: Integration
- [ ] Update NativeAudioEngine to use InstrumentFactory
- [ ] Replace samplePreview/synthPreview with PreviewManager
- [ ] Update useNoteInteractionsV2 to use PreviewManager

### Phase 4: Testing & Optimization
- [ ] Test all instrument types (SAMPLE, VASYNTH, SYNTH)
- [ ] Test multi-sampling (Piano)
- [ ] Test keyboard piano mode
- [ ] Performance optimization

---

## Benefits of Centralized Architecture

### 1. **Consistency**
- Same instrument creation logic everywhere
- Guaranteed interface compliance

### 2. **Code Reuse**
- Sample loading logic shared
- Preview and playback use same instruments

### 3. **Maintainability**
- Single place to fix bugs
- Easy to add new instrument types

### 4. **Performance**
- Shared sample cache (preview + playback)
- Efficient resource management

### 5. **Type Safety**
- Factory validates instrument data
- TypeScript-ready structure

---

## Migration Path

### Backward Compatibility
- Keep existing NativeSamplerNode for now
- Gradually migrate to new system
- Support both old and new simultaneously

### Testing Strategy
1. Create new factory alongside existing code
2. Test with one instrument type (VASYNTH)
3. Migrate SAMPLE instruments
4. Migrate SYNTH (ForgeSynth)
5. Remove old code

---

**Last Updated:** 18 Ekim 2025
**Status:** Architecture Defined, Implementation Pending
