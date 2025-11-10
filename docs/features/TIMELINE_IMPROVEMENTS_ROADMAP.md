# 🎯 Timeline Control Improvements - Comprehensive Roadmap

**Status:** Planning Phase
**Priority:** High
**Estimated Duration:** 7-10 weeks
**Based On:** Timeline Control Analysis + Professional DAW Comparison

---

## 📊 Executive Summary

Current timeline system is **architecturally solid (Grade B+)** but missing critical UX features present in professional DAWs. This roadmap addresses the gap between our unified TimelineController architecture and pro-level user experience.

### Current Strengths ✅
- Unified TimelineController singleton architecture
- Optimistic updates with 0ms latency
- Event-driven panel synchronization
- LOD-based rendering for performance
- GPU-accelerated playhead (transform3d)

### Critical Gaps ⚠️
1. **No follow playhead mode** (auto-scroll during playback)
2. **Limited arrangement timeline scrubbing** (only seeks on click)
3. **Missing marker navigation shortcuts**
4. **No punch recording markers**
5. **No minimap/overview component**
6. **No snap-to-grid during timeline interactions**

---

## 🎯 Implementation Phases

### **Phase 1: Follow Playhead Mode** (Week 1-2)
**Priority:** CRITICAL - This is the #1 UX complaint
**Complexity:** Medium
**Panels Affected:** All 3 (Arrangement, Piano Roll, Channel Rack)

#### Features
- [ ] Auto-scroll timeline during playback to keep playhead centered
- [ ] 3 follow modes:
  - `CONTINUOUS`: Always centered (like Ableton)
  - `PAGE`: Jump to next page when playhead reaches edge (like FL Studio)
  - `OFF`: No follow (current behavior)
- [ ] Smart follow pause on user interaction (scroll/zoom stops follow)
- [ ] Resume follow on next play/seek
- [ ] Keyboard shortcut: `F` to toggle follow mode

#### Technical Implementation
```javascript
// TimelineController.js enhancement
class TimelineController {
  followMode = 'CONTINUOUS' | 'PAGE' | 'OFF';

  updatePlayheadPosition(position) {
    // Existing optimistic update
    this._updateUIPosition(position);

    // NEW: Follow playhead logic
    if (this.isPlaying && this.followMode !== 'OFF') {
      this._followPlayhead(position);
    }
  }

  _followPlayhead(position) {
    const playheadX = position * this.stepWidth;
    const viewportCenter = this.viewport.scrollX + this.viewport.width / 2;

    if (this.followMode === 'CONTINUOUS') {
      // Keep playhead centered
      const targetScrollX = playheadX - this.viewport.width / 2;
      this._smoothScrollTo(targetScrollX);
    } else if (this.followMode === 'PAGE') {
      // Jump to next page when reaching edge
      const threshold = this.viewport.width * 0.8;
      if (playheadX > this.viewport.scrollX + threshold) {
        this._smoothScrollTo(this.viewport.scrollX + this.viewport.width);
      }
    }
  }
}
```

#### User Settings
```javascript
// Add to settings panel
{
  category: 'Playback',
  settings: [
    {
      id: 'followPlayhead',
      label: 'Follow Playhead',
      type: 'select',
      options: [
        { value: 'CONTINUOUS', label: 'Continuous (Always Centered)' },
        { value: 'PAGE', label: 'Page (Jump at Edge)' },
        { value: 'OFF', label: 'Off' }
      ],
      default: 'CONTINUOUS'
    }
  ]
}
```

#### Success Metrics
- [ ] Playhead stays visible during playback in all panels
- [ ] Smooth scrolling without jank (<16ms per frame)
- [ ] User scroll/zoom pauses follow mode
- [ ] Resume follow on next play

---

### **Phase 2: Arrangement Timeline Scrubbing** (Week 2-3)
**Priority:** HIGH - Essential for arrangement workflow
**Complexity:** Medium-High
**Panel Affected:** Arrangement Panel V2

#### Current Limitations
- Timeline only seeks on click (no drag scrubbing)
- No audio preview during scrub
- No snap-to-grid feedback

#### Features
- [ ] Drag timeline ruler to scrub through arrangement
- [ ] Real-time audio preview during scrub (configurable)
- [ ] Snap-to-grid visualization during scrub
- [ ] Magnetic snap to clip boundaries
- [ ] Scrub sensitivity based on zoom level

