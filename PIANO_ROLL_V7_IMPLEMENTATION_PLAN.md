# PIANO ROLL V7 - IMPLEMENTATION PLAN

## 🎯 HEDEF
FL Studio kabiliyetinde, performanslı, single source of truth prensipli Piano Roll

## 📊 MEVCUT DURUM
- **Temel MIDI Editing**: 7/10
- **Timeline**: 5/10
- **MIDI Recording**: 0/10
- **Automation**: 3/10
- **Musical Intelligence**: 1/10
- **GENEL**: 5.4/10 → Hedef: **9.5/10**

---

## 🏗️ ARCHITECTURE PRINCIPLES

### 1. Single Source of Truth
- **TimelineStore**: Tempo, time signature, markers → SINGLE OWNER
- **ArrangementStore**: Pattern notes, CC data → SINGLE OWNER
- **PlaybackStore**: Transport state, playhead → SINGLE OWNER
- **NO DUPLICATION**: State derived from stores, never duplicated

### 2. Performance First
- **LOD System**: Existing system excellent, extend it
- **Canvas Layers**: Separate layers for static/dynamic content
- **UIUpdateManager**: 60fps guaranteed
- **Lazy Loading**: Render only visible area
- **Worker Threads**: Heavy calculations (quantize, humanize) in workers

### 3. Modularity
- Each feature as independent module
- Clear interfaces between modules
- Easy to test, easy to extend

---

## 🚀 IMPLEMENTATION PHASES

### ✅ PHASE 1: TIMELINE INFRASTRUCTURE (Week 1-2)
**Priority: CRITICAL** | **Effort: Medium** | **Impact: HIGH**

#### 1.1. TimelineStore (Single Source of Truth)
```javascript
// client/src/stores/TimelineStore.js
class TimelineStore {
  state = {
    // Time signature
    timeSignatures: [
      { position: 0, numerator: 4, denominator: 4 }
    ],

    // Tempo
    tempoMarkers: [
      { position: 0, bpm: 140 }
    ],

    // Markers & bookmarks
    markers: [
      { id, position, name, color, type: 'section' | 'loop' | 'bookmark' }
    ],

    // Loop regions (multiple)
    loopRegions: [
      { id, start, end, name, color, isActive: boolean }
    ],

    // Timeline settings
    displaySettings: {
      showTimeSignature: true,
      showTempo: true,
      showMarkers: true,
      snapToMarkers: true,
      rulerHeight: 30
    }
  }

  // Methods
  addTimeSignature(position, numerator, denominator)
  removeTimeSignature(id)
  getTimeSignatureAt(position)

  addTempoMarker(position, bpm)
  removeTempoMarker(id)
  getTempoAt(position)

  addMarker(position, name, options)
  removeMarker(id)
  getNearestMarker(position)

  addLoopRegion(start, end, name)
  setActiveLoopRegion(id)
}
```

#### 1.2. Timeline Coordinate System
```javascript
// client/src/lib/timeline/TimelineCoordinateSystem.js
class TimelineCoordinateSystem {
  // Convert step position to pixels
  stepToPixel(step, zoom, timeSignatureAt, stepsPerBeat)

  // Convert pixels to step position
  pixelToStep(pixel, zoom, timeSignatureAt, stepsPerBeat)

  // Get bar/beat/subdivision from step
  stepToBarBeat(step, timeSignatureAt, stepsPerBeat)

  // Get step from bar/beat/subdivision
  barBeatToStep(bar, beat, subdivision, timeSignatureAt, stepsPerBeat)

  // Calculate bars in time signature region
  getBarsInRegion(startStep, endStep, timeSignatures)
}
```

#### 1.3. TimelineRenderer Extension
```javascript
// client/src/features/piano_roll_v7/renderers/timelineRenderer.js
export class TimelineRenderer {
  // Existing methods...

  // NEW: Render time signature markers
  renderTimeSignatures(ctx, engine, timelineStore)

  // NEW: Render tempo markers
  renderTempoMarkers(ctx, engine, timelineStore)

  // NEW: Render markers & bookmarks
  renderMarkers(ctx, engine, timelineStore)

  // NEW: Render multiple loop regions
  renderLoopRegions(ctx, engine, timelineStore)
}
```

