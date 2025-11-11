# Voice Allocation System - Detailed Comparison & Issues

## PART 1: VOICE STORAGE ARCHITECTURE

### VASynthInstrument: Direct Instance Map

```
┌──────────────────────────────────────────┐
│      VASynthInstrument Instance          │
├──────────────────────────────────────────┤
│ voices: Map                              │
│ ├─ 'mono' → VASynth (mono mode only)    │
│ ├─ 60    → VASynth (C4)                 │
│ ├─ 64    → VASynth (E4)                 │
│ └─ 67    → VASynth (G4)                 │
│                                          │
│ voiceTimeouts: Map                       │
│ ├─ 60 → timeoutId(12345)                │
│ ├─ 64 → timeoutId(12346)                │
│ └─ 67 → timeoutId(12347)                │
│                                          │
│ activeNotes: Map                         │
│ ├─ 60 → { startTime, velocity }         │
│ └─ 64 → { startTime, velocity }         │
│                                          │
│ maxVoices: 8                             │
│ masterGain: GainNode (0.7 level)         │
└──────────────────────────────────────────┘
```

**Each VASynth contains:**
- 3 oscillators (OscillatorNode)
- 3 oscillator gains (GainNode)
- 1 filter (BiquadFilterNode)
- 1 filter envelope gain (GainNode)
- 1 amplitude gain (GainNode)
- 1 master gain (GainNode)
- 2 envelopes (ADSREnvelope)
- 1 LFO (LFO)
- Total: ~15 AudioNode objects per voice

### MultiSampleInstrument: Voice Pool Architecture

```
┌────────────────────────────────────────────────┐
│      MultiSampleInstrument Instance            │
├────────────────────────────────────────────────┤
│ voicePool: VoicePool                           │
│                                                 │
│  voices: [SampleVoice[16]]  (Pre-allocated)   │
│  ├─ [0] → SampleVoice (IDLE)                  │
│  ├─ [1] → SampleVoice (IDLE)                  │
│  ├─ [2] → SampleVoice (IDLE)                  │
│  └─ ...                                        │
│                                                 │
│  activeVoices: Map                             │
│  ├─ 60 → SampleVoice[2] (PLAYING)             │
│  └─ 64 → SampleVoice[5] (PLAYING)             │
│                                                 │
│  freeVoices: [SampleVoice[6], [7], [9], ...] │
│  (Stack of available voices)                   │
│                                                 │
│  releaseQueue: [                               │
│    { voice: SampleVoice[1], endTime: 123.5 }, │
│    { voice: SampleVoice[3], endTime: 124.2 }  │
│  ]                                             │
│                                                 │
│ maxPolyphony: 16                               │
│ masterGain: GainNode (0.8 level)               │
│ sampleMap: Map (128 MIDI notes → buffer info) │
└────────────────────────────────────────────────┘
```

**Each SampleVoice contains:**
- 1 envelope gain (GainNode) - persistent
- 1 playback gain (GainNode) - persistent
- 1 buffer source (AudioBufferSource) - recreated per trigger
- Optional: 1 filter (BiquadFilterNode) - created if modWheel/aftertouch
- Optional: 1 panner (StereoPannerNode) - created if pan parameter
- Total: 2-4 AudioNode objects reused per voice

---

## PART 2: DETAILED VOICE LIFECYCLE

### VASynthInstrument: Complete Timeline

