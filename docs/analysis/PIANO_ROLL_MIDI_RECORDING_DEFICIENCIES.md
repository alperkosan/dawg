# Piano Roll MIDI Recording & Keyboard Mapping Eksiklikleri

## 📋 Analiz Tarihi
2024 - Piano Roll v7 MIDI Recording ve Klavye Mapping İyileştirmeleri

---

## 🎯 Tespit Edilen Eksiklikler

### 1. Count-in (3-2-1 Geri Sayım) Eksiklikleri

#### Mevcut Durum:
- ✅ `MIDIRecorder.js`'de `startCountIn` metodu var
- ✅ `MIDIRecordingPanel.jsx`'te count-in ayarı var (0-4 bar)
- ❌ **Görsel geri sayım yok** (3-2-1 sayısı gösterilmiyor)
- ❌ **Metronome sesi/klik sesi yok**
- ❌ **Count-in sırasında görsel feedback yok**

#### Standart DAW Davranışı:
- FL Studio: 3-2-1 görsel geri sayım + metronome klik sesi
- Ableton Live: 1 bar count-in + metronome
- Logic Pro: 1-2-3-4 görsel geri sayım + metronome

#### Gereken İyileştirmeler:
1. **Görsel Geri Sayım UI**
   - Büyük, merkezi sayı gösterimi (3 → 2 → 1 → GO!)
   - Animasyonlu geçişler
   - Count-in sırasında piano roll'u overlay ile kaplama

2. **Metronome Sesi**
   - Count-in sırasında metronome klik sesi
   - BPM'e göre senkronize
   - Son klik'te farklı ton (GO!)

3. **Görsel Feedback**
   - Count-in sırasında record butonu yanıp sönme
   - Timeline'da count-in bölgesi vurgulama

---

### 2. MIDI Record/Stop Eksiklikleri

#### Mevcut Durum:
- ✅ `MIDIRecordingPanel` component'i var
- ✅ Record/Stop butonları var
- ❌ **Toolbar'da record butonu yok**
- ❌ **Klavye kısayolları yok** (R = Record, Space = Stop)
- ❌ **Record durumu görsel feedback'i yetersiz**
- ❌ **Record sırasında timeline'da görsel işaret yok**

