# Pratik Test Rehberi - Faz 1 Öncesi Log Toplama

## 🎯 Amaç

Bu rehber, Faz 1 geliştirmelerinden ÖNCE mevcut durumun loglarını toplamak için **adım adım** talimatlar içerir.

---

## 📋 Genel Hazırlık

### 1. Chrome DevTools'u Açın
- **F12** tuşuna basın veya **Right Click → Inspect**
- **Console** tab'ını açın
- Console'u temizleyin: **Clear console** butonuna basın (🚫 simgesi)

### 2. Console Filtreleme Ayarları
Console'da şu filtreleri **aktif** tutun:
- ✅ **Info** (mavi loglar)
- ✅ **Warnings** (sarı loglar)
- ❌ **Errors** (kırmızı loglar - sadece test sırasında hata olursa açın)

### 3. Log Formatı
Logları toplarken şu formatta paylaşın:
```
[Log başlangıcı]
...log içeriği...
[Log bitişi]
```

---

## 🧪 Test Senaryoları

### ✅ Test 1: Timing Precision (Yüksek BPM)

**Hedef:** Schedule ahead time'ın timing precision üzerindeki etkisini ölçmek

**Adımlar:**

1. **Proje Hazırlığı:**
   ```
   - Yeni proje açın
   - BPM: 160 yapın
   - Bir enstrüman ekleyin (örnek: Kick)
   - Sequencer'da 16 nota ekleyin (her step'te bir nota)
   ```

2. **Console'u Hazırlayın:**
   - Console'u temizleyin
   - Console'da şu text'i arayın: `⏰ Processing` veya `▶️ Executing`

3. **Test Çalıştırın:**
   - **Play**'e basın
   - **10-15 saniye** çalıştırın (yaklaşık 2-3 loop)
   - **Stop**'a basın

4. **Logları Toplayın:**
   - Console'da **sağ tık → Save as...** ile kaydedin VEYA
   - Console'daki logları **seçip kopyalayın** (Ctrl+A, Ctrl+C)
   - İlk **20-30 satır** yeterli (çok fazla log varsa)

**Paylaşılacak Loglar:**
```javascript
// Test 1: Timing Precision (BPM: 160)
// Console'dan kopyaladığınız logları buraya yapıştırın:

⏰ Processing 1 events at 43.296s (currentTime: 43.296s)
  ▶️ Executing event: {type: 'noteOn', instrumentId: 'kick-1', note: {...}, step: 0, ...}
⏰ Processing 1 events at 43.796s (currentTime: 43.79600000000023s)
  ▶️ Executing event: {type: 'noteOn', instrumentId: 'kick-1', note: {...}, step: 4, ...}
...
```

**Gözlemler:**
- Notalar düzgün çalıyor mu? (Evet/Hayır)
- Timing hatası var mı? (Evet/Hayır - eğer varsa açıklayın)

---

### ✅ Test 2: Automation Smoothness

**Hedef:** Automation interval'ın smoothness üzerindeki etkisini ölçmek

**Adımlar:**

1. **Proje Hazırlığı:**
   ```
   - Bir mixer channel seçin
   - Piano Roll'u açın
   - Automation lane ekleyin (Volume)
   - 0'dan 1'e smooth bir curve çizin (64 step boyunca)
   ```

2. **Console'u Hazırlayın:**
   - Console'u temizleyin
   - Console'da şu text'i arayın: `🎛️` veya `📊` veya `automation`

3. **Test Çalıştırın:**
   - **Play**'e basın
   - Automation'ı **görsel olarak izleyin** (mixer channel'daki volume meter)
   - **10-15 saniye** çalıştırın
   - **Stop**'a basın

4. **Logları Toplayın:**
   - Automation ile ilgili loglar varsa kopyalayın
   - Eğer log yoksa, sadece gözlemleri paylaşın

**Paylaşılacak Loglar:**
```javascript
// Test 2: Automation Smoothness
// Console'dan kopyaladığınız logları buraya yapıştırın:
// (Eğer log yoksa, sadece gözlemleri paylaşın)

[Loglar buraya]
```

