/**
 * INSERT ROUTING SELECTOR
 *
 * Simple dropdown to select insert output target
 * - Shows current output target
 * - Click to open menu
 * - Select new target
 * - Prevents circular routing
 */

import React, { useState, useRef, useEffect } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { ChevronDown } from 'lucide-react';
import './InsertRoutingSelector.css';

export const InsertRoutingSelector = ({ track }) => {
  const { mixerTracks, setTrackOutput } = useMixerStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Current output target
  const currentOutputId = track.output || track.outputTarget || 'master';
  const currentOutput = mixerTracks.find(t => t.id === currentOutputId);

  // Helper: check if routing would create a loop
  const wouldCreateLoop = (sourceId, targetId) => {
    const visited = new Set();

    const checkRoute = (currentId) => {
      if (currentId === sourceId) return true; // Loop detected!
      if (visited.has(currentId)) return false;
      visited.add(currentId);

      const currentTrack = mixerTracks.find(t => t.id === currentId);
      if (!currentTrack) return false;

      const nextTarget = currentTrack.output || currentTrack.outputTarget;
      if (nextTarget && nextTarget !== 'master') {
        return checkRoute(nextTarget);
      }

      return false;
    };

    return checkRoute(targetId);
  };

  // Available targets (all channels except self, excluding ones that would create loops)
  const availableTargets = mixerTracks.filter(t => {
    if (t.id === track.id) return false; // Can't route to self
    if (wouldCreateLoop(track.id, t.id)) return false; // Would create circular routing
    return true;
  });

  const handleSelectTarget = (targetId) => {
    setTrackOutput(track.id, targetId);
    setShowMenu(false);
  };

  return (
    <div className="insert-routing-selector" ref={menuRef}>
      <div className="insert-routing-selector__label">OUT</div>

      <button
        className="insert-routing-selector__button"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        style={{
          borderColor: currentOutput?.color || '#4b5563',
          color: currentOutput?.color || '#a0a0a0'
        }}
      >
        <span className="insert-routing-selector__button-text">
          {currentOutput?.name || 'Master'}
        </span>
        <ChevronDown
          size={12}
          style={{
            transform: showMenu ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        />
      </button>

      {showMenu && (
        <div className="insert-routing-selector__menu">
          {availableTargets.map(target => {
            const isActive = target.id === currentOutputId;

            return (
              <button
                key={target.id}
                className={`insert-routing-selector__menu-item ${isActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectTarget(target.id);
                }}
              >
                <div
                  className="insert-routing-selector__menu-color"
                  style={{ backgroundColor: target.color || '#4b5563' }}
                />
                <div className="insert-routing-selector__menu-info">
                  <div className="insert-routing-selector__menu-name">
                    {target.name}
                  </div>
                  <div className="insert-routing-selector__menu-type">
                    {target.type}
                  </div>
                </div>
                {isActive && (
                  <div className="insert-routing-selector__menu-check">✓</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InsertRoutingSelector;
