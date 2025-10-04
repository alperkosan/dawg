/**
 *  PATTERN LIBRARY
 *
 * Simple pattern browser:
 * - List all patterns from project
 * - Search functionality
 * - Drag and drop to arrangement timeline
 */

import React, { useState, useMemo } from 'react';
import { Search, Music } from 'lucide-react';
import { useArrangementStore } from '../../../store/useArrangementStore';

const PatternLibrary = () => {
  const { patterns } = useArrangementStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedPattern, setDraggedPattern] = useState(null);

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

  // =================== RENDER ===================

  return (
    <div className="pattern-library">
      {/* Header */}
      <div className="pattern-library__header">
        <h3 className="pattern-library__title">
          <Music size={16} />
          Patterns
        </h3>
        <div className="pattern-library__stats">
          {filteredPatterns.length}
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

      {/* Pattern List */}
      <div className="pattern-library__list">
        {filteredPatterns.length === 0 ? (
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
                    {pattern.length || 4} bars
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default PatternLibrary;
export { PatternLibrary };
