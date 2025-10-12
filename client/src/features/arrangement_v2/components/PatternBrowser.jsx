/**
 * 🎹 PATTERN BROWSER
 *
 * Simple pattern library browser for ArrangementV2
 * - Lists all available patterns
 * - Drag & drop to arrangement
 */

import React from 'react';
import { useArrangementStore } from '@/store/useArrangementStore';
import './PatternBrowser.css';

export function PatternBrowser() {
  const patterns = useArrangementStore(state => state.patterns);
  const patternOrder = useArrangementStore(state => state.patternOrder);

  const handleDragStart = (e, patternId) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-dawg-pattern', patternId);
  };

  return (
    <div
      className="pattern-browser"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="pattern-browser-header">
        <h3>Patterns</h3>
      </div>
      <div className="pattern-browser-list">
        {patternOrder.map(patternId => {
          const pattern = patterns[patternId];
          if (!pattern) return null;

          const noteCount = Object.values(pattern.data || {})
            .reduce((sum, notes) => sum + (Array.isArray(notes) ? notes.length : 0), 0);

          return (
            <div
              key={patternId}
              className="pattern-browser-item"
              draggable
              onDragStart={(e) => handleDragStart(e, patternId)}
            >
              <div className="pattern-icon">🎹</div>
              <div className="pattern-info">
                <div className="pattern-name">{pattern.name}</div>
                <div className="pattern-details">
                  {noteCount} notes • {pattern.length || 16} steps
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
