# DAWG Optimization Plan
## Generated: 2025-10-19

---

## 🚀 Phase 1: Immediate Wins (1-2 hours)

### 1.1 Remove Unused Worklets ⚡ PRIORITY 1

**Impact**: Reduce codebase complexity, improve maintainability

```bash
# Files to remove or archive:
rm client/public/worklets/instrument-processor.js
rm client/public/worklets/multi-timbral-processor.js
rm client/public/worklets/test-processor.js

# Verify these are truly unused:
# - dynamic-effect-processor.js
# - base-effect-processor.js (might be template/base class)
```

**Why**: These worklets are loaded but never instantiated. Current architecture uses native Web Audio for instruments (correct decision).

**Validation**:
```bash
# Search for references:
grep -r "instrument-processor\|multi-timbral" client/src/
# Expected: Only in NativeAudioEngine (commented or unused)
```

---

### 1.2 Consolidate Worklet Loading 🎯 PRIORITY 2

**Current State**:
- NativeAudioEngine only loads `analysis-processor`
- 16 effect worklets loaded on-demand via EffectRegistry

**Problem**: Inconsistent loading strategy

**Solution**:
```javascript
// Centralize all worklet loading in one place
// Option A: Lazy load effects (current - good!)
// Option B: Preload critical effects at init

// Recommend: Keep current lazy-loading, but add preloading for common effects
const PRELOAD_EFFECTS = [
    'modern-delay-processor',
    'modern-reverb-processor',
    'compressor-processor'
];
```

**File**: `client/src/lib/audio/EffectRegistry.js`

---

## 🎨 Phase 2: Architecture Refinements (2-4 hours)

### 2.1 Granular Sampler Performance Tuning ⚙️

**Current Issues** (from previous session):
- ✅ FIXED: Unit conversion bug (80 seconds → 80ms)
- ✅ FIXED: isPlaying flag not updating
- ⚠️ POTENTIAL: Grain density auto-scaling

**Optimization**:
```javascript
// GranularSamplerInstrument.js
// Add dynamic grain density based on polyphony:

updateParams(params) {
    // Auto-reduce density when polyphony is high
    const densityScale = Math.max(0.5, 1 - (this.activeNotes.size / this.maxPolyphony) * 0.5);
    const adjustedDensity = params.grainDensity * densityScale;

    this.params = {
        ...this.params,
        ...params,
        grainDensity: adjustedDensity // Auto-scaled
    };
}
```

**Impact**: Prevent CPU spikes when playing chords

---

### 2.2 Instrument Voice Pooling Strategy 🎭

**Current**:
- GranularSampler: ✅ 128-voice pool (excellent)
- VASynth: ❓ No pooling visible
- Samplers: ❓ Voice allocation unclear

**Recommendation**:
```javascript
// Unified voice pooling across all instruments
class BaseInstrument {
    constructor() {
        this.voicePool = new VoicePool(maxVoices); // ✅ Already exists!
        this.voiceAllocator = new VoiceAllocator(); // ✅ Already exists!
    }
}

// Check if VASynth uses these base classes
// If not, refactor to use unified pooling
```

**Files to check**:
- `client/src/lib/audio/instruments/base/VoicePool.js` ✅ EXISTS
- `client/src/lib/audio/instruments/base/VoiceAllocator.js` ✅ EXISTS
- Verify usage in VASynthInstrument

---

### 2.3 Effect Chain Optimization 🔗

**Potential Issue**: Effect processing order and bypass

```javascript
// EffectChain should support:
✅ Bypass (dry/wet = 0) without processing
✅ Dynamic enable/disable (disconnect when bypassed)
❓ Parallel processing (sends already support this)

// Optimization:
if (effect.bypass || effect.wetLevel === 0) {
    // Disconnect worklet to save CPU
    effect.disconnect();
} else {
    effect.connect();
}
```

**Impact**: Save CPU when effects are bypassed

---

## 🧠 Phase 3: Advanced Optimizations (4-8 hours)

### 3.1 Audio Context Latency Tuning 🎚️

**Current**:
```javascript
// NativeAudioEngine.js
sampleRate: 48000,
latencyHint: 'interactive',
bufferSize: 256 // Good for low latency
```

**Analysis**:
- 48kHz @ 256 samples = **5.3ms latency** (excellent!)
- Modern browsers use adaptive buffer sizes

**Recommendation**: Keep current settings ✅

**Optional**: Add user preference for latency/quality tradeoff
```javascript
// Settings:
LOW_LATENCY: { bufferSize: 128, latencyHint: 'interactive' }    // 2.6ms
BALANCED: { bufferSize: 256, latencyHint: 'interactive' }        // 5.3ms (current)
HIGH_QUALITY: { bufferSize: 512, latencyHint: 'playback' }       // 10.6ms
```

---

### 3.2 Sample Loading & Caching Strategy 💾

**Current**:
```javascript
// NativeAudioEngine.js
this.sampleBuffers = new Map();
this.sampleCache = new Map();
```

**Questions**:
1. Are samples preloaded or lazy-loaded?
2. Is there a cache eviction policy?
3. What's the max cache size?

