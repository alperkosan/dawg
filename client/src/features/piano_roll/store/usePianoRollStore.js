import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as Tone from 'tone';

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

export const usePianoRollStore = create(
  persist(
    (set, get) => ({
      // State
      scale: { root: 'C', type: 'Minor' },
      showScaleHighlighting: true,
      showGhostNotes: true,
      activeTool: 'pencil',
      gridSnapValue: '16n',
      snapMode: 'hard',
      lastUsedDuration: '16n',
      zoomX: 1,
      zoomY: 1,
      velocityLaneHeight: 100,
      showVelocityLane: true, // `EnhancedVelocityLane` bunu bekliyor
      
      // Actions
      setScale: (root, type) => set({ scale: { root, type } }),
      toggleScaleHighlighting: () => set(state => ({ showScaleHighlighting: !state.showScaleHighlighting })),
      toggleGhostNotes: () => set(state => ({ showGhostNotes: !state.showGhostNotes })),
      setActiveTool: (tool) => set({ activeTool: tool }),
      setGridSnapValue: (snap) => set({ gridSnapValue: snap }),
      toggleSnapMode: () => set(state => ({ snapMode: state.snapMode === 'hard' ? 'soft' : 'hard' })),
      setLastUsedDuration: (duration) => set({ lastUsedDuration: duration }),
      zoomIn: () => set(state => ({ zoomX: clamp(state.zoomX * 1.2, 0.1, 10) })),
      zoomOut: () => set(state => ({ zoomX: clamp(state.zoomX / 1.2, 0.1, 10) })),
      
      // HATA DÜZELTMESİ: `EnhancedVelocityLane`'in beklediği fonksiyonlar eklendi.
      // Artık mutlak bir yükseklik değeri alıyor.
      setVelocityLaneHeight: (height) => set({ 
          velocityLaneHeight: clamp(height, 20, 300),
          showVelocityLane: true 
      }),
      
      toggleVelocityLane: () => set(state => {
        const newHeight = state.velocityLaneHeight > 0 ? 0 : 100;
        return { 
            velocityLaneHeight: newHeight,
            showVelocityLane: newHeight > 0
        };
      }),
      
      collapseVelocityLane: () => set({ velocityLaneHeight: 20, showVelocityLane: true }),
      expandVelocityLane: () => set({ velocityLaneHeight: 100, showVelocityLane: true }),

    }),
    {
      name: 'piano-roll-settings-v2',
      partialize: (state) => ({
        scale: state.scale,
        showScaleHighlighting: state.showScaleHighlighting,
        showGhostNotes: state.showGhostNotes,
        gridSnapValue: state.gridSnapValue,
        snapMode: state.snapMode,
        velocityLaneHeight: state.velocityLaneHeight,
        showVelocityLane: state.showVelocityLane,
      })
    }
  )
);

