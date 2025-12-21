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
 * - Virtualized channel list for performance
 * - Centralized meter service
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { useMixerUIStore } from '@/store/useMixerUIStore';
import {
  SlidersHorizontal,
  Plus,
  Settings,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import ShortcutManager, { SHORTCUT_PRIORITY } from '@/lib/core/ShortcutManager';
import { MixerChannel } from './components/MixerChannel';
import { EffectsRack } from './components/EffectsRack';
import { MixerPrimaryMeter } from './components/MixerPrimaryMeter';
import { ColorPicker } from './components/ColorPicker';
import './Mixer.css';



const Mixer = ({ isVisible = true }) => {
  const [showEffectsRack, setShowEffectsRack] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef(null);

  // ✅ OPTIMIZATION: Global color picker state
  const [colorPickerState, setColorPickerState] = useState({
    isOpen: false,
    trackId: null,
    position: { top: 0, left: 0 }
  });

  // ✅ PERFORMANCE OPTIMIZATION: Use memoized selectors
  // Only re-render when mixer tracks array changes (not on individual track updates)
  const mixerTracks = useMixerStore(state => state.mixerTracks);

  // ✅ PERFORMANCE: Subscribe to actions individually (stable references)
  const addTrack = useMixerStore(state => state.addTrack);
  const removeTrack = useMixerStore(state => state.removeTrack);
  const toggleMute = useMixerStore(state => state.toggleMute);
  const toggleSolo = useMixerStore(state => state.toggleSolo);
  const setTrackColor = useMixerStore(state => state.setTrackColor);

  // UI state - subscribe to specific values only
  const activeChannelId = useMixerUIStore(state => state.activeChannelId);
  const setActiveChannelId = useMixerUIStore(state => state.setActiveChannelId);

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

  // ✅ FIX: Memoize navigateChannel to avoid recreating on every render
  const navigateChannel = useCallback((direction) => {
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
  }, [mixerTracks, activeChannelId, setActiveChannelId]);

  // ✅ OPTIMIZATION: Handle color picker requests from channels
  const handleChannelClick = useCallback((trackId) => (event) => {
    if (event?.type === 'color-picker') {
      const { rect } = event;
      const pickerWidth = 172;
      const pickerHeight = 130;

      // Calculate position relative to viewport
      let left = rect.left - 2;
      let top = rect.bottom + 2;

      // Constrain to viewport
      const maxLeft = window.innerWidth - pickerWidth - 4;
      const maxTop = window.innerHeight - pickerHeight - 4;

      left = Math.max(4, Math.min(left, maxLeft));

      // If doesn't fit below, show above
      if (top + pickerHeight > window.innerHeight - 4) {
        top = rect.top - pickerHeight - 2;
      }
      top = Math.max(4, Math.min(top, maxTop));

      setColorPickerState({
        isOpen: true,
        trackId,
        position: { top, left }
      });
    } else {
      // Regular click - select channel
      setActiveChannelId(trackId);
    }
  }, [setActiveChannelId]);

  const handleColorSelect = useCallback((color) => {
    if (colorPickerState.trackId) {
      setTrackColor(colorPickerState.trackId, color);
      setColorPickerState(prev => ({ ...prev, isOpen: false }));
    }
  }, [colorPickerState.trackId, setTrackColor]);

  const handleColorPickerClose = useCallback(() => {
    setColorPickerState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // ✅ KEYBOARD SHORTCUTS MIGRATION
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input field (handled by manager, but extra safety)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return false;
      }

      const activeTrack = mixerTracks.find(t => t.id === activeChannelId);
      if (!activeTrack) return false;

      switch (e.key.toLowerCase()) {
        case 'm':
          e.preventDefault();
          toggleMute(activeChannelId);
          return true;

        case 'delete':
        case 'backspace':
          if (activeTrack.type !== 'master') {
            e.preventDefault();
            if (window.confirm(`Delete ${activeTrack.name}?`)) {
              removeTrack(activeChannelId);
            }
          }
          return true;

        case 'arrowleft':
          e.preventDefault();
          navigateChannel(-1);
          return true;

        case 'arrowright':
          e.preventDefault();
          navigateChannel(1);
          return true;

        default:
          break;
      }
      return false;
    };

    ShortcutManager.registerContext('MIXER', SHORTCUT_PRIORITY.CONTEXTUAL, {
      onKeyDown: handleKeyDown
    });

    return () => ShortcutManager.unregisterContext('MIXER');
  }, [activeChannelId, mixerTracks, toggleMute, toggleSolo, removeTrack, navigateChannel]);

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
        {/* Primary Meter (left) */}
        <div className="mixer-2__primary-panel">
          <MixerPrimaryMeter activeTrack={activeTrack} masterTrack={masterTrack} />
        </div>

        {/* Mixer Channels */}
        {/* Mixer Channels */}
        <div className="mixer-2__channels-container">
          <div className="mixer-2__channels">
            {/* Master Channel (Pinned) */}
            {masterTrack && (
              <>
                <div className="mixer-2__separator">
                  <div className="mixer-2__separator-line" />
                  <div className="mixer-2__separator-label">MASTER</div>
                </div>
                <MixerChannel
                  key={masterTrack.id}
                  trackId={masterTrack.id}
                  allTracks={allTracksOrdered}
                  activeTrackId={activeChannelId}
                  isActive={activeChannelId === masterTrack.id}
                  isMaster={true}
                  onClick={handleChannelClick(masterTrack.id)}
                  isVisible={isVisible}
                />
              </>
            )}

            {/* Bus Channels */}
            {busTracks.length > 0 && (
              <>
                <div className="mixer-2__separator">
                  <div className="mixer-2__separator-line" />
                  <div className="mixer-2__separator-label">BUSES</div>
                </div>
                {busTracks.map(track => (
                  <MixerChannel
                    key={track.id}
                    trackId={track.id}
                    allTracks={allTracksOrdered}
                    activeTrackId={activeChannelId}
                    isActive={activeChannelId === track.id}
                    isMaster={false}
                    onClick={handleChannelClick(track.id)}
                    isVisible={isVisible}
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
                trackId={track.id}
                allTracks={allTracksOrdered}
                activeTrackId={activeChannelId}
                isActive={activeChannelId === track.id}
                isMaster={false}
                onClick={handleChannelClick(track.id)}
                isVisible={isVisible}
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

      {/* ✅ OPTIMIZATION: Global Color Picker */}
      <ColorPicker
        isOpen={colorPickerState.isOpen}
        position={colorPickerState.position}
        currentColor={mixerTracks.find(t => t.id === colorPickerState.trackId)?.color}
        onColorSelect={handleColorSelect}
        onClose={handleColorPickerClose}
      />
    </div>
  );
};

export default Mixer;