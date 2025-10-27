/**
 * Modulation Matrix
 * Route LFOs, Envelopes, and other modulators to parameters
 * FL Studio / Vital inspired modulation routing
 */

import { useState } from 'react';
import useInstrumentEditorStore from '@/store/useInstrumentEditorStore';
import { Plus, Trash2, Activity, TrendingUp, Sliders } from 'lucide-react';
import './ModulationMatrix.css';

const MODULATION_SOURCES = [
  { id: 'lfo1', name: 'LFO 1', icon: '〜', type: 'lfo' },
  { id: 'lfo2', name: 'LFO 2', icon: '〜', type: 'lfo' },
  { id: 'env1', name: 'Envelope 1', icon: '📈', type: 'envelope' },
  { id: 'env2', name: 'Envelope 2', icon: '📈', type: 'envelope' },
  { id: 'velocity', name: 'Velocity', icon: '⚡', type: 'midi' },
  { id: 'aftertouch', name: 'Aftertouch', icon: '👆', type: 'midi' },
  { id: 'modwheel', name: 'Mod Wheel', icon: '🎚️', type: 'midi' },
];

const MODULATION_TARGETS = [
  { id: 'filter.cutoff', name: 'Filter Cutoff', category: 'Filter' },
  { id: 'filter.resonance', name: 'Filter Resonance', category: 'Filter' },
  { id: 'osc.level', name: 'Oscillator Level', category: 'Oscillator' },
  { id: 'osc.detune', name: 'Oscillator Detune', category: 'Oscillator' },
  { id: 'osc.pitch', name: 'Oscillator Pitch', category: 'Oscillator' },
  { id: 'pan', name: 'Pan', category: 'Output' },
  { id: 'volume', name: 'Volume', category: 'Output' },
];

const ModulationMatrix = ({ instrumentData }) => {
  const [modulations, setModulations] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [amount, setAmount] = useState(0.5);

  const handleAddModulation = () => {
    if (!selectedSource || !selectedTarget) {
      alert('Please select both source and target');
      return;
    }

    const newMod = {
      id: `mod_${Date.now()}`,
      source: selectedSource,
      target: selectedTarget,
      amount: amount,
      enabled: true,
    };

    setModulations([...modulations, newMod]);
    setShowAddModal(false);
    setSelectedSource(null);
    setSelectedTarget(null);
    setAmount(0.5);
  };

  const handleRemoveModulation = (modId) => {
    setModulations(modulations.filter(m => m.id !== modId));
  };

  const handleToggleModulation = (modId) => {
    setModulations(modulations.map(m =>
      m.id === modId ? { ...m, enabled: !m.enabled } : m
    ));
  };

  const handleAmountChange = (modId, newAmount) => {
    setModulations(modulations.map(m =>
      m.id === modId ? { ...m, amount: newAmount } : m
    ));
  };

  const getSourceInfo = (sourceId) => {
    return MODULATION_SOURCES.find(s => s.id === sourceId);
  };

  const getTargetInfo = (targetId) => {
    return MODULATION_TARGETS.find(t => t.id === targetId);
  };

  return (
    <div className="modulation-matrix">
      <div className="modulation-matrix__header">
        <h3>Modulation Matrix</h3>
        <p className="modulation-matrix__hint">
          Route modulators (LFOs, Envelopes) to control parameters
        </p>
      </div>

      {/* Modulations List */}
      <div className="modulation-matrix__list">
        {modulations.length === 0 ? (
          <div className="modulation-matrix__empty">
            <div className="modulation-matrix__empty-icon">🔀</div>
            <p>No modulation routings</p>
            <p className="modulation-matrix__empty-hint">
              Click "Add Modulation" to create your first routing
            </p>
          </div>
        ) : (
          modulations.map((mod) => {
            const source = getSourceInfo(mod.source);
            const target = getTargetInfo(mod.target);

            return (
              <div
                key={mod.id}
                className={`modulation-matrix__item ${!mod.enabled ? 'modulation-matrix__item--disabled' : ''}`}
              >
                <div className="modulation-matrix__item-header">
                  <button
                    className={`modulation-matrix__item-toggle ${mod.enabled ? 'active' : ''}`}
                    onClick={() => handleToggleModulation(mod.id)}
                    title="Enable/Disable"
                  >
                    <Activity size={14} />
                  </button>

                  <div className="modulation-matrix__item-route">
                    <span className="modulation-matrix__item-source">
                      <span className="modulation-matrix__item-icon">{source?.icon}</span>
                      {source?.name}
                    </span>
                    <span className="modulation-matrix__item-arrow">→</span>
                    <span className="modulation-matrix__item-target">
                      {target?.name}
                    </span>
                  </div>

                  <button
                    className="modulation-matrix__item-remove"
                    onClick={() => handleRemoveModulation(mod.id)}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="modulation-matrix__item-controls">
                  <label className="modulation-matrix__item-label">Amount</label>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={mod.amount}
                    onChange={(e) => handleAmountChange(mod.id, parseFloat(e.target.value))}
                    className="modulation-matrix__item-slider"
                  />
                  <span className="modulation-matrix__item-value">
                    {(mod.amount * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Button */}
      <button
        className="modulation-matrix__add-btn"
        onClick={() => setShowAddModal(true)}
      >
        <Plus size={16} />
        Add Modulation
      </button>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modulation-matrix__modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modulation-matrix__modal" onClick={(e) => e.stopPropagation()}>
            <div className="modulation-matrix__modal-header">
              <h4>Add Modulation Routing</h4>
              <button
                className="modulation-matrix__modal-close"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modulation-matrix__modal-content">
              {/* Source Selection */}
              <div className="modulation-matrix__modal-section">
                <label className="modulation-matrix__modal-label">Source (Modulator)</label>
                <div className="modulation-matrix__modal-grid">
                  {MODULATION_SOURCES.map((source) => (
                    <button
                      key={source.id}
                      className={`modulation-matrix__modal-option ${selectedSource === source.id ? 'active' : ''}`}
                      onClick={() => setSelectedSource(source.id)}
                    >
                      <span className="modulation-matrix__modal-option-icon">{source.icon}</span>
                      <span className="modulation-matrix__modal-option-name">{source.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Selection */}
              <div className="modulation-matrix__modal-section">
                <label className="modulation-matrix__modal-label">Target (Parameter)</label>
                <div className="modulation-matrix__modal-list">
                  {MODULATION_TARGETS.map((target) => (
                    <button
                      key={target.id}
                      className={`modulation-matrix__modal-list-item ${selectedTarget === target.id ? 'active' : ''}`}
                      onClick={() => setSelectedTarget(target.id)}
                    >
                      <span className="modulation-matrix__modal-list-category">{target.category}</span>
                      <span className="modulation-matrix__modal-list-name">{target.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div className="modulation-matrix__modal-section">
                <label className="modulation-matrix__modal-label">
                  Amount: {(amount * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value))}
                  className="modulation-matrix__modal-slider"
                />
              </div>
            </div>

            <div className="modulation-matrix__modal-footer">
              <button
                className="modulation-matrix__modal-btn modulation-matrix__modal-btn--cancel"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="modulation-matrix__modal-btn modulation-matrix__modal-btn--add"
                onClick={handleAddModulation}
                disabled={!selectedSource || !selectedTarget}
              >
                Add Routing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="modulation-matrix__info">
        <strong>ℹ️ Note:</strong> Modulation matrix is currently in preview mode.
        Full implementation coming soon with real-time parameter modulation.
      </div>
    </div>
  );
};

export default ModulationMatrix;
