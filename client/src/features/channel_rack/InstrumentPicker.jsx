import React, { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronDown } from 'lucide-react';
import {
  INSTRUMENT_CATEGORIES,
  CATEGORY_INFO,
  SAMPLER_PRESETS,
  MULTI_SAMPLER_PRESETS,
  VA_SYNTH_PRESETS,
  createInstrumentFromPreset
} from '@/config/instrumentCategories';
import './InstrumentPicker.css';

/**
 * InstrumentPicker - Modern instrument selection panel
 *
 * Replaces FileBrowser for adding instruments to Channel Rack
 * Organized by category and preset groups
 */
export default function InstrumentPicker({ onSelectInstrument, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState(INSTRUMENT_CATEGORIES.SAMPLER);
  const [expandedGroups, setExpandedGroups] = useState(new Set(['drums'])); // Default expand drums

  // Get presets for selected category
  const categoryPresets = useMemo(() => {
    switch (selectedCategory) {
      case INSTRUMENT_CATEGORIES.SAMPLER:
        return SAMPLER_PRESETS;
      case INSTRUMENT_CATEGORIES.MULTI_SAMPLER:
        return MULTI_SAMPLER_PRESETS;
      case INSTRUMENT_CATEGORIES.VA_SYNTH:
        return VA_SYNTH_PRESETS;
      default:
        return {};
    }
  }, [selectedCategory]);

  const toggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const handlePresetClick = (preset) => {
    const instrument = createInstrumentFromPreset(selectedCategory, preset);
    onSelectInstrument(instrument);
  };

  return (
    <div className="instrument-picker">
      <div className="instrument-picker__header">
        <h3>Add Instrument</h3>
        <button className="instrument-picker__close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="instrument-picker__content">
        {/* Category Tabs */}
        <div className="instrument-picker__categories">
          {Object.values(INSTRUMENT_CATEGORIES).map((category) => {
            const info = CATEGORY_INFO[category];
            const isActive = category === selectedCategory;

            return (
              <button
                key={category}
                className={`instrument-picker__category ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                <span className="instrument-picker__category-icon">{info.icon}</span>
                <div className="instrument-picker__category-info">
                  <div className="instrument-picker__category-name">{info.name}</div>
                  <div className="instrument-picker__category-desc">{info.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Preset Groups */}
        <div className="instrument-picker__presets">
          {Object.entries(categoryPresets).map(([groupKey, group]) => {
            const isExpanded = expandedGroups.has(groupKey);

            return (
              <div key={groupKey} className="instrument-picker__group">
                <div
                  className="instrument-picker__group-header"
                  onClick={() => toggleGroup(groupKey)}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span>{group.name}</span>
                  <span className="instrument-picker__group-count">({group.presets.length})</span>
                </div>

                {isExpanded && (
                  <div className="instrument-picker__group-presets">
                    {group.presets.map((preset) => (
                      <button
                        key={preset.id}
                        className="instrument-picker__preset"
                        onClick={() => handlePresetClick(preset)}
                      >
                        <div
                          className="instrument-picker__preset-color"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span className="instrument-picker__preset-name">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="instrument-picker__footer">
        <div className="instrument-picker__hint">
          💡 Tip: Click any preset to add it to Channel Rack
        </div>
      </div>
    </div>
  );
}
