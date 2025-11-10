/**
 * MIDIRecordingPanel - MIDI Recording UI
 *
 * Features:
 * - Device selection
 * - Record mode selection (Replace/Overdub/Loop)
 * - Quantize strength control
 * - Count-in settings
 * - Recording status display
 */

import React, { useState, useEffect } from 'react';
import { getMIDIDeviceManager } from '@/lib/midi/MIDIDeviceManager';
import { RECORD_MODE } from '@/lib/midi/MIDIRecorder';
import './MIDIRecordingPanel.css';

export const MIDIRecordingPanel = ({ midiRecorder, isRecording, onRecordingChange }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [midiDeviceManager] = useState(() => getMIDIDeviceManager());

    // MIDI state
    const [isSupported, setIsSupported] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [activeNotes, setActiveNotes] = useState([]);

    // Recording settings
    const [recordMode, setRecordMode] = useState(RECORD_MODE.REPLACE);
    const [quantizeStrength, setQuantizeStrength] = useState(0);
    const [countInBars, setCountInBars] = useState(1);

    // Recording state
    const [recordingState, setRecordingState] = useState(null);

    // Initialize MIDI
    useEffect(() => {
        const initMIDI = async () => {
            const success = await midiDeviceManager.initialize();
            setIsSupported(success);

            if (success) {
                updateDevices();
                // Auto-select first device
                midiDeviceManager.autoSelectInput();
            }
        };

        initMIDI();
    }, [midiDeviceManager]);

    // Subscribe to MIDI events
    useEffect(() => {
        const unsubscribe = midiDeviceManager.subscribe((event) => {
            // Update device list on state changes
            if (event.type === 'deviceStateChange') {
                updateDevices();
            }

            // Update active notes
            if (event.type === 'noteOn' || event.type === 'noteOff') {
                setActiveNotes(midiDeviceManager.getActiveNotes());
            }
        });

        return unsubscribe;
    }, [midiDeviceManager]);

    // Update recording state periodically
    useEffect(() => {
        if (!isRecording) return;

        const interval = setInterval(() => {
            if (midiRecorder) {
                setRecordingState(midiRecorder.getState());
            }
        }, 100);

        return () => clearInterval(interval);
    }, [isRecording, midiRecorder]);

    const updateDevices = () => {
        const inputDevices = midiDeviceManager.getInputDevices();
        setDevices(inputDevices);

        const selected = midiDeviceManager.getSelectedInput();
        setSelectedDeviceId(selected?.id || null);
    };

    const handleDeviceSelect = (deviceId) => {
        midiDeviceManager.selectInput(deviceId);
        setSelectedDeviceId(deviceId);
    };

    const handleStartRecording = () => {
        if (!midiRecorder) return;

        const success = midiRecorder.startRecording({
            mode: recordMode,
            quantizeStrength,
            countInBars
        });

        if (success && onRecordingChange) {
            onRecordingChange(true);
        }
    };

    const handleStopRecording = () => {
        if (!midiRecorder) return;

        midiRecorder.stopRecording();

        if (onRecordingChange) {
            onRecordingChange(false);
        }
    };

    if (!isExpanded) {
        return (
            <div className="midi-recording-panel collapsed">
                <button
                    className={`expand-button ${isRecording ? 'recording' : ''}`}
                    onClick={() => setIsExpanded(true)}
                    title="MIDI Recording"
                >
                    {isRecording ? '🔴' : '🎹'} MIDI
                    {activeNotes.length > 0 && ` (${activeNotes.length})`}
                </button>
            </div>
        );
    }

    return (
        <div className="midi-recording-panel expanded">
            <div className="panel-header">
                <h3>MIDI Recording</h3>
                <button
                    className="collapse-button"
                    onClick={() => setIsExpanded(false)}
                >
                    ✕
                </button>
            </div>

            {!isSupported ? (
                <div className="not-supported">
                    <p>⚠️ Web MIDI API not supported</p>
                    <small>Please use Chrome, Edge, or Opera</small>
                </div>
            ) : (
                <>
                    {/* Device Selection */}
                    <div className="device-section">
                        <label>MIDI Input Device:</label>
                        <select
                            value={selectedDeviceId || ''}
                            onChange={(e) => handleDeviceSelect(e.target.value)}
                            disabled={isRecording}
                        >
                            <option value="">No device selected</option>
                            {devices.map(device => (
                                <option key={device.id} value={device.id}>
                                    {device.name}
                                    {device.state === 'disconnected' && ' (disconnected)'}
                                </option>
                            ))}
                        </select>

                        {devices.length === 0 && (
                            <small className="no-devices">
                                No MIDI devices found. Connect a MIDI keyboard.
                            </small>
                        )}
                    </div>

                    {/* Active Notes Indicator */}
                    {activeNotes.length > 0 && (
                        <div className="active-notes">
                            <span className="indicator">●</span>
                            Active notes: {activeNotes.join(', ')}
                        </div>
                    )}

                    {/* Recording Settings */}
                    <div className="settings-section">
                        {/* Record Mode */}
                        <div className="setting-group">
                            <label>Record Mode:</label>
                            <div className="button-group">
                                <button
                                    className={recordMode === RECORD_MODE.REPLACE ? 'active' : ''}
                                    onClick={() => setRecordMode(RECORD_MODE.REPLACE)}
                                    disabled={isRecording}
                                    title="Replace existing notes"
                                >
                                    Replace
                                </button>
                                <button
                                    className={recordMode === RECORD_MODE.OVERDUB ? 'active' : ''}
                                    onClick={() => setRecordMode(RECORD_MODE.OVERDUB)}
                                    disabled={isRecording}
                                    title="Add to existing notes"
                                >
                                    Overdub
                                </button>
                                <button
                                    className={recordMode === RECORD_MODE.LOOP ? 'active' : ''}
                                    onClick={() => setRecordMode(RECORD_MODE.LOOP)}
                                    disabled={isRecording}
                                    title="Loop recording with overdub"
                                >
                                    Loop
                                </button>
                            </div>
                        </div>

                        {/* Quantize Strength */}
                        <div className="setting-group">
                            <label>
                                Quantize: {Math.round(quantizeStrength * 100)}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={quantizeStrength}
                                onChange={(e) => setQuantizeStrength(parseFloat(e.target.value))}
                                disabled={isRecording}
                            />
                            <small>
                                {quantizeStrength === 0 && 'No quantization'}
                                {quantizeStrength > 0 && quantizeStrength < 1 && 'Partial quantization'}
                                {quantizeStrength === 1 && 'Full quantization to grid'}
                            </small>
                        </div>

                        {/* Count-in */}
                        <div className="setting-group">
                            <label>Count-in: {countInBars} bar{countInBars !== 1 ? 's' : ''}</label>
                            <input
                                type="range"
                                min="0"
                                max="4"
                                step="1"
                                value={countInBars}
                                onChange={(e) => setCountInBars(parseInt(e.target.value))}
                                disabled={isRecording}
                            />
                        </div>
                    </div>

                    {/* Recording Status */}
                    {recordingState && (
                        <div className="recording-status">
                            {recordingState.isCountingIn && (
                                <div className="count-in-indicator">
                                    🎵 Count-in...
                                </div>
                            )}
                            {recordingState.isRecording && (
                                <div className="recording-indicator">
                                    <span className="pulse">●</span>
                                    Recording: {recordingState.notesRecorded} note{recordingState.notesRecorded !== 1 ? 's' : ''}
                                    {recordingState.pendingNotes > 0 && ` (+${recordingState.pendingNotes} pending)`}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Record Button */}
                    <div className="record-button-section">
                        {isRecording ? (
                            <button
                                className="stop-button"
                                onClick={handleStopRecording}
                            >
                                ⏹ Stop Recording
                            </button>
                        ) : (
                            <button
                                className="record-button"
                                onClick={handleStartRecording}
                                disabled={!selectedDeviceId}
                            >
                                ⏺ Start Recording
                            </button>
                        )}
                    </div>

                    {/* Keyboard Shortcuts */}
                    <div className="shortcuts-hint">
                        <small>
                            <kbd>Ctrl</kbd>+<kbd>R</kbd> Start/Stop recording
                        </small>
                    </div>
                </>
            )}
        </div>
    );
};

export default MIDIRecordingPanel;
