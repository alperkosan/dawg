import { INSTRUMENT_TYPES, MIXER_TRACK_TYPES } from './constants';

// =========================================================================
// === NOTA ve PATTERN ÜRETİM MERKEZİ ===
// =========================================================================

const defaultNote = (time, pitch = 'C4', velocity = 1.0, duration = '16n') => ({
  id: `note_${time}_${pitch}_${Math.random().toString(36).substring(7)}`,
  time, pitch, velocity, duration
});

// --- DÜZELTME: Anahtar isimleri (keys) standart hale getirildi (boşluksuz, küçük harf) ---
const trapNotes = {
  kick: [0, 6, 10, 16, 22, 26, 32, 38, 42, 48, 54, 58].map(t => defaultNote(t, 'C4', 1.0)),
  snare: [8, 24, 40, 56].map(t => defaultNote(t, 'C4', 0.9)),
  'hi-hat': Array.from({ length: 32 }).map((_, i) => defaultNote(i * 2, 'F#4', 0.6 + Math.random() * 0.1)),
  openhat: [4, 20, 36, 52].map(t => defaultNote(t, 'G#4', 0.7, '8n')),
  wobblebass: [
    { t: 0, p: 'C2', d: '2n' }, { t: 8, p: 'C2', d: '4n' }, { t: 12, p: 'G#1', d: '4n' },
    { t: 16, p: 'G1', d: '2n' }, { t: 24, p: 'G1', d: '4n' }, { t: 28, p: 'F1', d: '4n' },
  ].map(n => defaultNote(n.t, n.p, 1.0, n.d)),
  plucklead: [
    { t: 0, p: 'G4' }, { t: 2, p: 'C5' }, { t: 4, p: 'D#5' }, { t: 6, p: 'G5' },
    { t: 16, p: 'F4' }, { t: 18, p: 'G#4' }, { t: 20, p: 'C5' }, { t: 22, p: 'F5' },
  ].map(n => defaultNote(n.t, n.p, 0.8, '8n')),
  etherealpad: [
      {t: 0, p: 'G#3', d: '1n'}, {t: 16, p: 'G3', d: '1n'}, {t: 32, p: 'F3', d: '1n'}, {t: 48, p: 'D#3', d: '1n'}
  ].map(n => defaultNote(n.t, n.p, 0.7, n.d))
};

const houseNotes = {
    kick: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60].map(t => defaultNote(t, 'C4', 1.0)),
    clap: [8, 24, 40, 56].map(t => defaultNote(t, 'C4', 0.9)),
    offbeathat: [2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62].map(t => defaultNote(t, 'F#4', 0.7)),
    chicagopiano: [
        {t: 0, p: 'A#3', d: '8n'}, {t: 2, p: 'C4', d: '8n'}, {t: 4, p: 'D#4', d: '8n'}, {t: 6, p: 'G4', d: '8n'},
        {t: 16, p: 'G#3', d: '8n'}, {t: 18, p: 'C4', d: '8n'}, {t: 20, p: 'D4', d: '8n'}, {t: 22, p: 'F4', d: '8n'},
    ].map(n => defaultNote(n.t, n.p, 0.85, n.d)),
    deepbass: [
        {t: 0, p: 'D#2', d: '4n'}, {t: 4, p: 'D#2', d: '4n'}, {t: 8, p: 'D#2', d: '4n'}, {t: 12, p: 'D#2', d: '4n'},
    ].map(n => defaultNote(n.t, n.p, 1.0, n.d))
};

const ambientNotes = {
    evolvingpad: [{t: 0, p: 'C3', d: '16n'}].map(n => defaultNote(n.t, n.p, 0.8, n.d)),
    crystalkeys: [
        {t: 0, p: 'G5'}, {t: 8, p: 'C5'}, {t: 16, p: 'D#5'}, {t: 28, p: 'A#4'},
        {t: 32, p: 'F5'}, {t: 40, p: 'G4'}, {t: 48, p: 'C5'}, {t: 60, p: 'G5'},
    ].map(n => defaultNote(n.t, n.p, 0.7, '2n')),
    subbassdrone: [{t: 0, p: 'C1', d: '16n'}].map(n => defaultNote(n.t, n.p, 1.0, n.d))
};

