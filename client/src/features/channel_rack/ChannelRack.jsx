import React, { useRef, useEffect, useCallback, useState, memo, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { usePanelsStore } from '@/store/usePanelsStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
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
import InstrumentPicker from './InstrumentPicker'; // ✅ NEW: Instrument selection UI
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

  // ✅ Display position for UnifiedTimeline
  const displayPosition = position;

  // ✅ Position tracking with actual position (not ghost)
  // ❌ REMOVED: Legacy ghost position state - now handled by UnifiedTimeline
  // ❌ REMOVED: channelRackPosition - no longer needed (compact playhead removed)
  // ❌ REMOVED: isJumping state - no longer needed (compact playhead removed)

  // Refs for UI element registration
  const patternDropdownRef = useRef(null);

  // State for pattern dropdown
  const [isPatternDropdownOpen, setIsPatternDropdownOpen] = useState(false);

  // State for audio export panel
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);

  // ✅ NEW: State for instrument picker
  const [isInstrumentPickerOpen, setIsInstrumentPickerOpen] = useState(false);

  // State for native drag-and-drop visual feedback
  const [isNativeDragOver, setIsNativeDragOver] = useState(false);

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

  // ⚡ DYNAMIC PATTERN LENGTH: Use pattern.length if defined, otherwise calculate
  const audioLoopLength = useMemo(() => {
    if (!activePattern) return 64;

    // ✅ Use explicit pattern length if defined
    if (activePattern.length && typeof activePattern.length === 'number') {
      return activePattern.length;
    }

    // Fallback: Calculate based on note data
    if (!activePattern.data) return 64;

    let maxNoteTime = 0;
    Object.values(activePattern.data).forEach(notes => {
      if (!Array.isArray(notes)) return;
      notes.forEach(note => {
        if (note.time > maxNoteTime) {
          maxNoteTime = note.time;
        }
      });
    });

    // Round up to next bar (16 steps)
    const minLength = 64; // Minimum 4 bars
    const roundedLength = Math.ceil((maxNoteTime + 1) / 16) * 16; // +1 to include last note

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

  // ✅ Native HTML5 drag-and-drop support for FileBrowser
  const handleNativeDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsNativeDragOver(true); // ✅ Show visual feedback
  }, []);

  const handleNativeDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsNativeDragOver(true);
  }, []);

  const handleNativeDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide if actually leaving the container (not just entering a child)
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget)) {
      setIsNativeDragOver(false);
    }
  }, []);

  const handleNativeDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsNativeDragOver(false); // ✅ Hide feedback after drop

    try {
      // Try to get data from native drag event (FileBrowser uses this)
      const data = e.dataTransfer.getData('text/plain');
      if (data) {
        const fileData = JSON.parse(data);
        console.log('🎵 Native drag sample dropped from FileBrowser:', fileData);

        // ✅ Load audio buffer before creating instrument
        const { AudioContextService } = await import('@/lib/services/AudioContextService');
        const audioContext = AudioContextService.getAudioEngine().audioContext;

        try {
          // Fetch and decode audio file
          const response = await fetch(fileData.url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          console.log('✅ Audio buffer loaded:', audioBuffer.duration, 'seconds');

          // Convert FileBrowser format to instrument format with buffer
          handleAddNewInstrument({
            name: fileData.name,
            url: fileData.url,
            audioBuffer: audioBuffer, // ✅ Include loaded audio buffer
            type: 'audio'
          });
        } catch (loadError) {
          console.error('Failed to load audio file:', loadError);
          alert(`Failed to load audio file: ${fileData.name}`);
        }
      }
    } catch (error) {
      console.error('Failed to handle native drop:', error);
    }
  }, [handleAddNewInstrument]);

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
      className={`channel-rack-layout no-select ${(isOver && canDrop) || isNativeDragOver ? 'channel-rack-layout--drop-active' : ''}`}
      onDragOver={handleNativeDragOver}
      onDragEnter={handleNativeDragEnter}
      onDragLeave={handleNativeDragLeave}
      onDrop={handleNativeDrop}
    >
      {/* Drop overlay - shows for both React DnD and native HTML5 drag */}
      {((isOver && canDrop) || isNativeDragOver) && (
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
          {/* ✅ NEW: Instrument Picker Button */}
          <div className="instrument-row instrument-row--add" onClick={() => setIsInstrumentPickerOpen(true)}>
            <Icon name="PlusCircle" size={20} />
            <span>Add Instrument...</span>
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
          {/* ❌ REMOVED: Compact playhead - UnifiedTimeline handles all playhead rendering */}
          {/* ❌ REMOVED: Legacy ghost playhead interaction area - UnifiedTimeline handles this now */}


        </div>
      </div>
      <div ref={scrollContainerRef} className="channel-rack-layout__grid-scroll-area" /* Legacy onClick removed - TimelineController handles this */>
        <div style={{ width: audioLoopLength * STEP_WIDTH, height: totalContentHeight }} className="channel-rack-layout__grid-content">
          {visibleInstruments.map((inst, index) => {
            // ✅ Check if notes have pitches other than C5
            const notes = activePattern?.data[inst.id] || [];
            const hasNonC5Notes = notes.some(note => note.pitch && note.pitch !== 'C5');
            const showPianoRoll = inst.pianoRoll || hasNonC5Notes;

            return (
            <div key={inst.id} className="channel-rack-layout__grid-row" onClick={handleGridRowClick}>
              {showPianoRoll ? (
                <PianoRollMiniView
                  notes={notes}
                  patternLength={audioLoopLength}
                  onNoteClick={() => openPianoRollForInstrument(inst)}
                />
              ) : (
                <StepGridCanvas
                  instrumentId={inst.id}
                  notes={notes}
                  totalSteps={audioLoopLength}
                  onNoteToggle={handleNoteToggle}
                />
              )}
            </div>
            );
          })}
          <div className="channel-rack-layout__grid-row" onClick={handleGridRowClick} />
        </div>
      </div>

      {/* Audio Export Panel */}
      <AudioExportPanel
        isOpen={isExportPanelOpen}
        onClose={() => setIsExportPanelOpen(false)}
      />

      {/* ✅ NEW: Instrument Picker */}
      {isInstrumentPickerOpen && (
        <InstrumentPicker
          onSelectInstrument={(instrumentData) => {
            handleAddNewInstrument(instrumentData);
            setIsInstrumentPickerOpen(false);
          }}
          onClose={() => setIsInstrumentPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ✅ Memoize the entire component to prevent unnecessary re-renders
export default memo(ChannelRack);