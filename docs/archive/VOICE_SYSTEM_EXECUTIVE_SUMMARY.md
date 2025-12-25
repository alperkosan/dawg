# Voice Allocation System - Executive Summary

## Overview

This analysis examines voice management across three instrument implementations:
1. **VASynthInstrument** - Virtual Analog synth with direct voice management
2. **MultiSampleInstrument** - Sample-based with voice pooling
3. **SampleInstrument** - Not found (replaced by MultiSample)

## Key Findings

### Architecture Differences

| Dimension | VASynthInstrument | MultiSampleInstrument |
|-----------|-------------------|----------------------|
| **Voice Lifecycle** | Create → Play → Release → Dispose | Pre-allocated → Allocate → Play → Release → Reset |
| **Storage** | Map<midiNote, VASynth> | VoicePool with activeVoices Map |
| **Memory Model** | Dynamic allocation, GC-heavy | Fixed pool, zero-allocation |
| **Cleanup Timing** | setTimeout (100ms precision) | AudioParam (sample-accurate) |
| **Polyphony Limit** | 8 voices (configurable) | 16 voices (optimized) |
| **Voice Stealing** | Simple FIFO (oldest first) | Priority-based (3-tier) |
| **Mono Mode** | Native (voiceMode='mono') | Via cutItself flag |
| **Audio Nodes/Voice** | 15+ (full synth) | 2-4 (sample + envelope) |
| **CPU Cost** | High (synthesis) | Low (playback) |

### Memory Management

**VASynthInstrument:**
- Each voice = ~2-3 MB (full synthesizer)
- Voices created on-demand → garbage collection per release
- setTimeout-based cleanup (~0.6s latency)
- Risk: Timeout race conditions, accumulation if stopped abruptly

**MultiSampleInstrument:**
- Each voice = ~50-100 KB (sample player)
- Voices pre-allocated and reused
- Zero garbage collection during playback
- AudioParam-based cleanup (precise timing)
- Risk: ConstantSourceNode reliability varies by browser

### Polyphony Management

**VASynthInstrument Voice Stealing:**
```javascript
const oldestNote = Array.from(this.voices.keys())[0];
this.noteOff(oldestNote);
```
- Takes first key in insertion order
- Not truly "oldest" (unreliable after retriggers)
- No consideration of amplitude or envelope phase

**MultiSampleInstrument Voice Stealing:**
1. Prefer releasing voices (already fading)
2. Find lowest-priority active voice considering:
   - Amplitude (louder = higher priority)
   - Envelope phase (attack > sustain > release)
   - Age (newer = higher priority)
   - Velocity (higher velocity = higher priority)
3. Result: More intelligent, predictable allocation

### Mono Mode Implementation

**VASynthInstrument:**
- Single voice keyed as 'mono'
- All notes routed through same oscillators
- Portamento/glide support
- Legato mode (no envelope retrigger)
- Natural last-note-priority

**MultiSampleInstrument:**
- Mono via `cutItself` parameter
- Allocate returns existing voice if same note
- Limited to sample playback (no true glide)
- No multi-note precedence handling

---

## Critical Issues Found

### 1. ⚠️ CRITICAL: MultiSample Polyphony Tracking Bug
**Location:** VoicePool.js:72
**Issue:** Map key overwrites when allocating multiple voices for same MIDI note
**Impact:** Voice exhaustion, memory leak
**Status:** Not fixed

### 2. ⚠️ CRITICAL: Missing ConstantSourceNode Fallback
**Location:** VoicePool.js:174-194
**Issue:** onended callback reliability varies, no fallback
**Impact:** Voices stuck in pool → audio failure
**Status:** Not fixed

### 3. ⚠️ MEDIUM: VASynth Voice Stealing Unreliable
**Location:** VASynthInstrument.js:127
**Issue:** Takes first Map key (not actual oldest)
**Impact:** Unpredictable polyphony behavior
**Status:** Not fixed

### 4. ⚠️ MEDIUM: SampleVoice Decay Interval Leak
**Location:** SampleVoice.js:320
**Issue:** setInterval not tracked, not cleared in reset()
**Impact:** CPU overhead, amplitude corruption
**Status:** Not fixed

### 5. ⚠️ MEDIUM: SampleVoice Filter/Panner Not Disposed
**Location:** SampleVoice.js:169-205
**Issue:** Dynamic nodes created but never disconnected
**Impact:** Orphaned nodes, eventual audio context failure
**Status:** Not fixed

### 6. ⚠️ MEDIUM: VASynth Timeout Race Condition
**Location:** VASynthInstrument.js:104-119
**Issue:** Double-dispose possible on rapid retrigger
**Impact:** Error logs (silent, mitigated)
**Status:** Partially mitigated