**Deliverables:**
- ✅ TimelineStore with full state management
- ✅ TimelineCoordinateSystem for accurate positioning
- ✅ Timeline rendering for all markers
- ✅ Unit tests for coordinate conversions

---

### ✅ PHASE 2: TIMELINE FEATURES (Week 2-3)
**Priority: HIGH** | **Effort: Medium** | **Impact: HIGH**

#### 2.1. Timeline Markers UI
```javascript
// client/src/features/piano_roll_v7/components/TimelineMarkers.jsx
export const TimelineMarkers = ({ timelineStore, engine }) => {
  // Drag to create marker
  // Double-click to edit marker
  // Right-click context menu
  // Keyboard shortcuts (M to add marker)

  return (
    <div className="timeline-markers">
      {markers.map(marker => (
        <TimelineMarker
          key={marker.id}
          marker={marker}
          onDrag={handleDrag}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      ))}
    </div>
  );
};
```

#### 2.2. Auto-Scroll During Playback
```javascript
// client/src/features/piano_roll_v7/hooks/useAutoScroll.js
export const useAutoScroll = (engine, playbackStore, options = {}) => {
  useEffect(() => {
    if (!playbackStore.isPlaying) return;

    const interval = setInterval(() => {
      const playheadStep = playbackStore.currentStep;
      const playheadX = engine.stepToPixel(playheadStep);
      const viewportWidth = engine.viewport.width;
      const scrollX = engine.viewport.scrollX;

      // Keep playhead in center 50% of viewport
      const centerStart = viewportWidth * 0.25;
      const centerEnd = viewportWidth * 0.75;
      const playheadRelativeX = playheadX - scrollX;

      if (playheadRelativeX < centerStart || playheadRelativeX > centerEnd) {
        // Smooth scroll to center
        const targetScrollX = playheadX - (viewportWidth / 2);
        engine.setTargetScroll({ x: targetScrollX });
      }
    }, 16); // 60fps

    return () => clearInterval(interval);
  }, [playbackStore.isPlaying]);
};
```

#### 2.3. Zoom Presets & Shortcuts
```javascript
// client/src/features/piano_roll_v7/hooks/useZoomPresets.js
export const ZOOM_PRESETS = {
  FIT_PATTERN: 'fit',
  ZOOM_1X: 1.0,
  ZOOM_2X: 2.0,
  ZOOM_4X: 4.0,
  ZOOM_8X: 8.0,
  ZOOM_OUT_MAX: 0.1,
  ZOOM_IN_MAX: 20.0
};

export const useZoomPresets = (engine, patternLength) => {
  const zoomToFit = () => {
    const viewportWidth = engine.viewport.width;
    const patternWidth = engine.stepToPixel(patternLength);
    const targetZoom = viewportWidth / patternWidth;
    engine.setTargetZoom({ x: targetZoom });
  };

  const zoomToPreset = (preset) => {
    if (preset === ZOOM_PRESETS.FIT_PATTERN) {
      zoomToFit();
    } else {
      engine.setTargetZoom({ x: preset });
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcut('Ctrl+0', () => zoomToFit());
  useKeyboardShortcut('Ctrl+1', () => zoomToPreset(1.0));
  useKeyboardShortcut('Ctrl+2', () => zoomToPreset(2.0));
  useKeyboardShortcut('Ctrl+4', () => zoomToPreset(4.0));
  useKeyboardShortcut('Ctrl+Plus', () => engine.zoomIn());
  useKeyboardShortcut('Ctrl+Minus', () => engine.zoomOut());

  return { zoomToFit, zoomToPreset };
};
```

