// src/store/useInstrumentsStore.js
// NativeAudioEngine ve AudioContextService ile tam entegre, olay tabanlı mimari.
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
// ✅ Empty project - no initial data
import { INSTRUMENT_TYPES } from '@/config/constants';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { InstrumentService } from '@/lib/services/InstrumentService';
import { MixerService } from '@/lib/services/MixerService';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
import { createDefaultSampleChopPattern } from '@/lib/audio/instruments/sample/sampleChopUtils';
import { storeManager } from './StoreManager';
import { useMixerStore } from './useMixerStore';

export const useInstrumentsStore = create((set, get) => ({
  instruments: [], // ✅ Empty project - start with no instruments
  // Bir enstrüman üzerinde (örn. reverse) işlem yapılırken UI'da bekleme durumu göstermek için.
  processingEffects: {},

  // ========================================================
  // === CHANNEL MANAGEMENT ===
  // ========================================================

  // Channel organization
  channelOrder: [], // Will be initialized based on instruments
  channelGroups: [
    { id: 'drums', name: 'Drums', color: '#ef4444', collapsed: false, instruments: [] },
    { id: 'bass', name: 'Bass', color: '#a855f7', collapsed: false, instruments: [] },
    { id: 'melodic', name: 'Melodic', color: '#ec4899', collapsed: false, instruments: [] },
    { id: 'fx', name: 'FX', color: '#10b981', collapsed: false, instruments: [] },
  ],
  selectedChannels: [], // Multi-selection support
  channelViewMode: 'flat', // 'grouped' | 'flat' | 'arrangement'

  // ========================================================
  // === EYLEMLER (ACTIONS) ===
  // ========================================================

  /**
   * Yeni bir sample tabanlı enstrüman oluşturur, state'i günceller ve ses motoruna bildirir.
   * @param {object} sample - File browser'dan gelen sample bilgisi.
   */
  handleAddNewInstrument: (instrumentData) => {
    const { instruments } = get();

    // ✅ NEW: Support both old format (FileBrowser sample) and new format (InstrumentPicker preset)
    const isPreset = instrumentData.type && (instrumentData.type === 'sample' || instrumentData.type === 'vasynth');

    // Extract name
    const baseName = isPreset
      ? instrumentData.name
      : instrumentData.name.split('.')[0].replace(/_/g, ' ');

    let newName = baseName;
    let counter = 2;
    // Aynı isimde başka bir enstrüman varsa, ismin sonuna sayı ekle.
    while (instruments.some(inst => inst.name === newName)) {
      newName = `${baseName} ${counter++}`;
    }

    // ✅ PERFORMANCE: Use StoreManager to find unused mixer track (only if not already specified)
    let mixerTrackId = instrumentData.mixerTrackId;

    // ✅ FIX: Auto-match mixer track by instrument name if mixerTrackId is "master"
    // This fixes the issue where instruments added later are saved with mixerTrackId: "master"
    // but mixer has a track with the same name
    if (mixerTrackId === 'master' || !mixerTrackId) {
      const mixerState = useMixerStore.getState();
      const instrumentName = newName?.toLowerCase().trim();

      if (instrumentName) {
        // Find mixer track with matching name
        const matchingTrack = mixerState.mixerTracks.find(track =>
          track.id !== 'master' &&
          track.name?.toLowerCase().trim() === instrumentName
        );

        if (matchingTrack) {
          mixerTrackId = matchingTrack.id;
          console.log(`🔗 ✅ Auto-matched instrument "${newName}" to mixer track "${matchingTrack.id}" (${matchingTrack.name})`);
        }
      }
    }

    if (!mixerTrackId) {
      const firstUnusedTrack = storeManager.findUnusedMixerTrack();

      if (!firstUnusedTrack) {
        // ✅ FIX: Create a new mixer track instead of falling back to master
        // Master channel doesn't have a MixerInsert, so routing to it won't work
        console.log("🎛️ No unused mixer tracks available, creating new track...");

        // Create new mixer track
        const newTrackId = useMixerStore.getState().addTrack('track');
        mixerTrackId = newTrackId;

        console.log(`✅ Created new mixer track: ${newTrackId}`);
      } else {
        mixerTrackId = firstUnusedTrack.id;

        // ✅ FIX: Ensure mixer insert exists for this track
        // The track exists in store but insert might not exist in AudioEngine yet
        const audioEngine = AudioEngineGlobal.get();
        if (audioEngine && !audioEngine.mixerInserts?.has(mixerTrackId)) {
          console.log(`🎛️ Creating missing mixer insert for existing track: ${mixerTrackId}`);
          MixerService.createMixerInsert(mixerTrackId, firstUnusedTrack.name);
        }
      }
    }

    // ✅ Build instrument based on type
    // ✅ FIX: Ensure unique ID - if provided ID already exists, generate new one
    let instrumentId = instrumentData.id;
    if (instrumentId && instruments.some(inst => inst.id === instrumentId)) {
      // ID already exists, generate unique one
      console.warn(`⚠️ Instrument ID "${instrumentId}" already exists, generating unique ID`);
      instrumentId = `inst-${uuidv4()}`;
    } else if (!instrumentId) {
      // No ID provided, generate one
      instrumentId = `inst-${uuidv4()}`;
    }

    const newInstrument = {
      id: instrumentId,
      name: newName,
      type: instrumentData.type || 'sample',
      color: instrumentData.color || '#888888',
      notes: [],
      mixerTrackId,
      envelope: instrumentData.envelope || { attack: 0.001, decay: 0.01, sustain: 1.0, release: 0.01 }, // ✅ DAW standard: Default values (not applied unless envelopeEnabled is true)
      envelopeEnabled: instrumentData.envelopeEnabled !== undefined ? instrumentData.envelopeEnabled : false, // ✅ FL Studio behavior: Envelope OFF by default, preserves sample's natural character
      precomputed: {},
      effectChain: instrumentData.effectChain || [],
      isMuted: instrumentData.isMuted !== undefined ? instrumentData.isMuted : false, // ✅ FIX: Preserve mute state from saved project
      cutItself: instrumentData.cutItself !== undefined ? instrumentData.cutItself : false, // ✅ FIX: Preserve cutItself state
      pianoRoll: instrumentData.pianoRoll !== undefined ? instrumentData.pianoRoll : true,
      // Type-specific fields
      ...(instrumentData.url && { url: instrumentData.url }),
      ...(instrumentData.multiSamples && { multiSamples: instrumentData.multiSamples }),
      ...(instrumentData.presetName && { presetName: instrumentData.presetName }),
      ...(instrumentData.baseNote && { baseNote: instrumentData.baseNote }),
      ...(instrumentData.assetId && { assetId: instrumentData.assetId }),
      ...(instrumentData.audioBuffer && { audioBuffer: instrumentData.audioBuffer })
    };

    const resolvedType = newInstrument.type || INSTRUMENT_TYPES.SAMPLE;
    newInstrument.type = resolvedType;

    if (resolvedType === INSTRUMENT_TYPES.SAMPLE) {
      newInstrument.sampleChop = createDefaultSampleChopPattern();
      newInstrument.sampleChopMode = 'standard';
    }

    // ✅ AUTO-GROUP ASSIGNMENT: Detect instrument type and assign to appropriate group
    const detectInstrumentGroup = (name) => {
      const lowerName = name.toLowerCase();

      // Drum patterns
      if (lowerName.includes('kick') || lowerName.includes('bd') || lowerName.includes('bassdrum')) return 'drums';
      if (lowerName.includes('snare') || lowerName.includes('sd') || lowerName.includes('rim')) return 'drums';
      if (lowerName.includes('hihat') || lowerName.includes('hh') || lowerName.includes('hat')) return 'drums';
      if (lowerName.includes('crash') || lowerName.includes('ride') || lowerName.includes('cymbal')) return 'drums';
      if (lowerName.includes('tom') || lowerName.includes('perc') || lowerName.includes('drum')) return 'drums';

      // Bass patterns
      if (lowerName.includes('bass') || lowerName.includes('808') || lowerName.includes('sub')) return 'bass';
      if (lowerName.includes('low') && (lowerName.includes('freq') || lowerName.includes('end'))) return 'bass';

      // Default to melody for everything else
      return 'melody';
    };

    const targetGroupId = detectInstrumentGroup(newName);

    set(state => ({
      instruments: [...state.instruments, newInstrument],
      channelOrder: [...state.channelOrder, newInstrument.id] // Add to global channel order
    }));

    // Auto-assign to detected group
    get().addInstrumentToGroup(newInstrument.id, targetGroupId);

    // ✅ PERFORMANCE: Use StoreManager for all side effects
    storeManager.createInstrumentWithSideEffects(newInstrument, mixerTrackId, newName);

    // ✅ NEW: Add buffer to ProjectBufferManager if available
    if (newInstrument.audioBuffer && newInstrument.url) {
      // Async import to avoid circular dependencies
      import('@/lib/audio/ProjectBufferManager.js').then(({ getProjectBufferManager }) => {
        const bufferManager = getProjectBufferManager();
        bufferManager.addBuffer(newInstrument.url, newInstrument.audioBuffer);
      }).catch(err => {
        // Non-critical, just log
        console.debug('ProjectBufferManager not available:', err);
      });
    }

    // ✅ NOTE: Instrument creation in AudioEngine is now handled automatically
    // by the store subscription in AudioContextService._setupStoreSubscriptions()
    // which calls EngineStateSyncService.syncInstrumentsToMixerInserts()
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
    InstrumentService.setMute(instrumentId, isMuted);
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
          if (newParams.sampleChop) {
            mergedParams.sampleChop = JSON.parse(JSON.stringify(newParams.sampleChop));
          }
          if (newParams.sampleChopMode !== undefined) {
            mergedParams.sampleChopMode = newParams.sampleChopMode;
          }
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
        const newBuffer = await InstrumentService.reconcile(instrumentId, updatedInstrument);

        // Sample Editor açıksa, güncellenmiş buffer'ı anında göster.
        // ✅ PERFORMANCE: Use StoreManager for panel updates
        storeManager.updatePanelBuffer(instrumentId, newBuffer);
      } catch (error) {
        console.error(`[STORE] Reconcile işlemi başarısız oldu: ${instrumentId}`, error);
      } finally {
        set(state => ({ processingEffects: { ...state.processingEffects, [instrumentId]: false } }));
      }
    } else {
      // SES MOTORUNA KOMUT GÖNDER: Sadece değişen parametreleri motorla senkronla.
      InstrumentService.updateParameters(instrumentId, newParams);
    }
  },

  /**
   * Bir enstrümanın notalarını günceller. Bu eylem doğrudan ses motorunu tetiklemez;
   * değişiklikler bir sonraki oynatma veya yeniden zamanlama (reschedule) sırasında motora yansır.
   * @param {string} instrumentId - Enstrüman ID'si.
   * @param {Array} newNotes - Yeni nota dizisi.
   */
  updatePatternNotes: (instrumentId, newNotes) => {
    // Use StoreManager to avoid circular dependency
    storeManager.updatePatternNotes(instrumentId, newNotes);

    // NOT: Ses motorunun yeniden zamanlanması artık ArrangementStore'dan tetikleniyor.
  },

  // ========================================================
  // === CHANNEL MANAGEMENT ACTIONS ===
  // ========================================================

  /**
   * Initialize channel order based on current instruments
   */
  initializeChannelOrder: () => set((state) => {
    if (state.channelOrder.length === 0) {
      const order = state.instruments.map(inst => inst.id);
      return { channelOrder: order };
    }
    return state;
  }),

  /**
   * Reorder channels via drag & drop
   */
  reorderChannels: (fromIndex, toIndex) => set((state) => {
    const newOrder = [...state.channelOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    return { channelOrder: newOrder };
  }),

  /**
   * Toggle channel selection (multi-select support)
   */
  toggleChannelSelection: (instrumentId) => set((state) => {
    const isSelected = state.selectedChannels.includes(instrumentId);
    const newSelection = isSelected
      ? state.selectedChannels.filter(id => id !== instrumentId)
      : [...state.selectedChannels, instrumentId];
    return { selectedChannels: newSelection };
  }),

  /**
   * Clear all channel selections
   */
  clearChannelSelection: () => set({ selectedChannels: [] }),

  /**
   * Set channel view mode
   */
  setChannelViewMode: (mode) => set({ channelViewMode: mode }),

  /**
   * Create new channel group
   */
  createChannelGroup: (name, color) => set((state) => {
    const newGroup = {
      id: `group-${Date.now()}`,
      name,
      color,
      collapsed: false,
      instruments: []
    };
    return { channelGroups: [...state.channelGroups, newGroup] };
  }),

  /**
   * Add instrument to group
   */
  addInstrumentToGroup: (instrumentId, groupId) => set((state) => {
    const newGroups = state.channelGroups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          instruments: [...group.instruments.filter(id => id !== instrumentId), instrumentId]
        };
      }
      // Remove from other groups
      return {
        ...group,
        instruments: group.instruments.filter(id => id !== instrumentId)
      };
    });
    return { channelGroups: newGroups };
  }),

  /**
   * Toggle group collapsed state
   */
  toggleGroupCollapsed: (groupId) => set((state) => {
    const newGroups = state.channelGroups.map(group =>
      group.id === groupId ? { ...group, collapsed: !group.collapsed } : group
    );
    return { channelGroups: newGroups };
  }),

  /**
   * Get organized instruments based on view mode
   */
  getOrganizedInstruments: () => {
    const state = get();

    switch (state.channelViewMode) {
      case 'grouped':
        return state.channelGroups;

      case 'flat':
        return state.channelOrder.map(id =>
          state.instruments.find(inst => inst.id === id)
        ).filter(Boolean);

      case 'arrangement':
        // Sort by arrangement timeline order based on first note occurrence
        return storeManager.getArrangementSortedInstruments();

      default:
        return state.instruments;
    }
  },
}));
