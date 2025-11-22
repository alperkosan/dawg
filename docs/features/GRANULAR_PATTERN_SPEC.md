# Granular Pattern Sequencer Spec

**Status:** Draft  
**Related Docs:** `GRANULAR_MODE_UI_UX_PLAN.md`

---

## 1. Amaç

Kullanıcının granular motoru sadece makro parametrelerle değil, zaman ekseninde klipler oluşturarak sekanslayabilmesini sağlamak. Kullanıcı:

- Pattern uzunluğunu belirleyebilmeli (ör. 1–8 bar)
- Parametre klipleri (density, grain size, position vb.) çizip otomasyon gibi çalabilmeli
- Pattern’leri kayıt edip farklı preset/projelerde kullanabilmeli
- Arrangement veya Channel Rack içinde granular pattern toplayıp tetikleyebilmeli

---

## 2. Konsept Bileşenleri

```
GranularPatternEditor
├─ PatternTimeline
│  ├─ Ruler (bars/beats)
│  ├─ Grid (snap: 1/4, 1/8, 1/16, 1/32)
│  ├─ ParamTrack (macro parameter per row)
│  │    ├─ ClipLayer (multiple clips allow layering)
│  │    └─ PatternClip (value automation)
│  └─ Playhead (sync with playback)
├─ TrackList (param selection + visibility toggle)
├─ ClipInspector (selected clip param / interpolation)
├─ TransportControls (play/loop length, zoom)
└─ PatternBank (save/recall pattern presets)
```

---

## 3. Veri Modeli

```ts
type GranularPattern = {
  id: string;
  name: string;
  length: number; // steps (e.g. 64 = 4 bars at 16 steps/bar)
  snap: '1/4' | '1/8' | '1/16' | '1/32';
  tracks: GranularPatternTrack[];
  loopEnabled: boolean;
  editorState?: {
    zoom: number;
    scrollX: number;
  };
};

type GranularPatternTrack = {
  id: string; // e.g. 'macro.density'
  label: string;
  type: 'macro' | 'random' | 'envelope' | 'spatial';
  enabled: boolean;
  defaultValue: number;
  clips: PatternClip[];
};

type PatternClip = {
  id: string;
  start: number; // step index
  end: number;   // step index (exclusive)
  shape: 'hold' | 'linear' | 'curve'; // interpolation type
  valueStart: number;
  valueEnd: number;
  easing?: 'easeIn' | 'easeOut' | 'easeInOut';
  modulation?: ModTargetAssignment[];
};

type ModTargetAssignment = {
  source: 'lfo1' | 'env1' | string;
  amount: number;
};
```

**Notlar**
- Pattern length = `stepsPerBar * barCount`. Varsayılan 4 bar @ 16 steps → 64.
- Track defaultValue, knob panelindeki mevcut değeri yansıtacak (pattern play dışındayken).
- Clips overlapping: aynı track’te çakışan klipler birleştirilebilir veya layer (en güncel, “topmost” clip override).
- Shape=hold: param aniden değişir. Shape=linear/curve: param tween.

---

## 4. Engine Event Akışı

```
PatternScheduler (new)
├─ prepare(pattern, bpm, sampleRate)
├─ start(atTime)
├─ stop()
├─ getActiveClips(time)
└─ getTransportInfo()

PatternClip → to ParamEvent(s)
ParamEvent = {
  paramId: 'macro.density',
  time: number,         // AudioContext time
  value: number,
  interpolation: 'step'|'linear'|'curve',
  duration?: number,
}

AudioContext → GrainScheduler
    applyParamEvent(event)
```

1. PatternScheduler pattern’i granularSettings ile birleştirir.
2. Param event’ler `setTimeout` benzeri scheduling yerine audioContext time tabanlı queue ile anlık yazılır.
3. Macro knob drag → pattern editör ile canlı senkron:
   - Pattern oynarken knob = preview of clip value (ghost).
   - Pattern durduğunda knob = defaultValue restore.

---

## 5. UI/UX Detayları

### 5.1 Track List
- Varsayılan macro trackleri (Density, Grain Size, Jitter, Stretch, Pitch, Mix).
- Random tracks (Position Random, Pitch Random, Reverse Probability).
- Envelope tracks (Attack, Hold, Release – splitting grain envelope).
- Spatial tracks (Spread, Pan Random, Doppler).
- Toggle ile track gizleme (daha sade timeline).
- Renk kodlama: Macro (cyan), Random (purple), Envelope (green), Spatial (blue).

