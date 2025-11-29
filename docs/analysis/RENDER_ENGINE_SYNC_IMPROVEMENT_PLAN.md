# RenderEngine - Audio Engine Senkronizasyon İyileştirme Planı

## Hedef
RenderEngine (ExportManager) ile Real-Time Audio Engine arasındaki uyumsuzlukları gidermek ve export kalitesini iyileştirmek.

## Tespit Edilen Sorunlar

### 1. Sample Rate Uyumsuzluğu
- **Sorun**: RenderEngine default 44.1kHz kullanıyor, real-time engine browser'a bağlı (44.1kHz veya 48kHz)
- **Etki**: Export edilen audio, live playback'ten farklı pitch/timing'e sahip olabilir
- **Çözüm**: RenderEngine'i her zaman real-time engine'in sample rate'ini kullanacak şekilde güncelle

### 2. Signal Chain Farkları
- **Sorun**: RenderEngine'de analyzer yok, real-time'de var
- **Etki**: Signal chain sırası farklı olabilir
- **Çözüm**: Signal chain'i tam olarak eşleştir (analyzer'ı render'da skip et)

### 3. Automation Timing
- **Sorun**: Offline'da sample-accurate, real-time'de 10ms interval
- **Etki**: Automation timing farklı olabilir
- **Çözüm**: Automation'ları offline rendering'de de aynı şekilde uygula

### 4. Performance
- **Sorun**: Offline rendering uzun sürebilir
- **Etki**: UI blocking, kullanıcı deneyimi
- **Çözüm**: Progressive rendering, Web Workers (ileride)

## Geliştirme Planı

### Phase 1: Sample Rate Senkronizasyonu ✅
1. RenderEngine constructor'da sample rate'i real-time engine'den al
2. Audio engine hazır olduğunda otomatik güncelle
3. Export sırasında sample rate'i kontrol et ve uyar

### Phase 2: Signal Chain Eşleştirmesi ✅
1. RenderEngine signal chain'ini real-time engine ile eşleştir
2. Analyzer'ı render'da skip et (sadece metering için)
3. Effect chain sırasını kontrol et

### Phase 3: Automation Senkronizasyonu ✅
1. Automation'ları offline rendering'de de aynı şekilde uygula
2. Sample-accurate automation (offline rendering'de daha doğru)
3. Automation timing'i kontrol et

### Phase 4: Quality Matching ✅
1. Export quality preset'lerini real-time engine'in capabilities'ine göre ayarla
2. Standard: 44.1kHz (real-time ile match)
3. High: 48kHz (real-time ile match)
4. Studio: 96kHz (sadece export için)

## Implementation Steps

### Step 1: Sample Rate Auto-Sync
- [x] RenderEngine constructor'da AudioContextService'den sample rate al
- [x] Audio engine ready olduğunda otomatik güncelle
- [x] Export sırasında sample rate match kontrolü

### Step 2: Signal Chain Matching
- [x] RenderEngine signal chain'ini MixerInsert ile eşleştir
- [x] Analyzer'ı render'da skip et
- [x] Effect chain sırasını kontrol et

### Step 3: Automation Integration
- [x] Automation'ları offline rendering'de de uygula
- [x] Sample-accurate automation
- [x] Automation timing kontrolü

### Step 4: Quality Presets Update
- [x] Quality preset'leri real-time engine'e göre ayarla
- [x] Sample rate matching
- [x] Bit depth optimization

## Test Plan

1. **Sample Rate Match Test**: Export ve live playback'i aynı sample rate'te test et
2. **Signal Chain Test**: Export ve live playback'i karşılaştır (A/B test)
3. **Automation Test**: Automation'ları export ve live playback'te karşılaştır
4. **Effect Test**: Effect'leri export ve live playback'te karşılaştır
5. **Performance Test**: Export süresini ve CPU kullanımını ölç

## Success Criteria

- ✅ Export edilen audio, live playback ile aynı sample rate'te
- ✅ Signal chain tam olarak eşleşiyor
- ✅ Automation'lar export'ta da doğru çalışıyor
- ✅ Effect'ler export'ta da doğru çalışıyor
- ✅ Performance kabul edilebilir seviyede