#### 2.4. Mini-Map Navigator
```javascript
// client/src/features/piano_roll_v7/components/MiniMap.jsx
export const MiniMap = ({ engine, notes, totalSteps }) => {
  const canvasRef = useRef(null);

  // Render mini-map (simplified view of entire pattern)
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw notes (simplified)
    notes.forEach(note => {
      const x = (note.startTime / totalSteps) * MINIMAP_WIDTH;
      const y = (note.pitch / 127) * MINIMAP_HEIGHT;
      const width = (note.length / totalSteps) * MINIMAP_WIDTH;

      ctx.fillStyle = getVelocityColor(note.velocity);
      ctx.fillRect(x, y, Math.max(1, width), 2);
    });

    // Draw viewport indicator
    const viewportX = (engine.viewport.scrollX / totalSteps) * MINIMAP_WIDTH;
    const viewportWidth = (engine.viewport.width / (totalSteps * engine.viewport.zoomX)) * MINIMAP_WIDTH;

    ctx.strokeStyle = '#3b82f6';
    ctx.strokeRect(viewportX, 0, viewportWidth, MINIMAP_HEIGHT);
  }, [notes, engine.viewport]);

  return <canvas ref={canvasRef} className="minimap" />;
};
```

**Deliverables:**
- ✅ Timeline markers with drag/edit/delete
- ✅ Auto-scroll during playback
- ✅ Zoom presets & keyboard shortcuts
- ✅ Mini-map navigator

---

### ✅ PHASE 3: MIDI RECORDING (Week 3-5)
**Priority: CRITICAL** | **Effort: High** | **Impact: CRITICAL**

#### 3.1. MIDIDeviceManager (Single Source of Truth)
```javascript
// client/src/lib/midi/MIDIDeviceManager.js
export class MIDIDeviceManager {
  constructor() {
    this.state = {
      isSupported: false,
      devices: new Map(),
      selectedInputId: null,
      selectedOutputId: null,
      activeNotes: new Set(), // Currently held notes
      listeners: new Set()
    };
  }

  async initialize() {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not supported');
      this.state.isSupported = false;
      return;
    }

    try {
      const midiAccess = await navigator.requestMIDIAccess();
      this.state.isSupported = true;

      // Listen for device connections
      midiAccess.addEventListener('statechange', this.handleStateChange);

      // Initialize existing devices
      this.scanDevices(midiAccess);

      console.log('🎹 MIDI Device Manager initialized');
    } catch (error) {
      console.error('MIDI initialization failed:', error);
    }
  }

  scanDevices(midiAccess) {
    // Scan inputs
    for (const input of midiAccess.inputs.values()) {
      this.state.devices.set(input.id, {
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer,
        type: 'input',
        state: input.state,
        connection: input.connection,
        midiInput: input
      });
    }

    // Scan outputs
    for (const output of midiAccess.outputs.values()) {
      this.state.devices.set(output.id, {
        id: output.id,
        name: output.name,
        manufacturer: output.manufacturer,
        type: 'output',
        state: output.state,
        connection: output.connection,
        midiOutput: output
      });
    }
  }

  selectInput(deviceId) {
    const device = this.state.devices.get(deviceId);
    if (!device || device.type !== 'input') {
      console.warn('Invalid MIDI input device:', deviceId);
      return;
    }

    // Unsubscribe from previous device
    if (this.state.selectedInputId) {
      const prevDevice = this.state.devices.get(this.state.selectedInputId);
      if (prevDevice?.midiInput) {
        prevDevice.midiInput.onmidimessage = null;
      }
    }

    // Subscribe to new device
    this.state.selectedInputId = deviceId;
    device.midiInput.onmidimessage = (event) => {
      this.handleMIDIMessage(event);
    };

    console.log('✅ MIDI input selected:', device.name);
  }

  handleMIDIMessage(event) {
    const [status, note, velocity] = event.data;
    const command = status & 0xf0;
    const channel = status & 0x0f;

    const midiEvent = {
      timestamp: event.timeStamp,
      command,
      channel,
      note,
      velocity,
      rawData: event.data
    };

    // Notify listeners
    this.state.listeners.forEach(listener => listener(midiEvent));

    // Track active notes (for note-off detection)
    if (command === 0x90 && velocity > 0) { // Note On
      this.state.activeNotes.add(note);
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) { // Note Off
      this.state.activeNotes.delete(note);
    }
  }

  subscribe(listener) {
    this.state.listeners.add(listener);
    return () => this.state.listeners.delete(listener);
  }

  getActiveNotes() {
    return Array.from(this.state.activeNotes);
  }
}

// Singleton instance
export const midiDeviceManager = new MIDIDeviceManager();
```

