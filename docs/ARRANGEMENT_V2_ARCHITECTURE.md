# 🎵 ARRANGEMENT PANEL V2.0 - ARCHITECTURE

## 📐 Core Design Principles

### 1. Canvas-First Approach
```
Similar to Piano Roll v7 success:
- Main rendering on canvas (60fps smooth)
- React overlays for UI (track headers, toolbars)
- Hybrid approach for best performance
```

### 2. Component Structure
```
ArrangementPanelV2/
├── ArrangementContainer.jsx          (Main wrapper)
├── components/
│   ├── Timeline/
│   │   ├── TimelineRuler.jsx        (Top ruler - canvas)
│   │   ├── PlayheadCursor.jsx       (Animated cursor)
│   │   └── LoopMarkers.jsx          (Loop region)
│   ├── Tracks/
│   │   ├── TrackList.jsx            (Track container)
│   │   ├── TrackHeader.jsx          (Name, mute, solo, volume)
│   │   └── TrackLane.jsx            (Canvas for clips)
│   ├── Clips/
│   │   ├── AudioClip.jsx            (Canvas-rendered audio clip)
│   │   ├── PatternClip.jsx          (Canvas-rendered pattern clip)
│   │   ├── ClipHandles.jsx          (Fade/Gain handles overlay)
│   │   └── ClipContextMenu.jsx      (Right-click menu)
│   ├── Toolbar/
│   │   ├── ArrangementToolbar.jsx   (Top toolbar)
│   │   └── TransportControls.jsx    (Play/Stop/Record)
│   └── Panels/
│       ├── ClipPropertiesPanel.jsx  (Right sidebar)
│       └── PatternLibrary.jsx       (Left sidebar - reuse existing)
├── renderers/
│   ├── trackRenderer.js             (Draw track lanes)
│   ├── audioClipRenderer.js         (Draw waveform + fades)
│   ├── patternClipRenderer.js       (Draw MIDI preview)
│   └── gridRenderer.js              (Draw grid lines)
├── hooks/
│   ├── useArrangementCanvas.js      (Canvas setup + rendering)
│   ├── useClipInteraction.js        (Drag, resize, handles)
│   ├── useSelection.js              (Multi-select logic)
│   ├── useKeyboardShortcuts.js      (Keyboard bindings)
│   └── useSnapToGrid.js             (Snap logic)
└── store/
    └── useArrangementV2Store.js     (Clean Zustand store)
```

### 3. Rendering Strategy

**Layered Canvas System:**
```
┌──────────────────────────────────────┐
│ Layer 4: Overlays (React Portals)   │  ← Context menus, tooltips
├──────────────────────────────────────┤
│ Layer 3: Handles Canvas              │  ← Fade/Gain handles (interactive)
├──────────────────────────────────────┤
│ Layer 2: Clips Canvas                │  ← Audio + Pattern clips
├──────────────────────────────────────┤
│ Layer 1: Grid Canvas                 │  ← Background grid + tracks
└──────────────────────────────────────┘
```

**Performance Optimizations:**
- Viewport culling (only render visible clips)
- LOD for waveforms (zoom-dependent detail)
- RequestAnimationFrame for smooth animations
- Debounced redraws on state changes
- OffscreenCanvas for waveform pre-rendering

---

## 🎨 Zenith Theme Integration

### Color Palette
```javascript
const ZENITH_ARRANGEMENT = {
  background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
  trackLane: 'rgba(20, 20, 30, 0.4)',
  trackLaneHover: 'rgba(30, 30, 45, 0.6)',
  gridLine: 'rgba(255, 255, 255, 0.05)',
  gridLineBeat: 'rgba(255, 255, 255, 0.1)',
  gridLineBar: 'rgba(255, 255, 255, 0.15)',

  audioClip: {
    background: 'rgba(139, 92, 246, 0.2)',    // Purple
    border: 'rgba(139, 92, 246, 0.6)',
    waveform: 'rgba(167, 139, 250, 0.9)',
    selected: 'rgba(139, 92, 246, 1)',
    glow: '0 0 20px rgba(139, 92, 246, 0.6)'
  },

  patternClip: {
    background: 'rgba(59, 130, 246, 0.2)',    // Blue
    border: 'rgba(59, 130, 246, 0.6)',
    notes: 'rgba(96, 165, 250, 0.9)',
    selected: 'rgba(59, 130, 246, 1)',
    glow: '0 0 20px rgba(59, 130, 246, 0.6)'
  },

  playhead: {
    color: 'rgba(248, 113, 113, 0.9)',        // Red
    glow: '0 0 30px rgba(248, 113, 113, 0.8)',
    shadow: '0 4px 20px rgba(248, 113, 113, 0.4)'
  },

  handles: {
    fade: 'rgba(34, 197, 94, 0.9)',           // Green
    gain: 'rgba(251, 191, 36, 0.9)',          // Amber
    resize: 'rgba(236, 72, 153, 0.9)',        // Pink
  }
};
```

