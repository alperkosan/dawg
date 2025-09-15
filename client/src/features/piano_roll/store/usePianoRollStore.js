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
  'Locrian': [0, 1, 3, 4, 7, 8, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
  'Pentatonic Major': [0, 2, 4, 7, 9],
  'Pentatonic Minor': [0, 3, 5, 7, 10],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const updateNotesInArrangement = (instrumentId, newNotes) => {
  useArrangementStore.getState().updatePatternNotes(instrumentId, newNotes);
};

export const usePianoRollStore = create(
  persist(
    (set, get) => ({
      // === STATE ===
      
      // Gam ve müzik teorisi
      scale: { root: 'C', type: 'Minor' },
      showScaleHighlighting: true,
      
      // Araçlar ve etkileşim
      activeTool: 'pencil',
      gridSnapValue: '16n',
      snapMode: 'hard', // 'hard' veya 'soft'
      lastUsedDuration: '16n',
      
      // Görünüm ve zoom
      zoomX: 1,
      zoomY: 1,
      targetScroll: null, // Zoom to selection için
      
      // Velocity lane
      velocityLaneHeight: 100,
      showVelocityLane: true,
      
      // === ACTIONS ===
      
      // Gam ayarları
      setScale: (root, type) => {
        if (NOTES.includes(root) && SCALES[type]) {
          set({ scale: { root, type } });
        }
      },
      
      toggleScaleHighlighting: () => set(state => ({ 
        showScaleHighlighting: !state.showScaleHighlighting 
      })),
      
      // Araç seçimi
      setActiveTool: (tool) => {
        const validTools = ['selection', 'pencil', 'eraser'];
        if (validTools.includes(tool)) {
          set({ activeTool: tool });
        }
      },
      
      // Snap ayarları
      setGridSnapValue: (snap) => {
        const validSnaps = ['32n', '16n', '8n', '4n', '2n', '1m'];
        if (validSnaps.includes(snap)) {
          set({ gridSnapValue: snap });
        }
      },
      
      toggleSnapMode: () => set(state => ({ 
        snapMode: state.snapMode === 'hard' ? 'soft' : 'hard' 
      })),
      
      // Duration ayarları
      setLastUsedDuration: (duration) => {
        try {
          // Tone.js ile geçerlilik kontrolü
          Tone.Time(duration);
          set({ lastUsedDuration: duration });
        } catch (error) {
          console.warn('Invalid duration:', duration);
        }
      },
      
      // Zoom kontrolleri
      handleZoom: (deltaX, deltaY) => {
        set(state => ({
          zoomX: clamp(state.zoomX + deltaX, 0.25, 5),
          zoomY: clamp(state.zoomY + deltaY, 0.5, 3),
        }));
      },
      
      zoomIn: () => set(state => ({ 
        zoomX: clamp(state.zoomX * 1.2, 0.25, 5),
        zoomY: clamp(state.zoomY * 1.1, 0.5, 3)
      })),
      
      zoomOut: () => set(state => ({ 
        zoomX: clamp(state.zoomX / 1.2, 0.25, 5),
        zoomY: clamp(state.zoomY / 1.1, 0.5, 3)
      })),
      
      // Gelişmiş zoom - seçili notaları odakla
      setView: ({ zoomX, zoomY, scrollLeft, scrollTop }) => {
        set({ 
          zoomX: clamp(zoomX, 0.25, 5),
          zoomY: clamp(zoomY, 0.5, 3),
          targetScroll: { left: scrollLeft, top: scrollTop }
        });
        // Target scroll'u temizlemek için timeout
        setTimeout(() => set({ targetScroll: null }), 50);
      },
      
      // Velocity lane kontrolleri
      toggleVelocityLane: () => set(state => {
        if (state.showVelocityLane && state.velocityLaneHeight > 0) {
          return { velocityLaneHeight: 0, showVelocityLane: false };
        }
        return { velocityLaneHeight: 100, showVelocityLane: true };
      }),
      
      setVelocityLaneHeight: (delta) => set(state => {
        const newHeight = state.velocityLaneHeight + delta;
        return { 
          velocityLaneHeight: clamp(newHeight, 0, 300),
          showVelocityLane: newHeight > 0
        };
      }),
      
      // === GELİŞMİŞ İŞLEMLER ===
      
      // Quantize - seçili notaları grid'e hizala
      quantizeSelected: () => {
        const state = get();
        console.log('Quantizing selected notes to:', state.gridSnapValue);
        // Bu fonksiyon PianoRoll bileşeninde implement edilecek
        // Çünkü seçili notaları bilmesi gerekiyor
      },
      
      // Humanize - seçili notaları hafif kaydır
      humanizeSelected: () => {
        const state = get();
        console.log('Humanizing selected notes');
        // Bu fonksiyon da PianoRoll bileşeninde implement edilecek
      },
      
      // Preset yönetimi
      savePreset: (name) => {
        const state = get();
        const preset = {
          scale: state.scale,
          gridSnapValue: state.gridSnapValue,
          snapMode: state.snapMode,
          zoomX: state.zoomX,
          zoomY: state.zoomY
        };
        console.log('Saving preset:', name, preset);
        // LocalStorage'a kaydet
        const presets = JSON.parse(localStorage.getItem('pianoRollPresets') || '{}');
        presets[name] = preset;
        localStorage.setItem('pianoRollPresets', JSON.stringify(presets));
      },
      
      loadPreset: (name) => {
        const presets = JSON.parse(localStorage.getItem('pianoRollPresets') || '{}');
        if (presets[name]) {
          set(presets[name]);
          console.log('Loaded preset:', name);
        }
      },
      
      // Sıfırlama
      resetView: () => set({
        zoomX: 1,
        zoomY: 1,
        targetScroll: { left: 0, top: 0 }
      }),
      
      resetToDefaults: () => set({
        scale: { root: 'C', type: 'Minor' },
        showScaleHighlighting: true,
        activeTool: 'pencil',
        gridSnapValue: '16n',
        snapMode: 'hard',
        zoomX: 1,
        zoomY: 1,
        velocityLaneHeight: 100,
        showVelocityLane: true,
        targetScroll: null
      }),
      
      // === UTILITY FUNCTIONS ===
      
      // Mevcut ayarları al
      getSettings: () => {
        const state = get();
        return {
          scale: state.scale,
          showScaleHighlighting: state.showScaleHighlighting,
          activeTool: state.activeTool,
          gridSnapValue: state.gridSnapValue,
          snapMode: state.snapMode,
          zoom: { x: state.zoomX, y: state.zoomY },
          velocityLane: {
            height: state.velocityLaneHeight,
            visible: state.showVelocityLane
          }
        };
      },
      
      // Grid snap bilgilerini al
      getSnapInfo: () => {
        const state = get();
        try {
          const stepTime = Tone.Time(state.gridSnapValue).toSeconds();
          const sixteenthTime = Tone.Time('16n').toSeconds();
          const snapSteps = stepTime / sixteenthTime;
          
          return {
            value: state.gridSnapValue,
            mode: state.snapMode,
            stepSize: snapSteps,
            description: `${state.gridSnapValue} (${state.snapMode})`,
            isValid: snapSteps > 0
          };
        } catch (error) {
          return {
            value: state.gridSnapValue,
            mode: state.snapMode,
            stepSize: 1,
            description: 'Invalid snap value',
            isValid: false
          };
        }
      }
    }),
    {
      name: 'piano-roll-settings',
      // Sadece önemli ayarları persist et
      partialize: (state) => ({
        scale: state.scale,
        showScaleHighlighting: state.showScaleHighlighting,
        gridSnapValue: state.gridSnapValue,
        snapMode: state.snapMode,
        velocityLaneHeight: state.velocityLaneHeight,
        showVelocityLane: state.showVelocityLane
      })
    }
  )
);