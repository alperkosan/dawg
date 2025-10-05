import React, { useState, useRef, useEffect } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import { pluginRegistry } from '@/config/pluginConfig';
import {
  Plus,
  Trash2,
  Power,
  MoreVertical,
  Zap,
  Volume2,
  Filter,
  Waves
} from 'lucide-react';
import './EffectsPanel.css';

const EffectsPanel = ({ trackId, onClose }) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState(null);
  const addMenuRef = useRef(null);

  const track = useMixerStore(state =>
    state.mixerTracks.find(t => t.id === trackId)
  );

  const {
    handleMixerEffectAdd,
    handleMixerEffectRemove,
    handleMixerEffectChange,
    reorderEffect
  } = useMixerStore.getState();

  const effects = track?.insertEffects || [];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getEffectIcon = (effectType) => {
    const icons = {
      compressor: <Volume2 size={14} />,
      eq: <Waves size={14} />,
      reverb: <Filter size={14} />,
      delay: <Zap size={14} />
    };
    return icons[effectType] || <Filter size={14} />;
  };

  const handleAddEffect = (effectType) => {
    const newEffect = handleMixerEffectAdd(trackId, effectType);
    if (newEffect) {
      setSelectedEffect(newEffect.id);
    }
    setShowAddMenu(false);
  };

  return (
    <div className="effects-panel">
      <div className="effects-panel__header">
        <div className="effects-panel__title">
          <Filter size={16} />
          <span>Effects Chain</span>
          <span className="effects-panel__track-name">({track?.name})</span>
        </div>
        <button
          className="effects-panel__close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="effects-panel__content">
        {/* Effects Chain */}
        <div className="effects-chain">
          {effects.map((effect, index) => (
            <div
              key={effect.id}
              className={`effect-slot ${effect.bypass ? 'effect-slot--bypassed' : ''} ${
                selectedEffect === effect.id ? 'effect-slot--selected' : ''
              }`}
              onClick={() => setSelectedEffect(selectedEffect === effect.id ? null : effect.id)}
            >
              {/* Effect Header */}
              <div className="effect-slot__header">
                <div className="effect-slot__info">
                  <div className="effect-slot__icon">
                    {getEffectIcon(effect.type)}
                  </div>
                  <div className="effect-slot__name">
                    {pluginRegistry[effect.type]?.name || effect.type}
                  </div>
                </div>

                <div className="effect-slot__controls">
                  <button
                    className={`effect-slot__bypass ${effect.bypass ? 'effect-slot__bypass--active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMixerEffectChange(trackId, effect.id, 'bypass', !effect.bypass);
                    }}
                    title="Bypass effect"
                  >
                    <Power size={12} />
                  </button>

                  <button
                    className="effect-slot__menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle effect menu
                    }}
                  >
                    <MoreVertical size={12} />
                  </button>

                  <button
                    className="effect-slot__remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMixerEffectRemove(trackId, effect.id);
                      if (selectedEffect === effect.id) {
                        setSelectedEffect(null);
                      }
                    }}
                    title="Remove effect"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Effect Parameters (when selected) */}
              {selectedEffect === effect.id && (
                <div className="effect-slot__parameters">
                  {Object.entries(effect.settings || {}).map(([param, value]) => (
                    <div key={param} className="effect-param">
                      <label className="effect-param__label">{param}</label>
                      <div className="effect-param__control">
                        {typeof value === 'boolean' ? (
                          <button
                            className={`effect-param__toggle ${value ? 'effect-param__toggle--active' : ''}`}
                            onClick={() => handleMixerEffectChange(trackId, effect.id, param, !value)}
                          >
                            {value ? 'ON' : 'OFF'}
                          </button>
                        ) : (
                          <div className="effect-param__slider-container">
                            <input
                              type="range"
                              className="effect-param__slider"
                              min={pluginRegistry[effect.type]?.params?.[param]?.min || 0}
                              max={pluginRegistry[effect.type]?.params?.[param]?.max || 100}
                              step={pluginRegistry[effect.type]?.params?.[param]?.step || 1}
                              value={value}
                              onChange={(e) => handleMixerEffectChange(trackId, effect.id, param, parseFloat(e.target.value))}
                            />
                            <span className="effect-param__value">
                              {typeof value === 'number' ? value.toFixed(1) : value}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Visual connection line to next effect */}
              {index < effects.length - 1 && (
                <div className="effect-connection-line" />
              )}
            </div>
          ))}

          {/* Add Effect Button */}
          <div className="effect-add-slot">
            <button
              className="effect-add-btn"
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              <Plus size={16} />
              <span>Add Effect</span>
            </button>

            {/* Add Effect Menu */}
            {showAddMenu && (
              <div className="effect-add-menu" ref={addMenuRef}>
                <div className="effect-add-menu__header">
                  <span>Choose Effect</span>
                </div>
                <div className="effect-add-menu__categories">
                  {Object.entries(pluginRegistry).map(([effectType, config]) => (
                    <button
                      key={effectType}
                      className="effect-add-menu__item"
                      onClick={() => handleAddEffect(effectType)}
                    >
                      <div className="effect-add-menu__icon">
                        {getEffectIcon(effectType)}
                      </div>
                      <div className="effect-add-menu__info">
                        <div className="effect-add-menu__name">{config.name}</div>
                        <div className="effect-add-menu__description">{config.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Empty State */}
        {effects.length === 0 && (
          <div className="effects-empty-state">
            <div className="effects-empty-state__icon">
              <Filter size={32} />
            </div>
            <div className="effects-empty-state__text">
              <h3>No Effects</h3>
              <p>Add your first effect to start building the signal chain</p>
            </div>
            <button
              className="effects-empty-state__add-btn"
              onClick={() => setShowAddMenu(true)}
            >
              <Plus size={16} />
              Add Effect
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EffectsPanel;