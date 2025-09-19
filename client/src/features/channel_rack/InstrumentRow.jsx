import React, { useState } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { usePanelsStore } from '../../store/usePanelsStore'; // Panelleri açmak için eklendi
import ChannelContextMenu from '../../components/ChannelContextMenu';
import { Music, Piano, Volume2, VolumeX, SlidersHorizontal } from 'lucide-react';
import VolumeKnob from '../../ui/VolumeKnob';

const InstrumentRow = ({ instrument, onPianoRollClick, onEditClick }) => {
  const { updateInstrument } = useInstrumentsStore.getState();
  const { setTrackName, handleMixerParamChange, setActiveChannelId } = useMixerStore.getState(); // setActiveChannelId eklendi
  const togglePanel = usePanelsStore(state => state.togglePanel); // togglePanel eklendi

  const mixerTrack = useMixerStore(state => 
    state.mixerTracks.find(t => t.id === instrument.mixerTrackId)
  );
  
  const [contextMenu, setContextMenu] = useState(null);

  if (!instrument || !mixerTrack) return null;

  const isMuted = instrument.isMuted;
  const isSelected = usePanelsStore.getState().pianoRollInstrumentId === instrument.id;

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const openMixerAndFocus = (e) => {
    e.stopPropagation();
    setActiveChannelId(mixerTrack.id);
    togglePanel('mixer');
  };

  const getContextMenuOptions = () => [
    {
      label: 'Rename',
      action: () => {
        const newName = prompt('Enter new name:', instrument.name);
        if (newName && newName.trim()) {
          const trimmedName = newName.trim();
          updateInstrument(instrument.id, { name: trimmedName });
          setTrackName(mixerTrack.id, trimmedName);
        }
      }
    },
    { label: 'Show in Mixer', action: openMixerAndFocus },
    // ... diğer context menu seçenekleri ...
  ];
  
  // Dinamik olarak CSS sınıflarını oluşturuyoruz
  const rowClasses = `
    instrument-row 
    ${isMuted ? 'instrument-row--muted' : ''}
    ${isSelected ? 'instrument-row--selected' : ''}
  `;
  const muteButtonClasses = `instrument-row__action-btn ${isMuted ? 'instrument-row__action-btn--active' : ''}`;
  const pianoButtonClasses = `instrument-row__action-btn ${instrument.pianoRoll ? 'instrument-row__action-btn--active' : ''}`;
  const iconStyle = { '--instrument-color': mixerTrack.color || 'var(--color-surface-3)' };

  return (
    <div className={rowClasses} onContextMenu={handleContextMenu}>
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
        <VolumeKnob
          label="Pan" size={28} value={mixerTrack.pan}
          onChange={(val) => handleMixerParamChange(mixerTrack.id, 'pan', val)}
          min={-1} max={1} defaultValue={0}
        />
        <VolumeKnob
          label="Vol" size={28} value={mixerTrack.volume}
          onChange={(val) => handleMixerParamChange(mixerTrack.id, 'volume', val)}
          min={-60} max={6} defaultValue={0}
        />
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

export default InstrumentRow;
