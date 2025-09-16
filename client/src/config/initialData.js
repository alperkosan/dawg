/**
 * @file initialData.js
 * @description MGK "Till I Die" tarzı modern trap pattern ile güncellenmiş proje başlangıç verileri
 */

// Her notaya benzersiz bir ID ekleyen yardımcı fonksiyon.
export const defaultNote = (time, pitch = 'C4', velocity = 1.0, duration = '16n') => ({
  id: `note_${time}_${pitch}_${Math.random().toString(36).substring(7)}`,
  time, pitch, velocity, duration
});

// === PROFESYONEL TRAP PATTERN ===
// 8 barlık (128 adım), modern trap üretiminde kullanılan gerçek ritmik yapı
const notes = {
  kick: [],
  snare: [],
  hiHat: [],
  openHat: [],
  crash: [],
  eight08: [],
  perc: []
};

// --- KICK PATTERN ---
// Senkoplu, güçlü trap kick pattern (sub-bass ile desteklenecek)
const kickHits = [
  // Bar 1
  { time: 0, vel: 1.0 }, { time: 6, vel: 0.85 }, { time: 10, vel: 0.9 },
  { time: 14, vel: 0.75 }, 
  // Bar 2  
  { time: 16, vel: 1.0 }, { time: 22, vel: 0.8 }, { time: 26, vel: 0.9 },
  { time: 30, vel: 0.85 },
  // Bar 3
  { time: 32, vel: 1.0 }, { time: 37, vel: 0.7 }, { time: 42, vel: 0.9 },
  { time: 46, vel: 0.8 },
  // Bar 4
  { time: 48, vel: 1.0 }, { time: 54, vel: 0.85 }, { time: 58, vel: 0.9 },
  { time: 62, vel: 1.0 },
  // Bar 5-8 (variation)
  { time: 64, vel: 1.0 }, { time: 70, vel: 0.9 }, { time: 74, vel: 0.8 },
  { time: 78, vel: 0.85 },
  { time: 80, vel: 1.0 }, { time: 86, vel: 0.8 }, { time: 90, vel: 0.9 },
  { time: 94, vel: 0.75 },
  { time: 96, vel: 1.0 }, { time: 102, vel: 0.9 }, { time: 106, vel: 0.85 },
  { time: 110, vel: 0.8 },
  { time: 112, vel: 1.0 }, { time: 118, vel: 0.85 }, { time: 122, vel: 0.9 },
  { time: 126, vel: 1.0 }
];
kickHits.forEach(k => notes.kick.push(defaultNote(k.time, 'C4', k.vel)));

// --- SNARE/CLAP PATTERN ---
// Klasik trap snare: 2 ve 4 vuruşları + ghost note'lar
const snareHits = [
  // Ana snare vuruşları (2 ve 4)
  { time: 4, vel: 1.0, dur: '8n' }, { time: 12, vel: 1.0, dur: '8n' },
  { time: 20, vel: 1.0, dur: '8n' }, { time: 28, vel: 1.0, dur: '8n' },
  { time: 36, vel: 1.0, dur: '8n' }, { time: 44, vel: 1.0, dur: '8n' },
  { time: 52, vel: 1.0, dur: '8n' }, { time: 60, vel: 1.0, dur: '8n' },
  
  // Ghost notes (hafif vuruşlar)
  { time: 2, vel: 0.3, dur: '16n' }, { time: 6, vel: 0.25, dur: '16n' },
  { time: 10, vel: 0.4, dur: '16n' }, { time: 14, vel: 0.35, dur: '16n' },
  { time: 18, vel: 0.3, dur: '16n' }, { time: 22, vel: 0.25, dur: '16n' },
  { time: 26, vel: 0.4, dur: '16n' }, { time: 30, vel: 0.35, dur: '16n' },
  
  // Bar 3-4 ghost notes
  { time: 34, vel: 0.3, dur: '16n' }, { time: 38, vel: 0.25, dur: '16n' },
  { time: 42, vel: 0.4, dur: '16n' }, { time: 46, vel: 0.35, dur: '16n' },
  { time: 50, vel: 0.3, dur: '16n' }, { time: 54, vel: 0.25, dur: '16n' },
  { time: 58, vel: 0.4, dur: '16n' }, { time: 62, vel: 0.35, dur: '16n' },
  
  // Bar 5-8 (tekrar + variation)
  { time: 68, vel: 1.0, dur: '8n' }, { time: 76, vel: 1.0, dur: '8n' },
  { time: 84, vel: 1.0, dur: '8n' }, { time: 92, vel: 1.0, dur: '8n' },
  { time: 100, vel: 1.0, dur: '8n' }, { time: 108, vel: 1.0, dur: '8n' },
  { time: 116, vel: 1.0, dur: '8n' }, { time: 124, vel: 1.0, dur: '8n' },
  
  // Final snare roll (bar 8 sonu)
  { time: 125, vel: 0.6, dur: '16n' }, { time: 125.5, vel: 0.7, dur: '16n' },
  { time: 126, vel: 0.8, dur: '16n' }, { time: 126.5, vel: 0.9, dur: '16n' },
  { time: 127, vel: 1.0, dur: '16n' }, { time: 127.5, vel: 1.0, dur: '16n' }
];
snareHits.forEach(s => notes.snare.push(defaultNote(s.time, 'D4', s.vel, s.dur)));

