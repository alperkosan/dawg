import React, { useState } from 'react';
import { useMixerStore } from '../../../store/useMixerStore';
import {
  Plus,
  Trash2,
  ExternalLink,
  Volume2,
  VolumeX,
  Settings,
  RouteOff,
  Route,
  MoreVertical
} from 'lucide-react';
import VolumeKnob from './VolumeKnob';
import './SendRoutingPanel.css';

const SendRoutingPanel = ({ onClose }) => {
  const [selectedSend, setSelectedSend] = useState(null);

  const {
    sendChannels,
    mixerTracks,
    addSendChannel,
    removeSendChannel,
    updateSendChannel,
    handleSendChange
  } = useMixerStore();

  const handleAddSend = () => {
    const sendName = prompt('Enter send channel name:', 'FX Send');
    if (sendName && sendName.trim()) {
      const newSendId = addSendChannel({
        name: sendName.trim(),
        masterLevel: -12,
        pan: 0
      });
      setSelectedSend(newSendId);
    }
  };

  const handleRemoveSend = (sendId) => {
    if (confirm('Are you sure you want to remove this send channel?')) {
      removeSendChannel(sendId);
      if (selectedSend === sendId) {
        setSelectedSend(null);
      }
    }
  };

  const trackChannels = mixerTracks.filter(t => t.type === 'track');

  return (
    <div className="send-routing-panel">
      <div className="send-routing-panel__header">
        <div className="send-routing-panel__title">
          <Route size={16} />
          <span>Send Routing</span>
        </div>
        <button
          className="send-routing-panel__close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="send-routing-panel__content">
        {/* Send Channels List */}
        <div className="send-channels-section">
          <div className="send-channels-section__header">
            <h3>Send Channels</h3>
            <button
              className="add-send-btn"
              onClick={handleAddSend}
            >
              <Plus size={14} />
              Add Send
            </button>
          </div>

          <div className="send-channels-list">
            {sendChannels.map((sendChannel, index) => (
              <div
                key={sendChannel.id}
                className={`send-channel-item ${selectedSend === sendChannel.id ? 'send-channel-item--selected' : ''}`}
                onClick={() => setSelectedSend(selectedSend === sendChannel.id ? null : sendChannel.id)}
              >
                <div className="send-channel-item__header">
                  <div className="send-channel-item__info">
                    <div className="send-channel-item__icon">
                      <ExternalLink size={14} />
                    </div>
                    <div className="send-channel-item__name">
                      {sendChannel.name || `Send ${index + 1}`}
                    </div>
                  </div>

                  <div className="send-channel-item__controls">
                    <button
                      className="send-channel-item__menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle send settings
                      }}
                    >
                      <Settings size={12} />
                    </button>
                    <button
                      className="send-channel-item__remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSend(sendChannel.id);
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Send Master Controls */}
                <div className="send-channel-item__master">
                  <div className="send-master-controls">
                    <VolumeKnob
                      value={sendChannel.masterLevel || 0}
                      onChange={(value) => updateSendChannel(sendChannel.id, { masterLevel: value })}
                      label="LEVEL"
                      min={-60}
                      max={12}
                      size="small"
                    />
                    <VolumeKnob
                      value={sendChannel.pan || 0}
                      onChange={(value) => updateSendChannel(sendChannel.id, { pan: value })}
                      label="PAN"
                      min={-100}
                      max={100}
                      size="small"
                      bipolar={true}
                    />
                  </div>
                </div>

                {/* Track Routing (when selected) */}
                {selectedSend === sendChannel.id && (
                  <div className="send-routing-matrix">
                    <div className="send-routing-matrix__header">
                      <span>Track Routing</span>
                    </div>
                    <div className="send-routing-grid">
                      {trackChannels.map(track => {
                        const sendValue = track.sends?.[sendChannel.id] || 0;
                        const sendMuted = track.sends?.[`${sendChannel.id}_muted`] || false;

                        return (
                          <div key={track.id} className="send-routing-row">
                            <div className="send-routing-row__track">
                              <div
                                className="send-routing-row__color"
                                style={{ backgroundColor: track.color || '#4b5563' }}
                              />
                              <span className="send-routing-row__name">{track.name}</span>
                            </div>

                            <div className="send-routing-row__controls">
                              <div className="send-routing-row__knob">
                                <VolumeKnob
                                  value={sendValue}
                                  onChange={(value) => handleSendChange(track.id, sendChannel.id, value)}
                                  label="SEND"
                                  min={-60}
                                  max={12}
                                  size="mini"
                                  disabled={sendMuted}
                                />
                              </div>
                              <button
                                className={`send-routing-row__mute ${sendMuted ? 'send-routing-row__mute--active' : ''}`}
                                onClick={() => handleSendChange(track.id, `${sendChannel.id}_muted`, !sendMuted)}
                              >
                                {sendMuted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Empty State */}
          {sendChannels.length === 0 && (
            <div className="send-channels-empty">
              <div className="send-channels-empty__icon">
                <RouteOff size={32} />
              </div>
              <div className="send-channels-empty__text">
                <h3>No Send Channels</h3>
                <p>Create send channels for effects routing and parallel processing</p>
              </div>
              <button
                className="send-channels-empty__add-btn"
                onClick={handleAddSend}
              >
                <Plus size={16} />
                Add First Send
              </button>
            </div>
          )}
        </div>

        {/* Send Channel Details */}
        {selectedSend && (
          <div className="send-details-section">
            {(() => {
              const sendChannel = sendChannels.find(s => s.id === selectedSend);
              if (!sendChannel) return null;

              return (
                <>
                  <div className="send-details-section__header">
                    <h3>{sendChannel.name} Details</h3>
                  </div>

                  <div className="send-details-content">
                    <div className="send-detail-group">
                      <label>Send Name</label>
                      <input
                        type="text"
                        value={sendChannel.name || ''}
                        onChange={(e) => updateSendChannel(sendChannel.id, { name: e.target.value })}
                        className="send-detail-input"
                        placeholder="Send channel name"
                      />
                    </div>

                    <div className="send-detail-group">
                      <label>Send Type</label>
                      <select
                        value={sendChannel.sendType || 'post'}
                        onChange={(e) => updateSendChannel(sendChannel.id, { sendType: e.target.value })}
                        className="send-detail-select"
                      >
                        <option value="post">Post Fader</option>
                        <option value="pre">Pre Fader</option>
                      </select>
                    </div>

                    <div className="send-detail-group">
                      <label>Output Routing</label>
                      <select
                        value={sendChannel.outputRoute || 'master'}
                        onChange={(e) => updateSendChannel(sendChannel.id, { outputRoute: e.target.value })}
                        className="send-detail-select"
                      >
                        <option value="master">Master Out</option>
                        <option value="external">External Output</option>
                      </select>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default SendRoutingPanel;