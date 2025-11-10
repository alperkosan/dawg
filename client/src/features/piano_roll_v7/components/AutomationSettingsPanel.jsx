/**
 * AutomationSettingsPanel - Automation Lane Management UI
 *
 * Features:
 * - Browse and add lane presets
 * - Template quick-add (by category)
 * - MIDI learn integration
 * - Active lanes management
 * - Lane visibility toggles
 */

import React, { useState, useEffect } from 'react';
import { getAutomationManager, LANE_PRESETS, LANE_CATEGORIES } from '@/lib/automation/AutomationManager';
import './AutomationSettingsPanel.css';

export const AutomationSettingsPanel = ({ patternId, instrumentId }) => {
    const [automationManager] = useState(() => getAutomationManager());
    const [activeLanes, setActiveLanes] = useState([]);
    const [availablePresets, setAvailablePresets] = useState([]);
    const [isLearning, setIsLearning] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Subscribe to automation manager events
    useEffect(() => {
        const unsubscribe = automationManager.subscribe((event) => {
            // Refresh lanes on any change
            refreshLanes();

            // Update learning state
            if (event.type === 'learnStarted') {
                setIsLearning(true);
            } else if (event.type === 'learnStopped') {
                setIsLearning(false);
            }
        });

        return unsubscribe;
    }, [automationManager]);

    // Load lanes when pattern/instrument changes
    useEffect(() => {
        if (patternId && instrumentId) {
            refreshLanes();
        }
    }, [patternId, instrumentId]);

    const refreshLanes = () => {
        if (!patternId || !instrumentId) return;

        const lanes = automationManager.getLanes(patternId, instrumentId);
        setActiveLanes(lanes);

        const presets = automationManager.getAvailablePresets(patternId, instrumentId);
        setAvailablePresets(presets);
    };

    const handleAddPreset = (presetKey) => {
        automationManager.addLaneFromPreset(patternId, instrumentId, presetKey);
    };

    const handleRemoveLane = (ccNumber) => {
        automationManager.removeLane(patternId, instrumentId, ccNumber);
    };

    const handleToggleVisibility = (ccNumber) => {
        automationManager.toggleLaneVisibility(patternId, instrumentId, ccNumber);
        refreshLanes();
    };

    const handleApplyTemplate = (categoryKey) => {
        automationManager.applyTemplate(patternId, instrumentId, categoryKey);
    };

    const handleStartMIDILearn = () => {
        automationManager.startMIDILearn(patternId, instrumentId);
    };

    const handleStopMIDILearn = () => {
        automationManager.stopMIDILearn();
    };

    if (!patternId || !instrumentId) {
        return (
            <div className="automation-settings-panel empty">
                <p>Select a pattern and instrument to manage automation lanes</p>
            </div>
        );
    }

    return (
        <div className="automation-settings-panel">
            {/* Active Lanes Section */}
            <div className="section active-lanes-section">
                <div className="section-header">
                    <h4>Active Lanes ({activeLanes.length})</h4>
                    {activeLanes.length > 0 && (
                        <button
                            className="clear-all-button"
                            onClick={() => automationManager.clearLanes(patternId, instrumentId)}
                            title="Clear all lanes"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {activeLanes.length === 0 ? (
                    <div className="empty-state">
                        <p>No automation lanes active</p>
                        <small>Add lanes from presets below</small>
                    </div>
                ) : (
                    <div className="lanes-list">
                        {activeLanes.map(lane => {
                            const preset = automationManager.getPresetByCC(lane.ccNumber);
                            const color = preset?.color || '#6b7280';

                            return (
                                <div key={lane.id} className="lane-item">
                                    <div
                                        className="lane-color"
                                        style={{ backgroundColor: color }}
                                    />
                                    <div className="lane-info">
                                        <span className="lane-name">{lane.name}</span>
                                        <span className="lane-cc">
                                            {typeof lane.ccNumber === 'number' ? `CC${lane.ccNumber}` : lane.ccNumber}
                                        </span>
                                    </div>
                                    <div className="lane-actions">
                                        <button
                                            className={`visibility-button ${lane.visible ? 'visible' : 'hidden'}`}
                                            onClick={() => handleToggleVisibility(lane.ccNumber)}
                                            title={lane.visible ? 'Hide lane' : 'Show lane'}
                                        >
                                            {lane.visible ? '👁' : '👁‍🗨'}
                                        </button>
                                        <button
                                            className="remove-button"
                                            onClick={() => handleRemoveLane(lane.ccNumber)}
                                            title="Remove lane"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Templates Section */}
            <div className="section templates-section">
                <div className="section-header">
                    <h4>Lane Templates</h4>
                </div>

                <div className="templates-grid">
                    {Object.keys(LANE_CATEGORIES).map(categoryKey => {
                        const template = automationManager.getTemplate(categoryKey);
                        const laneCount = template.length;

                        return (
                            <button
                                key={categoryKey}
                                className="template-button"
                                onClick={() => handleApplyTemplate(categoryKey)}
                                title={`Add ${laneCount} ${categoryKey.toLowerCase()} lanes`}
                            >
                                <span className="template-name">
                                    {categoryKey.replace('_', ' ')}
                                </span>
                                <span className="template-count">{laneCount} lanes</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Available Presets Section */}
            <div className="section presets-section">
                <div className="section-header">
                    <h4>Available Presets ({availablePresets.length})</h4>
                    {availablePresets.length > 0 && (
                        <button
                            className={`midi-learn-button ${isLearning ? 'learning' : ''}`}
                            onClick={isLearning ? handleStopMIDILearn : handleStartMIDILearn}
                            title={isLearning ? 'Stop MIDI Learn' : 'Start MIDI Learn'}
                        >
                            {isLearning ? '⏹ Stop Learn' : '🎹 MIDI Learn'}
                        </button>
                    )}
                </div>

                {isLearning && (
                    <div className="midi-learn-indicator">
                        <span className="pulse">●</span>
                        Move a MIDI controller to add its lane...
                    </div>
                )}

                {availablePresets.length === 0 ? (
                    <div className="empty-state">
                        <p>All presets added</p>
                        <small>Remove lanes to add different ones</small>
                    </div>
                ) : (
                    <div className="presets-list">
                        {availablePresets.map(preset => (
                            <button
                                key={preset.key}
                                className="preset-button"
                                onClick={() => handleAddPreset(preset.key)}
                                style={{ borderLeftColor: preset.color }}
                            >
                                <div className="preset-info">
                                    <span className="preset-name">{preset.name}</span>
                                    <span className="preset-cc">
                                        {typeof preset.ccNumber === 'number' ? `CC${preset.ccNumber}` : preset.ccNumber}
                                    </span>
                                </div>
                                <span className="add-icon">+</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AutomationSettingsPanel;
