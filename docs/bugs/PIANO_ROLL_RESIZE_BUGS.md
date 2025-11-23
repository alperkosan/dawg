# Piano Roll Resize Bug Analysis

## Tespit Edilen Bug'lar

### BUG 1: Closure Sorunu - notes Güncel Değil ⚠️ KRİTİK

**Sorun:**
- `finalizeResize` içinde `updateNoteFn` oluşturulurken `notes` closure'dan geliyor
- Eğer resize sırasında notes değişirse (başka bir işlem), eski notes kullanılıyor
- Bu, notaların kaybolmasına veya yanlış güncellenmesine neden olabilir

**Kod:**
```javascript
// useNoteInteractionsV3.js:1152
const updateNoteFn = (id, state) => {
    const finalNotes = notes.map(n =>  // ❌ notes closure'dan geliyor, güncel olmayabilir
        n.id === id ? { ...n, ...state } : n
    );
    updatePatternNotes(activePatternId, currentInstrument.id, finalNotes);
};
```

**Etki:**
- Resize sırasında notes değişirse, eski notes kullanılıyor
- Notalar kaybolabilir veya yanlış güncellenebilir

**Çözüm:**
- `updateNoteFn` içinde store'dan güncel notes'u al
- Veya `updatePatternNotes` içinde güncel notes'u kullan

---

### BUG 2: Batch Command'da currentNotesRef Güncel Değil ⚠️ KRİTİK

**Sorun:**
- `currentNotesRef` resize başladığında capture ediliyor
- Eğer resize sırasında notes değişirse, `currentNotesRef` güncel olmayabilir
- Undo/redo sırasında yanlış notes kullanılabilir

**Kod:**
```javascript
// useNoteInteractionsV3.js:1198
let currentNotesRef = notes; // ❌ Capture ediliyor, güncel olmayabilir

const updateAllNotesFn = (statesToApply) => {
    const finalNotes = currentNotesRef.map(n => {  // ❌ Güncel olmayabilir
        const state = statesToApply.get(n.id);
        if (state) {
            return { ...n, ...state };
        }
        return n;
    });
    // ...
    currentNotesRef = finalNotes; // ✅ Güncelleniyor ama ilk çağrıda sorun var
};
```

**Etki:**
- Resize sırasında notes değişirse, eski notes kullanılıyor
- Notalar kaybolabilir

**Çözüm:**
- `updateAllNotesFn` içinde store'dan güncel notes'u al
- Veya her çağrıda güncel notes'u parametre olarak geç

---

### BUG 3: originals Map'inde Note Yoksa Note Güncellenmiyor ⚠️ ORTA

**Sorun:**
- `finalizeResize` içinde `originals.get(note.id)` yoksa, note güncellenmiyor
- Bu durumda note kaybolmuyor ama resize edilmiyor
- Bu bir sorun olabilir çünkü kullanıcı resize yapmış ama note değişmemiş

**Kod:**
```javascript
// useNoteInteractionsV3.js:1084
const orig = originals.get(note.id);
if (!orig) return note; // ❌ Note güncellenmiyor ama kaybolmuyor
```

**Etki:**
- Resize başladığında note `originals` map'ine eklenmemişse, resize edilmiyor
- Kullanıcı resize yapmış ama note değişmemiş

**Çözüm:**
- `originals` map'ine note eklenmemişse, hata logla veya note'u ekle
- Veya resize başladığında tüm seçili notaları `originals` map'ine ekle

---

### BUG 4: updatePatternNotes İçinde Notes Array'i Tamamen Değiştiriliyor ⚠️ ORTA

**Sorun:**
- `updatePatternNotes` direkt olarak yeni notes array'ini alıyor
- Eğer yeni array'de bazı notalar eksikse, notalar kaybolabilir
- Store'daki mevcut notes ile merge edilmiyor

**Kod:**
```javascript
// useArrangementStore.js:231
updatePatternNotes: (patternId, instrumentId, newNotes) => {
    set(state => {
        const newPatterns = { ...state.patterns };
        const targetPattern = newPatterns[patternId];
        if (targetPattern) {
            const newData = { ...targetPattern.data, [instrumentId]: newNotes };
            // ❌ newNotes direkt olarak kullanılıyor, merge edilmiyor
            newPatterns[patternId] = { ...targetPattern, data: newData };
            return { patterns: newPatterns };
        }
        return state;
    });
}
```

**Etki:**
- Eğer `newNotes` array'inde bazı notalar eksikse, notalar kaybolabilir
- Store'daki mevcut notes ile merge edilmiyor

**Çözüm:**
- `updatePatternNotes` içinde mevcut notes ile merge et
- Veya sadece güncellenen notaları gönder, store'da merge et

---

### BUG 5: Hit Point Resize - Hit Point Nedir? ⚠️ BİLİNMİYOR

**Sorun:**
- Kullanıcı "hit point resize" dedi
- "Hit point" terimi kodda bulunamadı
- Belki "resize handle" demek istiyor (left/right handle)

**Araştırma:**
- Kodda "hit point" terimi yok
- "resize handle" terimi var (left/right)
- Belki kullanıcı resize handle'dan bahsediyor

**Çözüm:**
- Kullanıcıya sorulmalı: "Hit point" nedir?
- Veya resize handle sorunlarını düzelt

---

## Öncelik Sırası

1. **BUG 1 (KRİTİK)**: Closure sorunu - notes güncel değil
2. **BUG 2 (KRİTİK)**: Batch command'da currentNotesRef güncel değil
3. **BUG 3 (ORTA)**: originals map'inde note yoksa note güncellenmiyor
4. **BUG 4 (ORTA)**: updatePatternNotes içinde notes array'i tamamen değiştiriliyor
5. **BUG 5 (BİLİNMİYOR)**: Hit point resize - hit point nedir?

