import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { initialInstruments } from '../config/initialData';
import { usePlaybackStore } from './usePlaybackStore';

const initialPatternData = initialInstruments.reduce((acc, inst) => {
  acc[inst.id] = inst.notes;
  return acc;
}, {});

// BAŞLANGIÇ VERİSİNİ YENİ YAPIYA UYGUN HALE GETİRELİM
const initialPatterns = {
  'pattern-1': {
    id: 'pattern-1',
    name: 'Pattern 1',
    data: initialPatternData
  }
};
// YENİ: Başlangıç sırasını tanımlayan dizi
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
  patternOrder: initialPatternOrder, // YENİ: Sıralamayı tutan dizi
  tracks: initialTracks,
  clips: initialClips,
  activePatternId: 'pattern-1', 
  songLength: 128,
  zoomX: 1,

  // --- Eylemler ---
  
  addClip: (clipData) => set(state => ({ clips: [...state.clips, { id: uuidv4(), ...clipData }] })),
  
  updateClip: (clipId, newProperties) => set(state => ({
    clips: state.clips.map(c => c.id === clipId ? { ...c, ...newProperties } : c)
  })),

  deleteClip: (clipId) => set(state => ({
    clips: state.clips.filter(c => c.id !== clipId)
  })),

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

 /**
   * NİHAİ SÜRÜM: Bu metot artık sadece ve sadece state'i günceller.
   * Geri kalan tüm sihir, App.jsx'teki sync kancası tarafından yapılır.
   */
  setActivePatternId: (patternId) => {
    set({ activePatternId: patternId });
  },

  // Bu metotlar artık sadece basit setter'ı çağırıyor.
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

  _internal_setActivePatternId: (patternId) => {
      set({ activePatternId: patternId });
  },

  /**
   * NİHAİ DÜZELTME: Artık çalma sırasında "Temiz Başlangıç" mantığıyla çalışıyor.
   */
  addPattern: (audioEngine) => {
    const { playbackState } = usePlaybackStore.getState();
    const isPlaying = playbackState === 'playing' || playbackState === 'paused';

    const newId = `pattern-${Date.now()}`;
    const newPatternName = `Pattern ${get().patternOrder.length + 1}`;
    // Her zaman boş bir pattern oluşturuyoruz
    const newPattern = { id: newId, name: newPatternName, data: {} };
    
    // Arayüzün anında tepki vermesi için state'i hemen güncelliyoruz
    set(state => ({ 
      patterns: { ...state.patterns, [newId]: newPattern },
      patternOrder: [...state.patternOrder, newId]
    }));
    
    // Eğer çalma devam ediyorsa, özel bir senkronizasyon ve reset işlemi yap
    if (isPlaying && audioEngine) {
      // --- ANAHTAR DÜZELTME BURADA ---
      // Ses motorunun es_ki (stale) veriye sahip olma sorununu çözmek için,
      // yeni pattern'i motorun kendi `patterns` listesine manuel olarak ekliyoruz.
      audioEngine.patterns[newId] = newPattern;

      // Artık motor yeni pattern'i tanıdığı için, `next/prev` butonlarındaki
      // "temiz başlangıç" mantığını güvenle uygulayabiliriz.
      
      // 1. Motorun aktif pattern ID'sini, state'i değiştirmeden güncelle
      audioEngine.activePatternId = newId;
      
      // 2. Yeni (boş) pattern'e göre notaları ve döngüyü yeniden zamanla
      audioEngine.reschedule();
      
      // 3. Çalmayı yeni döngünün en başına zıplat
      audioEngine.jumpToPercent(0);
      
      // 4. Son olarak, store'daki aktif ID'yi arayüz için güncelle
      get()._internal_setActivePatternId(newId);

    } else {
      // Çalma duruyorsa, sadece state'i güncellemek yeterlidir.
      // Bir sonraki "play" komutunda motor zaten senkronize olacaktır.
      get().setActivePatternId(newId, audioEngine);
    }
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