#### Technical Implementation
```javascript
// ArrangementPanelV2.jsx - Timeline ruler interaction
const handleRulerMouseDown = (e) => {
  if (e.button !== 0) return; // Left click only

  const position = pixelToStep(e.clientX);

  // Start scrubbing
  setIsScrubbing(true);
  timelineController.scrubStart(position);

  // Optional: Start audio preview
  if (settings.scrubAudioPreview) {
    audioPreviewManager.startScrubPreview();
  }
};

const handleRulerMouseMove = (e) => {
  if (!isScrubbing) return;

  let position = pixelToStep(e.clientX);

  // Snap to grid if enabled
  if (settings.snapToGrid) {
    position = snapToGrid(position, snapValue);
  }

  // Magnetic snap to clip boundaries
  if (settings.magneticSnap) {
    position = snapToNearestClipBoundary(position, 8); // 8 steps threshold
  }

  // Update position
  timelineController.scrubUpdate(position);

  // Update audio preview
  if (settings.scrubAudioPreview) {
    audioPreviewManager.updateScrubPreview(position);
  }
};

const handleRulerMouseUp = () => {
  if (!isScrubbing) return;

  setIsScrubbing(false);
  timelineController.scrubEnd();

  // Stop audio preview
  if (settings.scrubAudioPreview) {
    audioPreviewManager.stopScrubPreview();
  }
};
```

#### Audio Preview Manager
```javascript
// lib/core/AudioPreviewManager.js
export class AudioPreviewManager {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.previewBuffer = [];
    this.isPreviewActive = false;
  }

  startScrubPreview() {
    this.isPreviewActive = true;
    // Pre-load short audio snippets around scrub position
  }

  updateScrubPreview(position) {
    if (!this.isPreviewActive) return;

    // Play short audio snippet at position (50ms)
    const snippet = this.audioEngine.renderSnippet(position, 0.05);
    this._playSnippet(snippet);
  }

  stopScrubPreview() {
    this.isPreviewActive = false;
    this._clearPreviewBuffer();
  }
}
```

#### Success Metrics
- [ ] Smooth scrubbing at 60fps
- [ ] Audio preview latency < 50ms
- [ ] Snap feedback visible in real-time
- [ ] No playback glitches after scrub

---

### **Phase 3: Timeline Markers & Navigation** (Week 3-4)
**Priority:** MEDIUM - Professional workflow enhancement
**Complexity:** Medium

#### Features
- [ ] Timeline markers with labels
- [ ] Color-coded marker types (Section, Verse, Chorus, Drop, etc.)
- [ ] Keyboard navigation: `Shift+M` to add marker, `Ctrl+←/→` to jump
- [ ] Marker list panel (sidebar)
- [ ] Auto-naming based on position ("Bar 16", "Beat 64", etc.)
- [ ] Export markers to metadata

#### Marker Data Structure
```javascript
interface TimelineMarker {
  id: string;
  position: number;        // Step position
  label: string;           // "Intro", "Drop", "Bar 32"
  type: MarkerType;        // 'section' | 'marker' | 'region'
  color: string;           // Hex color
  regionEnd?: number;      // For region markers
  metadata?: {
    tempo?: number;
    timeSignature?: string;
  };
}

// Store in TimelineStore
const markers = [
  { id: '1', position: 0, label: 'Intro', type: 'section', color: '#3b82f6' },
  { id: '2', position: 64, label: 'Build Up', type: 'section', color: '#10b981' },
  { id: '3', position: 128, label: 'Drop', type: 'section', color: '#ef4444' },
];
```

#### Rendering Integration
```javascript
// timelineRenderer.js enhancement
export function renderMarkers(ctx, { markers, viewport, dimensions }) {
  markers.forEach(marker => {
    const x = marker.position * dimensions.stepWidth - viewport.scrollX;

    // Only render visible markers
    if (x < 0 || x > viewport.width) return;

    // Draw marker line
    ctx.strokeStyle = marker.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, dimensions.height);
    ctx.stroke();

    // Draw marker flag
    ctx.fillStyle = marker.color;
    ctx.fillRect(x - 1, 0, 12, 20);

    // Draw marker label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Inter';
    ctx.fillText(marker.label, x + 15, 12);
  });
}
```

