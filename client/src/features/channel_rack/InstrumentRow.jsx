import React, { useState, memo, useCallback, useMemo } from 'react';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { usePanelsStore } from '@/store/usePanelsStore'; // Panelleri açmak için eklendi
import ChannelContextMenu from '@/components/ChannelContextMenu';
import { Music, Piano, Volume2, VolumeX, SlidersHorizontal } from 'lucide-react';
import { Knob } from '@/components/controls';

// ✅ Direct property selectors - no object creation
const selectUpdateInstrument = (state) => state.updateInstrument;
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
  onToggleSelection
}) => {
  // ✅ Direct selectors - no object creation in selectors
  const updateInstrument = useInstrumentsStore(selectUpdateInstrument);
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

  const getContextMenuOptions = useCallback(() => [
    { label: 'Rename', action: handleRename },
    { label: 'Show in Mixer', action: openMixerAndFocus },
    // ... diğer context menu seçenekleri ...
  ], [handleRename, openMixerAndFocus]);

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
    ({ '--instrument-color': mixerTrack.color || 'var(--color-surface-3)' }),
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
