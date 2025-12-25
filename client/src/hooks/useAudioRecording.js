/**
 * useAudioRecording - React Hook for Audio Recording
 *
 * Manages audio recording state and provides interface to AudioRecorder
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAudioRecorder, RECORDING_STATE } from '@/lib/audio/AudioRecorder';

export function useAudioRecording() {
    const [audioRecorder] = useState(() => getAudioRecorder());
    const [isInitialized, setIsInitialized] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const [recordingState, setRecordingState] = useState(RECORDING_STATE.IDLE);
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [inputLevel, setInputLevel] = useState(0);
    const [error, setError] = useState(null);

    // Level monitoring RAF handle
    const levelRafRef = useRef(null);

    // Initialize recorder
    useEffect(() => {
        const init = async () => {
            const success = await audioRecorder.initialize();
            setIsInitialized(success);

            if (success) {
                const state = audioRecorder.getState();
                setDevices(state.availableDevices);
                setSelectedDeviceId(state.selectedDeviceId);
            }
        };

        init();

        // Subscribe to events
        const unsubscribers = [
            audioRecorder.on('initialized', ({ devices }) => {
                setDevices(devices);
            }),
            audioRecorder.on('devicesUpdated', ({ devices }) => {
                setDevices(devices);
            }),
            audioRecorder.on('deviceSelected', ({ deviceId }) => {
                setSelectedDeviceId(deviceId);
            }),
            audioRecorder.on('recordingStarted', () => {
                setRecordingState(RECORDING_STATE.RECORDING);
                setError(null);
                startLevelMonitoring();
            }),
            audioRecorder.on('recordingStopped', () => {
                setRecordingState(RECORDING_STATE.IDLE);
                setRecordingDuration(0);
                stopLevelMonitoring();
            }),
            audioRecorder.on('recordingPaused', () => {
                setRecordingState(RECORDING_STATE.PAUSED);
            }),
            audioRecorder.on('recordingResumed', () => {
                setRecordingState(RECORDING_STATE.RECORDING);
            }),
            audioRecorder.on('durationUpdate', ({ duration }) => {
                setRecordingDuration(duration);
            }),
            audioRecorder.on('monitoringChanged', ({ enabled }) => {
                setIsMonitoring(enabled);
            }),
            audioRecorder.on('error', ({ type, error, message }) => {
                setError({ type, error, message });
                console.error('🎙️ Recording error:', type, error);
            })
        ];

        return () => {
            unsubscribers.forEach(unsub => unsub());
            stopLevelMonitoring();
        };
    }, [audioRecorder]);

    // Start level monitoring (RAF-based with throttling)
    const startLevelMonitoring = useCallback(() => {
        if (levelRafRef.current) return;

        let lastUpdate = 0;
        const THROTTLE_MS = 100; // 10 FPS is sufficient for visual feedback

        const updateLevel = (timestamp) => {
            if (timestamp - lastUpdate >= THROTTLE_MS) {
                const level = audioRecorder.getInputLevel();
                setInputLevel(level);
                lastUpdate = timestamp;
            }
            levelRafRef.current = requestAnimationFrame(updateLevel);
        };

        levelRafRef.current = requestAnimationFrame(updateLevel);
    }, [audioRecorder]);

    // Stop level monitoring
    const stopLevelMonitoring = useCallback(() => {
        if (levelRafRef.current) {
            cancelAnimationFrame(levelRafRef.current);
            levelRafRef.current = null;
            setInputLevel(0);
        }
    }, []);

    // Actions
    const selectDevice = useCallback(async (deviceId) => {
        await audioRecorder.selectDevice(deviceId);
    }, [audioRecorder]);

    const startRecording = useCallback(async (options) => {
        return await audioRecorder.startRecording(options);
    }, [audioRecorder]);

    const stopRecording = useCallback(async () => {
        return await audioRecorder.stopRecording();
    }, [audioRecorder]);

    const pauseRecording = useCallback(async () => {
        return await audioRecorder.pauseRecording();
    }, [audioRecorder]);

    const resumeRecording = useCallback(async () => {
        return await audioRecorder.resumeRecording();
    }, [audioRecorder]);

    const toggleMonitoring = useCallback((enabled) => {
        audioRecorder.setMonitoring(enabled);
    }, [audioRecorder]);

    const refreshDevices = useCallback(async () => {
        const updatedDevices = await audioRecorder.updateDeviceList();
        setDevices(updatedDevices);
    }, [audioRecorder]);

    return {
        // State
        isInitialized,
        devices,
        selectedDeviceId,
        recordingState,
        isRecording: recordingState === RECORDING_STATE.RECORDING,
        isPaused: recordingState === RECORDING_STATE.PAUSED,
        isMonitoring,
        recordingDuration,
        inputLevel,
        error,

        // Actions
        selectDevice,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
        toggleMonitoring,
        refreshDevices,

        // Recorder instance (for advanced usage)
        audioRecorder
    };
}

export default useAudioRecording;