// 🎵 90 BPM Old-School Boom Bap Beats
const boomBapNotes = {
  kick: [0, 12, 16, 28, 32, 44, 48, 60].map(t => defaultNote(t, 'C4', 1.0, '8n')),
  snare: [8, 24, 40, 56].map(t => defaultNote(t, 'C4', 0.95, '8n')),
  clap: [8, 24, 40, 56].map(t => defaultNote(t, 'C4', 0.6, '16n')),
  'hi-hat': [
    ...Array.from({ length: 16 }).map((_, i) => {
      const t = i * 4;
      const isSwung = i % 2 === 1;
      return defaultNote(t + (isSwung ? 1 : 0), 'F#4', isSwung ? 0.4 : 0.7, '16n');
    })
  ],
  offbeathat: [6, 14, 22, 30, 38, 46, 54, 62].map(t => defaultNote(t, 'G#4', 0.65, '8n')),
  drillbass: [
    { t: 0, p: 'A1', d: '4n' }, { t: 8, p: 'A1', d: '8n' }, { t: 12, p: 'D2', d: '8n' },
    { t: 16, p: 'G1', d: '4n' }, { t: 24, p: 'G1', d: '8n' }, { t: 28, p: 'C2', d: '8n' },
    { t: 32, p: 'F1', d: '4n' }, { t: 40, p: 'F1', d: '8n' }, { t: 44, p: 'A#1', d: '8n' },
    { t: 48, p: 'G1', d: '4n' }, { t: 56, p: 'D2', d: '8n' }, { t: 60, p: 'E2', d: '8n' },
  ].map(n => defaultNote(n.t, n.p, 0.9, n.d)),
  glidesynth: [
    { t: 0, p: 'A3', d: '2n' }, { t: 4, p: 'C4', d: '8n' }, { t: 6, p: 'D4', d: '8n' },
    { t: 16, p: 'G3', d: '2n' }, { t: 20, p: 'A#3', d: '8n' }, { t: 22, p: 'C4', d: '8n' },
    { t: 32, p: 'F3', d: '2n' }, { t: 36, p: 'A3', d: '8n' }, { t: 38, p: 'C4', d: '8n' },
    { t: 48, p: 'G3', d: '1n' },
  ].map(n => defaultNote(n.t, n.p, 0.7, n.d)),
  chordstab: [
    { t: 0, p: 'A2' }, { t: 0, p: 'C3' }, { t: 0, p: 'E3' }, { t: 0, p: 'A3' },
    { t: 16, p: 'G2' }, { t: 16, p: 'A#2' }, { t: 16, p: 'D3' }, { t: 16, p: 'G3' },
    { t: 32, p: 'F2' }, { t: 32, p: 'A2' }, { t: 32, p: 'C3' }, { t: 32, p: 'F3' },
    { t: 48, p: 'G2' }, { t: 48, p: 'D3' }, { t: 48, p: 'G3' },
  ].map(n => defaultNote(n.t, n.p, 0.75, '2n'))
};

const jazzHopNotes = {
  kick: [0, 10, 16, 26, 32, 42, 48, 58].map(t => defaultNote(t, 'C4', 0.95, '8n')),
  snare: [8, 24, 40, 56].map(t => defaultNote(t, 'C4', 0.9, '8n')),
  'hi-hat': Array.from({ length: 64 }).map((_, i) => {
    const swing = i % 3 === 2 ? 1 : 0;
    return defaultNote(i + swing, 'F#4', (i % 4 === 0 ? 0.8 : 0.35), '16n');
  }),
  offbeathat: [7, 15, 23, 31, 39, 47, 55, 63].map(t => defaultNote(t, 'G#4', 0.5, '16n')),
  hyperbass: [
    { t: 0, p: 'D2', d: '4n' }, { t: 6, p: 'A1', d: '8n' }, { t: 10, p: 'D2', d: '16n' },
    { t: 16, p: 'C2', d: '4n' }, { t: 22, p: 'G1', d: '8n' }, { t: 26, p: 'C2', d: '16n' },
    { t: 32, p: 'A#1', d: '4n' }, { t: 38, p: 'F1', d: '8n' }, { t: 42, p: 'A#1', d: '16n' },
    { t: 48, p: 'C2', d: '2n' }, { t: 56, p: 'E2', d: '8n' }, { t: 60, p: 'G2', d: '8n' },
  ].map(n => defaultNote(n.t, n.p, 0.88, n.d)),
  retrosynth: [
    { t: 0, p: 'D4', d: '8n' }, { t: 4, p: 'F4', d: '8n' }, { t: 8, p: 'A4', d: '4n' },
    { t: 16, p: 'C4', d: '8n' }, { t: 20, p: 'E4', d: '8n' }, { t: 24, p: 'G4', d: '4n' },
    { t: 32, p: 'A#3', d: '8n' }, { t: 36, p: 'D4', d: '8n' }, { t: 40, p: 'F4', d: '4n' },
    { t: 48, p: 'C4', d: '2n' }, { t: 56, p: 'E4', d: '8n' },
  ].map(n => defaultNote(n.t, n.p, 0.65, n.d)),
  bellchord: [
    { t: 0, p: 'D3' }, { t: 0, p: 'F#3' }, { t: 0, p: 'A3' }, { t: 0, p: 'D4' },
    { t: 32, p: 'C3' }, { t: 32, p: 'E3' }, { t: 32, p: 'G3' }, { t: 32, p: 'C4' },
  ].map(n => defaultNote(n.t, n.p, 0.7, '1n'))
};

