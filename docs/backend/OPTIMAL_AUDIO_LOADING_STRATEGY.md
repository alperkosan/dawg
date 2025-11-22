# Optimal Audio Loading Strategy for Sound Selection

## 🎯 Kullanım Senaryosu

**Sound Selection Workflow:**
1. Kullanıcı file browser'da sample'ları gezinir
2. Her sample'ı **hızlıca preview eder** (1-2 saniye dinler)
3. Beğendiğini **projeye ekler** (ChannelRack veya Arrangement)
4. **Bir kere projeye eklendikten sonra buffer elimize gelir**
5. **Tekrar buffer isteğine ihtiyaç kalmaz**

## ✅ Mevcut Durum Analizi

### Preview (File Browser)
- ❌ **Tüm dosya yükleniyor** - Yavaş internet için sorun
- ✅ Cache var (LRU, max 50 dosya)
- ✅ AbortController ile iptal edilebilir

### Projeye Eklenen Sample'lar
- ✅ Buffer yükleniyor ve `audioBuffer` olarak saklanıyor
- ✅ `useInstrumentsStore` ve `AudioAssetManager` buffer'ı tutuyor
- ❌ Proje serialize edilirken buffer serialize edilmiyor (çok büyük)
- ❌ Proje deserialize edilirken buffer'lar tekrar yükleniyor

## 🚀 Önerilen Çözüm: Hybrid Strategy

### 1. **Preview için Range Requests** ⭐⭐⭐⭐⭐
**En Kritik Özellik - Sound Selection İçin**

```javascript
// Preview için sadece ilk 2 saniye yükle
async loadPreview(url, duration = 2) {
  const sampleRate = 44100;
  const bytesPerSample = 2; // 16-bit
  const channels = 2; // stereo
  const bytesPerSecond = sampleRate * bytesPerSample * channels;
  const rangeEnd = bytesPerSecond * duration;
  
  const response = await fetch(url, {
    headers: {
      'Range': `bytes=0-${rangeEnd}`
    }
  });
  
  // Sadece ilk 2 saniye decode et
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}
```

**Avantajlar:**
- ✅ Preview için %90+ bandwidth tasarrufu
- ✅ Hızlı preview gösterimi (< 500ms)
- ✅ Sound selection workflow'u hızlandırır
- ✅ CDN'ler genellikle destekler

### 2. **Proje Sample'ları için Full Buffer** ⭐⭐⭐⭐⭐
**Bir Kere Yükle, Sonsuza Kadar Kullan**

```javascript
// Projeye eklenen sample için full buffer yükle
async loadFullBuffer(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

// Buffer'ı proje içinde sakla
// - useInstrumentsStore: audioBuffer field
// - AudioAssetManager: assets Map
// - NativeAudioEngine: sampleBuffers Map
```

**Avantajlar:**
- ✅ Bir kere yükle, tekrar yükleme yok
- ✅ Proje içinde buffer zaten var
- ✅ Offline çalışma mümkün

### 3. **Proje Buffer Management** ⭐⭐⭐⭐
**Akıllı Buffer Yönetimi**

```javascript
class ProjectBufferManager {
  // Projede kullanılan sample'ların buffer'larını tut
  projectBuffers = new Map(); // url -> AudioBuffer
  
  // Proje serialize edilirken buffer'ları serialize etme
  // Sadece URL'leri serialize et
  
  // Proje deserialize edilirken:
  // 1. Önce projectBuffers'tan kontrol et (cache)
  // 2. Yoksa URL'den yükle
  // 3. Yüklenen buffer'ı projectBuffers'a ekle
  
  async getBuffer(url) {
    // Proje buffer'ında var mı?
    if (this.projectBuffers.has(url)) {
      return this.projectBuffers.get(url);
    }
    
    // Yükle ve cache'le
    const buffer = await loadFullBuffer(url);
    this.projectBuffers.set(url, buffer);
    return buffer;
  }
}
```

**Avantajlar:**
- ✅ Proje içinde buffer tekrar yüklenmez
- ✅ Proje açıldığında sadece yeni sample'lar yüklenir
- ✅ Basit ve maintainable