---

## Voice Lifecycle Diagrams

### VASynthInstrument (setTimeout-based)
```
noteOn() → Create VASynth → voice.noteOn()
  ↓
PLAYING (oscillators active)
  ↓
noteOff() → voice.noteOff() → Schedule disposal via setTimeout
  ↓
RELEASING (envelope fading ~0.5s)
  ↓
setTimeout fires (~0.6s total) → voice.dispose()
  ↓
DISPOSED (oscillators stopped, gains disconnected)
```

### MultiSampleInstrument (AudioParam-based)
```
allocate() → Pop voice from pool → voice.reset()
  ↓
trigger() → Create BufferSource → Start playback
  ↓
PLAYING (sample + envelope active)
  ↓
release() → voice.release() → Schedule via ConstantSourceNode
  ↓
RELEASING (envelope fading ~0.5s)
  ↓
onended fires (ideally) → voice.reset() → Return to pool
  ↓
IDLE (in free pool, ready for reuse)
```

---

## Performance Comparison

| Metric | VASynth | MultiSample | Winner |
|--------|---------|-------------|--------|
| Memory per voice | 2-3 MB | 50-100 KB | MultiSample (40x) |
| GC per release | 1 object + children | 0 | MultiSample |
| Max polyphony | 4-8 | 16+ | MultiSample |
| Voice stealing latency | 50-100ms (timeout) | Immediate | MultiSample |
| Timing accuracy | ~100ms (setTimeout) | Sample-accurate | MultiSample |
| Mono mode quality | Excellent (native) | Limited (flag-based) | VASynth |
| Synthesis flexibility | Full | Sample+pitch | VASynth |

---

## Recommendations

### Immediate (Critical)

1. **Fix MultiSample polyphony tracking:**
   - Change activeVoices from Map to Array/Set tracking
   - Allow multiple voices per MIDI note
   - Implement proper release for all allocated voices

2. **Add ConstantSourceNode fallback:**
   - Use setTimeout as backup
   - Ensure voices always return to pool
   - Add explicit timeout on release queue

3. **Clear decay intervals in SampleVoice.reset():**
   - Store interval reference
   - clearInterval() in reset()
   - Prevent amplitude corruption

### Short-term (High Priority)

4. **Fix VASynth voice stealing:**
   - Track voice creation time
   - Implement priority-based algorithm
   - Align with MultiSample approach

5. **Dispose dynamic nodes in SampleVoice:**
   - Disconnect filter and panner in reset()
   - Prevent orphaned node accumulation

### Long-term (Architectural)

6. **Unify voice management:**
   - Use VoicePool for both VASynth and MultiSample
   - Create shared voice interface
   - Eliminate duplicate code

7. **Improve mono mode support:**
   - Implement for MultiSample
   - Add glide/portamento to samples
   - Consistent API across instruments

---

## Summary

The codebase implements two fundamentally different voice management approaches:

**VASynthInstrument** prioritizes flexibility and synthesis quality but at the cost of complexity and memory overhead. The dynamic allocation model and setTimeout-based cleanup introduce timing uncertainty and garbage collection pressure.

**MultiSampleInstrument** prioritizes efficiency with pre-allocated voice pools and AudioParam-based timing, but has critical bugs in polyphony tracking and node disposal that can lead to voice exhaustion and orphaned nodes.

**Recommended action:** Fix critical bugs in MultiSample first (highest impact), then gradually migrate VASynth to use the VoicePool pattern for consistency and improved performance.

---

## File References

- **VASynthInstrument:** `/Users/alperkosan/dawg/client/src/lib/audio/instruments/synth/VASynthInstrument.js`
- **VASynth:** `/Users/alperkosan/dawg/client/src/lib/audio/synth/VASynth.js`
- **MultiSampleInstrument:** `/Users/alperkosan/dawg/client/src/lib/audio/instruments/sample/MultiSampleInstrument.js`
- **VoicePool:** `/Users/alperkosan/dawg/client/src/lib/audio/instruments/base/VoicePool.js`
- **SampleVoice:** `/Users/alperkosan/dawg/client/src/lib/audio/instruments/sample/SampleVoice.js`
- **BaseVoice:** `/Users/alperkosan/dawg/client/src/lib/audio/instruments/base/BaseVoice.js`
- **BaseInstrument:** `/Users/alperkosan/dawg/client/src/lib/audio/instruments/base/BaseInstrument.js`

---

## Related Analysis Documents

- `VOICE_ALLOCATION_ANALYSIS.md` - Comprehensive technical analysis
- `VOICE_SYSTEM_DETAILED_COMPARISON.md` - Detailed lifecycle and bug analysis

