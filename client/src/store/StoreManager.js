/**
 * Store Manager - Central orchestration for all store interactions
 * Prevents circular dependencies and provides a clean interface for store communication
 */

class StoreManager {
  constructor() {
    this.stores = {};
    this.initialized = false;
  }

  /**
   * Register stores for orchestration
   */
  registerStores({ useInstrumentsStore, useArrangementStore, useMixerStore, usePanelsStore, usePlaybackStore }) {
    this.stores = {
      instruments: useInstrumentsStore,
      arrangement: useArrangementStore,
      mixer: useMixerStore,
      panels: usePanelsStore,
      playback: usePlaybackStore
    };
    this.initialized = true;
  }

  /**
   * Add instrument to active pattern safely
   */
  addInstrumentToActivePattern(instrument) {
    if (!this.initialized) return;

    try {
      const { activePatternId } = this.stores.arrangement.getState();
      if (activePatternId) {
        this.stores.arrangement.getState().addInstrumentToPattern(activePatternId, instrument);
      }
    } catch (error) {
      console.warn('Could not add instrument to active pattern:', error);
    }
  }

  /**
   * Add existing instrument to specific pattern by ID
   */
  addInstrumentToPattern(patternId, instrumentId) {
    if (!this.initialized) return;

    try {
      // Get the instrument by ID
      const { instruments } = this.stores.instruments.getState();
      const instrument = instruments.find(inst => inst.id === instrumentId);

      if (instrument) {
        this.stores.arrangement.getState().addInstrumentToPattern(patternId, instrument);
      }
    } catch (error) {
      console.warn('Could not add instrument to pattern:', error);
    }
  }

  /**
   * Update pattern notes safely
   */
  updatePatternNotes(instrumentId, newNotes) {
    if (!this.initialized) return;

    try {
      const { activePatternId } = this.stores.arrangement.getState();
      if (activePatternId) {
        this.stores.arrangement.getState().updatePatternNotes(activePatternId, instrumentId, newNotes);
      }
    } catch (error) {
      console.warn('Could not update pattern notes:', error);
    }
  }

  /**
   * FL Studio Style: No pattern instrument initialization needed
   * All instruments are always visible regardless of pattern
   */
  initializePatternInstruments() {
    // FL Studio Logic: Do nothing - all instruments are always visible
    console.log('🎵 FL Studio Mode: All instruments are globally visible');
  }

  /**
   * ✅ PERFORMANCE: Centralized loop length update to prevent cascade updates
   */
  updateLoopLength() {
    if (!this.initialized || !this.stores.playback) return;

    try {
      // Single source of truth - call playback store's updateLoopLength once
      this.stores.playback.getState().updateLoopLength();
    } catch (error) {
      console.warn('Could not update loop length:', error);
    }
  }

  /**
   * ✅ PERFORMANCE: Find unused mixer track
   * Optimized with Set-based lookup for O(n) instead of O(n*m)
   */
  findUnusedMixerTrack() {
    if (!this.initialized || !this.stores.mixer || !this.stores.instruments) return null;

    try {
      const { mixerTracks } = this.stores.mixer.getState();
      const { instruments } = this.stores.instruments.getState();

      // ✅ PERFORMANCE: Use Set for O(1) lookup instead of array.includes() O(n)
      const usedTrackIds = new Set(instruments.map(inst => inst.mixerTrackId));
      
      // Find first unused track (early return)
      for (const track of mixerTracks) {
        if (track.type === 'track' && !usedTrackIds.has(track.id)) {
          // ✅ PERFORMANCE: Only log in DEV mode
          if (import.meta.env.DEV) {
            const availableTracks = mixerTracks.filter(t => t.type === 'track');
            console.log('🎛️ Mixer Track Usage:', {
              total: availableTracks.length,
              used: usedTrackIds.size,
              foundUnused: track.id
            });
          }
          return track;
        }
      }

      // No unused track found
      if (import.meta.env.DEV) {
        console.log('🎛️ No unused mixer tracks available');
      }
      return null;
    } catch (error) {
      console.warn('Could not find unused mixer track:', error);
      return null;
    }
  }

  /**
   * ✅ PERFORMANCE: Centralized instrument creation with all side effects
   */
  createInstrumentWithSideEffects(instrument, mixerTrackId, trackName) {
    if (!this.initialized) return;

    try {
      // 1. Create mixer track name (single call)
      // ✅ FIX: Don't rename master/bus channels, only regular tracks
      if (this.stores.mixer && mixerTrackId && trackName) {
        const { mixerTracks } = this.stores.mixer.getState();
        const track = mixerTracks.find(t => t.id === mixerTrackId);

        // Only rename if it's a regular track, not master or bus
        if (track && track.type === 'track') {
          this.stores.mixer.getState().setTrackName(mixerTrackId, trackName);
        }
      }

      // 2. Add to active pattern (single call)
      this.addInstrumentToActivePattern(instrument);
    } catch (error) {
      console.warn('Could not complete instrument creation side effects:', error);
    }
  }

  /**
   * ✅ PERFORMANCE: Centralized panel buffer update
   */
  updatePanelBuffer(instrumentId, newBuffer) {
    if (!this.initialized || !this.stores.panels) return;

    try {
      const panelsState = this.stores.panels.getState();
      if (panelsState.editingInstrumentId === instrumentId) {
        panelsState.setEditorBuffer(newBuffer);
      }
    } catch (error) {
      console.warn('Could not update panel buffer:', error);
    }
  }

  /**
   * ✅ PERFORMANCE: Centralized panel toggle for effect cleanup
   */
  togglePanelIfOpen(panelId) {
    if (!this.initialized || !this.stores.panels) return;

    try {
      const panelsState = this.stores.panels.getState();
      if (panelsState.panels[panelId]?.isOpen) {
        panelsState.togglePanel(panelId);
      }
    } catch (error) {
      console.warn('Could not toggle panel:', error);
    }
  }

  /**
   * Get arrangement-sorted instruments safely
   */
  getArrangementSortedInstruments() {
    if (!this.initialized) {
      return this.stores?.instruments?.getState?.()?.instruments || [];
    }

    try {
      const { instruments } = this.stores.instruments.getState();
      const { patterns, activePatternId } = this.stores.arrangement.getState();
      const activePattern = patterns[activePatternId];

      if (!activePattern) return instruments;

      return instruments.sort((a, b) => {
        const aFirstNote = activePattern.data[a.id]?.[0]?.time ?? Infinity;
        const bFirstNote = activePattern.data[b.id]?.[0]?.time ?? Infinity;

        // Sort by first note occurrence time, then by instrument name
        if (aFirstNote !== bFirstNote) {
          return aFirstNote - bFirstNote;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.warn('Could not get arrangement-sorted instruments:', error);
      return this.stores?.instruments?.getState?.()?.instruments || [];
    }
  }
}

// Singleton instance
export const storeManager = new StoreManager();