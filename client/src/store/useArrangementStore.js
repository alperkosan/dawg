import { create } from 'zustand';
import { initialInstruments } from '../config/initialData';
import { AudioContextService } from '../lib/services/AudioContextService';
import { usePlaybackStore } from './usePlaybackStore';

// =========================================================================
// === BAŞLANGIÇ VERİLERİ (HATA DÜZELTMESİ: TANIMLAMALAR YUKARI TAŞINDI) ===
// =========================================================================
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


// =========================================================================
// === MERKEZİ ORKESTRA ŞEFİ (MIDDLEWARE) ===
// =========================================================================
const arrangementStoreOrchestrator = (config) => (set, get, api) => {
  const store = config(set, get, api);

  const originalUpdatePatternNotes = store.updatePatternNotes;
  store.updatePatternNotes = (...args) => {
    originalUpdatePatternNotes(...args);
    console.log("[Orchestrator] Notalar değişti, döngü uzunluğu güncelleniyor.");
    usePlaybackStore.getState().updateLoopLength();
  };

  const originalSetActivePatternId = store.setActivePatternId;
  store.setActivePatternId = (...args) => {
    originalSetActivePatternId(...args);
    console.log("[Orchestrator] Aktif pattern değişti, döngü uzunluğu güncelleniyor.");
    usePlaybackStore.getState().updateLoopLength();
  };

  return store;
};

// =========================================================================
// === STORE TANIMLAMASI ===
// =========================================================================
export const useArrangementStore = create(arrangementStoreOrchestrator((set, get) => ({
  patterns: initialPatterns,
  patternOrder: initialPatternOrder,
  tracks: initialTracks,
  clips: initialClips,
  activePatternId: 'pattern-1',
  songLength: 128,
  zoomX: 1,

  // --- Eylemler ---

  nextPattern: () => {
    const { patternOrder, activePatternId } = get();
    const currentIndex = patternOrder.indexOf(activePatternId);
    const nextIndex = (currentIndex + 1) % patternOrder.length;
    get().setActivePatternId(patternOrder[nextIndex]);
  },

  previousPattern: () => {
    const { patternOrder, activePatternId } = get();
    const currentIndex = patternOrder.indexOf(activePatternId);
    const prevIndex = (currentIndex - 1 + patternOrder.length) % patternOrder.length;
    get().setActivePatternId(patternOrder[prevIndex]);
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
  // ✅ NEW: Playback-aware pattern switching
  setActivePatternId: (patternId) => {
    const currentState = get();
    if (currentState.activePatternId === patternId) return;
    
    set({ activePatternId: patternId });
    
    // Update playback if in pattern mode
    const playbackState = usePlaybackStore.getState();
    if (playbackState.playbackMode === PLAYBACK_MODES.PATTERN) {
      // Update loop settings for new pattern
      playbackState.updateLoopSettings();
      
      // Reschedule if playing
      if (playbackState.playbackState === PLAYBACK_STATES.PLAYING) {
        AudioContextService.schedulePatternContent();
      }
    }
    
    console.log(`🎯 Active pattern changed: ${patternId}`);
  },

  // ✅ NEW: Smart clip manipulation
  addClipWithPlayback: (clipData) => {
    const currentState = get();
    const newClip = {
      id: `clip_${Date.now()}`,
      ...clipData
    };
    
    set({
      clips: [...currentState.clips, newClip]
    });
    
    // Update song loop if in song mode
    const playbackState = usePlaybackStore.getState();
    if (playbackState.playbackMode === PLAYBACK_MODES.SONG) {
      playbackState.updateLoopSettings();
    }
    
    return newClip;
  },

  // ✅ NEW: Pattern length calculation
  getPatternPlaybackLength: (patternId) => {
    const pattern = get().patterns[patternId];
    if (!pattern) return 64;
    
    return calculatePatternLoopLength(pattern);
  },

  // ✅ NEW: Song length calculation  
  getSongPlaybackLength: () => {
    const clips = get().clips;
    return calculateAudioLoopLength('song', { clips });
  }
})));