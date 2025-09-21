import { INSTRUMENT_TYPES, MIXER_TRACK_TYPES } from './constants'; // GÜNCELLENDİ

export const defaultNote = (time, pitch = 'C4', velocity = 1.0, duration = '16n') => ({
  id: `note_${time}_${pitch}_${Math.random().toString(36).substring(7)}`,
  time, pitch, velocity, duration
});

const notes = {
  kick: [], snare: [], counterSnare: [], hiHat: [], openHat: [], eight08: [], piano: [],
};

const kickPattern = [
  { time: 0, vel: 1.0 }, { time: 6, vel: 0.95 }, { time: 11, vel: 0.98 },
  { time: 16, vel: 1.0 }, { time: 22, vel: 0.95 }, { time: 27, vel: 0.98 },
  { time: 32, vel: 1.0 }, { time: 38, vel: 0.95 }, { time: 43, vel: 0.98 },
  { time: 48, vel: 1.0 }, { time: 54, vel: 0.95 }, { time: 61, vel: 0.98 },
];
kickPattern.forEach(k => notes.kick.push(defaultNote(k.time, 'C4', k.vel)));

const snarePattern = [8, 24, 40, 56];
snarePattern.forEach(s => notes.snare.push(defaultNote(s, 'C4', 1.0)));

const counterSnarePattern = [13, 29, 35, 45, 62];
counterSnarePattern.forEach(cs => notes.counterSnare.push(defaultNote(cs, 'C4', 0.75)));

for (let i = 0; i < 64; i += 2) {
    notes.hiHat.push(defaultNote(i, 'F#4', 0.6));
}
const hatRolls = [
    {t: 6.66, d: '16t'}, {t: 7.33, d: '16t'}, {t: 14, d: '16n'}, {t: 14.5, d: '16n'},
    {t: 22.66, d: '16t'}, {t: 23.33, d: '16t'}, {t: 30, d: '16n'}, {t: 30.5, d: '16n'}, {t: 31, d: '16n'},
    {t: 38.66, d: '16t'}, {t: 39.33, d: '16t'}, {t: 46, d: '16n'}, {t: 46.5, d: '16n'},
    {t: 54.66, d: '16t'}, {t: 55.33, d: '16t'}, {t: 62, d: '32n'}, {t: 62.25, d: '32n'}, {t: 62.5, d: '32n'}, {t: 62.75, d: '32n'},
];
hatRolls.forEach(r => notes.hiHat.push(defaultNote(r.t, 'F#4', 0.8, r.d)));

const openHatPattern = [4, 20, 36, 52];
openHatPattern.forEach(oh => notes.openHat.push(defaultNote(oh, 'G#4', 0.7, '4n')));

const bassline = [
  { time: 0, pitch: 'C3', duration: '2n' }, { time: 6, pitch: 'C3', duration: '8n' }, { time: 11, pitch: 'D#4', duration: '4n' },
  { time: 16, pitch: 'G4', duration: '2n' }, { time: 22, pitch: 'G4', duration: '8n' }, { time: 27, pitch: 'G#4', duration: '4n' },
  { time: 32, pitch: 'C3', duration: '2n' }, { time: 38, pitch: 'C3', duration: '8n' }, { time: 43, pitch: 'D#4', duration: '4n' },
  { time: 48, pitch: 'G4', duration: '2n' }, { time: 54, pitch: 'D4', duration: '4n' }, { time: 61, pitch: 'C3', duration: '8n' },
];
bassline.forEach(b => notes.eight08.push({ ...defaultNote(b.time, b.pitch), duration: b.duration }));

const pianoMelody = [
    {t: 0, p: 'G4'}, {t: 3, p: 'D#4'}, {t: 6, p: 'C5'}, {t: 16, p: 'G4'}, {t: 19, p: 'F4'}, {t: 22, p: 'D#5'},
    {t: 32, p: 'C5'}, {t: 35, p: 'G#4'}, {t: 38, p: 'G4'}, {t: 48, p: 'G4'}, {t: 51, p: 'D#4'}, {t: 54, p: 'D5'}, {t: 60, p: 'C5'},
];
pianoMelody.forEach(n => notes.piano.push(defaultNote(n.t, n.p, 0.8, '4n')));

