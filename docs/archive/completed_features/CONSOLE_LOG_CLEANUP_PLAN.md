# 🧹 Console Log Cleanup Plan

**Goal:** Reduce console noise from ~200 logs to ~20 essential logs

---

## 🎯 Priority 1: Remove Development-Only Helpers

### 1. Disable Demo/Test Helpers in Production

**Files:**
- `client/src/dev/performanceHelpers.js`
- `client/src/dev/UnifiedMixerDemo.js`
- `client/src/dev/wasmHelpers.js`

**Action:** Wrap all console.log in environment check:
```javascript
if (import.meta.env.DEV) {
    console.log('...');
}
```

**Impact:** -10 logs

---

### 2. Make Sample Analyzer Conditional

**File:** `client/src/lib/audio/sampleAnalyzer.js`

**Change:**
```javascript
// Only analyze in dev or when explicitly enabled
export function analyzeAllSamples(samples) {
    if (!import.meta.env.DEV && !window.enableSampleAnalysis) {
        return; // Skip in production
    }
    // ... analysis code
}
```

**Impact:** -50+ logs (all the sample analysis)

---

## 🎯 Priority 2: Consolidate Repetitive Logs

### 3. Batch MixerInsert Creation

**File:** `client/src/App.jsx:151-157`

**Before:**
```javascript
for (const track of tracks) {
    const insert = await createMixerInsert(track);
    console.log(`✅ Created mixer insert: ${track.id} (${track.name})`);
}
```

**After:**
```javascript
const inserts = [];
for (const track of tracks) {
    const insert = await createMixerInsert(track);
    inserts.push(track.name);
}
console.log(`✅ Created ${inserts.length} mixer inserts: ${inserts.slice(0, 3).join(', ')}${inserts.length > 3 ? '...' : ''}`);
```

**Impact:** -20 logs → 1 log

---

### 4. Batch Instrument Creation

**File:** `client/src/lib/core/NativeAudioEngine.js`

**Change:**
```javascript
// Remove individual instrument creation logs
// Keep only summary
console.log(`✅ Instruments initialized: ${instrumentCount} total`);
```

**Impact:** -40 logs → 1 log

---

### 5. Remove Routing Redundancy

**File:** `client/src/lib/core/MixerInsert.js:65,228`

**Remove:**
```javascript
console.log(`🔗 Connected instrument ${id} → ${trackId}`);
console.log(`🔗 ${trackId} → master bus`);
```

**Reason:** Already logged in NativeAudioEngine

**Impact:** -40 logs

---

### 6. Silence Voice/Pool Creation

**Files:**
- `client/src/lib/instruments/voice/VoicePool.js:32`
- `client/src/lib/instruments/voice/VoiceAllocator.js:25`
- `client/src/lib/instruments/voice/16VASynthVoice.js:117`

**Change:** Only log in dev mode
```javascript
if (import.meta.env.DEV) {
    console.log(`🎵 VoicePool created: ...`);
}
```

**Impact:** -30 logs

---

## 🎯 Priority 3: Make UI Logs Conditional

### 7. Canvas Resize Events

**Files:**
- `client/src/features/channel_rack/ChannelRack.jsx`
- `client/src/features/arrangement_v2/components/TimelineCanvas.jsx`
- `client/src/components/ui/UnifiedGridContainer.jsx`

**Change:** Only log on error or in verbose mode
```javascript
if (import.meta.env.DEV && window.verboseUI) {
    console.log('🔄 Canvas resized...');
}
```

**Impact:** -15 logs

---

### 8. Theme Changes

**File:** `client/src/styles/ThemeProvider.jsx:29`

**Change:**
```javascript
// Only log initial theme load, not every change
if (!this.themeInitialized) {
    console.log(`🎨 Theme applied: ${themeName}`);
    this.themeInitialized = true;
}
```

**Impact:** -5 logs

---

## 🎯 Priority 4: Keep Essential Logs

### ✅ KEEP These (Important for debugging):

1. **Critical Errors**
   ```javascript
   console.error('❌ Failed to initialize...');
   ```

2. **System Initialization**
   ```javascript
   console.log('🚀 Ses sistemi başlatılıyor...');
   console.log('✅ AudioContextService ready');
   console.log('✅ UnifiedMixer initialized: 32 channels');
   ```

3. **Performance Warnings**
   ```javascript
   console.warn('⚠️ High CPU usage detected');
   ```

4. **Audio Engine State Changes**
   ```javascript
   console.log('▶️ Playback started');
   console.log('⏸️ Playback paused');
   ```

---

## 📊 Expected Results

### Before:
```
~200 logs on startup
~50 logs per interaction
```

### After:
```
~15-20 logs on startup
~3-5 logs per interaction
```

---

## 🚀 Implementation Order

### Phase 1 (Quick Wins - 10 min):
1. ✅ Disable development helpers
2. ✅ Disable sample analyzer in production
3. ✅ Remove routing redundancy

**Impact:** -100 logs

### Phase 2 (Consolidation - 20 min):
4. ✅ Batch MixerInsert creation
5. ✅ Batch Instrument creation
6. ✅ Silence voice/pool creation

**Impact:** -80 logs

### Phase 3 (Polish - 10 min):
7. ✅ Make UI logs conditional
8. ✅ Reduce theme logs

**Impact:** -20 logs

---

## 💡 Best Practices Going Forward

### Use Log Levels:
```javascript
const LOG_LEVELS = {
    ERROR: 0,   // Always show
    WARN: 1,    // Production warnings
    INFO: 2,    // Key milestones
    DEBUG: 3,   // Development only
    TRACE: 4    // Verbose debugging
};

const currentLevel = import.meta.env.DEV ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

function log(level, ...args) {
    if (level <= currentLevel) {
        console.log(...args);
    }
}
```

### Use Environment Variables:
```javascript
// vite.config.js
define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __VERBOSE__: JSON.stringify(process.env.VERBOSE === 'true')
}
```

### Use Console Groups for Related Logs:
```javascript
if (__DEV__) {
    console.group('🎵 Instrument Loading');
    // ... multiple logs
    console.groupEnd();
}
```

---

**Status:** 📋 Plan Ready
**Estimated Time:** 40 minutes
**Priority:** High (reduces cognitive load significantly)
