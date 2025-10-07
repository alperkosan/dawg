# 🎯 UNIFIED TIMELINE CONTROL SYSTEM

## Sorun
3 farklı timeline panelinde (Channel Rack, Piano Roll, Arrangement) tutarsız ve parçalı timeline kontrol mekanizması:
- Her panel kendi jump/seek mantığını yönetiyor
- Play/pause/stop akışı merkezi değil
- Ghost position (hover) bazı panellerde eksik
- Motor ile UI senkronizasyonu optimum değil

## Çözüm Mimarisi

### 1. **TimelineController** (Yeni Merkezi Sistem)
```
┌─────────────────────────────────────────┐
│      TimelineController (Singleton)      │
│  - Tek kaynak doğruluk (position state)  │
│  - Tüm timeline interaksiyonları         │
│  - Smart caching & debouncing            │
│  - Optimistic updates                    │
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴─────────┐
    ▼                   ▼
┌─────────┐      ┌──────────────┐
│  Motor  │      │  UI Panels   │
│ Engine  │      │ (3 timelines)│
└─────────┘      └──────────────┘
```

### 2. Temel Prensipler

#### A. Timeline Interaction Modes
```javascript
// Kullanıcı ne yapmak istiyor?
const INTERACTION_MODES = {
  SEEK: 'seek',           // Direkt pozisyon değiştir (click)
  SCRUB: 'scrub',         // Sürekli pozisyon değiştir (drag)
  HOVER: 'hover',         // Ghost position göster (mouseover)
  PREVIEW: 'preview',     // Kısa preview çal (hover + modifier)
  SELECT_RANGE: 'range'   // Timeline bölgesi seç (shift+drag)
};
```

#### B. Playback State Machine
```
┌──────────┐  play()   ┌─────────┐  pause()  ┌────────┐
│ STOPPED  │─────────▶ │ PLAYING │─────────▶ │ PAUSED │
└─────┬────┘           └────┬────┘           └───┬────┘
      │                     │                    │
      │  stop()             │ stop()             │ stop()
      │◀────────────────────┴────────────────────┘
      │
      │ jumpTo() while stopped
      └─────────────────────▶ (position değişir ama state STOPPED kalır)
```

#### C. Position Update Flow
```
User Timeline Click/Drag
         │
         ▼
   TimelineController
    (optimistic update)
         │
         ├──▶ UI Update (immediate, 0ms)
         │
         └──▶ Motor Update (queued, <16ms)
                    │
                    ▼
            Motor Confirmation ───▶ UI Validation
                                   (rollback if needed)
```

### 3. API Design

#### TimelineController Methods
```javascript
class TimelineController {
  // === CORE TRANSPORT ===
  play(options?: { from?: number, mode?: 'pattern' | 'song' }): Promise<void>
  pause(): Promise<void>
  stop(): Promise<void>

  // === POSITION CONTROL ===
  seekTo(position: number, options?: {
    immediate?: boolean,    // UI instant, motor queued (default: true)
    smooth?: boolean,       // Smooth transition (default: false)
    updateMotor?: boolean   // Actually update motor or UI only (default: true)
  }): void

  scrubStart(position: number): void
  scrubUpdate(position: number): void
  scrubEnd(): void

  // === GHOST POSITION (Hover) ===
  showGhostPosition(position: number): void
  hideGhostPosition(): void

  // === RANGE SELECTION ===
  selectRange(start: number, end: number): void
  clearSelection(): void

  // === TIMELINE REGISTRATION ===
  registerTimeline(id: string, config: TimelineConfig): void
  unregisterTimeline(id: string): void

  // === STATE ACCESS ===
  getState(): TimelineState
  subscribe(callback: (state: TimelineState) => void): UnsubscribeFn
}

interface TimelineState {
  // Core state
  playbackState: 'stopped' | 'playing' | 'paused'
  currentPosition: number      // Step cinsinden (master clock)
  ghostPosition: number | null // Hover position

  // Interaction state
  interactionMode: InteractionMode | null
  isScrubbing: boolean
  isHovering: boolean

  // Selection state
  selectedRange: { start: number, end: number } | null

  // Loop state
  loopEnabled: boolean
  loopStart: number
  loopEnd: number
}

interface TimelineConfig {
  element: HTMLElement
  stepWidth: number           // Pixel per step
  totalSteps: number          // Timeline length
  onPositionChange?: (pos: number) => void
  enableGhostPosition?: boolean
  enableRangeSelection?: boolean
}
```

### 4. Implementation Strategy

#### Phase 1: Core TimelineController
- [ ] Create `TimelineController` class with optimistic updates
- [ ] Implement `seekTo()` with immediate UI + queued motor updates
- [ ] Integrate with existing `TransportManager` & `PlaybackController`
- [ ] Add debouncing for rapid position changes

#### Phase 2: Timeline UI Components
- [ ] Create `<InteractiveTimeline>` base component
- [ ] Implement hover ghost position
- [ ] Implement click seek
- [ ] Implement drag scrubbing
- [ ] Implement range selection (Shift+Drag)

#### Phase 3: Panel Integration
- [ ] Replace Channel Rack timeline with unified system
- [ ] Replace Piano Roll timeline with unified system
- [ ] Replace Arrangement timeline with unified system
- [ ] Test cross-panel synchronization

#### Phase 4: Smart Features
- [ ] Add preview playback on hover (with modifier key)
- [ ] Add snap-to-beat/bar while scrubbing
- [ ] Add keyboard shortcuts (←/→ for step, Ctrl+←/→ for bar)
- [ ] Add zoom-aware scrubbing (faster on zoomed out)

### 5. Performance Optimizations

#### A. Optimistic Updates
```javascript
// User clicks timeline
seekTo(position) {
  // 1. Immediate UI update (0ms)
  this._updateUIPosition(position);

  // 2. Queue motor update (next frame, <16ms)
  this._queueMotorUpdate(() => {
    this.motor.jumpToStep(position);
  });

  // 3. Motor confirms (async)
  // If motor disagrees, rollback UI
}
```

#### B. Debounced Motor Updates
```javascript
// During scrubbing, don't overwhelm motor
scrubUpdate(position) {
  // UI updates every frame (60fps)
  this._updateUIPosition(position);

  // Motor updates throttled (10fps max)
  this._throttledMotorUpdate(position, 100);
}
```

#### C. Cached Position Calculations
```javascript
// Pre-calculate pixel positions for visible range
class TimelineViewport {
  visibleRange: { start: number, end: number }
  pixelPositions: Map<number, number>

  updateCache(scrollX: number, width: number) {
    // Only cache visible steps
    const startStep = Math.floor(scrollX / stepWidth);
    const endStep = Math.ceil((scrollX + width) / stepWidth);
    // ...
  }
}
```

### 6. Backward Compatibility

Keep existing APIs as wrappers:
```javascript
// Old API (deprecated but supported)
jumpToPosition(pos) {
  console.warn('jumpToPosition() deprecated, use seekTo()');
  return this.timelineController.seekTo(pos);
}

// New unified API
seekTo(pos, options) {
  return this.timelineController.seekTo(pos, options);
}
```

### 7. Testing Strategy

```javascript
// Unit tests
test('seekTo updates UI immediately', () => {
  controller.seekTo(32);
  expect(controller.getState().currentPosition).toBe(32);
  expect(uiElement.style.transform).toContain('32');
});

// Integration tests
test('scrubbing syncs across all panels', () => {
  controller.scrubStart(0);
  controller.scrubUpdate(16);

  expect(channelRackPlayhead.position).toBe(16);
  expect(pianoRollPlayhead.position).toBe(16);
  expect(arrangementPlayhead.position).toBe(16);
});

// Performance tests
test('scrubbing handles 60fps without lag', () => {
  const start = performance.now();
  for (let i = 0; i < 60; i++) {
    controller.scrubUpdate(i);
  }
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(16); // < 1 frame
});
```

### 8. Migration Path

1. **Week 1**: Implement `TimelineController` core
2. **Week 2**: Migrate Channel Rack (simplest)
3. **Week 3**: Migrate Piano Roll (medium complexity)
4. **Week 4**: Migrate Arrangement (most complex)
5. **Week 5**: Deprecate old APIs, cleanup
6. **Week 6**: Performance profiling & optimization

---

## Benefits

✅ **Tek kaynak doğruluk** - Position state merkezi yönetiliyor
✅ **Optimistic updates** - UI instant, motor async
✅ **Tutarlı UX** - Tüm panellerde aynı interaction behavior
✅ **Performance** - Debouncing, throttling, caching
✅ **Kolay test** - Merkezi logic, isolated components
✅ **Ölçeklenebilir** - Yeni paneller kolayca eklenebilir

## Next Steps

1. Review this design with team
2. Create detailed implementation tickets
3. Set up performance benchmarks
4. Start Phase 1 implementation
