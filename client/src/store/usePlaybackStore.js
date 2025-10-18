// src/store/usePlaybackStore.js
import { create } from 'zustand';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '@/config/constants';
import { initialSettings } from '@/config/initialData';
import PlaybackControllerSingleton from '@/lib/core/PlaybackControllerSingleton.js';

/**
 * UNIFIED PLAYBACK STORE
 *
 * This store integrates with PlaybackController singleton for centralized state management.
 *
 * Architecture:
 * - PlaybackController: Core playback logic and state (single source of truth)
 * - usePlaybackStore: React/Zustand binding layer (UI state reflection)
 * - PlaybackManager: Audio scheduling and note management
 *
 * Migration History:
 * - V1 (deprecated): Direct AudioContextService access
 * - V2 (migrated 2025-10-10): PlaybackController singleton integration
 *
 * @see PlaybackController.js for core implementation
 * @see PlaybackControllerSingleton.js for singleton pattern
 */

export const usePlaybackStore = create((set, get) => ({
  // =============== STATE ===============
  isPlaying: false,
  playbackState: PLAYBACK_STATES.STOPPED,
  playbackMode: PLAYBACK_MODES.PATTERN,
  bpm: initialSettings.bpm,  // ✅ Use initial BPM from config (140)
  masterVolume: 0.8,
  transportPosition: '1:1:00',
  transportStep: 0,
  loopEnabled: true,
  audioLoopLength: 64,
  currentStep: 0,
  ghostPosition: null,
  loopStartStep: 64,
  loopEndStep: 128,
  _controller: null,
  _isInitialized: false,
  _currentPositionMode: 'pattern', // ✅ Track which mode the current position is for

  // =============== INITIALIZATION ===============
  _initController: async () => {
    const state = get();
    if (state._isInitialized) return state._controller;

    try {
      const controller = await PlaybackControllerSingleton.getInstance();
      if (!controller) return null;

      const unsubscribe = controller.subscribe((data) => {
        const currentState = get();
        const updates = {
          isPlaying: data.state.isPlaying,
          playbackState: data.state.playbackState,
          currentStep: data.state.currentPosition,
          loopEnabled: data.state.loopEnabled,
          loopStartStep: data.state.loopStart,
          loopEndStep: data.state.loopEnd
        };

        if (data.type !== 'init' && data.state.bpm !== currentState.bpm) {
          console.log('🎵 BPM changed from controller:', currentState.bpm, '→', data.state.bpm);
          updates.bpm = data.state.bpm;
        }

        set(updates);
      });

      let lastPositionUpdate = 0;
      const POSITION_UPDATE_INTERVAL = 33.33;

      controller.on('position-update', (data) => {
        const now = performance.now();
        if (now - lastPositionUpdate < POSITION_UPDATE_INTERVAL) return;

        // ✅ Always update currentStep - components decide whether to use it based on mode
        // Store now includes mode information for filtering at component level
        set({
          currentStep: data.position,
          _currentPositionMode: data.mode // Track which mode this position is for
        });
        lastPositionUpdate = now;
      });

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

  // =============== ACTIONS ===============
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

  jumpToStep: async (step) => {
    const controller = await get()._initController();
    if (!controller) return;
    await controller.jumpToPosition(step, { smooth: true });
  },

  setCurrentStep: (step) => {
    get().jumpToStep(step);
  },

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

  setTransportPosition: async (position, step) => {
    set({ transportPosition: position, transportStep: step });
    const controller = await get()._initController();
    if (controller?.playbackManager) {
      controller.playbackManager.jumpToStep(step);
    }
  },

  setPlaybackState: (state) => {
    // Silently handled by PlaybackController
  },

  setPlaybackMode: async (mode) => {
    let controller = get()._controller;
    if (!controller) {
      controller = await get()._initController();
    }

    const wasPlaying = get().isPlaying;
    if (wasPlaying && controller) {
      await controller.stop();
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const playbackManager = controller?.audioEngine?.playbackManager;
    if (playbackManager) {
      playbackManager.setPlaybackMode(mode);
    }

    set({
      playbackMode: mode,
      isPlaying: false,
      playbackState: PLAYBACK_STATES.STOPPED,
      currentStep: 0
    });

    get().updateLoopLength();
  },

  updateLoopLength: () => {
    const newLength = 64;
    set({ audioLoopLength: newLength });

    const { _controller } = get();
    if (_controller) {
      _controller.setLoopRange(0, newLength);
    }
  },

  handleMasterVolumeChange: async (volume) => {
    set({ masterVolume: volume });
  },

  // =============== UTILITY ===============
  getController: async () => {
    try {
      return await PlaybackControllerSingleton.getInstance();
    } catch (error) {
      console.error('Failed to get controller:', error);
      return null;
    }
  },

  destroy: () => {
    const { _controller, _unsubscribe } = get();
    if (_unsubscribe) _unsubscribe();
    if (_controller) _controller.destroy();
    set({ _controller: null, _isInitialized: false });
  }
}));