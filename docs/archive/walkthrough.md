# Mixer Redesign & Routing

## Overview
Redesigned the Mixer's Send UI to improve usability and implemented "Exclusive Routing" (Submix capability) alongside the existing parallel sends.

## Changes

### 1. FL Studio-Style Send UI
**Problem:** Clicking a mixer channel was causing layout shifts ("jumping faders") because the Send controls appeared/disappeared dynamically.
**Fix:** Implemented a fixed-height container that renders a dimmed, disabled arrow when no connection is possible (e.g. self-send). This reserves space consistently and provides helpful tooltips (e.g., "Cannot send to itself"), improving both stability and UX.

### 2. Exclusive Routing ("Route to this track only")
**Problem:** Previously, sending a track to a bus created a *parallel* clean signal + send signal, resulting in a volume boost. There was no way to create a true submix (where the original signal stops going to Master).
**Fix:** Added an "Exclusive Routing" mode. 
- **Right-Click** the Send Arrow to access the menu.
- Select **"Route to this track only"**.
- This disconnects the track from the Master and routes it *exclusively* to the target bus.
- Visualized by a **Green Knob (Locked at 100%)** and **ROUTE badge**, matching the style of parallel sends but with distinct color coding.
- **Disconnect**: Click the triangular arrow at the top (just like standard sends) to reset routing to Master.

### 3. Context Menu
Added a context menu to the Send button with options:
- **Route to this track only**: Exclusive submix routing.
- **Sidechain to this track**: Creates a send at 0% volume (useful for sidechain compression).
- **Reset Routing**: Reconnects to Master.
- **Disconnect**: Removes the send.
**Fix:** Ensured the menu renders via `ReactDOM.createPortal` to break out of the Mixer's stacking context, guaranteeing visibility. Also implemented a robust `onMouseUp` handler for right-click reliability.

## Verification
- **UI Stability**: Click between tracks; the faders and buttons should remaining perfectly stationary.
- **Routing**: Right-click a send -> "Route to this track only". Verify the sound goes through the Bus only.
- **Menu**: Right-click the arrow or existing connection to open routing options.

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
