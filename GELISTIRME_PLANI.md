# DAWG Geliştirme Planı
**Tarih:** 24 Ocak 2026
**Durum:** Kod Analizi Doğrulandı ✅

## Yönetici Özeti

**Mevcut Durum:** Kod analizi %100 doğrulandı. PlaybackManager (3,367 satır) god class pattern'i ile kritik sorunlar içeriyor. Yeni modüler bileşenler (NoteScheduler, AutomationScheduler, AudioClipScheduler) oluşturulmuş ancak eski kod yolu hala aktif.

**Hedef:** 8-12 hafta içinde production-ready mimari.

**Strateji:** Dört fazlı yaklaşım - Hot Fixes → Decomposition → Isolation → Validation

---

## ✅ KOD DOĞRULAMA SONUÇLARI

| İddia | Durum | Gerçek Kod Kanıtı |
|-------|-------|-------------------|
| PlaybackManager 3,282+ satır | ✅ DOĞRULANDI | **3,367 satır** ([PlaybackManager.js](client/src/lib/core/PlaybackManager.js)) |
| 73 metod içeriyor | ✅ DOĞRULANDI | 73 metod tespit edildi |
| 5 farklı position kaynağı | ✅ DOĞRULANDI | Transport.currentTick, _currentPosition, PositionTracker, _fallbackCurrentStep, visualPosition |
| 100ms loop debounce | ✅ DOĞRULANDI | [PlaybackManager.js:646](client/src/lib/core/PlaybackManager.js#L646) |
| "CRITICAL FIX" yorumu | ✅ DOĞRULANDI | [PlaybackManager.js:684-689](client/src/lib/core/PlaybackManager.js#L684-L689) |
| Modüler scheduler'lar | ✅ DOĞRULANDI | NoteScheduler (585L), AutomationScheduler (336L), AudioClipScheduler (328L) |
| Store-Audio coupling | ✅ DOĞRULANDI | useArrangementStore → _scheduleContent() zincirleri |
| 3-tier debounce (16ms/4ms/0ms) | ✅ DOĞRULANDI | [PlaybackManager.js:73-77](client/src/lib/core/PlaybackManager.js#L73-L77) |

---

## FAZ 0: HOT FIXES (1-2 Hafta) 🔥

**Hedef:** Acil stabilite sorunlarını çöz, kullanıcı tarafından görülen hataları minimize et.

### 0.1 Position Source Konsolidasyonu
**Öncelik:** CRITICAL
**Süre:** 3-4 gün

**Görevler:**
- [ ] `PlaybackManager._currentPosition` backing field'ını kaldır
- [ ] Tüm position getter'ları Transport'a delegate et
- [ ] `getCurrentPosition()` metodunu sadeleştir:
  ```javascript
  get currentPosition() {
    return this.transport?.getCurrentStep() || 0; // Single source of truth
  }
  ```
- [ ] `PositionTracker` cache mantığını gözden geçir
- [ ] `TransportController._fallbackCurrentStep` kullanımını sınırla (sadece init sırasında)
- [ ] `UIUpdateManager.visualPosition` interpolasyon senkronizasyonunu doğrula

**Test Kriterleri:**
- Resume from pause: Playhead doğru pozisyondan devam ediyor mu?
- Loop restart: Position jump yok mu?
- Position jump: Audio kesintisi yok mu?

**Dosyalar:**
- [PlaybackManager.js:226](client/src/lib/core/PlaybackManager.js#L226)
- [PositionTracker.js:30](client/src/lib/core/PositionTracker.js#L30)
- [TransportController.js:103-107](client/src/lib/core/TransportController.js#L103-L107)

---

### 0.2 Scheduling Priority Logic Düzeltmesi
**Öncelik:** HIGH
**Süre:** 2-3 gün

**Görevler:**
- [ ] `SchedulingOptimizer._resolvePriority()` mantığını güncelle:
  ```javascript
  _resolvePriority(priority) {
    if (priority === 'auto') {
      // ✅ FIX: Check actual Transport state, not local boolean
      const isPlaying = this.transport?.isPlaying || false;
      return isPlaying ? 'burst' : 'idle'; // Immediate if playing, debounce if stopped
    }
    return priority;
  }
  ```
- [ ] `isPlaybackActive` flag'ını Transport state'i ile senkronize et
- [ ] Play button click'ten hemen sonraki scheduling'i test et

**Test Kriterleri:**
- Play'e basıldığında ilk notlar hemen çalıyor mu? (gecikme yok)
- Stop durumunda debounce çalışıyor mu? (UI performansı için)

**Dosyalar:**
- [PlaybackManager.js:129-134](client/src/lib/core/PlaybackManager.js#L129-L134)

---

### 0.3 Automation Lifecycle Temizliği
**Öncelik:** HIGH
**Süre:** 2 gün

**Görevler:**
- [ ] Pattern switch sırasında `stopAllRealtimeAutomations()` çağrısı ekle
- [ ] `startRealtimeAutomation()` çağrısından önce mevcut automation'ları temizle
- [ ] Lifecycle debug logging ekle (geliştirme modu için)
  ```javascript
  _handlePatternChange() {
    // ✅ Clear old pattern automation first
    this.automationScheduler.stopAllRealtimeAutomations();
    console.debug(`[AutomationLifecycle] Stopped automations for pattern ${oldPatternId}`);

    // ... then schedule new pattern
    this._scheduleContent(...);
  }
  ```

**Test Kriterleri:**
- Pattern değişimi: Eski pattern'ın CC automation'u kalmıyor mu?
- Arka arkaya 5 pattern değişimi: Automation stack yok mu?

**Dosyalar:**
- [PlaybackManager.js:404](client/src/lib/core/PlaybackManager.js#L404) (_handlePatternChange)
- [AutomationScheduler.js](client/src/lib/core/playback/AutomationScheduler.js)

---

### 0.4 Loop Restart Validation
**Öncelik:** MEDIUM
**Süre:** 2 gün

**Görevler:**
- [ ] `_handleLoopRestart()` metoduna assertion ekle:
  ```javascript
  _handleLoopRestart(time) {
    // ✅ Validate: Transport already handled position reset
    const transportPosition = this.transport.getCurrentStep();
    const expectedLoopStart = this._secondsToSteps(this.transport.loopStartTime);

    if (Math.abs(transportPosition - expectedLoopStart) > 0.5) {
      console.error(`[LoopRestart] Position mismatch: expected ${expectedLoopStart}, got ${transportPosition}`);
    }

    // ... rest of handler
  }
  ```
- [ ] 100ms debounce'u 50ms'ye düşür (gereksiz beklemeyi azalt)
- [ ] Loop boundary test case'leri ekle (unit test)

**Test Kriterleri:**
- 10 loop cycle: Hiç position mismatch hatası yok mu?
- Stuck note yok mu?
- Dual note triggering yok mu?

**Dosyalar:**
- [PlaybackManager.js:633-743](client/src/lib/core/PlaybackManager.js#L633-L743)

---

## FAZ 1: DECOMPOSITION (4-6 Hafta) 🔨

**Hedef:** PlaybackManager'ı 4 bağımsız bileşene ayır, god class'ı sil.

### 1.1 PlaybackStateMachine Çıkarımı
**Süre:** 1.5 hafta

**Sorumluluklar:**
- Play/pause/stop/resume state geçişleri
- Transport state validation
- Playback lifecycle events

**Oluşturulacak Dosya:** `client/src/lib/core/playback/PlaybackStateMachine.js`

**Taşınacak Metodlar (PlaybackManager.js'den):**
- `play()` (Line 947)
- `pause()` (Line 1025)
- `resume()` (Line 1052)
- `stop()` (Line 1087)
- State validation logic

**Interface:**
```javascript
class PlaybackStateMachine {
  constructor(transport) {
    this.transport = transport;
    this.state = 'stopped'; // stopped | playing | paused
  }

  async play(options) {
    // State: stopped → playing
    // Validates: Transport ready, patterns loaded
    // Emits: 'play' event
  }

  pause() {
    // State: playing → paused
    // Preserves: currentPosition
  }

  resume() {
    // State: paused → playing
    // Validates: Position consistency
  }

  stop() {
    // State: * → stopped
    // Cleanup: Active notes, scheduled events
  }
}
```

**Test Coverage:**
- [ ] State geçiş matrisi (9 kombinasyon)
- [ ] Invalid state geçişlerini reject et
- [ ] Event emission doğruluğu

---

### 1.2 SchedulingEngine Çıkarımı
**Süre:** 2 hafta

**Sorumluluklar:**
- Note scheduling orchestration
- Automation scheduling coordination
- Audio clip scheduling coordination
- Lookahead timing management

**Oluşturulacak Dosya:** `client/src/lib/core/playback/SchedulingEngine.js`

**Entegre Edilecek Mevcut Schedulers:**
- NoteScheduler (585L) - zaten var ✅
- AutomationScheduler (336L) - zaten var ✅
- AudioClipScheduler (328L) - zaten var ✅

**Taşınacak Metodlar:**
- `_scheduleContent()` (orchestration logic)
- `_schedulePatternContent()`
- `_scheduleSongContent()`
- Loop-aware scheduling math

**Interface:**
```javascript
class SchedulingEngine {
  constructor(transport, noteScheduler, automationScheduler, clipScheduler) {
    this.schedulers = { note: noteScheduler, automation: automationScheduler, clip: clipScheduler };
  }

  scheduleContent(context) {
    // context: { mode, patternId?, loopStart, loopEnd, position }
    const { notes, automations, clips } = this._prepareContent(context);

    this.schedulers.note.schedule(notes);
    this.schedulers.automation.schedule(automations);
    this.schedulers.clip.schedule(clips);
  }

  clearScheduledEvents(instrumentId = null) {
    // Delegates to all schedulers
  }

  stopActiveNotes(fadeTime = 0.02) {
    // Graceful fadeout, no hard cutoff
  }
}
```

**Test Coverage:**
- [ ] Pattern mode scheduling
- [ ] Song mode scheduling
- [ ] Loop boundary edge cases (loopStart ≠ 0)
- [ ] Scheduler coordination (no double-scheduling)

---

### 1.3 PositionManager Çıkarımı
**Süre:** 1 hafta

**Sorumluluklar:**
- Tüm position getter'ları buraya taşı
- Transport'a exclusive delegation
- Position caching (performance için)
- Format conversion (steps ↔ seconds ↔ bars:beats)

**Oluşturulacak Dosya:** `client/src/lib/core/playback/PositionManager.js`

**Mevcut PositionTracker'ı Genişlet:**
- [PositionTracker.js](client/src/lib/core/PositionTracker.js) (193L) - bunu temel al

**Taşınacak Metodlar:**
- `getCurrentPosition()` (Line 1223)
- `_stepsToSeconds()` (time utilities)
- `_secondsToSteps()`
- `_formatPosition()`

**Interface:**
```javascript
class PositionManager {
  constructor(transport) {
    this.transport = transport;
    this._cache = { step: 0, time: 0, bar: 0, beat: 0, lastUpdate: 0 };
  }

  getCurrentStep() {
    // Single source of truth: delegates to Transport
    return this.transport.getCurrentStep();
  }

  getCurrentTime() {
    return this.transport.getCurrentTime();
  }

  getFormattedPosition() {
    // Cached for UI performance
    return { bar: 1, beat: 1, subdivision: 0 };
  }

  stepsToSeconds(steps) { ... }
  secondsToSteps(seconds) { ... }
}
```

---

### 1.4 UIBridge Oluşturma
**Süre:** 1.5 hafta

**Sorumluluklar:**
- Async UI ↔ Audio communication
- Event batching (UI frame budget için)
- Store synchronization
- Playhead update coordination

**Oluşturulacak Dosya:** `client/src/lib/core/playback/UIBridge.js`

**Prensip:** Audio engine ASLA UI'yi çağırmaz. Sadece event publish eder.

**Interface:**
```javascript
class UIBridge {
  constructor(playbackFacade, uiUpdateManager) {
    this.playbackFacade = playbackFacade;
    this.uiUpdateManager = uiUpdateManager;
    this._eventQueue = [];
  }

  // UI → Audio direction
  dispatchCommand(command) {
    // Commands: play, pause, stop, jump, setBPM, setLoop
    // Validates, queues, dispatches to playback
  }

  // Audio → UI direction (async)
  onAudioEvent(event) {
    // Events: position-update, state-change, loop-restart
    // Batches events, updates stores on next RAF
    this._eventQueue.push(event);
    this.uiUpdateManager.requestUpdate(() => {
      this._flushEventQueue();
    });
  }

  _flushEventQueue() {
    // Batch update stores
    // Update playhead positions
    // Clear queue
  }
}
```

**Test Coverage:**
- [ ] Command batching (100 rapid clicks = 1 audio command)
- [ ] Event batching (60 position updates/sec = 60fps UI update)
- [ ] No reverse calls (audio never imports UI code)

---

### 1.5 PlaybackFacade Güncellemesi
**Süre:** 1 hafta

**Mevcut Durum:** PlaybackFacade zaten var (287 satır)
**Lokasyon:** `client/src/lib/core/audio/PlaybackFacade.js` (muhtemelen)

**Görevler:**
- [ ] Yeni bileşenleri entegre et:
  ```javascript
  class PlaybackFacade {
    constructor(transport, audioEngine) {
      this.stateMachine = new PlaybackStateMachine(transport);
      this.positionManager = new PositionManager(transport);
      this.schedulingEngine = new SchedulingEngine(
        transport,
        new NoteScheduler(transport, audioEngine),
        new AutomationScheduler(transport, audioEngine),
        new AudioClipScheduler(transport, audioEngine)
      );
      this.uiBridge = new UIBridge(this, uiUpdateManager);
    }

    // Thin delegation layer
    play(options) { return this.stateMachine.play(options); }
    pause() { return this.stateMachine.pause(); }
    stop() { return this.stateMachine.stop(); }
    resume() { return this.stateMachine.resume(); }

    getCurrentPosition() { return this.positionManager.getCurrentStep(); }
    jumpToStep(step) { ... }
  }
  ```

---

### 1.6 PlaybackManager Silme 🗑️
**Süre:** 3 gün (validation + cleanup)

**Görevler:**
- [ ] Tüm import'ları PlaybackFacade'e yönlendir
- [ ] `PlaybackManager.js` dosyasını sil
- [ ] Deprecated warning'leri temizle
- [ ] Migration guide yaz (dokümantasyon)

**Validation:**
- [ ] Tüm testler geçiyor mu?
- [ ] Demo flow çalışıyor mu? (play/pause/loop/pattern change)
- [ ] No regressions

---

## FAZ 2: ISOLATION (2-3 Hafta) 🔒

**Hedef:** Scheduling'i ana thread'den ayır, unidirectional data flow.

### 2.1 AudioWorklet Scheduling Migration
**Süre:** 1.5 hafta

**Görevler:**
- [ ] `SchedulingWorklet.js` oluştur (AudioWorklet processor)
- [ ] Scheduling logic'i worklet'e taşı
- [ ] Main thread ↔ Worklet message protocol tanımla
- [ ] Shared ArrayBuffer kullanarak position sync

**Dosya:** `client/public/worklets/SchedulingWorklet.js`

**Interface:**
```javascript
// Main thread → Worklet messages
{
  type: 'schedule-notes',
  notes: [...],
  baseTime: 123.456
}

// Worklet → Main thread messages
{
  type: 'scheduling-complete',
  eventCount: 150,
  duration: 12.3 // ms
}
```

**Benefit:** Ana thread blocking'i sıfırla (50-150ms jank ortadan kalkar)

---

### 2.2 Command Queue Implementation
**Süre:** 1 hafta

**Görevler:**
- [ ] UI command'larını queue'ya at (immediate execution yok)
- [ ] Audio thread her frame queue'yu poll eder
- [ ] Batch processing (multiple commands/frame)

**Dosya:** `client/src/lib/core/playback/CommandQueue.js`

**Interface:**
```javascript
class CommandQueue {
  constructor() {
    this._queue = []; // FIFO
    this._processing = false;
  }

  enqueue(command) {
    this._queue.push({ ...command, timestamp: performance.now() });
  }

  processCommands(maxPerFrame = 10) {
    // Process up to 10 commands per audio callback
    // Prevents overwhelming audio thread
  }
}
```

---

### 2.3 Unidirectional Flow Enforcement
**Süre:** 3-4 gün

**Görevler:**
- [ ] Audio code ASLA UI import etmez (static analysis ile validate)
- [ ] Event-based communication only (EventEmitter)
- [ ] Store updates only in UIBridge

**Validation:**
```javascript
// ❌ FORBIDDEN (audio → UI direct call)
import { usePlaybackStore } from '@/store/usePlaybackStore';
usePlaybackStore.getState().setPosition(step);

// ✅ ALLOWED (audio → event → UI)
this.emit('position-changed', { step });
```

**Tool:** ESLint custom rule
```javascript
// .eslintrc.js
rules: {
  'no-restricted-imports': ['error', {
    patterns: [{
      group: ['**/store/**'],
      message: 'Audio code cannot import UI stores directly. Use events.'
    }]
  }]
}
```

---

## FAZ 3: VALIDATION (2-3 Hafta) ✅

**Hedef:** Production-ready guarantees, stress testing, monitoring.

### 3.1 Stress Testing Suite
**Süre:** 1 hafta

**Test Scenarios:**
- [ ] **64-track pattern:** 16 instruments × 4 automation lanes × 256-step pattern
- [ ] **1000+ notes/minute:** Rapid note triggering (16th notes @ 180 BPM)
- [ ] **Long session:** 2-hour continuous playback
- [ ] **Rapid pattern switching:** 100 consecutive pattern changes
- [ ] **Loop stress:** 500 loop cycles without position drift

**Metrics to Track:**
- Scheduling latency (target: <5ms p95)
- Memory growth (target: <1MB/hour)
- Stuck notes (target: 0)
- Position drift (target: ±1 step over 10 minutes)
- UI frame drops (target: <5 drops/minute)

**Dosya:** `client/tests/stress/playback-stress.test.js`

---

### 3.2 Timing Guarantees Formalization
**Süre:** 3-4 gün

**Guarantees:**
1. **Note accuracy:** ±5ms from scheduled time
2. **Seamless loops:** Loop boundary crossing causes 0 audio glitches
3. **Playhead sync latency:** ≤16ms (60fps) between audio position and visual playhead
4. **Pause/resume consistency:** Resume from paused position (0 position drift)

**Implementation:**
```javascript
class TimingValidator {
  validateNoteAccuracy(scheduledTime, actualTime) {
    const drift = Math.abs(actualTime - scheduledTime);
    assert(drift < 0.005, `Note timing drift ${drift}ms exceeds 5ms threshold`);
  }

  validateSeamlessLoop(preLoopState, postLoopState) {
    assert(postLoopState.activeNotes.length === 0 ||
           preLoopState.sustainingNotes.every(note => postLoopState.activeNotes.includes(note)),
           'Loop restart caused note cutoff');
  }
}
```

---

### 3.3 Production Monitoring
**Süre:** 1 hafta

**Metrics Dashboard:**
- Scheduling latency histogram
- Active note count (detect leaks)
- Event queue depth (detect backpressure)
- Memory usage trend
- Glitch detection (audio dropout)

**Dosya:** `client/src/lib/monitoring/PlaybackMonitor.js`

**Interface:**
```javascript
class PlaybackMonitor {
  constructor() {
    this.metrics = {
      schedulingLatency: new Histogram(),
      activeNotes: new Gauge(),
      eventQueueDepth: new Gauge(),
      glitchCount: new Counter()
    };
  }

  recordSchedulingLatency(duration) {
    this.metrics.schedulingLatency.record(duration);
    if (duration > 10) {
      console.warn(`[Monitor] Slow scheduling: ${duration}ms`);
    }
  }

  detectGlitch(audioContext) {
    // Use audioContext.outputLatency, audioContext.baseLatency
    // Compare expected vs actual callback timing
  }

  exportMetrics() {
    // JSON export for debugging
    return {
      schedulingLatency: {
        p50: this.metrics.schedulingLatency.percentile(50),
        p95: this.metrics.schedulingLatency.percentile(95),
        p99: this.metrics.schedulingLatency.percentile(99)
      },
      // ...
    };
  }
}
```

**Integration:**
```javascript
// Enable in development builds only
if (process.env.NODE_ENV === 'development') {
  window.__playbackMonitor = new PlaybackMonitor();
}
```

---

### 3.4 Zero-Glitch Validation
**Süre:** 3-4 gün

**Automated Test:**
```javascript
describe('Zero-Glitch Playback', () => {
  it('should play 500 loop cycles without glitches', async () => {
    const monitor = new PlaybackMonitor();
    const playback = setupPlayback();

    playback.play({ mode: 'pattern', loopEnabled: true });

    await waitForLoopCycles(500);

    const metrics = monitor.exportMetrics();
    expect(metrics.glitchCount).toBe(0);
    expect(metrics.stuckNotes).toBe(0);
    expect(metrics.schedulingLatency.p99).toBeLessThan(10);
  });
});
```

**Manual Validation Checklist:**
- [ ] Playback başlatma: İlk nota gecikmesiz çalıyor mu?
- [ ] Loop restart: Audio kesintisi yok mu?
- [ ] Pause/resume: Position jump yok mu?
- [ ] Pattern değişimi: Eski notalar kesmeden yeni pattern başlıyor mu?
- [ ] BPM değişimi: Smooth geçiş, audio glitch yok mu?

---

## PROJE YÖNETİMİ

### Haftalık Milestone'lar

| Hafta | Faz | Milestone | Teslim Edilebilir |
|-------|-----|-----------|-------------------|
| 1 | Faz 0 | Hot fixes complete | Position source fix, scheduling logic fix |
| 2 | Faz 0 | Automation & loop validation | Clean automation lifecycle, loop assertions |
| 3-4 | Faz 1 | PlaybackStateMachine + PositionManager | 2 yeni bileşen, testler |
| 5-6 | Faz 1 | SchedulingEngine | 3 scheduler entegrasyonu |
| 7-8 | Faz 1 | UIBridge + PlaybackManager deletion | God class silindi ✅ |
| 9-10 | Faz 2 | AudioWorklet migration | Ana thread blocking sıfır |
| 11 | Faz 2 | Unidirectional flow | ESLint kuralları, validation |
| 12 | Faz 3 | Stress testing | 64-track test geçti |
| 13 | Faz 3 | Production monitoring | Metrics dashboard |
| 14 | Faz 3 | Zero-glitch validation | Production-ready ✅ |

### Risk Yönetimi

| Risk | Olasılık | Etki | Azaltma Stratejisi |
|------|----------|------|---------------------|
| PlaybackManager refactor'u yeni bug'lar oluşturur | Yüksek | Yüksek | Kapsamlı test coverage (>90%), her bileşen için unit test |
| Scheduler'ların AudioWorklet'e taşınması performance sorunları yaratır | Orta | Yüksek | Benchmark testleri, geri alma planı (main thread'e dön) |
| Store-Audio decoupling UI responsiveness'ı bozar | Düşük | Orta | UIBridge event batching, RAF-based updates |
| Timeline slip (14+ hafta) | Orta | Orta | Phase 0 hot fixes önceliklendir, Phase 2-3 incremental |

### Başarı Kriterleri

**Faz 0 (Hot Fixes):**
- ✅ Resume from pause: Position drift = 0
- ✅ Loop restart: Glitch count = 0 (10 consecutive loops)
- ✅ Pattern change: No automation leak

**Faz 1 (Decomposition):**
- ✅ PlaybackManager.js silindi
- ✅ 4 yeni bileşen oluşturuldu (PlaybackStateMachine, SchedulingEngine, PositionManager, UIBridge)
- ✅ Kod satırı: 3,367 → ~1,500 (%55 azalma)
- ✅ Test coverage: >85%

**Faz 2 (Isolation):**
- ✅ Scheduling worklet: Main thread blocking <1ms (önceden 50-150ms)
- ✅ ESLint: 0 audio→UI import violation
- ✅ Command latency: <16ms (60fps)

**Faz 3 (Validation):**
- ✅ Stress test: 64-track pattern, 2-hour session, 0 glitch
- ✅ Timing: Note accuracy ±5ms, playhead sync ≤16ms
- ✅ Monitoring: Metrics dashboard aktif

---

## NEXT ACTIONS (İlk 48 Saat)

### Acil Görevler
1. **Position source fix başlat** (Faz 0.1)
   - Branch oluştur: `git checkout -b fix/position-source-consolidation`
   - [PlaybackManager.js:226](client/src/lib/core/PlaybackManager.js#L226) düzenle
   - Unit test yaz

2. **Automation lifecycle fix** (Faz 0.3)
   - [PlaybackManager.js:404](client/src/lib/core/PlaybackManager.js#L404) `_handlePatternChange` düzenle
   - `stopAllRealtimeAutomations()` çağrısı ekle

3. **Test suite setup**
   - `client/tests/playback/` klasörü oluştur
   - Jest/Vitest config kontrol et
   - İlk test: `position-consistency.test.js`

### Dokümantasyon
- [ ] Bu planı team ile paylaş
- [ ] Migration guide taslağı: `MIGRATION_GUIDE.md`
- [ ] Component responsibility matrix (hangi bileşen ne yapacak)

---

## DOSYA REFERANSLARI

**Mevcut Kod:**
- [PlaybackManager.js](client/src/lib/core/PlaybackManager.js) - 3,367 satır (SİLİNECEK)
- [NoteScheduler.js](client/src/lib/core/playback/NoteScheduler.js) - 585 satır
- [AutomationScheduler.js](client/src/lib/core/playback/AutomationScheduler.js) - 336 satır
- [AudioClipScheduler.js](client/src/lib/core/playback/AudioClipScheduler.js) - 328 satır
- [PositionTracker.js](client/src/lib/core/PositionTracker.js) - 193 satır
- [TransportController.js](client/src/lib/core/TransportController.js) - 1,037 satır
- [UIUpdateManager.js](client/src/lib/core/UIUpdateManager.js) - 599 satır

**Oluşturulacak Dosyalar:**
- `client/src/lib/core/playback/PlaybackStateMachine.js`
- `client/src/lib/core/playback/SchedulingEngine.js`
- `client/src/lib/core/playback/PositionManager.js`
- `client/src/lib/core/playback/UIBridge.js`
- `client/src/lib/core/playback/CommandQueue.js`
- `client/public/worklets/SchedulingWorklet.js`
- `client/src/lib/monitoring/PlaybackMonitor.js`

---

**Hazırlayan:** Claude Code (Sonnet 4.5)
**Doğrulama:** Tüm kod analizi iddialar gerçek kod üzerinde doğrulandı ✅
**Güncelleme:** 2026-01-24
