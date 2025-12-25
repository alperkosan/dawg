/**
 * 🎵 TIME RANGE SELECTOR
 *
 * UI component for selecting time ranges for export
 * Supports beats, bars, and time (seconds) formats
 * Includes loop region selection
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Clock, Music, Repeat } from 'lucide-react';
import { getCurrentBPM } from '@/lib/audio/audioRenderConfig.js';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useArrangementWorkspaceStore } from '@/store/useArrangementWorkspaceStore';
import './TimeRangeSelector.css';

const TIME_FORMAT = {
    BEATS: 'beats',
    BARS: 'bars',
    TIME: 'time'
};

/**
 * Convert beats to bars (assuming 4/4 time signature)
 */
function beatsToBars(beats) {
    return beats / 4;
}

/**
 * Convert bars to beats
 */
function barsToBeats(bars) {
    return bars * 4;
}

/**
 * Convert beats to seconds
 */
function beatsToSeconds(beats, bpm) {
    return beats * (60 / bpm);
}

/**
 * Convert seconds to beats
 */
function secondsToBeats(seconds, bpm) {
    return seconds * (bpm / 60);
}

/**
 * Format time as MM:SS.mmm
 */
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

/**
 * Parse time from MM:SS.mmm format
 */
function parseTime(timeString) {
    const parts = timeString.split(':');
    if (parts.length !== 2) return null;
    const minutes = parseInt(parts[0], 10);
    const secondsParts = parts[1].split('.');
    const seconds = parseInt(secondsParts[0], 10);
    const millis = secondsParts[1] ? parseInt(secondsParts[1], 10) : 0;
    return minutes * 60 + seconds + millis / 1000;
}

