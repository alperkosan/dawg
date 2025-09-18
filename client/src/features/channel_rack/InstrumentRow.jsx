import React, { useState } from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { useThemeStore } from '../../store/useThemeStore';
import ChannelContextMenu from '../../components/ChannelContextMenu';
import { Music, Piano, Edit3, Volume2, VolumeX, Scissors, Replace, Trash2 } from 'lucide-react';
import VolumeKnob from '../../ui/VolumeKnob';
import './InstrumentRow.css'; // Yeni ve gelişmiş CSS dosyasını import et
import { InstrumentService } from '../../lib/services/InstrumentService';
import { AudioContextService } from '../../lib/services/AudioContextService';

const InstrumentRow = ({ instrument, onPianoRollClick, onEditClick, audioEngineRef }) => {
  const engine = AudioContextService.getAudioEngine(); // Motoru doğrudan al

  const { updateInstrument, deleteInstrument, assignToNewTrack } = useInstrumentsStore.getState();
  const { setTrackName } = useMixerStore.getState();
  const activeTheme = useThemeStore(state => state.getActiveTheme());

  const mixerTrack = useMixerStore(state => 
    state.mixerTracks.find(t => t.id === instrument.mixerTrackId)
  );
  
  const [contextMenu, setContextMenu] = useState(null);

  if (!instrument || !mixerTrack) return null;

  const isMuted = instrument.isMuted;

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const getContextMenuOptions = () => [
    {
      label: 'Rename',
      action: () => {
        const newName = prompt('Enter new name:', instrument.name);
        if (newName) {
          updateInstrument(instrument.id, { name: newName });
          setTrackName(mixerTrack.id, newName);
        }
      }
    },
    {
      label: 'Cut Itself',
      isActive: instrument.cutItself,
      action: () => updateInstrument(instrument.id, { cutItself: !instrument.cutItself }, false, engine)
    },
    {
      label: 'Assign to new mixer track',
      action: () => assignToNewTrack(instrument.id, engine)
    },
    {
      label: 'Delete',
      action: () => {
        if (window.confirm(`'${instrument.name}' silinecek. Emin misiniz?`)) {
          // Karmaşık silme işlemini tek bir komutla servise devrediyoruz.
          InstrumentService.deleteInstrument(instrument.id);
        }
      }
    }
  ];

  return (
    <div 
      className={`instrument-row-enhanced ${isMuted ? 'muted' : ''}`}
      style={{
        '--instrument-color': activeTheme.colors.primary,
        '--hover-bg': activeTheme.colors.primary + '1A',
        '--active-color': activeTheme.colors.primary,
        height: '64px',
      }}
      onContextMenu={handleContextMenu}
    >
      <div className="instrument-info-v2" onClick={onEditClick} title="Open Sample Editor">
        <div className="instrument-icon-v2">
          <Music size={18} />
        </div>
        <div className="instrument-details-v2">
          <span className="instrument-name-v2">{instrument.name}</span>
          <span className="instrument-target-v2" style={{ color: activeTheme.colors.muted }}>
            → Track {mixerTrack.id.split('-')[1]}
          </span>
        </div>
      </div>

      <div className="instrument-controls-v2">
        <VolumeKnob
          label="Pan" size={26} value={mixerTrack.pan}
          onChange={(val) => useMixerStore.getState().handleMixerParamChange(mixerTrack.id, 'pan', val, engine)}
          min={-1} max={1} defaultValue={0}
        />
        <VolumeKnob
          label="Vol" size={26} value={mixerTrack.volume}
          onChange={(val) => useMixerStore.getState().handleMixerParamChange(mixerTrack.id, 'volume', val, engine)}
          min={-60} max={6} defaultValue={0}
        />
      </div>

      <div className="instrument-actions-v2">
        <button
          className={`action-btn-v2 mute-btn ${instrument.isMuted ? 'active' : ''}`}
          onClick={(e) => { 
              e.stopPropagation(); 
              // State ve motoru senkronize eden işlemi store'a bırakıyoruz.
              // Bu mantık da ileride bir servise taşınabilir.
              useInstrumentsStore.getState().handleToggleInstrumentMute(instrument.id, AudioContextService.getAudioEngine()); 
          }}
          title={instrument.isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button
          className={`action-btn-v2 piano-btn ${instrument.pianoRoll ? 'active' : ''}`}
          onClick={onPianoRollClick}
          title="Open Piano Roll"
        >
          <Piano size={16} />
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
