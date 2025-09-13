import { create } from 'zustand';

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const SCALES = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Minor': [0, 2, 3, 5, 7, 8, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Locrian': [0, 1, 3, 4, 7, 8, 10],
  'Pentatonic Major': [0, 2, 4, 7, 9],
  'Pentatonic Minor': [0, 3, 5, 7, 10],
};
const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const usePianoRollStore = create((set, get) => ({
  // --- STATE ---
  scale: { root: 'C', type: 'Minor' },
  showScaleHighlighting: true,
  activeTool: 'pencil',
  zoomX: 1,
  zoomY: 1,
  gridSnapValue: '16n',
  lastUsedDuration: '16n',
  showVelocityLane: true,
  velocityLaneHeight: 100,

  // --- ACTIONS ---
  setScale: (root, type) => set({ scale: { root, type } }),
  toggleScaleHighlighting: () => set(state => ({ showScaleHighlighting: !state.showScaleHighlighting })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  
  // GÜNCELLEME: handleZoom fonksiyonu, zoom işleminin merkezlenmesi için
  // PianoRoll.jsx bileşenindeki DOM manipülasyonu ile birlikte çalışır.
  // Buradaki zoomFactor, zoom'un hassasiyetini ayarlar.
  handleZoom: (deltaX, deltaY) => {
    set(state => ({
      zoomX: clamp(state.zoomX + deltaX, 0.25, 5),
      zoomY: clamp(state.zoomY + deltaY, 0.5, 3),
    }));
  },

  // YENİ: Belirli bir zoom ve scroll değerine animasyonlu geçiş için.
  setView: ({ zoomX, zoomY, scrollLeft, scrollTop }) => {
    set({ 
        zoomX: clamp(zoomX, 0.25, 5),
        zoomY: clamp(zoomY, 0.5, 3),
        // Bu değerler doğrudan PianoRoll bileşeni tarafından okunacak.
        targetScroll: { left: scrollLeft, top: scrollTop }
    });
    // Scroll pozisyonunu sıfırlamak için bir kerelik bir state yaratıyoruz.
    setTimeout(() => set({ targetScroll: null }), 10);
  },

  zoomIn: () => set(state => ({ zoomX: clamp(state.zoomX * 1.2, 0.25, 5)})),
  zoomOut: () => set(state => ({ zoomX: clamp(state.zoomX / 1.2, 0.25, 5)})),

  setGridSnapValue: (snap) => set({ gridSnapValue: snap }),
  setLastUsedDuration: (duration) => set({ lastUsedDuration: duration }),

  toggleVelocityLane: () => set(state => {
    if (state.showVelocityLane && state.velocityLaneHeight > 0) {
      return { velocityLaneHeight: 0 };
    }
    return { velocityLaneHeight: 100, showVelocityLane: true };
  }),

  setVelocityLaneHeight: (delta) => set(state => {
      const newHeight = state.velocityLaneHeight + delta;
      return { velocityLaneHeight: clamp(newHeight, 0, 300) };
  }),
}));