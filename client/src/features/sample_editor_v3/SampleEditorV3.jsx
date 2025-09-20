import React from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { useMixerStore } from '../../store/useMixerStore';

import { WaveformWorkbench } from './components/WaveformWorkbench';
import { ControlDeck } from './components/ControlDeck';

import './SampleEditorV3.css';

const SampleEditorV3 = ({ instrument }) => {
  const instrumentBuffer = usePanelsStore(state => state.editorBuffer);
  const { updateInstrument } = useInstrumentsStore.getState();
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));

  // --- LOG 4: Ana bileşen render olduğunda buffer'ın durumunu kontrol edelim ---
  console.log('[LOG 4] SampleEditorV3 render oldu. Gelen instrumentBuffer:', instrumentBuffer ? `ToneAudioBuffer (Süre: ${instrumentBuffer.duration.toFixed(2)}s)` : 'null veya undefined');

  if (!instrument || !track) {
    return <div className="p-4">Enstrüman veya kanal verisi yüklenemedi.</div>;
  }

  const handleParamChange = (param, value) => {
    updateInstrument(instrument.id, { [param]: value }, false);
  };
  
  const handlePrecomputedChange = (param, value) => {
    const newPrecomputed = { ...instrument.precomputed, [param]: value };
    updateInstrument(instrument.id, { precomputed: newPrecomputed }, true);
  };
  
  const handleEnvelopeChange = (newEnvelope) => {
    updateInstrument(instrument.id, { envelope: newEnvelope }, false);
  };

  return (
    <div className="sample-editor-v3-container">
      <WaveformWorkbench
        instrument={instrument}
        buffer={instrumentBuffer}
        onPrecomputedChange={handlePrecomputedChange}
        onEnvelopeChange={handleEnvelopeChange}
      />
      <ControlDeck
        instrument={instrument}
        track={track}
        onParamChange={handleParamChange}
      />
    </div>
  );
};

export default React.memo(SampleEditorV3);