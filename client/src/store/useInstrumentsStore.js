// src/store/useInstrumentsStore.js - YENİDEN YAZILMIŞ (Olay Tabanlı Mimari)

import { create } from 'zustand';
import { initialInstruments } from '../config/initialData';
import { v4 as uuidv4 } from 'uuid';

import { useMixerStore } from './useMixerStore';
import { useArrangementStore } from './useArrangementStore';
import { usePanelsStore } from './usePanelsStore';
import { usePlaybackStore } from './usePlaybackStore';
import { AudioContextService } from '../lib/services/AudioContextService';

export const useInstrumentsStore = create((set, get) => ({
  instruments: initialInstruments,
  processingEffects: {}, // UI'da "işleniyor..." durumu için

  // ========================================================
  // === YAPISAL DEĞİŞİKLİK YARATAN EYLEMLER            ===
  // ========================================================

  handleAddNewInstrument: (sample) => {
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
    AudioContextService?.createInstrument(newInstrument);
  },

  handleToggleInstrumentMute: (instrumentId) => {
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
    AudioContextService?.setInstrumentMute(instrumentId, isMuted);
    
    // Eğer çalma devam ediyorsa, bir sonraki döngüde notaların
    // hiç çalınmaması için yeniden zamanlama yap. Bu daha verimlidir.
    if (usePlaybackStore.getState().playbackState === 'playing') {
      AudioContextService?.reschedule();
    }
  },

  updateInstrument: (instrumentId, newParams, shouldReconcile) => {
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

    if (!AudioContextService || !updatedInstrument) return;

    // ARAYÜZ <-> MOTOR İLETİŞİM HATTI ONARILDI
    if (shouldReconcile) {
      // Ses buffer'ını kalıcı olarak değiştiren ağır işlemler (reverse, normalize vb.)
      console.log(`[STORE->ENGINE] Reconcile komutu gönderiliyor: ${instrumentId}`);
      set(state => ({ processingEffects: { ...state.processingEffects, [instrumentId]: true } }));
      
      const newBuffer = AudioContextService.reconcileInstrument(instrumentId, updatedInstrument);
      
      if (usePanelsStore.getState().editingInstrumentId === instrumentId) {
        usePanelsStore.getState().setEditorBuffer(newBuffer);
      }
      
      set(state => ({ processingEffects: { ...state.processingEffects, [instrumentId]: false } }));
    } else {
      // Zarf (envelope) gibi anlık, kalıcı olmayan parametre değişiklikleri
      console.log(`[STORE->ENGINE] Parametre güncelleme komutu gönderiliyor: ${instrumentId}`);
      AudioContextService.updateInstrumentParameters(instrumentId, updatedInstrument);
    }
  },

  handleTogglePrecomputedEffect: (instrumentId, effectType) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (!instrument) return;
    
    const newParams = { 
        precomputed: { 
            ...instrument.precomputed, 
            [effectType]: !instrument.precomputed?.[effectType] 
        } 
    };
    get().updateInstrument(instrumentId, newParams, true);
  },

  handleInstrumentSynthParamChange: (instrumentId, paramPath, value) => {
    // Synth'ler için bu özel fonksiyon, `updateInstrument`'ı dolaylı olarak kullanır.
    // Bu, synth'lere özel karmaşık state güncellemeleri için esneklik sağlar.
    let updatedInstrument = null;
    set(state => {
      const newInstruments = state.instruments.map(inst => {
        if (inst.id === instrumentId) {
          const newSynthParams = { ...inst.synthParams };
          // lodash.set gibi bir yardımcı ile iç içe objeleri güvenle güncelleyebiliriz
          // Şimdilik basit yol:
          const keys = paramPath.split('.');
          if (keys.length === 2) {
              newSynthParams[keys[0]] = { ...newSynthParams[keys[0]], [keys[1]]: value };
          } else {
              newSynthParams[paramPath] = value;
          }
          updatedInstrument = { ...inst, synthParams: newSynthParams };
          return updatedInstrument;
        }
        return inst;
      });
      return { instruments: newInstruments };
    });

    if (AudioContextService && updatedInstrument) {
      AudioContextService.updateInstrumentParameters(instrumentId, updatedInstrument);
    }
  },

  // Bu fonksiyon artık doğrudan ses motorunu etkilemiyor,
  // sadece notaları değiştiriyor. Motor, bir sonraki `reschedule`
  // komutunda bu yeni notaları alacak.
  updatePatternNotes: (instrumentId, newNotes) => {
    const { activePatternId } = useArrangementStore.getState();
    if (!activePatternId) return;
    
    useArrangementStore.getState().updatePatternNotes(activePatternId, instrumentId, newNotes);
    
    // Geliştirme: Notalar değiştiğinde motoru anında yeniden zamanlamak için:
    // AudioContextService?.reschedule();
  },
}));