const lofiNotes = {
  kick: [0, 12, 16, 28, 32, 44, 48, 60].map(t => defaultNote(t, 'C4', 0.88, '8n')),
  snare: [8, 24, 40, 56].map(t => defaultNote(t, 'C4', 0.75, '8n')),
  'hi-hat': Array.from({ length: 32 }).map((_, i) =>
    defaultNote(i * 2 + (i % 2 === 1 ? 1 : 0), 'F#4', i % 4 === 0 ? 0.6 : 0.3, '16n')
  ),
  bedroombass: [
    { t: 0, p: 'E2', d: '2n' }, { t: 8, p: 'E2', d: '8n' },
    { t: 16, p: 'C2', d: '2n' }, { t: 24, p: 'C2', d: '8n' },
    { t: 32, p: 'A1', d: '2n' }, { t: 40, p: 'A1', d: '8n' },
    { t: 48, p: 'D2', d: '1n' },
  ].map(n => defaultNote(n.t, n.p, 0.85, n.d)),
  vocalchop: [
    { t: 2, p: 'E4', d: '16n' }, { t: 4, p: 'G4', d: '16n' }, { t: 6, p: 'B4', d: '8n' },
    { t: 18, p: 'C4', d: '16n' }, { t: 20, p: 'E4', d: '16n' }, { t: 22, p: 'G4', d: '8n' },
    { t: 34, p: 'A3', d: '16n' }, { t: 36, p: 'C4', d: '16n' }, { t: 38, p: 'E4', d: '8n' },
    { t: 50, p: 'D4', d: '16n' }, { t: 52, p: 'F#4', d: '16n' }, { t: 54, p: 'A4', d: '8n' },
  ].map(n => defaultNote(n.t, n.p, 0.68, n.d)),
  sparklearp: [
    { t: 0, p: 'E5', d: '16n' }, { t: 4, p: 'B4', d: '16n' }, { t: 8, p: 'G4', d: '16n' }, { t: 12, p: 'E4', d: '16n' },
    { t: 16, p: 'C5', d: '16n' }, { t: 20, p: 'G4', d: '16n' }, { t: 24, p: 'E4', d: '16n' }, { t: 28, p: 'C4', d: '16n' },
    { t: 32, p: 'A4', d: '16n' }, { t: 36, p: 'E4', d: '16n' }, { t: 40, p: 'C4', d: '16n' }, { t: 44, p: 'A3', d: '16n' },
    { t: 48, p: 'D5', d: '16n' }, { t: 52, p: 'A4', d: '16n' }, { t: 56, p: 'F#4', d: '16n' }, { t: 60, p: 'D4', d: '16n' },
  ].map(n => defaultNote(n.t, n.p, 0.55, n.d))
};

// =========================================================================
// === FORGESYNTH PRESET KÜTÜPHANESİ ===
// =========================================================================

