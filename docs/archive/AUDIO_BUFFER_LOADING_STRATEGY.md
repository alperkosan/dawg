# Audio Buffer Loading Strategy for Slow Internet

## 🎯 Problem Statement

Uploaded sample'ların yavaş internet bağlantılarında yüklenmesi için optimize edilmiş bir strateji gerekiyor. Kullanıcı deneyimini bozmadan, en verimli şekilde audio buffer'ları yüklemek.

## 📊 Mevcut Durum

### Şu Anki Implementasyonlar:
1. **ProgressiveAudioLoader**: Chunked streaming var ama sadece rendering için
2. **SampleLoader**: Progress tracking var ama chunk-based değil
3. **AudioAssetManager**: Basit fetch + decode
4. **usePreviewPlayerStore**: Basit fetch + decode

### Sorunlar:
- ❌ Tüm dosya yüklenmeden decode edilemiyor
- ❌ Cache stratejisi yok (IndexedDB)
- ❌ Priority queue yok
- ❌ Retry logic zayıf
- ❌ Range requests kullanılmıyor
- ❌ Compression format desteği yok

## 🚀 Önerilen Çözüm: Hybrid Loading Strategy

### 1. **HTTP Range Requests (206 Partial Content)** ⭐⭐⭐⭐⭐
**En Önemli Özellik**

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
- ✅ Preview için sadece %5-10 veri yüklenir
- ✅ Hızlı preview gösterimi
- ✅ Bandwidth tasarrufu
- ✅ CDN'ler genellikle destekler

### 2. **IndexedDB Persistent Cache** ⭐⭐⭐⭐⭐
**Offline Kullanım İçin Kritik**

```javascript
class AudioCacheManager {
  constructor() {
    this.db = null; // IndexedDB instance
    this.maxCacheSize = 500 * 1024 * 1024; // 500MB
  }
  
  async init() {
    // IndexedDB aç
    // Store: { url, buffer, timestamp, size }
  }
  
  async get(url) {
    // Cache'ten oku
    // Eğer varsa ve fresh ise döndür
  }
  
  async set(url, buffer) {
    // Cache'e yaz
    // LRU eviction policy
  }
  
  async clearOld() {
    // Eski cache'leri temizle
    // Size limit kontrolü
  }
}
```

**Avantajlar:**
- ✅ Offline kullanım
- ✅ Hızlı ikinci yükleme
- ✅ Bandwidth tasarrufu
- ✅ Persistent storage

### 3. **Priority Queue System** ⭐⭐⭐⭐
**Akıllı Yükleme Sırası**

```javascript
class PriorityLoader {
  constructor() {
    this.queue = new PriorityQueue((a, b) => a.priority - b.priority);
    this.active = new Set();
    this.maxConcurrent = 3;
  }
  
  add(url, priority, onProgress) {
    // Priority: 0 = critical, 10 = low
    // Critical: Şu an çalınacak sample
    // High: Pattern'de kullanılan sample
    // Medium: Aynı pack'teki sample
    // Low: Diğer sample'lar
  }
  
  async process() {
    // Priority'ye göre yükle
    // Concurrent limit kontrolü
  }
}
```

**Priority Seviyeleri:**
- **Critical (0)**: Şu an çalınacak sample
- **High (1)**: Pattern'de kullanılan sample
- **Medium (3)**: Aynı pack'teki sample
- **Low (5)**: Diğer sample'lar
- **Background (10)**: Preload için

### 4. **Streaming Decode with Chunks** ⭐⭐⭐⭐
**Büyük Dosyalar İçin**

```javascript
async loadStreaming(url, onProgress) {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  const total = parseInt(response.headers.get('content-length'), 10);
  
  // Chunk'ları topla
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    chunks.push(value);
    received += value.length;
    
    // Progress: 0-80% download, 80-100% decode
    onProgress((received / total) * 0.8);
  }
  
  // Combine chunks
  const arrayBuffer = combineChunks(chunks);
  
  // Decode (20% progress)
  onProgress(0.9);
  const buffer = await audioContext.decodeAudioData(arrayBuffer);
  onProgress(1.0);
  
  return buffer;
}
```

**Avantajlar:**
- ✅ Progress tracking
- ✅ Memory efficient
- ✅ Cancellation support

### 5. **Compression Format Support** ⭐⭐⭐
**Bandwidth Tasarrufu**

