/**
 * SEND MATRIX
 *
 * FL Studio-inspired send routing matrix:
 * - Visual grid showing all send connections
 * - Click to toggle send on/off
 * - Knobs to adjust send level
 * - Color-coded for easy visualization
 */

import React from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { X, ArrowRight } from 'lucide-react';
import './SendMatrix.css';

export const SendMatrix = ({ tracks, onClose }) => {
  const { handleSendChange } = useMixerStore();

  const sourceChannels = tracks.filter(t => t.type === 'track');
  const destinationChannels = tracks.filter(t => t.type === 'bus' || t.type === 'master');

  const getSendLevel = (sourceId, destId) => {
    const source = tracks.find(t => t.id === sourceId);
    if (!source || !source.sends) return 0;

    // sends is an object, not an array
    // Check if there's a send with key matching destId
    const sendKey = `send_${destId}`;
    return source.sends[sendKey] !== undefined ? source.sends[sendKey] : 0;
  };

  const handleSendClick = (sourceId, destId) => {
    const currentLevel = getSendLevel(sourceId, destId);
    const newLevel = currentLevel > 0 ? 0 : 0.8; // Toggle between 0 and 80%
    const sendKey = `send_${destId}`;
    handleSendChange(sourceId, sendKey, newLevel);
  };

  const handleSendLevelChange = (sourceId, destId, level) => {
    const sendKey = `send_${destId}`;
    handleSendChange(sourceId, sendKey, level);
  };

  return (
    <div className="send-matrix-overlay">
      <div className="send-matrix">
        {/* Header */}
        <div className="send-matrix__header">
          <h3>Send Routing Matrix</h3>
          <button className="send-matrix__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Matrix Grid */}
        <div className="send-matrix__content">
          <div className="send-matrix__grid">
            {/* Column Headers (Destinations) */}
            <div className="send-matrix__header-row">
              <div className="send-matrix__corner">
                <ArrowRight size={14} />
              </div>
              {destinationChannels.map(dest => (
                <div
                  key={dest.id}
                  className="send-matrix__col-header"
                >
                  <div
                    className="send-matrix__header-color"
                    style={{ backgroundColor: dest.color || '#4b5563' }}
                  />
                  <span>{dest.name}</span>
                </div>
              ))}
            </div>

            {/* Rows (Sources) */}
            {sourceChannels.map(source => (
              <div key={source.id} className="send-matrix__row">
                {/* Row Header */}
                <div className="send-matrix__row-header">
                  <div
                    className="send-matrix__header-color"
                    style={{ backgroundColor: source.color || '#4b5563' }}
                  />
                  <span>{source.name}</span>
                </div>

                {/* Send Cells */}
                {destinationChannels.map(dest => {
                  const sendLevel = getSendLevel(source.id, dest.id);
                  const isActive = sendLevel > 0;

                  return (
                    <div
                      key={`${source.id}-${dest.id}`}
                      className="send-matrix__cell"
                    >
                      <button
                        className={`send-matrix__send-btn ${isActive ? 'active' : ''}`}
                        onClick={() => handleSendClick(source.id, dest.id)}
                        title={isActive ? `Send: ${Math.round(sendLevel * 100)}%` : 'Click to enable send'}
                      >
                        {isActive && (
                          <div className="send-matrix__send-indicator">
                            <div
                              className="send-matrix__send-level"
                              style={{
                                height: `${sendLevel * 100}%`,
                                backgroundColor: source.color || '#4b5563'
                              }}
                            />
                          </div>
                        )}
                      </button>

                      {/* Level Control (appears on hover if active) */}
                      {isActive && (
                        <div className="send-matrix__level-control">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={sendLevel}
                            onChange={(e) => handleSendLevelChange(source.id, dest.id, parseFloat(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span>{Math.round(sendLevel * 100)}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="send-matrix__legend">
          <div className="send-matrix__legend-item">
            <div className="send-matrix__legend-dot send-matrix__legend-dot--off" />
            <span>No Send</span>
          </div>
          <div className="send-matrix__legend-item">
            <div className="send-matrix__legend-dot send-matrix__legend-dot--on" />
            <span>Active Send</span>
          </div>
          <div className="send-matrix__legend-hint">
            Click to toggle • Hover to adjust level
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendMatrix;
