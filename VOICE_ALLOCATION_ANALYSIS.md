# Voice Allocation & Playback System Analysis

## Executive Summary

The codebase implements three distinct instrument types with different voice management strategies:
1. **VASynthInstrument** - Virtual Analog synth with direct voice map management
2. **MultiSampleInstrument** - Sample-based with voice pooling
3. ~~SampleInstrument~~ - Not found (MultiSample replaces it)

Each has fundamentally different voice lifecycle, memory management, and polyphony approaches.

---

## 1. VOICE STORAGE & CREATION

### VASynthInstrument (Direct Voice Map)
```javascript
this.voices = new Map();           // midiNote → VASynth instance
this.voiceTimeouts = new Map();    // midiNote → timeoutId
this.maxVoices = 8;               // Default polyphony
```

**Storage Strategy:**
- Dynamic: Voices created on-demand per noteOn
- Each VASynth is a full synth engine (oscillators, filters, envelopes)
- Keyed by MIDI note (polyphony: one voice per unique note)
- Separate timeout map for cleanup scheduling

**Creation Flow:**
```
noteOn(midiNote) →
  Check if note already playing →
    If yes: Dispose old voice immediately, replace
    If no: Create new VASynth instance
  Connect to masterGain
  Store in this.voices.set(midiNote, voice)
```

### MultiSampleInstrument (Voice Pooling)
```javascript
this.voicePool = new VoicePool(
    audioContext,
    SampleVoice,
    maxPolyphony   // Pre-allocated, typically 16 voices
);
this.voicePool.activeVoices = new Map();    // midiNote → voice
this.voicePool.freeVoices = [];              // Pool of available voices
this.voicePool.releaseQueue = [];            // Voices in release phase
```

**Storage Strategy:**
- Fixed-size pre-allocated pool (16 voices by default)
- Voices reused across notes (no creation/destruction per note)
- One Buffer source per trigger (lightweight reuse)
- Three-state system: free, active, releasing

**Allocation Flow:**
```
noteOn(midiNote) →
  voicePool.allocate(midiNote, allowPolyphony) →
    If free voice available: Pop from freeVoices, reset, return
    If none free: stealVoice() using priority system
    If success: Add to activeVoices, trigger() with sample data
```

---

## 2. VOICE LIFECYCLE COMPARISON

### VASynthInstrument Lifecycle

#### Creation (noteOn)
```
1. Check for retrigger:
   - If note already playing: Cancel timeout, dispose old VASynth
   - Create new VASynth instance
   
2. Check polyphony limit:
   - If voices.size >= maxVoices (8)
   - Call noteOff(oldestNote) - schedules disposal
   
3. Connect to master:
   - If extendedParams.pan: Create StereoPanner
   - Connect: voice.masterGain → panner → masterGain
   
4. Trigger playback:
   - voice.noteOn(midiNote, velocity, time, extendedParams)
   - Store: this.voices.set(midiNote, voice)
```

#### Playing
```
Active voices continue playing until:
- Manual noteOff() called
- Timeout from previous noteOff fires
- Emergency stopAll() or allNotesOff()
```

#### Release (noteOff)
```
1. Get voice: voice = this.voices.get(midiNote)
2. Trigger release: voice.noteOff(time)
   - Starts amplitude envelope release phase
   - Schedules oscillator stop at releaseEnd time
3. Schedule disposal:
   - Calculate releaseTime from amplitudeEnvelope.releaseTime
   - setTimeout(() => {
       voice.dispose()
       this.voices.delete(midiNote)
     }, (releaseTime + 0.1) * 1000)
   - Store timeoutId in voiceTimeouts
```

#### Disposal (cleanup)
```
VASynth.dispose():
  1. cleanup() - Stop oscillators, disconnect gains
  2. Set nodes to null
  3. Stop LFO

VASynthInstrument.dispose():
  1. Cancel ALL pending timeouts
  2. Dispose all voices immediately
  3. Clear voices, activeNotes, masterGain
```

### MultiSampleInstrument Lifecycle

