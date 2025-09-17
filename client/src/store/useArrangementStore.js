import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { initialInstruments } from '../config/initialData';

const initialPatternData = initialInstruments.reduce((acc, inst) => {
  acc[inst.id] = inst.notes;
  return acc;
}, {});

const initialPatterns = {
  'pattern-1': {
    id: 'pattern-1',
    name: 'Pattern 1',
    data: initialPatternData
  }
};

const initialPatternOrder = ['pattern-1'];

const initialTracks = initialInstruments.map(inst => ({
  id: `track-${inst.id}`,
  instrumentId: inst.id,
  name: inst.name,
  height: 60,
}));

const initialClips = [{
  id: 'clip-1',
  patternId: 'pattern-1',
  trackId: null,
  startTime: 0,
  duration: 8,
}];


export const useArrangementStore = create((set, get) => ({
  patterns: initialPatterns,
  patternOrder: initialPatternOrder,
  tracks: initialTracks,
  clips: initialClips,
  activePatternId: 'pattern-1',
  songLength: 128,
  zoomX: 1,

  // --- Eylemler ---
  
  setActivePatternId: (patternId, audioEngine) => {
    set({ activePatternId: patternId });
    // Aktif pattern değiştiğinde, ses motorunun notaları yeniden zamanlaması gerekir.
    audioEngine?.reschedule();
  },

  nextPattern: (audioEngine) => {
    const { patternOrder, activePatternId } = get();
    const currentIndex = patternOrder.indexOf(activePatternId);
    const nextIndex = (currentIndex + 1) % patternOrder.length;
    get().setActivePatternId(patternOrder[nextIndex], audioEngine);
  },

  previousPattern: (audioEngine) => {
    const { patternOrder, activePatternId } = get();
    const currentIndex = patternOrder.indexOf(activePatternId);
    const prevIndex = (currentIndex - 1 + patternOrder.length) % patternOrder.length;
    get().setActivePatternId(patternOrder[prevIndex], audioEngine);
  },

  updatePatternNotes: (patternId, instrumentId, newNotes) => {
    set(state => {
      const newPatterns = { ...state.patterns };
      const targetPattern = newPatterns[patternId];
      if (targetPattern) {
        const newData = { ...targetPattern.data, [instrumentId]: newNotes };
        newPatterns[patternId] = { ...targetPattern, data: newData };
        return { patterns: newPatterns };
      }
      return state;
    });
  },
  
  renameActivePattern: (newName) => {
    const { activePatternId } = get();
    if (newName && activePatternId) {
        set(state => {
            const newPatterns = { ...state.patterns };
            if (newPatterns[activePatternId]) {
                newPatterns[activePatternId].name = newName;
            }
            return { patterns: newPatterns };
        });
    }
  },

}));
