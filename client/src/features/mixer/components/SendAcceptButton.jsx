/**
 * SEND ACCEPT BUTTON V3
 *
 * NEW LOGIC:
 * - Shows active track's sends UNDER the target inserts they're connected to
 * - Shows "Connect" button under ALL other available inserts
 * - When you change active track, display updates to show that track's sends
 */

import React from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { ArrowUp } from 'lucide-react';
import { Knob } from '@/components/controls/base/Knob';
import './SendAcceptButton.css';

export const SendAcceptButton = ({ targetTrack, sourceTrack }) => {
  const { addSend, removeSend, updateSendLevel, toggleSendPreFader } = useMixerStore();

  // Don't show for master (master cannot receive sends)
  if (targetTrack.type === 'master') {
    return null;
  }

  // Can't send to self
  if (!sourceTrack || sourceTrack.id === targetTrack.id) {
    return null;
  }

  // Master can't send
  if (sourceTrack.type === 'master') {
    return null;
  }

  // ✅ NEW LOGIC: Check if ACTIVE track is sending to THIS target
  const activeSends = Array.isArray(sourceTrack.sends) ? sourceTrack.sends : [];
  const existingSend = activeSends.find(s => s.busId === targetTrack.id);
  const isConnected = !!existingSend;

  const handleConnect = (e) => {
    e.stopPropagation();
    addSend(sourceTrack.id, targetTrack.id, 0.7, false);
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

  // ✅ CONNECTED: Show send controls with active track's send data
  if (isConnected) {
    return (
      <div className="send-accept-container">
        <div className="send-accept">
          <div className="send-accept__connected">
            {/* Disconnect triangle */}
            <button
              className="send-accept__disconnect-triangle"
              onClick={handleDisconnect}
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

            {/* Target track name label */}
            <div className="send-accept__source-label" title={targetTrack.name}>
              {targetTrack.name}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ NOT CONNECTED: Show connect button
  return (
    <div className="send-accept-container">
      <div className="send-accept">
        <button
          className="send-accept__arrow"
          onClick={handleConnect}
          title={`Send to ${targetTrack.name}`}
          style={{ borderColor: sourceTrack.color || '#60a5fa' }}
        >
          <ArrowUp size={12} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

export default SendAcceptButton;
