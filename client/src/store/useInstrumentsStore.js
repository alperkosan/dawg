// src/store/useInstrumentsStore.js
// NativeAudioEngine ve AudioContextService ile tam entegre, olay tabanlı mimari.
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { initialInstruments } from '../config/initialData';
import { useMixerStore } from './useMixerStore';
import { useArrangementStore } from './useArrangementStore';
import { AudioContextService } from '../lib/services/AudioContextService';
import { usePanelsStore } from './usePanelsStore';

export const useInstrumentsStore = create((set, get) => ({
  instruments: initialInstruments,
  // Bir enstrüman üzerinde (örn. reverse) işlem yapılırken UI'da bekleme durumu göstermek için.
  processingEffects: {},

  // ========================================================
  // === EYLEMLER (ACTIONS) ===
  // ========================================================

  /**
   * Yeni bir sample tabanlı enstrüman oluşturur, state'i günceller ve ses motoruna bildirir.
   * @param {object} sample - File browser'dan gelen sample bilgisi.
   */
  handleAddNewInstrument: (sample) => {
    const { instruments } = get();
    const mixerTracks = useMixerStore.getState().mixerTracks;

    const baseName = sample.name.split('.')[0].replace(/_/g, ' ');
    let newName = baseName;
    let counter = 2;
    // Aynı isimde başka bir enstrüman varsa, ismin sonuna sayı ekle.
    while (instruments.some(inst => inst.name === newName)) {
        newName = `${baseName} ${counter++}`;
    }
    
    // Boş bir mixer kanalı bul.
    const firstUnusedTrack = mixerTracks.find(track => 
        track.type === 'track' && !instruments.some(inst => inst.mixerTrackId === track.id)
    );
    
    if (!firstUnusedTrack) {
        // Modern UI'lar için alert yerine daha iyi bir bildirim sistemi düşünülebilir.
        console.error("Boş mixer kanalı kalmadı!"); 
        return;
    }

    const newInstrument = {
        id: `inst-${uuidv4()}`,
        name: newName,
        type: 'sample',
        url: sample.url,
        notes: [],
        mixerTrackId: firstUnusedTrack.id,
        // Varsayılan zarf (envelope) ve ön-hesaplama (precomputed) ayarları
        envelope: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 1.0 },
        precomputed: {},
        isMuted: false,
        cutItself: false, // Bir nota çalarken öncekini sustur
        pianoRoll: true, // Bu enstrüman piano roll'da gösterilebilir mi?
    };

    set({ instruments: [...instruments, newInstrument] });
    useMixerStore.getState().setTrackName(firstUnusedTrack.id, newName);

    // SES MOTORUNA KOMUT GÖNDER: Yeni enstrümanı oluştur.
    AudioContextService.createInstrument(newInstrument);
  },
  
  /**
   * Bir enstrümanın Mute (Susturma) durumunu değiştirir.
   * @param {string} instrumentId - Susturulacak enstrümanın ID'si.
   */
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
    
    // SES MOTORUNA KOMUT GÖNDER: Enstrümanın mute durumunu anında güncelle.
    AudioContextService.setInstrumentMute(instrumentId, isMuted);
  },

  /**
   * Bir enstrümanın parametrelerini günceller.
   * @param {string} instrumentId - Güncellenecek enstrümanın ID'si.
   * @param {object} newParams - Güncellenecek yeni parametreler.
   * @param {boolean} shouldReconcile - Ön-hesaplama (precomputed) efektleri için buffer'ın
   * yeniden işlenip işlenmeyeceğini belirtir.
   */
  updateInstrument: async (instrumentId, newParams, shouldReconcile) => {
    let updatedInstrument = null;
    set(state => {
      const newInstruments = state.instruments.map(inst => {
        if (inst.id === instrumentId) {
          // precomputed gibi iç içe objeleri doğru bir şekilde birleştir.
          const mergedParams = { ...inst, ...newParams };
          if (newParams.precomputed) {
            mergedParams.precomputed = { ...inst.precomputed, ...newParams.precomputed };
          }
          updatedInstrument = mergedParams;
          return updatedInstrument;
        }
        return inst;
      });
      return { instruments: newInstruments };
    });

    if (!AudioContextService || !updatedInstrument) return;

    if (shouldReconcile) {
      console.log(`[STORE->ENGINE] Reconcile komutu gönderiliyor: ${instrumentId}`);
      set(state => ({ processingEffects: { ...state.processingEffects, [instrumentId]: true } }));
      
      try {
        // SES MOTORUNA KOMUT GÖNDER: Buffer'ı yeniden işle ve güncelle.
        const newBuffer = await AudioContextService.reconcileInstrument(instrumentId, updatedInstrument);
        
        // Sample Editor açıksa, güncellenmiş buffer'ı anında göster.
        if (usePanelsStore.getState().editingInstrumentId === instrumentId) {
          usePanelsStore.getState().setEditorBuffer(newBuffer);
        }
      } catch (error) {
        console.error(`[STORE] Reconcile işlemi başarısız oldu: ${instrumentId}`, error);
      } finally {
        set(state => ({ processingEffects: { ...state.processingEffects, [instrumentId]: false } }));
      }
    } else {
      // SES MOTORUNA KOMUT GÖNDER: Sadece anlık parametreleri (örn. envelope) güncelle.
      AudioContextService.updateInstrumentParameters(instrumentId, updatedInstrument);
    }
  },

  /**
   * Bir enstrümanın notalarını günceller. Bu eylem doğrudan ses motorunu tetiklemez;
   * değişiklikler bir sonraki oynatma veya yeniden zamanlama (reschedule) sırasında motora yansır.
   * @param {string} instrumentId - Enstrüman ID'si.
   * @param {Array} newNotes - Yeni nota dizisi.
   */
  updatePatternNotes: (instrumentId, newNotes) => {
    const { activePatternId } = useArrangementStore.getState();
    if (!activePatternId) return;
    
    // Değişikliği ArrangementStore üzerinden yap.
    useArrangementStore.getState().updatePatternNotes(activePatternId, instrumentId, newNotes);
    
    // NOT: Ses motorunun yeniden zamanlanması artık ArrangementStore'dan tetikleniyor.
  },
}));
