/**
 * SEND ACCEPT BUTTON V3
 *
 * NEW LOGIC:
 * - Shows active track's sends UNDER the target inserts they're connected to
 * - Shows "Connect" button under ALL other available inserts
 * - When you change active track, display updates to show that track's sends
 */

import React from 'react';
import { createPortal } from 'react-dom';
import { useMixerStore } from '@/store/useMixerStore';
import { ArrowUp } from 'lucide-react';
import { Knob } from '@/components/controls/base/Knob';
import './SendAcceptButton.css';

export const SendAcceptButton = ({ targetTrack, sourceTrack }) => {
  const { addSend, removeSend, updateSendLevel, toggleSendPreFader, routeToTrack } = useMixerStore();
  const [showMenu, setShowMenu] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Validation: Check if send is allowed
  const isMasterTarget = targetTrack.type === 'master';
  const isSelf = sourceTrack && sourceTrack.id === targetTrack.id;
  const isSourceMaster = sourceTrack && sourceTrack.type === 'master';

  let disabledReason = null;
  if (isMasterTarget) disabledReason = "Master cannot receive sends";
  else if (isSelf) disabledReason = "Cannot send to itself";
  else if (isSourceMaster) disabledReason = "Master cannot send to other tracks";

  const isDisabled = !!disabledReason;

  if (isDisabled) {
    // ✅ FIX: Show disabled state with tooltip instead of hiding (User Feedback)
    return (
      <div className="send-accept-container">
        <div className="send-accept">
          <button
            className="send-accept__arrow disabled"
            title={disabledReason}
            disabled
            style={{
              borderColor: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.05)',
              background: 'transparent',
              cursor: 'not-allowed'
            }}
          >
            <ArrowUp size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  // Check parallel send connection
  const activeSends = Array.isArray(sourceTrack.sends) ? sourceTrack.sends : [];
  const existingSend = activeSends.find(s => s.busId === targetTrack.id);
  const isConnected = !!existingSend;

  // Check exclusive routing connection
  const isRouted = sourceTrack.output === targetTrack.id;

  const handleConnect = (e) => {
    e.stopPropagation();
    // Default click: Add Parallel Send (Standard behavior)
    // If routing (Submix) is desired, use Right Click or Menu
    if (!isConnected) {
      addSend(sourceTrack.id, targetTrack.id, 0.7, false);
    }
  };

  /* REMOVED LOGS and Updated Routed UI */
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Fallback: trigger menu here if mouseUp didn't
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleMouseUp = (e) => {
    if (e.button === 2) { // Right click
      e.preventDefault();
      e.stopPropagation();
      setMenuPosition({ x: e.clientX, y: e.clientY });
      setShowMenu(true);
    }
  };

  /* ... handlers ... */

  const handleRouteToTrack = (e) => {
    e.stopPropagation();
    routeToTrack(sourceTrack.id, targetTrack.id);
    setShowMenu(false);
  };

  const handleResetRouting = (e) => {
    e.stopPropagation();
    // Reset to master
    routeToTrack(sourceTrack.id, 'master');
    setShowMenu(false);
  };

  const handleSidechain = (e) => {
    e.stopPropagation();
    // Sidechain = Send at 0 volume
    if (!isConnected) {
      addSend(sourceTrack.id, targetTrack.id, 0.0, true); // Pre-fader usually better for SC
    }
    setShowMenu(false);
  };

  const handleDisconnect = (e) => {
    e.stopPropagation();
    removeSend(sourceTrack.id, targetTrack.id);
  };

  const handleLevelChange = (level) => {
    updateSendLevel(sourceTrack.id, targetTrack.id, level / 100);
  };

  const handlePreFaderToggle = (e) => {
    e.stopPropagation();
    toggleSendPreFader(sourceTrack.id, targetTrack.id);
  };

  // Menu Component (Portaled to break stacking contexts)
  const Menu = () => createPortal(
    <div
      ref={menuRef}
      className="send-accept__menu"
      style={{ left: menuPosition.x, top: menuPosition.y, zIndex: 99999 }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button className="send-accept__menu-item" onClick={handleRouteToTrack}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', marginRight: 4 }}></div>
        Route to this track only
      </button>
      <button className="send-accept__menu-item" onClick={handleSidechain}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', marginRight: 4 }}></div>
        Sidechain to this track
      </button>
      {(isConnected || isRouted) && (
        <>
          <div className="send-accept__menu-separator" />
          {isRouted && (
            <button className="send-accept__menu-item" onClick={handleResetRouting}>
              Reset Routing (to Master)
            </button>
          )}
          {isConnected && (
            <button className="send-accept__menu-item danger" onClick={() => { handleDisconnect({ stopPropagation: () => { } }); setShowMenu(false); }}>
              Disconnect Send
            </button>
          )}
        </>
      )}
    </div>,
    document.body
  );

  // ✅ CONNECTED (Parallel Send)
  if (isConnected) {
    return (
      <div className="send-accept-container" onContextMenu={handleContextMenu} onMouseUp={handleMouseUp}>
        {showMenu && <Menu />}
        <div className="send-accept">
          <div className="send-accept__connected">
            {/* Disconnect triangle */}
            <button
              className="send-accept__disconnect-triangle"
              onClick={handleDisconnect}
              onContextMenu={handleContextMenu} // ✅ Ensure context menu works on button
              title={`Disconnect from ${targetTrack.name}`}
              style={{ borderBottomColor: sourceTrack.color || '#60a5fa' }}
            />

            {/* Knob container with cable indicator */}
            <div className="send-accept__knob-container">
              <div
                className="send-accept__cable"
                style={{ backgroundColor: sourceTrack.color || '#60a5fa' }}
              />
              <Knob
                value={existingSend.level * 100}
                min={0}
                max={100}
                onChange={handleLevelChange}
                size={24}
                showValue={false}
                variant="mixer"
              />
            </div>

            {/* Level percentage */}
            <div className="send-accept__level">
              {Math.round(existingSend.level * 100)}
            </div>

            {/* Pre/Post fader toggle */}
            <button
              className={`send-accept__pre-post ${existingSend.preFader ? 'pre' : 'post'}`}
              onClick={handlePreFaderToggle}
              title={existingSend.preFader ? 'Pre-fader (before volume)' : 'Post-fader (after volume)'}
            >
              {existingSend.preFader ? 'PRE' : 'POST'}
            </button>

          </div>
        </div>
      </div>
    );
  }

  // ✅ ROUTED (Exclusive) - Submix Connection
  if (isRouted) {
    return (
      <div className="send-accept-container" onContextMenu={handleContextMenu} onMouseUp={handleMouseUp}>
        {showMenu && <Menu />}
        <div className="send-accept">
          <div className="send-accept__connected">
            {/* Reset Routing Triangle - clearly visible */}
            <button
              className="send-accept__disconnect-triangle"
              onClick={handleResetRouting}
              onContextMenu={handleContextMenu}
              onMouseUp={handleMouseUp}
              title="Reset routing to Master"
              style={{ borderBottomColor: '#22c55e' }}
            />

            {/* Knob container with Green Cable */}
            <div className="send-accept__knob-container">
              <div
                className="send-accept__cable"
                style={{ backgroundColor: '#22c55e' }}
              />
              <Knob
                value={100}
                min={0}
                max={100}
                onChange={() => { }} // Read-only
                size={24}
                showValue={false}
                variant="mixer"
                color="#22c55e"
              />
            </div>

            {/* Indicator Label */}
            <div className="send-accept__level" style={{ color: '#22c55e' }}>
              100%
            </div>

            {/* Route Badge */}
            <div
              className="send-accept__pre-post"
              style={{
                color: '#22c55e',
                borderColor: 'rgba(34, 197, 94, 0.3)',
                cursor: 'default',
                fontSize: 9
              }}
              title="Exclusive Route (Output to this track)"
            >
              ROUTE
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ NOT CONNECTED: Show connect button
  return (
    <div className="send-accept-container" onContextMenu={handleContextMenu}>
      {showMenu && <Menu />}
      <div className="send-accept">
        <button
          className="send-accept__arrow"
          onClick={handleConnect}
          onContextMenu={handleContextMenu}
          onMouseUp={handleMouseUp}
          title={`Send to ${targetTrack.name} (Right-click for options)`}
          style={{ borderColor: sourceTrack.color || '#60a5fa' }}
        >
          <ArrowUp size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

export default SendAcceptButton;
