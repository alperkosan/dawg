// src/store/usePlaybackStoreV2.js
import { create } from 'zustand';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '@/config/constants';
import PlaybackControllerSingleton from '@/lib/core/PlaybackControllerSingleton.js';

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
  bpm: 90,
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
      const currentState = get();

      // ✅ Only update BPM if it actually changed AND it's not the initial sync
      // This prevents controller's initial state from overriding store's BPM
      const updates = {
        isPlaying: data.state.isPlaying,
        playbackState: data.state.playbackState,
        currentStep: data.state.currentPosition,
        loopEnabled: data.state.loopEnabled,
        loopStartStep: data.state.loopStart,
        loopEndStep: data.state.loopEnd
      };

      // Only update BPM if:
      // 1. Controller's BPM is different from store's BPM
      // 2. AND this is not an 'init' event (which happens on first subscribe)
      if (data.type !== 'init' && data.state.bpm !== currentState.bpm) {
        console.log('🎵 BPM changed from controller:', currentState.bpm, '→', data.state.bpm);
        updates.bpm = data.state.bpm;
      }

      set(updates);
    });

    // ✅ FIX: Position update subscription (throttled to 30Hz for performance)
    let lastPositionUpdate = 0;
    const POSITION_UPDATE_INTERVAL = 33.33; // ~30fps (sufficient for visual feedback)

    controller.on('position-update', (data) => {
      const now = performance.now();
      if (now - lastPositionUpdate < POSITION_UPDATE_INTERVAL) return;

      set({ currentStep: data.position });
      lastPositionUpdate = now;
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
    const controller = await get()._initController();
    if (!controller) {
      console.error('🏪 No controller available for togglePlayPause');
      return;
    }
    await controller.togglePlayPause();
  },

  handleStop: async () => {
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
  setTransportPosition: async (position, step) => {
    // Update UI state
    set({ transportPosition: position, transportStep: step });

    // Update PlaybackManager position
    const controller = await get()._initController();
    if (controller?.playbackManager) {
      controller.playbackManager.jumpToStep(step);
    }
  },

  setPlaybackState: (state) => {
    // ✅ Silently handled by PlaybackController - no warning needed
  },

  // =============== ARRANGEMENT INTEGRATION ===============

  setPlaybackMode: async (mode) => {

    // ✅ Get controller first
    let controller = get()._controller;
    if (!controller) {
      controller = await get()._initController();
    }

    // ✅ CRITICAL: Stop playback first (before any state changes)
    const wasPlaying = get().isPlaying;
    if (wasPlaying && controller) {
      await controller.stop();
      // Wait a tick for events to propagate
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // ✅ Update mode in PlaybackManager (use setter for proper scheduling)
    const playbackManager = controller?.audioEngine?.playbackManager;
    if (playbackManager) {
      playbackManager.setPlaybackMode(mode);
    }

    // ✅ Update store state (after controller updated)
    set({
      playbackMode: mode,
      isPlaying: false,
      playbackState: PLAYBACK_STATES.STOPPED,
      currentStep: 0
    });

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