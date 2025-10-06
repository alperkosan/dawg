import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { EffectFactory } from '@/lib/audio/effects';
import './EffectsPanel.css';

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

  return (
    <div className="effects-panel">
      <div className="effects-panel__header">
        <h3 className="effects-panel__title">Effects</h3>

        <div className="effects-panel__add-menu-wrapper">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="effects-panel__add-btn"
          >
            <Plus size={14} /> Add Effect
          </button>

          {showAddMenu && (
            <div className="effects-panel__add-menu">
              <div
                onClick={() => handleAddEffect('waveshaper')}
                className="effects-panel__menu-item"
              >
                🎛️ Waveshaper
              </div>
              <div
                onClick={() => handleAddEffect('delay')}
                className="effects-panel__menu-item"
              >
                🔁 Delay
              </div>
              <div
                onClick={() => handleAddEffect('reverb')}
                className="effects-panel__menu-item"
              >
                🌊 Reverb
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="effects-panel__content">
        {effectChain.length === 0 ? (
          <div className="effects-panel__empty">
            No effects. Click "Add Effect" to get started.
          </div>
        ) : (
          <div className="effects-panel__list">
            {effectChain.map((effect, index) => (
              <EffectSlot
                key={effect.id}
                effect={effect}
                index={index}
                isExpanded={expandedEffect === effect.id}
                onToggleExpand={() => toggleExpanded(effect.id)}
                onRemove={() => onEffectRemove?.(effect.id)}
                onParameterChange={(paramName, value) => handleParameterChange(effect.id, paramName, value)}
                onPresetSelect={(presetParams) => handlePresetSelect(effect.id, presetParams)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const EffectSlot = ({ effect, index, isExpanded, onToggleExpand, onRemove, onParameterChange, onPresetSelect }) => {
  const presets = EffectFactory.getPresets(effect.type);

  return (
    <div className="effect-slot">
      <div className="effect-slot__header" onClick={onToggleExpand}>
        <div className="effect-slot__header-left">
          <span className="effect-slot__index">#{index + 1}</span>
          <span className="effect-slot__name">{effect.name}</span>
        </div>

        <div className="effect-slot__header-right">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="effect-slot__delete-btn"
          >
            <Trash2 size={14} />
          </button>
          {isExpanded ? <ChevronUp size={14} color="#888" /> : <ChevronDown size={14} color="#888" />}
        </div>
      </div>

      {isExpanded && (
        <div className="effect-slot__controls">
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
            {Object.keys(effect.parameters).map(paramName => {
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
