import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Settings, Zap, Volume2, Waves, Filter, Sliders, Power } from 'lucide-react';
import { EffectFactory } from '@/lib/audio/effects';
import './EffectsPanel.css';

const EFFECT_ICONS = {
  'reverb': Filter,
  'delay': Zap,
  'feedback-delay': Zap,
  'compressor': Volume2,
  'saturator': Zap,
  'waveshaper': Zap,
  'multiband-eq': Waves,
  'bass-enhancer': Volume2,
  'stardust-chorus': Waves,
  'vortex-phaser': Waves,
  'tidal-filter': Filter,
  'orbit-panner': Sliders,
  'arcade-crusher': Zap,
  'pitch-shifter': Sliders,
  'atmos-machine': Filter,
  'ghost-lfo': Waves,
  'sample-morph': Sliders,
  'sidechain-compressor': Volume2,
  default: Settings
};

const EFFECT_CATEGORIES = {
  'Dynamics & Tone': ['compressor', 'saturator', 'waveshaper', 'multiband-eq', 'bass-enhancer'],
  'Time & Space': ['delay', 'feedback-delay', 'reverb', 'atmos-machine'],
  'Modulation': ['stardust-chorus', 'vortex-phaser', 'tidal-filter', 'ghost-lfo', 'orbit-panner'],
  'Creative': ['arcade-crusher', 'pitch-shifter', 'sample-morph', 'sidechain-compressor']
};

const EffectsPanel = ({ instrument, onEffectAdd, onEffectRemove, onEffectUpdate }) => {
  const [expandedEffect, setExpandedEffect] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const effectChain = instrument?.effectChain || [];

  const handleAddEffect = (type) => {
    onEffectAdd?.(type);
    setShowAddMenu(false);
  };

  const handleParameterChange = (effectId, paramName, value) => {
    onEffectUpdate?.(effectId, paramName, value);
  };

  const handlePresetSelect = (effectId, presetParams) => {
    Object.keys(presetParams).forEach(paramName => {
      onEffectUpdate?.(effectId, paramName, presetParams[paramName]);
    });
  };

  const toggleExpanded = (effectId) => {
    setExpandedEffect(expandedEffect === effectId ? null : effectId);
  };

  // Get effect display name
  const getEffectDisplayName = (type) => {
    return EffectFactory.workletEffects[type]?.displayName || type;
  };

  return (
    <div className="effects-panel">
      {/* Header */}
      <div className="effects-panel__header">
        <div className="effects-panel__title">
          <div className="effects-panel__info">
            <h3>{instrument?.name || 'Effects'}</h3>
            <span>{effectChain.length} {effectChain.length === 1 ? 'Effect' : 'Effects'}</span>
          </div>
        </div>

        <button
          className="effects-panel__add-btn"
          onClick={() => setShowAddMenu(!showAddMenu)}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Add Effect Menu */}
      {showAddMenu && (
        <div className="effects-panel__add-menu">
          {Object.entries(EFFECT_CATEGORIES).map(([category, effects]) => (
            <div key={category} className="effects-panel__category">
              <div className="effects-panel__category-title">{category}</div>
              {effects.map(effectType => {
                const Icon = EFFECT_ICONS[effectType] || EFFECT_ICONS.default;
                const displayName = getEffectDisplayName(effectType);
                return (
                  <button
                    key={effectType}
                    className="effects-panel__add-item"
                    onClick={() => handleAddEffect(effectType)}
                  >
                    <Icon size={14} />
                    <span>{displayName}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Effects Grid */}
      <div className="effects-panel__grid">
        {effectChain.map((effect, index) => {
          const Icon = EFFECT_ICONS[effect.type] || EFFECT_ICONS.default;
          return (
            <EffectSlot
              key={effect.id}
              effect={effect}
              index={index}
              icon={Icon}
              displayName={getEffectDisplayName(effect.type)}
              isExpanded={expandedEffect === effect.id}
              onToggleExpand={() => toggleExpanded(effect.id)}
              onRemove={() => onEffectRemove?.(effect.id)}
              onParameterChange={(paramName, value) => handleParameterChange(effect.id, paramName, value)}
              onPresetSelect={(presetParams) => handlePresetSelect(effect.id, presetParams)}
            />
          );
        })}

        {/* Add Effect Card */}
        <div className="effect-add-card" onClick={() => setShowAddMenu(!showAddMenu)}>
          <Plus size={48} />
        </div>
      </div>
    </div>
  );
};

const EffectSlot = ({ effect, index, icon: Icon, displayName, isExpanded, onToggleExpand, onRemove, onParameterChange, onPresetSelect }) => {
  const presets = EffectFactory.getPresets(effect.type);
  const [enabled, setEnabled] = React.useState(effect.enabled ?? true);

  // Get mix/wet parameter
  const mixParam = effect.parameters?.wet || effect.parameters?.mix;

  const handleToggleEnabled = (e) => {
    e.stopPropagation();
    setEnabled(!enabled);
    // TODO: Apply enabled state to effect
  };

  return (
    <div className={`effect-slot ${enabled ? 'effect-slot--enabled' : 'effect-slot--disabled'}`}>
      <div className="effect-slot__header">
        <div className="effect-slot__title">
          <span className="effect-slot__name">{displayName}</span>
        </div>
        <div className="effect-slot__controls">
          <button
            onClick={handleToggleEnabled}
            className={`effect-slot__power-btn ${enabled ? 'active' : ''}`}
            title={enabled ? 'Disable' : 'Enable'}
          >
            <Power size={16} />
          </button>
          <button
            onClick={onToggleExpand}
            className="effect-slot__settings-btn"
            title="Settings"
          >
            {isExpanded ? <ChevronUp size={16} /> : <Settings size={16} />}
          </button>
        </div>
      </div>

      <div className="effect-slot__body">
        {mixParam && (
          <div className="effect-slot__mix">
            <div className="effect-slot__knob">
              <div className="knob-track">
                <div
                  className="knob-fill"
                  style={{
                    transform: `rotate(${(mixParam.value / mixParam.max) * 270 - 135}deg)`
                  }}
                />
              </div>
              <input
                type="range"
                min={mixParam.min}
                max={mixParam.max}
                step={(mixParam.max - mixParam.min) / 100}
                value={mixParam.value}
                onChange={(e) => onParameterChange('wet', parseFloat(e.target.value))}
                className="knob-input"
              />
            </div>
            <span className="effect-slot__mix-label">MIX</span>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="effect-slot__expanded">
          {presets.length > 0 && (
            <div className="effect-slot__presets">
              <label className="effect-slot__presets-label">Presets</label>
              <div className="effect-slot__presets-list">
                {presets.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => onPresetSelect(preset.params)}
                    className="effect-slot__preset-btn"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="effect-slot__parameters">
            {Object.keys(effect.parameters).filter(key => key !== 'wet' && key !== 'mix').map(paramName => {
              const param = effect.parameters[paramName];

              if (typeof param.value !== 'number') return null;

              return (
                <div key={paramName} className="effect-param">
                  <label className="effect-param__label">
                    <span className="effect-param__name">{param.label || paramName}</span>
                    <span className="effect-param__value">
                      {param.value.toFixed(2)}{param.unit || ''}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={(param.max - param.min) / 100}
                    value={param.value}
                    onChange={(e) => onParameterChange(paramName, parseFloat(e.target.value))}
                    className="effect-param__slider"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EffectsPanel;
