# Pitch Shifter - İyileştirme Planı

## Mevcut Durum Analizi

**Mevcut Algoritma:** PSOLA (Pitch Synchronous Overlap-Add)
- ✅ Basit implementasyon
- ✅ Düşük CPU kullanımı
- ❌ Phaser artifacts (grain overlap'den kaynaklı)
- ❌ Extreme shifts'te kalite düşüyor
- ❌ Transient preservation zayıf

## Profesyonel Alternatifler

### 1. Phase Vocoder (FFT-based) ⭐ EN İYİ

**Avantajlar:**
- ✅ En yüksek kalite (Soundtoys, Waves standard)
- ✅ Phaser artifacts yok
- ✅ Transient preservation mükemmel
- ✅ Extreme shifts'te bile temiz
- ✅ Formant shifting daha doğal

**Dezavantajlar:**
- ❌ Yüksek CPU kullanımı (FFT hesaplamaları)
- ❌ Daha karmaşık implementasyon
- ❌ Gecikme (latency) daha yüksek

**Kullanım:** Profesyonel vokal processing için ideal

### 2. Improved PSOLA (Mevcut - İyileştirilmiş)

**İyileştirmeler:**
- ✅ Multiple grain overlap (mevcut)
- ✅ Adaptive window sizing (mevcut)
- ✅ Better grain synchronization
- ✅ Phase locking between grains

**Sonuç:** Orta seviye kalite, düşük CPU

### 3. Hybrid Approach (Elastique-style)

**Yöntem:**
- Small shifts (<6st): Time-domain (PSOLA)
- Large shifts (>6st): Frequency-domain (Phase Vocoder)
- Dynamic switching

**Avantaj:** CPU/kalite dengesi

## Önerilen Çözüm: Phase Vocoder Ekleme

### Implementation Plan

**Phase 1: FFT Infrastructure**
- FFT/iFFT fonksiyonları (kullanılabiliyor mu kontrol et)
- Phase accumulator
- Magnitude/phase separation

**Phase 2: Phase Vocoder Core**
- Frequency bin processing
- Phase propagation
- Time-scale modification

**Phase 3: Integration**
- Quality mode'da Phase Vocoder seçeneği
- PSOLA → Fast/Normal, Phase Vocoder → High Quality
- Seamless switching

### Kod Yapısı

```javascript
// Phase Vocoder için
- FFT size: 2048 (kalite için), 1024 (performans için)
- Overlap: 75% (smooth transitions)
- Window: Blackman-Harris (better spectral properties)
- Phase unwrapping: prevent phase discontinuities
```

## Mevcut İyileştirmeler (Kısa Vadeli)

1. **Better Grain Synchronization**
   - Pitch detection ile grain start noktalarını optimize et
   - Phase-locked grains

2. **Improved Window Function**
   - Hann yerine Blackman-Harris window
   - Daha iyi spectral properties

3. **Grain Pool Management**
   - Pre-allocated grain buffers
   - Smooth crossfading between grains

4. **Transient Detection**
   - Transient'leri preserve et
   - Zaman domain'de transient'leri bypass et

## Karar

**Seçenek A: Phase Vocoder Eklemek** (En İyi)
- Kalite: 10/10
- CPU: Yüksek
- Zaman: 2-3 saat

**Seçenek B: PSOLA İyileştirmeleri** (Hızlı)
- Kalite: 7/10
- CPU: Düşük
- Zaman: 30 dakika

**Seçenek C: Hybrid** (Denge)
- Kalite: 9/10
- CPU: Orta
- Zaman: 1-2 saat

## Öneri

**Kısa Vadeli (Şimdi):** PSOLA iyileştirmeleri
**Orta Vadeli:** Phase Vocoder eklemek (Quality=High mode)

