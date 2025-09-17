/**
 * @file initialData.js
 * @description Projenin başlangıçtaki tüm enstrüman, nota ve mikser verilerini içerir.
 * YENİ: Pattern, MGK - "Till I Die" tarzı enerjik ve modern bir trap ritmiyle güncellenmiştir.
 */

// Her notaya benzersiz bir ID ekleyen yardımcı fonksiyon.
export const defaultNote = (time, pitch = 'C4', velocity = 1.0, duration = '16n') => ({
  id: `note_${time}_${pitch}_${Math.random().toString(36).substring(7)}`,
  time, pitch, velocity, duration
});

// --- MGK "TILL I DIE" TARZI ENERJİK TRAP PATTERN ---
// Bu pattern, 8 barlık (128 adım) oldukça dinamik bir döngüden oluşur.
const notes = {
  kick: [],
  snare: [],
  hiHat: [],
  openHat: [],
  eight08: [],
};

// --- KICK ---
// Daha fazla senkop ve beklenmedik vuruşlarla dolu, agresif bir yapı.
const kickPattern = [
  { time: 0, vel: 1.0 }, { time: 6, vel: 0.9 }, { time: 8, vel: 1.0 }, { time: 14, vel: 0.95 },
  { time: 16, vel: 1.0 }, { time: 22, vel: 0.9 }, { time: 24, vel: 1.0 }, { time: 30, vel: 1.0 },
  { time: 32, vel: 1.0 }, { time: 38, vel: 0.9 }, { time: 40, vel: 1.0 }, { time: 46, vel: 0.95 },
  { time: 48, vel: 1.0 }, { time: 54, vel: 0.9 }, { time: 56, vel: 1.0 }, { time: 62, vel: 1.0 },
  { time: 64, vel: 1.0 }, { time: 70, vel: 0.9 }, { time: 72, vel: 1.0 }, { time: 78, vel: 0.95 },
  { time: 80, vel: 1.0 }, { time: 86, vel: 0.9 }, { time: 88, vel: 1.0 }, { time: 94, vel: 1.0 },
  { time: 96, vel: 1.0 }, { time: 102, vel: 0.9 }, { time: 104, vel: 1.0 }, { time: 110, vel: 0.95 },
  { time: 112, vel: 1.0 }, { time: 118, vel: 0.9 }, { time: 120, vel: 1.0 }, { time: 124, vel: 1.0 }, { time: 126, vel: 1.0 }
];
kickPattern.forEach(k => notes.kick.push(defaultNote(k.time, 'C4', k.vel)));

// --- SNARE ---
// Klasik 2 ve 4 vuruşları, ancak son barda heyecan yaratan bir snare roll ile.
const snarePattern = [
  { time: 4 }, { time: 12 }, { time: 20 }, { time: 28 },
  { time: 36 }, { time: 44 }, { time: 52 }, { time: 60 },
  { time: 68 }, { time: 76 }, { time: 84 }, { time: 92 },
  { time: 100 }, { time: 108 }, { time: 116 }, { time: 124 },
];
snarePattern.forEach(s => notes.snare.push(defaultNote(s.time, 'D4', 1.0)));
// Döngü sonu snare roll
notes.snare.push(defaultNote(125, 'D4', 0.6));
notes.snare.push(defaultNote(126, 'D4', 0.7));
notes.snare.push(defaultNote(126.5, 'D4', 0.8));
notes.snare.push(defaultNote(127, 'D4', 0.9));
notes.snare.push(defaultNote(127.5, 'D4', 1.0));


// --- HI-HAT ---
// Bu tarzın kalbi: Sürekli 16'lık notalar, velocity oynamaları ve hızlı triplet roll'lar.
for (let i = 0; i < 128; i += 0.5) {
    // Her 4 vuruşta bir velocity'yi değiştirerek bounce efekti yarat
    const stepInBar = i % 16;
    let velocity = 0.7;
    if (stepInBar % 4 === 0) velocity = 0.9;
    if (stepInBar % 2 === 0) velocity = 0.8;
    notes.hiHat.push(defaultNote(i, 'F#4', velocity));
}
// Özel roll'lar ekle
// 2. barın sonunda hızlı bir triplet roll
for (let i = 0; i < 6; i++) notes.hiHat.push(defaultNote(30 + (i * (1/3)), 'F#4', 0.6 + i * 0.05));
// 4. barın sonunda 32'lik bir roll
for (let i = 0; i < 4; i++) notes.hiHat.push(defaultNote(62 + (i * 0.5), 'F#4', 0.7 + i * 0.05));
// 6. barın sonunda yine triplet
for (let i = 0; i < 6; i++) notes.hiHat.push(defaultNote(94 + (i * (1/3)), 'F#4', 0.6 + i * 0.05));
// 8. barın sonunda çok hızlı bir final roll
for (let i = 0; i < 8; i++) notes.hiHat.push(defaultNote(126 + (i * 0.25), 'F#4', 0.5 + i * 0.06));

