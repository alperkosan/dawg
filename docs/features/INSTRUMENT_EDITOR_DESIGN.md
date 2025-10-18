# Instrument Editor Panel - Design Document

## Overview

Comprehensive instrument editor panel system that replaces Sample Editor when clicking on Channel Rack instruments. Each instrument type gets a custom-designed editor UI with real-time parameter control and visualization.

## Architecture

### Panel System
```
┌─────────────────────────────────────────────────────────┐
│ INSTRUMENT EDITOR PANEL                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Header: [Icon] Piano (Sampled) - Track 6      [×]   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Dynamic Editor Content (switches based on type)     │ │
│ │ - VASynthEditor                                     │ │
│ │ - MultiSampleEditor                                 │ │
│ │ - DrumSamplerEditor                                 │ │
│ │ - ForgeSynthEditor                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Footer: Preset Browser / Save / Initialize          │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Component Hierarchy
```
InstrumentEditorPanel (Container)
├── InstrumentEditorHeader
├── EditorRouter (switches based on instrument type)
│   ├── VASynthEditor (for type: 'vasynth')
│   ├── MultiSampleEditor (for type: 'sample' + multiSamples)
│   ├── DrumSamplerEditor (for type: 'sample' + single sample)
│   └── ForgeSynthEditor (for type: 'synth')
└── InstrumentEditorFooter
```

## Editor Types & UI Design

### 1. VASynthEditor (Virtual Analog Synth)

**Layout: Serum/Vital-inspired**
```
┌──────────────────────────────────────────────────────────┐
│ OSCILLATORS                                              │
│ ┌────────────┬────────────┬────────────┐                │
│ │   OSC 1    │   OSC 2    │   OSC 3    │                │
│ │ [Waveform] │ [Waveform] │ [Waveform] │                │
│ │  Sawtooth  │  Triangle  │   Sine     │                │
│ │                                       │                │
│ │  Detune: -3.0   +2.0      +0.0        │                │
│ │  Octave:   0      0        +1         │                │
│ │  Level:  [████░] [███░░] [██░░░]      │                │
│ └────────────┴────────────┴────────────┘                │
│                                                          │
│ FILTER                                                   │
│ ┌──────────────────────────────────────────────────────┐│
│ │  Type: [Lowpass ▼]  Cutoff: [═══════●═] 2400 Hz     ││
│ │  Resonance: [═══●═════] 2.5    Envelope: [═══●════] ││
│ │                                                      ││
│ │  Filter Envelope (ADSR)                             ││
│ │  A:[═●═] D:[══●] S:[════●] R:[═══●]                 ││
│ └──────────────────────────────────────────────────────┘│
│                                                          │
│ AMPLITUDE                                                │
│ ┌──────────────────────────────────────────────────────┐│
│ │  Amp Envelope (ADSR)                                 ││
│ │  Attack:[═●═] Decay:[══●] Sustain:[════●] Release:[═●]│
│ │  [Visual ADSR Curve Graph]                           ││
│ └──────────────────────────────────────────────────────┘│
│                                                          │
│ LFO & MODULATION                                         │
│ ┌──────────────────────────────────────────────────────┐│
│ │  LFO Rate: [═══●══] 4 Hz    Waveform: [Sine ▼]      ││
│ │  Destinations: Filter Cutoff [████░] Pitch [█░░░░]   ││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Features:**
- Real-time waveform visualization
- Visual ADSR envelope curves
- Oscilloscope showing output waveform
- Drag-and-drop modulation routing

### 2. MultiSampleEditor (Sampled Instruments)

