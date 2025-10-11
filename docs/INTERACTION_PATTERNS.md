# 🎯 Interaction Patterns - Reusable Design for DAW UI

This document describes the interaction patterns implemented in ArrangementV2 that can be reused in Piano Roll and other timeline-based editors.

## 📋 Table of Contents

1. [Interaction Hierarchy](#interaction-hierarchy)
2. [State Machine](#state-machine)
3. [Selection System](#selection-system)
4. [Drag & Drop System](#drag--drop-system)
5. [Implementation Checklist](#implementation-checklist)

---

## 🎪 Interaction Hierarchy

**Priority Order (High → Low):**

```
1. Resize handles (small, precise hit areas)
   ├─ Left edge: Adjust start time
   └─ Right edge: Adjust duration

2. Fade handles (audio clips only)
   ├─ Fade in: Top-left corner
   └─ Fade out: Top-right corner

3. Clip body drag (move clips)
   └─ Full clip area for drag

4. Empty space
   └─ Marquee selection

5. Pan (middle mouse button)
   └─ Handled by viewport system
```

**Why this order?**
- Small, precise areas have highest priority (resize handles)
- Larger areas have lower priority (clip body)
- This prevents accidental resizing when trying to drag

---

## 🔄 State Machine

### States

```javascript
interactionState = {
  mode: 'idle' | 'dragging' | 'resizing' | 'fading' | 'marquee',

  // Drag state
  draggedClipIds: [],
  dragStartCanvasX: 0,
  dragStartCanvasY: 0,
  dragStartScreenX: 0,
  dragStartScreenY: 0,
  originalClipStates: new Map(),
  hasMoved: false,

  // Marquee state
  marqueeStartX: 0,
  marqueeStartY: 0
}
```

### State Transitions

```
IDLE
  ├─ MouseDown on clip → DRAGGING (potential)
  ├─ MouseDown on resize handle → RESIZING
  ├─ MouseDown on fade handle → FADING
  └─ MouseDown on empty space → MARQUEE

DRAGGING / RESIZING / FADING / MARQUEE
  ├─ MouseMove → Update ghost visuals
  ├─ MouseUp → Commit changes → IDLE
  ├─ Escape → Cancel → IDLE
  └─ MouseLeave → Cancel → IDLE
```

---

## ✅ Selection System

### Click Behaviors

| Action | Behavior | Use Case |
|--------|----------|----------|
| **Click** | Select single clip | Basic selection |
| **Shift+Click** | Add to selection | Build selection |
| **Ctrl/Cmd+Click** | Toggle selection | Fine-tune selection |
| **Drag empty space** | Marquee selection | Select multiple clips |
| **Shift+Marquee** | Add to selection | Extend selection |

### Selection Code Pattern

```javascript
const handleMouseDown = (e, clickedClip) => {
  const isShiftHeld = e.shiftKey;
  const isCtrlHeld = e.ctrlKey || e.metaKey;

  if (clickedClip) {
    if (isCtrlHeld) {
      toggleSelection(clickedClip.id);
      return; // Don't start drag on Ctrl+Click
    } else if (isShiftHeld) {
      if (!selectedIds.includes(clickedClip.id)) {
        addToSelection(clickedClip.id);
      }
      return; // Don't start drag on Shift+Click
    } else {
      // Regular click
      if (!selectedIds.includes(clickedClip.id)) {
        setSelection(clickedClip.id);
      }
    }

    // Start potential drag
    startDrag(clickedClip.id, ...);
  }
};
```

### ⚠️ Critical Bug Fix: Selection + Drag Timing

**Problem:** When clicking a new clip, selection updates asynchronously, causing drag to use old selection.

**Solution:** Pass clicked clip ID directly to `startDrag`:

```javascript
const startDrag = (clickedClipId, canvasX, canvasY, screenX, screenY) => {
  // Determine drag set based on current selection state
  let clipsToDrag;
  if (selectedIds.includes(clickedClipId)) {
    // Clicked clip already selected → drag all selected
    clipsToDrag = selectedIds;
  } else {
    // Clicked clip not selected → drag only this clip
    // (selection will update in next render)
    clipsToDrag = [clickedClipId];
  }

  // Store original positions
  const originalStates = new Map();
  clipsToDrag.forEach(id => {
    const item = items.find(i => i.id === id);
    originalStates.set(id, { ...item });
  });

  state.mode = 'dragging';
  state.draggedItemIds = clipsToDrag;
  state.originalStates = originalStates;
  state.hasMoved = false;
};
```

---

## 🎯 Drag & Drop System

### Drag Threshold

**Why:** Prevent accidental drags when user just wants to click.

```javascript
const DRAG_THRESHOLD = 3; // pixels

const updateDrag = (canvasX, canvasY, screenX, screenY) => {
  // Check if threshold exceeded
  const dx = screenX - state.dragStartScreenX;
  const dy = screenY - state.dragStartScreenY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (!state.hasMoved && distance < DRAG_THRESHOLD) {
    return; // Don't show ghost until threshold exceeded
  }

  state.hasMoved = true;
  // Continue with drag logic...
};
```

### Snap to Grid

```javascript
const updateDrag = (canvasX, canvasY, screenX, screenY) => {
  // Calculate delta
  const deltaBeats = (canvasX - state.dragStartCanvasX) / pixelsPerBeat;

  // Apply to original positions
  ghosts = state.draggedItemIds.map(id => {
    const original = state.originalStates.get(id);
    let newTime = original.startTime + deltaBeats;

    // Snap to grid
    newTime = snapToGrid(newTime, snapSize);

    // Clamp bounds
    newTime = Math.max(0, newTime);

    return { id, newTime, ... };
  });

  setDragGhosts(ghosts);
};
```

### Ghost Visualization

```javascript
// Draw semi-transparent ghosts during drag
dragGhosts.forEach(ghost => {
  const x = ghost.x - scrollX;
  const y = ghost.y - scrollY;

  // Ghost fill
  ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
  ctx.fillRect(x, y, ghost.width, ghost.height);

  // Dashed border
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x, y, ghost.width, ghost.height);
  ctx.setLineDash([]);

  // Item name
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText(ghost.name, x + 8, y + 6);
});
```

### Commit vs Cancel

```javascript
const handleMouseUp = () => {
  if (state.mode === 'dragging') {
    if (!state.hasMoved) {
      // Drag threshold not exceeded → treat as click
      state.mode = 'idle';
      setDragGhosts(null);
      return;
    }

    // Commit changes
    dragGhosts.forEach(ghost => {
      updateItem(ghost.id, {
        startTime: ghost.newTime,
        trackId: ghost.newTrackId
      });
    });

    state.mode = 'idle';
    setDragGhosts(null);
  }
};

const handleEscape = () => {
  if (state.mode === 'dragging') {
    // Cancel drag, restore original positions
    state.mode = 'idle';
    setDragGhosts(null);
  }
};
```

---

## 📏 Resize System

### Overview

Resize handles allow users to adjust the start time and duration of clips/notes. Handles have the highest interaction priority due to their small hit areas.

### Constants

```javascript
const RESIZE_HANDLE_WIDTH = 8; // Pixels for resize handle hit area
const MIN_CLIP_DURATION = 0.25; // Minimum duration in beats (1/16 note)
```

### State Machine Integration

Add resize state to your interaction state:

```javascript
interactionState = {
  mode: 'idle', // 'idle' | 'dragging' | 'resizing' | 'marquee'

  // Resize state
  resizingClipId: null,
  resizeHandle: null, // 'left' | 'right'
  resizeStartCanvasX: 0,
  resizeStartScreenX: 0,
  originalClipState: null,
};
```

Add resize visual feedback state:

```javascript
const [hoveredHandle, setHoveredHandle] = useState(null); // { clipId, handle }
const [resizeGhost, setResizeGhost] = useState(null); // Ghost visualization
```

### Handle Detection (Priority 1)

```javascript
const findResizeHandleAtPosition = useCallback((canvasX, canvasY) => {
  // Find track and clip at position
  const trackIndex = Math.floor(canvasY / trackHeight);
  if (trackIndex < 0 || trackIndex >= tracks.length) return null;

  const track = tracks[trackIndex];
  const clipsInTrack = clips.filter(c => c.trackId === track.id);

  for (const clip of clipsInTrack) {
    const clipStartX = clip.startTime * PIXELS_PER_BEAT * zoomX;
    const clipWidth = clip.duration * PIXELS_PER_BEAT * zoomX;
    const clipEndX = clipStartX + clipWidth;

    // Check left handle (first 8px)
    if (canvasX >= clipStartX && canvasX <= clipStartX + RESIZE_HANDLE_WIDTH) {
      return { clip, handle: 'left' };
    }

    // Check right handle (last 8px)
    if (canvasX >= clipEndX - RESIZE_HANDLE_WIDTH && canvasX <= clipEndX) {
      return { clip, handle: 'right' };
    }
  }

  return null;
}, [tracks, clips, zoomX]);
```

### Resize Operations

**Start Resize:**

```javascript
const startResize = useCallback((clip, handle, canvasX, screenX) => {
  const state = interactionStateRef.current;

  state.mode = 'resizing';
  state.resizingClipId = clip.id;
  state.resizeHandle = handle;
  state.resizeStartCanvasX = canvasX;
  state.resizeStartScreenX = screenX;
  state.originalClipState = {
    startTime: clip.startTime,
    duration: clip.duration
  };

  console.log(`Started resizing ${handle} handle of clip ${clip.id}`);
}, []);
```

**Update Resize:**

```javascript
const updateResize = useCallback((canvasX, screenX) => {
  const state = interactionStateRef.current;
  if (state.mode !== 'resizing') return;

  const clip = clips.find(c => c.id === state.resizingClipId);
  if (!clip) return;

  // Drag threshold (3px)
  const dx = screenX - state.resizeStartScreenX;
  if (Math.abs(dx) < DRAG_THRESHOLD) return;

  const original = state.originalClipState;
  const deltaCanvasX = canvasX - state.resizeStartCanvasX;
  const deltaBeats = deltaCanvasX / (PIXELS_PER_BEAT * zoomX);

  let newStartTime = original.startTime;
  let newDuration = original.duration;

  if (state.resizeHandle === 'left') {
    // Left handle: Adjust start time and duration
    newStartTime = snapToGrid(original.startTime + deltaBeats, snapSize);
    newDuration = original.startTime + original.duration - newStartTime;

    // Constraints
    if (newStartTime < 0) {
      newStartTime = 0;
      newDuration = original.startTime + original.duration;
    }
    if (newDuration < MIN_CLIP_DURATION) {
      newDuration = MIN_CLIP_DURATION;
      newStartTime = original.startTime + original.duration - MIN_CLIP_DURATION;
    }
  } else {
    // Right handle: Adjust duration only
    newDuration = original.duration + deltaBeats;
    const endTime = snapToGrid(newStartTime + newDuration, snapSize);
    newDuration = endTime - newStartTime;

    if (newDuration < MIN_CLIP_DURATION) {
      newDuration = MIN_CLIP_DURATION;
    }
  }

  // Generate ghost visualization
  const worldX = newStartTime * PIXELS_PER_BEAT * zoomX;
  const width = newDuration * PIXELS_PER_BEAT * zoomX;
  const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
  const worldY = trackIndex * trackHeight;

  setResizeGhost({
    x: worldX,
    y: worldY,
    width,
    height: trackHeight,
    startTime: newStartTime,
    duration: newDuration,
    clip
  });
}, [clips, tracks, zoomX, snapSize]);
```

**Commit Resize:**

```javascript
const commitResize = useCallback(() => {
  const state = interactionStateRef.current;
  if (state.mode !== 'resizing' || !resizeGhost) {
    state.mode = 'idle';
    setResizeGhost(null);
    return;
  }

  // Apply resize to clip
  updateClip(state.resizingClipId, {
    startTime: resizeGhost.startTime,
    duration: resizeGhost.duration
  });

  console.log(`Committed resize: ${resizeGhost.startTime} → ${resizeGhost.duration} beats`);

  // Reset state
  state.mode = 'idle';
  state.resizingClipId = null;
  state.resizeHandle = null;
  state.originalClipState = null;
  setResizeGhost(null);
}, [resizeGhost, updateClip]);
```

**Cancel Resize:**

```javascript
const cancelResize = useCallback(() => {
  const state = interactionStateRef.current;
  if (state.mode !== 'resizing') return;

  console.log('Cancelled resize');

  state.mode = 'idle';
  state.resizingClipId = null;
  state.resizeHandle = null;
  state.originalClipState = null;
  setResizeGhost(null);
}, []);
```

### Event Handler Integration

**Mouse Down (Check resize handles FIRST):**

```javascript
const handleMouseDown = useCallback((e) => {
  // Calculate canvas coordinates
  const canvasX = ...;
  const canvasY = ...;

  // PRIORITY 1: Check for resize handle (highest priority - small hit area)
  const resizeHandle = findResizeHandleAtPosition(canvasX, canvasY);
  if (resizeHandle) {
    startResize(resizeHandle.clip, resizeHandle.handle, canvasX, screenX);
    return;
  }

  // PRIORITY 2: Check for clip body
  const clickedClip = findClipAtPosition(canvasX, canvasY);
  if (clickedClip) {
    // Handle selection and drag...
  }

  // PRIORITY 3: Empty space (marquee)
  // ...
}, [findResizeHandleAtPosition, startResize, ...]);
```

**Mouse Move:**

```javascript
const handleMouseMove = useCallback((e) => {
  const state = interactionStateRef.current;

  if (state.mode === 'resizing') {
    // Update resize position
    updateResize(canvasX, screenX);
  } else if (state.mode === 'dragging') {
    // Update drag...
  } else {
    // Update hover state - check resize handles first
    const resizeHandle = findResizeHandleAtPosition(canvasX, canvasY);
    if (resizeHandle) {
      setHoveredHandle({
        clipId: resizeHandle.clip.id,
        handle: resizeHandle.handle
      });
      setHoveredClipId(null);
    } else {
      setHoveredHandle(null);
      // Check for clip hover...
    }
  }
}, [updateResize, findResizeHandleAtPosition, ...]);
```

**Mouse Up & Mouse Leave:**

```javascript
const handleMouseUp = useCallback((e) => {
  const state = interactionStateRef.current;

  if (state.mode === 'resizing') {
    commitResize();
  } else if (state.mode === 'dragging') {
    commitDrag();
  }
}, [commitResize, commitDrag]);

const handleMouseLeave = useCallback(() => {
  const state = interactionStateRef.current;

  if (state.mode === 'resizing') {
    cancelResize(); // Cancel on mouse leave
  } else if (state.mode === 'dragging') {
    cancelDrag();
  }
}, [cancelResize, cancelDrag]);
```

### Visual Feedback

**Resize Ghost (handles canvas):**

```javascript
// Draw resize ghost with blue tint
if (resizeGhost) {
  const x = resizeGhost.x - viewport.scrollX;
  const y = resizeGhost.y - viewport.scrollY;

  // Semi-transparent ghost
  ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Blue for resize
  ctx.fillRect(x, y, resizeGhost.width, resizeGhost.height);

  // Dashed border
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x, y, resizeGhost.width, resizeGhost.height);
  ctx.setLineDash([]);

  // Duration label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${resizeGhost.duration.toFixed(2)} beats`, x + resizeGhost.width / 2, y + resizeGhost.height / 2);
}
```

**Handle Highlight (on hover):**

```javascript
// Draw resize handle highlights
if (hoveredHandle && !dragGhosts && !resizeGhost) {
  const clip = clips.find(c => c.id === hoveredHandle.clipId);
  if (clip) {
    const clipStartX = clip.startTime * PIXELS_PER_BEAT * zoomX - scrollX;
    const clipWidth = clip.duration * PIXELS_PER_BEAT * zoomX;

    const handleWidth = 8;
    const handleX = hoveredHandle.handle === 'left' ? clipStartX : clipStartX + clipWidth - handleWidth;

    // Blue highlight
    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.fillRect(handleX, y, handleWidth, height);

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(handleX, y, handleWidth, height);
  }
}
```

**Cursor Styling:**

```javascript
// Dynamic cursor based on interaction state
<div
  className="canvas-container"
  style={{
    cursor: hoveredHandle ? 'ew-resize' :
            resizeGhost ? 'ew-resize' :
            dragGhosts ? 'grabbing' :
            'default'
  }}
>
  {/* Canvas layers */}
</div>
```

### Keyboard Integration

```javascript
// ESC key cancels resize operation
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      cancelResize();
      cancelDrag();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [cancelResize, cancelDrag]);
```

### Common Pitfalls

1. **Priority Inversion**: Always check resize handles BEFORE clip body in hit testing
2. **Handle Width**: 8px is the sweet spot - smaller is too hard to hit, larger interferes with drag
3. **Minimum Duration**: Always enforce minimum duration (0.25 beats recommended)
4. **Snap to Grid**: Apply snap AFTER constraint checks, not before
5. **Visual Feedback**: Use different colors for resize (blue) vs drag (purple) ghosts
6. **Cursor**: Update cursor on hover, during resize, and reset on idle
7. **Mouse Leave**: Always cancel resize on mouse leave to prevent stuck states

---

## 📝 Implementation Checklist

### For Piano Roll Note Interaction

- [ ] Define interaction hierarchy (resize → note body → empty space)
- [ ] Implement state machine with modes
- [ ] Selection system
  - [ ] Click selection
  - [ ] Shift+Click add
  - [ ] Ctrl+Click toggle
  - [ ] Marquee selection
- [ ] Drag & drop
  - [ ] Pass clicked note ID to startDrag
  - [ ] Drag threshold (3px)
  - [ ] Multi-note drag
  - [ ] Snap to grid
  - [ ] Ghost visualization
- [ ] Resize handles
  - [ ] Left edge (adjust start time)
  - [ ] Right edge (adjust duration)
  - [ ] Handle hit testing (small area, high priority)
- [ ] Keyboard shortcuts
  - [ ] Escape → Cancel drag
  - [ ] Delete → Remove selected
  - [ ] Ctrl+D → Duplicate
- [ ] Edge cases
  - [ ] Mouse leave → Cancel drag
  - [ ] Clamp bounds (no negative time, no negative pitch)
  - [ ] Prevent overlaps (optional, depends on design)

### Code Structure

```
hooks/
  useNoteInteraction.js     ← Main interaction logic
    - State machine
    - Selection handlers
    - Drag handlers
    - Resize handlers
    - Coordinate utilities

components/
  PianoRoll.jsx
    - Integrate useNoteInteraction
    - Render ghost notes
    - Render selection highlights
    - Handle keyboard shortcuts
```

---

## 🎨 Visual Feedback Standards

### Selection Highlight
- **Border**: `rgba(139, 92, 246, 1)` - 2px solid
- **Glow**: `0 0 20px rgba(139, 92, 246, 0.6)`

### Hover Highlight
- **Border**: `rgba(255, 255, 255, 0.4)` - 2px solid
- **Show only when**: Not selected AND not dragging

### Drag Ghost
- **Fill**: `rgba(139, 92, 246, 0.3)` - 30% opacity
- **Border**: `rgba(139, 92, 246, 0.9)` - 2px dashed (4px dash)
- **Text**: White 11px Inter

### Marquee Box
- **Fill**: `rgba(139, 92, 246, 0.1)` - 10% opacity
- **Border**: `rgba(139, 92, 246, 0.8)` - 2px dashed (5px dash)

---

## 🐛 Common Pitfalls

### 1. Selection State Timing
❌ **Wrong:**
```javascript
setSelection(clipId);
startDrag(); // Uses old selection!
```

✅ **Correct:**
```javascript
setSelection(clipId);
startDrag(clipId); // Pass clicked item explicitly
```

### 2. Forgetting Drag Threshold
❌ **Wrong:** Start drag immediately on mouse down
✅ **Correct:** Wait for 3px movement before showing ghosts

### 3. Not Canceling on Mouse Leave
❌ **Wrong:** Keep dragging when mouse leaves canvas
✅ **Correct:** Cancel drag and restore positions

### 4. Modifier Keys + Drag
❌ **Wrong:** Allow drag on Ctrl+Click
✅ **Correct:** Ctrl/Shift+Click only for selection, no drag

### 5. Async State in Closures
❌ **Wrong:** Reading state from closure in callbacks
✅ **Correct:** Use refs for immediate state or pass values explicitly

---

## 📚 Related Files

### ArrangementV2 Implementation
- `client/src/features/arrangement_v2/hooks/useClipInteraction.js` - Main interaction logic
- `client/src/features/arrangement_v2/ArrangementPanelV2.jsx` - Integration + rendering
- `client/src/store/useArrangementV2Store.js` - State management

### Piano Roll (To Be Implemented)
- `client/src/features/piano_roll_v7/hooks/useNoteInteraction.js` - Apply patterns here
- `client/src/features/piano_roll_v7/PianoRoll.jsx` - Integration

---

## 🚀 Next Steps for Piano Roll

1. Copy `useClipInteraction.js` structure → `useNoteInteraction.js`
2. Adapt coordinate system (beats → time, tracks → pitch)
3. Add note-specific features:
   - Velocity adjustment
   - Note stretching (hold Ctrl while resizing)
   - Pitch snapping
4. Reuse visual feedback patterns
5. Test all edge cases from this document

---

**Last Updated:** 2025-10-11
**Status:** ✅ Validated in ArrangementV2, Ready for Piano Roll