const forgeSynthPresets = {
  'Wobble Bass': {
    oscillator: { type: 'fatsawtooth' },
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.2 },
    filter: { type: 'lowpass', frequency: 100, rolloff: -24, Q: 3.5 },
    filterEnv: { attack: 0.02, decay: 0.2, sustain: 0.2, release: 0.1, baseFrequency: 100, octaves: 5 },
    lfo1: { type: 'sine', frequency: '8n', amplitude: 1, min: 100, max: 2000 },
    lfo2: { type: 'square', frequency: '16n', amplitude: 1, min: 0, max: 0.1 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.8 },
      { id: 'slot2', source: 'none', destination: 'none', amount: 0 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Pluck Lead': {
    oscillator: { type: 'square' },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.0, release: 0.3 },
    filter: { type: 'lowpass', frequency: 200, rolloff: -12, Q: 1.5 },
    filterEnv: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1, baseFrequency: 200, octaves: 6 },
    lfo1: { type: 'sawtooth', frequency: '8t', amplitude: 1, min: -50, max: 50 },
    lfo2: { type: 'sine', frequency: '2n', amplitude: 1, min: -0.2, max: 0.2 },
    modMatrix: [
      { id: 'slot1', source: 'none', destination: 'none', amount: 0 },
      { id: 'slot2', source: 'lfo2', destination: 'pan', amount: 0.8 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Ethereal Pad': {
    oscillator: { type: 'fattriangle' },
    envelope: { attack: 3.5, decay: 1.5, sustain: 0.8, release: 4.5 },
    filter: { type: 'lowpass', frequency: 800, rolloff: -24, Q: 1 },
    filterEnv: { attack: 4.0, decay: 1.2, sustain: 0.8, release: 3.0, baseFrequency: 800, octaves: 4 },
    lfo1: { type: 'sine', frequency: '2m', amplitude: 1, min: 500, max: 1500 },
    lfo2: { type: 'sine', frequency: '1m', amplitude: 1, min: -1, max: 1 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.4 },
      { id: 'slot2', source: 'lfo2', destination: 'pan', amount: 1 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Chicago Piano': {
    oscillator: { type: 'fatsquare' },
    envelope: { attack: 0.01, decay: 1.5, sustain: 0.0, release: 0.5 },
    filter: { type: 'lowpass', frequency: 1000, rolloff: -12, Q: 1 },
    filterEnv: { attack: 0.02, decay: 0.3, sustain: 0, release: 0.1, baseFrequency: 1000, octaves: 4 },
    lfo1: { type: 'sine', min: 400, max: 2000, frequency: '8n', amplitude: 0.5 },
    lfo2: { type: 'triangle', min: -1, max: 1, frequency: '2n', amplitude: 1 },
    modMatrix: [
      { id: 'slot1', source: 'none', destination: 'none', amount: 0 },
      { id: 'slot2', source: 'none', destination: 'none', amount: 0 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Deep Bass': {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 },
      filter: { type: 'lowpass', frequency: 700, rolloff: -24, Q: 4 },
      filterEnv: { attack: 0.01, decay: 0.1, sustain: 1, release: 0.1, baseFrequency: 700, octaves: 0 },
      lfo1: { type: 'sine', frequency: '16n', amplitude: 1, min: 400, max: 800 },
      lfo2: { type: 'square', frequency: '1n', amplitude: 1, min: 0, max: 1 },
      modMatrix: [
          { id: 'slot1', source: 'none', destination: 'none', amount: 0 },
          { id: 'slot2', source: 'none', destination: 'none', amount: 0 },
          { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
      ]
  },
  'Evolving Pad': {
    oscillator: { type: 'fatsawtooth' },
    envelope: { attack: 5.0, decay: 2, sustain: 1.0, release: 8.0 },
    filter: { type: 'lowpass', frequency: 400, rolloff: -24, Q: 1.5 },
    filterEnv: { attack: 7.0, decay: 3, sustain: 0.7, release: 6.0, baseFrequency: 400, octaves: 5 },
    lfo1: { type: 'sine', frequency: '1m', amplitude: 1, min: 300, max: 1200 },
    lfo2: { type: 'sine', frequency: '2m', amplitude: 1, min: -0.8, max: 0.8 },
    modMatrix: [
        { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.6 },
        { id: 'slot2', source: 'lfo2', destination: 'pan', amount: 1 },
        { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Crystal Keys': {
      oscillator: { type: 'fattriangle' },
      envelope: { attack: 0.01, decay: 1.0, sustain: 0.2, release: 1.5 },
      filter: { type: 'highpass', frequency: 1000, rolloff: -12, Q: 1 },
      filterEnv: { attack: 0.02, decay: 0.5, sustain: 0.5, release: 1.0, baseFrequency: 1000, octaves: 3 },
      lfo1: { type: 'sine', frequency: '8n', amplitude: 1, min: -20, max: 20 },
      lfo2: { type: 'sine', frequency: '4n', amplitude: 1, min: 0.8, max: 1 },
      modMatrix: [
          { id: 'slot1', source: 'lfo1', destination: 'oscPitch', amount: 0.1 },
          { id: 'slot2', source: 'none', destination: 'none', amount: 0 },
          { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
      ]
  },
  'Sub Bass Drone': {
      oscillator: { type: 'sine' },
      envelope: { attack: 4.0, decay: 1.0, sustain: 1.0, release: 6.0 },
      filter: { type: 'lowpass', frequency: 250, rolloff: -24, Q: 1 },
      filterEnv: { attack: 5.0, decay: 2, sustain: 1, release: 5, baseFrequency: 250, octaves: 1.5 },
      lfo1: { type: 'sine', frequency: '2m', amplitude: 1, min: 200, max: 300 },
      lfo2: { type: 'sine', frequency: '1m', amplitude: 1, min: 0.9, max: 1 },
      modMatrix: [
          { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.5 },
          { id: 'slot2', source: 'none', destination: 'none', amount: 0 },
          { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
      ]
  },
  // ✨ NEW: Modern Synth Presets
  'Drill Bass': {
    oscillator: { type: 'fatsawtooth' },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.4 },
    filter: { type: 'lowpass', frequency: 150, rolloff: -24, Q: 2.5 },
    filterEnv: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3, baseFrequency: 150, octaves: 3 },
    lfo1: { type: 'square', frequency: '16n', amplitude: 1, min: 80, max: 400 },
    lfo2: { type: 'sine', frequency: '4n', amplitude: 1, min: -0.15, max: 0.15 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.6 },
      { id: 'slot2', source: 'lfo2', destination: 'pan', amount: 0.7 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Glide Synth': {
    oscillator: { type: 'square' },
    envelope: { attack: 0.08, decay: 0.5, sustain: 0.3, release: 0.8 },
    filter: { type: 'lowpass', frequency: 600, rolloff: -12, Q: 2 },
    filterEnv: { attack: 0.15, decay: 0.4, sustain: 0.5, release: 0.6, baseFrequency: 600, octaves: 5 },
    lfo1: { type: 'sine', frequency: '4n', amplitude: 1, min: 400, max: 1200 },
    lfo2: { type: 'triangle', frequency: '2n', amplitude: 1, min: -30, max: 30 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.5 },
      { id: 'slot2', source: 'lfo2', destination: 'oscPitch', amount: 0.3 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Chord Stab': {
    oscillator: { type: 'fatsquare' },
    envelope: { attack: 0.01, decay: 0.6, sustain: 0.2, release: 0.5 },
    filter: { type: 'highpass', frequency: 300, rolloff: -12, Q: 1 },
    filterEnv: { attack: 0.02, decay: 0.4, sustain: 0.3, release: 0.4, baseFrequency: 300, octaves: 4 },
    lfo1: { type: 'sine', frequency: '8n', amplitude: 1, min: 200, max: 800 },
    lfo2: { type: 'sine', frequency: '16n', amplitude: 1, min: 0.7, max: 1 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.4 },
      { id: 'slot2', source: 'lfo2', destination: 'volume', amount: 0.3 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Scream Synth': {
    oscillator: { type: 'fatsawtooth' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0.8, release: 0.2 },
    filter: { type: 'bandpass', frequency: 1500, rolloff: -24, Q: 6 },
    filterEnv: { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.15, baseFrequency: 1500, octaves: 6 },
    lfo1: { type: 'square', frequency: '32n', amplitude: 1, min: 800, max: 3000 },
    lfo2: { type: 'sine', frequency: '8n', amplitude: 1, min: -0.3, max: 0.3 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.9 },
      { id: 'slot2', source: 'lfo2', destination: 'pan', amount: 1 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Hyper Bass': {
    oscillator: { type: 'fatsawtooth' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 },
    filter: { type: 'lowpass', frequency: 200, rolloff: -24, Q: 3 },
    filterEnv: { attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.25, baseFrequency: 200, octaves: 4 },
    lfo1: { type: 'sawtooth', frequency: '16n', amplitude: 1, min: 100, max: 600 },
    lfo2: { type: 'square', frequency: '8n', amplitude: 1, min: -50, max: 50 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.7 },
      { id: 'slot2', source: 'lfo2', destination: 'oscPitch', amount: 0.4 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Sparkle Arp': {
    oscillator: { type: 'fattriangle' },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.4 },
    filter: { type: 'highpass', frequency: 800, rolloff: -12, Q: 1.5 },
    filterEnv: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.3, baseFrequency: 800, octaves: 5 },
    lfo1: { type: 'sine', frequency: '16n', amplitude: 1, min: 500, max: 2000 },
    lfo2: { type: 'triangle', frequency: '4n', amplitude: 1, min: 0.8, max: 1 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.6 },
      { id: 'slot2', source: 'lfo2', destination: 'volume', amount: 0.2 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Bell Chord': {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 2.0, sustain: 0.3, release: 2.5 },
    filter: { type: 'highpass', frequency: 600, rolloff: -12, Q: 1 },
    filterEnv: { attack: 0.03, decay: 1.5, sustain: 0.4, release: 2.0, baseFrequency: 600, octaves: 4 },
    lfo1: { type: 'sine', frequency: '1m', amplitude: 1, min: 400, max: 1000 },
    lfo2: { type: 'sine', frequency: '2m', amplitude: 1, min: 0.9, max: 1 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.3 },
      { id: 'slot2', source: 'lfo2', destination: 'volume', amount: 0.1 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Bedroom Bass': {
    oscillator: { type: 'fatsawtooth' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.4 },
    filter: { type: 'lowpass', frequency: 250, rolloff: -24, Q: 2 },
    filterEnv: { attack: 0.02, decay: 0.25, sustain: 0.6, release: 0.35, baseFrequency: 250, octaves: 3.5 },
    lfo1: { type: 'sine', frequency: '8n', amplitude: 1, min: 150, max: 500 },
    lfo2: { type: 'triangle', frequency: '4n', amplitude: 1, min: -0.2, max: 0.2 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.5 },
      { id: 'slot2', source: 'lfo2', destination: 'pan', amount: 0.6 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Vocal Chop': {
    oscillator: { type: 'fatsquare' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.15 },
    filter: { type: 'bandpass', frequency: 1000, rolloff: -12, Q: 4 },
    filterEnv: { attack: 0.01, decay: 0.08, sustain: 0.4, release: 0.12, baseFrequency: 1000, octaves: 4 },
    lfo1: { type: 'square', frequency: '16n', amplitude: 1, min: 600, max: 1800 },
    lfo2: { type: 'sine', frequency: '8n', amplitude: 1, min: 0.6, max: 1 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.8 },
      { id: 'slot2', source: 'lfo2', destination: 'volume', amount: 0.4 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  },
  'Retro Synth': {
    oscillator: { type: 'square' },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.6, release: 0.6 },
    filter: { type: 'lowpass', frequency: 800, rolloff: -12, Q: 2 },
    filterEnv: { attack: 0.03, decay: 0.3, sustain: 0.5, release: 0.5, baseFrequency: 800, octaves: 4 },
    lfo1: { type: 'sawtooth', frequency: '8t', amplitude: 1, min: 500, max: 1500 },
    lfo2: { type: 'sine', frequency: '2n', amplitude: 1, min: -0.15, max: 0.15 },
    modMatrix: [
      { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.5 },
      { id: 'slot2', source: 'lfo2', destination: 'pan', amount: 0.7 },
      { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
    ]
  }
};

// =========================================================================
// === GENİŞLETİLMİŞ ENSTRÜMAN LİSTESİ ===
// =========================================================================

// Create instruments with environment-aware configuration
const createInstruments = () => {
  const baseInstruments = [
    // --- Ritim (Samples) - Hepsinde kullanılıyor ---
    { id: 'inst-1', name: 'Kick', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/kick.wav', mixerTrackId: 'track-1', pianoRoll: false, effectChain: [] },
    { id: 'inst-2', name: 'Snare', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/snare.wav', mixerTrackId: 'track-2', pianoRoll: false, effectChain: [] },
    { id: 'inst-3', name: 'Clap', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/clap.wav', mixerTrackId: 'track-3', pianoRoll: false, effectChain: [] },
    { id: 'inst-4', name: 'Hi-Hat', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/hihat.wav', mixerTrackId: 'track-4', pianoRoll: false, effectChain: [] },
    { id: 'inst-5', name: 'Offbeat Hat', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/openhat.wav', mixerTrackId: 'track-5', pianoRoll: false, cutItself: true, effectChain: [] },

    // ✨ NEW: Modern Bass Synths
    { id: 'inst-6', name: 'Drill Bass', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-6', pianoRoll: true, synthParams: forgeSynthPresets['Drill Bass'], effectChain: [] },
    { id: 'inst-7', name: 'Hyper Bass', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-7', pianoRoll: true, synthParams: forgeSynthPresets['Hyper Bass'], effectChain: [] },
    { id: 'inst-8', name: 'Bedroom Bass', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-8', pianoRoll: true, synthParams: forgeSynthPresets['Bedroom Bass'], effectChain: [] },

    // ✨ NEW: Modern Lead & Melodic Synths
    { id: 'inst-9', name: 'Glide Synth', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-9', pianoRoll: true, synthParams: forgeSynthPresets['Glide Synth'], effectChain: [] },
    { id: 'inst-10', name: 'Scream Synth', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-10', pianoRoll: true, synthParams: forgeSynthPresets['Scream Synth'], effectChain: [] },
    { id: 'inst-11', name: 'Vocal Chop', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-11', pianoRoll: true, synthParams: forgeSynthPresets['Vocal Chop'], effectChain: [] },

    // ✨ NEW: Modern Texture & Harmony Synths
    { id: 'inst-12', name: 'Chord Stab', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-12', pianoRoll: true, synthParams: forgeSynthPresets['Chord Stab'], effectChain: [] },
    { id: 'inst-13', name: 'Sparkle Arp', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-13', pianoRoll: true, synthParams: forgeSynthPresets['Sparkle Arp'], effectChain: [] },
    { id: 'inst-14', name: 'Bell Chord', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-14', pianoRoll: true, synthParams: forgeSynthPresets['Bell Chord'], effectChain: [] },
    { id: 'inst-15', name: 'Retro Synth', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-15', pianoRoll: true, synthParams: forgeSynthPresets['Retro Synth'], effectChain: [] },
  ];

  return baseInstruments;
};

export const initialInstruments = createInstruments();

// Create mixer tracks with environment-aware configuration
const createMixerTracks = () => {
  const baseTracks = [
  // ... Master ve Bus Kanalları aynı ...
  { id: 'master', name: 'Master', type: MIXER_TRACK_TYPES.MASTER, volume: 0, pan: 0, insertEffects: [], sends: [] },
  { id: 'bus-1', name: 'Reverb Bus', type: MIXER_TRACK_TYPES.BUS, volume: -12, pan: 0, color: '#3b82f6', insertEffects: [{ id: 'fx-reverb-bus', type: 'Reverb', settings: { decay: 3.5, preDelay: 0.02, wet: 1.0 }, bypass: false }], sends: [] },
  { id: 'bus-2', name: 'Delay Bus', type: MIXER_TRACK_TYPES.BUS, volume: -15, pan: 0, color: '#10b981', insertEffects: [{ id: 'fx-delay-bus', type: 'PingPongDelay', settings: { delayTime: '8n.', feedback: 0.4, wet: 1.0 }, bypass: false }], sends: [] },
  { id: 'bus-3', name: 'Drum Bus', type: MIXER_TRACK_TYPES.BUS, volume: -3, pan: 0, color: '#f59e0b', insertEffects: [{ id: 'fx-drum-comp', type: 'Compressor', settings: { threshold: -18, ratio: 4, attack: 0.01, release: 0.2, knee: 15, wet: 1.0 }, bypass: false }], sends: [] },

  // ... ilk 13 enstrüman kanalı aynı ...
  { id: 'track-1', name: 'Kick', type: MIXER_TRACK_TYPES.TRACK, volume: 0, pan: 0, color: '#ef4444', output: 'bus-3', insertEffects: [], sends: {}, inputGain: 0, eq: { highGain: 0, highFreq: 12000, midGain: 0, midFreq: 2500, midQ: 1, lowGain: 0, lowFreq: 80 } },
  { id: 'track-2', name: 'Snare', type: MIXER_TRACK_TYPES.TRACK, volume: -3.5, pan: 0, color: '#ef4444', output: 'bus-3', insertEffects: [], sends: { 'send1': -18, 'send2': -40 } },
  { id: 'track-3', name: 'Clap', type: MIXER_TRACK_TYPES.TRACK, volume: -4, pan: 0, color: '#ef4444', output: 'bus-3', insertEffects: [], sends: { 'send1': -15, 'send2': -30 } },
  { id: 'track-4', name: 'Hi-Hat', type: MIXER_TRACK_TYPES.TRACK, volume: -10, pan: -15, color: '#f59e0b', output: 'bus-3', insertEffects: [], sends: {}, inputGain: 0, eq: { highGain: 0, highFreq: 12000, midGain: 0, midFreq: 2500, midQ: 1, lowGain: 0, lowFreq: 80 } },
  { id: 'track-5', name: 'Offbeat Hat', type: MIXER_TRACK_TYPES.TRACK, volume: -12, pan: 10, color: '#f59e0b', output: 'bus-3', insertEffects: [], sends: { 'send1': -24, 'send2': -35 }, inputGain: 0, eq: { highGain: 0, highFreq: 12000, midGain: 0, midFreq: 2500, midQ: 1, lowGain: 0, lowFreq: 80 } },
  // ✨ Updated for modern instruments
  { id: 'track-6', name: 'Drill Bass', type: MIXER_TRACK_TYPES.TRACK, volume: -5, pan: 0, color: '#a855f7', insertEffects: [], sends: {} },
  { id: 'track-7', name: 'Hyper Bass', type: MIXER_TRACK_TYPES.TRACK, volume: -6, pan: 0, color: '#a855f7', insertEffects: [], sends: {} },
  { id: 'track-8', name: 'Bedroom Bass', type: MIXER_TRACK_TYPES.TRACK, volume: -7, pan: 0, color: '#a855f7', insertEffects: [], sends: {} },
  { id: 'track-9', name: 'Glide Synth', type: MIXER_TRACK_TYPES.TRACK, volume: -10, pan: 0, color: '#ec4899', insertEffects: [], sends: { 'send1': -20, 'send2': -15 } },
  { id: 'track-10', name: 'Scream Synth', type: MIXER_TRACK_TYPES.TRACK, volume: -11, pan: 0, color: '#ec4899', insertEffects: [], sends: { 'send1': -18, 'send2': -12 } },
  { id: 'track-11', name: 'Vocal Chop', type: MIXER_TRACK_TYPES.TRACK, volume: -9, pan: 0, color: '#ec4899', insertEffects: [], sends: { 'send1': -15, 'send2': -20 } },
  { id: 'track-12', name: 'Chord Stab', type: MIXER_TRACK_TYPES.TRACK, volume: -8, pan: 0, color: '#6366f1', insertEffects: [], sends: { 'send1': -22, 'send2': -25 } },
  { id: 'track-13', name: 'Sparkle Arp', type: MIXER_TRACK_TYPES.TRACK, volume: -12, pan: 0, color: '#6366f1', insertEffects: [], sends: { 'send1': -10, 'send2': -18 } },
  { id: 'track-14', name: 'Bell Chord', type: MIXER_TRACK_TYPES.TRACK, volume: -14, pan: 0, color: '#10b981', insertEffects: [], sends: { 'send1': -8, 'send2': -15 } },
  { id: 'track-15', name: 'Retro Synth', type: MIXER_TRACK_TYPES.TRACK, volume: -10, pan: 0, color: '#10b981', insertEffects: [], sends: { 'send1': -16, 'send2': -20 } },

    // --- Kullanılmayan boş kanallar ---
    ...Array.from({ length: 9 }, (_, i) => ({ id: `track-${16 + i}`, name: `Insert ${16 + i}`, type: MIXER_TRACK_TYPES.TRACK, volume: 0, pan: 0, insertEffects: [], sends: [] })),
  ];

  return baseTracks;
};

export const initialMixerTracks = createMixerTracks();

// =========================================================================
// === BAŞLANGIÇ PATTERN & ARANJMAN VERİLERİ ===
// =========================================================================

// Birden fazla pattern'i yönetebilmek için bir yardımcı fonksiyon
const createInitialPatternData = (notesObject) => {
    const patternData = {};
    initialInstruments.forEach(inst => {
        // Enstrüman adını boşluksuz ve küçük harfe çevirerek anahtar oluştur
        const key = inst.name.replace(/\s+/g, '').toLowerCase();
        patternData[inst.id] = notesObject[key] || [];
    });
    return patternData;
};

// Create patterns with environment-aware configuration
const createPatterns = () => {
  // 🎵 Old-school boom bap patterns at 90 BPM
  const boomBapPatternData = createInitialPatternData(boomBapNotes);
  const jazzHopPatternData = createInitialPatternData(jazzHopNotes);
  const lofiPatternData = createInitialPatternData(lofiNotes);
  const emptyPatternData = createInitialPatternData({});

  // FL Studio Style: Patterns only contain note data, no instrument ownership
  const basePatterns = {
    'pattern-1': {
      id: 'pattern-1',
      name: '🎹 Classic Boom Bap',
      data: boomBapPatternData,
      settings: { length: 64, quantization: '16n' }
    },
    'pattern-2': {
      id: 'pattern-2',
      name: '🎷 Jazz Hop',
      data: jazzHopPatternData,
      settings: { length: 64, quantization: '16n' }
    },
    'pattern-3': {
      id: 'pattern-3',
      name: '🌙 Lo-fi Vibes',
      data: lofiPatternData,
      settings: { length: 64, quantization: '16n' }
    },
    'pattern-4': {
      id: 'pattern-4',
      name: '📝 Empty Canvas',
      data: emptyPatternData,
      settings: { length: 64, quantization: '16n' }
    },
  };

  return basePatterns;
};

export const initialPatterns = createPatterns();

// Create pattern order and clips with environment-aware configuration
const createPatternOrder = () => {
  return ['pattern-1', 'pattern-2', 'pattern-3', 'pattern-4'];
};

const createClips = () => {
  return [
    { id: 'clip-1', patternId: 'pattern-1', trackId: null, startTime: 0, duration: 4 },
    { id: 'clip-2', patternId: 'pattern-2', trackId: null, startTime: 4, duration: 4 },
    { id: 'clip-3', patternId: 'pattern-3', trackId: null, startTime: 8, duration: 8 },
  ];
};

export const initialPatternOrder = createPatternOrder();
export const initialClips = createClips();