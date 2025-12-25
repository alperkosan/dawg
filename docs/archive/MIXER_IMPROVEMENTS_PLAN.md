# 🎚️ Mixer Panel İyileştirme Planı

**Tarih**: 2025-10-17
**Öncelik**: Yüksek (Sprint 2)
**Etkilenen Dosyalar**:
- `client/src/features/mixer/Mixer.jsx`
- `client/src/features/mixer/components/MixerChannel.jsx`
- `client/src/features/mixer/components/EffectsRack.jsx`
- `client/src/features/mixer/components/SendMatrix.jsx`
- `client/src/store/useMixerStore.js`
- `client/src/lib/core/NativeAudioEngine.js`

---

## Mevcut Durum Analizi

### ✅ Çalışan Özellikler
- Master channel routing (tracks → master → output)
- Efekt ekleme/çıkarma
- Basic gain kontrolü
- Temel channel layout

### ❌ Sorunlar ve Eksiklikler

#### 1. Effect Chain Reordering (Kritik)
**Sorun**: Efektlerin sıralaması değiştirilemiyor
**Etki**: Efekt zinciri sırası ses kalitesini önemli ölçüde etkiler
**Öncelik**: 🔴 Yüksek

#### 2. Send/Insert System (Kritik)
**Sorun**:
- Insert butonları çalışmıyor
- Send matrix fonksiyonel değil
- Hangi kanala send edildiği görünmüyor
- Send seviyesi ayarlanamıyor
**Etki**: Profesyonel mixing workflow eksik
**Öncelik**: 🔴 Yüksek

#### 3. Pan Değerleri (Orta)
**Sorun**: "L1500", "R1000" gibi yanlış değerler gösteriliyor
**Etki**: Kullanıcı kafa karışıklığı
**Öncelik**: 🟡 Orta

#### 4. Channel Management (Orta)
**Sorun**:
- Kanal isimleri düzenlenemiyor
- Kanal renkleri değiştirilemiyor
- Mute/Solo butonları çalışmıyor
**Etki**: Organizasyon ve workflow sorunu
**Öncelik**: 🟡 Orta

#### 5. Fader UX (Düşük)
**Sorun**:
- Çok hassas hareket
- Tasarım iyileştirilebilir
- Gain değeri input olarak girilemez
**Etki**: Kullanım zorluğu
**Öncelik**: 🟢 Düşük

#### 6. Output Display (Düşük)
**Sorun**: Output kısmındaki değer doğru değil
**Etki**: Yanlış bilgi gösterimi
**Öncelik**: 🟢 Düşük

---

## İyileştirme Adımları

### 📋 Faz 1: Effect Chain Reordering (1-2 saat)

#### Hedef
Efektlerin drag-and-drop ile sıralanabilmesi ve audio graph'in otomatik güncellenmesi.

#### Teknik Yaklaşım

**1. UI Katmanı: Drag-and-Drop**
```javascript
// EffectsRack.jsx
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

function EffectsRack({ trackId, effects }) {
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = effects.findIndex(fx => fx.id === active.id);
      const newIndex = effects.findIndex(fx => fx.id === over.id);

      // Update store
      reorderEffects(trackId, oldIndex, newIndex);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SortableContext items={effects} strategy={verticalListSortingStrategy}>
        {effects.map(fx => <EffectItem key={fx.id} effect={fx} />)}
      </SortableContext>
    </DndContext>
  );
}
```

**2. Store Katmanı: State Management**
```javascript
// useMixerStore.js
reorderEffects: (trackId, oldIndex, newIndex) => {
  set(state => {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return state;

    const newEffects = [...track.effectChain];
    const [moved] = newEffects.splice(oldIndex, 1);
    newEffects.splice(newIndex, 0, moved);

    return {
      tracks: state.tracks.map(t =>
        t.id === trackId ? { ...t, effectChain: newEffects } : t
      )
    };
  });

  // ✅ Update audio graph
  AudioContextService.updateEffectChain(trackId, newEffects);
}
```

**3. Audio Engine Katmanı: Graph Reconstruction**
```javascript
// NativeAudioEngine.js
updateEffectChain(trackId, newEffectOrder) {
  const channel = this.channels.get(trackId);
  if (!channel) return;

  // Disconnect all effects
  channel.effects.forEach(fx => fx.disconnect());

  // Reconnect in new order
  let previousNode = channel.inputNode;
  newEffectOrder.forEach((fxConfig, index) => {
    const fxNode = channel.effects.get(fxConfig.id);
    previousNode.connect(fxNode);
    previousNode = fxNode;
  });

  // Connect last to output
  previousNode.connect(channel.outputNode);

  console.log(`✅ Effect chain updated for ${trackId}`);
}
```

#### Implementasyon Checklist
- [ ] Install `@dnd-kit/core` ve `@dnd-kit/sortable`
- [ ] EffectsRack'e drag-and-drop ekle
- [ ] useMixerStore'a reorderEffects action ekle
- [ ] NativeAudioEngine'de updateEffectChain implement et
- [ ] Visual feedback ekle (dragging state)
- [ ] Test: Sıralama değişince ses değişiyor mu?

---

### 📋 Faz 2: Send/Insert System (3-4 saat)

#### Hedef
- Send matrix ile kanal arası routing
- Insert level kontrolü
- Visual send routing gösterimi

#### Teknik Yaklaşım

**1. Audio Routing Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                      Channel Track 1                         │
│                                                              │
│  Input → Effects Chain → Pre-Fader Send ─┐                  │
│                ↓                          │                  │
│             Fader                         │                  │
│                ↓                          ↓                  │
│             Pan/Mute                  Send Bus 1             │
│                ↓                      (Reverb)               │
│          Post-Fader Send ─────────────────┘                  │
│                ↓                          │                  │
│             Output                        │                  │
└───────────────┬───────────────────────────┴──────────────────┘
                │                           │
                ↓                           ↓
            Master Bus                  Return Track
```

**2. Store Katmanı: Send/Return Tracks**
```javascript
// useMixerStore.js
{
  tracks: [
    {
      id: 'track-1',
      type: 'channel',
      sends: [
        { busId: 'bus-reverb', level: 0.3, preFader: false },
        { busId: 'bus-delay', level: 0.2, preFader: true }
      ],
      inserts: [] // Future: sidechain routing
    }
  ],
  buses: [
    {
      id: 'bus-reverb',
      name: 'Reverb Bus',
      type: 'send',
      effectChain: [/* reverb effect */],
      returnLevel: 1.0
    }
  ]
}

// Actions
addSend: (trackId, busId, level = 0.0, preFader = false) => {
  // Add send connection
  // Update audio graph
},

