import React, { useRef, useEffect, useCallback, useState, memo, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePanelsStore } from '@/store/usePanelsStore';
import { usePlaybackStore } from '@/store/usePlaybackStoreV2';
import { shallow } from 'zustand/shallow';
import { useMixerStore } from '@/store/useMixerStore';
import commandManager from '@/lib/commands/CommandManager';
import { AddNoteCommand } from '@/lib/commands/AddNoteCommand';
import { DeleteNoteCommand } from '@/lib/commands/DeleteNoteCommand';
import { DND_TYPES } from '@/config/constants';
import { storeManager } from '@/store/StoreManager';
import { createMultiScrollSync, createWheelForwarder } from '@/lib/utils/scrollSync';

// ✅ PERFORMANCE: Local throttle utility removed - now using optimized scroll utilities
import { Copy, X, Download } from 'lucide-react';
import InstrumentRow from './InstrumentRow';
import StepGrid from './StepGrid';
import StepGridCanvas from './StepGridCanvas'; // ⚡ NEW: Canvas-based grid
import PianoRollMiniView from './PianoRollMiniView';
import PianoRollMiniViewC4 from './PianoRollMiniViewC4'; // ⚡ NEW: C4-level preview
import UnifiedTimeline from './UnifiedTimeline'; // ✅ NEW: Unified timeline system
// import InteractiveTimeline from './InteractiveTimeline'; // ⚠️ DEPRECATED - kept for reference
import AudioExportPanel from '@/components/AudioExportPanel';
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

  // ✅ UNIFIED STATE from PlaybackStore - Single source of truth
  const playbackMode = usePlaybackStore(state => state.playbackMode);
  const playbackState = usePlaybackStore(state => state.playbackState);
  const isPlaying = usePlaybackStore(state => state.isPlaying);
  const position = usePlaybackStore(state => playbackMode === 'pattern' ? state.currentStep : 0);
  const setTransportPosition = usePlaybackStore(state => state.setTransportPosition);

  // ✅ Conditional position - only track in pattern mode
  const channelRackPosition = playbackMode === 'pattern' ? position : 0;
  const displayPosition = position;

  // Ghost position state (local to channel rack)
  const [ghostPosition, setGhostPosition] = useState(null);
  const clearGhostPosition = () => setGhostPosition(null);

  // ✅ Position tracking with actual position (not ghost)

  // Refs for UI element registration
  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const patternDropdownRef = useRef(null);

  // State for smooth compact playhead animation
  const [isJumping, setIsJumping] = useState(false);

  // State for pattern dropdown
  const [isPatternDropdownOpen, setIsPatternDropdownOpen] = useState(false);

  // State for audio export panel
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);

  // Refs
  const scrollContainerRef = useRef(null);
  const instrumentListRef = useRef(null);
  const timelineContainerRef = useRef(null);

  // ✅ Initialize StoreManager and channel order on mount
  useEffect(() => {
    // ✅ PERFORMANCE: Register all stores with StoreManager including playback
    storeManager.registerStores({
      useInstrumentsStore,
      useArrangementStore,
      useMixerStore,
      usePanelsStore,
      usePlaybackStore
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

  // ⚡ DYNAMIC PATTERN LENGTH: Calculate based on actual note data
  const audioLoopLength = useMemo(() => {
    if (!activePattern || !activePattern.data) return 64;

    // Find maximum note position across all instruments in this pattern
    let maxNoteTime = 0;
    Object.values(activePattern.data).forEach(notes => {
      if (!Array.isArray(notes)) return;
      notes.forEach(note => {
        if (note.time > maxNoteTime) {
          maxNoteTime = note.time;
        }
      });
    });

    // Round up to next bar (16 steps) + 2 empty bars for editing space
    const minLength = 64; // Minimum 4 bars
    const paddedLength = maxNoteTime + 32; // Add 2 bars padding
    const roundedLength = Math.ceil(paddedLength / 16) * 16; // Round to bar

    return Math.max(minLength, roundedLength);
  }, [activePattern]);

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

  // ✅ PERFORMANCE OPTIMIZED: High-performance scroll synchronization using optimized utilities
  useEffect(() => {
    const mainGrid = scrollContainerRef.current;
    const instrumentsList = instrumentListRef.current;
    const timeline = timelineContainerRef.current;

    if (!mainGrid || !instrumentsList || !timeline) return;

    console.log('🔄 ChannelRack: Setting up optimized scroll synchronization');

    // ✅ PERFORMANCE: Use optimized multi-target scroll sync
    const scrollSyncCleanup = createMultiScrollSync(
      { current: mainGrid },
      [
        // High priority: Timeline (critical for user feedback)
        { ref: { current: timeline }, axis: 'x', priority: 'high', method: 'scroll' },
        // Normal priority: Instruments list (less critical)
        { ref: { current: instrumentsList }, axis: 'y', priority: 'normal', method: 'scroll' }
      ],
      {
        throttleMs: 8, // ~120fps for ultra-smooth sync
        debugMode: false // Set to true for performance debugging
      }
    );

    // ✅ PERFORMANCE: Use optimized wheel forwarder with momentum
    const wheelForwarderCleanup = createWheelForwarder(
      { current: instrumentsList },
      { current: mainGrid },
      'both', // Allow both x and y wheel forwarding
      {
        throttleMs: 8,
        enableMomentum: true,
        momentumDecay: 0.92, // Slightly more responsive
        maxDelta: 120, // Prevent excessive jumps
        debugMode: false
      }
    );

    console.log('🔄 ChannelRack: Optimized scroll sync initialized');

    return () => {
      scrollSyncCleanup();
      wheelForwarderCleanup();
      console.log('🔄 ChannelRack: Optimized scroll sync cleaned up');
    };
  }, []); // Empty deps - setup once

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

  // ⚠️ DEPRECATED: This handler is now replaced by TimelineController
  // Kept for fallback if TimelineController is not available
  const handleTimelineClickInternal = useCallback((e) => {
    console.warn('⚠️ Using legacy timeline click handler - TimelineController should handle this');

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetStep = calculateStep(clickX, STEP_WIDTH, audioLoopLength - 1);

    // Fallback to legacy behavior
    const beatPosition = targetStep / 4;
    const bar = Math.floor(beatPosition / 4);
    const beat = Math.floor(beatPosition % 4);
    const tick = Math.floor((beatPosition % 1) * 480);
    const transportPos = `${bar + 1}:${beat + 1}:${tick}`;

    setTransportPosition(transportPos, targetStep);
  }, [setTransportPosition, audioLoopLength]);

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
            <button
              className="channel-rack-layout__mgmt-btn channel-rack-layout__mgmt-btn--export"
              onClick={() => setIsExportPanelOpen(true)}
              title="Export Audio"
            >
              <Download size={14} />
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
              patternNotes={activePattern?.data[inst.id] || []}
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
          <UnifiedTimeline
            loopLength={audioLoopLength}
            currentPosition={displayPosition}
            onPositionChange={null} // ✅ TimelineController handles store updates now
          />
          {/* FL Studio style compact playhead - only in pattern mode */}
          {playbackMode === 'pattern' && (
            <div
              className={`channel-rack-layout__compact-playhead ${
                isPlaying ? 'channel-rack-layout__compact-playhead--playing' : ''
              } ${
                isJumping ? 'channel-rack-layout__compact-playhead--jumping' : ''
              } ${
                playbackState === 'stopped' ? 'channel-rack-layout__compact-playhead--stopped' : ''
              }`}
              style={{
                transform: `translateX(${channelRackPosition * STEP_WIDTH}px)`,
                // ⚡ Animation controlled by TimelineController (smooth during playback, instant during seek)
                transition: isJumping ? 'none' : 'transform 0.1s linear',
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
          )}
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
              cursor: 'crosshair', // Always allow timeline interaction
              pointerEvents: 'none' // ✅ Let clicks pass through to UnifiedTimeline
            }}
            // onClick={handleTimelineClickInternal} // ⚠️ REMOVED - TimelineController handles this
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
      <div ref={scrollContainerRef} className="channel-rack-layout__grid-scroll-area" /* Legacy onClick removed - TimelineController handles this */>
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
                <StepGridCanvas
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

      {/* Audio Export Panel */}
      <AudioExportPanel
        isOpen={isExportPanelOpen}
        onClose={() => setIsExportPanelOpen(false)}
      />
    </div>
  );
}

// ✅ Memoize the entire component to prevent unnecessary re-renders
export default memo(ChannelRack);