```
TIME  STATE        ACTION                          VOICES MAP           TIMEOUTS MAP
────────────────────────────────────────────────────────────────────────────────────

0.0s  INIT
      noteOn(60)   Create VASynth for C4          { 60→VASynth }       {}
                   voice.noteOn() triggers

0.05s PLAYING      (user holds note...)
                   OSCs generating sound
                   Envelopes at sustain

0.3s  noteOn(64)   Create VASynth for E4          { 60→VASynth,        {}
                   voice.noteOn() triggers        64→VASynth }

0.5s  PLAYING      (user holds both notes)
                   2 voices generating sound

0.7s  noteOff(60)  voice.noteOff() on VASynth     { 60→VASynth,        { 60→tid1 }
                   Start release envelope         64→VASynth }         (setTimeout 0.6s)
                   Calculate releaseTime = 0.5s
                   Schedule disposal at 0.7 + 0.6 = 1.3s

0.8s  RELEASING    (Release envelope running)
      PLAYING      60 fading out, 64 sustaining    { 60→VASynth,        { 60→tid1 }
                                                    64→VASynth }

1.3s  TIMEOUT      setTimeout fires for note 60   { 64→VASynth }       {}
                   voice.dispose() called
                   Clear voices.set(60)
                   Stop OSCs, disconnect gains

1.5s  noteOn(60)   Retrigger! Create new VASynth  { 60→VASynth(NEW),   {}
                   OLD voice already disposed      64→VASynth(OLD) }

2.0s  noteOff(64)  voice.noteOff() on VASynth     { 60→VASynth(NEW),   { 64→tid2 }
                   Release envelope starts        64→VASynth(OLD) }    (setTimeout 0.6s)

2.6s  TIMEOUT      setTimeout fires for note 64   { 60→VASynth(NEW) }  {}
                   Dispose OLD voice
```

### MultiSampleInstrument: Complete Timeline

```
TIME  STATE        ACTION                         ACTIVE       FREE          RELEASE
────────────────────────────────────────────────────────────────────────────────

0.0s  INIT
      allocate(60) Pop from freeVoices           { 60→V[0] }   [1..15]       []
                   reset() called
                   trigger() with sample mapping
                   V[0] starts playback

0.05s PLAYING      (audio context playing)
                   V[0] envelope in sustain phase

0.3s  allocate(64) Pop from freeVoices           { 60→V[0],    [2..15]       []
                   V[1] starts playback            64→V[1] }

0.5s  PLAYING      2 voices actively playing

0.7s  release(60)  V[0].release() called          { 64→V[1] }   [2..15]       [V[0]]
                   Release envelope 0.5s
                   ConstantSourceNode scheduled
                   V[0] moves to releaseQueue

0.8s  RELEASING    (Release envelope running)    { 64→V[1] }   [2..15]       [V[0]]
      PLAYING      V[0] fading, V[1] sustaining

1.2s  ONENDED      ConstantSourceNode.onended()  { 64→V[1] }   [0,2..15]     []
                   V[0].reset() called
                   Return to freeVoices pool
                   Remove from releaseQueue

1.5s  allocate(60) Pop from freeVoices           { 60→V[0],    [2..15]       []
      (retrigger)  V[0].reset() called            64→V[1] }
                   trigger() with new sample data
                   V[0] restarts immediately

2.0s  release(64)  V[1].release() called          { 60→V[0] }   [2..15]       [V[1]]
                   Release envelope starts

2.5s  ONENDED      ConstantSourceNode.onended()  { 60→V[0] }   [1,2..15]     []
                   V[1].reset() called
                   Return to freeVoices pool
```

---

## PART 3: POLYPHONY & VOICE STEALING

### VASynthInstrument Voice Stealing (Current - FIFO)

```javascript
// Issue: Based on Map.keys() order, not actual age

if (this.voices.size >= this.maxVoices) {  // maxVoices = 8
    const oldestNote = Array.from(this.voices.keys())[0];
    this.noteOff(oldestNote);
}

// Problem Scenario:
// Time 0.0s: noteOn(60) → voices = { 60 }
// Time 0.1s: noteOn(64) → voices = { 60, 64 }
// Time 0.2s: noteOn(67) → voices = { 60, 64, 67 }
// Time 0.3s: noteOff(60), setTimeout scheduled for disposal
// Time 0.4s: noteOn(60) → voices = { 60(NEW), 64, 67 }
//            (OLD 60 still in timeout queue)
// Time 0.5s: noteOn(71) → voices = { 60(NEW), 64, 67, 71 }
// ...
// Time 1.3s: Original timeout for 60 fires - disposes 60(NEW)!
//            WRONG VOICE STOLEN
```