#### Keyboard Shortcuts
```javascript
// TransportManager.js enhancement
const markerShortcuts = {
  'Shift+M': () => addMarkerAtPlayhead(),
  'Ctrl+ArrowRight': () => jumpToNextMarker(),
  'Ctrl+ArrowLeft': () => jumpToPreviousMarker(),
  'Ctrl+Shift+M': () => openMarkerList(),
};
```

#### Success Metrics
- [ ] Markers render at 60fps even with 100+ markers
- [ ] Jump to marker < 16ms latency
- [ ] Marker labels visible at all zoom levels (LOD)
- [ ] Keyboard navigation works consistently

---

### **Phase 4: Punch Recording Markers** (Week 4-5)
**Priority:** MEDIUM - Essential for recording workflows
**Complexity:** Medium

#### Features
- [ ] Pre-roll/post-roll markers
- [ ] Punch in/out region visualization
- [ ] Auto-enable recording within punch region
- [ ] Count-in before punch-in (metronome)
- [ ] Loop recording mode within punch region

#### Punch Recording Workflow
```
Timeline: |-------|======PUNCH REGION======|-------|
          ^       ^                        ^       ^
      Pre-roll  Punch In              Punch Out  Post-roll
       (2 bars)                                  (1 bar)
```

#### Implementation
```javascript
// TimelineStore.js enhancement
export const useTimelineStore = create((set, get) => ({
  // Punch recording state
  punchRecording: {
    enabled: false,
    punchIn: null,          // Step position
    punchOut: null,         // Step position
    preRoll: 8,             // Steps before punch-in
    postRoll: 4,            // Steps after punch-out
    countIn: true,          // Enable metronome count-in
    loopMode: false,        // Loop within punch region
  },

  setPunchRegion: (start, end) => set(state => ({
    punchRecording: {
      ...state.punchRecording,
      punchIn: start,
      punchOut: end,
      enabled: true
    }
  })),

  clearPunchRegion: () => set(state => ({
    punchRecording: { ...state.punchRecording, enabled: false }
  })),
}));
```

#### Recording Manager Integration
```javascript
// RecordingManager.js enhancement
class RecordingManager {
  startRecording() {
    const { punchRecording } = useTimelineStore.getState();

    if (punchRecording.enabled) {
      // Start from pre-roll position
      const startPosition = punchRecording.punchIn - punchRecording.preRoll;
      this.transportManager.seekTo(startPosition);

      // Schedule punch-in
      this._schedulePunchIn(punchRecording.punchIn);

      // Schedule punch-out
      this._schedulePunchOut(punchRecording.punchOut);

      // Enable metronome for count-in
      if (punchRecording.countIn) {
        this.metronome.enable();
      }
    }

    this.transportManager.play();
  }

  _schedulePunchIn(position) {
    // At punch-in position, enable actual recording
    this.scheduler.scheduleAt(position, () => {
      this.isActuallyRecording = true;
      this.metronome.disable(); // Stop metronome after count-in
    });
  }

  _schedulePunchOut(position) {
    // At punch-out position, disable recording
    this.scheduler.scheduleAt(position, () => {
      this.isActuallyRecording = false;

      // If loop mode, jump back to punch-in
      const { loopMode, punchIn } = useTimelineStore.getState().punchRecording;
      if (loopMode) {
        this.transportManager.seekTo(punchIn);
      } else {
        this.transportManager.stop();
      }
    });
  }
}
```

#### UI Visualization
```javascript
// Timeline renderer enhancement
function renderPunchRegion(ctx, { punchRecording, viewport, dimensions }) {
  if (!punchRecording.enabled) return;

  const startX = punchRecording.punchIn * dimensions.stepWidth - viewport.scrollX;
  const endX = punchRecording.punchOut * dimensions.stepWidth - viewport.scrollX;
  const width = endX - startX;

  // Pre-roll region (light blue)
  const preRollX = startX - (punchRecording.preRoll * dimensions.stepWidth);
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.fillRect(preRollX, 0, punchRecording.preRoll * dimensions.stepWidth, dimensions.height);

  // Punch region (red highlight)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  ctx.fillRect(startX, 0, width, dimensions.height);

  // Post-roll region (light blue)
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.fillRect(endX, 0, punchRecording.postRoll * dimensions.stepWidth, dimensions.height);

  // Punch markers
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, 0);
  ctx.lineTo(startX, dimensions.height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, 0);
  ctx.lineTo(endX, dimensions.height);
  ctx.stroke();
}
```

