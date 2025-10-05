import React, { useState } from 'react';
import { X, Download, Activity } from 'lucide-react';
import './RenderDialog.css';

/**
 * Render Dialog Component
 * Allows rendering samples, patterns, and tracks to new audio
 */
const RenderDialog = ({ isOpen, onClose, renderOptions, onRender }) => {
  const [settings, setSettings] = useState({
    renderType: renderOptions.type || 'sample', // 'sample', 'pattern', 'track', 'selection'
    name: renderOptions.name || 'Rendered Audio',
    normalize: true,
    includeEffects: true,
    addToProject: true,
    addToArrangement: false,
    quality: 'high', // 'standard', 'high', 'ultra'
    format: 'wav',
    ...renderOptions.settings
  });

  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  const qualityPresets = {
    standard: { sampleRate: 44100, bitDepth: 16, label: 'Standard (44.1kHz, 16-bit)' },
    high: { sampleRate: 48000, bitDepth: 24, label: 'High (48kHz, 24-bit)' },
    ultra: { sampleRate: 96000, bitDepth: 32, label: 'Ultra (96kHz, 32-bit)' }
  };

  const handleRender = async () => {
    setIsRendering(true);
    setProgress(0);

    try {
      const result = await onRender({
        ...settings,
        qualityPreset: qualityPresets[settings.quality],
        onProgress: (p) => setProgress(p)
      });

      if (result.success) {
        onClose();
      }
    } catch (error) {
      console.error('Render failed:', error);
      alert(`Render failed: ${error.message}`);
    } finally {
      setIsRendering(false);
      setProgress(0);
    }
  };

  const renderTypeLabels = {
    sample: 'Render Audio Sample',
    pattern: 'Render Pattern to Audio',
    track: 'Render Track to Audio',
    selection: 'Render Selection'
  };

  return (
    <div className="render-dialog-overlay">
      <div className="render-dialog">
        <div className="render-dialog-header">
          <div className="render-dialog-title">
            <Activity size={20} />
            <h3>{renderTypeLabels[settings.renderType]}</h3>
          </div>
          <button className="render-dialog-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="render-dialog-content">
          {/* Source Info */}
          <div className="render-section">
            <label>Source</label>
            <div className="render-source-info">
              <span className="source-name">{renderOptions.sourceName || 'Unknown'}</span>
              {renderOptions.duration && (
                <span className="source-duration">
                  Duration: {renderOptions.duration.toFixed(2)}s
                </span>
              )}
            </div>
          </div>

          {/* Output Name */}
          <div className="render-section">
            <label>Output Name</label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              placeholder="Rendered Audio"
            />
          </div>

          {/* Quality Settings */}
          <div className="render-section">
            <label>Quality</label>
            <select
              value={settings.quality}
              onChange={(e) => setSettings({ ...settings, quality: e.target.value })}
            >
              <option value="standard">{qualityPresets.standard.label}</option>
              <option value="high">{qualityPresets.high.label}</option>
              <option value="ultra">{qualityPresets.ultra.label}</option>
            </select>
          </div>

          {/* Processing Options */}
          <div className="render-section">
            <label>Processing</label>
            <div className="render-options">
              <label className="render-checkbox">
                <input
                  type="checkbox"
                  checked={settings.includeEffects}
                  onChange={(e) => setSettings({ ...settings, includeEffects: e.target.checked })}
                />
                <span>Include Effects</span>
              </label>
              <label className="render-checkbox">
                <input
                  type="checkbox"
                  checked={settings.normalize}
                  onChange={(e) => setSettings({ ...settings, normalize: e.target.checked })}
                />
                <span>Normalize Audio</span>
              </label>
            </div>
          </div>

          {/* Import Options */}
          <div className="render-section">
            <label>After Rendering</label>
            <div className="render-options">
              <label className="render-checkbox">
                <input
                  type="checkbox"
                  checked={settings.addToProject}
                  onChange={(e) => setSettings({ ...settings, addToProject: e.target.checked })}
                />
                <span>Add to Instruments</span>
              </label>
              {settings.renderType !== 'sample' && (
                <label className="render-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.addToArrangement}
                    onChange={(e) => setSettings({ ...settings, addToArrangement: e.target.checked })}
                  />
                  <span>Add to Arrangement</span>
                </label>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {isRendering && (
            <div className="render-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="progress-text">{Math.round(progress)}%</span>
            </div>
          )}
        </div>

        <div className="render-dialog-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isRendering}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleRender}
            disabled={isRendering || !settings.name.trim()}
          >
            <Download size={16} />
            {isRendering ? 'Rendering...' : 'Render'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenderDialog;