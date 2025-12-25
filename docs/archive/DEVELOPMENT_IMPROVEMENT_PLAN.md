# 🔧 DAWG Audio Engine - Kapsamlı Geliştirme Planı

## 📊 Mevcut Durum Özeti

### Kod Metrikleri
| Metrik | Değer | Durum |
|--------|-------|-------|
| Toplam JS Dosyası | ~120 | - |
| En Büyük Dosya | PlaybackManager.js (2619 lines) | 🔴 Kritik |
| 1000+ Satır Dosyalar | 11 dosya | 🔴 Kritik |
| Test Dosyası | 1 adet | 🔴 Kritik |
| TODO/FIXME İşaretleri | 65 adet | 🟡 Dikkat |
| Deprecated Kod | 14 referans | 🟡 Dikkat |
| Empty Catch Blocks | 72 adet | 🔴 Kritik |

### Büyük Dosyalar (Refactoring Önceliği)
```
🔴 2619 lines - PlaybackManager.js
🔴 2475 lines - AudioContextService.js
🔴 2197 lines - NativeAudioEngine.js
🔴 1719 lines - RenderEngine.js
🟡 1634 lines - presets.js (data file, OK)
🔴 1299 lines - ProjectSerializer.js
🔴 1252 lines - VASynth.js
🔴 1055 lines - AudioExportManager.js
🔴 1051 lines - ExportManager.js
🟡 1047 lines - MixerInsert.js
```

---

## 🎯 Geliştirme Alanları

### 1. 📁 KOD ORGANİZASYONU

#### 1.1 PlaybackManager.js Modülerleştirme (2619 lines → ~400 lines/modül)

**Mevcut Sorunlar:**
- Single Responsibility Principle ihlali
- 2600+ satır tek dosyada
- Test edilmesi çok zor
- Debugging karmaşık

**Önerilen Yapı:**
```
client/src/lib/core/playback/
├── PlaybackManager.js          (orchestrator, ~300 lines)
├── SchedulingOptimizer.js      (debouncing, ~100 lines)
├── NoteScheduler.js            (✅ mevcut)
├── AutomationScheduler.js      (✅ mevcut)
├── AudioClipScheduler.js       (✅ mevcut)
├── LoopController.js           (loop logic, ~200 lines)
├── PositionManager.js          (position tracking, ~150 lines)
├── PlaybackState.js            (state machine, ~200 lines)
├── PatternPlayer.js            (pattern mode, ~200 lines)
├── SongPlayer.js               (song mode, ~200 lines)
└── index.js                    (barrel export)
```

**Uygulama Planı:**
```javascript
// ADIM 1: SchedulingOptimizer'ı ayır (zaten class olarak var)
// playback/SchedulingOptimizer.js
export class SchedulingOptimizer {
  // Mevcut kod: lines 26-100
}

// ADIM 2: LoopController'ı ayır
// playback/LoopController.js
export class LoopController {
  constructor(playbackManager) {
    this.pm = playbackManager;
  }
  
  setLoopPoints(start, end) { /* ... */ }
  getLoopInfo() { /* ... */ }
  enableAutoLoop() { /* ... */ }
  calculateAutoLoop() { /* ... */ }
}

// ADIM 3: PlaybackState machine
// playback/PlaybackState.js
export class PlaybackState {
  static STATES = {
    STOPPED: 'stopped',
    PLAYING: 'playing',
    PAUSED: 'paused',
    RECORDING: 'recording'
  };
  
  transition(from, to, context) { /* ... */ }
  canTransition(from, to) { /* ... */ }
}
```

#### 1.2 AudioContextService.js Modülerleştirme (2475 lines → ~300 lines/modül)

**Önerilen Yapı:**
```
client/src/lib/services/audio/
├── AudioContextService.js      (facade, ~300 lines)
├── InterfaceLayer.js           (timeline, loop, params, ~200 lines)
├── MixerBridge.js              (mixer operations, ~300 lines)
├── InstrumentBridge.js         (instrument operations, ~200 lines)
├── EffectBridge.js             (effect operations, ~200 lines)
├── SyncManager.js              (store-engine sync, ~300 lines)
├── DebugTools.js               (debugging utilities, ~150 lines)
└── index.js
```

#### 1.3 NativeAudioEngine.js Modülerleştirme (2197 lines → ~350 lines/modül)

