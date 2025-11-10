# 🎵 ARRANGEMENT PANEL REDESIGN - MASTER PLAN

## 📋 Vision

Transform the Arrangement Panel into a professional, FL Studio / Ableton-inspired timeline with:
- **Distinct clip types**: Pattern clips (MIDI) vs Audio clips with unique interactions
- **Professional editing**: Fade handles, gain control, time-stretch, split, duplicate
- **Smooth workflow**: Keyboard shortcuts, context menus, smart snapping
- **Visual feedback**: Waveform preview, MIDI note preview, ghost clips
- **Track management**: Color coding, reordering, grouping, automation lanes

---

## 🎯 PHASE 1: CLIP INTERACTION SYSTEM

### 1.1 Pattern Clip (MIDI) Enhancements

**Visual Improvements:**
```javascript
// Pattern clip should show:
- Piano roll mini-preview (note blocks)
- Note range indicator (lowest/highest note)
- Pattern name overlay
- Instrument icon/color
- Loop count indicator
```

**Interactions:**
- **Double-click** → Open in Piano Roll
- **Right edge drag** → Loop/repeat pattern
- **Left edge drag** → Trim start
- **Middle drag** → Move to different track/time
- **Alt + drag** → Duplicate
- **Shift + drag** → Quantize-snap off
- **Right-click** → Context menu

**Context Menu:**
```
- Edit in Piano Roll
- Duplicate
- Split at cursor
- Convert to Audio
- Change color
- Mute
- Delete
```

---

### 1.2 Audio Clip Enhancements

**Visual Improvements:**
```javascript
// Audio clip should show:
- Waveform preview (optimized LOD)
- Fade in/out curves (visual)
- Gain level indicator
- Time-stretch indicator (if rate ≠ 1.0)
- Clip name overlay
```

**Unique Handles:**
```
┌─────────────────────────┐
│ ┏━━━━━━━━━━━━━━━━━━┓ │  ← Gain handle (top-right)
│ ┃  Waveform       ┃ │
│ ┃                 ┃ │
│ ┗━━━━━━━━━━━━━━━━━━┛ │
└─▲─────────────────────▲─┘
  │                     │
Fade In              Fade Out
handle              handle
```

**Interactions:**
- **Top-left handle** → Fade in duration
- **Top-right handle** → Fade out duration
- **Bottom-right handle** → Gain adjustment
- **Left edge + Alt** → Time-stretch left
- **Right edge + Alt** → Time-stretch right
- **Left edge** → Trim start (sample offset)
- **Right edge** → Trim end
- **Middle drag** → Move
- **Double-click** → Open in Sample Editor
- **Right-click** → Context menu

**Context Menu:**
```
- Edit in Sample Editor
- Reverse
- Normalize
- Fade In/Out
- Time Stretch...
- Pitch Shift...
- Convert to MIDI (experimental)
- Duplicate
- Split at cursor
- Change color
- Mute
- Delete
```

---

## 🎯 PHASE 2: SELECTION & MANIPULATION

### 2.1 Selection Modes

**Marquee Selection:**
```javascript
// Click + drag empty area → Marquee box
// All clips inside box → Selected
// Shift + marquee → Add to selection
// Ctrl + marquee → Remove from selection
```

**Lasso Selection:**
```javascript
// Alt + Click + drag → Free-form lasso
// Useful for complex selections
```

**Range Selection:**
```javascript
// Top timeline drag → Select time range
// All clips in range → Selected
// Can apply actions to range (delete, copy, etc.)
```

### 2.2 Multi-Clip Operations

**Keyboard Shortcuts:**
```
Ctrl + C   → Copy selected clips
Ctrl + V   → Paste at cursor
Ctrl + D   → Duplicate (copy + paste after)
Ctrl + X   → Cut
Delete     → Delete selected
Ctrl + A   → Select all
Ctrl + Z   → Undo
Ctrl + Y   → Redo

Alt + Drag → Duplicate while dragging
Shift + Drag → Lock to current track (horizontal only)
```

**Group Operations:**
```javascript
// When multiple clips selected:
- Drag one → All move together
- Delete one → All delete (with confirmation)
- Color change → All change color
- Fade In/Out → All get same fade
```

---

## 🎯 PHASE 3: TRACK MANAGEMENT

### 3.1 Track Header Redesign

