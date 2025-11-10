# 🎵 Arrangement Store Consolidation Plan

**Last Updated:** 2025-01-XX  
**Version:** 1.0.0  
**Status:** 🚧 In Progress

---

## 📋 Executive Summary

Arrangement panelinin store yapısını konsolide ederek single source of truth prensibine uygun hale getirmek. Mevcut 5 farklı store kullanımını tek bir unified store'a indirgemek.

---

## 🔍 Mevcut Durum Analizi

### Store Kullanımı

#### Arrangement Panel (Mevcut)
```javascript
// ArrangementPanelV2.jsx
const tracks = useArrangementV2Store(state => state.tracks);
const clips = useArrangementV2Store(state => state.clips);
const patterns = useArrangementStore(state => state.patterns);
const currentStep = usePlaybackStore(state => state.currentStep);
const playbackMode = usePlaybackStore(state => state.playbackMode);
// ... 5 farklı store
```

#### Piano Roll (Referans - Daha İyi)
```javascript
// PianoRoll.jsx
const currentStep = usePlaybackStore(state => state.currentStep);
const patterns = useArrangementStore(state => state.patterns);
const instruments = useInstrumentsStore(state => state.instruments);
// TimelineControllerSingleton kullanıyor (unified transport)
```

### Problemler

1. **Store Fragmentation:**
   - `useArrangementV2Store`: Tracks, clips, selection, markers, loop regions
   - `useArrangementStore`: Patterns (pattern clip rendering için)
   - `usePlaybackStore`: Playback state (currentStep, playbackMode)
   - `usePanelsStore`: Panel state
   - `useProjectAudioStore`: Audio assets (kullanılmıyor)

2. **Transport System Duplication:**
   - Arrangement: `TransportManagerSingleton` + custom subscription
   - Piano Roll: `TimelineControllerSingleton` (unified)
   - **Sonuç:** İki farklı transport sistemi

3. **Playback State Duplication:**
   - Arrangement: `useArrangementV2Store.cursorPosition` + `usePlaybackStore.currentStep`
   - Piano Roll: `usePlaybackStore.currentStep` (single source)
   - **Sonuç:** Veri tutarsızlığı riski

---

## 🎯 Hedef Yapı

### Unified Store Architecture

```
useArrangementStore (unified)
├── Tracks
│   ├── tracks: Array<Track>
│   ├── addTrack()
│   ├── removeTrack()
│   ├── updateTrack()
│   └── reorderTracks()
├── Clips
│   ├── clips: Array<Clip>
│   ├── addClip()
│   ├── removeClip()
│   ├── updateClip()
│   ├── splitClip()
│   └── duplicateClips()
├── Patterns (from useArrangementStore)
│   ├── patterns: Object<Pattern>
│   ├── activePatternId: string
│   ├── patternOrder: Array<string>
│   └── updatePatternNotes()
├── Selection
│   ├── selectedClipIds: Array<string>
│   ├── setSelection()
│   ├── addToSelection()
│   └── clearSelection()
├── Markers & Loop Regions
│   ├── markers: Array<Marker>
│   ├── loopRegions: Array<LoopRegion>
│   ├── addMarker()
│   └── addLoopRegion()
├── Viewport
│   ├── viewportOffset: { x, y }
│   ├── zoom: { x, y }
│   ├── snapEnabled: boolean
│   └── snapSize: number
├── History
│   ├── history: { past, future }
│   ├── undo()
│   └── redo()
└── Transport (read-only from usePlaybackStore)
    ├── currentStep (sync)
    ├── playbackMode (sync)
    └── isPlaying (sync)
```

### Transport System Unification

```
TimelineControllerSingleton (unified)
├── Arrangement Panel
│   └── getTimelineController() → unified transport
└── Piano Roll
    └── getTimelineController() → unified transport
```

### Playback Store Integration

```
usePlaybackStore (single source of truth)
├── Arrangement Panel (read-only)
│   ├── currentStep (read)
│   ├── playbackMode (read)
│   └── isPlaying (read)
└── Piano Roll (read-only)
    ├── currentStep (read)
    ├── playbackMode (read)
    └── isPlaying (read)
```

---

## 🏗️ Implementation Plan

### Phase 1: Store Consolidation

#### Step 1.1: Unified Store Creation

