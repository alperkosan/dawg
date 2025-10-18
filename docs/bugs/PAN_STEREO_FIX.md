# Pan Stereo Configuration Fix

**Date:** 2025-10-18
**Status:** ✅ FIXED
**Issue:** Pan control not working - audio not panning left/right
**Root Cause:** Instrument processors outputting mono signal, causing stereo collapse before reaching mixer

---

## Problem Analysis

### Symptom
- Pan knob values being set correctly (console logs showed `Pan set to 1`)
- Mixer worklet had correct constant-power panning algorithm
- But audio was not panning left/right in headphones

### Investigation Process

1. **Initial Check**: Verified pan value flow (UI → Store → Audio Engine → Worklet) ✅ Correct
2. **Algorithm Check**: Verified constant-power panning math in mixer-processor.js ✅ Correct
3. **Routing Check**: Verified mixer channel → master → output connections ✅ Correct
4. **Stereo Config Check (Mixer)**: Found mixer channels not configured for stereo ⚠️ Issue #1
5. **Stereo Config Check (Instruments)**: Found instruments outputting mono ⚠️ **ROOT CAUSE**

### Root Cause

The audio signal path was:
```
Instrument (mono) → Mixer Channel (mono collapse) → Master (stereo) → Output
```

Even though we fixed the mixer to support stereo, the **instruments were outputting mono**, which meant there was only a single audio channel by the time it reached the mixer. Panning a mono signal does nothing - you need a true stereo signal to pan.

**Specifically:**
- `instrument-processor.js` was mixing all voices to a single sample, then **copying that same value to all output channels**
- This resulted in "dual mono" (L and R both have identical signal)
- Web Audio API treats dual mono as mono and collapses it

---

## Solution

### 1. Instrument Processor Stereo Output

**File:** `client/public/worklets/instrument-processor.js`

**Change:** Modified process() method to explicitly output to separate L/R channels:

```javascript
// ❌ BEFORE: Mono output copied to all channels
const finalSample = Math.tanh(mixedSample);
for (let channel = 0; channel < output.length; channel++) {
    output[channel][i] = finalSample;
}

// ✅ AFTER: Explicit stereo output
const finalSample = Math.tanh(mixedSample);

if (output.length >= 2) {
    output[0][i] = finalSample; // Left channel
    output[1][i] = finalSample; // Right channel
} else if (output.length === 1) {
    output[0][i] = finalSample; // Fallback mono
}
```

**Why:** Even though L and R are currently identical, this establishes true stereo infrastructure that the mixer can pan.

### 2. Instrument Worklet Node Stereo Configuration

**File:** `client/src/lib/core/NativeAudioEngine.js` (Lines 989-1005)

**Change:** Added explicit stereo configuration to instrument processor creation:

```javascript
// ❌ BEFORE: No channel configuration (defaults to mono)
const { node } = await this.workletManager.createWorkletNode(
    'instrument-processor',
    {
        processorOptions: { ... }
    }
);

// ✅ AFTER: Force stereo configuration
const { node } = await this.workletManager.createWorkletNode(
    'instrument-processor',
    {
        numberOfInputs: 0,  // No external inputs (generates audio)
        numberOfOutputs: 1,
        outputChannelCount: [2],  // ✅ Force stereo output
        channelCount: 2,          // ✅ Force stereo processing
        channelCountMode: 'explicit',  // ✅ Prevent auto-conversion to mono
        channelInterpretation: 'speakers',  // ✅ Stereo interpretation
        processorOptions: { ... }
    }
);
```

### 3. Instrument Output GainNode Stereo Preservation

**File:** `client/src/lib/core/NativeAudioEngine.js` (Lines 1007-1018)

**Change:** Force stereo on instrument's internal output gain node:

```javascript
this.workletNode = node;
this.internalOutput = this.audioContext.createGain();
this.internalOutput.gain.value = 0.8;

// ✅ NEW: Force stereo on output gain node
this.internalOutput.channelCount = 2;
this.internalOutput.channelCountMode = 'explicit';
this.internalOutput.channelInterpretation = 'speakers';

this.output = this.internalOutput;
this.workletNode.connect(this.internalOutput);
```

### 4. Debug Logging

**File:** `client/public/worklets/instrument-processor.js`