**New Track Header Layout:**
```
┌────────────────────────────────┐
│ [M][S] Track 1          [▼]   │  ← Mute, Solo, Name, Menu
│ ▓▓▓▓▓▓▓▓▓▓                    │  ← Volume slider
│ ◄─────●─────►                 │  ← Pan slider
└────────────────────────────────┘
```

**Features:**
- **Drag track header** → Reorder tracks
- **Double-click name** → Rename
- **Color swatch** → Change color
- **Track menu (▼)** → Advanced options

**Track Menu:**
```
- Rename
- Change color
- Duplicate track
- Insert track above/below
- Delete track
- Add automation lane
- Freeze track
- Group with...
```

### 3.2 Track Types

**Different track behaviors:**
```javascript
{
  type: 'instrument',  // MIDI/Pattern clips only
  type: 'audio',       // Audio clips only
  type: 'hybrid',      // Both (default)
  type: 'automation',  // Automation lane
  type: 'group',       // Folder track
}
```

---

## 🎯 PHASE 4: TIMELINE ENHANCEMENTS

### 4.1 Grid & Snap Improvements

**Smart Snapping:**
```javascript
// Snap targets (priority order):
1. Bar lines (highest priority)
2. Beat lines
3. Grid subdivision
4. Clip edges (magnetic snap)
5. Loop markers
6. Cursor position
```

**Snap Modes:**
```
- Snap to Grid (default)
- Snap to Events (clip edges)
- Relative Snap (maintain offset)
- No Snap (Shift held)
```

### 4.2 Playback Integration

**Timeline Cursor:**
- **Click timeline** → Jump to position
- **Drag playhead** → Scrub audio
- **Space** → Play/Pause
- **Enter** → Play from cursor
- **L** → Toggle loop

**Loop Region:**
```
┌─────────────────────────────────────┐
│         [======LOOP======]         │  ← Drag edges to set loop
└─────────────────────────────────────┘
```

---

## 🎯 PHASE 5: VISUAL IMPROVEMENTS

### 5.1 Waveform Rendering

**LOD System:**
```javascript
// Zoom level 1 (far out):  Simple envelope
// Zoom level 2 (medium):   Peak waveform (1 sample per pixel)
// Zoom level 3 (zoomed):   Full waveform
// Zoom level 4 (max):      Individual samples
```

**Color Coding:**
```javascript
// Waveform intensity based on amplitude
const color = `rgba(${clipColor}, ${amplitude})`;

// Clipping detection (red highlight)
if (sample > 0.95) color = 'rgba(255, 0, 0, 0.8)';
```

### 5.2 MIDI Preview

**Pattern Clip Mini-Roll:**
```
┌──────────────────────┐
│ ████  ██  ████       │  ← Note blocks (simplified)
│   ██      ██  ██     │
│      ████       ████ │
└──────────────────────┘
```

**Note Range Indicator:**
```
High ┤ ─
     │
     │ ████████  ← Notes visualization
     │
Low  ┤ ─
```

---

## 🎯 PHASE 6: CONTEXT MENUS & MODALS

### 6.1 Right-Click Context Menu

**Clip Context Menu:**
```jsx
<ContextMenu x={mouseX} y={mouseY}>
  <MenuItem onClick={handleEdit}>
    {clip.type === 'pattern' ? 'Edit in Piano Roll' : 'Edit in Sample Editor'}
  </MenuItem>
  <MenuDivider />
  <MenuItem onClick={handleDuplicate}>Duplicate</MenuItem>
  <MenuItem onClick={handleSplit}>Split at Cursor</MenuItem>
  <MenuItem onClick={handleReverse} disabled={clip.type !== 'audio'}>
    Reverse
  </MenuItem>
  <MenuDivider />
  <MenuItem onClick={handleColor}>Change Color...</MenuItem>
  <MenuItem onClick={handleMute}>Mute</MenuItem>
  <MenuDivider />
  <MenuItem onClick={handleDelete} destructive>Delete</MenuItem>
</ContextMenu>
```

### 6.2 Clip Properties Panel

