import React, { useState } from 'react';
import { effectRegistry } from '@/lib/audio/EffectRegistry.js';
import './EffectBuilder.css';

/**
 * EffectBuilder Component
 * Visual interface for creating custom effects by chaining DSP modules
 */
export const EffectBuilder = ({ onEffectCreate, onClose }) => {
  const [effectName, setEffectName] = useState('My Custom Effect');
  const [dspChain, setDspChain] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);

  const availableModules = effectRegistry.getDSPModules();

  const addModule = (moduleType) => {
    const moduleConfig = availableModules.find(m => m.type === moduleType);
    if (!moduleConfig) return;

    const defaultParams = {};
    moduleConfig.params.forEach(param => {
      // Set sensible defaults
      if (param === 'frequency') defaultParams[param] = 1000;
      else if (param === 'q') defaultParams[param] = 1.0;
      else if (param === 'drive') defaultParams[param] = 1.5;
      else if (param === 'time') defaultParams[param] = 0.3;
      else if (param === 'feedback') defaultParams[param] = 0.3;
      else if (param === 'rate') defaultParams[param] = 1.0;
      else if (param === 'amount') defaultParams[param] = 1.0;
      else if (param === 'threshold') defaultParams[param] = -24;
      else if (param === 'ratio') defaultParams[param] = 4;
      else if (param === 'attack') defaultParams[param] = 0.003;
      else if (param === 'release') defaultParams[param] = 0.25;
      else if (param === 'decay') defaultParams[param] = 2.5;
      else if (param === 'type') defaultParams[param] = 'lowpass';
      else if (param === 'shape') defaultParams[param] = 'sine';
      else defaultParams[param] = 0.5;
    });

    setDspChain([...dspChain, {
      id: Date.now(),
      type: moduleType,
      params: defaultParams
    }]);
  };

  const removeModule = (id) => {
    setDspChain(dspChain.filter(m => m.id !== id));
  };

  const updateModuleParam = (id, paramName, value) => {
    setDspChain(dspChain.map(module =>
      module.id === id
        ? { ...module, params: { ...module.params, [paramName]: value } }
        : module
    ));
  };

  const moveModule = (id, direction) => {
    const index = dspChain.findIndex(m => m.id === id);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= dspChain.length) return;

    const newChain = [...dspChain];
    [newChain[index], newChain[newIndex]] = [newChain[newIndex], newChain[index]];
    setDspChain(newChain);
  };

  const createEffect = () => {
    const effectConfig = {
      effectName,
      dspChain: dspChain.map(({ id, ...rest }) => rest) // Remove id before sending
    };

    onEffectCreate?.(effectConfig);
  };

  const getModuleName = (type) => {
    return availableModules.find(m => m.type === type)?.name || type;
  };

  return (
    <div className="effect-builder">
      <div className="effect-builder-header">
        <h2>Effect Builder</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="effect-builder-content">
        {/* Effect Name */}
        <div className="effect-name-section">
          <label>Effect Name:</label>
          <input
            type="text"
            value={effectName}
            onChange={(e) => setEffectName(e.target.value)}
            placeholder="My Custom Effect"
          />
        </div>

        {/* Module Library */}
        <div className="module-library">
          <h3>Add Module</h3>
          <div className="module-grid">
            {availableModules.map(module => (
              <button
                key={module.type}
                className="module-add-btn"
                onClick={() => addModule(module.type)}
              >
                + {module.name}
              </button>
            ))}
          </div>
        </div>

        {/* DSP Chain */}
        <div className="dsp-chain">
          <h3>DSP Chain ({dspChain.length} modules)</h3>
          {dspChain.length === 0 ? (
            <div className="empty-chain">
              Add modules to create your custom effect
            </div>
          ) : (
            <div className="chain-modules">
              {dspChain.map((module, index) => (
                <div key={module.id} className="chain-module">
                  <div className="module-header">
                    <span className="module-index">{index + 1}</span>
                    <span className="module-name">{getModuleName(module.type)}</span>
                    <div className="module-controls">
                      <button
                        onClick={() => moveModule(module.id, 'up')}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveModule(module.id, 'down')}
                        disabled={index === dspChain.length - 1}
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeModule(module.id)}
                        className="remove-btn"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="module-params">
                    {Object.entries(module.params).map(([paramName, value]) => (
                      <div key={paramName} className="param-control">
                        <label>{paramName}</label>
                        {paramName === 'type' ? (
                          <select
                            value={value}
                            onChange={(e) => updateModuleParam(module.id, paramName, e.target.value)}
                          >
                            <option value="lowpass">Lowpass</option>
                            <option value="highpass">Highpass</option>
                            <option value="bandpass">Bandpass</option>
                            <option value="notch">Notch</option>
                          </select>
                        ) : paramName === 'shape' ? (
                          <select
                            value={value}
                            onChange={(e) => updateModuleParam(module.id, paramName, e.target.value)}
                          >
                            <option value="sine">Sine</option>
                            <option value="triangle">Triangle</option>
                            <option value="square">Square</option>
                            <option value="saw">Saw</option>
                          </select>
                        ) : (
                          <>
                            <input
                              type="number"
                              value={value}
                              onChange={(e) => updateModuleParam(module.id, paramName, parseFloat(e.target.value))}
                              step={paramName === 'frequency' ? 10 : 0.1}
                            />
                            <input
                              type="range"
                              value={value}
                              onChange={(e) => updateModuleParam(module.id, paramName, parseFloat(e.target.value))}
                              min={paramName === 'frequency' ? 20 : paramName === 'threshold' ? -60 : 0}
                              max={paramName === 'frequency' ? 20000 : paramName === 'ratio' ? 20 : paramName === 'drive' ? 10 : 1}
                              step={paramName === 'frequency' ? 10 : 0.01}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="effect-builder-actions">
          <button
            className="create-effect-btn"
            onClick={createEffect}
            disabled={dspChain.length === 0}
          >
            Create Effect
          </button>
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