export const TimeRangeSelector = ({
    startTime = null,
    endTime = null,
    onStartTimeChange,
    onEndTimeChange,
    loopRegion = false,
    onLoopRegionChange,
    disabled = false
}) => {
    const [timeFormat, setTimeFormat] = useState(TIME_FORMAT.BEATS);
    const [startValue, setStartValue] = useState('');
    const [endValue, setEndValue] = useState('');

    const bpm = getCurrentBPM();
    const currentStep = usePlaybackStore(state => state.currentStep);
    const arrangementStore = useArrangementStore();
    const workspaceStore = useArrangementWorkspaceStore();

    // Get loop region from workspace store
    const activeArrangement = useMemo(() => {
        return workspaceStore.getActiveArrangement();
    }, [workspaceStore]);

    const loopStart = activeArrangement?.loopStart || 0;
    const loopEnd = activeArrangement?.loopEnd || 32;

    // Convert current step to beats (1 step = 0.25 beats for 16th note grid)
    const currentStepInBeats = useMemo(() => {
        return currentStep * 0.25;
    }, [currentStep]);

    // Initialize values from props
    useEffect(() => {
        if (startTime !== null) {
            setStartValue(formatValue(startTime, timeFormat, bpm));
        } else if (loopRegion) {
            setStartValue(formatValue(loopStart, timeFormat, bpm));
        } else {
            setStartValue(formatValue(0, timeFormat, bpm));
        }
    }, [startTime, loopRegion, loopStart, timeFormat, bpm]);

    useEffect(() => {
        if (endTime !== null) {
            setEndValue(formatValue(endTime, timeFormat, bpm));
        } else if (loopRegion) {
            setEndValue(formatValue(loopEnd, timeFormat, bpm));
        } else {
            // Default to song length or pattern length
            const songLength = arrangementStore.songLength || 128; // bars
            const songLengthBeats = songLength * 4; // bars to beats
            setEndValue(formatValue(songLengthBeats, timeFormat, bpm));
        }
    }, [endTime, loopRegion, loopEnd, timeFormat, bpm, arrangementStore.songLength]);

    /**
     * Format value based on time format
     */
    const formatValue = useCallback((beats, format, bpm) => {
        switch (format) {
            case TIME_FORMAT.BEATS:
                return beats.toFixed(2);
            case TIME_FORMAT.BARS:
                return beatsToBars(beats).toFixed(2);
            case TIME_FORMAT.TIME:
                return formatTime(beatsToSeconds(beats, bpm));
            default:
                return beats.toFixed(2);
        }
    }, []);

    /**
     * Parse value based on time format
     */
    const parseValue = useCallback((value, format, bpm) => {
        if (!value || value.trim() === '') return null;

        const numValue = parseFloat(value);
        if (isNaN(numValue)) return null;

        switch (format) {
            case TIME_FORMAT.BEATS:
                return numValue;
            case TIME_FORMAT.BARS:
                return barsToBeats(numValue);
            case TIME_FORMAT.TIME:
                const seconds = parseTime(value);
                return seconds !== null ? secondsToBeats(seconds, bpm) : null;
            default:
                return numValue;
        }
    }, []);

    /**
     * Handle start time change
     */
    const handleStartChange = useCallback((value) => {
        setStartValue(value);
        const beats = parseValue(value, timeFormat, bpm);
        if (beats !== null && onStartTimeChange) {
            onStartTimeChange(beats);
        }
    }, [timeFormat, bpm, parseValue, onStartTimeChange]);

    /**
     * Handle end time change
     */
    const handleEndChange = useCallback((value) => {
        setEndValue(value);
        const beats = parseValue(value, timeFormat, bpm);
        if (beats !== null && onEndTimeChange) {
            onEndTimeChange(beats);
        }
    }, [timeFormat, bpm, parseValue, onEndTimeChange]);

    /**
     * Handle loop region toggle
     */
    const handleLoopRegionToggle = useCallback(() => {
        if (onLoopRegionChange) {
            const newLoopRegion = !loopRegion;
            onLoopRegionChange(newLoopRegion);

            if (newLoopRegion) {
                // Set to loop region values
                if (onStartTimeChange) onStartTimeChange(loopStart);
                if (onEndTimeChange) onEndTimeChange(loopEnd);
            }
        }
    }, [loopRegion, onLoopRegionChange, loopStart, loopEnd, onStartTimeChange, onEndTimeChange]);

    /**
     * Set to current playhead position
     */
    const handleSetToPlayhead = useCallback(() => {
        if (onStartTimeChange) {
            onStartTimeChange(currentStepInBeats);
        }
    }, [currentStepInBeats, onStartTimeChange]);

    /**
     * Set to song start
     */
    const handleSetToStart = useCallback(() => {
        if (onStartTimeChange) {
            onStartTimeChange(0);
        }
    }, [onStartTimeChange]);

    /**
     * Set to song end
     */
    const handleSetToEnd = useCallback(() => {
        const songLength = arrangementStore.songLength || 128; // bars
        const songLengthBeats = songLength * 4; // bars to beats
        if (onEndTimeChange) {
            onEndTimeChange(songLengthBeats);
        }
    }, [arrangementStore.songLength, onEndTimeChange]);

    return (
        <div className="time-range-selector">
            <div className="time-range-selector__header">
                <h4 className="time-range-selector__title">⏱️ Time Range</h4>
                <div className="time-range-selector__format-toggle">
                    <button
                        className={`time-range-selector__format-btn ${timeFormat === TIME_FORMAT.BEATS ? 'active' : ''}`}
                        onClick={() => setTimeFormat(TIME_FORMAT.BEATS)}
                        disabled={disabled}
                        title="Beats"
                    >
                        <Music size={14} />
                        Beats
                    </button>
                    <button
                        className={`time-range-selector__format-btn ${timeFormat === TIME_FORMAT.BARS ? 'active' : ''}`}
                        onClick={() => setTimeFormat(TIME_FORMAT.BARS)}
                        disabled={disabled}
                        title="Bars"
                    >
                        <Music size={14} />
                        Bars
                    </button>
                    <button
                        className={`time-range-selector__format-btn ${timeFormat === TIME_FORMAT.TIME ? 'active' : ''}`}
                        onClick={() => setTimeFormat(TIME_FORMAT.TIME)}
                        disabled={disabled}
                        title="Time (MM:SS.mmm)"
                    >
                        <Clock size={14} />
                        Time
                    </button>
                </div>
            </div>

            <div className="time-range-selector__inputs">
                <div className="time-range-selector__input-group">
                    <label className="time-range-selector__label">Start</label>
                    <input
                        type="text"
                        className="time-range-selector__input"
                        value={startValue}
                        onChange={(e) => handleStartChange(e.target.value)}
                        disabled={disabled || loopRegion}
                        placeholder={timeFormat === TIME_FORMAT.TIME ? "00:00.000" : "0.00"}
                    />
                    <div className="time-range-selector__quick-actions">
                        <button
                            className="time-range-selector__quick-btn"
                            onClick={handleSetToStart}
                            disabled={disabled || loopRegion}
                            title="Set to start (0)"
                        >
                            Start
                        </button>
                        <button
                            className="time-range-selector__quick-btn"
                            onClick={handleSetToPlayhead}
                            disabled={disabled || loopRegion}
                            title={`Set to playhead (${currentStepInBeats.toFixed(2)} beats)`}
                        >
                            Playhead
                        </button>
                    </div>
                </div>

                <div className="time-range-selector__input-group">
                    <label className="time-range-selector__label">End</label>
                    <input
                        type="text"
                        className="time-range-selector__input"
                        value={endValue}
                        onChange={(e) => handleEndChange(e.target.value)}
                        disabled={disabled || loopRegion}
                        placeholder={timeFormat === TIME_FORMAT.TIME ? "00:00.000" : "0.00"}
                    />
                    <div className="time-range-selector__quick-actions">
                        <button
                            className="time-range-selector__quick-btn"
                            onClick={handleSetToEnd}
                            disabled={disabled || loopRegion}
                            title="Set to song end"
                        >
                            End
                        </button>
                    </div>
                </div>
            </div>

            <div className="time-range-selector__options">
                <label className="time-range-selector__checkbox">
                    <input
                        type="checkbox"
                        checked={loopRegion}
                        onChange={handleLoopRegionToggle}
                        disabled={disabled}
                    />
                    <Repeat size={14} />
                    <span>Use Loop Region</span>
                    {loopRegion && (
                        <span className="time-range-selector__loop-info">
                            ({loopStart.toFixed(2)} - {loopEnd.toFixed(2)} beats)
                        </span>
                    )}
                </label>
            </div>

            {startTime !== null && endTime !== null && (
                <div className="time-range-selector__info">
                    <span>Duration: {formatValue(endTime - startTime, timeFormat, bpm)} {timeFormat}</span>
                    {timeFormat !== TIME_FORMAT.TIME && (
                        <span className="time-range-selector__info-secondary">
                            ({formatTime(beatsToSeconds(endTime - startTime, bpm))})
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default TimeRangeSelector;

