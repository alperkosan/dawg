import React from 'react';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { useArrangementV2Store } from '@/store/useArrangementV2Store';

import { WaveformWorkbench } from './components/WaveformWorkbench';
import { ControlDeck } from './components/ControlDeck';

import './SampleEditorV3.css';

// AudioClipControls: Mixer routing for audio clips
const AudioClipControls = ({ editorClipData }) => {
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  const updateClip = useArrangementV2Store(state => state.updateClip);
  const tracks = useArrangementV2Store(state => state.tracks);
  const clips = useArrangementV2Store(state => state.clips);
  const instrumentBuffer = usePanelsStore(state => state.editorBuffer);

  // Get live clip data from store (reactive)
  const liveClip = clips.find(c => c.id === editorClipData.clipId);

  const handleMixerChannelChange = (newChannelId) => {
    console.log('🎛️ Changing clip mixer channel to:', newChannelId);
    updateClip(editorClipData.clipId, {
      mixerChannelId: newChannelId || null
    });
  };

  const currentTrack = tracks.find(t => t.id === editorClipData.trackId);
  const currentMixerChannel = liveClip?.mixerChannelId || 'inherit';

  console.log('🔍 AudioClipControls state:', {
    clipId: editorClipData.clipId,
    initialMixerChannelId: editorClipData.mixerChannelId,
    liveMixerChannelId: liveClip?.mixerChannelId,
    currentMixerChannel
  });

  return (
    <div className="p-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
      <div className="font-bold mb-3 text-gray-300">{editorClipData.name}</div>

      <div className="mb-3 text-sm text-gray-400">
        <div>Duration: {instrumentBuffer?.duration.toFixed(2)}s</div>
        <div>Track: {currentTrack?.name || 'Unknown'}</div>
      </div>

      <div className="mt-4">
        <label className="block text-xs text-gray-400 mb-2">Mixer Channel Routing</label>
        <select
          value={currentMixerChannel}
          onChange={(e) => handleMixerChannelChange(e.target.value === 'inherit' ? null : e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'white',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <option value="inherit">🔗 Inherit from Track ({currentTrack?.name})</option>
          {mixerTracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.name}
            </option>
          ))}
        </select>

        <div className="mt-2 text-xs text-gray-500">
          {currentMixerChannel === 'inherit'
            ? 'This clip uses the mixer channel of its track.'
            : 'This clip has a dedicated mixer channel.'}
        </div>
      </div>
    </div>
  );
};

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

  // Audio clip mode: show waveform + mixer routing control
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
        <AudioClipControls editorClipData={editorClipData} />
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