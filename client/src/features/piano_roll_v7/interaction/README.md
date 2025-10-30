# 🎹 Piano Roll Interaction System

**Professional-grade interaction system for piano roll editing with advanced UX patterns**

Bu sistem, piano roll için kapsamlı etkileşim hiyerarşisi sağlar ve emsal DAW'ların (FL Studio, Ableton Live, Logic Pro) etkileşim kalitesini hedefler.

## ✨ **Özellikler**

### 🎯 **Temel Etkileşimler**
- **Undo/Redo**: Command pattern ile tam geri alma/yineleme
- **Event Hierarchy**: Hiyerarşik olay yönetimi
- **Context Menu**: Sağ tık menü sistemi
- **Selection**: Çoklu seçim (Ctrl+Click, Ctrl+A, Ctrl+I)
- **Clipboard**: Kesme, kopyalama, yapıştırma

### 🎨 **Görsel Geri Bildirim**
- **Professional Cursors**: 20+ profesyonel cursor türü
- **Smooth Animations**: 200ms yumuşak animasyonlar
- **Visual States**: Hover, selected, preview, ghost states
- **Performance Monitoring**: 60fps performans izleme
- **Accessibility**: Reduced motion, high contrast desteği

### 🧠 **Akıllı Nota Oluşturma**
- **Context Awareness**: Müzikal bağlam farkındalığı
- **Pattern Recognition**: Öğrenen pattern sistemi
- **Smart Defaults**: Akıllı varsayılan değerler
- **Memory System**: Kullanıcı tercihlerini hatırlama
- **Intelligence Levels**: 4 seviye zeka (Basic → Expert)

### 🎵 **Çoklu Nota Operasyonları**
- **Transform Operations**: Move, resize, rotate, flip, mirror
- **Musical Operations**: Quantize, humanize, velocity, duration, pitch
- **Pattern Operations**: Repeat, reverse, stretch, compress, chop, slice
- **Advanced Operations**: Arpeggiate, strum, flam, roll, glissando
- **Special Operations**: Randomize, smooth, normalize, invert

## 🚀 **Kurulum**

```javascript
import { 
    PianoRollInteractionSystem, 
    createInteractionSystem,
    DEFAULT_CONFIG 
} from '@/features/piano_roll_v7/interaction';

// Varsayılan konfigürasyon ile oluştur
const interactionSystem = createInteractionSystem();

// Özel konfigürasyon ile oluştur
const customSystem = createInteractionSystem({
    interaction: {
        debounceMs: 8,
        dragThreshold: 2
    },
    visualFeedback: {
        defaultDuration: 150,
        maxAnimations: 100
    }
});

// Sistemi başlat
await interactionSystem.initialize();
```

## 📖 **Kullanım**

### **Temel Kullanım**

```javascript
// Bileşenleri al
const { 
    interactionManager, 
    visualFeedback, 
    smartNoteCreation, 
    cursorSystem, 
    multiNoteOperations 
} = interactionSystem.getComponents();

// Mouse olaylarını dinle
interactionManager.on('interactionStart', (data) => {
    console.log('Etkileşim başladı:', data);
});

// Görsel geri bildirim göster
visualFeedback.showNoteFeedback('note_123', 'note-added', {
    duration: 300,
    easing: 'bounce-out'
});

// Akıllı nota oluştur
const smartNote = smartNoteCreation.createSmartNote(
    { time: 4, pitch: 60 }, 
    { duration: 2, velocity: 100 }
);

// Cursor değiştir
cursorSystem.setCursor('paint', 'active', {
    animation: 'fade-in'
});

// Çoklu nota operasyonu
await multiNoteOperations.executeOperation('quantize', selectedNotes, {
    value: 1,
    strength: 0.8,
    swing: 0.1
});
```

### **Gelişmiş Kullanım**

