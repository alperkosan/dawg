/**
 * @file initialData.js
 * @description Projenin başlangıçtaki tüm enstrüman, nota ve mikser verilerini içerir.
 * Bu dosya, uygulamanın ilk açıldığındaki varsayılan "şablonunu" tanımlar.
 * 
 * v2.0 - Timing precision ve performance optimizasyonları
 */

/**
 * OPTIMIZE EDİLMİŞ nota oluşturma fonksiyonu - Fractional timing sorunlarını önler
 * @param {number} time - Notanın 16'lık grid'deki konumu (adımı).
 * @param {string} [pitch='C4'] - Notanın perdesi.
 * @param {number} [velocity=1.0] - Notanın vuruş gücü (0.0 ile 1.0 arası).
 * @param {string} [duration='16n'] - Notanın uzunluğu.
 * @returns {object} Bir nota objesi.
 */
export const defaultNote = (time, pitch = 'C4', velocity = 1.0, duration = '16n') => ({
  time: Math.round(time * 1000) / 1000, // 3 decimal precision - timing stability için
  pitch, 
  velocity, 
  duration
});

// --- OPTIMIZE EDİLMİŞ 32 BARLIK TRAP PATTERN ---
// Performance için daha az yoğun, ama aynı müzikal etkiyi veren pattern

const notes = {
  kick: [],
  snare: [],
  hiHat: [],
  openHat: [],
  eight08: [],
};

// 8 Barlık Ana Döngü (Optimized Loop)
const mainLoop = (barOffset) => {
  const stepOffset = barOffset * 128; // Her döngü 128 adımdır (8 bar * 16 adım)

  // --- KICK (Değişiklik yok - zaten optimize) ---
  const kickPattern = [
    { time: 0, vel: 1.0 }, { time: 2, vel: 0.7 }, { time: 10, vel: 1.0 }, 
    { time: 16, vel: 1.0 }, { time: 26, vel: 1.0 }, { time: 32, vel: 1.0 }, 
    { time: 38, vel: 0.7 }, { time: 42, vel: 1.0 }, { time: 48, vel: 1.0 }, 
    { time: 58, vel: 1.0 }, { time: 64, vel: 1.0 }, { time: 66, vel: 0.7 },
    { time: 74, vel: 1.0 }, { time: 80, vel: 1.0 }, { time: 90, vel: 1.0 },
    { time: 96, vel: 1.0 }, { time: 102, vel: 0.7 }, { time: 108, vel: 1.0 },
    { time: 112, vel: 1.0 }, { time: 122, vel: 1.0 }, { time: 126, vel: 1.0 },
  ];
  kickPattern.forEach(k => notes.kick.push(defaultNote(stepOffset + k.time, 'C3', k.vel)));

  // --- SNARE (Aynı kalıyor - zaten stabil) ---
  const snarePattern = [
    { time: 4, vel: 1.0 }, { time: 12, vel: 1.0 }, { time: 20, vel: 1.0 },
    { time: 28, vel: 1.0 }, { time: 31, vel: 0.6 }, { time: 36, vel: 1.0 },
    { time: 44, vel: 1.0 }, { time: 52, vel: 1.0 }, { time: 60, vel: 1.0 },
    { time: 62, vel: 0.5 }, { time: 68, vel: 1.0 }, { time: 76, vel: 1.0 },
    { time: 84, vel: 1.0 }, { time: 87, vel: 0.6 }, { time: 92, vel: 1.0 },
    { time: 100, vel: 1.0 }, { time: 108, vel: 1.0 }, { time: 116, vel: 1.0 },
    { time: 124, vel: 1.0 }, { time: 127, vel: 0.7 },
  ];
  snarePattern.forEach(s => notes.snare.push(defaultNote(stepOffset + s.time, 'D3', s.vel)));
  
  // --- HI-HAT (KRİTİK OPTİMİZASYON: Fractional timing kaldırıldı) ---
  for (let bar = 0; bar < 8; bar++) {
    const barStart = stepOffset + bar * 16;
    
    if (bar % 4 === 1) { // Her 4 barın 2.'si - Triplet rulo optimize edildi
      // 12 yerine 6 nota, 2/3 yerine 1 step intervals
      for(let i = 0; i < 6; i++) {
        notes.hiHat.push(defaultNote(
          barStart + 10 + (i * 1), // Tam sayı step intervals
          'F#3', 
          0.5 + i * 0.08
        ));
      }
    } else if (bar % 4 === 3) { // Her 4 barın 4.'sü - 32'lik rulo optimize edildi
      // 8 yerine 4 nota, 0.5 yerine 1 step intervals  
      for(let i = 0; i < 4; i++) {
        notes.hiHat.push(defaultNote(
          barStart + 12 + i * 1, // Tam sayı step intervals
          'F#3', 
          0.4 + i * 0.1
        ));
      }
    } else {
      // Standart 8'likler (değişiklik yok - zaten stabil)
      const standardPattern = [0, 2, 4, 6, 8, 10, 12, 14];
      const velocities = [0.8, 0.7, 0.9, 0.7, 0.8, 0.75, 0.9, 0.8];
      
      standardPattern.forEach((step, index) => {
        notes.hiHat.push(defaultNote(barStart + step, 'F#3', velocities[index]));
      });
    }
  }

  // --- OPEN HAT (Değişiklik yok - zaten optimize) ---
  const openHatPattern = [14, 30, 46, 62, 78, 94, 110, 126];
  openHatPattern.forEach(oh => notes.openHat.push(defaultNote(stepOffset + oh, 'G#3', 0.7)));

  // --- 808 BASS (KRİTİK OPTİMİZASYON: Overlap önlemek için kısa duration'lar) ---
  const bassline = [
    { time: 0, pitch: 'G4', duration: '4n', vel: 1.0 }, // 2n'den 4n'ye düşürüldü
    { time: 8, pitch: 'G4', duration: '8n', vel: 0.9 }, // Yeni not eklendi
    { time: 16, pitch: 'G4', duration: '4n', vel: 1.0 }, // 4n kaldı
    { time: 24, pitch: 'C4', duration: '8n', vel: 0.8 }, // 4n'den 8n'ye düşürüldü
    { time: 32, pitch: 'D#5', duration: '4n', vel: 1.0 }, // 2n'den 4n'ye düşürüldü
    { time: 40, pitch: 'D5', duration: '8n', vel: 0.9 }, // 4n'den 8n'ye düşürüldü
    { time: 48, pitch: 'C4', duration: '2n', vel: 1.0 }, // 2n.'den 2n'ye düşürüldü
    { time: 64, pitch: 'G4', duration: '4n', vel: 1.0 }, // 2n'den 4n'ye düşürüldü
    { time: 72, pitch: 'G4', duration: '8n', vel: 0.8 }, // Yeni not eklendi
    { time: 80, pitch: 'G#4', duration: '8n', vel: 0.9 }, // 4n'den 8n'ye düşürüldü
    { time: 88, pitch: 'A#4', duration: '8n', vel: 0.8 }, // 4n'den 8n'ye düşürüldü
    { time: 96, pitch: 'C4', duration: '2n', vel: 1.0 }, // 1n'den 2n'ye düşürüldü
  ];
  
  bassline.forEach(b => {
    notes.eight08.push({
      ...defaultNote(stepOffset + b.time, b.pitch, b.vel),
      duration: b.duration
    });
  });
};

// 8 barlık ana döngüyü 4 kez çalıştırarak 32 barlık (512 adım) deseni oluştur.
for (let i = 0; i < 4; i++) {
  mainLoop(i);
}

// --- OPTIMIZE EDİLMİŞ 808 ATAĞI ---
// 32. barın sonunda, overlap riski olmayan kısa notalar
const attackTime = 512 - 4; // Son 4 adıma
notes.eight08.push(defaultNote(attackTime + 0, 'G3', 1.0, '16n'));
notes.eight08.push(defaultNote(attackTime + 1, 'A#3', 1.0, '16n'));
notes.eight08.push(defaultNote(attackTime + 2, 'C4', 1.0, '16n'));
notes.eight08.push(defaultNote(attackTime + 3, 'D4', 1.0, '16n'));

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
    isMuted: false, cutItself: false, pianoRoll: false, // cutItself artık false
  },
  {
    id: 'inst-6', name: 'Open Hat', type: 'sample', url: '/audio/openhat.wav',
    notes: notes.openHat, mixerTrackId: 'track-6',
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.0, release: 0.3 },
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: false, // cutItself artık false
  },
  { 
    id: 'inst-2', name: '808', type: 'sample', url: '/audio/808.wav', 
    notes: notes.eight08, mixerTrackId: 'track-2',
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.8 }, // Release kısaltıldı: 1.5'ten 0.8'e
    precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
    isMuted: false, cutItself: false, pianoRoll: true, // cutItself artık false
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