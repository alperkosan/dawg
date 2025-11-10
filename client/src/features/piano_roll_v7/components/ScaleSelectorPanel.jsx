/**
 * Scale Selector Panel
 * Phase 5: Musical Intelligence - Scale Selection & Control
 *
 * FL Studio-style scale selector with:
 * - Root note selection
 * - Scale type selection
 * - Lock-to-scale toggle
 * - Scale highlighting toggle
 * - Quick preset buttons
 */

import React, { useState, useEffect } from 'react';
import { getScaleSystem, ScaleSystem, SCALES, NOTE_NAMES } from '@/lib/music/ScaleSystem';
import './ScaleSelectorPanel.css';

function ScaleSelectorPanel({ onChange }) {
    const scaleSystem = getScaleSystem();

    const [enabled, setEnabled] = useState(false);
    const [selectedRoot, setSelectedRoot] = useState(0); // 0 = C
    const [selectedScale, setSelectedScale] = useState('major');
    const [lockToScale, setLockToScale] = useState(false);

    // Apply changes to scale system
    useEffect(() => {
        if (enabled) {
            scaleSystem.setScale(selectedRoot, selectedScale);
            scaleSystem.setLockToScale(lockToScale);
        } else {
            scaleSystem.clearScale();
        }

        // Notify parent component
        if (onChange) {
            onChange({
                enabled,
                root: selectedRoot,
                scaleType: selectedScale,
                lockToScale,
                scaleSystem: enabled ? scaleSystem : null
            });
        }
    }, [enabled, selectedRoot, selectedScale, lockToScale, onChange]);

    const handleToggle = () => {
        setEnabled(!enabled);
    };

    const handleRootChange = (root) => {
        setSelectedRoot(root);
    };

    const handleScaleChange = (scaleKey) => {
        setSelectedScale(scaleKey);
    };

    const handleLockToggle = () => {
        setLockToScale(!lockToScale);
    };

    // Quick preset buttons for common scales
    const quickPresets = [
        { root: 0, scale: 'major', label: 'C Major' },
        { root: 9, scale: 'minor', label: 'A Minor' },
        { root: 2, scale: 'major', label: 'D Major' },
        { root: 7, scale: 'major', label: 'G Major' },
        { root: 4, scale: 'minor', label: 'E Minor' },
    ];

    const scaleInfo = enabled ? scaleSystem.getScaleInfo() : null;

    return (
        <div className={`scale-selector-panel ${!enabled ? 'disabled' : ''}`}>
            {/* Header */}
            <div className="panel-header">
                <div className="header-left">
                    <h3>Scale Highlighting</h3>
                    {scaleInfo && (
                        <span className="scale-name" style={{ color: scaleInfo.color }}>
                            {scaleInfo.name}
                        </span>
                    )}
                </div>
                <label className="toggle-switch">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={handleToggle}
                    />
                    <span className="toggle-slider"></span>
                </label>
            </div>

            {/* Content - only show when enabled */}
            {enabled && (
                <div className="scale-selector-panel-content">
                    {/* Scale Info */}
                    {scaleInfo && (
                        <div className="scale-info" style={{ borderLeftColor: scaleInfo.color }}>
                            <div className="info-text">
                                <strong>{scaleInfo.name}</strong>
                                <p>{scaleInfo.description}</p>
                            </div>
                        </div>
                    )}

                    {/* Quick Presets */}
                    <div className="section">
                        <h4>Quick Presets</h4>
                        <div className="presets-grid">
                            {quickPresets.map((preset, index) => (
                                <button
                                    key={index}
                                    className={`preset-button ${
                                        selectedRoot === preset.root && selectedScale === preset.scale
                                            ? 'active'
                                            : ''
                                    }`}
                                    onClick={() => {
                                        setSelectedRoot(preset.root);
                                        setSelectedScale(preset.scale);
                                    }}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Root Note Selection */}
                    <div className="section">
                        <h4>Root Note</h4>
                        <div className="note-grid">
                            {NOTE_NAMES.map((note, index) => (
                                <button
                                    key={index}
                                    className={`note-button ${selectedRoot === index ? 'active' : ''}`}
                                    onClick={() => handleRootChange(index)}
                                >
                                    {note}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scale Type Selection */}
                    <div className="section">
                        <h4>Scale Type</h4>
                        <div className="scale-list">
                            {Object.entries(SCALES).map(([key, scale]) => (
                                <button
                                    key={key}
                                    className={`scale-item ${selectedScale === key ? 'active' : ''}`}
                                    style={{
                                        borderLeftColor: scale.color
                                    }}
                                    onClick={() => handleScaleChange(key)}
                                >
                                    <div className="scale-item-content">
                                        <span className="scale-item-name">{scale.name}</span>
                                        <span className="scale-item-desc">{scale.description}</span>
                                    </div>
                                    <span className="scale-item-intervals">
                                        {scale.intervals.length} notes
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lock to Scale Toggle */}
                    <div className="section lock-section">
                        <div className="lock-header">
                            <h4>Lock to Scale</h4>
                            <label className="toggle-switch small">
                                <input
                                    type="checkbox"
                                    checked={lockToScale}
                                    onChange={handleLockToggle}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                        <p className="lock-description">
                            {lockToScale
                                ? 'New notes will be locked to scale notes only'
                                : 'All notes can be added freely'}
                        </p>
                    </div>
                </div>
            )}

            {/* Disabled state message */}
            {!enabled && (
                <div className="disabled-message">
                    <p>Enable scale highlighting to see scale notes on the keyboard</p>
                    <small>Toggle the switch above to get started</small>
                </div>
            )}
        </div>
    );
}

export default ScaleSelectorPanel;
