import React from 'react';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useMixerStore } from '@/store/useMixerStore';
// ✅ PHASE 1: Store Consolidation - Use unified store
import { useArrangementStore } from '@/store/useArrangementStore';
import { audioAssetManager } from '@/lib/audio/AudioAssetManager.js';

import { WaveformWorkbench } from './components/WaveformWorkbench';
import { ControlDeck } from './components/ControlDeck';

import './SampleEditorV3.css';

// AudioClipControls: Mixer routing for audio clips with shared/unique editing
const AudioClipControls = ({ editorClipData }) => {
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  // ✅ PHASE 1: Store Consolidation - Use unified store
  const updateClip = useArrangementStore(state => state.updateArrangementClip);
  const tracks = useArrangementStore(state => state.arrangementTracks);
  const clips = useArrangementStore(state => state.arrangementClips);
  const instrumentBuffer = usePanelsStore(state => state.editorBuffer);

  // Get live clip data from store (reactive)
  const liveClip = clips.find(c => c.id === editorClipData.clipId);

  // Determine if this clip is unique or shared
  const isUnique = liveClip?.isUnique || false;

  // Get all sibling clips (same asset, not unique)
  const siblingClips = clips.filter(c =>
    c.assetId === editorClipData.assetId &&
    !c.isUnique &&
    c.type === 'audio'
  );
  const siblingCount = siblingClips.length;

  // Get effective mixer channel (from asset or unique metadata)
  let effectiveMixerChannel;
  if (isUnique && liveClip.uniqueMetadata?.mixerChannelId) {
    effectiveMixerChannel = liveClip.uniqueMetadata.mixerChannelId;
  } else if (!isUnique && editorClipData.assetId) {
    const assetMeta = audioAssetManager.getAssetMetadata(editorClipData.assetId);
    effectiveMixerChannel = assetMeta?.mixerChannelId;
  }
  effectiveMixerChannel = effectiveMixerChannel || 'inherit';

  const handleMixerChannelChange = (newChannelId) => {
    const channelId = newChannelId === 'inherit' ? null : newChannelId;

    if (isUnique) {
      // Update only this clip's unique metadata
      console.log('🎛️ Updating UNIQUE clip mixer channel:', channelId);
      updateClip(editorClipData.clipId, {
        uniqueMetadata: {
          ...liveClip.uniqueMetadata,
          mixerChannelId: channelId
        }
      });
    } else {
      // Update asset metadata (affects all sibling clips)
      console.log(`🎛️ Updating SHARED asset mixer channel (${siblingCount} clips):`, channelId);
      audioAssetManager.updateAssetMetadata(editorClipData.assetId, {
        mixerChannelId: channelId
      });

      // Force re-render by triggering empty update on all sibling clips
      siblingClips.forEach(clip => {
        updateClip(clip.id, {});
      });
    }
  };

  const handleMakeUnique = () => {
    // Copy current asset metadata to clip's unique metadata
    const assetMeta = audioAssetManager.getAssetMetadata(editorClipData.assetId);

    updateClip(editorClipData.clipId, {
      isUnique: true,
      uniqueMetadata: {
        mixerChannelId: assetMeta.mixerChannelId,
        precomputed: { ...assetMeta.precomputed }
      }
    });

    console.log('✂️ Made clip unique:', editorClipData.clipId);
  };

  const handleMakeShared = () => {
    updateClip(editorClipData.clipId, {
      isUnique: false,
      uniqueMetadata: null
    });

    console.log('🔗 Made clip shared:', editorClipData.clipId);
  };

  const currentTrack = tracks.find(t => t.id === editorClipData.trackId);

  return (
    <div className="p-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
      {/* Shared/Unique Status Banner */}
      <div style={{
        padding: '8px 12px',
        background: isUnique ? 'rgba(251, 146, 60, 0.1)' : 'rgba(34, 197, 94, 0.1)',
        border: `1px solid ${isUnique ? 'rgba(251, 146, 60, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
        borderRadius: '6px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: '12px' }}>
          {isUnique ? (
            <>
              <span style={{ color: '#fb923c', fontWeight: '600' }}>✂️ Unique Clip</span>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                Changes affect only this clip
              </div>
            </>
          ) : (
            <>
              <span style={{ color: '#22c55e', fontWeight: '600' }}>🔗 Shared ({siblingCount} clips)</span>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                Changes affect all {siblingCount} clips using this audio
              </div>
            </>
          )}
        </div>

        <button
          onClick={isUnique ? handleMakeShared : handleMakeUnique}
          style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            color: 'white',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
        >
          {isUnique ? '🔗 Make Shared' : '✂️ Make Unique'}
        </button>
      </div>

      <div className="font-bold mb-3 text-gray-300">{editorClipData.name}</div>

      <div className="mb-3 text-sm text-gray-400">
        <div>Duration: {instrumentBuffer?.duration.toFixed(2)}s</div>
        <div>Track: {currentTrack?.name || 'Unknown'}</div>
      </div>

      <div className="mt-4">
        <label className="block text-xs text-gray-400 mb-2">
          Mixer Channel Routing
          {!isUnique && <span style={{ color: '#22c55e', marginLeft: '6px', fontSize: '10px' }}>
            (affects {siblingCount} clips)
          </span>}
        </label>
        <select
          value={effectiveMixerChannel}
          onChange={(e) => handleMixerChannelChange(e.target.value)}
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
          {effectiveMixerChannel === 'inherit'
            ? 'This clip uses the mixer channel of its track.'
            : `This clip uses a dedicated mixer channel.${!isUnique ? ` (shared across ${siblingCount} clips)` : ''}`}
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

  // Audio clip mode: show waveform + mixer routing control
  if (isAudioClipMode) {
    return (
      <div className="sample-editor-v3-container">
        <WaveformWorkbench instrument={null} buffer={instrumentBuffer} readOnly />
        <AudioClipControls editorClipData={editorClipData} />
      </div>
    );
  }

  // Normal instrument mode
  return (
    <div className="sample-editor-v3-container">
      <WaveformWorkbench instrument={instrument} buffer={instrumentBuffer} />
      <ControlDeck
        instrument={instrument}
        track={track}
        onParamChange={handleParamChange}
      />
    </div>
  );
};

export default React.memo(SampleEditorV3);