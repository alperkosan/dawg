/**
 * @file usePianoRollStore.js
 * @description Sadece Piano Roll paneline özgü durumları yönetir.
 * Zoom seviyeleri, aktif çizim aracı, gam (scale) vurgulama gibi
 * arayüzle ilgili ayarları tutar.
 */
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

export const usePianoRollStore = create((set) => ({
  // --- STATE ---
  scale: { root: 'C', type: 'Minor' },
  showScaleHighlighting: true,
  activeTool: 'pencil',
  zoomX: 1, // Yatay zoom
  zoomY: 1, // Dikey zoom
  
  // --- ACTIONS ---
  setScale: (root, type) => set({ scale: { root, type } }),
  toggleScaleHighlighting: () => set(state => ({ showScaleHighlighting: !state.showScaleHighlighting })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  
  handleZoom: (deltaX, deltaY) => {
    set(state => ({
      zoomX: clamp(state.zoomX + deltaX * 0.01, 0.25, 4),
      zoomY: clamp(state.zoomY + deltaY * 0.01, 0.5, 3),
    }));
  },

  zoomIn: () => set(state => ({ zoomX: clamp(state.zoomX * 1.2, 0.25, 4)})),
  zoomOut: () => set(state => ({ zoomX: clamp(state.zoomX / 1.2, 0.25, 4)})),
}));
