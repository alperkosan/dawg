/**
 * ZenithKnob - Premium Canvas-based Knob Control
 * 
 * Features:
 * - Canvas rendering with glow effects
 * - Glassmorphic design
 * - Smooth animations
 * - Vertical drag interaction
 * - Shift for fine control
 * - Double-click to reset
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import './ZenithKnob.css';

export const ZenithKnob = ({
    label,
    value = 0,
    min = 0,
    max = 100,
    defaultValue = 50,
    onChange,
    onChangeEnd,
    color = '#00d9ff',
    size = 70,
    step,
    valueFormatter,
    logarithmic = false,
    disabled = false,
    showValue = true,
}) => {
    const canvasRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ y: 0, value: 0 });
    const rafRef = useRef(null);

    // Value to angle conversion (-135° to +135°)
    const valueToAngle = useCallback((val) => {
        const valueInRange = Math.max(min, Math.min(max, val));
        let normalizedValue;

        if (logarithmic && min > 0) {
            normalizedValue = Math.log(valueInRange / min) / Math.log(max / min);
        } else {
            normalizedValue = (valueInRange - min) / (max - min);
        }

        return -135 + normalizedValue * 270;
    }, [min, max, logarithmic]);

    // Format display value
    const formatValue = useCallback((val) => {
        if (valueFormatter) return valueFormatter(val);
        return val.toFixed(2);
    }, [valueFormatter]);

    // Draw knob on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Set canvas size for retina displays
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        ctx.scale(dpr, dpr);

        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2 - 8;
        const angle = valueToAngle(value);

        // Clear canvas
        ctx.clearRect(0, 0, size, size);

        // Draw outer glow
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = `${color}80`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}20`;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();

        // Draw track (background)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius,
            (-135 * Math.PI) / 180,
            (135 * Math.PI) / 180
        );
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw active arc
        const startAngle = (-135 * Math.PI) / 180;
        const endAngle = (angle * Math.PI) / 180;

        // Gradient for active arc
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, '#a855f7');

        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // Draw center circle (glassmorphic)
        const innerRadius = radius * 0.6;

        // Inner glow
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = `${color}40`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(26, 26, 46, 0.8)';
        ctx.fill();
        ctx.restore();

        // Inner border
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw indicator line
        const indicatorLength = radius * 0.5;
        const indicatorAngle = (angle * Math.PI) / 180;
        const indicatorX = centerX + Math.cos(indicatorAngle) * indicatorLength;
        const indicatorY = centerY + Math.sin(indicatorAngle) * indicatorLength;

        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(indicatorX, indicatorY);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();

        // Draw center dot
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

    }, [value, size, color, valueToAngle, isDragging]);

    // Mouse handlers
    const handleMouseMove = useCallback((e) => {
        if (disabled) return;

        if (rafRef.current !== null) return;

        rafRef.current = requestAnimationFrame(() => {
            const deltaY = dragStartRef.current.y - e.clientY;
            const range = max - min;
            const sensitivity = logarithmic ? 0.002 : (e.shiftKey ? 0.001 : 0.005);

            let newValue;
            if (logarithmic && min > 0) {
                const factor = Math.pow(1.01, -deltaY);
                newValue = dragStartRef.current.value * factor;
            } else {
                newValue = dragStartRef.current.value + (deltaY * range * sensitivity);
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
        dragStartRef.current = { y: e.clientY, value };
        document.body.style.cursor = 'ns-resize';

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [value, disabled, handleMouseMove, handleMouseUp]);

    const handleDoubleClick = useCallback(() => {
        if (disabled) return;
        onChange?.(defaultValue);
        onChangeEnd?.();
    }, [defaultValue, disabled, onChange, onChangeEnd]);

    return (
        <div className="zenith-knob">
            {label && (
                <div className="zenith-knob__label">{label}</div>
            )}
            <canvas
                ref={canvasRef}
                className={`zenith-knob__canvas ${disabled ? 'zenith-knob__canvas--disabled' : ''}`}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                title={`${label}: ${formatValue(value)}\nShift+Drag for precision\nDouble-click to reset`}
            />
            {showValue && (
                <div className="zenith-knob__value">{formatValue(value)}</div>
            )}
        </div>
    );
};