// --- OPEN HAT ---
// Vurguları güçlendirmek için genellikle snare'den hemen önce veya off-beat'lerde.
const openHatPattern = [2, 14, 18, 30, 34, 46, 50, 62, 66, 78, 82, 94, 98, 110, 114, 126];
openHatPattern.forEach(oh => notes.openHat.push(defaultNote(oh, 'G#4', 0.7, '8n')));

// --- 808 BASS ---
// Karanlık, melodik ve kick ile senkronize bir bas hattı (G minör skalasında).
const bassline = [
  { time: 0, pitch: 'G4', duration: '2n' }, { time: 8, pitch: 'G4', duration: '4n' },
  { time: 14, pitch: 'A#4', duration: '8n' }, { time: 16, pitch: 'C5', duration: '2n' },
  { time: 24, pitch: 'C5', duration: '4n' }, { time: 30, pitch: 'D5', duration: '8n' },
  { time: 32, pitch: 'D#5', duration: '2n.' }, { time: 48, pitch: 'F5', duration: '2n' },
  { time: 62, pitch: 'G5', duration: '8n' }, { time: 64, pitch: 'D#5', duration: '2n' },
  { time: 80, pitch: 'D5', duration: '2n' }, { time: 94, pitch: 'C5', duration: '8n' },
  { time: 96, pitch: 'A#4', duration: '1n' }, { time: 112, pitch: 'G4', duration: '1n' },
  // Final 808 roll
  { time: 124, pitch: 'A#4', duration: '16n' }, { time: 125, pitch: 'C5', duration: '16n' },
  { time: 126, pitch: 'D5', duration: '16n' }, { time: 127, pitch: 'D#5', duration: '16n' }
];
bassline.forEach(b => {
    notes.eight08.push({ ...defaultNote(b.time, b.pitch), duration: b.duration });
});


// --- ENSTRÜMANLARI OLUŞTUR ---
export const initialInstruments = [
  { 
    id: 'inst-1', name: 'Kick', type: 'sample', url: '/audio/kick.wav', 
    notes: notes.kick, mixerTrackId: 'track-1',
    envelope: { attack: 0.001, decay: 0.2, sustain: 0.8, release: 0.3 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: false,
  },
  { 
    id: 'inst-3', name: 'Snare', type: 'sample', url: '/audio/snare.wav', 
    notes: notes.snare, mixerTrackId: 'track-3',
    envelope: { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.2 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: false,
  },
  { 
    id: 'inst-4', name: 'Hi-Hat', type: 'sample', url: '/audio/hihat.wav', 
    notes: notes.hiHat, mixerTrackId: 'track-4',
    envelope: { attack: 0.001, decay: 0.05, sustain: 0.0, release: 0.1 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: false,
  },
  {
    id: 'inst-6', name: 'Open Hat', type: 'sample', url: '/audio/openhat.wav',
    notes: notes.openHat, mixerTrackId: 'track-6',
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.0, release: 0.3 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: true, // Open hat'ler genellikle birbirini keser
  },
  { 
    id: 'inst-2', name: '808', type: 'sample', url: '/audio/808.wav', 
    notes: notes.eight08, mixerTrackId: 'track-2',
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 1.5 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: true, // 808 notaları birbirini kesmeli (glide efekti için)
    pianoRoll: true,
  },
];

// --- MİKSER KANALLARINI OLUŞTUR (Bu kısım aynı kalabilir) ---
const createEmptyTrack = (index) => ({
  id: `track-${index}`, name: `Insert ${index}`, type: 'track',
  volume: 0, pan: 0, insertEffects: [], sends: [],
});

const initialTracks = Array.from({ length: 10 }, (_, i) => createEmptyTrack(i + 1));

// Kullanılan kanalların başlangıç ayarları
const usedTracks = [
  { id: 'track-1', name: 'Kick', volume: 0 },
  { id: 'track-2', name: '808', volume: -2 },
  { id: 'track-3', name: 'Snare', volume: -3.5, pan: 0.05, sends: [{ busId: 'bus-1', level: -18 }] },
  { id: 'track-4', name: 'Hi-Hat', volume: -9, pan: -0.1 },
  { id: 'track-6', name: 'Open Hat', volume: -12, pan: 0.15, sends: [{ busId: 'bus-1', level: -15 }] },
];

usedTracks.forEach(usedTrack => {
  const index = initialTracks.findIndex(t => t.id === usedTrack.id);
  if (index !== -1) initialTracks[index] = { ...initialTracks[index], ...usedTrack };
});

export const initialMixerTracks = [
  { id: 'master', name: 'Master', type: 'master', volume: 0, pan: 0, insertEffects: [], sends: [] },
  ...initialTracks,
  { 
    id: 'bus-1', name: 'Reverb', type: 'bus', volume: -12, pan: 0, 
    insertEffects: [{ id: 'fx-bus-reverb', type: 'Reverb', settings: { decay: 1.8, preDelay: 0.01, wet: 1.0 }, bypass: false }], 
    sends: [] 
  },
];