**Gözlemler:**
- Automation "steppy" görünüyor mu? (Evet/Hayır)
- Automation smooth mu? (Evet/Hayır)
- Kaç saniyede bir update oluyor? (Tahmin: XX ms)

---

### ✅ Test 3: Real-time Note Addition Latency

**Hedef:** Debounce time'ın real-time responsiveness üzerindeki etkisini ölçmek

**Adımlar:**

1. **Proje Hazırlığı:**
   ```
   - Bir pattern'e birkaç nota ekleyin
   - Sequencer'ı açık tutun
   ```

2. **Console'u Hazırlayın:**
   - Console'u temizleyin
   - Console'da şu text'i arayın: `🎵 Scheduling` veya `immediate`

3. **Test Çalıştırın:**
   - **Play**'e basın
   - **Play halindeyken** sequencer'dan **yeni bir nota ekleyin** (mouse ile tıklayın)
   - Nota ekleme zamanını ve çalma zamanını **gözlemleyin**
   - **Stop**'a basın

4. **Logları Toplayın:**
   - Nota ekleme ile ilgili logları kopyalayın
   - Eğer log yoksa, sadece gözlemleri paylaşın

**Paylaşılacak Loglar:**
```javascript
// Test 3: Real-time Note Addition Latency
// Console'dan kopyaladığınız logları buraya yapıştırın:
// (Eğer log yoksa, sadece gözlemleri paylaşın)

[Loglar buraya]
```

**Gözlemler:**
- Nota ekledikten sonra ne kadar süre sonra çaldı? (Tahmin: XX ms)
- Hızlı mı yoksa yavaş mı? (Hızlı/Yavaş)

---

### ✅ Test 4: CPU Usage

**Hedef:** Worker interval ve debounce time'ın CPU kullanımı üzerindeki etkisini ölçmek

**Adımlar:**

1. **Performance Tab'ını Hazırlayın:**
   - Chrome DevTools'da **Performance** tab'ını açın
   - **Record** butonuna hazır olun (kırmızı nokta)

2. **Test Çalıştırın:**
   - **Record** butonuna basın (kırmızı nokta başlar)
   - **Play**'e basın
   - **30 saniye** play yapın
   - **Stop**'a basın (hem playback hem recording)

3. **Metrikleri Toplayın:**
   - Performance tab'ında **Summary** bölümüne bakın
   - Şu metrikleri not edin:
     - **CPU Usage** (ortalama)
     - **Peak CPU Usage** (en yüksek)
     - **Main Thread** blocking time (varsa)

**Paylaşılacak Metrikler:**
```javascript
// Test 4: CPU Usage (30 saniye test)
// Performance tab'ından aldığınız metrikleri buraya yazın:

Average CPU Usage: XX%
Peak CPU Usage: XX%
Main Thread Blocking: XX ms (varsa)
```

**Not:** Eğer Performance tab'ı kullanmak zorsa, sadece gözlemleri paylaşın:
- CPU kullanımı yüksek mi? (Evet/Hayır)
- Sistem yavaşlıyor mu? (Evet/Hayır)

---

### ✅ Test 5: Event Count Scalability

**Hedef:** Event storage optimizasyonunun etkisini ölçmek

**Adımlar:**

1. **Proje Hazırlığı:**
   ```
   - Büyük bir pattern oluşturun:
     * 4 farklı enstrüman ekleyin
     * Her enstrümana 25 nota ekleyin (toplam 100 nota)
     * 64 step pattern
   ```

2. **Console'u Hazırlayın:**
   - Console'u temizleyin
   - Console'da şu text'i arayın: `🎵 Scheduling` veya `⏰ Processing`

3. **Test Çalıştırın:**
   - **Play**'e basın
   - **5-10 saniye** çalıştırın
   - **Stop**'a basın

4. **Logları Toplayın:**
   - Scheduling ile ilgili logları kopyalayın
   - Toplam nota sayısını ve event sayısını not edin