```javascript
// CDN'de MP3/OGG formatı sun
// WAV yerine compressed format kullan

const formats = {
  preview: 'mp3', // 128kbps
  playback: 'ogg', // 192kbps Vorbis
  export: 'wav' // Original quality
};

// Web Audio API MP3/OGG decode edebilir
// decodeAudioData() otomatik format detection yapar
```

**Avantajlar:**
- ✅ %70-80 bandwidth tasarrufu
- ✅ Daha hızlı yükleme
- ✅ Web Audio API native destekler

### 6. **Retry Logic with Exponential Backoff** ⭐⭐⭐
**Network Hataları İçin**

```javascript
async loadWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff: 1s, 2s, 4s
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

### 7. **Lazy Loading Strategy** ⭐⭐⭐⭐
**Sadece İhtiyaç Duyulan Sample'ları Yükle**

```javascript
// Pattern'de kullanılan sample'ları önce yükle
// Diğer sample'ları background'da yükle

class LazySampleLoader {
  async loadForPattern(pattern) {
    // Pattern'deki sample'ları yükle (priority: high)
    const sampleIds = pattern.getSampleIds();
    await this.loadBatch(sampleIds, 'high');
  }
  
  async preloadPack(packId) {
    // Pack'teki sample'ları background'da yükle (priority: low)
    const samples = await getPackSamples(packId);
    await this.loadBatch(samples, 'low');
  }
}
```

## 🎯 Önerilen Implementasyon Sırası

### Phase 1: Critical (Hemen)
1. ✅ **Range Requests** - Preview için
2. ✅ **IndexedDB Cache** - Offline support
3. ✅ **Retry Logic** - Network hataları

### Phase 2: High Priority (1-2 hafta)
4. ✅ **Priority Queue** - Akıllı yükleme
5. ✅ **Streaming Decode** - Büyük dosyalar
6. ✅ **Lazy Loading** - Pattern-based

### Phase 3: Optimization (2-4 hafta)
7. ✅ **Compression Support** - MP3/OGG
8. ✅ **Background Fetch API** - Arka plan yükleme
9. ✅ **Predictive Preloading** - ML-based

## 📝 Teknik Detaylar

### Range Request Implementation
```javascript
// Backend'de Range request desteği gerekli
// Fastify'da otomatik destekleniyor mu kontrol et
// CDN (Bunny CDN) Range requests destekliyor mu?

// Test:
const response = await fetch(url, {
  headers: { 'Range': 'bytes=0-88200' }
});
console.log(response.status); // 206 Partial Content olmalı
```

### IndexedDB Schema
```javascript
{
  stores: {
    audioCache: {
      keyPath: 'url',
      indexes: ['timestamp', 'size']
    }
  }
}
```

### Priority Calculation
```javascript
function calculatePriority(sample, context) {
  let priority = 5; // default: low
  
  // Şu an çalınacak mı?
  if (context.isPlaying && context.currentSample === sample.id) {
    return 0; // critical
  }
  
  // Pattern'de kullanılıyor mu?
  if (context.activePatterns.includes(sample.patternId)) {
    return 1; // high
  }
  
  // Aynı pack'te mi?
  if (context.currentPack === sample.packId) {
    return 3; // medium
  }
  
  return 5; // low
}
```

## 🔍 Performance Metrics

### Hedefler:
- **Preview Load Time**: < 500ms (Range request ile)
- **Full Load Time**: < 5s (100MB dosya, 10Mbps)
- **Cache Hit Rate**: > 80%
- **Bandwidth Savings**: > 70% (compression ile)

### Monitoring:
- Load time tracking
- Cache hit/miss ratio
- Network speed detection
- Error rate tracking

## 🚨 Edge Cases

1. **Very Slow Internet (< 1Mbps)**
   - Sadece preview yükle
   - Full load için kullanıcı onayı iste
   - Background'da yavaşça yükle

2. **Offline Mode**
   - IndexedDB cache'ten oku
   - Cache miss durumunda error göster

3. **Large Files (> 100MB)**
   - Streaming decode kullan
   - Progress göster
   - Cancellation desteği

4. **Multiple Simultaneous Loads**
   - Priority queue ile sırala
   - Concurrent limit (3-5)
   - Bandwidth throttling

## 💡 Best Practices

1. **Always check cache first**
2. **Use Range requests for preview**
3. **Implement retry logic**
4. **Show progress to user**
5. **Support cancellation**
6. **Monitor performance**
7. **Graceful degradation**

## 📚 Referanslar

- [Web Audio API - decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/decodeAudioData)
- [HTTP Range Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Background Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Fetch_API)

