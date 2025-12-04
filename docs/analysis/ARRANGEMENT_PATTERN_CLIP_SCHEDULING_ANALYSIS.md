# Arrangement Pattern Clip Scheduling - Kapsamlı Analiz

## 📋 İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [Scheduling Akışı](#scheduling-akışı)
3. [Timing Hesaplamaları](#timing-hesaplamaları)
4. [Pattern Loop Mantığı](#pattern-loop-mantığı)
5. [Split Clip Desteği (patternOffset)](#split-clip-desteği-patternoffset)
6. [Instrument Loading](#instrument-loading)
7. [Potansiyel Sorunlar](#potansiyel-sorunlar)
8. [İyileştirme Önerileri](#iyileştirme-önerileri)

---

## Genel Bakış

Arrangement panelinde pattern clip'lerin schedule edilmesi, `PlaybackManager._scheduleSongContent()` metodunda gerçekleşir. Bu sistem:

- **Pattern clip'leri** arrangement timeline'ında doğru zamanlarda çalar
- **Pattern loop** desteği sağlar (clip duration > pattern length)
- **Split clip** desteği sağlar (patternOffset ile)
- **Track mute/solo** durumlarını kontrol eder
- **Instrument loading** yapar (gerekirse)

### Ana Bileşenler

```javascript
// PlaybackManager.js - _scheduleSongContent()
async _scheduleSongContent(baseTime, options = {}) {
    // 1. Store'dan clips ve tracks al
    // 2. Solo/mute kontrolü yap
    // 3. Her clip için:
    //    - Pattern clip ise: pattern notalarını schedule et
    //    - Audio clip ise: audio buffer'ı schedule et
}
```

---

## Scheduling Akışı

### 1. Clip ve Track Yükleme

```javascript
// useArrangementStore'dan arrangement clips/tracks al
const arrangementClips = arrangementStore.arrangementClips || [];
const arrangementTracks = arrangementStore.arrangementTracks || [];
const patterns = arrangementStore.patterns || {};
```

**Fallback Mekanizması:**
- Önce `arrangementClips` ve `arrangementTracks` kontrol edilir (yeni sistem)
- Yoksa `useArrangementWorkspaceStore`'dan alınır (eski sistem)

### 2. Track Filtreleme (Mute/Solo)

```javascript
// Solo track kontrolü
const soloTracks = tracks.filter(t => t.solo);
const hasSolo = soloTracks.length > 0;

// Her clip için:
if (track.muted) continue;  // Mute edilmiş track'teki clip'leri atla
if (hasSolo && !track.solo) continue;  // Solo varsa, solo olmayan track'leri atla
```

### 3. Pattern Clip Scheduling

```javascript
if (clip.type === 'pattern') {
    const pattern = patterns[clip.patternId];
    if (!pattern) continue;
    
    // Timing hesaplamaları
    const clipStartStep = Math.floor((clip.startTime || 0) * 4);
    const clipDurationSteps = (clip.duration || pattern.length || 4) * 4;
    const patternOffset = clip.patternOffset || 0;
    
    // Pattern length hesaplama
    let patternLengthSteps = pattern.length ? pattern.length * 4 : 64;
    
    // Her instrument için notaları schedule et
    for (const [instrumentId, notes] of Object.entries(pattern.data)) {
        // Instrument loading (gerekirse)
        // Pattern loop mantığı
        // Nota filtering ve timing adjustment
        // Schedule et
    }
}
```

---

## Timing Hesaplamaları

### Birim Dönüşümleri

```javascript
// 1 beat = 4 sixteenth notes (steps)
// 1 bar = 4 beats = 16 steps

const clipStartStep = Math.floor((clip.startTime || 0) * 4);
const clipDurationSteps = (clip.duration || 4) * 4;
```

**Örnek:**
- `clip.startTime = 4` (beats) → `clipStartStep = 16` (steps)
- `clip.duration = 8` (beats) → `clipDurationSteps = 32` (steps)

### Pattern Length Hesaplama

```javascript
let patternLengthSteps = 64; // Default 4 bars

if (pattern.length) {
    // pattern.length is in beats, convert to steps
    patternLengthSteps = pattern.length * 4;
} else {
    // Calculate from notes if length not available
    let maxStep = 0;
    Object.values(pattern.data || {}).forEach(notes => {
        if (Array.isArray(notes)) {
            notes.forEach(note => {
                const noteTime = note.time || 0;
                maxStep = Math.max(maxStep, noteTime);
            });
        }
    });
    if (maxStep > 0) {
        // Round up to nearest bar (16 steps)
        patternLengthSteps = Math.max(64, Math.ceil(maxStep / 16) * 16);
    }
}
```

**Önemli Notlar:**
- Pattern length **beats** cinsinden saklanır
- Steps'e çevirmek için `* 4` yapılır
- Eğer `pattern.length` yoksa, notalardan hesaplanır
- En az 64 step (4 bar) olarak yuvarlanır

---

## Pattern Loop Mantığı

### Problem

Pattern clip'in duration'ı pattern length'ten uzunsa, pattern'in **loop** etmesi gerekir.

**Örnek:**
- Pattern length: 64 step (4 bar)
- Clip 1: step 0-63 → pattern 0-63 ✅
- Clip 2: step 64-127 → pattern 0-63, ama 64-127'ye offset'lenmeli ✅

### Çözüm: Loop Iterasyonları

```javascript
const offsetNotes = [];

// Calculate how many pattern loops we need to cover the clip duration
const effectivePatternStart = patternOffset % patternLengthSteps;
const effectivePatternEnd = effectivePatternStart + clipDurationSteps;
const numLoops = Math.ceil(effectivePatternEnd / patternLengthSteps);

for (let loopIndex = 0; loopIndex < numLoops; loopIndex++) {
    const loopStartStep = loopIndex * patternLengthSteps;
    
    // Filter notes that fall within this loop iteration and clip range
    notes.forEach(note => {
        const noteTime = note.time || 0;
        const noteTimeInLoop = noteTime + loopStartStep;
        
        // Check if note falls within the effective pattern range
        if (noteTimeInLoop >= effectivePatternStart && 
            noteTimeInLoop < effectivePatternEnd) {
            
            // Calculate final note time in arrangement timeline
            const relativeNoteTime = noteTimeInLoop - effectivePatternStart;
            const finalNoteTime = relativeNoteTime + clipStartStep;
            
            offsetNotes.push({
                ...note,
                time: finalNoteTime
            });
        }
    });
}
```

### Örnek Senaryo

**Pattern:**
- Length: 64 steps (4 bars)
- Piano notaları: step 0, 12, 16, 20, 24, 28, 32, 44, 48, 52, 56, 60

**Clip 1:**
- `clipStartStep = 0`
- `clipDurationSteps = 64`
- `patternOffset = 0`
- `effectivePatternStart = 0`
- `effectivePatternEnd = 64`
- `numLoops = 1`
- **Sonuç:** Tüm piano notaları schedule edilir (step 0-63)

**Clip 2:**
- `clipStartStep = 64`
- `clipDurationSteps = 64`
- `patternOffset = 0`
- `effectivePatternStart = 0`
- `effectivePatternEnd = 64`
- `numLoops = 1`
- **Loop 0:** `loopStartStep = 0`
  - Piano notaları (0, 12, 16, ...) → `noteTimeInLoop = 0, 12, 16, ...`
  - `finalNoteTime = 0 + 64 = 64, 12 + 64 = 76, 16 + 64 = 80, ...`
- **Sonuç:** Tüm piano notaları schedule edilir (step 64-127) ✅

---

## Split Clip Desteği (patternOffset)

### Konsept

Pattern clip split edildiğinde, sağ taraftaki clip pattern'in **ortasından** başlamalı.

**Örnek:**
- Pattern: 64 step (4 bar)
- Clip: step 0-63 (4 bar)
- Split point: step 32 (2. bar)
- **Left clip:** step 0-31, `patternOffset = 0` (pattern'in başından)
- **Right clip:** step 32-63, `patternOffset = 32` (pattern'in ortasından)

### Split İşlemi

```javascript
// useArrangementStore.js - splitArrangementClip()
if (clip.type === 'pattern') {
    // Convert split point from beats to steps
    const splitPointSteps = Math.floor(splitPoint * 4);
    const currentPatternOffset = clip.patternOffset || 0;
    
    // Right clip starts from split point in pattern
    rightClip.patternOffset = currentPatternOffset + splitPointSteps;
    
    // Left clip keeps original patternOffset
    leftClip.patternOffset = currentPatternOffset;
}
```

### Scheduling'de Kullanımı

```javascript
// Pattern loop mantığında patternOffset kullanımı
const effectivePatternStart = patternOffset % patternLengthSteps;
const effectivePatternEnd = effectivePatternStart + clipDurationSteps;

// Notes are filtered based on effectivePatternStart
if (noteTimeInLoop >= effectivePatternStart && 
    noteTimeInLoop < effectivePatternEnd) {
    // Schedule this note
}
```

**Örnek Senaryo:**

**Pattern:**
- Length: 64 steps
- Piano notaları: step 0, 12, 16, 20, 24, 28, 32, 44, 48, 52, 56, 60

**Split Clip (Right):**
- `clipStartStep = 32`
- `clipDurationSteps = 32`
- `patternOffset = 32` (split point)
- `effectivePatternStart = 32`
- `effectivePatternEnd = 64`
- **Sonuç:** Sadece step 32-63 arasındaki notalar schedule edilir (32, 44, 48, 52, 56, 60)

---

## Instrument Loading

### Problem

Pattern'deki bir instrument, audio engine'de yüklü olmayabilir.

### Çözüm: Async Instrument Loading

```javascript
let instrument = this.audioEngine.instruments.get(instrumentId);
if (!instrument) {
    console.warn(`🎵 ❌ Instrument ${instrumentId} not found in audio engine, attempting to load...`);
    
    try {
        // Get instrument from store
        const { useInstrumentsStore } = await import('@/store/useInstrumentsStore');
        const instrumentsStore = useInstrumentsStore.getState();
        const instrumentData = instrumentsStore.instruments.find(inst => inst.id === instrumentId);
        
        if (instrumentData) {
            // Load instrument into audio engine
            const { AudioContextService } = await import('@/lib/services/AudioContextService');
            await AudioContextService._syncInstrumentsToMixerInserts();
            
            // Try again after sync
            instrument = this.audioEngine.instruments.get(instrumentId);
            if (instrument) {
                console.log(`✅ Instrument ${instrumentId} loaded successfully`);
            } else {
                console.error(`❌ Failed to load instrument ${instrumentId} after sync`);
                continue; // Skip this instrument
            }
        } else {
            console.error(`❌ Instrument ${instrumentId} not found in store either`);
            continue; // Skip this instrument
        }
    } catch (error) {
        console.error(`❌ Error loading instrument ${instrumentId}:`, error);
        continue; // Skip this instrument
    }
}
```

**Önemli Notlar:**
- `_scheduleSongContent()` **async** olmalı (await için)
- `for...of` loop kullanılmalı (forEach async desteklemez)
- Instrument bulunamazsa, o instrument'in notaları **atlanır** (hata fırlatılmaz)

---

## Potansiyel Sorunlar

### 1. ❌ `rescheduleClipEvents()` Pattern Loop Eksik

**Sorun:**
`rescheduleClipEvents()` metodunda pattern loop mantığı **yok**. Sadece basit filtering yapılıyor:

```javascript
// ❌ Eski kod (loop yok)
const offsetNotes = notes
    .filter(note => {
        const noteTime = note.time || 0;
        return noteTime >= patternOffset && noteTime < (patternOffset + clipDurationSteps);
    })
    .map(note => ({
        ...note,
        time: (note.time || 0) - patternOffset + clipStartStep
    }));
```

**Etki:**
- Clip duration > pattern length ise, pattern loop etmez
- İkinci clip'te notalar çalmaz (5. bar sorunu)

**Çözüm:**
`rescheduleClipEvents()` metoduna da pattern loop mantığı eklenmeli.

### 2. ⚠️ Pattern Length Hesaplama Tutarsızlığı

**Sorun:**
Pattern length hesaplama mantığı farklı yerlerde farklı:

- `_scheduleSongContent()`: `pattern.length * 4` veya notalardan hesaplama
- `rescheduleClipEvents()`: Pattern length kullanılmıyor (sadece `clip.duration`)
- `_calculatePatternLoop()`: `Math.max(64, Math.ceil(maxStep / 16) * 16)`

**Etki:**
- Farklı yerlerde farklı pattern length değerleri kullanılabilir
- Loop hesaplamaları yanlış olabilir

**Çözüm:**
Pattern length hesaplama mantığı **merkezi bir utility function**'a taşınmalı.

### 3. ⚠️ Pattern Offset Modulo İşlemi

**Sorun:**
```javascript
const effectivePatternStart = patternOffset % patternLengthSteps;
```

Bu işlem, `patternOffset > patternLengthSteps` durumunda doğru çalışır, ama **split clip'lerde** genelde `patternOffset < patternLengthSteps` olur.

**Etki:**
- Genelde sorun yok, ama edge case'lerde problem olabilir

**Çözüm:**
Modulo işlemi doğru, ama daha açıklayıcı yorumlar eklenebilir.

### 4. ⚠️ Debug Logging Performansı

**Sorun:**
Piano için veya `patternOffset > 0` durumunda her zaman log atılıyor:

```javascript
if (instrumentId === 'piano' || offsetNotes.length !== notes.length || patternOffset > 0) {
    console.log(`🎵 [${instrumentId}] Pattern clip ${clip.id} note filtering:`, {
        // ... büyük obje
    });
}
```

**Etki:**
- Production'da gereksiz log'lar
- Performans etkisi minimal ama yine de

**Çözüm:**
Debug flag ile kontrol edilmeli veya sadece development'ta log atılmalı.

---

## İyileştirme Önerileri

### 1. ✅ Pattern Loop Mantığını `rescheduleClipEvents()`'e Ekle

```javascript
rescheduleClipEvents(clip) {
    // ... existing code ...
    
    if (clip.type === 'pattern') {
        // ✅ Pattern loop mantığını ekle (aynı _scheduleSongContent'teki gibi)
        const patternLengthSteps = pattern.length ? pattern.length * 4 : 64;
        const effectivePatternStart = patternOffset % patternLengthSteps;
        const effectivePatternEnd = effectivePatternStart + clipDurationSteps;
        const numLoops = Math.ceil(effectivePatternEnd / patternLengthSteps);
        
        // ... loop logic ...
    }
}
```

### 2. ✅ Pattern Length Utility Function

```javascript
// utils/patternUtils.js
export function calculatePatternLengthSteps(pattern) {
    if (pattern.length) {
        return pattern.length * 4; // beats to steps
    }
    
    // Calculate from notes
    let maxStep = 0;
    Object.values(pattern.data || {}).forEach(notes => {
        if (Array.isArray(notes)) {
            notes.forEach(note => {
                const noteTime = note.time || 0;
                maxStep = Math.max(maxStep, noteTime);
            });
        }
    });
    
    if (maxStep > 0) {
        return Math.max(64, Math.ceil(maxStep / 16) * 16);
    }
    
    return 64; // Default
}
```

### 3. ✅ Pattern Loop Logic'i Extract Et

```javascript
// PlaybackManager.js
_schedulePatternNotesWithLoop(pattern, clip, baseTime, reason) {
    const clipStartStep = Math.floor((clip.startTime || 0) * 4);
    const clipDurationSteps = (clip.duration || pattern.length || 4) * 4;
    const patternOffset = clip.patternOffset || 0;
    const patternLengthSteps = calculatePatternLengthSteps(pattern);
    
    // ... loop logic ...
    
    return offsetNotes;
}
```

### 4. ✅ Debug Logging Kontrolü

```javascript
const DEBUG_PATTERN_SCHEDULING = process.env.NODE_ENV === 'development';

if (DEBUG_PATTERN_SCHEDULING && (instrumentId === 'piano' || ...)) {
    console.log(...);
}
```

### 5. ✅ Error Handling İyileştirmesi

```javascript
// Instrument loading başarısız olursa, daha detaylı hata mesajı
if (!instrument) {
    console.error(`❌ Instrument ${instrumentId} not found:`, {
        clipId: clip.id,
        patternId: clip.patternId,
        instrumentId,
        availableInstruments: Array.from(this.audioEngine.instruments.keys())
    });
    continue;
}
```

---

## Test Senaryoları

### Senaryo 1: Basit Pattern Clip
- **Pattern:** 64 step, piano notaları step 0-63
- **Clip:** step 0-63, duration 4 bar
- **Beklenen:** Tüm piano notaları çalınmalı

### Senaryo 2: Pattern Loop
- **Pattern:** 64 step, piano notaları step 0-63
- **Clip 1:** step 0-63, duration 4 bar
- **Clip 2:** step 64-127, duration 4 bar
- **Beklenen:** Her iki clip'te de tüm piano notaları çalınmalı

### Senaryo 3: Split Clip
- **Pattern:** 64 step, piano notaları step 0-63
- **Clip:** step 0-63, duration 4 bar
- **Split:** step 32'de
- **Left Clip:** step 0-31, `patternOffset = 0`
- **Right Clip:** step 32-63, `patternOffset = 32`
- **Beklenen:** 
  - Left clip: step 0-31 arası notalar
  - Right clip: step 32-63 arası notalar

### Senaryo 4: Uzun Clip (Multiple Loops)
- **Pattern:** 64 step, piano notaları step 0-63
- **Clip:** step 0-127, duration 8 bar
- **Beklenen:** Pattern 2 kez loop etmeli, tüm notalar 2 kez çalınmalı

### Senaryo 5: Missing Instrument
- **Pattern:** 64 step, piano notaları (piano instrument yok)
- **Clip:** step 0-63
- **Beklenen:** Piano notaları atlanmalı, hata fırlatılmamalı, diğer instrument'ler çalınmalı

---

## Sonuç

Arrangement pattern clip scheduling sistemi **genel olarak iyi çalışıyor**, ancak:

1. ✅ **Pattern loop mantığı** eklendi (5. bar sorunu çözüldü)
2. ⚠️ **`rescheduleClipEvents()`** metoduna da loop mantığı eklenmeli
3. ⚠️ **Pattern length hesaplama** merkezi bir utility'ye taşınmalı
4. ⚠️ **Debug logging** production'da kapatılmalı

Bu iyileştirmeler yapıldığında, sistem daha **tutarlı** ve **maintainable** olacak.




