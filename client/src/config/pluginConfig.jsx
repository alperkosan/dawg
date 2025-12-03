/**
 * DAWG Plugin Registry - Clean Architecture
 *
 * 14 Professional-Grade Plugins:
 * - Tier 1: Core Effects (Saturator, Compressor, OTT, EQ, Reverb, Delay)
 * - Tier 2: Creative Effects (Filter, Chorus, Phaser, Panner)
 * - Tier 3: Specialized (BitCrusher, PitchShifter, BassEnhancer, TransientDesigner)
 */

// Tier 1: Core Effects
import SaturatorUI_V2 from '@/components/plugins/effects/SaturatorUI_V2'; // ✨ v2.0
import AdvancedCompressorUI_V2 from '@/components/plugins/effects/AdvancedCompressorUI_V2'; // ✨ v2.0
import OTTUI_V2 from '@/components/plugins/effects/OTTUI_V2'; // ✨ v2.0
import { AdvancedEQUI } from '@/components/plugins/effects/AdvancedEQUI.jsx';
import MultiBandEQUI_V2 from '@/components/plugins/effects/MultiBandEQUI_V2.jsx'; // ✨ v2.0
import ModernReverbUI_V2 from '@/components/plugins/effects/ModernReverbUI_V2'; // ✨ v2.0
import ModernDelayUI_V2 from '@/components/plugins/effects/ModernDelayUI_V2'; // ✨ v2.0

// Presets
import { EQ_FACTORY_PRESETS } from '@/config/presets/eqPresets.js';
import { delayPresets } from '@/config/presets/delayPresets.js';
import { saturatorPresets } from '@/config/presets/saturatorPresets_simple.js';
import { compressorPresets } from '@/config/presets/compressorPresets_simple.js';
import { ottPresets } from '@/config/presets/ottPresets.js';
import { tidalFilterPresets } from '@/config/presets/tidalFilterPresets.js';
import { stardustChorusPresets } from '@/config/presets/stardustChorusPresets.js';
import { vortexPhaserPresets } from '@/config/presets/vortexPhaserPresets.js';
import { orbitPannerPresets } from '@/config/presets/orbitPannerPresets.js';
import { arcadeCrusherPresets } from '@/config/presets/arcadeCrusherPresets.js';
import { pitchShifterPresets } from '@/config/presets/pitchShifterPresets.js';
import { bassEnhancer808Presets } from '@/config/presets/bassEnhancer808Presets.js';
import { transientDesignerPresets } from '@/config/presets/transientDesignerPresets.js';
import { halfTimePresets } from '@/config/presets/halfTimePresets.js';
import { limiterPresets } from '@/config/presets/limiterPresets.js';
import { clipperPresets } from '@/config/presets/clipperPresets.js';
import { rhythmFXPresets } from '@/config/presets/rhythmFXPresets.js';
import { maximizerPresets } from '@/config/presets/maximizerPresets.js';
import { imagerPresets } from '@/config/presets/imagerPresets.js';
import { reverbPresets } from '@/config/presets/reverbPresets.js';

// Tier 2: Creative Effects
import TidalFilterUI_V2 from '@/components/plugins/effects/TidalFilterUI_V2'; // ✨ v2.0
import StardustChorusUI_V2 from '@/components/plugins/effects/StardustChorusUI_V2'; // ✨ v2.0
import VortexPhaserUI_V2 from '@/components/plugins/effects/VortexPhaserUI_V2'; // ✨ v2.0
import OrbitPannerUI_V2 from '@/components/plugins/effects/OrbitPannerUI_V2'; // ✨ v2.0

// Tier 3: Specialized
import ArcadeCrusherUI_V2 from '@/components/plugins/effects/ArcadeCrusherUI_V2'; // ✨ v2.0
import PitchShifterUI_V2 from '@/components/plugins/effects/PitchShifterUI_V2'; // ✨ v2.0
import BassEnhancer808UI_V2 from '@/components/plugins/effects/BassEnhancer808UI_V2'; // ✨ v2.0
import TransientDesignerUI_V2 from '@/components/plugins/effects/TransientDesignerUI_V2'; // ✨ v2.0
import HalfTimeUI_V2 from '@/components/plugins/effects/HalfTimeUI_V2'; // ✨ v2.0
import LimiterUI_V2 from '@/components/plugins/effects/LimiterUI_V2'; // ✨ v2.0
import ClipperUI_V2 from '@/components/plugins/effects/ClipperUI_V2'; // ✨ v2.0
import RhythmFXUI_V2 from '@/components/plugins/effects/RhythmFXUI_V2'; // ✨ v2.0