#### 3.2. MIDIRecorder
```javascript
// client/src/lib/midi/MIDIRecorder.js
export class MIDIRecorder {
  constructor(midiDeviceManager, playbackStore, arrangementStore) {
    this.midiDeviceManager = midiDeviceManager;
    this.playbackStore = playbackStore;
    this.arrangementStore = arrangementStore;

    this.state = {
      isRecording: false,
      recordMode: 'replace', // 'replace' | 'overdub' | 'loop'
      quantizeStrength: 0, // 0 = no quantize, 1 = full quantize
      countIn: 0, // bars of count-in

      // Recording session state
      recordedNotes: new Map(), // noteId -> { startTime, note, velocity, endTime }
      recordStartTime: null,
      recordStartStep: null
    };
  }

  startRecording(options = {}) {
    if (this.state.isRecording) {
      console.warn('Already recording');
      return;
    }

    this.state.recordMode = options.mode || 'replace';
    this.state.quantizeStrength = options.quantizeStrength ?? 0;
    this.state.countIn = options.countIn ?? 0;

    // Count-in handling
    if (this.state.countIn > 0) {
      this.startCountIn(() => this.beginRecording());
    } else {
      this.beginRecording();
    }
  }

  beginRecording() {
    this.state.isRecording = true;
    this.state.recordStartTime = performance.now();
    this.state.recordStartStep = this.playbackStore.currentStep;

    // Subscribe to MIDI events
    this.unsubscribe = this.midiDeviceManager.subscribe((midiEvent) => {
      this.handleMIDIEvent(midiEvent);
    });

    // Clear previous notes in replace mode
    if (this.state.recordMode === 'replace') {
      this.clearExistingNotes();
    }

    console.log('🔴 Recording started');
  }

  handleMIDIEvent(midiEvent) {
    const { command, note, velocity, timestamp } = midiEvent;

    // Calculate step position
    const elapsedMs = timestamp - this.state.recordStartTime;
    const currentStep = this.state.recordStartStep + this.msToSteps(elapsedMs);

    // Quantize if enabled
    const quantizedStep = this.state.quantizeStrength > 0
      ? this.quantizeStep(currentStep, this.state.quantizeStrength)
      : currentStep;

    if (command === 0x90 && velocity > 0) { // Note On
      const noteId = `recorded_${Date.now()}_${note}`;
      this.state.recordedNotes.set(noteId, {
        id: noteId,
        pitch: note,
        velocity,
        startTime: quantizedStep,
        endTime: null // Will be set on Note Off
      });
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) { // Note Off
      // Find matching Note On
      for (const [noteId, recordedNote] of this.state.recordedNotes) {
        if (recordedNote.pitch === note && recordedNote.endTime === null) {
          recordedNote.endTime = quantizedStep;
          recordedNote.length = Math.max(0.25, recordedNote.endTime - recordedNote.startTime);

          // Add to arrangement store
          this.arrangementStore.addNote(recordedNote);
          break;
        }
      }
    }
  }

  stopRecording() {
    if (!this.state.isRecording) return;

    this.state.isRecording = false;

    // Unsubscribe from MIDI events
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Finalize any hanging notes (no Note Off received)
    for (const [noteId, recordedNote] of this.state.recordedNotes) {
      if (recordedNote.endTime === null) {
        recordedNote.endTime = recordedNote.startTime + 1; // Default 1 step
        recordedNote.length = 1;
        this.arrangementStore.addNote(recordedNote);
      }
    }

    console.log('⏹️ Recording stopped');
    this.state.recordedNotes.clear();
  }

  msToSteps(ms) {
    const bpm = this.playbackStore.getCurrentTempo();
    const stepsPerSecond = (bpm / 60) * 4; // 4 steps per beat
    return (ms / 1000) * stepsPerSecond;
  }

  quantizeStep(step, strength) {
    const snapValue = this.arrangementStore.getSnapValue();
    const quantized = Math.round(step / snapValue) * snapValue;
    return step + (quantized - step) * strength;
  }
}
```