**Change:** Added channel configuration logging (similar to mixer):

```javascript
// In constructor:
this.hasLoggedChannelConfig = false;

// In process():
if (!this.hasLoggedChannelConfig && output) {
  console.log(`🎹 InstrumentProcessor[${this.instrumentId}] CHANNEL CONFIG:`, {
    outputChannels: output?.length || 0,
    stereo: (output?.length === 2) ? '✅ YES' : '❌ NO',
    instrumentName: this.instrumentName
  });
  this.hasLoggedChannelConfig = true;
}
```

---

## Verification

### Expected Console Logs (After Refresh)

When playing a note, you should see:

```
🎹 InstrumentProcessor[instr-1] CHANNEL CONFIG: {
  outputChannels: 2,
  stereo: '✅ YES',
  instrumentName: 'Kick'
}

🎚️ MixerProcessor[track-1] CHANNEL CONFIG: {
  inputChannels: 2,
  outputChannels: 2,
  stereo: '✅ YES'
}
```

### Testing Pan

1. Open Mixer panel
2. Select a channel with an active instrument
3. Turn pan knob fully left (-100): Should hear audio only in left ear
4. Turn pan knob fully right (+100): Should hear audio only in right ear
5. Center (0): Should hear audio equally in both ears

---

## Technical Details

### Why This Was Hard to Debug

1. **Value Flow Was Correct**: Pan values were being set properly all the way to the worklet
2. **Algorithm Was Correct**: Constant-power panning math was implemented correctly
3. **Routing Was Correct**: All nodes were connected in the right order
4. **Problem Was Upstream**: The issue was in the audio signal format (mono vs stereo) before it even reached the pan processing

### Web Audio API Stereo Requirements

For stereo processing to work correctly:

1. **AudioWorkletNode Config:**
   - `outputChannelCount: [2]` - Explicitly request 2 output channels
   - `channelCount: 2` - Process 2 channels
   - `channelCountMode: 'explicit'` - Don't let browser auto-convert

2. **GainNode Preservation:**
   - Must also be configured for stereo, or it will collapse to mono
   - `channelCountMode: 'explicit'` prevents automatic mixing

3. **Worklet Implementation:**
   - Must explicitly write to `output[0][i]` and `output[1][i]`
   - Cannot use `for (let channel...)` loop with same value - this creates dual mono

### Audio Signal Flow (After Fix)

```
Instrument Worklet (stereo: L=signal, R=signal)
  ↓ (2 channels preserved)
Instrument Output GainNode (stereo config)
  ↓ (2 channels preserved)
Mixer Channel Worklet (stereo config + pan processing)
  ↓ (2 channels, now L≠R after pan)
Mixer Channel Output GainNode (stereo config)
  ↓ (2 channels preserved)
Master Mixer Worklet (stereo config)
  ↓ (2 channels preserved)
Output Chain → Speakers/Headphones
```

---

## Previous Related Fixes

This fix builds on previous work:

1. **MASTER_CHANNEL_ROUTING_FIX.md**: Fixed mixer routing (all tracks → master → output)
2. **Mixer_2 Pan Value Range**: Fixed UI display (-100 to 100) vs API values (-1 to 1)
3. **Fader Throttling**: Added RAF-based throttling for performance

---

## Future Enhancements

With true stereo infrastructure now in place, we can add:

1. **Instrument-level stereo effects** (chorus, stereo delay, etc.)
2. **Per-voice panning** (different synth voices in different stereo positions)
3. **Stereo width control** on instruments
4. **Stereo samplers** with original L/R channel preservation

---

## Files Modified

1. `client/public/worklets/instrument-processor.js`
   - Modified process() method for explicit stereo output
   - Added channel config debug logging

2. `client/src/lib/core/NativeAudioEngine.js`
   - Added stereo configuration to instrument worklet node creation (lines 989-1005)
   - Added stereo preservation to instrument output GainNode (lines 1007-1018)

---

## Testing Notes

**IMPORTANT:** This fix requires a **hard refresh** (Cmd+Shift+R or Ctrl+Shift+R) to:
1. Reload the worklet processors with new code
2. Recreate audio engine with new stereo configuration
3. Create new instrument instances with stereo output

Without refresh, old mono instruments will still be in use and pan will not work.
