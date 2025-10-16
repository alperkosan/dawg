# 🐛 Waveform Rendering Edge Cases at Extreme Zoom Levels

**Date**: 2025-10-17
**Status**: ✅ FIXED
**Severity**: Medium (Visual bug affecting workflow)
**Files Affected**:
- `client/src/features/arrangement_v2/renderers/WaveformCache.js`
- `client/src/features/arrangement_v2/renderers/audioClipRenderer.js`

---

## Problem Description

### User Report
> "çok uzun samplelarda bir zoom seviyesinden sonra waveform render edilmiyor"
> (Waveforms don't render at certain zoom levels for very long samples)

### Symptoms
1. When zooming out to extreme levels (zoomX < 0.2)
2. Or when working with very long audio samples (> 60 seconds)
3. Waveforms would disappear completely
4. No error messages in console
5. Clip background and borders still visible

### Root Causes

Multiple edge cases were causing the waveform renderer to fail silently:

#### 1. **Canvas Dimension Edge Cases**
- Canvas width/height could become < 1 pixel at extreme zoom levels
- Canvas dimensions could exceed browser limits (32767px)
- Floating point values not rounded, causing canvas creation to fail

#### 2. **Sample Calculation Edge Cases**
- `samplesPerPixel` calculation could result in Infinity or NaN
- Sample offsets could exceed audio buffer length
- Start sample could equal or exceed end sample (zero samples to render)

#### 3. **Time Scale Calculation Edge Cases**
- `secondsPerPixel` could become 0 or negative at extreme zoom
- Division by zero in time scale calculations
- Invalid BPM values (0, negative, or NaN)

#### 4. **Array Bounds Edge Cases**
- Sample indices could go negative or exceed buffer length
- Inner loop could access out-of-bounds array indices
- Y coordinates could be NaN or Infinity

---

## Solution

### Fix #1: Canvas Dimension Validation

**File**: `client/src/features/arrangement_v2/renderers/WaveformCache.js`

Added robust validation and clamping for canvas dimensions:

```javascript
// ✅ FIX: Clamp canvas dimensions to prevent issues
const MIN_CANVAS_WIDTH = 1;
const MAX_CANVAS_WIDTH = 32767; // Max canvas dimension in most browsers
const MIN_CANVAS_HEIGHT = 1;
const MAX_CANVAS_HEIGHT = 32767;

const clampedWidth = Math.max(MIN_CANVAS_WIDTH, Math.min(MAX_CANVAS_WIDTH, Math.floor(width)));
const clampedHeight = Math.max(MIN_CANVAS_HEIGHT, Math.min(MAX_CANVAS_HEIGHT, Math.floor(height)));

if (clampedWidth !== width || clampedHeight !== height) {
  console.warn('⚠️ renderWaveform: clamped dimensions', {
    original: { width, height },
    clamped: { width: clampedWidth, height: clampedHeight }
  });
}
```

**Why This Works**:
- Ensures canvas dimensions are always valid integers
- Prevents browser canvas creation failures
- Logs warnings for debugging when clamping occurs

### Fix #2: Sample Offset Validation

**File**: `client/src/features/arrangement_v2/renderers/WaveformCache.js`

Added validation for sample offsets and ranges:

```javascript
// ✅ CRITICAL FIX: Validate sample offset to prevent out-of-bounds access
if (startSample < 0 || startSample >= channelData.length) {
  console.warn('⚠️ renderWaveform: invalid sample offset', {
    sampleOffset,
    startSample,
    channelLength: channelData.length
  });
  return null;
}

// ... later ...

// ✅ FIX: Ensure we have samples to render
if (endSample <= startSample) {
  console.warn('⚠️ renderWaveform: no samples to render', {
    startSample,
    endSample,
    channelLength: channelData.length
  });
  return null;
}
```

**Why This Works**:
- Prevents array out-of-bounds access
- Returns null early instead of creating broken canvas
- Provides diagnostic logging

### Fix #3: Time Scale Validation

**File**: `client/src/features/arrangement_v2/renderers/WaveformCache.js`

Added validation for time scale calculations:

```javascript
// ✅ FIX: Add safety checks for calculation results
if (!isFinite(secondsPerPixel) || secondsPerPixel <= 0) {
  console.warn('⚠️ renderWaveform: invalid time scale calculation', {
    bpm,
    pixelsPerBeat,
    zoomX,
    secondsPerPixel
  });
  return null;
}

// ... later ...

// ✅ FIX: Validate base samples per pixel
if (!isFinite(baseSamplesPerPixel) || baseSamplesPerPixel <= 0) {
  console.warn('⚠️ renderWaveform: invalid baseSamplesPerPixel', {
    baseSamplesPerPixel,
    secondsPerPixel,
    sampleRate
  });
  return null;
}
```

**Why This Works**:
- Catches division by zero errors
- Prevents NaN/Infinity propagation through calculations
- Fails gracefully with diagnostic info

### Fix #4: Waveform Drawing Loop Safety

**File**: `client/src/features/arrangement_v2/renderers/WaveformCache.js`

Added bounds checking in the drawing loop:

```javascript
// ✅ FIX: Use clamped width for loop
for (let x = 0; x < clampedWidth; x++) {
  const sampleIndex = startSample + Math.floor(x * samplesPerPixel);

  // ✅ FIX: Add bounds checking for sample index
  if (sampleIndex >= endSample || sampleIndex < 0 || sampleIndex >= channelData.length) {
    break;
  }

  // Find min/max in this pixel's sample range
  let min = 1;
  let max = -1;

  for (let s = 0; s < samplesPerPixel && sampleIndex + s < endSample; s++) {
    // ✅ FIX: Additional bounds check inside inner loop
    if (sampleIndex + s < channelData.length) {
      const sample = channelData[sampleIndex + s] || 0;
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
  }

  // ✅ FIX: Skip drawing if no valid samples were found
  if (min > max) {
    continue;
  }

  // Draw vertical line from min to max
  const y1 = centerY - min * amplitudeScale;
  const y2 = centerY - max * amplitudeScale;

  // ✅ FIX: Validate y coordinates before drawing
  if (isFinite(y1) && isFinite(y2)) {
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
  }
}
```

**Why This Works**:
- Multiple layers of bounds checking prevent crashes
- Skips invalid samples gracefully
- Only draws valid line segments

### Fix #5: Minimum Clip Width Check

**File**: `client/src/features/arrangement_v2/renderers/audioClipRenderer.js`

Added early exit for tiny clips:

```javascript
// ✅ FIX: Don't render waveform if clip is too small (< 2 pixels)
if (width < 2) {
  console.log('⚠️ Clip too small for waveform rendering:', width);
  return;
}
```

**Why This Works**:
- Prevents wasting CPU on invisible waveforms
- Avoids edge cases with 1-pixel canvases
- Improves performance at extreme zoom levels

### Fix #6: Waveform Height Safety

**File**: `client/src/features/arrangement_v2/renderers/audioClipRenderer.js`

Added minimum height validation:

```javascript
// ✅ FIX: Ensure waveform height is at least 1 pixel
const waveformHeight = Math.max(1, height - 16); // Leave space for padding

// ... later ...

// ✅ FIX: Only cache if render was successful
if (waveformCanvas) {
  waveformCache.set(clip.id, clip, width, waveformHeight, bpm, waveformLOD, waveformCanvas, pixelsPerBeat, zoomX);
}
```

**Why This Works**:
- Ensures canvas height is always valid
- Doesn't cache failed renders
- Prevents cache pollution with null values

---

## Key Lessons Learned

### ⚠️ Canvas API Edge Cases

When working with HTML5 Canvas:

1. **Always validate dimensions** before creating canvas
2. **Clamp to browser limits** (32767px in most browsers)
3. **Round to integers** - fractional pixels cause issues
4. **Check context creation** - getContext() can return null

### ⚠️ Audio Buffer Edge Cases

When processing audio data:

1. **Validate sample indices** at every level (outer loop, inner loop)
2. **Check buffer bounds** before array access
3. **Handle empty ranges** (startSample >= endSample)
4. **Use defensive defaults** (sample || 0)

### ⚠️ Floating Point Math Edge Cases

When doing calculations:

1. **Check for NaN and Infinity** after every division
2. **Validate denominators** are non-zero before dividing
3. **Use isFinite()** to catch both NaN and Infinity
4. **Fail gracefully** with diagnostic logging

### ⚠️ Extreme Zoom Level Handling

At extreme zoom levels:

1. **LOD system** should degrade quality, not break rendering
2. **Minimum thresholds** prevent rendering invisible content
3. **Early exits** are better than complex conditionals
4. **Log diagnostics** for debugging rare edge cases

---

## Testing Checklist

- [x] Waveform renders at normal zoom (zoomX = 1.0)
- [x] Waveform renders when zoomed in (zoomX > 2.0)
- [x] Waveform renders when slightly zoomed out (zoomX = 0.5)
- [x] Waveform renders or gracefully skips at extreme zoom out (zoomX < 0.1)
- [x] Long samples (> 60 seconds) render correctly
- [x] Short samples (< 1 second) render correctly
- [x] Clips smaller than 2 pixels don't attempt waveform render
- [x] Console warnings appear for edge cases (not errors)
- [x] No crashes or undefined behavior at any zoom level
- [x] Cache doesn't store null/failed renders

---

## Edge Cases Handled

### 1. Extreme Zoom Out (zoomX < 0.1)
- **Behavior**: Waveforms disappear when clip width < 2px
- **Result**: Graceful skip with console log

### 2. Very Long Samples (> 120 seconds)
- **Behavior**: Sample calculations could overflow
- **Result**: Bounds checking prevents out-of-range access

### 3. Fractional Pixel Dimensions
- **Behavior**: Canvas creation could fail
- **Result**: Dimensions rounded to integers

### 4. Canvas Size Limits
- **Behavior**: Browser rejects canvas > 32767px
- **Result**: Dimensions clamped to safe range

### 5. Invalid Time Scales
- **Behavior**: Division by zero or negative values
- **Result**: Early return with diagnostic logging

### 6. Empty Audio Buffers
- **Behavior**: startSample >= endSample
- **Result**: Early return, no wasted rendering

### 7. NaN/Infinity Propagation
- **Behavior**: Invalid calculations could corrupt state
- **Result**: isFinite() checks at every step

---

## Performance Impact

### Before Fix
- Could attempt to create invalid canvases (wasted CPU)
- Silent failures created confusion
- Cache could fill with null values

### After Fix
- Early exits prevent wasted work
- Diagnostic logging helps debugging
- Cache only stores valid renders
- No measurable performance regression

---

## Prevention Strategies

To avoid similar issues in future:

1. **Input Validation Pattern**: Always validate canvas dimensions, array indices, and calculation results
2. **Graceful Degradation**: Use early returns instead of complex nested conditionals
3. **Diagnostic Logging**: Warn (don't error) for edge cases with context
4. **Bounds Checking**: Multiple layers - outer loop, inner loop, before drawing
5. **Unit Tests**: Add tests for edge cases (extreme zoom, long samples, fractional dimensions)

---

## Related Code

- Waveform cache system: `WaveformCache.js:14-258`
- Audio clip renderer: `audioClipRenderer.js:119-176`
- LOD calculation: `useArrangementCanvas.js:81-88`
- Canvas rendering: `ArrangementPanelV2.jsx` (uses these renderers)

---

## References

- Browser Canvas Size Limits: https://stackoverflow.com/questions/6081483/maximum-size-of-a-canvas-element
- Web Audio API AudioBuffer: https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer
- Canvas Context getContext(): https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext

---

**Resolution Time**: ~1 hour
**Debugging Approach**: Systematic edge case analysis + defensive programming
**Lines Changed**: ~50 lines (validation + logging)
**Risk Level**: Low (all changes are safety checks and early exits)
