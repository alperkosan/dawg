import React from 'react';
import { useInstrumentsStore } from '../../store/useInstrumentsStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { useMixerStore } from '../../store/useMixerStore';

import { InspectorPanel } from './components/InspectorPanel';
import { WaveformCanvas } from './components/WaveformCanvas';
import { EffectsAndAnalysisPanel } from './components/EffectsAndAnalysisPanel';

import './SampleEditorV2.css';

const SampleEditorV2 = ({ instrument }) => {
  const instrumentBuffer = usePanelsStore(state => state.editorBuffer);
  const { updateInstrument } = useInstrumentsStore.getState();
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));

  if (!instrument || !track) {
    return <div className="p-4">Enstrüman veya kanal verisi yüklenemedi. Lütfen tekrar deneyin.</div>;
  }

  // Değişiklikleri yöneten ana fonksiyonlar
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
    <div className="sample-editor-v2-container">
      {/* SOL SÜTUN: Inspector ve Waveform */}
      <div className="sample-editor-v2-container__left-column">
        <InspectorPanel
          instrument={instrument}
          onParamChange={handleParamChange}
          onPrecomputedChange={handlePrecomputedChange}
        />
        <WaveformCanvas
          instrument={instrument}
          buffer={instrumentBuffer}
          onEnvelopeChange={handleEnvelopeChange}
        />
      </div>
      
      {/* SAĞ SÜTUN: Efektler ve Analiz */}
      <EffectsAndAnalysisPanel
        instrument={instrument}
        instrumentBuffer={instrumentBuffer}
        track={track}
      />
    </div>
  );
};

export default React.memo(SampleEditorV2);