### MultiSampleInstrument Voice Stealing (Current - Priority-Based)

```javascript
// 3-Tier Algorithm

stealVoice() {
    // Tier 1: Prefer quietest releasing voice
    if (this.releaseQueue.length > 0) {
        let quietest = this.releaseQueue[0];
        let lowestAmp = quietest.voice.getAmplitude();
        
        for (let i = 1; i < this.releaseQueue.length; i++) {
            const amp = this.releaseQueue[i].voice.getAmplitude();
            if (amp < lowestAmp) {
                lowestAmp = amp;
                quietest = this.releaseQueue[i];
            }
        }
        return quietest.voice;  // Already fading out!
    }
    
    // Tier 2: Find lowest-priority active voice
    if (this.activeVoices.size > 0) {
        let lowestPriority = Infinity;
        let candidate = null;
        
        this.activeVoices.forEach((voice, note) => {
            const priority = voice.updatePriority();
            // priority = 100(active) + age(0-50) + amplitude*50 + velocity*25
            // + envelope bonus (attack +50, sustain +30, release -30)
            
            if (priority < lowestPriority) {
                lowestPriority = priority;
                candidate = voice;
            }
        });
        
        return candidate;  // Lowest priority
    }
    
    return null;  // Pool exhausted
}

// Example: Stealing calculation
voice1: amp=0.8, age=0.1s, velocity=100, phase='sustain'
        priority = 100 + 49 + 40 + 19 + 30 = 238

voice2: amp=0.2, age=3.0s, velocity=50,  phase='sustain'
        priority = 100 + 20 + 10 + 9 + 30 = 169

voice3: amp=0.9, age=0.05s, velocity=127, phase='attack'
        priority = 100 + 49.5 + 45 + 25 + 50 = 269.5

Result: Steal voice2 (lowest priority)
Reason: Quieter, older, lower velocity
```

---

## PART 4: MEMORY MANAGEMENT DEEP DIVE

### VASynthInstrument: setTimeout-Based Cleanup

```javascript
// ============ noteOff() - Per-Voice Release ============
noteOff(midiNote) {
    const voice = this.voices.get(midiNote);
    if (!voice) return;
    
    // 1. Trigger audio release
    voice.noteOff(time);  // Start amplitude envelope release
    
    // 2. Calculate release duration from envelope
    const releaseTime = voice.amplitudeEnvelope?.releaseTime || 0.5;
    
    // 3. Schedule disposal AFTER release completes
    const timeoutId = setTimeout(() => {
        // This runs ~0.6 seconds later in JavaScript thread
        voice.dispose();              // Stop OSCs, disconnect nodes
        this.voices.delete(midiNote);
        this.voiceTimeouts.delete(midiNote);
    }, (releaseTime + 0.1) * 1000);  // e.g., 600ms
    
    // 4. Track timeout for potential cancellation
    this.voiceTimeouts.set(midiNote, timeoutId);
}

// ============ Potential Issue: Race Condition ============

// Thread A (UI/MIDI): noteOff(60) at time 0.7s
//   → timeout scheduled for 0.7 + 0.6 = 1.3s
//   → voiceTimeouts.set(60, tid123)

// Thread A (UI/MIDI): noteOn(60) at time 0.8s (retrigger)
//   → clearTimeout(tid123)  ← Clears pending disposal
//   → dispose old voice immediately
//   → Create new voice

// Thread A (JS Engine): setTimeout callback at 1.3s
//   → TRIES to dispose again!
//   → But: this.voices.delete(60) already happened
//   → voice.dispose() called twice
//   → Caught by try-catch in dispose(), no error
//   → BUT: voiceTimeouts still has entry temporarily

// Fix Applied: Lines 108-111 cancel timeout FIRST
```

### MultiSampleInstrument: AudioParam-Based Cleanup

