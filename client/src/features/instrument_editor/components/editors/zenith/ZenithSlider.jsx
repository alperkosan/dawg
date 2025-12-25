/**
 * ZenithSlider - Premium Slider Control
 * 
 * Features:
 * - Horizontal slider with gradient fill
 * - Glassmorphic design
 * - Glow effects
 * - Bipolar mode support
 */

import React, { useRef, useState, useCallback } from 'react';
import './ZenithSlider.css';

export const ZenithSlider = ({
    label,
    value = 0,
    min = 0,
    max = 100,
    onChange,
    onChangeEnd,
    color = '#6B8EBF',
    valueFormatter,
    logarithmic = false,
    bipolar = false,
    disabled = false,
    step,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const sliderRef = useRef(null);
    const rafRef = useRef(null);

    // Format display value
    const formatValue = useCallback((val) => {
        if (valueFormatter) return valueFormatter(val);
        return val.toFixed(2);
    }, [valueFormatter]);

    // Calculate position percentage
    const getPositionPercent = useCallback((val) => {
        let normalizedValue;

        if (logarithmic && min > 0) {
            normalizedValue = Math.log(val / min) / Math.log(max / min);
        } else {
            normalizedValue = (val - min) / (max - min);
        }

        return Math.max(0, Math.min(1, normalizedValue)) * 100;
    }, [min, max, logarithmic]);

    // Mouse handlers
    const handleMouseMove = useCallback((e) => {
        if (disabled || !sliderRef.current) return;

        if (rafRef.current !== null) return;

        rafRef.current = requestAnimationFrame(() => {
            const rect = sliderRef.current.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

            let newValue;
            if (logarithmic && min > 0) {
                newValue = min * Math.pow(max / min, percent);
            } else {
                newValue = min + (max - min) * percent;
            }

            let clampedValue = Math.max(min, Math.min(max, newValue));

            if (step && step > 0) {
                clampedValue = Math.round(clampedValue / step) * step;
                clampedValue = Math.max(min, Math.min(max, clampedValue));
            }

            onChange?.(clampedValue);
            rafRef.current = null;
        });
    }, [min, max, logarithmic, step, disabled, onChange]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        document.body.style.cursor = 'default';

        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        onChangeEnd?.();

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove, onChangeEnd]);

    const handleMouseDown = useCallback((e) => {
        if (disabled) return;

        e.preventDefault();
        setIsDragging(true);
        document.body.style.cursor = 'ew-resize';

        handleMouseMove(e);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [disabled, handleMouseMove, handleMouseUp]);

    const positionPercent = getPositionPercent(value);
    const zeroPercent = bipolar ? getPositionPercent(0) : 0;

    return (
        <div className="zenith-slider">
            <div className="zenith-slider__header">
                {label && <div className="zenith-slider__label">{label}</div>}
                <div className="zenith-slider__value">{formatValue(value)}</div>
            </div>

            <div
                ref={sliderRef}
                className={`zenith-slider__track ${disabled ? 'zenith-slider__track--disabled' : ''}`}
                onMouseDown={handleMouseDown}
            >
                {/* Background track */}
                <div className="zenith-slider__track-bg" />

                {/* Fill */}
                <div
                    className="zenith-slider__fill"
                    style={{
                        left: bipolar ? `${Math.min(zeroPercent, positionPercent)}%` : '0%',
                        width: bipolar
                            ? `${Math.abs(positionPercent - zeroPercent)}%`
                            : `${positionPercent}%`,
                        background: `linear-gradient(90deg, ${color}, #a855f7)`,
                        boxShadow: `0 0 12px ${color}80`,
                    }}
                />

                {/* Zero marker for bipolar */}
                {bipolar && (
                    <div
                        className="zenith-slider__zero"
                        style={{ left: `${zeroPercent}%` }}
                    />
                )}

                {/* Thumb */}
                <div
                    className="zenith-slider__thumb"
                    style={{
                        left: `${positionPercent}%`,
                        boxShadow: `0 0 16px ${color}`,
                        borderColor: color,
                    }}
                />
            </div>
        </div>
    );
};
