import React, { useState, memo, useCallback, useMemo } from 'react';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { usePanelsStore } from '@/store/usePanelsStore'; // Panelleri açmak için eklendi
import { useArrangementStore } from '@/store/useArrangementStore';
import ChannelContextMenu from '@/components/ChannelContextMenu';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { Music, Piano, Volume2, VolumeX, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { Knob } from '@/components/controls';
import commandManager from '@/lib/commands/CommandManager';
import { AddNoteCommand } from '@/lib/commands/AddNoteCommand';
import { FillPatternCommand } from '@/lib/commands/FillPatternCommand';
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

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [contextMenu, setContextMenu] = useState(null);

  if (!instrument || !mixerTrack) return null;

  // ✅ Memoize computed values
  const isMuted = useMemo(() => instrument.isMuted, [instrument.isMuted]);
  const isPianoRollSelected = useMemo(() =>
    usePanelsStore.getState().pianoRollInstrumentId === instrument.id,
    [instrument.id]
  );

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleRowClick = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
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
      (instrument.type === 'singleSample' ? true : false);
    updateInstrument(instrument.id, { cutItself: !currentValue });
  }, [instrument.id, instrument.cutItself, instrument.type, updateInstrument]);

  const handleFillPattern = useCallback((stepInterval, clearExisting = false) => {
    const activePatternId = useArrangementStore.getState().activePatternId;
    if (!activePatternId) return;

    const activePattern = useArrangementStore.getState().patterns[activePatternId];
    if (!activePattern) return;

    const patternLengthInSteps = calculatePatternLoopLength(activePattern) || 64;
    const currentNotes = activePattern.data[instrument.id] || [];
    let defaultVelocity = 100;

    if (currentNotes.length > 0 && currentNotes[0].velocity !== undefined) {
      const velocity = currentNotes[0].velocity;
      defaultVelocity = velocity <= 1.0 ? Math.round(velocity * 127) : Math.round(velocity);
    }

    const command = new FillPatternCommand(instrument.id, stepInterval, clearExisting);
    commandManager.execute(command);
  }, [instrument.id]);

  // ✅ Trigger Modal
  const handleDeleteRequest = useCallback(() => {
    setIsDeleteConfirmOpen(true);
    setContextMenu(null); // Close context menu if open
  }, []);

  // ✅ Confirm Action
  const handleConfirmDelete = useCallback(() => {
    removeInstrument(instrument.id);
    setIsDeleteConfirmOpen(false);
  }, [instrument.id, removeInstrument]);

  // ✅ Cancel Action
  const handleCancelDelete = useCallback(() => {
    setIsDeleteConfirmOpen(false);
  }, []);

  const getContextMenuOptions = useCallback(() => {
    const cutItselfActive = instrument.cutItself !== undefined ? instrument.cutItself :
      (instrument.type === 'singleSample' ? true : false);

    return [
      { label: 'Rename', action: handleRename },
      { label: 'Show in Mixer', action: openMixerAndFocus },
      { type: 'separator' },
      { label: 'Cut Itself', action: handleToggleCutItself, isActive: cutItselfActive },
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
      { label: 'Delete Instrument', action: handleDeleteRequest, danger: true },
    ];
  }, [handleRename, openMixerAndFocus, handleToggleCutItself, handleFillPattern, handleDeleteRequest, instrument.cutItself, instrument.type]);

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

  // ✅ REDESIGNED: Rich delete confirmation message
  const deleteMessage = useMemo(() => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Target Info Card */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        background: 'var(--zenith-bg-tertiary)',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid var(--zenith-border-light)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.8em', color: 'var(--zenith-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--zenith-text-primary)', fontWeight: '600' }}>
            <Music size={16} color="var(--zenith-accent-purple)" />
            <span>{instrument.name}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.8em', color: 'var(--zenith-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mixer Link</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--zenith-text-primary)' }}>
            <SlidersHorizontal size={16} color="var(--zenith-text-tertiary)" />
            <span>{mixerTrack?.name || 'Unrouted'}</span>
          </div>
        </div>
      </div>

      {/* Warning Alert */}
      <div style={{
        display: 'flex',
        gap: '12px',
        background: 'rgba(239, 68, 68, 0.1)', // Red transparent
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '8px',
        padding: '12px'
      }}>
        <AlertTriangle size={20} color="var(--zenith-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <strong style={{ color: 'var(--zenith-red)', fontSize: '0.95em' }}>Destructive Action</strong>
          <span style={{ fontSize: '0.9em', color: 'var(--zenith-text-secondary)', lineHeight: '1.4' }}>
            This will permanently delete the instrument, remove it from all active patterns, and unlink its mixer track.
          </span>
        </div>
      </div>

    </div>
  ), [instrument.name, mixerTrack?.name]);

  return (
    <>
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

      <ConfirmationModal
        isOpen={isDeleteConfirmOpen}
        title="Delete Instrument?"
        message={deleteMessage}
        confirmText="Delete Forever"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
};

// ✅ Memoize component to prevent unnecessary re-renders
export default memo(InstrumentRow);