**File:** `client/src/store/useArrangementStore.js` (existing, extend)

**Changes:**
1. Merge `useArrangementV2Store` into `useArrangementStore`
2. Keep patterns functionality
3. Add tracks, clips, selection, markers, loop regions
4. Remove duplicate transport logic
5. Add read-only playback state sync

**Migration Strategy:**
- Keep `useArrangementStore` as base (patterns already there)
- Add arrangement-specific state (tracks, clips, etc.)
- Remove `useArrangementV2Store` dependency
- Update `ArrangementPanelV2` to use unified store

#### Step 1.2: Transport System Unification

**File:** `client/src/features/arrangement_v2/ArrangementPanelV2.jsx`

**Changes:**
1. Remove `TransportManagerSingleton` usage
2. Use `TimelineControllerSingleton` (same as Piano Roll)
3. Remove custom transport subscription
4. Use unified transport methods

**Migration Strategy:**
- Replace `initializeTransport()` with `getTimelineController()`
- Remove `_transportManager` and `_transportSubscription`
- Use `TimelineController` methods directly
- Sync playback state from `usePlaybackStore` (read-only)

#### Step 1.3: Playback Store Integration

**File:** `client/src/store/useArrangementStore.js`

**Changes:**
1. Remove playback state from arrangement store
2. Add read-only playback state sync from `usePlaybackStore`
3. Remove duplicate cursor position logic
4. Use `usePlaybackStore.currentStep` directly

**Migration Strategy:**
- Remove `cursorPosition`, `isPlaying`, `bpm` from arrangement store
- Add computed selectors for playback state
- Use `usePlaybackStore` directly in components
- Remove transport control methods (use `TimelineController` instead)

---

## 📝 Detailed Changes

### 1. Unified Store Structure

#### Current: `useArrangementV2Store.js`
```javascript
export const useArrangementV2Store = create((set, get) => ({
  tracks: [],
  clips: [],
  selectedClipIds: [],
  markers: [],
  loopRegions: [],
  cursorPosition: 0,
  isPlaying: false,
  bpm: 140,
  // ... transport logic
}));
```

#### New: `useArrangementStore.js` (extended)
```javascript
export const useArrangementStore = create((set, get) => ({
  // Existing patterns
  patterns: {},
  activePatternId: 'pattern1',
  patternOrder: [],
  
  // Arrangement tracks
  tracks: [],
  addTrack: (name, color) => { /* ... */ },
  removeTrack: (trackId) => { /* ... */ },
  updateTrack: (trackId, updates) => { /* ... */ },
  
  // Arrangement clips
  clips: [],
  addClip: (clip) => { /* ... */ },
  removeClip: (clipId) => { /* ... */ },
  updateClip: (clipId, updates) => { /* ... */ },
  splitClip: (clipId, splitPosition) => { /* ... */ },
  
  // Selection
  selectedClipIds: [],
  setSelection: (clipIds) => { /* ... */ },
  clearSelection: () => { /* ... */ },
  
  // Markers & Loop Regions
  markers: [],
  loopRegions: [],
  addMarker: (time, label, color) => { /* ... */ },
  addLoopRegion: (startTime, endTime, label, color) => { /* ... */ },
  
  // Viewport
  viewportOffset: { x: 0, y: 0 },
  zoom: { x: 1, y: 1 },
  snapEnabled: true,
  snapSize: 0.25,
  
  // History
  history: { past: [], future: [] },
  undo: () => { /* ... */ },
  redo: () => { /* ... */ },
  
  // ❌ REMOVED: Playback state (use usePlaybackStore instead)
  // ❌ REMOVED: Transport logic (use TimelineControllerSingleton instead)
}));
```

### 2. Transport System Unification

#### Current: `ArrangementPanelV2.jsx`
```javascript
// Custom transport initialization
const initializeTransport = useArrangementV2Store(state => state.initializeTransport);
const transport = useTransportManager({ trackPosition: true });

// Custom subscription
useEffect(() => {
  initializeTransport();
  return () => cleanupTransport();
}, []);
```

#### New: `ArrangementPanelV2.jsx`
```javascript
// Unified transport (same as Piano Roll)
import { getTimelineController } from '@/lib/core/TimelineControllerSingleton';

// Use unified transport
const timelineController = getTimelineController();

// Read playback state from usePlaybackStore (read-only)
const currentStep = usePlaybackStore(state => state.currentStep);
const playbackMode = usePlaybackStore(state => state.playbackMode);
const isPlaying = usePlaybackStore(state => state.isPlaying);
```

