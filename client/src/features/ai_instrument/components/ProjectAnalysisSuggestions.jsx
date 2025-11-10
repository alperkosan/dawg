/**
 * Project Analysis Suggestions
 * 
 * Mevcut projeyi analiz ederek AI enstrüman önerileri sunar
 */

import React from 'react';
import './ProjectAnalysisSuggestions.css';

export function ProjectAnalysisSuggestions({ suggestions, analysis, onSelect }) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="ai-suggestions-empty">
        <span className="ai-suggestions-empty__icon">🎯</span>
        <p className="ai-suggestions-empty__text">
          No suggestions available. Start adding instruments to get AI-powered recommendations!
        </p>
      </div>
    );
  }

  return (
    <div className="ai-suggestions">
      {/* Analysis Summary */}
      {analysis && (
        <div className="ai-suggestions__analysis">
          <h3 className="ai-suggestions__analysis-title">Project Analysis</h3>
          <div className="ai-suggestions__analysis-grid">
            {analysis.genres && analysis.genres.length > 0 && (
              <div className="ai-suggestions__analysis-item">
                <span className="ai-suggestions__analysis-label">Genres:</span>
                <span className="ai-suggestions__analysis-value">
                  {analysis.genres.join(', ')}
                </span>
              </div>
            )}
            {analysis.tempo && (
              <div className="ai-suggestions__analysis-item">
                <span className="ai-suggestions__analysis-label">Tempo:</span>
                <span className="ai-suggestions__analysis-value">{analysis.tempo} BPM</span>
              </div>
            )}
            {analysis.key && (
              <div className="ai-suggestions__analysis-item">
                <span className="ai-suggestions__analysis-label">Key:</span>
                <span className="ai-suggestions__analysis-value">{analysis.key}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggestions List */}
      <div className="ai-suggestions__list">
        <h3 className="ai-suggestions__list-title">Suggested Instruments</h3>
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={index}
            suggestion={suggestion}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion, onSelect }) {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'var(--zenith-accent-warm, #ff6b6b)';
      case 'medium':
        return 'var(--zenith-accent-cool, #6B8EBF)';
      case 'low':
        return 'var(--zenith-text-secondary, #94a3b8)';
      default:
        return 'var(--zenith-text-secondary, #94a3b8)';
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      drums: '🥁',
      bass: '🎸',
      lead: '🎹',
      pad: '🎼',
      percussion: '🔔',
      other: '🎵'
    };
    return icons[type] || '🎵';
  };

  return (
    <div className="ai-suggestion-card">
      <div className="ai-suggestion-card__header">
        <div className="ai-suggestion-card__type">
          <span className="ai-suggestion-card__type-icon">
            {getTypeIcon(suggestion.type)}
          </span>
          <span className="ai-suggestion-card__type-name">
            {suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)}
          </span>
        </div>
        <div
          className="ai-suggestion-card__priority"
          style={{ color: getPriorityColor(suggestion.priority) }}
        >
          {suggestion.priority}
        </div>
      </div>

      <p className="ai-suggestion-card__reason">{suggestion.reason}</p>

      <div className="ai-suggestion-card__prompts">
        {suggestion.prompts.slice(0, 3).map((prompt, index) => (
          <button
            key={index}
            className="ai-suggestion-card__prompt-button"
            onClick={() => onSelect && onSelect(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

