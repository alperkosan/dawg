/**
 *  PATTERN LIBRARY
 *
 * Simple pattern browser:
 * - List all patterns from project
 * - Search functionality
 * - Drag and drop to arrangement timeline
 */

import React, { useState, useMemo } from 'react';
import { Search, Music, Volume2 } from 'lucide-react';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';

const PatternLibrary = () => {
  const { patterns } = useArrangementStore();
  const { instruments } = useInstrumentsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedPattern, setDraggedPattern] = useState(null);
  const [draggedSample, setDraggedSample] = useState(null);
  const [activeTab, setActiveTab] = useState('patterns'); // 'patterns' or 'samples'

  // Filter patterns by search query
  const filteredPatterns = useMemo(() => {
    // Convert patterns object to array
    const patternsArray = patterns && typeof patterns === 'object'
      ? Object.values(patterns)
      : [];

    if (patternsArray.length === 0) return [];

    if (!searchQuery.trim()) return patternsArray;

    const query = searchQuery.toLowerCase();
    return patternsArray.filter(pattern =>
      pattern.name?.toLowerCase().includes(query)
    );
  }, [patterns, searchQuery]);

  // Filter audio samples (instruments with audioBuffer)
  const audioSamples = useMemo(() => {
    const samplesArray = instruments.filter(inst => inst.audioBuffer || inst.type === 'sampler');

    if (!searchQuery.trim()) return samplesArray;

    const query = searchQuery.toLowerCase();
    return samplesArray.filter(sample =>
      sample.name?.toLowerCase().includes(query)
    );
  }, [instruments, searchQuery]);

  // =================== EVENT HANDLERS ===================

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handlePatternDragStart = (e, pattern) => {
    setDraggedPattern(pattern);
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'pattern',
      patternId: pattern.id,
      source: 'library'
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handlePatternDragEnd = () => {
    setDraggedPattern(null);
  };

  const handleSampleDragStart = (e, sample) => {
    setDraggedSample(sample);
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'audio',
      sampleId: sample.id,
      sampleName: sample.name,
      audioBuffer: sample.audioBuffer ? 'present' : null,
      source: 'library'
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleSampleDragEnd = () => {
    setDraggedSample(null);
  };

  // =================== RENDER ===================

  return (
    <div className="pattern-library">
      {/* Header with Tabs */}
      <div className="pattern-library__header">
        <div className="pattern-library__tabs">
          <button
            className={`pattern-library__tab ${activeTab === 'patterns' ? 'active' : ''}`}
            onClick={() => setActiveTab('patterns')}
          >
            <Music size={14} />
            Patterns ({filteredPatterns.length})
          </button>
          <button
            className={`pattern-library__tab ${activeTab === 'samples' ? 'active' : ''}`}
            onClick={() => setActiveTab('samples')}
          >
            <Volume2 size={14} />
            Samples ({audioSamples.length})
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="pattern-library__search">
        <div className="pattern-library__search-input">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search patterns..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Content List */}
      <div className="pattern-library__list">
        {activeTab === 'patterns' ? (
          // Patterns Tab
          filteredPatterns.length === 0 ? (
            <div className="pattern-library__empty">
              <Music size={32} />
              <p>No patterns</p>
              <small>Create patterns in Piano Roll</small>
            </div>
          ) : (
            filteredPatterns.map(pattern => {
              const isDragging = draggedPattern?.id === pattern.id;

              return (
                <div
                  key={pattern.id}
                  className={`pattern-library__item ${
                    isDragging ? 'pattern-library__item--dragging' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handlePatternDragStart(e, pattern)}
                  onDragEnd={handlePatternDragEnd}
                  title="Drag to timeline"
                >
                  <div className="pattern-library__item-icon">
                    <Music size={16} />
                  </div>
                  <div className="pattern-library__item-info">
                    <div className="pattern-library__item-name">
                      {pattern.name}
                    </div>
                    <div className="pattern-library__item-meta">
                      {Math.round((pattern.length || 64) / 4)} bars
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          // Samples Tab
          audioSamples.length === 0 ? (
            <div className="pattern-library__empty">
              <Volume2 size={32} />
              <p>No audio samples</p>
              <small>Load samples from browser</small>
            </div>
          ) : (
            audioSamples.map(sample => {
              const isDragging = draggedSample?.id === sample.id;

              return (
                <div
                  key={sample.id}
                  className={`pattern-library__item ${
                    isDragging ? 'pattern-library__item--dragging' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleSampleDragStart(e, sample)}
                  onDragEnd={handleSampleDragEnd}
                  title="Drag to timeline as audio clip"
                >
                  <div className="pattern-library__item-icon" style={{ color: '#f59e0b' }}>
                    <Volume2 size={16} />
                  </div>
                  <div className="pattern-library__item-info">
                    <div className="pattern-library__item-name">
                      {sample.name}
                    </div>
                    <div className="pattern-library__item-meta">
                      Audio Sample
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
};

export default PatternLibrary;
export { PatternLibrary };