#### Standart DAW Kısayolları:
- **R** = Record (Toggle)
- **Space** = Play/Pause (Record sırasında Stop)
- **Ctrl/Cmd + R** = Record (Bazı DAW'larda)

#### Gereken İyileştirmeler:
1. **Toolbar'a Record Butonu**
   - Toolbar.jsx'e record butonu ekle
   - Record durumunda kırmızı yanıp sönme
   - Tooltip: "Record (R)"

2. **Klavye Kısayolları**
   - **R** tuşu: Record toggle
   - **Space** tuşu: Record sırasında Stop
   - Kısayollar sadece piano roll focus'ta çalışmalı

3. **Görsel Feedback**
   - Record sırasında timeline'da kırmızı çizgi
   - Record edilen notaların real-time görselleştirilmesi
   - Record butonu animasyonu

---

### 3. Klavye Mapping (C4-C7) Eksiklikleri

#### Mevcut Durum:
- ✅ `useNoteInteractionsV2.js`'de `KEYBOARD_TO_PITCH` mapping var
- ❌ **C4-C7 aralığı tam kapsanmıyor**
- ❌ **Standart DAW mapping'i kullanılmıyor**
- ❌ **Mapping karışık ve tutarsız**

#### Standart DAW Klavye Mapping (C4-C7):
```
C4 (60) - C7 (96) = 4 oktav = 48 nota

OCTAVE 1: C4-B4 (60-71) - 12 nota
  White Keys: Z X C V B N M , . / 
  Black Keys: S D G H J

OCTAVE 2: C5-B5 (72-83) - 12 nota
  White Keys: A S D F G H J K L ; '
  Black Keys: W E T Y U O P

OCTAVE 3: C6-B6 (84-95) - 12 nota
  White Keys: Q W E R T Y U I O P [ ]
  Black Keys: 2 3 5 6 7 9 0 - =

OCTAVE 4: C7-B7 (96-107) - 12 nota
  White Keys: 1 2 3 4 5 6 7 8 9 0 - =
  Black Keys: Tab ` ~ ! @ # $ % ^ & * ( )
```

#### FL Studio / Ableton Standart Mapping:
```
C4-B4 (60-71):
  White: Z X C V B N M , . / 
  Black: S D G H J

C5-B5 (72-83):
  White: A S D F G H J K L ; '
  Black: W E T Y U O P

C6-B6 (84-95):
  White: Q W E R T Y U I O P [ ]
  Black: 2 3 5 6 7 9 0 - =

C7-B7 (96-107):
  White: 1 2 3 4 5 6 7 8 9 0 - =
  Black: Tab ` ~ ! @ # $ % ^ & * ( )
```

#### Mevcut Mapping Sorunları:
1. **C4-C7 aralığı tam kapsanmıyor**
   - Bazı notalar eksik
   - Oktav geçişleri tutarsız

2. **Standart mapping kullanılmıyor**
   - FL Studio/Ableton mapping'i farklı
   - Kullanıcılar alışkın oldukları mapping'i bekliyor

3. **Siyah tuşlar yanlış konumlandırılmış**
   - Siyah tuşlar beyaz tuşların arasında olmalı
   - Fiziksel piyano düzenine uygun olmalı

#### Gereken İyileştirmeler:
1. **Standart DAW Mapping'i Uygula**
   - FL Studio/Ableton mapping'ini referans al
   - C4-C7 aralığını tam kapsa
   - Oktav geçişlerini düzelt

2. **Mapping Ayarlanabilir Olsun**
   - Kullanıcı mapping'i özelleştirebilsin
   - Preset mapping'ler (FL Studio, Ableton, Logic Pro)

3. **Oktav Shift Tuşları**
   - **Z** / **X**: Oktav aşağı/yukarı
   - Veya **Ctrl/Cmd + Up/Down**: Oktav shift

---

## 📊 Öncelik Sıralaması

### Yüksek Öncelik:
1. ✅ **Klavye Mapping'i Standart DAW Mapping'ine Çevir** (C4-C7 tam kapsama)
2. ✅ **Toolbar'a Record Butonu Ekle**
3. ✅ **Record/Stop Klavye Kısayolları** (R, Space)

### Orta Öncelik:
4. ✅ **Count-in Görsel Geri Sayım** (3-2-1)
5. ✅ **Count-in Metronome Sesi**
6. ✅ **Record Sırasında Görsel Feedback**

### Düşük Öncelik:
7. ✅ **Mapping Özelleştirme** (Kullanıcı mapping'i değiştirebilir)
8. ✅ **Oktav Shift Tuşları**

---

## 🔧 Uygulama Planı

### Faz 1: Klavye Mapping Düzeltmesi
- [ ] Standart DAW mapping'ini araştır ve doğrula
- [ ] `KEYBOARD_TO_PITCH` mapping'ini C4-C7 için güncelle
- [ ] Oktav geçişlerini düzelt
- [ ] Test et ve doğrula

### Faz 2: Record/Stop İyileştirmeleri
- [ ] Toolbar'a record butonu ekle
- [ ] R tuşu kısayolu ekle
- [ ] Space tuşu (record sırasında stop) ekle
- [ ] Record durumu görsel feedback'i iyileştir

### Faz 3: Count-in İyileştirmeleri
- [ ] Görsel geri sayım UI component'i oluştur
- [ ] Metronome sesi ekle
- [ ] Count-in animasyonları
- [ ] Timeline'da count-in görselleştirme

---

## 📝 Notlar

- Standart DAW mapping'leri genellikle FL Studio ve Ableton Live'ı referans alır
- C4-C7 aralığı 4 oktav = 48 nota
- Mapping fiziksel piyano düzenine uygun olmalı (siyah tuşlar arasında)
- Oktav shift özelliği kullanıcı deneyimini önemli ölçüde iyileştirir






