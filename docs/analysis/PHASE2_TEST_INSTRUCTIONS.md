# Faz 2 Test Talimatları - MEVCUT DURUM (BEFORE)

## 🎯 Amaç

Faz 2 geliştirmelerinden ÖNCE mevcut durumun loglarını toplamak. Bu loglar, iyileştirmelerin etkisini ölçmek için referans olacak.

**Faz 2 Geliştirmeleri:**
1. Event Storage Optimizasyonu (Priority Queue)
2. Event Batching
3. Automation Interpolation

---

## ⚠️ ÖNEMLİ: Bu adımı tamamlamadan Faz 2'ye geçmeyin!

---

## 📋 Test Senaryoları

### Senaryo 1: Event Count Scalability Test (BEFORE)
**Hedef:** Event storage optimizasyonunun etkisini ölçmek

**Hazırlık:**
1. Büyük bir pattern oluşturun:
   - 4-6 farklı enstrüman ekleyin
   - Her enstrümana **30-40 nota** ekleyin (toplam 150-200 nota)
   - 64 step pattern
2. Chrome DevTools Console'u açın (F12)
3. Performance tab'ını açın (hazır olun)

**Test:**
1. **Record** butonuna basın (Performance tab)
2. **Play**'e basın
3. **10-15 saniye** çalıştırın
4. **Stop**'a basın (hem playback hem recording)
5. Console'da şu logları **kopyalayın**:
   - `🎵 Scheduling X notes`
   - `⏰ Processing X events`
   - Performance timing logs (varsa)

**Performance Tab Metrikleri:**
- **Summary** bölümünden:
  - Total Duration
  - Scripting time
  - Rendering time
  - Painting time
- **Bottom-Up** veya **Call Tree**'den:
  - `scheduleEvent` fonksiyonunun toplam süresi
  - `processScheduledEvents` fonksiyonunun toplam süresi

**Toplanacak Loglar:**
```javascript
// Test 1: Event Count Scalability (BEFORE)
// Console'dan kopyaladığınız logları buraya yapıştırın:

🎵 Scheduling 150 notes for instrument...
⏰ Processing 25 events at...
...
```

**Performance Metrikleri:**
- Total Duration: XX ms
- Scripting time: XX ms
- scheduleEvent total time: XX ms
- processScheduledEvents total time: XX ms

---

### Senaryo 2: Event Batching Test (BEFORE)
**Hedef:** Event batching'in etkisini ölçmek

**Hazırlık:**
1. Bir pattern'e **50+ nota** ekleyin (aynı anda çalacak şekilde)
2. Chrome DevTools Console'u açın
3. Performance tab'ını açın

**Test:**
1. **Record** butonuna basın
2. **Play**'e basın
3. **5-10 saniye** çalıştırın
4. **Stop**'a basın

**Performance Tab Metrikleri:**
- **Call Tree**'den:
  - `scheduleEvent` çağrı sayısı
  - `scheduleEvent` toplam süresi
  - Ortalama `scheduleEvent` süresi

**Toplanacak Metrikler:**
- scheduleEvent call count: XXX
- scheduleEvent total time: XX ms
- scheduleEvent average time: XX ms

---

### Senaryo 3: Automation Smoothness Test (BEFORE)
**Hedef:** Automation interpolation'ın etkisini ölçmek

**Hazırlık:**
1. Bir mixer channel seçin
2. Piano Roll'u açın
3. Automation lane ekleyin (Volume)
4. 0'dan 1'e **smooth bir curve** çizin (64 step boyunca)
5. Chrome DevTools Console'u açın

**Test:**
1. **Play**'e basın
2. Automation'ı **görsel olarak izleyin** (mixer channel'daki volume meter)
3. **10-15 saniye** çalıştırın
4. **Stop**'a basın

**Gözlem:**
- Automation "steppy" görünüyor mu? (Evet/Hayır)
- Kaç saniyede bir update oluyor? (Tahmin: XX ms)
- Smooth mu? (Evet/Hayır)

**Toplanacak Loglar:**
```javascript
// Test 3: Automation Smoothness (BEFORE)
// Console'dan kopyaladığınız logları buraya yapıştırın:
// (Eğer log yoksa, sadece gözlemleri paylaşın)

[Loglar buraya]
```

