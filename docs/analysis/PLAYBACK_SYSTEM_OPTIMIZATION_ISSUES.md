# Playback System Optimization Issues

## 🔴 Critical Issues Found

### 1. **DUPLICATE SCHEDULING LOGIC** ⚠️
**Problem:**
- `_scheduleInstrumentNotes` (PlaybackManager) içinde 500+ satır kod var
- `NoteScheduler.scheduleInstrumentNotes` aynı işi yapıyor ama **hiç kullanılmıyor**
- TODO yorumu var: "Complex loop-aware scheduling still handled here for now (TODO: move to NoteScheduler)"
- Bu duplicate logic demek, maintenance nightmare

**Impact:**
- Code duplication (DRY violation)
- Bug fixes iki yerde yapılmalı
- Performance overhead (unused code)
- Confusion about which code path is used

**Location:**
- `client/src/lib/core/PlaybackManager.js:2090-2625` (535 lines)
- `client/src/lib/core/playback/NoteScheduler.js:31-243` (212 lines)

---

### 2. **OVERLAP DETECTION DUPLICATE** ⚠️
**Problem:**
- Hem `NoteScheduler.scheduleInstrumentNotes` içinde overlap detection var (lines 101-163)
- Hem `_scheduleInstrumentNotes` içinde overlap detection var (lines 2298-2341)
- `activeNotesByPitch` Map'i **her çağrıda sıfırlanıyor** (line 2160, 2160)
- Bu yüzden **cross-batch overlap detection çalışmıyor**

**Impact:**
- Farklı batch'lerde schedule edilen notalar arasında overlap tespit edilemez
- Oval note clicks devam edebilir
- Memory waste (duplicate Map instances)

**Example:**
```javascript
// Batch 1: Note at step 0 (length: 20 steps)
_scheduleInstrumentNotes(instrument, [note1], ...); // activeNotesByPitch = {C4: note1}

// Batch 2: Note at step 17 (length: 5 steps) 
_scheduleInstrumentNotes(instrument, [note2], ...); // activeNotesByPitch = {} (SIFIRLANMIŞ!)
// Overlap tespit edilemez çünkü Map sıfırlanmış!
```

---

### 3. **LOOP-AWARE LOGIC NOT IN NoteScheduler** ⚠️
**Problem:**
- `NoteScheduler.scheduleInstrumentNotes` loop-aware değil
- Sadece basit `baseTime + noteTimeInSeconds` kullanıyor
- `_scheduleInstrumentNotes` içinde kompleks loop-aware logic var:
  - Resume detection (line 2098)
  - Position jump detection (line 2099)
  - Loop restart detection (line 2112)
  - Past note handling (line 2196-2226)
  - Loop time adjustment (line 2200)

**Impact:**
- `NoteScheduler` kullanılamıyor çünkü loop-aware değil
- Loop restart'ta notalar yanlış schedule edilebilir
- Resume/pause durumlarında timing hataları

---

### 4. **GEREKSIZ HESAPLAMALAR** ⚠️
**Problem:**
- Her nota için loop hesaplamaları yapılıyor (line 2107-2149)
- `loopLength`, `loopStartTimeInSeconds`, `timeSinceLoopStart` her nota için hesaplanıyor
- Bu değerler cache edilebilir (zaten line 2147'de cache ediliyor ama her nota için tekrar hesaplanıyor)

**Impact:**
- Performance overhead (unnecessary calculations)
- CPU waste

---

### 5. **ACTIVE NOTES MAP SCOPE ISSUE** ⚠️
**Problem:**
- `activeNotesByPitch` Map'i `_scheduleInstrumentNotes` içinde local scope'ta (line 2160)
- Her fonksiyon çağrısında sıfırlanıyor
- Cross-batch overlap detection imkansız

**Impact:**
- Oval note overlap detection sadece aynı batch içindeki notalar için çalışıyor
- Farklı batch'lerdeki notalar arasında overlap tespit edilemez
- Bu yüzden 17. step'teki nota 0. step'teki notayı kesemiyor

---

## ✅ Recommended Solutions

### Solution 1: Use NoteScheduler (Preferred)
1. **Move loop-aware logic to NoteScheduler**
   - Add `currentPosition`, `loopStart`, `loopEnd`, `loopEnabled` parameters
   - Add `reason` parameter for resume/position-jump detection
   - Implement loop-aware time calculation in `NoteScheduler`

2. **Make activeNotesByPitch instance-level**
   - Move `activeNotesByPitch` to `NoteScheduler` constructor
   - Clear only on loop restart or explicit clear
   - This enables cross-batch overlap detection

3. **Remove duplicate code from _scheduleInstrumentNotes**
   - Keep only loop-aware position calculation
   - Delegate actual scheduling to `NoteScheduler.scheduleInstrumentNotes`
   - Reduce `_scheduleInstrumentNotes` from 535 lines to ~50 lines

### Solution 2: Fix activeNotesByPitch Scope (Quick Fix)
1. **Move activeNotesByPitch to PlaybackManager instance**
   - Add `this.activeNotesByPitch = new Map()` in constructor
   - Clear on loop restart only
   - Pass to `_scheduleInstrumentNotes` or use instance variable

2. **Remove duplicate overlap detection from _scheduleInstrumentNotes**
   - Keep only one implementation (preferably in NoteScheduler)
   - Or keep in `_scheduleInstrumentNotes` but use instance-level Map

---

## 📊 Code Metrics

| Metric | Current | After Fix |
|--------|---------|-----------|
| `_scheduleInstrumentNotes` lines | 535 | ~50-100 |
| `NoteScheduler.scheduleInstrumentNotes` lines | 212 | ~250-300 |
| Duplicate overlap detection | 2 places | 1 place |
| activeNotesByPitch scope | Local (broken) | Instance (fixed) |
| Loop-aware logic | 1 place | 1 place (NoteScheduler) |

---

## 🎯 Priority

1. **HIGH**: Fix activeNotesByPitch scope (cross-batch overlap detection)
2. **HIGH**: Remove duplicate overlap detection
3. **MEDIUM**: Move loop-aware logic to NoteScheduler
4. **LOW**: Cache loop calculations (already partially done)

---

## 🔍 Related Files

- `client/src/lib/core/PlaybackManager.js` (line 2090-2625)
- `client/src/lib/core/playback/NoteScheduler.js` (line 31-243)
- `client/src/lib/core/NativeTransportSystem.js` (scheduling system)

---

## 📝 Notes

- `NoteScheduler` was created for modularity but never fully integrated
- The TODO comment at line 2092 indicates this was known but not fixed
- Current implementation works but is inefficient and has bugs (cross-batch overlap)
- Quick fix: Move `activeNotesByPitch` to instance level
- Long-term fix: Fully integrate `NoteScheduler` with loop-aware logic

