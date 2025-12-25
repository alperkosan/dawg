import React, { useState, memo, useCallback, useMemo } from 'react';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { usePanelsStore } from '@/store/usePanelsStore'; // Panelleri açmak için eklendi
import { useArrangementStore } from '@/store/useArrangementStore';
import ChannelContextMenu from '@/components/ChannelContextMenu';
import { Music, Piano, Volume2, VolumeX, SlidersHorizontal } from 'lucide-react';
import { Knob } from '@/components/controls';
import commandManager from '@/lib/commands/CommandManager';
import { AddNoteCommand } from '@/lib/commands/AddNoteCommand';
import { DeleteNoteCommand } from '@/lib/commands/DeleteNoteCommand';
import { calculatePatternLoopLength } from '@/lib/utils/patternUtils.js';

// ✅ Direct property selectors - no object creation
const selectUpdateInstrument = (state) => state.updateInstrument;
const selectRemoveInstrument = (state) => state.removeInstrument;
const selectSetTrackName = (state) => state.setTrackName;
const selectHandleMixerParamChange = (state) => state.handleMixerParamChange;
const selectSetActiveChannelId = (state) => state.setActiveChannelId;
const selectTogglePanel = (state) => state.togglePanel;

const InstrumentRow = ({
  instrument,
  index = 0,
  isSelected = false,
  onPianoRollClick,
  onEditClick,
  onToggleSelection,
  patternNotes = [] // ⚡ NEW: Pattern notes for mini sequencer preview
}) => {
  // ✅ Direct selectors - no object creation in selectors
  const updateInstrument = useInstrumentsStore(selectUpdateInstrument);
  const removeInstrument = useInstrumentsStore(selectRemoveInstrument);
  const setTrackName = useMixerStore(selectSetTrackName);
  const handleMixerParamChange = useMixerStore(selectHandleMixerParamChange);
  const setActiveChannelId = useMixerStore(selectSetActiveChannelId);
  const togglePanel = usePanelsStore(selectTogglePanel);

  // ✅ Memoize expensive mixerTrack lookup with stable selector
  const mixerTrack = useMixerStore(
    useMemo(() =>
      (state) => state.mixerTracks.find(t => t.id === instrument.mixerTrackId)
      , [instrument.mixerTrackId])
  );

  const [contextMenu, setContextMenu] = useState(null);

  if (!instrument || !mixerTrack) return null;

  // ✅ Memoize computed values
  const isMuted = useMemo(() => instrument.isMuted, [instrument.isMuted]);
  const isPianoRollSelected = useMemo(() =>
    usePanelsStore.getState().pianoRollInstrumentId === instrument.id,
    [instrument.id]
  );

  // ✅ Memoized event handlers
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleRowClick = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      // Multi-select with Ctrl/Cmd
      e.preventDefault();
      onToggleSelection?.();
    }
  }, [onToggleSelection]);

  const openMixerAndFocus = useCallback((e) => {
    e.stopPropagation();
    setActiveChannelId(mixerTrack.id);
    togglePanel('mixer');
  }, [mixerTrack.id, setActiveChannelId, togglePanel]);

  const handleRename = useCallback(() => {
    const newName = prompt('Enter new name:', instrument.name);
    if (newName && newName.trim()) {
      const trimmedName = newName.trim();
      updateInstrument(instrument.id, { name: trimmedName });
      setTrackName(mixerTrack.id, trimmedName);
    }
  }, [instrument.name, instrument.id, mixerTrack.id, updateInstrument, setTrackName]);

  const handleToggleCutItself = useCallback(() => {
    const currentValue = instrument.cutItself !== undefined ? instrument.cutItself :
      (instrument.type === 'singleSample' ? true : false); // Default: true for drums, false for melodic
    updateInstrument(instrument.id, { cutItself: !currentValue });
  }, [instrument.id, instrument.cutItself, instrument.type, updateInstrument]);

  // ✅ FL STUDIO STYLE: Fill pattern with notes at specified intervals
  const handleFillPattern = useCallback((stepInterval, clearExisting = false) => {
    const activePatternId = useArrangementStore.getState().activePatternId;
    if (!activePatternId) return;

    const activePattern = useArrangementStore.getState().patterns[activePatternId];
    if (!activePattern) return;

    const patternLengthInSteps = calculatePatternLoopLength(activePattern) || 64;

    // Get existing notes to determine pitch and velocity
    const currentNotes = activePattern.data[instrument.id] || [];
    const defaultPitch = currentNotes.length > 0 ? currentNotes[0].pitch : 'C4';

    // ✅ FIX: Normalize velocity to 0-127 MIDI range
    let defaultVelocity = 100; // Default MIDI velocity
    if (currentNotes.length > 0 && currentNotes[0].velocity !== undefined) {
      const velocity = currentNotes[0].velocity;
      if (velocity <= 1.0) {
        // 0-1 normalized format, convert to 0-127
        defaultVelocity = Math.round(velocity * 127);
      } else {
        // Already in 0-127 format
        defaultVelocity = Math.round(velocity);
      }
    }

    // Clear existing notes if requested
    if (clearExisting && currentNotes.length > 0) {
      // Delete all existing notes first
      currentNotes.forEach(note => {
        const command = new DeleteNoteCommand(instrument.id, note);
        commandManager.execute(command);
      });
    }

    // Add notes at specified intervals
    const notesToAdd = [];
    for (let step = 0; step < patternLengthInSteps; step += stepInterval) {
      // Check if note already exists at this step (only if not clearing)
      if (!clearExisting && currentNotes.some(n => n.time === step)) {
        continue; // Skip existing notes
      }
      notesToAdd.push({ step, pitch: defaultPitch, velocity: defaultVelocity });
    }

    // Execute all add commands with fixed length (fill pattern behavior)
    // ✅ FIX: Use fixed length for fill pattern - all notes should have the same length
    notesToAdd.forEach(({ step }) => {
      const command = new AddNoteCommand(instrument.id, step, stepInterval);
      commandManager.execute(command);
    });

    console.log(`✅ Filled pattern with notes every ${stepInterval} steps:`, {
      patternLengthInSteps,
      notesAdded: notesToAdd.length,
      stepInterval,
      clearExisting
    });
  }, [instrument.id]);

  const handleDelete = useCallback(() => {
    const confirmDelete = window.confirm(
      `🗑️ Delete Instrument?\n\n` +
      `Instrument: "${instrument.name}"\n` +
      `Mixer Track: ${mixerTrack?.name || 'Unknown'}\n\n` +
      `⚠️ This will permanently remove:\n` +
      `• The instrument from all patterns\n` +
      `• All notes and automation\n` +
      `• Associated mixer track\n\n` +
      `This action cannot be undone.`
    );
    if (confirmDelete) {
      removeInstrument(instrument.id);
    }
  }, [instrument.id, instrument.name, mixerTrack?.name, removeInstrument]);

  const getContextMenuOptions = useCallback(() => {
    // Determine current cutItself state
    const cutItselfActive = instrument.cutItself !== undefined ? instrument.cutItself :
      (instrument.type === 'singleSample' ? true : false);

    return [
      { label: 'Rename', action: handleRename },
      { label: 'Show in Mixer', action: openMixerAndFocus },
      { type: 'separator' },
      {
        label: 'Cut Itself',
        action: handleToggleCutItself,
        isActive: cutItselfActive
      },
      { type: 'separator' },
      {
        label: 'Fill Pattern',
        children: [
          { label: 'Fill each 2 steps', action: () => handleFillPattern(2) },
          { label: 'Fill each 4 steps', action: () => handleFillPattern(4) },
          { label: 'Fill each 8 steps', action: () => handleFillPattern(8) },
          { label: 'Fill each 16 steps', action: () => handleFillPattern(16) },
        ]
      },
      { type: 'separator' },
      { label: 'Delete Instrument', action: handleDelete, danger: true },
    ];
  }, [handleRename, openMixerAndFocus, handleToggleCutItself, handleFillPattern, instrument.cutItself, instrument.type]);

  // ✅ Memoized computed classes and styles
  const rowClasses = useMemo(() => `
    instrument-row
    ${isMuted ? 'instrument-row--muted' : ''}
    ${isPianoRollSelected ? 'instrument-row--selected' : ''}
    ${isSelected ? 'instrument-row--channel-selected' : ''}
  `, [isMuted, isPianoRollSelected, isSelected]);

  const muteButtonClasses = useMemo(() =>
    `instrument-row__action-btn ${isMuted ? 'instrument-row__action-btn--active' : ''}`,
    [isMuted]
  );

  const pianoButtonClasses = useMemo(() =>
    `instrument-row__action-btn ${instrument.pianoRoll ? 'instrument-row__action-btn--active' : ''}`,
    [instrument.pianoRoll]
  );

  const iconStyle = useMemo(() =>
    ({ '--instrument-color': mixerTrack.color || 'var(--zenith-bg-tertiary)' }),
    [mixerTrack.color]
  );


  return (
    <div className={rowClasses} onContextMenu={handleContextMenu} onClick={handleRowClick}>
      <div className="instrument-row__info" onClick={onEditClick} title="Open Sample/Synth Editor">
        <div className="instrument-row__icon" style={iconStyle}>
          <Music size={18} />
        </div>
        <div className="instrument-row__details">
          <span className="instrument-row__name">{instrument.name}</span>
          <span className="instrument-row__target">
            → Track {mixerTrack.id.split('-')[1]}
          </span>
        </div>
      </div>

      <div className="instrument-row__controls">
        <div className="instrument-row__control-item">
          <Knob
            size={24}
            value={mixerTrack.pan}
            onChange={(val) => handleMixerParamChange(mixerTrack.id, 'pan', val)}
            min={-1}
            max={1}
            defaultValue={0}
            precision={2}
            showValue={false}
            aria-label="Pan"
          />
          <span className="instrument-row__control-label">P</span>
        </div>
        <div className="instrument-row__control-item">
          <Knob
            size={24}
            value={mixerTrack.volume}
            onChange={(val) => handleMixerParamChange(mixerTrack.id, 'volume', val)}
            min={-60}
            max={6}
            defaultValue={0}
            precision={1}
            showValue={false}
            aria-label="Volume"
          />
          <span className="instrument-row__control-label">V</span>
        </div>
      </div>

      <div className="instrument-row__actions">
        <button
          className={muteButtonClasses}
          onClick={(e) => {
            e.stopPropagation();
            useInstrumentsStore.getState().handleToggleInstrumentMute(instrument.id);
          }}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button
          className={pianoButtonClasses}
          onClick={onPianoRollClick}
          title="Open Piano Roll"
        >
          <Piano size={16} />
        </button>
        <button
          className="instrument-row__action-btn"
          onClick={openMixerAndFocus}
          title="Show in Mixer"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {contextMenu && (
        <ChannelContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          options={getContextMenuOptions()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

// ✅ Memoize component to prevent unnecessary re-renders
export default memo(InstrumentRow);