export const initialInstruments = [
  { id: 'inst-1', name: 'Kick', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/kick.wav', notes: notes.kick, mixerTrackId: 'track-1', isMuted: false, cutItself: false },
  { id: 'inst-2', name: 'Snare', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/snare.wav', notes: notes.snare, mixerTrackId: 'track-2', isMuted: false, cutItself: false },
  { id: 'inst-3', name: 'Counter Snare', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/rim.wav', notes: notes.counterSnare, mixerTrackId: 'track-3', isMuted: false, cutItself: false },
  { id: 'inst-4', name: 'Hi-Hat', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/hihat.wav', notes: notes.hiHat, mixerTrackId: 'track-4', isMuted: false, cutItself: false },
  { id: 'inst-5', name: 'Open Hat', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/openhat.wav', notes: notes.openHat, mixerTrackId: 'track-5', isMuted: false, cutItself: true },
  { id: 'inst-6', name: '808', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/808.wav', notes: notes.eight08, mixerTrackId: 'track-6', isMuted: false, cutItself: true, pianoRoll: true },
  { 
    id: 'inst-7', 
    name: 'Piano', 
    type: INSTRUMENT_TYPES.SYNTH, 
    notes: notes.piano, 
    mixerTrackId: 'track-7', 
    isMuted: false, 
    pianoRoll: true,
    synthParams: { 
      oscillator: { type: 'fatsquare' }, 
      envelope: { attack: 0.01, decay: 1.5, sustain: 0.1, release: 0.8 },
      filter: { type: 'lowpass', frequency: 1500, rolloff: -24, Q: 1 },
      // YENİ: İki LFO için ayrı ayarlar
      lfo1: { type: 'sine', min: 400, max: 2000, frequency: '8n', amplitude: 1 },
      lfo2: { type: 'triangle', min: -1, max: 1, frequency: '2n', amplitude: 1 },
      // YENİ: Modülasyon Matrisi Tanımlaması
      modMatrix: [
        { id: 'slot1', source: 'lfo1', destination: 'filterFreq', amount: 0.65 },
        { id: 'slot2', source: 'lfo2', destination: 'pan', amount: 0.4 },
        { id: 'slot3', source: 'none', destination: 'none', amount: 0 },
      ]
    } 
  }
];

export const initialMixerTracks = [
  { id: 'master', name: 'Master', type: MIXER_TRACK_TYPES.MASTER, volume: 0, pan: 0, insertEffects: [], sends: [] },
  { id: 'track-1', name: 'Kick', type: MIXER_TRACK_TYPES.TRACK, volume: 0, pan: 0, insertEffects: [], sends: [] },
  { id: 'track-2', name: 'Snare', type: MIXER_TRACK_TYPES.TRACK, volume: -3.5, pan: 0, insertEffects: [], sends: [{ busId: 'bus-1', level: -18 }] },
  { id: 'track-3', name: 'Counter Snare', type: MIXER_TRACK_TYPES.TRACK, volume: -8, pan: 0.2, insertEffects: [], sends: [{ busId: 'bus-1', level: -15 }] },
  { id: 'track-4', name: 'Hi-Hat', type: MIXER_TRACK_TYPES.TRACK, volume: -10, pan: -0.15, insertEffects: [], sends: [] },
  { id: 'track-5', name: 'Open Hat', type: MIXER_TRACK_TYPES.TRACK, volume: -12, pan: 0, insertEffects: [], sends: [{ busId: 'bus-1', level: -20 }] },
  { id: 'track-6', name: '808', type: MIXER_TRACK_TYPES.TRACK, volume: -2, pan: 0, insertEffects: [], sends: [] },
  { id: 'track-7', name: 'Piano', type: MIXER_TRACK_TYPES.TRACK, volume: -9, pan: 0, insertEffects: [], sends: [{ busId: 'bus-1', level: -12 }] },
  ...Array.from({ length: 3 }, (_, i) => ({ id: `track-${8 + i}`, name: `Insert ${8 + i}`, type: MIXER_TRACK_TYPES.TRACK, volume: 0, pan: 0, insertEffects: [], sends: [] })),
  { 
    id: 'bus-1', name: 'Reverb Bus', type: MIXER_TRACK_TYPES.BUS, volume: -12, pan: 0, 
    insertEffects: [{ id: 'fx-reverb-bus', type: 'Reverb', settings: { decay: 2.2, preDelay: 0.015, wet: 1.0 }, bypass: false }], 
    sends: [] 
  },
];
