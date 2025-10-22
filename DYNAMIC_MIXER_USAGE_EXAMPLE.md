# 🎛️ Dynamic Mixer - Kullanım Örneği

Bu dokümanda yeni dinamik mixer sisteminin nasıl kullanılacağı açıklanıyor.

## Temel Kullanım

### 1. Engine Başlatma

```javascript
import { NativeAudioEngine } from './lib/core/NativeAudioEngine.js';

const engine = new NativeAudioEngine({
  setPlaybackState: (state) => console.log('Playback:', state),
  setTransportPosition: (pos, step) => console.log('Position:', pos)
});

await engine.initialize();
// ✅ Dynamic MixerInsert system active - no static channels
```

### 2. Track Oluşturma (UI'dan user action)

```javascript
// User "Kick" track'i ekler
const kickInsert = engine.createMixerInsert('kick-1', 'Kick');
// ✅ MixerInsert created: kick-1 (Kick)
// ✅ Auto-connected to master bus
```

### 3. Sample Yükleme ve Routing

```javascript
// Kick sample'ını yükle
const kickBuffer = await loadAudioFile('/samples/kick.wav');

// Instrument oluştur
const kickInstrument = await engine.createInstrument({
  id: 'kick-inst-1',
  type: 'sample',
  name: 'Kick',
  audioBuffer: kickBuffer,
  mixerTrackId: 'kick-1'  // Auto-route edecek
});

// Veya manuel routing:
// engine.routeInstrumentToInsert('kick-inst-1', 'kick-1');
```

### 4. Effect Ekleme

```javascript
// Kick'e reverb ekle
const reverbId = await engine.addEffectToInsert('kick-1', 'ModernReverb', {
  roomSize: 0.5,
  damping: 0.7,
  wet: 0.3
});
// ✅ Effect added: ModernReverb → kick-1

// Saturator ekle
const satId = await engine.addEffectToInsert('kick-1', 'Saturator', {
  drive: 2.0,
  mix: 0.5
});
```

### 5. Gain/Pan Kontrolü

```javascript
// Volume ayarla (0-1)
engine.setInsertGain('kick-1', 0.8);

// Pan ayarla (-1 = sol, 0 = center, 1 = sağ)
engine.setInsertPan('kick-1', -0.3);
```

### 6. Track Silme

```javascript
// Track'i sil (bağlı tüm kaynaklar temizlenir)
engine.removeMixerInsert('kick-1');
// ✅ Instrument dispose
// ✅ Effects dispose
// ✅ Insert dispose
// ✅ Memory temiz!
```

## AudioContextService Üzerinden Kullanım

UI component'lerinden service layer kullanılır:

```javascript
import { AudioContextService } from './lib/services/AudioContextService.js';

// Track ekle
AudioContextService.createMixerInsert('bass-1', 'Bass');

// Instrument route et
AudioContextService.routeInstrumentToInsert('bass-inst-1', 'bass-1');

// Effect ekle
await AudioContextService.addEffectToInsert('bass-1', 'LowPassFilter', {
  cutoff: 800,
  resonance: 2.0
});

// Gain ayarla
AudioContextService.setInsertGain('bass-1', 0.7);

// Track sil
AudioContextService.removeMixerInsert('bass-1');
```

## Metering

```javascript
// Analyzer al (metering için)
const analyzer = AudioContextService.getInsertAnalyzer('kick-1');

// Veya doğrudan insert'i al
const insert = AudioContextService.getMixerInsert('kick-1');
const meterLevel = insert.getMeterLevel(); // 0-1 RMS value
```

## Signal Flow Örneği

```
[Kick Sample]
    ↓
Instrument Output
    ↓
MixerInsert('kick-1').input
    ↓
ModernReverb Effect
    ↓
Saturator Effect
    ↓
Gain Node (volume: 0.8)
    ↓
Pan Node (pan: -0.3)
    ↓
Analyzer (metering)
    ↓
MixerInsert.output
    ↓
Master Bus Input
    ↓
Master Gain
    ↓
AudioContext.destination
```

## Tam Örnek - Multiple Tracks

```javascript
// 1. Engine başlat
const engine = new NativeAudioEngine();
await engine.initialize();

// 2. Kick track
const kick = engine.createMixerInsert('kick', 'Kick');
const kickInst = await engine.createInstrument({
  id: 'kick-inst',
  type: 'sample',
  name: 'Kick',
  audioBuffer: await loadSample('kick.wav'),
  mixerTrackId: 'kick'
});
await engine.addEffectToInsert('kick', 'Saturator', { drive: 1.5 });
engine.setInsertGain('kick', 0.9);

// 3. Snare track
const snare = engine.createMixerInsert('snare', 'Snare');
const snareInst = await engine.createInstrument({
  id: 'snare-inst',
  type: 'sample',
  name: 'Snare',
  audioBuffer: await loadSample('snare.wav'),
  mixerTrackId: 'snare'
});
await engine.addEffectToInsert('snare', 'ModernReverb', { roomSize: 0.7 });
engine.setInsertGain('snare', 0.8);
engine.setInsertPan('snare', 0.2);

// 4. Bass track
const bass = engine.createMixerInsert('bass', 'Bass');
const bassInst = await engine.createInstrument({
  id: 'bass-inst',
  type: 'sample',
  name: 'Bass',
  audioBuffer: await loadSample('bass.wav'),
  mixerTrackId: 'bass'
});
await engine.addEffectToInsert('bass', 'LowPassFilter', { cutoff: 600 });
await engine.addEffectToInsert('bass', 'Compressor', { threshold: -20 });
engine.setInsertGain('bass', 0.7);
engine.setInsertPan('bass', -0.1);

// 5. Play!
engine.play();

// 6. Cleanup (opsiyonel - user track siler)
setTimeout(() => {
  engine.removeMixerInsert('kick');
  // Sadece kick track temizlendi, diğerleri çalışmaya devam ediyor
}, 10000);
```

## Master Effects

Master bus için ayrı sistem:

```javascript
// Master'a reverb ekle (tüm output'a uygulanır)
await engine.addEffectToInsert('master', 'ModernReverb', {
  roomSize: 0.3,
  wet: 0.15
});

// Master volume
engine.setMasterVolume(0.8);
```

## Önemli Notlar

1. **Otomatik Master Routing**: Her `createMixerInsert` otomatik olarak master bus'a bağlanır
2. **Effect Order**: Effect'ler eklenme sırasına göre işlenir
3. **Memory Management**: `removeMixerInsert` tüm kaynakları otomatik temizler
4. **No Static Limits**: Track sayısı sınırı yok, browser memory'sine kadar
5. **Bypass**: Effect bypass özelliği yakında gelecek

## Migration - Eski Koddan

### Önce (UnifiedMixer):
```javascript
const inst = await engine.createInstrument(data);
// Otomatik olarak track-1, track-2, etc.'ye assign ediliyordu
// 28 track limiti vardı
```

### Şimdi (Dynamic MixerInsert):
```javascript
// 1. Önce insert oluştur
const insert = engine.createMixerInsert('my-track', 'My Track');

// 2. Sonra instrument
const inst = await engine.createInstrument({
  ...data,
  mixerTrackId: 'my-track'  // Otomatik route edilecek
});

// Track sayısı sınırsız!
```

---

**Avantajlar**:
- ✅ Tam dinamik - sadece kullanılan tracks oluşturulur
- ✅ Memory efficient - dispose edilen tracks bellekten tamamen temizlenir
- ✅ Track limit yok - istediğin kadar track ekle
- ✅ Daha temiz API - intent daha net
- ✅ Effect management basit
