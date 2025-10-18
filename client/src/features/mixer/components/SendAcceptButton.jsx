/**
 * SEND ACCEPT BUTTON
 *
 * Target-based send routing - appears below each channel
 * Shows "Accept send from [active channel]" button
 * FL Studio style with integrated disconnect triangle
 */

import React from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { ArrowUp } from 'lucide-react';
import { Knob } from '@/components/controls/base/Knob';
import './SendAcceptButton.css';

export const SendAcceptButton = ({ targetTrack, sourceTrack }) => {
  const { addSend, removeSend, updateSendLevel, toggleSendPreFader } = useMixerStore();

  // Don't show if:
  // 1. No source (nothing selected)
  // 2. Source is master (master cannot send)
  // 3. Target is same as source (can't send to self)
  // 4. Target is master (cannot receive sends - it's final output)
  if (!sourceTrack ||
      sourceTrack.type === 'master' ||
      sourceTrack.id === targetTrack.id ||
      targetTrack.type === 'master') {
    return null;
  }

  // Check if send exists
  const sends = Array.isArray(sourceTrack.sends) ? sourceTrack.sends : [];
  const existingSend = sends.find(s => s.busId === targetTrack.id);
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

  return (
    <div className="send-accept">
      {isConnected ? (
        /* Connected: Show knob with triangle on top */
        <div className="send-accept__connected">
          {/* Disconnect triangle - positioned on top of knob */}
          <button
            className="send-accept__disconnect-triangle"
            onClick={handleDisconnect}
            title="Disconnect send"
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
      ) : (
        /* Not connected: Show arrow up icon */
        <button
          className="send-accept__arrow"
          onClick={handleConnect}
          title={`Send from ${sourceTrack.name}`}
          style={{ borderColor: sourceTrack.color || '#60a5fa' }}
        >
          <ArrowUp size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};

export default SendAcceptButton;
