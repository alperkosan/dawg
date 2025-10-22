# Distortion Debug Test

## Test Adımları:

### 1. Browser Console'da Test Et:

```javascript
// 1. Sample buffer'larını kontrol et
const audioEngine = window.audioEngine;
const sampleBuffers = audioEngine.sampleBuffers;

// Her sample için peak seviyesini kontrol et
sampleBuffers.forEach((buffer, sampleId) => {
    const channelData = buffer.getChannelData(0);
    let peak = 0;
    for (let i = 0; i < channelData.length; i++) {
        peak = Math.max(peak, Math.abs(channelData[i]));
    }
    console.log(`Sample ${sampleId}: Peak = ${peak.toFixed(4)} (${(20 * Math.log10(peak)).toFixed(2)} dB)`);

    if (peak > 0.9) {
        console.warn(`⚠️ Sample ${sampleId} is HOT! Peak at ${(peak * 100).toFixed(1)}%`);
    }
});

// 2. Velocity değerlerini kontrol et
const pattern = audioEngine.patterns.get(audioEngine.activePatternId);
if (pattern) {
    pattern.notes.forEach(note => {
        console.log(`Note: velocity=${note.velocity}, gain=${note.velocity/127}`);
    });
}

// 3. Master chain gain seviyelerini kontrol et
console.log('Master Bus Gain:', audioEngine.masterBusGain.gain.value);
console.log('Master Volume:', audioEngine.masterGain.gain.value);

// 4. UnifiedMixer channel parametrelerini kontrol et
console.log('UnifiedMixer active:', audioEngine.unifiedMixer !== null);
```

### 2. Olası Distortion Kaynakları:

#### A. Sample Clipping (EN MUHTEMEL)
```
Sample dosyası kendisi -0.1dB veya daha yüksek seviyede kaydedilmiş
→ Velocity 127 (1.0 gain) ile çalınca clipping oluyor
→ Çözüm: Sample'ları normalize et veya velocity'yi düşür
```

**Test:**
- Velocity'yi 64'e (0.5 gain) düşür
- Hala distortion varsa → Sample değil, başka bir kaynak
- Distortion azalırsa → Sample çok yüksek seviyede

#### B. Multiple Instances (Polyphony Stacking)
```
Aynı anda birden fazla not çalınca gain toplanıyor
→ 3 not × 0.8 gain = 2.4 (clipping!)
→ Çözüm: Polyphony gain reduction (şu an disabled)
```

**Test:**
- Tek bir not çal → Distortion var mı?
- 3-4 not birden çal → Daha kötü mü?

#### C. WASM Pan Bug (Düzeltildi ama yeniden kontrol)
```
Pan formula hala eski formülü kullanıyor olabilir
→ Cache problemi?
```

**Test:**
```javascript
// Hard reload yap (Cmd+Shift+R veya Ctrl+Shift+R)
// WASM cache'i temizle
```

#### D. Hidden Compression/Limiting
```
Somewhere in the chain bir limiter var
→ Master chain'de veya sample playback'te
```

**Test:**
```javascript
// Master chain'i bypass et
audioEngine.masterBusGain.disconnect();
audioEngine.masterGain.disconnect();

// Sadece instrument'ı speaker'a bağla
const inst = audioEngine.instruments.values().next().value;
if (inst && inst.output) {
    inst.output.connect(audioEngine.audioContext.destination);
}
```

---

## Hızlı Test:

**1. Velocity'yi düşür:**
- Piano roll'da tüm notları seç
- Velocity'yi 64'e düşür (0.5 gain)
- Çal ve dinle

**2. Hard reload:**
- Cmd+Shift+R (Mac) veya Ctrl+Shift+R (Windows)
- WASM cache temizlensin

**3. Sample seviyesini kontrol et:**
- Mixer'da instrument fader'ını -6dB'ye çek
- Hala distortion varsa → Sample içinde problem var

---

## Beklenen Sonuçlar:

### Eğer distortion sample'dan geliyorsa:
- Velocity düşürünce düzelir
- Fader'ı düşürünce düzelir
- **Çözüm:** Sample'ları normalize et veya default velocity'yi 80'e düşür

### Eğer distortion WASM'dan geliyorsa:
- Velocity/fader değiştirince değişmez
- Hala aynı saturated sound
- **Çözüm:** WASM cache problemi, hard reload gerekli

### Eğer distortion polyphony'den geliyorsa:
- Tek not temiz
- Birden fazla not distorted
- **Çözüm:** Polyphony gain reduction etkinleştir

---

## İlk Adım:

Konsola bunu yapıştır ve çalıştır:

```javascript
// Hızlı debug
const inst = Array.from(audioEngine.instruments.values())[0];
console.log('Instrument output gain:', inst?.internalOutput?.gain?.value);
console.log('Master bus gain:', audioEngine.masterBusGain?.gain?.value);
console.log('Master volume:', audioEngine.masterGain?.gain?.value);

// Sample peak check
const firstSample = audioEngine.sampleBuffers.values().next().value;
if (firstSample) {
    const data = firstSample.getChannelData(0);
    const peak = Math.max(...data.map(Math.abs));
    console.log('Sample peak:', peak.toFixed(4), '→', (20 * Math.log10(peak)).toFixed(2), 'dB');
    if (peak > 0.95) console.warn('🔥 SAMPLE TOO HOT!');
}
```

Bu testi yap ve sonuçları bana gönder!
