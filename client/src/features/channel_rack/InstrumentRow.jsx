import React from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Music, Piano, Edit3, Volume2, VolumeX } from 'lucide-react';
import VolumeKnob from '../../ui/VolumeKnob';
import './InstrumentRow.css';

const InstrumentRow = ({ instrument, onPianoRollClick, onEditClick, audioEngineRef }) => {
  const { handleToggleInstrumentMute } = useInstrumentsStore.getState();
  const { handleMixerParamChange } = useMixerStore.getState();
  const activeTheme = useThemeStore(state => state.getActiveTheme());

  const mixerTrack = useMixerStore(state => 
    state.mixerTracks.find(t => t.id === instrument.mixerTrackId)
  );

  if (!instrument || !mixerTrack) {
    console.error("InstrumentRow'da enstrüman veya mixer kanalı bulunamadı:", instrument, mixerTrack);
    return null;
  }

  const isMuted = mixerTrack.isMuted;

  const handleMuteClick = (e) => {
    e.stopPropagation();
    handleToggleInstrumentMute(instrument.id, audioEngineRef.current);
  };
  
  const handlePreviewClick = (e) => {
      e.stopPropagation();
      audioEngineRef?.current?.previewInstrument(instrument.id);
  };

  return (
    <div 
      className={`instrument-row-v2 ${isMuted ? 'muted' : ''}`}
      style={{
        '--instrument-color': activeTheme.colors.primary,
        '--hover-bg': activeTheme.colors.primary + '1A',
        '--active-bg': activeTheme.colors.primary + '33',
        height: '64px',
        backgroundColor: activeTheme.colors.surface
      }}
    >
      <div className="instrument-info-v2" onClick={onEditClick} title="Sample Editor'ı Aç">
        <div className="instrument-icon-v2">
          <Music size={18} />
        </div>
        <div className="instrument-details-v2">
          <span className="instrument-name-v2">{instrument.name}</span>
          <span className="instrument-target-v2" style={{ color: activeTheme.colors.muted }}>
            Track {mixerTrack.id.split('-')[1]}
          </span>
        </div>
      </div>

      <div className="instrument-controls-v2">
        <VolumeKnob
          label="Pan"
          size={26}
          value={mixerTrack.pan}
          onChange={(val) => handleMixerParamChange(mixerTrack.id, 'pan', val, audioEngineRef.current)}
          min={-1}
          max={1}
          defaultValue={0}
        />
        <VolumeKnob
          label="Vol"
          size={26}
          value={mixerTrack.volume}
          onChange={(val) => handleMixerParamChange(mixerTrack.id, 'volume', val, audioEngineRef.current)}
          min={-60}
          max={6}
          defaultValue={0}
        />
      </div>

      <div className="instrument-actions-v2">
        <button
          className={`action-btn-v2 mute-btn ${isMuted ? 'active' : ''}`}
          onClick={handleMuteClick}
          title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
          style={{ '--active-color': activeTheme.colors.accent }}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button
          className={`action-btn-v2 piano-btn ${instrument.pianoRoll ? 'active' : ''}`}
          onClick={onPianoRollClick}
          title="Piano Roll'u Aç"
          style={{ '--active-color': activeTheme.colors.primary }}
        >
          <Piano size={16} />
        </button>
      </div>
    </div>
  );
};

export default InstrumentRow;