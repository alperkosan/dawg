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
  }
};

// =========================================================================
// === GENİŞLETİLMİŞ ENSTRÜMAN LİSTESİ ===
// =========================================================================

export const initialInstruments = [
  // --- DÜZELTME: Gereksiz `notes` özellikleri kaldırıldı ---
  // --- Ritim (Samples) ---
  { id: 'inst-1', name: 'Kick', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/kick.wav', mixerTrackId: 'track-1', pianoRoll: false },
  { id: 'inst-2', name: 'Snare', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/snare.wav', mixerTrackId: 'track-2', pianoRoll: false },
  { id: 'inst-3', name: 'Clap', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/clap.wav', mixerTrackId: 'track-3', pianoRoll: false },
  { id: 'inst-4', name: 'Hi-Hat', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/hihat.wav', mixerTrackId: 'track-4', pianoRoll: false },
  { id: 'inst-5', name: 'Offbeat Hat', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/openhat.wav', mixerTrackId: 'track-5', pianoRoll: false, cutItself: true },

  // --- Bass (Synth & Sample) ---
  { id: 'inst-6', name: 'Wobble Bass', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-6', pianoRoll: true, synthParams: forgeSynthPresets['Wobble Bass'] },
  { id: 'inst-7', name: 'Deep Bass', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-7', pianoRoll: true, synthParams: forgeSynthPresets['Deep Bass'] },
  { id: 'inst-8', name: 'Sub Bass Drone', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-8', pianoRoll: true, synthParams: forgeSynthPresets['Sub Bass Drone'] },

  // --- Melodi & Armoni (Synth'ler) ---
  { id: 'inst-9', name: 'Pluck Lead', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-9', pianoRoll: true, synthParams: forgeSynthPresets['Pluck Lead'] },
  { id: 'inst-10', name: 'Ethereal Pad', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-10', pianoRoll: true, synthParams: forgeSynthPresets['Ethereal Pad'] },
  { id: 'inst-11', name: 'Chicago Piano', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-11', pianoRoll: true, synthParams: forgeSynthPresets['Chicago Piano'] },
  
  // --- Sinematik (Synth'ler) ---
  { id: 'inst-12', name: 'Evolving Pad', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-12', pianoRoll: true, synthParams: forgeSynthPresets['Evolving Pad'] },
  { id: 'inst-13', name: 'Crystal Keys', type: INSTRUMENT_TYPES.SYNTH, mixerTrackId: 'track-13', pianoRoll: true, synthParams: forgeSynthPresets['Crystal Keys'] },
];

export const initialMixerTracks = [
  // ... Master ve Bus Kanalları aynı ...
  { id: 'master', name: 'Master', type: MIXER_TRACK_TYPES.MASTER, volume: 0, pan: 0, insertEffects: [], sends: [] },
  { id: 'bus-1', name: 'Reverb Bus', type: MIXER_TRACK_TYPES.BUS, volume: -12, pan: 0, color: '#3b82f6', insertEffects: [{ id: 'fx-reverb-bus', type: 'Reverb', settings: { decay: 3.5, preDelay: 0.02, wet: 1.0 }, bypass: false }], sends: [] },
  { id: 'bus-2', name: 'Delay Bus', type: MIXER_TRACK_TYPES.BUS, volume: -15, pan: 0, color: '#10b981', insertEffects: [{ id: 'fx-delay-bus', type: 'PingPongDelay', settings: { delayTime: '8n.', feedback: 0.4, wet: 1.0 }, bypass: false }], sends: [] },
  { id: 'bus-3', name: 'Drum Bus', type: MIXER_TRACK_TYPES.BUS, volume: -3, pan: 0, color: '#f59e0b', insertEffects: [{ id: 'fx-drum-comp', type: 'Compressor', settings: { threshold: -18, ratio: 4, attack: 0.01, release: 0.2, knee: 15, wet: 1.0 }, bypass: false }], sends: [] },

  // ... ilk 13 enstrüman kanalı aynı ...
  { id: 'track-1', name: 'Kick', type: MIXER_TRACK_TYPES.TRACK, volume: 0, pan: 0, color: '#ef4444', output: 'bus-3', insertEffects: [], sends: [] },
  { id: 'track-2', name: 'Snare', type: MIXER_TRACK_TYPES.TRACK, volume: -3.5, pan: 0, color: '#ef4444', output: 'bus-3', insertEffects: [], sends: [{ busId: 'bus-1', level: -18 }] },
  { id: 'track-3', name: 'Clap', type: MIXER_TRACK_TYPES.TRACK, volume: -4, pan: 0, color: '#ef4444', output: 'bus-3', insertEffects: [], sends: [{ busId: 'bus-1', level: -15 }] },
  { id: 'track-4', name: 'Hi-Hat', type: MIXER_TRACK_TYPES.TRACK, volume: -10, pan: -0.15, color: '#f59e0b', output: 'bus-3', insertEffects: [], sends: [] },
  { id: 'track-5', name: 'Offbeat Hat', type: MIXER_TRACK_TYPES.TRACK, volume: -12, pan: 0.1, color: '#f59e0b', output: 'bus-3', insertEffects: [], sends: [{ busId: 'bus-1', level: -24 }] },
  { id: 'track-6', name: 'Wobble Bass', type: MIXER_TRACK_TYPES.TRACK, volume: -6, pan: 0, color: '#a855f7', insertEffects: [{ id: 'fx-wobble-sat', type: 'Saturator', settings: { distortion: 0.5, wet: 0.8 }, bypass: false }], sends: [] },
  { id: 'track-7', name: 'Deep Bass', type: MIXER_TRACK_TYPES.TRACK, volume: -5, pan: 0, color: '#a855f7', insertEffects: [], sends: [] },
  { id: 'track-8', name: 'Sub Bass Drone', type: MIXER_TRACK_TYPES.TRACK, volume: -8, pan: 0, color: '#a855f7', insertEffects: [], sends: [] },
  { id: 'track-9', name: 'Pluck Lead', type: MIXER_TRACK_TYPES.TRACK, volume: -12, pan: 0, color: '#ec4899', insertEffects: [], sends: [{ busId: 'bus-2', level: -12 }] },
  { id: 'track-10', name: 'Ethereal Pad', type: MIXER_TRACK_TYPES.TRACK, volume: -15, pan: 0, color: '#ec4899', insertEffects: [], sends: [{ busId: 'bus-1', level: -9 }] },
  { id: 'track-11', name: 'Chicago Piano', type: MIXER_TRACK_TYPES.TRACK, volume: -9, pan: 0, color: '#ec4899', insertEffects: [], sends: [{ busId: 'bus-1', level: -18 }] },
  { id: 'track-12', name: 'Evolving Pad', type: MIXER_TRACK_TYPES.TRACK, volume: -18, pan: 0, color: '#6366f1', insertEffects: [], sends: [{ busId: 'bus-1', level: -6 }] },
  { id: 'track-13', name: 'Crystal Keys', type: MIXER_TRACK_TYPES.TRACK, volume: -14, pan: 0, color: '#6366f1', insertEffects: [], sends: [{ busId: 'bus-1', level: -12 }, { busId: 'bus-2', level: -18 }] },

  // === BU İKİ SATIRI SİL VEYA YORUM SATIRI YAP ===
  // { id: 'track-14', name: 'Vocal Chop', type: MIXER_TRACK_TYPES.TRACK, volume: -16, pan: 0, color: '#10b981', insertEffects: [], sends: [{ busId: 'bus-2', level: -15 }] },
  // { id: 'track-15', name: 'Impact FX', type: MIXER_TRACK_TYPES.TRACK, volume: -20, pan: 0, color: '#64748b', insertEffects: [], sends: [{ busId: 'bus-1', level: -3 }] },
  
  // --- Kullanılmayan boş kanallar ---
  ...Array.from({ length: 11 }, (_, i) => ({ id: `track-${14 + i}`, name: `Insert ${14 + i}`, type: MIXER_TRACK_TYPES.TRACK, volume: 0, pan: 0, insertEffects: [], sends: [] })),
];


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

// Farklı müzik tarzları için başlangıç pattern'leri oluştur
const trapPatternData = createInitialPatternData(trapNotes);
const housePatternData = createInitialPatternData(houseNotes);
const ambientPatternData = createInitialPatternData(ambientNotes);

export const initialPatterns = {
  'pattern-1': { id: 'pattern-1', name: 'Trap Beat', data: trapPatternData },
  'pattern-2': { id: 'pattern-2', name: 'House Groove', data: housePatternData },
  'pattern-3': { id: 'pattern-3', name: 'Ambient Mood', data: ambientPatternData },
  'pattern-4': { id: 'pattern-4', name: 'Empty Pattern', data: createInitialPatternData({}) },
};

export const initialPatternOrder = ['pattern-1', 'pattern-2', 'pattern-3', 'pattern-4'];

export const initialClips = [
    { id: 'clip-1', patternId: 'pattern-1', trackId: null, startTime: 0, duration: 4 },
    { id: 'clip-2', patternId: 'pattern-2', trackId: null, startTime: 4, duration: 4 },
    { id: 'clip-3', patternId: 'pattern-3', trackId: null, startTime: 8, duration: 8 },
];