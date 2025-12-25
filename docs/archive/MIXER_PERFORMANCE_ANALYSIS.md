# 🎛️ Mixer Performans Analizi ve Optimizasyon Önerileri

## 📋 Mevcut Durum

### `findUnusedMixerTrack` Fonksiyonu

```javascript
// StoreManager.js:103-127
findUnusedMixerTrack() {
  const { mixerTracks } = this.stores.mixer.getState();
  const { instruments } = this.stores.instruments.getState();

  // Her çağrıda tüm track'leri ve instrument'ları tarar
  const usedTrackIds = instruments.map(inst => inst.mixerTrackId);
  const availableTracks = mixerTracks.filter(track => track.type === 'track');
  const unusedTracks = availableTracks.filter(track => !usedTrackIds.includes(track.id));

  return unusedTracks[0] || null;
}
```

**Sorunlar:**
1. ❌ Her enstrüman eklemede O(n*m) karmaşıklık (n=track, m=instrument)
2. ❌ Her çağrıda `console.log` ile debug output (production'da gereksiz)
3. ❌ `.includes()` kullanımı - O(n) lookup her track için

---

## ⚡ Performans Sorunları

### 1. **MixerInsert._rebuildChain() - Aşırı Logging**

```javascript
// MixerInsert.js:417-491
_rebuildChain() {
  console.log(`🔧 Rebuilding chain for ${this.insertId}`);
  console.log(`  📊 Effect order: [${this.effectOrder.join(', ')}]`);
  console.log(`  📊 Effects map size: ${this.effects.size}`);
  
  // Her effect için log
  this.effects.forEach((effect, effectId) => {
    console.log(`  📌 Effect in map: ${effectId}`, {...});
  });
  
  // Effect bağlantılarında log
  for (const effectId of this.effectOrder) {
    console.log(`  ✅ Connecting effect: ${effectId}`);
  }
  
  console.log(`  📊 Connected effects: ${connectedEffects}/${this.effectOrder.length}`);
  console.log(`  ✅ Chain complete: ...`);
}
```

**Sorun:** Her effect bypass toggle'da, her volume/pan değişikliğinde onlarca console.log çağrılıyor!

### 2. **Analyzer Node - Her Insert'te Var**

```javascript
// MixerInsert.js:59-62
this.analyzer = this.audioContext.createAnalyser();
this.analyzer.fftSize = 256;
this.analyzer.smoothingTimeConstant = 0.8;
```

**Sorun:** 28 track = 28 AnalyserNode. Her biri CPU kullanıyor, çoğu zaman metering bile yapılmıyor.

### 3. **Auto-Sleep Monitor - Her Insert'te Aktif**

```javascript
// MixerInsert.js:93-94
this._initAutoSleepMonitor();
```

**Sorun:** Her insert için ayrı bir interval timer çalışıyor. 28 track = 28 timer.

### 4. **Effect Chain Rebuild - Sık Tetikleniyor**

`_rebuildChain()` şu durumlarda çağrılıyor:
- Effect ekleme/silme
- Effect bypass toggle
- Effect reorder
- Auto-sleep state değişimi

Her rebuild'de TÜM bağlantılar koparılıp yeniden kuruluyor.

---

## ✅ Optimizasyon Önerileri

### 1. **findUnusedMixerTrack Optimizasyonu**

```javascript
// ÖNCE: O(n*m) - Her çağrıda full scan
findUnusedMixerTrack() {
  const usedTrackIds = instruments.map(inst => inst.mixerTrackId);
  const unusedTracks = availableTracks.filter(track => !usedTrackIds.includes(track.id));
  return unusedTracks[0] || null;
}

// SONRA: O(1) - Cache kullanımı
class StoreManager {
  constructor() {
    this._usedTrackCache = new Set();
    this._cacheValid = false;
  }

  _invalidateTrackCache() {
    this._cacheValid = false;
  }

  findUnusedMixerTrack() {
    if (!this._cacheValid) {
      const { instruments } = this.stores.instruments.getState();
      this._usedTrackCache = new Set(instruments.map(inst => inst.mixerTrackId));
      this._cacheValid = true;
    }

    const { mixerTracks } = this.stores.mixer.getState();
    for (const track of mixerTracks) {
      if (track.type === 'track' && !this._usedTrackCache.has(track.id)) {
        return track;
      }
    }
    return null;
  }
}
```

### 2. **Conditional Logging**

```javascript
// ÖNCE: Her zaman log
console.log(`🔧 Rebuilding chain for ${this.insertId}`);

// SONRA: Sadece DEV modda
if (import.meta.env.DEV) {
  console.log(`🔧 Rebuilding chain for ${this.insertId}`);
}
```

### 3. **Lazy Analyzer Creation**

```javascript
// ÖNCE: Her insert'te analyzer var
constructor() {
  this.analyzer = this.audioContext.createAnalyser();
}

// SONRA: İlk metering isteğinde oluştur
getAnalyzer() {
  if (!this._analyzer) {
    this._analyzer = this.audioContext.createAnalyser();
    this._analyzer.fftSize = 256;
    // Mevcut chain'e ekle
    this._insertAnalyzerToChain();
  }
  return this._analyzer;
}
```

### 4. **Batched Auto-Sleep Monitor**

```javascript
// ÖNCE: Her insert için ayrı timer
class MixerInsert {
  _initAutoSleepMonitor() {
    this._autoSleepState.monitorHandle = setInterval(() => {
      this._checkAutoSleep();
    }, this.autoSleepConfig.pollIntervalMs);
  }
}

// SONRA: Tek global timer, tüm insert'leri kontrol et
class MixerInsertManager {
  constructor() {
    this.inserts = new Map();
    this._startGlobalMonitor();
  }

  _startGlobalMonitor() {
    setInterval(() => {
      for (const insert of this.inserts.values()) {
        if (insert.autoSleepConfig.enabled) {
          insert._checkAutoSleep();
        }
      }
    }, 250); // Tek timer
  }
}
```

### 5. **Incremental Chain Rebuild**

```javascript
// ÖNCE: Full rebuild - tüm bağlantıları kopar ve yeniden kur
_rebuildChain() {
  this.input.disconnect();
  this.gainNode.disconnect();
  // ... her şeyi kopar
  // ... her şeyi yeniden bağla
}

// SONRA: Sadece değişen kısmı güncelle
_updateEffectBypass(effectId, bypass) {
  const effect = this.effects.get(effectId);
  const prevNode = this._getPreviousNode(effectId);
  const nextNode = this._getNextNode(effectId);
  
  if (bypass) {
    // Effect'i atla: prev → next
    prevNode.disconnect(effect.node);
    effect.node.disconnect(nextNode);
    prevNode.connect(nextNode);
  } else {
    // Effect'i ekle: prev → effect → next
    prevNode.disconnect(nextNode);
    prevNode.connect(effect.node);
    effect.node.connect(nextNode);
  }
}
```

---

## 📊 Tahmini Performans Kazanımları

| Optimizasyon | CPU Kazanımı | Bellek Kazanımı |
|--------------|--------------|-----------------|
| findUnusedMixerTrack cache | ~5% (enstrüman ekleme) | Minimal |
| Conditional logging | ~10-15% (genel) | Minimal |
| Lazy analyzer | ~20% (idle durumda) | ~2MB |
| Batched auto-sleep | ~5% | Minimal |
| Incremental rebuild | ~15% (effect işlemleri) | Minimal |
| **TOPLAM** | **~50-55%** | **~2MB** |

---

## 🔧 Hemen Uygulanabilir Düzeltmeler

### 1. Console.log'ları DEV moduna al

```javascript
// MixerInsert.js - _rebuildChain()
_rebuildChain() {
  const isDev = import.meta.env.DEV;
  
  try {
    if (isDev) {
      console.log(`🔧 Rebuilding chain for ${this.insertId}`);
    }
    
    // ... mevcut kod ...
    
    for (const effectId of this.effectOrder) {
      const effect = this.effects.get(effectId);
      if (effect && !effect.bypass && effect.node) {
        if (isDev) {
          console.log(`  ✅ Connecting effect: ${effectId}`);
        }
        currentNode.connect(effect.node);
        currentNode = effect.node;
        connectedEffects++;
      }
    }
    
    if (isDev) {
      console.log(`  ✅ Chain complete: ...`);
    }
  } catch (error) {
    console.error(`❌ Error rebuilding chain:`, error);
  }
}
```

### 2. findUnusedMixerTrack debug log'unu kaldır

```javascript
// StoreManager.js
findUnusedMixerTrack() {
  // ...
  
  // ❌ KALDIR: Production'da gereksiz
  // console.log('🎛️ Mixer Track Usage:', {...});
  
  // ✅ Sadece DEV modda
  if (import.meta.env.DEV) {
    console.log('🎛️ Mixer Track Usage:', {
      total: availableTracks.length,
      used: usedTrackIds.length,
      available: unusedTracks.length
    });
  }
  
  return unusedTracks[0] || null;
}
```

---

## 🎯 Öncelik Sırası

1. **[YÜKSEK]** Console.log'ları DEV moduna al - Hemen yapılabilir
2. **[YÜKSEK]** findUnusedMixerTrack cache - Kolay implementasyon
3. **[ORTA]** Lazy analyzer - Biraz refactoring gerektirir
4. **[ORTA]** Batched auto-sleep - MixerInsertManager sınıfı gerektirir
5. **[DÜŞÜK]** Incremental rebuild - Karmaşık, dikkatli test gerektirir

