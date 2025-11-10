/**
 * Variation Selector
 * 
 * Üretilen varyasyonları gösterir ve seçim yapılmasını sağlar
 */

import React, { useState, useRef } from 'react';
import './VariationSelector.css';

export function VariationSelector({ variations, selectedIndex, onSelect }) {
  const [previewingIndex, setPreviewingIndex] = useState(null);
  const audioRefs = useRef({});

  const handlePreview = async (index, variation) => {
    // Stop other previews
    Object.values(audioRefs.current).forEach(audio => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    if (previewingIndex === index) {
      // Stop current preview
      if (audioRefs.current[index]) {
        audioRefs.current[index].pause();
        audioRefs.current[index].currentTime = 0;
      }
      setPreviewingIndex(null);
      return;
    }

    // Start new preview
    try {
      // TODO: Create audio element from AudioBuffer when API is available
      // For now, just show preview state
      setPreviewingIndex(index);
      
      // Mock preview (will be replaced with real audio playback)
      setTimeout(() => {
        setPreviewingIndex(null);
      }, 2000);
    } catch (error) {
      console.error('Preview failed:', error);
      setPreviewingIndex(null);
    }
  };

  return (
    <div className="ai-variation-selector">
      <h3 className="ai-variation-selector__title">
        Variations ({variations.length})
      </h3>
      <div className="ai-variation-selector__grid">
        {variations.map((variation, index) => (
          <VariationCard
            key={variation.id || index}
            variation={variation}
            index={index}
            selected={index === selectedIndex}
            previewing={index === previewingIndex}
            onSelect={() => onSelect && onSelect(index)}
            onPreview={() => handlePreview(index, variation)}
          />
        ))}
      </div>
    </div>
  );
}

function VariationCard({ variation, index, selected, previewing, onSelect, onPreview }) {
  return (
    <div
      className={`ai-variation-card ${selected ? 'selected' : ''} ${
        previewing ? 'previewing' : ''
      }`}
      onClick={onSelect}
    >
      <div className="ai-variation-card__header">
        <span className="ai-variation-card__number">#{index + 1}</span>
        {variation.duration && (
          <span className="ai-variation-card__duration">
            {variation.duration.toFixed(1)}s
          </span>
        )}
      </div>

      <div className="ai-variation-card__prompt">
        {variation.prompt}
      </div>

      <div className="ai-variation-card__actions">
        <button
          className="ai-variation-card__preview-button"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
        >
          {previewing ? '⏸️' : '▶️'} Preview
        </button>
        {selected && (
          <span className="ai-variation-card__selected-badge">Selected</span>
        )}
      </div>

      {/* Waveform visualization placeholder */}
      <div className="ai-variation-card__waveform">
        <div className="ai-variation-card__waveform-bars">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="ai-variation-card__waveform-bar"
              style={{
                height: `${Math.random() * 60 + 20}%`,
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