### Visual Effects
```javascript
// Gradient overlays
const clipGradient = ctx.createLinearGradient(x, y, x, y + height);
clipGradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
clipGradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)');

// Glow effects for selected clips
ctx.shadowBlur = 20;
ctx.shadowColor = 'rgba(139, 92, 246, 0.6)';

// Glassmorphism for panels
background: 'rgba(20, 20, 30, 0.7)',
backdropFilter: 'blur(20px) saturate(180%)',
border: '1px solid rgba(255, 255, 255, 0.1)'
```

---

## 🎯 Clip Types & Interactions

### Audio Clip
```javascript
{
  id: 'clip-uuid',
  type: 'audio',
  trackId: 'track-1',

  // Timing
  startTime: 4.0,        // beats
  duration: 8.0,         // beats

  // Audio properties
  assetId: 'asset-uuid', // Reference to AudioAssetManager
  sampleOffset: 0,       // trim start (seconds)
  playbackRate: 1.0,     // time-stretch

  // Effects
  fadeIn: 0.1,           // beats
  fadeOut: 0.2,          // beats
  gain: 0,               // dB (-60 to +12)

  // Metadata
  name: 'Kick Loop',
  color: '#8b5cf6',
  muted: false,
  locked: false
}
```

**Interactions:**
```
┌─────────────────────────────────────┐
│ ╔═══════════════════════════════╗  │ ← Gain handle (top-right)
│ ║ ▁▃▅█▅▃▁ ▁▃▅█▅▃▁ ▁▃▅█▅▃▁      ║  │
│ ║   Waveform (LOD adaptive)     ║  │
│ ╚═══════════════════════════════╝  │
└▲────────────────────────────────▲──┘
  │                                │
Fade In                         Fade Out
(Triangle overlay)              (Triangle overlay)
```

### Pattern Clip
```javascript
{
  id: 'clip-uuid',
  type: 'pattern',
  trackId: 'track-1',

  // Timing
  startTime: 0,
  duration: 4.0,         // Pattern length in beats

  // Pattern reference
  patternId: 'pattern-uuid',
  instrumentId: 'inst-uuid',

  // Repeat settings
  loopCount: 2,          // How many times to repeat

  // Metadata
  name: 'Lead Melody',
  color: '#3b82f6',
  muted: false,
  locked: false
}
```

**Interactions:**
```
┌─────────────────────────────────────┐
│ 🎹 Lead Melody           [x2]      │ ← Header with loop count
│ ┌───────────────────────────────┐  │
│ │ ▮▮▮  ▮  ▮▮   ▮▮▮           │  │ ← MIDI preview
│ │   ▮    ▮     ▮              │  │   (simplified note blocks)
│ │      ▮    ▮                 │  │
│ └───────────────────────────────┘  │
│ C1 ────────────────────────── C6   │ ← Note range
└─────────────────────────────────────┘
```

---

## 🎮 Interaction Model

### Mouse Interactions

**Left Click:**
- Empty space → Clear selection
- Clip → Select clip
- Clip + Shift → Add to selection
- Clip + Ctrl → Toggle selection
- Drag empty space → Marquee selection
- Drag clip → Move clip(s)
- Drag handle → Resize/Fade/Gain

**Right Click:**
- Clip → Context menu
- Track header → Track menu
- Empty space → Arrangement menu

**Double Click:**
- Audio clip → Open Sample Editor
- Pattern clip → Open Piano Roll
- Track header → Rename track
- Timeline → Create marker

**Alt + Actions:**
- Drag clip → Duplicate
- Resize clip (audio) → Time-stretch
- Resize clip (pattern) → Loop count

**Shift + Actions:**
- Drag → Lock to horizontal (same track)
- Resize → Disable snap