#### 3.3. MIDI Recording UI
```javascript
// client/src/features/piano_roll_v7/components/MIDIRecordingPanel.jsx
export const MIDIRecordingPanel = ({ midiRecorder, midiDeviceManager }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordMode, setRecordMode] = useState('replace');
  const [quantizeStrength, setQuantizeStrength] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const devices = Array.from(midiDeviceManager.state.devices.values())
    .filter(d => d.type === 'input');

  const handleStartRecording = () => {
    midiRecorder.startRecording({
      mode: recordMode,
      quantizeStrength,
      countIn: 1 // 1 bar count-in
    });
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    midiRecorder.stopRecording();
    setIsRecording(false);
  };

  return (
    <div className="midi-recording-panel">
      <select onChange={(e) => midiDeviceManager.selectInput(e.target.value)}>
        <option value="">Select MIDI Device...</option>
        {devices.map(device => (
          <option key={device.id} value={device.id}>{device.name}</option>
        ))}
      </select>

      <div className="record-mode">
        <button onClick={() => setRecordMode('replace')}>Replace</button>
        <button onClick={() => setRecordMode('overdub')}>Overdub</button>
      </div>

      <div className="quantize-control">
        <label>Quantize: {Math.round(quantizeStrength * 100)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={quantizeStrength}
          onChange={(e) => setQuantizeStrength(parseFloat(e.target.value))}
        />
      </div>

      {isRecording ? (
        <button onClick={handleStopRecording} className="stop-button">⏹ Stop</button>
      ) : (
        <button onClick={handleStartRecording} className="record-button">⏺ Record</button>
      )}
    </div>
  );
};
```

**Deliverables:**
- ✅ MIDIDeviceManager with Web MIDI API
- ✅ MIDIRecorder with replace/overdub modes
- ✅ Real-time quantization
- ✅ MIDI Recording UI panel
- ✅ Count-in support

---

### ✅ PHASE 4: AUTOMATION SYSTEM (Week 5-7)
**Priority: HIGH** | **Effort: High** | **Impact: HIGH**

#### 4.1. AutomationStore (Single Source of Truth)
```javascript
// client/src/stores/AutomationStore.js
export class AutomationStore {
  state = {
    // Pattern-level automation
    patterns: new Map(), // patternId -> { lanes: Map<laneId, AutomationLane> }

    // Global settings
    settings: {
      defaultInterpolation: 'linear', // 'linear' | 'cubic' | 'step'
      snapToGrid: true,
      showAllLanes: false,
      laneHeight: 100
    }
  };

  // Get or create automation lane
  getAutomationLane(patternId, laneType, ccNumber = null) {
    if (!this.state.patterns.has(patternId)) {
      this.state.patterns.set(patternId, { lanes: new Map() });
    }

    const pattern = this.state.patterns.get(patternId);
    const laneId = ccNumber ? `cc${ccNumber}` : laneType;

    if (!pattern.lanes.has(laneId)) {
      pattern.lanes.set(laneId, new AutomationLane(laneId, laneType, ccNumber));
    }

    return pattern.lanes.get(laneId);
  }

  // Add automation point
  addAutomationPoint(patternId, laneId, position, value) {
    const lane = this.getAutomationLane(patternId, laneId);
    lane.addPoint(position, value);
    this.notifyListeners();
  }
}

class AutomationLane {
  constructor(id, type, ccNumber = null) {
    this.id = id;
    this.type = type; // 'velocity' | 'pitchBend' | 'modWheel' | 'cc' | 'pan'
    this.ccNumber = ccNumber;
    this.points = []; // { position, value }
    this.interpolation = 'linear';
    this.visible = true;
  }

  addPoint(position, value) {
    // Insert in sorted order
    const index = this.points.findIndex(p => p.position > position);
    if (index === -1) {
      this.points.push({ position, value });
    } else {
      this.points.splice(index, 0, { position, value });
    }
  }

  getValueAt(position) {
    if (this.points.length === 0) return 0;
    if (this.points.length === 1) return this.points[0].value;

    // Find surrounding points
    let prevPoint = this.points[0];
    let nextPoint = this.points[this.points.length - 1];

    for (let i = 0; i < this.points.length - 1; i++) {
      if (this.points[i].position <= position && this.points[i + 1].position >= position) {
        prevPoint = this.points[i];
        nextPoint = this.points[i + 1];
        break;
      }
    }

    // Interpolate
    if (this.interpolation === 'step') {
      return prevPoint.value;
    } else if (this.interpolation === 'linear') {
      const t = (position - prevPoint.position) / (nextPoint.position - prevPoint.position);
      return prevPoint.value + (nextPoint.value - prevPoint.value) * t;
    } else if (this.interpolation === 'cubic') {
      // Cubic interpolation (smooth curves)
      const t = (position - prevPoint.position) / (nextPoint.position - prevPoint.position);
      const t2 = t * t;
      const t3 = t2 * t;
      return prevPoint.value * (2 * t3 - 3 * t2 + 1) + nextPoint.value * (-2 * t3 + 3 * t2);
    }
  }
}
```

