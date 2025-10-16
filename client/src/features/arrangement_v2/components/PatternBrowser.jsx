/**
 * 🎹 PATTERN BROWSER
 *
 * Pattern and Audio library browser for ArrangementV2
 * - Lists all available patterns
 * - Lists project-generated audio (frozen patterns, stems, bounces)
 * - Drag & drop to arrangement
 * - Tabbed interface: Patterns | Audio
 */

import React, { useState } from 'react';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useProjectAudioStore } from '@/store/useProjectAudioStore';
import { usePanelsStore } from '@/store/usePanelsStore';
import './PatternBrowser.css';

export function PatternBrowser() {
  const [activeTab, setActiveTab] = useState('patterns');

  const patterns = useArrangementStore(state => state.patterns);
  const patternOrder = useArrangementStore(state => state.patternOrder);

  // Samples are now stored as array - stable reference
  const audioSamples = useProjectAudioStore(state => state.samples);

  const handleDragStart = (e, patternId) => {
    console.log('🎯 PatternBrowser handleDragStart called!');

    // CRITICAL FIX: Stop event propagation to prevent DraggableWindow from interfering
    e.stopPropagation();

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-dawg-pattern', patternId);

    console.log('✅ Drag data set:', patternId);
  };

  const handleAudioDragStart = (e, sample) => {
    console.log('🎯 Audio drag start called!');

    // CRITICAL FIX: Stop event propagation to prevent DraggableWindow from interfering
    e.stopPropagation();

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/x-dawg-audio', sample.assetId);

    console.log('✅ Audio drag data set:', sample.assetId);
  };

  return (
    <div
      className="pattern-browser"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="pattern-browser-header">
        <div className="pattern-browser-tabs">
          <button
            className={`pattern-browser-tab ${activeTab === 'patterns' ? 'active' : ''}`}
            onClick={() => setActiveTab('patterns')}
          >
            Patterns
          </button>
          <button
            className={`pattern-browser-tab ${activeTab === 'audio' ? 'active' : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            Audio
          </button>
        </div>
      </div>

      <div className="pattern-browser-list">
        {activeTab === 'patterns' ? (
          // PATTERNS TAB
          patternOrder.map(patternId => {
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
          })
        ) : (
          // AUDIO TAB
          audioSamples.length > 0 ? (
            audioSamples.map(sample => (
              <div
                key={sample.id}
                className="pattern-browser-item"
                draggable
                onDragStart={(e) => handleAudioDragStart(e, sample)}
              >
                <div className="pattern-icon">
                  {sample.type === 'frozen' ? '❄️' : sample.type === 'stem' ? '🎚️' : '🔊'}
                </div>
                <div className="pattern-info">
                  <div className="pattern-name">{sample.name}</div>
                  <div className="pattern-details">
                    {sample.durationBeats?.toFixed(1) || '?'} beats • {sample.type}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="pattern-browser-empty">
              <p>No audio samples yet</p>
              <p className="pattern-browser-empty-hint">
                Freeze patterns to create audio clips
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