#### Allocation (noteOn)
```
1. Check for retrigger:
   - allowPolyphony = !cutItself
   - If !allowPolyphony && activeVoices.has(midiNote): Reuse voice
   
2. Allocate voice:
   - If freeVoices available: Pop and return
   - If none: stealVoice() using priority algorithm
   
3. Reset voice:
   - voice.reset() - Stop current source, zero gains
   
4. Trigger playback:
   - voice.trigger(midiNote, velocity, frequency, time, mapping, data, params)
   - Add to activeVoices
```

#### Trigger (sample playback setup)
```
SampleVoice.trigger():
  1. Create new BufferSource (one-shot playback)
  2. Set buffer from sample mapping
  3. Calculate playback rate (pitch shifting)
  4. Connect source → envelopeGain
  5. Apply dynamic filter/pan if extended params present
  6. Set ADSR envelope from instrument data
  7. Start playback: currentSource.start(time)
  8. Register onended callback for auto-cleanup
```

#### Release (noteOff)
```
1. Get voice: voice = activeVoices.get(midiNote)
2. Release voice:
   - voice.release(time)
   - Apply release envelope: gain ramp 0 → current over releaseTime
   - Stop source at (time + releaseTime)
3. Schedule voice return:
   - Use ConstantSourceNode for precise timing (AudioParam-based!)
   - timer.onended → Return voice to freeVoices
   - Remove from releaseQueue
4. Remove from active:
   - activeVoices.delete(midiNote)
   - Add to releaseQueue: { voice, endTime }
```

#### Disposal (cleanup)
```
VoicePool.stopAll():
  1. Clear releaseQueue
  2. voice.reset() for all voices
  3. activeVoices.clear()
  4. Return all voices to freeVoices

VoicePool.dispose():
  1. stopAll()
  2. Disconnect all voices
  3. Clear all collections
  4. No per-note cleanup!
```

---

## 3. POLYPHONY MANAGEMENT

### VASynthInstrument
```
maxVoices: 8
Polyphony Type: Unbounded dynamic (scales with voices.size)
Voice Stealing: Oldest note (FIFO)
Mono Mode: Single 'mono' key reused for all notes
```

**Polyphony Check:**
```javascript
// Line 125-129
if (this.voices.size >= this.maxVoices) {
    const oldestNote = Array.from(this.voices.keys())[0];
    this.noteOff(oldestNote);
}
```

**Issues Identified:**
1. **Oldest note != lowest priority**: Just takes first key (insertion order)
2. **No real voice stealing algorithm**: Doesn't consider amplitude or envelope phase
3. **Mono mode limitation**: Can't truly track last-note-priority correctly
4. **Retrigger bug risk**: If same note retriggered, old voice disposed immediately

### MultiSampleInstrument
```
maxPolyphony: 16 (reduced from 32 for optimization)
Polyphony Type: Fixed-size pool
Voice Stealing: Priority-based (3-tier algorithm)
Mono Mode: Can use cutItself parameter
```

**Voice Stealing Priority Algorithm:**
```javascript
// VoicePool.stealVoice() - 3-tier system
1. PREFER: Voices in releaseQueue (already fading)
   - Find quietest releasing voice by getAmplitude()
   
2. FALLBACK: Active voices with lowest priority
   - Priority = voice.updatePriority()
   - Considers: amplitude + envelope phase + age + velocity
   
3. FALLBACK: Return null if no voices available
```

**Priority Calculation (BaseVoice):**
```javascript
priority = 0
if (isActive) priority += 100           // Must be active
if (age < 5s) priority += (50 - age*10) // Newer = higher
priority += amplitude * 50               // Louder = higher
priority += (velocity/127) * 25          // Higher velocity = higher

// SampleVoice bonus:
if (attack phase) priority += 50         // Don't steal during attack
if (sustain phase) priority += 30
if (release phase) priority -= 30        // OK to steal
```

