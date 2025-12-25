/**
 * AudioRecorder - Real-time Audio Recording
 *
 * Features:
 * - Microphone/audio interface recording
 * - Real-time input level monitoring
 * - Pause/Resume support
 * - Multiple format support (WebM, WAV)
 * - Integration with audio asset manager
 *
 * Architecture:
 * - Event-driven
 * - MediaRecorder API
 * - Web Audio API for monitoring
 */

import { audioAssetManager } from './AudioAssetManager';
import { AudioContextService } from '../services/AudioContextService';

// ═══════════════════════════════════════════════════════════
// RECORDING STATES
// ═══════════════════════════════════════════════════════════

export const RECORDING_STATE = {
    IDLE: 'idle',
    RECORDING: 'recording',
    PAUSED: 'paused',
    STOPPING: 'stopping'
};

// ═══════════════════════════════════════════════════════════
// AUDIO RECORDER
// ═══════════════════════════════════════════════════════════

export class AudioRecorder {
    constructor() {
        this.state = {
            currentState: RECORDING_STATE.IDLE,
            selectedDeviceId: null,
            isMonitoring: false,

            // Recording session
            mediaStream: null,
            mediaRecorder: null,
            recordedChunks: [],
            recordingStartTime: null,
            recordingDuration: 0,

            // Audio monitoring
            audioContext: null,
            sourceNode: null,
            analyserNode: null,
            monitorGainNode: null,

            // Device info
            availableDevices: [],

            // Format settings
            mimeType: 'audio/webm;codecs=opus',
            sampleRate: 48000,
            channelCount: 2
        };

        // Event listeners
        this.eventListeners = new Map();

        // Stats
        this.stats = {
            totalRecordings: 0,
            totalDuration: 0
        };

        console.log('🎙️ AudioRecorder initialized');
    }

