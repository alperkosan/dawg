// src/store/useInstrumentsStore.js - GÜNCELLENMİŞ VE GÜÇLENDİRİLMİŞ VERSİYON

import { create } from 'zustand';
import { initialInstruments, defaultNote } from '../config/initialData';
// GÜNCELLENDİ: Tüm hesaplama fonksiyonlarını import ediyoruz
import { calculateAudioLoopLength, calculateUIRackLength } from '../lib/utils/patternUtils';
import { useMixerStore } from './useMixerStore';
import { usePanelsStore } from './usePanelsStore';
// GÜNCELLENDİ: Diğer store'ları dinlemek için import ediyoruz
import { usePlaybackStore } from './usePlaybackStore';
import { useArrangementStore } from './useArrangementStore';

export const useInstrumentsStore = create((set, get) => ({
  // ========================================================================
  // === STATE (DURUM) ===
  // ========================================================================

  instruments: initialInstruments,
  processingEffects: {},

  // DÜZELTME: Başlangıç state'ine loopLength ve audioLoopLength eklendi
  loopLength: 64, // Varsayılan UI uzunluğu (4 bar)
  audioLoopLength: 64, // Varsayılan ses motoru uzunluğu (4 bar)


  // ========================================================================
  // === ACTIONS (EYLEMLER) ===
  // ========================================================================

  /**
   * YENİ VE EN ÖNEMLİ EYLEM:
   * Projenin o anki moduna ve verisine göre döngü uzunluklarını
   * merkezi olarak hesaplar ve günceller. Bu, artık tek yetkili fonksiyondur.
   */
  updateLoopLength: () => {
    const { playbackMode } = usePlaybackStore.getState();
    const { clips, patterns, activePatternId } = useArrangementStore.getState();

    // Merkezi fonksiyona ilgili verileri göndererek hesaplama yapıyoruz.
    const newAudioLoopLength = calculateAudioLoopLength(playbackMode, {
      patterns,
      activePatternId,
      clips,
    });
    
    const newUiRackLength = calculateUIRackLength(newAudioLoopLength);

    set({
      audioLoopLength: newAudioLoopLength,
      loopLength: newUiRackLength
    });
  },
  
  // Bu özel fonksiyon artık doğrudan updateLoopLength'i çağırıyor.
  _recalculateLoop: () => {
    get().updateLoopLength();
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

    if (shouldReconcile && audioEngine && updatedInstrument) {
      set(state => ({ ...state, processingEffects: { ...state.processingEffects, [instrumentId]: true } }));
      
      const newBuffer = audioEngine.reconcileInstrument(instrumentId, updatedInstrument);
      
      if (usePanelsStore.getState().editingInstrumentId === instrumentId) {
        usePanelsStore.getState().setEditorBuffer(newBuffer);
      }

      set(state => ({ ...state, processingEffects: { ...state.processingEffects, [instrumentId]: false } }));
    }
  },

  handlePreviewInstrumentSlice: (instrumentId, audioEngine) => {
    audioEngine?.previewInstrument(instrumentId);
  },
  
  handleTogglePrecomputedEffect: (instrumentId, effectType, audioEngine) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (!instrument) return;
    const newParams = { precomputed: { ...instrument.precomputed, [effectType]: !instrument.precomputed[effectType] } };
    get().updateInstrument(instrumentId, newParams, true, audioEngine);
  },

  handleInstrumentParamChange: (instrumentId, param, value, audioEngine) => {
    const newParams = { [param]: value };
    get().updateInstrument(instrumentId, newParams, true, audioEngine);
  },

  handleAddNewInstrument: (sample) => {
    set(state => {
        const { instruments } = state;
        const mixerTracks = useMixerStore.getState().mixerTracks;

        const baseName = sample.name.split('.')[0];
        let newName = baseName;
        let counter = 2;
        while (instruments.some(inst => inst.name === newName)) {
            newName = `${baseName}_${counter++}`;
        }
        
        const firstUnusedTrack = mixerTracks.find(track => track.type === 'track' && !instruments.some(inst => inst.mixerTrackId === track.id));
        if (!firstUnusedTrack) {
            alert("Boş mixer kanalı kalmadı!");
            return state;
        }

        const newInstrument = {
            id: `inst-${Date.now()}`, name: newName, type: 'sample', url: sample.url, notes: [], mixerTrackId: firstUnusedTrack.id,
            envelope: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 1.0 },
            precomputed: { normalize: false, reverse: false, reversePolarity: false, removeDCOffset: false },
            isMuted: false, cutItself: false, pianoRoll: false,
        };

        const newInstruments = [...instruments, newInstrument];
        
        useMixerStore.getState().setTrackName(firstUnusedTrack.id, newName);

        return { instruments: newInstruments };
    });
    get()._recalculateLoop();
  },
  
  handleSetPianoRollMode: (instrumentId, isPianoRoll) => {
    get().updateInstrument(instrumentId, { pianoRoll: isPianoRoll });
  },

  handleNotesChange: (instrumentId, newNotes) => {
    get().updateInstrument(instrumentId, { notes: newNotes });
    get()._recalculateLoop();
  },

  handleRenameInstrument: (instrumentId, newName) => {
    if (!newName) return;
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if(instrument) {
        get().updateInstrument(instrumentId, { name: newName });
        useMixerStore.getState().setTrackName(instrument.mixerTrackId, newName);
    }
  },

  handleCloneInstrument: (instrumentId) => {
    set(state => {
        const instrumentToClone = state.instruments.find(inst => inst.id === instrumentId);
        if (!instrumentToClone) return state;

        const mixerTracks = useMixerStore.getState().mixerTracks;
        const firstUnusedTrack = mixerTracks.find(track => track.type === 'track' && !state.instruments.some(inst => inst.mixerTrackId === track.id));
        
        if (!firstUnusedTrack) {
            alert("Boş mixer kanalı kalmadı!");
            return state;
        }

        const newName = `${instrumentToClone.name} (Kopya)`;
        const newInstrument = { ...instrumentToClone, id: `inst-${Date.now()}`, name: newName, mixerTrackId: firstUnusedTrack.id };
        
        useMixerStore.getState().setTrackName(firstUnusedTrack.id, newName);
        
        return { instruments: [...state.instruments, newInstrument] };
    });
    get()._recalculateLoop();
  },

  handleDeleteInstrument: (instrumentId) => {
    if (window.confirm("Bu enstrümanı silmek istediğinize emin misiniz?")) {
      set(state => ({
        instruments: state.instruments.filter(inst => inst.id !== instrumentId)
      }));
      get()._recalculateLoop();
    }
  },

  handlePatternChange: (instrumentId, stepIndex) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (!instrument) return;

    const notes = instrument.notes || [];
    const uniqueNotes = new Map(notes.map(note => [note.time, note]));

    if (uniqueNotes.has(stepIndex)) {
      uniqueNotes.delete(stepIndex);
    } else {
      const pitch = instrument.pitch || 'C4';
      uniqueNotes.set(stepIndex, defaultNote(stepIndex, pitch));
    }
    
    const newNotes = Array.from(uniqueNotes.values());
    get().updateInstrument(instrumentId, { notes: newNotes });
    get()._recalculateLoop();
  },

  handleInstrumentSynthParamChange: (instrumentId, paramPath, value) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (!instrument) return;

    const newInst = JSON.parse(JSON.stringify(instrument));
    const keys = paramPath.split('.');
    let current = newInst;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    get().updateInstrument(instrumentId, { [keys[0]]: newInst[keys[0]] });
  },

  handleToggleInstrumentMute: (instrumentId) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (instrument) {
      get().updateInstrument(instrumentId, { isMuted: !instrument.isMuted });
    }
  },

  handleToggleInstrumentCutItself: (instrumentId) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (instrument) {
      get().updateInstrument(instrumentId, { cutItself: !instrument.cutItself });
    }
  },
}));