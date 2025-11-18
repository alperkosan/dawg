# Granular Mode – UX-Driven Implementation Plan

**Status:** Draft (Sprint 1)  
**Last update:** 2025-11-12  
**Owner:** Instruments Team (UI/Audio)

---

## 1. Kullanıcı Profilleri & Kullanım Senaryoları

| Persona | Motivasyon | Ana Akışlar |
|---------|------------|-------------|
| **Speed Creator** (Beat-maker) | Hızlı ilham, preset gezisi | - Sample'ı granular moda almak<br>- Hazır makro kontrollerle hızlı şekil vermek<br>- Randomize / lock seçenekleriyle çıkış almak |
| **Sound Designer** (Detaycı) | Derin parametre kontrolü | - Macro + advanced paneller arasında geçiş<br>- Grain yapısını görsel olarak takip etmek<br>- Parametreleri otomasyon, MIDI CC ile bağlamak |
| **Live Performer** | Sahnede esneklik | - Macro parametreleri performansta makine üstünden döndürmek<br>- Grain akışını görsel olarak denetlemek<br>- Hızlı preset kaydetme/çağırma |

> **Hedef:** Bu üç persona'nın tamamı, tek ekranda (Zenith temasıyla uyumlu) aradığını bulmalı. Macro panelde “hızlı sonuç”, Advanced panelde “mikro cerrahi” hissi.

---

## 2. Mimari Özet

```
┌────────────────────── Instrument Editor (React) ──────────────────────┐
│  GranularModePanel                                                   │
│  ├─ ModeToggle (Standard / Granular / …)                             │
│  ├─ MacroControls (Density, Size, Jitter, Stretch, Pitch, Mix)       │
│  ├─ GranularVisualizer (canvas)                                      │
│  └─ AdvancedDrawer                                                   │
│     ├─ Randomization (position, pitch, reverse)                      │
│     ├─ Envelope (grain window, ADSR, sync)                           │
│     ├─ Spatial (spread, pan jitter)                                  │
│     ├─ Modulation Routing (LFO/Envelope targets)                     │
│     └─ Snapshot Manager (save/recall)                                │
│                                                                      │
│  Zustand Store (instrument editor state)                             │
│  ├─ `instrumentData.granularSettings`                                │
│  ├─ `uiState.granularPanel` (drawer açık/kapat)                      │
│  └─ Actions: `setGranularParam`, `toggleGranularMode`, …             │
└──────────────────────────────────────────────────────────────────────┘
┌────────────────────── Audio Engine (WebAudio) ───────────────────────┐
│  MultiSampleInstrument                                               │
│  ├─ `mode`: "standard" | "granular"                                  │
│  ├─ `granularEngine`: GranularSamplerInstrument (reused/adapted)     │
│  ├─ Param map:                                                       │
│  │   - macro: { density, size, jitter, stretch, pitch, mix }         │
│  │   - advanced: { random, envelope, spatial }                       │
│  └─ Routing: Mixer → FX → Master (SSOT, PreviewManager dahil)        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. UI/UX Tasarım İlkeleri

1. **Macro Öncelikli:** İlk bakışta 5–6 makro knob + waveform üzerinden granular hissi.
2. **Canlı Geri Bildirim:** Canvas tabanlı grain vizualizer (grains per second, jitter, reverse oranı).
3. **Modüler Layout:** Macro üstte, advanced drawer/sekme altta. 992px ve üzeri genişlikte iki kolon.
4. **Tema Uyumu:** Zenith teması (koyu arka plan, neon vurgu) + noise/grid overlay (workspace tasarımına uyum).
5. **Mikro Eğitim:** İlk açılışta 3 adımlı tooltip (Mode toggle, Macro ayarları, Advanced drawer).
6. **Performans Bilinçli:** Ağır canvas animasyonları throttle + requestAnimationFrame (60 FPS hedef, degrade fallback).

---

## 4. Low-Fi Wireframe Notları (Sprint 1)

### 4.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Header (Instrument name + Mode Selector)                     │
├──────────────────────────────────────────────────────────────┤
│ Macro Panel (2 satır x 3 knob grid)                          │
│  [Density] [Grain Size] [Jitter]                             │
│  [Stretch] [Pitch]      [Mix]                                │
├──────────────────────────────────────────────────────────────┤
│ Granular Visualizer (Canvas + overlay controls)              │
│  - Waveform + Grain bursts                                   │
│  - Playhead + lock/unlock                                    │
│  - Freeze / Randomize buttons                                │
├──────────────────────────────────────────────────────────────┤
│ Advanced Drawer (collapsible)                                │
│  Tabs: [Random] [Envelope] [Spatial] [Modulation] [Snapshots]│
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Interaction Flow

1. Kullanıcı sample seçer → Mode toggle “Granular” yapılır.
2. Macro knob’ları çevirir → anlık ses + canvas update.
3. Advanced drawer’ı açar → Random tab’da reverse olasılığını ayarlar.
4. Snapshot kaydeder → Preset listesi “Granular Snapshots” altına eklenir.
5. MIDI CC map özelliği: knob üzerine sağ tık → “Assign MIDI CC”.

---

## 5. UI Bileşenleri & Teknik Detaylar

| Bileşen | Tip | Notlar |
|---------|-----|--------|
| `GranularModeToggle` | React + Zustand | Mode state değişimi, background engine switch |
| `MacroKnobGrid` | CanvasKnob (mevcut knob bileşenleri) | Çoklu param update, debounced audio update |
| `GranularVisualizer` | Canvas / WebGL (fallback canvas) | Grain spawn, density heatmap, jitter overlay |
| `FreezeButton`, `RandomizeButton` | Small control | Freeze: mevcut sample cut-out, Randomize: param range’e göre seed |
| `AdvancedDrawer` | Sliding panel | İçeride tab navigation (React state) |
| `RandomTab` | Form knobs + toggles | positionRandom, pitchRandom, reverseProb |
| `EnvelopeTab` | ADSR çizimi + window type | grainEnvelope select (hann/triangle/gaussian), envelope ADSR |
| `SpatialTab` | Pan spread, width, doppler | stereo etkiler |
| `ModulationTab` | LFO routing | Granular param targets (density, position, stretch) |
| `SnapshotTab` | List + Save/Recall | Local preset kaydı, rename, delete |

---

## 6. Audio Engine Entegrasyon Planı

### 6.1 Katmanlar Arası Akış

```
UI (React) ── Zustand Store ── InstrumentStore / AudioEngine ── Playback & Preview
    │                │                    │                        │
    │ setGranularParam()                 updateInstrumentParameters()
    │──────────────► granularSettings ──────────────► MultiSampleInstrument
                                                      ├─ mode: 'standard' | 'granular'
                                                      ├─ granularEngine (GranularSamplerInstrument)
                                                      └─ standard voices (SampleVoice)
```

### 6.2 Mode Switch Stratejisi

| Alan | Yapılacak | Not |
|------|-----------|-----|
| **Instrument Data** | `instrumentData.playbackMode` (enum: `standard`, `granular`, gelecekte `hybrid`) | Default mevcut davranış |
| **Store** | Zustand’da `setPlaybackMode(id, mode)` action’ı | Instrument editor + Channel Rack senkron |
| **AudioEngine** | `MultiSampleInstrument` içerisinde `switchMode(mode)` | - Mode değişince aktif sesleri durdur<br>- GranularSamplerInstrument instance’ını lazy initialize<br>- Sample buffer paylaşımı (tek kaynak) |
| **PreviewManager** | `setInstrument` sırasında mode’a göre preview motoru | Piano roll / file browser / instrument editor aynı motoru kullanır |

**Fail-safe:** Mode değişiminde param restore; standard → granular geçişte granular varsayılanları yükle, granular → standard dönüşte standard param’ları koru.

### 6.3 Parametre Haritalama

| Katman | Param Anahtarları | Not |
|--------|-------------------|-----|
| UI Macro | `granularSettings.macro = { density, grainSize, jitter, stretch, pitch, mix }` | Knob grid |
| Advanced Random | `granularSettings.random = { positionRandom, pitchRandom, reverseProb }` | Drawer |
| Advanced Envelope | `granularSettings.envelope = { windowType, attack, hold, release }` | Grain window + ADSR |
| Spatial | `granularSettings.spatial = { spread, panRandom, doppler }` | Stereo kontroller |
| Mod Targets | `granularSettings.modulationTargets = [...]` | LFO/Envelope mapping |

**Store → Engine:**  
`AudioEngine.updateInstrumentParameters(id, { granularSettings })`  
`MultiSampleInstrument.updateParameters` içinde `granularEngine.updateParams(granularSettings)` dispatch edilir.

**Engine içi:**  
```js
if (mode === 'granular') {
  this.granularEngine.updateParams({
    macro: granularSettings.macro,
    random: granularSettings.random,
    envelope: granularSettings.envelope,
    spatial: granularSettings.spatial
  });
}
```

### 6.4 Sample Yönetimi & Buffer Paylaşımı

1. MultiSampleInstrument initialize olurken sample buffer map’i oluşturuyor.
2. Granular moda geçildiğinde:
   - `granularEngine` yoksa instantiate.
   - `granularEngine.loadSample(activeBuffer)` çağrısı (aktif sample/preset bazında).
   - Granular snapshot/preset’lerde buffer url saklanır (fallback: ilk multi sample).
3. Sample değiştiğinde (ör. yeni kit yükleme) hem standard hem granular motor güncellenir.

### 6.5 Playback & Preview Senkronizasyonu

| Sistem | Yapılacak | Detay |
|--------|-----------|-------|
| **PreviewManager** | `previewManager.setInstrument(instrumentData)` granular ayarları geçir | Piano roll, editor, file browser |
| **Arrangement Playback** | PlaybackManager not scheduling → `MultiSampleInstrument` `noteOn` | Mode = granular ise `granularEngine.noteOn` |
| **Freeze/Randomize** | UI’da eylem tetiklenince store + engine aynı anda güncellenir | Freeze (grain pattern snapshot), Randomize (seed) |

### 6.6 Performans & Kaynak Yönetimi

- **Grain Pool Skalası:** Density’ye ve polyphony’ye göre dinamik.
  ```js
  const poolSize = clamp(basePool * (1 + polyphonyFactor), min, max);
  ```
- **Param Update Throttle:** UI → Engine 60 FPS limit (`requestAnimationFrame` + diff).
- **Cleanup:** Mode değişiminde granular engine dispose; Memory leak önleme.
- **Audio Worklet (Opsiyonel V2):** İlk sürüm main-thread scheduler; performans ölçümüne göre worklet sürümü planlanacak.

### 6.7 Persistans & Snapshot

- Proje JSON’unda:
  ```json
  {
    "playbackMode": "granular",
    "granularSettings": { ... }
  }
  ```
- Snapshot formatı: `granularSnapshots: Array<{ name, settings, timestamp }>`
- Export/Import: Snapshot’lar preset sistemiyle uyumlu JSON.

### 6.8 Açık Teknik İşler

1. `MultiSampleInstrument` içine mode switch + granular engine yönetimi ekle.
2. `GranularSamplerInstrument` param API’sini macro/advanced struct’ına uyarlamak.
3. PreviewManager’da mode-aware instrument instantiate.
4. Zustand store’da granular settings & mode actions.
5. AudioEngine route’larında granular output’un mixer kanalına bağlanması + FX chain uyumu.

Yukarıdaki adımlar `granular-2` (Engine Integration Plan) tamamlanınca sprint tasklarına kırılacak.

---

## 7. Test Stratejisi

| Test Tipi | Kapsam | Not |
|-----------|--------|-----|
| **UI Usability** | 3 persona için task bazlı walkthrough | “Macro knob ile karakter değiştir”, “Reverse olasılığını arttır”, “Snapshot kaydet” |
| **Audio Accuracy** | Grain density, jitter, pitch random | Unit test (scheduler param), manuel kulak testi |
| **Performance** | CPU usage (Low/High settings), canvas FPS | Chrome devtools + custom metrics |
| **Regression** | Standard playback, time stretch, modulation | Multi-sample regression suite |

---

## 8. Timeline (Sprint Önerisi)

| Sprint | Hedefler |
|--------|----------|
| **Sprint 1** | UX araştırma, low-fi mockup, API haritası (bu doküman) |
| **Sprint 2** | Audio engine refactor (mode switch, param map), store güncellemeleri |
| **Sprint 3** | UI implementasyonu (macro + visualizer), basic snapshot |
| **Sprint 4** | Advanced drawer, modulation entegrasyonu, performans optimizasyonu |
| **Sprint 5** | QA, usability testing, docs & tutorial, beta release |
| **Sprint Pattern-1** | Granular pattern veri modeli, timeline temel UI, motor event kuyruğu |
| **Sprint Pattern-2** | Macro param klipleri, canlı önizleme, undo/redo entegrasyonu |
| **Sprint Pattern-3** | Position & random klipleri, pattern preset export/import, telemetri heatmap |
| **Sprint Pattern-4** | Pattern↔arrangement entegrasyonu, performans tuning, dokümantasyon |

---

## 9. Açık Sorular

- Grain vizualizer’ı WebGL ile mi yoksa canvas + precomputed path ile mi yapmalıyız? (Performans testi gerekli)
- Freeze (resample) özelliği realtime mı yoksa offline bounce mı olacak?
- Mapping / MIDI CC UI’sini granular panel için genellemek mi (tüm enstrümanlara) yoksa sadece granular'a özel mi?
- Snapshot’ları global preset sistemine bağlayacak mıyız yoksa sadece granular panel içinde mi tutacağız?

---

## 10. Sonraki Adımlar

1. **(granular-2)** Engine integration planını detaylandır ve teknik görev listesine çevir.
2. **(granular-3)** React bileşen mimarisi için component tree + props/state sözleşmesi hazırla.
3. Mockup’ları Figma (veya tercih edilen araç) üzerinde orta seviye detaya taşımak.

> Bu doküman “Living Document” olarak güncellenecek. Her sprint sonunda “Plan vs Actual” bölümü eklenecek.

