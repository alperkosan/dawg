# DAWG Preset System

## 📁 Dosya Organizasyonu

```
presets/
├── index.js              # Central export point
├── saturatorPresets.js   # Saturator mode presets
├── README.md            # This file
└── [future presets]     # compressorPresets.js, eqPresets.js, etc.
```

## 🎯 Kullanım

### Import Etme

```javascript
// Method 1: Direct import
import { SATURATOR_MODES, getModeParameters } from '@/config/presets/saturatorPresets';

// Method 2: Central import (recommended)
import { SATURATOR_MODES, getModeParameters } from '@/config/presets';
```

### Mode Preset Yapısı

Her preset aşağıdaki yapıyı takip etmelidir:

```javascript
{
  id: 'mode-id',           // Unique identifier
  name: 'Mode Name',       // Display name
  icon: '🎤',              // Emoji icon
  color: 'amber',          // Tailwind color
  description: 'Brief description',
  category: 'musical',     // Category for grouping

  baseParams: {            // Fixed parameters
    // Plugin-specific parameters
  },

  curves: {                // Amount-scalable parameters
    paramName: {
      min: 0,
      max: 1.0,
      curve: 'linear'      // linear, exponential, logarithmic
    }
  }
}
```

## 📋 Preset Kategorileri

### Saturator Kategorileri
- **musical**: Warm, natural saturation
- **aggressive**: Heavy, distorted tones
- **vintage**: Analog, lo-fi character
- **subtle**: Gentle enhancement

## 🔄 Yeni Preset Ekleme

1. Uygun dosyayı oluştur: `[pluginName]Presets.js`
2. Preset object'leri tanımla
3. Helper functions ekle (getModeParameters, vb.)
4. `index.js`'e export ekle
5. Plugin UI'da import et ve kullan

## 🎨 Best Practices

1. **Naming**: Açıklayıcı, kullanıcı dostu isimler kullan
2. **Categories**: 4-6 kategoride sınırla
3. **Modes**: Kategori başına 2-3 mode (toplam 8-12)
4. **Icons**: Anlamlı emoji'ler seç
5. **Descriptions**: Kısa ve öz (max 40 karakter)
6. **Curves**: Doğal hareket için uygun curve tipi seç

## 🔧 Plugin Integration

Plugin UI'da kullanım:

```javascript
import { SATURATOR_MODES, getModeParameters } from '@/config/presets';

// Mode değişimi
const handleModeChange = (modeId) => {
  setSelectedMode(modeId);
};

// Amount değişimi
useEffect(() => {
  const params = getModeParameters(selectedMode, amount);
  // Apply params to plugin
}, [selectedMode, amount]);
```

## 📝 Notlar

- Her plugin kendi preset file'ına sahip olmalı
- Preset'ler pluginConfig.jsx'ten ayrı tutulmalı
- Mode-based design philosophy'ye uygun olmalı
- Responsive tasarım için minSize/initialSize ayarları önemli
