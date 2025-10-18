/**
 * MIXER - FL Studio Style Mixer with Cable Routing
 *
 * Features:
 * - Master channel first (left-most)
 * - Clean channel strips with real-time dB meters
 * - Target-based send routing (click target to accept send)
 * - Insert routing with loop prevention
 * - Pre/Post fader sends
 * - Effect chain reordering (drag & drop)
 * - Throttled controls for performance
 * - Centralized meter service
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import {
  SlidersHorizontal,
  Plus,
  Settings,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { MixerChannel } from './components/MixerChannel';
import { EffectsRack } from './components/EffectsRack';
import './Mixer.css';

const Mixer = () => {
  const [showEffectsRack, setShowEffectsRack] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef(null);

  const {
    mixerTracks,
    activeChannelId,
    setActiveChannelId,
    addTrack,
    removeTrack,
    toggleMute,
    toggleSolo
  } = useMixerStore();

  // Close add menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setShowAddMenu(false);
      }
    };

    if (showAddMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAddMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const activeTrack = mixerTracks.find(t => t.id === activeChannelId);
      if (!activeTrack) return;

      switch (e.key.toLowerCase()) {
        case 'm':
          e.preventDefault();
          toggleMute(activeChannelId);
          break;

        case 's':
          e.preventDefault();
          toggleSolo(activeChannelId);
          break;

        case 'delete':
        case 'backspace':
          if (activeTrack.type !== 'master') {
            e.preventDefault();
            if (window.confirm(`Delete ${activeTrack.name}?`)) {
              removeTrack(activeChannelId);
            }
          }
          break;

        case 'arrowleft':
          e.preventDefault();
          navigateChannel(-1);
          break;

        case 'arrowright':
          e.preventDefault();
          navigateChannel(1);
          break;

        default:
          break;
      }
    };

    const navigateChannel = (direction) => {
      const allTracksOrdered = [
        ...mixerTracks.filter(t => t.type === 'track'),
        ...mixerTracks.filter(t => t.type === 'master'),
        ...mixerTracks.filter(t => t.type === 'bus')
      ];

      const currentIndex = allTracksOrdered.findIndex(t => t.id === activeChannelId);
      if (currentIndex === -1) return;

      const newIndex = currentIndex + direction;
      if (newIndex >= 0 && newIndex < allTracksOrdered.length) {
        setActiveChannelId(allTracksOrdered[newIndex].id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeChannelId, mixerTracks, toggleMute, toggleSolo, removeTrack, setActiveChannelId]);

  const handleAddTrack = () => {
    addTrack('track');
    setShowAddMenu(false);
  };

  const handleAddBus = () => {
    addTrack('bus');
    setShowAddMenu(false);
  };

  // Organize tracks: Tracks first, then Master, then Buses
  const { masterTrack, regularTracks, busTracks } = useMemo(() => {
    const master = mixerTracks.find(t => t.type === 'master');
    const tracks = mixerTracks.filter(t => t.type === 'track');
    const buses = mixerTracks.filter(t => t.type === 'bus');

    return {
      masterTrack: master,
      regularTracks: tracks,
      busTracks: buses
    };
  }, [mixerTracks]);

  // All tracks in display order: Tracks, Master, Buses
  const allTracksOrdered = useMemo(() => {
    return [
      ...regularTracks,
      ...(masterTrack ? [masterTrack] : []),
      ...busTracks
    ];
  }, [masterTrack, regularTracks, busTracks]);

  const activeTrack = useMemo(() =>
    mixerTracks.find(t => t.id === activeChannelId),
    [mixerTracks, activeChannelId]
  );

  return (
    <div className="mixer-2">
      {/* Header */}
      <div className="mixer-2__header">
        <div className="mixer-2__header-center">
          <div className="mixer-2__shortcuts-hint">
            <kbd>M</kbd> Mute
            <kbd>S</kbd> Solo
            <kbd>←→</kbd> Navigate
            <kbd>Del</kbd> Remove
          </div>
        </div>

        <div className="mixer-2__header-right">
          <div className="mixer-2__add-channel-container" ref={addMenuRef}>
            <button
              className="mixer-2__header-btn"
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <Plus size={14} />
              Add Channel
            </button>
            {showAddMenu && (
              <div className="mixer-2__add-menu">
                <button
                  className="mixer-2__add-menu-item"
                  onClick={handleAddTrack}
                >
                  <Plus size={14} />
                  <div className="mixer-2__add-menu-info">
                    <div className="mixer-2__add-menu-title">Audio Track</div>
                    <div className="mixer-2__add-menu-desc">Standard mixer channel</div>
                  </div>
                </button>
                <button
                  className="mixer-2__add-menu-item"
                  onClick={handleAddBus}
                >
                  <Plus size={14} />
                  <div className="mixer-2__add-menu-info">
                    <div className="mixer-2__add-menu-title">Bus Channel</div>
                    <div className="mixer-2__add-menu-desc">Group/submix channel</div>
                  </div>
                </button>
              </div>
            )}
          </div>
          <button className="mixer-2__header-btn">
            <Settings size={14} />
          </button>
          <button
            className={`mixer-2__panel-toggle ${showEffectsRack ? 'active' : ''}`}
            onClick={() => setShowEffectsRack(!showEffectsRack)}
            title="Toggle Effects Rack"
          >
            {showEffectsRack ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="mixer-2__content">
        {/* Mixer Channels */}
        <div className="mixer-2__channels-container">
          <div className="mixer-2__channels">
            {/* Master Channel with left separator */}
            {masterTrack && (
              <>
                <div className="mixer-2__separator">
                  <div className="mixer-2__separator-line" />
                  <div className="mixer-2__separator-label">MASTER</div>
                </div>
                <MixerChannel
                  key={masterTrack.id}
                  track={masterTrack}
                  allTracks={allTracksOrdered}
                  activeTrack={activeTrack}
                  isActive={activeChannelId === masterTrack.id}
                  isMaster={true}
                  onClick={() => setActiveChannelId(masterTrack.id)}
                />
              </>
            )}

            {/* Bus Channels with left separator */}
            {busTracks.length > 0 && (
              <>
                <div className="mixer-2__separator">
                  <div className="mixer-2__separator-line" />
                  <div className="mixer-2__separator-label">BUSES</div>
                </div>
                {busTracks.map(track => (
                  <MixerChannel
                    key={track.id}
                    track={track}
                    allTracks={allTracksOrdered}
                    activeTrack={activeTrack}
                    isActive={activeChannelId === track.id}
                    isMaster={false}
                    onClick={() => setActiveChannelId(track.id)}
                  />
                ))}
              </>
            )}

            {/* Regular Tracks */}
            <div className="mixer-2__separator">
              <div className="mixer-2__separator-line" />
              <div className="mixer-2__separator-label">TRACKS</div>
            </div>
            {regularTracks.map(track => (
              <MixerChannel
                key={track.id}
                track={track}
                allTracks={allTracksOrdered}
                activeTrack={activeTrack}
                isActive={activeChannelId === track.id}
                isMaster={false}
                onClick={() => setActiveChannelId(track.id)}
              />
            ))}
          </div>
        </div>

        {/* Right: Effects Rack */}
        {showEffectsRack && (
          <div className="mixer-2__effects-panel">
            <EffectsRack track={activeTrack} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Mixer;