### 5.2 Clip Interaction
- Draw: `Alt` + drag ile clip (veya toolbar’daki Draw mode).
- Select: click → Inspector (value start/end, shape).
- Resize: drag edges.
- Duplicate: `Cmd+D`.
- Clear: `Delete`.
- Snap: default 1/16; UI slider / dropdown.
- Undo/redo: instrument editor history ile entegre.

### 5.3 Clip Inspector
- Value range slider (0–1, -12–12 vs param tipine göre).
- Shape dropdown + easing (e.g. for granular sweeps).
- Copy/paste param curves.

### 5.4 Pattern Controls
- Length selector (1 bar – 8 bar).
- Loop on/off, play, stop (play instrument preview).
- Zoom slider + timeline scrub.
- CPU meter (grain rate) overlay.

### 5.5 Pattern Bank
- Save current pattern as preset (name + metadata).
- Pattern preview (length, used tracks).
- Export/import JSON.
- Quick load (“Init Pattern”, “Random Variations”).

---

## 6. Store & Persistence

Zustand state genişletmesi:

```ts
granularPatterns: Record<string, GranularPattern>;
activePatternId: string | null;
granularPatternBank: Record<string, GranularPatternPreset>;

actions:
  setPattern(instrumentId, pattern);
  updatePattern(instrumentId, updates);
  setPatternLength(instrumentId, length);
  addPatternClip(instrumentId, trackId, clip);
  updatePatternClip(instrumentId, trackId, clipId, updates);
  deletePatternClip(instrumentId, trackId, clipId);
  savePatternPreset(name, pattern);
  loadPatternPreset(instrumentId, presetId);
```

`instrumentData` içinde:

```json
{
  "playbackMode": "granular",
  "granularSettings": { ... },
  "granularPattern": {
    "id": "pattern-1",
    "length": 64,
    "tracks": [
      {
        "id": "macro.density",
        "clips": [
          { "id": "clip-1", "start": 0, "end": 16, "valueStart": 12, "valueEnd": 24 }
        ]
      }
    ]
  }
}
```

Persistence: Project JSON’a pattern data dahil. Snapshot/preset export ≈ granular paneldeki snapshot mantığı ile hizalanmalı (pattern + settings birlikte kaydedilebilir).

---

## 7. Ses Motoru Genişletmesi

1. `MultiSampleInstrument` → `granularPattern` state’i tutar.
2. Pattern playback: note on/off ile tetiklenir (arrangement/preview).
3. Pattern scheduler, grain scheduler ile paralel çalışır:
   - Macro param default knob values = baseline.
   - Pattern event geldiğinde param override (sadece clip süresi boyunca).
   - Clip bittikten sonra param knob değerine döner (veya bir sonraki clip).
4. Freeze/randomize pattern modunda:
   - Freeze pattern param override’larını bypass eder.
5. Telemetry: grainCount, CPU, activeClips → UI HUD.

---

## 8. Test Senaryoları

| Test | Adım | Beklenen |
|------|------|----------|
| Basit pattern | Density track’e 4 clip, start 12 → end 24 | Akışte yoğunluk artışı audibly duyulur |
| Loop | Pattern loop açık, arrangement note 8 bar | Pattern seamless loop |
| Knob override | Pattern oynarken knob drag | Clip ghost overlay, pattern bittiğinde knob kontrol |
| Preset save/load | Pattern kaydet, yeni instrument → load | Aynı klipler yeniden çizilir |
| Export/import | JSON export, farklı proje → import | Pattern data taşınır |

---

## 9. Açık Sorular

- Pattern playback arrangement’daki notayla mı belirlenir (nota uzunluğu pattern’i kaç kere loop edeceğini belirlesin)?
- Pattern clip’lerinde ease-in/out için hangi easing fonksiyonlarını sunmalıyız?
- Macro knob ile pattern eşzamanlı edit: Pattern playing iken knob değerinin pattern clip’ini “anında” editlemesi mi yoksa pattern dururken mi?
- CPU limit: Yüksek pattern + granular param (stretch >3) CPU’yu aşarsa fallback stratejisi?
- Pattern bank: global mi (tüm projelere) yoksa proje bazlı mı?

---

## 10. Sonraki Adımlar

1. İş gereken backlog’a ekle: `granular-pattern-1` (data model + timeline skeleton).
2. Mockup: Pattern timeline UI (Figma).
3. Motor prototipi: Param event queue + density override.
4. Telemetri HUD prototipi.
5. Kullanıcı testi: Sound designer ile pattern editing seansı.