```javascript
// ============ release() - Per-Voice Release ============
release(midiNote, time) {
    const voice = this.activeVoices.get(midiNote);
    if (!voice) return;
    
    // 1. Trigger audio release
    const releaseDuration = voice.release(time);
    
    // 2. Remove from active
    this.activeVoices.delete(midiNote);
    
    // 3. Add to release queue (tracking)
    this.releaseQueue.push({
        voice,
        endTime: time + releaseDuration
    });
    
    // 4. Schedule return using AUDICONTEXT timing (not JS!)
    this.scheduleVoiceReturn(voice, time, releaseDuration);
}

// ============ scheduleVoiceReturn() - Precise Timing ============
scheduleVoiceReturn(voice, startTime, duration) {
    // Create a dummy ConstantSourceNode for timing
    // This fires "onended" callback at EXACT audio time
    const timer = this.context.createConstantSource();
    
    timer.onended = () => {
        // Return voice to free pool
        if (!this.freeVoices.includes(voice)) {
            this.freeVoices.push(voice);
        }
        
        // Remove from release queue
        const index = this.releaseQueue.findIndex(
            item => item.voice === voice
        );
        if (index !== -1) {
            this.releaseQueue.splice(index, 1);
        }
    };
    
    // Schedule precisely
    timer.start(startTime);
    timer.stop(startTime + duration);
}

// ============ Potential Issue: ConstantSourceNode Fallback ============

// Problem: onended() callback reliability varies by browser/context
// - Real-time contexts: Usually reliable
// - Offline contexts: May not fire (no event loop)
// - Some Safari versions: Timing issues

// Missing fallback:
// If onended doesn't fire → voice stuck in releaseQueue
// → Pool becomes exhausted → No new voices allocated
// → Audio stops

// Solution: Add setTimeout fallback
```

---

## PART 5: CRITICAL BUGS IDENTIFIED

### Bug #1: MultiSample Polyphony Tracking (HIGH SEVERITY)

**Location**: `/Users/alperkosan/dawg/client/src/lib/audio/instruments/base/VoicePool.js:72`

**Code**:
```javascript
allocate(midiNote, allowPolyphony = true) {
    // ... voice allocation code ...
    
    // BUG: Map key overwrites previous voice
    this.activeVoices.set(midiNote, voice);  // Line 72
    return voice;
}
```

**Scenario**:
```
1. allocate(60, true) → voice1 allocated, activeVoices = { 60→voice1 }
2. allocate(60, true) → voice2 allocated, activeVoices = { 60→voice2 }

3. release(60) → ONLY release voice2
   → voice1 still in audio graph but not in activeVoices
   → voice1 never returned to freeVoices
   → voice1 stuck in audio context forever!
```

**Impact**:
- Memory leak: Voices accumulate in audio graph
- Voice exhaustion: Pool eventually has no free voices
- Audio degradation: Stuck voices continue processing

**Fix Priority**: CRITICAL

---

### Bug #2: VASynth Timeout Race Condition (MEDIUM SEVERITY)

**Location**: `/Users/alperkosan/dawg/client/src/lib/audio/instruments/synth/VASynthInstrument.js:104-119`

**Code**:
```javascript
noteOn(midiNote, velocity, startTime, extendedParams) {
    // ...
    if (this.voices.has(midiNote)) {
        const oldVoice = this.voices.get(midiNote);
        
        if (this.voiceTimeouts.has(midiNote)) {
            clearTimeout(this.voiceTimeouts.get(midiNote));  // Line 109
            this.voiceTimeouts.delete(midiNote);
        }
        
        if (oldVoice) {
            oldVoice.dispose();  // Line 115 - Immediate dispose
        }
    }
}
```

**Scenario**:
```
Time 0.7s:  noteOff(60) → setTimeout scheduled for 1.3s
            voiceTimeouts = { 60→tid123 }

Time 0.8s:  noteOn(60) → Retrigger
            clearTimeout(tid123) ✓
            oldVoice.dispose() ✓
            Create new voice

Time 1.3s:  setTimeout callback fires (supposed to dispose old voice)
            → voice.dispose() called AGAIN (but voice is already disposed)
            → voiceTimeouts.delete(60) still tries to delete
```

