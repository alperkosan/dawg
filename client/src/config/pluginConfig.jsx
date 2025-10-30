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
import HalfTimeUI from '@/components/plugins/effects/HalfTimeUI.jsx';
import LimiterUI from '@/components/plugins/effects/LimiterUI.jsx';
import ClipperUI from '@/components/plugins/effects/ClipperUI.jsx';
import RhythmFXUI from '@/components/plugins/effects/RhythmFXUI.jsx';

// Master Chain
import { MaximizerUI } from '@/components/plugins/effects/MaximizerUI.jsx';
import { ImagerUI } from '@/components/plugins/effects/ImagerUI.jsx';

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
      // 🎯 METHODOLOGY: Real acoustic spaces + analog equipment references
      { 
        name: 'Room', 
        description: 'Small intimate space - Studio room',
        genre: ['All Genres'],
        reference: 'Studio Room',
        settings: { size: 0.35, decay: 0.8, damping: 0.4, wet: 0.25, earlyLateMix: 0.4, preDelay: 0.015, diffusion: 0.6 } 
      },
      { 
        name: 'Hall', 
        description: 'Concert hall - Large acoustic space',
        genre: ['Classical', 'Jazz', 'Rock'],
        reference: 'Concert Hall',
        settings: { size: 0.65, decay: 2.5, damping: 0.5, wet: 0.35, earlyLateMix: 0.5, preDelay: 0.02, diffusion: 0.7 } 
      },
      { 
        name: 'Cathedral', 
        description: 'Vast sacred space - Long decay',
        genre: ['Ambient', 'Classical', 'Electronic'],
        reference: 'Cathedral Acoustics',
        settings: { size: 0.9, decay: 6.0, damping: 0.7, wet: 0.45, earlyLateMix: 0.7, preDelay: 0.03, diffusion: 0.8 } 
      },
      { 
        name: 'Plate', 
        description: 'Lexicon-style plate reverb',
        genre: ['Rock', 'Pop', 'Hip-Hop'],
        reference: 'Lexicon Plate',
        settings: { size: 0.5, decay: 1.8, damping: 0.2, wet: 0.4, earlyLateMix: 0.3, diffusion: 0.9, preDelay: 0.01 } 
      },
      { 
        name: 'Vocal', 
        description: 'Vocal plate - Warm and smooth',
        genre: ['Pop', 'R&B', 'Soul'],
        reference: 'Vocal Plate',
        settings: { size: 0.45, decay: 1.5, damping: 0.6, wet: 0.3, earlyLateMix: 0.45, preDelay: 0.015, diffusion: 0.75 } 
      },
      { 
        name: 'Ambient', 
        description: 'Infinite soundscape - Long tail',
        genre: ['Ambient', 'Electronic', 'Cinematic'],
        reference: 'Ambient Reverb',
        settings: { size: 0.95, decay: 10.0, damping: 0.8, wet: 0.6, earlyLateMix: 0.8, diffusion: 0.9, preDelay: 0.04 } 
      },
      { 
        name: 'Chamber', 
        description: 'Recording chamber - Medium decay',
        genre: ['Jazz', 'Rock', 'Pop'],
        reference: 'Chamber Reverb',
        settings: { size: 0.55, decay: 1.2, damping: 0.5, wet: 0.32, earlyLateMix: 0.5, preDelay: 0.018, diffusion: 0.7 } 
      }
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
      // 🎯 METHODOLOGY: Classic delay techniques + tempo-synced delays
      { 
        name: 'Slapback', 
        description: 'Vintage rockabilly echo - Short delay',
        genre: ['Rock', 'Country', 'Blues'],
        reference: '1950s Rockabilly',
        settings: { timeLeft: 0.08, timeRight: 0.085, feedbackLeft: 0.15, feedbackRight: 0.15, pingPong: 0.0, wet: 0.25, saturation: 0.2, filterFreq: 8000 } 
      },
      { 
        name: 'Ping-Pong', 
        description: 'Stereo bouncing delay - Classic effect',
        genre: ['Pop', 'Electronic', 'Rock'],
        reference: 'Classic Ping-Pong',
        settings: { timeLeft: 0.375, timeRight: 0.5, feedbackLeft: 0.5, feedbackRight: 0.5, pingPong: 0.9, wet: 0.4, diffusion: 0.3, filterFreq: 6000 } 
      },
      { 
        name: 'Dub', 
        description: 'Reggae-style echo - Filtered feedback',
        genre: ['Reggae', 'Dub', 'Electronic'],
        reference: 'King Tubby Style',
        settings: { timeLeft: 0.5, timeRight: 0.75, feedbackLeft: 0.7, feedbackRight: 0.7, pingPong: 0.6, wet: 0.5, filterFreq: 2000, saturation: 0.4, diffusion: 0.5 } 
      },
      { 
        name: 'Ambient', 
        description: 'Long atmospheric delay - Wide stereo',
        genre: ['Ambient', 'Electronic', 'Cinematic'],
        reference: 'Ambient Delay',
        settings: { timeLeft: 1.2, timeRight: 1.5, feedbackLeft: 0.8, feedbackRight: 0.8, pingPong: 0.3, wet: 0.6, filterFreq: 5000, diffusion: 0.8, modDepth: 0.02 } 
      },
      { 
        name: 'Tape', 
        description: 'Analog tape echo - Warm character',
        genre: ['Rock', 'Pop', 'Blues'],
        reference: 'Echoplex',
        settings: { timeLeft: 0.425, timeRight: 0.425, feedbackLeft: 0.45, feedbackRight: 0.45, pingPong: 0.0, wet: 0.35, filterFreq: 4000, saturation: 0.4, modDepth: 0.01, diffusion: 0.15 } 
      },
      { 
        name: 'Eighth Note', 
        description: 'Tempo-synced 1/8 note delay',
        genre: ['EDM', 'Hip-Hop', 'Pop'],
        reference: 'Tempo Sync',
        settings: { timeLeft: 0.25, timeRight: 0.25, feedbackLeft: 0.3, feedbackRight: 0.3, pingPong: 0.5, wet: 0.3, filterFreq: 7000, diffusion: 0.2 } 
      },
      { 
        name: 'Quarter Note', 
        description: 'Tempo-synced 1/4 note delay',
        genre: ['Rock', 'Pop', 'Electronic'],
        reference: 'Tempo Sync',
        settings: { timeLeft: 0.5, timeRight: 0.5, feedbackLeft: 0.4, feedbackRight: 0.4, pingPong: 0.7, wet: 0.35, filterFreq: 6000, diffusion: 0.3 } 
      }
    ]
  },
  'HalfTime': {
    type: 'HalfTime',
    name: 'Half Time',
    description: 'Professional time-stretching with granular synthesis',
    category: 'The Spacetime Chamber',
    story: 'Drag music through molasses - Time dilation effect',
    toneNode: 'HalfTime',
    uiComponent: HalfTimeUI,
    initialSize: { width: 900, height: 750 },
    minSize: { width: 900, height: 750 },
    defaultSettings: {
      rate: 0.5,
      smoothing: 50,
      pitchShift: -12,
      grainSize: 100,
      grainDensity: 8,
      pitchLock: 1,
      mix: 100,
      mode: 0,
      analogWarmth: 0,
      glitchAmount: 0
    },
    presets: [
      { name: 'Clean Half', settings: { rate: 0.5, smoothing: 80, pitchLock: 1, mode: 0, mix: 100 } },
      { name: 'Tape Slowdown', settings: { rate: 0.5, smoothing: 30, pitchLock: 0, analogWarmth: 40, mode: 1, mix: 100 } },
      { name: 'Granular Cloud', settings: { rate: 0.5, smoothing: 70, grainDensity: 12, pitchLock: 1, mode: 2, mix: 100 } },
      { name: 'Vinyl Drag', settings: { rate: 0.5, smoothing: 40, pitchLock: 0, analogWarmth: 60, mode: 3, mix: 100 } },
      { name: 'Glitch Stutter', settings: { rate: 0.5, smoothing: 90, grainSize: 50, grainDensity: 16, glitchAmount: 30, mode: 5, mix: 100 } },
      { name: 'Quarter Time', settings: { rate: 0.25, smoothing: 60, pitchLock: 1, mode: 0, mix: 100 } }
    ]
  },
  'Limiter': {
    type: 'Limiter',
    name: 'Limiter',
    description: 'Professional mastering-grade peak limiter with true peak detection',
    category: 'The Dynamics Forge',
    story: 'The Ceiling Guardian - Transparent loudness maximization',
    toneNode: 'Limiter',
    uiComponent: LimiterUI,
    initialSize: { width: 750, height: 680 },
    minSize: { width: 750, height: 680 },
    defaultSettings: {
      ceiling: -0.1,
      release: 100,
      attack: 0.1,
      lookahead: 5,
      knee: 0,
      stereoLink: 100,
      autoGain: 0,
      mode: 0,
      truePeak: 1,
      oversample: 4
    },
    presets: [
      { name: 'Transparent Master', settings: { ceiling: -0.1, release: 500, attack: 0.1, lookahead: 10, knee: 0.3, mode: 0, truePeak: 1, oversample: 4 } },
      { name: 'Punchy Drums', settings: { ceiling: -0.5, release: 100, attack: 1.0, lookahead: 5, knee: 0, mode: 1, truePeak: 1, oversample: 2 } },
      { name: 'Aggressive Loud', settings: { ceiling: -0.1, release: 50, attack: 0.01, lookahead: 2, knee: 0, mode: 2, autoGain: 1, truePeak: 1, oversample: 4 } },
      { name: 'Streaming Ready', settings: { ceiling: -1.0, release: 200, attack: 0.5, lookahead: 8, knee: 0.3, mode: 3, truePeak: 1, oversample: 4 } },
      { name: 'Vintage Soft', settings: { ceiling: -0.5, release: 300, attack: 5.0, lookahead: 0, knee: 0.5, mode: 4, truePeak: 0, oversample: 1 } }
    ]
  },
  'Clipper': {
    type: 'Clipper',
    name: 'Clipper',
    description: 'Aggressive peak shaping with harmonic generation',
    category: 'The Texture Lab',
    story: 'The Hard Edge - Add punch and harmonic richness',
    toneNode: 'Clipper',
    uiComponent: ClipperUI,
    initialSize: { width: 950, height: 650 },
    minSize: { width: 950, height: 650 },
    defaultSettings: {
      ceiling: 0.0,
      hardness: 100,
      harmonics: 50,
      preGain: 0,
      postGain: 0,
      mix: 100,
      mode: 0,
      dcFilter: 1,
      oversample: 2
    },
    presets: [
      { name: 'Hard Clip', settings: { mode: 0, ceiling: 0.0, hardness: 100, harmonics: 30, preGain: 0, mix: 100 } },
      { name: 'Soft Warmth', settings: { mode: 1, ceiling: 0.0, hardness: 50, harmonics: 60, preGain: 3, mix: 100 } },
      { name: 'Tube Saturation', settings: { mode: 2, ceiling: 0.0, hardness: 40, harmonics: 80, preGain: 6, mix: 100 } },
      { name: 'Diode Grit', settings: { mode: 3, ceiling: 0.0, hardness: 60, harmonics: 70, preGain: 4, mix: 100 } },
      { name: 'Wave Folder', settings: { mode: 4, ceiling: 0.0, hardness: 100, harmonics: 80, preGain: 8, mix: 100 } },
      { name: 'Lo-Fi Crush', settings: { mode: 5, ceiling: 0.0, hardness: 70, harmonics: 60, preGain: 0, mix: 100 } }
    ]
  },

  'RhythmFX': {
    type: 'RhythmFX',
    name: 'Rhythm FX',
    description: 'Infinite rhythmic possibilities - gate, stutter, glitch, repeat, reverse',
    category: 'The Rhythm Forge',
    story: 'The Groove Sculptor - Infinite rhythmic creativity',
    toneNode: 'RhythmFX',
    uiComponent: RhythmFXUI,
    initialSize: { width: 1000, height: 700 },
    minSize: { width: 1000, height: 700 },
    defaultSettings: {
      division: 16,
      chance: 100,
      intensity: 100,
      swing: 50,
      bufferSize: 500,
      fadeTime: 10,
      glitchAmount: 50,
      tapeSpeed: 100,
      mode: 0,
      bpm: 128
    },
    presets: [
      { name: 'Gate Pattern', settings: { mode: 0, division: 16, chance: 100, intensity: 100, swing: 50, fadeTime: 10, bpm: 128 } },
      { name: 'Stutter Roll', settings: { mode: 1, division: 32, chance: 100, intensity: 100, bufferSize: 100, fadeTime: 5, bpm: 128 } },
      { name: 'Repeat Loop', settings: { mode: 2, division: 8, chance: 100, intensity: 80, bufferSize: 1000, fadeTime: 15, bpm: 128 } },
      { name: 'Reverse Build', settings: { mode: 3, division: 16, chance: 100, intensity: 100, bufferSize: 500, fadeTime: 20, bpm: 128 } },
      { name: 'Glitch Mayhem', settings: { mode: 4, division: 32, chance: 75, intensity: 100, glitchAmount: 80, bufferSize: 300, bpm: 128 } },
      { name: 'Tape Stop', settings: { mode: 5, division: 8, chance: 100, intensity: 100, tapeSpeed: 50, fadeTime: 10, bpm: 128 } },
      { name: 'Trap Hi-Hat', settings: { mode: 1, division: 32, chance: 100, intensity: 100, bufferSize: 50, swing: 60, bpm: 140 } },
      { name: 'Euclidean Dream', settings: { mode: 0, division: 16, chance: 100, intensity: 100, swing: 50, fadeTime: 5, bpm: 128 } }
    ]
  },

  // === MASTER CHAIN EFFECTS ===

  'Maximizer': {
    type: 'Maximizer',
    name: 'Maximizer',
    description: 'Loudness maximizer with soft saturation and brick-wall limiting',
    category: 'The Master Chain',
    story: 'Make it louder without clipping - Professional mastering tool',
    toneNode: 'Maximizer',
    uiComponent: MaximizerUI,
    initialSize: { width: 800, height: 650 },
    minSize: { width: 800, height: 650 },
    defaultSettings: {
      inputGain: 0,
      saturation: 0.3,
      ceiling: -0.1,
      release: 0.1,
      wet: 1.0
    },
    presets: [
      { name: 'Gentle Loudness', settings: { inputGain: 2, saturation: 0.2, ceiling: -0.3, release: 0.2, wet: 1.0 } },
      { name: 'Moderate Master', settings: { inputGain: 3, saturation: 0.3, ceiling: -0.1, release: 0.1, wet: 1.0 } },
      { name: 'Aggressive Loud', settings: { inputGain: 6, saturation: 0.5, ceiling: -0.1, release: 0.05, wet: 1.0 } },
      { name: 'Warm Glue', settings: { inputGain: 4, saturation: 0.6, ceiling: -0.2, release: 0.15, wet: 1.0 } },
      { name: 'Transparent', settings: { inputGain: 2, saturation: 0.1, ceiling: -0.5, release: 0.2, wet: 1.0 } }
    ]
  },

  'Imager': {
    type: 'Imager',
    name: 'Imager',
    description: 'Stereo field sculptor with 7 character modes',
    category: 'The Master Chain',
    story: 'Shape your stereo image instantly - Professional Mid/Side processing',
    toneNode: 'Imager',
    uiComponent: ImagerUI,
    initialSize: { width: 900, height: 720 },
    minSize: { width: 900, height: 720 },
    defaultSettings: {
      width: 1.0,
      midGain: 1.0,
      sideGain: 1.0,
      wet: 1.0
    },
    presets: [
      { name: 'Mono (Bass Safe)', settings: { width: 0, midGain: 1.0, sideGain: 0, wet: 1.0 } },
      { name: 'Narrow', settings: { width: 0.5, midGain: 1.0, sideGain: 0.5, wet: 1.0 } },
      { name: 'Normal', settings: { width: 1.0, midGain: 1.0, sideGain: 1.0, wet: 1.0 } },
      { name: 'Wide', settings: { width: 1.4, midGain: 0.85, sideGain: 1.4, wet: 1.0 } },
      { name: 'Ultra Wide', settings: { width: 1.8, midGain: 0.7, sideGain: 1.8, wet: 1.0 } },
      { name: 'Enhance Sides', settings: { width: 1.5, midGain: 0.6, sideGain: 1.9, wet: 1.0 } },
      { name: 'Vocal Focus', settings: { width: 0.7, midGain: 1.3, sideGain: 0.5, wet: 1.0 } }
    ]
  }
};