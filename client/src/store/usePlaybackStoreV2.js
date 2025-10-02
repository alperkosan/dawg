// src/store/usePlaybackStoreV2.js
import { create } from 'zustand';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '../config/constants';
import PlaybackControllerSingleton from '../lib/core/PlaybackControllerSingleton.js';

/**
 * ✅ V2 PLAYBACK STORE - Unified System Bridge
 *
 * Bu store artık PlaybackController singleton'ı kullanır
 * Backward compatibility + yeni sistemin avantajları
 */

export const usePlaybackStore = create((set, get) => ({
  // =============== STATE ===============
  // Backward compatibility state
  isPlaying: false,
  playbackState: PLAYBACK_STATES.STOPPED,
  playbackMode: PLAYBACK_MODES.PATTERN,
  bpm: 140,
  masterVolume: 0.8,
  transportPosition: '1:1:00',
  transportStep: 0,
  loopEnabled: true,
  audioLoopLength: 64,

  // ✅ SIMPLIFIED: Tek position source
  currentStep: 0,           // Gerçek motor pozisyonu
  ghostPosition: null,      // UI ghost playhead

  // Loop management
  loopStartStep: 64,
  loopEndStep: 128,

  // Internal
  _controller: null,
  _isInitialized: false,

  // =============== INITIALIZATION ===============
  _initController: async () => {
    const state = get();
    if (state._isInitialized) return state._controller;

    try {
      const controller = await PlaybackControllerSingleton.getInstance();
      if (!controller) return null;

    // Controller events subscription
    const unsubscribe = controller.subscribe((data) => {
      console.log('🏪 Store receiving controller update:', {
        playbackState: data.state.playbackState,
        isPlaying: data.state.isPlaying,
        reason: data.reason
      });

      set({
        isPlaying: data.state.isPlaying,
        playbackState: data.state.playbackState,
        currentStep: data.state.currentPosition,
        bpm: data.state.bpm,
        loopEnabled: data.state.loopEnabled,
        loopStartStep: data.state.loopStart,
        loopEndStep: data.state.loopEnd
      });
    });

    // Ghost position subscription
    controller.on('ghost-position-change', (position) => {
      set({ ghostPosition: position });
    });

      set({
        _controller: controller,
        _isInitialized: true,
        _unsubscribe: unsubscribe
      });

      return controller;
    } catch (error) {
      console.error('Failed to initialize PlaybackController in store:', error);
      return null;
    }
  },

  // =============== ACTIONS (Controller Proxy) ===============

  // Primary controls
  togglePlayPause: async () => {
    console.log('🏪 Store.togglePlayPause called');
    const controller = await get()._initController();
    if (!controller) {
      console.error('🏪 No controller available for togglePlayPause');
      return;
    }
    await controller.togglePlayPause();
  },

  handleStop: async () => {
    console.log('🏪 Store.handleStop called');
    const controller = await get()._initController();
    if (!controller) {
      console.error('🏪 No controller available for handleStop');
      return;
    }
    await controller.stop();
  },

  // Position control
  jumpToStep: async (step) => {
    const controller = await get()._initController();
    if (!controller) return;
    await controller.jumpToPosition(step, { smooth: true });
  },

  setCurrentStep: (step) => {
    // Legacy compatibility - now updates through controller
    get().jumpToStep(step);
  },

  // Settings
  handleBpmChange: async (newBpm) => {
    const controller = await get()._initController();
    if (!controller) return;
    controller.setBPM(newBpm);
  },

  setLoopEnabled: async (enabled) => {
    const controller = await get()._initController();
    if (!controller) return;
    controller.setLoopEnabled(enabled);
  },

  setLoopRange: async (startStep, endStep) => {
    const controller = await get()._initController();
    if (!controller) return;
    controller.setLoopRange(startStep, endStep);
  },

  // =============== LEGACY COMPATIBILITY ===============

  // Eski API backward compatibility için
  setStartPosition: (step) => {
    console.warn('setStartPosition is deprecated, use jumpToStep');
    get().jumpToStep(step);
  },

  setPausePosition: (step) => {
    console.warn('setPausePosition is deprecated, use jumpToStep');
    get().jumpToStep(step);
  },

  getCurrentMotorPosition: () => {
    const { _controller } = get();
    return _controller?.getCurrentPosition() || 0;
  },

  // Transport legacy
  setTransportPosition: (position, step) => {
    set({ transportPosition: position, transportStep: step });
  },

  setPlaybackState: (state) => {
    // ✅ Silently handled by PlaybackController - no warning needed
  },

  // =============== ARRANGEMENT INTEGRATION ===============

  setPlaybackMode: async (mode) => {
    set({ playbackMode: mode });
    get().updateLoopLength();
  },

  updateLoopLength: () => {
    // TODO: Calculate from arrangement
    const newLength = 64; // Placeholder
    set({ audioLoopLength: newLength });

    // Update controller
    const { _controller } = get();
    if (_controller) {
      _controller.setLoopRange(0, newLength);
    }
  },

  // Master volume
  handleMasterVolumeChange: async (volume) => {
    set({ masterVolume: volume });
    // TODO: Integrate with controller
  },

  // =============== UTILITY ===============

  // Controller accessor for advanced usage
  getController: async () => {
    try {
      return await PlaybackControllerSingleton.getInstance();
    } catch (error) {
      console.error('Failed to get controller:', error);
      return null;
    }
  },

  // Cleanup
  destroy: () => {
    const { _controller, _unsubscribe } = get();
    if (_unsubscribe) _unsubscribe();
    if (_controller) _controller.destroy();
    set({ _controller: null, _isInitialized: false });
  }
}));