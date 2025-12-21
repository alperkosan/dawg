// src/store/usePlaybackStore.js
import { create } from 'zustand';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '@/config/constants';
import { usePreviewPlayerStore } from './usePreviewPlayerStore.js';
import { storeManager } from './StoreManager';
import { calculatePatternLoopLength, calculateArrangementLoopLength } from '@/lib/utils/patternUtils.js';
// ✅ Empty project - no initial settings
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
  bpm: 120, // ✅ Empty project - default BPM
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

  // ✅ PHASE 1: Follow Playhead Mode
  followPlayheadMode: 'OFF', // 'CONTINUOUS' | 'PAGE' | 'OFF'

  // ✅ GLOBAL SHORTCUTS: Musical Typing mode
  keyboardPianoMode: false,

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
    console.log('🏪 usePlaybackStore.togglePlayPause() called');
    const controller = await get()._initController();
    if (!controller) {
      console.error('🏪 No controller available for togglePlayPause');
      return;
    }
    console.log('🏪 Calling controller.togglePlayPause()');
    await controller.togglePlayPause();
    console.log('🏪 controller.togglePlayPause() completed');
  },

  handleStop: async () => {
    const controller = await get()._initController();
    if (!controller) {
      console.error('🏪 No controller available for handleStop');
      return;
    }
    await controller.stop();
    // ✅ UX: Always rewind to start when transport is stopped from UI
    await controller.jumpToPosition(0, { smooth: false });
    set({
      currentStep: 0,
      transportStep: 0,
      transportPosition: '1:1:00'
    });
    try {
      const { stopPreview, isPlaying } = usePreviewPlayerStore.getState();
      if (isPlaying) {
        stopPreview();
      }
    } catch (error) {
      console.warn('⚠️ Failed to stop preview player on transport stop:', error);
    }
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
    const { playbackMode, _controller } = get();
    let nextLength = 64;

    try {
      const arrangementStore = storeManager?.stores?.arrangement;
      const arrangementState = arrangementStore?.getState?.();

      if (arrangementState) {
        if (playbackMode === PLAYBACK_MODES.PATTERN) {
          const { activePatternId, patterns } = arrangementState;
          const activePattern = patterns?.[activePatternId];
          if (activePattern) {
            if (typeof activePattern.length === 'number') {
              nextLength = activePattern.length;
            } else {
              nextLength = calculatePatternLoopLength(activePattern);
            }
          }
        } else {
          const arrangementClips = arrangementState.clips || [];
          if (arrangementClips.length > 0) {
            nextLength = calculateArrangementLoopLength(arrangementClips);
          } else if (typeof arrangementState.songLength === 'number') {
            nextLength = Math.max(64, Math.ceil(arrangementState.songLength * 16));
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to compute loop length from arrangement state:', error);
    }

    set({
      audioLoopLength: nextLength,
      loopEndStep: nextLength
    });

    if (_controller) {
      _controller.setLoopRange(0, nextLength);
    }
  },

  handleMasterVolumeChange: async (volume) => {
    set({ masterVolume: volume });
  },

  // ✅ PHASE 1: Follow Playhead Mode Actions
  setFollowPlayheadMode: (mode) => {
    set({ followPlayheadMode: mode });
    console.log('🎯 Follow Playhead Mode:', mode);
  },

  cycleFollowPlayheadMode: () => {
    const modes = ['CONTINUOUS', 'PAGE', 'OFF'];
    const currentMode = get().followPlayheadMode;
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    get().setFollowPlayheadMode(nextMode);
  },

  setKeyboardPianoMode: (active) => {
    set({ keyboardPianoMode: active });
    console.log('🎹 Global Musical Typing:', active ? 'ON' : 'OFF');
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