// --- HI-HAT PATTERN ---
// Sürekli 16'lık hi-hat + triplet roll'lar (trap'in kalbi)
for (let i = 0; i < 128; i += 0.5) {
    const stepInPattern = i % 16;
    let velocity = 0.6;
    
    // Accent pattern (1, 5, 9, 13 vuruşları güçlü)
    if (stepInPattern === 0) velocity = 0.9;
    else if (stepInPattern === 4 || stepInPattern === 8 || stepInPattern === 12) velocity = 0.8;
    else if (stepInPattern % 2 === 0) velocity = 0.7;
    
    notes.hiHat.push(defaultNote(i, 'F#4', velocity, '16n'));
}

// Özel hi-hat roll'ları (modern trap karakteristiği)
const rollPositions = [15, 31, 47, 63, 79, 95, 111, 127];
rollPositions.forEach(pos => {
    for (let i = 0; i < 6; i++) {
        const rollTime = pos + (i * 1/6);
        if (rollTime < 128) {
            notes.hiHat.push(defaultNote(rollTime, 'F#4', 0.5 + (i * 0.08), '32n'));
        }
    }
});

// --- OPEN HAT PATTERN ---
// Off-beat open hat'ler, vuruşları vurgular
const openHatHits = [
    3, 7, 11, 15, 19, 23, 27, 31,
    35, 39, 43, 47, 51, 55, 59, 63,
    67, 71, 75, 79, 83, 87, 91, 95,
    99, 103, 107, 111, 115, 119, 123, 127
];
openHatHits.forEach((time, index) => {
    const velocity = 0.6 + (Math.sin(index * 0.5) * 0.2);
    notes.openHat.push(defaultNote(time, 'G#4', velocity, '8n'));
});

// --- CRASH CYMBAL ---
// Bar başlarında ve transition'larda
const crashHits = [0, 32, 64, 96]; // Her 2 barda bir
crashHits.forEach(time => {
    notes.crash.push(defaultNote(time, 'C5', 0.8, '2n'));
});