```javascript
// Context-aware nota oluşturma
const context = smartNoteCreation.detectContext({ time: 8, pitch: 64 });
const smartDefaults = smartNoteCreation.generateSmartDefaults(context);

// Pattern recognition
const patterns = smartNoteCreation.detectPatterns(notes);
smartNoteCreation.learnPattern(patterns.duration, 'duration');

// Çoklu operasyon zinciri
await multiNoteOperations.executeOperation('select', notes, { mode: 'all' });
await multiNoteOperations.executeOperation('quantize', selectedNotes, { value: 0.5 });
await multiNoteOperations.executeOperation('humanize', selectedNotes, { amount: 0.1 });
await multiNoteOperations.executeOperation('velocity', selectedNotes, { value: 10, mode: 'relative' });

// Performans izleme
interactionSystem.on('performanceUpdate', (metrics) => {
    console.log('Performans:', metrics);
});
```

## 🎨 **Cursor Sistemi**

### **Cursor Türleri**

```javascript
import { CURSOR_TYPES, CURSOR_STATES } from '@/features/piano_roll_v7/interaction';

// Temel cursors
cursorSystem.setCursor(CURSOR_TYPES.SELECT, CURSOR_STATES.HOVER);
cursorSystem.setCursor(CURSOR_TYPES.PAINT, CURSOR_STATES.ACTIVE);
cursorSystem.setCursor(CURSOR_TYPES.ERASE, CURSOR_STATES.ACTIVE);

// Resize cursors
cursorSystem.setCursor(CURSOR_TYPES.RESIZE_LEFT, CURSOR_STATES.RESIZING);
cursorSystem.setCursor(CURSOR_TYPES.RESIZE_RIGHT, CURSOR_STATES.RESIZING);
cursorSystem.setCursor(CURSOR_TYPES.RESIZE_BOTH, CURSOR_STATES.RESIZING);

// Move cursors
cursorSystem.setCursor(CURSOR_TYPES.MOVE, CURSOR_STATES.DRAGGING);
cursorSystem.setCursor(CURSOR_TYPES.GRAB, CURSOR_STATES.HOVER);
cursorSystem.setCursor(CURSOR_TYPES.GRABBING, CURSOR_STATES.DRAGGING);

// Özel cursors
cursorSystem.setCursor(CURSOR_TYPES.CUSTOM, CURSOR_STATES.ACTIVE, {
    svg: '<svg>...</svg>',
    animation: 'pulse'
});
```

### **Cursor Animasyonları**

```javascript
import { CURSOR_ANIMATIONS } from '@/features/piano_roll_v7/interaction';

// Animasyonlu cursor değişimi
cursorSystem.setCursor('paint', 'active', {
    animation: CURSOR_ANIMATIONS.BOUNCE_IN,
    duration: 200
});

// Özel cursor oluştur
cursorSystem.addCustomCursor('my-cursor', {
    type: 'my-cursor',
    css: 'crosshair',
    svg: '<svg>...</svg>',
    priority: 80,
    states: ['idle', 'active']
});
```

## 🎵 **Müzikal Operasyonlar**

### **Quantize**

```javascript
// Temel quantize
await multiNoteOperations.executeOperation('quantize', notes, {
    value: 1,        // 1 step
    strength: 0.8,   // %80 güç
    swing: 0.1       // %10 swing
});

// Gelişmiş quantize
await multiNoteOperations.executeOperation('quantize', notes, {
    value: 0.5,      // 1/2 step
    strength: 1.0,   // %100 güç
    swing: 0.2,      // %20 swing
    mode: 'selected'
});
```

### **Humanize**

```javascript
// Timing humanize
await multiNoteOperations.executeOperation('humanize', notes, {
    amount: 0.1,     // %10 varyasyon
    timing: true,    // Zamanlama varyasyonu
    velocity: true,  // Velocity varyasyonu
    pitch: false    // Pitch varyasyonu yok
});
```

### **Velocity Operations**

```javascript
// Relative velocity change
await multiNoteOperations.executeOperation('velocity', notes, {
    value: 10,       // +10 velocity
    mode: 'relative'
});

// Absolute velocity
await multiNoteOperations.executeOperation('velocity', notes, {
    value: 100,      // 100 velocity
    mode: 'absolute'
});

// Percentage velocity
await multiNoteOperations.executeOperation('velocity', notes, {
    value: 1.2,      // %20 artış
    mode: 'percentage'
});
```

