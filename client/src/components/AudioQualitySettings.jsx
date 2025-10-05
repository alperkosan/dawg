import React, { useState, useEffect } from 'react';
import {
    Settings,
    Cpu,
    HardDrive,
    Volume,
    Zap,
    AlertTriangle,
    CheckCircle,
    Info,
    Monitor,
    Headphones
} from 'lucide-react';
import AudioQualityManager, { AUDIO_QUALITY_PRESETS } from '@/lib/config/AudioQualityConfig';

const AudioQualitySettings = ({ onSettingsChange, currentEngine = null }) => {
    const [qualityManager] = useState(() => new AudioQualityManager());
    const [isInitialized, setIsInitialized] = useState(false);
    const [capabilities, setCapabilities] = useState(null);
    const [currentPreset, setCurrentPreset] = useState('balanced');
    const [customSettings, setCustomSettings] = useState({});
    const [performanceImpact, setPerformanceImpact] = useState({});
    const [validation, setValidation] = useState({ valid: true, warnings: [], errors: [] });
    const [isAdvancedMode, setIsAdvancedMode] = useState(false);

    // Initialize quality manager
    useEffect(() => {
        const initialize = async () => {
            try {
                const result = await qualityManager.initialize();
                setCapabilities(result.capabilities);
                setCurrentPreset(result.recommendedPreset);
                setIsInitialized(true);

                // Calculate initial performance impact
                updatePerformanceImpact(result.settings);

                console.log('🎛️ Audio Quality Settings initialized:', result);
            } catch (error) {
                console.error('Failed to initialize audio quality settings:', error);
                setIsInitialized(true); // Still allow manual operation
            }
        };

        initialize();
    }, [qualityManager]);

    // Update performance impact when settings change
    const updatePerformanceImpact = (settings) => {
        const impact = qualityManager.calculatePerformanceImpact(settings);
        const validation = qualityManager.validateSettings(settings);

        setPerformanceImpact(impact);
        setValidation(validation);
    };

    // Handle preset change
    const handlePresetChange = (presetName) => {
        const settings = qualityManager.setPreset(presetName);
        setCurrentPreset(presetName);

        updatePerformanceImpact(settings);
        onSettingsChange?.(settings);
    };

    // Handle custom setting change
    const handleCustomSettingChange = (key, value) => {
        const settings = qualityManager.updateCustomSetting(key, value);
        setCurrentPreset('custom');
        setCustomSettings(prev => ({ ...prev, [key]: value }));

        updatePerformanceImpact(settings);
        onSettingsChange?.(settings);
    };

    // Get current settings
    const getCurrentSettings = () => qualityManager.getCurrentSettings();

    if (!isInitialized) {
        return (
            <div className="audio-quality-settings loading">
                <div className="loading-spinner">
                    <Cpu className="animate-spin" size={24} />
                    <p>Analyzing system capabilities...</p>
                </div>
            </div>
        );
    }

    const compatiblePresets = qualityManager.getCompatiblePresets();
    const settings = getCurrentSettings();

    return (
        <div className="audio-quality-settings">
            <div className="settings-header">
                <div className="header-title">
                    <Headphones size={20} />
                    <h2>Audio Quality Settings</h2>
                </div>
                <button
                    className={`advanced-toggle ${isAdvancedMode ? 'active' : ''}`}
                    onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                >
                    <Settings size={16} />
                    Advanced
                </button>
            </div>

            {/* System Info */}
            {capabilities && (
                <div className="system-info">
                    <h3><Monitor size={16} /> System Analysis</h3>
                    <div className="capability-grid">
                        <div className="capability-item">
                            <Cpu size={16} />
                            <span>CPU: {capabilities.cpu.cores} cores</span>
                            <div className={`score ${capabilities.cpu.performanceScore > 50 ? 'good' : 'average'}`}>
                                {Math.round(capabilities.cpu.performanceScore)}
                            </div>
                        </div>
                        <div className="capability-item">
                            <HardDrive size={16} />
                            <span>RAM: {capabilities.memory.deviceMemory}GB</span>
                            <div className={`score ${capabilities.memory.deviceMemory >= 8 ? 'good' : 'average'}`}>
                                {capabilities.memory.deviceMemory >= 8 ? 'Good' : 'Limited'}
                            </div>
                        </div>
                        <div className="capability-item">
                            <Volume size={16} />
                            <span>Audio System</span>
                            <div className={`score ${capabilities.audioSystem.audioWorkletSupported ? 'good' : 'average'}`}>
                                {capabilities.audioSystem.audioWorkletSupported ? 'Modern' : 'Legacy'}
                            </div>
                        </div>
                        <div className="capability-item">
                            <Zap size={16} />
                            <span>Overall Score</span>
                            <div className={`score ${capabilities.overallScore >= 80 ? 'good' : capabilities.overallScore >= 60 ? 'average' : 'poor'}`}>
                                {Math.round(capabilities.overallScore)}%
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Messages */}
            {(validation.warnings.length > 0 || validation.errors.length > 0) && (
                <div className="validation-messages">
                    {validation.errors.map((error, index) => (
                        <div key={index} className="validation-message error">
                            <AlertTriangle size={16} />
                            {error}
                        </div>
                    ))}
                    {validation.warnings.map((warning, index) => (
                        <div key={index} className="validation-message warning">
                            <Info size={16} />
                            {warning}
                        </div>
                    ))}
                </div>
            )}

            {/* Preset Selection */}
            <div className="preset-section">
                <h3>Quality Presets</h3>
                <div className="preset-grid">
                    {Object.entries(AUDIO_QUALITY_PRESETS).map(([key, preset]) => {
                        const isCompatible = compatiblePresets.includes(key);
                        const isSelected = currentPreset === key;

                        return (
                            <div
                                key={key}
                                className={`preset-card ${isSelected ? 'selected' : ''} ${!isCompatible ? 'incompatible' : ''}`}
                                onClick={() => isCompatible && handlePresetChange(key)}
                            >
                                <div className="preset-header">
                                    <h4>{preset.name}</h4>
                                    {isSelected && <CheckCircle size={16} className="selected-icon" />}
                                    {!isCompatible && <AlertTriangle size={16} className="warning-icon" />}
                                </div>
                                <p className="preset-description">{preset.description}</p>

                                {preset.settings && (
                                    <div className="preset-specs">
                                        <span>Sample Rate: {preset.settings.sampleRate / 1000}kHz</span>
                                        <span>Polyphony: {preset.settings.maxPolyphony}</span>
                                        <span>Buffer: {preset.settings.bufferSize}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Performance Impact */}
            <div className="performance-impact">
                <h3>Performance Impact</h3>
                <div className="impact-bars">
                    <div className="impact-bar">
                        <label>CPU Load</label>
                        <div className="bar-container">
                            <div
                                className={`impact-fill ${performanceImpact.cpu > 2 ? 'high' : performanceImpact.cpu > 1.5 ? 'medium' : 'low'}`}
                                style={{ width: `${Math.min(100, performanceImpact.cpu * 50)}%` }}
                            />
                        </div>
                        <span>{Math.round(performanceImpact.cpu * 100)}%</span>
                    </div>

                    <div className="impact-bar">
                        <label>Memory Usage</label>
                        <div className="bar-container">
                            <div
                                className={`impact-fill ${performanceImpact.memory > 2 ? 'high' : performanceImpact.memory > 1.5 ? 'medium' : 'low'}`}
                                style={{ width: `${Math.min(100, performanceImpact.memory * 50)}%` }}
                            />
                        </div>
                        <span>{Math.round(performanceImpact.memory * 100)}%</span>
                    </div>

                    <div className="impact-bar">
                        <label>Audio Quality</label>
                        <div className="bar-container">
                            <div
                                className="impact-fill quality"
                                style={{ width: `${Math.min(100, performanceImpact.quality * 100)}%` }}
                            />
                        </div>
                        <span>{Math.round(performanceImpact.quality * 100)}%</span>
                    </div>
                </div>
            </div>

            {/* Advanced Settings */}
            {isAdvancedMode && (
                <div className="advanced-settings">
                    <h3>Advanced Configuration</h3>

                    <div className="setting-group">
                        <label>Sample Rate</label>
                        <select
                            value={settings.sampleRate}
                            onChange={(e) => handleCustomSettingChange('sampleRate', parseInt(e.target.value))}
                        >
                            <option value={44100}>44.1 kHz (CD Quality)</option>
                            <option value={48000}>48 kHz (Professional)</option>
                            <option value={88200}>88.2 kHz (High Quality)</option>
                            <option value={96000}>96 kHz (Studio Quality)</option>
                            {capabilities?.audioSystem.maxSampleRate >= 192000 && (
                                <option value={192000}>192 kHz (Ultra Quality)</option>
                            )}
                        </select>
                        <small>Higher rates increase quality but use more CPU</small>
                    </div>

                    <div className="setting-group">
                        <label>Buffer Size</label>
                        <select
                            value={settings.bufferSize}
                            onChange={(e) => handleCustomSettingChange('bufferSize', parseInt(e.target.value))}
                        >
                            <option value={64}>64 samples (Ultra Low Latency)</option>
                            <option value={128}>128 samples (Very Low Latency)</option>
                            <option value={256}>256 samples (Low Latency)</option>
                            <option value={512}>512 samples (Balanced)</option>
                            <option value={1024}>1024 samples (Safe)</option>
                            <option value={2048}>2048 samples (Maximum Compatibility)</option>
                        </select>
                        <small>Lower values reduce latency but require more CPU power</small>
                    </div>

                    <div className="setting-group">
                        <label>Maximum Polyphony</label>
                        <input
                            type="range"
                            min={8}
                            max={128}
                            step={8}
                            value={settings.maxPolyphony}
                            onChange={(e) => handleCustomSettingChange('maxPolyphony', parseInt(e.target.value))}
                        />
                        <div className="range-labels">
                            <span>8</span>
                            <span>{settings.maxPolyphony} voices</span>
                            <span>128</span>
                        </div>
                        <small>Maximum simultaneous notes</small>
                    </div>

                    <div className="setting-group">
                        <label>Mixer Channels</label>
                        <input
                            type="range"
                            min={8}
                            max={64}
                            step={8}
                            value={settings.mixerChannels}
                            onChange={(e) => handleCustomSettingChange('mixerChannels', parseInt(e.target.value))}
                        />
                        <div className="range-labels">
                            <span>8</span>
                            <span>{settings.mixerChannels} channels</span>
                            <span>64</span>
                        </div>
                        <small>Number of mixer channels available</small>
                    </div>

                    <div className="setting-group checkbox-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.enableRealTimeEffects}
                                onChange={(e) => handleCustomSettingChange('enableRealTimeEffects', e.target.checked)}
                            />
                            <span>Enable Real-time Effects</span>
                        </label>
                        <small>Allow effects processing during playback</small>
                    </div>

                    <div className="setting-group checkbox-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.enableHighQualityResampling}
                                onChange={(e) => handleCustomSettingChange('enableHighQualityResampling', e.target.checked)}
                            />
                            <span>High Quality Resampling</span>
                        </label>
                        <small>Better quality at the cost of CPU usage</small>
                    </div>

                    <div className="setting-group checkbox-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.audioWorkletFallback}
                                onChange={(e) => handleCustomSettingChange('audioWorkletFallback', e.target.checked)}
                            />
                            <span>Enable Audio Worklet Fallback</span>
                        </label>
                        <small>Use alternative methods if Audio Worklets fail</small>
                    </div>
                </div>
            )}

            {/* Current Configuration Summary */}
            <div className="config-summary">
                <h3>Current Configuration</h3>
                <div className="summary-grid">
                    <div className="summary-item">
                        <strong>Sample Rate:</strong> {settings.sampleRate / 1000}kHz
                    </div>
                    <div className="summary-item">
                        <strong>Latency:</strong> ~{Math.round((settings.bufferSize / settings.sampleRate) * 1000)}ms
                    </div>
                    <div className="summary-item">
                        <strong>Polyphony:</strong> {settings.maxPolyphony} voices
                    </div>
                    <div className="summary-item">
                        <strong>Quality Score:</strong>
                        <span className={`score ${performanceImpact.quality >= 1 ? 'good' : 'average'}`}>
                            {Math.round(performanceImpact.quality * 100)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
                <button
                    className="btn-secondary"
                    onClick={() => {
                        const exported = qualityManager.exportSettings();
                        navigator.clipboard?.writeText(JSON.stringify(exported, null, 2));
                        alert('Settings copied to clipboard!');
                    }}
                >
                    Export Settings
                </button>

                <button
                    className="btn-primary"
                    onClick={() => {
                        if (currentEngine) {
                            // Apply settings to current engine
                            console.log('🎛️ Applying audio settings to engine:', settings);
                        }
                    }}
                    disabled={!validation.valid}
                >
                    Apply Settings
                </button>
            </div>
        </div>
    );
};

export default AudioQualitySettings;