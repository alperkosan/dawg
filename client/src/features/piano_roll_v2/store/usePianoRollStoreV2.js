// src/features/piano_roll_v2/store/usePianoRollStoreV2.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const SCALES = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Minor': [0, 2, 3, 5, 7, 8, 10],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

// YENİ: LOD seviyelerini ve eşiklerini tanımlıyoruz
export const LOD_LEVELS = {
  DETAILED: 'detailed',       // En yakın zoom, 1/32'lik gridler
  NORMAL: 'normal',           // Standart görünüm, 1/16'lık gridler
  SIMPLIFIED: 'simplified',     // Uzak görünüm, sadece beat ve bar'lar
  OVERVIEW: 'overview',         // En uzak, sadece ana bar'lar
};

const getLODLevelFromZoom = (zoomX) => {
    if (zoomX >= 2.0) return LOD_LEVELS.DETAILED;   // 200% ve üzeri - tüm detaylar
    if (zoomX >= 1.0) return LOD_LEVELS.NORMAL;     // 100-199% - standart görünüm
    if (zoomX >= 0.5) return LOD_LEVELS.SIMPLIFIED; // 50-99% - basitleştirilmiş
    return LOD_LEVELS.OVERVIEW;                     // 50% altı - sadana ana hatlar
};


const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const usePianoRollStoreV2 = create(
  persist(
    (set, get) => ({
      // State
      scale: { root: 'C', type: 'Minor' },
      showScaleHighlighting: true,
      showGhostNotes: true,
      activeTool: 'pencil',
      gridSnapValue: '16n',
      snapMode: 'hard',
      lastUsedDuration: '32n',
      zoomX: 1,
      zoomY: 1,
      velocityLaneHeight: 100,
      showVelocityLane: true,
      
      // Actions
      setScale: (root, type) => set({ scale: { root, type } }),
      toggleScaleHighlighting: () => set(state => ({ showScaleHighlighting: !state.showScaleHighlighting })),
      toggleGhostNotes: () => set(state => ({ showGhostNotes: !state.showGhostNotes })),
      setActiveTool: (tool) => set({ activeTool: tool }),
      setGridSnapValue: (snap) => set({ gridSnapValue: snap }),
      toggleSnapMode: () => set(state => ({ snapMode: state.snapMode === 'hard' ? 'soft' : 'hard' })),
      setLastUsedDuration: (duration) => set({ lastUsedDuration: duration }),
      
      setZoomX: (newZoomX) => {
        const clampedZoom = clamp(newZoomX, 0.1, 20);
        console.log('[STORE DEBUG] setZoomX', { from: get().zoomX, to: clampedZoom });
        set({ zoomX: clampedZoom });
      },
      setZoomY: (newZoomY) => {
        const clampedZoom = clamp(newZoomY, 0.5, 5);
        console.log('[STORE DEBUG] setZoomY', { from: get().zoomY, to: clampedZoom });
        set({ zoomY: clampedZoom });
      },
      zoomIn: () => {
        const currentZoom = get().zoomX;
        const newZoom = clamp(currentZoom * 1.25, 0.1, 20);
        console.log('[STORE DEBUG] zoomIn', { from: currentZoom, to: newZoom });
        set({ zoomX: newZoom });
      },
      zoomOut: () => {
        const currentZoom = get().zoomX;
        const newZoom = clamp(currentZoom / 1.25, 0.1, 20);
        console.log('[STORE DEBUG] zoomOut', { from: currentZoom, to: newZoom });
        set({ zoomX: newZoom });
      },
      setVelocityLaneHeight: (height) => {
        const clampedHeight = clamp(height, 20, 300);
        const showLane = height > 20;
        console.log('[STORE DEBUG] setVelocityLaneHeight', { height: clampedHeight, show: showLane });
        set({
          velocityLaneHeight: clampedHeight,
          showVelocityLane: showLane
        });
      },
      toggleVelocityLane: () => {
        const currentState = get();
        const newShowState = !currentState.showVelocityLane;
        const newHeight = newShowState ? 100 : 0;
        console.log('[STORE DEBUG] toggleVelocityLane', { from: currentState.showVelocityLane, to: newShowState });
        set({
          showVelocityLane: newShowState,
          velocityLaneHeight: newHeight
        });
      },

      // YENİ: LOD seviyesini hesaplayan ve tüm bileşenlerin kullanacağı merkezi seçici (selector)
      getLODLevel: () => {
        return getLODLevelFromZoom(get().zoomX);
      },
    }),
    {
      name: 'soundforge-pianoroll-v2-settings',
      partialize: (state) => ({
        scale: state.scale,
        showScaleHighlighting: state.showScaleHighlighting,
        showGhostNotes: state.showGhostNotes,
        gridSnapValue: state.gridSnapValue,
        snapMode: state.snapMode,
        velocityLaneHeight: state.velocityLaneHeight,
        showVelocityLane: state.showVelocityLane,
        zoomX: state.zoomX,
        zoomY: state.zoomY,
      })
    }
  )
);