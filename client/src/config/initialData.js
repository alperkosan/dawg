/**
 * @file initialData.js
 * @description Projenin başlangıçtaki tüm enstrüman, nota ve mikser verilerini içerir.
 * Bu dosya, uygulamanın ilk açıldığındaki varsayılan "şablonunu" tanımlar.
 */

/**
 * Nota oluşturmak için kullanılan yardımcı fonksiyon.
 * @param {number} time - Notanın 16'lık grid'deki konumu (adımı).
 * @param {string} [pitch='C4'] - Notanın perdesi.
 * @param {number} [velocity=1.0] - Notanın vuruş gücü (0.0 ile 1.0 arası).
 * @param {string} [duration='16n'] - Notanın uzunluğu.
 * @returns {object} Bir nota objesi.
 */
// GÜNCELLEME: Her notaya benzersiz bir ID ekleniyor.
export const defaultNote = (time, pitch = 'C4', velocity = 1.0, duration = '16n') => ({
  id: `note_${time}_${pitch}_${Math.random().toString(36).substring(7)}`,
  time, pitch, velocity, duration
});

// --- 32 BARLIK HİSSİYATLI TRAP PATTERN ---
// Bu pattern, 8 barlık (128 adım) bir ana döngünün 4 kez tekrarından oluşur.

const notes = {
  kick: [],
  snare: [],
  hiHat: [],
  openHat: [],
  eight08: [],
};

// 8 Barlık Ana Döngü (Loop)
const mainLoop = (barOffset) => {
  const stepOffset = barOffset * 1; // Her döngü 128 adımdır (8 bar * 16 adım)

  // --- KICK ---
  // Vurgulu (1.0) ve hayalet (0.7) notaların birleşimiyle "bouncy" bir his.
  const kickPattern = [
    { time: 0, vel: 1.0 }, { time: 2, vel: 0.7 }, { time: 10, vel: 1.0 }, 
    { time: 16, vel: 1.0 }, { time: 26, vel: 1.0 }, { time: 32, vel: 1.0 }, 
    { time: 38, vel: 0.7 }, { time: 42, vel: 1.0 }, { time: 48, vel: 1.0 }, 
    { time: 58, vel: 1.0 }, { time: 64, vel: 1.0 }, { time: 66, vel: 0.7 },
    { time: 74, vel: 1.0 }, { time: 80, vel: 1.0 }, { time: 90, vel: 1.0 },
    { time: 96, vel: 1.0 }, { time: 102, vel: 0.7 }, { time: 108, vel: 1.0 },
    { time: 112, vel: 1.0 }, { time: 122, vel: 1.0 }, { time: 126, vel: 1.0 },
  ];
  kickPattern.forEach(k => notes.kick.push(defaultNote(stepOffset + k.time, 'C4', k.vel)));

  // --- SNARE ---
  // Ana vuruşlar güçlü, ara süslemeler (ghost notes) daha düşük velocity'de.
  const snarePattern = [
    { time: 4, vel: 1.0 }, { time: 12, vel: 1.0 }, { time: 20, vel: 1.0 },
    { time: 28, vel: 1.0 }, { time: 31, vel: 0.6 }, { time: 36, vel: 1.0 },
    { time: 44, vel: 1.0 }, { time: 52, vel: 1.0 }, { time: 60, vel: 1.0 },
    { time: 62, vel: 0.5 }, { time: 68, vel: 1.0 }, { time: 76, vel: 1.0 },
    { time: 84, vel: 1.0 }, { time: 87, vel: 0.6 }, { time: 92, vel: 1.0 },
    { time: 100, vel: 1.0 }, { time: 108, vel: 1.0 }, { time: 116, vel: 1.0 },
    { time: 124, vel: 1.0 }, { time: 127, vel: 0.7 },
  ];
  snarePattern.forEach(s => notes.snare.push(defaultNote(stepOffset + s.time, 'D4', s.vel)));
  
  // --- HI-HAT ---
  // Farklı hızlarda rulolar (rolls) ve velocity oynamalarıyla dolu.
  for (let bar = 0; bar < 8; bar++) {
    const barStart = stepOffset + bar * 16;
    if (bar % 4 === 1) { // Her 4 barın 2.'si (Örn: 2, 6, 10...)
      // Hızlı triplet (üçleme) rulo
      for(let i=0; i<12; i++) notes.hiHat.push(defaultNote(barStart + 10 + (i * (2/3)), 'F#4', 0.5 + i*0.04));
    } else if (bar % 4 === 3) { // Her 4 barın 4.'sü (Örn: 4, 8, 12...)
      // Hızlanan 32'lik rulo
      for(let i=0; i<8; i++) notes.hiHat.push(defaultNote(barStart + 12 + i*0.5, 'F#4', 0.4 + i*0.05));
    } else {
      // Standart 8'likler (arada boşluklu ve velocity'li)
      notes.hiHat.push(defaultNote(barStart + 0, 'F#4', 0.8));
      notes.hiHat.push(defaultNote(barStart + 2, 'F#4', 0.7));
      notes.hiHat.push(defaultNote(barStart + 4, 'F#4', 0.9));
      notes.hiHat.push(defaultNote(barStart + 6, 'F#4', 0.7));
      notes.hiHat.push(defaultNote(barStart + 8, 'F#4', 0.8));
      notes.hiHat.push(defaultNote(barStart + 10, 'F#4', 0.75));
      notes.hiHat.push(defaultNote(barStart + 12, 'F#4', 0.9));
      notes.hiHat.push(defaultNote(barStart + 14, 'F#4', 0.8));
    }
  }

  // --- OPEN HAT ---
  // Genellikle her 2 barın sonunda, groove'u açmak için kullanılır.
  const openHatPattern = [14, 30, 46, 62, 78, 94, 110, 126];
  openHatPattern.forEach(oh => notes.openHat.push(defaultNote(stepOffset + oh, 'G#4', 0.7)));

  // --- 808 BASS ---
  // Kick'i takip eden ama kendi melodik yapısı olan bir bas hattı (G minör)
  const bassline = [
    { time: 0, pitch: 'G4', duration: '2n' }, { time: 10, pitch: 'G4', duration: '4n' },
    { time: 16, pitch: 'G4', duration: '4n' }, { time: 26, pitch: 'C5', duration: '4n' },
    { time: 32, pitch: 'D#5', duration: '2n' }, { time: 42, pitch: 'D5', duration: '4n' },
    { time: 48, pitch: 'C4', duration: '2n.' }, { time: 64, pitch: 'G4', duration: '2n' },
    { time: 74, pitch: 'G4', duration: '4n' }, { time: 80, pitch: 'G#4', duration: '4n' },
    { time: 90, pitch: 'A#5', duration: '4n' }, { time: 96, pitch: 'C5', duration: '1n' },
  ];
  // GÜNCELLEME: Özel bas notalarına da benzersiz ID ekleniyor.
  bassline.forEach(b => {
      const note = defaultNote(stepOffset + b.time, b.pitch);
      notes.eight08.push({ ...note, duration: b.duration });
  });
};

// 8 barlık ana döngüyü 4 kez çalıştırarak 32 barlık (512 adım) deseni oluştur.
for (let i = 0; i < 1; i++) {
  mainLoop(i);
}

// --- ÖZEL 808 ATAĞI ---
// 32. barın sonunda, bir sonraki döngüye bağlanmak için hızlı bir 808 rulosu.
const attackTime = 512 - 4; // Son 4 adıma
// GÜNCELLEME: Atak notalarına da ID ekleniyor.
notes.eight08.push({ id: `note_${attackTime + 0}`, time: attackTime + 0, pitch: 'G4', duration: '16n', velocity: 0.8 });
notes.eight08.push({ id: `note_${attackTime + 1}`, time: attackTime + 1, pitch: 'A#4', duration: '16n', velocity: 0.9 });
notes.eight08.push({ id: `note_${attackTime + 2}`, time: attackTime + 2, pitch: 'C5', duration: '16n', velocity: 1.0 });
notes.eight08.push({ id: `note_${attackTime + 3}`, time: attackTime + 3, pitch: 'D5', duration: '16n', velocity: 1.0 });


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
    id: 'inst-6', name: 'Open Hat', type: 'sample', url: '/audio/openhat.wav', // Yeni ses dosyası (varsayımsal)
    notes: notes.openHat, mixerTrackId: 'track-6',
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.0, release: 0.3 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: false,
  },
  { 
    id: 'inst-2', name: '808', type: 'sample', url: '/audio/808.wav', 
    notes: notes.eight08, mixerTrackId: 'track-2',
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 1.5 }, // Uzun release
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: true,
  },
];

// --- MİKSER KANALLARINI OLUŞTUR ---
const createEmptyTrack = (index) => ({
  id: `track-${index}`, name: `Insert ${index}`, type: 'track',
  volume: 0, pan: 0, insertEffects: [], sends: [],
});

const initialTracks = Array.from({ length: 100 }, (_, i) => createEmptyTrack(i + 1));

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