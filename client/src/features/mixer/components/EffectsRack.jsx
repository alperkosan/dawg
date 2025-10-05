/**
 * EFFECTS RACK
 *
 * FL Studio-inspired effects panel:
 * - List of effects on selected channel
 * - Wet/dry (mix) control per effect
 * - Enable/disable toggle
 * - Drag to reorder
 * - Add effect button
 */

import React, { useState } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { usePanelsStore } from '@/store/usePanelsStore';
import { pluginRegistry } from '@/config/pluginConfig';
import {
  Plus,
  Trash2,
  Power,
  Settings,
  GripVertical,
  ChevronDown,
  Zap,
  Volume2,
  Waves,
  Filter,
  Sliders
} from 'lucide-react';
import './EffectsRack.css';

const EFFECT_ICONS = {
  'Reverb': Filter,
  'Delay': Zap,
  'Compressor': Volume2,
  'MultiBandEQ': Waves,
  'Saturator': Zap,
  'StardustChorus': Waves,
  'VortexPhaser': Waves,
  'TidalFilter': Filter,
  'OrbitPanner': Sliders,
  'ArcadeCrusher': Zap,
  'PitchShifter': Sliders,
  'FeedbackDelay': Zap,
  'AtmosMachine': Filter,
  'GhostLFO': Waves,
  'SampleMorph': Sliders,
  'BassEnhancer808': Volume2,
  'SidechainCompressor': Volume2,
  default: Settings
};

export const EffectsRack = ({ track }) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [expandedEffect, setExpandedEffect] = useState(null);

  const {
    handleMixerEffectAdd,
    handleMixerEffectRemove,
    handleMixerEffectChange,
    handleMixerEffectToggle
  } = useMixerStore();

  if (!track) {
    return (
      <div className="effects-rack effects-rack--empty">
        <div className="effects-rack__empty">
          <Settings size={48} stroke="#333" />
          <p>No channel selected</p>
          <span>Select a mixer channel to view effects</span>
        </div>
      </div>
    );
  }

  const effects = track.insertEffects || track.effects || [];

  const handleAddEffect = (effectType) => {
    handleMixerEffectAdd(track.id, effectType);
    setShowAddMenu(false);
  };

  const handleWetDryChange = (effectId, value) => {
    handleMixerEffectChange(track.id, effectId, 'wet', value);
  };

  // Get available effects from plugin registry
  const availableEffects = Object.keys(pluginRegistry).map(key => {
    const plugin = pluginRegistry[key];
    const Icon = EFFECT_ICONS[key] || EFFECT_ICONS.default;
    return {
      type: key,
      name: key,
      icon: Icon,
      category: plugin.category
    };
  });

  return (
    <div className="effects-rack">
      {/* Header */}
      <div className="effects-rack__header">
        <div className="effects-rack__title">
          <div
            className="effects-rack__color"
            style={{ backgroundColor: track.color || '#4b5563' }}
          />
          <div className="effects-rack__info">
            <h3>{track.name}</h3>
            <span>{effects.length} {effects.length === 1 ? 'Effect' : 'Effects'}</span>
          </div>
        </div>

        <button
          className="effects-rack__add-btn"
          onClick={() => setShowAddMenu(!showAddMenu)}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Add Effect Menu */}
      {showAddMenu && (
        <div className="effects-rack__add-menu">
          {availableEffects.map(effect => {
            const Icon = effect.icon;
            return (
              <button
                key={effect.type}
                className="effects-rack__add-item"
                onClick={() => handleAddEffect(effect.type)}
                title={effect.category}
              >
                <Icon size={14} />
                <div className="effects-rack__add-item-text">
                  <span className="effects-rack__add-item-name">{effect.name}</span>
                  <span className="effects-rack__add-item-category">{effect.category}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Effects List */}
      <div className="effects-rack__list">
        {effects.length === 0 ? (
          <div className="effects-rack__no-effects">
            <p>No effects</p>
            <span>Click + to add an effect</span>
          </div>
        ) : (
          effects.map((effect, index) => {
            const Icon = EFFECT_ICONS[effect.type] || EFFECT_ICONS.default;
            const isExpanded = expandedEffect === effect.id;
            const mix = effect.settings?.wet !== undefined ? effect.settings.wet : 1.0;
            const isEnabled = !effect.bypass;

            return (
              <div
                key={effect.id}
                className={`effects-rack__item ${effect.bypass ? 'effects-rack__item--disabled' : ''}`}
              >
                {/* Effect Header */}
                <div className="effects-rack__item-header">
                  <button className="effects-rack__drag-handle">
                    <GripVertical size={12} />
                  </button>

                  <div className="effects-rack__item-info">
                    <Icon size={14} />
                    <span className="effects-rack__item-name">
                      {effect.type}
                    </span>
                  </div>

                  <div className="effects-rack__item-controls">
                    <button
                      className={`effects-rack__power-btn ${isEnabled ? 'active' : ''}`}
                      onClick={() => handleMixerEffectToggle(track.id, effect.id)}
                      title={isEnabled ? 'Disable' : 'Enable'}
                    >
                      <Power size={12} />
                    </button>

                    <button
                      className="effects-rack__expand-btn"
                      onClick={() => setExpandedEffect(isExpanded ? null : effect.id)}
                    >
                      <ChevronDown
                        size={12}
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      />
                    </button>

                    <button
                      className="effects-rack__delete-btn"
                      onClick={() => handleMixerEffectRemove(track.id, effect.id)}
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Wet/Dry Slider */}
                <div className="effects-rack__mix-control">
                  <label>Mix</label>
                  <div className="effects-rack__mix-slider-container">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={mix}
                      onChange={(e) => handleWetDryChange(effect.id, parseFloat(e.target.value))}
                      className="effects-rack__mix-slider"
                    />
                    <span className="effects-rack__mix-value">
                      {Math.round(mix * 100)}%
                    </span>
                  </div>
                </div>

                {/* Expanded Parameters */}
                {isExpanded && (
                  <div className="effects-rack__params">
                    {/* Effect-specific parameters would go here */}
                    <div className="effects-rack__param">
                      <label>Parameters</label>
                      <button
                        className="effects-rack__settings-btn"
                        onClick={() => usePanelsStore.getState().togglePluginPanel(effect, track)}
                        title="Open Effect UI"
                      >
                        <Settings size={12} />
                        <span>Edit Effect</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Routing Info */}
      {track.type !== 'master' && (
        <div className="effects-rack__routing">
          <div className="effects-rack__routing-label">Output</div>
          <div className="effects-rack__routing-value">
            {track.output || 'Master'}
          </div>
        </div>
      )}
    </div>
  );
};

export default EffectsRack;
