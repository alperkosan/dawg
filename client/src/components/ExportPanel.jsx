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

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Download, Settings, Play, Square, CheckCircle, XCircle, Loader, Save, FolderOpen, File, Clock, HardDrive } from 'lucide-react';
import { exportManager, EXPORT_FORMAT, EXPORT_MODE, QUALITY_PRESET } from '@/lib/audio/ExportManager';
import { useMixerStore } from '@/store/useMixerStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { TimeRangeSelector } from './TimeRangeSelector';
import { formatFileSize, formatDuration, formatSampleRate, formatBitDepth, formatExportFormat } from '@/utils/formatUtils';
import './ExportPanel.css';

// ✅ NEW: Export Presets Management
const EXPORT_PRESETS_KEY = 'dawg_export_presets';

const DEFAULT_PRESETS = {
    'Master Mixdown': {
        format: EXPORT_FORMAT.WAV,
        quality: 'PROFESSIONAL',
        mode: EXPORT_MODE.OFFLINE,
        includeEffects: true,
        normalize: true,
        fadeOut: true,
        fadeIn: false,
        stereo: true,
        mp3Bitrate: 320,
        mp3Mode: 'CBR',
        mp3Quality: 2
    },
    'Stems for Mixing': {
        format: EXPORT_FORMAT.WAV,
        quality: 'HIGH',
        mode: EXPORT_MODE.OFFLINE,
        includeEffects: true,
        normalize: false,
        fadeOut: false,
        fadeIn: false,
        stereo: true,
        mp3Bitrate: 320,
        mp3Mode: 'CBR',
        mp3Quality: 2
    },
    'Social Media': {
        format: EXPORT_FORMAT.MP3,
        quality: 'STANDARD',
        mode: EXPORT_MODE.OFFLINE,
        includeEffects: true,
        normalize: true,
        fadeOut: true,
        fadeIn: false,
        stereo: true,
        mp3Bitrate: 320,
        mp3Mode: 'CBR',
        mp3Quality: 2
    },
    'Demo Export': {
        format: EXPORT_FORMAT.WAV,
        quality: 'STANDARD',
        mode: EXPORT_MODE.OFFLINE,
        includeEffects: true,
        normalize: true,
        fadeOut: true,
        fadeIn: false,
        stereo: true,
        mp3Bitrate: 320,
        mp3Mode: 'CBR',
        mp3Quality: 2
    }
};

function loadPresets() {
    try {
        const stored = localStorage.getItem(EXPORT_PRESETS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_PRESETS, ...parsed };
        }
    } catch (error) {
        console.warn('Failed to load export presets:', error);
    }
    return DEFAULT_PRESETS;
}

function savePresets(presets) {
    try {
        localStorage.setItem(EXPORT_PRESETS_KEY, JSON.stringify(presets));
    } catch (error) {
        console.warn('Failed to save export presets:', error);
    }
}