**Önerilen Yapı:**
```
client/src/lib/core/engine/
├── NativeAudioEngine.js        (core, ~400 lines)
├── MasterBusManager.js         (master chain, ~200 lines)
├── InstrumentManager.js        (instrument lifecycle, ~300 lines)
├── MixerManager.js             (mixer routing, ~300 lines)
├── EffectManager.js            (effect management, ~200 lines)
├── TransportBridge.js          (transport integration, ~150 lines)
├── MetricsCollector.js         (performance metrics, ~100 lines)
└── index.js
```

---

### 2. 🔴 HATA YÖNETİMİ

#### 2.1 Empty Catch Blocks (72 adet)

**Mevcut Sorun:**
```javascript
// ❌ KÖTÜ: Hata yutulmuş
try {
  this.output.disconnect();
} catch (e) {
  // Already disconnected
}
```

**Çözüm:**
```javascript
// ✅ İYİ: Beklenen hata için açık kontrol
try {
  this.output.disconnect();
} catch (error) {
  // Expected: Node might already be disconnected
  // Only log in DEV mode if unexpected error type
  if (import.meta.env.DEV && !(error instanceof DOMException)) {
    console.warn(`Unexpected disconnect error:`, error);
  }
}
```

**Uygulama - ErrorHandler Utility:**
```javascript
// client/src/lib/utils/ErrorHandler.js
export class ErrorHandler {
  static EXPECTED_ERRORS = {
    ALREADY_DISCONNECTED: 'InvalidAccessError',
    INVALID_STATE: 'InvalidStateError',
    NOT_FOUND: 'NotFoundError'
  };

  static isExpected(error, type) {
    if (type === 'disconnect') {
      return error.name === 'InvalidAccessError' ||
             error.message?.includes('already disconnected');
    }
    return false;
  }

  static handleAudioError(error, context, options = {}) {
    const { silent = false, fallback = null } = options;
    
    if (this.isExpected(error, context)) {
      // Expected error, log only in DEV
      if (import.meta.env.DEV && !silent) {
        console.debug(`[Expected] ${context}:`, error.message);
      }
      return fallback;
    }
    
    // Unexpected error - log and optionally rethrow
    console.error(`[Audio Error] ${context}:`, error);
    
    if (options.rethrow) {
      throw error;
    }
    
    return fallback;
  }

  static wrap(fn, context, options = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        return this.handleAudioError(error, context, options);
      }
    };
  }
}

// Kullanım:
import { ErrorHandler } from '@/lib/utils/ErrorHandler';

// Önce:
try { node.disconnect(); } catch (e) {}

// Sonra:
ErrorHandler.wrap(() => node.disconnect(), 'disconnect', { silent: true })();
```

#### 2.2 Centralized Error Boundary

```javascript
// client/src/lib/core/AudioErrorBoundary.js
export class AudioErrorBoundary {
  static errors = [];
  static maxErrors = 100;
  static subscribers = new Set();

  static capture(error, context, severity = 'error') {
    const entry = {
      timestamp: Date.now(),
      error,
      context,
      severity,
      stack: error.stack
    };

    this.errors.push(entry);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    this.notify(entry);

    // Critical errors should be reported
    if (severity === 'critical') {
      this.reportCritical(entry);
    }
  }

  static notify(entry) {
    this.subscribers.forEach(cb => {
      try {
        cb(entry);
      } catch (e) {
        console.error('Error in error subscriber:', e);
      }
    });
  }

  static subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  static getErrors(filter = {}) {
    let filtered = this.errors;
    
    if (filter.severity) {
      filtered = filtered.filter(e => e.severity === filter.severity);
    }
    if (filter.context) {
      filtered = filtered.filter(e => e.context.includes(filter.context));
    }
    if (filter.since) {
      filtered = filtered.filter(e => e.timestamp > filter.since);
    }
    
    return filtered;
  }

  static clear() {
    this.errors = [];
  }

  static reportCritical(entry) {
    // Integration with error reporting service
    // e.g., Sentry, LogRocket, etc.
    if (typeof window !== 'undefined' && window.__DAWG_ERROR_REPORTER__) {
      window.__DAWG_ERROR_REPORTER__(entry);
    }
  }
}
```

---

### 3. 🧪 TEST COVERAGE

#### 3.1 Mevcut Durum
- **Test Dosyası**: 1 adet (`BaseAudioPlugin.test.js`)
- **Coverage**: ~1% (tahmin)
- **Hedef**: >80%

#### 3.2 Test Stratejisi

**Öncelik 1 - Kritik Yollar:**
```
client/src/lib/__tests__/
├── core/
│   ├── PlaybackManager.test.js
│   ├── NativeAudioEngine.test.js
│   ├── MixerInsert.test.js
│   └── NativeTransportSystem.test.js
├── services/
│   ├── AudioContextService.test.js
│   └── MeterService.test.js
└── audio/
    ├── instruments/
    │   ├── InstrumentFactory.test.js
    │   └── SingleSampleInstrument.test.js
    └── effects/
        └── EffectRegistry.test.js
```

**Test Template:**
```javascript
// client/src/lib/__tests__/core/MixerInsert.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MixerInsert } from '@/lib/core/MixerInsert';

// Mock AudioContext
const createMockAudioContext = () => ({
  createGain: vi.fn(() => ({
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn()
  })),
  createStereoPanner: vi.fn(() => ({
    pan: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn()
  })),
  createAnalyser: vi.fn(() => ({
    fftSize: 256,
    frequencyBinCount: 128,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn()
  })),
  currentTime: 0
});

describe('MixerInsert', () => {
  let audioContext;
  let mixerInsert;

  beforeEach(() => {
    audioContext = createMockAudioContext();
    mixerInsert = new MixerInsert(audioContext, 'test-insert', 'Test');
  });

  afterEach(() => {
    mixerInsert.dispose();
  });

  describe('constructor', () => {
    it('should create with correct ID and label', () => {
      expect(mixerInsert.insertId).toBe('test-insert');
      expect(mixerInsert.label).toBe('Test');
    });

    it('should initialize audio nodes', () => {
      expect(audioContext.createGain).toHaveBeenCalledTimes(3); // input, gain, output
      expect(audioContext.createStereoPanner).toHaveBeenCalledTimes(1);
    });

    it('should NOT create analyzer immediately (lazy)', () => {
      expect(audioContext.createAnalyser).not.toHaveBeenCalled();
    });
  });

  describe('getAnalyzer (lazy creation)', () => {
    it('should create analyzer on first call', () => {
      const analyzer = mixerInsert.getAnalyzer();
      expect(audioContext.createAnalyser).toHaveBeenCalledTimes(1);
      expect(analyzer).toBeDefined();
    });

    it('should return same analyzer on subsequent calls', () => {
      const analyzer1 = mixerInsert.getAnalyzer();
      const analyzer2 = mixerInsert.getAnalyzer();
      expect(analyzer1).toBe(analyzer2);
      expect(audioContext.createAnalyser).toHaveBeenCalledTimes(1);
    });
  });

  describe('connectInstrument', () => {
    it('should connect valid instrument output', () => {
      const mockOutput = { connect: vi.fn() };
      const result = mixerInsert.connectInstrument('inst-1', mockOutput);
      
      expect(result).toBe(true);
      expect(mockOutput.connect).toHaveBeenCalled();
      expect(mixerInsert.instruments.has('inst-1')).toBe(true);
    });

    it('should reject null output', () => {
      const result = mixerInsert.connectInstrument('inst-1', null);
      expect(result).toBe(false);
    });

    it('should reject invalid AudioNode', () => {
      const result = mixerInsert.connectInstrument('inst-1', { notANode: true });
      expect(result).toBe(false);
    });
  });

  describe('setEffectBypass (incremental)', () => {
    it('should toggle bypass without full rebuild', () => {
      // Add mock effect
      const mockEffect = {
        node: { connect: vi.fn(), disconnect: vi.fn() },
        bypass: false,
        settings: {}
      };
      mixerInsert.effects.set('fx-1', mockEffect);
      mixerInsert.effectOrder.push('fx-1');

      // Spy on _rebuildChain
      const rebuildSpy = vi.spyOn(mixerInsert, '_rebuildChain');
      
      mixerInsert.setEffectBypass('fx-1', true);
      
      // Should NOT call full rebuild (incremental update)
      expect(rebuildSpy).not.toHaveBeenCalled();
      expect(mockEffect.bypass).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      mixerInsert.dispose();
      
      expect(mixerInsert.input).toBeNull();
      expect(mixerInsert.output).toBeNull();
      expect(mixerInsert.gainNode).toBeNull();
    });
  });
});
```

#### 3.3 Test Automation

```json
// package.json scripts
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:lib": "vitest client/src/lib"
  }
}
```

---

### 4. 🔄 STATE SYNC

#### 4.1 Mevcut Sorunlar
- Store ve engine arasında duplicate state
- Sync timing sorunları
- Race conditions

#### 4.2 Çözüm: Unified State Pattern

```javascript
// client/src/lib/state/UnifiedAudioState.js
export class UnifiedAudioState {
  constructor() {
    this.state = {
      mixer: new Map(),      // trackId -> MixerState
      instruments: new Map(), // instrumentId -> InstrumentState
      transport: {
        isPlaying: false,
        position: 0,
        bpm: 140,
        loopStart: 0,
        loopEnd: 64
      }
    };
    
    this.subscribers = new Map();
    this.pendingUpdates = [];
    this.updateScheduled = false;
  }

  // Single source of truth getter
  getMixerState(trackId) {
    return this.state.mixer.get(trackId);
  }

  // Batched updates
  updateMixer(trackId, updates) {
    this.pendingUpdates.push({
      type: 'mixer',
      id: trackId,
      updates
    });
    this.scheduleFlush();
  }

  scheduleFlush() {
    if (this.updateScheduled) return;
    
    this.updateScheduled = true;
    queueMicrotask(() => {
      this.flush();
      this.updateScheduled = false;
    });
  }

  flush() {
    const updates = this.pendingUpdates;
    this.pendingUpdates = [];

    // Apply all updates
    for (const update of updates) {
      this.applyUpdate(update);
    }

    // Notify subscribers once
    this.notifySubscribers(updates);
  }

  applyUpdate(update) {
    switch (update.type) {
      case 'mixer':
        const current = this.state.mixer.get(update.id) || {};
        this.state.mixer.set(update.id, { ...current, ...update.updates });
        break;
      // ... other types
    }
  }

  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
    
    return () => this.subscribers.get(key).delete(callback);
  }
}

// Singleton
export const audioState = new UnifiedAudioState();
```

---

### 5. 📝 DEPRECATED CODE CLEANUP

#### 5.1 Deprecated Referanslar (14 adet)

| Dosya | Deprecated Kod | Aksiyon |
|-------|----------------|---------|
| NativeAudioEngine.js | unifiedMixer, unifiedMixerChannelMap | Sil (MixerInsert kullanılıyor) |
| NativeAudioEngine.js | mixerChannels (old system) | Sil |
| PlaybackManager.js | onNoteAdded (use EventBus) | Sil |
| PlaybackManager.js | clip.mixerChannelId | Migrate to trackId |
| TimelineControllerSingleton.js | initializeTimelineController() | Sil |
| TimelineControllerSingleton.js | destroyTimelineController() | Sil |
| TransportManagerSingleton.js | cleanup() | Sil |
| PlaybackControllerSingleton.js | onInitialization() | Sil |

**Cleanup Script:**
```javascript
// scripts/cleanup-deprecated.js
const deprecatedPatterns = [
  { file: 'NativeAudioEngine.js', pattern: /this\.unifiedMixer[^;]*;/g, replacement: '' },
  { file: 'NativeAudioEngine.js', pattern: /this\.unifiedMixerChannelMap[^;]*;/g, replacement: '' },
  // ... more patterns
];

// Run with: node scripts/cleanup-deprecated.js --dry-run
```

---

### 6. 🚀 PERFORMANS İYİLEŞTİRMELERİ

#### 6.1 Web Worker Offloading

**Hedef Alanlar:**
1. Metering (FFT calculations)
2. Waveform rendering
3. Audio analysis

```javascript
// client/src/lib/workers/MeteringWorker.js
self.onmessage = (e) => {
  const { type, data } = e.data;
  
  switch (type) {
    case 'analyze':
      const { frequencyData, trackId } = data;
      const result = calculateLevels(frequencyData);
      self.postMessage({ trackId, ...result });
      break;
  }
};

function calculateLevels(dataArray) {
  let peak = 0;
  let sumSquares = 0;
  const length = dataArray.length;

  for (let i = 0; i < length; i++) {
    const normalized = (dataArray[i] - 128) / 128;
    const abs = Math.abs(normalized);
    if (abs > peak) peak = abs;
    sumSquares += normalized * normalized;
  }

  const rms = Math.sqrt(sumSquares / length);
  
  return {
    peak: peak > 0.00001 ? 20 * Math.log10(peak) : -60,
    rms: rms > 0.00001 ? 20 * Math.log10(rms) : -60
  };
}
```

#### 6.2 Object Pooling

```javascript
// client/src/lib/utils/AudioNodePool.js
export class AudioNodePool {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.pools = new Map();
  }

  acquire(type) {
    const pool = this.pools.get(type) || [];
    
    if (pool.length > 0) {
      return pool.pop();
    }
    
    return this.create(type);
  }

  release(type, node) {
    this.reset(node);
    
    const pool = this.pools.get(type) || [];
    pool.push(node);
    this.pools.set(type, pool);
  }

  create(type) {
    switch (type) {
      case 'gain':
        return this.audioContext.createGain();
      case 'panner':
        return this.audioContext.createStereoPanner();
      case 'analyzer':
        const analyzer = this.audioContext.createAnalyser();
        analyzer.fftSize = 256;
        return analyzer;
      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  }

  reset(node) {
    if (node.gain) {
      node.gain.value = 1;
    }
    if (node.pan) {
      node.pan.value = 0;
    }
    try {
      node.disconnect();
    } catch (e) {}
  }

  prewarm(type, count) {
    const pool = this.pools.get(type) || [];
    for (let i = 0; i < count; i++) {
      pool.push(this.create(type));
    }
    this.pools.set(type, pool);
  }
}
```

---

### 7. 📚 TYPESCRIPT MIGRATION

#### 7.1 Migration Stratejisi

**Faz 1: Type Definitions (2 hafta)**
```typescript
// client/src/lib/types/audio.d.ts
export interface MixerInsertState {
  id: string;
  label: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  effects: EffectState[];
}

export interface EffectState {
  id: string;
  type: EffectType;
  bypass: boolean;
  settings: Record<string, number>;
}

export type EffectType = 
  | 'MultiBandEQ'
  | 'Compressor'
  | 'Limiter'
  | 'ModernReverb'
  | 'ModernDelay'
  | 'Saturator';
```

**Faz 2: Critical Paths (4 hafta)**
- MixerInsert.ts
- NativeAudioEngine.ts
- AudioContextService.ts

**Faz 3: Full Migration (8 hafta)**
- Tüm lib/ klasörü

---

## 📅 Uygulama Takvimi

### Sprint 1 (Hafta 1-2): Foundation
| Gün | Task | Öncelik |
|-----|------|---------|
| 1-2 | ErrorHandler utility oluştur | HIGH |
| 3-4 | Empty catch blocks düzelt (kritik dosyalar) | HIGH |
| 5-6 | Test setup (Vitest config) | HIGH |
| 7-8 | MixerInsert testleri yaz | HIGH |
| 9-10 | AudioErrorBoundary implement et | MEDIUM |

### Sprint 2 (Hafta 3-4): Modularization
| Gün | Task | Öncelik |
|-----|------|---------|
| 1-3 | PlaybackManager SchedulingOptimizer ayır | HIGH |
| 4-6 | PlaybackManager LoopController ayır | HIGH |
| 7-9 | AudioContextService MixerBridge ayır | HIGH |
| 10 | Integration tests | HIGH |

### Sprint 3 (Hafta 5-6): State & Sync
| Gün | Task | Öncelik |
|-----|------|---------|
| 1-3 | UnifiedAudioState implement et | MEDIUM |
| 4-6 | Store-Engine sync refactor | MEDIUM |
| 7-8 | Deprecated code cleanup | MEDIUM |
| 9-10 | Performance testing | MEDIUM |

### Sprint 4 (Hafta 7-8): Performance
| Gün | Task | Öncelik |
|-----|------|---------|
| 1-3 | Web Worker metering | MEDIUM |
| 4-6 | AudioNodePool implement et | MEDIUM |
| 7-8 | TypeScript type definitions | LOW |
| 9-10 | Documentation update | LOW |

---

## ✅ Başarı Kriterleri

| Metrik | Mevcut | Hedef Sprint 4 | Uzun Vadeli |
|--------|--------|----------------|-------------|
| En Büyük Dosya | 2619 lines | <1000 lines | <500 lines |
| Test Coverage | ~1% | >30% | >80% |
| Empty Catch Blocks | 72 | <20 | 0 |
| Deprecated Code | 14 | 0 | 0 |
| TODO/FIXME | 65 | <30 | <10 |
| TypeScript | 0% | Type defs | 100% |

---

## 🔗 İlgili Dokümanlar

- [SYSTEM_SWOT_ANALYSIS.md](./SYSTEM_SWOT_ANALYSIS.md)
- [MIXER_ADVANCED_OPTIMIZATION_PLAN.md](./MIXER_ADVANCED_OPTIMIZATION_PLAN.md)
- [MIXER_ROUTING_FLOW_ANALYSIS.md](./MIXER_ROUTING_FLOW_ANALYSIS.md)
- [ARCHITECTURE.md](../client/src/lib/ARCHITECTURE.md)

---

*Son Güncelleme: 2025-11-28*
*Versiyon: 1.0*