    // ═══════════════════════════════════════════════════════════
    // INITIALIZATION & DEVICE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    /**
     * Initialize audio recorder and request permissions
     */
    async initialize() {
        try {
            // Check MediaRecorder support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('MediaRecorder API not supported in this browser');
            }

            // Request initial permissions (will trigger browser permission prompt)
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Stop the permission stream immediately
            stream.getTracks().forEach(track => track.stop());

            // Get available audio devices
            await this.updateDeviceList();

            // Auto-select first device if available
            if (this.state.availableDevices.length > 0) {
                this.state.selectedDeviceId = this.state.availableDevices[0].deviceId;
            }

            console.log('🎙️ AudioRecorder initialized successfully');
            this.emit('initialized', { devices: this.state.availableDevices });

            return true;
        } catch (error) {
            console.error('🎙️ Failed to initialize AudioRecorder:', error);
            this.emit('error', { type: 'initialization', error });
            return false;
        }
    }

    /**
     * Update list of available audio input devices
     */
    async updateDeviceList() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.state.availableDevices = devices
                .filter(device => device.kind === 'audioinput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `Microphone ${device.deviceId.substring(0, 8)}`,
                    groupId: device.groupId
                }));

            console.log(`🎙️ Found ${this.state.availableDevices.length} audio input devices`);
            this.emit('devicesUpdated', { devices: this.state.availableDevices });

            return this.state.availableDevices;
        } catch (error) {
            console.error('🎙️ Failed to enumerate devices:', error);
            return [];
        }
    }

    /**
     * Select audio input device
     */
    async selectDevice(deviceId) {
        if (!deviceId) {
            console.warn('🎙️ No device ID provided');
            return false;
        }

        // Stop current stream if active
        if (this.state.mediaStream) {
            this.stopMediaStream();
        }

        this.state.selectedDeviceId = deviceId;
        console.log(`🎙️ Selected device: ${deviceId}`);
        this.emit('deviceSelected', { deviceId });

        return true;
    }

    /**
     * Get list of available audio devices
     */
    getAudioDevices() {
        return this.state.availableDevices;
    }

    /**
     * Get selected device info
     */
    getSelectedDevice() {
        return this.state.availableDevices.find(
            device => device.deviceId === this.state.selectedDeviceId
        );
    }

    // ═══════════════════════════════════════════════════════════
    // RECORDING CONTROL
    // ═══════════════════════════════════════════════════════════

    /**
     * Start recording
     */
    async startRecording(options = {}) {
        if (this.state.currentState !== RECORDING_STATE.IDLE) {
            console.warn('🎙️ Already recording or in invalid state');
            return false;
        }

        if (!this.state.selectedDeviceId) {
            console.error('🎙️ No device selected');
            this.emit('error', { type: 'noDevice', message: 'Please select an audio input device' });
            return false;
        }

        try {
            // Get media stream from selected device
            const constraints = {
                audio: {
                    deviceId: { exact: this.state.selectedDeviceId },
                    sampleRate: options.sampleRate || this.state.sampleRate,
                    channelCount: options.channelCount || this.state.channelCount,
                    echoCancellation: options.echoCancellation ?? true,
                    noiseSuppression: options.noiseSuppression ?? true,
                    autoGainControl: options.autoGainControl ?? false
                }
            };

            this.state.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Setup audio monitoring (Web Audio API)
            await this.setupAudioMonitoring();

            // Determine best supported MIME type
            const mimeType = this.getBestMimeType();
            this.state.mimeType = mimeType;

            // Create MediaRecorder
            const recorderOptions = {
                mimeType: mimeType,
                audioBitsPerSecond: options.audioBitsPerSecond || 128000
            };

            this.state.mediaRecorder = new MediaRecorder(this.state.mediaStream, recorderOptions);
            this.state.recordedChunks = [];

            // MediaRecorder event handlers
            this.state.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.state.recordedChunks.push(event.data);
                }
            };

            this.state.mediaRecorder.onstop = async () => {
                await this.handleRecordingStop();
            };

            this.state.mediaRecorder.onerror = (event) => {
                console.error('🎙️ MediaRecorder error:', event.error);
                this.emit('error', { type: 'recording', error: event.error });
            };

            // Start recording
            this.state.mediaRecorder.start(100); // Collect data every 100ms
            this.state.recordingStartTime = performance.now();
            this.state.currentState = RECORDING_STATE.RECORDING;

            console.log('🎙️ Recording started', { mimeType, constraints });
            this.emit('recordingStarted', {
                deviceId: this.state.selectedDeviceId,
                mimeType: this.state.mimeType
            });

            // Start duration tracking
            this.startDurationTracking();

            return true;
        } catch (error) {
            console.error('🎙️ Failed to start recording:', error);
            this.emit('error', { type: 'startRecording', error });
            this.cleanup();
            return false;
        }
    }

    /**
     * Stop recording
     */
    async stopRecording() {
        if (this.state.currentState !== RECORDING_STATE.RECORDING &&
            this.state.currentState !== RECORDING_STATE.PAUSED) {
            console.warn('🎙️ Not recording');
            return null;
        }

        try {
            this.state.currentState = RECORDING_STATE.STOPPING;

            // Stop MediaRecorder (will trigger onstop event)
            if (this.state.mediaRecorder && this.state.mediaRecorder.state !== 'inactive') {
                this.state.mediaRecorder.stop();
            }

            // Stop duration tracking
            this.stopDurationTracking();

            // Note: Actual processing happens in handleRecordingStop()
            // which is called by MediaRecorder's onstop event

            return true;
        } catch (error) {
            console.error('🎙️ Failed to stop recording:', error);
            this.emit('error', { type: 'stopRecording', error });
            this.cleanup();
            return null;
        }
    }

    /**
     * Pause recording
     */
    async pauseRecording() {
        if (this.state.currentState !== RECORDING_STATE.RECORDING) {
            console.warn('🎙️ Not recording');
            return false;
        }

        try {
            if (this.state.mediaRecorder && this.state.mediaRecorder.state === 'recording') {
                this.state.mediaRecorder.pause();
                this.state.currentState = RECORDING_STATE.PAUSED;

                console.log('🎙️ Recording paused');
                this.emit('recordingPaused');

                return true;
            }
            return false;
        } catch (error) {
            console.error('🎙️ Failed to pause recording:', error);
            this.emit('error', { type: 'pauseRecording', error });
            return false;
        }
    }

    /**
     * Resume recording
     */
    async resumeRecording() {
        if (this.state.currentState !== RECORDING_STATE.PAUSED) {
            console.warn('🎙️ Not paused');
            return false;
        }

        try {
            if (this.state.mediaRecorder && this.state.mediaRecorder.state === 'paused') {
                this.state.mediaRecorder.resume();
                this.state.currentState = RECORDING_STATE.RECORDING;

                console.log('🎙️ Recording resumed');
                this.emit('recordingResumed');

                return true;
            }
            return false;
        } catch (error) {
            console.error('🎙️ Failed to resume recording:', error);
            this.emit('error', { type: 'resumeRecording', error });
            return false;
        }
    }

    /**
     * Handle recording stop (called by MediaRecorder onstop event)
     */
    async handleRecordingStop() {
        try {
            // Create blob from recorded chunks
            const blob = new Blob(this.state.recordedChunks, { type: this.state.mimeType });
            const duration = (performance.now() - this.state.recordingStartTime) / 1000;

            console.log(`🎙️ Recording stopped: ${duration.toFixed(2)}s, ${(blob.size / 1024).toFixed(2)}KB`);

            // Convert to AudioBuffer
            const audioBuffer = await this.blobToAudioBuffer(blob);

            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `Recording_${timestamp}`;

            // Add to audio asset manager
            const assetId = await audioAssetManager.addAsset({
                id: `audio-recording-${Date.now()}`,
                name: filename,
                buffer: audioBuffer,
                type: 'audio',
                metadata: {
                    recorded: true,
                    recordedAt: Date.now(),
                    duration: audioBuffer.duration,
                    sampleRate: audioBuffer.sampleRate,
                    numberOfChannels: audioBuffer.numberOfChannels,
                    mimeType: this.state.mimeType
                }
            });

            // Update stats
            this.stats.totalRecordings++;
            this.stats.totalDuration += duration;

            // Emit completion event
            this.emit('recordingStopped', {
                assetId,
                filename,
                duration,
                audioBuffer,
                blob,
                size: blob.size
            });

            // Cleanup
            this.cleanup();

            return { assetId, filename, audioBuffer, blob };
        } catch (error) {
            console.error('🎙️ Failed to process recording:', error);
            this.emit('error', { type: 'processRecording', error });
            this.cleanup();
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // AUDIO MONITORING
    // ═══════════════════════════════════════════════════════════

    /**
     * Setup audio monitoring (Web Audio API)
     */
    async setupAudioMonitoring() {
        try {
            // Get or create audio context
            this.state.audioContext = AudioContextService.getAudioContext();

            // Create source from media stream
            this.state.sourceNode = this.state.audioContext.createMediaStreamSource(this.state.mediaStream);

            // Create analyser for level metering
            this.state.analyserNode = this.state.audioContext.createAnalyser();
            this.state.analyserNode.fftSize = 256;
            this.state.analyserNode.smoothingTimeConstant = 0.8;

            // Create gain node for monitoring (initially muted)
            this.state.monitorGainNode = this.state.audioContext.createGain();
            this.state.monitorGainNode.gain.value = 0; // Muted by default

            // Connect: source -> analyser -> gain -> destination
            this.state.sourceNode.connect(this.state.analyserNode);
            this.state.analyserNode.connect(this.state.monitorGainNode);
            this.state.monitorGainNode.connect(this.state.audioContext.destination);

            console.log('🎙️ Audio monitoring setup complete');
        } catch (error) {
            console.error('🎙️ Failed to setup audio monitoring:', error);
            throw error;
        }
    }

    /**
     * Toggle input monitoring (hear yourself)
     */
    setMonitoring(enabled) {
        if (!this.state.monitorGainNode) {
            console.warn('🎙️ Monitoring not available');
            return false;
        }

        this.state.isMonitoring = enabled;
        this.state.monitorGainNode.gain.value = enabled ? 1.0 : 0;

        console.log(`🎙️ Input monitoring ${enabled ? 'enabled' : 'disabled'}`);
        this.emit('monitoringChanged', { enabled });

        return true;
    }

    /**
     * Get current input level (0-1)
     */
    getInputLevel() {
        if (!this.state.analyserNode) {
            return 0;
        }

        const dataArray = new Uint8Array(this.state.analyserNode.frequencyBinCount);
        this.state.analyserNode.getByteTimeDomainData(dataArray);

        // Calculate RMS (Root Mean Square) for level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        return Math.min(rms * 2, 1.0); // Scale and clamp to 0-1
    }

    /**
     * Get waveform data for visualization
     */
    getWaveformData() {
        if (!this.state.analyserNode) {
            return new Uint8Array(0);
        }

        const dataArray = new Uint8Array(this.state.analyserNode.frequencyBinCount);
        this.state.analyserNode.getByteTimeDomainData(dataArray);
        return dataArray;
    }

    // ═══════════════════════════════════════════════════════════
    // UTILITY METHODS
    // ═══════════════════════════════════════════════════════════

    /**
     * Get best supported MIME type
     */
    getBestMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        // Fallback to default
        return 'audio/webm';
    }

    /**
     * Convert Blob to AudioBuffer
     */
    async blobToAudioBuffer(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = AudioContextService.getAudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer;
    }

    /**
     * Start duration tracking (RAF-based for performance)
     */
    startDurationTracking() {
        const updateDuration = () => {
            if (this.state.currentState === RECORDING_STATE.RECORDING) {
                this.state.recordingDuration = (performance.now() - this.state.recordingStartTime) / 1000;
                this.emit('durationUpdate', { duration: this.state.recordingDuration });
                this.durationRafId = requestAnimationFrame(updateDuration);
            }
        };
        this.durationRafId = requestAnimationFrame(updateDuration);
    }

    /**
     * Stop duration tracking
     */
    stopDurationTracking() {
        if (this.durationRafId) {
            cancelAnimationFrame(this.durationRafId);
            this.durationRafId = null;
        }
    }

    /**
     * Stop media stream
     */
    stopMediaStream() {
        if (this.state.mediaStream) {
            this.state.mediaStream.getTracks().forEach(track => track.stop());
            this.state.mediaStream = null;
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Stop duration tracking
        this.stopDurationTracking();

        // Stop media stream
        this.stopMediaStream();

        // Disconnect audio nodes
        if (this.state.sourceNode) {
            this.state.sourceNode.disconnect();
            this.state.sourceNode = null;
        }
        if (this.state.analyserNode) {
            this.state.analyserNode.disconnect();
            this.state.analyserNode = null;
        }
        if (this.state.monitorGainNode) {
            this.state.monitorGainNode.disconnect();
            this.state.monitorGainNode = null;
        }

        // Reset state
        this.state.mediaRecorder = null;
        this.state.recordedChunks = [];
        this.state.recordingStartTime = null;
        this.state.recordingDuration = 0;
        this.state.currentState = RECORDING_STATE.IDLE;
        this.state.isMonitoring = false;

        console.log('🎙️ Cleanup complete');
    }

    // ═══════════════════════════════════════════════════════════
    // STATE & INFO
    // ═══════════════════════════════════════════════════════════

    /**
     * Get current state
     */
    getState() {
        return {
            currentState: this.state.currentState,
            isRecording: this.state.currentState === RECORDING_STATE.RECORDING,
            isPaused: this.state.currentState === RECORDING_STATE.PAUSED,
            isMonitoring: this.state.isMonitoring,
            selectedDeviceId: this.state.selectedDeviceId,
            recordingDuration: this.state.recordingDuration,
            availableDevices: this.state.availableDevices,
            mimeType: this.state.mimeType
        };
    }

    /**
     * Get stats
     */
    getStats() {
        return { ...this.stats };
    }

    // ═══════════════════════════════════════════════════════════
    // EVENT SYSTEM
    // ═══════════════════════════════════════════════════════════

    /**
     * Subscribe to events
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);

        // Return unsubscribe function
        return () => {
            const listeners = this.eventListeners.get(event);
            if (listeners) {
                const index = listeners.indexOf(callback);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            }
        };
    }

    /**
     * Emit event
     */
    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`🎙️ Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Dispose recorder
     */
    dispose() {
        this.cleanup();
        this.eventListeners.clear();
        console.log('🎙️ AudioRecorder disposed');
    }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════

let _audioRecorderInstance = null;

/**
 * Get singleton AudioRecorder instance
 */
export function getAudioRecorder() {
    if (!_audioRecorderInstance) {
        _audioRecorderInstance = new AudioRecorder();
    }
    return _audioRecorderInstance;
}

export default AudioRecorder;