#### Success Metrics
- [ ] Punch-in/out accurate to nearest step
- [ ] Count-in metronome synced with tempo
- [ ] Loop mode seamless (no audio glitch)
- [ ] Visual feedback clear and non-intrusive

---

### **Phase 5: Minimap & Overview** (Week 5-6)
**Priority:** LOW - Nice-to-have for large projects
**Complexity:** High

#### Features
- [ ] Bird's-eye view of entire timeline
- [ ] Show clips, markers, and playhead
- [ ] Click to jump to position
- [ ] Drag to navigate viewport
- [ ] Waveform overview mode (optional)

#### Component Structure
```javascript
// components/timeline/TimelineMinimap.jsx
export function TimelineMinimap({
  totalSteps,
  clips,
  markers,
  currentPosition,
  viewport,
  onSeek,
  onViewportDrag
}) {
  const minimapRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate minimap dimensions
  const minimapWidth = 200; // Fixed width
  const minimapHeight = 40; // Fixed height
  const stepWidth = minimapWidth / totalSteps; // Very small

  // Render minimap
  useEffect(() => {
    const canvas = minimapRef.current;
    const ctx = canvas.getContext('2d');

    // Clear
    ctx.clearRect(0, 0, minimapWidth, minimapHeight);

    // Draw clips (simplified)
    clips.forEach(clip => {
      const x = clip.start * stepWidth;
      const width = clip.duration * stepWidth;
      ctx.fillStyle = clip.color;
      ctx.fillRect(x, 10, width, 20);
    });

    // Draw markers
    markers.forEach(marker => {
      const x = marker.position * stepWidth;
      ctx.strokeStyle = marker.color;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, minimapHeight);
      ctx.stroke();
    });

    // Draw playhead
    const playheadX = currentPosition * stepWidth;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, minimapHeight);
    ctx.stroke();

    // Draw viewport window
    const viewportX = viewport.scrollX * stepWidth / viewport.stepWidth;
    const viewportWidth = viewport.width * stepWidth / viewport.stepWidth;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.strokeRect(viewportX, 0, viewportWidth, minimapHeight);

  }, [clips, markers, currentPosition, viewport, totalSteps]);

  // Handle minimap click
  const handleMinimapClick = (e) => {
    const rect = minimapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const position = Math.floor(x / stepWidth);
    onSeek(position);
  };

  return (
    <canvas
      ref={minimapRef}
      width={minimapWidth}
      height={minimapHeight}
      onClick={handleMinimapClick}
      style={{
        cursor: 'pointer',
        border: '1px solid var(--zenith-border-primary)',
        borderRadius: '4px'
      }}
    />
  );
}
```

#### Integration Points
- Arrangement panel header (always visible)
- Piano roll header (optional, user preference)
- Floating minimap window (detachable)

#### Success Metrics
- [ ] Minimap updates < 16ms after clip changes
- [ ] Click to jump < 16ms latency
- [ ] Viewport drag smooth (60fps)
- [ ] Readable at high clip density (LOD)

---

### **Phase 6: Snap-to-Grid Enhancements** (Week 6-7)
**Priority:** MEDIUM - Improves precision
**Complexity:** Low-Medium

#### Current Limitations
- Snap only works for note placement
- No snap during timeline scrubbing
- No magnetic snap to clip boundaries
- No visual snap feedback

#### Features
- [ ] Snap during timeline scrubbing
- [ ] Snap during marker placement
- [ ] Magnetic snap to clip edges (8-step threshold)
- [ ] Visual snap guides (vertical lines)
- [ ] Snap to time signatures (bars/beats)
- [ ] Keyboard toggle: `S` to toggle snap on/off

