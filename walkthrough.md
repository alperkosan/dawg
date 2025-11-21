# Saturator Metrics & Performance Fixes

## Overview
Addressed the issue where Saturator RMS/Peak monitors were showing `-InfinitydB`. This was caused by a combination of a performance bottleneck in the DSP code and a limitation in the metering hook that prevented updates when the transport was stopped.

## Changes

### 1. DSP Optimization (`saturator-processor.js`)
**Problem:** The `processMultiband` method was recalculating high-pass filter coefficients **per sample** inside the audio loop, causing excessive CPU usage and potential audio dropouts (silence).
**Fix:** Implemented caching for all crossover filter coefficients.

```javascript
// BEFORE (Inside per-sample loop)
const lowMidHP = this.calculateHighpass(lowMidFreq); // Expensive!

// AFTER (Cached)
if (lowMidFreq !== this.cachedCrossoverCoeffs.lowMid.freq) {
  this.cachedCrossoverCoeffs.lowMid.hp = this.calculateHighpass(lowMidFreq);
  // ...
}
```

### 2. Live Metering Support (`useAudioPlugin.js`)
**Problem:** The `useAudioPlugin` hook only updated metrics when `isPlaying` was true. This prevented metering for live inputs or when the transport was stopped.
**Fix:** Removed the `!isPlaying` check to allow metrics to update whenever the plugin UI is open.

```javascript
// BEFORE
if (!options.updateMetrics || !isPlaying || !pluginRef.current) return;

// AFTER
if (!options.updateMetrics || !pluginRef.current) return;
```

### 3. UI Display Improvements (`SaturatorUI_V2.jsx`)
**Problem:** The UI displayed `-InfinitydB` literally when silence was detected.
**Fix:** Added formatting to display `-Inf dB` for values below -100dB and ensured the metrics overlay is always visible.

```javascript
const formatDb = (val) => val < -100 ? '-Inf' : val.toFixed(1);
ctx.fillText(`RMS: ${formatDb(metricsDb.rmsDb)} dB`, ...);
```

## Verification
- **Performance:** The Saturator should now run efficiently even in Multiband mode without audio dropouts.
- **Metering:** RMS and Peak meters should now be active even when the transport is stopped (showing noise floor or live input).
- **Visuals:** The display should show `-Inf dB` instead of `-InfinitydB` for silence.