#### 4.2. AutomationLaneRenderer
```javascript
// client/src/features/piano_roll_v7/renderers/automationRenderer.js
export class AutomationRenderer {
  renderLane(ctx, lane, engine, options = {}) {
    const { height = 100, color = '#3b82f6' } = options;

    ctx.save();

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, engine.viewport.width, height);

    // Draw grid lines
    this.renderGrid(ctx, engine, height);

    // Draw automation curve
    if (lane.points.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      for (let i = 0; i < lane.points.length; i++) {
        const point = lane.points[i];
        const x = engine.stepToPixel(point.position);
        const y = height - (point.value / 127) * height; // Normalize 0-127 to height

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          if (lane.interpolation === 'step') {
            const prevPoint = lane.points[i - 1];
            const prevX = engine.stepToPixel(prevPoint.position);
            const prevY = height - (prevPoint.value / 127) * height;
            ctx.lineTo(x, prevY); // Horizontal
            ctx.lineTo(x, y); // Vertical
          } else {
            ctx.lineTo(x, y);
          }
        }
      }

      ctx.stroke();

      // Draw points
      lane.points.forEach(point => {
        const x = engine.stepToPixel(point.position);
        const y = height - (point.value / 127) * height;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();
  }
}
```

**Deliverables:**
- ✅ AutomationStore with lane management
- ✅ AutomationLane with interpolation
- ✅ AutomationRenderer with curve drawing
- ✅ CC lanes UI (CC1-127)
- ✅ Pitch bend lane
- ✅ Mod wheel lane

---

### ✅ PHASE 5: MUSICAL INTELLIGENCE (Week 7-9)
**Priority: MEDIUM** | **Effort: Medium** | **Impact: HIGH**

