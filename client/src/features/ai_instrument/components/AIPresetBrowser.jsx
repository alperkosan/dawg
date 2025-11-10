/**
 * AI Preset Browser
 * 
 * Preset'leri kategorilere göre gösterir ve seçim yapılmasını sağlar
 */

import React, { useState, useMemo } from 'react';
import { AI_PRESETS } from '@/lib/ai/AIPresets';
import './AIPresetBrowser.css';

export function AIPresetBrowser({ onSelect }) {
  const [selectedCategory, setSelectedCategory] = useState('drums');
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);

  const categories = Object.keys(AI_PRESETS);
  const subcategories = useMemo(() => {
    if (!selectedCategory || !AI_PRESETS[selectedCategory]) return [];
    return Object.keys(AI_PRESETS[selectedCategory]);
  }, [selectedCategory]);

  const presets = useMemo(() => {
    if (!selectedCategory || !AI_PRESETS[selectedCategory]) return [];
    if (selectedSubcategory && AI_PRESETS[selectedCategory][selectedSubcategory]) {
      return AI_PRESETS[selectedCategory][selectedSubcategory];
    }
    // If no subcategory selected, show all presets from category
    return Object.values(AI_PRESETS[selectedCategory]).flat();
  }, [selectedCategory, selectedSubcategory]);

  const handlePresetClick = (preset) => {
    if (onSelect) {
      onSelect(preset);
    }
  };

  return (
    <div className="ai-preset-browser">
      {/* Category Tabs */}
      <div className="ai-preset-browser__categories">
        {categories.map((category) => (
          <button
            key={category}
            className={`ai-preset-browser__category-tab ${
              selectedCategory === category ? 'active' : ''
            }`}
            onClick={() => {
              setSelectedCategory(category);
              setSelectedSubcategory(null);
            }}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      {/* Subcategory Tabs (if available) */}
      {subcategories.length > 0 && (
        <div className="ai-preset-browser__subcategories">
          <button
            className={`ai-preset-browser__subcategory-tab ${
              selectedSubcategory === null ? 'active' : ''
            }`}
            onClick={() => setSelectedSubcategory(null)}
          >
            All
          </button>
          {subcategories.map((subcategory) => (
            <button
              key={subcategory}
              className={`ai-preset-browser__subcategory-tab ${
                selectedSubcategory === subcategory ? 'active' : ''
              }`}
              onClick={() => setSelectedSubcategory(subcategory)}
            >
              {subcategory.charAt(0).toUpperCase() + subcategory.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Preset Grid */}
      <div className="ai-preset-browser__grid">
        {presets.map((preset, index) => (
          <div
            key={index}
            className="ai-preset-browser__preset-card"
            onClick={() => handlePresetClick(preset)}
          >
            <div className="ai-preset-browser__preset-icon">
              {getCategoryIcon(selectedCategory)}
            </div>
            <div className="ai-preset-browser__preset-text">{preset}</div>
            <div className="ai-preset-browser__preset-action">→</div>
          </div>
        ))}
      </div>

      {presets.length === 0 && (
        <div className="ai-preset-browser__empty">
          <span className="ai-preset-browser__empty-icon">🎵</span>
          <p>No presets available for this category</p>
        </div>
      )}
    </div>
  );
}

function getCategoryIcon(category) {
  const icons = {
    drums: '🥁',
    bass: '🎸',
    leads: '🎹',
    pads: '🎼',
    percussion: '🔔',
    other: '🎵'
  };
  return icons[category] || '🎵';
}

