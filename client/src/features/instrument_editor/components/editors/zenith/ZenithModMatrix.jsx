/**
 * ZenithModMatrix - Modulation Matrix Component
 * 
 * Features:
 * - 16 modulation slots
 * - Source selection (4 LFOs, 2 Envelopes, MIDI)
 * - Destination selection (Oscillators, Filter, Envelopes)
 * - Bipolar amount control (-100% to +100%)
 * - Curve type selection
 * - Visual routing display
 */

import React, { useCallback } from 'react';
import { ZenithModSlot } from './ZenithModSlot';
import './ZenithModMatrix.css';

export const ZenithModMatrix = ({ slots = [], onChange }) => {
    const handleSlotChange = useCallback((slotIndex, updates) => {
        onChange?.(slotIndex, updates);
    }, [onChange]);

    const handleAddSlot = useCallback(() => {
        // Find first empty slot or add new one
        const emptySlotIndex = slots.findIndex(s => !s.enabled);
        if (emptySlotIndex !== -1) {
            onChange?.(emptySlotIndex, { enabled: true });
        } else if (slots.length < 16) {
            // Add new slot
            onChange?.(slots.length, { enabled: true });
        }
    }, [slots, onChange]);

    const handleRemoveSlot = useCallback((slotIndex) => {
        onChange?.(slotIndex, {
            enabled: false,
            source: null,
            destination: null,
            amount: 0,
            curve: 'linear'
        });
    }, [onChange]);

    // Available sources
    const sources = [
        { value: 'lfo_1', label: 'LFO 1', color: '#00d9ff', icon: '🌊' },
        { value: 'lfo_2', label: 'LFO 2', color: '#00d9ff', icon: '🌊' },
        { value: 'lfo_3', label: 'LFO 3', color: '#00d9ff', icon: '🌊' },
        { value: 'lfo_4', label: 'LFO 4', color: '#00d9ff', icon: '🌊' },
        { value: 'env_1', label: 'Filter Env', color: '#a855f7', icon: '📈' },
        { value: 'env_2', label: 'Amp Env', color: '#a855f7', icon: '📊' },
        { value: 'velocity', label: 'Velocity', color: '#ec4899', icon: '🎹' },
        { value: 'aftertouch', label: 'Aftertouch', color: '#ec4899', icon: '👆' },
        { value: 'mod_wheel', label: 'Mod Wheel', color: '#ec4899', icon: '🎚️' },
    ];

    // Available destinations
    const destinations = [
        { value: 'filter.cutoff', label: 'Filter Cutoff', group: 'Filter' },
        { value: 'filter.resonance', label: 'Filter Resonance', group: 'Filter' },
        { value: 'filter.drive', label: 'Filter Drive', group: 'Filter' },
        { value: 'osc.1.level', label: 'Osc 1 Level', group: 'Oscillators' },
        { value: 'osc.2.level', label: 'Osc 2 Level', group: 'Oscillators' },
        { value: 'osc.3.level', label: 'Osc 3 Level', group: 'Oscillators' },
        { value: 'osc.4.level', label: 'Osc 4 Level', group: 'Oscillators' },
        { value: 'osc.1.detune', label: 'Osc 1 Detune', group: 'Oscillators' },
        { value: 'osc.2.detune', label: 'Osc 2 Detune', group: 'Oscillators' },
        { value: 'osc.3.detune', label: 'Osc 3 Detune', group: 'Oscillators' },
        { value: 'osc.4.detune', label: 'Osc 4 Detune', group: 'Oscillators' },
        { value: 'osc.1.pwm', label: 'Osc 1 PWM', group: 'Oscillators' },
        { value: 'lfo.1.rate', label: 'LFO 1 Rate', group: 'LFOs' },
        { value: 'lfo.2.rate', label: 'LFO 2 Rate', group: 'LFOs' },
        { value: 'lfo.3.rate', label: 'LFO 3 Rate', group: 'LFOs' },
        { value: 'lfo.4.rate', label: 'LFO 4 Rate', group: 'LFOs' },
    ];

    // Only show enabled slots
    const activeSlots = slots.filter(s => s.enabled);
    const canAddMore = slots.length < 16;

    return (
        <div className="zenith-mod-matrix">
            <div className="zenith-mod-matrix__header">
                <span className="zenith-mod-matrix__icon">⚡</span>
                <span className="zenith-mod-matrix__title">Modulation Matrix</span>
                <span className="zenith-mod-matrix__subtitle">
                    {activeSlots.length} / 16 Slots
                </span>
            </div>

            <div className="zenith-mod-matrix__grid">
                {slots.map((slot, index) =>
                    slot.enabled && (
                        <ZenithModSlot
                            key={index}
                            slotIndex={index}
                            slot={slot}
                            sources={sources}
                            destinations={destinations}
                            onChange={(updates) => handleSlotChange(index, updates)}
                            onRemove={() => handleRemoveSlot(index)}
                        />
                    )
                )}

                {/* Add Slot Button */}
                {canAddMore && (
                    <button
                        className="zenith-mod-matrix__add-btn"
                        onClick={handleAddSlot}
                        title="Add modulation slot"
                    >
                        <span className="zenith-mod-matrix__add-icon">+</span>
                        <span className="zenith-mod-matrix__add-text">Add Slot</span>
                    </button>
                )}
            </div>
        </div>
    );
};
