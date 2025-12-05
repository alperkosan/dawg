# Scheduling System - Test Logger Rehberi

## 📋 Amaç

Bu doküman, scheduling sisteminin performansını ölçmek ve iyileştirmeleri karşılaştırmak için test loglarını nasıl toplayacağınızı açıklar.

---

## 🧪 Test Senaryoları

### Senaryo 1: Timing Precision Test (Yüksek BPM)
**Amaç:** Schedule ahead time'ın timing precision üzerindeki etkisini ölçmek

**Adımlar:**
1. BPM'i 160+ yapın
2. Bir pattern'e 16 nota ekleyin (her step'te bir nota)
3. Play'e basın ve 5-10 loop çalıştırın
4. Console'da şu logları arayın:
   - `⏰ Processing X events at Ys`
   - `▶️ Executing event: {type: 'noteOn', ...}`
   - Timing farkları (scheduled time vs actual time)

**Toplanacak Loglar:**
```javascript
// Console'dan kopyalayın:
// 1. Event scheduling times
// 2. Event execution times
// 3. Timing differences
// 4. Audio dropout warnings (varsa)
```

---

### Senaryo 2: Automation Smoothness Test
**Amaç:** Automation interval'ın smoothness üzerindeki etkisini ölçmek

**Adımlar:**
1. Bir mixer channel'a automation ekleyin (volume)
2. 0'dan 1'e smooth bir curve çizin
3. Play'e basın ve automation'ı izleyin
4. Console'da şu logları arayın:
   - `🎛️ Automation update:`
   - `📊 Automation value:`

**Toplanacak Loglar:**
```javascript
// Console'dan kopyalayın:
// 1. Automation update intervals
// 2. Automation value changes
// 3. Steppy görünüm var mı? (görsel gözlem)
```

---

### Senaryo 3: Real-time Note Addition Latency
**Amaç:** Debounce time'ın real-time responsiveness üzerindeki etkisini ölçmek

**Adımlar:**
1. Play halindeyken sequencer'dan nota ekleyin
2. Nota ekleme zamanını ve çalma zamanını ölçün
3. Console'da şu logları arayın:
   - `🎵 Scheduling new note immediately`
   - `▶️ Executing event: {type: 'noteOn', ...}`

**Toplanacak Loglar:**
```javascript
// Console'dan kopyalayın:
// 1. Note addition timestamp
// 2. Note scheduling timestamp
// 3. Note execution timestamp
// 4. Latency hesaplaması
```

---

### Senaryo 4: CPU Usage Test
**Amaç:** Worker interval ve debounce time'ın CPU kullanımı üzerindeki etkisini ölçmek

**Adımlar:**
1. Chrome DevTools Performance tab'ını açın
2. Recording başlatın
3. 30 saniye play yapın
4. Recording'i durdurun
5. CPU usage'ı analiz edin

**Toplanacak Metrikler:**
- Average CPU usage (%)
- Peak CPU usage (%)
- Main thread blocking time
- Worker thread usage

---

### Senaryo 5: Event Count Scalability Test
**Amaç:** Event storage optimizasyonunun etkisini ölçmek

**Adımlar:**
1. Büyük bir pattern oluşturun (100+ nota)
2. Play'e basın
3. Console'da şu logları arayın:
   - `🎵 Scheduling X notes`
   - `⏰ Processing X events`
   - Performance timing logs

**Toplanacak Loglar:**
```javascript
// Console'dan kopyalayın:
// 1. Total event count
// 2. Scheduling duration
// 3. Event processing time
// 4. Memory usage (Chrome DevTools)
```

---

## 📊 Log Formatı

### Mevcut Durum Logları (BEFORE)
```markdown
## Test: [Test Adı]
**Tarih:** YYYY-MM-DD HH:MM:SS
**BPM:** XXX
**Pattern:** [Açıklama]

### Console Logs:
[Console loglarını buraya yapıştırın]

### Performance Metrics:
- CPU Usage: XX%
- Memory Usage: XX MB
- Scheduling Duration: XX ms
- Event Count: XXX

### Gözlemler:
- [Gözlemlerinizi buraya yazın]
```