updateSendLevel: (trackId, busId, level) => {
  // Update send gain
  AudioContextService.updateSendLevel(trackId, busId, level);
}
```

**3. UI Katmanı: Send Matrix**
```javascript
// SendMatrix.jsx
function SendMatrix({ selectedTrack }) {
  const buses = useMixerStore(state => state.buses);
  const sends = selectedTrack.sends || [];

  return (
    <div className="send-matrix">
      <h3>Sends from {selectedTrack.name}</h3>
      {buses.map(bus => {
        const send = sends.find(s => s.busId === bus.id);
        return (
          <div key={bus.id} className="send-row">
            <label>{bus.name}</label>
            <input
              type="checkbox"
              checked={!!send}
              onChange={(e) => {
                if (e.target.checked) {
                  addSend(selectedTrack.id, bus.id);
                } else {
                  removeSend(selectedTrack.id, bus.id);
                }
              }}
            />
            {send && (
              <Slider
                min={0}
                max={1}
                value={send.level}
                onChange={(v) => updateSendLevel(selectedTrack.id, bus.id, v)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**4. Audio Engine Katmanı**
```javascript
// NativeAudioEngine.js
createSend(trackId, busId, level, preFader) {
  const track = this.channels.get(trackId);
  const bus = this.buses.get(busId);

  // Create send gain node
  const sendGain = this.audioContext.createGain();
  sendGain.gain.value = level;

  // Connect: pre or post fader
  const sourceNode = preFader ? track.effectChainOutput : track.fader;
  sourceNode.connect(sendGain);
  sendGain.connect(bus.input);

  // Store reference
  track.sends.set(busId, { gainNode: sendGain, preFader });

  console.log(`✅ Send created: ${trackId} → ${busId}`);
}
```

#### Implementasyon Checklist
- [ ] useMixerStore'a send/bus state ekle
- [ ] NativeAudioEngine'de send routing implement et
- [ ] SendMatrix component oluştur
- [ ] Pre/Post fader toggle ekle
- [ ] Visual routing display (hangi bus'a send ediliyor)
- [ ] Send level sliders
- [ ] Test: Send routing doğru çalışıyor mu?

---

### 📋 Faz 3: Pan Değerleri Düzeltme (30 dakika)

#### Sorun
```javascript
// Yanlış: "L1500", "R1000"
// Doğru: "L50", "Center", "R50"
```

#### Çözüm
```javascript
// MixerChannel.jsx
const formatPanValue = (panValue) => {
  // panValue: -1 (full left) to +1 (full right)
  if (Math.abs(panValue) < 0.01) return 'Center';

  const percentage = Math.abs(panValue * 100).toFixed(0);
  return panValue < 0 ? `L${percentage}` : `R${percentage}`;
};

// Usage
<div className="pan-display">{formatPanValue(channel.pan)}</div>
```

#### Implementasyon Checklist
- [ ] formatPanValue utility function
- [ ] Pan display güncelleme
- [ ] Initial data'daki pan değerlerini kontrol et
- [ ] Test: Pan değerleri doğru gösteriliyor mu?

---

### 📋 Faz 4: Channel Management (1-2 saat)

#### 4.1 Channel Naming
```javascript
// MixerChannel.jsx
const [isEditingName, setIsEditingName] = useState(false);
const [tempName, setTempName] = useState(channel.name);

const handleNameSubmit = () => {
  if (tempName.trim()) {
    updateChannelName(channel.id, tempName.trim());
    setIsEditingName(false);
  }
};

return (
  <div className="channel-name">
    {isEditingName ? (
      <input
        value={tempName}
        onChange={(e) => setTempName(e.target.value)}
        onBlur={handleNameSubmit}
        onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
        autoFocus
      />
    ) : (
      <span onDoubleClick={() => setIsEditingName(true)}>
        {channel.name}
      </span>
    )}
  </div>
);
```

#### 4.2 Channel Colors
```javascript
// Color picker modal
import { HexColorPicker } from 'react-colorful';

const [colorPickerOpen, setColorPickerOpen] = useState(false);

return (
  <>
    <div
      className="channel-color-indicator"
      style={{ backgroundColor: channel.color }}
      onClick={() => setColorPickerOpen(true)}
    />
    {colorPickerOpen && (
      <div className="color-picker-modal">
        <HexColorPicker
          color={channel.color}
          onChange={(color) => updateChannelColor(channel.id, color)}
        />
        <button onClick={() => setColorPickerOpen(false)}>Done</button>
      </div>
    )}
  </>
);
```

#### 4.3 Mute/Solo Buttons
```javascript
// useMixerStore.js
toggleMute: (trackId) => {
  set(state => ({
    tracks: state.tracks.map(t =>
      t.id === trackId ? { ...t, muted: !t.muted } : t
    )
  }));

  // Update audio engine
  const track = get().tracks.find(t => t.id === trackId);
  AudioContextService.setTrackMute(trackId, track.muted);
},

toggleSolo: (trackId) => {
  const state = get();
  const newSoloState = !state.tracks.find(t => t.id === trackId).solo;

  set({
    tracks: state.tracks.map(t =>
      t.id === trackId ? { ...t, solo: newSoloState } : t
    )
  });

  // Apply solo logic: mute all non-solo tracks
  const soloedTracks = state.tracks.filter(t => t.id === trackId ? newSoloState : t.solo);
  state.tracks.forEach(track => {
    const shouldMute = soloedTracks.length > 0 && !soloedTracks.includes(track);
    AudioContextService.setTrackMute(track.id, shouldMute);
  });
}
```

#### Implementasyon Checklist
- [ ] Double-click to edit channel name
- [ ] Color picker integration
- [ ] Mute button functional
- [ ] Solo button functional (mute others)
- [ ] Visual state feedback

---

### 📋 Faz 5: Fader UX İyileştirmeleri (1 saat)

#### 5.1 Fader Design
```css
/* Gerçekçi fader tasarımı */
.fader-container {
  height: 200px; /* Daha uzun */
  width: 40px;
  background: linear-gradient(to bottom, #2a2a2a, #1a1a1a);
  border-radius: 8px;
  position: relative;
  box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);
}

.fader-track {
  height: calc(100% - 20px);
  width: 4px;
  margin: 10px auto;
  background: #444;
  position: relative;
}

.fader-handle {
  width: 36px;
  height: 40px;
  background: linear-gradient(to bottom, #666, #333);
  border: 2px solid #888;
  border-radius: 4px;
  cursor: grab;
  box-shadow: 0 2px 4px rgba(0,0,0,0.8);
}

.fader-handle:active {
  cursor: grabbing;
  box-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
```

#### 5.2 Gain Input
```javascript
const [isEditingGain, setIsEditingGain] = useState(false);
const [tempGain, setTempGain] = useState(channel.gain);

return (
  <div className="gain-display">
    {isEditingGain ? (
      <input
        type="number"
        value={tempGain}
        onChange={(e) => setTempGain(parseFloat(e.target.value))}
        onBlur={() => {
          updateChannelGain(channel.id, tempGain);
          setIsEditingGain(false);
        }}
        step={0.1}
        min={-60}
        max={12}
      />
    ) : (
      <span onClick={() => setIsEditingGain(true)}>
        {channel.gain.toFixed(1)} dB
      </span>
    )}
  </div>
);
```

#### 5.3 Smoother Movement
```javascript
// Daha hassas olmayan fader kontrolü
const handleFaderDrag = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const percentage = 1 - (y / rect.height);

  // ✅ Logarithmic scaling for better control
  const gain = percentageToGain(percentage);
  updateChannelGain(channel.id, gain);
};

const percentageToGain = (p) => {
  // 0-1 range to -60dB to +12dB
  // Logarithmic curve for better low-end control
  if (p < 0.1) return -60 + (p * 10 * 30); // -60 to -30dB
  if (p < 0.9) return -30 + ((p - 0.1) * 1.25 * 36); // -30 to +6dB
  return 6 + ((p - 0.9) * 10 * 6); // +6 to +12dB
};
```

---

## Uygulama Sırası

### Hafta 1: Kritik Özellikler
1. **Effect Chain Reordering** (Gün 1-2) - En kritik
2. **Send/Insert System** (Gün 3-5) - Profesyonel workflow için gerekli

### Hafta 2: UX İyileştirmeleri
3. **Pan Değerleri** (Gün 1) - Hızlı fix
4. **Channel Management** (Gün 2-3) - Kullanım kolaylığı
5. **Fader UX** (Gün 4) - Son rötuşlar
6. **Output Display** (Gün 5) - Polish

---

## Başarı Kriterleri

### Effect Chain Reordering
- ✅ Efektler drag-and-drop ile sıralanabiliyor
- ✅ Ses zinciri otomatik güncelleniyor
- ✅ Visual feedback var
- ✅ Performance sorunsuz (60fps)

### Send/Insert System
- ✅ Send matrixi fonksiyonel
- ✅ Bus'lara send edilebiliyor
- ✅ Send seviyeleri ayarlanabiliyor
- ✅ Pre/Post fader seçilebiliyor
- ✅ Visual routing gösterimi var

### Channel Management
- ✅ İsimler düzenlenebiliyor
- ✅ Renkler değiştirilebiliyor
- ✅ Mute/Solo çalışıyor
- ✅ Pan değerleri doğru

### Fader UX
- ✅ Daha uzun ve kullanımı kolay
- ✅ Gain değeri input ile girilebiliyor
- ✅ Gerçekçi tasarım
- ✅ Hassasiyet optimize

---

## Teknik Kararlar

### Kütüphaneler
- **@dnd-kit**: Effect reordering için (modern, performanslı)
- **react-colorful**: Color picker için (küçük, hızlı)

### Mimari
- **Store-first**: Tüm state değişiklikleri önce store'da
- **Audio-sync**: Store güncellemelerinden sonra audio engine sync
- **Optimistic UI**: UI önce güncellenir, audio async

### Performance
- **Debounce**: Send level sliders için (50ms)
- **Throttle**: Fader drag için (16ms = 60fps)
- **Memoization**: Effect list rendering için

---

## Risk Analizi

### Yüksek Risk
- **Audio graph reconstruction**: Effect reordering sırasında ses kesilmesi
  - *Mitigation*: Fade in/out geçişleri

### Orta Risk
- **Send routing complexity**: Circular routing prevention
  - *Mitigation*: Routing validation

### Düşük Risk
- **UI performance**: Çok fazla mixer channel ile lag
  - *Mitigation*: Virtualization

---

## Test Planı

### Manuel Testler
1. Effect sırasını değiştir → Ses değişiyor mu?
2. Send ekle/çıkar → Routing doğru mu?
3. Mute/Solo → Diğer kanallar etkileniyor mu?
4. Fader → Hassasiyet uygun mu?

### Automated Tests
```javascript
describe('Mixer Effect Reordering', () => {
  it('should update audio graph when effects reordered', async () => {
    const { result } = renderHook(() => useMixerStore());

    act(() => {
      result.current.reorderEffects('track-1', 0, 1);
    });

    // Verify store updated
    expect(result.current.tracks[0].effectChain[0].id).toBe('fx-2');

    // Verify audio engine called
    expect(AudioContextService.updateEffectChain).toHaveBeenCalled();
  });
});
```

---

## Dokümantasyon

Her faz için:
- [ ] Implementation guide
- [ ] API documentation
- [ ] User guide (nasıl kullanılır)
- [ ] Architecture diagrams

---

**Sonraki Adım**: Faz 1 (Effect Chain Reordering) ile başlayalım mı?
