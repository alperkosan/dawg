/**
 * Global Color Picker for Mixer Channels
 * Renders as a portal to avoid duplicating DOM in each channel
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ColorPicker.css';

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b'
];

export function ColorPicker({
    isOpen,
    position,
    currentColor,
    onColorSelect,
    onClose
}) {
    const pickerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                onClose();
            }
        };

        // Use setTimeout to avoid immediate close on the same click that opened it
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={pickerRef}
            className="mixer-color-picker"
            style={{
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                zIndex: 10000
            }}
        >
            <div className="mixer-color-picker__grid">
                {PRESET_COLORS.map(color => (
                    <button
                        key={color}
                        className={`mixer-color-picker__swatch ${currentColor === color ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => onColorSelect(color)}
                        title={color}
                    />
                ))}
            </div>
        </div>,
        document.body
    );
}
