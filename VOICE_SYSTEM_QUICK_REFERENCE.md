# Voice Allocation System - Quick Reference

## Files Generated

1. **VOICE_SYSTEM_EXECUTIVE_SUMMARY.md** (240 lines)
   - High-level overview of both systems
   - Critical issues at a glance
   - Recommendations prioritized

2. **VOICE_ALLOCATION_ANALYSIS.md** (815 lines)
   - Comprehensive technical analysis
   - 9 major sections with code samples
   - Voice lifecycle detailed
   - Memory management patterns
   - Recommendations and fixes

3. **VOICE_SYSTEM_DETAILED_COMPARISON.md** (688 lines)
   - Visual architecture diagrams
   - Timeline examples
   - All 6 bugs with scenarios
   - Performance metrics
   - Design decision matrix

---

## Critical Issues at a Glance

### 🔴 CRITICAL (Fix Immediately)

1. **MultiSample Polyphony Tracking Bug**
   - File: VoicePool.js:72
   - Issue: Same MIDI note allocates multiple voices but only last tracked
   - Result: Voices stuck in audio graph forever
   - Impact: Voice exhaustion after ~16 rapid same-note triggers

2. **ConstantSourceNode No Fallback**
   - File: VoicePool.js:174-194
   - Issue: onended callback unreliable in some contexts
   - Result: Voices never returned to pool
   - Impact: Silent audio failure when pool exhausted

3. **SampleVoice Decay Interval Leak**
   - File: SampleVoice.js:320-327
   - Issue: setInterval not tracked, not cleared in reset()
   - Result: Intervals accumulate, CPU overhead
   - Impact: Amplitude corruption, performance degradation

### 🟡 HIGH (Fix Soon)

4. **Filter/Panner Nodes Not Disposed**
   - File: SampleVoice.js:169-205
   - Issue: Dynamic filter/panner nodes not disconnected
   - Result: Orphaned nodes accumulate
   - Impact: Audio context becomes unstable

5. **VASynth Voice Stealing Wrong**
   - File: VASynthInstrument.js:127
   - Issue: Uses first Map key, not actual oldest
   - Result: Wrong voice stolen
   - Impact: Unpredictable polyphony behavior

6. **VASynth Timeout Race Condition**
   - File: VASynthInstrument.js:104-119
   - Issue: Double-dispose possible
   - Result: Silent error catch
   - Status: Partially mitigated

---

## Architecture Comparison (TL;DR)

```
VASynthInstrument          MultiSampleInstrument
├─ Create per noteOn       ├─ Pre-allocated pool
├─ 2-3 MB per voice        ├─ 50-100 KB per voice
├─ 15+ audio nodes         ├─ 2-4 audio nodes
├─ GC per release          ├─ Zero GC
├─ setTimeout cleanup      ├─ AudioParam cleanup
├─ FIFO voice stealing     ├─ Priority-based stealing
├─ Excellent mono mode     ├─ Limited mono mode
└─ High CPU               └─ Low CPU (40x memory efficient)
```

---

## Voice Storage Models

### VASynthInstrument (Direct Map)
```javascript
this.voices = new Map();        // midiNote → VASynth instance
this.voiceTimeouts = new Map(); // midiNote → timeoutId
// Each note gets its own synth engine
```

### MultiSampleInstrument (Voice Pool)
```javascript
this.voicePool.voices = [];           // Pre-allocated SampleVoice[16]
this.voicePool.activeVoices = Map;    // midiNote → SampleVoice
this.voicePool.freeVoices = [];       // Available voices
this.voicePool.releaseQueue = [];     // Voices in release phase
// Voices recycled, never disposed
```

---

## Voice Lifecycle Comparison

### VASynthInstrument Timeline
```
noteOn(60)     → VASynth created
  ↓ 0.3s
PLAYING        → Oscillators active, sustain envelope
  ↓
noteOff(60)    → Envelope release phase starts
  ↓ 0.5s
RELEASING      → Fading out
  ↓ 0.6s
setTimeout     → voice.dispose() called
  ↓
DISPOSED       → Oscillators stopped
```
Total: ~1.1 seconds

