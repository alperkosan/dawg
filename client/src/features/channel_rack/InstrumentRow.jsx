import React from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useThemeStore } from '../../store/useThemeStore';
import { Play, Square, Piano, Edit3, Volume2, VolumeX } from 'lucide-react';
import './InstrumentRow.css';

export default function InstrumentRow({ instrument, onPianoRollClick, onEditClick, audioEngineRef }) {
  const { handleToggleInstrumentMute, updateInstrument } = useInstrumentsStore();
  const activeTheme = useThemeStore(state => state.getActiveTheme());

  // Güvenlik kontrolü
  if (!instrument) {
    console.error('InstrumentRow: instrument prop is undefined');
    return null;
  }

  const handlePreview = () => {
    audioEngineRef?.current?.previewInstrument(instrument.id);
  };

  const handleMuteToggle = () => {
    handleToggleInstrumentMute(instrument.id, audioEngineRef?.current);
  };

  const handlePianoRollToggle = () => {
    updateInstrument(instrument.id, { pianoRoll: !instrument.pianoRoll });
    if (!instrument.pianoRoll) {
      onPianoRollClick();
    }
  };

  return (
    <div 
      className={`instrument-row ${instrument.isMuted ? 'muted' : ''}`}
      style={{
        backgroundColor: activeTheme.colors.surface,
        borderBottom: `1px solid ${activeTheme.colors.border}`,
        color: instrument.isMuted ? activeTheme.colors.muted : activeTheme.colors.text
      }}
    >
      {/* Preview Button */}
      <button 
        className="instrument-button preview-button"
        onClick={handlePreview}
        title="Preview"
        style={{
          color: activeTheme.colors.primary,
          '--hover-bg': activeTheme.colors.primary + '20'
        }}
      >
        <Play size={14} />
      </button>

      {/* Mute Button */}
      <button 
        className={`instrument-button mute-button ${instrument.isMuted ? 'active' : ''}`}
        onClick={handleMuteToggle}
        title={instrument.isMuted ? "Unmute" : "Mute"}
        style={{
          color: instrument.isMuted ? activeTheme.colors.accent : activeTheme.colors.text,
          '--hover-bg': activeTheme.colors.accent + '20'
        }}
      >
        {instrument.isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>

      {/* Instrument Name */}
      <div className="instrument-name" title={instrument.name}>
        {instrument.name}
      </div>

      {/* Piano Roll Toggle */}
      <button 
        className={`instrument-button piano-button ${instrument.pianoRoll ? 'active' : ''}`}
        onClick={handlePianoRollToggle}
        title="Toggle Piano Roll Mode"
        style={{
          color: instrument.pianoRoll ? activeTheme.colors.primary : activeTheme.colors.muted,
          backgroundColor: instrument.pianoRoll ? activeTheme.colors.primary + '20' : 'transparent',
          '--hover-bg': activeTheme.colors.primary + '20'
        }}
      >
        <Piano size={14} />
      </button>

      {/* Edit Button */}
      <button 
        className="instrument-button edit-button"
        onClick={onEditClick}
        title="Edit Sample"
        style={{
          color: activeTheme.colors.text,
          '--hover-bg': activeTheme.colors.accent + '20'
        }}
      >
        <Edit3 size={14} />
      </button>
    </div>
  );
}