#### Implementation
```javascript
// lib/utils/SnapHelper.js
export class SnapHelper {
  constructor(snapValue = 4) {
    this.snapValue = snapValue;
    this.enabled = true;
    this.magneticThreshold = 8; // steps
  }

  snapToGrid(position) {
    if (!this.enabled) return position;
    return Math.round(position / this.snapValue) * this.snapValue;
  }

  snapToClipBoundary(position, clips) {
    if (!this.enabled) return position;

    // Find nearest clip boundary
    let nearestBoundary = null;
    let minDistance = this.magneticThreshold;

    clips.forEach(clip => {
      const distToStart = Math.abs(position - clip.start);
      const distToEnd = Math.abs(position - clip.end);

      if (distToStart < minDistance) {
        minDistance = distToStart;
        nearestBoundary = clip.start;
      }

      if (distToEnd < minDistance) {
        minDistance = distToEnd;
        nearestBoundary = clip.end;
      }
    });

    return nearestBoundary !== null ? nearestBoundary : position;
  }

  getSnapGuidePositions(position, viewport) {
    // Return positions of vertical snap guide lines
    const snappedPosition = this.snapToGrid(position);

    return [
      snappedPosition - this.snapValue,
      snappedPosition,
      snappedPosition + this.snapValue
    ].filter(pos => {
      const x = pos * viewport.stepWidth;
      return x >= viewport.scrollX && x <= viewport.scrollX + viewport.width;
    });
  }
}
```

#### Visual Feedback
```javascript
// Render snap guides during scrubbing
function renderSnapGuides(ctx, { snapHelper, scrubbingPosition, viewport, dimensions }) {
  if (!snapHelper.enabled || !scrubbingPosition) return;

  const guidePositions = snapHelper.getSnapGuidePositions(scrubbingPosition, viewport);

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  guidePositions.forEach(pos => {
    const x = pos * dimensions.stepWidth - viewport.scrollX;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, dimensions.height);
    ctx.stroke();
  });

  ctx.setLineDash([]);
}
```

#### Success Metrics
- [ ] Snap feedback visible in real-time
- [ ] Magnetic snap feels natural (not too sticky)
- [ ] Toggle snap with `S` key works globally
- [ ] No snap jank during fast scrubbing

---

### **Phase 7: Performance Profiling & Polish** (Week 7-10)
**Priority:** HIGH - Ensure 60fps in all scenarios
**Complexity:** Variable

#### Optimization Targets
1. **Timeline Rendering** - Target: <8ms per frame
2. **Scrubbing** - Target: 60fps even with 1000+ clips
3. **Follow Playhead** - Target: Smooth scroll, no jank
4. **Marker Rendering** - Target: 60fps with 100+ markers
5. **Minimap Updates** - Target: <16ms after clip changes

#### Profiling Tools
```javascript
// lib/utils/PerformanceProfiler.js
export class TimelineProfiler {
  constructor() {
    this.metrics = {
      renderTime: [],
      scrubLatency: [],
      followScrollTime: [],
      markerRenderTime: []
    };
  }

  startMeasure(label) {
    performance.mark(`${label}-start`);
  }

  endMeasure(label) {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);

    const measure = performance.getEntriesByName(label)[0];
    this.metrics[`${label}Time`].push(measure.duration);

    // Warn if over budget
    if (measure.duration > 16) {
      console.warn(`⚠️ Timeline performance: ${label} took ${measure.duration.toFixed(2)}ms (>16ms budget)`);
    }
  }

  getReport() {
    return Object.entries(this.metrics).map(([key, values]) => ({
      metric: key,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      max: Math.max(...values),
      min: Math.min(...values),
      samples: values.length
    }));
  }
}
```

#### Optimization Techniques
1. **Virtual Rendering** - Only render visible timeline elements
2. **Debounced Updates** - Throttle motor updates during scrubbing
3. **RequestAnimationFrame Batching** - Batch all UI updates
4. **WebGL Rendering** - Use GPU for large timeline rendering (optional)
5. **Worker Thread** - Offload clip boundary calculations

#### Success Metrics
- [ ] 60fps timeline rendering in all panels
- [ ] <16ms scrub latency (click to visual update)
- [ ] <100ms follow playhead scroll animation
- [ ] No jank during playback with 100+ clips
- [ ] Memory usage stable (<500MB for large project)

---

## 📋 Implementation Checklist

### Phase 1: Follow Playhead Mode ✅
- [ ] Implement 3 follow modes (CONTINUOUS, PAGE, OFF)
- [ ] Add smooth scroll animation
- [ ] Pause follow on user interaction
- [ ] Resume follow on play
- [ ] Add keyboard shortcut (F)
- [ ] Add settings UI
- [ ] Test with all 3 panels
- [ ] Performance profiling (<16ms scroll updates)

### Phase 2: Arrangement Timeline Scrubbing ✅
- [ ] Implement drag scrubbing in arrangement panel
- [ ] Add audio preview during scrub
- [ ] Implement snap-to-grid during scrub
- [ ] Add magnetic snap to clip boundaries
- [ ] Scrub sensitivity based on zoom
- [ ] Performance profiling (60fps scrubbing)

