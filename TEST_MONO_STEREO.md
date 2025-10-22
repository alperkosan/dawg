# 🔍 MONO/STEREO TEST - Distortion Kaynağını Bul

## Hipotez:
**Kick/Synth = MONO samples → Stereo'ya kopyalanırken +6dB boost**
**Hihat/Snare = STEREO samples → Direkt pass-through, boost yok**

---

## Browser Console'da Test:

```javascript
// 1. Sample'ların kaç kanallı olduğunu kontrol et
audioEngine.sampleBuffers.forEach((buffer, id) => {
    const instrument = Array.from(audioEngine.instruments.values())
        .find(i => i.sampleBuffers?.has(id));

    console.log(`Sample ${id}:`, {
        instrument: instrument?.type || 'unknown',
        channels: buffer.numberOfChannels,
        isMono: buffer.numberOfChannels === 1,
        isStereo: buffer.numberOfChannels === 2,
        duration: buffer.duration.toFixed(2) + 's',
        sampleRate: buffer.sampleRate
    });
});

// 2. Mono sample'ları filtrele
const monoSamples = [];
const stereoSamples = [];

audioEngine.sampleBuffers.forEach((buffer, id) => {
    const instrument = Array.from(audioEngine.instruments.values())
        .find(i => i.sampleBuffers?.has(id));

    const info = {
        id,
        type: instrument?.type || 'unknown',
        channels: buffer.numberOfChannels
    };

    if (buffer.numberOfChannels === 1) {
        monoSamples.push(info);
    } else {
        stereoSamples.push(info);
    }
});

console.log('📊 MONO SAMPLES (distorted?):', monoSamples);
console.log('📊 STEREO SAMPLES (clean?):', stereoSamples);

// 3. Korelasyon kontrolü
console.log('\n🔍 KORELASYON:');
console.log('Kick/Synth mono mu?', monoSamples.some(s => s.type === 'kick' || s.type === 'synth'));
console.log('Hihat/Snare stereo mu?', stereoSamples.some(s => s.type === 'hihat' || s.type === 'snare'));
```

---

## Beklenen Sonuç:

### EĞER MONO = DISTORTED ise:

```
MONO SAMPLES (DISTORTED):
- Kick: 1 channel ❌
- Synth: 1 channel ❌

STEREO SAMPLES (CLEAN):
- Hihat: 2 channels ✅
- Snare: 2 channels ✅
```

**PROBLEM:** Mono→Stereo dönüşümünde gain yanlış!

---

## Nerede Mono→Stereo Dönüşümü Oluyor?

### 1. NativeSamplerNode.js - Sample Playback
```javascript
// AudioBufferSourceNode otomatik olarak:
// 1 channel → 2 channel (L+R kopyalanıyor, +6dB!)
```

### 2. WASM UnifiedMixer
```rust
// Input: stereo (L, R)
// Eğer mono sample ise:
//   - L = sample data
//   - R = sample data (KOPYALANIYOR!)
// Linear pan center → L×1.0 + R×1.0 = 2× gain!
```

---

## Çözüm Stratejileri:

### A. Constant Power Pan (Önceki Versiyon)
```rust
// Center pan = 0.707 × 0.707
// Mono sample: L=0.707, R=0.707
// Toplam: 0.707 + 0.707 = 1.414 = +3dB
// Hala yüksek ama daha iyi!
```

### B. Mono Detection + Gain Reduction
```rust
// Detect if L == R (mono signal)
if (sample_l - sample_r).abs() < 0.0001 {
    // Mono signal, reduce by 0.5 (-6dB)
    out_l *= 0.5;
    out_r *= 0.5;
}
```

### C. Proper Mono→Stereo Upmix
```rust
// Mono signal should be -3dB per channel
if is_mono_signal {
    let mono_gain = 0.707; // -3dB
    out_l *= mono_gain;
    out_r *= mono_gain;
}
```

---

## İlk Adım - BU TESTİ YAP:

```javascript
// HIZLI TEST:
const buffer = Array.from(audioEngine.sampleBuffers.values())[0];
console.log('Channels:', buffer.numberOfChannels);
console.log('Is Mono?', buffer.numberOfChannels === 1);
```

Sonucu söyle! Mono mu stereo mu?
