/**
 * Instrument Editor Panel
 * Main container for instrument editing UI
 * Dynamically loads editor based on instrument type
 */

import { useEffect } from 'react';
import useInstrumentEditorStore from '../../store/useInstrumentEditorStore';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { useMixerStore } from '../../store/useMixerStore';
import VASynthEditor from './components/editors/VASynthEditor';
import MultiSampleEditor from './components/editors/MultiSampleEditor';
import DrumSamplerEditor from './components/editors/DrumSamplerEditor';
import { GranularSamplerUI } from '@/components/instruments/granular';
import './InstrumentEditorPanel.css';

const InstrumentEditorPanel = () => {
  const {
    isOpen,
    instrumentId,
    instrumentData,
    activeTab,
    isDirty,
    closeEditor,
    setActiveTab,
    save,
    revert,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useInstrumentEditorStore();

  const getInstrument = useInstrumentsStore((state) => state.getInstrument);
  const updateInstrument = useInstrumentsStore((state) => state.updateInstrument);

  // Get mixer tracks for routing selector
  const mixerTracks = useMixerStore(state => state.mixerTracks);

  // Handle mixer channel change
  const handleMixerChannelChange = (newChannelId) => {
    if (!instrumentId) return;

    // Update instrument's mixerTrackId in store
    updateInstrument(instrumentId, { mixerTrackId: newChannelId });

    // Update editor state (use updateParameter instead of updateField)
    useInstrumentEditorStore.getState().updateParameter('mixerTrackId', newChannelId);
  };

  // Update instrument data when instrument changes
  useEffect(() => {
    if (instrumentId && !instrumentData) {
      const instrument = getInstrument(instrumentId);
      if (instrument) {
        useInstrumentEditorStore.getState().openEditor(instrumentId, instrument);
      }
    }
  }, [instrumentId, instrumentData, getInstrument]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // ESC to close
      if (e.key === 'Escape') {
        closeEditor();
      }

      // Ctrl+Z to undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
      }

      // Ctrl+Shift+Z or Ctrl+Y to redo
      if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
      }

      // Ctrl+S to save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        save();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeEditor, canUndo, canRedo, undo, redo, save]);

  if (!isOpen || !instrumentData) {
    return null;
  }

  // Determine editor type
  const getEditorComponent = () => {
    const { type, multiSamples } = instrumentData;

    if (type === 'vasynth') {
      return <VASynthEditor instrumentData={instrumentData} />;
    }

    if (type === 'sample') {
      if (multiSamples && multiSamples.length > 0) {
        return <MultiSampleEditor instrumentData={instrumentData} />;
      } else {
        return <DrumSamplerEditor instrumentData={instrumentData} />;
      }
    }

    if (type === 'granular') {
      return <GranularSamplerUI instrumentId={instrumentId} />;
    }

    if (type === 'synth') {
      // TODO: ForgeSynthEditor
      return (
        <div className="editor-placeholder">
          <div className="editor-placeholder__icon">🎹</div>
          <div className="editor-placeholder__text">
            ForgeSynth Editor
            <br />
            <span style={{ fontSize: '12px', color: '#666' }}>Coming soon...</span>
          </div>
        </div>
      );
    }

    return (
      <div className="editor-placeholder">
        <div className="editor-placeholder__icon">❓</div>
        <div className="editor-placeholder__text">Unknown instrument type: {type}</div>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`instrument-editor__backdrop ${isOpen ? 'instrument-editor__backdrop--open' : ''}`}
        onClick={closeEditor}
      />

      {/* Panel */}
      <div className={`instrument-editor-panel ${isOpen ? 'instrument-editor-panel--open' : ''}`}>
        {/* Header */}
        <div className="instrument-editor-panel__header">
          <div className="instrument-editor-panel__title">
            <div className="instrument-editor-panel__icon">
              {instrumentData.type === 'vasynth' && '🎹'}
              {instrumentData.type === 'sample' && (instrumentData.multiSamples ? '🎵' : '🥁')}
              {instrumentData.type === 'synth' && '🎛️'}
              {instrumentData.type === 'granular' && '🌾'}
            </div>
            <div className="instrument-editor-panel__name">
              <div className="instrument-editor-panel__name-primary">{instrumentData.name}</div>
              <div className="instrument-editor-panel__name-secondary">
                {/* Mixer Channel Selector */}
                <select
                  className="instrument-editor-panel__mixer-select"
                  value={instrumentData.mixerTrackId || 'master'}
                  onChange={(e) => handleMixerChannelChange(e.target.value)}
                  title="Select mixer channel"
                >
                  {mixerTracks
                    .filter(track => track.type === 'track' || track.type === 'bus' || track.type === 'master')
                    .map(track => (
                      <option key={track.id} value={track.id}>
                        {track.type === 'master' ? '🎛️' : track.type === 'bus' ? '🔀' : '🎚️'} {track.name}
                      </option>
                    ))}
                </select>
                {isDirty && <span className="instrument-editor-panel__dirty"> • Modified</span>}
              </div>
            </div>
          </div>

          <div className="instrument-editor-panel__actions">
            {/* Undo/Redo */}
            <button
              className="instrument-editor-panel__action"
              onClick={undo}
              disabled={!canUndo()}
              title="Undo (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              className="instrument-editor-panel__action"
              onClick={redo}
              disabled={!canRedo()}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↷
            </button>

            {/* Save/Revert */}
            {isDirty && (
              <>
                <button
                  className="instrument-editor-panel__action instrument-editor-panel__action--primary"
                  onClick={save}
                  title="Save (Ctrl+S)"
                >
                  💾
                </button>
                <button
                  className="instrument-editor-panel__action"
                  onClick={revert}
                  title="Revert changes"
                >
                  ⟲
                </button>
              </>
            )}

            {/* Close */}
            <button
              className="instrument-editor-panel__action instrument-editor-panel__close"
              onClick={closeEditor}
              title="Close (ESC)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="instrument-editor-panel__tabs">
          <button
            className={`instrument-editor-panel__tab ${activeTab === 'main' ? 'instrument-editor-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Main
          </button>
          <button
            className={`instrument-editor-panel__tab ${activeTab === 'effects' ? 'instrument-editor-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('effects')}
          >
            Effects
          </button>
          <button
            className={`instrument-editor-panel__tab ${activeTab === 'modulation' ? 'instrument-editor-panel__tab--active' : ''}`}
            onClick={() => setActiveTab('modulation')}
          >
            Modulation
          </button>
        </div>

        {/* Content */}
        <div className="instrument-editor-panel__content">
          {activeTab === 'main' && getEditorComponent()}
          {activeTab === 'effects' && (
            <div className="editor-placeholder">
              <div className="editor-placeholder__icon">🎚️</div>
              <div className="editor-placeholder__text">Effects Chain Editor</div>
            </div>
          )}
          {activeTab === 'modulation' && (
            <div className="editor-placeholder">
              <div className="editor-placeholder__icon">🔀</div>
              <div className="editor-placeholder__text">Modulation Matrix</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="instrument-editor-panel__footer">
          <div className="instrument-editor-panel__footer-info">
            Type: <span>{instrumentData.type}</span>
            {instrumentData.presetName && (
              <> | Preset: <span>{instrumentData.presetName}</span></>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default InstrumentEditorPanel;