### Phase 3: Timeline Markers & Navigation ✅
- [ ] Implement marker data structure
- [ ] Add marker rendering to timeline
- [ ] Implement keyboard navigation (Ctrl+←/→)
- [ ] Add marker list panel
- [ ] Implement add marker shortcut (Shift+M)
- [ ] Add marker export to metadata
- [ ] LOD optimization for 100+ markers

### Phase 4: Punch Recording Markers ✅
- [ ] Implement punch region data structure
- [ ] Add pre-roll/post-roll settings
- [ ] Implement punch-in/out scheduling
- [ ] Add count-in metronome
- [ ] Implement loop recording mode
- [ ] Add punch region visualization
- [ ] Test recording accuracy

### Phase 5: Minimap & Overview ✅
- [ ] Create TimelineMinimap component
- [ ] Implement bird's-eye view rendering
- [ ] Add click-to-jump functionality
- [ ] Implement viewport drag
- [ ] Add waveform overview mode
- [ ] Optimize for large projects (1000+ clips)
- [ ] Add detachable minimap window

### Phase 6: Snap-to-Grid Enhancements ✅
- [ ] Implement SnapHelper utility class
- [ ] Add snap during scrubbing
- [ ] Add magnetic snap to clip boundaries
- [ ] Implement visual snap guides
- [ ] Add snap to time signatures
- [ ] Implement global snap toggle (S key)
- [ ] Test snap accuracy

### Phase 7: Performance Profiling & Polish ✅
- [ ] Set up TimelineProfiler
- [ ] Profile all timeline operations
- [ ] Optimize slow operations (>16ms)
- [ ] Implement virtual rendering
- [ ] Add WebGL rendering (if needed)
- [ ] Memory profiling (large projects)
- [ ] Stress testing (1000+ clips, 100+ markers)
- [ ] Final UX polish

---

## 🎨 UI/UX Enhancements

### Timeline Header Redesign
```
┌────────────────────────────────────────────────────────────┐
│ ▶️ Play  ⏸ Pause  ⏹ Stop │ 🔄 Follow: [Continuous ▼]     │
│ 📍 Markers  🎙️ Punch  🗺️ Minimap │ ⚡ Snap: [ON]  [1/4 ▼] │
└────────────────────────────────────────────────────────────┘
```

### Contextual Hints
- Hover timeline: "Click to seek, Drag to scrub"
- Shift+Click: "Add marker here"
- Ctrl+Drag: "Select range"
- Alt+Hover: "Preview audio"

### Visual Feedback
- Scrubbing: Blue vertical line follows mouse
- Snap: Dashed guide lines at snap positions
- Punch region: Red highlight with "REC" badge
- Follow mode: Playhead glow animation

---

## 🧪 Testing Strategy

### Unit Tests
```javascript
// TimelineController tests
describe('Follow Playhead', () => {
  test('CONTINUOUS mode keeps playhead centered', () => {
    controller.setFollowMode('CONTINUOUS');
    controller.play();
    controller.updatePlayheadPosition(64);
    expect(viewport.scrollX).toBe(64 * stepWidth - viewport.width / 2);
  });

  test('PAGE mode jumps at edge', () => {
    controller.setFollowMode('PAGE');
    controller.play();
    controller.updatePlayheadPosition(viewport.width * 0.9);
    expect(viewport.scrollX).toBeGreaterThan(0);
  });
});

describe('Scrubbing', () => {
  test('scrub updates position at 60fps', async () => {
    const positions = [];
    for (let i = 0; i < 60; i++) {
      controller.scrubUpdate(i);
      positions.push(controller.getState().currentPosition);
      await sleep(16); // 60fps
    }
    expect(positions).toEqual(Array.from({ length: 60 }, (_, i) => i));
  });
});
```

### Integration Tests
```javascript
// Cross-panel synchronization
test('scrubbing syncs across all panels', () => {
  arrangementPanel.scrubStart(0);
  arrangementPanel.scrubUpdate(32);

  expect(pianoRollPanel.playheadPosition).toBe(32);
  expect(channelRackPanel.playheadPosition).toBe(32);
});
```