### Gelişmiş Durum Logları (AFTER)
```markdown
## Test: [Test Adı]
**Tarih:** YYYY-MM-DD HH:MM:SS
**BPM:** XXX
**Pattern:** [Açıklama]
**Faz:** [Faz Numarası]

### Console Logs:
[Console loglarını buraya yapıştırın]

### Performance Metrics:
- CPU Usage: XX%
- Memory Usage: XX MB
- Scheduling Duration: XX ms
- Event Count: XXX

### Gözlemler:
- [Gözlemlerinizi buraya yazın]

### İyileştirmeler:
- [Farkları buraya yazın]
```

---

## 🔍 Log Toplama Araçları

### 1. Console Log Filtering
Chrome DevTools Console'da şu filtreleri kullanın:
- `⏰` - Transport timing logs
- `🎵` - Note scheduling logs
- `🎛️` - Automation logs
- `📊` - Performance logs

### 2. Performance Profiling
Chrome DevTools Performance tab:
1. Record butonuna basın
2. Test senaryosunu çalıştırın
3. Stop'a basın
4. Summary'den metrikleri alın

### 3. Memory Profiling
Chrome DevTools Memory tab:
1. Heap snapshot alın (before)
2. Test senaryosunu çalıştırın
3. Heap snapshot alın (after)
4. Comparison yapın

---

## 📝 Log Paylaşım Formatı

Logları paylaşırken şu formatta gönderin:

```markdown
# [Test Senaryosu Adı] - [BEFORE/AFTER]

## Test Bilgileri
- **Tarih:** YYYY-MM-DD HH:MM:SS
- **BPM:** XXX
- **Pattern:** [Açıklama]
- **Faz:** [Faz Numarası veya "BEFORE"]

## Console Logs
```
[Console loglarını buraya yapıştırın]
```

## Performance Metrics
- CPU Usage: XX%
- Memory Usage: XX MB
- Scheduling Duration: XX ms
- Event Count: XXX

## Gözlemler
[Gözlemlerinizi buraya yazın]
```

---

## ✅ Test Checklist

Her faz öncesi:
- [ ] Senaryo 1: Timing Precision Test (Yüksek BPM) - BEFORE
- [ ] Senaryo 2: Automation Smoothness Test - BEFORE
- [ ] Senaryo 3: Real-time Note Addition Latency - BEFORE
- [ ] Senaryo 4: CPU Usage Test - BEFORE
- [ ] Senaryo 5: Event Count Scalability Test - BEFORE

Her faz sonrası:
- [ ] Senaryo 1: Timing Precision Test (Yüksek BPM) - AFTER
- [ ] Senaryo 2: Automation Smoothness Test - AFTER
- [ ] Senaryo 3: Real-time Note Addition Latency - AFTER
- [ ] Senaryo 4: CPU Usage Test - AFTER
- [ ] Senaryo 5: Event Count Scalability Test - AFTER

---

## 🎯 Karşılaştırma Kriterleri

### Timing Precision
- **Hedef:** < 5ms timing error
- **Ölçüm:** Scheduled time vs actual execution time

### Automation Smoothness
- **Hedef:** Steppy görünüm yok
- **Ölçüm:** Visual inspection + update frequency

### Real-time Latency
- **Hedef:** < 20ms note addition latency
- **Ölçüm:** Note addition time - note execution time

### CPU Usage
- **Hedef:** %20'den fazla artış yok
- **Ölçüm:** Average CPU usage comparison

### Scalability
- **Hedef:** 1000+ event'te < 5ms overhead
- **Ölçüm:** Scheduling duration / event count

---

**Hazırlayan:** AI Assistant  
**Tarih:** 2025-01-27  
**Versiyon:** 1.0






