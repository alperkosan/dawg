# Export Sistemleri Analizi ve Birleştirme Planı

## Tespit Edilen Export Noktaları

### 1. ExportManager (`client/src/lib/audio/ExportManager.js`)
- **Kullanım**: Mixer channel export (individual veya batch)
- **UI**: `ExportPanel.jsx` → TopToolbar'dan açılıyor
- **Render Engine**: `audioExportManager.renderEngine` (paylaşılan instance)
- **Export Yöntemleri**:
  - **Offline**: `renderEngine.renderPattern()` kullanıyor ✅
  - **Real-time**: `MediaRecorder` kullanıyor ❌ (RenderEngine kullanmıyor)
- **Özellikler**:
  - Channel selection
  - Format/quality settings
  - Effects include/exclude
  - Normalize, fade in/out
  - Add to project/arrangement

### 2. AudioExportManager (`client/src/lib/audio/AudioExportManager.js`)
- **Kullanım**: Pattern export (single, channels, stems, freeze)
- **UI**: `AudioExportPanel.jsx`
- **Render Engine**: Kendi `RenderEngine` instance'ı oluşturuyor ❌
- **Export Yöntemleri**:
  - `renderEngine.renderPattern()` kullanıyor ✅
  - Pattern-to-audio conversion
  - Batch export
  - Freeze operations
- **Özellikler**:
  - Pattern export
  - Channel split
  - Stem export
  - Freeze (pattern to audio)

### 3. ExportSessionManager (`client/src/lib/audio/export/ExportSessionManager.js`)
- **Kullanım**: Project export (isolated workspace)
- **UI**: Backend rendering (Puppeteer)
- **Render Engine**: `exportManager.exportChannels()` üzerinden (ExportManager'a bağlı) ✅
- **Export Yöntemleri**:
  - Isolated workspace
  - Project deserialization
  - Export via ExportManager
- **Özellikler**:
  - Headless rendering
  - Project-level export

### 4. RenderPage (`client/src/pages/RenderPage.jsx`)
- **Kullanım**: Backend rendering (Puppeteer)
- **UI**: Headless (no UI)
- **Render Engine**: `exportManager.exportChannels()` üzerinden ✅
- **Export Yöntemleri**:
  - Project loading
  - Master channel export
  - Base64 encoding for backend

## Sorunlar

### 1. **RenderEngine Instance Tutarsızlığı**
- **ExportManager**: `audioExportManager.renderEngine` kullanıyor (paylaşılan)
- **AudioExportManager**: Kendi `new RenderEngine()` instance'ı oluşturuyor
- **Sorun**: İki farklı RenderEngine instance'ı var, senkronizasyon sorunları olabilir

### 2. **Real-time Export Yöntemi Farklılığı**
- **ExportManager**: Real-time export için `MediaRecorder` kullanıyor
- **Diğerleri**: Hepsi `RenderEngine` (offline) kullanıyor
- **Sorun**: Real-time export RenderEngine'in iyileştirmelerinden faydalanmıyor

### 3. **Quality Preset Tutarsızlığı**
- **ExportManager**: `QUALITY_PRESET` (kendi tanımları)
- **AudioExportManager**: `QUALITY_PRESETS` (audioRenderConfig'den)
- **Sorun**: İki farklı quality preset sistemi var

### 4. **Export Format Tutarsızlığı**
- **ExportManager**: `EXPORT_FORMAT` (kendi tanımları)
- **AudioExportManager**: `EXPORT_FORMATS` (audioRenderConfig'den)
- **Sorun**: İki farklı format sistemi var

## Birleştirme Planı

### Phase 1: RenderEngine Singleton ✅
- [x] RenderEngine'i singleton yap
- [x] Tüm export sistemlerinin aynı instance'ı kullanmasını sağla
- [x] Sample rate senkronizasyonu (zaten yapıldı)

### Phase 2: Quality Preset Birleştirme ✅
- [x] Quality preset'leri `audioRenderConfig.js`'de birleştir
- [x] ExportManager'ı `QUALITY_PRESETS` kullanacak şekilde güncelle
- [x] Real-time engine matching (zaten yapıldı)

### Phase 3: Export Format Birleştirme
- [ ] Export format'ları `audioRenderConfig.js`'de birleştir
- [ ] ExportManager'ı `EXPORT_FORMATS` kullanacak şekilde güncelle

### Phase 4: Real-time Export İyileştirmesi
- [ ] Real-time export'u da RenderEngine kullanacak şekilde güncelle
- [ ] Veya real-time export'u kaldır (offline her zaman daha iyi)

### Phase 5: Ortak Export Interface
- [ ] Tüm export sistemleri için ortak interface oluştur
- [ ] ExportManager ve AudioExportManager'ı birleştir veya ortak base class oluştur

## Mevcut Durum Özeti

| Export Sistemi | RenderEngine | Quality Preset | Export Format | Durum |
|----------------|--------------|----------------|---------------|-------|
| **ExportManager** | ✅ Paylaşılan | ❌ Kendi | ❌ Kendi | ⚠️ Tutarsız |
| **AudioExportManager** | ❌ Kendi instance | ✅ Ortak | ✅ Ortak | ⚠️ Instance sorunu |
| **ExportSessionManager** | ✅ ExportManager üzerinden | ✅ Ortak | ✅ Ortak | ✅ OK |
| **RenderPage** | ✅ ExportManager üzerinden | ✅ Ortak | ✅ Ortak | ✅ OK |

## Önerilen Çözüm

1. **RenderEngine Singleton**: Tüm export sistemleri aynı RenderEngine instance'ını kullanmalı
2. **Quality Preset Birleştirme**: Tek bir quality preset sistemi
3. **Export Format Birleştirme**: Tek bir export format sistemi
4. **Real-time Export**: RenderEngine kullanacak şekilde güncelle veya kaldır
5. **Ortak Base Class**: ExportManager ve AudioExportManager için ortak base class

