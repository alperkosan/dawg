/**
 * Instrument Effects Panel
 * Manages effects chain for individual instruments
 * Effects are applied at instrument level before mixer
 */

import { useState } from 'react';
import { useMixerStore } from '@/store/useMixerStore';
import useInstrumentEditorStore from '@/store/useInstrumentEditorStore';
import { pluginRegistry } from '@/config/pluginConfig';
import { Plus, Trash2, Power, Settings, GripVertical } from 'lucide-react';
import './InstrumentEffectsPanel.css';

const InstrumentEffectsPanel = ({ instrumentData }) => {
  const [expandedEffect, setExpandedEffect] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const { updateParameter } = useInstrumentEditorStore();
  const { addEffectToInsert, removeEffectFromInsert, toggleEffectBypass } = useMixerStore();

  // Get mixer track for this instrument
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  const mixerTrack = mixerTracks.find(t => t.id === instrumentData.mixerTrackId);

  // Get instrument-level effects (if supported)
  const effects = instrumentData.effects || [];

  const handleAddEffect = (effectType) => {
    const effectConfig = pluginRegistry[effectType];
    if (!effectConfig) return;

    // For now, redirect to mixer channel
    // In future, we can add instrument-level effects
    alert(`Add ${effectConfig.type || effectType} to mixer channel "${mixerTrack?.name || 'Unknown'}" instead.\n\nInstrument-level effects coming soon!`);
    setShowAddMenu(false);
  };

  const handleRemoveEffect = (effectId) => {
    if (!confirm('Remove this effect?')) return;
    // Implementation for instrument-level effects
  };

  const handleToggleBypass = (effectId) => {
    // Implementation for instrument-level effects
  };

  return (
    <div className="instrument-effects-panel">
      <div className="instrument-effects-panel__header">
        <h3>Instrument Effects</h3>
        <p className="instrument-effects-panel__hint">
          Effects applied at instrument level (before mixer channel)
        </p>
      </div>

      {/* Current Status */}
      <div className="instrument-effects-panel__info">
        <div className="instrument-effects-panel__info-row">
          <span>Mixer Channel:</span>
          <strong>{mixerTrack?.name || 'Not routed'}</strong>
        </div>
        <div className="instrument-effects-panel__info-row">
          <span>Instrument Effects:</span>
          <strong>{effects.length} active</strong>
        </div>
      </div>

      {/* Effects List */}
      <div className="instrument-effects-panel__list">
        {effects.length === 0 ? (
          <div className="instrument-effects-panel__empty">
            <div className="instrument-effects-panel__empty-icon">🎚️</div>
            <p>No instrument-level effects</p>
            <p className="instrument-effects-panel__empty-hint">
              Add effects at the mixer channel level for now
            </p>
          </div>
        ) : (
          effects.map((effect) => (
            <div key={effect.id} className="instrument-effects-panel__effect">
              <div className="instrument-effects-panel__effect-header">
                <GripVertical size={16} className="instrument-effects-panel__drag-handle" />
                <span className="instrument-effects-panel__effect-name">{effect.name}</span>
                <div className="instrument-effects-panel__effect-actions">
                  <button
                    className={`instrument-effects-panel__effect-btn ${effect.bypass ? '' : 'active'}`}
                    onClick={() => handleToggleBypass(effect.id)}
                    title="Toggle bypass"
                  >
                    <Power size={14} />
                  </button>
                  <button
                    className="instrument-effects-panel__effect-btn"
                    onClick={() => setExpandedEffect(expandedEffect === effect.id ? null : effect.id)}
                    title="Settings"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    className="instrument-effects-panel__effect-btn instrument-effects-panel__effect-btn--danger"
                    onClick={() => handleRemoveEffect(effect.id)}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {expandedEffect === effect.id && (
                <div className="instrument-effects-panel__effect-settings">
                  Effect settings here
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Effect Button */}
      <div className="instrument-effects-panel__add-section">
        <button
          className="instrument-effects-panel__add-btn"
          onClick={() => setShowAddMenu(!showAddMenu)}
        >
          <Plus size={16} />
          Add Effect
        </button>

        {showAddMenu && (
          <div className="instrument-effects-panel__add-menu">
            <div className="instrument-effects-panel__add-menu-header">
              Select Effect Type
            </div>
            <div className="instrument-effects-panel__add-menu-list">
              {Object.entries(pluginRegistry).map(([key, config]) => (
                <button
                  key={key}
                  className="instrument-effects-panel__add-menu-item"
                  onClick={() => handleAddEffect(key)}
                >
                  <span className="instrument-effects-panel__add-menu-icon">
                    {config.category === 'dynamics' && '📊'}
                    {config.category === 'eq' && '〰️'}
                    {config.category === 'spatial' && '🌊'}
                    {config.category === 'modulation' && '🌀'}
                    {config.category === 'distortion' && '⚡'}
                    {config.category === 'utility' && '🔧'}
                  </span>
                  <div className="instrument-effects-panel__add-menu-info">
                    <div className="instrument-effects-panel__add-menu-name">{config.type || key}</div>
                    <div className="instrument-effects-panel__add-menu-desc">{config.story || config.category}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recommendation */}
      <div className="instrument-effects-panel__recommendation">
        <strong>💡 Tip:</strong> For better CPU efficiency, add effects at the mixer channel level.
        This allows multiple instruments to share the same effect chain.
      </div>
    </div>
  );
};

export default InstrumentEffectsPanel;
