/**
 * ZENITH MIXER
 *
 * FL Studio-inspired professional mixer with:
 * - Clean channel strips
 * - Right panel with effects rack
 * - Send routing matrix
 * - Modern Zenith design
 */

import React, { useState, useMemo } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import {
  SlidersHorizontal,
  Route,
  Plus,
  Settings,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { MixerChannel } from './components/MixerChannel';
import { EffectsRack } from './components/EffectsRack';
import { SendMatrix } from './components/SendMatrix';
import { MasterChannel } from './components/MasterChannel';
import './Mixer.css';

const Mixer = () => {
  const [showEffectsRack, setShowEffectsRack] = useState(true);
  const [showSendMatrix, setShowSendMatrix] = useState(false);

  const {
    mixerTracks,
    activeChannelId,
    setActiveChannelId
  } = useMixerStore();

  // Organize tracks
  const { trackChannels, busChannels, masterTrack } = useMemo(() => ({
    trackChannels: mixerTracks.filter(t => t.type === 'track'),
    busChannels: mixerTracks.filter(t => t.type === 'bus'),
    masterTrack: mixerTracks.find(t => t.type === 'master')
  }), [mixerTracks]);

  const activeTrack = useMemo(() =>
    mixerTracks.find(t => t.id === activeChannelId),
    [mixerTracks, activeChannelId]
  );

  return (
    <div className="zenith-mixer">
      {/* Header */}
      <div className="zenith-mixer__header">
        <div className="zenith-mixer__header-left">
          <SlidersHorizontal size={18} />
          <h2>Mixer</h2>
        </div>

        <div className="zenith-mixer__header-center">
          <button
            className={`zenith-mixer__header-btn ${showSendMatrix ? 'active' : ''}`}
            onClick={() => setShowSendMatrix(!showSendMatrix)}
          >
            <Route size={14} />
            Send Matrix
          </button>
        </div>

        <div className="zenith-mixer__header-right">
          <button className="zenith-mixer__header-btn">
            <Plus size={14} />
            Insert
          </button>
          <button className="zenith-mixer__header-btn">
            <Settings size={14} />
          </button>
          <button
            className={`zenith-mixer__panel-toggle ${showEffectsRack ? 'active' : ''}`}
            onClick={() => setShowEffectsRack(!showEffectsRack)}
            title="Toggle Effects Rack"
          >
            {showEffectsRack ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="zenith-mixer__content">
        {/* Channel Strips */}
        <div className="zenith-mixer__channels">
          <div className="zenith-mixer__channels-scroll">
            {/* Track Channels */}
            <div className="zenith-mixer__section">
              {trackChannels.map(track => (
                <MixerChannel
                  key={track.id}
                  track={track}
                  isActive={activeChannelId === track.id}
                  onClick={() => setActiveChannelId(track.id)}
                />
              ))}
            </div>

            {/* Bus Channels */}
            {busChannels.length > 0 && (
              <>
                <div className="zenith-mixer__divider" />
                <div className="zenith-mixer__section">
                  {busChannels.map(track => (
                    <MixerChannel
                      key={track.id}
                      track={track}
                      isActive={activeChannelId === track.id}
                      onClick={() => setActiveChannelId(track.id)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Master Channel */}
            <div className="zenith-mixer__divider zenith-mixer__divider--master" />
            <div className="zenith-mixer__section zenith-mixer__section--master">
              {masterTrack && (
                <MasterChannel
                  track={masterTrack}
                  isActive={activeChannelId === masterTrack.id}
                  onClick={() => setActiveChannelId(masterTrack.id)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Effects Rack Panel */}
        {showEffectsRack && (
          <div className="zenith-mixer__effects-panel">
            <EffectsRack track={activeTrack} />
          </div>
        )}
      </div>

      {/* Send Matrix Overlay */}
      {showSendMatrix && (
        <div className="zenith-mixer__send-overlay">
          <SendMatrix
            tracks={mixerTracks}
            onClose={() => setShowSendMatrix(false)}
          />
        </div>
      )}
    </div>
  );
};

export default Mixer;