**Layout: Kontakt-inspired**
```
┌──────────────────────────────────────────────────────────┐
│ SAMPLE MAPPING                                           │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Piano Keyboard (88 keys)                             │ │
│ │ C1──C2──C3──[C4]─C5──C6──C7──C8                      │ │
│ │ ▓▓▓▓░░░░████░░░░████████████░░░░░░░░                 │ │
│ │  └─ Sample Regions (color-coded by octave)           │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ SAMPLE LIST                                              │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ✓ piano_c1.ogg   | C1 (MIDI 24)  | 118 KB | [Play]  │ │
│ │ ✓ piano_c2.ogg   | C2 (MIDI 36)  | 117 KB | [Play]  │ │
│ │ ✓ piano_c3.ogg   | C3 (MIDI 48)  | 125 KB | [Play]  │ │
│ │ ✓ piano_c4.ogg   | C4 (MIDI 60)  | 117 KB | [Play]  │ │
│ │ ✓ piano_c5.ogg   | C5 (MIDI 72)  |  80 KB | [Play]  │ │
│ │ ✓ piano_c6.ogg   | C6 (MIDI 84)  |  55 KB | [Play]  │ │
│ │ ✓ piano_c7.ogg   | C7 (MIDI 96)  |  42 KB | [Play]  │ │
│ │ ✓ piano_c8.ogg   | C8 (MIDI 108) |  21 KB | [Play]  │ │
│ │                                           [+ Add Sample]│ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ SAMPLE PROPERTIES (Selected: piano_c4.ogg)               │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Waveform: [██████████████████████████████]           │ │
│ │                                                      │ │
│ │ Root Note: [C4 ▼]  Fine Tune: [═══●════] +0.0 cents │ │
│ │ Volume:    [═════●══] -2.0 dB                        │ │
│ │ Pan:       [════●════]  0.0 (Center)                 │ │
│ │                                                      │ │
│ │ Loop:  [ ] Enable   Start: 0  End: 44100            │ │
│ │ ADSR:  A:[═●] D:[══●] S:[════●] R:[══●]              │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Features:**
- Visual keyboard mapping with sample regions
- Waveform display for selected sample
- Drag-and-drop sample loading
- Sample cache statistics
- MIDI learn for root note detection

### 3. DrumSamplerEditor (One-Shot Samples)

**Layout: Simple & focused**
```
┌──────────────────────────────────────────────────────────┐
│ KICK                                                     │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ [Waveform Display]                                   │ │
│ │ ████████████████░░░░░░░░░░░░                         │ │
│ │ kick.wav - 44.1kHz, 16-bit, Stereo, 1.2s            │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌────────────────┬────────────────┬───────────────────┐ │
│ │ PLAYBACK       │ ENVELOPE       │ FX                │ │
│ │                │                │                   │ │
│ │ Pitch:         │ Attack:  [═●═] │ Distortion: [█░░] │ │
│ │ [═════●════]   │ Decay:   [══●] │ Filter:     [██░] │ │
│ │ +0.0 semitones │ Sustain: [═══] │ Reverb:     [░░░] │ │
│ │                │ Release: [═●═] │                   │ │
│ │ Volume:        │                │ Compression: [██░]│ │
│ │ [═══════●══]   │ [ADSR Curve]   │                   │ │
│ │ -3.0 dB        │                │                   │ │
│ │                │                │                   │ │
│ │ Pan:           │                │                   │ │
│ │ [═════●═════]  │                │                   │ │
│ │ Center         │                │                   │ │
│ └────────────────┴────────────────┴───────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ [Load Sample] [Replace] [Export]        [▶ Preview]  │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Features:**
- Large waveform display
- Simple pitch/volume/pan controls
- Built-in ADSR envelope
- Quick preview button
- Drag-and-drop sample replacement

### 4. ForgeSynthEditor (Legacy Synth)

