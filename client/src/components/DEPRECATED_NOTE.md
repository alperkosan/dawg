# DEPRECATED COMPONENTS

## Motor Precision System (Deprecated)
The following files have been deprecated due to unnecessary complexity:
- `/features/piano_roll_v2/hooks/useMotorPrecisionNotes.js`
- `/features/piano_roll_v2/utils/precisionGrid.js`
- `/features/piano_roll_v2/hooks/useMicroAdjustment.js`

### Reason for Deprecation
The motor precision system added unnecessary complexity:
- Additional abstraction layer over standard musical time units (beats/steps)
- High cognitive load for developers
- Error-prone tick <-> step <-> second conversions
- Over-engineered for typical DAW needs

### Replacement
Use the simplified time system in `InfinitePianoRoll.jsx`:
- Time is stored in beats (float values)
- 1 beat = quarter note
- Snap to grid: 1/64, 1/32, 1/16, 1/8, 1/4, 1/2, 1 (standard musical subdivisions)
- No "motor ticks" - direct beat values only

### Migration Guide
Instead of:
```js
const ticks = precisionGrid.pixelsToTicks(pixelX);
const note = createNoteAtTicks(ticks);
```

Use:
```js
const timeInBeats = pixelX / (cellWidth * 4 * zoom);
const snappedTime = Math.round(timeInBeats / snapSize) * snapSize;
const note = { time: snappedTime, ... };
```

This approach is:
- Simpler to understand
- Industry standard (used by FL Studio, Ableton, etc.)
- Less error-prone
- Better performance (fewer conversions)