#### 5.1. Scale System
```javascript
// client/src/lib/music/ScaleSystem.js
export const SCALES = {
  MAJOR: [0, 2, 4, 5, 7, 9, 11],
  MINOR: [0, 2, 3, 5, 7, 8, 10],
  HARMONIC_MINOR: [0, 2, 3, 5, 7, 8, 11],
  MELODIC_MINOR: [0, 2, 3, 5, 7, 9, 11],
  DORIAN: [0, 2, 3, 5, 7, 9, 10],
  PHRYGIAN: [0, 1, 3, 5, 7, 8, 10],
  LYDIAN: [0, 2, 4, 6, 7, 9, 11],
  MIXOLYDIAN: [0, 2, 4, 5, 7, 9, 10],
  LOCRIAN: [0, 1, 3, 5, 6, 8, 10],
  PENTATONIC_MAJOR: [0, 2, 4, 7, 9],
  PENTATONIC_MINOR: [0, 3, 5, 7, 10],
  BLUES: [0, 3, 5, 6, 7, 10],
  CHROMATIC: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

export class ScaleSystem {
  constructor() {
    this.state = {
      enabled: false,
      rootNote: 60, // C4
      scale: SCALES.MAJOR,
      highlightNotes: true,
      lockToScale: false
    };
  }

  isNoteInScale(pitch) {
    if (!this.state.enabled) return true;

    const pitchClass = pitch % 12;
    const rootClass = this.state.rootNote % 12;
    const relativeNote = (pitchClass - rootClass + 12) % 12;

    return this.state.scale.includes(relativeNote);
  }

  getScaleNotes(octaveStart = 0, octaveEnd = 10) {
    const notes = [];
    for (let octave = octaveStart; octave <= octaveEnd; octave++) {
      this.state.scale.forEach(interval => {
        const pitch = (this.state.rootNote % 12) + interval + (octave * 12);
        if (pitch >= 0 && pitch <= 127) {
          notes.push(pitch);
        }
      });
    }
    return notes.sort((a, b) => a - b);
  }

  snapToScale(pitch) {
    if (!this.state.lockToScale) return pitch;

    const scaleNotes = this.getScaleNotes();

    // Find closest scale note
    let closest = scaleNotes[0];
    let minDistance = Math.abs(pitch - closest);

    for (const note of scaleNotes) {
      const distance = Math.abs(pitch - note);
      if (distance < minDistance) {
        minDistance = distance;
        closest = note;
      }
    }

    return closest;
  }
}
```

#### 5.2. Chord Detection
```javascript
// client/src/lib/music/ChordDetector.js
export const CHORD_TYPES = {
  MAJOR: [0, 4, 7],
  MINOR: [0, 3, 7],
  DIMINISHED: [0, 3, 6],
  AUGMENTED: [0, 4, 8],
  MAJOR_7: [0, 4, 7, 11],
  MINOR_7: [0, 3, 7, 10],
  DOMINANT_7: [0, 4, 7, 10],
  DIMINISHED_7: [0, 3, 6, 9],
  HALF_DIMINISHED_7: [0, 3, 6, 10],
  MINOR_MAJOR_7: [0, 3, 7, 11],
  AUGMENTED_7: [0, 4, 8, 10],
  SUSPENDED_2: [0, 2, 7],
  SUSPENDED_4: [0, 5, 7]
};

export class ChordDetector {
  detectChord(notes) {
    if (notes.length < 2) return null;

    // Get unique pitch classes
    const pitchClasses = [...new Set(notes.map(n => n.pitch % 12))].sort((a, b) => a - b);

    if (pitchClasses.length < 2) return null;

    // Try each note as root
    for (const root of pitchClasses) {
      const intervals = pitchClasses.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b);

      // Match against chord types
      for (const [name, pattern] of Object.entries(CHORD_TYPES)) {
        if (this.arraysEqual(intervals.slice(0, pattern.length), pattern)) {
          return {
            root,
            type: name,
            intervals,
            notes: pitchClasses
          };
        }
      }
    }

    return null;
  }

  arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  suggestNextChord(currentChord, scale) {
    // Common chord progressions
    const progressions = {
      MAJOR: [[0, 4], [0, 5], [0, 3], [4, 5], [5, 0]],
      MINOR: [[0, 3], [0, 5], [0, 6], [3, 6], [5, 0]]
    };

    // Return suggested chords based on music theory
    // Implementation details...
  }
}
```

**Deliverables:**
- ✅ Scale highlighting on piano keyboard
- ✅ Scale lock mode (snap to scale)
- ✅ Chord detection algorithm
- ✅ Chord suggestions UI
- ✅ Scale selector panel

---

### ✅ PHASE 6: ADVANCED EDITING (Week 9-11)
**Priority: MEDIUM** | **Effort: Medium** | **Impact: MEDIUM**