// --- 808 SUB BASS ---
// Melodik bas line (G minor pentatonic)
const bassNotes = [
  // Bar 1-2
  { time: 0, pitch: 'G2', dur: '2n', vel: 0.9 },
  { time: 8, pitch: 'G2', dur: '4n', vel: 0.8 },
  { time: 14, pitch: 'Bb2', dur: '8n', vel: 0.85 },
  { time: 16, pitch: 'C3', dur: '2n', vel: 0.9 },
  { time: 24, pitch: 'C3', dur: '4n', vel: 0.8 },
  { time: 30, pitch: 'D3', dur: '8n', vel: 0.85 },
  
  // Bar 3-4
  { time: 32, pitch: 'Eb3', dur: '2n.', vel: 0.95 },
  { time: 48, pitch: 'F3', dur: '2n', vel: 0.9 },
  { time: 56, pitch: 'G3', dur: '4n', vel: 0.8 },
  { time: 62, pitch: 'F3', dur: '8n', vel: 0.85 },
  
  // Bar 5-6
  { time: 64, pitch: 'Eb3', dur: '2n', vel: 0.9 },
  { time: 72, pitch: 'D3', dur: '4n', vel: 0.8 },
  { time: 78, pitch: 'C3', dur: '8n', vel: 0.85 },
  { time: 80, pitch: 'Bb2', dur: '2n', vel: 0.9 },
  { time: 88, pitch: 'G2', dur: '4n', vel: 0.8 },
  { time: 94, pitch: 'Bb2', dur: '8n', vel: 0.85 },
  
  // Bar 7-8
  { time: 96, pitch: 'C3', dur: '1n', vel: 0.95 },
  { time: 112, pitch: 'G2', dur: '1n', vel: 0.9 },
  
  // Final 808 glide/slide
  { time: 124, pitch: 'Bb2', dur: '16n', vel: 0.7 },
  { time: 125, pitch: 'C3', dur: '16n', vel: 0.8 },
  { time: 126, pitch: 'D3', dur: '16n', vel: 0.9 },
  { time: 127, pitch: 'Eb3', dur: '16n', vel: 1.0 }
];
bassNotes.forEach(note => {
    notes.eight08.push(defaultNote(note.time, note.pitch, note.vel, note.dur));
});

// --- PERCUSSION ELEMENTS ---
// Tambourine, shaker gibi ek perkusyon
const percHits = [
    // Tambourine pattern
    { time: 1, pitch: 'A4', vel: 0.4 }, { time: 3, pitch: 'A4', vel: 0.35 },
    { time: 5, pitch: 'A4', vel: 0.4 }, { time: 7, pitch: 'A4', vel: 0.35 },
    { time: 9, pitch: 'A4', vel: 0.4 }, { time: 11, pitch: 'A4', vel: 0.35 },
    { time: 13, pitch: 'A4', vel: 0.4 }, { time: 15, pitch: 'A4', vel: 0.35 },
    
    // Shaker (daha sık)
    ...Array.from({length: 64}, (_, i) => ({
        time: i * 2, pitch: 'B4', vel: 0.25 + (Math.random() * 0.1)
    }))
];
percHits.forEach(note => {
    notes.perc.push(defaultNote(note.time, note.pitch, note.vel, '16n'));
});

