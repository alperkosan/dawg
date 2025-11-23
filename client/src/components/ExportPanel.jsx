/**
 * 🎵 EXPORT PANEL - Comprehensive Export UI
 *
 * Industry-standard export interface inspired by Ableton Live, FL Studio, Pro Tools:
 * - Channel selection (individual or batch)
 * - Format and quality settings
 * - Export options (effects, normalize, fade)
 * - Progress tracking
 * - File naming
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Download, Settings, Play, Square, CheckCircle, XCircle, Loader } from 'lucide-react';
import { exportManager, EXPORT_FORMAT, EXPORT_MODE, QUALITY_PRESET } from '@/lib/audio/ExportManager';
import { useMixerStore } from '@/store/useMixerStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import './ExportPanel.css';

export const ExportPanel = ({ isOpen, onClose }) => {
    // Debug
    React.useEffect(() => {
        console.log('🎵 ExportPanel render:', { isOpen });
    }, [isOpen]);

    // State
    const [selectedChannels, setSelectedChannels] = useState(new Set(['master']));
    const [exportSettings, setExportSettings] = useState({
        format: EXPORT_FORMAT.WAV,
        quality: 'STANDARD',
        mode: EXPORT_MODE.OFFLINE,
        includeEffects: true,
        normalize: true,
        fadeIn: false,
        fadeOut: true,
        fadeInDuration: 0.01,
        fadeOutDuration: 0.1,
        stereo: true,
        startTime: null,
        endTime: null,
        fileNameTemplate: '{channelName}_{timestamp}',
        addToProject: true,        // ✅ NEW: Add to project as audio asset
        addToArrangement: true,    // ✅ NEW: Add to arrangement as clip
        download: false            // ✅ NEW: Don't download by default (add to project instead)
    });
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(null);
    const [exportResults, setExportResults] = useState([]);

    // Store data
    const mixerTracks = useMixerStore(state => state.mixerTracks);
    const isPlaying = usePlaybackStore(state => state.isPlaying);
    const currentStep = usePlaybackStore(state => state.currentStep);

    // Available channels (including master)
    const availableChannels = useMemo(() => {
        // ✅ FIX: Filter out 'master' from mixerTracks to avoid duplicate key
        const regularTracks = mixerTracks.filter(track => track.id !== 'master');
        
        const channels = [
            { id: 'master', name: 'Master', type: 'master' },
            ...regularTracks.map(track => ({
                id: track.id,
                name: track.name || track.id,
                type: 'channel'
            }))
        ];
        return channels;
    }, [mixerTracks]);

    // =================== CHANNEL SELECTION ===================

    const toggleChannel = useCallback((channelId) => {
        setSelectedChannels(prev => {
            const next = new Set(prev);
            if (next.has(channelId)) {
                next.delete(channelId);
            } else {
                next.add(channelId);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedChannels(new Set(availableChannels.map(c => c.id)));
    }, [availableChannels]);

    const deselectAll = useCallback(() => {
        setSelectedChannels(new Set());
    }, []);

    // =================== EXPORT OPERATIONS ===================

    const handleExport = useCallback(async () => {
        if (selectedChannels.size === 0) {
            const { apiClient } = await import('@/services/api.js');
            apiClient.showToast('Please select at least one channel to export', 'warning', 3000);
            return;
        }

        setIsExporting(true);
        setExportProgress({ overall: 0, current: null, status: 'preparing' });
        setExportResults([]);

        try {
            const channelIds = Array.from(selectedChannels);
            const qualityPreset = QUALITY_PRESET[exportSettings.quality] || QUALITY_PRESET.STANDARD;

            const results = await exportManager.exportChannels(
                channelIds,
                {
                    ...exportSettings,
                    quality: qualityPreset,
                    startTime: exportSettings.startTime ?? currentStep
                },
                (channelId, progress, status) => {
                    setExportProgress({
                        overall: progress,
                        current: channelId,
                        status,
                        channelName: availableChannels.find(c => c.id === channelId)?.name
                    });
                }
            );

            setExportResults(results);
            setExportProgress({ overall: 100, status: 'completed' });

            // Show success message if assets/clips were created
            const hasAssets = results.some(r => r.assetId);
            const hasClips = results.some(r => r.clipId);
            if (hasAssets || hasClips) {
                console.log('✅ Export completed:', {
                    assets: results.filter(r => r.assetId).length,
                    clips: results.filter(r => r.clipId).length
                });
            }
        } catch (error) {
            console.error('❌ Export failed:', error);
            setExportProgress({
                overall: 0,
                status: 'error',
                error: error.message
            });
        } finally {
            setIsExporting(false);
            setTimeout(() => {
                setExportProgress(null);
            }, 5000);
        }
    }, [selectedChannels, exportSettings, currentStep, availableChannels]);

    if (!isOpen) {
        return null;
    }

    return (
        <>
            {/* ✅ FIX: Add overlay to prevent clicks on elements behind panel */}
            <div 
                className="export-panel-overlay"
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9999,
                }}
            />
            <div 
                className="export-panel" 
                style={{ zIndex: 10000 }}
                onClick={(e) => e.stopPropagation()} // ✅ FIX: Prevent event bubbling
            >
                <div className="export-panel-header">
                    <h2>🎵 Export Audio</h2>
                    <button className="close-button" onClick={onClose}>✕</button>
                </div>

            <div className="export-panel-content">
                {/* Channel Selection */}
                <section className="export-section">
                    <div className="section-header">
                        <h3>Channels</h3>
                        <div className="section-actions">
                            <button onClick={selectAll} className="link-button">Select All</button>
                            <button onClick={deselectAll} className="link-button">Deselect All</button>
                        </div>
                    </div>
                    <div className="channel-list">
                        {availableChannels.map(channel => (
                            <label key={channel.id} className="channel-item">
                                <input
                                    type="checkbox"
                                    checked={selectedChannels.has(channel.id)}
                                    onChange={() => toggleChannel(channel.id)}
                                    disabled={isExporting}
                                />
                                <span className="channel-name">{channel.name}</span>
                                <span className="channel-type">{channel.type}</span>
                            </label>
                        ))}
                    </div>
                    <div className="selection-info">
                        {selectedChannels.size} channel{selectedChannels.size !== 1 ? 's' : ''} selected
                    </div>
                </section>

                {/* Format Settings */}
                <section className="export-section">
                    <div className="section-header">
                        <h3>Format & Quality</h3>
                    </div>
                    <div className="settings-grid">
                        <div className="setting-group">
                            <label>Format</label>
                            <select
                                value={exportSettings.format}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, format: e.target.value }))}
                                disabled={isExporting}
                            >
                                <option value={EXPORT_FORMAT.WAV}>WAV</option>
                                <option value={EXPORT_FORMAT.MP3}>MP3</option>
                                <option value={EXPORT_FORMAT.OGG}>OGG</option>
                                <option value={EXPORT_FORMAT.FLAC}>FLAC</option>
                                <option value={EXPORT_FORMAT.AIFF}>AIFF</option>
                            </select>
                        </div>

                        <div className="setting-group">
                            <label>Quality</label>
                            <select
                                value={exportSettings.quality}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, quality: e.target.value }))}
                                disabled={isExporting}
                            >
                                <option value="DRAFT">Draft (44.1kHz, 16-bit, Real-time)</option>
                                <option value="STANDARD">Standard (44.1kHz, 24-bit, Offline)</option>
                                <option value="HIGH">High (48kHz, 24-bit, Offline)</option>
                                <option value="PROFESSIONAL">Professional (96kHz, 32-bit, Offline)</option>
                            </select>
                        </div>

                        <div className="setting-group">
                            <label>Mode</label>
                            <select
                                value={exportSettings.mode}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, mode: e.target.value }))}
                                disabled={isExporting}
                            >
                                <option value={EXPORT_MODE.OFFLINE}>Offline (High Quality)</option>
                                <option value={EXPORT_MODE.REALTIME}>Real-time (Fast)</option>
                            </select>
                        </div>

                        <div className="setting-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={exportSettings.stereo}
                                    onChange={(e) => setExportSettings(prev => ({ ...prev, stereo: e.target.checked }))}
                                    disabled={isExporting}
                                />
                                Stereo
                            </label>
                        </div>
                    </div>
                </section>

                {/* Export Options */}
                <section className="export-section">
                    <div className="section-header">
                        <h3>Options</h3>
                    </div>
                    <div className="options-grid">
                        <label className="option-item">
                            <input
                                type="checkbox"
                                checked={exportSettings.includeEffects}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, includeEffects: e.target.checked }))}
                                disabled={isExporting}
                            />
                            Include Effects
                        </label>

                        <label className="option-item">
                            <input
                                type="checkbox"
                                checked={exportSettings.normalize}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, normalize: e.target.checked }))}
                                disabled={isExporting}
                            />
                            Normalize
                        </label>

                        <label className="option-item">
                            <input
                                type="checkbox"
                                checked={exportSettings.fadeIn}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, fadeIn: e.target.checked }))}
                                disabled={isExporting}
                            />
                            Fade In
                        </label>

                        <label className="option-item">
                            <input
                                type="checkbox"
                                checked={exportSettings.fadeOut}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, fadeOut: e.target.checked }))}
                                disabled={isExporting}
                            />
                            Fade Out
                        </label>

                        <label className="option-item">
                            <input
                                type="checkbox"
                                checked={exportSettings.addToProject}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, addToProject: e.target.checked }))}
                                disabled={isExporting}
                            />
                            Add to Project
                        </label>

                        <label className="option-item">
                            <input
                                type="checkbox"
                                checked={exportSettings.addToArrangement}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, addToArrangement: e.target.checked }))}
                                disabled={isExporting || !exportSettings.addToProject}
                            />
                            Add to Arrangement
                        </label>

                        <label className="option-item">
                            <input
                                type="checkbox"
                                checked={exportSettings.download}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, download: e.target.checked }))}
                                disabled={isExporting}
                            />
                            Download File
                        </label>
                    </div>

                    {exportSettings.fadeIn && (
                        <div className="setting-group">
                            <label>Fade In Duration (seconds)</label>
                            <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.01"
                                value={exportSettings.fadeInDuration}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, fadeInDuration: parseFloat(e.target.value) }))}
                                disabled={isExporting}
                            />
                        </div>
                    )}

                    {exportSettings.fadeOut && (
                        <div className="setting-group">
                            <label>Fade Out Duration (seconds)</label>
                            <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.1"
                                value={exportSettings.fadeOutDuration}
                                onChange={(e) => setExportSettings(prev => ({ ...prev, fadeOutDuration: parseFloat(e.target.value) }))}
                                disabled={isExporting}
                            />
                        </div>
                    )}
                </section>

                {/* File Naming */}
                <section className="export-section">
                    <div className="section-header">
                        <h3>File Naming</h3>
                    </div>
                    <div className="setting-group">
                        <label>Template</label>
                        <input
                            type="text"
                            value={exportSettings.fileNameTemplate}
                            onChange={(e) => setExportSettings(prev => ({ ...prev, fileNameTemplate: e.target.value }))}
                            disabled={isExporting}
                            placeholder="{channelName}_{timestamp}"
                        />
                        <small>Available: {'{channelName}'}, {'{timestamp}'}, {'{format}'}</small>
                    </div>
                </section>

                {/* Progress */}
                {exportProgress && (
                    <section className="export-section progress-section">
                        <div className="progress-header">
                            <h3>Export Progress</h3>
                            {exportProgress.status === 'completed' && <CheckCircle className="success-icon" />}
                            {exportProgress.status === 'error' && <XCircle className="error-icon" />}
                            {exportProgress.status === 'exporting' && <Loader className="loading-icon" />}
                        </div>
                        <div className="progress-bar-container">
                            <div className="progress-bar" style={{ width: `${exportProgress.overall}%` }} />
                        </div>
                        {exportProgress.current && (
                            <div className="progress-info">
                                Exporting: {exportProgress.channelName || exportProgress.current} ({Math.round(exportProgress.overall)}%)
                            </div>
                        )}
                        {exportProgress.error && (
                            <div className="error-message">
                                Error: {exportProgress.error}
                            </div>
                        )}
                    </section>
                )}

                {/* Results */}
                {exportResults.length > 0 && (
                    <section className="export-section results-section">
                        <div className="section-header">
                            <h3>Export Results</h3>
                        </div>
                        <div className="results-list">
                            {exportResults.map((result, index) => {
                                const file = result.file || result;
                                return (
                                    <div key={index} className={`result-item ${result.success !== false ? 'success' : 'error'}`}>
                                        {result.success !== false ? (
                                            <>
                                                <CheckCircle className="icon" />
                                                <div className="result-info">
                                                    <span className="channel-name">{file.channelName || file.channelId}</span>
                                                    {file.filename && <span className="filename">{file.filename}</span>}
                                                    {file.assetId && (
                                                        <span className="asset-info">✅ Added to project</span>
                                                    )}
                                                    {file.clipId && (
                                                        <span className="clip-info">🎵 Added to arrangement</span>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="icon" />
                                                <span>{result.channelId || 'Unknown'}</span>
                                                <span className="error-text">{result.error}</span>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Actions */}
                <div className="export-actions">
                    <button
                        className="export-button primary"
                        onClick={handleExport}
                        disabled={isExporting || selectedChannels.size === 0}
                    >
                        <Download className="icon" />
                        {isExporting ? 'Exporting...' : `Export ${selectedChannels.size} Channel${selectedChannels.size !== 1 ? 's' : ''}`}
                    </button>
                    <button
                        className="export-button secondary"
                        onClick={onClose}
                        disabled={isExporting}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
        </>
    );
};

export default ExportPanel;

