# 🎛️ Mixer İleri Seviye Optimizasyon Planı

## 📊 Mevcut Durum Analizi

### 1. Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MEVCUT MİXER MİMARİSİ                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   Instruments   │───▶│  MixerInserts   │───▶│   Master Bus    │ │
│  │  (NativeAudio)  │    │  (Per-Track)    │    │  (MixerInsert)  │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│         │                      │                      │            │
│         ▼                      ▼                      ▼            │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │ InstrumentStore │    │   MixerStore    │    │ AudioContext    │ │
│  │   (Zustand)     │◀──▶│   (Zustand)     │───▶│  destination    │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. MixerInsert Sınıfı - Mevcut Durum

```javascript
// Her MixerInsert instance'ı şunları içerir:
class MixerInsert {
  // Audio Nodes (her insert için ayrı)
  input: GainNode           // ~0.1% CPU
  gainNode: GainNode        // ~0.1% CPU
  panNode: StereoPanner     // ~0.2% CPU
  analyzer: AnalyserNode    // ~0.5% CPU (FFT hesaplaması)
  output: GainNode          // ~0.1% CPU
  
  // Effect Chain
  effects: Map              // 0-N effect, her biri ~1-5% CPU
  
  // Auto-Sleep System
  autoSleepMonitor: setInterval  // 250ms polling
  
  // Tracking
  instruments: Set          // Bağlı instrument ID'leri
  sends: Map               // Send routing
}
```

### 3. Kaynak Kullanımı (28 Track Senaryosu)

| Bileşen | Adet | CPU/Adet | Toplam CPU | Bellek |
|---------|------|----------|------------|--------|
| GainNode (input) | 28 | 0.1% | 2.8% | 28KB |
| GainNode (gain) | 28 | 0.1% | 2.8% | 28KB |
| GainNode (output) | 28 | 0.1% | 2.8% | 28KB |
| StereoPanner | 28 | 0.2% | 5.6% | 56KB |
| AnalyserNode | 28 | 0.5% | 14% | 280KB |
| Auto-sleep timers | 28 | 0.05% | 1.4% | 14KB |
| **TOPLAM (boş)** | - | - | **~29%** | **~434KB** |

### 4. Tespit Edilen Darboğazlar

#### 4.1 AnalyserNode Her Insert'te Aktif
```javascript
// MixerInsert.js:59-62 - PROBLEM
this.analyzer = this.audioContext.createAnalyser();
this.analyzer.fftSize = 256;  // 256 bin FFT her frame
```
- **Sorun**: 28 track = 28 FFT hesaplaması/frame
- **Etki**: ~14% CPU sadece metering için
- **Çözüm**: Lazy initialization + visible-only metering

#### 4.2 Auto-Sleep Timer Per-Insert
```javascript
// MixerInsert.js:93-94 - PROBLEM
this._initAutoSleepMonitor();
// Her insert için ayrı setInterval(250ms)
```
- **Sorun**: 28 ayrı timer, context switch overhead
- **Etki**: ~1.4% CPU + event loop pollution
- **Çözüm**: Global batched monitor

#### 4.3 Full Chain Rebuild on Any Change
```javascript
// MixerInsert.js:394-456 - PROBLEM
_rebuildChain() {
  this.input.disconnect();
  this.gainNode.disconnect();
  // ... tüm bağlantıları kopar
  // ... tüm bağlantıları yeniden kur
}
```
- **Sorun**: Bypass toggle bile full rebuild tetikliyor
- **Etki**: Audio glitch riski + unnecessary CPU
- **Çözüm**: Incremental chain updates

#### 4.4 findUnusedMixerTrack O(n*m) Karmaşıklık
```javascript
// StoreManager.js:104-138 - OPTİMİZE EDİLDİ
findUnusedMixerTrack() {
  const usedTrackIds = new Set(instruments.map(inst => inst.mixerTrackId));
  // ✅ Set kullanımı ile O(n) lookup
}
```
- **Durum**: ✅ Zaten optimize edildi (Set kullanımı)
- **Kalan sorun**: Her çağrıda yeni Set oluşturma

---

## 🚀 İleri Seviye Optimizasyon Planı

### Faz 1: Immediate Wins (1-2 gün)

#### 1.1 Lazy AnalyserNode Creation

```javascript
// ÖNCE: Her insert'te analyzer var
class MixerInsert {
  constructor() {
    this.analyzer = this.audioContext.createAnalyser();
  }
}

// SONRA: İlk metering isteğinde oluştur
class MixerInsert {
  constructor() {
    this._analyzer = null;  // Lazy
  }

  getAnalyzer() {
    if (!this._analyzer) {
      this._analyzer = this.audioContext.createAnalyser();
      this._analyzer.fftSize = 256;
      this._analyzer.smoothingTimeConstant = 0.8;
      this._insertAnalyzerToChain();
    }
    return this._analyzer;
  }

  _insertAnalyzerToChain() {
    // Pan -> Analyzer -> Output (sadece analyzer varsa)
    this.panNode.disconnect(this.output);
    this.panNode.connect(this._analyzer);
    this._analyzer.connect(this.output);
  }

  getMeterLevel() {
    // Sadece analyzer varsa hesapla
    if (!this._analyzer) return 0;
    // ... mevcut hesaplama
  }
}
```

**Kazanım**: ~14% CPU tasarrufu (metering kullanılmadığında)

#### 1.2 Visible-Only Metering

```javascript
// MixerMeterBridge.js - YENİ
class MixerMeterBridge {
  constructor() {
    this.visibleTracks = new Set();
    this.meterData = new Map();
    this._rafHandle = null;
  }

  setVisibleTracks(trackIds) {
    this.visibleTracks = new Set(trackIds);
  }

  startMetering() {
    const update = () => {
      for (const trackId of this.visibleTracks) {
        const insert = audioEngine.mixerInserts.get(trackId);
        if (insert) {
          // Sadece görünür track'ler için metering
          this.meterData.set(trackId, insert.getMeterLevel());
        }
      }
      this._rafHandle = requestAnimationFrame(update);
    };
    update();
  }

  stopMetering() {
    if (this._rafHandle) {
      cancelAnimationFrame(this._rafHandle);
    }
  }
}
```

**Kazanım**: Görünür olmayan track'ler için 0 CPU metering

#### 1.3 Batched Auto-Sleep Monitor

```javascript
// MixerInsertManager.js - YENİ
class MixerInsertManager {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this._monitorHandle = null;
    this._pollInterval = 250;
  }

  startGlobalMonitor() {
    this._monitorHandle = setInterval(() => {
      const inserts = this.audioEngine.mixerInserts;
      if (!inserts) return;

      for (const [insertId, insert] of inserts) {
        if (insert.autoSleepConfig?.enabled) {
          insert._evaluateAutoSleep();
        }
      }
    }, this._pollInterval);
  }

  stopGlobalMonitor() {
    if (this._monitorHandle) {
      clearInterval(this._monitorHandle);
      this._monitorHandle = null;
    }
  }
}

// MixerInsert.js - Güncelleme
class MixerInsert {
  constructor() {
    // ❌ KALDIR: this._initAutoSleepMonitor();
    // Auto-sleep artık MixerInsertManager tarafından yönetiliyor
  }
}
```

**Kazanım**: 28 timer → 1 timer, ~1.3% CPU tasarrufu

---

### Faz 2: Incremental Chain Updates (3-5 gün)

#### 2.1 Bypass Toggle Optimization

```javascript
// MixerInsert.js - Incremental bypass
class MixerInsert {
  setEffectBypass(effectId, bypass) {
    const effect = this.effects.get(effectId);
    if (!effect || effect.bypass === bypass) return;

    effect.bypass = bypass;

    // ✅ INCREMENTAL: Sadece bu effect'in bağlantılarını güncelle
    this._updateEffectConnection(effectId, bypass);
  }

  _updateEffectConnection(effectId, bypass) {
    const effectIndex = this.effectOrder.indexOf(effectId);
    if (effectIndex === -1) return;

    const effect = this.effects.get(effectId);
    const prevNode = this._getNodeAt(effectIndex - 1);
    const nextNode = this._getNodeAt(effectIndex + 1);

    try {
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
    } catch (error) {
      // Fallback: full rebuild
      this._rebuildChain();
    }
  }

  _getNodeAt(index) {
    if (index < 0) return this.input;
    if (index >= this.effectOrder.length) return this.gainNode;
    
    const effectId = this.effectOrder[index];
    const effect = this.effects.get(effectId);
    return effect?.bypass ? this._getNodeAt(index - 1) : effect.node;
  }
}
```

**Kazanım**: Bypass toggle ~50ms → ~1ms

#### 2.2 Effect Reorder Optimization

```javascript
// MixerInsert.js - Optimized reorder
class MixerInsert {
  reorderEffects(sourceIndex, destinationIndex) {
    if (sourceIndex === destinationIndex) return;

    const [movedEffectId] = this.effectOrder.splice(sourceIndex, 1);
    this.effectOrder.splice(destinationIndex, 0, movedEffectId);

    // ✅ INCREMENTAL: Sadece etkilenen bölümü yeniden bağla
    const minIndex = Math.min(sourceIndex, destinationIndex);
    const maxIndex = Math.max(sourceIndex, destinationIndex);
    
    this._rebuildChainSegment(minIndex, maxIndex);
  }

  _rebuildChainSegment(startIndex, endIndex) {
    // Sadece startIndex ile endIndex arasındaki bağlantıları güncelle
    let prevNode = this._getNodeAt(startIndex - 1);
    
    for (let i = startIndex; i <= endIndex + 1; i++) {
      const currentNode = this._getNodeAt(i);
      try {
        prevNode.disconnect();
      } catch (e) {}
      prevNode.connect(currentNode);
      prevNode = currentNode;
    }
  }
}
```

**Kazanım**: Reorder ~100ms → ~5ms

---

### Faz 3: Advanced Optimizations (1-2 hafta)

#### 3.1 Web Worker Metering

```javascript
// meterWorker.js
self.onmessage = (e) => {
  const { type, data } = e.data;
  
  if (type === 'analyze') {
    const { frequencyData, trackId } = data;
    
    // RMS hesaplaması worker'da
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      const normalized = (frequencyData[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / frequencyData.length);
    
    self.postMessage({ trackId, rms });
  }
};

// MixerMeterBridge.js
class MixerMeterBridge {
  constructor() {
    this.worker = new Worker('/workers/meterWorker.js');
    this.worker.onmessage = this._handleWorkerMessage.bind(this);
  }

  _handleWorkerMessage(e) {
    const { trackId, rms } = e.data;
    this.meterData.set(trackId, rms);
    this._notifyListeners(trackId, rms);
  }

  requestMeterUpdate(trackId, insert) {
    const dataArray = new Uint8Array(insert.analyzer.frequencyBinCount);
    insert.analyzer.getByteTimeDomainData(dataArray);
    
    // Worker'a gönder (transferable)
    this.worker.postMessage(
      { type: 'analyze', data: { frequencyData: dataArray, trackId } },
      [dataArray.buffer]
    );
  }
}
```

**Kazanım**: Main thread'den ~5% CPU kaldırma

#### 3.2 Effect Node Pooling

```javascript
// EffectNodePool.js - YENİ
class EffectNodePool {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.pools = new Map(); // effectType → availableNodes[]
    this.inUse = new Map(); // effectType → usedNodes[]
  }

  acquire(effectType) {
    const pool = this.pools.get(effectType) || [];
    
    if (pool.length > 0) {
      const node = pool.pop();
      this._markInUse(effectType, node);
      return node;
    }
    
    // Pool boş, yeni node oluştur
    const node = this._createEffectNode(effectType);
    this._markInUse(effectType, node);
    return node;
  }

  release(effectType, node) {
    // Node'u resetle ve pool'a geri koy
    this._resetNode(node);
    
    const pool = this.pools.get(effectType) || [];
    pool.push(node);
    this.pools.set(effectType, pool);
    
    this._removeFromInUse(effectType, node);
  }

  _resetNode(node) {
    // Effect parametrelerini default'a döndür
    if (node.parameters) {
      for (const [name, param] of node.parameters) {
        param.setValueAtTime(param.defaultValue, this.audioContext.currentTime);
      }
    }
  }

  prewarm(effectType, count = 2) {
    // Sık kullanılan effect'ler için önceden node oluştur
    const pool = this.pools.get(effectType) || [];
    for (let i = 0; i < count; i++) {
      pool.push(this._createEffectNode(effectType));
    }
    this.pools.set(effectType, pool);
  }
}
```

**Kazanım**: Effect ekleme ~50ms → ~5ms

#### 3.3 Instrument Output Caching

```javascript
// NativeAudioEngine.js - Output caching
class NativeAudioEngine {
  constructor() {
    this._instrumentOutputCache = new WeakMap();
  }

  routeInstrumentToInsert(instrumentId, insertId) {
    const instrument = this.instruments.get(instrumentId);
    const insert = this.mixerInserts.get(insertId);
    
    if (!instrument?.output || !insert) return;

    // ✅ CACHE: Output referansını cache'le
    const cachedOutput = this._instrumentOutputCache.get(instrument);
    if (cachedOutput === instrument.output) {
      // Output değişmemiş, sadece routing güncelle
      this._updateRouting(instrumentId, insertId);
      return;
    }

    // Output değişmiş, full routing yap
    this._instrumentOutputCache.set(instrument, instrument.output);
    this._fullRouting(instrumentId, insertId);
  }
}
```

**Kazanım**: Tekrarlı routing çağrılarında ~80% hızlanma

---

### Faz 4: Architecture Improvements (2-4 hafta)

#### 4.1 MixerInsert State Machine

```javascript
// MixerInsertStateMachine.js - YENİ
const MixerInsertState = {
  IDLE: 'idle',           // Ses yok, minimum CPU
  ACTIVE: 'active',       // Ses var, full processing
  SLEEPING: 'sleeping',   // Auto-sleep aktif
  BYPASSED: 'bypassed'    // Tüm effect'ler bypass
};

class MixerInsertStateMachine {
  constructor(insert) {
    this.insert = insert;
    this.state = MixerInsertState.IDLE;
    this.transitions = {
      [MixerInsertState.IDLE]: {
        'signal_detected': MixerInsertState.ACTIVE,
        'sleep_requested': MixerInsertState.SLEEPING
      },
      [MixerInsertState.ACTIVE]: {
        'signal_lost': MixerInsertState.IDLE,
        'sleep_requested': MixerInsertState.SLEEPING,
        'all_bypassed': MixerInsertState.BYPASSED
      },
      [MixerInsertState.SLEEPING]: {
        'wake_requested': MixerInsertState.ACTIVE,
        'signal_detected': MixerInsertState.ACTIVE
      },
      [MixerInsertState.BYPASSED]: {
        'effect_enabled': MixerInsertState.ACTIVE
      }
    };
  }

  transition(event) {
    const nextState = this.transitions[this.state]?.[event];
    if (nextState) {
      this._onExit(this.state);
      this.state = nextState;
      this._onEnter(nextState);
    }
  }

  _onEnter(state) {
    switch (state) {
      case MixerInsertState.SLEEPING:
        this.insert._disconnectEffects();
        break;
      case MixerInsertState.ACTIVE:
        this.insert._rebuildChain();
        break;
      case MixerInsertState.BYPASSED:
        this.insert._bypassAllEffects();
        break;
    }
  }
}
```

**Kazanım**: Daha öngörülebilir state transitions, debug kolaylığı

#### 4.2 Mixer Graph Visualization (Debug Tool)

```javascript
// MixerGraphDebugger.js - YENİ
class MixerGraphDebugger {
  static generateGraph(audioEngine) {
    const nodes = [];
    const edges = [];

    // Instruments
    audioEngine.instruments.forEach((inst, id) => {
      nodes.push({ id, type: 'instrument', label: inst.name });
    });

    // Mixer Inserts
    audioEngine.mixerInserts.forEach((insert, id) => {
      nodes.push({ 
        id, 
        type: 'insert', 
        label: insert.label,
        state: insert._autoSleepState?.isSleeping ? 'sleeping' : 'active',
        effectCount: insert.effects.size
      });
    });

    // Routing
    audioEngine.instrumentToInsert.forEach((insertId, instrumentId) => {
      edges.push({ from: instrumentId, to: insertId, type: 'route' });
    });

    // Sends
    audioEngine.mixerInserts.forEach((insert, insertId) => {
      insert.sends.forEach((send, busId) => {
        edges.push({ from: insertId, to: busId, type: 'send' });
      });
    });

    return { nodes, edges };
  }

  static printGraph(audioEngine) {
    const { nodes, edges } = this.generateGraph(audioEngine);
    
    console.group('🎛️ Mixer Graph');
    console.table(nodes);
    console.table(edges);
    console.groupEnd();
  }
}

// Global debug function
window.debugMixerGraph = () => MixerGraphDebugger.printGraph(audioEngine);
```

**Kazanım**: Routing sorunlarını hızlı tespit

---

## 📈 Tahmini Performans Kazanımları

### Faz 1 Sonrası (Immediate Wins)
| Metrik | Önce | Sonra | Kazanım |
|--------|------|-------|---------|
| Idle CPU | ~29% | ~14% | -52% |
| Memory | 434KB | 200KB | -54% |
| Timer count | 28 | 1 | -96% |

### Faz 2 Sonrası (Incremental Updates)
| Metrik | Önce | Sonra | Kazanım |
|--------|------|-------|---------|
| Bypass toggle | ~50ms | ~1ms | -98% |
| Effect reorder | ~100ms | ~5ms | -95% |
| Audio glitch risk | High | Low | Significant |

### Faz 3 Sonrası (Advanced)
| Metrik | Önce | Sonra | Kazanım |
|--------|------|-------|---------|
| Main thread CPU | ~29% | ~10% | -66% |
| Effect add time | ~50ms | ~5ms | -90% |
| GC pressure | High | Low | Significant |

### Faz 4 Sonrası (Architecture)
| Metrik | Önce | Sonra | Kazanım |
|--------|------|-------|---------|
| Debug time | Hours | Minutes | -90% |
| State bugs | Common | Rare | Significant |
| Code maintainability | Medium | High | Improved |

---

## 🎯 Uygulama Öncelik Sırası

### Kritik (Hemen) - ✅ TAMAMLANDI
1. ✅ Console.log'ları DEV moduna al
2. ✅ Lazy AnalyserNode creation
3. ✅ Batched auto-sleep monitor (MixerInsertManager)

### Yüksek (1-2 hafta) - ✅ TAMAMLANDI
4. ✅ Visible-only metering (MeterService entegrasyonu)
5. ✅ Incremental bypass toggle
6. ✅ Effect reorder optimization

### Orta (2-4 hafta) - ⏳ BEKLEMEDE
7. ⏳ Web Worker metering
8. ⏳ Effect node pooling
9. ⏳ Instrument output caching

### Düşük (Backlog)
10. State machine refactor
11. Graph visualization tool
12. Performance dashboard

---

## 🔧 Hemen Uygulanabilir Kod Değişiklikleri

### 1. Lazy AnalyserNode (MixerInsert.js)

```javascript
// MixerInsert.js - constructor değişikliği
constructor(audioContext, insertId, label = '') {
  // ... mevcut kod ...

  // ❌ KALDIR:
  // this.analyzer = this.audioContext.createAnalyser();
  // this.analyzer.fftSize = 256;
  // this.analyzer.smoothingTimeConstant = 0.8;

  // ✅ EKLE:
  this._analyzer = null;  // Lazy initialization

  // ... mevcut kod ...
}

// ✅ EKLE: Lazy analyzer getter
getAnalyzer() {
  if (!this._analyzer) {
    this._analyzer = this.audioContext.createAnalyser();
    this._analyzer.fftSize = 256;
    this._analyzer.smoothingTimeConstant = 0.8;
    
    // Chain'e ekle
    this.panNode.disconnect(this.output);
    this.panNode.connect(this._analyzer);
    this._analyzer.connect(this.output);
    
    if (import.meta.env.DEV) {
      console.log(`📊 Lazy analyzer created for ${this.insertId}`);
    }
  }
  return this._analyzer;
}

// ✅ GÜNCELLE: getMeterLevel
getMeterLevel() {
  // Analyzer yoksa 0 döndür (CPU tasarrufu)
  if (!this._analyzer) return 0;
  
  const dataArray = new Uint8Array(this._analyzer.frequencyBinCount);
  this._analyzer.getByteTimeDomainData(dataArray);
  // ... mevcut hesaplama
}

// ✅ GÜNCELLE: _rebuildChain (analyzer opsiyonel)
_rebuildChain() {
  // ... mevcut kod ...

  // Complete chain: effects → gain → pan → [analyzer] → output
  currentNode.connect(this.gainNode);
  this.gainNode.connect(this.panNode);
  
  if (this._analyzer) {
    this.panNode.connect(this._analyzer);
    this._analyzer.connect(this.output);
  } else {
    this.panNode.connect(this.output);
  }
}
```

### 2. Batched Auto-Sleep (Yeni dosya)

```javascript
// client/src/lib/core/MixerInsertManager.js - YENİ DOSYA
export class MixerInsertManager {
  constructor() {
    this.audioEngine = null;
    this._monitorHandle = null;
    this._pollInterval = 250;
  }

  setAudioEngine(engine) {
    this.audioEngine = engine;
  }

  startGlobalMonitor() {
    if (this._monitorHandle) return;

    this._monitorHandle = setInterval(() => {
      if (!this.audioEngine?.mixerInserts) return;

      for (const [, insert] of this.audioEngine.mixerInserts) {
        if (insert.autoSleepConfig?.enabled && !insert._isDisposed) {
          try {
            insert._evaluateAutoSleep();
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn(`Auto-sleep error for ${insert.insertId}:`, error);
            }
          }
        }
      }
    }, this._pollInterval);

    if (import.meta.env.DEV) {
      console.log('✅ Global auto-sleep monitor started');
    }
  }

  stopGlobalMonitor() {
    if (this._monitorHandle) {
      clearInterval(this._monitorHandle);
      this._monitorHandle = null;
      
      if (import.meta.env.DEV) {
        console.log('🛑 Global auto-sleep monitor stopped');
      }
    }
  }

  dispose() {
    this.stopGlobalMonitor();
    this.audioEngine = null;
  }
}

// Singleton
export const mixerInsertManager = new MixerInsertManager();
```

---

## 📝 Test Checklist

### Faz 1 Testleri
- [ ] Lazy analyzer: Metering UI açılmadan CPU düşük mü?
- [ ] Lazy analyzer: Metering UI açılınca analyzer oluşuyor mu?
- [ ] Batched monitor: 28 track ile tek timer mı?
- [ ] Batched monitor: Auto-sleep düzgün çalışıyor mu?

### Faz 2 Testleri
- [ ] Bypass toggle: Audio glitch yok mu?
- [ ] Bypass toggle: Effect state doğru mu?
- [ ] Effect reorder: Ses kesintisi yok mu?
- [ ] Effect reorder: Settings korunuyor mu?

### Faz 3 Testleri
- [ ] Worker metering: Main thread CPU düştü mü?
- [ ] Worker metering: Meter değerleri doğru mu?
- [ ] Node pooling: Effect ekleme hızlandı mı?
- [ ] Node pooling: Memory leak yok mu?

---

## 🔗 İlgili Dosyalar

- `client/src/lib/core/MixerInsert.js` - Ana mixer insert sınıfı
- `client/src/lib/core/NativeAudioEngine.js` - Audio engine
- `client/src/store/useMixerStore.js` - Mixer state yönetimi
- `client/src/store/useInstrumentsStore.js` - Instrument state
- `client/src/store/StoreManager.js` - Store orchestration
- `client/src/lib/services/AudioContextService.js` - Service layer

