import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useTimelineStore } from '@/store/TimelineStore';
import { MIDIRecorder } from '@/lib/midi/MIDIRecorder';
import EventBus from '@/lib/core/EventBus';
import { AudioContextService } from '@/lib/services/AudioContextService';

export const useMidiRecording = ({
    currentInstrument,
    loopRegion
}) => {
    // Global State
    const bpm = usePlaybackStore(state => state.bpm);

    // Local State
    const [isRecording, setIsRecording] = useState(false);
    const [isCountingIn, setIsCountingIn] = useState(false);
    const [countInBars, setCountInBars] = useState(1);

    const recorderRef = useRef(null);

    // Initialize Recorder & Listeners
    useEffect(() => {
        // We initialize recorder lazily or on mount? 
        // Original code initialized it inside useEffect dependent on nothing (mount), 
        // but used refs for stores.
        // Actually, original code re-created recorder when `loopRegion` or `currentInstrument` changed?
        // No, deps were `[loopRegion]`.

        const playbackStore = usePlaybackStore.getState();
        const arrangementStore = useArrangementStore.getState();
        const timelineStore = useTimelineStore.getState();

        const recorder = new MIDIRecorder(
            playbackStore,
            arrangementStore,
            timelineStore,
            loopRegion,
            currentInstrument?.id
        );

        recorderRef.current = recorder;

        // Handlers
        const handleCountInStart = (e) => {
            setIsCountingIn(true);
            if (e.detail?.countInBars) {
                setCountInBars(e.detail.countInBars);
            }
        };

        const handleCountInEnd = () => {
            setIsCountingIn(false);
        };

        const handleRecordingStart = () => {
            setIsRecording(true);
        };

        const handleTransportStop = () => {
            if (recorder && recorder.state.isRecording) {
                console.log('⏹ Transport stop: Stopping recording');
                recorder.stopRecording().then(() => {
                    setIsRecording(false);
                    setIsCountingIn(false);
                });
            }
        };

        const handleKeyboardNoteOn = (e) => {
            if (recorder && recorder.state.isRecording) {
                const { pitch, velocity } = e.detail;
                // Timestamp logic is handled internally by recorder or passed here?
                // Original code had heavy timestamp logic here. 
                // For now, let's keep it simple or delegate to recorder if it supports it.
                // Replicating original heavy timestamp logic for safety:

                let audioTime = null;
                try {
                    const audioEngine = AudioContextService.getAudioEngine();
                    if (audioEngine?.audioContext) {
                        audioTime = audioEngine.audioContext.currentTime;
                    }
                } catch (err) { }

                const finalTimestamp = audioTime || (performance.now() / 1000);

                recorder.handleMIDIEvent({
                    type: 'noteOn',
                    note: pitch,
                    velocity,
                    timestamp: finalTimestamp
                });
            }
        };

        const handleKeyboardNoteOff = (e) => {
            if (recorder && recorder.state.isRecording) {
                const { pitch } = e.detail;

                let audioTime = null;
                try {
                    const audioEngine = AudioContextService.getAudioEngine();
                    if (audioEngine?.audioContext) {
                        audioTime = audioEngine.audioContext.currentTime;
                    }
                } catch (err) { }

                const finalTimestamp = audioTime || (performance.now() / 1000);

                recorder.handleMIDIEvent({
                    type: 'noteOff',
                    note: pitch,
                    velocity: 0,
                    timestamp: finalTimestamp
                });
            }
        };

        // Attach Listeners
        if (typeof window !== 'undefined') {
            window.addEventListener('midi:countInStart', handleCountInStart);
            window.addEventListener('midi:countInEnd', handleCountInEnd);
            window.addEventListener('midi:recordingStart', handleRecordingStart);
            window.addEventListener('midi:keyboardNoteOn', handleKeyboardNoteOn);
            window.addEventListener('midi:keyboardNoteOff', handleKeyboardNoteOff);
        }
        EventBus.on('transport:stop', handleTransportStop);

        // Cleanup
        return () => {
            if (recorder) void recorder.stopRecording();

            if (typeof window !== 'undefined') {
                window.removeEventListener('midi:countInStart', handleCountInStart);
                window.removeEventListener('midi:countInEnd', handleCountInEnd);
                window.removeEventListener('midi:recordingStart', handleRecordingStart);
                window.removeEventListener('midi:keyboardNoteOn', handleKeyboardNoteOn);
                window.removeEventListener('midi:keyboardNoteOff', handleKeyboardNoteOff);
            }
            EventBus.off('transport:stop', handleTransportStop);
            recorderRef.current = null;
        };
    }, [loopRegion, currentInstrument?.id]); // Re-init on loop region or instrument change

    return {
        isRecording,
        isCountingIn,
        countInBars,
        recorder: recorderRef.current
    };
};
