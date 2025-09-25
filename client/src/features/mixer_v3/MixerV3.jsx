import React, { useState, useMemo } from 'react';
import { useMixerStore } from '../../store/useMixerStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import {
  SlidersHorizontal,
  Route,
  Plus,
  Settings,
  Eye,
  EyeOff,
  Zap
} from 'lucide-react';
import MixerChannelV3 from './components/MixerChannelV3';
import SendsPanel from './components/SendsPanel';
import SendRoutingPanel from './components/SendRoutingPanel';
import ActiveChannelPanel from './components/ActiveChannelPanel';
import MasterSection from './components/MasterSection';
import EffectsPanel from './components/EffectsPanel';
import './MixerV3.css';

const MixerV3 = () => {
  const [selectedSend, setSelectedSend] = useState(null);
  const [showSendsPanel, setShowSendsPanel] = useState(false);
  const [showSendRoutingPanel, setShowSendRoutingPanel] = useState(false);
  const [selectedEffectsTrack, setSelectedEffectsTrack] = useState(null);
  const [showActivePanel, setShowActivePanel] = useState(true);

  const {
    mixerTracks,
    activeChannelId,
    sendChannels,
    setActiveChannelId
  } = useMixerStore();

  // Organize tracks by type
  const { trackChannels, busChannels, masterTracks } = useMemo(() => ({
    trackChannels: mixerTracks.filter(t => t.type === 'track'),
    busChannels: mixerTracks.filter(t => t.type === 'bus'),
    masterTracks: mixerTracks.filter(t => t.type === 'master'),
  }), [mixerTracks]);

  const activeTrack = useMixerStore(state =>
    state.mixerTracks.find(t => t.id === activeChannelId)
  );

  const handleSendClick = (sendId) => {
    setSelectedSend(sendId);
    setShowSendsPanel(true);
  };

  const handleEffectsClick = (trackId) => {
    setSelectedEffectsTrack(trackId);
  };

  return (
    <div className="mixer-v3">
      {/* Premium Mixer Header */}
      <div className="mixer-v3__header">
        <div className="mixer-v3__header-title">
          <SlidersHorizontal size={16} />
          <span>Professional Mixer</span>
        </div>

        <div className="mixer-v3__header-controls">
          <button
            className={`mixer-v3__header-btn ${showSendRoutingPanel ? 'mixer-v3__header-btn--active' : ''}`}
            onClick={() => setShowSendRoutingPanel(!showSendRoutingPanel)}
          >
            <Route size={12} />
            Send Routing
          </button>

          <button
            className="mixer-v3__header-btn"
            onClick={() => {
              // Add new mixer track
              console.log('Add new mixer track');
            }}
          >
            <Plus size={12} />
            Add Track
          </button>

          <div className="mixer-v3__view-controls">
            <button
              className="mixer-v3__view-btn"
              title="Mixer Settings"
            >
              <Settings size={14} />
            </button>

            <button
              className={`mixer-v3__view-btn ${showActivePanel ? 'mixer-v3__view-btn--active' : ''}`}
              onClick={() => setShowActivePanel(!showActivePanel)}
              title="Toggle Active Channel Panel"
            >
              {showActivePanel ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      <div className="mixer-v3__main-content">
        <div className="mixer-v3__channels">
          <div className="mixer-v3__channels-scroll">
            {/* Track Channels */}
            <div className="mixer-v3__section">
              {trackChannels.map(track => (
                <MixerChannelV3
                  key={track.id}
                  trackId={track.id}
                  onSendClick={handleSendClick}
                  onEffectsClick={handleEffectsClick}
                  isActive={activeChannelId === track.id}
                  onClick={() => setActiveChannelId(track.id)}
                />
              ))}
            </div>

            {/* Bus Channels */}
            {busChannels.length > 0 && (
              <>
                <div className="mixer-v3__separator" />
                <div className="mixer-v3__section">
                  {busChannels.map(track => (
                    <MixerChannelV3
                      key={track.id}
                      trackId={track.id}
                      onSendClick={handleSendClick}
                      onEffectsClick={handleEffectsClick}
                      isActive={activeChannelId === track.id}
                      onClick={() => setActiveChannelId(track.id)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Master Section */}
            <div className="mixer-v3__separator" />
            <div className="mixer-v3__section mixer-v3__section--master">
              {masterTracks.map(track => (
                <MasterSection
                  key={track.id}
                  trackId={track.id}
                  isActive={activeChannelId === track.id}
                  onClick={() => setActiveChannelId(track.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Active Channel Panel */}
        {showActivePanel && <ActiveChannelPanel />}
      </div>

      {/* Sends Panel */}
      {showSendsPanel && (
        <SendsPanel
          selectedSend={selectedSend}
          onClose={() => setShowSendsPanel(false)}
          onSendChange={(sendId, value) => {
            // Handle send level changes
            console.log('Send change:', sendId, value);
          }}
        />
      )}

      {/* Send Routing Panel */}
      {showSendRoutingPanel && (
        <SendRoutingPanel
          onClose={() => setShowSendRoutingPanel(false)}
        />
      )}

      {/* Effects Panel */}
      {selectedEffectsTrack && (
        <EffectsPanel
          trackId={selectedEffectsTrack}
          onClose={() => setSelectedEffectsTrack(null)}
        />
      )}
    </div>
  );
};

export default MixerV3;