// components/playback/PlaybackControls.jsx
// DAWG - Enhanced Playback Controls with Song/Pattern Mode Support

import React, { useState, useEffect } from 'react';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  Repeat, Clock, Radio, Music, Film,
  Volume2, Settings, Zap, Target
} from 'lucide-react';
import { BPMInput } from '@/components/controls/BPMInput';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import {
  selectPlaybackControls,
  selectTransportDisplay,
  selectPlaybackActions,
  shallow
} from '@/store/selectors/playbackSelectors';
import { PLAYBACK_MODES, PLAYBACK_STATES } from '@/config/constants';
import { AudioContextService } from '@/lib/services/AudioContextService';
import EventBus from '@/lib/core/EventBus.js';

export const PlaybackControls = () => {
  // ✅ PERFORMANCE FIX: Use memoized selectors instead of entire store
  // Before: Re-renders 10x/sec (currentStep updates) = 2,000ms/sec waste
  // After: Re-renders ONLY when playbackState/mode/bpm changes = ~0ms waste

  // Memoized controls (stable reference, no currentStep)
  const {
    playbackState,
    playbackMode,
    bpm,
    loopEnabled,
    isPlaying
  } = usePlaybackStore(selectPlaybackControls, shallow);

  // Transport display (only for position text display)
  const { position: transportPosition } = usePlaybackStore(selectTransportDisplay, shallow);

  // Actions (stable function references)
  const {
    togglePlayPause,
    handleStop,
    setPlaybackMode,
    handleBpmChange,
    setLoopEnabled
  } = usePlaybackStore(selectPlaybackActions, shallow);

  // Legacy actions not in selectors yet (used rarely)
  const {
    enableAutoLoop,
    setPlaybackRegion,
    jumpToBar,
    isAutoLoop,
    playbackRegion,
    timelineSelection
  } = usePlaybackStore((state) => ({
    enableAutoLoop: state.enableAutoLoop,
    setPlaybackRegion: state.setPlaybackRegion,
    jumpToBar: state.jumpToBar,
    isAutoLoop: state.isAutoLoop,
    playbackRegion: state.playbackRegion,
    timelineSelection: state.timelineSelection
  }), shallow);

  const { activePatternId, patterns } = useArrangementStore();

  // ✅ DEBUG: Log state changes
  useEffect(() => {
    console.log('🎛️ PlaybackControls state:', { playbackState, bpm, loopEnabled });
  }, [playbackState, bpm, loopEnabled]);

  // =================== MAIN TRANSPORT CONTROLS ===================

  const TransportButtons = () => {
    // ✅ UNIFIED TRANSPORT: Use TransportController for consistent behavior
    const handleUnifiedStop = async () => {
      // ✅ Stop recording if active
      EventBus.emit('transport:stop', {});

      try {
        const transportController = AudioContextService.getTransportController();
        transportController.stop();
      } catch (error) {
        console.warn('TransportController not available, using fallback:', error);
        handleStop();
      }
    };

    const handleUnifiedPlayPause = async () => {
      try {
        const transportController = AudioContextService.getTransportController();
        transportController.togglePlayPause();
      } catch (error) {
        console.warn('TransportController not available, using fallback:', error);
        togglePlayPause();
      }
    };

    return (
      <div className="flex items-center space-x-2">
        {/* Stop */}
        <button
          onClick={handleUnifiedStop}
          className={`p-2 rounded transition-colors ${playbackState === PLAYBACK_STATES.STOPPED
            ? 'bg-orange-600 text-white shadow-lg'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          title="Stop"
        >
          <Square size={18} />
        </button>

        {/* Play/Pause */}
        <button
          onClick={handleUnifiedPlayPause}
          className={`p-3 rounded-lg transition-all duration-200 ${playbackState === PLAYBACK_STATES.PLAYING
            ? 'bg-red-600 hover:bg-red-700 shadow-lg'
            : playbackState === PLAYBACK_STATES.PAUSED
              ? 'bg-yellow-600 hover:bg-yellow-700 shadow-lg'
              : 'bg-green-600 hover:bg-green-700 shadow-lg'
            }`}
          title={
            playbackState === PLAYBACK_STATES.PLAYING
              ? 'Pause'
              : playbackState === PLAYBACK_STATES.PAUSED
                ? 'Resume'
                : 'Play'
          }
        >
          {playbackState === PLAYBACK_STATES.PLAYING ? (
            <Pause size={20} className="text-white" />
          ) : (
            <Play size={20} className="text-white ml-0.5" />
          )}
        </button>

        {/* Previous/Next Bar */}
        <div className="flex space-x-1">
          <button
            onClick={() => {
              try {
                const transportController = AudioContextService.getTransportController();
                // Get current step directly from stored state or controller
                const state = transportController.getState();
                const currentPosition = state.currentStep;

                const currentBar = Math.floor(currentPosition / 16);
                const previousBarStep = Math.max(0, currentBar - 1) * 16;
                transportController.jumpToStep(previousBarStep, { updateUI: true });
              } catch (error) {
                const currentBar = Math.floor(transportPosition.split(':')[0]) || 1;
                jumpToBar(Math.max(1, currentBar - 1));
              }
            }}
            className="p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
            title="Previous Bar"
          >
            <SkipBack size={16} className="text-gray-300" />
          </button>
          <button
            onClick={() => {
              try {
                const transportController = AudioContextService.getTransportController();
                const state = transportController.getState();
                const currentPosition = state.currentStep;

                const currentBar = Math.floor(currentPosition / 16);
                const nextBarStep = (currentBar + 1) * 16;
                transportController.jumpToStep(nextBarStep, { updateUI: true });
              } catch (error) {
                const currentBar = Math.floor(transportPosition.split(':')[0]) || 1;
                jumpToBar(currentBar + 1);
              }
            }}
            className="p-2 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
            title="Next Bar"
          >
            <SkipForward size={16} className="text-gray-300" />
          </button>
        </div>
      </div>
    );
  };

  // =================== MODE SELECTOR ===================

  const ModeSelector = () => (
    <div className="flex items-center bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => setPlaybackMode(PLAYBACK_MODES.PATTERN)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-all ${playbackMode === PLAYBACK_MODES.PATTERN
          ? 'bg-blue-600 text-white shadow-md'
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        title="Pattern Mode - Play active pattern in loop"
      >
        <Radio size={16} />
        <span className="text-sm font-medium">Pattern</span>
      </button>

      <button
        onClick={() => setPlaybackMode(PLAYBACK_MODES.SONG)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-all ${playbackMode === PLAYBACK_MODES.SONG
          ? 'bg-purple-600 text-white shadow-md'
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        title="Song Mode - Play arrangement timeline"
      >
        <Film size={16} />
        <span className="text-sm font-medium">Song</span>
      </button>
    </div>
  );

  // =================== LOOP CONTROLS ===================

  const LoopControls = () => (
    <div className="flex items-center space-x-2">
      {/* Loop Enable */}
      <button
        onClick={() => setLoopEnabled(!loopEnabled)}
        className={`p-2 rounded transition-all ${loopEnabled
          ? 'bg-yellow-600 text-white shadow-md'
          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        title={loopEnabled ? 'Disable Loop' : 'Enable Loop'}
      >
        <Repeat size={16} />
      </button>

      {/* Auto Loop */}
      <button
        onClick={enableAutoLoop}
        className={`px-3 py-1 rounded text-xs transition-all ${isAutoLoop
          ? 'bg-green-600 text-white'
          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        title="Auto-calculate loop points based on content"
      >
        AUTO
      </button>
    </div>
  );

  // =================== PLAYBACK REGION SELECTOR ===================

  const PlaybackRegionSelector = () => (
    <div className="flex items-center bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => setPlaybackRegion('full')}
        className={`px-2 py-1 rounded text-xs transition-all ${playbackRegion === 'full'
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        title="Play full content"
      >
        FULL
      </button>

      <button
        onClick={() => setPlaybackRegion('loop')}
        className={`px-2 py-1 rounded text-xs transition-all ${playbackRegion === 'loop'
          ? 'bg-yellow-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        title="Play loop range only"
      >
        LOOP
      </button>

      <button
        onClick={() => setPlaybackRegion('selection')}
        disabled={!timelineSelection}
        className={`px-2 py-1 rounded text-xs transition-all ${playbackRegion === 'selection'
          ? 'bg-purple-600 text-white'
          : timelineSelection
            ? 'text-gray-400 hover:text-white hover:bg-gray-700'
            : 'text-gray-600 cursor-not-allowed'
          }`}
        title="Play timeline selection"
      >
        SEL
      </button>
    </div>
  );

  // =================== BPM CONTROL ===================

  const BPMControl = () => {
    return (
      <div className="flex items-center space-x-2">
        <Clock size={16} className="text-gray-400" />
        <BPMInput
          value={bpm}
          onChange={handleBpmChange}
          showPresets={true}
          showTapTempo={true}
          showButtons={true}
          precision={1}
        />
      </div>
    );
  };

  // =================== PATTERN INFO ===================

  const PatternInfo = () => {
    if (playbackMode !== PLAYBACK_MODES.PATTERN) return null;

    const activePattern = patterns[activePatternId];
    if (!activePattern) return null;

    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-800 rounded-lg">
        <Music size={16} className="text-blue-400" />
        <span className="text-sm text-gray-300">{activePattern.name}</span>
      </div>
    );
  };

  // =================== TRANSPORT DISPLAY ===================

  const TransportDisplay = () => (
    <div className="flex items-center space-x-4 px-4 py-2 bg-gray-900 rounded-lg font-mono">
      <div className="text-lg font-bold text-green-400">
        {transportPosition}
      </div>
      <div className="flex items-center space-x-2 text-sm text-gray-400">
        <span>{playbackMode.toUpperCase()}</span>
        {loopEnabled && <Repeat size={12} className="text-yellow-400" />}
        {timelineSelection && <Target size={12} className="text-purple-400" />}
      </div>
    </div>
  );

  // =================== MAIN RENDER ===================

  return (
    <div className="flex items-center justify-between bg-gray-800 border-t border-gray-700 px-4 py-3">
      {/* Left Side - Transport Controls */}
      <div className="flex items-center space-x-4">
        <TransportButtons />
        <ModeSelector />
        <PatternInfo />
      </div>

      {/* Center - Transport Display */}
      <div className="flex-1 flex justify-center">
        <TransportDisplay />
      </div>

      {/* Right Side - Settings */}
      <div className="flex items-center space-x-4">
        <BPMControl />
        <LoopControls />
        <PlaybackRegionSelector />
      </div>
    </div>
  );
};

// =================== TIMELINE RULER COMPONENT ===================

export const TimelineRuler = ({
  lengthInSteps = 64,
  currentStep = 0,
  onStepClick,
  onSelectionChange,
  className = ""
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);

  const {
    loopStartStep,
    loopEndStep,
    timelineSelection,
    setTimelineSelection,
    jumpToStep
  } = usePlaybackStore();

  const stepsPerBar = 16;
  const totalBars = Math.ceil(lengthInSteps / stepsPerBar);

  const handleMouseDown = (step) => {
    setIsDragging(true);
    setDragStart(step);
    setDragEnd(step);
  };

  const handleMouseMove = (step) => {
    if (isDragging) {
      setDragEnd(step);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart !== null && dragEnd !== null) {
      const selectionStart = Math.min(dragStart, dragEnd);
      const selectionEnd = Math.max(dragStart, dragEnd);

      if (selectionStart !== selectionEnd) {
        setTimelineSelection(selectionStart, selectionEnd);
        onSelectionChange?.(selectionStart, selectionEnd);
      } else {
        jumpToStep(selectionStart);
        onStepClick?.(selectionStart);
      }
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => handleMouseUp();
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragStart, dragEnd]);

  return (
    <div className={`timeline-ruler ${className}`}>
      {/* Bar Numbers */}
      <div className="flex border-b border-gray-600 bg-gray-800">
        {Array.from({ length: totalBars }, (_, barIndex) => (
          <div
            key={barIndex}
            className="flex-1 min-w-16 px-2 py-1 text-xs text-gray-400 text-center border-r border-gray-700 last:border-r-0"
          >
            {barIndex + 1}
          </div>
        ))}
      </div>

      {/* Step Ruler */}
      <div className="flex bg-gray-900 relative h-8">
        {/* Loop Range Background */}
        <div
          className="absolute top-0 bottom-0 bg-yellow-500 bg-opacity-20 border-l-2 border-r-2 border-yellow-500"
          style={{
            left: `${(loopStartStep / lengthInSteps) * 100}%`,
            width: `${((loopEndStep - loopStartStep) / lengthInSteps) * 100}%`
          }}
        />

        {/* Timeline Selection Background */}
        {timelineSelection && (
          <div
            className="absolute top-0 bottom-0 bg-purple-500 bg-opacity-30 border-l-2 border-r-2 border-purple-500"
            style={{
              left: `${(timelineSelection.start / lengthInSteps) * 100}%`,
              width: `${((timelineSelection.end - timelineSelection.start) / lengthInSteps) * 100}%`
            }}
          />
        )}

        {/* Drag Selection */}
        {isDragging && dragStart !== null && dragEnd !== null && (
          <div
            className="absolute top-0 bottom-0 bg-blue-500 bg-opacity-40 border-l-2 border-r-2 border-blue-500"
            style={{
              left: `${(Math.min(dragStart, dragEnd) / lengthInSteps) * 100}%`,
              width: `${(Math.abs(dragEnd - dragStart) / lengthInSteps) * 100}%`
            }}
          />
        )}

        {/* Step Markers */}
        {Array.from({ length: lengthInSteps }, (_, stepIndex) => {
          const isBarStart = stepIndex % stepsPerBar === 0;
          const isBeatStart = stepIndex % 4 === 0;

          return (
            <div
              key={stepIndex}
              className={`flex-1 border-r border-gray-700 last:border-r-0 cursor-pointer hover:bg-gray-700 ${isBarStart ? 'border-r-gray-500' : ''
                }`}
              onMouseDown={() => handleMouseDown(stepIndex)}
              onMouseEnter={() => handleMouseMove(stepIndex)}
              title={`Step ${stepIndex + 1}`}
            >
              {/* Step marker */}
              <div className={`h-full flex items-end ${isBarStart ? 'justify-center' :
                isBeatStart ? 'justify-center' : 'justify-end'
                }`}>
                <div className={`${isBarStart ? 'w-0.5 h-6 bg-gray-400' :
                  isBeatStart ? 'w-0.5 h-4 bg-gray-500' :
                    'w-0.5 h-2 bg-gray-600'
                  }`} />
              </div>
            </div>
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-green-400 shadow-lg z-10 pointer-events-none"
          style={{
            left: `${(currentStep / lengthInSteps) * 100}%`
          }}
        />
      </div>
    </div>
  );
};

export default PlaybackControls;