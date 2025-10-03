import React, { useRef, useEffect, useCallback, useState, memo, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { shallow } from 'zustand/shallow';
import { useMixerStore } from '../../store/useMixerStore';
import { useTransportPosition, useTransportTimeline, useTransportPlayhead } from '../../hooks/useTransportManager.js';
import commandManager from '../../lib/commands/CommandManager';
import { AddNoteCommand } from '../../lib/commands/AddNoteCommand';
import { DeleteNoteCommand } from '../../lib/commands/DeleteNoteCommand';
import { DND_TYPES } from '../../config/constants';
import { storeManager } from '../../store/StoreManager';

// ✅ PERFORMANCE: Throttle utility for scroll events
const throttle = (func, delay) => {
  let timeoutId;
  let lastExecTime = 0;
  return function (...args) {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};
import { Copy, X } from 'lucide-react';
import InstrumentRow from './InstrumentRow';
import StepGrid from './StepGrid';
import PianoRollMiniView from './PianoRollMiniView';
import InteractiveTimeline from './InteractiveTimeline';
// ✅ PERFORMANCE: Lazy-loaded icons to reduce initial bundle size
const Icon = memo(({ name, size = 20, ...props }) => {
  const [IconComponent, setIconComponent] = useState(null);

  useEffect(() => {
    import('lucide-react').then((icons) => {
      setIconComponent(() => icons[name]);
    });
  }, [name]);

  if (!IconComponent) {
    // Placeholder while loading
    return <div className="icon-placeholder" style={{ width: size, height: size }} />;
  }

  return <IconComponent size={size} {...props} />;
});

const STEP_WIDTH = 16;

// Precise step calculation to avoid floating point errors
const calculateStep = (clickX, stepWidth, maxStep) => {
  const exactStep = clickX / stepWidth;
  const roundedStep = Math.round(exactStep * 100) / 100; // Round to 2 decimal places first
  const finalStep = Math.round(roundedStep); // Then round to integer
  return Math.max(0, Math.min(maxStep, finalStep));
};


// ✅ PERFORMANCE: Cached selector functions to prevent infinite loops
const selectInstrumentsData = (state) => state;
const selectArrangementData = (state) => state;
const selectPanelsData = (state) => state;

function ChannelRack() {
  // ✅ PERFORMANCE: Batched store subscriptions with shallow equality
  const instrumentsData = useInstrumentsStore(selectInstrumentsData, shallow);

  const arrangementData = useArrangementStore(selectArrangementData, shallow);
  const panelsData = usePanelsStore(selectPanelsData, shallow);

  // ✅ PERFORMANCE: Destructure from full state objects
  const {
    instruments,
    channelOrder,
    channelGroups,
    selectedChannels,
    channelViewMode,
    initializeChannelOrder,
    reorderChannels,
    toggleChannelSelection,
    setChannelViewMode,
    handleAddNewInstrument
  } = instrumentsData;

  const {
    patterns,
    activePatternId,
    patternOrder,
    setActivePatternId,
    createPattern,
    duplicatePattern,
    deletePattern,
    renamePattern
  } = arrangementData;

  const {
    openPianoRollForInstrument,
    handleEditInstrument,
    togglePanel
  } = panelsData;

  // ✅ UNIFIED TRANSPORT SYSTEM
  const { position, displayPosition, playbackState, isPlaying } = useTransportPosition();
  const { jumpToPosition, setGhostPosition, clearGhostPosition } = useTransportTimeline(STEP_WIDTH, 64);
  const { ghostPosition, registerPlayheadElement } = useTransportPlayhead(STEP_WIDTH);

  // ✅ Position tracking with actual position (not ghost)

  // Refs for UI element registration
  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const patternDropdownRef = useRef(null);

  // Audio loop length hesaplama
  const audioLoopLength = 64; // TODO: Get from arrangement/pattern

  // State for smooth compact playhead animation
  const [isJumping, setIsJumping] = useState(false);

  // State for pattern dropdown
  const [isPatternDropdownOpen, setIsPatternDropdownOpen] = useState(false);

  // Refs
  const scrollContainerRef = useRef(null);
  const instrumentListRef = useRef(null);
  const timelineContainerRef = useRef(null);

  // ✅ Initialize StoreManager and channel order on mount
  useEffect(() => {
    // Register stores with StoreManager
    storeManager.registerStores({
      useInstrumentsStore,
      useArrangementStore,
      useMixerStore,
      usePanelsStore
    });

    initializeChannelOrder();

    // Initialize pattern instruments (backwards compatibility via StoreManager)
    storeManager.initializePatternInstruments();
  }, [initializeChannelOrder]);

  // ✅ FL Studio Style: Add button allows creating new instruments only
  // All existing channels are always visible, so no need for "available instruments" logic
  const canCreateNewInstrument = useMemo(() => {
    return true; // FL Studio always allows creating new instruments
  }, []);

  // ✅ Click outside to close pattern dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (patternDropdownRef.current && !patternDropdownRef.current.contains(event.target)) {
        setIsPatternDropdownOpen(false);
      }
    };

    if (isPatternDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isPatternDropdownOpen]);

  // ✅ Memoize expensive calculations
  const activePattern = useMemo(() => patterns[activePatternId], [patterns, activePatternId]);

  // ✅ PERFORMANCE: Pre-compute instruments lookup map - O(1) access
  const instrumentsMap = useMemo(() =>
    new Map(instruments.map(inst => [inst.id, inst])), [instruments]
  );

  // ✅ FL Studio Style: All channels are always visible
  const allChannels = useMemo(() => {
    return instruments; // All instruments/channels are always visible
  }, [instruments]);

  // ✅ FL Studio Style: Global channel order (not pattern-specific)
  const globalChannelOrder = useMemo(() => {
    return channelOrder.length > 0 ? channelOrder : instruments.map(inst => inst.id);
  }, [channelOrder, instruments]);

  // ✅ PERFORMANCE: Simplified to flat view only - O(n) optimized
  const organizedContent = useMemo(() => {
    // Always use flat mode with global channel order
    if (globalChannelOrder.length === 0) {
      return { type: 'instruments', data: allChannels };
    }

    const orderedChannels = globalChannelOrder.map(id =>
      instrumentsMap.get(id)
    ).filter(Boolean);

    return { type: 'instruments', data: orderedChannels };
  }, [instrumentsMap, globalChannelOrder, allChannels]);

  // High-performance playhead artık useOptimizedPlayhead hook'u tarafından yönetiliyor
  // GPU acceleration ve direct DOM manipulation ile smooth hareket

  // ✅ PERFORMANCE: Throttled scroll handlers for 60fps (16ms)
  const handleMainScroll = useCallback(
    throttle(() => {
      const mainGrid = scrollContainerRef.current;
      const instrumentsList = instrumentListRef.current;
      const timeline = timelineContainerRef.current;

      if (!mainGrid || !instrumentsList || !timeline) return;

      // Sync instruments vertically and timeline horizontally
      instrumentsList.scrollTop = mainGrid.scrollTop;
      timeline.scrollLeft = mainGrid.scrollLeft;
    }, 16), // 60fps throttling
    []
  );

  const handleInstrumentsScroll = useCallback(
    throttle(() => {
      const mainGrid = scrollContainerRef.current;
      const instrumentsList = instrumentListRef.current;

      if (!mainGrid || !instrumentsList) return;

      // Sync main grid vertically
      mainGrid.scrollTop = instrumentsList.scrollTop;
    }, 16), // 60fps throttling
    []
  );

  // Custom scroll synchronization for Channel Rack
  useEffect(() => {
    const mainGrid = scrollContainerRef.current;
    const instrumentsList = instrumentListRef.current;

    if (!mainGrid || !instrumentsList) return;

    mainGrid.addEventListener('scroll', handleMainScroll, { passive: true });
    instrumentsList.addEventListener('scroll', handleInstrumentsScroll, { passive: true });

    // ✅ SCROLL FIX: Wheel event delegation from instruments panel to main grid
    const handleWheelDelegation = (e) => {
      e.preventDefault();
      // Forward wheel event to main grid for synchronized scrolling
      mainGrid.scrollBy({
        top: e.deltaY,
        left: e.deltaX,
        behavior: 'auto'
      });
    };

    instrumentsList.addEventListener('wheel', handleWheelDelegation, { passive: false });

    return () => {
      mainGrid.removeEventListener('scroll', handleMainScroll);
      instrumentsList.removeEventListener('scroll', handleInstrumentsScroll);
      instrumentsList.removeEventListener('wheel', handleWheelDelegation);
    };
  }, [handleMainScroll, handleInstrumentsScroll]);

  const handleNoteToggle = useCallback((instrumentId, step) => {
    try {
      if (!activePattern) return;
      const currentNotes = activePattern.data[instrumentId] || [];
      const existingNote = currentNotes.find(note => note.time === step);

      if (existingNote) {
        commandManager.execute(new DeleteNoteCommand(instrumentId, existingNote));
      } else {
        commandManager.execute(new AddNoteCommand(instrumentId, step));
      }
    } catch (error) {
      console.error('Error toggling note:', error);
    }
  }, [activePatternId, activePattern]);

  // ✅ Get all visible instruments for grid rendering (simplified for flat view)
  const visibleInstruments = useMemo(() => {
    return organizedContent.data;
  }, [organizedContent]);

  // ✅ Calculate content height for flat view
  const totalContentHeight = useMemo(() => {
    return Math.max(64, (organizedContent.data.length + 1) * 64); // +1 for add button
  }, [organizedContent]);

  // ✅ UNIFIED: Timeline interaction via TransportManager
  const handleTimelineClickInternal = useCallback((e) => {
    // ✅ OPTIMIZED - Allow position changes in all states (fire-and-forget)

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const exactStep = clickX / STEP_WIDTH;
    const targetStep = calculateStep(clickX, STEP_WIDTH, audioLoopLength - 1);

    console.log(`🎯 Timeline click precision:`, {
      clickX,
      exactStep,
      targetStep,
      stepWidth: STEP_WIDTH,
      roundingDiff: exactStep - targetStep,
      preciseCalculation: true
    });

    // ✅ OPTIMIZED - Fire-and-forget for 0ms UI latency
    jumpToPosition(targetStep); // No await needed
  }, [jumpToPosition, audioLoopLength, playbackState]);

  // ✅ Prevent timeline click on grid rows (only allow on empty areas)
  const handleGridRowClick = useCallback((e) => {
    e.stopPropagation(); // Prevent timeline click when clicking on grid rows
  }, []);

  // ✅ Drop zone for new samples/instruments
  const [{ isOver, canDrop }, dropRef] = useDrop({
    accept: DND_TYPES.SOUND_SOURCE,
    drop: (item) => {
      console.log('🎵 Sample dropped:', item);
      handleAddNewInstrument(item);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    })
  });

  // ✅ Pattern management handlers
  const handlePatternChange = useCallback((patternId) => {
    setActivePatternId(patternId);
    setIsPatternDropdownOpen(false);
  }, [setActivePatternId]);

  const handleCreatePattern = useCallback(() => {
    const newPatternId = createPattern();
    setActivePatternId(newPatternId);
    setIsPatternDropdownOpen(false);
  }, [createPattern, setActivePatternId]);

  const handleDuplicatePattern = useCallback(() => {
    const newPatternId = duplicatePattern(activePatternId);
    if (newPatternId) {
      setActivePatternId(newPatternId);
    }
    setIsPatternDropdownOpen(false);
  }, [duplicatePattern, activePatternId, setActivePatternId]);

  const handleDeletePattern = useCallback(() => {
    if (patternOrder.length > 1) {
      deletePattern(activePatternId);
    }
    setIsPatternDropdownOpen(false);
  }, [deletePattern, activePatternId, patternOrder.length]);

  const handleRenamePattern = useCallback(() => {
    const currentPattern = patterns[activePatternId];
    const newName = prompt('Enter new pattern name:', currentPattern?.name || '');
    if (newName && newName.trim()) {
      renamePattern(activePatternId, newName.trim());
    }
    setIsPatternDropdownOpen(false);
  }, [renamePattern, activePatternId, patterns]);



  return (
    <div
      ref={dropRef}
      className={`channel-rack-layout no-select ${isOver && canDrop ? 'channel-rack-layout--drop-active' : ''}`}
    >
      {/* Drop overlay */}
      {isOver && canDrop && (
        <div className="channel-rack-layout__drop-overlay">
          <div className="channel-rack-layout__drop-indicator">
            <Icon name="Upload" size={48} />
            <h3>Drop sample to create new instrument</h3>
            <p>Sample will be added as a new channel</p>
          </div>
        </div>
      )}

      <div className="channel-rack-layout__corner">
        <div className="channel-rack-layout__corner-left">
          <div className="channel-rack-layout__pattern-selector" ref={patternDropdownRef}>
            <button
              className="channel-rack-layout__pattern-button"
              onClick={() => setIsPatternDropdownOpen(!isPatternDropdownOpen)}
            >
              <span>{activePattern?.name || '...'}</span>
              <Icon name="ChevronDown" size={14} />
            </button>

            {isPatternDropdownOpen && (
              <div className="channel-rack-layout__pattern-dropdown">
                <div className="channel-rack-layout__pattern-list">
                  {patternOrder.map((patternId) => (
                    <button
                      key={patternId}
                      className={`channel-rack-layout__pattern-item ${
                        patternId === activePatternId ? 'channel-rack-layout__pattern-item--active' : ''
                      }`}
                      onClick={() => handlePatternChange(patternId)}
                    >
                      {patterns[patternId]?.name || patternId}
                    </button>
                  ))}
                </div>
                <div className="channel-rack-layout__pattern-actions">
                  <button
                    className="channel-rack-layout__pattern-action"
                    onClick={handleCreatePattern}
                    title="Create New Pattern"
                  >
                    <Icon name="Plus" size={14} />
                    New
                  </button>
                  <button
                    className="channel-rack-layout__pattern-action"
                    onClick={handleDuplicatePattern}
                    title="Duplicate Pattern"
                  >
                    <Copy size={14} />
                    Duplicate
                  </button>
                  <button
                    className="channel-rack-layout__pattern-action"
                    onClick={handleRenamePattern}
                    title="Rename Pattern"
                  >
                    Rename
                  </button>
                  {patternOrder.length > 1 && (
                    <button
                      className="channel-rack-layout__pattern-action channel-rack-layout__pattern-action--danger"
                      onClick={handleDeletePattern}
                      title="Delete Pattern"
                    >
                      <X size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="channel-rack-layout__corner-right">
          <div className="channel-rack-layout__pattern-management">
            <button
              className="channel-rack-layout__mgmt-btn"
              onClick={handleCreatePattern}
              title="New Pattern"
            >
              <Icon name="Plus" size={14} />
            </button>
            <button
              className="channel-rack-layout__mgmt-btn"
              onClick={handleDuplicatePattern}
              title="Duplicate Pattern"
            >
              <Icon name="Copy" size={14} />
            </button>
            <button
              className="channel-rack-layout__mgmt-btn"
              onClick={handleRenamePattern}
              title="Rename Pattern"
            >
              <Icon name="Edit3" size={14} />
            </button>
          </div>
        </div>
      </div>
      <div ref={instrumentListRef} className="channel-rack-layout__instruments">
        <div style={{ height: totalContentHeight }}>
          {/* Flat view (instruments only) */}
          {organizedContent.data.map((inst, index) => (
            <InstrumentRow
              key={inst.id}
              instrument={inst}
              index={index}
              isSelected={selectedChannels.includes(inst.id)}
              onPianoRollClick={() => openPianoRollForInstrument(inst)}
              onEditClick={() => handleEditInstrument(inst)}
              onToggleSelection={() => toggleChannelSelection(inst.id)}
            />
          ))}
          {/* FL Studio Style: Simple Add Channel Button */}
          <div className="instrument-row instrument-row--add" onClick={() => togglePanel('file-browser')}>
            <Icon name="PlusCircle" size={20} />
            <span>Add Channel...</span>
          </div>
        </div>
      </div>
      <div ref={timelineContainerRef} className="channel-rack-layout__timeline">
        <div style={{ width: audioLoopLength * STEP_WIDTH, height: '100%' }}>
          <InteractiveTimeline
            loopLength={audioLoopLength}
            currentPosition={displayPosition}
            onJumpToPosition={jumpToPosition}
          />
          {/* FL Studio style compact playhead with click interaction */}
          <div
            className={`channel-rack-layout__compact-playhead ${
              isPlaying ? 'channel-rack-layout__compact-playhead--playing' : ''
            } ${
              isJumping ? 'channel-rack-layout__compact-playhead--jumping' : ''
            } ${
              playbackState === 'stopped' ? 'channel-rack-layout__compact-playhead--stopped' : ''
            }`}
            style={{
              transform: `translateX(${position * STEP_WIDTH}px)`,
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: '#00ff88',
              zIndex: 100,
              pointerEvents: 'none',
              boxShadow: '0 0 8px rgba(0, 255, 136, 0.6)',
              transition: 'transform 50ms linear',
              willChange: 'transform'
            }}
          >
            {/* Compact playhead indicator arrow */}
            <div
              style={{
                position: 'absolute',
                top: '-2px',
                left: '-3px',
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: '6px solid #00ff88',
                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))'
              }}
            />
          </div>
          {/* Interactive timeline area - FL Studio style */}
          <div
            className="channel-rack-layout__timeline-click-area"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${audioLoopLength * STEP_WIDTH}px`,
              bottom: 0,
              zIndex: 99,
              cursor: 'crosshair' // Always allow timeline interaction
            }}
            onClick={handleTimelineClickInternal}
            onMouseMove={(e) => {
              // ✅ OPTIMIZED - Always show ghost position for better UX
              const rect = e.currentTarget.getBoundingClientRect();
              const hoverX = e.clientX - rect.left;
              const hoverStep = calculateStep(hoverX, STEP_WIDTH, audioLoopLength - 1);
              setGhostPosition(hoverStep);
            }}
            onMouseLeave={() => {
              clearGhostPosition();
            }}
          />

          {/* Ghost playhead on hover - Always visible for better UX */}
          {ghostPosition !== null && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${ghostPosition * STEP_WIDTH}px`,
                width: '1px',
                backgroundColor: 'rgba(0, 255, 136, 0.4)',
                zIndex: 97,
                pointerEvents: 'none',
                transition: 'left 0.1s ease'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-2px',
                  left: '-3px',
                  width: 0,
                  height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '6px solid rgba(0, 255, 136, 0.4)',
                  filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))'
                }}
              />
            </div>
          )}


        </div>
      </div>
      <div ref={scrollContainerRef} className="channel-rack-layout__grid-scroll-area" onClick={handleTimelineClickInternal}>
        <div style={{ width: audioLoopLength * STEP_WIDTH, height: totalContentHeight }} className="channel-rack-layout__grid-content">
          {visibleInstruments.map((inst, index) => (
            <div key={inst.id} className="channel-rack-layout__grid-row" onClick={handleGridRowClick}>
              {inst.pianoRoll ? (
                <PianoRollMiniView
                  notes={activePattern?.data[inst.id] || []}
                  patternLength={audioLoopLength}
                  onNoteClick={() => openPianoRollForInstrument(inst)}
                />
              ) : (
                <StepGrid
                  instrumentId={inst.id}
                  notes={activePattern?.data[inst.id] || []}
                  totalSteps={audioLoopLength}
                  onNoteToggle={handleNoteToggle}
                />
              )}
            </div>
          ))}
          <div className="channel-rack-layout__grid-row" onClick={handleGridRowClick} />
        </div>
      </div>
    </div>
  );
}

// ✅ Memoize the entire component to prevent unnecessary re-renders
export default memo(ChannelRack);