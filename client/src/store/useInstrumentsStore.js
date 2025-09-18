// src/store/useInstrumentsStore.js - YENİDEN YAZILMIŞ (Olay Tabanlı Mimari)

import { create } from 'zustand';
import { initialInstruments } from '../config/initialData';
import { v4 as uuidv4 } from 'uuid';

import { useMixerStore } from './useMixerStore';
import { useArrangementStore } from './useArrangementStore';
import { usePanelsStore } from './usePanelsStore';
import { usePlaybackStore } from './usePlaybackStore';

export const useInstrumentsStore = create((set, get) => ({
  instruments: initialInstruments,
  processingEffects: {}, // UI'da "işleniyor..." durumu için

  // ========================================================
  // === YAPISAL DEĞİŞİKLİK YARATAN EYLEMLER            ===
  // ========================================================

  handleAddNewInstrument: (sample, audioEngine) => {
    const { instruments } = get();
    const mixerTracks = useMixerStore.getState().mixerTracks;

    const baseName = sample.name.split('.')[0];
    let newName = baseName;
    let counter = 2;
    while (instruments.some(inst => inst.name === newName)) {
        newName = `${baseName}_${counter++}`;
    }
    
    const firstUnusedTrack = mixerTracks.find(track => 
        track.type === 'track' && !instruments.some(inst => inst.mixerTrackId === track.id)
    );
    
    if (!firstUnusedTrack) {
        alert("Boş mixer kanalı kalmadı!");
        return;
    }

    const newInstrument = {
        id: `inst-${uuidv4()}`,
        name: newName,
        type: 'sample',
        url: sample.url,
        notes: [],
        mixerTrackId: firstUnusedTrack.id,
        envelope: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 1.0 },
        precomputed: {},
        isMuted: false,
        cutItself: false,
        pianoRoll: false,
    };

    set({ instruments: [...instruments, newInstrument] });
    useMixerStore.getState().setTrackName(firstUnusedTrack.id, newName);

    // SES MOTORUNA KOMUT GÖNDER
    audioEngine?.createInstrument(newInstrument);
  },

  handleToggleInstrumentMute: (instrumentId, audioEngine) => {
    let isMuted = false;
    set(state => ({
      instruments: state.instruments.map(inst => {
        if (inst.id === instrumentId) {
          isMuted = !inst.isMuted;
          return { ...inst, isMuted };
        }
        return inst;
      })
    }));
    
    // ANLIK MUTE: Ses motoruna anında komut gönder.
    audioEngine?.setInstrumentMute(instrumentId, isMuted);
    
    // Eğer çalma devam ediyorsa, bir sonraki döngüde notaların
    // hiç çalınmaması için yeniden zamanlama yap. Bu daha verimlidir.
    if (usePlaybackStore.getState().playbackState === 'playing') {
      audioEngine?.reschedule();
    }
  },
  updateInstrument: (instrumentId, newParams, shouldReconcile, audioEngine) => {
    let updatedInstrument = null;
    set(state => {
      const newInstruments = state.instruments.map(inst => {
        if (inst.id === instrumentId) {
          updatedInstrument = { ...inst, ...newParams };
          return updatedInstrument;
        }
        return inst;
      });
      return { instruments: newInstruments };
    });

    // Eğer bu değişiklik ses buffer'ını etkiliyorsa (örn: reverse, normalize)...
    if (shouldReconcile && audioEngine && updatedInstrument) {
      set(state => ({ processingEffects: { ...state.processingEffects, [instrumentId]: true } }));
      
      // 1. Motora buffer'ı yeniden işlemesini ve yeni buffer'ı geri göndermesini söyle.
      const newBuffer = audioEngine.reconcileInstrument(instrumentId, updatedInstrument);
      
      // 2. Eğer Sample Editor o an bu enstrüman için açıksa, dalga formunu anında güncelle.
      if (usePanelsStore.getState().editingInstrumentId === instrumentId) {
        usePanelsStore.getState().setEditorBuffer(newBuffer);
      }
      
      set(state => ({ processingEffects: { ...state.processingEffects, [instrumentId]: false } }));
    }
  },

  // YENİ: Bu eylem artık sadece state'i güncellemekle kalmıyor, motoru da tetikliyor.
  handleTogglePrecomputedEffect: (instrumentId, effectType, audioEngine) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (!instrument) return;
    
    const newParams = { 
        precomputed: { 
            ...instrument.precomputed, 
            [effectType]: !instrument.precomputed?.[effectType] 
        } 
    };

    // `updateInstrument` fonksiyonunu `shouldReconcile=true` ile çağırarak
    // motorun buffer'ı yeniden işlemesini ve UI'ı güncellemesini sağlıyoruz.
    get().updateInstrument(instrumentId, newParams, true, audioEngine);
  },

  // Bu fonksiyon artık doğrudan ses motorunu etkilemiyor,
  // sadece notaları değiştiriyor. Motor, bir sonraki `reschedule`
  // komutunda bu yeni notaları alacak.
  updatePatternNotes: (instrumentId, newNotes) => {
    const { activePatternId } = useArrangementStore.getState();
    if (!activePatternId) return;
    
    useArrangementStore.getState().updatePatternNotes(activePatternId, instrumentId, newNotes);
    
    // Geliştirme: Notalar değiştiğinde motoru anında yeniden zamanlamak için:
    // audioEngine?.reschedule();
  },

}));