**Gözlemler:**
- Steppy görünüm: [Evet/Hayır]
- Smooth mu: [Evet/Hayır]
- Update frequency: [Tahmin: XX ms]

---

### Senaryo 4: CPU Usage Test (BEFORE)
**Hedef:** Event storage ve batching'in CPU kullanımı üzerindeki etkisini ölçmek

**Hazırlık:**
1. Chrome DevTools **Performance** tab'ını açın
2. **Record** butonuna hazır olun

**Test:**
1. Büyük pattern'i açın (150-200 nota)
2. **Record** butonuna basın
3. **Play**'e basın
4. **30 saniye** play yapın
5. **Stop**'a basın (hem playback hem recording)

**Performance Tab Metrikleri:**
- **Summary** bölümünden:
  - Average CPU Usage: XX%
  - Peak CPU Usage: XX%
  - Main Thread Blocking: XX ms

**Toplanacak Metrikler:**
- Average CPU Usage: XX%
- Peak CPU Usage: XX%
- Main Thread Blocking: XX ms

---

## 📊 Log Paylaşım Formatı

Logları topladıktan sonra şu formatta paylaşın:

```markdown
# Faz 2 - MEVCUT DURUM (BEFORE) Logları

## Senaryo 1: Event Count Scalability
**Pattern:** X enstrüman, XXX nota, 64 step

### Console Logs:
```
[Console loglarını buraya yapıştırın]
```

### Performance Metrikleri:
- Total Duration: XX ms
- Scripting time: XX ms
- scheduleEvent total time: XX ms
- processScheduledEvents total time: XX ms

---

## Senaryo 2: Event Batching
**Pattern:** 50+ nota, aynı anda çalacak şekilde

### Performance Metrikleri:
- scheduleEvent call count: XXX
- scheduleEvent total time: XX ms
- scheduleEvent average time: XX ms

---

## Senaryo 3: Automation Smoothness
**Automation:** Volume, 0-1 smooth curve

### Console Logs:
```
[Console loglarını buraya yapıştırın - yoksa "Log yok" yazın]
```

### Gözlemler:
- Steppy görünüm: [Evet/Hayır]
- Smooth mu: [Evet/Hayır]
- Update frequency: [Tahmin: XX ms]

---

## Senaryo 4: CPU Usage
**Test Süresi:** 30 saniye
**Pattern:** Büyük pattern (150-200 nota)

### Performance Metrikleri:
- Average CPU Usage: XX%
- Peak CPU Usage: XX%
- Main Thread Blocking: XX ms
```

---

## ⚡ Hızlı Test (Minimum)

Eğer tüm testleri yapmak çok zaman alıyorsa, **minimum** şu testleri yapın:

1. ✅ **Senaryo 1: Event Count Scalability** (Zorunlu)
   - Büyük pattern (150+ nota)
   - Performance tab ile metrikler

2. ✅ **Senaryo 3: Automation Smoothness** (Gözlem yeterli)
   - Automation smoothness gözlemi

Bu 2 test yeterli olacaktır. Diğer testleri sonra yapabiliriz.

---

## ✅ Checklist

Testleri tamamladıktan sonra kontrol edin:

- [ ] Senaryo 1: Event Count Scalability logları ve metrikleri toplandı
- [ ] Senaryo 2: Event Batching metrikleri toplandı (opsiyonel)
- [ ] Senaryo 3: Automation Smoothness gözlemleri yapıldı
- [ ] Senaryo 4: CPU Usage metrikleri toplandı (opsiyonel)
- [ ] Tüm loglar yukarıdaki formatta hazırlandı

---

## 🎯 Önemli Notlar

1. **Performance Tab Kullanımı:**
   - Record butonuna basın
   - Test çalıştırın
   - Stop'a basın
   - Summary ve Call Tree'den metrikleri alın

2. **Console Logları:**
   - Eğer log yoksa sorun değil, sadece gözlemleri paylaşın

3. **Tahminler Yeterli:**
   - Kesin değerler gerekmez, tahminler yeterli

4. **Hızlı Test:**
   - Her test 10-30 saniye sürmeli

---

**Hazırlayan:** AI Assistant  
**Tarih:** 2025-01-27  
**Durum:** Faz 2 Test Bekleniyor

