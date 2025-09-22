// store/usePlaybackStore.js - Enhanced with Song/Pattern Mode Support
// DAWG - Advanced Playback Store with Song/Pattern Modes

import { create } from 'zustand';
import { useArrangementStore } from './useArrangementStore';
import { calculateAudioLoopLength, calculateUIRackLength, calculatePatternLoopLength } from '../lib/utils/patternUtils';
import { AudioContextService } from '../lib/services/AudioContextService';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '../config/constants';

export const usePlaybackStore = create((set, get) => ({
  // =================== BASIC STATE ===================
  playbackState: PLAYBACK_STATES.STOPPED,
  bpm: 120,
  masterVolume: 0.8,
  transportPosition: '1:1:00',
  transportStep: 0,
  
  // =================== ✅ NEW: MODE MANAGEMENT ===================
  playbackMode: PLAYBACK_MODES.PATTERN, // 'pattern' | 'song'
  
  // =================== ✅ NEW: LOOP MANAGEMENT ===================
  loopEnabled: true,
  loopStartStep: 0,
  loopEndStep: 64,
  isAutoLoop: true, // Auto calculate loop points based on content
  
  // =================== ✅ NEW: PATTERN MODE ===================
  patternLoopLength: 64, // Calculated from active pattern
  
  // =================== ✅ NEW: SONG MODE ===================
  songLoopLength: 256, // Calculated from arrangement clips
  
  // =================== ✅ NEW: TIMELINE MANAGEMENT ===================
  timelineSelection: null, // { start: number, end: number } in steps
  playbackRegion: 'full', // 'full' | 'selection' | 'loop'
  
  // =================== ✅ NEW: AUTOMATION ===================
  automationEnabled: true,
  recordingAutomation: false,
  automationMode: 'read', // 'read' | 'write' | 'touch' | 'latch'

  // =================== ACTIONS ===================

  // ✅ ENHANCED: Playback Mode Management
  setPlaybackMode: (mode) => {
    const currentState = get();
    if (currentState.playbackMode === mode) return;
    
    const wasPlaying = currentState.playbackState === PLAYBACK_STATES.PLAYING;
    
    // Stop if playing
    if (wasPlaying) {
      get().handleStop();
    }
    
    set({ playbackMode: mode });
    
    // Update loop settings for new mode
    get().updateLoopSettings();
    
    // Restart if was playing
    if (wasPlaying) {
      setTimeout(() => get().handlePlay(), 100);
    }
    
    console.log(`🔄 Playback mode changed to: ${mode}`);
  },

  // ✅ NEW: Loop Management
  setLoopPoints: (startStep, endStep) => {
    const clampedStart = Math.max(0, startStep);
    const clampedEnd = Math.max(clampedStart + 1, endStep);
    
    set({ 
      loopStartStep: clampedStart,
      loopEndStep: clampedEnd,
      isAutoLoop: false
    });
    
    // Update engine
    AudioContextService.setLoop(clampedStart, clampedEnd);
    
    console.log(`🔁 Loop points set: ${clampedStart} -> ${clampedEnd}`);
  },

  setLoopEnabled: (enabled) => {
    set({ loopEnabled: enabled });
    AudioContextService.getAudioEngine()?.setLoopEnabled(enabled);
    console.log(`🔁 Loop ${enabled ? 'enabled' : 'disabled'}`);
  },

  enableAutoLoop: () => {
    set({ isAutoLoop: true });
    get().updateLoopSettings();
    AudioContextService.getAudioEngine()?.enableAutoLoop();
    console.log('🔄 Auto loop enabled');
  },

  // ✅ NEW: Timeline Selection
  setTimelineSelection: (start, end) => {
    if (start !== null && end !== null) {
      const selection = {
        start: Math.min(start, end),
        end: Math.max(start, end)
      };
      set({ timelineSelection: selection });
      console.log(`📏 Timeline selection: ${selection.start} -> ${selection.end}`);
    } else {
      set({ timelineSelection: null });
      console.log('📏 Timeline selection cleared');
    }
  },

  setPlaybackRegion: (region) => {
    set({ playbackRegion: region });
    
    // Update loop points based on region
    switch (region) {
      case 'selection':
        const selection = get().timelineSelection;
        if (selection) {
          get().setLoopPoints(selection.start, selection.end);
        }
        break;
      case 'loop':
        // Use current loop points
        break;
      case 'full':
      default:
        get().enableAutoLoop();
        break;
    }
    
    console.log(`🎯 Playback region set to: ${region}`);
  },

  // ✅ ENHANCED: Loop Length Calculation
  updateLoopSettings: () => {
    const { playbackMode, isAutoLoop } = get();
    
    if (!isAutoLoop) return;
    
    let newLoopEnd;
    
    if (playbackMode === PLAYBACK_MODES.PATTERN) {
      // Calculate from active pattern
      const { patterns, activePatternId } = useArrangementStore.getState();
      const activePattern = patterns[activePatternId];
      
      if (activePattern) {
        newLoopEnd = calculatePatternLoopLength(activePattern);
      } else {
        newLoopEnd = 64; // Default
      }
      
      set({ patternLoopLength: newLoopEnd });
      
    } else {
      // Calculate from song arrangement
      const { clips } = useArrangementStore.getState();
      newLoopEnd = calculateAudioLoopLength(playbackMode, { clips });
      set({ songLoopLength: newLoopEnd });
    }
    
    // Update loop points
    set({ 
      loopStartStep: 0,
      loopEndStep: newLoopEnd
    });
    
    // Update engine
    AudioContextService.setLoop(0, newLoopEnd);
    
    console.log(`📏 Loop length updated: ${newLoopEnd} steps (${playbackMode} mode)`);
  },

  // =================== BASIC TRANSPORT CONTROLS ===================
  
  setPlaybackState: (state) => set({ playbackState: state }),
  
  setTransportPosition: (position, step) => {
    let positionString = position;
    if (typeof position === 'object' && position !== null && position.hasOwnProperty('formatted')) {
      positionString = position.formatted;
    } else if (typeof position === 'object') {
      positionString = 'ERROR'; 
    }
    set({
      transportPosition: positionString,
      transportStep: step || 0
    });
  },

  handleBpmChange: (newBpm) => {
    const clampedBpm = Math.max(60, Math.min(300, newBpm));
    set({ bpm: clampedBpm });
    AudioContextService.setBPM(clampedBpm);
  },

  handleMasterVolumeChange: (newVolume) => {
    const clampedVolume = Math.max(0, Math.min(2, newVolume));
    set({ masterVolume: clampedVolume });
    AudioContextService.setMasterVolume(clampedVolume);
  },

  // =================== ✅ ENHANCED: PLAYBACK CONTROLS ===================

  handlePlay: () => {
    const engine = AudioContextService.getAudioEngine();
    if (!engine) return;
    
    const { playbackState, transportStep, playbackRegion, timelineSelection } = get();
    
    let startStep = 0;
    
    // Determine start position based on playback region
    switch (playbackRegion) {
      case 'selection':
        if (timelineSelection) {
          startStep = timelineSelection.start;
        } else {
          startStep = transportStep || 0;
        }
        break;
      case 'loop':
        startStep = get().loopStartStep;
        break;
      case 'full':
      default:
        if (playbackState === PLAYBACK_STATES.STOPPED) {
          startStep = 0;
        } else {
          startStep = transportStep || 0;
        }
        break;
    }
    
    // Set playback mode in engine
    engine.setPlaybackMode(get().playbackMode);
    
    if (playbackState === PLAYBACK_STATES.STOPPED) {
      console.log(`▶️ Starting playback from step ${startStep} (${get().playbackMode} mode)`);
      engine.play(startStep);
    } else if (playbackState === PLAYBACK_STATES.PAUSED) {
      console.log(`▶️ Resuming playback (${get().playbackMode} mode)`);
      engine.resume();
    }
  },

  handlePause: () => {
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.pause();
    }
  },

  handleStop: () => {
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.stop();
      // Reset position based on playback region
      const { playbackRegion, timelineSelection } = get();
      let resetPosition = 0;
      
      switch (playbackRegion) {
        case 'selection':
          resetPosition = timelineSelection?.start || 0;
          break;
        case 'loop':
          resetPosition = get().loopStartStep;
          break;
        default:
          resetPosition = 0;
      }
      
      get().setTransportPosition(`1:1:00`, resetPosition);
    }
  },

  // =================== ✅ NEW: POSITION CONTROLS ===================

  jumpToBar: (barNumber) => {
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.jumpToBar(barNumber);
    }
  },

  jumpToStep: (step) => {
    const engine = AudioContextService.getAudioEngine();
    if (engine) {
      engine.jumpToStep(step);
    }
  },

  jumpToPercent: (percent) => {
    const { loopEndStep } = get();
    const targetStep = Math.floor((loopEndStep * percent) / 100);
    get().jumpToStep(targetStep);
  },

  // =================== ✅ NEW: AUTOMATION CONTROLS ===================

  setAutomationEnabled: (enabled) => {
    set({ automationEnabled: enabled });
    console.log(`🤖 Automation ${enabled ? 'enabled' : 'disabled'}`);
  },

  setAutomationMode: (mode) => {
    set({ automationMode: mode });
    console.log(`🤖 Automation mode: ${mode}`);
  },

  startAutomationRecording: () => {
    set({ recordingAutomation: true, automationMode: 'write' });
    console.log('🔴 Automation recording started');
  },

  stopAutomationRecording: () => {
    set({ recordingAutomation: false, automationMode: 'read' });
    console.log('⏹️ Automation recording stopped');
  },

  // =================== ✅ NEW: UTILITY METHODS ===================

  getCurrentLoopInfo: () => {
    const { loopStartStep, loopEndStep, loopEnabled, isAutoLoop, playbackMode } = get();
    return {
      start: loopStartStep,
      end: loopEndStep,
      length: loopEndStep - loopStartStep,
      enabled: loopEnabled,
      auto: isAutoLoop,
      mode: playbackMode
    };
  },

  getPlaybackInfo: () => {
    const state = get();
    return {
      mode: state.playbackMode,
      state: state.playbackState,
      position: state.transportStep,
      bpm: state.bpm,
      loop: state.getCurrentLoopInfo(),
      region: state.playbackRegion,
      selection: state.timelineSelection,
      automation: {
        enabled: state.automationEnabled,
        recording: state.recordingAutomation,
        mode: state.automationMode
      }
    };
  },

  // =================== ✅ NEW: SMART PLAYBACK ===================

  smartPlay: () => {
    const { playbackState, timelineSelection, playbackRegion } = get();
    
    // If there's a timeline selection and we're not in selection mode, switch to it
    if (timelineSelection && playbackRegion !== 'selection') {
      get().setPlaybackRegion('selection');
    }
    
    // Start playback
    get().handlePlay();
  },

  togglePlayPause: () => {
    const { playbackState } = get();
    
    switch (playbackState) {
      case PLAYBACK_STATES.STOPPED:
        get().handlePlay();
        break;
      case PLAYBACK_STATES.PLAYING:
        get().handlePause();
        break;
      case PLAYBACK_STATES.PAUSED:
        get().handlePlay();
        break;
    }
  },

  // =================== ✅ NEW: PATTERN/SONG SPECIFIC ===================

  playFromPattern: (patternId) => {
    // Switch to pattern mode and play specific pattern
    get().setPlaybackMode(PLAYBACK_MODES.PATTERN);
    useArrangementStore.getState().setActivePatternId(patternId);
    setTimeout(() => get().handlePlay(), 100);
  },

  playFromClip: (clipId) => {
    // Switch to song mode and play from specific clip
    get().setPlaybackMode(PLAYBACK_MODES.SONG);
    
    // Find clip and jump to its start
    const { clips } = useArrangementStore.getState();
    const clip = clips.find(c => c.id === clipId);
    if (clip) {
      const clipStartStep = (clip.startTime || 0) * 16; // Convert bars to steps
      get().jumpToStep(clipStartStep);
    }
    
    setTimeout(() => get().handlePlay(), 100);
  },

  // =================== ✅ NEW: ADVANCED FEATURES ===================

  recordEnable: (instrumentId, enabled) => {
    // Enable/disable recording for specific instrument
    // This would be used for live recording while playback is running
    console.log(`🔴 Record ${enabled ? 'enabled' : 'disabled'} for ${instrumentId}`);
    // Implementation would depend on recording system
  },

  setQuantization: (quantizeValue) => {
    // Set global quantization for recording and editing
    // '16n', '8n', '4n', etc.
    console.log(`📐 Quantization set to: ${quantizeValue}`);
    // This would affect how recorded notes are quantized
  },

  // =================== ✅ NEW: PERFORMANCE CONTROLS ===================

  setPreroll: (bars) => {
    // Set preroll bars before recording starts
    set({ prerollBars: bars });
    console.log(`⏰ Preroll set to ${bars} bars`);
  },

  setMetronome: (enabled, volume = 0.5) => {
    // Enable/disable metronome
    set({ 
      metronomeEnabled: enabled,
      metronomeVolume: volume
    });
    console.log(`🥁 Metronome ${enabled ? 'enabled' : 'disabled'}`);
  },

  // =================== INITIALIZATION ===================
  
  // Initialize store with default values
  _initialize: () => {
    // This is called once when the engine is ready
    get().updateLoopSettings();
    console.log('🎵 PlaybackStore initialized');
  }
}));