### Keyboard Shortcuts
```javascript
// Selection
Ctrl + A     → Select all clips
Ctrl + D     → Deselect all
Shift + ←/→  → Extend selection

// Clipboard
Ctrl + C     → Copy selected
Ctrl + X     → Cut selected
Ctrl + V     → Paste at cursor
Ctrl + D     → Duplicate selected

// Editing
Delete       → Delete selected
Ctrl + Z     → Undo
Ctrl + Y     → Redo
S            → Split at cursor
M            → Mute selected
L            → Loop selected region

// Navigation
Space        → Play/Pause
Enter        → Play from cursor
Home         → Go to start
End          → Go to end
←/→          → Move cursor by snap
Ctrl + ←/→   → Move cursor by bar

// Tools
1            → Select tool
2            → Draw tool
3            → Split tool
4            → Eraser tool

// View
Ctrl + +     → Zoom in horizontal
Ctrl + -     → Zoom out horizontal
Ctrl + Scroll → Zoom horizontal
Shift + Scroll → Zoom vertical
```

---

## 📦 State Management

### Zustand Store Structure
```javascript
export const useArrangementV2Store = create((set, get) => ({
  // ========== TRACKS ==========
  tracks: [
    { id: 'track-1', name: 'Track 1', color: '#8b5cf6', height: 80, ... }
  ],

  addTrack: (name, color) => { ... },
  removeTrack: (trackId) => { ... },
  updateTrack: (trackId, updates) => { ... },
  reorderTracks: (fromIndex, toIndex) => { ... },

  // ========== CLIPS ==========
  clips: [
    { id: 'clip-1', type: 'audio', trackId: 'track-1', ... },
    { id: 'clip-2', type: 'pattern', trackId: 'track-2', ... }
  ],

  addClip: (clip) => { ... },
  removeClip: (clipId) => { ... },
  updateClip: (clipId, updates) => { ... },
  duplicateClips: (clipIds) => { ... },
  splitClip: (clipId, position) => { ... },

  // ========== SELECTION ==========
  selectedClipIds: [],
  setSelection: (clipIds) => { ... },
  addToSelection: (clipIds) => { ... },
  removeFromSelection: (clipIds) => { ... },
  clearSelection: () => { ... },

  // ========== CLIPBOARD ==========
  clipboard: null,
  copySelection: () => { ... },
  cutSelection: () => { ... },
  paste: (cursorPosition) => { ... },

  // ========== PLAYBACK ==========
  cursorPosition: 0,      // beats
  isPlaying: false,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: 16,

  setCursorPosition: (position) => { ... },
  play: () => { ... },
  pause: () => { ... },
  stop: () => { ... },

  // ========== VIEW ==========
  viewportOffset: { x: 0, y: 0 },
  zoom: { x: 1, y: 1 },
  snapEnabled: true,
  snapSize: 0.25,         // beats (1/16 note)

  setZoom: (axis, value) => { ... },
  setViewportOffset: (x, y) => { ... },
  setSnapSize: (size) => { ... },

  // ========== HISTORY ==========
  history: { past: [], future: [] },
  undo: () => { ... },
  redo: () => { ... },
  pushHistory: (action) => { ... }
}));
```

---

## 🚀 Implementation Plan

### Phase 1: Foundation (Day 1-2)
1. Create new `ArrangementPanelV2` folder structure
2. Setup canvas rendering system
3. Build grid renderer with Zenith theme
4. Implement timeline ruler
5. Create basic track lanes

### Phase 2: Clips (Day 3-4)
6. Build AudioClip renderer with waveforms
7. Build PatternClip renderer with MIDI preview
8. Implement clip selection system
9. Add drag & drop for clips

### Phase 3: Handles (Day 5)
10. Add fade in/out handles for audio clips
11. Add gain handle for audio clips
12. Add resize handles for both clip types
13. Visual feedback for all interactions

### Phase 4: Features (Day 6-7)
14. Context menus (clip, track, arrangement)
15. Keyboard shortcuts system
16. Copy/paste/duplicate
17. Split tool
18. Undo/redo

### Phase 5: Polish (Day 8)
19. Smooth animations and transitions
20. Performance optimization
21. Edge case handling
22. Testing and bug fixes

---

## ✅ Success Metrics

1. **60fps rendering** even with 100+ clips
2. **Sub-100ms** interaction latency
3. **Waveform renders** at all zoom levels
4. **MIDI preview shows** note density accurately
5. **All keyboard shortcuts** work as expected
6. **Undo/redo** handles all operations
7. **Context menus** provide quick access to all features
8. **Zenith theme** is consistent throughout

---

**Ready to start implementation?** 🎵
