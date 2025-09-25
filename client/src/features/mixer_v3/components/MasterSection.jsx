import React from 'react';
import { useMixerStore } from '../../../store/useMixerStore';
import FaderV3 from './FaderV3';
import VolumeKnob from './VolumeKnob';
import { Volume2, VolumeX, Headphones } from 'lucide-react';

const MasterSection = ({ trackId, isActive, onClick }) => {
  const track = useMixerStore(state =>
    state.mixerTracks.find(t => t.id === trackId)
  );

  const {
    handleMixerParamChange,
    toggleMute
  } = useMixerStore.getState();

  if (!track) return null;

  return (
    <div
      className={`master-section-v3 ${isActive ? 'master-section-v3--active' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="master-section-v3__header">
        <div className="master-section-v3__name">MASTER</div>
      </div>

      {/* Master Level Meter */}
      <div className="master-section-v3__meters">
        <div className="master-level-meter">
          <div className="master-level-meter__channel master-level-meter__left">
            <div className="level-meter-v3">
              <div className="level-meter-v3__peak"></div>
              <div className="level-meter-v3__rms"></div>
            </div>
          </div>
          <div className="master-level-meter__channel master-level-meter__right">
            <div className="level-meter-v3">
              <div className="level-meter-v3__peak"></div>
              <div className="level-meter-v3__rms"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Master Fader */}
      <div className="master-section-v3__fader-section">
        <FaderV3
          value={track.volume}
          onChange={(value) => handleMixerParamChange(trackId, 'volume', value)}
          showValue={true}
        />
      </div>

      {/* Master Controls */}
      <div className="master-section-v3__controls">
        {/* Master Pan */}
        <div className="master-section-v3__pan">
          <VolumeKnob
            value={track.pan || 0}
            onChange={(value) => handleMixerParamChange(trackId, 'pan', value)}
            label="BAL"
            min={-100}
            max={100}
            size="small"
            bipolar={true}
          />
        </div>

        {/* Master Transport */}
        <div className="master-section-v3__transport">
          <button
            className={`master-section-v3__mute-btn ${track.muted ? 'master-section-v3__mute-btn--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleMute(trackId);
            }}
            title="Master Mute"
          >
            {track.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            className="master-section-v3__monitor-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleMixerParamChange(trackId, 'monitoring', !track.monitoring);
            }}
            title="Monitor"
          >
            <Headphones size={16} />
          </button>
        </div>
      </div>

      {/* Master Status */}
      <div className="master-section-v3__status">
        <div className="master-status-indicator">
          <div className="master-status-indicator__label">MASTER</div>
          <div className="master-status-indicator__level">
            {track.volume > -60 ? `${track.volume.toFixed(1)}dB` : '-∞'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterSection;