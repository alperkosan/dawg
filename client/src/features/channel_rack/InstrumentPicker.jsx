import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, ChevronRight, ChevronDown, Search, Play } from 'lucide-react';
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
 * Features: Search/filter, preview audio, keyboard navigation
 */
export default function InstrumentPicker({ onSelectInstrument, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState(INSTRUMENT_CATEGORIES.SAMPLER);
  const [expandedGroups, setExpandedGroups] = useState(new Set(['drums'])); // Default expand drums
  const [searchQuery, setSearchQuery] = useState('');
  const [previewingPreset, setPreviewingPreset] = useState(null);

  const searchInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const previewSourceRef = useRef(null);

  // ✅ Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // ✅ Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewSourceRef.current) {
        try {
          previewSourceRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }
    };
  }, []);

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

  // ✅ Filter presets based on search query
  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) {
      return categoryPresets;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = {};

    Object.entries(categoryPresets).forEach(([groupKey, group]) => {
      const matchingPresets = group.presets.filter(preset =>
        preset.name.toLowerCase().includes(query) ||
        preset.id.toLowerCase().includes(query)
      );

      if (matchingPresets.length > 0) {
        filtered[groupKey] = {
          ...group,
          presets: matchingPresets
        };
      }
    });

    return filtered;
  }, [categoryPresets, searchQuery]);

  // ✅ Auto-expand groups when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      // Expand all groups that have matching presets
      setExpandedGroups(new Set(Object.keys(filteredPresets)));
    } else {
      // Reset to default
      setExpandedGroups(new Set(['drums']));
    }
  }, [searchQuery, filteredPresets]);

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
    // Stop any playing preview
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      previewSourceRef.current = null;
    }

    const instrument = createInstrumentFromPreset(selectedCategory, preset);
    onSelectInstrument(instrument);
  };

  // ✅ Preview audio playback
  const handlePreviewClick = async (preset, e) => {
    e.stopPropagation(); // Prevent triggering handlePresetClick

    // Stop current preview
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      previewSourceRef.current = null;
      setPreviewingPreset(null);
    }

    // Only SAMPLER category has audio preview
    if (selectedCategory !== INSTRUMENT_CATEGORIES.SAMPLER || !preset.url) {
      console.log('Preview not available for this preset type');
      return;
    }

    try {
      setPreviewingPreset(preset.id);

      // Get or create AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;

      // Resume if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Fetch and decode audio
      const response = await fetch(preset.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Create and play
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.7;

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      source.onended = () => {
        setPreviewingPreset(null);
        previewSourceRef.current = null;
      };

      source.start(0);
      previewSourceRef.current = source;

    } catch (error) {
      console.error('Preview failed:', error);
      setPreviewingPreset(null);
    }
  };

  // ✅ Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="instrument-picker">
      <div className="instrument-picker__header">
        <h3>Add Instrument</h3>
        <button className="instrument-picker__close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="instrument-picker__content">
        {/* Search Bar */}
        <div className="instrument-picker__search">
          <Search size={16} className="instrument-picker__search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search instruments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="instrument-picker__search-input"
          />
          {searchQuery && (
            <button
              className="instrument-picker__search-clear"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

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
          {Object.keys(filteredPresets).length === 0 ? (
            <div className="instrument-picker__empty">
              <p>No instruments found matching "{searchQuery}"</p>
            </div>
          ) : (
            Object.entries(filteredPresets).map(([groupKey, group]) => {
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
                      {group.presets.map((preset) => {
                        const isPreviewing = previewingPreset === preset.id;
                        const hasPreview = selectedCategory === INSTRUMENT_CATEGORIES.SAMPLER && preset.url;

                        return (
                          <div
                            key={preset.id}
                            className={`instrument-picker__preset-wrapper ${isPreviewing ? 'previewing' : ''}`}
                          >
                            <button
                              className="instrument-picker__preset"
                              onClick={() => handlePresetClick(preset)}
                            >
                              <div
                                className="instrument-picker__preset-color"
                                style={{ backgroundColor: preset.color }}
                              />
                              <span className="instrument-picker__preset-name">{preset.name}</span>
                            </button>
                            {hasPreview && (
                              <button
                                className="instrument-picker__preset-preview"
                                onClick={(e) => handlePreviewClick(preset, e)}
                                title="Preview sound"
                              >
                                <Play size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="instrument-picker__footer">
        <div className="instrument-picker__hint">
          💡 Click to add • <Play size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> to preview • ESC to close
        </div>
      </div>
    </div>
  );
}
