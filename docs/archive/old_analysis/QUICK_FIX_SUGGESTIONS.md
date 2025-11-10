# Hızlı Distortion Çözümleri

## Durum:
- ✅ WASM rebuild yapıldı (21:41)
- ✅ Pan bug fix'i uygulandı
- ✅ Compression parametreleri düzeltildi
- ✅ EQ/Compression default olarak kapalı
- ❌ Hala distortion var

## İhtimal 1: Browser Cache (EN MUHTEMEL!) 🔥

**Problem:** Browser eski WASM dosyasını kullanıyor

**Çözüm:**
1. **Hard Reload:** `Cmd+Shift+R` (Mac) veya `Ctrl+Shift+R` (Windows)
2. **DevTools'da Disable Cache:**
   - F12 → Network tab
   - "Disable cache" checkbox'ını işaretle
   - Sayfayı yenile

3. **Service Worker temizle:**
```javascript
// Console'a yapıştır:
navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister());
    location.reload();
});
```

---

## İhtimal 2: Sample Seviyesi Çok Yüksek 🔊

**Problem:** Piano sample dosyası zaten -0.5dB veya daha yüksek seviyede

**Test:**
```javascript
// Console'a yapıştır:
const buffer = Array.from(audioEngine.sampleBuffers.values())[0];
const data = buffer.getChannelData(0);
const peak = Math.max(...data.map(Math.abs));
console.log('Sample peak:', (peak * 100).toFixed(1) + '%',
            '→', (20 * Math.log10(peak)).toFixed(2) + ' dBFS');
```

**Beklenen:**
- Peak < 0.7 (70%) = -3dB = İyi ✅
- Peak > 0.9 (90%) = -0.9dB = Çok yüksek! ⚠️

**Hızlı Çözüm:**
```javascript
// Tüm sample'ları %50'ye düşür
audioEngine.instruments.forEach(inst => {
    if (inst.internalOutput) {
        inst.internalOutput.gain.value = 0.5; // -6dB
    }
});
```

---

## İhtimal 3: Polyphony Stacking 🎹

**Problem:** Aynı anda birden fazla not çalınca toplanıyor

**Test:**
- Tek nota çal → Temiz mi?
- 3-4 nota birden → Distorted mı?

**Hızlı Çözüm:**
Polyphony gain reduction'ı aç:

```javascript
// NativeSamplerNode.js'de
this.polyphonyGainReduction = true;
```

---

## İhtimal 4: Velocity Çok Yüksek 📈

**Problem:** Default velocity 100+ ise ve sample zaten yüksekse → Clipping

**Test:**
Piano roll'da velocity değerlerini kontrol et

**Hızlı Çözüm:**
```javascript
// Tüm velocity'leri düşür
const pattern = audioEngine.patterns.get(audioEngine.activePatternId);
pattern.notes.forEach(note => {
    note.velocity = Math.min(note.velocity, 80); // Max 80 (0.63 gain)
});
```

---

## İhtimal 5: Linear Pan Çok Yüksek 📊

**Problem:** Linear panning ile center'da L+R = 2.0 (6dB boost!)

**Açıklama:**
```
Linear Pan (şimdi kullandığımız):
pan = 0 (center) → L=1.0, R=1.0
Mono sample çalınca → L+R = 2.0 = +6dB! 🔥
```

**Test:**
```javascript
// Pan'ı tamamen sola al
// Set all instruments to full left
audioEngine.unifiedMixer?.updateChannel?.(0, { pan: -1.0 });
// Distortion azalıyor mu?
```

**Kalıcı Çözüm:**
Constant power pan'a geri dön ama +3dB boost ekle:

```rust
// lib.rs'de
let pan_rad = (self.pan + 1.0) * 0.25 * std::f32::consts::PI;
let left_gain = pan_rad.cos() * 1.414;  // √2 boost
let right_gain = pan_rad.sin() * 1.414; // √2 boost
```

---

## ŞİMDİ YAPILACAKLAR (Sırayla):

### 1. Hard Reload (30 saniye)
```
Cmd+Shift+R (Mac) veya Ctrl+Shift+R (Windows)
→ WASM cache temizlensin
```

### 2. Sample Peak Kontrolü (1 dakika)
```javascript
const buffer = Array.from(audioEngine.sampleBuffers.values())[0];
const data = buffer.getChannelData(0);
const peak = Math.max(...data.map(Math.abs));
console.log('Peak:', (peak*100).toFixed(1)+'%', (20*Math.log10(peak)).toFixed(2)+'dB');
```

### 3. Temporary Gain Reduction (Test)
```javascript
// Hepsini -6dB düşür
audioEngine.instruments.forEach(inst => {
    if (inst.internalOutput) inst.internalOutput.gain.value = 0.5;
});
// Düzeliyor mu?
```

### 4. Pan Test
```javascript
// Center yerine full left
audioEngine.unifiedMixer?.updateChannel?.(0, { pan: -1.0 });
// Düzeliyor mu?
```

---

## Sonuç:

**Eğer Hard Reload ile düzelirse:**
→ Cache problemi, her zaman hard reload yapmalısın

**Eğer Gain reduction ile düzelirse:**
→ Sample çok yüksek seviyede, normalize etmeli

**Eğer Pan test ile düzelirse:**
→ Linear pan problemi, constant power'a dönmeli

**Eğer hiçbiri düzeltmiyorsa:**
→ Başka bir kaynak var, daha derin araştırma gerekli

---

**İLK ADIM: Hard Reload Yap! 🔄**

`Cmd+Shift+R` (Mac) veya `Ctrl+Shift+R` (Windows)

Sonra bana ne oldu söyle!
