# 🔄 Audio Engine Migration Guide

## Overview

This guide explains how to migrate from the old `NativeAudioEngine` to the new modular architecture.

---

## Quick Migration

### Before (Old API)
```javascript
import { NativeAudioEngine } from '@/lib/core/NativeAudioEngine';

const engine = new NativeAudioEngine();
await engine.initialize();
engine.play();
engine.setChannelVolume('track-1', 0.8);
```

### After (New API)
```javascript
import { createAudioEngine } from '@/lib/core';

const engine = createAudioEngine();
await engine.initialize();
engine.play();
engine.setChannelVolume('track-1', 0.8);
```

**Key Point:** The API is identical - you just change the import!

---

## Using React Hooks (Recommended)

### Playback Control
```jsx
import { usePlaybackControl } from '@/hooks/useAudioEngine';

function TransportBar() {
  const { play, stop, pause, setBPM, isInitialized } = usePlaybackControl();
  
  return (
    <div>
      <button onClick={() => play()} disabled={!isInitialized}>Play</button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}
```

### Mixer Control
```jsx
import { useMixerControl } from '@/hooks/useAudioEngine';

function MixerChannel({ trackId }) {
  const { setVolume, setPan, setMute, setMasterVolume } = useMixerControl();
  
  return (
    <input 
      type="range" 
      onChange={(e) => setVolume(trackId, e.target.value)}
    />
  );
}
```

### Instrument Control
```jsx
import { useInstrumentControl } from '@/hooks/useAudioEngine';

function PianoKey({ instrumentId, pitch }) {
  const { auditionNote, releaseNote } = useInstrumentControl();
  
  return (
    <div 
      onMouseDown={() => auditionNote(instrumentId, pitch)}
      onMouseUp={() => releaseNote(instrumentId, pitch)}
    />
  );
}
```

---

## Undo/Redo Integration

### Basic Usage
```jsx
import { useUndoRedo } from '@/hooks/useCommandManager';
import { AddNoteCommand } from '@/lib/core/commands';
import { useArrangementStore } from '@/store/useArrangementStore';

function PianoRoll({ patternId, instrumentId }) {
  const { execute, undo, redo, canUndo, canRedo } = useUndoRedo();
  const store = useArrangementStore;
  
  const handleAddNote = (note) => {
    execute(new AddNoteCommand(store, patternId, instrumentId, note));
  };
  
  return (
    <div>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
    </div>
  );
}
```

### Keyboard Shortcuts
```jsx
import { useUndoRedoShortcuts } from '@/hooks/useCommandManager';

function App() {
  // Automatically enables Ctrl+Z / Ctrl+Y
  useUndoRedoShortcuts(true);
  
  return <YourApp />;
}
```

### Batch Operations
```jsx
const { execute, beginBatch, endBatch } = useUndoRedo();

// Multiple operations as single undo step
beginBatch('Delete Selected Notes');
selectedNotes.forEach(note => {
  execute(new RemoveNoteCommand(store, patternId, instrumentId, note.id));
});
endBatch(); // One Ctrl+Z will undo all deletions
```

---

## Direct Service Access

For advanced use cases, you can access services directly:

```javascript
import { useAudioServices } from '@/hooks/useAudioEngine';

function AdvancedComponent() {
  const {
    instrumentService,
    mixerService,
    transportService,
    effectService,
    performanceService
  } = useAudioServices();
  
  // Direct service access
  const stats = performanceService?.getStats();
  const effectChain = effectService?.getEffectChain('track-1');
}
```

---

## Available Commands

### Pattern Commands
| Command | Description | Usage |
|:---|:---|:---|
| `AddNoteCommand` | Add a note | `new AddNoteCommand(store, patternId, instrumentId, note)` |
| `RemoveNoteCommand` | Remove a note | `new RemoveNoteCommand(store, patternId, instrumentId, noteId)` |
| `MoveNoteCommand` | Move a note | `new MoveNoteCommand(store, patternId, instrumentId, noteId, newStep, newPitch)` |
| `ChangeVelocityCommand` | Change velocity | `new ChangeVelocityCommand(store, patternId, instrumentId, noteId, newVelocity)` |
| `ChangeDurationCommand` | Change duration | `new ChangeDurationCommand(store, patternId, instrumentId, noteId, newDuration)` |
| `CreatePatternCommand` | Create pattern | `new CreatePatternCommand(store, patternName)` |
| `DeletePatternCommand` | Delete pattern | `new DeletePatternCommand(store, patternId)` |

### Mixer Commands
| Command | Description | Usage |
|:---|:---|:---|
| `ChangeVolumeCommand` | Change volume | `new ChangeVolumeCommand(store, trackId, newVolume)` |
| `ChangePanCommand` | Change pan | `new ChangePanCommand(store, trackId, newPan)` |
| `ToggleMuteCommand` | Toggle mute | `new ToggleMuteCommand(store, trackId)` |
| `ToggleSoloCommand` | Toggle solo | `new ToggleSoloCommand(store, trackId)` |
| `AddEffectCommand` | Add effect | `new AddEffectCommand(store, trackId, effectType, settings)` |
| `RemoveEffectCommand` | Remove effect | `new RemoveEffectCommand(store, trackId, effectId)` |
| `ChangeEffectParamCommand` | Change param | `new ChangeEffectParamCommand(store, trackId, effectId, param, value)` |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Components                          │
├─────────────────────────────────────────────────────────────┤
│  useAudioEngine │ useMixerControl │ useUndoRedo │ etc.      │
├─────────────────────────────────────────────────────────────┤
│                 NativeAudioEngineFacade                      │
│                   (Thin Orchestrator)                        │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│Instrument│  Mixer   │Transport │ Effect   │   Scheduler    │
│ Service  │ Service  │ Service  │ Service  │    Service     │
├──────────┴──────────┴──────────┴──────────┴────────────────┤
│              UnifiedMixerNode (WASM)                        │
├─────────────────────────────────────────────────────────────┤
│                    Web Audio API                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Performance Benefits

| Metric | Before | After |
|:---|:---|:---|
| God Class size | 2,598 lines | 608 lines |
| Modular services | 0 | 8 services |
| Hot reload time | ~2.5s | ~0.5s |
| GC pressure | High | Low (Object Pool) |
| Undo/Redo | None | Full support |

---

*Last Updated: 2025-12-25*