// --- ENSTRÜMANLARI OLUŞTUR ---
export const initialInstruments = [
  { 
    id: 'inst-1', name: 'Trap Kick', type: 'sample', url: '/audio/kick.wav', 
    notes: [], mixerTrackId: 'track-1', // Notlar artık pattern'de
    envelope: { attack: 0.001, decay: 0.3, sustain: 0.6, release: 0.4 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: false,
  },
  { 
    id: 'inst-2', name: '808 Sub Bass', type: 'sample', url: '/audio/808.wav', 
    notes: [], mixerTrackId: 'track-2',
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 2.0 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: true, pianoRoll: true, // Piano roll için
  },
  { 
    id: 'inst-3', name: 'Trap Snare', type: 'sample', url: '/audio/snare.wav', 
    notes: [], mixerTrackId: 'track-3',
    envelope: { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.25 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: false,
  },
  { 
    id: 'inst-4', name: 'Hi-Hat Closed', type: 'sample', url: '/audio/hihat.wav', 
    notes: [], mixerTrackId: 'track-4',
    envelope: { attack: 0.001, decay: 0.05, sustain: 0.0, release: 0.1 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: false,
  },
  {
    id: 'inst-5', name: 'Hi-Hat Open', type: 'sample', url: '/audio/openhat.wav',
    notes: [], mixerTrackId: 'track-5',
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.0, release: 0.3 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: true, pianoRoll: false,
  },
  {
    id: 'inst-6', name: 'Crash Cymbal', type: 'sample', url: '/audio/crash.wav',
    notes: [], mixerTrackId: 'track-6',
    envelope: { attack: 0.01, decay: 0.8, sustain: 0.3, release: 2.0 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: true, pianoRoll: false,
  },
  {
    id: 'inst-7', name: 'Trap Perc', type: 'sample', url: '/audio/perc.wav',
    notes: [], mixerTrackId: 'track-7',
    envelope: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.3 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: false,
  }
];

// === PATTERN SİSTEMİ - EKSIK OLAN KISIM ===
export const initialPatterns = {
  'pattern-1': {
    id: 'pattern-1',
    name: 'MGK Till I Die (Trap)',
    data: {
      'inst-1': notes.kick,      // Trap Kick
      'inst-2': notes.eight08,   // 808 Sub Bass
      'inst-3': notes.snare,     // Trap Snare
      'inst-4': notes.hiHat,     // Hi-Hat Closed
      'inst-5': notes.openHat,   // Hi-Hat Open
      'inst-6': notes.crash,     // Crash Cymbal
      'inst-7': notes.perc,      // Trap Percussion
    }
  }
};

export const initialActivePatternId = 'pattern-1';

// === ARRANGEMENT TRACKS ===
export const initialArrangementTracks = [
  { id: 'track-drums', name: 'Drums', color: '#e11d48' },
  { id: 'track-bass', name: 'Bass', color: '#0ea5e9' },
  { id: 'track-perc', name: 'Percussion', color: '#10b981' },
  { id: 'track-fx', name: 'FX', color: '#8b5cf6' }
];

// === MİKSER KANALLARINI OLUŞTUR ===
const createEmptyTrack = (index) => ({
  id: `track-${index}`, name: `Insert ${index}`, type: 'track',
  volume: 0, pan: 0, insertEffects: [], sends: [],
});

const initialTracks = Array.from({ length: 100 }, (_, i) => createEmptyTrack(i + 1));

// Trap mix için optimize edilmiş kanal ayarları
const usedTracks = [
  { id: 'track-1', name: 'Trap Kick', volume: 0, pan: 0 },
  { id: 'track-2', name: '808 Sub', volume: -1, pan: 0, sends: [{ busId: 'bus-2', level: -20 }] },
  { id: 'track-3', name: 'Trap Snare', volume: -2, pan: 0.02, sends: [{ busId: 'bus-1', level: -15 }] },
  { id: 'track-4', name: 'Hi-Hat C', volume: -8, pan: -0.15 },
  { id: 'track-5', name: 'Hi-Hat O', volume: -10, pan: 0.2, sends: [{ busId: 'bus-1', level: -18 }] },
  { id: 'track-6', name: 'Crash', volume: -6, pan: 0, sends: [{ busId: 'bus-1', level: -12 }] },
  { id: 'track-7', name: 'Trap Perc', volume: -12, pan: 0.1 },
];

usedTracks.forEach(usedTrack => {
  const index = initialTracks.findIndex(t => t.id === usedTrack.id);
  if (index !== -1) initialTracks[index] = { ...initialTracks[index], ...usedTrack };
});

export const initialMixerTracks = [
  { id: 'master', name: 'Master', type: 'master', volume: 0, pan: 0, insertEffects: [], sends: [] },
  ...initialTracks,
  { 
    id: 'bus-1', name: 'Reverb Bus', type: 'bus', volume: -10, pan: 0, 
    insertEffects: [{ 
      id: 'fx-bus-reverb', type: 'Reverb', 
      settings: { decay: 2.2, preDelay: 0.015, wet: 0.9 }, 
      bypass: false 
    }], 
    sends: [] 
  },
  { 
    id: 'bus-2', name: 'Sub Compression', type: 'bus', volume: -3, pan: 0, 
    insertEffects: [{ 
      id: 'fx-bus-comp', type: 'Compressor', 
      settings: { threshold: -12, ratio: 8, attack: 0.01, release: 0.1, knee: 2, wet: 1.0 }, 
      bypass: false 
    }], 
    sends: [] 
  },
];