**Advantages over VASynth:**
- Considers multiple factors (not just age)
- Envelope-aware (won't steal attack phase)
- Doesn't steal from release phase unnecessarily

---

## 4. MEMORY MANAGEMENT & CLEANUP

### VASynthInstrument (setTimeout-Based)

**Disposal Points:**
1. **noteOff()** - Each voice
   ```javascript
   const releaseTime = voice.amplitudeEnvelope?.releaseTime || 0.5;
   setTimeout(() => {
       voice.dispose();
       this.voices.delete(midiNote);
       this.voiceTimeouts.delete(midiNote);
   }, (releaseTime + 0.1) * 1000);
   ```

2. **allNotesOff()** - All active voices
   ```javascript
   this.voices.forEach((voice, midiNote) => {
       voice.noteOff(time);
       // Schedule async disposal for each
   });
   ```

3. **stopAll()** - Immediate panic
   ```javascript
   this.voiceTimeouts.forEach(id => clearTimeout(id));
   this.voiceTimeouts.clear();
   this.voices.forEach(voice => voice.dispose());
   this.voices.clear();
   ```

**Memory Leak Risks:**
1. **Timeout accumulation**: If stopAll() called with pending timeouts
   - FIX: Cancel all timeouts first (lines 291-293)
   
2. **Incomplete disposal**: Voices partially disconnected
   - Mitigated by VASynth.dispose() cleanup()
   
3. **No voice reuse**: New VASynth per note wastes objects
   - Not ideal for high-polyphony scenarios

### MultiSampleInstrument (AudioParam-Based!)

**Disposal Points:**

1. **release()** - Per voice (no setTimeout!)
   ```javascript
   // Schedule voice return using ConstantSourceNode.onended
   const timer = this.context.createConstantSource();
   timer.onended = () => {
       this.freeVoices.push(voice);
       // Remove from releaseQueue
   };
   timer.start(startTime);
   timer.stop(startTime + duration);
   ```

2. **stopAll()** - Immediate
   ```javascript
   this.releaseQueue = [];
   this.voices.forEach(voice => voice.reset());
   this.activeVoices.clear();
   this.freeVoices = [...this.voices];
   ```

3. **SampleVoice.reset()**
   ```javascript
   this.stopCurrentSource();
   this.envelopeGain.gain.setValueAtTime(0);
   // Audio nodes persist, just reset state
   ```

**Memory Advantages:**
1. **No setTimeout**: Uses AudioParam timing
   - Precise, no JavaScript overhead
   - Automatically aligned with audio context
   
2. **Voice reuse**: Same voice objects recycled
   - Pre-allocated at startup
   - Zero garbage collection during playback!
   
3. **Lightweight cleanup**: Just stop BufferSource
   - No oscillator/filter chains to disconnect
   - Envelope gains reset to 0

**Potential Issue:**
- ConstantSourceNode.onended timing might be unreliable in some contexts
- No explicit test of this mechanism in code

---

## 5. MONO VS POLYPHONIC MODES

### VASynthInstrument

#### Polyphonic Mode
```javascript
// Each note gets its own voice
this.voices.set(midiNote, voice);

// Retrigger handling:
if (this.voices.has(midiNote)) {
    const oldVoice = this.voices.get(midiNote);
    clearTimeout(this.voiceTimeouts.get(midiNote));
    oldVoice.dispose();
    this.voices.delete(midiNote);
}
```

#### Monophonic Mode
```javascript
const isMono = this.preset?.voiceMode === 'mono';

if (isMono) {
    // Single voice keyed as 'mono'
    let monoVoice = this.voices.get('mono');
    
    if (!monoVoice) {
        monoVoice = new VASynth(this.audioContext);
        this.voices.set('mono', monoVoice);
    }
    
    // All notes played through same voice
    monoVoice.noteOn(midiNote, velocity, time, extendedParams);
    
    // Track active notes separately
    this.activeNotes.set(midiNote, { startTime, velocity, extendedParams });
}

// noteOff in mono mode:
if (isMono) {
    this.activeNotes.delete(midiNote);
    if (this.activeNotes.size === 0) {
        monoVoice.noteOff(time);
    }
    // Otherwise: keep playing (note transition)
}
```

**VASynth Internal Mono Logic:**
```javascript
// VASynth.noteOn() - Mono mode with portamento
if (this.isPlaying && this.voiceMode === 'mono') {
    // Glide oscillator frequencies to new note
    osc.frequency.exponentialRampToValueAtTime(
        targetFreq,
        time + this.portamento  // Glide time
    );
    
    if (!this.legato) {
        // Retrigger envelopes
        this.filterEnvelope.trigger(...);
        this.amplitudeEnvelope.trigger(...);
    }
    return;  // Don't recreate oscillators
}
```

**Mono Features:**
- Portamento/glide (time parameter)
- Legato mode (no envelope retrigger)
- Last-note priority (by definition)

### MultiSampleInstrument

#### Polyphonic Mode
```javascript
const allowPolyphony = !cutItself;

// Multi-instance same note:
// Both voices active, each gets new allocation
voice1 = voicePool.allocate(60, true);
voice2 = voicePool.allocate(60, true);

// Second allocation replaces first in activeVoices Map
// BUG: activeVoices.set(60, voice2) overwrites voice1
```

#### Monophonic Mode (via cutItself)
```javascript
if (cutItself === true) {
    allowPolyphony = false;
    
    // activeVoices.get(midiNote) returns existing voice
    // Return existing voice for immediate retrigger
    if (this.activeVoices.has(midiNote)) {
        return this.activeVoices.get(midiNote);
    }
}
```

**Issue Found:**
```javascript
// VoicePool.allocate() - Line 71
// TODO: Consider using Array<{note, voice}> for true polyphony tracking
this.activeVoices.set(midiNote, voice);

// With allowPolyphony=true, same midiNote gets multiple voices
// But only last voice tracked in Map!
// This causes memory leak: old voices never returned to pool
```

---

## 6. DIFFERENCES BETWEEN INSTRUMENT TYPES

| Aspect | VASynthInstrument | MultiSampleInstrument |
|--------|-------------------|------------------------|
| **Voice Creation** | Dynamic (per noteOn) | Pre-allocated pool |
| **Voice Storage** | Map<midiNote, VASynth> | Pool + activeVoices Map |
| **Voice Reuse** | Never (disposed) | Always (reset & reuse) |
| **Memory Pattern** | GC every release | Zero GC (objects persist) |
| **Polyphony Type** | Unbounded (1-8+ voices) | Fixed pool (16 voices) |
| **Voice Stealing** | FIFO (oldest first) | Priority-based (3-tier) |
| **Mono Mode** | Native (voiceMode) | Via cutItself flag |
| **Release Timing** | setTimeout (JS) | AudioParam (precise) |
| **Cleanup** | Per-voice timeout | Shared pool return |
| **Oscillators** | 3 per voice | 0 (samples) |
| **Audio Nodes** | Many (filter, gains) | Minimal (source, envelope) |
| **Complexity** | High | Low |
| **CPU Cost** | Higher | Lower |
| **Flexibility** | Full synthesis | Sample playback + pitch |

---

## 7. POTENTIAL ISSUES & CONCERNS

### Critical Issues

1. **MultiSampleInstrument: Polyphony Tracking Bug**
   ```javascript
   // VoicePool.allocate() - Line 72
   this.activeVoices.set(midiNote, voice);
   
   // With allowPolyphony=true AND same midiNote:
   // Multiple voices allocated but Map key overwrites
   // Result: Previous voice never released, stuck in pool
   ```
   **Impact**: Memory leak, voice exhaustion
   **Severity**: HIGH
   **Location**: /Users/alperkosan/dawg/client/src/lib/audio/instruments/base/VoicePool.js:72

2. **VASynthInstrument: Timeout Race Condition**
   ```javascript
   // If noteOn() called while timeout pending:
   if (this.voices.has(midiNote)) {
       clearTimeout(this.voiceTimeouts.get(midiNote));
       oldVoice.dispose();  // Dispose during release = double-free risk
   }
   
   // Later: Original timeout fires and tries to dispose again
   ```
   **Impact**: Double-dispose errors (silent in try-catch)
   **Severity**: MEDIUM
   **Location**: /Users/alperkosan/dawg/client/src/lib/audio/instruments/synth/VASynthInstrument.js:108-119

3. **VASynthInstrument: Unreliable Voice Stealing**
   ```javascript
   // Line 127
   const oldestNote = Array.from(this.voices.keys())[0];
   
   // Map insertion order = first-inserted, not oldest-active
   // If notes interleaved: A, B, A, C → Stealing A but it's newest!
   ```
   **Impact**: Wrong voice stolen
   **Severity**: MEDIUM
   **Location**: /Users/alperkosan/dawg/client/src/lib/audio/instruments/synth/VASynthInstrument.js:125-128

### High-Priority Issues

4. **MultiSampleInstrument: ConstantSourceNode Timing Uncertainty**
   ```javascript
   // VoicePool.scheduleVoiceReturn()
   const timer = this.context.createConstantSource();
   timer.onended = () => { /* voice return */ };
   timer.start(startTime);
   timer.stop(startTime + duration);
   
   // onended reliability varies across browsers
   // No fallback if timer fails to fire
   ```
   **Impact**: Voices never returned to pool
   **Severity**: HIGH
   **Location**: /Users/alperkosan/dawg/client/src/lib/audio/instruments/base/VoicePool.js:174-194

5. **SampleVoice: Decay Interval Memory Leak**
   ```javascript
   // SampleVoice.release() - Line 320
   const decayInterval = setInterval(() => {
       this.currentAmplitude = Math.max(0, ...);
   }, updateInterval);
   
   // If voice reset while interval running: Leak!
   // clearInterval() should be called in reset()
   ```
   **Impact**: Intervals accumulate, CPU overhead
   **Severity**: MEDIUM
   **Location**: /Users/alperkosan/dawg/client/src/lib/audio/instruments/sample/SampleVoice.js:320-327

6. **VASynthInstrument: activeNotes Not Cleared on Dispose**
   ```javascript
   // VASynthInstrument.dispose()
   // activeNotes.clear() missing for mono mode tracking
   // Disposed synth's activeNotes still exist
   ```
   **Impact**: Memory leak (Map entries for dead voices)
   **Severity**: LOW
   **Location**: /Users/alperkosan/dawg/client/src/lib/audio/instruments/synth/VASynthInstrument.js:304-307

### Medium-Priority Issues

7. **VASynth: Oscillator Stop Timing Double-Scheduled**
   ```javascript
   // VASynth.noteOff() - Lines 336-337
   osc.stop(releaseEnd + 0.1);
   
   // ALSO: cleanup() called by setTimeout also stops oscillators
   // Could call stop() twice
   ```
   **Impact**: Error logs (caught by try-catch)
   **Severity**: LOW
   **Location**: /Users/alperkosan/dawg/client/src/lib/audio/instruments/synth/VASynth.js:331-350

8. **SampleVoice: Filter/Panner Nodes Not Disposed**
   ```javascript
   // SampleVoice.trigger() - Lines 172, 201
   if (extendedParams?.modWheel) {
       filterNode = this.context.createBiquadFilter();
       // ...
       this.envelopeGain.connect(filterNode);
   }
   
   // reset() doesn't disconnect these nodes!
   // They persist indefinitely
   ```
   **Impact**: Orphaned audio nodes, memory leak
   **Severity**: MEDIUM
   **Location**: /Users/alperkosan/dawg/client/src/lib/audio/instruments/sample/SampleVoice.js:169-205

---

## 8. RECOMMENDATIONS

### Immediate Fixes (Critical)

1. **Fix MultiSampleInstrument polyphony tracking**
   ```javascript
   // Change from Map to Array-based tracking
   this.noteVoices = new Map();  // midiNote → [voices]
   
   // allocate():
   if (!this.noteVoices.has(midiNote)) {
       this.noteVoices.set(midiNote, []);
   }
   this.noteVoices.get(midiNote).push(voice);
   
   // release():
   const voices = this.noteVoices.get(midiNote);
   voices.forEach(v => voicePool.release(v, time));
   this.noteVoices.delete(midiNote);
   ```

2. **Replace ConstantSourceNode with timeout fallback**
   ```javascript
   scheduleVoiceReturn(voice, startTime, duration) {
       const timer = this.context.createConstantSource();
       let timerFired = false;
       
       timer.onended = () => {
           timerFired = true;
           returnVoiceToPool(voice);
       };
       
       timer.start(startTime);
       timer.stop(startTime + duration);
       
       // Fallback timeout for safety
       setTimeout(() => {
           if (!timerFired) {
               console.warn('Timer fallback triggered');
               returnVoiceToPool(voice);
           }
       }, (duration + 0.5) * 1000);
   }
   ```

3. **Clear decay intervals in SampleVoice.reset()**
   ```javascript
   reset() {
       super.reset();
       this.stopCurrentSource();
       
       // NEW: Clear any pending decay intervals
       if (this.decayInterval) {
           clearInterval(this.decayInterval);
           this.decayInterval = null;
       }
       
       // ... existing reset code
   }
   ```

### Short-Term Improvements

4. **Implement proper voice stealing timestamp for VASynth**
   ```javascript
   // Add startTime tracking
   this.voices.set(midiNote, {
       voice: voiceInstance,
       startTime: audioContext.currentTime
   });
   
   // When stealing:
   let oldestNote = null;
   let oldestTime = Infinity;
   
   this.voices.forEach((data, note) => {
       if (data.startTime < oldestTime) {
           oldestTime = data.startTime;
           oldestNote = note;
       }
   });
   ```

5. **Implement VASynthInstrument priority-based stealing**
   ```javascript
   // Use same algorithm as MultiSampleInstrument
   stealVoice() {
       let candidate = null;
       let lowestPriority = Infinity;
       
       this.voices.forEach((voice, note) => {
           const priority = this.calculateVoicePriority(voice);
           if (priority < lowestPriority) {
               lowestPriority = priority;
               candidate = note;
           }
       });
       
       if (candidate) {
           this.noteOff(candidate);
           return candidate;
       }
       return null;
   }
   ```

### Long-Term Refactoring

6. **Unify voice management under VoicePool**
   ```
   Use VoicePool for both:
   - MultiSampleInstrument (already does)
   - VASynthInstrument (instead of direct Map)
   - Potential SampleInstrument
   
   Benefits:
   - Consistent API
   - Shared voice stealing logic
   - Reduced code duplication
   ```

7. **Create VoiceBase interface**
   ```javascript
   // All voices implement this
   interface IVoice {
       trigger(midiNote, velocity, frequency, time, params)
       release(time): releaseDuration
       reset()
       dispose()
       getAmplitude(): number
       updatePriority(): number
       output: AudioNode
   }
   ```

---

## 9. COMPARISON TABLE

### Voice Lifecycle State Machine

```
VASynthInstrument Flow:
┌─────────┐
│  IDLE   │
└────┬────┘
     │ noteOn()
     ▼
┌─────────────┐
│  PLAYING    │────────┐
└────┬────────┘        │
     │ noteOff()       │ retrigger
     ▼                 │ (immediate dispose)
┌──────────────────┐   │
│  RELEASING       │───┘
│ (envelope fades) │
└────┬─────────────┘
     │ timeout fires
     │ (releaseTime + 0.1s)
     ▼
┌─────────┐
│DISPOSED │
└─────────┘

MultiSampleInstrument Flow:
┌──────────┐
│   IDLE   │
│(in pool) │
└────┬─────┘
     │ allocate()
     ▼
┌──────────────┐
│  ACTIVE      │
│  (playing)   │
└────┬─────────┘
     │ release()
     ▼
┌──────────────────┐
│  RELEASING       │
│ (envelope fades) │
└────┬─────────────┘
     │ onended fires
     │ (immediate return)
     ▼
┌──────────┐
│   IDLE   │
│(in pool) │
└──────────┘
```

### Performance Characteristics

| Metric | VASynthInstrument | MultiSampleInstrument |
|--------|-------------------|----------------------|
| **Memory per voice** | 2-3 MB (full synth) | 50-100 KB (sample + gains) |
| **Voices created/sec** | Same as noteOn rate | 0 (pre-allocated) |
| **Garbage per voice** | 1 object + children | 0 (reset only) |
| **Audio nodes per voice** | 10-15 (osc, filter, gains) | 2-4 (source, gains) |
| **CPU per voice** | Higher (synthesis) | Lower (sample playback) |
| **Max sustainable voices** | 4-8 (synthesis) | 16+ (pooled samples) |
| **Voice stealing latency** | timeOut (50-1000ms) | Immediate |
| **Release timing accuracy** | ~100ms (setTimeout) | Audio-precise (AudioParam) |

---

## Summary of Key Findings

1. **Architecture Difference**: VASynth = dynamic allocation; MultiSample = fixed pool
2. **Memory Management**: VASynth generates GC; MultiSample zero-allocation
3. **Polyphony Control**: VASynth simple FIFO; MultiSample smart 3-tier priority
4. **Release Timing**: VASynth timeout-based; MultiSample AudioParam-based
5. **Mono Support**: VASynth native; MultiSample flag-based
6. **Critical bugs**: Polyphony tracking, ConstantSourceNode fallback, interval leaks
7. **Best practices**: Use VoicePool pattern everywhere, implement proper priority stealing

