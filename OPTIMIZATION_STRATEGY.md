# 🚀 DAWG Performance Optimization Strategy

## Executive Summary
This document outlines a comprehensive, risk-managed approach to optimizing DAWG's performance based on thorough analysis of critical UI panels and their requirements.

**Current Status**:
- Idle CPU: 20-25% (Target: <5%)
- Frame Time: ~17ms (Target: <8ms)
- Multiple RAF loops: 6-8 concurrent

**Analysis Documents**:
- [PERFORMANCE_ANALYSIS.md](./PERFORMANCE_ANALYSIS.md) - Main thread bottlenecks
- [CRITICAL_UI_PANELS_ANALYSIS.md](./CRITICAL_UI_PANELS_ANALYSIS.md) - Component requirements

---

## 🎯 Optimization Philosophy

### Guiding Principles
1. **UX First**: Never sacrifice user experience for performance gains
2. **Risk Management**: Low-risk optimizations first, test high-risk changes
3. **Measure Everything**: Profile before/after each change
4. **Incremental**: Small, testable changes over large rewrites
5. **Reversible**: Always maintain ability to rollback

### Critical UX Requirements (Non-Negotiable)
- ✅ Smooth playhead tracking (60fps during playback)
- ✅ Instant hover feedback on grids
- ✅ Smooth note editing (drag, resize, move)
- ✅ Real-time spectrum analysis (no lag)
- ✅ Accurate audio sync (playhead, visualizers, meters)
- ✅ Professional feel (no stuttering, no choppy animations)

---

## 📊 Current State Assessment

### ✅ Already Optimized Components
1. **PianoRoll** - Uses UIUpdateManager, dirty flags, separate canvas layers ⭐ Reference
2. **ArrangementCanvas** - Uses UIUpdateManager, viewport culling, LOD ⭐ Reference
3. **ChannelMeter** - Uses MeterService (centralized RAF), throttled updates ⭐ Reference
4. **MeterService** - Single RAF for all meters, idle pause ⭐ Reference
5. **UIUpdateManager** - Unified RAF loop, idle pause ⭐ Reference
6. **IdleDetector** - 5-second timeout, playback awareness ⭐ Reference
7. **AudioContext** - Idle suspend working ⭐ Reference

### ⚠️ Needs Optimization
1. **UnifiedGridCanvas** - Own RAF loop, no dirty flags
2. **TimelineCanvas** - Own RAF loop on events
3. **AdvancedEQUI** - Continuous RAF per instance, no idle pause
4. **WebGLSpectrumVisualizer** - Continuous RAF per instance, no idle pause

### 📈 Optimization Potential
- **Current RAF loops**: 6-8 concurrent
- **After optimization**: 1-2 concurrent
- **Estimated savings**: 10-12ms per frame
- **Target frame time**: <8ms (currently ~17ms)

---

## 🗺️ Implementation Roadmap

### Phase 1: Low-Risk, High-Impact (1-2 days) 🟢
**Goal**: Reduce frame time by 5-8ms without UX changes

#### Task 1.1: Add Dirty Flags to Canvas Components
**Components**: UnifiedGridCanvas, TimelineCanvas
**Changes**:
```javascript
// Add dirty flag state
let isDirty = false;

// Only render if dirty
const scheduleRender = useCallback(() => {
  if (!isDirty) return; // ⚡ Skip if nothing changed
  // ... existing RAF code
}, []);

// Set dirty on state changes
useEffect(() => {
  isDirty = true;
  scheduleRender();
}, [notesData, instruments, hoveredCell]);
```

**Expected Impact**:
- Prevents redraws when state unchanged
- Savings: 3-5ms per frame (when idle)
- Risk: Very low - just adds a check

**Success Metrics**:
- Frame time drops when canvas not changing
- No visual regressions
- Hover/interaction still smooth

---

#### Task 1.2: Migrate UnifiedGridCanvas to UIUpdateManager
**Component**: UnifiedGridCanvas
**Pattern**: Follow PianoRoll reference implementation

**Changes**:
```javascript
// BEFORE: Own RAF loop
rafId = requestAnimationFrame(() => {
  render();
});

// AFTER: UIUpdateManager subscription
useEffect(() => {
  const unsubscribe = uiUpdateManager.subscribe(
    'channel-rack-grid',
    () => {
      if (!isDirty) return;
      render();
      isDirty = false;
    },
    UPDATE_PRIORITIES.MEDIUM,
    UPDATE_FREQUENCIES.MEDIUM
  );

  return unsubscribe;
}, [render]);
```