### **Pattern Operations**

```javascript
// Arpeggiate
await multiNoteOperations.executeOperation('arpeggiate', notes, {
    pattern: 'up',      // Yukarı arpeggio
    speed: 0.1,         // 0.1 step aralık
    octaves: 2          // 2 oktav
});

// Strum
await multiNoteOperations.executeOperation('strum', notes, {
    direction: 'down',  // Aşağı strum
    speed: 0.05,        // 0.05 step aralık
    velocity: 0.8       // %80 velocity
});

// Flam
await multiNoteOperations.executeOperation('flam', notes, {
    offset: 0.02,       // 0.02 step offset
    velocity: 0.6       // %60 velocity
});
```

## 🧠 **Akıllı Nota Oluşturma**

### **Context Awareness**

```javascript
// Müzikal bağlam tespit et
const context = smartNoteCreation.detectContext({ time: 8, pitch: 64 });
console.log('Detected context:', context);

// Scale-aware nota oluştur
if (context.type === 'scale') {
    const smartNote = smartNoteCreation.createSmartNote(
        { time: 12, pitch: 0 }, // Pitch otomatik belirlenecek
        { duration: 2, velocity: 100 }
    );
}

// Pattern-based nota oluştur
if (context.type === 'pattern') {
    const smartNote = smartNoteCreation.createSmartNote(
        { time: 16, pitch: 0 },
        { duration: 0, velocity: 0 } // Tüm değerler otomatik
    );
}
```

### **Memory System**

```javascript
// Kullanıcı tercihlerini öğren
smartNoteCreation.learnFromUser({
    duration: 2,
    velocity: 120,
    pitch: 64
});

// Akıllı varsayılanları al
const smartDefaults = smartNoteCreation.getSmartDefaults();
console.log('Smart defaults:', smartDefaults);

// Pattern öğren
const pattern = [1, 1, 0.5, 0.5, 2];
smartNoteCreation.learnPattern(pattern, 'duration');
```

## 🎨 **Görsel Geri Bildirim**

### **Note States**

```javascript
import { FEEDBACK_TYPES, ANIMATION_TYPES } from '@/features/piano_roll_v7/interaction';

// Nota durumları
visualFeedback.showNoteFeedback('note_123', FEEDBACK_TYPES.NOTE_HOVER);
visualFeedback.showNoteFeedback('note_456', FEEDBACK_TYPES.NOTE_SELECTED);
visualFeedback.showNoteFeedback('note_789', FEEDBACK_TYPES.NOTE_PREVIEW);

// Animasyonlar
visualFeedback.showAnimation('note_123', ANIMATION_TYPES.BOUNCE_IN, {
    duration: 300,
    easing: 'ease-out'
});

// Selection feedback
visualFeedback.showSelectionFeedback({
    start: { time: 0, pitch: 60 },
    end: { time: 4, pitch: 72 }
}, FEEDBACK_TYPES.SELECTION_AREA);
```

### **Custom Animations**

```javascript
// Özel animasyon oluştur
visualFeedback.showAnimation('note_123', 'custom-morph', {
    duration: 500,
    easing: 'ease-in-out',
    properties: {
        scale: [1, 1.2, 1],
        rotation: [0, 180, 360],
        opacity: [1, 0.5, 1]
    },
    onComplete: () => {
        console.log('Animation completed');
    }
});
```

## ⚡ **Performans Optimizasyonu**

### **Performance Monitoring**

```javascript
// Performans metriklerini al
const metrics = interactionSystem.getPerformanceMetrics();
console.log('Performance:', metrics);

// Frame rate izleme
interactionSystem.on('performanceUpdate', (data) => {
    if (data.metrics.frameRate < 30) {
        console.warn('Low frame rate detected:', data.metrics.frameRate);
    }
});
```

### **Configuration Tuning**