**Paylaşılacak Loglar:**
```javascript
// Test 5: Event Count Scalability
// Console'dan kopyaladığınız logları buraya yapıştırın:

🎵 Scheduling 100 notes for instrument kick-1
⏰ Processing 25 events at 43.296s
...
```

**Gözlemler:**
- Total Notes: XXX
- Total Events: XXX (tahmin)
- Scheduling hızlı mı yoksa yavaş mı? (Hızlı/Yavaş)

---

## 📊 Log Paylaşım Formatı

Logları topladıktan sonra şu formatta paylaşın:

```markdown
# Faz 1 - MEVCUT DURUM (BEFORE) Logları

## Test 1: Timing Precision (BPM: 160)
**Pattern:** 16 nota, 1 bar

### Console Logs:
```
[Test 1 loglarını buraya yapıştırın]
```

### Gözlemler:
- Notalar düzgün çalıyor mu: [Evet/Hayır]
- Timing hatası var mı: [Evet/Hayır]

---

## Test 2: Automation Smoothness
**Automation:** Volume, 0-1 smooth curve

### Console Logs:
```
[Test 2 loglarını buraya yapıştırın - yoksa "Log yok" yazın]
```

### Gözlemler:
- Steppy görünüm: [Evet/Hayır]
- Smooth mu: [Evet/Hayır]
- Update frequency: [Tahmin: XX ms]

---

## Test 3: Real-time Note Addition Latency
**Test:** Play halindeyken nota ekleme

### Console Logs:
```
[Test 3 loglarını buraya yapıştırın - yoksa "Log yok" yazın]
```

### Gözlemler:
- Latency: [Tahmin: XX ms]
- Hızlı/Yavaş: [Hızlı/Yavaş]

---

## Test 4: CPU Usage
**Test Süresi:** 30 saniye

### Performance Metrics:
- Average CPU Usage: XX%
- Peak CPU Usage: XX%
- Main Thread Blocking: XX ms (varsa)

VEYA

### Gözlemler:
- CPU kullanımı yüksek mi: [Evet/Hayır]
- Sistem yavaşlıyor mu: [Evet/Hayır]

---

## Test 5: Event Count Scalability
**Pattern:** 4 enstrüman, 100 nota, 64 step

### Console Logs:
```
[Test 5 loglarını buraya yapıştırın]
```

### Gözlemler:
- Total Notes: XXX
- Total Events: XXX (tahmin)
- Scheduling hızlı/Yavaş: [Hızlı/Yavaş]
```

---

## ⚡ Hızlı Test (Minimum)

Eğer tüm testleri yapmak çok zaman alıyorsa, **minimum** şu testleri yapın:

1. ✅ **Test 1: Timing Precision** (Zorunlu)
2. ✅ **Test 2: Automation Smoothness** (Gözlem yeterli, log gerekmez)
3. ✅ **Test 4: CPU Usage** (Gözlem yeterli, Performance tab gerekmez)

Bu 3 test yeterli olacaktır. Diğer testleri sonra yapabiliriz.

---

## 🎯 Önemli Notlar

1. **Log yoksa sorun değil:** Bazı testlerde log olmayabilir, sadece gözlemleri paylaşın
2. **Tahminler yeterli:** Kesin değerler gerekmez, tahminler yeterli
3. **Hızlı test yapın:** Her test 10-30 saniye sürmeli, çok uzun tutmayın
4. **Console'u temizleyin:** Her test öncesi console'u temizleyin

---

## ✅ Checklist

Testleri tamamladıktan sonra kontrol edin:

- [ ] Test 1: Timing Precision logları toplandı
- [ ] Test 2: Automation Smoothness gözlemleri yapıldı
- [ ] Test 3: Real-time Note Addition gözlemleri yapıldı
- [ ] Test 4: CPU Usage metrikleri/gözlemleri toplandı
- [ ] Test 5: Event Count Scalability logları toplandı
- [ ] Tüm loglar yukarıdaki formatta hazırlandı

---

**Hazırlayan:** AI Assistant  
**Tarih:** 2025-01-27  
**Durum:** Test Bekleniyor