**Expected Impact**:
- Removes 1 RAF loop
- Shares RAF with other components
- Savings: 2-3ms per frame
- Risk: Low - PianoRoll proves pattern works

**Success Metrics**:
- Grid rendering still smooth
- Hover feedback still instant
- No visual regressions

---

#### Task 1.3: Migrate TimelineCanvas to UIUpdateManager
**Component**: TimelineCanvas
**Pattern**: Follow PianoRoll playhead pattern

**Changes**:
```javascript
// Subscribe for playhead updates
useEffect(() => {
  const unsubscribe = uiUpdateManager.subscribe(
    'channel-rack-timeline',
    () => {
      if (!isDirty) return;
      renderTimeline();
      isDirty = false;
    },
    UPDATE_PRIORITIES.HIGH, // Timeline is visible during playback
    UPDATE_FREQUENCIES.HIGH
  );

  return unsubscribe;
}, [renderTimeline]);
```

**Expected Impact**:
- Removes 1 RAF loop
- Playhead tracking through unified system
- Savings: 2-3ms per frame
- Risk: Low - Timeline less complex than PianoRoll

**Success Metrics**:
- Playhead tracking smooth
- Timeline markers visible
- Ghost playhead works

---

#### Task 1.4: Add Visibility Detection
**Components**: All canvas components
**Purpose**: Pause rendering when tab hidden

**Changes**:
```javascript
// In UIUpdateManager or per-component
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      uiUpdateManager.stop();
      console.log('🙈 Tab hidden - pausing UI updates');
    } else {
      uiUpdateManager.start();
      console.log('👁️ Tab visible - resuming UI updates');
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

**Expected Impact**:
- Zero CPU when tab hidden
- Savings: 100% of frame time when not visible
- Risk: Very low - standard browser API

**Success Metrics**:
- CPU drops to ~0% when tab hidden
- Resumes smoothly when tab visible

---

**Phase 1 Total Expected Savings**: 8-11ms per frame
**Phase 1 Risk Level**: Very Low ✅
**Phase 1 Timeline**: 1-2 days

---

### Phase 2: Medium-Risk, Medium-Impact (2-3 days) 🟡
**Goal**: Further optimize with user testing

#### Task 2.1: Consolidate Effect RAF Loops
**Components**: AdvancedEQUI, WebGLSpectrumVisualizer
**Pattern**: Share RAF loop via UIUpdateManager

**Changes**:
```javascript
// BEFORE: Each effect has own RAF
animationId = requestAnimationFrame(animateSpectrum);

// AFTER: Subscribe to UIUpdateManager
useEffect(() => {
  const unsubscribe = uiUpdateManager.subscribe(
    `eq-spectrum-${effectId}`,
    () => {
      // Read analyzer data
      analyser.getByteFrequencyData(spectrumData);
      // Trigger redraw if needed
      if (needsUpdate) {
        drawCanvas();
      }
    },
    UPDATE_PRIORITIES.LOW, // Spectrum less critical than playhead
    UPDATE_FREQUENCIES.MEDIUM // 30fps for spectrum
  );

  return unsubscribe;
}, [effectId]);
```

**Expected Impact**:
- Removes N RAF loops (N = number of effect instances)
- Savings: 2-3ms per additional effect instance
- Risk: Medium - need to ensure spectrum stays smooth

**Testing Required**:
- [ ] A/B test 30fps vs 60fps spectrum - is it noticeably choppy?
- [ ] Test with 3+ EQ instances - does it feel laggy?
- [ ] User feedback on spectrum smoothness

**Success Metrics**:
- Spectrum still feels smooth
- No lag when dragging EQ nodes
- CPU drops with multiple effects

---

#### Task 2.2: Add Idle Detection to Effects
**Components**: AdvancedEQUI, WebGLSpectrumVisualizer
**Pattern**: Pause spectrum when idle (no audio playing)

**Changes**:
```javascript
// In effect component
useEffect(() => {
  // Pause spectrum when idle
  const unsubscribeIdle = idleDetector.onIdle(() => {
    const audioEngine = AudioContextService.getAudioEngine();
    const isPlaying = audioEngine?.transport?.state === 'started';

    if (!isPlaying && uiUpdateManager) {
      console.log('😴 Pausing spectrum (idle, not playing)');
      // Unsubscribe from UIUpdateManager (will re-subscribe on active)
    }
  });

  // Resume spectrum when active
  const unsubscribeActive = idleDetector.onActive(() => {
    console.log('👁️ Resuming spectrum (active)');
    // Re-subscribe to UIUpdateManager
  });

  return () => {
    unsubscribeIdle();
    unsubscribeActive();
  };
}, []);
```

**Expected Impact**:
- Pauses spectrum when no audio + no user activity
- Savings: 3-5ms per effect when idle
- Risk: Low - users won't notice when no audio playing

**Success Metrics**:
- Spectrum pauses after 5 seconds of idle
- Spectrum resumes on user activity or playback
- No visual glitches on resume

---

#### Task 2.3: Test Grid Hover Throttling
**Component**: UnifiedGridCanvas
**Purpose**: Test if 30fps hover is acceptable

**Changes**:
```javascript
// Try MEDIUM frequency for hover updates
uiUpdateManager.subscribe(
  'channel-rack-grid-hover',
  () => {
    // Update hover state
  },
  UPDATE_PRIORITIES.LOW,
  UPDATE_FREQUENCIES.MEDIUM // 30fps instead of 60fps
);
```

**Testing Required**:
- [ ] A/B test 30fps vs 60fps hover - is it noticeably laggy?
- [ ] User feedback on hover responsiveness
- [ ] Test with fast mouse movements

**Decision Point**:
- If 30fps feels responsive: Keep it (saves 1-2ms)
- If 30fps feels laggy: Revert to 60fps

---

**Phase 2 Total Expected Savings**: 4-7ms per frame (if all tests pass)
**Phase 2 Risk Level**: Medium - Requires user testing ⚠️
**Phase 2 Timeline**: 2-3 days (including testing)

---

### Phase 3: React Re-render Optimization (3-4 days) 🟡
**Goal**: Reduce React overhead from store updates

#### Task 3.1: Add React.memo to Expensive Components
**Components**: MixerChannel, EffectPanel, InstrumentPanel

**Changes**:
```javascript
// BEFORE
export const MixerChannel = ({ trackId }) => {
  const mixerStore = useMixerStore(); // ❌ Subscribes to entire store
  // ...
};