**Recommendation**:
```javascript
// Implement LRU cache with size limits
class SampleCache {
    constructor(maxSizeMB = 100) {
        this.cache = new Map();
        this.lru = new LRUQueue();
        this.currentSize = 0;
        this.maxSize = maxSizeMB * 1024 * 1024;
    }

    add(key, buffer) {
        const size = buffer.length * 4; // Float32 = 4 bytes

        // Evict old samples if needed
        while (this.currentSize + size > this.maxSize) {
            this.evictOldest();
        }

        this.cache.set(key, buffer);
        this.lru.push(key);
        this.currentSize += size;
    }
}
```

**Impact**: Prevent memory bloat with large sample libraries

---

### 3.3 Playback Manager Optimization 🎼

**File**: `client/src/lib/core/PlaybackManager.js` (1853 lines - largest file!)

**Potential Issues**:
- Large file size indicates complex logic
- Event scheduling overhead
- Note scheduling precision

**Recommendations**:
1. **Profile event scheduling** - Is `scheduleEvent()` being called excessively?
2. **Batch note scheduling** - Schedule multiple notes in one pass
3. **Consider splitting** - Break into smaller modules:
   ```
   PlaybackManager.js
   ├── NoteScheduler.js
   ├── AutomationScheduler.js
   ├── AudioClipScheduler.js
   └── TransportSync.js
   ```

---

## 📊 Phase 4: Monitoring & Metrics (2-3 hours)

### 4.1 Performance Monitoring Dashboard 📈

**Current**:
```javascript
// NativeAudioEngine.js
this.metrics = {
    instrumentsCreated: 0,
    channelsCreated: 0,
    effectsCreated: 0,
    activeVoices: 0,
    cpuUsage: 0,
    audioLatency: 0,
    dropouts: 0,
    lastUpdateTime: 0
};
```

**Good foundation!** ✅

**Enhancement**:
```javascript
// Add real-time monitoring:
class PerformanceMonitor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.startMonitoring();
    }

    startMonitoring() {
        setInterval(() => {
            const stats = {
                cpuLoad: this.measureCPULoad(),
                memoryUsage: performance.memory?.usedJSHeapSize || 0,
                audioLatency: this.audioContext.outputLatency || 0,
                bufferUnderruns: this.detectUnderruns(),
                activeWorklets: this.countActiveWorklets()
            };

            // Emit to UI
            eventBus.emit('performance:stats', stats);
        }, 1000);
    }
}
```

**UI Integration**: Add performance overlay (dev mode)

---

### 4.2 Worklet Health Monitoring 🏥

**Problem**: Worklets can fail silently

**Solution**:
```javascript
// Monitor worklet processor errors
class WorkletHealthMonitor {
    monitorWorklet(workletNode) {
        workletNode.port.onmessage = (event) => {
            if (event.data.type === 'error') {
                console.error('Worklet error:', event.data);
                // Attempt recovery
                this.restartWorklet(workletNode);
            }
        };
    }
}
```

**Files**:
- `client/src/lib/audio/ImprovedWorkletManager.js` (already has error tracking!)
- Add recovery mechanisms

---

## 🎯 Priority Matrix

### HIGH PRIORITY (Do First)
1. ✅ **Remove unused worklets** (15 min)
2. ✅ **Verify voice pooling in VASynth** (30 min)
3. ⚠️ **Profile PlaybackManager** (1 hour)

### MEDIUM PRIORITY (Next Sprint)
4. ⚙️ **Granular density auto-scaling** (2 hours)
5. 🔗 **Effect bypass optimization** (2 hours)
6. 📊 **Performance monitoring UI** (3 hours)

### LOW PRIORITY (Future)
7. 💾 **Sample cache LRU** (4 hours)
8. 🎚️ **User latency settings** (2 hours)

---

## 📏 Success Metrics

### Before Optimization:
```
CPU Usage: 20-45%
Memory: 11-51MB
Grain Count: 48/sec (fixed from 200/sec bug)
Worklet Files: 24
Dead Code: ~5 files
```

### After Optimization (Target):
```
CPU Usage: 15-35% (-25% improvement)
Memory: 10-40MB (with LRU cache)
Grain Count: Dynamic (auto-scaled)
Worklet Files: 19 (-5 unused)
Dead Code: 0 files
Performance Monitoring: Real-time dashboard
```

---

## 🛠️ Tools & Commands

### Performance Profiling
```bash
# Chrome DevTools:
1. Open Performance tab
2. Record while playing complex pattern
3. Look for long tasks (>50ms)
4. Check AudioWorklet thread activity

# Memory Profiling:
1. Open Memory tab
2. Take heap snapshot
3. Look for detached nodes
4. Check sample buffer retention
```

### Code Analysis
```bash
# Find dead code:
grep -r "TODO\|FIXME\|XXX" client/src/lib/

# Find large files:
find client/src/lib -name "*.js" -exec wc -l {} + | sort -rn | head -20

# Find unused exports:
npx depcheck client/
```

---

## 📝 Notes

- **Architecture is solid** ✅
- **Worklet usage is correct** ✅ (effects only, not instruments)
- **Main optimization**: Remove dead code, add monitoring
- **No major refactoring needed** - current design is sound

**Author**: AI Assistant
**Date**: 2025-10-19
**Status**: Ready for implementation
