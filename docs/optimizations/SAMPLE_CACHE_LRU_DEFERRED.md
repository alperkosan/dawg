# Sample Cache LRU Policy - Deferred to Future Version

**Status**: 📋 Planned for future release
**Priority**: Medium
**Estimated Time**: 4 hours
**Date Noted**: 2025-10-19

---

## Why Deferred?

Bu optimizasyon şu anda gerekli değil çünkü:
- Mevcut proje boyutu küçük-orta ölçekli
- Sample sayısı henüz hafıza sorununa yol açacak seviyede değil
- Kullanıcılar büyük kütüphanelerle çalışmıyor (henüz)

**Gelecekte gerekli olacak**:
- ✅ 100+ sample yüklendiğinde
- ✅ Büyük kütüphaneler import edildiğinde (örn: 1GB+ sample library)
- ✅ Uzun mixing session'larda RAM kullanımı artarsa
- ✅ Kullanıcılar hafıza sızıntısı rapor ederse

---

## Planned Implementation

### Problem
```
Current behavior:
1. Sample loaded → AudioBuffer created → Stored in cache
2. Sample never removed from cache (even if unused)
3. Memory grows indefinitely
4. Browser crash at ~2GB RAM usage
```

### Solution: LRU (Least Recently Used) Cache

```javascript
class SampleCacheLRU {
    constructor(maxSizeBytes = 500 * 1024 * 1024) { // 500MB default
        this.cache = new Map();
        this.accessOrder = []; // Track access order
        this.maxSize = maxSizeBytes;
        this.currentSize = 0;
    }

    get(key) {
        if (!this.cache.has(key)) return null;

        // Mark as recently used
        this._updateAccessOrder(key);
        return this.cache.get(key);
    }

    set(key, audioBuffer) {
        const bufferSize = this._calculateBufferSize(audioBuffer);

        // Evict old samples if needed
        while (this.currentSize + bufferSize > this.maxSize) {
            this._evictLRU();
        }

        this.cache.set(key, audioBuffer);
        this.currentSize += bufferSize;
        this._updateAccessOrder(key);
    }

    _evictLRU() {
        // Remove least recently used sample
        const lruKey = this.accessOrder.shift();
        const buffer = this.cache.get(lruKey);

        this.currentSize -= this._calculateBufferSize(buffer);
        this.cache.delete(lruKey);

        console.log(`🗑️ Evicted LRU sample: ${lruKey}`);
    }

    _calculateBufferSize(audioBuffer) {
        // bytes = channels × length × 4 (Float32)
        return audioBuffer.numberOfChannels * audioBuffer.length * 4;
    }

    _updateAccessOrder(key) {
        // Remove from current position
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        // Add to end (most recent)
        this.accessOrder.push(key);
    }
}
```

### Integration Points

**Files to modify**:
1. `client/src/lib/audio/AudioAssetManager.js` - Replace current cache
2. `client/src/lib/core/PerformanceMonitor.js` - Track cache stats
3. `client/src/store/useInstrumentsStore.js` - Handle eviction callbacks

**Settings to add**:
```javascript
// User configurable via Settings panel
sampleCacheSettings: {
    maxSizeBytes: 500 * 1024 * 1024, // 500MB
    evictionPolicy: 'lru', // 'lru' | 'fifo' | 'manual'
    minKeepSamples: 10, // Always keep N most recent
}
```

---

## Performance Impact (Expected)

### Before LRU
```
Timeline:
0min:  50MB RAM (10 samples)
30min: 200MB RAM (40 samples)
60min: 500MB RAM (100 samples)
90min: 1.2GB RAM (240 samples)
120min: CRASH! (Browser OOM)
```

### After LRU (500MB limit)
```
Timeline:
0min:  50MB RAM (10 samples)
30min: 200MB RAM (40 samples)
60min: 500MB RAM (100 samples, cache full)
90min: 500MB RAM (100 samples, auto-evicting)
120min: 500MB RAM (100 samples, stable!)
∞:     500MB RAM (never crashes!)
```

**Result**: Infinite session length without crash!

---

## Testing Checklist (For Future)

When implementing, test:
- [ ] Load 200+ samples
- [ ] Verify old samples evicted
- [ ] Check RAM stays under limit
- [ ] Ensure active instruments never evicted
- [ ] Test reload performance (cache miss)
- [ ] Performance Monitor shows cache stats
- [ ] User settings work correctly

---

## Performance Monitor Integration

**Add to PerformanceOverlay**:
```jsx
<div className="metric-group">
  <div className="metric-label">Sample Cache</div>
  <div className="metric-value">
    {metrics.cacheUsed}MB / {metrics.cacheMax}MB
  </div>
  <ProgressBar
    value={metrics.cachePercent}
    warning={70}
    critical={90}
  />
  <div className="metric-subtext">
    {metrics.cachedSamples} samples, {metrics.evictions} evictions
  </div>
</div>
```

---

## When to Implement

**Trigger conditions** (implement when ANY is true):
1. User reports "browser crashed after long session"
2. Memory usage consistently exceeds 1GB
3. Large sample library support requested (1000+ samples)
4. Performance Monitor shows memory warnings frequently

**Estimated timeline**: Version 1.2 or 1.3

---

## Alternative Solutions (Lower priority)

1. **Manual Cache Clear Button**
   - User clicks "Clear Sample Cache" in Settings
   - Simpler but requires user action
   - Good stopgap solution

2. **Streaming from Disk**
   - Load samples on-demand, don't cache
   - Better for HUGE libraries (10GB+)
   - More complex, higher latency

3. **Compressed Audio Storage**
   - Store MP3/OGG, decode on play
   - Reduces RAM but increases CPU
   - Not recommended for DAW (CPU > RAM)

---

## Notes

- Current architecture already supports this (AudioAssetManager is isolated)
- Implementation is straightforward (4 hours estimate accurate)
- No breaking changes to existing code
- Can be added incrementally without rewrite

**Decision**: Wait for actual need before implementing. YAGNI principle.

---

**Related Documents**:
- [OPTIMIZATION_PLAN.md](../OPTIMIZATION_PLAN.md) - Original optimization roadmap
- [OPTIMIZATION_RESULTS.md](../OPTIMIZATION_RESULTS.md) - Completed optimizations
- [EFFECT_BYPASS_OPTIMIZATION_COMPLETE.md](../../EFFECT_BYPASS_OPTIMIZATION_COMPLETE.md) - Latest completed optimization

**Status**: 📋 Tracked, ready to implement when needed