#### 6.1. Advanced Quantize
```javascript
// client/src/lib/editing/AdvancedQuantize.js
export class AdvancedQuantize {
  quantize(notes, options = {}) {
    const {
      strength = 1.0, // 0 = no quantize, 1 = full quantize
      swing = 0, // -1 to 1
      snapValue = 1,
      quantizeLength = false,
      humanize = 0 // 0 = no humanize, 1 = full humanize
    } = options;

    return notes.map(note => {
      let quantizedTime = this.quantizePosition(note.startTime, snapValue, strength, swing);

      // Add humanization (random timing variation)
      if (humanize > 0) {
        const variation = (Math.random() - 0.5) * snapValue * humanize * 0.1;
        quantizedTime += variation;
      }

      let quantizedLength = note.length;
      if (quantizeLength) {
        quantizedLength = this.quantizePosition(note.length, snapValue, strength, 0);
      }

      return {
        ...note,
        startTime: quantizedTime,
        length: Math.max(0.25, quantizedLength)
      };
    });
  }

  quantizePosition(position, snapValue, strength, swing) {
    // Snap to grid
    const snapped = Math.round(position / snapValue) * snapValue;

    // Apply swing (delay even beats)
    let swingAdjusted = snapped;
    if (swing !== 0) {
      const beatPosition = (snapped / snapValue) % 2;
      if (beatPosition === 1) {
        swingAdjusted += swing * snapValue * 0.5;
      }
    }

    // Apply strength (interpolate between original and quantized)
    return position + (swingAdjusted - position) * strength;
  }
}
```

#### 6.2. Humanize Function
```javascript
// client/src/lib/editing/Humanize.js
export class Humanize {
  humanize(notes, options = {}) {
    const {
      timingAmount = 0.1, // Timing variation (0-1)
      velocityAmount = 0.15, // Velocity variation (0-1)
      lengthAmount = 0.05, // Length variation (0-1)
      seed = Date.now() // For reproducible randomization
    } = options;

    const rng = this.createSeededRandom(seed);

    return notes.map(note => {
      // Timing variation
      const timingVariation = (rng() - 0.5) * timingAmount * 0.25; // ±1/16 step max
      const newStartTime = Math.max(0, note.startTime + timingVariation);

      // Velocity variation
      const velocityVariation = (rng() - 0.5) * velocityAmount * 127;
      const newVelocity = Math.max(1, Math.min(127,
        Math.round(note.velocity + velocityVariation)
      ));

      // Length variation
      const lengthVariation = (rng() - 0.5) * lengthAmount * note.length;
      const newLength = Math.max(0.25, note.length + lengthVariation);

      return {
        ...note,
        startTime: newStartTime,
        velocity: newVelocity,
        length: newLength
      };
    });
  }

  createSeededRandom(seed) {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }
}
```

**Deliverables:**
- ✅ Advanced quantize with strength, swing
- ✅ Humanize with timing/velocity/length variation
- ✅ Groove templates system
- ✅ Legato tool (remove overlaps)
- ✅ Strum tool (guitar strumming)

---

## 📝 TESTING STRATEGY

### Unit Tests
- TimelineCoordinateSystem
- ScaleSystem
- ChordDetector
- AdvancedQuantize
- Humanize

### Integration Tests
- MIDI Recording workflow
- Automation lane editing
- Timeline marker management

### Performance Tests
- 1000+ notes rendering
- Real-time MIDI input latency
- Automation curve rendering

---

## 🎯 SUCCESS METRICS

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Timeline Features | 5/10 | 9/10 | 🎯 |
| MIDI Recording | 0/10 | 9/10 | 🎯 |
| Automation | 3/10 | 8/10 | 🎯 |
| Musical Intelligence | 1/10 | 7/10 | 🎯 |
| Advanced Editing | 4/10 | 8/10 | 🎯 |
| **OVERALL** | **5.4/10** | **9.5/10** | 🎯 |

---

## 📅 TIMELINE

- **Week 1-2**: Timeline Infrastructure
- **Week 3**: Timeline Features
- **Week 4-5**: MIDI Recording
- **Week 6-7**: Automation System
- **Week 8-9**: Musical Intelligence
- **Week 10-11**: Advanced Editing
- **Week 12**: Testing, Polish, Documentation

**Total: ~3 months for FL Studio parity**

---

## 🚀 LET'S BUILD!
