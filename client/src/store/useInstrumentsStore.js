/**
 * @file useInstrumentsStore.js
 * @description Projedeki tüm enstrümanların durumunu (state) ve bu durumu değiştiren
 * eylemleri (actions) yönetir. Uygulamanın en merkezi state yönetim birimidir.
 *
 * MİMARİ FELSEFESİ:
 * 1. TEK GERÇEKLİK KAYNAĞI: Bir enstrümanın tüm özellikleri (notaları, efektleri,
 * ses ayarları vb.) SADECE bu store içinde tutulur.
 * 2. TEK YÖNLÜ VERİ AKIŞI: Bir değişiklik olduğunda akış her zaman aynıdır:
 * Kullanıcı Arayüzü (UI) -> Store Eylemi -> Store State Güncellemesi -> AudioEngine Senkronizasyonu (useAudioEngineSync hook'u ile)
 */
import { create } from 'zustand';
import { initialInstruments, defaultNote } from '../config/initialData';
// GÜNCELLENDİ: Tüm hesaplama fonksiyonlarını import ediyoruz
import { calculateAudioLoopLength, calculatePatternLoopLength, calculateUIRackLength } from '../lib/utils/patternUtils';
import { useMixerStore } from './useMixerStore';
import { usePanelsStore } from './usePanelsStore';
// GÜNCELLENDİ: Diğer store'ları dinlemek için import ediyoruz
import { usePlaybackStore } from './usePlaybackStore';
import { useArrangementStore } from './useArrangementStore';

