/**
 * ZenithModSlot - Individual Modulation Slot
 * 
 * Features:
 * - Source/Destination selection
 * - Bipolar amount slider
 * - Curve type selector
 * - Remove button
 * - Visual feedback
 */

import React, { useCallback } from 'react';
import './ZenithModMatrix.css';

export const ZenithModSlot = ({ slotIndex, slot, sources, destinations, onChange, onRemove }) => {
    const handleChange = useCallback((field, value) => {
        onChange?.({ [field]: value });
    }, [onChange]);

    const getSourceInfo = (sourceValue) => {
        return sources.find(s => s.value === sourceValue) || { label: 'None', color: '#666', icon: '○' };
    };

    const getDestInfo = (destValue) => {
        return destinations.find(d => d.value === destValue) || { label: 'None' };
    };

    const sourceInfo = getSourceInfo(slot.source);
    const destInfo = getDestInfo(slot.destination);

    return (
        <div className="zenith-mod-slot zenith-mod-slot--active">
            <div className="zenith-mod-slot__header">
                <span className="zenith-mod-slot__number">{slotIndex + 1}</span>
                <button
                    className="zenith-mod-slot__remove"
                    onClick={onRemove}
                    title="Remove slot"
                >
                    ×
                </button>
            </div>

            {/* Source Selection */}
            <div className="zenith-mod-slot__field">
                <label className="zenith-mod-slot__label">Source</label>
                <select
                    className="zenith-mod-slot__select"
                    value={slot.source || ''}
                    onChange={(e) => handleChange('source', e.target.value)}
                    style={{ borderColor: sourceInfo.color }}
                >
                    <option value="">None</option>
                    <optgroup label="LFOs">
                        {sources.filter(s => s.value.startsWith('lfo')).map(s => (
                            <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Envelopes">
                        {sources.filter(s => s.value.startsWith('env')).map(s => (
                            <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                        ))}
                    </optgroup>
                    <optgroup label="MIDI">
                        {sources.filter(s => !s.value.startsWith('lfo') && !s.value.startsWith('env')).map(s => (
                            <option key={s.value} value={s.value}>{s.icon} {s.label}</option>
                        ))}
                    </optgroup>
                </select>
            </div>

            {/* Destination Selection */}
            <div className="zenith-mod-slot__field">
                <label className="zenith-mod-slot__label">Destination</label>
                <select
                    className="zenith-mod-slot__select"
                    value={slot.destination || ''}
                    onChange={(e) => handleChange('destination', e.target.value)}
                >
                    <option value="">None</option>
                    {['Filter', 'Oscillators', 'LFOs'].map(group => (
                        <optgroup key={group} label={group}>
                            {destinations.filter(d => d.group === group).map(d => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>

            {/* Amount Slider */}
            <div className="zenith-mod-slot__field">
                <label className="zenith-mod-slot__label">
                    Amount: {((slot.amount || 0) * 100).toFixed(0)}%
                </label>
                <input
                    type="range"
                    className="zenith-mod-slot__slider"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={slot.amount || 0}
                    onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                    style={{
                        background: `linear-gradient(90deg, 
                            #ef4444 0%, 
                            #666 50%, 
                            #10b981 100%)`
                    }}
                />
            </div>

            {/* Curve Selection */}
            <div className="zenith-mod-slot__field">
                <label className="zenith-mod-slot__label">Curve</label>
                <select
                    className="zenith-mod-slot__select zenith-mod-slot__select--small"
                    value={slot.curve || 'linear'}
                    onChange={(e) => handleChange('curve', e.target.value)}
                >
                    <option value="linear">Linear</option>
                    <option value="exponential">Exponential</option>
                    <option value="s-curve">S-Curve</option>
                </select>
            </div>

            {/* Visual Routing */}
            {slot.source && slot.destination && (
                <div className="zenith-mod-slot__routing">
                    <span className="zenith-mod-slot__routing-source" style={{ color: sourceInfo.color }}>
                        {sourceInfo.icon}
                    </span>
                    <span className="zenith-mod-slot__routing-arrow">→</span>
                    <span className="zenith-mod-slot__routing-dest">
                        {destInfo.label.split(' ')[0]}
                    </span>
                </div>
            )}
        </div>
    );
};