### 4. **Preview Cache (Mevcut - İyileştir)** ⭐⭐⭐
**LRU Cache - Basit ve Etkili**

```javascript
// Mevcut: usePreviewPlayerStore'da var
// İyileştirme: Range request ile daha küçük buffer'lar cache'lenir
// Max cache size: 50 dosya (mevcut)
// Cache size: Preview için sadece 2 saniye = çok küçük
```

**Avantajlar:**
- ✅ Preview için hızlı erişim
- ✅ Memory efficient (sadece 2 saniye buffer)
- ✅ LRU eviction (otomatik temizlik)

## 📋 Implementasyon Planı

### Phase 1: Preview Range Requests (Hemen)
1. `usePreviewPlayerStore.loadAudioBuffer` güncelle
2. Range request desteği ekle
3. Preview için sadece 2 saniye yükle
4. Full buffer sadece projeye eklenirken yükle

### Phase 2: Proje Buffer Management (1 hafta)
1. `ProjectBufferManager` oluştur
2. Proje serialize/deserialize'de buffer yönetimi
3. Proje açıldığında buffer'ları cache'le

### Phase 3: Optimization (İsteğe Bağlı)
1. Background preloading (proje sample'ları)
2. Compression format (MP3/OGG) - preview için
3. Network speed detection

## 🎯 Beklenen Sonuçlar

### Preview Performance
- **Önceki**: 10MB dosya = 8-10 saniye (1Mbps)
- **Sonraki**: 2 saniye preview = 0.2MB = 1.6 saniye (1Mbps)
- **İyileştirme**: %80+ hız artışı

### Proje Performance
- **Önceki**: Her proje açılışında tüm sample'lar yüklenir
- **Sonraki**: Sadece yeni sample'lar yüklenir
- **İyileştirme**: Proje açılış hızı %90+ artış

### Memory Usage
- **Preview Cache**: 50 dosya × 2 saniye = ~10MB
- **Proje Buffers**: Sadece projede kullanılan sample'lar
- **Toplam**: Çok daha efficient

## 🔧 Teknik Detaylar

### Range Request Implementation
```javascript
// Backend'de Range request desteği gerekli
// Fastify otomatik destekliyor mu kontrol et
// CDN (Bunny CDN) Range requests destekliyor mu?

// Test:
const response = await fetch(url, {
  headers: { 'Range': 'bytes=0-176400' } // 2 saniye stereo 44.1kHz
});
console.log(response.status); // 206 Partial Content olmalı
```

### Preview vs Full Load
```javascript
// Preview için
const previewBuffer = await loadPreview(url, 2); // 2 saniye

// Projeye eklenirken
const fullBuffer = await loadFullBuffer(url); // Tüm dosya
```

### Proje Buffer Lifecycle
```javascript
// 1. Sample projeye eklenir
const buffer = await loadFullBuffer(url);
instrument.audioBuffer = buffer;
projectBufferManager.add(url, buffer);

// 2. Proje serialize
// Buffer serialize edilmez, sadece URL

// 3. Proje deserialize
// Buffer projectBufferManager'dan alınır veya yüklenir
```

## 🚨 Edge Cases

1. **Range Request Desteklenmiyorsa**
   - Fallback: Full load (mevcut davranış)
   - Kullanıcıya bilgi ver

2. **Proje Buffer Cache Temizlenirse**
   - URL'den tekrar yükle
   - Background'da yükle, kullanıcıya bilgi ver

3. **Çok Büyük Projeler**
   - Proje buffer limit (örn: 500MB)
   - LRU eviction policy

## 💡 Best Practices

1. **Preview için Range requests kullan**
2. **Projeye eklenen sample'lar için full buffer**
3. **Proje buffer'ları cache'le**
4. **Serialize'de buffer'ları serialize etme**
5. **Deserialize'de akıllı buffer yönetimi**
6. **Graceful degradation (Range request yoksa full load)**

## 📚 Referanslar

- [HTTP Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)
- [Web Audio API - decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/decodeAudioData)
- Mevcut kod: `usePreviewPlayerStore.js`, `AudioAssetManager.js`, `ProjectSerializer.js`