### 3. Playback Store Integration

#### Current: `ArrangementPanelV2.jsx`
```javascript
// Duplicate playback state
const cursorPosition = useArrangementV2Store(state => state.cursorPosition);
const isPlaying = useArrangementV2Store(state => state.isPlaying);
const currentStep = usePlaybackStore(state => state.currentStep);
```

#### New: `ArrangementPanelV2.jsx`
```javascript
// Single source of truth (read-only)
const currentStep = usePlaybackStore(state => state.currentStep);
const playbackMode = usePlaybackStore(state => state.playbackMode);
const isPlaying = usePlaybackStore(state => state.isPlaying);

// Transport control via TimelineController
const timelineController = getTimelineController();
const setCursorPosition = (position) => {
  timelineController.setPosition(position);
};
```

---

## 🔄 Migration Steps

### Step 1: Create Unified Store

1. **Extend `useArrangementStore.js`:**
   - Add tracks management
   - Add clips management
   - Add selection management
   - Add markers & loop regions
   - Add viewport state
   - Add history management
   - Keep patterns functionality

2. **Remove Playback State:**
   - Remove `cursorPosition`, `isPlaying`, `bpm`
   - Remove transport initialization logic
   - Remove transport subscription logic

3. **Add Read-Only Playback Sync:**
   - Add computed selectors for playback state
   - Sync from `usePlaybackStore` (read-only)

### Step 2: Update Arrangement Panel

1. **Replace Store Usage:**
   - Replace `useArrangementV2Store` with `useArrangementStore`
   - Remove duplicate store subscriptions
   - Use unified store methods

2. **Replace Transport System:**
   - Remove `useTransportManager` hook
   - Remove `initializeTransport()` and `cleanupTransport()`
   - Use `getTimelineController()` (same as Piano Roll)

3. **Update Playback State:**
   - Use `usePlaybackStore` directly (read-only)
   - Remove duplicate playback state
   - Use `TimelineController` for transport control

### Step 3: Remove Old Store

1. **Deprecate `useArrangementV2Store`:**
   - Mark as deprecated
   - Remove from imports
   - Delete file after migration

2. **Update Dependencies:**
   - Update all components using `useArrangementV2Store`
   - Update tests
   - Update documentation

### Step 4: Testing

1. **Unit Tests:**
   - Test unified store actions
   - Test store state updates
   - Test store synchronization

2. **Integration Tests:**
   - Test arrangement panel functionality
   - Test transport system integration
   - Test playback state synchronization

3. **E2E Tests:**
   - Test track management
   - Test clip editing
   - Test playback control

---

## 📊 Success Metrics

### Code Quality
- **Store Count:** 5 → 1 (80% reduction)
- **Code Duplication:** High → Low
- **State Consistency:** Low → High

### Performance
- **Store Subscriptions:** Reduced
- **Re-renders:** Optimized
- **Memory Usage:** Reduced

### Maintainability
- **Code Complexity:** Reduced
- **Test Coverage:** Improved
- **Documentation:** Updated

---

## 🚀 Implementation Timeline

### Week 1: Store Consolidation
- **Day 1-2:** Unified store design and implementation
- **Day 3-4:** Transport system unification
- **Day 5:** Testing and bug fixes

### Week 2: Migration & Testing
- **Day 1-2:** Arrangement panel updates
- **Day 3-4:** Testing and bug fixes
- **Day 5:** Documentation and cleanup

---

## 📚 Documentation

### Store API
- Unified store methods
- Store state structure
- Store synchronization

### Migration Guide
- Step-by-step migration
- Breaking changes
- Compatibility notes

### Testing Guide
- Unit test examples
- Integration test examples
- E2E test examples

---

## 🎯 Next Steps

### Immediate
1. Create unified store structure
2. Implement transport system unification
3. Update arrangement panel

### Short Term
1. Remove old store
2. Update tests
3. Update documentation

### Long Term
1. Optimize store performance
2. Add store dev tools
3. Add store analytics

---

**Last Updated:** 2025-01-XX  
**Maintained by:** DAWG Development Team