**Layout: Compact modular**
```
┌──────────────────────────────────────────────────────────┐
│ OSCILLATOR                                               │
│ Type: [FatSawtooth ▼]  Detune: [══●══] +5.0 cents       │
│                                                          │
│ FILTER                                                   │
│ Type: [Lowpass ▼]  Freq: [═════●══] 800 Hz  Q: [══●═]   │
│                                                          │
│ ENVELOPE                                                 │
│ Attack:[═●══] Decay:[═●═] Sustain:[═══●] Release:[══●═] │
│                                                          │
│ MODULATION                                               │
│ ┌────────────────────────────────────────────────────┐  │
│ │ LFO 1 → Filter Freq   Amount: [═══●══]            │  │
│ │ LFO 2 → Pan           Amount: [═●════]            │  │
│ │ Env   → Filter Freq   Amount: [═════●]            │  │
│ └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Design System

### Colors (Zenith Dark Theme)
```css
--editor-bg: #1a1a1a
--panel-bg: #252525
--section-bg: #2a2a2a
--border: #3a3a3a
--text: #e0e0e0
--text-dim: #888888
--accent-blue: #6B8EBF (synths)
--accent-purple: #7A6BA8 (bass)
--accent-pink: #B67BA3 (leads)
--accent-green: #5A9B82 (pads)
--accent-orange: #D4A259 (drums)
```

### Component Specs

#### Knob Control
- Size: 48x48px (small), 64x64px (medium), 80x80px (large)
- Arc indicator (270° travel)
- Value label below
- Double-click to reset
- Scroll wheel support

#### Slider Control
- Height: 24px
- Track: 2px solid line
- Thumb: 12px circle
- Hover highlight
- Snap to default on Alt+Click

#### Waveform Display
- Canvas-based rendering
- 60 FPS animation
- Zoom controls
- Time ruler
- Loop markers

#### ADSR Envelope Visualizer
- SVG-based curve drawing
- Draggable breakpoints
- Grid background
- Time/level labels
- Real-time preview

## State Management

### Store: useInstrumentEditorStore
```javascript
{
  isOpen: boolean,
  instrumentId: string | null,
  instrumentType: 'vasynth' | 'sample' | 'synth',
  activeTab: 'main' | 'effects' | 'modulation',
  isDirty: boolean, // unsaved changes
  previewNote: string | null, // currently previewing
}
```

### Actions
- `openEditor(instrumentId)` - Open editor for instrument
- `closeEditor()` - Close editor
- `updateParameter(path, value)` - Real-time parameter update
- `savePreset(name)` - Save current state as preset
- `loadPreset(name)` - Load preset
- `previewNote(pitch)` - Preview sound
- `exportInstrument()` - Export to file

## Integration Points

### Channel Rack
```javascript
// ChannelRackRow.jsx
const handleChannelClick = (instrumentId) => {
  const instrument = useInstrumentsStore.getState().getInstrument(instrumentId);
  useInstrumentEditorStore.getState().openEditor(instrumentId);
  // Panel slides in from right
};
```

### Panel Placement
- Replaces current panel system (Sample Editor location)
- Full-height right panel
- Slide-in animation (300ms ease-out)
- Backdrop blur effect
- ESC key to close

## Development Phases

### Phase 1: Foundation (Current)
- [ ] Create InstrumentEditorPanel container
- [ ] Create useInstrumentEditorStore
- [ ] Implement panel routing system
- [ ] Add Channel Rack integration

### Phase 2: VASynth Editor
- [ ] Oscillator section with waveform selector
- [ ] Filter section with cutoff/resonance
- [ ] ADSR envelope visualizer
- [ ] Real-time parameter binding

### Phase 3: Sample Editors
- [ ] MultiSampleEditor with keyboard mapping
- [ ] DrumSamplerEditor with waveform display
- [ ] Sample loading/preview system

### Phase 4: Polish
- [ ] Preset browser
- [ ] Undo/redo for parameters
- [ ] Keyboard shortcuts
- [ ] Touch/gesture support

## Technical Notes

### Performance
- Use React.memo for expensive components
- Debounce parameter updates (16ms for 60fps feel)
- Canvas rendering for waveforms
- Web Workers for waveform analysis

### Accessibility
- Keyboard navigation (Tab, Arrow keys)
- Screen reader labels
- Focus indicators
- Tooltip descriptions

### Audio Preview
- Use existing preview system
- Lock preview to current instrument
- MIDI keyboard input support
- Computer keyboard octave (QWERTY = C-B)

## File Structure
```
src/features/instrument_editor/
├── InstrumentEditorPanel.jsx         # Main container
├── components/
│   ├── InstrumentEditorHeader.jsx
│   ├── InstrumentEditorFooter.jsx
│   ├── editors/
│   │   ├── VASynthEditor.jsx
│   │   ├── MultiSampleEditor.jsx
│   │   ├── DrumSamplerEditor.jsx
│   │   └── ForgeSynthEditor.jsx
│   ├── controls/
│   │   ├── Knob.jsx
│   │   ├── Slider.jsx
│   │   ├── WaveformDisplay.jsx
│   │   ├── ADSREnvelope.jsx
│   │   └── KeyboardMapping.jsx
│   └── sections/
│       ├── OscillatorSection.jsx
│       ├── FilterSection.jsx
│       ├── EnvelopeSection.jsx
│       └── ModulationSection.jsx
├── hooks/
│   ├── useInstrumentEditor.js
│   ├── useParameterUpdate.js
│   └── useAudioPreview.js
├── store/
│   └── useInstrumentEditorStore.js
└── InstrumentEditor.css
```

## Next Steps
1. Create base panel structure
2. Implement store and routing
3. Build reusable control components (Knob, Slider, etc.)
4. Implement VASynthEditor (most complex)
5. Add MultiSampleEditor
6. Polish and optimize
