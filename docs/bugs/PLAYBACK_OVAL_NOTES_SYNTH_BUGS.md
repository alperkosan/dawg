# Playback Oval Notes & Synth Parameter Bugs

## Tespit Edilen Bug'lar

### BUG 1: Duration Parametresi VASynth.noteOn'a Geçilmiyor ⚠️ KRİTİK

**Sorun:**
- `PlaybackManager._scheduleInstrumentNotes` içinde `triggerNote` çağrısında `noteDuration` parametresi geçiliyor
- `BaseInstrument.triggerNote` metodunda `duration` parametresi alınıyor ama `noteOn` metoduna geçilmiyor
- `VASynthInstrument.noteOn` metodunda `duration` parametresi yok
- `VASynth.noteOn` metodunda `duration` parametresi yok

**Etki:**
- Notaların süresi `triggerNote`'a geçiliyor ama `VASynth` voice'larına ulaşmıyor
- Note off eventi schedule ediliyor ama voice'lar duration'ı bilmiyor
- Bu, envelope release timing'ini etkileyebilir

**Kod:**
```javascript
// PlaybackManager.js:1680
instrument.triggerNote(
    note.pitch || 'C4',
    note.velocity || 1,
    scheduledTime,
    noteDuration,  // ✅ Geçiliyor
    hasExtendedParams ? extendedParams : null
);

// BaseInstrument.js:131
this.noteOn(midiNote, midiVelocity, startTime, extendedParams);
// ❌ duration parametresi geçilmiyor!

// VASynthInstrument.js:240
voice.noteOn(midiNote, velocity, time, extendedParams);
// ❌ duration parametresi yok!
```

**Çözüm:**
1. `BaseInstrument.noteOn` metoduna `duration` parametresi ekle
2. `VASynthInstrument.noteOn` metoduna `duration` parametresi ekle
3. `VASynth.noteOn` metoduna `duration` parametresi ekle
4. Duration'ı voice'a geçir (envelope release timing için)

---

### BUG 2: Oval Notalar İçin visualLength Kontrolü Eksik ⚠️ ORTA

**Sorun:**
- Oval notalar `visualLength: 1` ama `length: patternLength` olarak saklanıyor
- PlaybackManager'da sadece `note.length` kullanılıyor, `visualLength` kontrol edilmiyor
- Bu teknik olarak doğru (audio uzunluğu `length` ile belirleniyor) ama:
  - Eğer bir nota `visualLength: 1` ama `length: undefined` ise, fallback 1 step oluyor
  - Bu durumda oval notalar yanlış sürede çalabilir

**Etki:**
- Eğer bir nota `visualLength: 1` ama `length` undefined ise, 1 step olarak çalıyor
- Oval notalar pattern sonuna kadar çalmalı ama çalmıyor

**Kod:**
```javascript
// PlaybackManager.js:1487
if (typeof note.length === 'number') {
    noteDuration = this.transport.stepsToSeconds(note.length);
} else if (note.duration) {
    // ...
} else {
    noteDuration = this.transport.stepsToSeconds(1); // ❌ Fallback 1 step
}
// ❌ visualLength kontrol edilmiyor!
```

**Çözüm:**
- Eğer `note.length` undefined ama `note.visualLength` varsa, pattern length'e kadar extend et
- Veya oval notalar için özel kontrol ekle

---

### BUG 3: BaseInstrument.triggerNote Duration Kullanmıyor ⚠️ ORTA

**Sorun:**
- `BaseInstrument.triggerNote` metodunda `duration` parametresi alınıyor
- Ama sadece `activeNotes` map'ine kaydediliyor, `noteOn` metoduna geçilmiyor
- Bu, sample-based enstrümanlar için sorun olmayabilir ama synth'ler için sorun

**Etki:**
- Duration bilgisi kayboluyor
- Note off eventi schedule ediliyor ama voice'lar duration'ı bilmiyor

**Kod:**
```javascript
// BaseInstrument.js:131
this.noteOn(midiNote, midiVelocity, startTime, extendedParams);
// ❌ duration geçilmiyor

// BaseInstrument.js:134
if (duration && duration > 0) {
    this.activeNotes.set(midiNote, { startTime, duration, pitch, extendedParams });
}
// ✅ Sadece map'e kaydediliyor, noteOn'a geçilmiyor
```

**Çözüm:**
- `noteOn` metoduna `duration` parametresi ekle
- Veya `extendedParams` içine `duration` ekle

---

### BUG 4: Synth Parametreleri Playback Sırasında Güncellenmiyor Olabilir ⚠️ DÜŞÜK

**Sorun:**
- `updateParameters` metodu var ve aktif voice'ları güncelliyor
- Ama playback sırasında parametre değişiklikleri doğru şekilde uygulanıyor mu?
- Yeni oluşturulan voice'lar preset'ten yükleniyor ama playback sırasında parametre değişikliği olursa?

**Etki:**
- Playback sırasında parametre değişiklikleri aktif notalara uygulanmıyor olabilir
- Yeni notalar eski parametrelerle çalıyor olabilir

**Kod:**
```javascript
// VASynthInstrument.js:224
const voice = new VASynth(this.audioContext);
voice.loadPreset(this.preset); // ✅ Preset'ten yükleniyor
// Ama playback sırasında preset güncellenirse?
```

**Çözüm:**
- Playback sırasında parametre değişikliklerini kontrol et
- Yeni voice'lar oluşturulurken güncel preset'i kullan

---

## Öncelik Sırası

1. **BUG 1 (KRİTİK)**: Duration parametresi voice'lara geçilmiyor
2. **BUG 2 (ORTA)**: Oval notalar için visualLength kontrolü eksik
3. **BUG 3 (ORTA)**: BaseInstrument.triggerNote duration kullanmıyor
4. **BUG 4 (DÜŞÜK)**: Synth parametreleri playback sırasında güncellenmiyor olabilir