### MultiSampleInstrument Timeline
```
allocate(60)   → Pop voice from free pool, reset()
  ↓
trigger(60)    → BufferSource created & started
  ↓ 0.3s
PLAYING        → Sample + envelope sustain
  ↓
release(60)    → Envelope release phase
  ↓ 0.5s
RELEASING      → Fading out
  ↓
onended        → voice.reset(), return to free pool
  ↓
IDLE           → Ready for reuse
```
Total: ~0.8 seconds

---

## Voice Stealing Algorithms

### VASynthInstrument (Current - FIFO)
```javascript
const oldestNote = Array.from(this.voices.keys())[0];
// Problem: Returns first inserted key, not oldest by age
```

### MultiSampleInstrument (Current - Priority)
```javascript
1. Prefer releasing voices (already fading)
2. Fallback to lowest priority active voice:
   - priority = 100(active) + age(0-50) + amp*50 + velocity*25
   - bonus: attack +50, sustain +30, release -30
3. Result: Intelligent, predictable stealing
```

---

## Bug Priority & Effort

| Bug | Severity | Effort | Files |
|-----|----------|--------|-------|
| Polyphony Map overwrite | CRITICAL | Medium | VoicePool.js |
| ConstantSourceNode fallback | CRITICAL | Low | VoicePool.js |
| Decay interval leak | MEDIUM | Low | SampleVoice.js |
| Filter/Panner disposal | MEDIUM | Low | SampleVoice.js |
| Voice stealing wrong | MEDIUM | Low | VASynthInstrument.js |
| Timeout race condition | MEDIUM | Done* | VASynthInstrument.js |

*Already partially mitigated with clearTimeout

---

## Key Code Locations

### Voice Creation
- VASynth: VASynthInstrument.js:132-149
- Sample: VoicePool.js:44-74, SampleVoice.js:61-287

### Voice Release
- VASynth: VASynthInstrument.js:193-215
- Sample: VoicePool.js:83-101, SampleVoice.js:295-330

### Voice Stealing
- VASynth: VASynthInstrument.js:125-128
- Sample: VoicePool.js:113-164

### Cleanup/Disposal
- VASynth: VASynthInstrument.js:286-308, VASynth.js:621-627
- Sample: VoicePool.js:214-230, SampleVoice.js:336-351

### Mono Mode
- VASynth: VASynthInstrument.js:71-97, VASynth.js:128-179
- Sample: VoicePool.js:45-50

---

## Testing Checklist

- [ ] Test rapid same-note triggers (VASynth)
- [ ] Test polyphony limit behavior (both)
- [ ] Test voice stealing with mixed amplitudes (MultiSample)
- [ ] Test release timing accuracy (both)
- [ ] Test offline rendering (ConstantSourceNode fallback)
- [ ] Test voice pool exhaustion (MultiSample)
- [ ] Test memory usage over time (GC patterns)
- [ ] Test mono mode transitions (VASynth)
- [ ] Test decay interval cleanup (MultiSample)
- [ ] Test filter/panner node cleanup (MultiSample)

---

## Performance Targets

### VASynthInstrument
- Max sustainable voices: 4-8
- Memory per voice: 2-3 MB
- CPU impact: High (synthesis)
- Cleanup latency: 50-100ms (setTimeout)

### MultiSampleInstrument
- Max sustainable voices: 16+
- Memory per voice: 50-100 KB (40x better)
- CPU impact: Low (playback)
- Cleanup latency: Sample-accurate (AudioParam)

---

## Recommended Reading Order

1. Start: **VOICE_SYSTEM_EXECUTIVE_SUMMARY.md**
   - Get overview and priorities

2. Deep dive: **VOICE_ALLOCATION_ANALYSIS.md**
   - Understand architecture and memory management

3. Debug details: **VOICE_SYSTEM_DETAILED_COMPARISON.md**
   - See exact bugs and timelines

4. Code: Reference the actual files listed above

---

## Key Takeaways

1. **Two different architectures:** VASynth = dynamic, MultiSample = pooled
2. **MultiSample more efficient:** 40x less memory, zero GC
3. **Critical bugs exist:** Polyphony tracking and ConstantSourceNode fallback
4. **Voice stealing differs:** VASynth unreliable, MultiSample smart
5. **Mono mode:** VASynth excellent, MultiSample limited
6. **Cleanup timing:** VASynth imprecise (setTimeout), MultiSample precise (AudioParam)
7. **Future:** Unify under VoicePool pattern for consistency