export const ExportPanel = ({ isOpen, onClose }) => {
    // Debug
    React.useEffect(() => {
        console.log('🎵 ExportPanel render:', { isOpen });
    }, [isOpen]);

    // State
    const [exportType, setExportType] = useState('channels'); // 'channels' or 'arrangement'
    const [selectedChannels, setSelectedChannels] = useState(new Set(['master']));
    const [selectedArrangementId, setSelectedArrangementId] = useState(null);
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
        useLoopRegion: false,
        fileNameTemplate: '{channelName}_{timestamp}',
        addToProject: true,        // ✅ NEW: Add to project as audio asset
        addToArrangement: true,    // ✅ NEW: Add to arrangement as clip
        download: false,            // ✅ NEW: Don't download by default (add to project instead)
        // ✅ NEW: MP3 compression options
        mp3Bitrate: 320,
        mp3Mode: 'CBR', // CBR or VBR
        mp3Quality: 2 // 0-9 for VBR
    });
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(null);
    const [exportResults, setExportResults] = useState([]);
    // ✅ NEW: Export presets
    const [presets, setPresets] = useState(() => loadPresets());
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
    const [presetName, setPresetName] = useState('');

    // Store data
    const mixerTracks = useMixerStore(state => state.mixerTracks);
    const isPlaying = usePlaybackStore(state => state.isPlaying);
    const currentStep = usePlaybackStore(state => state.currentStep);
    
    // ✅ NEW: Arrangement data
    const [arrangements, setArrangements] = useState([]);
    const [activeArrangementId, setActiveArrangementId] = useState(null);
    
    // Load arrangements on mount
    useEffect(() => {
        const loadArrangements = async () => {
            try {
                const { useArrangementWorkspaceStore } = await import('@/store/useArrangementWorkspaceStore');
                const workspaceStore = useArrangementWorkspaceStore.getState();
                const arrangementsList = Object.values(workspaceStore.arrangements || {});
                const activeId = workspaceStore.activeArrangementId;
                
                setArrangements(arrangementsList);
                setActiveArrangementId(activeId);
                if (activeId && !selectedArrangementId) {
                    setSelectedArrangementId(activeId);
                }
            } catch (error) {
                console.warn('Failed to load arrangements:', error);
            }
        };
        
        loadArrangements();
    }, [selectedArrangementId]);

    // ✅ NEW: Load preset when selected
    useEffect(() => {
        if (selectedPreset && presets[selectedPreset]) {
            setExportSettings(prev => ({ ...prev, ...presets[selectedPreset] }));
        }
    }, [selectedPreset, presets]);

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
        savePresets(newPresets);
        setShowSavePresetDialog(false);
        setPresetName('');
        const { apiClient } = await import('@/services/api.js');
        apiClient.showToast(`Preset "${presetName}" saved`, 'success', 2000);
    }, [presetName, exportSettings, presets]);

    const handleDeletePreset = useCallback(async (presetName) => {
        if (presetName in DEFAULT_PRESETS) {
            const { apiClient } = await import('@/services/api.js');
            apiClient.showToast('Cannot delete default presets', 'warning', 3000);
            return;
        }
        const newPresets = { ...presets };
        delete newPresets[presetName];
        setPresets(newPresets);
        savePresets(newPresets);
        if (selectedPreset === presetName) {
            setSelectedPreset(null);
        }
    }, [presets, selectedPreset]);

    // =================== EXPORT OPERATIONS ===================

    const handleExport = useCallback(async () => {
        if (exportType === 'channels') {
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
        } else if (exportType === 'arrangement') {
            if (!selectedArrangementId) {
                const { apiClient } = await import('@/services/api.js');
                apiClient.showToast('Please select an arrangement to export', 'warning', 3000);
                return;
            }

            setIsExporting(true);
            setExportProgress({ overall: 0, current: null, status: 'preparing' });
            setExportResults([]);

            try {
                const qualityPreset = QUALITY_PRESET[exportSettings.quality] || QUALITY_PRESET.STANDARD;
                const selectedArrangement = arrangements.find(a => a.id === selectedArrangementId);

                const result = await exportManager.exportArrangement(
                    selectedArrangementId,
                    {
                        ...exportSettings,
                        quality: qualityPreset,
                        fileNameTemplate: exportSettings.fileNameTemplate.replace('{channelName}', selectedArrangement?.name || 'arrangement')
                    },
                    (progress, status) => {
                        setExportProgress({
                            overall: progress,
                            current: selectedArrangement?.name || 'arrangement',
                            status
                        });
                    }
                );

                setExportResults([{ success: true, file: result }]);
                setExportProgress({ overall: 100, status: 'completed' });

                if (result.assetId) {
                    console.log('✅ Arrangement export completed and added to project');
                }
            } catch (error) {
                console.error('❌ Arrangement export failed:', error);
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
        }
    }, [exportType, selectedChannels, selectedArrangementId, arrangements, exportSettings, currentStep, availableChannels]);

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
                {/* ✅ NEW: Export Type Selection */}
                <section className="export-section">
                    <div className="section-header">
                        <h3>Export Type</h3>
                    </div>
                    <div className="settings-grid">
                        <div className="setting-group">
                            <label>Type</label>
                            <select
                                value={exportType}
                                onChange={(e) => setExportType(e.target.value)}
                                disabled={isExporting}
                            >
                                <option value="channels">Channels</option>
                                <option value="arrangement">Arrangement</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Channel Selection (only show for channels export) */}
                {exportType === 'channels' && (
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
                )}

                {/* ✅ NEW: Arrangement Selection (only show for arrangement export) */}
                {exportType === 'arrangement' && (
                    <section className="export-section">
                        <div className="section-header">
                            <h3>Arrangement</h3>
                        </div>
                        <div className="setting-group">
                            <label>Select Arrangement</label>
                            <select
                                value={selectedArrangementId || ''}
                                onChange={(e) => setSelectedArrangementId(e.target.value || null)}
                                disabled={isExporting}
                            >
                                <option value="">-- Select Arrangement --</option>
                                {arrangements.map(arrangement => (
                                    <option key={arrangement.id} value={arrangement.id}>
                                        {arrangement.name} {arrangement.id === activeArrangementId ? '(Active)' : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedArrangementId && (
                                <small>
                                    {arrangements.find(a => a.id === selectedArrangementId)?.clips?.length || 0} clips
                                </small>
                            )}
                        </div>
                    </section>
                )}
                )}

                {/* ✅ NEW: Arrangement Selection (only show for arrangement export) */}
                {exportType === 'arrangement' && (
                    <section className="export-section">
                        <div className="section-header">
                            <h3>Arrangement</h3>
                        </div>
                        <div className="setting-group">
                            <label>Select Arrangement</label>
                            <select
                                value={selectedArrangementId || ''}
                                onChange={(e) => setSelectedArrangementId(e.target.value || null)}
                                disabled={isExporting}
                            >
                                <option value="">-- Select Arrangement --</option>
                                {arrangements.map(arrangement => (
                                    <option key={arrangement.id} value={arrangement.id}>
                                        {arrangement.name} {arrangement.id === activeArrangementId ? '(Active)' : ''}
                                    </option>
                                ))}
                            </select>
                            {selectedArrangementId && (
                                <small>
                                    {arrangements.find(a => a.id === selectedArrangementId)?.clips?.length || 0} clips
                                </small>
                            )}
                        </div>
                    </section>
                )}

                {/* ✅ NEW: Export Presets */}
                <section className="export-section">
                    <div className="section-header">
                        <h3>Export Presets</h3>
                        <div className="section-actions">
                            <button
                                onClick={() => setShowSavePresetDialog(true)}
                                className="link-button"
                                disabled={isExporting}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Save size={14} />
                                Save Preset
                            </button>
                        </div>
                    </div>
                    <div className="setting-group">
                        <label>Load Preset</label>
                        <select
                            value={selectedPreset || ''}
                            onChange={(e) => handleLoadPreset(e.target.value || null)}
                            disabled={isExporting}
                        >
                            <option value="">-- Select Preset --</option>
                            {Object.keys(presets).map(presetName => (
                                <option key={presetName} value={presetName}>
                                    {presetName} {presetName in DEFAULT_PRESETS ? '(Default)' : ''}
                                </option>
                            ))}
                        </select>
                        {selectedPreset && presets[selectedPreset] && !(selectedPreset in DEFAULT_PRESETS) && (
                            <button
                                onClick={() => handleDeletePreset(selectedPreset)}
                                className="link-button"
                                style={{ marginTop: '4px', fontSize: '11px', color: 'var(--zenith-error, #EF4444)' }}
                            >
                                Delete Preset
                            </button>
                        )}
                    </div>
                    {showSavePresetDialog && (
                        <div style={{ marginTop: '12px', padding: '12px', background: 'var(--zenith-bg-tertiary, #1E242F)', borderRadius: '6px', border: '1px solid var(--zenith-border-medium, rgba(255, 255, 255, 0.1))' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>Preset Name</label>
                            <input
                                type="text"
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                                placeholder="Enter preset name..."
                                style={{ width: '100%', padding: '6px 8px', background: 'var(--zenith-bg-primary, #0A0E1A)', border: '1px solid var(--zenith-border-medium, rgba(255, 255, 255, 0.1))', borderRadius: '4px', color: 'var(--zenith-text-primary, #FFFFFF)', fontSize: '12px', marginBottom: '8px' }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={handleSavePreset}
                                    className="link-button"
                                    style={{ padding: '6px 12px', background: 'var(--zenith-accent-cool, #4ECDC4)', color: 'var(--zenith-text-inverse, #0A0E1A)', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => { setShowSavePresetDialog(false); setPresetName(''); }}
                                    className="link-button"
                                    style={{ padding: '6px 12px', background: 'var(--zenith-bg-tertiary, #1E242F)', color: 'var(--zenith-text-primary, #FFFFFF)', borderRadius: '4px', border: '1px solid var(--zenith-border-medium, rgba(255, 255, 255, 0.1))', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
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

                    {/* ✅ NEW: MP3 Compression Options (only show when MP3 is selected) */}
                    {exportSettings.format === EXPORT_FORMAT.MP3 && (
                        <div className="mp3-options" style={{ marginTop: '16px', padding: '16px', background: 'var(--zenith-bg-tertiary, #1E242F)', borderRadius: '6px', border: '1px solid var(--zenith-border-medium, rgba(255, 255, 255, 0.1))' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: 'var(--zenith-text-primary, #FFFFFF)' }}>MP3 Compression</h4>
                            <div className="settings-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                                <div className="setting-group">
                                    <label>Bitrate</label>
                                    <select
                                        value={exportSettings.mp3Bitrate}
                                        onChange={(e) => setExportSettings(prev => ({ ...prev, mp3Bitrate: parseInt(e.target.value) }))}
                                        disabled={isExporting}
                                    >
                                        <option value={128}>128 kbps</option>
                                        <option value={192}>192 kbps</option>
                                        <option value={256}>256 kbps</option>
                                        <option value={320}>320 kbps (Best)</option>
                                    </select>
                                </div>
                                <div className="setting-group">
                                    <label>Mode</label>
                                    <select
                                        value={exportSettings.mp3Mode}
                                        onChange={(e) => setExportSettings(prev => ({ ...prev, mp3Mode: e.target.value }))}
                                        disabled={isExporting}
                                    >
                                        <option value="CBR">CBR (Constant)</option>
                                        <option value="VBR">VBR (Variable)</option>
                                    </select>
                                </div>
                                {exportSettings.mp3Mode === 'VBR' && (
                                    <div className="setting-group">
                                        <label>VBR Quality (0-9)</label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="9"
                                            value={exportSettings.mp3Quality}
                                            onChange={(e) => setExportSettings(prev => ({ ...prev, mp3Quality: parseInt(e.target.value) }))}
                                            disabled={isExporting}
                                        />
                                        <small style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--zenith-text-secondary, #A1A8B5)' }}>
                                            Quality: {exportSettings.mp3Quality} (0=best, 9=smallest)
                                        </small>
                                    </div>
                                )}
                            </div>
                            <small style={{ display: 'block', marginTop: '8px', fontSize: '11px', color: 'var(--zenith-text-tertiary, #6B7280)' }}>
                                ⚠️ MP3 encoding requires encoder library. Currently exports as WAV.
                            </small>
                        </div>
                    )}
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

                {/* ✅ NEW: Time Range Selection */}
                <section className="export-section">
                    <TimeRangeSelector
                        startTime={exportSettings.startTime}
                        endTime={exportSettings.endTime}
                        onStartTimeChange={(beats) => setExportSettings(prev => ({ ...prev, startTime: beats }))}
                        onEndTimeChange={(beats) => setExportSettings(prev => ({ ...prev, endTime: beats }))}
                        loopRegion={exportSettings.useLoopRegion}
                        onLoopRegionChange={(useLoop) => setExportSettings(prev => ({ ...prev, useLoopRegion: useLoop }))}
                        disabled={isExporting}
                    />
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
                                <div style={{ marginBottom: '8px', fontWeight: 600 }}>❌ Export Failed</div>
                                <div style={{ marginBottom: '8px' }}>{exportProgress.error}</div>
                                <div style={{ fontSize: '11px', color: 'var(--zenith-text-tertiary, #6B7280)', marginBottom: '8px' }}>
                                    <strong>Possible solutions:</strong>
                                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                                        <li>Check available disk space</li>
                                        <li>Ensure format is supported</li>
                                        <li>Try a different quality setting</li>
                                        <li>Check browser console for details</li>
                                    </ul>
                                </div>
                                <button
                                    onClick={handleExport}
                                    className="link-button"
                                    style={{ marginTop: '8px', padding: '6px 12px', background: 'var(--zenith-accent-cool, #4ECDC4)', color: 'var(--zenith-text-inverse, #0A0E1A)', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                                >
                                    Retry Export
                                </button>
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
                                                    <div className="result-header">
                                                        <span className="channel-name">{file.channelName || file.channelId || file.arrangementName || 'Export'}</span>
                                                        {file.filename && (
                                                            <span className="filename" title={file.filename}>
                                                                <File size={12} />
                                                                {file.filename}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* ✅ NEW: File metadata */}
                                                    <div className="result-metadata">
                                                        {file.size && (
                                                            <span className="metadata-item" title="File size">
                                                                <HardDrive size={12} />
                                                                {formatFileSize(file.size)}
                                                            </span>
                                                        )}
                                                        {file.duration !== undefined && (
                                                            <span className="metadata-item" title="Duration">
                                                                <Clock size={12} />
                                                                {formatDuration(file.duration)}
                                                            </span>
                                                        )}
                                                        {file.format && (
                                                            <span className="metadata-item" title="Format">
                                                                {formatExportFormat(file.format)}
                                                            </span>
                                                        )}
                                                        {file.sampleRate && (
                                                            <span className="metadata-item" title="Sample rate">
                                                                {formatSampleRate(file.sampleRate)}
                                                            </span>
                                                        )}
                                                        {file.bitDepth && (
                                                            <span className="metadata-item" title="Bit depth">
                                                                {formatBitDepth(file.bitDepth)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Status indicators */}
                                                    <div className="result-status">
                                                        {file.assetId && (
                                                            <span className="asset-info">✅ Added to project</span>
                                                        )}
                                                        {file.clipId && (
                                                            <span className="clip-info">🎵 Added to arrangement</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="icon" />
                                                <div className="result-info">
                                                    <span className="channel-name">{result.channelId || 'Unknown'}</span>
                                                    <span className="error-text">{result.error}</span>
                                                </div>
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
                        disabled={
                            isExporting || 
                            (exportType === 'channels' && selectedChannels.size === 0) ||
                            (exportType === 'arrangement' && !selectedArrangementId)
                        }
                    >
                        <Download className="icon" />
                        {isExporting 
                            ? 'Exporting...' 
                            : exportType === 'channels'
                                ? `Export ${selectedChannels.size} Channel${selectedChannels.size !== 1 ? 's' : ''}`
                                : `Export Arrangement`
                        }
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

