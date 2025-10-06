import React from 'react';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useMixerStore } from '@/store/useMixerStore';

import { WaveformWorkbench } from './components/WaveformWorkbench';
import { ControlDeck } from './components/ControlDeck';

import './SampleEditorV3.css';

const SampleEditorV3 = ({ instrument }) => {
  const instrumentBuffer = usePanelsStore(state => state.editorBuffer);
  const editorClipData = usePanelsStore(state => state.editorClipData);
  const { updateInstrument } = useInstrumentsStore.getState();
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));

  // --- LOG 4: Ana bileşen render olduğunda buffer'ın durumunu kontrol edelim ---
  console.log('[LOG 4] SampleEditorV3 render oldu. Gelen instrumentBuffer:', instrumentBuffer ? `ToneAudioBuffer (Süre: ${instrumentBuffer.duration.toFixed(2)}s)` : 'null veya undefined');
  console.log('[LOG 4] editorClipData:', editorClipData);

  // Audio clip mode (arrangement'tan gelen frozen pattern)
  const isAudioClipMode = editorClipData?.type === 'audio-clip';

  if (!instrument && !isAudioClipMode) {
    return <div className="p-4">Enstrüman veya kanal verisi yüklenemedi.</div>;
  }

  if (isAudioClipMode && !instrumentBuffer) {
    return <div className="p-4">Audio clip yükleniyor...</div>;
  }

  if (!isAudioClipMode && (!instrument || !track)) {
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

  // Audio clip mode: show waveform only (read-only)
  if (isAudioClipMode) {
    return (
      <div className="sample-editor-v3-container">
        <WaveformWorkbench
          instrument={null}
          buffer={instrumentBuffer}
          onPrecomputedChange={() => {}}
          onEnvelopeChange={() => {}}
          readOnly={true}
          clipData={editorClipData}
        />
        <div className="p-4 text-gray-400 text-sm">
          <div className="font-bold mb-2">{editorClipData.name}</div>
          <div>Duration: {instrumentBuffer?.duration.toFixed(2)}s</div>
          <div className="mt-2 text-xs text-gray-500">Frozen pattern - read only</div>
        </div>
      </div>
    );
  }

  // Normal instrument mode
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