// Master Chain
import MaximizerUI_V2 from '@/components/plugins/effects/MaximizerUI_V2'; // ✨ v2.0
import ImagerUI_V2 from '@/components/plugins/effects/ImagerUI_V2'; // ✨ v2.0

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
    toneNode: 'Saturator',
    uiComponent: SaturatorUI_V2,
    initialSize: { width: 1100, height: 750 },
    minSize: { width: 1000, height: 650 },
    defaultSettings: {
      distortion: 0.25,  // More conservative starting point
      wet: 0.7,          // Blend for musicality instead of 100% wet
      autoGain: 1,
      lowCutFreq: 20,    // Full range
      highCutFreq: 20000,
      tone: 0,
      headroom: 0,
      multiband: 0,
      lowMidCrossover: 250,
      midHighCrossover: 2500,
      lowDrive: 1.0,
      midDrive: 1.0,
      highDrive: 1.0,
      lowMix: 1.0,
      midMix: 1.0,
      highMix: 1.0,
      // ✅ NEW: Oversampling, Drive Curve, and Tape Modeling
      oversampling: 2,    // 2x oversampling by default
      driveCurve: 3,      // Tube mode by default
      tapeBias: 0.5,
      tapeWow: 0,
      tapeFlutter: 0,
      tapeSpeed: 1.0
    },
    // ✨ v2.0: Factory presets managed by PresetManager
    // See: @/config/presets/saturatorPresets.js
    presets: saturatorPresets
  },
  'Compressor': {
    type: 'Compressor',
    category: 'The Dynamics Forge',
    story: "Kozmik Atölye'nin presi - From gentle control to aggressive limiting.",
    toneNode: 'Compressor',
    uiComponent: AdvancedCompressorUI_V2,
    initialSize: { width: 1200, height: 800 },
    minSize: { width: 1100, height: 700 },
    defaultSettings: {
      threshold: -20,      // Less aggressive starting point
      ratio: 3,            // More musical ratio (3:1)
      attack: 0.005,       // 5ms - versatile medium-fast attack
      release: 0.15,       // 150ms - more musical release
      knee: 10,            // Soft knee for transparency
      wet: 1.0,
      lookahead: 3,        // Professional default
      stereoLink: 100,     // Full stereo link
      autoMakeup: 0,       // Disabled by default
      upwardRatio: 2,
      upwardDepth: 0,      // Disabled by default
      // 🎯 NEW v2.0: Detection mode defaults
      detectionMode: 0,    // 0=Peak (default), 1=RMS
      rmsWindow: 10,       // 10ms RMS window (SSL-style)
      // 🎯 NEW: Compressor model (0=Clean/VCA, 1=Opto, 2=FET)
      compressorModel: 0, // 0=Clean/VCA (transparent), 1=Opto (musical), 2=FET (aggressive)
      // 🎯 NEW: Mix/Blend control for parallel compression
      mix: 100,            // 100% = full compression, 0% = dry (parallel compression)
      // Sidechain defaults
      scEnable: 0,
      scGain: 0,
      scFilterType: 1,     // 1=HPF
      scFreq: 150,
      scListen: 0
    },
    // ✨ v2.0: Factory presets managed by PresetManager
    // See: @/config/presets/compressorPresets.js
    presets: compressorPresets
  },
  'OTT': {
    type: 'OTT',
    category: 'The Dynamics Forge',
    story: "Over the top - Xfer OTT'den ilham alan multiband compression gücü.",
    toneNode: 'OTT',
    uiComponent: OTTUI_V2, // ✨ v2.0
    initialSize: { width: 1300, height: 920 },
    minSize: { width: 1200, height: 920 },
    defaultSettings: {
      depth: 0.3,          // Gentler starting point (30%)
      time: 0.5,           // Medium timing
      lowUpRatio: 2.5,     // Gentler low-end compression
      lowDownRatio: 2.5,
      lowGain: 0,
      midUpRatio: 3,       // Standard mid-range
      midDownRatio: 3,
      midGain: 0,
      highUpRatio: 3,      // Standard high-end
      highDownRatio: 3,
      highGain: 0,
      wet: 1.0
    },
    // ✨ v2.0: Factory presets managed by PresetManager
    // See: @/config/presets/ottPresets.js
    presets: ottPresets
  },
  'MultiBandEQ': {
    type: 'MultiBandEQ',
    category: 'The Spectral Weave',
    story: "Shape the spectrum like a sculptor - v2.0 with WebGL analyzer",
    toneNode: 'MultiBandEQ',
    uiComponent: MultiBandEQUI_V2, // ✨ v2.0
    initialSize: { width: 1200, height: 700 },
    minSize: { width: 1000, height: 600 },
    // --- DEĞİŞİKLİK BURADA ---
    // Her banda benzersiz ve kalıcı bir 'id' eklendi.
    defaultSettings: {
      bands: [
        { id: 'band-1', type: 'highpass', frequency: 30, gain: 0, q: 0.71, active: true },    // Sub rumble filter
        { id: 'band-2', type: 'lowshelf', frequency: 100, gain: 0, q: 0.71, active: true },   // Bass shelf
        { id: 'band-3', type: 'peaking', frequency: 500, gain: 0, q: 1.0, active: true },     // Low-mid
        { id: 'band-4', type: 'peaking', frequency: 2000, gain: 0, q: 1.0, active: true },    // Presence
        { id: 'band-5', type: 'highshelf', frequency: 10000, gain: 0, q: 0.71, active: true } // Air
      ],
      wet: 1.0,
      output: 1.0
    },
    // v2.0: Factory presets managed by PresetManager
    presets: EQ_FACTORY_PRESETS
  },
  'TidalFilter': {
    type: 'TidalFilter',
    category: 'The Spectral Weave',
    story: "Professional state-variable filter with smooth morphing - v2.0 with spectral visualization",
    toneNode: 'TidalFilter',
    uiComponent: TidalFilterUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      cutoff: 1000,
      resonance: 0.5,
      filterType: 0, // 0=Lowpass, 0.5=Bandpass, 0.85=Highpass, 1=Notch
      drive: 1.0,
      wet: 1.0,
      // ✅ NEW: Filter model (0=State-Variable, 1=Moog, 2=Korg, 3=Oberheim)
      filterModel: 0,
      // ✅ NEW: LFO Modulation
      lfoEnabled: 0,
      lfoRate: 1.0,
      lfoDepth: 0.5,
      lfoShape: 0, // 0=sine, 1=triangle, 2=square, 3=sawtooth
      lfoTempoSync: 0,
      lfoNoteDivision: 3, // 1/4 note
      bpm: 120
    },
    // ✨ v2.0: Factory presets managed by PresetManager
    // See: @/config/presets/tidalFilterPresets.js
    presets: tidalFilterPresets
  },
  'StardustChorus': {
    type: 'StardustChorus',
    category: 'Cosmic Modulation',
    story: "Professional chorus with galaxy particle visualization - v2.0 with rich spatial effects",
    toneNode: 'StardustChorus',
    uiComponent: StardustChorusUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      rate: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      voices: 3,
      stereoWidth: 0.5,
      wet: 0.5
    },
    // ✨ v2.0: Factory presets managed by PresetManager
    // See: @/config/presets/stardustChorusPresets.js
    presets: stardustChorusPresets
  },
  'VortexPhaser': {
    type: 'VortexPhaser',
    category: 'Cosmic Modulation',
    story: "Professional phaser with spectral visualization - v2.0 with sweeping notch filters",
    toneNode: 'VortexPhaser',
    uiComponent: VortexPhaserUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 750 },
    minSize: { width: 1000, height: 650 },
    defaultSettings: {
      rate: 0.5,
      depth: 0.6,
      stages: 4,
      feedback: 0.3,
      stereoPhase: 90,
      wet: 0.7
    },
    // ✨ v2.0: Factory presets managed by PresetManager
    // See: @/config/presets/vortexPhaserPresets.js
    presets: vortexPhaserPresets
  },
  'OrbitPanner': {
    type: 'OrbitPanner',
    category: 'Cosmic Modulation',
    story: "Professional auto-panner with orbit visualization - v2.0",
    toneNode: 'OrbitPanner',
    uiComponent: OrbitPannerUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      rate: 1.0,
      depth: 0.7,
      shape: 0,
      stereoWidth: 1.0,
      wet: 1.0,
      // ✅ NEW: Tempo sync
      tempoSync: 0,
      noteDivision: 3, // 1/4 note
      bpm: 120
    },
    presets: orbitPannerPresets
  },
  'ArcadeCrusher': {
    type: 'ArcadeCrusher',
    category: 'The Texture Lab',
    story: "Professional bit-crushing with retro arcade aesthetics - v2.0",
    toneNode: 'ArcadeCrusher',
    uiComponent: ArcadeCrusherUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      bitDepth: 8,
      sampleRateReduction: 2,
      crush: 0.5,
      wet: 1.0
    },
    presets: arcadeCrusherPresets
  },
  'PitchShifter': {
    type: 'PitchShifter',
    category: 'The Texture Lab',
    story: "Professional pitch-shifting with harmonic visualization - v2.0",
    toneNode: 'PitchShifter',
    uiComponent: PitchShifterUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      pitch: 0,
      fineTune: 0,
      formantShift: 0,
      quality: 1,        // 0=Fast, 1=Normal, 2=High
      // ✅ NEW: Pitch Algorithm (0=PSOLA, 1=Phase Vocoder, 2=Elastique-like)
      pitchAlgorithm: 1,
      // ✅ NEW: Formant Preservation (0=off, 1=on)
      formantPreservation: 0,
      inputGain: 0,
      outputGain: 0,
      wet: 1.0
      // Note: windowSize removed - now auto-optimized to prevent phaser artifacts
    },
    presets: pitchShifterPresets
  },
  'BassEnhancer808': {
    type: 'BassEnhancer808',
    category: 'The Dynamics Forge',
    story: "Professional 808-style bass enhancement with TASTE & TEXTURE - v2.0",
    toneNode: 'BassEnhancer808',
    uiComponent: BassEnhancer808UI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      subBoost: 0.5,
      saturation: 0.5,
      punch: 0.5,
      taste: 0.5,
      texture: 0.5,
      wet: 1.0
    },
    presets: bassEnhancer808Presets
  },
  'TransientDesigner': {
    type: 'TransientDesigner',
    category: 'The Dynamics Forge',
    story: "Shape the attack and sustain of any sound - From punchy drums to smooth textures - v2.0",
    toneNode: 'TransientDesigner',
    uiComponent: TransientDesignerUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      attack: 0,
      sustain: 0,
      mix: 1.0,
      // ✅ NEW: Frequency Targeting
      frequencyTargeting: 0, // 0=Full, 1=Low, 2=Mid, 3=High
      lowAttack: 0,
      lowSustain: 0,
      midAttack: 0,
      midSustain: 0,
      highAttack: 0,
      highSustain: 0,
      lowCrossover: 200, // Hz
      highCrossover: 5000 // Hz
    },
    presets: transientDesignerPresets
  },
  'ModernReverb': {
    type: 'ModernReverb',
    name: 'Modern Reverb',
    description: 'Professional algorithmic reverb with early reflections',
    category: 'The Spacetime Chamber',
    story: 'Freeverb algoritması ile profesyonel reverb motoru',
    toneNode: 'ModernReverb',
    uiComponent: ModernReverbUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 720 },
    minSize: { width: 1100, height: 720 },
    defaultSettings: {
      size: 0.5,         // Medium room - more versatile
      decay: 1.5,        // Shorter decay for general use
      damping: 0.5,
      width: 1.0,
      preDelay: 0.015,   // 15ms - natural pre-delay
      wet: 0.25,         // More conservative mix
      earlyLateMix: 0.5,
      diffusion: 0.7,
      modDepth: 0.3,
      modRate: 0.5,
      lowCut: 100,
      highCut: 20000,    // ✅ NEW: High cut filter
      shimmer: 0.0,
      reverbAlgorithm: 0 // ✅ NEW: Room algorithm by default
    },
    // ✨ v2.0: Factory presets managed by PresetManager
    // See: @/config/presets/reverbPresets.js
    presets: reverbPresets
  },
  'ModernDelay': {
    type: 'ModernDelay',
    name: 'Modern Delay',
    description: 'Professional multi-tap stereo delay engine',
    category: 'The Spacetime Chamber',
    story: 'Multi-tap stereo delay - Ping-pong, filtre ve saturasyon',
    toneNode: 'ModernDelay',
    uiComponent: ModernDelayUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 760 },
    minSize: { width: 1100, height: 760 },
    defaultSettings: {
      timeLeft: 0.375,     // 3/8 note (dotted eighth @ 120 BPM)
      timeRight: 0.5,      // Quarter note @ 120 BPM
      feedbackLeft: 0.4,   // Moderate feedback
      feedbackRight: 0.4,
      pingPong: 0,         // No ping-pong by default
      wet: 0.35,           // Conservative mix
      filterFreq: 8000,
      saturation: 0.0,     // Off by default
      diffusion: 0.0,      // Off by default
      width: 1.0,          // Normal stereo width
      // ✅ NEW: Delay model, tempo sync, and note division
      delayModel: 0,       // Digital by default
      tempoSync: 0,        // Off by default
      noteDivision: 3,     // 1/4 note by default
      bpm: 120             // Default BPM
    },
    // ✨ v2.0: Factory presets managed by PresetManager
    // See: @/config/presets/delayPresets.js
    presets: delayPresets
  },
  'HalfTime': {
    type: 'HalfTime',
    category: 'The Spacetime Chamber',
    story: 'Professional time-stretching with granular synthesis - v2.0',
    toneNode: 'HalfTime',
    uiComponent: HalfTimeUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      rate: 0.5,
      smoothing: 50,
      pitchShift: -12,
      grainSize: 100,
      grainDensity: 8,
      pitchLock: 1,
      mix: 100,
      reverse: 0
    },
    presets: halfTimePresets
  },
  'Limiter': {
    type: 'Limiter',
    name: 'Limiter',
    description: 'Professional mastering-grade peak limiter with true peak detection',
    category: 'The Dynamics Forge',
    story: 'Professional mastering-grade peak limiter with true peak detection - v2.0',
    toneNode: 'Limiter',
    uiComponent: LimiterUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      ceiling: -1.0,       // Streaming-era standard (-1dB TP)
      release: 100,
      attack: 0.1,
      lookahead: 5,
      knee: 0.2,           // Slight knee for transparency
      stereoLink: 100,
      autoGain: 0,         // Manual control
      mode: 0,             // Transparent mode
      truePeak: 1,
      oversample: 4
    },
    presets: limiterPresets
  },
  'Clipper': {
    type: 'Clipper',
    category: 'The Texture Lab',
    story: 'Aggressive peak shaping with harmonic generation - v2.0',
    toneNode: 'Clipper',
    uiComponent: ClipperUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      ceiling: 0.0,
      hardness: 100,
      harmonics: 50,
      preGain: 0,
      postGain: 0,
      mix: 100,
      mode: 0,
      curve: 1,
      dcFilter: 1,
      oversample: 2
    },
    presets: clipperPresets
  },
  'RhythmFX': {
    type: 'RhythmFX',
    name: 'Rhythm FX',
    description: 'Infinite rhythmic possibilities - gate, stutter, glitch, repeat, reverse',
    category: 'The Rhythm Forge',
    story: 'Infinite rhythmic possibilities - gate, stutter, glitch, repeat, reverse - v2.0',
    toneNode: 'RhythmFX',
    uiComponent: RhythmFXUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
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
      bpm: 128,
      tempoSync: 0,
      noteDivision: 0.25
    },
    presets: rhythmFXPresets
  },

  // === MASTER CHAIN EFFECTS ===

  'Maximizer': {
    type: 'Maximizer',
    name: 'Maximizer',
    description: 'Loudness maximizer with soft saturation and brick-wall limiting',
    category: 'The Master Chain',
    story: 'Loudness maximizer with soft saturation and brick-wall limiting - v2.0',
    toneNode: 'Maximizer',
    uiComponent: MaximizerUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      inputGain: 2,        // Gentle gain for audible maximizing
      saturation: 0.2,     // Conservative saturation
      ceiling: -0.5,       // Safer ceiling for streaming
      release: 0.15,
      wet: 1.0,
      lookahead: 3,        // Professional default
      truePeak: 1
    },
    presets: maximizerPresets
  },
  'Imager': {
    type: 'Imager',
    category: 'The Master Chain',
    story: 'Professional multiband stereo imaging - v2.0',
    toneNode: 'Imager',
    uiComponent: ImagerUI_V2, // ✨ v2.0
    initialSize: { width: 1100, height: 700 },
    minSize: { width: 1000, height: 600 },
    defaultSettings: {
      band1Freq: 100,
      band2Freq: 600,
      band3Freq: 3000,
      band4Freq: 6000,
      band1Width: 0,
      band2Width: 0,
      band3Width: 0,
      band4Width: 0,
      globalWidth: 1.0,
      stereoize: 0
    },
    presets: imagerPresets
  }
};