// AFTER
export const MixerChannel = React.memo(({ trackId }) => {
  // ✅ Use selectors - only re-render when THIS track changes
  const track = useMixerStore(state =>
    state.mixerTracks.find(t => t.id === trackId)
  );
  const isMuted = useMixerStore(state =>
    state.mutedChannels.has(trackId)
  );
  // ...
}, (prevProps, nextProps) => {
  return prevProps.trackId === nextProps.trackId;
});
```

**Expected Impact**:
- Prevents cascading re-renders
- Savings: 2-3ms per store update
- Risk: Low - React.memo is standard optimization

**Success Metrics**:
- React DevTools Profiler shows fewer re-renders
- Store updates don't trigger unrelated components
- UI still updates when needed

---

#### Task 3.2: Use Zustand Selectors
**Components**: All components using useMixerStore, useInstrumentsStore

**Pattern**:
```javascript
// ❌ BAD: Re-renders on ANY mixer change
const { setTrackVolume, mutedChannels, soloedChannels } = useMixerStore();

// ✅ GOOD: Only re-renders when THIS track's data changes
const setTrackVolume = useMixerStore(state => state.setTrackVolume);
const isMuted = useMixerStore(state => state.mutedChannels.has(trackId));
const isSoloed = useMixerStore(state => state.soloedChannels.has(trackId));
```

**Expected Impact**:
- 30-40% reduction in React renders
- Savings: 1-2ms per store update
- Risk: Low - standard Zustand pattern

**Success Metrics**:
- Mixer tracks don't re-render when other tracks change
- Console logs show fewer renders

---

**Phase 3 Total Expected Savings**: 3-5ms per frame
**Phase 3 Risk Level**: Low - Standard React optimization ✅
**Phase 3 Timeline**: 3-4 days

---

### Phase 4: Advanced Optimizations (Future) 🔵
**Goal**: Polish and edge-case optimization

1. **Virtualization**: Add react-window to long lists (mixer, patterns)
2. **Web Workers**: Move heavy calculations off main thread
3. **Progressive Rendering**: Render in chunks for large projects
4. **WASM**: Performance-critical audio processing in Rust/WASM

**Timeline**: After Phase 1-3 complete, based on real-world metrics

---

## 📈 Expected Results

### After Phase 1 (Low-Risk)
```
Frame Time Breakdown:
UIUpdateManager (unified):  ~2ms   (12%)
MeterService (idle pause):  ~0ms   (0%)
Canvas (dirty flags):       ~2ms   (12%)
React re-renders:           ~3ms   (18%)
AudioContext:               ~0ms   (0%)
Other:                      ~0.5ms (3%)
───────────────────────────────────
TOTAL:                     ~7.5ms  (45% of budget)
```

**Improvement**: 17ms → 7.5ms (56% faster)

### After Phase 2 (Medium-Risk, if tests pass)
```
Frame Time Breakdown:
UIUpdateManager (unified):  ~2ms   (12%)
Canvas (dirty + idle):      ~1ms   (6%)
React re-renders:           ~3ms   (18%)
Effects (idle pause):       ~0ms   (0%)
Other:                      ~0.5ms (3%)
───────────────────────────────────
TOTAL:                     ~6.5ms  (39% of budget)
```

**Improvement**: 17ms → 6.5ms (62% faster)

### After Phase 3 (React Optimization)
```
Frame Time Breakdown:
UIUpdateManager (unified):  ~2ms   (12%)
Canvas (optimized):         ~1ms   (6%)
React (memo + selectors):   ~1ms   (6%)
Other:                      ~0.5ms (3%)
───────────────────────────────────
TOTAL:                     ~4.5ms  (27% of budget)
```

**Improvement**: 17ms → 4.5ms (74% faster)

**Idle CPU**: 20-25% → <2%

---

## 🔬 Testing & Validation

### Performance Metrics to Track
1. **Frame Time**: Chrome DevTools Performance tab
2. **CPU Usage**: Chrome Task Manager
3. **Dropped Frames**: Performance.now() timing
4. **Memory Usage**: Chrome DevTools Memory profiler
5. **RAF Loop Count**: Console logs, debugging tools

### User Experience Metrics
1. **Playback Smoothness**: Does playhead stutter?
2. **Hover Responsiveness**: Does hover feel laggy?
3. **Spectrum Smoothness**: Does analyzer look choppy?
4. **Editor Responsiveness**: Does note editing feel sluggish?

### Regression Testing
- [ ] Channel Rack note editing still smooth
- [ ] Piano Roll note editing still smooth
- [ ] Arrangement clip editing still smooth
- [ ] Mixer controls respond instantly
- [ ] Effects show real-time updates
- [ ] Playback tracking smooth
- [ ] Theme switching works
- [ ] Fullscreen works

---

## 🚨 Rollback Plan

### If Issues Arise
1. **Git**: Each phase in separate branch, easy to revert
2. **Feature Flags**: Can disable optimizations via config
3. **A/B Testing**: Show old/new to different users
4. **Monitoring**: Track metrics, auto-rollback if degradation

### Rollback Triggers
- CPU usage increases (vs decreases)
- Frame time increases
- User reports laggy UI
- Visual glitches appear
- Audio glitches occur

---

## 📋 Success Criteria

### Phase 1 (Must Achieve)
- ✅ Frame time <10ms
- ✅ Idle CPU <8%
- ✅ No visual regressions
- ✅ All interactions smooth

### Phase 2 (Target)
- ✅ Frame time <8ms
- ✅ Idle CPU <5%
- ✅ Spectrum still smooth (user feedback)

### Phase 3 (Stretch Goal)
- ✅ Frame time <6ms
- ✅ Idle CPU <2%
- ✅ React renders optimized

---

## 🎯 Recommendations

### Immediate Action (Phase 1)
Start with Phase 1 - all low-risk, high-impact changes:
1. Add dirty flags (1 day)
2. Migrate to UIUpdateManager (1 day)
3. Add visibility detection (0.5 days)

**Why**: These are proven patterns (PianoRoll reference), minimal risk, guaranteed savings.

### Next Steps (Phase 2)
After Phase 1 success, test Phase 2 optimizations:
1. Consolidate effect RAF loops
2. Add idle detection to effects
3. A/B test spectrum/hover frame rates

**Why**: Higher impact with testing required - need user feedback.

### Future (Phase 3+)
React optimization and advanced features:
1. React.memo + selectors
2. Virtualization for long lists
3. Web Workers for heavy calculations

**Why**: Polish and edge-case optimization.

---

## 📞 Decision Points for User

### Before Starting
1. **Phase 1 Approval**: Can we proceed with dirty flags + UIUpdateManager migration?
2. **Testing Plan**: Should we A/B test Phase 2 changes with beta users?
3. **Success Criteria**: Are the targets (frame time, idle CPU) correct?

### During Phase 2
4. **Spectrum Frame Rate**: Is 30fps acceptable for spectrum analyzer?
5. **Hover Throttling**: Is 30fps acceptable for grid hover?
6. **Idle Behavior**: Should visualizers pause when idle?

### After Each Phase
7. **Metrics Review**: Are we seeing expected improvements?
8. **UX Feedback**: Any user complaints about responsiveness?
9. **Next Phase**: Should we proceed to next phase or iterate?

---

**Status**: ✅ Strategy Complete - Ready for Phase 1 Implementation

**Awaiting**: User approval to begin Phase 1 optimizations

