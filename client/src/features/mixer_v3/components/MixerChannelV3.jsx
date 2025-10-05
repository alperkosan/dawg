import React, { useState, useMemo } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import FaderV3 from './FaderV3';
import EQSection from './EQSection';
import SendsSection from './SendsSection';
import VolumeKnob from './VolumeKnob';
import {
  Volume2,
  VolumeX,
  Headphones,
  Settings,
  Waves,
  Share,
  Power,
  ChevronUp,
  ChevronDown,
  Filter
} from 'lucide-react';

const MixerChannelV3 = React.memo(({ trackId, onSendClick, onEffectsClick, isActive, onClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [showSends, setShowSends] = useState(false);

  // Simple store subscriptions to avoid infinite loop
  const activeChannelId = useMixerStore(state => state.activeChannelId);
  const track = useMixerStore(state =>
    state.mixerTracks.find(t => t.id === trackId)
  );
  const isRoutingTarget = activeChannelId && activeChannelId !== trackId;

  // Get stable references to store actions
  const storeActions = useMemo(() => {
    const state = useMixerStore.getState();
    return {
      handleMixerParamChange: state.handleMixerParamChange,
      toggleMute: state.toggleMute,
      toggleSolo: state.toggleSolo
    };
  }, []);

  if (!track) return null;

  const channelStyle = {
    '--track-color': track.color || '#4b5563',
    '--track-color-light': track.color ? `${track.color}33` : '#4b556333'
  };

  const handleQuickRoute = (e) => {
    e.stopPropagation();
    if (isRoutingTarget) {
      // Perform quick route from active channel to this channel
      console.log('🔄 Quick route:', activeChannelId, '→', trackId);
      // Add your routing logic here
    }
  };

  return (
    <div
      className={`mixer-channel-v3 ${isActive ? 'mixer-channel-v3--active' : ''} ${isExpanded ? 'mixer-channel-v3--expanded' : ''} ${isRoutingTarget ? 'mixer-channel-v3--routing-target' : ''}`}
      style={channelStyle}
      onClick={isRoutingTarget ? handleQuickRoute : onClick}
    >
      {/* Quick Route Indicator */}
      {isRoutingTarget && (
        <div className="mixer-channel-v3__routing-indicator">
          <span>Click to Route</span>
        </div>
      )}
      {/* Header */}
      <div className="mixer-channel-v3__header">
        <div className="mixer-channel-v3__name" title={track.name}>
          {track.name}
        </div>
        <button
          className="mixer-channel-v3__expand-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Input Gain */}
      <div className="mixer-channel-v3__input-section">
        <VolumeKnob
          value={track.inputGain || 0}
          onChange={(value) => storeActions.handleMixerParamChange(trackId, 'inputGain', value)}
          label="GAIN"
          min={-30}
          max={30}
          size="small"
        />
      </div>

      {/* EQ Section */}
      {(isExpanded || showEQ) && (
        <div className="mixer-channel-v3__eq-section">
          <EQSection trackId={trackId} />
        </div>
      )}

      {/* Sends Section */}
      {(isExpanded || showSends) && (
        <div className="mixer-channel-v3__sends-section">
          <SendsSection
            trackId={trackId}
            onSendClick={onSendClick}
          />
        </div>
      )}

      {/* Level Meter & Fader */}
      <div className="mixer-channel-v3__level-section">
        <div className="mixer-channel-v3__meter">
          {/* Premium Level meter with segments */}
          <div className="level-meter-v3">
            <div className="level-meter-v3__segments"></div>
            <div className="level-meter-v3__rms"></div>
            <div className="level-meter-v3__peak"></div>
          </div>
        </div>

        <div className="mixer-channel-v3__fader-section">
          <FaderV3
            value={track.volume}
            onChange={(value) => storeActions.handleMixerParamChange(trackId, 'volume', value)}
            showValue={true}
          />
        </div>
      </div>

      {/* Pan Control */}
      <div className="mixer-channel-v3__pan-section">
        <VolumeKnob
          value={track.pan || 0}
          onChange={(value) => storeActions.handleMixerParamChange(trackId, 'pan', value)}
          label="PAN"
          min={-100}
          max={100}
          size="small"
          bipolar={true}
        />
      </div>

      {/* Transport Controls */}
      <div className="mixer-channel-v3__transport">
        <button
          className={`mixer-channel-v3__mute-btn ${track.muted ? 'mixer-channel-v3__mute-btn--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            storeActions.toggleMute(trackId);
          }}
          title="Mute"
        >
          {track.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        <button
          className={`mixer-channel-v3__solo-btn ${track.solo ? 'mixer-channel-v3__solo-btn--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            storeActions.toggleSolo(trackId);
          }}
          title="Solo"
        >
          <Headphones size={14} />
        </button>
      </div>

      {/* Utility Buttons */}
      <div className="mixer-channel-v3__utilities">
        <button
          className={`mixer-channel-v3__utility-btn ${showEQ ? 'mixer-channel-v3__utility-btn--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowEQ(!showEQ);
          }}
          title="EQ"
        >
          <Waves size={12} />
        </button>

        <button
          className={`mixer-channel-v3__utility-btn ${showSends ? 'mixer-channel-v3__utility-btn--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowSends(!showSends);
          }}
          title="Sends"
        >
          <Share size={12} />
        </button>

        <button
          className="mixer-channel-v3__utility-btn"
          onClick={(e) => {
            e.stopPropagation();
            onEffectsClick?.(trackId);
          }}
          title="Effects"
        >
          <Filter size={12} />
        </button>

        <button
          className="mixer-channel-v3__utility-btn"
          onClick={(e) => {
            e.stopPropagation();
            // Open channel settings
          }}
          title="Settings"
        >
          <Settings size={12} />
        </button>
      </div>

      {/* Record/Monitor */}
      <div className="mixer-channel-v3__record">
        <button
          className={`mixer-channel-v3__rec-btn ${track.armed ? 'mixer-channel-v3__rec-btn--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            storeActions.handleMixerParamChange(trackId, 'armed', !track.armed);
          }}
          title="Arm for recording"
        >
          <div className="mixer-channel-v3__rec-indicator" />
        </button>
      </div>
    </div>
  );
});

// Define comparison function for React.memo
MixerChannelV3.displayName = 'MixerChannelV3';

export default MixerChannelV3;