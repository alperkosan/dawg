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

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const usePianoRollStoreV2 = create(
  persist(
    (set) => ({
      // State
      scale: { root: 'C', type: 'Minor' },
      showScaleHighlighting: true,
      showGhostNotes: true,
      activeTool: 'pencil',
      gridSnapValue: '16n',
      snapMode: 'hard',
      lastUsedDuration: '32n', // Default to 32nd note for shorter notes
      zoomX: 1,
      zoomY: 1,
      velocityLaneHeight: 100, // Başlangıç yüksekliği
      showVelocityLane: true,
      
      // Actions
      setScale: (root, type) => set({ scale: { root, type } }),
      toggleScaleHighlighting: () => set(state => ({ showScaleHighlighting: !state.showScaleHighlighting })),
      toggleGhostNotes: () => set(state => ({ showGhostNotes: !state.showGhostNotes })),
      setActiveTool: (tool) => set({ activeTool: tool }),
      setGridSnapValue: (snap) => set({ gridSnapValue: snap }),
      toggleSnapMode: () => set(state => ({ snapMode: state.snapMode === 'hard' ? 'soft' : 'hard' })),
      setLastUsedDuration: (duration) => set({ lastUsedDuration: duration }),
      
      // === YENİ VE GÜNCELLENMİŞ ZOOM AKSİYONLARI ===
      setZoomX: (newZoomX) => set({ zoomX: clamp(newZoomX, 0.1, 20) }), // Maksimum zoom artırıldı
      setZoomY: (newZoomY) => set({ zoomY: clamp(newZoomY, 0.5, 5) }),
      zoomIn: () => set(state => ({ zoomX: clamp(state.zoomX * 1.25, 0.1, 20) })),
      zoomOut: () => set(state => ({ zoomX: clamp(state.zoomX / 1.25, 0.1, 20) })),
      setVelocityLaneHeight: (height) => set({ 
          velocityLaneHeight: clamp(height, 20, 300), // Min 20px, Max 300px
          showVelocityLane: height > 20 
      }),
      toggleVelocityLane: () => set(state => {
        const newShowState = !state.showVelocityLane;
        return { 
            showVelocityLane: newShowState,
            velocityLaneHeight: newShowState ? 100 : 0
        };
      }),      
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
        zoomX: state.zoomX, // Zoom seviyesini de kaydet
        zoomY: state.zoomY,
      })
    }
  )
);