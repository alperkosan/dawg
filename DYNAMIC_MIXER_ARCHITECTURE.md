# 🎛️ Dynamic Mixer Architecture

## Genel Bakış

Yeni dinamik mixer sistemi, statik 20 kanal sınırlamasını kaldırıp tamamen ihtiyaç bazlı (on-demand) bir routing sistemi kurar.

## Temel Prensipler

### 1. Her Şey Dinamik ✅
- Track eklendiğinde MixerInsert oluşturulur
- Instrument yüklendiğinde MixerInsert'e bağlanır
- Track silindiğinde tüm kaynaklar temizlenir
- **Hiçbir statik kanal veya node yok**

### 2. Temiz Routing 🔗
```
Instrument → MixerInsert → Master Bus → Output
            (effects)      (master effects)
```

### 3. Memory Efficient 💾
- Kullanılmayan insert yok
- Dispose edilen instrument'ler bellekten tamamen temizlenir
- Effect chain'ler dinamik olarak kurulur/kaldırılır

## Mimari

### MixerInsert (Yeni Class)

Her mixer insert şunları içerir:
- **Input**: Instrument'ler buraya bağlanır
- **Effect Chain**: Insert effect'leri
- **Gain/Pan**: Volume ve pan kontrolleri
- **Analyzer**: Metering için
- **Output**: Master bus'a gider

```javascript
const insert = new MixerInsert(audioContext, 'kick-1', 'Kick');
insert.connectToMaster(masterBusInput);
insert.connectInstrument('kick-inst-1', instrumentOutput);
```

### NativeAudioEngine API

#### Track Oluşturma
```javascript
// 1. Insert oluştur (track eklendiğinde)
const kickInsert = engine.createMixerInsert('kick-1', 'Kick');

// 2. Instrument yükle
const kickInstrument = await engine.createInstrument({
  id: 'kick-inst-1',
  type: 'sample',
  name: 'Kick',
  audioBuffer: kickBuffer
});

// 3. Instrument'i insert'e route et
engine.routeInstrumentToInsert('kick-inst-1', 'kick-1');
```

#### Effect Ekleme
```javascript
// Insert'e effect ekle
const reverbId = await engine.addEffectToInsert('kick-1', 'ModernReverb', {
  roomSize: 0.8,
  damping: 0.7
});

// Effect'i kaldır
engine.removeEffectFromInsert('kick-1', reverbId);
```

#### Gain/Pan Kontrolü
```javascript
// Insert gain ayarla
engine.setInsertGain('kick-1', 0.8);

// Insert pan ayarla
engine.setInsertPan('kick-1', -0.3); // Sol
```

#### Track Silme
```javascript
// Insert'i sil (bağlı tüm instrument'leri de temizler)
engine.removeMixerInsert('kick-1');
```

## Signal Flow

### Regular Track
```
Instrument Output
    ↓
MixerInsert.input
    ↓
[Effect 1] (bypass edilmediyse)
    ↓
[Effect 2] (bypass edilmediyse)
    ↓
MixerInsert.gainNode (volume)
    ↓
MixerInsert.panNode (pan)
    ↓
MixerInsert.analyzer (metering)
    ↓
MixerInsert.output
    ↓
Master Bus Input
```

### Master Bus
```
Master Bus Input (tüm insert'lerden gelen)
    ↓
Master Bus Gain
    ↓
[Master Effect 1]
    ↓
[Master Effect 2]
    ↓
Master Gain (final volume)
    ↓
Master Analyzer
    ↓
AudioContext.destination
```

## Avantajlar

### ✅ Tam Dinamik
- Track sayısı sınırı yok
- Sadece kullanılan kaynaklar oluşturulur
- Memory kullanımı optimize

### ✅ Temiz Kod
- Her insert bağımsız
- Effect chain management basit
- Dispose logic net

### ✅ Performance
- Gereksiz node yok
- Effect bypass CPU tasarrufu sağlar
- Analyzer sadece gerektiğinde

### ✅ Flexibility
- Instrument'ler insert'ler arası taşınabilir
- Effect order değiştirilebilir
- Send/Return bus'lar eklenebilir (gelecek)

## Migration Notes

### Eski Sistem (UnifiedMixer)
```javascript
// ❌ Statik 28 kanal
// ❌ Önceden oluşturulmuş
// ❌ WASM karmaşıklığı
unifiedMixer = new UnifiedMixerNode(audioContext, 32);
```

### Yeni Sistem (MixerInsert)
```javascript
// ✅ Dinamik insert'ler
// ✅ İhtiyaç anında oluşturulur
// ✅ Basit JavaScript node'ları
const insert = engine.createMixerInsert('track-1', 'Track 1');
```

## Sonraki Adımlar

1. ✅ MixerInsert class - TAMAMLANDI
2. ✅ NativeAudioEngine API - TAMAMLANDI
3. ⏳ UnifiedMixer'ı kaldır (deprecated)
4. ⏳ AudioContextService'i güncelle
5. ⏳ UI'ı yeni API'ye bağla
6. ⏳ Test et

## Örnek Kullanım

```javascript
// DAW başlangıcında sadece master bus var
const engine = new NativeAudioEngine();
await engine.initialize();

// User "Kick" track'i ekler
const kickInsert = engine.createMixerInsert('kick-1', 'Kick');

// User kick sample yükler
const kickInst = await engine.createInstrument({
  id: 'kick-inst-1',
  type: 'sample',
  audioBuffer: kickBuffer
});

// Automatic routing
engine.routeInstrumentToInsert('kick-inst-1', 'kick-1');

// User reverb ekler
await engine.addEffectToInsert('kick-1', 'ModernReverb', {
  roomSize: 0.5
});

// User kick track'i siler
engine.removeMixerInsert('kick-1'); // Instrument ve effect'ler de temizlenir

// Memory temiz! 🎉
```

## Önemli Notlar

- **Backward Compatibility**: Eski UnifiedMixer kodu şu an deprecated ama çalışır durumda
- **Master Effects**: Master bus için ayrı effect sistemi var (engine.masterEffects)
- **Performance**: Her insert native Web Audio nodes kullanır (no WASM overhead)
- **Testing**: Dinamik create/destroy cycle'ları test edilmeli

---

**Tasarım Prensibi**: *"Create only what you need, when you need it, and clean it up when you're done."*