export const useInstrumentsStore = create((set, get) => ({
  // ========================================================================
  // === STATE (DURUM) ===
  // Uygulamanın o anki "fotoğrafını" temsil eden veriler.
  // ========================================================================

  /** @type {Array<object>} Projedeki tüm enstrümanların listesi. */
  instruments: initialInstruments,

  /** @type {object} Pre-computed efektler işlenirken hangi enstrümanın kilitli olduğunu tutar. */
  processingEffects: {},

  /** * --- DÜZELTME: Başlangıç state'ine loopLength ve audioLoopLength eklendi ---
   * Bu değerler, initialInstruments verisine göre en başta bir kere hesaplanır.
   * Bu sayede ChannelRack gibi bileşenler ilk render olduğunda geçerli bir sayıya erişebilir.
   */
  loopLength: calculateUIRackLength(calculateAudioLoopLength(initialInstruments)),
  audioLoopLength: calculateAudioLoopLength(initialInstruments),

  // ========================================================================
  // === ACTIONS (EYLEMLER) ===
  // State'i güvenli ve tahmin edilebilir bir şekilde değiştiren fonksiyonlar.
  // ========================================================================

  // === YENİ VE EN ÖNEMLİ EYLEM ===
  /**
   * Projenin o anki moduna ve verisine göre döngü uzunluklarını
   * merkezi olarak hesaplar ve günceller.
   */
  updateLoopLength: () => {
    const { playbackMode } = usePlaybackStore.getState();
    const { clips, patterns, activePatternId } = useArrangementStore.getState();
    const instruments = get().instruments;

    let newAudioLoopLength = 16; // Varsayılan değer

    if (playbackMode === 'song') {
      // Song modundaysak, aranjmandaki kliplere göre hesapla
      newAudioLoopLength = calculateAudioLoopLength(instruments, clips);
    } else {
      // Pattern modundaysak, sadece aktif pattern'e göre hesapla
      const activePattern = patterns[activePatternId];
      if (activePattern) {
        newAudioLoopLength = calculatePatternLoopLength(activePattern);
      }
    }
    
    const newUiRackLength = calculateUIRackLength(newAudioLoopLength);

    // Hesaplanan yeni değerleri state'e set et
    set({
      audioLoopLength: newAudioLoopLength,
      loopLength: newUiRackLength
    });
  },

  /**
   * Projedeki en son notanın yerine göre döngü uzunluklarını yeniden hesaplar.
   * @private
   */
  _recalculateLoop: () => {
    get().updateLoopLength();
  },

  /**
   * --- GÜNCELLENDİ: Artık anlık ve doğru state ile çalışıyor ---
   * Bu fonksiyon, bir enstrümanın state'ini günceller VE GEREKİRSE
   * ses motoruna bu enstrümanın sesini yeniden işlemesi için komut gönderir.
   */
  updateInstrument: (instrumentId, newParams, shouldReconcile, audioEngine) => {
    let updatedInstrument = null;
    // 1. Adım: State'i anında güncelle ve güncellenmiş enstrüman objesini yakala.
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

    // 2. Adım: Eğer bu değişiklik sesi etkiliyorsa, motoru senkronize et.
    if (shouldReconcile && audioEngine && updatedInstrument) {
      set(state => ({ ...state, processingEffects: { ...state.processingEffects, [instrumentId]: true } }));
      
      // Ses motoruna güncellenmiş enstrüman verisini DOĞRUDAN gönderiyoruz.
      const newBuffer = audioEngine.reconcileInstrument(instrumentId, updatedInstrument);
      
      // 3. Adım: UI'ı yeni dalga formuyla güncelle.
      if (usePanelsStore.getState().editingInstrumentId === instrumentId) {
        usePanelsStore.getState().setEditorBuffer(newBuffer);
      }

      set(state => ({ ...state, processingEffects: { ...state.processingEffects, [instrumentId]: false } }));
    }
  },

  /**
   * --- EKLENDİ: Kayıp fonksiyon geri getirildi ---
   * Sample Editor'daki anlık önizlemeyi tetikler.
   * Bu fonksiyon, komutu doğrudan AudioEngine'e iletir.
   */
  handlePreviewInstrumentSlice: (instrumentId, audioEngine) => {
    audioEngine?.previewInstrument(instrumentId);
  },
  
  /**
   * Sample Editor'daki pre-computed efekt düğmelerini (Normalize, Reverse vb.) yönetir.
   */
  handleTogglePrecomputedEffect: (instrumentId, effectType, audioEngine) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (!instrument) return;
    const newParams = { precomputed: { ...instrument.precomputed, [effectType]: !instrument.precomputed[effectType] } };
    // Bu değişiklik sesi yeniden işlemeyi gerektirir (shouldReconcile = true)
    get().updateInstrument(instrumentId, newParams, true, audioEngine);
  },

  /**
   * Sample Editor'daki trim (kesme) ve length (uzunluk) knob'larını yönetir.
   */
  handleInstrumentParamChange: (instrumentId, param, value, audioEngine) => {
    const newParams = { [param]: value };
    // Bu değişiklik de sesi yeniden işlemeyi gerektirir (shouldReconcile = true)
    get().updateInstrument(instrumentId, newParams, true, audioEngine);
  },

  /**
   * Projeye sürüklenen yeni bir sample'dan yeni bir enstrüman oluşturur.
   */
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
        
        // İlgili mixer kanalının adını da güncelle
        useMixerStore.getState().setTrackName(firstUnusedTrack.id, newName);

        return { instruments: newInstruments };
    });
    get()._recalculateLoop();
  },
  
  /**
   * Bir enstrümanın modunu 'player' (Channel Rack) ve 'sampler' (Piano Roll) arasında değiştirir.
   */
  handleSetPianoRollMode: (instrumentId, isPianoRoll) => {
    get().updateInstrument(instrumentId, { pianoRoll: isPianoRoll });
  },

  /**
   * Bir enstrümanın tüm nota dizisini toplu olarak günceller (Piano Roll için).
   */
  handleNotesChange: (instrumentId, newNotes) => {
    get().updateInstrument(instrumentId, { notes: newNotes });
    get()._recalculateLoop();
  },

  /**
   * Bir enstrümanın adını değiştirir ve bağlı olduğu mixer kanalını da günceller.
   */
  handleRenameInstrument: (instrumentId, newName) => {
    if (!newName) return;
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if(instrument) {
        get().updateInstrument(instrumentId, { name: newName });
        useMixerStore.getState().setTrackName(instrument.mixerTrackId, newName);
    }
  },

  /**
   * Mevcut bir enstrümanın tüm ayarlarıyla bir kopyasını oluşturur.
   */
  handleCloneInstrument: (instrumentId) => {
    set(state => {
        const { instruments } = state;
        const instrumentToClone = instruments.find(inst => inst.id === instrumentId);
        if (!instrumentToClone) return state;

        const mixerTracks = useMixerStore.getState().mixerTracks;
        const firstUnusedTrack = mixerTracks.find(track => track.type === 'track' && !instruments.some(inst => inst.mixerTrackId === track.id));
        
        if (!firstUnusedTrack) {
            alert("Boş mixer kanalı kalmadı!");
            return state;
        }

        const newName = `${instrumentToClone.name} (Kopya)`;
        const newInstrument = { ...instrumentToClone, id: `inst-${Date.now()}`, name: newName, mixerTrackId: firstUnusedTrack.id };
        
        useMixerStore.getState().setTrackName(firstUnusedTrack.id, newName);
        
        return { instruments: [...instruments, newInstrument] };
    });
    get()._recalculateLoop();
  },

  /**
   * Bir enstrümanı projeden tamamen siler.
   */
  handleDeleteInstrument: (instrumentId) => {
    if (window.confirm("Bu enstrümanı silmek istediğinize emin misiniz?")) {
      set(state => ({
        instruments: state.instruments.filter(inst => inst.id !== instrumentId)
      }));
      get()._recalculateLoop();
    }
  },

  /**
   * Channel Rack'teki bir adıma tıklandığında nota ekler veya kaldırır.
   * --- GÜÇLENDİRİLDİ: Yinelenen notaları önleyen ve temizleyen mantık. ---
   */
  handlePatternChange: (instrumentId, stepIndex) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (!instrument) return;

    const notes = instrument.notes || [];
    
    // Map yapısı, her bir zaman adımı (key) için sadece bir nota (value) olmasını garanti eder.
    // Bu, mevcut yinelenen notaları otomatik olarak temizler.
    const uniqueNotes = new Map(notes.map(note => [note.time, note]));

    if (uniqueNotes.has(stepIndex)) {
      // Nota zaten varsa, Map'ten sil.
      uniqueNotes.delete(stepIndex);
    } else {
      // Nota yoksa, yeni notayı Map'e ekle.
      const pitch = instrument.pitch || 'C4'; // Bu satır eski kodunuzdan gelmiş olabilir, C4 mantıklı bir varsayılan.
      uniqueNotes.set(stepIndex, defaultNote(stepIndex, pitch));
    }
    
    // Map'in içindeki değerleri yeni notalar dizisi olarak ayarla.
    const newNotes = Array.from(uniqueNotes.values());
    
    get().updateInstrument(instrumentId, { notes: newNotes });
    get()._recalculateLoop();
  },

  /**
   * Bir enstrümanın envelope gibi sentezleyici parametrelerini günceller.
   */
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

  /**
   * Bir enstrümanı susturur veya sesini açar.
   */
  handleToggleInstrumentMute: (instrumentId) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (instrument) {
      get().updateInstrument(instrumentId, { isMuted: !instrument.isMuted });
    }
  },

  /**
   * Bir enstrümanın "cut itself" özelliğini açıp kapatır.
   */
  handleToggleInstrumentCutItself: (instrumentId) => {
    const instrument = get().instruments.find(inst => inst.id === instrumentId);
    if (instrument) {
      get().updateInstrument(instrumentId, { cutItself: !instrument.cutItself });
    }
  },
}));