**Impact**:
- Error logs (caught by try-catch, silent)
- Timing issues with rapid retriggering
- voiceTimeouts.set() at line 211 creates orphan entry temporarily

**Fix Priority**: MEDIUM (Already mostly mitigated by line 109)

---

### Bug #3: Unreliable Voice Stealing in VASynth (MEDIUM SEVERITY)

**Location**: `/Users/alperkosan/dawg/client/src/lib/audio/instruments/synth/VASynthInstrument.js:125-128`

**Code**:
```javascript
if (this.voices.size >= this.maxVoices) {
    const oldestNote = Array.from(this.voices.keys())[0];
    this.noteOff(oldestNote);  // Line 128
}
```

**Problem**:
- `Array.from(this.voices.keys())[0]` returns first key in insertion order
- NOT the oldest note by age
- Map iteration order = insertion order, NOT access time

**Scenario**:
```
Creation order: A(0.0s), B(0.1s), C(0.2s), D(0.3s), E(0.4s)

noteOff(A) at 0.5s:
  - timeout scheduled, A still in Map temporarily
  - voices = { A(releasing), B, C, D, E }

noteOn(F) at 0.6s:
  - voices.size = 5 (not yet >= 8)

noteOn(G) at 0.65s:
  - voices.size = 6

...more notes...

noteOn(H) at 1.0s:
  - voices.size = 8 → Must steal
  - Array.from(voices.keys())[0] = B (not A!)
  - A was released but still in Map
  - STEALS B instead of oldest
```

**Impact**:
- Wrong voice stolen (not actually oldest)
- Unpredictable polyphony behavior
- Differences with traditional synth behavior

**Fix Priority**: MEDIUM

---

### Bug #4: ConstantSourceNode Reliability (HIGH SEVERITY)

**Location**: `/Users/alperkosan/dawg/client/src/lib/audio/instruments/base/VoicePool.js:174-194`

**Code**:
```javascript
scheduleVoiceReturn(voice, startTime, duration) {
    const timer = this.context.createConstantSource();
    
    timer.onended = () => {  // Line 179
        if (!this.freeVoices.includes(voice)) {
            this.freeVoices.push(voice);
        }
        // Remove from releaseQueue
    };
    
    timer.start(startTime);
    timer.stop(startTime + duration);
}
```

**Problem**:
- `onended` callback reliability varies
- No documented browser support for `AudioNode.onended` event
- Different behavior in offline vs real-time contexts
- No fallback mechanism

**Impact**:
- Voice never returned to pool
- releaseQueue accumulates indefinitely
- Eventually: pool exhausted, no voices available
- Audio stops working

**Severity**: HIGH - Silent failure, no error logs

**Fix Priority**: CRITICAL

---

### Bug #5: Decay Interval Memory Leak in SampleVoice (MEDIUM SEVERITY)

**Location**: `/Users/alperkosan/dawg/client/src/lib/audio/instruments/sample/SampleVoice.js:320-327`

**Code**:
```javascript
release(time) {
    // ... envelope code ...
    
    const decayInterval = setInterval(() => {
        this.currentAmplitude = Math.max(0, 
            this.currentAmplitude - (decayRate * updateInterval / 1000)
        );
        
        if (this.currentAmplitude <= 0) {
            clearInterval(decayInterval);
        }
    }, updateInterval);  // Line 320 - NO REFERENCE SAVED!
}

reset() {
    super.reset();
    this.stopCurrentSource();
    
    // MISSING: clearInterval(this.decayInterval)
    // If reset() called while interval running: LEAK!
}
```

**Problem**:
- `decayInterval` local variable, not tracked
- If voice reset before amplitude reaches 0 → interval never cleared
- No reference to clear the interval

