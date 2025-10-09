# 🎯 DAWG Master Plan & Development Rules

**Proje Durumu ve Geliştirme Kuralları - Kapsamlı Kılavuz**

**Tarih:** 2025-10-10
**Versiyon:** 1.0.0
**Durum:** ✅ Aktif ve Güncel

---

## 📍 NEREDEYIZ (Where We Are)

### Mevcut Mimari Durum

**Mimari Kalite Skoru:** 8.5/10 ⭐ (ARCHITECTURE_AUDIT_REPORT.md)

```
✅ GÜÇLÜ YÖNLER:
- PlaybackController: Singleton pattern ile mükemmel state management
- UIUpdateManager: RAF (RequestAnimationFrame) konsolidasyonu
- PlayheadRenderer: Optimize edilmiş DOM manipülasyonu
- EventBus: Decoupled communication pattern
- Separation of Concerns: 9/10

⚠️ İYİLEŞTİRME ALANLARI:
- 1 adet standalone RAF loop (ArrangementCanvasRenderer)
- Debug logging sistemi eksik
- Bazı dokümantasyon boşlukları
```

**Dosya Sistemi:** Temizlenmiş ve optimize edilmiş
- Toplam dokumentasyon: 38 MD dosyası (~309 KB)
- Archive klasörleri temizlendi (git history'de korunuyor)
- Store konsolidasyonu tamamlandı (V2 → unified)
- /lib cleanup tamamlandı (4 unused file silindi)

### Tamamlanan İşler Özeti

**Plugin Redesign İlerlemesi:**
- ✅ 6/14 plugin redesign tamamlandı (43%)
- ✅ Component library hazır ve production-ready
- ✅ BaseAudioPlugin + PresetManager infrastructure complete
- ✅ TypeScript definitions hazır

**Redesign Edilen Pluginler:**
1. ✅ **Saturator v2.0** (texture-lab) - Flagship implementation
2. ✅ **AdvancedCompressor v2.0** (dynamics-forge) - 6-mode dynamics
3. ✅ **TransientDesigner v2.0** (dynamics-forge) - Bipolar controls
4. ✅ **ModernDelay v2.0** (spacetime-chamber) - Ping-pong delay
5. ✅ **ModernReverb v2.0** (spacetime-chamber) - 6 space modes
6. ✅ **OrbitPanner v2.0** (spacetime-chamber) - Circular auto-pan

**Kalan Pluginler (8/14):**
- TidalFilter, StardustChorus, VortexPhaser
- PitchShifter, ArcadeCrusher, BassEnhancer808
- AdvancedEQ, OTT

### Mevcut Tech Stack ve Patternler

**Frontend Stack:**
- React 18 + Vite
- Zustand (state management)
- Web Audio API + AudioWorklet
- Canvas API (visualization)

**Kurulu Design Systems:**
- Zenith Design System (tema sistemi)
- 5 kategori color palette (texture-lab, dynamics-forge, etc.)
- Component library (15 component)
- Responsive layout patterns

**Performance:**
- Build time: ~4.85s
- Bundle size: ~984 KB (gzipped)
- 60fps target visualization
- CPU usage: <2% per plugin instance

---

## 🎯 NEREYE GİTMEK İSTİYORUZ (Where We Want To Go)

### Genel Vizyon

> **"Industry-grade DAW with professional audio processing and modern web UX"**

**Hedefler:**
1. **14/14 plugin redesign** - Tüm pluginler yeni design system ile
2. **Performance optimization** - 60fps @ 3 plugin instances
3. **Plugin SDK** - 3rd party developer desteği
4. **Preset marketplace** - Community-driven content
5. **Mobile support** - iPad-optimized UI

### Kalan İşler (PLUGIN_MIGRATION_PLAN.md)

**Tier 1: Core Effects** (Yüksek öncelik - ~2.5 saat)
- AdvancedEQ (45 dk)
- Kalan 2 plugin

**Tier 2: Creative Effects** (~2.3 saat)
- TidalFilter (30 dk)
- StardustChorus (45 dk)
- VortexPhaser (30 dk)
- Diğerleri

**Tier 3: Specialized** (~2.2 saat)
- ArcadeCrusher (30 dk)
- PitchShifter (45 dk)
- BassEnhancer808 (60 dk - most complex)

**Toplam Tahmini Süre:** ~9 saat (1-2 gün)

### Gelecek Geliştirmeler

**Kısa Vadeli (Next Month):**
- Plugin Generator CLI
- Visual preset editor
- Advanced benchmarking

**Orta Vadeli (Next Quarter):**
- Plugin SDK for 3rd party developers
- More test utilities
- Performance profiler

**Uzun Vadeli (Future Releases):**
- WASM support (C++ DSP)
- GPU acceleration (WebGL/Compute shaders)
- Plugin hot reload

---

## ✅ NE YAPTIK (What We've Done)

### Kronolojik Özet

#### **Phase 0: Cleanup** (1 saat) - TAMAMLANDI
**Tarih:** 2025-10-09
**Referans:** [PHASE0_CLEANUP_COMPLETE.md](./PHASE0_CLEANUP_COMPLETE.md)

**Yapılanlar:**
- 15 eski dosya arşivlendi (~121 KB)
- 3 aktif dosya standart isimlere renamed
- pluginConfig.jsx temizlendi
- %39 daha az dosya (23 → 14 plugin UI)

**Sonuç:** Temiz, maintainable codebase

---

#### **Phase 1: Theme System (Zenith)** (2 saat) - TAMAMLANDI
**Tarih:** 2025-10-09
**Referans:** [PHASE1_THEME_SYSTEM_COMPLETE.md](./PHASE1_THEME_SYSTEM_COMPLETE.md)

**Yapılanlar:**
- 5 kategori color palette eklendi
- useControlTheme enhanced with category support
- Helper functions: `getCategoryKey`, `getCategoryPalettes`
- %100 backward compatible

**Kategoriler:**
```javascript
{
  'texture-lab': { primary: '#FF6B35' },      // Orange - Analog warmth
  'dynamics-forge': { primary: '#00A8E8' },   // Blue - Precise control
  'spectral-weave': { primary: '#9B59B6' },   // Purple - Frequency work
  'modulation-machines': { primary: '#2ECC71' }, // Green - Movement
  'spacetime-chamber': { primary: '#E74C3C' }   // Red - Spatial depth
}
```

**Sonuç:** Automatic visual identity per category

---

#### **Phase 2: Core Components** (3 saat) - TAMAMLANDI
**Tarih:** 2025-10-09
**Referans:** [PHASE2_CORE_COMPONENTS_COMPLETE.md](./PHASE2_CORE_COMPONENTS_COMPLETE.md)

**Enhanced Components:**

**1. Knob (ProfessionalKnob)**
- ✅ Ghost value support (400ms lag)
- ✅ Category theming
- ✅ Size variants (60/80/100px)
- ✅ Custom color override
- ✅ Custom value formatting

**2. Slider (LinearSlider)**
- ✅ Bipolar mode (center at 0)
- ✅ Logarithmic scaling
- ✅ Horizontal/Vertical orientation
- ✅ Tick marks
- ✅ Center detent (snap to 0)
- ✅ Ghost value support

**3. Meter**
- ✅ Labels
- ✅ Category theming
- ✅ Custom color override

**Yeni Components:**

**4. ModeSelector**
- ✅ Segmented button group
- ✅ Icon + tooltip support
- ✅ Animated indicator
- ✅ Keyboard navigation

**5. ExpandablePanel**
- ✅ Collapsible advanced settings
- ✅ Smooth animations
- ✅ Category theming

**Sonuç:** 15 component (5 enhanced, 2 new, 8 existing)

---

#### **Plugin Redesign Journey** - DEVAMEDİYOR

**Day 1:** Saturator v2.0 (2025-10-10)
- First production plugin with new system
- Mode-based workflow
- Ghost values
- Category theming (texture-lab orange)

**Day 2:** 5 More Plugins (2025-10-09)
- Compressor, TransientDesigner
- ModernDelay, ModernReverb, OrbitPanner
- 3-panel layout standardization
- Bug fixes (ModeSelector, Bipolar Slider, AudioParam)

**Sonuç:** 6/14 complete (43%), patterns established

---

#### **Architecture Cleanup** - TAMAMLANDI (2025-10-10)

**Store Cleanup:** [STORE_CLEANUP_COMPLETE.md](./STORE_CLEANUP_COMPLETE.md)
- usePlaybackStoreV2 → usePlaybackStore (unified)
- 8 import güncellendi
- Archive directories silindi
- Comprehensive documentation eklendi

**Lib Cleanup:** [LIB_CLEANUP_COMPLETE.md](./LIB_CLEANUP_COMPLETE.md)
- 4 unused file silindi (~19 KB)
- MultiBandEQEffect_v2.js (unused V2)
- EffectPresetManager.js (superseded)
- WorkletMessageProtocol.js (unused)
- PluginBenchmark.js (never used)
- Index.js dead exports temizlendi

**Sonuç:** Cleaner, more maintainable codebase

---

## 🏗️ KURULAN SİSTEMLER (Established Systems)

### Architecture Patterns

#### 1. PlaybackController Pattern
**Dosya:** `lib/core/PlaybackController.js`
**Pattern:** Singleton + EventEmitter
**Durum:** ✅ Excellent (ARCHITECTURE_AUDIT_REPORT.md)

```javascript
// Single source of truth for playback state
export class PlaybackController extends SimpleEventEmitter {
  constructor(audioEngine, initialBPM = 140) {
    this.state = {
      playbackState: PLAYBACK_STATES.STOPPED,
      isPlaying: false,
      currentPosition: 0,  // Tek pozisyon kaynağı
      bpm: initialBPM,
      // ...
    };
    this._bindMotorEvents();  // Event-driven
  }
}
```

**Why:** Event-driven architecture, no fragmentation, proper lifecycle

---

#### 2. UIUpdateManager Pattern
**Dosya:** `lib/ui/UIUpdateManager.js`
**Pattern:** RAF Consolidation + Priority Queue
**Durum:** ✅ Professional implementation

```javascript
// Centralized RAF loop for all UI updates
export class UIUpdateManager {
  subscribe(id, callback, priority = NORMAL, frequency = HIGH) {
    // Priority-based execution
    // Frequency throttling
    // Adaptive quality (FPS-based)
  }
}
```

**Why:** 60fps guaranteed, adaptive quality, metrics tracking

---

#### 3. EventBus Pattern
**Dosya:** `lib/core/EventBus.js`
**Pattern:** Pub/Sub
**Durum:** ✅ Decoupled communication

```javascript
// Decoupled component communication
EventBus.emit('playback:start', { position: 0 });
EventBus.on('playback:start', handlePlaybackStart);
```

**Why:** Loose coupling, easy testing, clear data flow

---

#### 4. Singleton Pattern (BaseSingleton)
**Dosya:** `lib/core/BaseSingleton.js`
**Pattern:** Lazy initialization singleton
**Kullanıldığı Yerler:**
- PlaybackController
- TimelineController
- AudioContextService

```javascript
export class BaseSingleton {
  static getInstance(...args) {
    if (!this.instance) {
      this.instance = new this(...args);
    }
    return this.instance;
  }
}
```

**Why:** Prevents multiple instances, lazy init, memory efficient

---

#### 5. Store Management (Zustand)
**Dosya:** `store/usePlaybackStore.js` (unified)
**Pattern:** Zustand state management + PlaybackController binding

```javascript
export const usePlaybackStore = create((set, get) => ({
  // State mirrors PlaybackController
  isPlaying: false,
  currentStep: 0,
  bpm: 140,

  // Actions delegate to PlaybackController
  play: () => playbackController.play(),
  stop: () => playbackController.stop(),
}));
```

**Why:** React bindings for singleton, immutable updates, devtools support

---

### Plugin Infrastructure

#### 1. BaseAudioPlugin Abstract Class
**Dosya:** `lib/audio/BaseAudioPlugin.js`
**Pattern:** Abstract base class + Hooks integration
**Durum:** ✅ Production-ready + TypeScript definitions

**Features:**
- ✅ Automatic audio node connection
- ✅ Analyser setup/management
- ✅ Time/frequency domain data
- ✅ RMS, peak, peak hold metrics
- ✅ dB FS conversions
- ✅ Performance tracking
- ✅ Automatic cleanup

```javascript
const plugin = new BaseAudioPlugin(trackId, effectId, {
  fftSize: 2048,
  smoothingTimeConstant: 0.8
});

const waveform = plugin.getTimeDomainData();
const spectrum = plugin.getFrequencyData();
const metrics = plugin.calculateMetrics();
```

**Why:** DRY principle, consistent API, zero boilerplate

---

#### 2. PresetManager System
**Dosya:** `lib/audio/PresetManager.js`
**Pattern:** Factory pattern + localStorage persistence

**Features:**
- ✅ Factory presets registration
- ✅ User presets (save/load/delete)
- ✅ localStorage persistence
- ✅ Import/Export JSON
- ✅ Category filtering
- ✅ Search functionality

```javascript
const presetManager = createPresetManager('Saturator', FACTORY_PRESETS);
presetManager.saveUserPreset('My Settings', params);
const preset = presetManager.getPreset('vocal-warmth');
```

**Why:** Consistent UX, persistence, shareable presets

---

#### 3. useAudioPlugin Hook
**Dosya:** `hooks/useAudioPlugin.js`
**Pattern:** React custom hook + automatic cleanup

**Replaces:** 150-200 lines of boilerplate per plugin

```javascript
const {
  isPlaying,
  metrics,
  getTimeDomainData,
  getFrequencyData
} = useAudioPlugin(trackId, effectId, {
  fftSize: 2048,
  updateMetrics: true
});
```

**Why:** 85-90% code reduction, consistent pattern, automatic cleanup

---

#### 4. Plugin Development Workflow
**Referans:** [PLUGIN_DEVELOPMENT_QUICKSTART.md](./PLUGIN_DEVELOPMENT_QUICKSTART.md)

**Steps:**
1. Copy template files (PluginTemplate.jsx, template-processor.js)
2. Update names and IDs
3. Implement DSP logic
4. Customize UI
5. Register in pluginConfig.jsx
6. Test and deploy

**Time:** 15 minutes (with templates)
**Before:** 4-8 hours (manual setup)
**Savings:** 95% reduction

---

#### 5. Component Library
**Referans:** [PLUGIN_COMPONENT_LIBRARY.md](./PLUGIN_COMPONENT_LIBRARY.md)

**Base Controls (8):**
- Knob, Slider, ModeSelector, ExpandablePanel
- Fader, Button, Toggle, Display

**Advanced Controls (3):**
- Meter, XYPad, StepSequencer

**Specialized (4):**
- SpectrumKnob, WaveformKnob, FrequencyGraph, EnvelopeEditor

**Total:** 15 reusable components
**Reusability:** 100% across all plugins

---

### Theme System

#### Zenith Design System
**Referans:** [ZENITH_DESIGN_SYSTEM.md](./ZENITH_DESIGN_SYSTEM.md)

**Token Structure:**
```css
--zenith-bg-primary
--zenith-bg-secondary
--zenith-bg-tertiary
--zenith-text-primary
--zenith-text-secondary
--zenith-border-subtle
--zenith-accent-cool
--zenith-accent-warm
```

**Features:**
- ✅ CSS custom properties
- ✅ 3 default themes (Ghetto Star, 8-Bit Night, Analog Warmth)
- ✅ Dark mode support
- ✅ Real-time theme switching

---

#### useControlTheme Hook
**Dosya:** `components/controls/useControlTheme.js`

```javascript
// Automatic category theming
const theme = useControlTheme('default', 'texture-lab');

// Component usage
<Knob category="texture-lab" /> // Orange theme
<Slider category="dynamics-forge" /> // Blue theme
```

**Why:** Single prop theming, visual identity, zero manual color work

---

### Effect System

#### EffectRegistry
**Dosya:** `lib/audio/EffectRegistry.js`
**Pattern:** Registry + Factory

```javascript
EffectRegistry.register('saturator', {
  displayName: 'Saturator',
  workletPath: '/worklets/effects/saturator-processor.js',
  component: SaturatorUI,
  category: 'texture-lab'
});
```

---

#### EffectFactory
**Dosya:** `lib/audio/effects/EffectFactory.js`
**Pattern:** Factory Method

```javascript
const effect = EffectFactory.create('saturator', audioContext, options);
```

---

#### WorkletEffect Base Class
**Dosya:** `lib/audio/effects/WorkletEffect.js`
**Pattern:** Template Method

```javascript
class MyWorkletEffect extends WorkletEffect {
  async initialize() {
    await this.loadWorklet('/worklets/my-processor.js', 'my-processor');
  }
}
```

---

#### "Old vs Modern" Pattern (Intentional)
**Referans:** [LIB_CLEANUP_COMPLETE.md](./LIB_CLEANUP_COMPLETE.md)

**Discovery:** Both versions intentionally coexist!

```
DelayEffect.js (4 imports)        → Simple, Tone.js-based
ModernDelayEffect.js (2 imports)  → Advanced, custom 8-tap

ReverbEffect.js (4 imports)       → Tone.js wrapper
ModernReverbEffect.js (2 imports) → Custom Freeverb
```

**Why:** Different feature sets, different use cases
**Rule:** Don't delete "old" versions - check EffectFactory mappings first!

---

## 📏 KURALLAR (Development Rules)

### Code Quality Rules

#### Rule 1: Zero Breaking Changes
**Kaynak:** PLUGIN_DESIGN_PHILOSOPHY.md

> "Her yeni feature %100 backward compatible olmalı"

**Neden:**
- Existing plugins çalışmaya devam etmeli
- User workflows kırılmamalı
- Migration gradual olmalı

**Nasıl:**
- New props optional olmalı
- Default values smart olmalı
- Old API deprecated ama functional kalmalı

**Örnek:**
```javascript
// OLD - still works
<Knob size={60} unit="%" precision={0} />

// NEW - enhanced but compatible
<Knob sizeVariant="large" category="texture-lab" />
```

---

#### Rule 2: DRY (Don't Repeat Yourself)
**Kaynak:** PLUGIN_STANDARDIZATION_GUIDE.md

> "Boilerplate code component/hook'a çıkartılmalı"

**Before (❌):**
```javascript
// Her plugin'de 150 satır boilerplate
const analyserRef = useRef(null);
useEffect(() => { /* 50 lines audio setup */ }, []);
// ... 100+ more lines
```

**After (✅):**
```javascript
// 1 line hook
const { isPlaying, getTimeDomainData } = useAudioPlugin(trackId, effectId);
```

**Savings:** 85-90% code reduction

---

#### Rule 3: Performance First
**Target Metrics:**

| Metric | Target | Acceptable | Warning |
|--------|--------|------------|---------|
| UI render | 60fps | 50fps | <30fps |
| Plugin creation | <1ms | <5ms | >10ms |
| Audio data | <0.1ms | <0.5ms | >1ms |
| Metrics calc | <0.5ms | <1ms | >2ms |
| Canvas draw | <5ms | <16ms | >33ms |

**Nasıl Test:**
```javascript
import { PluginBenchmark } from '@/lib/utils/PluginBenchmark';
const bench = new PluginBenchmark('MyPlugin');
bench.run('Process', () => process(), 1000);
```

---

#### Rule 4: Accessibility (a11y)
**Minimum Requirements:**
- [x] Keyboard navigation (Tab, Enter, Space, Arrows)
- [x] ARIA labels
- [x] Focus indicators
- [x] Screen reader support
- [x] Color contrast (WCAG 2.1 AA)

**Test:**
```bash
npm run lighthouse
# Target: 100% accessibility score
```

---

#### Rule 5: TypeScript Definitions
**Kaynak:** PLUGIN_INFRASTRUCTURE_COMPLETE.md

> "Her public API TypeScript definitions olmalı"

**Files:**
- `BaseAudioPlugin.d.ts`
- `useAudioPlugin.d.ts`
- `PresetManager.d.ts`

**Neden:**
- IDE autocomplete
- Compile-time error checking
- Living documentation

---

### Architecture Rules

#### Rule 1: Single Source of Truth
**Pattern:** PlaybackController pattern

> "State her zaman tek bir kaynaktan gelir"

**✅ CORRECT:**
```javascript
// PlaybackController holds state
playbackController.state.currentPosition

// Zustand store mirrors it
usePlaybackStore(state => state.currentStep)
```

**❌ WRONG:**
```javascript
// Multiple sources of truth
const [position, setPosition] = useState(0);
const currentPos = usePlaybackStore(s => s.position);
// Which one is correct? ❌
```

---

#### Rule 2: Event-Driven Communication
**Pattern:** EventBus + EventEmitter

> "Components arası communication events ile"

**✅ CORRECT:**
```javascript
// Emit event
playbackController.emit('position:changed', newPosition);

// Subscribe to event
playbackController.on('position:changed', updateUI);
```

**❌ WRONG:**
```javascript
// Direct coupling
componentA.updateComponentB(data); // ❌
```

---

#### Rule 3: RAF Consolidation
**Pattern:** UIUpdateManager

> "Her component kendi RAF loop'u açmamalı"

**✅ CORRECT:**
```javascript
uiUpdateManager.subscribe('my-component', (time, dt) => {
  // Update UI
}, UPDATE_PRIORITIES.NORMAL);
```

**❌ WRONG:**
```javascript
const loop = () => {
  updateUI();
  requestAnimationFrame(loop); // ❌ Multiple RAF loops
};
loop();
```

**Exception:** Currently ArrangementCanvasRenderer (will be migrated)

---

#### Rule 4: Separation of Concerns
**Layers:**

```
UI Layer (React Components)
  ↓ uses
Hook Layer (useAudioPlugin, useGhostValue)
  ↓ uses
Core Layer (BaseAudioPlugin, PresetManager)
  ↓ connects to
Audio Engine (AudioContext, Worklets)
```

**Rule:** Never skip layers (e.g., UI directly accessing AudioContext)

---

### Plugin Development Rules

#### Rule 1: Mode-Based Design Philosophy
**Kaynak:** PLUGIN_DESIGN_PHILOSOPHY.md

> "One Knob, Infinite Possibilities"

**Pattern:**
```
1. Identify use cases
   ↓
2. Create preset modes per use case
   ↓
3. Single "Amount/Intensity" master control
   ↓
4. Advanced settings in expandable panel
```

**Örnek (Saturator):**
```javascript
MODES = {
  'vocal-warmth': {
    description: 'Warm vocals',
    defaults: { drive: 0.3, tone: 0.2 }
  },
  'bass-power': {
    description: 'Powerful bass',
    defaults: { drive: 0.7, tone: -0.3 }
  }
}
```

**Benefits:**
- Reduced decision fatigue
- Faster workflow
- Beginner-friendly
- Power-user friendly (advanced panel)

---

#### Rule 2: Component-First Development
**Kaynak:** PLUGIN_REDESIGN_OVERVIEW.md

> "Component library'den compose et, custom yapmaya çalışma"

**Sequence:**
1. Check existing components first
2. Customize via props
3. Only create new component if truly unique
4. If created, make it reusable

**Örnek:**
```javascript
// ✅ GOOD - Use existing
<Knob category="texture-lab" sizeVariant="large" />

// ❌ BAD - Custom implementation
<CustomSaturatorKnob /> // Not reusable!
```

---

#### Rule 3: Category Theming Mandatory
**Kaynak:** PLUGIN_DESIGN_THEMES.md

> "Her control'e category prop ekle"

**Categories:**
- `texture-lab` - Orange (saturation, distortion)
- `dynamics-forge` - Blue (compression, limiting)
- `spectral-weave` - Purple (EQ, filtering)
- `modulation-machines` - Green (chorus, phaser, flanger)
- `spacetime-chamber` - Red (reverb, delay)

**Usage:**
```javascript
// All controls in plugin
<Knob category="texture-lab" />
<Slider category="texture-lab" />
<ModeSelector category="texture-lab" />
```

**Result:** Automatic visual identity

---

#### Rule 4: Ghost Values for Visual Feedback
**Kaynak:** PHASE2_CORE_COMPONENTS_COMPLETE.md

> "Interactive kontrolde ghost value kullan"

**Pattern:**
```javascript
const ghostDrive = useGhostValue(drive, 400); // 400ms lag

<Knob
  value={drive}
  ghostValue={ghostDrive}
  // Ghost arc lags 400ms behind
/>
```

**Why:** Professional "analog" feel, smooth feedback

---

#### Rule 5: Progressive Disclosure
**Pattern:** ExpandablePanel

> "Advanced settings gizli, istenince açılır"

```javascript
<div className="plugin-ui">
  {/* Main controls - always visible */}
  <Knob label="DRIVE" />
  <Knob label="MIX" />

  {/* Advanced - expandable */}
  <ExpandablePanel title="ADVANCED">
    <Slider label="LOW CUT" />
    <Slider label="HIGH CUT" />
    <Toggle label="AUTO GAIN" />
  </ExpandablePanel>
</div>
```

**Benefits:**
- Beginner: Simple 2-knob interface
- Expert: Full control when expanded
- Best of both worlds

---

#### Rule 6: 3-Panel Layout Standard
**Kaynak:** DAY2_SIX_PLUGINS_COMPLETE.md

> "Tüm pluginler 3-panel layout kullanır"

```
┌─────────────┬──────────────────────────┬─────────────┐
│             │                          │             │
│  LEFT PANEL │    CENTER PANEL          │ RIGHT PANEL │
│  (240px)    │    (flex-1)              │  (200px)    │
│             │                          │             │
│  • Header   │  • Visualization (top)   │  • Stats    │
│  • Modes    │  • Main Controls         │  • Info     │
│  • Info     │  • Secondary Controls    │  • Category │
│             │                          │             │
└─────────────┴──────────────────────────┴─────────────┘
```

**Why:** Consistency, professional look, predictable UX

---

### Naming Conventions

#### File Naming
```
ComponentName.jsx         → PascalCase for React components
myHook.js                 → camelCase for hooks
my-processor.js           → kebab-case for worklets
CONSTANT_NAME.js          → UPPER_SNAKE for constants
_private.css              → underscore prefix for internal
```

#### Component Exports
```javascript
// Named export (preferred)
export function MyComponent() {}

// Default export (avoid for components)
export default MyComponent; // ❌ Harder to refactor
```

#### Variable Naming
```javascript
// Boolean - is/has/should prefix
const isPlaying = true;
const hasError = false;
const shouldRender = true;

// Arrays - plural
const plugins = [];
const effects = [];

// Objects - singular
const plugin = {};
const effect = {};
```

---

### File Organization

#### Component Structure
```
MyComponent/
├── MyComponent.jsx        # Main component
├── MyComponent.css        # Styles
├── MyComponent.test.js    # Tests
├── index.js               # Barrel export
└── utils.js               # Component-specific utils
```

#### Plugin Structure
```
effects/
├── SaturatorUI.jsx           # UI component
├── saturator-processor.js    # AudioWorklet (public/worklets/)
└── presets/
    └── saturator-presets.js  # Factory presets
```

#### No Archive Folders
```
❌ components/plugins/effects/_archive/
❌ styles/_archive/
```

**Why:** Git history is the archive! No manual backup folders.

---

## 🔄 WORKFLOW (Development Workflow)

### How to Add New Plugins

**Referans:** [PLUGIN_DEVELOPMENT_QUICKSTART.md](./PLUGIN_DEVELOPMENT_QUICKSTART.md)

**Steps (15 minutes):**

```bash
# 1. Copy templates
cp PluginTemplate.jsx MyPluginUI.jsx
cp template-processor.js my-plugin-processor.js

# 2. Update names/IDs in files

# 3. Register in pluginConfig.jsx
{
  id: 'myPlugin',
  name: 'My Plugin',
  component: MyPluginUI,
  category: 'Dynamics',
  workletPath: '/worklets/effects/my-plugin-processor.js',
  workletName: 'my-plugin-processor'
}

# 4. Implement DSP logic in processor

# 5. Customize UI
- Add controls with category theming
- Add visualization
- Add presets

# 6. Test
- Audio output
- Parameters
- Presets
- Performance
```

---

### How to Migrate Old Plugins

**3 Migration Patterns:**

#### Pattern 1: Light Migration (30 min)
**For:** Simple plugins

```javascript
// Add hooks
const { isPlaying, getTimeDomainData } = useAudioPlugin(trackId, effectId);
const ghostValue = useGhostValue(param, 400);

// Update worklet listener
useEffect(() => {
  const worklet = plugin?.audioNode?.workletNode;
  if (!worklet?.port) return;
  // ... message handling
}, [plugin]);
```

#### Pattern 2: Medium Migration (45 min)
**For:** Plugins with visualization

```javascript
// Add canvas hook
const drawVisualization = useCallback((ctx, width, height) => {
  const data = getTimeDomainData();
  // ... draw
}, [getTimeDomainData]);

const { containerRef, canvasRef } = useCanvasVisualization(
  drawVisualization,
  [deps]
);
```

#### Pattern 3: Full Redesign (60 min)
**For:** Complex plugins

- Start with PluginTemplate.jsx
- Full UI redesign
- Enhanced visualization
- Preset management
- Category theming

---

### How to Test

#### Manual Testing Checklist
```
[ ] Audio output correct
[ ] All parameters work
[ ] Presets load/save
[ ] Visualization smooth (60fps)
[ ] No console errors
[ ] Theme switching works
[ ] Keyboard navigation works
[ ] Responsive to window resize
```

#### Automated Testing
```bash
# Unit tests
npm test

# Performance benchmark
import { PluginBenchmark } from '@/lib/utils/PluginBenchmark';
const bench = new PluginBenchmark('MyPlugin');
bench.run('Process', () => process(), 1000);

# Build test
npm run build
```

#### Performance Targets
- CPU usage: <2% per instance
- UI render: 60fps
- Parameter latency: <10ms
- Memory: <50MB per instance

---

### How to Document

#### Component Documentation
```javascript
/**
 * Professional rotary knob control with ghost values and category theming
 *
 * @param {number} value - Current value (0-100)
 * @param {number} ghostValue - Ghost value for visual lag
 * @param {string} category - Plugin category for theming
 * @param {'small'|'medium'|'large'} sizeVariant - Knob size
 * @param {function} onChange - Value change callback
 *
 * @example
 * <Knob
 *   value={drive}
 *   ghostValue={useGhostValue(drive, 400)}
 *   category="texture-lab"
 *   sizeVariant="large"
 *   onChange={setDrive}
 * />
 */
```

#### Plugin Documentation
Create `docs/plugins/MY_PLUGIN.md`:
```markdown
# My Plugin

**Category:** The Texture Lab
**Type:** Saturation

## Features
- Feature 1
- Feature 2

## Parameters
- DRIVE (0-100%) - Amount of saturation
- MIX (0-100%) - Dry/wet blend

## Presets
- Vocal Warmth - Subtle warmth for vocals
- Bass Power - Heavy saturation for bass

## Usage Tips
- Start with low drive
- Use mix for parallel processing
```

---

## 📊 METRICS

### Plugin Redesign Progress

**Completed:** 6/14 plugins (43%)

| Plugin | Category | Status | Complexity |
|--------|----------|--------|------------|
| Saturator | texture-lab | ✅ Day 1 | Medium |
| Compressor | dynamics-forge | ✅ Day 2 | Medium |
| TransientDesigner | dynamics-forge | ✅ Day 2 | Low |
| ModernDelay | spacetime-chamber | ✅ Day 2 | Medium |
| ModernReverb | spacetime-chamber | ✅ Day 2 | Medium |
| OrbitPanner | spacetime-chamber | ✅ Day 2 | Low |
| TidalFilter | spectral-weave | 🔲 Next | Low |
| StardustChorus | modulation-machines | 🔲 Next | Medium |
| VortexPhaser | modulation-machines | 🔲 Next | Low |
| PitchShifter | texture-lab | 🔲 Next | Medium |
| ArcadeCrusher | texture-lab | 🔲 Next | Low |
| BassEnhancer808 | dynamics-forge | 🔲 Next | High |
| AdvancedEQ | spectral-weave | 🔲 Next | High |
| OTT | dynamics-forge | 🔲 Next | High |

**Remaining Time:** ~9 hours (at current pace)

---

### Code Cleaned

**Store Cleanup:**
- usePlaybackStoreV2 → merged into usePlaybackStore
- Archive directories deleted (~161 KB)
- 8 imports updated

**Lib Cleanup:**
- 4 unused files deleted (~19 KB)
- 2 dead exports removed
- 93 files audited

**Plugin Cleanup:**
- 15 old plugin files archived
- 8 CSS backup files archived
- Zero breaking changes

**Total Removed:** ~180 KB dead code

---

### Architecture Score

**Current:** 8.5/10 (ARCHITECTURE_AUDIT_REPORT.md)

| Category | Score | Status |
|----------|-------|--------|
| Separation of Concerns | 9/10 | ✅ Excellent |
| Single Source of Truth | 9/10 | ✅ Excellent |
| Event-Driven Design | 10/10 | ✅ Perfect |
| UI Performance | 8/10 | 🟡 Good (1 RAF to fix) |
| Code Documentation | 7/10 | 🟡 Improving |
| Debug Tooling | 6/10 | 🟡 Logger needed |
| Naming Consistency | 8/10 | 🟡 Good |

**Action Items:**
1. Migrate ArrangementCanvasRenderer to UIUpdateManager
2. Implement debug logger system
3. Continue documentation improvements

---

### Build Metrics

**Build Time:** ~4.85s (optimized)
**Bundle Size:** 984.52 KB (gzipped)
**CSS Size:** 231.08 KB
**Errors:** 0
**Warnings:** Chunk size only (acceptable)

**Performance:**
- HMR: <500ms
- Cold start: ~5s
- Development server: Vite (fast)

---

## 🚀 NEXT STEPS

### Immediate Priorities (This Week)

#### 1. Complete Remaining Plugins (9 hours)
**Referans:** PLUGIN_MIGRATION_PLAN.md

**Tier 1 (2.5 hours):**
- AdvancedEQ - 45 min
- 2 more plugins

**Tier 2 (2.3 hours):**
- TidalFilter - 30 min
- StardustChorus - 45 min
- VortexPhaser - 30 min
- 1 more

**Tier 3 (2.2 hours):**
- ArcadeCrusher - 30 min
- PitchShifter - 45 min
- BassEnhancer808 - 60 min

**Goal:** 14/14 plugins redesigned

---

#### 2. Architecture Polish (2 hours)
**Referans:** ARCHITECTURE_AUDIT_REPORT.md

**Tasks:**
1. Migrate ArrangementCanvasRenderer to UIUpdateManager (1 hour)
2. Implement debug logger system (30 min)
3. Add PlaybackStore documentation (30 min)

**Goal:** Architecture score → 9/10

---

#### 3. Performance Optimization (2 hours)

**Tasks:**
1. Run benchmarks on all plugins
2. Identify bottlenecks
3. Optimize heavy visualizations
4. Profile with Chrome DevTools

**Goal:** Consistent 60fps @ 3 plugin instances

---

### Short Term (Next Month)

#### 1. Plugin Generator CLI
```bash
npm run create-plugin --name "MyPlugin" --category "Dynamics"
# Auto-scaffolds everything
```

**Benefits:**
- 5-minute plugin creation
- Zero boilerplate
- Best practices enforced

---

#### 2. Visual Preset Editor
- GUI for creating/editing presets
- A/B comparison
- Visual parameter mapping
- Export to JSON

---

#### 3. Advanced Testing
- Visual regression tests (Chromatic)
- Audio unit testing
- Integration tests
- CI/CD pipeline

---

### Mid Term (Next Quarter)

#### 1. Plugin SDK
- Public API documentation
- Developer portal
- Plugin marketplace
- Revenue sharing

---

#### 2. TypeScript Migration
- Migrate core to TypeScript
- Full type safety
- Better IDE support
- Compile-time guarantees

---

#### 3. Performance Profiler
- Visual performance timeline
- CPU/Memory tracking
- Bottleneck identification
- Automated optimization suggestions

---

### Long Term (2025-2026)

#### 1. WASM Support
- C++ DSP compilation to WASM
- Native performance
- Complex algorithms
- Cross-platform compatibility

---

#### 2. GPU Acceleration
- WebGL visualization
- Compute shaders for DSP
- Real-time spectrum analysis
- Lower CPU usage

---

#### 3. Mobile Support
- iPad-optimized UI
- Touch controls
- Responsive design
- Performance optimization

---

## 📚 APPENDIX

### File Reference Index

**Core Architecture:**
- `lib/core/PlaybackController.js` - Singleton state management
- `lib/ui/UIUpdateManager.js` - RAF consolidation
- `lib/core/EventBus.js` - Pub/sub communication
- `lib/core/BaseSingleton.js` - Singleton pattern

**Plugin Infrastructure:**
- `lib/audio/BaseAudioPlugin.js` - Plugin base class
- `lib/audio/PresetManager.js` - Preset management
- `hooks/useAudioPlugin.js` - React integration
- `lib/audio/EffectRegistry.js` - Effect registration
- `lib/audio/effects/EffectFactory.js` - Effect instantiation

**Component Library:**
- `components/controls/base/Knob.jsx` - Rotary control
- `components/controls/base/Slider.jsx` - Linear control
- `components/controls/base/ModeSelector.jsx` - Mode buttons
- `components/controls/base/ExpandablePanel.jsx` - Collapsible panel
- `components/controls/advanced/Meter.jsx` - Level meter
- `components/controls/useControlTheme.js` - Theme system

**State Management:**
- `store/usePlaybackStore.js` - Unified playback state
- `store/useArrangementStore.js` - Arrangement state
- `store/useMixerStore.js` - Mixer state
- `store/useThemeStore.js` - Theme state

**Templates:**
- `components/plugins/effects/PluginTemplate.jsx` - UI template
- `public/worklets/effects/template-processor.js` - DSP template
- `components/plugins/effects/PluginTemplate.css` - CSS template

**Documentation:**
- 38 MD files in `/docs` directory
- See git history for archived files

---

### Git Workflow

**Branch Strategy:**
```
main             → Production-ready code
development      → Integration branch
feature/*        → New features
bugfix/*         → Bug fixes
refactor/*       → Code improvements
```

**Commit Messages:**
```
feat: Add ghost value support to Knob component
fix: Resolve ModeSelector positioning bug
refactor: Consolidate playback stores
docs: Update PLUGIN_DEVELOPMENT_QUICKSTART
test: Add BaseAudioPlugin unit tests
perf: Optimize canvas rendering in visualizers
```

**Pull Request Checklist:**
```
[ ] All tests pass
[ ] Build succeeds (0 errors)
[ ] Performance benchmarks met
[ ] Documentation updated
[ ] No breaking changes (or documented)
[ ] Code review approved
```

---

### Contact & Support

**Documentation Issues:** Check this master plan first
**Bug Reports:** File issue with reproduction steps
**Feature Requests:** Discussion thread + proposal
**Code Questions:** Review architecture patterns in this doc

---

## SON GÜNCELLEME

**Tarih:** 2025-10-10
**Versiyon:** 1.0.0
**Durum:** ✅ Aktif ve Kapsamlı

**Sonraki Güncelleme:** Her plugin redesign sonrası (kalan 8 plugin)

---

**🎯 Bu doküman, DAWG projesinin tek kapsamlı kılavuzudur. Tüm kurallar, patternler, ve durumlar buradadır.**

**📖 Okuma Süresi:** 10-15 dakika
**🎓 Hedef Kitle:** Yeni geliştiriciler, future sessions, code review
**💡 Amaç:** Projenin tüm tarihini, mevcut durumunu, ve gelecek planlarını tek dokümanda toplamak

---

*"Clean code, clear architecture, consistent patterns"* - DAWG Development Philosophy
