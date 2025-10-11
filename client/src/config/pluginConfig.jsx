/**
 * DAWG Plugin Registry - Clean Architecture
 *
 * 14 Professional-Grade Plugins:
 * - Tier 1: Core Effects (Saturator, Compressor, OTT, EQ, Reverb, Delay)
 * - Tier 2: Creative Effects (Filter, Chorus, Phaser, Panner)
 * - Tier 3: Specialized (BitCrusher, PitchShifter, BassEnhancer, TransientDesigner)
 */

// Tier 1: Core Effects
import { SaturatorUI } from '@/components/plugins/effects/SaturatorUI.jsx';
import { AdvancedCompressorUI } from '@/components/plugins/effects/AdvancedCompressorUI.jsx';
import { OTTUI } from '@/components/plugins/effects/OTTUI.jsx';
import { AdvancedEQUI } from '@/components/plugins/effects/AdvancedEQUI.jsx';
import { ModernReverbUI } from '@/components/plugins/effects/ModernReverbUI';
import { ModernDelayUI } from '@/components/plugins/effects/ModernDelayUI';

// Tier 2: Creative Effects
import { TidalFilterUI } from '@/components/plugins/effects/TidalFilterUI.jsx';
import { StardustChorusUI } from '@/components/plugins/effects/StardustChorusUI.jsx';
import { VortexPhaserUI } from '@/components/plugins/effects/VortexPhaserUI.jsx';
import { OrbitPannerUI } from '@/components/plugins/effects/OrbitPannerUI.jsx';

// Tier 3: Specialized
import { ArcadeCrusherUI } from '@/components/plugins/effects/ArcadeCrusherUI.jsx';
import { PitchShifterUI } from '@/components/plugins/effects/PitchShifterUI.jsx';
import { BassEnhancer808UI } from '@/components/plugins/effects/BassEnhancer808UI';
import { TransientDesignerUI } from '@/components/plugins/effects/TransientDesignerUI.jsx';

/**
 * @file pluginConfig.jsx
 * @description Tüm eklentilerin merkezi tanım dosyası.
 * Her eklenti için başlangıç ve minimum pencere boyutları eklendi.
 */
export const pluginRegistry = {
  'Saturator': {
    type: 'Saturator',
    category: 'The Texture Lab',
    story: "Vintage tüp amplifikatörlerin sıcaklığı - From subtle warmth to molten distortion.",
    toneNode: 'Distortion',
    uiComponent: SaturatorUI,
    initialSize: { width: 1100, height: 750 },
    minSize: { width: 1000, height: 650 },
    defaultSettings: {
      distortion: 0.4,
      wet: 1.0,
      autoGain: 1,
      lowCutFreq: 0,
      highCutFreq: 20000,
      tone: 0,
      headroom: 0
    },
    // Presets are now managed by preset modes system
    // See: @/config/presets/saturatorPresets.js
    presets: []
  },
  'Compressor': {
    type: 'Compressor',
    category: 'The Dynamics Forge',
    story: "Kozmik Atölye'nin presi - From gentle control to aggressive limiting.",
    toneNode: 'Compressor',
    uiComponent: AdvancedCompressorUI,
    initialSize: { width: 1200, height: 800 },
    minSize: { width: 1100, height: 700 },
    defaultSettings: {
      threshold: -24,
      ratio: 4,
      attack: 0.01,
      release: 0.1,
      knee: 12,
      wet: 1.0,
      upwardRatio: 2,
      upwardDepth: 0
    },
    // Presets are now managed by preset modes system
    // See: @/config/presets/compressorPresets.js
    presets: []
  },
  'OTT': {
    type: 'OTT',
    category: 'The Dynamics Forge',
    story: "Over the top - Xfer OTT'den ilham alan multiband compression gücü.",
    toneNode: 'OTT',
    uiComponent: OTTUI,
    initialSize: { width: 1300, height: 920 },
    minSize: { width: 1200, height: 920 },
    defaultSettings: {
      depth: 0.5,
      time: 0.5,
      lowUpRatio: 3,
      lowDownRatio: 3,
      lowGain: 0,
      midUpRatio: 3,
      midDownRatio: 3,
      midGain: 0,
      highUpRatio: 3,
      highDownRatio: 3,
      highGain: 0,
      wet: 1.0
    },
    // Presets are now managed by OTT modes system
    // See: @/config/presets/ottPresets.js
    presets: []
  },
  'MultiBandEQ': {
    type: 'MultiBandEQ', category: 'The Spectral Weave', story: "Sesin tayfını, bir heykeltıraş gibi biçimlendir.",
    toneNode: 'MultiBand', uiComponent: AdvancedEQUI,
    initialSize: { width: 810, height: 620 },
    minSize: { width: 810, height: 620 },
    // --- DEĞİŞİKLİK BURADA ---
    // Her banda benzersiz ve kalıcı bir 'id' eklendi.
    defaultSettings: {
      bands: [
        { id: 'band-low', type: 'lowshelf', frequency: 120, gain: 0, q: 0.71, active: true },
        { id: 'band-mid', type: 'peaking', frequency: 1000, gain: 0, q: 1.5, active: true },
        { id: 'band-high', type: 'highshelf', frequency: 8000, gain: 0, q: 0.71, active: true },
      ],
      wet: 1.0,
    },
    // --- DEĞİŞİKLİK SONU ---
    presets: [
        { name: 'Vokal Parlaklığı', settings: { bands: [ { id: 'band-1', type: 'peaking', frequency: 4000, gain: 2, q: 1.5, active: true }, { id: 'band-2', type: 'highshelf', frequency: 10000, gain: 1, q: 0.71, active: true } ] } },
        { name: 'Bass Gücü', settings: { bands: [ { id: 'band-1', type: 'peaking', frequency: 80, gain: 3, q: 1.2, active: true }, { id: 'band-2', type: 'peaking', frequency: 400, gain: -2, q: 2, active: true } ] } },
    ]
  },
  'TidalFilter': {
    type: 'TidalFilter', category: 'The Spectral Weave', story: "Sesin üzerinden gelgit dalgaları gibi geçen ritmik filtre.",
    toneNode: 'AutoFilter', uiComponent: TidalFilterUI,
    initialSize: { width: 1235, height: 640 },
    minSize: { width: 1235, height: 640 },
    defaultSettings: { frequency: '8n', baseFrequency: 400, octaves: 2, wet: 1.0 },
    presets: [
      { name: 'Yavaş Süpürme', settings: { frequency: '1n', baseFrequency: 200, octaves: 4, wet: 1.0 } },
      { name: 'Synth Ritim', settings: { frequency: '16n', baseFrequency: 800, octaves: 3, wet: 0.7 } },
    ]
  },
  'StardustChorus': {
    type: 'StardustChorus', category: 'Modulation Machines', story: "Sesi, yıldız tozundan bir bulutla sarmalar.",
    toneNode: 'Chorus', uiComponent: StardustChorusUI,
    initialSize: { width: 630, height: 670 },
    minSize: { width: 630, height: 670 },
    defaultSettings: { frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.5 },
    presets: [
      { name: 'Hafif Işıltı', settings: { frequency: 0.8, delayTime: 4.5, depth: 0.5, wet: 0.4 } },
      { name: 'Sıvı Gitar', settings: { frequency: 2.2, delayTime: 2.8, depth: 0.8, wet: 0.6 } },
    ]
  },
  'VortexPhaser': {
    type: 'VortexPhaser', category: 'Modulation Machines', story: "Sesi, bir girdabın içine çeker.",
    toneNode: 'Phaser', uiComponent: VortexPhaserUI,
    initialSize: { width: 1170, height: 640 },
    minSize: { width: 1170, height: 640 },
    defaultSettings: { frequency: 0.5, octaves: 3, baseFrequency: 350, wet: 0.5 },
     presets: [
      { name: 'Yavaş Girdap', settings: { frequency: 0.2, octaves: 5, wet: 0.4, baseFrequency: 400 } },
      { name: 'Jet Motoru', settings: { frequency: 4, octaves: 6, baseFrequency: 600, wet: 0.7 } },
    ]
  },
  'OrbitPanner': {
    type: 'OrbitPanner', category: 'Modulation Machines', story: "Sesi, stereo alanında yörüngeye oturtur.",
    toneNode: 'AutoPanner', uiComponent: OrbitPannerUI,
    initialSize: { width: 1160, height: 780 },
    minSize: { width: 1160, height: 780 },
    defaultSettings: { frequency: '4n', depth: 1, wet: 1.0 },
    presets: [
      { name: 'Yavaş Yörünge', settings: { frequency: '2m', depth: 1, wet: 1.0 } },
      { name: 'Hızlı Döngü', settings: { frequency: '8n', depth: 0.9, wet: 0.8 } },
    ]
  },
  'ArcadeCrusher': {
    type: 'ArcadeCrusher', category: 'The Texture Lab', story: "Sesi, 8-bit bir video oyunu karakterine dönüştürür.",
    toneNode: 'BitCrusher', uiComponent: ArcadeCrusherUI,
    initialSize: { width: 1045, height: 566 },
    minSize: { width: 1045, height: 566 },
    defaultSettings: { bits: 4, wet: 1.0 },
    presets: [
      { name: 'Atari Sesi', settings: { bits: 4, wet: 0.8 } },
      { name: 'Lo-Fi Vokal', settings: { bits: 6, wet: 0.5 } },
    ]
  },
  'PitchShifter': {
    type: 'PitchShifter', category: 'The Texture Lab', story: "Sesin DNA'sıyla oynayarak onu bir deve veya cüceye dönüştürür.",
    toneNode: 'PitchShift', uiComponent: PitchShifterUI,
    initialSize: { width: 1135, height: 596 },
    minSize: { width: 1135, height: 596 },
    defaultSettings: { pitch: 0, windowSize: 0.1, wet: 1.0 },
    presets: [
      { name: 'Oktav Altı', settings: { pitch: -12, wet: 0.6, windowSize: 0.1 } },
      { name: 'Beşli Yukarı', settings: { pitch: 7, wet: 0.5, windowSize: 0.1 } },
    ]
  },
  'BassEnhancer808': {
    type: 'BassEnhancer808',
    name: '808 Bass Enhancer',
    description: 'Next-generation multiband 808 bass processing suite',
    category: 'dynamics',
    toneNode: 'BassEnhancer808',
    uiComponent: BassEnhancer808UI,
    defaultSettings: {
      saturation: 0.3,
      compression: 0.4,
      subBoost: 0.6,
      punch: 0.5,
      warmth: 0.3,
      wet: 1.0
    },
    presets: [
      {
        name: 'Sub Monster',
        settings: { saturation: 0.2, compression: 0.6, subBoost: 0.9, punch: 0.7, warmth: 0.4 }
      },
      {
        name: 'Trap Knock',
        settings: { saturation: 0.5, compression: 0.8, subBoost: 0.5, punch: 0.9, warmth: 0.3 }
      },
      {
        name: 'Drill Bass',
        settings: { saturation: 0.7, compression: 0.5, subBoost: 0.4, punch: 0.8, warmth: 0.6 }
      },
      {
        name: 'Future Bass',
        settings: { saturation: 0.4, compression: 0.3, subBoost: 0.7, punch: 0.4, warmth: 0.8 }
      },
      {
        name: 'Phonk Heavy',
        settings: { saturation: 0.8, compression: 0.9, subBoost: 0.6, punch: 1.0, warmth: 0.2 }
      },
      {
        name: 'Lofi Warm',
        settings: { saturation: 0.6, compression: 0.3, subBoost: 0.5, punch: 0.2, warmth: 0.9 }
      },
      {
        name: 'UK Drill',
        settings: { saturation: 0.9, compression: 0.7, subBoost: 0.3, punch: 0.9, warmth: 0.1 }
      }
    ],
    parameters: [
      { id: 'saturation', name: 'Saturation', min: 0, max: 1, default: 0.3, unit: '%' },
      { id: 'compression', name: 'Compression', min: 0, max: 1, default: 0.4, unit: '%' },
      { id: 'subBoost', name: 'Sub Boost', min: 0, max: 1, default: 0.6, unit: '%' },
      { id: 'punch', name: 'Punch', min: 0, max: 1, default: 0.5, unit: '%' },
      { id: 'warmth', name: 'Warmth', min: 0, max: 1, default: 0.3, unit: '%' },
      { id: 'wet', name: 'Mix', min: 0, max: 1, default: 1.0, unit: '%' }
    ]
  },
  'TransientDesigner': {
    type: 'TransientDesigner',
    category: 'The Dynamics Forge',
    story: "Shape the attack and sustain of any sound - From punchy drums to smooth textures.",
    toneNode: 'TransientDesigner',
    uiComponent: TransientDesignerUI,
    initialSize: { width: 1100, height: 660 },
    minSize: { width: 1100, height: 660 },
    defaultSettings: {
      attack: 0,
      sustain: 0,
      mix: 1.0
    },
    presets: []
  },
  'ModernReverb': {
    type: 'ModernReverb',
    name: 'Modern Reverb',
    description: 'Professional algorithmic reverb with early reflections',
    category: 'The Spacetime Chamber',
    story: 'Freeverb algoritması ile profesyonel reverb motoru',
    toneNode: 'ModernReverb',
    uiComponent: ModernReverbUI,
    initialSize: { width: 1100, height: 720 },
    minSize: { width: 1100, height: 720 },
    defaultSettings: {
      size: 0.7,
      decay: 2.5,
      damping: 0.5,
      width: 1.0,
      preDelay: 0.02,
      wet: 0.35,
      earlyLateMix: 0.5,
      diffusion: 0.7,
      modDepth: 0.3,
      modRate: 0.5
    },
    presets: [
      { name: 'Room', settings: { size: 0.35, decay: 0.8, damping: 0.4, wet: 0.25, earlyLateMix: 0.4 } },
      { name: 'Hall', settings: { size: 0.65, decay: 2.5, damping: 0.5, wet: 0.35, earlyLateMix: 0.5 } },
      { name: 'Cathedral', settings: { size: 0.9, decay: 6.0, damping: 0.7, wet: 0.45, earlyLateMix: 0.7 } },
      { name: 'Plate', settings: { size: 0.5, decay: 1.8, damping: 0.2, wet: 0.4, earlyLateMix: 0.3, diffusion: 0.9 } },
      { name: 'Vocal', settings: { size: 0.45, decay: 1.5, damping: 0.6, wet: 0.3, earlyLateMix: 0.45 } },
      { name: 'Ambient', settings: { size: 0.95, decay: 10.0, damping: 0.8, wet: 0.6, earlyLateMix: 0.8, diffusion: 0.9 } }
    ]
  },
  'ModernDelay': {
    type: 'ModernDelay',
    name: 'Modern Delay',
    description: 'Professional multi-tap stereo delay engine',
    category: 'The Spacetime Chamber',
    story: 'Multi-tap stereo delay - Ping-pong, filtre ve saturasyon',
    toneNode: 'ModernDelay',
    uiComponent: ModernDelayUI,
    initialSize: { width: 1100, height: 760 },
    minSize: { width: 1100, height: 760 },
    defaultSettings: {
      timeLeft: 0.375,
      timeRight: 0.5,
      feedbackLeft: 0.4,
      feedbackRight: 0.4,
      pingPong: 0.0,
      wet: 0.35,
      filterFreq: 8000,
      filterQ: 1.0,
      saturation: 0.0,
      modDepth: 0.0,
      modRate: 0.5,
      diffusion: 0.0,
      width: 1.0
    },
    presets: [
      { name: 'Slapback', settings: { timeLeft: 0.08, timeRight: 0.085, feedbackLeft: 0.15, feedbackRight: 0.15, pingPong: 0.0, wet: 0.25, saturation: 0.2 } },
      { name: 'Ping-Pong', settings: { timeLeft: 0.375, timeRight: 0.5, feedbackLeft: 0.5, feedbackRight: 0.5, pingPong: 0.9, wet: 0.4, diffusion: 0.3 } },
      { name: 'Dub', settings: { timeLeft: 0.5, timeRight: 0.75, feedbackLeft: 0.7, feedbackRight: 0.7, pingPong: 0.6, wet: 0.5, filterFreq: 2000, saturation: 0.4, diffusion: 0.5 } },
      { name: 'Ambient', settings: { timeLeft: 1.2, timeRight: 1.5, feedbackLeft: 0.8, feedbackRight: 0.8, pingPong: 0.3, wet: 0.6, filterFreq: 5000, diffusion: 0.8, modDepth: 0.02 } },
      { name: 'Tape', settings: { timeLeft: 0.425, timeRight: 0.425, feedbackLeft: 0.55, feedbackRight: 0.55, pingPong: 0.0, wet: 0.35, filterFreq: 4000, saturation: 0.5, modDepth: 0.01, diffusion: 0.2 } }
    ]
  }
};