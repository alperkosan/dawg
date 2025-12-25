/**
 * AudioRecordingPanel - Audio Recording UI
 *
 * Features:
 * - Device selection
 * - Input level meter
 * - Recording controls (Start/Stop/Pause/Resume)
 * - Input monitoring toggle
 * - Recording status display
 */

import React, { useState, useEffect } from 'react';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { RECORDING_STATE } from '@/lib/audio/AudioRecorder';
import './AudioRecordingPanel.css';

export const AudioRecordingPanel = ({ isOpen, onClose }) => {
    const {
        isInitialized,
        devices,
        selectedDeviceId,
        recordingState,
        isRecording,
        isPaused,
        isMonitoring,
        recordingDuration,
        inputLevel,
        error,
        selectDevice,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        toggleMonitoring,
        refreshDevices
    } = useAudioRecording();

    const [isExpanded, setIsExpanded] = useState(false);

    // Recording settings
    const [echoCancellation, setEchoCancellation] = useState(true);
    const [noiseSuppression, setNoiseSuppression] = useState(true);
    const [autoGainControl, setAutoGainControl] = useState(false);

    // Format duration for display
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle device selection
    const handleDeviceSelect = (deviceId) => {
        selectDevice(deviceId);
    };

    // Handle start recording
    const handleStartRecording = async () => {
        const success = await startRecording({
            echoCancellation,
            noiseSuppression,
            autoGainControl
        });

        if (!success) {
            console.error('Failed to start recording');
        }
    };

    // Handle stop recording
    const handleStopRecording = async () => {
        await stopRecording();
    };

    // Handle pause/resume
    const handlePauseResume = async () => {
        if (isPaused) {
            await resumeRecording();
        } else {
            await pauseRecording();
        }
    };

    // Handle monitoring toggle
    const handleMonitoringToggle = () => {
        toggleMonitoring(!isMonitoring);
    };

    if (!isOpen) {
        return null;
    }

    if (!isExpanded) {
        return (
            <div className="audio-recording-panel collapsed">
                <button
                    className={`expand-button ${isRecording ? 'recording' : ''}`}
                    onClick={() => setIsExpanded(true)}
                    title="Audio Recording"
                >
                    {isRecording ? '🔴' : '🎙️'} Audio
                    {isRecording && ` ${formatDuration(recordingDuration)}`}
                </button>
            </div>
        );
    }

    return (
        <div className="audio-recording-panel expanded">
            <div className="panel-header">
                <h3>🎙️ Audio Recording</h3>
                <button
                    className="collapse-button"
                    onClick={() => setIsExpanded(false)}
                >
                    ✕
                </button>
            </div>

            {!isInitialized ? (
                <div className="not-supported">
                    <p>⚠️ Audio recording not available</p>
                    <small>Please allow microphone access</small>
                </div>
            ) : (
                <>
                    {/* Device Selection */}
                    <div className="device-section">
                        <label>Audio Input Device:</label>
                        <div className="device-select-row">
                            <select
                                value={selectedDeviceId || ''}
                                onChange={(e) => handleDeviceSelect(e.target.value)}
                                disabled={isRecording || isPaused}
                            >
                                <option value="">No device selected</option>
                                {devices.map(device => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                className="refresh-button"
                                onClick={refreshDevices}
                                disabled={isRecording || isPaused}
                                title="Refresh devices"
                            >
                                🔄
                            </button>
                        </div>

                        {devices.length === 0 && (
                            <small className="no-devices">
                                No audio devices found. Connect a microphone.
                            </small>
                        )}
                    </div>

                    {/* Input Level Meter */}
                    <div className="level-meter-section">
                        <label>Input Level:</label>
                        <div className="level-meter">
                            <div
                                className="level-bar"
                                style={{
                                    width: `${inputLevel * 100}%`,
                                    backgroundColor: inputLevel > 0.9 ? '#ef4444' : inputLevel > 0.7 ? '#f59e0b' : '#10b981'
                                }}
                            />
                        </div>
                        <small className="level-value">{Math.round(inputLevel * 100)}%</small>
                    </div>

                    {/* Recording Settings */}
                    <div className="settings-section">
                        <label>Audio Processing:</label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={echoCancellation}
                                onChange={(e) => setEchoCancellation(e.target.checked)}
                                disabled={isRecording || isPaused}
                            />
                            Echo Cancellation
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={noiseSuppression}
                                onChange={(e) => setNoiseSuppression(e.target.checked)}
                                disabled={isRecording || isPaused}
                            />
                            Noise Suppression
                        </label>

                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={autoGainControl}
                                onChange={(e) => setAutoGainControl(e.target.checked)}
                                disabled={isRecording || isPaused}
                            />
                            Auto Gain Control
                        </label>
                    </div>

                    {/* Monitoring Toggle */}
                    <div className="monitoring-section">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={isMonitoring}
                                onChange={handleMonitoringToggle}
                                disabled={!isRecording && !isPaused}
                            />
                            Monitor Input (hear yourself)
                        </label>
                        {isMonitoring && (
                            <small className="monitoring-warning">
                                ⚠️ May cause feedback if using speakers
                            </small>
                        )}
                    </div>

                    {/* Recording Status */}
                    {(isRecording || isPaused) && (
                        <div className="recording-status">
                            <div className={`status-indicator ${isPaused ? 'paused' : 'recording'}`}>
                                <span className="pulse">●</span>
                                {isPaused ? 'Paused' : 'Recording'}
                            </div>
                            <div className="duration-display">
                                {formatDuration(recordingDuration)}
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="error-message">
                            <span>⚠️</span>
                            {error.message || 'An error occurred'}
                        </div>
                    )}

                    {/* Control Buttons */}
                    <div className="control-buttons">
                        {!isRecording && !isPaused ? (
                            <button
                                className="record-button"
                                onClick={handleStartRecording}
                                disabled={!selectedDeviceId}
                            >
                                ⏺ Start Recording
                            </button>
                        ) : (
                            <>
                                <button
                                    className="pause-button"
                                    onClick={handlePauseResume}
                                >
                                    {isPaused ? '▶️ Resume' : '⏸ Pause'}
                                </button>
                                <button
                                    className="stop-button"
                                    onClick={handleStopRecording}
                                >
                                    ⏹ Stop
                                </button>
                            </>
                        )}
                    </div>

                    {/* Keyboard Shortcuts */}
                    <div className="shortcuts-hint">
                        <small>
                            <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> Start/Stop recording
                        </small>
                    </div>
                </>
            )}
        </div>
    );
};

export default AudioRecordingPanel;