```javascript
// Performans için optimize et
interactionSystem.updateConfig({
    visualFeedback: {
        maxAnimations: 25,      // Daha az animasyon
        frameRate: 30           // Daha düşük frame rate
    },
    interaction: {
        debounceMs: 32,         // Daha uzun debounce
        throttleMs: 16          // Daha uzun throttle
    }
});
```

## 🔧 **Konfigürasyon**

### **Tam Konfigürasyon**

```javascript
const config = {
    interaction: {
        debounceMs: 16,         // 60fps debounce
        throttleMs: 8,          // 120fps throttle
        doubleClickThreshold: 300,
        dragThreshold: 3,
        resizeHandleSize: 8,
        snapTolerance: 0.1
    },
    
    visualFeedback: {
        defaultDuration: 200,
        fastDuration: 100,
        slowDuration: 400,
        ultraFastDuration: 50,
        maxAnimations: 50,
        animationQueueSize: 100,
        frameRate: 60,
        colors: {
            primary: '#3b82f6',
            secondary: '#8b5cf6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        }
    },
    
    smartNoteCreation: {
        intelligenceLevel: 'intermediate',
        contextAwareness: true,
        patternRecognition: true,
        musicalIntelligence: true,
        durationMemory: true,
        velocityLayering: true,
        pitchContext: true,
        timingContext: true
    },
    
    cursor: {
        defaultCursor: 'default',
        fallbackCursor: 'default',
        animationDuration: 150,
        transitionDuration: 100,
        hoverDelay: 50,
        cursorSize: 20,
        cursorScale: 1.0,
        cursorOpacity: 1.0,
        highContrast: false,
        reducedMotion: false,
        largeCursors: false
    },
    
    multiNoteOperations: {
        maxNotes: 1000,
        maxOperations: 100,
        operationTimeout: 5000,
        batchSize: 50,
        quantizeValues: [0.25, 0.5, 1, 2, 4, 8, 16],
        quantizeStrength: 1.0,
        quantizeSwing: 0.0,
        humanizeAmount: 0.1,
        humanizeTiming: true,
        humanizeVelocity: true,
        humanizePitch: false,
        velocityMin: 1,
        velocityMax: 127,
        durationMin: 0.25,
        durationMax: 16,
        pitchMin: 0,
        pitchMax: 127
    }
};
```

## 🎯 **Best Practices**

### **1. Performans**
- Maksimum 50 animasyon aynı anda
- 60fps hedef frame rate
- Debounce/throttle kullanın
- Gereksiz event listener'ları temizleyin

### **2. Kullanıcı Deneyimi**
- 200ms animasyon süresi
- Hover delay 50ms
- Smooth cursor geçişleri
- Context-aware davranışlar

### **3. Erişilebilirlik**
- Reduced motion desteği
- High contrast modu
- Keyboard navigation
- Screen reader uyumluluğu

### **4. Kod Organizasyonu**
- Bileşenleri ayrı tutun
- Event listener'ları temizleyin
- Memory leak'leri önleyin
- Error handling ekleyin

## 🐛 **Troubleshooting**

### **Yaygın Sorunlar**

1. **Düşük Frame Rate**
   ```javascript
   // Animasyon sayısını azalt
   visualFeedback.updateConfig({ maxAnimations: 25 });
   ```

2. **Cursor Gecikmesi**
   ```javascript
   // Debounce süresini azalt
   interactionManager.updateConfig({ debounceMs: 8 });
   ```

3. **Memory Leak**
   ```javascript
   // Sistemi temizle
   interactionSystem.destroy();
   ```

4. **Animation Sıçraması**
   ```javascript
   // Easing fonksiyonunu değiştir
   visualFeedback.showAnimation(id, 'fade-in', { easing: 'ease-out' });
   ```

## 📚 **API Referansı**

Detaylı API referansı için [API Documentation](./API.md) dosyasına bakın.

## 🤝 **Katkıda Bulunma**

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 **Lisans**

Bu proje MIT lisansı altında lisanslanmıştır.

---

**Piano Roll Interaction System v1.0.0** - Professional-grade piano roll editing experience
