# 🏗️ DAWG Architecture Documentation

**Last Updated:** 2025-01-XX  
**Version:** 2.0.0

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Core Architecture](#core-architecture)
3. [Audio Engine](#audio-engine)
4. [Plugin System](#plugin-system)
5. [UI Components](#ui-components)
6. [State Management](#state-management)
7. [Performance Optimizations](#performance-optimizations)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DAWG Application                         │
├─────────────────────────────────────────────────────────────┤
│  UI Layer (React Components)                                │
│  ├── Piano Roll v7                                          │
│  ├── Channel Rack                                           │
│  ├── Mixer                                                  │
│  └── Plugin Panels                                          │
├─────────────────────────────────────────────────────────────┤
│  State Management (Zustand)                                 │
│  ├── Instruments Store                                      │
│  ├── Patterns Store                                         │
│  ├── Mixer Store                                            │
│  └── UI State Store                                         │
├─────────────────────────────────────────────────────────────┤
│  Audio Engine (NativeAudioEngine)                           │
│  ├── UnifiedMixer (WASM)                                    │
│  ├── MixerInsert System                                     │
│  ├── Instrument Factory                                     │
│  └── PlaybackManager                                        │
├─────────────────────────────────────────────────────────────┤
│  Plugin System v2.0                                         │
│  ├── BaseAudioPlugin                                        │
│  ├── PresetManager                                          │
│  ├── ParameterBatcher                                       │
│  └── CanvasRenderManager                                    │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend Framework:** React 18 + Vite
- **State Management:** Zustand
- **Audio Processing:** Web Audio API + AudioWorklet
- **DSP:** WASM (Rust) + JavaScript fallback
- **Visualization:** Canvas API
- **Build Tool:** Vite
- **Styling:** CSS Modules + Tailwind CSS

---

## Core Architecture

### Design Patterns

#### 1. Singleton Pattern
- **PlaybackController**: Single instance for playback state
- **TimelineController**: Single instance for transport control
- **AudioContextService**: Single instance for audio context management

#### 2. Factory Pattern
- **InstrumentFactory**: Creates instrument instances
- **EffectFactory**: Creates effect instances
- **AudioProcessorFactory**: Creates audio processor backends

#### 3. Observer Pattern
- **EventBus**: Decoupled communication between components
- **Store Subscriptions**: Zustand store subscriptions

#### 4. Strategy Pattern
- **AudioProcessorBackend**: JavaScript vs WASM backend selection
- **Rendering Strategies**: Different rendering modes for plugins

### Separation of Concerns

```
UI Layer          → React Components (presentation)
State Layer       → Zustand Stores (state management)
Business Logic    → Services & Managers (business rules)
Audio Layer       → NativeAudioEngine (audio processing)
Plugin Layer      → Plugin System v2.0 (effects processing)
```

---

## Audio Engine

### NativeAudioEngine

**Location:** `client/src/lib/core/NativeAudioEngine.js`

**Responsibilities:**
- Audio context management
- Instrument creation and management
- Mixer system (UnifiedMixer + MixerInsert)
- Playback management
- Effect processing

**Key Components:**

#### 1. UnifiedMixer
- **Type:** AudioWorkletNode (WASM-accelerated)
- **Channels:** 32 channels
- **Performance:** 11x faster than old system
- **Location:** `client/src/lib/core/UnifiedMixerNode.js`

#### 2. MixerInsert System
- **Dynamic Routing:** Instruments → MixerInsert → UnifiedMixer
- **Effect Chain:** Per-insert effect processing
- **Location:** `client/src/lib/core/MixerInsert.js`

#### 3. Instrument Factory
- **Supported Types:**
  - SingleSampleInstrument (drums, one-shots)
  - MultiSampleInstrument (piano, chromatic)
  - VASynthInstrument (virtual analog synthesizer)
  - AIInstrument (AI-generated instruments)

#### 4. PlaybackManager
- **Note Scheduling:** Precise note timing
- **Pattern Playback:** Pattern-based sequencing
- **Transport Control:** Play, pause, stop, seek

### Audio Graph Structure

```
Instrument → MixerInsert → Effect Chain → UnifiedMixer → Master Bus → Output
```

---

## Plugin System

### Plugin System v2.0

**Location:** `client/src/lib/audio/plugins/`

**Architecture:**

#### 1. BaseAudioPlugin
- **Base Class:** All plugins extend this
- **Features:**
  - Parameter management
  - Preset management
  - A/B comparison
  - Undo/Redo
  - Event system

#### 2. PresetManager
- **Location:** `client/src/lib/audio/PresetManager.js`
- **Features:**
  - Factory presets
  - User presets
  - A/B comparison
  - Undo/Redo (50-step history)
  - Search with tags
  - Import/Export

#### 3. ParameterBatcher
- **Location:** `client/src/lib/audio/ParameterBatcher.js`
- **Features:**
  - Automatic batching (60fps)
  - 98% postMessage reduction
  - Per-effect batching
  - Statistics tracking

#### 4. CanvasRenderManager
- **Location:** `client/src/lib/audio/CanvasRenderManager.js`
- **Features:**
  - Single RAF loop for all plugins
  - Priority-based rendering queue
  - Smart throttling
  - Canvas pooling (90%+ reuse)

### Plugin Categories

1. **Texture Lab** (Saturator)
2. **Dynamics Forge** (Compressor, TransientDesigner, MultiBandEQ)
3. **Spacetime Chamber** (Delay, Reverb, Panner)
4. **Spectral Forge** (EQ, Filter)
5. **Creative Tools** (Phaser, Chorus, PitchShifter)

### Migrated Plugins (7/14)

- ✅ Saturator v2.0
- ✅ AdvancedCompressor v2.0
- ✅ TransientDesigner v2.0
- ✅ ModernDelay v2.0
- ✅ ModernReverb v2.0
- ✅ OrbitPanner v2.0
- ✅ MultiBandEQ v2.0

### Remaining Plugins (7/14)

- ⏳ TidalFilter
- ⏳ StardustChorus
- ⏳ VortexPhaser
- ⏳ PitchShifter
- ⏳ ArcadeCrusher
- ⏳ BassEnhancer808
- ⏳ OTT

---

## UI Components

### Component Library

**Location:** `client/src/components/`

**Core Components:**
- **Knob**: Parameter control knob
- **Slider**: Parameter slider
- **Button**: Action button
- **Switch**: Toggle switch
- **Dropdown**: Selection dropdown
- **Canvas**: Visualization canvas
- **PresetBrowser**: Preset browser
- **PluginContainer**: Plugin container with preset management

### Design System

**Zenith Design System:**
- **Color Palettes:** 5 categories (texture-lab, dynamics-forge, etc.)
- **Typography:** Consistent font system
- **Spacing:** 8px grid system
- **Components:** 15 core components

### Key UI Features

#### Piano Roll v7
- Canvas-based rendering
- Note editing (create, move, resize, delete)
- Slide notes (FL Studio-style)
- Lasso selection
- Time range selection
- Loop region selection

#### Channel Rack
- Instrument management
- Pattern sequencing
- Step grid
- Instrument picker

#### Mixer
- 32-channel mixer
- Dynamic routing
- Effect chains
- Send/Return system

---

## State Management

### Zustand Stores

**Location:** `client/src/store/`

**Key Stores:**

#### 1. Instruments Store
- Instrument management
- Instrument creation/deletion
- Instrument routing

#### 2. Patterns Store
- Pattern management
- Pattern playback
- Pattern editing

#### 3. Mixer Store
- Mixer track management
- Effect management
- Routing management

#### 4. UI State Store
- Panel management
- View state
- UI preferences

### Store Structure

```javascript
{
  instruments: Map<id, instrument>,
  patterns: Map<id, pattern>,
  mixerTracks: Map<id, track>,
  uiState: {
    panels: Map<id, panel>,
    activePattern: id,
    // ...
  }
}
```

---

## Performance Optimizations

### Implemented Optimizations

#### 1. Voice Stealing
- **Location:** `client/src/lib/core/PlaybackManager.js`
- **Benefit:** Reduced memory usage, improved polyphony

#### 2. Parameter Batching
- **Location:** `client/src/lib/audio/ParameterBatcher.js`
- **Benefit:** 98% postMessage reduction

#### 3. Canvas Pooling
- **Location:** `client/src/lib/audio/CanvasRenderManager.js`
- **Benefit:** 90%+ canvas reuse

#### 4. UnifiedMixer (WASM)
- **Location:** `client/src/lib/core/UnifiedMixerNode.js`
- **Benefit:** 11x performance improvement

#### 5. Lazy Initialization
- **Benefit:** Faster startup time
- **Implementation:** Instruments and effects created on-demand

### Performance Metrics

- **CPU Usage:** 2-3% (idle)
- **Memory Usage:** ~118MB (stable)
- **AudioNode Count:** 864 (optimized)
- **Build Time:** ~4.85s
- **Bundle Size:** ~984 KB (gzipped)

---

## Development Guidelines

### Code Style
- **ESLint:** Configured for React + JavaScript
- **Prettier:** Code formatting
- **TypeScript:** For new features (gradual migration)

### Testing
- **Unit Tests:** Jest (planned)
- **Integration Tests:** (planned)
- **E2E Tests:** (planned)

### Documentation
- **JSDoc:** Function documentation
- **README:** Component documentation
- **Architecture Docs:** This file

---

## Future Improvements

### Planned Optimizations
1. **WASM DSP:** Full WASM migration for DSP
2. **Web Workers:** Offload heavy computations
3. **Virtual Scrolling:** Large pattern lists
4. **Code Splitting:** Lazy load plugins

### Planned Features
1. **Plugin SDK:** 3rd party plugin support
2. **Preset Marketplace:** Community presets
3. **Mobile Support:** iPad optimization
4. **Advanced Automation:** Complex curves

---

**Last Updated:** 2025-01-XX  
**Maintained by:** DAWG Development Team

