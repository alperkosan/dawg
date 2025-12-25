# 🐛 UX Event Conflict Analysis

**Tarih:** 2025-01-XX  
**Durum:** Tespit edilen potansiyel sorunlar

---

## ✅ Düzeltilen Sorunlar

### 1. Alt + Wheel Scroll Conflict (DÜZELTİLDİ ✅)
**Sorun:** Alt + wheel ile velocity değiştirirken Y ekseninde scroll tetikleniyordu.

**Çözüm:**
- `PianoRoll.jsx`: Alt kontrolü eklendi, capture phase kullanıldı
- `usePianoRollEngine.js`: Alt kontrolü eklendi

**Dosyalar:**
- `client/src/features/piano_roll_v7/PianoRoll.jsx` (lines 1753-1759, 1784)
- `client/src/features/piano_roll_v7/usePianoRollEngine.js` (lines 116-121)

---

## ⚠️ Tespit Edilen Potansiyel Sorunlar

### 1. Ctrl + Alt + Wheel Conflict
**Sorun:** Ctrl + Alt + wheel yapıldığında, Alt kontrolü önce çalışıyor ve zoom yapılmıyor.

**Mevcut Durum:**
- `usePianoRollEngine.js`: Alt kontrolü Ctrl kontrolünden önce (line 117)
- `PianoRoll.jsx`: Alt kontrolü Ctrl kontrolünden önce (line 1755)

**Beklenen Davranış:**
- Ctrl + wheel → Zoom
- Alt + wheel → Velocity
- Ctrl + Alt + wheel → Hangisi öncelikli olmalı? (Genelde Ctrl öncelikli olur)

**Öneri:** Ctrl kontrolünü Alt kontrolünden önce yapmak veya Ctrl + Alt durumunda Ctrl'ü önceliklendirmek.

**Dosyalar:**
- `client/src/features/piano_roll_v7/usePianoRollEngine.js` (line 115-127)
- `client/src/features/piano_roll_v7/PianoRoll.jsx` (line 1739-1782)

---

### 2. Shift + Wheel (Duration) Eksik
**Sorun:** `useNoteInteractionsV3`'te Shift + wheel ile duration değiştirme özelliği yok. `useNoteInteractionsV2`'de vardı ama deprecated.

**Mevcut Durum:**
- `useNoteInteractionsV3`: Sadece Alt + wheel (velocity) var
- `useNoteInteractionsV2`: Shift + wheel (duration) var ama deprecated

**Beklenen Davranış:**
- Shift + wheel → Duration değiştirme (hovered/selected notes)

**Öneri:** `useNoteInteractionsV3`'e Shift + wheel desteği eklemek.

**Dosyalar:**
- `client/src/features/piano_roll_v7/hooks/useNoteInteractionsV3.js` (line 2616-2632)
- `client/src/features/piano_roll_v7/hooks/useNoteInteractionsV2.js` (line 2985-3020)

---

### 3. Drag Sırasında Wheel Event'leri
**Sorun:** Drag işlemi sırasında wheel event'leri hala çalışıyor olabilir, bu istenmeyen scroll/zoom'a neden olabilir.

**Mevcut Durum:**
- Drag state kontrolü wheel handler'larında yok
- Drag sırasında wheel event'leri engellenmiyor

**Beklenen Davranış:**
- Drag sırasında wheel event'leri engellenmeli (scroll/zoom yapılmamalı)

**Öneri:** Wheel handler'larına drag state kontrolü eklemek.

**Dosyalar:**
- `client/src/features/piano_roll_v7/PianoRoll.jsx` (line 1739-1782)
- `client/src/features/piano_roll_v7/usePianoRollEngine.js` (line 115-190)

---

### 4. Context Menu Açıkken Event'ler
**Sorun:** Context menu açıkken wheel/keyboard event'leri hala çalışıyor olabilir.

**Mevcut Durum:**
- Context menu açıkken wheel event'leri engellenmiyor
- Context menu açıkken keyboard event'leri engellenmiyor

**Beklenen Davranış:**
- Context menu açıkken wheel/keyboard event'leri engellenmeli

**Öneri:** Context menu state kontrolü eklemek.

**Dosyalar:**
- `client/src/features/piano_roll_v7/PianoRoll.jsx` (contextMenuState kontrolü yok)
- `client/src/features/piano_roll_v7/components/ContextMenu.jsx`

---

### 5. Ctrl + Wheel Zoom Priority
**Sorun:** PianoRoll.jsx'te Ctrl kontrolü yok, sadece engine'e geçiriliyor. Ctrl + Alt durumunda sorun olabilir.

**Mevcut Durum:**
- PianoRoll.jsx: Ctrl kontrolü yok, direkt engine'e geçiriliyor
- usePianoRollEngine.js: Ctrl kontrolü var ama Alt kontrolünden sonra

**Beklenen Davranış:**
- Ctrl + wheel → Zoom (öncelikli)
- Alt + wheel → Velocity (Ctrl yoksa)

**Öneri:** PianoRoll.jsx'te Ctrl kontrolünü Alt kontrolünden önce yapmak.

**Dosyalar:**
- `client/src/features/piano_roll_v7/PianoRoll.jsx` (line 1739-1782)
- `client/src/features/piano_roll_v7/usePianoRollEngine.js` (line 115-127)

---

## 📋 Öncelik Sırası

1. **Yüksek Öncelik:**
   - Ctrl + Alt + Wheel conflict (zoom çalışmıyor)
   - Drag sırasında wheel event'leri (istenmeyen scroll)

2. **Orta Öncelik:**
   - Shift + Wheel (duration) eksik özellik
   - Context menu açıkken event'ler

3. **Düşük Öncelik:**
   - Ctrl + Wheel zoom priority (mevcut durumda çalışıyor ama optimize edilebilir)

---

## 🔧 Önerilen Düzeltmeler

### 1. Ctrl + Alt + Wheel Fix
```javascript
// PianoRoll.jsx - wheelHandler
const wheelHandler = (e) => {
    // ✅ UX FIX: Ctrl + wheel (zoom) has priority over Alt
    if (e.ctrlKey || e.metaKey) {
        // Let engine handle zoom (don't prevent if Ctrl is pressed)
        if (engine.eventHandlers?.onWheel) {
            engine.eventHandlers.onWheel(e);
        }
        return;
    }
    
    // Alt + wheel: Handle velocity change
    if (e.altKey && selectedNoteIds.size > 0 && noteInteractions.handleWheel) {
        // ... velocity handling
    }
    // ...
};
```

### 2. Drag State Check
```javascript
// PianoRoll.jsx - wheelHandler
const wheelHandler = (e) => {
    // ✅ UX FIX: Don't handle wheel during drag
    if (rawDragState || rawResizeState) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    // ...
};
```

### 3. Context Menu Check
```javascript
// PianoRoll.jsx - wheelHandler
const wheelHandler = (e) => {
    // ✅ UX FIX: Don't handle wheel when context menu is open
    if (contextMenuState) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    // ...
};
```

---

**Son Güncelleme:** 2025-01-XX

