/**
 * 🎵 AUDIO EXPORT PANEL
 *
 * UI for audio export and manipulation features
 * Pattern-to-audio, split channels, batch operations
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { FileAudio, Zap, Snowflake, Save } from 'lucide-react';
import { audioExportManager, EXPORT_FORMATS, QUALITY_PRESETS, EXPORT_TYPES, FL_PRESETS } from '@/lib/audio/AudioExportManager.js';
import { useArrangementStore } from '@/store/useArrangementStore';
import { TimeRangeSelector } from './TimeRangeSelector';
import './AudioExportPanel.css';

// ✅ NEW: Export Presets Management
const AUDIO_EXPORT_PRESETS_KEY = 'dawg_audio_export_presets';

const DEFAULT_AUDIO_PRESETS = {
  'Master Mixdown': {
    format: EXPORT_FORMATS.WAV,
    quality: 'STUDIO',
    type: EXPORT_TYPES.PATTERN,
    normalize: true,
    fadeOut: true,
    includeEffects: true,
    mp3Bitrate: 320,
    mp3Mode: 'CBR',
    mp3Quality: 2,
    fileNameTemplate: '{patternName}_{timestamp}',
    exportStems: false
  },
  'Stems for Mixing': {
    format: EXPORT_FORMATS.WAV,
    quality: 'HIGH',
    type: EXPORT_TYPES.PATTERN,
    normalize: false,
    fadeOut: false,
    includeEffects: true,
    mp3Bitrate: 320,
    mp3Mode: 'CBR',
    mp3Quality: 2,
    fileNameTemplate: '{patternName}_{stemName}',
    exportStems: true,
    stemNamingTemplate: '{patternName}_{stemName}'
  },
  'Social Media': {
    format: EXPORT_FORMATS.MP3,
    quality: 'STANDARD',
    type: EXPORT_TYPES.PATTERN,
    normalize: true,
    fadeOut: true,
    includeEffects: true,
    mp3Bitrate: 320,
    mp3Mode: 'CBR',
    mp3Quality: 2,
    fileNameTemplate: '{patternName}_{timestamp}',
    exportStems: false
  }
};

function loadAudioPresets() {
  try {
    const stored = localStorage.getItem(AUDIO_EXPORT_PRESETS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_AUDIO_PRESETS, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load audio export presets:', error);
  }
  return DEFAULT_AUDIO_PRESETS;
}

function saveAudioPresets(presets) {
  try {
    localStorage.setItem(AUDIO_EXPORT_PRESETS_KEY, JSON.stringify(presets));
  } catch (error) {
    console.warn('Failed to save audio export presets:', error);
  }
}

const AudioExportPanel = ({ isOpen, onClose }) => {
  // State
  const [selectedPatterns, setSelectedPatterns] = useState([]);
  const [exportSettings, setExportSettings] = useState({
    format: EXPORT_FORMATS.WAV,
    quality: 'STANDARD',
    type: EXPORT_TYPES.PATTERN,
    normalize: true,
    fadeOut: true,
    includeEffects: true,
    // ✅ NEW: MP3 compression options
    mp3Bitrate: 320,
    mp3Mode: 'CBR',
    mp3Quality: 2,
    // ✅ NEW: File naming template
    fileNameTemplate: '{patternName}_{timestamp}',
    // ✅ NEW: Stems export options
    exportStems: false,
    stemNamingTemplate: '{patternName}_{stemName}',
    // ✅ NEW: Time range selection
    startTime: null,
    endTime: null,
    useLoopRegion: false
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  // ✅ NEW: Export presets
  const [presets, setPresets] = useState(() => loadAudioPresets());
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  // ✅ NEW: Load preset when selected
  useEffect(() => {
    if (selectedPreset && presets[selectedPreset]) {
      setExportSettings(prev => ({ ...prev, ...presets[selectedPreset] }));
    }
  }, [selectedPreset, presets]);

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

      const result = await audioExportManager.freezePattern(patternId, {
        onProgress: (progress) => {
          setExportProgress({
            status: 'rendering',
            pattern: patternId,
            message: progress.message || 'Rendering audio...',
            progress: progress.percent
          });
        }
      });

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
      setExportProgress({ status: 'preparing', pattern: patternId, message: 'Scheduling pattern notes...' });

      const result = await audioExportManager.patternToAudioWorkflow(patternId, {
        replaceOriginal: false,
        createInstrument: true,
        onProgress: (progress) => {
          setExportProgress({
            status: 'rendering',
            pattern: patternId,
            message: progress.message || 'Rendering audio...',
            progress: progress.percent
          });
        },
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

  // ✅ NEW: Preset management
  const handleLoadPreset = useCallback((presetName) => {
    setSelectedPreset(presetName);
  }, []);

  const handleSavePreset = useCallback(async () => {
    if (!presetName.trim()) {
      const { apiClient } = await import('@/services/api.js');
      apiClient.showToast('Please enter a preset name', 'warning', 3000);
      return;
    }
    const newPresets = {
      ...presets,
      [presetName]: { ...exportSettings }
    };
    setPresets(newPresets);
    saveAudioPresets(newPresets);
    setShowSavePresetDialog(false);
    setPresetName('');
    const { apiClient } = await import('@/services/api.js');
    apiClient.showToast(`Preset "${presetName}" saved`, 'success', 2000);
  }, [presetName, exportSettings, presets]);

  const handleDeletePreset = useCallback(async (presetName) => {
    if (presetName in DEFAULT_AUDIO_PRESETS) {
      const { apiClient } = await import('@/services/api.js');
      apiClient.showToast('Cannot delete default presets', 'warning', 3000);
      return;
    }
    const newPresets = { ...presets };
    delete newPresets[presetName];
    setPresets(newPresets);
    saveAudioPresets(newPresets);
    if (selectedPreset === presetName) {
      setSelectedPreset(null);
    }
  }, [presets, selectedPreset]);

  const getProgressMessage = () => {
    if (!exportProgress) return null;

    switch (exportProgress.status) {
      case 'preparing':
        return exportProgress.message || `Preparing ${exportProgress.pattern}...`;
      case 'rendering':
        return exportProgress.message || 'Rendering audio...';
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
        {/* ✅ NEW: Export Presets */}
        <div className="audio-export-panel__section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 className="audio-export-panel__section-title">📋 Export Presets</h4>
            <button
              onClick={() => setShowSavePresetDialog(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', background: '#333', border: '1px solid #555', borderRadius: '4px', color: '#ccc', cursor: 'pointer', fontSize: '11px' }}
            >
              <Save size={12} />
              Save
            </button>
          </div>
          <div className="audio-export-panel__setting-group">
            <label>Load Preset</label>
            <select
              value={selectedPreset || ''}
              onChange={(e) => handleLoadPreset(e.target.value || null)}
              style={{ width: '100%', padding: '6px 8px', background: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#ccc', fontSize: '12px' }}
            >
              <option value="">-- Select Preset --</option>
              {Object.keys(presets).map(presetName => (
                <option key={presetName} value={presetName}>
                  {presetName} {presetName in DEFAULT_AUDIO_PRESETS ? '(Default)' : ''}
                </option>
              ))}
            </select>
            {selectedPreset && presets[selectedPreset] && !(selectedPreset in DEFAULT_AUDIO_PRESETS) && (
              <button
                onClick={() => handleDeletePreset(selectedPreset)}
                style={{ marginTop: '4px', fontSize: '11px', color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Delete Preset
              </button>
            )}
          </div>
          {showSavePresetDialog && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#2a2a2a', borderRadius: '4px', border: '1px solid #444' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#aaa' }}>Preset Name</label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Enter preset name..."
                style={{ width: '100%', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#ccc', fontSize: '12px', marginBottom: '8px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSavePreset}
                  style={{ padding: '6px 12px', background: '#00ff88', color: '#000', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowSavePresetDialog(false); setPresetName(''); }}
                  style={{ padding: '6px 12px', background: '#333', color: '#ccc', borderRadius: '4px', border: '1px solid #555', cursor: 'pointer', fontSize: '12px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

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
            <label>
              <input
                type="checkbox"
                checked={exportSettings.exportStems}
                onChange={(e) => setExportSettings(prev => ({ ...prev, exportStems: e.target.checked }))}
              />
              Export Stems
            </label>
          </div>

          {/* ✅ NEW: MP3 Compression Options */}
          {exportSettings.format === EXPORT_FORMATS.MP3 && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#2a2a2a', borderRadius: '4px', border: '1px solid #444' }}>
              <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600, color: '#fff' }}>MP3 Compression</h5>
              <div className="audio-export-panel__settings-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="audio-export-panel__setting-group">
                  <label>Bitrate</label>
                  <select
                    value={exportSettings.mp3Bitrate}
                    onChange={(e) => setExportSettings(prev => ({ ...prev, mp3Bitrate: parseInt(e.target.value) }))}
                  >
                    <option value={128}>128 kbps</option>
                    <option value={192}>192 kbps</option>
                    <option value={256}>256 kbps</option>
                    <option value={320}>320 kbps</option>
                  </select>
                </div>
                <div className="audio-export-panel__setting-group">
                  <label>Mode</label>
                  <select
                    value={exportSettings.mp3Mode}
                    onChange={(e) => setExportSettings(prev => ({ ...prev, mp3Mode: e.target.value }))}
                  >
                    <option value="CBR">CBR</option>
                    <option value="VBR">VBR</option>
                  </select>
                </div>
              </div>
              {exportSettings.mp3Mode === 'VBR' && (
                <div className="audio-export-panel__setting-group" style={{ marginTop: '8px' }}>
                  <label>VBR Quality (0-9)</label>
                  <input
                    type="range"
                    min="0"
                    max="9"
                    value={exportSettings.mp3Quality}
                    onChange={(e) => setExportSettings(prev => ({ ...prev, mp3Quality: parseInt(e.target.value) }))}
                    style={{ width: '100%' }}
                  />
                  <small style={{ fontSize: '10px', color: '#aaa' }}>Quality: {exportSettings.mp3Quality}</small>
                </div>
              )}
              <small style={{ display: 'block', marginTop: '8px', fontSize: '10px', color: '#888' }}>
                ⚠️ MP3 encoding requires encoder library. Currently exports as WAV.
              </small>
            </div>
          )}

          {/* ✅ NEW: File Naming Template */}
          <div className="audio-export-panel__setting-group" style={{ marginTop: '16px' }}>
            <label>File Naming Template</label>
            <input
              type="text"
              value={exportSettings.fileNameTemplate}
              onChange={(e) => setExportSettings(prev => ({ ...prev, fileNameTemplate: e.target.value }))}
              placeholder="{patternName}_{timestamp}"
              style={{ width: '100%', padding: '6px 8px', background: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#ccc', fontSize: '12px' }}
            />
            <small style={{ fontSize: '10px', color: '#aaa', display: 'block', marginTop: '4px' }}>
              Variables: {'{patternName}'}, {'{timestamp}'}, {'{format}'}, {'{quality}'}
            </small>
          </div>

          {/* ✅ NEW: Stems Export Options */}
          {exportSettings.exportStems && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#2a2a2a', borderRadius: '4px', border: '1px solid #444' }}>
              <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600, color: '#fff' }}>Stem Naming</h5>
              <div className="audio-export-panel__setting-group">
                <label>Stem Template</label>
                <input
                  type="text"
                  value={exportSettings.stemNamingTemplate}
                  onChange={(e) => setExportSettings(prev => ({ ...prev, stemNamingTemplate: e.target.value }))}
                  placeholder="{patternName}_{stemName}"
                  style={{ width: '100%', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#ccc', fontSize: '12px' }}
                />
                <small style={{ fontSize: '10px', color: '#aaa', display: 'block', marginTop: '4px' }}>
                  Variables: {'{patternName}'}, {'{stemName}'}, {'{timestamp}'}
                </small>
              </div>
            </div>
          )}
        </div>

        {/* ✅ NEW: Time Range Selection */}
        <div className="audio-export-panel__section">
          <TimeRangeSelector
            startTime={exportSettings.startTime}
            endTime={exportSettings.endTime}
            onStartTimeChange={(beats) => setExportSettings(prev => ({ ...prev, startTime: beats }))}
            onEndTimeChange={(beats) => setExportSettings(prev => ({ ...prev, endTime: beats }))}
            loopRegion={exportSettings.useLoopRegion}
            onLoopRegionChange={(useLoop) => setExportSettings(prev => ({ ...prev, useLoopRegion: useLoop }))}
            disabled={isExporting}
          />
        </div>

        {/* FL Studio-Style Workflow */}
        <div className="audio-export-panel__section">
          <h4 className="audio-export-panel__section-title">🎛️ FL Studio Workflow</h4>
          <div className="audio-export-panel__fl-buttons">
            <button
              onClick={() => handlePatternToAudio(activePatternId, { replaceOriginal: true })}
              disabled={isExporting || !activePatternId}
              className="audio-export-panel__btn audio-export-panel__btn--freeze"
              title="Freeze pattern to reduce CPU load - replaces pattern with audio"
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
            <small>
              💡 <strong>Freeze:</strong> Pattern'i audio'ya çevirip yerine koy (CPU tasarrufu)<br />
              💡 <strong>Pattern → Audio:</strong> Audio sample oluştur + arrangement'a ekle (pattern'i değiştirmez)<br />
              💡 <strong>Quick Mixdown:</strong> Yüksek kaliteli dosya export et (download)
            </small>
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
          <div className={`audio-export-panel__progress ${exportProgress.status === 'error' ? 'audio-export-panel__progress--error' :
              (exportProgress.status.includes('completed') ? 'audio-export-panel__progress--success' : '')
            }`}>
            <div className="audio-export-panel__progress-message">
              {getProgressMessage()}
              {exportProgress.progress !== undefined && (
                <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>
                  {Math.round(exportProgress.progress)}%
                </span>
              )}
            </div>
            {exportProgress.progress !== undefined && exportProgress.status === 'rendering' && (
              <div className="audio-export-panel__progress-bar">
                <div
                  className="audio-export-panel__progress-bar-fill"
                  style={{ width: `${exportProgress.progress}%` }}
                />
              </div>
            )}
            {isExporting && !exportProgress.progress && (
              <div className="audio-export-panel__spinner">⏳</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioExportPanel;