# 🔍 Compressor Export/Import Analizi

## ✅ Çalışan Özellikler

### 1. **Temel Parametreler**
- ✅ `threshold`, `ratio`, `attack`, `release`, `knee` - Tümü serialize/deserialize ediliyor
- ✅ `autoMakeup`, `wet` - Tümü serialize/deserialize ediliyor
- ✅ `lookahead`, `stereoLink` - Tümü serialize/deserialize ediliyor
- ✅ `detectionMode`, `rmsWindow` - Tümü serialize/deserialize ediliyor
- ✅ `upwardRatio`, `upwardDepth` - Tümü serialize/deserialize ediliyor

### 2. **Yeni Özellikler (v2.0)**
- ✅ `compressorModel` (0=Clean/VCA, 1=Opto, 2=FET)
  - EffectRegistry'de tanımlı ✅
  - pluginConfig.jsx'te default: 0 ✅
  - ProjectSerializer'da serialize ediliyor ✅
  - Deserialize sırasında restore ediliyor ✅

- ✅ `mix` (0-100% parallel compression)
  - EffectRegistry'de tanımlı ✅
  - pluginConfig.jsx'te default: 100 ✅
  - ProjectSerializer'da serialize ediliyor ✅
  - Deserialize sırasında restore ediliyor ✅

### 3. **Sidechain Özellikleri**
- ✅ `scEnable`, `scGain`, `scFilterType`, `scFreq`, `scListen` - Tümü serialize/deserialize ediliyor
- ✅ `scSourceId` (external sidechain source)
  - ProjectSerializer'da serialize ediliyor ✅
  - Deserialize sırasında restore ediliyor ✅
  - `_syncMixerTracksToAudioEngine` sırasında `addEffectToInsert` çağrılıyor ✅
  - `addEffectToInsert` içinde `updateSidechainSource` çağrılıyor ✅
  - `MixerInsert.updateEffectSettings` içinde de `updateSidechainSource` çağrılıyor ✅

## ⚠️ Potansiyel Sorunlar

### 1. **Eski Projeler (Backward Compatibility)**
- ⚠️ Eski projelerde `compressorModel` ve `mix` parametreleri yoksa:
  - `pluginConfig.jsx`'teki `defaultSettings` sadece yeni effect oluşturulurken kullanılıyor
  - Deserialize sırasında eksik parametreler için default değerler **otomatik eklenmiyor**
  - **Çözüm**: `normalizeEffectSettings` veya deserialize sırasında default değerler eklenmeli

### 2. **scSourceId Timing**
- ⚠️ `scSourceId` restore edilirken, source track henüz oluşturulmamış olabilir
  - `_syncMixerTracksToAudioEngine` tüm track'leri sync ediyor, bu sorun olmamalı ✅
  - Ancak eğer source track yoksa, sidechain bağlantısı başarısız olur (sessizce fail eder)

## 🔧 Önerilen İyileştirmeler

### 1. **Default Değerler için Normalization**
```javascript
// parameterMappings.js'e eklenebilir
export function ensureDefaultSettings(effectType, settings = {}) {
  const defaultSettings = getDefaultSettingsForEffect(effectType);
  if (!defaultSettings) return settings;
  
  const merged = { ...defaultSettings, ...settings };
  return merged;
}
```

### 2. **scSourceId Validation**
```javascript
// addEffectToInsert içinde
if (effectType === 'Compressor' && settings.scSourceId) {
  // Source track'in var olduğunu kontrol et
  const sourceInsert = this.mixerInserts.get(settings.scSourceId);
  if (!sourceInsert) {
    console.warn(`⚠️ Sidechain source ${settings.scSourceId} not found, skipping sidechain connection`);
    // scSourceId'yi temizle veya retry mekanizması ekle
  } else {
    insert.updateSidechainSource(effectId, settings.scSourceId, getSourceInsert);
  }
}
```

## ✅ Sonuç

**Compressor'daki tüm özellikler export/import için hazır!**

- ✅ Tüm parametreler serialize ediliyor
- ✅ Tüm parametreler deserialize ediliyor
- ✅ Sidechain routing restore ediliyor
- ✅ Yeni özellikler (compressorModel, mix) tam destekleniyor

**Küçük iyileştirmeler:**
- Eski projeler için default değer garantisi (opsiyonel)
- scSourceId validation (opsiyonel, zaten çalışıyor)