**Right sidebar (when clip selected):**
```
┌─────────────────────────┐
│ CLIP PROPERTIES         │
├─────────────────────────┤
│ Name: [Kick Loop     ]  │
│ Color: [🎨]             │
│ Start: [1.0.0]          │
│ Length: [4 bars]        │
├─────────────────────────┤
│ Audio Properties:       │
│ Fade In: [0.1 s]   ▓▓▓  │
│ Fade Out: [0.2 s]  ▓▓▓  │
│ Gain: [+0.0 dB]    ▓▓▓  │
│ Rate: [100%]       ▓▓▓  │
│ Pitch: [0 st]      ▓▓▓  │
└─────────────────────────┘
```

---

## 🎯 IMPLEMENTATION PRIORITY

### 🔴 HIGH PRIORITY (Week 1)
1. ✅ Audio clip fade handles (visual + interaction)
2. ✅ Pattern clip mini-preview
3. ✅ Clip context menu system
4. ✅ Selection system (marquee, multi-select)
5. ✅ Keyboard shortcuts (copy, paste, duplicate, delete)

### 🟡 MEDIUM PRIORITY (Week 2)
6. Track header redesign (drag to reorder)
7. Waveform LOD rendering
8. Clip properties panel
9. Smart snapping improvements
10. Timeline scrubbing

### 🟢 LOW PRIORITY (Week 3+)
11. Automation lanes
12. Track grouping
13. Lasso selection
14. Time-stretch modal
15. Advanced MIDI preview

---

## 📁 FILE STRUCTURE

```
/features/arrangement_workspace/
├── ArrangementCanvas.jsx              (Main canvas - refactor)
├── components/
│   ├── ClipRenderer/
│   │   ├── PatternClip.jsx           (NEW: MIDI clip rendering)
│   │   ├── AudioClip.jsx             (NEW: Audio clip rendering)
│   │   ├── ClipHandles.jsx           (NEW: Fade/Gain handles)
│   │   └── ClipContextMenu.jsx       (NEW: Right-click menu)
│   ├── TrackHeader/
│   │   ├── TrackHeader.jsx           (REFACTOR: Enhanced header)
│   │   ├── TrackMenu.jsx             (NEW: Track options menu)
│   │   └── TrackColorPicker.jsx      (NEW: Color picker)
│   ├── Timeline/
│   │   ├── TimelineRuler.jsx         (REFACTOR: Click to jump)
│   │   ├── PlayheadCursor.jsx        (REFACTOR: Draggable scrub)
│   │   └── LoopRegion.jsx            (NEW: Loop markers)
│   └── ClipPropertiesPanel.jsx       (NEW: Right sidebar)
├── hooks/
│   ├── useClipInteraction.js         (REFACTOR: Unified clip logic)
│   ├── useSelection.js               (NEW: Selection state)
│   ├── useClipboard.js               (NEW: Copy/paste)
│   └── useKeyboardShortcuts.js       (NEW: Keyboard bindings)
├── renderers/
│   ├── waveformRenderer.js           (NEW: LOD waveform)
│   ├── midiPreviewRenderer.js        (NEW: MIDI mini-roll)
│   └── handleRenderer.js             (NEW: Fade/Gain handles)
└── utils/
    ├── clipUtils.js                  (NEW: Clip operations)
    ├── timeUtils.js                  (Existing: Enhanced)
    └── snapUtils.js                  (NEW: Smart snapping)
```

---

## 🎨 DESIGN REFERENCES

**Inspired by:**
- **FL Studio**: Pattern clips, piano roll integration
- **Ableton Live**: Session view, clip launching
- **Logic Pro**: Smart Tempo, Flex Time
- **Reaper**: Customizable actions, efficiency

**Unique DAWG Features:**
- Pattern Library drag & drop
- Real-time MIDI preview in clips
- Integrated sample editor
- Zenith theme aesthetic

---

## ✅ SUCCESS CRITERIA

1. **Clip interactions feel natural** (no lag, smooth preview)
2. **Audio clips have all expected features** (fade, gain, stretch)
3. **Pattern clips show meaningful preview** (notes visible)
4. **Selection system is intuitive** (marquee, multi-select work)
5. **Keyboard shortcuts accelerate workflow** (copy/paste/duplicate)
6. **Track management is effortless** (drag to reorder, easy rename)
7. **Context menus provide quick access** (right-click works everywhere)
8. **Timeline navigation is smooth** (click to jump, drag to scrub)

---

## 🚀 LET'S START!

**First Task:** Implement **Audio Clip Fade Handles** and **Pattern Clip Mini-Preview**

Shall we begin? 🎵