**Scenario**:
```
1. release(time) → setInterval starts, runs every 50ms
2. release() returns - interval continues in background
3. reset() called (voice returned to pool)
   - reset() doesn't know about interval
   - interval still running, updating amplitude
4. allocate() reuses voice, trigger() called
   - New release envelope starts
   - Old interval still running in background
   - TWO amplitude calculations now!
```

**Impact**:
- Intervals accumulate (1 per interrupted release)
- CPU overhead (unnecessary updates)
- Memory leaks (closure references)
- Amplitude tracking corrupted

**Fix Priority**: MEDIUM

---

### Bug #6: Filter/Panner Nodes Not Disposed (MEDIUM SEVERITY)

**Location**: `/Users/alperkosan/dawg/client/src/lib/audio/instruments/sample/SampleVoice.js:169-205`

**Code**:
```javascript
trigger(..., extendedParams) {
    // ...
    
    let lastNode = this.envelopeGain;
    let filterNode = null;
    
    if (extendedParams?.modWheel || extendedParams?.aftertouch) {
        filterNode = this.context.createBiquadFilter();
        // ... setup filter ...
        this.envelopeGain.connect(filterNode);
        lastNode = filterNode;  // Line 194
    }
    
    if (extendedParams?.pan && extendedParams.pan !== 0) {
        pannerNode = this.context.createStereoPanner();
        lastNode.connect(pannerNode);
        lastNode = pannerNode;  // Line 204
    }
}

reset() {
    super.reset();
    this.stopCurrentSource();
    
    // MISSING:
    // - filterNode.disconnect()
    // - pannerNode.disconnect()
    // - filterNode = null
    // - pannerNode = null
}
```

**Problem**:
- Dynamic nodes created but never disposed
- reset() called for pool reuse, but nodes persist
- Next trigger() creates NEW nodes → OLD nodes orphaned

**Impact**:
- Orphaned AudioNode accumulation
- Audio context node count increases
- Memory leak (filter chains)
- Eventually: Audio context becomes unstable

**Fix Priority**: MEDIUM

---

## PART 6: SUMMARY TABLE

| Bug | Severity | Type | Impact | File | Fix Effort |
|-----|----------|------|--------|------|-----------|
| Polyphony Tracking (Map overwrite) | CRITICAL | Logic | Memory leak, voice exhaustion | VoicePool.js:72 | Medium |
| ConstantSourceNode fallback | CRITICAL | Missing | Silent audio failure | VoicePool.js:174 | Low |
| Timeout race condition | MEDIUM | Race | Error logs, timing issues | VASynthInstrument.js:104 | Low (mostly done) |
| Voice stealing (wrong voice) | MEDIUM | Algorithm | Unpredictable behavior | VASynthInstrument.js:127 | Low |
| Decay interval leak | MEDIUM | Memory | CPU overhead, amplitude corruption | SampleVoice.js:320 | Low |
| Filter/Panner not disposed | MEDIUM | Resource | Orphaned nodes, memory leak | SampleVoice.js:169 | Low |

---

## PART 7: COMPARISON MATRIX

### Architecture Design Decisions

| Aspect | VASynth | MultiSample | Winner |
|--------|---------|-------------|---------|
| **Pre-allocation** | Dynamic (slow path) | Pre-allocated (fast) | MultiSample |
| **GC pressure** | High (per release) | Zero (reuse) | MultiSample |
| **Voice stealing** | Simple FIFO | Priority-based | MultiSample |
| **Timing precision** | setTimeout (100ms) | AudioParam (sample-accurate) | MultiSample |
| **Flexibility** | Full synthesis | Samples + pitch | VASynth |
| **CPU cost** | Higher (synthesis) | Lower (playback) | MultiSample |
| **Complexity** | High (15+ nodes) | Low (2-4 nodes) | MultiSample |
| **Mono mode** | Native support | Via flag | VASynth |
| **Code maturity** | More proven | Recent (AudioParam) | VASynth |

