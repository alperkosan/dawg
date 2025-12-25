import React, { useMemo } from 'react';
import { ChannelMeter } from './ChannelMeter';

export const MixerPrimaryMeter = ({ activeTrack, masterTrack }) => {
  const displayTrack = useMemo(() => {
    return activeTrack || masterTrack;
  }, [activeTrack, masterTrack]);

  return (
    <div className="mixer-primary-meter">
      <div className="mixer-primary-meter__meter-shell">
        <div className="mixer-primary-meter__header">
          <div className="mixer-primary-meter__chip">
            <span>{displayTrack?.type?.toUpperCase() || 'TRACK'}</span>
          </div>
          <div
            className="mixer-primary-meter__nameplate"
            style={{ borderColor: displayTrack?.color || 'var(--zenith-accent-cool)' }}
          >
            {displayTrack?.name || 'Master'}
          </div>
        </div>
        {displayTrack ? (
          <div className="mixer-primary-meter__meter">
            <ChannelMeter
              trackId={displayTrack.id}
              isVisible
              className="channel-meter--inspector"
            />
          </div>
        ) : (
          <div className="mixer-primary-meter__empty" />
        )}
      </div>
    </div>
  );
};

