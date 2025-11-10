# Oval Note Resize Bug Analysis

## Bug 1: Oval Note Resize - Notes Still Disappearing

### Root Cause Locations:

1. **Line 1154-1157 in `useNoteInteractionsV2.js`**:
   ```javascript
   // ✅ Update notes immediately to convert oval -> normal before resize
   if (convertedNotes.some(...)) {
       updatePatternStore(convertedNotes);  // ❌ BUG: Updates store BEFORE resize completes
       setTempNotes(convertedNotes);
   }
   ```
   **Problem**: Oval notes are converted to normal and immediately saved to store. If resize is cancelled or fails, the converted state persists but the note might be lost.

2. **Line 2034-2046 in `useNoteInteractionsV2.js`**:
   ```javascript
   const currentNotes = notes();  // ❌ BUG: May return converted notes
   const updatedNotes = currentNotes.map(n => {
       const finalState = finalStates.get(n.id);
       if (finalState) {
           return { ...n, ...finalState };
       }
       return n;  // ❌ BUG: If finalState is missing, note stays in converted state
   });
   ```
   **Problem**: If `finalStates` doesn't have an entry for a note (e.g., resize cancelled), the note remains in converted state but may not match the visual representation.

3. **Line 2025-2030 - hasChanged check**:
   ```javascript
   if (original && (Math.abs(finalState.startTime - original.startTime) > 0.001 ||
                   Math.abs(finalState.length - original.length) > 0.001)) {
       hasChanged = true;
   }
   ```
   **Problem**: Only checks if finalState differs from converted `original`, not from the TRUE original (before conversion). If resize is cancelled, `hasChanged = false` and updates are skipped, leaving notes in converted state.

### Fix Strategy:
1. Don't update store immediately on conversion - only convert in memory
2. Always use originalNotesForUndo for comparison, not converted originalNotes
3. Ensure all notes in dragState.noteIds have finalStates, even if resize is cancelled

---

## Bug 2: Visual Length Mismatch - Notes Shrinking More Than Shown

### Root Cause Locations:

1. **Line 1754 in `useNoteInteractionsV2.js`**:
   ```javascript
   const deltaTime = coords.time - dragState.startCoords.time;
   ```
   **Problem**: `deltaTime` is calculated from time coordinates, not considering `visualLength`. For oval notes, the resize handle is positioned based on `visualLength`, but `deltaTime` uses absolute time.

2. **Line 581, 595 in `noteRenderer.js`**:
   ```javascript
   renderNote = { ...note, startTime: newStartTime, length: newLength, visualLength: newLength };
   ```
   **Problem**: During resize, `visualLength` is set equal to `newLength`, but `newLength` is calculated from `deltaTime` which doesn't account for the visual representation.

3. **Line 337 in `useNoteInteractionsV2.js`**:
   ```javascript
   const displayLength = note.visualLength !== undefined ? note.visualLength : note.length;
   const noteWidth = Math.max(Math.round(stepWidth) - 1, Math.round(displayLength * stepWidth) - 1);
   ```
   **Problem**: Resize handle detection uses `visualLength`, but resize calculation uses `length`, causing mismatch.

4. **Line 1990, 2008 in `useNoteInteractionsV2.js`**:
   ```javascript
   resizedState.visualLength = newLength;  // Always matches length after resize
   ```
   **Problem**: After resize, `visualLength` is always set to `newLength`, but if the resize was very small, the visual representation might shrink more than expected because the initial resize handle position was based on `visualLength`.

### Fix Strategy:
1. Calculate resize delta based on visual representation, not absolute time
2. Account for visualLength when calculating resize deltas
3. Ensure resize calculations use the same length reference (visualLength) as the handle detection

