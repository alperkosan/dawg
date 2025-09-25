import React, { useState } from 'react';
import { useMixerStore } from '../../../store/useMixerStore';
import { X, Plus, Trash2, Settings } from 'lucide-react';
import VolumeKnob from './VolumeKnob';
import FaderV3 from './FaderV3';

const SendsPanel = ({ selectedSend, onClose, onSendChange }) => {
  const [newSendName, setNewSendName] = useState('');

  const {
    sendChannels,
    mixerTracks,
    addSendChannel,
    removeSendChannel,
    updateSendChannel
  } = useMixerStore();

  const selectedSendChannel = sendChannels.find(s => s.id === selectedSend);

  const handleAddSend = () => {
    if (newSendName.trim()) {
      addSendChannel({
        name: newSendName.trim(),
        type: 'send'
      });
      setNewSendName('');
    }
  };

  const handleRemoveSend = (sendId) => {
    if (window.confirm('Are you sure you want to remove this send? This will remove it from all channels.')) {
      removeSendChannel(sendId);
    }
  };

  return (
    <div className="sends-panel">
      <div className="sends-panel__header">
        <h3 className="sends-panel__title">Send Routing</h3>
        <button className="sends-panel__close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="sends-panel__content">
        {/* Send Creation */}
        <div className="sends-panel__section">
          <h4 className="sends-panel__section-title">Create Send</h4>
          <div className="send-creator">
            <input
              type="text"
              className="send-creator__input"
              placeholder="Send name (e.g., Reverb, Delay)"
              value={newSendName}
              onChange={(e) => setNewSendName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddSend()}
            />
            <button
              className="send-creator__button"
              onClick={handleAddSend}
              disabled={!newSendName.trim()}
            >
              <Plus size={14} />
              Add Send
            </button>
          </div>
        </div>

        {/* Send Channels List */}
        <div className="sends-panel__section">
          <h4 className="sends-panel__section-title">Send Channels</h4>
          <div className="sends-list">
            {sendChannels.map((send) => (
              <div
                key={send.id}
                className={`send-item ${selectedSend === send.id ? 'send-item--selected' : ''}`}
              >
                <div className="send-item__header">
                  <span className="send-item__name">{send.name}</span>
                  <div className="send-item__actions">
                    <button
                      className="send-item__action"
                      onClick={() => {/* Open send settings */}}
                      title="Send settings"
                    >
                      <Settings size={12} />
                    </button>
                    <button
                      className="send-item__action send-item__action--danger"
                      onClick={() => handleRemoveSend(send.id)}
                      title="Remove send"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="send-item__controls">
                  {/* Master send level */}
                  <div className="send-item__master">
                    <div className="send-item__label">Master</div>
                    <FaderV3
                      value={send.masterLevel || 0}
                      onChange={(value) => updateSendChannel(send.id, { masterLevel: value })}
                      min={-60}
                      max={12}
                      showValue={true}
                    />
                  </div>

                  {/* Send parameters */}
                  <div className="send-item__params">
                    <VolumeKnob
                      value={send.pan || 0}
                      onChange={(value) => updateSendChannel(send.id, { pan: value })}
                      label="PAN"
                      min={-100}
                      max={100}
                      size="small"
                      bipolar={true}
                    />
                  </div>
                </div>

                {/* Track Send Levels */}
                <div className="send-item__track-sends">
                  <div className="send-item__label">Track Sends</div>
                  <div className="track-sends-grid">
                    {mixerTracks
                      .filter(track => track.type === 'track')
                      .slice(0, 8) // Limit to first 8 tracks for space
                      .map((track) => {
                        const sendLevel = track.sends?.[send.id] || 0;
                        const sendMuted = track.sends?.[`${send.id}_muted`] || false;

                        return (
                          <div key={track.id} className="track-send">
                            <div className="track-send__name" title={track.name}>
                              {track.name.slice(0, 4)}
                            </div>
                            <VolumeKnob
                              value={sendLevel}
                              onChange={(value) => onSendChange?.(send.id, value)}
                              min={-60}
                              max={12}
                              size="mini"
                              disabled={sendMuted}
                            />
                            <button
                              className={`track-send__mute ${sendMuted ? 'track-send__mute--active' : ''}`}
                              onClick={() => onSendChange?.(`${send.id}_muted`, !sendMuted)}
                            >
                              M
                            </button>
                          </div>
                        );
                      })}
                  </div>
                  {mixerTracks.filter(track => track.type === 'track').length > 8 && (
                    <div className="track-sends-more">
                      +{mixerTracks.filter(track => track.type === 'track').length - 8} more tracks
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sendChannels.length === 0 && (
              <div className="sends-list__empty">
                No send channels created yet. Create your first send above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendsPanel;