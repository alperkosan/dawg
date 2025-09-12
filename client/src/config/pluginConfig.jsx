import React from 'react';

// Tüm plugin arayüzlerini import et
import { AdvancedCompressorUI } from '../ui/plugin_uis/AdvancedCompressorUI.jsx';
import { ReverbUI } from '../ui/plugin_uis/ReverbUI';
import { AdvancedEQUI } from '../ui/plugin_uis/AdvancedEQUI.jsx';
import { DelayUI } from '../ui/plugin_uis/DelayUI.jsx';
import { SaturatorUI } from '../ui/plugin_uis/SaturatorUI.jsx';
import { TidalFilterUI } from '../ui/plugin_uis/TidalFilterUI.jsx';
import { StardustChorusUI } from '../ui/plugin_uis/StardustChorusUI.jsx';
import { VortexPhaserUI } from '../ui/plugin_uis/VortexPhaserUI.jsx';
import { OrbitPannerUI } from '../ui/plugin_uis/OrbitPannerUI.jsx';
import { ArcadeCrusherUI } from '../ui/plugin_uis/ArcadeCrusherUI.jsx';
import { PitchShifterUI } from '../ui/plugin_uis/PitchShifterUI.jsx';
import { FeedbackDelayUI } from '../ui/plugin_uis/FeedbackDelayUI.jsx';
import { AtmosMachineUI } from '../ui/plugin_uis/AtmosMachineUI.jsx';
import { GhostLFOUI } from '../ui/plugin_uis/GhostLFOUI.jsx';
import { SampleMorphUI } from '../ui/plugin_uis/SampleMorphUI.jsx';

export const pluginRegistry = {
  // === DİNAMİK ATÖLYESİ ===
  'Compressor': {
    type: 'Compressor', category: 'The Dynamics Forge', story: "Kozmik Atölye'nin presi.",
    toneNode: 'Compressor', uiComponent: AdvancedCompressorUI,
    // YENİ: `knee` parametresi eklendi
    defaultSettings: { threshold: -24, ratio: 4, attack: 0.01, release: 0.1, knee: 10, wet: 1.0 },
    presets: [
      { name: 'Yumuşak Vokal Kontrolü', settings: { threshold: -18, ratio: 3, attack: 0.005, release: 0.2, knee: 15 } },
      { name: 'Sert Punch Vokal', settings: { threshold: -22, ratio: 6, attack: 0.005, release: 0.1, knee: 2, wet: 1.0 } },
      { name: 'Davul Tutkalı', settings: { threshold: -12, ratio: 2, attack: 0.03, release: 0.4, knee: 12, wet: 0.8 } },
      { name: 'Bass Güçlendirici', settings: { threshold: -20, ratio: 6, attack: 0.01, release: 0.1, knee: 8 } },
      { name: 'Sidechain Pump', settings: { threshold: -28, ratio: 10, attack: 0.002, release: 0.08, knee: 0, wet: 1.0 } }
    ]
  },
  // === TAYF DOKUMAHANESİ ===
  'MultiBandEQ': {
    type: 'MultiBandEQ', category: 'The Spectral Weave', story: "Sesin tayfını, bir heykeltıraş gibi biçimlendir.",
    toneNode: 'MultiBand', uiComponent: AdvancedEQUI,
    defaultSettings: { bands: [ { id: 1, type: 'lowshelf', frequency: 120, gain: 0, q: 0.71, active: true }, { id: 2, type: 'peaking', frequency: 1000, gain: 0, q: 1.5, active: true }, { id: 3, type: 'highshelf', frequency: 8000, gain: 0, q: 0.71, active: true }, ], wet: 1.0, },
    presets: [
        { name: 'Vokal Parlaklığı', settings: { bands: [ { id: 1, type: 'peaking', frequency: 4000, gain: 2, q: 1.5, active: true }, { id: 2, type: 'highshelf', frequency: 10000, gain: 1, q: 0.71, active: true } ] } },
        { name: 'Bass Gücü', settings: { bands: [ { id: 1, type: 'peaking', frequency: 80, gain: 3, q: 1.2, active: true }, { id: 2, type: 'peaking', frequency: 400, gain: -2, q: 2, active: true } ] } },
        { name: 'Air Boost', settings: { bands: [ { "type": "lowshelf", "frequency": 100, "gain": -3, "q": 0.7, "active": true }, { "type": "peaking", "frequency": 3000, "gain": 2, "q": 1.0, "active": true }, { "type": "highshelf", "frequency": 12000, "gain": 6, "q": 0.71, "active": true } ], wet: 1.0 } },
        { name: 'Lo-Fi Sıcaklığı', settings: { bands: [ { "type": "lowshelf", "frequency": 150, "gain": 3, "q": 0.71, "active": true }, { "type": "peaking", "frequency": 1200, "gain": -2, "q": 1.2, "active": true }, { "type": "highshelf", "frequency": 7000, "gain": -4, "q": 0.7, "active": true } ], wet: 1.0 } },
        { name: 'Telefon Efekti', settings: { bands: [ { id: 1, type: 'peaking', frequency: 1500, gain: 6, q: 3, active: true }, { id: 2, type: 'lowshelf', frequency: 500, gain: -18, q: 0.5, active: true }, { id: 3, type: 'highshelf', frequency: 3000, gain: -18, q: 0.5, active: true } ] } },
    ]
  },
  'TidalFilter': {
    type: 'TidalFilter', category: 'The Spectral Weave', story: "Sesin üzerinden gelgit dalgaları gibi geçen ritmik filtre.",
    toneNode: 'AutoFilter', uiComponent: TidalFilterUI,
    defaultSettings: { frequency: '8n', baseFrequency: 400, octaves: 2, wet: 1.0 },
    presets: [
      { name: 'Yavaş Süpürme', settings: { frequency: '1n', baseFrequency: 200, octaves: 4 } },
      { name: 'Synth Ritim', settings: { frequency: '16n', baseFrequency: 800, octaves: 3, wet: 0.7 } },
      { name: 'Wobble Bass', settings: { frequency: '1n', baseFrequency: 80, octaves: 4, wet: 1.0 } },
      { name: 'Sıvı Pad', settings: { frequency: '8n', baseFrequency: 500, octaves: 2, wet: 0.7 } }
    ]
  },
  // === UZAY-ZAMAN ODASI ===
  'Reverb': {
    type: 'Reverb', category: 'The Spacetime Chamber', story: "Unutulmuş bir tapınağın yankı odası.",
    toneNode: 'Reverb', uiComponent: ReverbUI,
    defaultSettings: { decay: 2.5, preDelay: 0.01, wet: 0.4 },
    presets: [
      { name: 'Küçük Oda', settings: { decay: 0.8, preDelay: 0.005, wet: 0.3 } },
      { name: 'Geniş Salon', settings: { decay: 6, preDelay: 0.03, wet: 0.35 } },
      { name: 'Vokal Plakası', settings: { decay: 1.8, preDelay: 0.015, wet: 0.28 } },
      { name: 'Katedral', settings: { decay: 6.5, preDelay: 0.02, wet: 0.6 } },
      { name: 'Rüya Atmosferi', settings: { decay: 10.0, preDelay: 0.03, wet: 0.9 } }
    ]
  },
  'PingPongDelay': {
    type: 'PingPongDelay', category: 'The Spacetime Chamber', story: "Sesin iki boyut arasında sektirildiği stereo gecikme.",
    toneNode: 'PingPongDelay', uiComponent: DelayUI,
    defaultSettings: { delayTime: '8n', feedback: 0.3, wet: 0.35 },
    presets: [
      { name: 'Genişletici', settings: { delayTime: '16n', feedback: 0.2, wet: 0.4 } },
      { name: 'Ritmik Yankı', settings: { delayTime: '8n.', feedback: 0.5, wet: 0.3 } },
      { name: 'Stereo Sıçrama', settings: { delayTime: '8n', feedback: 0.35, wet: 0.4 } },
      { name: 'Trap Üçlemesi', settings: { delayTime: '8t', feedback: 0.45, wet: 0.5 } }
    ]
  },
  'FeedbackDelay': {
    type: 'FeedbackDelay', category: 'The Spacetime Chamber', story: "Klasik bir teyp yankısı gibi mono gecikme.",
    toneNode: 'FeedbackDelay', uiComponent: FeedbackDelayUI,
    defaultSettings: { delayTime: '4n.', feedback: 0.4, wet: 0.4 },
    presets: [
        { name: 'Hafif Tokat', settings: { delayTime: 0.12, feedback: 0.15, wet: 0.3 } },
        { name: 'Dub Yankısı', settings: { delayTime: '4n.', feedback: 0.7, wet: 0.5 } },
    ]
  },
  // === MODÜLASYON MAKİNELERİ ===
  'StardustChorus': {
    type: 'StardustChorus', category: 'Modulation Machines', story: "Sesi, yıldız tozundan bir bulutla sarmalar.",
    toneNode: 'Chorus', uiComponent: StardustChorusUI,
    defaultSettings: { frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.5 },
    presets: [
      { name: 'Hafif Işıltı', settings: { frequency: 0.8, delayTime: 4.5, depth: 0.5, wet: 0.4 } },
      { name: 'Sıvı Gitar', settings: { frequency: 2.2, delayTime: 2.8, depth: 0.8, wet: 0.6 } },
      { name: 'Geniş Gitar', settings: { frequency: 1.2, delayTime: 4, depth: 0.8, wet: 0.6 } },
      { name: 'Işıltılı Pad', settings: { frequency: 0.8, delayTime: 5.5, depth: 0.9, wet: 0.7 } }
    ]
  },
  'VortexPhaser': {
    type: 'VortexPhaser', category: 'Modulation Machines', story: "Sesi, bir girdabın içine çeker.",
    toneNode: 'Phaser', uiComponent: VortexPhaserUI,
    // YENİ: `baseFrequency` eklendi
    defaultSettings: { frequency: 0.5, octaves: 3, baseFrequency: 350, wet: 0.5 },
     presets: [
      { name: 'Yavaş Girdap', settings: { frequency: 0.2, octaves: 5, wet: 0.4, baseFrequency: 400 } },
      { name: 'Jet Motoru', settings: { frequency: 4, octaves: 6, baseFrequency: 600, wet: 0.7 } },
      { name: 'Psikedelik Süpürme', settings: { frequency: 0.4, octaves: 4, baseFrequency: 250, wet: 0.7 } },
      { name: 'Hafif Hareket', settings: { frequency: 0.2, octaves: 2, baseFrequency: 800, wet: 0.3 } }
    ]
  },
  'OrbitPanner': {
    type: 'OrbitPanner', category: 'Modulation Machines', story: "Sesi, stereo alanında yörüngeye oturtur.",
    toneNode: 'AutoPanner', uiComponent: OrbitPannerUI,
    defaultSettings: { frequency: '4n', depth: 1, wet: 1.0 },
    presets: [
      { name: 'Yavaş Yörünge', settings: { frequency: '2m', depth: 1, wet: 1.0 } },
      { name: 'Hızlı Döngü', settings: { frequency: '8n', depth: 0.9, wet: 0.8 } },
      { name: 'Titreşim', settings: { frequency: '16n', depth: 0.5 } },
    ]
  },
  // === DOKU LABORATUVARI ===
  'Saturator': {
    type: 'Saturator', category: 'The Texture Lab', story: "Sese analog bir lambanın sıcaklığını katar.",
    toneNode: 'Distortion', uiComponent: SaturatorUI,
    defaultSettings: { distortion: 0.4, wet: 1.0 },
    presets: [
      { name: 'Bant Sıcaklığı', settings: { distortion: 0.25, wet: 0.8 } },
      { name: 'Analog Isı', settings: { distortion: 0.6, wet: 1.0 } },
      { name: 'Kirli Fuzz', settings: { distortion: 0.8, wet: 0.6 } },
    ]
  },
  'ArcadeCrusher': {
    type: 'ArcadeCrusher', category: 'The Texture Lab', story: "Sesi, 8-bit bir video oyunu karakterine dönüştürür.",
    toneNode: 'BitCrusher', uiComponent: ArcadeCrusherUI,
    defaultSettings: { bits: 4, wet: 1.0 },
    presets: [
      { name: 'Atari Sesi', settings: { bits: 4, wet: 0.8 } },
      { name: 'Lo-Fi Vokal', settings: { bits: 6, wet: 0.5 } },
      { name: 'Gameboy', settings: { bits: 6, wet: 1.0 } },
      { name: 'Arcade Kaosu', settings: { bits: 3, wet: 0.9 } }
    ]
  },
  'PitchShifter': {
    type: 'PitchShifter', category: 'The Texture Lab', story: "Sesin DNA'sıyla oynayarak onu bir deve veya cüceye dönüştürür.",
    toneNode: 'PitchShift', uiComponent: PitchShifterUI,
    // YENİ: `windowSize` eklendi
    defaultSettings: { pitch: 0, windowSize: 0.1, wet: 1.0 },
    presets: [
      { name: 'Oktav Altı', settings: { pitch: -12, wet: 0.6, windowSize: 0.1 } },
      { name: 'Beşli Yukarı', settings: { pitch: 7, wet: 0.5, windowSize: 0.1 } },
      { name: 'İnce Ayar Kalınlaştırma', settings: { pitch: 0, wet: 1.0, windowSize: 0.03 } },
      { name: 'Demon Vokali', settings: { pitch: -5, wet: 0.8, windowSize: 0.2 } }
    ]
  },
  'AtmosMachine': {
    type: 'AtmosMachine',
    category: 'Yaratıcı Efektler',
    story: "Sıradan bir sesi, yaşayan, nefes alan bir atmosfere dönüştür.",
    toneNode: 'AtmosChain', // AudioEngine'de oluşturduğumuz yeni builder'a işaret ediyor
    uiComponent: AtmosMachineUI,
    // Bunlar artık ToneJS parametreleri değil, bizim makro kontrollerimiz
    defaultSettings: { size: 0.3, movement: 0.2, width: 0.5, character: 0.1, wet: 1.0 },
    presets: [
      { name: 'Uzay Mekiği', settings: { size: 0.8, movement: 0.1, width: 1.0, character: 0.1 } },
      { name: 'Okyanus Dibi', settings: { size: 0.6, movement: 0.05, width: 0.7, character: 0.3 } },
      { name: 'VHS Kaset', settings: { size: 0.2, movement: 0.4, width: 0.3, character: 0.8 } },
      { name: 'Melek Korosu', settings: { size: 1.0, movement: 0.15, width: 1.0, character: 0.0 } },
    ]
  },
  'GhostLFO': {
      type: 'GhostLFO',
      category: 'Ritim & Zaman',
      story: "Sample'ları ele geçir, zamanı bük ve karanlık ritimler yarat.",
      toneNode: 'GhostLFOChain',
      uiComponent: GhostLFOUI,
      defaultSettings: { rate: '8n', stretch: 0.5, atmosphere: 0.3, glitch: 0.1, wet: 1.0 },
      presets: [
          { name: 'Phonk Drift', settings: { rate: '8t', stretch: 0.4, atmosphere: 0.5, glitch: 0.2 } },
          { name: 'Slowed + Reverb', settings: { rate: '1n', stretch: 0.35, atmosphere: 0.8, glitch: 0.1 } },
          { name: 'Drill Stutter', settings: { rate: '16t', stretch: 0.5, atmosphere: 0.2, glitch: 0.4 } },
          { name: 'Ambient Texture', settings: { rate: '2n', stretch: 0.25, atmosphere: 1.0, glitch: 0.8 } },
      ]
  },
  'SampleMorph': {
      type: 'SampleMorph',
      category: 'Ritim & Zaman',
      story: "Zamanı ve dokuyu parçala. Sample'ları yeniden yarat.",
      // ToneNode'u yeni ve güçlü builder'ımıza yönlendiriyoruz
      toneNode: 'SampleManipulator',
      uiComponent: SampleMorphUI,
      // Varsayılan ayarlar UI ile uyumlu kalıyor, çeviriyi motor içinde yapacağız
      defaultSettings: {
          mode: 'normal',
          randomness: 0,
          retrigger: 0,
          grainSize: 0.2,
          overlap: 0.1,
          sliceLength: 1.0,
          wet: 1.0
      },
      presets: [
          { name: 'Hızlı Tekrar', settings: { mode: 'stutter', retrigger: 0.8, grainSize: 0.1, sliceLength: 0.25 } },
          { name: 'Ters Yankı', settings: { mode: 'reverse', retrigger: 0.2, grainSize: 0.5, sliceLength: 1.0 } },
          { name: 'Sarhoş Piyano', settings: { mode: 'normal', randomness: 0.7, grainSize: 0.4, sliceLength: 0.8 } },
          { name: 'Yarı Hız', settings: { mode: 'halftime', retrigger: 0, grainSize: 0.6, sliceLength: 1.0 } },
      ]
  },
};