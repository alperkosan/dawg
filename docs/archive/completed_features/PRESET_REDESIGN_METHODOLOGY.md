# Preset Yeniden Tasarım Metodolojisi

## 📐 Genel Metodoloji

Tüm preset'ler aşağıdaki akılcı yöntemler kullanılarak yeniden tasarlandı:

### 1. **Analog Ekipman Referansları**
- Gerçek analog ekipmanların parametrelerini referans al
- Örnekler: Universal Audio LA-2A, 1176, Neve Console, SSL Bus Compressor
- Endüstri standardı ekipman karakteristiklerini modelle

### 2. **Endüstri Standardı Plugin'ler**
- FabFilter, Universal Audio, Waves gibi profesyonel plugin'lerin preset'lerini referans al
- Profesyonel mixing/mastering tekniklerini uygula

### 3. **Müzik Türü Bazlı Kategoriler**
- **Genre Tags**: Her preset'e genre tag'leri eklendi (EDM, Hip-Hop, Rock, Jazz, etc.)
- **Genre-Appropriate Settings**: EDM = fast attack/release, Jazz = slow, musical

### 4. **Enstrüman Bazlı Preset'ler**
- **Vocal**: Smooth, transparent compression
- **Drums**: Fast attack for transient preservation
- **Bass**: Controlled low-end dynamics
- **Guitar**: Tube-style compression

### 5. **Kullanım Senaryoları**
- **Mixing**: Bus compression, parallel compression
- **Mastering**: Transparent, mastering-grade settings
- **Creative**: Aggressive, characterful settings

### 6. **Parametre İlişkileri (Matematiksel)**
- **Threshold/Ratio Correlation**: Higher ratio needs lower threshold
- **Attack/Release Correlation**: Fast attack pairs with medium release
- **Knee/AutoMakeup**: Soft knee needs makeup gain
- **Curve Types**: Linear, Exponential, Logarithmic scaling

---

## 🎯 Compressor Preset Metodolojisi

### Kategoriler:
1. **Vocal Compression** (LA-2A, 1176)
2. **Drum Compression** (API 2500, Parallel)
3. **Mix Compression** (SSL Bus, Neve 33609)
4. **Limiting** (Brick Wall)
5. **Specialized** (Bass, Guitar, EDM Pumping)

### Parametre İlişkileri:
- **Attack/Release**: Genre-appropriate timing
  - EDM: Fast (0.001-0.1s)
  - Jazz: Slow (0.01-0.5s)
- **Threshold/Ratio**: Inverse relationship
  - High ratio = Lower threshold for control
- **Knee**: Soft for transparency, Hard for punch
- **Look-ahead**: Mastering (8-10ms), Mixing (2-5ms)

### Genre Mapping:
- **EDM**: Fast attack, medium release, high ratio
- **Hip-Hop**: Aggressive compression, punch
- **Rock**: API-style, transient-focused
- **Jazz**: Slow, musical, transparent

---

## 🎯 Saturator Preset Metodolojisi

### Kategoriler:
1. **Vocal Saturation** (Neve, SSL)
2. **Bass Saturation** (Transformer, Tube)
3. **Tape Saturation** (Studer A800, Vintage)
4. **Drum Saturation** (API, Aggressive)
5. **Master Saturation** (Console, Neve Mastering)

### Harmonic Content:
- **Even Harmonics** (`toasty`): Warmth, musical
- **Odd Harmonics** (`crunchy`): Presence, clarity
- **Mixed Harmonics** (`distress`): Aggressive character

### Frequency Modes:
- **Transformer**: Low-end focus (bass)
- **Tape**: Mid-range focus (vintage)
- **Wide**: Full spectrum (versatile)

### Parameter Relationships:
- **Drive/Tone**: Inverse relationship for balance
- **Headroom**: Less headroom = more saturation
- **Auto-gain**: Compensates for harmonic buildup

---

## 🎯 Reverb Preset Metodolojisi

### Acoustic Space References:
1. **Room**: Small studio room (0.35 size, 0.8s decay)
2. **Hall**: Concert hall (0.65 size, 2.5s decay)
3. **Cathedral**: Vast space (0.9 size, 6s decay)
4. **Plate**: Lexicon-style (0.5 size, 1.8s decay)
5. **Vocal**: Vocal plate (0.45 size, 1.5s decay)
6. **Ambient**: Long tail (0.95 size, 10s decay)
7. **Chamber**: Recording chamber (0.55 size, 1.2s decay)

### Parameter Relationships:
- **Size/Decay**: Proportional (larger = longer decay)
- **Damping**: Higher = less high-end (realistic)
- **Pre-delay**: Larger spaces = longer pre-delay
- **Early/Late Mix**: More early = tighter, more late = spacious

### Genre Mapping:
- **Rock/Pop**: Plate, Room, Hall
- **Ambient/Electronic**: Ambient, Cathedral
- **Jazz/Classical**: Hall, Chamber

---

## 🎯 Delay Preset Metodolojisi

### Classic Techniques:
1. **Slapback**: Vintage rockabilly (80-85ms)
2. **Ping-Pong**: Stereo bouncing (375-500ms)
3. **Dub**: Reggae-style filtered feedback
4. **Ambient**: Long atmospheric delay (1.2-1.5s)
5. **Tape**: Analog tape echo (Echoplex style)
6. **Tempo-Synced**: 1/8, 1/4 note delays

### Parameter Relationships:
- **Time/Stereo Width**: Wider stereo = different L/R times
- **Feedback/Filter**: More feedback = more filtering
- **Saturation**: Tape-style character
- **Diffusion**: Smoother, more natural repeats

### Genre Mapping:
- **Rock**: Slapback, Tape
- **Pop/EDM**: Ping-Pong, Tempo-synced
- **Reggae/Dub**: Dub delays
- **Ambient**: Long delays with modulation

---

## 📊 Preset Kalite Metrikleri

### Doğallık:
- ✅ Analog ekipman referansları
- ✅ Gerçekçi parametre değerleri
- ✅ Matematiksel parametre ilişkileri

### Kullanılabilirlik:
- ✅ Genre tags
- ✅ Açıklayıcı descriptions
- ✅ Reference ekipman bilgileri
- ✅ Kullanım senaryoları

### Müzikal Karakter:
- ✅ Genre-appropriate settings
- ✅ Enstrüman-specific preset'ler
- ✅ Mixing/mastering scenario'ları
- ✅ Creative options

---

## 🚀 Sonuç

Tüm preset'ler artık:
1. **Akılcı metodoloji** ile tasarlandı
2. **Analog ekipman referansları** içeriyor
3. **Genre-specific** ayarlara sahip
4. **Matematiksel parametre ilişkileri** kullanıyor
5. **Profesyonel mixing/mastering** tekniklerini uyguluyor
6. **Kullanım senaryoları** açıkça tanımlanmış

Bu yaklaşım, preset'lerin daha doğal, kullanışlı ve müzikal olmasını sağlıyor.

