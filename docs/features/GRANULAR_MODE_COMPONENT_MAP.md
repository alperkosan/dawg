# Granular Mode UI Component Architecture

**Status:** Draft (Sprint 1)  
**Linked Docs:** `GRANULAR_MODE_UI_UX_PLAN.md`

---

## 1. Component Tree Overview

```
GranularModePanel
├─ ModeHeader
│  ├─ ModeToggle
│  └─ SnapshotMenu
├─ MacroSection
│  └─ MacroKnobGrid
│     ├─ MacroKnob (Density)
│     ├─ MacroKnob (Grain Size)
│     ├─ MacroKnob (Jitter)
│     ├─ MacroKnob (Stretch)
│     ├─ MacroKnob (Pitch)
│     └─ MacroKnob (Mix)
├─ GranularVisualizer (canvas)
│  ├─ VisualOverlayControls
│  │  ├─ PlayheadLockToggle
│  │  ├─ FreezeButton
│  │  └─ RandomizeButton
│  └─ GrainCanvas (pure canvas renderer)
└─ AdvancedDrawer
   ├─ AdvancedTabs
   │  ├─ RandomTab
   │  ├─ EnvelopeTab
   │  ├─ SpatialTab
   │  ├─ ModulationTab
   │  └─ SnapshotTab
   └─ AdvancedFooter (Reset, Learn More link)
```

**Responsive Davranış:**  
- `< 992px` : Macro section tek sütun, advanced drawer tam genişlikte overlay.  
- `>= 992px`: Macro + visualizer üstte, advanced drawer sağda (two-column layout).

---

## 2. Component Responsibilities

| Component | Sorumluluk | Props | State | Not |
|-----------|-------------|-------|-------|-----|
| `GranularModePanel` | Ana container, mode state ve store senkronu | `instrumentId`, `granularSettings`, `onUpdate` | - local UI state (drawer açık/kapalı) | Mode toggle işlemlerini yönetir |
| `ModeHeader` | Başlık + mode & snapshot erişimi | `mode`, `onModeChange`, `snapshots` | - | Progress indicator + tooltip |
| `ModeToggle` | Standard / Granular / Hybrid seçimi | `mode`, `onChange` | - | Button-group |
| `SnapshotMenu` | Snapshot kaydet/çağır | `snapshots`, `onSave`, `onLoad`, `onDelete` | dropdown state | Modal confirm |
| `MacroKnobGrid` | Macro knob’ların düzeni | `macroSettings`, `onChange` | hover state | 2 x 3 grid; knob bileşeni canvas tabanlı |
| `MacroKnob` | Tek knob UI | `label`, `value`, `min`, `max`, `step`, `onChange`, `tooltip`, `modMapped` | internal drag state | Mod ataması highlight |
| `GranularVisualizer` | Grain akışının görselleştirilmesi | `macroSettings`, `advancedSettings`, `grainStats`, `onFreeze`, `onRandomize`, `isLocked` | canvas internal state (size, animation frame) | Canvas/WebGL fallback |
| `PlayheadLockToggle` | Playhead sabitleme | `locked`, `onToggle` | - | Icon button |
| `FreezeButton` | Freeze snapshot | `onFreeze`, `isDisabled` | - | Confirm prompt? |
| `RandomizeButton` | Param randomize | `onRandomize`, `seedOptions` | - | Seed selection popover |
| `AdvancedDrawer` | Slider panel | `isOpen`, `onClose`, `tabs` | selected tab | Slide/overlay animasyonu |
| `AdvancedTabs` | Tab navigation | `tabs`, `activeTab`, `onTabChange` | - | Tab component (buttons) |
| `RandomTab` | Randomization kontrolleri | `randomSettings`, `onChange` | - | Sliders + probability toggles |
| `EnvelopeTab` | Grain envelope & ADSR | `envelopeSettings`, `onChange` | envelope preview state | Canvas mini plot |
| `SpatialTab` | Stereo/spatial parametreler | `spatialSettings`, `onChange` | - | Spread slider, width meter |
| `ModulationTab` | Granular param target seçenekleri | `availableTargets`, `assignedTargets`, `onAssign`, `onRemove` | list/select state | Multi-select with tags |
| `SnapshotTab` | Snapshot yönetimi | `snapshots`, `onRename`, `onDelete` | editing state | Inline rename |
| `AdvancedFooter` | Reset & docs erişimi | `onReset`, `docsLink` | - | Basit button row |

---

## 3. State & Data Flow

### 3.1 Zustand Store Sözleşmesi

```ts
type GranularMacroSettings = {
  density: number;     // grains/sec
  grainSize: number;   // ms
  jitter: number;      // 0-1
  stretch: number;     // ratio
  pitch: number;       // semitone
  mix: number;         // 0-1
};

type GranularAdvancedSettings = {
  random: {
    position: number;
    pitch: number;
    reverseProb: number;
  };
  envelope: {
    window: 'hann' | 'triangle' | 'gaussian';
    attack: number;
    hold: number;
    release: number;
  };
  spatial: {
    spread: number;
    panRandom: number;
    doppler: number;
  };
};

type GranularSettings = {
  macro: GranularMacroSettings;
  advanced: GranularAdvancedSettings;
  modulationTargets: Array<{ id: string; target: string }>;
  snapshots: Array<{ id: string; name: string; settings: GranularSettingsSnapshot }>;
};
```

Zustand actions:
```ts
setGranularMode(instrumentId, mode);
setGranularParam(instrumentId, path, value); // path örn: ['macro', 'density']
saveGranularSnapshot(instrumentId, name);
loadGranularSnapshot(instrumentId, snapshotId);
deleteGranularSnapshot(instrumentId, snapshotId);
```

### 3.2 Audio Sync

```
MacroKnob onChange ─► setGranularParam ─► Zustand
    │                         │
    └─────────────────────────┘ (subscribe) ─► AudioEngine.updateInstrumentParameters
                                          └─ MultiSampleInstrument.updateParameters({
                                              granularSettings: ...
                                             })
```

Advanced drawer parametreleri de aynı mekanizmayı kullanır (path-based update).

---

## 4. Event Handling & Performance

- Macro knob değişimleri throttled (`requestAnimationFrame`) – UI fluid, engine update’leri diff’lenir.
- Visualizer `requestAnimationFrame` loop + `grainStats` (scheduler’dan 30Hz telemetry).
- Freeze/Randomize butonları async param set; state locked (loading indicator).
- Drawer transition CSS + `prefers-reduced-motion` göz önünde.

---

## 5. Styling & Theming

- Global CSS varlıkları: `_granularPanel.css`.
- BEM benzeri class yapısı:
  ```
  .granular-panel
    &__header
    &__macros
    &__visualizer
    &__advanced
  ```
- Zenith teması renkleri:
  - Arka plan: `var(--zenith-surface-elevated)`
  - Vurgu: `var(--zenith-accent-cyan)`
  - Uyarı: `var(--zenith-warning)`
- Canvas overlay: subtle noise (workspace ile uyumlu).

---

## 6. Açık Sorular / TBD

- Visualizer WebGL mi yoksa optimized canvas mı? (performans testi)
- Modulation tabında granular parametreleri ana modulation matrix’e bağlamak mı, yoksa panel içi mi limitlenecek?
- Snapshot paylaşımı: Global preset sistemiyle entegre mi olacak?
- Freeze fonksiyonu gerçek zamanlı “grain freeze” mi yoksa sample’dan bounce mu?

---

## 7. Sonraki Adımlar

1. Figma (veya tercih edilen araç) üzerinde mid-fi mockup → component tree’yi doğrula.
2. `GranularModePanel` scaffold’u oluştur; mock state ile knob & drawer layout’unu hazırla.
3. Canvas vizualizer için prototip (statik data ile) – performans ölç.
4. Advanced tab’ları incremental olarak implement et (Random → Envelope → Spatial → Modulation → Snapshots).

Bu doküman “component map” çalışmasıdır, implementasyon sırasında güncellenecektir.






