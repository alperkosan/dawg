// src/store/usePlaybackStore.js
import { create } from 'zustand';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '@/config/constants';
import { usePreviewPlayerStore } from './usePreviewPlayerStore.js';
import { storeManager } from './StoreManager';
import { calculatePatternLoopLength, calculateArrangementLoopLength } from '@/lib/utils/patternUtils.js';
// ✅ PHASE 2: Migrated to TransportController (unified singleton)
import { AudioContextService } from '@/lib/services/AudioContextService';

/**
 * UNIFIED PLAYBACK STORE
 *
 * This store integrates with TransportController for centralized state management.
 *
 * Architecture:
 * - TransportController: Core playback logic and state (single source of truth) ✅ PHASE 2
 * - usePlaybackStore: React/Zustand binding layer (UI state reflection)
 * - NativeTransportSystem: Audio scheduling and timing
 *
 * Migration History:
 * - V1 (deprecated): Direct AudioContextService access
 * - V2 (2025-10-10): PlaybackController singleton integration
 * - V3 (2025-12-27): TransportController unified singleton ✅ PHASE 2
 *
 * @see TransportController.js for core implementation
 */

export const usePlaybackStore = create((set, get) => ({
  // =============== STATE ===============
  // ✅ UNIFIED TRANSPORT: These are UI reflection states
  // The actual source of truth is SharedArrayBuffer via TransportController
  // These local states exist for React reactivity but are synced from controller
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
      // ✅ PHASE 2: Use TransportController
      const controller = AudioContextService.getTransportController();
      if (!controller) {
        console.warn('⚠️ TransportController not yet initialized');
        return null;
      }

      const unsubscribe = controller.subscribe((controllerState) => {
        const currentState = get();
        // ✅ UNIFIED TRANSPORT: Sync UI state from controller (which reads from SAB)
        // ✅ FIX: Check isPaused FIRST, because when paused, isPlaying is false
        // SAB states: 0=stopped, 1=playing, 2=paused
        // isPaused=true means SAB state is 2, not 0
        let computedPlaybackState;
        if (controllerState.isPaused) {
          computedPlaybackState = PLAYBACK_STATES.PAUSED;
        } else if (controllerState.isPlaying) {
          computedPlaybackState = PLAYBACK_STATES.PLAYING;
        } else {
          computedPlaybackState = PLAYBACK_STATES.STOPPED;
        }

        const updates = {
          isPlaying: controllerState.isPlaying,
          playbackState: computedPlaybackState,
          currentStep: controllerState.currentStep,
          loopEnabled: controllerState.loopEnabled,
          loopStartStep: controllerState.loopStart,
          loopEndStep: controllerState.loopEnd
        };

        if (controllerState.bpm !== currentState.bpm) {
          console.log('🎵 BPM changed from controller:', currentState.bpm, '→', controllerState.bpm);
          updates.bpm = controllerState.bpm;
        }

        set(updates);
      });

      // ✅ Subscribe to tick events for position updates
      let lastPositionUpdate = 0;
      const POSITION_UPDATE_INTERVAL = 100; // 10 FPS

      let rafId = null;
      let pendingPosition = null;

      const handleTick = (data) => {
        pendingPosition = data;

        if (!rafId) {
          rafId = requestAnimationFrame((timestamp) => {
            if (pendingPosition && timestamp - lastPositionUpdate >= POSITION_UPDATE_INTERVAL) {
              set({
                currentStep: pendingPosition.step || controller.getCurrentStep(),
                _currentPositionMode: 'pattern' // Default mode
              });
              lastPositionUpdate = timestamp;
            }
            rafId = null;
          });
        }
      };

      // Subscribe via EventBus
      const EventBus = (await import('@/lib/core/EventBus')).default;
      EventBus.on('transport:tick', handleTick);

      // Track ghost position
      EventBus.on('transport:ghostPosition', ({ position }) => {
        set({ ghostPosition: position });
      });

      // ✅ Fix: Listen to position changes (seeking while stopped)
      EventBus.on('transport:positionChanged', ({ step }) => {
        set({
          currentStep: step,
          transportStep: step,
          // Update string format? transportPosition: '...'
        });
      });

      // ✅ CRITICAL: Recalculate loop length when notes change
      // This ensures the loop range adapts dynamically as the user adds/removes notes
      const handlePatternChange = () => {
        // Use a small timeout to ensure store updates have propagated
        // (though synchronous updates usually don't need this, it assumes storeManager is up to date)
        setTimeout(() => {
          get().updateLoopLength();
        }, 0);
      };

      EventBus.on('NOTE_ADDED', handlePatternChange);
      EventBus.on('NOTE_REMOVED', handlePatternChange);

      set({
        _controller: controller,
        _isInitialized: true,
        _unsubscribe: () => {
          unsubscribe();
          EventBus.off('transport:tick', handleTick);
          EventBus.off('transport:ghostPosition');
          EventBus.off('transport:positionChanged');
          EventBus.off('NOTE_ADDED', handlePatternChange);
          EventBus.off('NOTE_REMOVED', handlePatternChange);
        }
      });

      // ✅ FIX: Calculate initial loop length once controller is ready
      // This ensures on page load/reload the loop is correct even before any interaction
      get().updateLoopLength();

      return controller;
    } catch (error) {
      console.error('Failed to initialize TransportController in store:', error);
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

  setTransportPosition: (position, step) => {
    // ✅ CRITICAL FIX: Only update UI state, do NOT call jumpToStep
    // Previously this was calling jumpToStep which caused a circular callback loop:
    // tick → setTransportPosition → jumpToStep → loop restart → position=0 → ...
    set({ transportPosition: position, transportStep: step });
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
            // ✅ FIX: Always calculate loop length dynamically based on content
            // This ensures the loop adapts to the actual notes (e.g. 16 steps)
            // instead of using the default fixed length (usually 64)
            nextLength = calculatePatternLoopLength(activePattern);
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
  getController: () => {
    // ✅ PHASE 2: Return TransportController directly (synchronous)
    return AudioContextService.getTransportController();
  },

  destroy: () => {
    const { _controller, _unsubscribe } = get();
    if (_unsubscribe) _unsubscribe();
    // TransportController is managed by AudioContextService, don't destroy it
    set({ _controller: null, _isInitialized: false });
  }
}));