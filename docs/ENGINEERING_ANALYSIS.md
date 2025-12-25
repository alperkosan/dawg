# 🔬 Engineering Architecture Analysis

> A critical review of the DAWG system architecture from an engineering perspective.

---

## 🎯 Executive Summary

The DAWG architecture is a functional, feature-rich system. However, from an engineering perspective, there are several areas where different techniques could have **shortened the development path** and **reduced long-term maintenance costs**.

---

## 1. 🚨 God Class Anti-Pattern

### Problem
The core engine files are excessively large:
- `NativeAudioEngine.js`: **2,599 lines**, 109 methods
- `PlaybackManager.js`: **2,620 lines**, 84 methods

This is a classic "God Class" anti-pattern. These files are the bottleneck for:
- **Development velocity**: Hard to onboard new developers.
- **Testing**: Complex to unit test.
- **Bug isolation**: Changes in one area can break others.

### Recommendation
**Apply the Command Pattern + Service Layer.**

Instead of methods like `engine.createInstrument()`, `engine.setChannelVolume()`, etc., use a command dispatcher:

```javascript
// Before (God Class)
engine.createInstrument(data);
engine.setChannelVolume(id, 0.8);
engine.setChannelPan(id, -0.5);

// After (Command Pattern)
dispatch({ type: 'CREATE_INSTRUMENT', payload: data });
dispatch({ type: 'SET_CHANNEL_VOLUME', channelId: id, value: 0.8 });
```

This decouples the *what* (intent) from the *how* (implementation) and allows for easy undo/redo, logging, and testing.

---

## 2. 🗄️ Store Proliferation

### Problem
The `store/` directory contains **15 separate Zustand stores**. Examples:
- `useArrangementStore.js` (40KB)
- `useArrangementWorkspaceStore.js` (29KB)
- `useMixerStore.js` (32KB)

This indicates:
- **Unclear ownership**: Which store owns "arrangement" state?
- **State sync issues**: Keeping multiple stores in sync is error-prone.
- **Cognitive load**: Developers must remember which store to use for which purpose.

### Recommendation
**Consolidate into Domain Slices.**

Use a single store per domain with internal slices:

```javascript
// Instead of 3 arrangement stores, use:
const useArrangementStore = create((set, get) => ({
  // Core arrangement state
  tracks: [...],
  patterns: [...],
  
  // Workspace-specific state (slice)
  workspace: {
    selectedTrackId: null,
    zoom: 1.0,
    scrollPosition: 0,
  },
  
  // Actions
  actions: {
    addTrack: (track) => set(state => ({ tracks: [...state.tracks, track] })),
    // ...
  }
}));
```

This would have reduced the 3 arrangement stores to 1, cutting ~66KB of redundant code.

---

## 3. 🔄 Dual State Systems

### Problem
The system uses **Zustand stores** for UI state AND **Singleton classes** (e.g., `PlaybackController`, `AudioContextService`) for audio state. This creates a "split brain" where:
- UI components read from stores.
- Audio engine reads from singletons.
- Synchronization is done manually via `EventBus` events.

This is error-prone and leads to complex debugging when state drifts.

### Recommendation
**Single Source of Truth (SSoT) with Derived Selectors.**

Use a single Zustand store for all playback state. Derive audio engine state from it:

```javascript
const usePlaybackStore = create((set, get) => ({
  isPlaying: false,
  currentStep: 0,
  bpm: 140,
  loopStart: 0,
  loopEnd: 64,
  
  // Actions directly control both UI and engine
  play: () => {
    set({ isPlaying: true });
    engine.transport.start();
  },
  stop: () => {
    set({ isPlaying: false, currentStep: 0 });
    engine.transport.stop();
  }
}));
```

This eliminates the EventBus sync layer and reduces bugs.

---

## 4. 📦 Missing TypeScript

### Problem
The entire client-side codebase is JavaScript (`.js`/`.jsx`). For a complex system like a DAW, this leads to:
- **Runtime errors** that could be caught at compile time.
- **Slower refactoring**: Renaming a method requires manual search.
- **Poor IDE support**: Autocomplete is guesswork.

### Recommendation
**Incremental TypeScript migration.**

Start with the core engine (`lib/core/`) and stores (`store/`). Use `// @ts-check` comments in JS files to get type checking without full migration.

```typescript
// NativeAudioEngine.ts
interface InstrumentData {
  id: string;
  type: 'sampler' | 'synth' | 'ai';
  name: string;
  samples?: { path: string; pitch: number }[];
}

class NativeAudioEngine {
  createInstrument(data: InstrumentData): void { ... }
}
```

This would have caught many of the bugs that required `*_FIX.md` documents.

---

## 5. 🧪 Missing Test Infrastructure

### Problem
The `server/` directory has no `tests/` folder. The `client/` directory has no test files visible. This means:
- **No automated regression testing.**
- **Manual verification** for every change.
- **Fear of refactoring** (might break something).

### Recommendation
**Add Vitest for Client, Jest for Server.**

For the audio engine, focus on **integration tests** rather than unit tests:

```javascript
// tests/audioEngine.test.js
import { NativeAudioEngine } from '../lib/core/NativeAudioEngine';

test('creating an instrument routes it to the mixer', async () => {
  const engine = new NativeAudioEngine();
  await engine.initialize();
  
  const inst = await engine.createInstrument({ type: 'sampler', name: 'Test' });
  
  expect(engine.instruments.has(inst.id)).toBe(true);
  expect(engine.getMixerChannelForInstrument(inst.id)).toBeDefined();
});
```

---

## 6. 📐 Schema Validation (Zod)

### Problem
The server has `zod` as a dependency but it's unclear if it's consistently used for all API request/response validation. Without strict schema validation:
- **Invalid data** can corrupt the database.
- **Client crashes** when receiving unexpected data shapes.

### Recommendation
**Zod at the Boundary.**

Define schemas for all API endpoints and parse incoming data:

```typescript
// server/src/routes/projects.ts
const ProjectSchema = z.object({
  name: z.string().min(1).max(100),
  data: z.record(z.unknown()),
});

app.post('/projects', async (req, res) => {
  const parsed = ProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).send(parsed.error);
  }
  // Now `parsed.data` is guaranteed to be valid
});
```

---

## 📊 Impact Summary

| Issue | Development Time Cost | Recommendation |
|:---|:---|:---|
| God Classes | HIGH (onboarding, debugging) | Command Pattern + Service Layer |
| Store Proliferation | MEDIUM (state sync bugs) | Consolidated Domain Slices |
| Dual State Systems | HIGH (EventBus sync bugs) | Single Source of Truth |
| No TypeScript | MEDIUM (runtime errors) | Incremental TypeScript Migration |
| No Tests | HIGH (fear of refactoring) | Vitest + Integration Tests |
| Weak Schema Validation | MEDIUM (data corruption) | Zod at Boundaries |

---

## ✅ What Was Done Well

1. **Wasm for DSP**: Using Rust/Wasm for audio processing is the correct choice for performance.
2. **Feature-Sliced Design**: The `features/` directory structure is modern and logical.
3. **Zenith Theme System**: Dynamic theming with CSS variables is well-implemented.
4. **AudioWorklet Usage**: Correct use of AudioWorklets for low-latency audio.

---

**Last Updated:** 2025-12-25
