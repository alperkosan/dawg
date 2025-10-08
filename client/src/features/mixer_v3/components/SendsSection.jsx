import React from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { Knob } from '@/components/controls/base/Knob';
import { ExternalLink } from 'lucide-react';
import './eq-sends-styles.css';

const SendsSection = ({ trackId, onSendClick }) => {
  const track = useMixerStore(state =>
    state.mixerTracks.find(t => t.id === trackId)
  );

  const sendChannels = useMixerStore(state => state.sendChannels || []);
  const { handleSendChange } = useMixerStore.getState();

  if (!track) return null;

  // Get sends for this track
  const trackSends = track.sends || {};

  return (
    <div className="sends-section">
      <div className="sends-section__header">
        <span className="sends-section__title">SENDS</span>
      </div>

      <div className="sends-section__controls">
        {sendChannels.map((sendChannel, index) => {
          const sendValue = trackSends[sendChannel.id] || 0;
          const sendMuted = trackSends[`${sendChannel.id}_muted`] || false;

          return (
            <div key={sendChannel.id} className="send-control">
              <div className="send-control__header">
                <span className="send-control__label">
                  {sendChannel.name || `Send ${index + 1}`}
                </span>
                <button
                  className="send-control__route-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSendClick?.(sendChannel.id);
                  }}
                  title="Show send routing"
                >
                  <ExternalLink size={10} />
                </button>
              </div>

              <div className="send-control__knob">
                <Knob
                  label={`S${index + 1}`}
                  value={sendValue}
                  min={-60}
                  max={12}
                  defaultValue={-60}
                  onChange={(value) => handleSendChange(trackId, sendChannel.id, value)}
                  size={28}
                  unit="dB"
                  precision={1}
                  variant="mixer"
                  disabled={sendMuted}
                  showValue={false}
                />
              </div>

              <button
                className={`send-control__mute ${sendMuted ? 'send-control__mute--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendChange(trackId, `${sendChannel.id}_muted`, !sendMuted);
                }}
                title="Mute send"
              >
                M
              </button>
            </div>
          );
        })}

        {/* Pre/Post Fader Toggle */}
        <div className="send-control send-control--mode">
          <button
            className={`send-mode-btn ${track.sendsPreFader ? 'send-mode-btn--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleSendChange(trackId, 'sendsPreFader', !track.sendsPreFader);
            }}
            title="Toggle pre/post fader sends"
          >
            {track.sendsPreFader ? 'PRE' : 'POST'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendsSection;