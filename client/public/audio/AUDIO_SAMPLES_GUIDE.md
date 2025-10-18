# Audio Samples Guide

Bu klasör yapısı DAW'deki farklı ses dosyası tiplerini organize eder.

## Klasör Yapısı

```
/audio/
├── samples/
│   ├── drums/          # Drum samples (one-shots)
│   ├── instruments/    # Instrument samples (pitched)
│   └── fx/            # Sound effects & transitions
├── loops/             # Audio loops (future)
└── user/              # User-imported samples (future)
```

---

## 1. Drum Samples (`/samples/drums/`)

**Mevcut Dosyalar:**
- ✅ `kick.wav` - 808/909 kick drum
- ✅ `snare.wav` - Acoustic/electronic snare
- ✅ `clap.wav` - Hand clap
- ✅ `hihat.wav` - Closed hi-hat
- ✅ `openhat.wav` - Open hi-hat
- ✅ `crash.wav` - Crash cymbal
- ✅ `rim.wav` - Rim shot

**İhtiyaç Duyulan Ek Drum Samples:**
- ⚠️ `kick_deep.wav` - Derin sub bass kick (808 style)
- ⚠️ `kick_punchy.wav` - Parlak, vuruşlu kick (909 style)
- ⚠️ `snare_crispy.wav` - Tiz, crispy snare
- ⚠️ `snare_deep.wav` - Derin, fat snare
- ⚠️ `hihat_808.wav` - 808 hi-hat
- ⚠️ `ride.wav` - Ride cymbal
- ⚠️ `tom_high.wav` - High tom
- ⚠️ `tom_mid.wav` - Mid tom
- ⚠️ `tom_low.wav` - Low tom
- ⚠️ `cowbell.wav` - Cowbell (808)
- ⚠️ `shaker.wav` - Shaker loop

