import React, { useState, useEffect, useCallback } from 'react';
import {
    Settings,
    Cpu,
    HardDrive,
    Volume2,
    Zap,
    AlertTriangle,
    CheckCircle,
    Info,
    Monitor,
    Headphones,
    Play,
    Gauge,
    RefreshCw,
    Save,
    X
} from 'lucide-react';
import AudioQualityManager, { AUDIO_QUALITY_PRESETS } from '@/lib/config/AudioQualityConfig';
import { AudioContextService } from '@/lib/services/AudioContextService';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';

const AudioQualitySettings_v2 = ({ onClose, currentEngine = null }) => {
    const [qualityManager] = useState(() => new AudioQualityManager());
    const [isInitialized, setIsInitialized] = useState(false);
    const [capabilities, setCapabilities] = useState(null);
    const [currentPreset, setCurrentPreset] = useState('balanced');
    const [customSettings, setCustomSettings] = useState({});
    const [performanceImpact, setPerformanceImpact] = useState({});
    const [validation, setValidation] = useState({ valid: true, warnings: [], errors: [] });
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [appliedSettings, setAppliedSettings] = useState(null);
    const [testAudioPlaying, setTestAudioPlaying] = useState(false);

    // ✅ FIX: Get audio engine with multiple fallbacks
    // Priority: 1. prop, 2. AudioEngineGlobal, 3. window.audioEngine
    const audioEngine = currentEngine || AudioEngineGlobal.get() || (typeof window !== 'undefined' ? window.audioEngine : null);

    // Initialize quality manager
    useEffect(() => {
        const initialize = async () => {
            try {
                const result = await qualityManager.initialize();
                setCapabilities(result.capabilities);
                setCurrentPreset(result.recommendedPreset);
                setIsInitialized(true);

                // Get current engine settings if available
                if (audioEngine?.settings) {
                    setAppliedSettings(audioEngine.settings);
                }

                // Calculate initial performance impact
                updatePerformanceImpact(result.settings);

                console.log('🎛️ Audio Quality Settings V2 initialized:', result);
            } catch (error) {
                console.error('Failed to initialize audio quality settings:', error);
                setIsInitialized(true); // Still allow manual operation
            }
        };

        initialize();
    }, [qualityManager, audioEngine]);

    // Update performance impact when settings change
    const updatePerformanceImpact = (settings) => {
        const impact = qualityManager.calculatePerformanceImpact(settings);
        const validation = qualityManager.validateSettings(settings);

        setPerformanceImpact(impact);
        setValidation(validation);
    };

    // Calculate real latency
    const calculateLatency = (bufferSize, sampleRate) => {
        return ((bufferSize / sampleRate) * 1000).toFixed(2);
    };

    // Handle preset change
    const handlePresetChange = (presetName) => {
        const settings = qualityManager.setPreset(presetName);
        setCurrentPreset(presetName);

        updatePerformanceImpact(settings);
    };

    // Handle custom setting change
    const handleCustomSettingChange = (key, value) => {
        const settings = qualityManager.updateCustomSetting(key, value);
        setCurrentPreset('custom');
        setCustomSettings(prev => ({ ...prev, [key]: value }));

        updatePerformanceImpact(settings);
    };

    // Apply settings to audio engine
    const applySettings = useCallback(async () => {
        const settings = qualityManager.getCurrentSettings();

        if (!validation.valid) {
            const { apiClient } = await import('@/services/api.js');
            apiClient.showToast('Cannot apply settings: There are validation errors', 'error', 5000);
            return;
        }

        setIsApplying(true);

        try {
            console.log('🎛️ Applying audio settings:', settings);

            // ✅ NEW: Apply settings to actual audio engine
            if (audioEngine && typeof audioEngine.applyQualitySettings === 'function') {
                const result = audioEngine.applyQualitySettings(settings);

                if (!result.success) {
                    throw new Error(result.error || 'Failed to apply settings');
                }

                console.log('✅ Audio engine settings applied successfully');
            } else {
                console.warn('⚠️ Audio engine not available or missing applyQualitySettings method');
                // Still allow updating local state for UI purposes
            }

            // Update applied settings state
            setAppliedSettings(settings);

            const { apiClient } = await import('@/services/api.js');
            apiClient.showToast('Audio settings applied successfully!', 'success', 3000);

        } catch (error) {
            console.error('Failed to apply audio settings:', error);
            const { apiClient } = await import('@/services/api.js');
            apiClient.showToast(`Failed to apply settings: ${error.message}`, 'error', 5000);
        } finally {
            setIsApplying(false);
        }
    }, [qualityManager, validation, audioEngine]);

    // Test audio with current settings
    const playTestAudio = useCallback(async () => {
        if (!audioEngine) {
            const { apiClient } = await import('@/services/api.js');
            apiClient.showToast('Audio engine not available', 'error', 3000);
            return;
        }

        setTestAudioPlaying(true);

        try {
            // Create a simple test tone
            const audioContext = audioEngine.audioContext;

            // ✅ Check if AudioContext is closed or suspended
            if (audioContext.state === 'closed') {
                const { apiClient } = await import('@/services/api.js');
                apiClient.showToast('Audio engine is closed. Please restart the application.', 'error', 5000);
                setTestAudioPlaying(false);
                return;
            }

            // ✅ Resume AudioContext if suspended
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note

            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 1);

            setTimeout(() => setTestAudioPlaying(false), 1000);
        } catch (error) {
            console.error('Test audio failed:', error);
            const { apiClient } = await import('@/services/api.js');
            apiClient.showToast(`Test audio failed: ${error.message}`, 'error', 5000);
            setTestAudioPlaying(false);
        }
    }, [audioEngine]);

    // Get current settings
    const getCurrentSettings = () => qualityManager.getCurrentSettings();

    if (!isInitialized) {
        return (
            <div className="audio-quality-settings-v2 loading">
                <div className="loading-spinner">
                    <Cpu className="animate-spin" size={24} />
                    <p>Analyzing system capabilities...</p>
                </div>
            </div>
        );
    }

    const compatiblePresets = qualityManager.getCompatiblePresets();
    const settings = getCurrentSettings();
    const latency = calculateLatency(settings.bufferSize, settings.sampleRate);

    return (
        <div className="audio-quality-settings-v2">
            <div className="settings-content">
                {/* Quick Stats */}
                <div className="quick-stats">
                    <div className="stat-card">
                        <Gauge size={20} />
                        <div className="stat-content">
                            <span className="stat-label">Latency</span>
                            <span className="stat-value">{latency}ms</span>
                        </div>
                        <div className={`stat-indicator ${latency < 10 ? 'good' : latency < 20 ? 'average' : 'poor'}`} />
                    </div>

                    <div className="stat-card">
                        <Volume2 size={20} />
                        <div className="stat-content">
                            <span className="stat-label">Sample Rate</span>
                            <span className="stat-value">{settings.sampleRate / 1000}kHz</span>
                        </div>
                        <div className={`stat-indicator ${settings.sampleRate >= 48000 ? 'good' : 'average'}`} />
                    </div>

                    <div className="stat-card">
                        <Zap size={20} />
                        <div className="stat-content">
                            <span className="stat-label">Polyphony</span>
                            <span className="stat-value">{settings.maxPolyphony}</span>
                        </div>
                        <div className={`stat-indicator ${settings.maxPolyphony >= 32 ? 'good' : 'average'}`} />
                    </div>

                    <div className="stat-card">
                        <Cpu size={20} />
                        <div className="stat-content">
                            <span className="stat-label">CPU Impact</span>
                            <span className="stat-value">{Math.round(performanceImpact.cpu * 100)}%</span>
                        </div>
                        <div className={`stat-indicator ${performanceImpact.cpu < 1.5 ? 'good' : performanceImpact.cpu < 2 ? 'average' : 'poor'}`} />
                    </div>
                </div>

                {/* System Info */}
                {capabilities && (
                    <div className="system-info-card">
                        <h3><Monitor size={18} /> System Analysis</h3>
                        <div className="capability-grid-v2">
                            <div className="capability-item-v2">
                                <div className="capability-header">
                                    <Cpu size={16} />
                                    <span>CPU</span>
                                </div>
                                <div className="capability-value">
                                    {capabilities.cpu.cores} cores
                                </div>
                                <div className="capability-score">
                                    <div
                                        className="score-bar"
                                        style={{ width: `${Math.min(100, capabilities.cpu.performanceScore)}%` }}
                                    />
                                </div>
                            </div>

                            <div className="capability-item-v2">
                                <div className="capability-header">
                                    <HardDrive size={16} />
                                    <span>RAM</span>
                                </div>
                                <div className="capability-value">
                                    {capabilities.memory.deviceMemory}GB
                                </div>
                                <div className="capability-score">
                                    <div
                                        className="score-bar"
                                        style={{ width: `${Math.min(100, (capabilities.memory.deviceMemory / 16) * 100)}%` }}
                                    />
                                </div>
                            </div>

                            <div className="capability-item-v2">
                                <div className="capability-header">
                                    <Zap size={16} />
                                    <span>Overall Score</span>
                                </div>
                                <div className="capability-value">
                                    {Math.round(capabilities.overallScore)}%
                                </div>
                                <div className="capability-score">
                                    <div
                                        className="score-bar quality"
                                        style={{ width: `${capabilities.overallScore}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Validation Messages */}
                {(validation.warnings.length > 0 || validation.errors.length > 0) && (
                    <div className="validation-messages-v2">
                        {validation.errors.map((error, index) => (
                            <div key={`error-${index}`} className="validation-message error">
                                <AlertTriangle size={16} />
                                <span>{error}</span>
                            </div>
                        ))}
                        {validation.warnings.map((warning, index) => (
                            <div key={`warning-${index}`} className="validation-message warning">
                                <Info size={16} />
                                <span>{warning}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Preset Selection */}
                <div className="preset-section-v2">
                    <div className="section-header">
                        <h3>Quality Presets</h3>
                        <span className="preset-hint">Choose a preset or customize below</span>
                    </div>

                    <div className="preset-grid-v2">
                        {Object.entries(AUDIO_QUALITY_PRESETS).map(([key, preset]) => {
                            if (key === 'custom') return null;

                            const isCompatible = compatiblePresets.includes(key);
                            const isSelected = currentPreset === key;
                            const isApplied = appliedSettings &&
                                JSON.stringify(preset.settings) === JSON.stringify(appliedSettings);

                            return (
                                <button
                                    key={key}
                                    className={`preset-card-v2 ${isSelected ? 'selected' : ''} ${!isCompatible ? 'incompatible' : ''} ${isApplied ? 'applied' : ''}`}
                                    onClick={() => isCompatible && handlePresetChange(key)}
                                    disabled={!isCompatible}
                                >
                                    <div className="preset-header-v2">
                                        <h4>{preset.name}</h4>
                                        {isApplied && <CheckCircle size={14} className="applied-icon" />}
                                        {isSelected && !isApplied && <div className="selected-dot" />}
                                        {!isCompatible && <AlertTriangle size={14} className="warning-icon" />}
                                    </div>
                                    <p className="preset-description-v2">{preset.description}</p>

                                    {preset.settings && (
                                        <div className="preset-specs-v2">
                                            <span>{preset.settings.sampleRate / 1000}kHz</span>
                                            <span>·</span>
                                            <span>{calculateLatency(preset.settings.bufferSize, preset.settings.sampleRate)}ms</span>
                                            <span>·</span>
                                            <span>{preset.settings.maxPolyphony} voices</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Advanced Settings Toggle */}
                <div className="advanced-toggle-section">
                    <button
                        className={`advanced-toggle-btn ${isAdvancedMode ? 'active' : ''}`}
                        onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                    >
                        <Settings size={16} />
                        <span>{isAdvancedMode ? 'Hide' : 'Show'} Advanced Settings</span>
                    </button>
                </div>

                {/* Advanced Settings */}
                {isAdvancedMode && (
                    <div className="advanced-settings-v2">
                        <div className="settings-grid">
                            {/* Sample Rate */}
                            <div className="setting-group-v2">
                                <label>
                                    <Volume2 size={16} />
                                    <span>Sample Rate</span>
                                </label>
                                <select
                                    value={settings.sampleRate}
                                    onChange={(e) => handleCustomSettingChange('sampleRate', parseInt(e.target.value))}
                                    className="setting-select"
                                >
                                    <option value={44100}>44.1 kHz (CD Quality)</option>
                                    <option value={48000}>48 kHz (Professional)</option>
                                    <option value={88200}>88.2 kHz (High Quality)</option>
                                    <option value={96000}>96 kHz (Studio Quality)</option>
                                    {capabilities?.audioSystem.maxSampleRate >= 192000 && (
                                        <option value={192000}>192 kHz (Ultra Quality)</option>
                                    )}
                                </select>
                                <small>Higher rates = better quality, more CPU</small>
                            </div>

                            {/* Buffer Size */}
                            <div className="setting-group-v2">
                                <label>
                                    <Gauge size={16} />
                                    <span>Buffer Size</span>
                                </label>
                                <select
                                    value={settings.bufferSize}
                                    onChange={(e) => handleCustomSettingChange('bufferSize', parseInt(e.target.value))}
                                    className="setting-select"
                                >
                                    <option value={64}>64 samples (~1.3ms @ 48kHz)</option>
                                    <option value={128}>128 samples (~2.7ms @ 48kHz)</option>
                                    <option value={256}>256 samples (~5.3ms @ 48kHz)</option>
                                    <option value={512}>512 samples (~10.7ms @ 48kHz)</option>
                                    <option value={1024}>1024 samples (~21.3ms @ 48kHz)</option>
                                    <option value={2048}>2048 samples (~42.7ms @ 48kHz)</option>
                                </select>
                                <small>Lower buffer = less latency, more CPU</small>
                            </div>

                            {/* Max Polyphony */}
                            <div className="setting-group-v2 slider-group">
                                <label>
                                    <Zap size={16} />
                                    <span>Maximum Polyphony</span>
                                </label>
                                <div className="slider-container">
                                    <input
                                        type="range"
                                        min={8}
                                        max={128}
                                        step={8}
                                        value={settings.maxPolyphony}
                                        onChange={(e) => handleCustomSettingChange('maxPolyphony', parseInt(e.target.value))}
                                        className="setting-slider"
                                    />
                                    <span className="slider-value">{settings.maxPolyphony} voices</span>
                                </div>
                                <small>Maximum simultaneous notes</small>
                            </div>

                            {/* Mixer Channels */}
                            <div className="setting-group-v2 slider-group">
                                <label>
                                    <Volume2 size={16} />
                                    <span>Mixer Channels</span>
                                </label>
                                <div className="slider-container">
                                    <input
                                        type="range"
                                        min={8}
                                        max={64}
                                        step={8}
                                        value={settings.mixerChannels}
                                        onChange={(e) => handleCustomSettingChange('mixerChannels', parseInt(e.target.value))}
                                        className="setting-slider"
                                    />
                                    <span className="slider-value">{settings.mixerChannels} channels</span>
                                </div>
                                <small>Available mixer channels</small>
                            </div>

                            {/* ✅ NEW: PPQ (Pulses Per Quarter Note) */}
                            <div className="setting-group-v2">
                                <label>
                                    <Gauge size={16} />
                                    <span>MIDI Resolution (PPQ)</span>
                                </label>
                                <select
                                    value={settings.ppq || 480}
                                    onChange={(e) => handleCustomSettingChange('ppq', parseInt(e.target.value))}
                                    className="setting-select"
                                >
                                    <option value={96}>96 PPQ (FL Studio Default)</option>
                                    <option value={192}>192 PPQ (Standard)</option>
                                    <option value={480}>480 PPQ (Professional)</option>
                                    <option value={960}>960 PPQ (Ableton/Logic Pro)</option>
                                </select>
                                <small>Higher = more timing precision, more CPU</small>
                            </div>

                            {/* ✅ NEW: Lookahead Time */}
                            <div className="setting-group-v2">
                                <label>
                                    <Headphones size={16} />
                                    <span>Lookahead Time</span>
                                </label>
                                <select
                                    value={settings.lookaheadTime || 0.12}
                                    onChange={(e) => handleCustomSettingChange('lookaheadTime', parseFloat(e.target.value))}
                                    className="setting-select"
                                >
                                    <option value={0.05}>50ms (Ultra Low Latency)</option>
                                    <option value={0.08}>80ms (Low Latency)</option>
                                    <option value={0.1}>100ms (Balanced)</option>
                                    <option value={0.12}>120ms (Stable)</option>
                                    <option value={0.15}>150ms (Very Stable)</option>
                                    <option value={0.2}>200ms (Maximum Stability)</option>
                                </select>
                                <small>Audio scheduling lookahead window</small>
                            </div>

                            {/* ✅ NEW: Schedule Ahead Time */}
                            <div className="setting-group-v2">
                                <label>
                                    <Zap size={16} />
                                    <span>Schedule Ahead Time</span>
                                </label>
                                <select
                                    value={settings.scheduleAheadTime || 0.15}
                                    onChange={(e) => handleCustomSettingChange('scheduleAheadTime', parseFloat(e.target.value))}
                                    className="setting-select"
                                >
                                    <option value={0.08}>80ms (Ultra Low Latency)</option>
                                    <option value={0.1}>100ms (Low Latency)</option>
                                    <option value={0.12}>120ms (Balanced)</option>
                                    <option value={0.15}>150ms (Stable)</option>
                                    <option value={0.2}>200ms (Very Stable)</option>
                                    <option value={0.3}>300ms (Maximum Stability)</option>
                                </select>
                                <small>How far ahead to schedule audio events</small>
                            </div>
                        </div>

                        {/* Checkboxes */}
                        <div className="checkbox-grid">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings.enableRealTimeEffects}
                                    onChange={(e) => handleCustomSettingChange('enableRealTimeEffects', e.target.checked)}
                                />
                                <span>Real-time Effects</span>
                            </label>

                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings.enableHighQualityResampling}
                                    onChange={(e) => handleCustomSettingChange('enableHighQualityResampling', e.target.checked)}
                                />
                                <span>High Quality Resampling</span>
                            </label>

                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={settings.audioWorkletFallback}
                                    onChange={(e) => handleCustomSettingChange('audioWorkletFallback', e.target.checked)}
                                />
                                <span>Audio Worklet Fallback</span>
                            </label>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="action-buttons-v2">
                    <button
                        className="btn-secondary-v2"
                        onClick={playTestAudio}
                        disabled={testAudioPlaying}
                    >
                        <Play size={16} />
                        {testAudioPlaying ? 'Playing...' : 'Test Audio'}
                    </button>

                    <button
                        className="btn-secondary-v2"
                        onClick={async () => {
                            const exported = qualityManager.exportSettings();
                            navigator.clipboard?.writeText(JSON.stringify(exported, null, 2));
                            const { apiClient } = await import('@/services/api.js');
                            apiClient.showToast('Settings copied to clipboard!', 'success', 3000);
                        }}
                    >
                        <Save size={16} />
                        Export Settings
                    </button>

                    <button
                        className="btn-primary-v2"
                        onClick={applySettings}
                        disabled={!validation.valid || isApplying}
                    >
                        {isApplying ? <RefreshCw size={16} className="spinning" /> : <CheckCircle size={16} />}
                        {isApplying ? 'Applying...' : 'Apply Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AudioQualitySettings_v2;
