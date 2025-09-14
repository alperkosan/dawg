import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { initialInstruments } from '../config/initialData';
import { usePlaybackStore } from './usePlaybackStore';

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
  tracks: initialTracks,
  clips: initialClips,
  activePatternId: 'pattern-1', 
  songLength: 128,
  zoomX: 1,

  // --- Eylemler ---
  
  // === KAYBOLAN FONKSİYONLAR BURAYA EKLENDİ ===
  addClip: (clipData) => set(state => ({ clips: [...state.clips, { id: uuidv4(), ...clipData }] })),
  
  updateClip: (clipId, newProperties) => set(state => ({
    clips: state.clips.map(c => c.id === clipId ? { ...c, ...newProperties } : c)
  })),

  deleteClip: (clipId) => set(state => ({
    clips: state.clips.filter(c => c.id !== clipId)
  })),
  // ==========================================

  setActivePatternId: (patternId, audioEngine) => {
    set({ activePatternId: patternId });
    const { playbackState, playbackMode } = usePlaybackStore.getState();
    if (audioEngine && playbackState === 'playing' && playbackMode === 'pattern') {
      console.log(`[SYNC] Aktif pattern değişti -> ${patternId}. Motor yeniden zamanlanıyor...`);
      audioEngine.activePatternId = patternId;
      audioEngine.reschedule();
    }
  },

  addPattern: (audioEngine) => {
    const newId = `pattern-${Date.now()}`;
    const newPatternName = `Pattern ${Object.keys(get().patterns).length + 1}`;
    const newPattern = { id: newId, name: newPatternName, data: {} };
    set(state => ({ patterns: { ...state.patterns, [newId]: newPattern } }));
    get().setActivePatternId(newId, audioEngine);
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

  nextPattern: (audioEngine) => {
    const { patterns, activePatternId } = get();
    const patternIds = Object.keys(patterns);
    const currentIndex = patternIds.indexOf(activePatternId);
    const nextIndex = (currentIndex + 1) % patternIds.length;
    get().setActivePatternId(patternIds[nextIndex], audioEngine);
  },

  previousPattern: (audioEngine) => {
    const { patterns, activePatternId } = get();
    const patternIds = Object.keys(patterns);
    const currentIndex = patternIds.indexOf(activePatternId);
    const prevIndex = (currentIndex - 1 + patternIds.length) % patternIds.length;
    get().setActivePatternId(patternIds[prevIndex], audioEngine);
  },

  updatePatternNotes: (instrumentId, newNotes) => {
    const { activePatternId } = get();
    set(state => {
      const patterns = JSON.parse(JSON.stringify(state.patterns));
      if (patterns[activePatternId]) {
        patterns[activePatternId].data[instrumentId] = newNotes;
      }
      return { patterns };
    });
  },

  splitPatternClip: (clipId) => {
    const { clips, patterns, tracks } = get();
    const sourceClip = clips.find(c => c.id === clipId);
    if (!sourceClip || !patterns[sourceClip.patternId]) return;
    const sourcePattern = patterns[sourceClip.patternId];
    const newClips = [];
    const newPatterns = { ...get().patterns };
    Object.entries(sourcePattern.data).forEach(([instrumentId, notes]) => {
      if (notes && notes.length > 0) {
        const targetTrack = tracks.find(t => t.instrumentId === instrumentId);
        if (targetTrack) {
          const newPatternId = `pattern-${instrumentId}-${Date.now()}`;
          newPatterns[newPatternId] = {
            id: newPatternId,
            name: `${sourcePattern.name} - ${targetTrack.name}`,
            data: { [instrumentId]: notes }
          };
          newClips.push({
            id: uuidv4(),
            patternId: newPatternId,
            trackId: targetTrack.id,
            startTime: sourceClip.startTime,
            duration: sourceClip.duration,
          });
        }
      }
    });
    set(state => ({
      clips: [...state.clips.filter(c => c.id !== clipId), ...newClips],
      patterns: newPatterns,
    }));
  }
}));