### Performance Tests
```javascript
// Stress testing
test('timeline renders 60fps with 1000 clips', () => {
  const clips = generateClips(1000);
  const profiler = new TimelineProfiler();

  profiler.startMeasure('render');
  timelineRenderer.render({ clips, viewport, dimensions });
  profiler.endMeasure('render');

  const report = profiler.getReport();
  expect(report.find(m => m.metric === 'renderTime').avg).toBeLessThan(16);
});
```

### User Testing
- [ ] Test follow playhead with real users (5 participants)
- [ ] Measure scrubbing satisfaction (1-10 scale)
- [ ] Test marker workflow efficiency (task completion time)
- [ ] Collect feedback on snap behavior (too sticky? not enough?)

---

## 📈 Success Metrics

### Performance KPIs
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Timeline render time | <8ms | TBD | ⏳ |
| Scrub latency | <16ms | TBD | ⏳ |
| Follow scroll time | <100ms | TBD | ⏳ |
| Marker render (100+) | 60fps | TBD | ⏳ |
| Memory usage (large project) | <500MB | TBD | ⏳ |

### User Experience KPIs
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Follow playhead satisfaction | >8/10 | N/A | ⏳ |
| Scrubbing feels natural | >8/10 | N/A | ⏳ |
| Snap helps precision | >7/10 | N/A | ⏳ |
| Marker workflow intuitive | >8/10 | N/A | ⏳ |

### Feature Adoption KPIs
| Feature | Target Usage | Current | Status |
|---------|--------------|---------|--------|
| Follow playhead enabled | >80% | 0% | ⏳ |
| Scrubbing used regularly | >60% | 0% | ⏳ |
| Markers used in projects | >40% | 0% | ⏳ |
| Snap enabled by default | >90% | 100% | ✅ |

---

## 🔄 Migration & Rollout

### Week-by-Week Plan
- **Week 1-2:** Phase 1 (Follow Playhead) → Beta release to 10 users
- **Week 2-3:** Phase 2 (Scrubbing) → Beta release to 25 users
- **Week 3-4:** Phase 3 (Markers) → Beta release to 50 users
- **Week 4-5:** Phase 4 (Punch Recording) → Beta release to 100 users
- **Week 5-6:** Phase 5 (Minimap) → Beta release to 200 users
- **Week 6-7:** Phase 6 (Snap Enhancements) → Beta release to all users
- **Week 7-10:** Phase 7 (Performance) → Production release

### Feature Flags
```javascript
export const TIMELINE_FEATURES = {
  FOLLOW_PLAYHEAD: process.env.FEATURE_FOLLOW_PLAYHEAD === 'true',
  ARRANGEMENT_SCRUBBING: process.env.FEATURE_ARRANGEMENT_SCRUBBING === 'true',
  TIMELINE_MARKERS: process.env.FEATURE_TIMELINE_MARKERS === 'true',
  PUNCH_RECORDING: process.env.FEATURE_PUNCH_RECORDING === 'true',
  MINIMAP: process.env.FEATURE_MINIMAP === 'true',
  SNAP_ENHANCEMENTS: process.env.FEATURE_SNAP_ENHANCEMENTS === 'true',
};
```

### User Communication
- [ ] Blog post: "What's New in Timeline Controls"
- [ ] Video tutorial: "Timeline Workflow 2.0"
- [ ] In-app tooltip tour for first-time users
- [ ] Changelog entry for each phase
- [ ] Discord announcement for beta features

---

## 🎯 Next Steps

1. **Review this roadmap with team** (Week 0)
2. **Set up feature flags** (Week 0)
3. **Create GitHub issues for each phase** (Week 0)
4. **Start Phase 1 implementation** (Week 1)
5. **Set up beta testing program** (Week 1)
6. **Create performance benchmarks** (Week 1)

---

## 📚 References

- [TIMELINE_CONTROL_REDESIGN.md](./TIMELINE_CONTROL_REDESIGN.md) - Original design doc
- [Timeline Analysis Report](../conversation-summary.md) - Professional DAW comparison
- [TimelineController.js](../../client/src/lib/core/TimelineController.js) - Current implementation
- [Ableton Live Timeline Behavior](https://www.ableton.com/en/manual/navigating-live/) - Reference
- [FL Studio Playlist Timeline](https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/playlist.htm) - Reference

---

**Last Updated:** 2025-01-09
**Status:** Ready for Team Review 🚀