**Format Gereksinimleri:**
- WAV format (16-bit veya 24-bit)
- 44.1kHz veya 48kHz sample rate
- Mono (tek kanal)
- Temiz, loop edilebilir (tail'ler dahil)
- Peak normalize edilmiş (-0.3dB)

---

## 2. Instrument Samples (`/samples/instruments/`)

**Mevcut Dosyalar:**
- ✅ `808.wav` - 808 bass
- ✅ `808_1.wav` - 808 bass variant 1
- ✅ `808_2.wav` - 808 bass variant 2
- ✅ `perc.wav` - Percussion sample

**İhtiyaç Duyulan Pitched Instrument Samples:**

### Piano Samples (Chromatic)
Multi-sample olarak her oktavdan birer nota:
- ⚠️ `piano_c2.wav` - C2 (65.41 Hz)
- ⚠️ `piano_c3.wav` - C3 (130.81 Hz)
- ⚠️ `piano_c4.wav` - C4 / Middle C (261.63 Hz)
- ⚠️ `piano_c5.wav` - C5 (523.25 Hz)
- ⚠️ `piano_c6.wav` - C6 (1046.50 Hz)

### Bass Samples
- ⚠️ `bass_acoustic_c1.wav` - Acoustic bass (C1)
- ⚠️ `bass_acoustic_c2.wav` - Acoustic bass (C2)
- ⚠️ `bass_electric_c1.wav` - Electric bass (C1)
- ⚠️ `bass_synth_c1.wav` - Synth bass (C1)

### String Samples
- ⚠️ `strings_c3.wav` - String ensemble (C3)
- ⚠️ `strings_c4.wav` - String ensemble (C4)
- ⚠️ `violin_c4.wav` - Solo violin (C4)
- ⚠️ `cello_c2.wav` - Solo cello (C2)

### Guitar Samples
- ⚠️ `guitar_acoustic_c3.wav` - Acoustic guitar (C3)
- ⚠️ `guitar_electric_c3.wav` - Electric guitar clean (C3)
- ⚠️ `guitar_distorted_c3.wav` - Electric guitar distorted (C3)

### Vocal Samples
- ⚠️ `vocal_ah_c4.wav` - Vocal "ah" (C4)
- ⚠️ `vocal_oh_c4.wav` - Vocal "oh" (C4)
- ⚠️ `choir_c4.wav` - Choir ensemble (C4)

**Format Gereksinimleri:**
- WAV format (24-bit preferred)
- 44.1kHz veya 48kHz sample rate
- Mono veya Stereo
- Sustain kısmı dahil (en az 2-3 saniye)
- Belirli bir pitch'te (dosya isminde belirtilmeli)
- Dry (reverb/delay yok)

---

## 3. Sound Effects (`/samples/fx/`)

**İhtiyaç Duyulan FX Samples:**
- ⚠️ `riser_short.wav` - Kısa riser (2-4 bar)
- ⚠️ `riser_long.wav` - Uzun riser (4-8 bar)
- ⚠️ `impact.wav` - Impact/drop hit
- ⚠️ `sweep_up.wav` - Upward sweep
- ⚠️ `sweep_down.wav` - Downward sweep
- ⚠️ `white_noise.wav` - White noise burst
- ⚠️ `vinyl_crackle.wav` - Vinyl crackle (lofi effect)
- ⚠️ `tape_stop.wav` - Tape stop effect
- ⚠️ `reverse_cymbal.wav` - Reversed cymbal

**Format Gereksinimleri:**
- WAV format (16-bit veya 24-bit)
- 44.1kHz veya 48kHz sample rate
- Stereo (wider soundstage)
- Normalized

---

## VASynth vs Sample-Based Instruments

### VASynth Instruments (Ses dosyası gerekmez)
Bunlar tamamen synth engine tarafından üretilir:
- ✅ Piano (VASynth preset)
- ✅ E. Piano (VASynth preset)
- ✅ Organ (VASynth preset)
- ✅ Bass (VASynth preset)
- ✅ Classic Lead (VASynth preset)
- ✅ Pluck (VASynth preset)
- ✅ Warm Pad (VASynth preset)
- ✅ Strings (VASynth preset)

### Sample-Based Instruments (Ses dosyası gerekir)
Gerçek enstrüman kaydı veya yüksek kaliteli sample:
- ⚠️ Piano (multi-sampled, realistic)
- ⚠️ Bass Guitar
- ⚠️ Acoustic Guitar
- ⚠️ Strings
- ⚠️ Vocals

---

## Dosya İsimlendirme Kuralları

### Drum Samples
Format: `<instrument>.wav`
Örnek: `kick.wav`, `snare_808.wav`, `hihat_closed.wav`

### Pitched Instrument Samples
Format: `<instrument>_<note><octave>.wav`
Örnekler:
- `piano_c4.wav`
- `bass_acoustic_c2.wav`
- `strings_g3.wav`

### FX Samples
Format: `<effect_type>_<variation>.wav`
Örnekler:
- `riser_short.wav`
- `sweep_up_fast.wav`
- `impact_heavy.wav`

---

## Sample Özellikleri

### Önerilen Formatlar
| Tip | Bit Depth | Sample Rate | Channels | Duration |
|-----|-----------|-------------|----------|----------|
| Drums | 16-24 bit | 44.1 kHz | Mono | 0.5-3s |
| Pitched | 24 bit | 48 kHz | Mono/Stereo | 2-5s |
| FX | 16-24 bit | 44.1 kHz | Stereo | Variable |
| Loops | 24 bit | 48 kHz | Stereo | 4-8 bars |

### Kalite Standartları
- ✅ Temiz kayıt (noise floor < -60dB)
- ✅ Peak normalize (-0.3dB headroom)
- ✅ Dry (efektsiz)
- ✅ Trimmed (gereksiz sessizlik yok)
- ✅ Fade out (pitched samples için)
- ✅ Consistent level (aynı kategorideki samplelar benzer volume)

---

## Kullanım Örnekleri

### initialData.js'de Sample Kullanımı

```javascript
// Drum sample (tek nota)
{
  id: 'inst-1',
  name: 'Kick',
  type: INSTRUMENT_TYPES.SAMPLE,
  url: '/audio/samples/drums/kick.wav',
  mixerTrackId: 'track-1',
  pianoRoll: false
}

// Pitched instrument sample (piano roll'da kullanılabilir)
{
  id: 'inst-20',
  name: 'Piano (Sampled)',
  type: INSTRUMENT_TYPES.SAMPLE,
  url: '/audio/samples/instruments/piano_c4.wav',
  mixerTrackId: 'track-20',
  pianoRoll: true,
  pitchOffset: 0,  // C4 base note
  multiSamples: [
    { note: 'C2', url: '/audio/samples/instruments/piano_c2.wav' },
    { note: 'C3', url: '/audio/samples/instruments/piano_c3.wav' },
    { note: 'C4', url: '/audio/samples/instruments/piano_c4.wav' },
    { note: 'C5', url: '/audio/samples/instruments/piano_c5.wav' },
    { note: 'C6', url: '/audio/samples/instruments/piano_c6.wav' }
  ]
}

// VASynth instrument (ses dosyası gerekmez)
{
  id: 'inst-6',
  name: 'Piano',
  type: INSTRUMENT_TYPES.VASYNTH,
  mixerTrackId: 'track-6',
  pianoRoll: true,
  presetName: 'Piano'
}
```

---

## Öncelikli İhtiyaçlar (Priority List)

### High Priority (Hemen gerekli)
1. ✅ Kick, Snare, Clap, Hi-hat (mevcut)
2. ⚠️ Piano multi-samples (C2-C6)
3. ⚠️ Bass samples (C1-C2)
4. ⚠️ Impact/riser FX

### Medium Priority (Yakında gerekli)
5. ⚠️ Tom samples (high, mid, low)
6. ⚠️ String samples
7. ⚠️ Guitar samples
8. ⚠️ Additional drum variations

### Low Priority (İleride eklenebilir)
9. ⚠️ Vocal samples
10. ⚠️ Exotic percussion
11. ⚠️ Sound design FX

---

## Nereden Sample Bulunabilir?

### Ücretsiz Kaynaklar
- **Freesound.org** - CC0/CC-BY licensed samples
- **99sounds.org** - Free sample packs
- **SampleSwap.org** - Free sample exchange
- **LANDR Samples** - Free tier samples
- **Splice Free Packs** - Monthly free sample packs

### Dikkat Edilmesi Gerekenler
- ✅ Lisans kontrolü (CC0, CC-BY, Royalty-Free)
- ✅ Attribüsyon gereklilikleri
- ✅ Ticari kullanım izni
- ⛔ Copyrighted materials kullanmayın

---

## Notlar

- VASynth presetleri gerçek zamanlı synth olduğu için ses dosyası gerektirmez
- Sample-based enstrümanlar daha gerçekçi ama daha fazla disk alanı kullanır
- Multi-sampling kaliteyi artırır (her oktavdan ayrı sample)
- Hybrid yaklaşım: VASynth + sample layer = en iyi sonuç

---

**Son Güncelleme:** 18 Ekim 2025
**Dosya Formatı:** Markdown
**Yazar:** DAW Audio Engine Team
