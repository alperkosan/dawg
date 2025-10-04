/**
 * 🎵 AUDIO EXPORT PANEL
 *
 * UI for audio export and manipulation features
 * Pattern-to-audio, split channels, batch operations
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { FileAudio, Zap, Snowflake } from 'lucide-react';
import { audioExportManager, EXPORT_FORMATS, QUALITY_PRESETS, EXPORT_TYPES, FL_PRESETS } from '../lib/audio/AudioExportManager';
import { useArrangementStore } from '../store/useArrangementStore';
import './AudioExportPanel.css';

const AudioExportPanel = ({ isOpen, onClose }) => {
  // State
  const [selectedPatterns, setSelectedPatterns] = useState([]);
  const [exportSettings, setExportSettings] = useState({
    format: EXPORT_FORMATS.WAV,
    quality: 'STANDARD',
    type: EXPORT_TYPES.PATTERN,
    normalize: true,
    fadeOut: true,
    includeEffects: true
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  // Store data
  const { patterns, activePatternId } = useArrangementStore();

  // Available patterns for export
  const availablePatterns = useMemo(() => {
    return Object.entries(patterns).map(([id, pattern]) => ({
      id,
      name: pattern.name || `Pattern ${id}`,
      hasNotes: Object.values(pattern.data || {}).some(notes => notes && notes.length > 0)
    })).filter(p => p.hasNotes);
  }, [patterns]);

  // =================== EXPORT OPERATIONS ===================

  const handleExportPattern = useCallback(async (patternId) => {
    try {
      setIsExporting(true);
      setExportProgress({ status: 'preparing', pattern: patternId });

      const result = await audioExportManager.exportPattern(patternId, {
        format: exportSettings.format,
        quality: QUALITY_PRESETS[exportSettings.quality],
        type: exportSettings.type,
        normalize: exportSettings.normalize,
        fadeOut: exportSettings.fadeOut,
        includeEffects: exportSettings.includeEffects
      });

      setExportProgress({
        status: 'completed',
        pattern: patternId,
        files: result.length,
        message: `Exported ${result.length} file(s) successfully`
      });

    } catch (error) {
      console.error('🎵 Export failed:', error);
      setExportProgress({
        status: 'error',
        pattern: patternId,
        error: error.message
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(null), 3000);
    }
  }, [exportSettings]);

  const handleBatchExport = useCallback(async () => {
    if (selectedPatterns.length === 0) return;

    try {
      setIsExporting(true);
      setExportProgress({ status: 'batch-preparing', count: selectedPatterns.length });

      const results = await audioExportManager.batchExportPatterns(selectedPatterns, {
        format: exportSettings.format,
        quality: QUALITY_PRESETS[exportSettings.quality],
        type: exportSettings.type,
        normalize: exportSettings.normalize,
        fadeOut: exportSettings.fadeOut,
        includeEffects: exportSettings.includeEffects
      });

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      setExportProgress({
        status: 'batch-completed',
        successful,
        failed,
        message: `Batch export: ${successful} successful, ${failed} failed`
      });

    } catch (error) {
      setExportProgress({
        status: 'error',
        error: error.message
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(null), 5000);
    }
  }, [selectedPatterns, exportSettings]);

  // =================== FL STUDIO-STYLE METHODS ===================

  const handleFreezePattern = useCallback(async (patternId) => {
    try {
      setIsExporting(true);
      setExportProgress({ status: 'preparing', pattern: patternId, message: 'Freezing pattern...' });

      const result = await audioExportManager.freezePattern(patternId);

      setExportProgress({
        status: 'completed',
        pattern: patternId,
        message: `Pattern frozen successfully (CPU load reduced)`
      });

    } catch (error) {
      setExportProgress({
        status: 'error',
        pattern: patternId,
        error: error.message
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(null), 3000);
    }
  }, []);

  const handleQuickMixdown = useCallback(async (patternId) => {
    try {
      setIsExporting(true);
      setExportProgress({ status: 'preparing', pattern: patternId, message: 'Creating mixdown...' });

      const result = await audioExportManager.quickMixdown(patternId);

      setExportProgress({
        status: 'completed',
        pattern: patternId,
        message: `High-quality mixdown exported`
      });

    } catch (error) {
      setExportProgress({
        status: 'error',
        pattern: patternId,
        error: error.message
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(null), 3000);
    }
  }, []);

  const handlePatternToAudio = useCallback(async (patternId, options = {}) => {
    try {
      setIsExporting(true);
      setExportProgress({ status: 'preparing', pattern: patternId, message: 'Converting to audio...' });

      const result = await audioExportManager.patternToAudioWorkflow(patternId, {
        replaceOriginal: false,
        createInstrument: true,
        ...options
      });

      const message = result.clipId
        ? `Pattern converted to audio instrument (${result.cpuSavings.estimatedSavings} CPU savings) + Added to arrangement`
        : `Pattern converted to audio instrument (${result.cpuSavings.estimatedSavings} CPU savings)`;

      setExportProgress({
        status: 'completed',
        pattern: patternId,
        message
      });

    } catch (error) {
      setExportProgress({
        status: 'error',
        pattern: patternId,
        error: error.message
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportProgress(null), 3000);
    }
  }, []);


  // =================== UI HELPERS ===================

  const handlePatternSelection = useCallback((patternId, selected) => {
    setSelectedPatterns(prev =>
      selected
        ? [...prev, patternId]
        : prev.filter(id => id !== patternId)
    );
  }, []);

  const getProgressMessage = () => {
    if (!exportProgress) return null;

    switch (exportProgress.status) {
      case 'preparing':
        return `Preparing ${exportProgress.pattern}...`;
      case 'batch-preparing':
        return `Preparing batch export of ${exportProgress.count} patterns...`;
      case 'completed':
      case 'batch-completed':
        return exportProgress.message;
      case 'error':
        return `Error: ${exportProgress.error}`;
      default:
        return 'Processing...';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="audio-export-panel">
      <div className="audio-export-panel__header">
        <h3 className="audio-export-panel__title">🎵 Pattern to Audio</h3>
        <button onClick={onClose} className="audio-export-panel__close">×</button>
      </div>

      <div className="audio-export-panel__content">
        {/* Render Settings */}
        <div className="audio-export-panel__section">
          <h4 className="audio-export-panel__section-title">🎛️ Render Settings</h4>

          <div className="audio-export-panel__settings-grid">
            <div className="audio-export-panel__setting-group">
              <label>Quality</label>
              <select
                value={exportSettings.quality}
                onChange={(e) => setExportSettings(prev => ({ ...prev, quality: e.target.value }))}
              >
                <option value="STANDARD">Standard (44kHz)</option>
                <option value="HIGH">High (48kHz)</option>
                <option value="STUDIO">Studio (96kHz)</option>
              </select>
            </div>

            <div className="audio-export-panel__setting-group">
              <label>Format</label>
              <select
                value={exportSettings.format}
                onChange={(e) => setExportSettings(prev => ({ ...prev, format: e.target.value }))}
              >
                <option value={EXPORT_FORMATS.WAV}>WAV</option>
                <option value={EXPORT_FORMATS.MP3}>MP3</option>
              </select>
            </div>
          </div>

          <div className="audio-export-panel__checkboxes">
            <label>
              <input
                type="checkbox"
                checked={exportSettings.includeEffects}
                onChange={(e) => setExportSettings(prev => ({ ...prev, includeEffects: e.target.checked }))}
              />
              Include Effects
            </label>
            <label>
              <input
                type="checkbox"
                checked={exportSettings.normalize}
                onChange={(e) => setExportSettings(prev => ({ ...prev, normalize: e.target.checked }))}
              />
              Normalize
            </label>
          </div>
        </div>

        {/* FL Studio-Style Workflow */}
        <div className="audio-export-panel__section">
          <h4 className="audio-export-panel__section-title">🎛️ FL Studio Workflow</h4>
          <div className="audio-export-panel__fl-buttons">
            <button
              onClick={() => handleFreezePattern(activePatternId)}
              disabled={isExporting || !activePatternId}
              className="audio-export-panel__btn audio-export-panel__btn--freeze"
              title="Freeze pattern to reduce CPU load"
            >
              <Snowflake size={16} />
              Freeze Pattern
            </button>

            <button
              onClick={() => handlePatternToAudio(activePatternId)}
              disabled={isExporting || !activePatternId}
              className="audio-export-panel__btn audio-export-panel__btn--workflow"
              title="Convert pattern to audio instrument"
            >
              <Zap size={16} />
              Pattern → Audio
            </button>

            <button
              onClick={() => handleQuickMixdown(activePatternId)}
              disabled={isExporting || !activePatternId}
              className="audio-export-panel__btn audio-export-panel__btn--mixdown"
              title="High-quality mixdown export"
            >
              <FileAudio size={16} />
              Quick Mixdown
            </button>
          </div>

          <div className="audio-export-panel__fl-info">
            <small>💡 FL Studio workflow: Export patterns as audio to reduce CPU load and create reusable audio clips</small>
          </div>
        </div>


        {/* Pattern Selection */}
        <div className="audio-export-panel__section">
          <h4 className="audio-export-panel__section-title">🎼 Select Patterns</h4>

          <div className="audio-export-panel__pattern-list">
            {availablePatterns.map(pattern => (
              <div key={pattern.id} className="audio-export-panel__pattern-item">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedPatterns.includes(pattern.id)}
                    onChange={(e) => handlePatternSelection(pattern.id, e.target.checked)}
                  />
                  <span className={pattern.id === activePatternId ? 'audio-export-panel__active-pattern' : ''}>
                    {pattern.name}
                  </span>
                </label>
              </div>
            ))}
          </div>

          <button
            onClick={handleBatchExport}
            disabled={isExporting || selectedPatterns.length === 0}
            className="audio-export-panel__btn audio-export-panel__btn--primary"
            style={{ width: '100%', padding: '10px' }}
          >
            <FileAudio size={16} />
            Export Selected ({selectedPatterns.length})
          </button>
        </div>


        {/* Progress Display */}
        {exportProgress && (
          <div className={`audio-export-panel__progress ${
            exportProgress.status === 'error' ? 'audio-export-panel__progress--error' :
            (exportProgress.status.includes('completed') ? 'audio-export-panel__progress--success' : '')
          }`}>
            <div>{getProgressMessage()}</div>
            {isExporting && (
              <div className="audio-export-panel__spinner">⏳</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioExportPanel;