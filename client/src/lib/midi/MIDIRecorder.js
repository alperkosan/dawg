/**
 * MIDIRecorder - Real-time MIDI Recording
 *
 * Features:
 * - Replace/Overdub/Loop modes
 * - Real-time quantization (0-100% strength)
 * - Count-in support
 * - Note duration tracking
 * - Integration with arrangement store
 *
 * Architecture:
 * - Event-driven
 * - Performance optimized
 * - Undo/redo support
 */

import { getMIDIDeviceManager, MIDI_MESSAGE_TYPE } from './MIDIDeviceManager';
import { Metronome } from '@/lib/audio/Metronome.js';
import { AudioContextService } from '../services/AudioContextService';
import { InstrumentService } from '../services/InstrumentService';
import { AudioEngineGlobal } from '@/lib/core/AudioEngineGlobal';
import { STEPS_PER_BEAT } from '@/lib/audio/audioRenderConfig.js';

import { useArrangementStore } from '@/store/useArrangementStore';

// ═══════════════════════════════════════════════════════════
// STRUCTURED LOGGING SYSTEM
// ═══════════════════════════════════════════════════════════

const LOG_CONFIG = {
    enabled: true,           // Master switch for all logs
    categories: {
        SESSION: true,       // Recording session start/stop
        NOTE: true,          // Note on/off events  
        SYNC: true,          // Position/timing sync checks
        WARN: true,          // Warnings and potential issues
    },
    // Log level: 'minimal' | 'normal' | 'verbose'
    level: 'normal'
};

/**
 * Structured logger for MIDI recording
 * Provides consistent format for debugging timing issues
 */
const MIDILog = {
    _formatTime(steps) {
        const beats = steps / STEPS_PER_BEAT;
        const bar = Math.floor(beats / 4) + 1;
        const beat = (Math.floor(beats) % 4) + 1;
        const tick = Math.round((beats % 1) * 480);
        return `${bar}:${beat}:${String(tick).padStart(3, '0')}`;
    },

    _formatSteps(steps) {
        return `${steps.toFixed(1)}st`;
    },

    _formatBeats(beats) {
        return `${beats.toFixed(3)}b`;
    },

    session(action, data) {
        if (!LOG_CONFIG.enabled || !LOG_CONFIG.categories.SESSION) return;
        const prefix = action === 'START' ? '🔴' : action === 'STOP' ? '⏹️' : '📍';
        console.log(`${prefix} [REC:${action}]`, data);
    },

    note(type, data) {
        if (!LOG_CONFIG.enabled || !LOG_CONFIG.categories.NOTE) return;
        const prefix = type === 'ON' ? '🎹→' : '🎹←';
        const { pitch, pitchName, step, beats, velocity, duration } = data;

        if (type === 'ON') {
            console.log(
                `${prefix} [NOTE:${type}] ${pitchName} (${pitch}) | pos: ${this._formatTime(step)} (${this._formatSteps(step)}) | vel: ${velocity}`
            );
        } else {
            console.log(
                `${prefix} [NOTE:${type}] ${pitchName} (${pitch}) | pos: ${this._formatTime(step)} (${this._formatSteps(step)}) | dur: ${this._formatBeats(duration)}`
            );
        }
    },

    sync(data) {
        if (!LOG_CONFIG.enabled || !LOG_CONFIG.categories.SYNC) return;
        if (LOG_CONFIG.level === 'minimal') return;

        const { calculated, actual, diff, source, bpm } = data;
        const bpmInfo = bpm ? ` | bpm: ${bpm}` : '';
        const transportInfo = actual !== null ? ` | transport: ${this._formatSteps(actual)}` : '';
        const driftInfo = diff !== null && diff > 0.5 ? ` | ⚠️drift: ${diff.toFixed(1)}st` : '';

        console.log(
            `🔍 [SYNC:✓] pos: ${this._formatSteps(calculated)}${transportInfo}${driftInfo} | ${source}${bpmInfo}`
        );
    },

    warn(message, data = null) {
        if (!LOG_CONFIG.enabled || !LOG_CONFIG.categories.WARN) return;
        console.warn(`⚠️ [MIDI:WARN] ${message}`, data || '');
    },

    // Tutarsızlık raporu - Recording bittiğinde özet
    report(stats) {
        if (!LOG_CONFIG.enabled) return;
        console.log('═══════════════════════════════════════════════');
        console.log('📊 [MIDI:REPORT] Recording Summary');
        console.log(`   Notes: ${stats.notesRecorded} | Duration: ${(stats.recordingDuration / 1000).toFixed(1)}s`);
        console.log(`   Sync issues: ${stats.syncIssues || 0}`);
        console.log('═══════════════════════════════════════════════');
    }
};

// ═══════════════════════════════════════════════════════════
// BBT UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Convert steps to BBT format (Bar:Beat:Tick)
 * @param {number} steps - Position in steps
 * @param {number} stepsPerBeat - Steps per beat (default: STEPS_PER_BEAT)
 * @returns {string} BBT format string (e.g., "1:2:120")
 */
function stepsToBBT(steps, stepsPerBeat = STEPS_PER_BEAT) {
    const beats = steps / stepsPerBeat;
    const bar = Math.floor(beats / 4) + 1; // 4/4 time signature
    const beat = (Math.floor(beats) % 4) + 1;
    const tick = Math.floor((beats % 1) * 480); // 480 ticks per beat (PPQ * 4)
    return `${bar}:${beat}:${tick}`;
}

// ═══════════════════════════════════════════════════════════
// RECORDING MODES
// ═══════════════════════════════════════════════════════════

export const RECORD_MODE = {
    REPLACE: 'replace',     // Clear existing notes in region
    OVERDUB: 'overdub',     // Keep existing notes, add new ones
    LOOP: 'loop'            // Loop recording with overdub
};

// ═══════════════════════════════════════════════════════════
// MIDI RECORDER
// ═══════════════════════════════════════════════════════════

export class MIDIRecorder {
    constructor(playbackStore, arrangementStore, timelineStore, loopRegion = null, activeInstrumentId = null) {
        this.playbackStore = playbackStore;
        this.arrangementStore = arrangementStore;
        this.timelineStore = timelineStore;
        this.midiDeviceManager = getMIDIDeviceManager();
        this.loopRegion = loopRegion; // { start: step, end: step } or null
        this.activeInstrumentId = activeInstrumentId; // ✅ Store active instrument ID

        this.state = {
            isRecording: false,
            recordMode: RECORD_MODE.REPLACE,
            quantizeStrength: 0, // 0 = no quantize, 1 = full quantize
            countInBars: 0, // Bars of count-in before recording

            // Recording session state
            recordedNotes: new Map(), // noteId -> { pitch, velocity, startTime, endTime }
            recordStartTime: null,    // performance.now() when recording started
            recordStartStep: null,    // Step position when recording started
            recordingBPM: null,       // BPM captured at recording start (authoritative)
            pendingNotes: new Map(),  // pitch -> { noteId, startTime, velocity }

            // Live note update loop
            liveUpdateInterval: null,  // Interval ID for updating note lengths while keys are held

            // Count-in state
            isCountingIn: false,
            countInStartTime: null,
            countInCallback: null,

            // Loop state backup (to restore after recording)
            loopEnabledBeforeRecording: null
        };

        // Unsubscribe function
        this.unsubscribeMIDI = null;

        // Performance tracking
        this.stats = {
            notesRecorded: 0,
            recordingDuration: 0,
            syncIssues: 0  // Count of position sync mismatches > 2 steps
        };

        // ✅ Metronome for count-in
        this.metronome = null;
        this.countInBeatCount = 0;
    }

    // ═══════════════════════════════════════════════════════════
    // RECORDING CONTROL
    // ═══════════════════════════════════════════════════════════

    /**
     * Start recording
     */
    async startRecording(options = {}) {
        if (this.state.isRecording) {
            MIDILog.warn('Already recording - ignoring start request');
            return false;
        }

        // Update options
        this.state.recordMode = options.mode || RECORD_MODE.REPLACE;
        this.state.quantizeStrength = options.quantizeStrength ?? 0;
        this.state.countInBars = options.countInBars ?? 0;

        // Reset sync issue counter
        this.stats.syncIssues = 0;

        // Capture playhead position from PlaybackManager (not store)
        let initialPlayheadStep = 0;
        let positionSource = 'store';

        try {
            const audioEngine = AudioEngineGlobal.get();

            if (this.playbackStore.isPlaying && audioEngine?.playbackManager) {
                initialPlayheadStep = audioEngine.playbackManager.getCurrentPosition();
                if (initialPlayheadStep === null || initialPlayheadStep === undefined || isNaN(initialPlayheadStep)) {
                    initialPlayheadStep = audioEngine.playbackManager.currentPosition || 0;
                }
                positionSource = 'playbackManager.live';
            } else if (audioEngine?.playbackManager) {
                initialPlayheadStep = audioEngine.playbackManager.currentPosition || 0;
                positionSource = 'playbackManager.stored';
            } else {
                initialPlayheadStep = this.playbackStore.currentStep || 0;
                positionSource = 'store.fallback';
            }

            // Validate position
            if (initialPlayheadStep < 0 || isNaN(initialPlayheadStep) || !isFinite(initialPlayheadStep)) {
                MIDILog.warn(`Invalid initial position: ${initialPlayheadStep}, using 0`);
                initialPlayheadStep = 0;
            }
        } catch (e) {
            MIDILog.warn('Could not get initial playhead position', e);
            initialPlayheadStep = this.playbackStore.currentStep || 0;
        }

        // ✅ Store initial position - this will be used as recordStartStep
        this.state.initialPlayheadStep = initialPlayheadStep;

        // ✅ Emit count-in start event
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('midi:countInStart', {
                detail: { countInBars: this.state.countInBars }
            }));
        }

        // Count-in handling
        if (this.state.countInBars > 0) {
            this.startCountIn(async () => {
                // ✅ Emit count-in end event
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('midi:countInEnd'));
                }
                await this.beginRecording();
                // ✅ Emit recording start event
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('midi:recordingStart'));
                }
            });
        } else {
            await this.beginRecording();
            // ✅ Emit recording start event
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('midi:recordingStart'));
            }
        }

        return true;
    }

    /**
     * Start count-in metronome
     */
    startCountIn(callback) {
        this.state.isCountingIn = true;
        this.state.countInStartTime = performance.now();
        this.state.countInCallback = callback;

        // Get BPM from Transport (Tone.js) - the authoritative source
        let bpm = 120; // Default
        try {
            const audioEngine = AudioEngineGlobal.get();
            if (audioEngine?.transport?.bpm?.value) {
                bpm = audioEngine.transport.bpm.value;
            }
        } catch (e) {
            bpm = this.playbackStore?.bpm || 120;
        }
        const msPerBar = (60000 / bpm) * 4; // 4 beats per bar
        const countInDuration = msPerBar * this.state.countInBars;

        MIDILog.session('COUNT_IN', { bars: this.state.countInBars, durationMs: Math.round(countInDuration), bpm });

        // ✅ Initialize metronome
        const audioEngine = AudioEngineGlobal.get();
        if (audioEngine?.audioContext) {
            this.metronome = new Metronome(audioEngine.audioContext);
            this.metronome.initialize();
            this.countInBeatCount = 0;

            // Start metronome with beat callbacks
            this.metronome.start(bpm, 4, (beatCount, isDownbeat) => {
                this.countInBeatCount = beatCount;
                // Emit event for UI updates
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('midi:countInBeat', {
                        detail: { beatCount, isDownbeat, barsRemaining: Math.ceil((this.state.countInBars * 4 - beatCount) / 4) }
                    }));
                }
            });
        }

        // Stop metronome and call callback after count-in duration
        setTimeout(() => {
            if (this.metronome) {
                this.metronome.stop();
                this.metronome = null;
            }
            this.state.isCountingIn = false;
            this.countInBeatCount = 0;
            if (this.state.countInCallback) {
                this.state.countInCallback();
                this.state.countInCallback = null;
            }
        }, countInDuration);
    }

    /**
     * Begin actual recording (after count-in)
     */
    async beginRecording() {
        this.state.isRecording = true;
        this.state.recordStartTime = performance.now();
        this.state.recordedNotes.clear();
        this.state.pendingNotes.clear();

        // Store AudioContext and get BPM from Transport (the authoritative source)
        try {
            const audioEngine = AudioEngineGlobal.get();
            if (audioEngine?.audioContext) {
                this.state.audioContext = audioEngine.audioContext;
            }
            // ✅ CRITICAL FIX: Get BPM from Transport (Tone.js), not timelineStore
            // Transport.bpm is what actually controls playback speed
            if (audioEngine?.transport?.bpm?.value) {
                this.state.recordingBPM = audioEngine.transport.bpm.value;
            } else {
                // Fallback to playbackStore or default
                this.state.recordingBPM = this.playbackStore?.bpm || 120;
            }
        } catch (e) {
            MIDILog.warn('Could not get AudioContext/BPM for recording', e);
            this.state.recordingBPM = 120; // Safe default
        }

        // Disable loop during recording (save current state to restore later)
        const currentLoopEnabled = this.playbackStore.loopEnabled;
        this.state.loopEnabledBeforeRecording = currentLoopEnabled;
        if (currentLoopEnabled) {
            await this.playbackStore.setLoopEnabled(false);
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Start playback if not already playing
        const wasAlreadyPlaying = this.playbackStore.isPlaying;
        if (!wasAlreadyPlaying) {
            // Note: We don't jump to initialPlayheadStep because PlaybackController 
            // always starts from 0. We'll use the actual position after playback starts.
            await this.playbackStore.togglePlayPause();
            // Wait for transport to actually start and position to stabilize
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Get AudioContext time and ACTUAL position AFTER playback starts
        let actualStartAudioTime = null;
        let actualRecordStartStep = 0; // Default to 0, will be updated from actual position

        try {
            const audioEngine = AudioEngineGlobal.get();
            if (audioEngine?.audioContext) {
                actualStartAudioTime = audioEngine.audioContext.currentTime;
                this.state.recordStartAudioTime = actualStartAudioTime;

                // ✅ CRITICAL FIX: Get the ACTUAL playback position from transport
                // This is the real position after playback has started
                if (audioEngine?.playbackManager) {
                    const actualPosAtStart = audioEngine.playbackManager.getCurrentPosition();
                    if (actualPosAtStart !== null && actualPosAtStart !== undefined && !isNaN(actualPosAtStart) && actualPosAtStart >= 0) {
                        actualRecordStartStep = actualPosAtStart;
                    }

                    // Debug: Log position sources for troubleshooting
                    MIDILog.session('POSITION_DEBUG', {
                        initialPlayhead: initialPlayheadStep.toFixed(2),
                        actualPosition: actualRecordStartStep.toFixed(2),
                        wasAlreadyPlaying,
                        transportTicks: audioEngine.playbackManager.transport?.ticks || 'N/A'
                    });
                }
            }
        } catch (e) {
            MIDILog.warn('Could not get AudioContext time', e);
        }

        // Set the REAL start step (from actual transport position)
        this.state.recordStartStep = actualRecordStartStep;

        // Log recording start with essential info
        MIDILog.session('START', {
            mode: this.state.recordMode,
            quantize: `${Math.round(this.state.quantizeStrength * 100)}%`,
            startStep: this.state.recordStartStep.toFixed(1),
            bpm: this.state.recordingBPM,
            loopDisabled: currentLoopEnabled
        });

        // ✅ Initialize MIDI device manager if needed
        if (!this.midiDeviceManager.state.isInitialized) {
            await this.midiDeviceManager.initialize();
        }

        // Subscribe to MIDI events
        this.unsubscribeMIDI = this.midiDeviceManager.subscribe((midiEvent) => {
            this.handleMIDIEvent(midiEvent);
        });
    }

    /**
     * Stop recording
     */
    async stopRecording() {
        if (!this.state.isRecording) {
            MIDILog.warn('Not recording - ignoring stop request');
            return false;
        }

        this.state.isRecording = false;

        // Unsubscribe from MIDI events
        if (this.unsubscribeMIDI) {
            this.unsubscribeMIDI();
            this.unsubscribeMIDI = null;
        }

        // Finalize any hanging notes (no Note Off received)
        this.finalizePendingNotes();

        // Calculate stats
        this.stats.recordingDuration = performance.now() - this.state.recordStartTime;
        this.stats.notesRecorded = this.state.recordedNotes.size;

        // Log recording summary
        MIDILog.session('STOP', {
            notes: this.stats.notesRecorded,
            duration: `${(this.stats.recordingDuration / 1000).toFixed(1)}s`,
            syncIssues: this.stats.syncIssues
        });
        MIDILog.report(this.stats);

        // Stop playback when recording stops
        if (this.playbackStore.isPlaying) {
            try {
                const transportController = AudioContextService.getTransportController();
                transportController.stop();
            } catch (error) {
                MIDILog.warn('TransportController not available, using fallback');
                await this.playbackStore.handleStop();
            }
        }

        // Restore loop state if it was enabled before recording
        if (this.state.loopEnabledBeforeRecording !== null) {
            await this.playbackStore.setLoopEnabled(this.state.loopEnabledBeforeRecording);
            this.state.loopEnabledBeforeRecording = null;
        }

        // Stop live note update loop
        this.stopLiveNoteUpdateLoop();

        // Stop all pending note previews
        this.state.pendingNotes.forEach((pendingNote) => {
            this.previewNoteOff(pendingNote.pitch);
        });

        // Clear state
        this.state.recordStartTime = null;
        this.state.recordStartStep = null;
        this.state.recordStartAudioTime = null;
        this.state.pendingNotes.clear();

        return true;
    }

    // ═══════════════════════════════════════════════════════════
    // MIDI EVENT HANDLING
    // ═══════════════════════════════════════════════════════════

    /**
     * Handle MIDI event during recording
     */
    handleMIDIEvent(midiEvent) {
        if (!this.state.isRecording) return;

        const { type, note, velocity, timestamp } = midiEvent;

        // Only handle note events
        if (type !== 'noteOn' && type !== 'noteOff') return;

        // ✅ AUDIOCONTEXT-BASED TIMING: Most reliable approach
        // Transport position can jump unexpectedly, but AudioContext timing is consistent
        let currentStep;
        let positionSource = 'audioContext';
        let transportStep = null; // For debug comparison only

        try {
            const audioEngine = AudioEngineGlobal.get();
            const currentAudioTime = this.state.audioContext?.currentTime;
            const recordStartAudioTime = this.state.recordStartAudioTime;
            const recordStartStep = this.state.recordStartStep || 0;
            const bpm = this.state.recordingBPM || 120;

            // Get transport position for debug comparison
            if (audioEngine?.playbackManager) {
                transportStep = audioEngine.playbackManager.getCurrentPosition();
            }

            if (currentAudioTime && recordStartAudioTime) {
                // ✅ RELIABLE CALCULATION: Elapsed time from AudioContext
                // AudioContext.currentTime is monotonic and consistent
                const elapsedSeconds = currentAudioTime - recordStartAudioTime;
                const elapsedBeats = (elapsedSeconds * bpm) / 60;
                const elapsedSteps = elapsedBeats * STEPS_PER_BEAT;

                currentStep = recordStartStep + elapsedSteps;
                positionSource = 'audioContext';
            } else {
                // Fallback: Use transport if AudioContext unavailable
                if (transportStep !== null && !isNaN(transportStep)) {
                    currentStep = transportStep;
                    positionSource = 'transport.fallback';
                } else {
                    // Ultimate fallback: Use performance.now()
                    const elapsedMs = performance.now() - this.state.recordStartTime;
                    const elapsedSeconds = elapsedMs / 1000;
                    const elapsedBeats = (elapsedSeconds * bpm) / 60;
                    currentStep = recordStartStep + (elapsedBeats * STEPS_PER_BEAT);
                    positionSource = 'performance.fallback';
                }
            }
        } catch (e) {
            // Error fallback
            const bpm = this.state.recordingBPM || 120;
            const elapsedMs = performance.now() - this.state.recordStartTime;
            const elapsedSeconds = elapsedMs / 1000;
            const elapsedBeats = (elapsedSeconds * bpm) / 60;
            currentStep = (this.state.recordStartStep || 0) + (elapsedBeats * STEPS_PER_BEAT);
            positionSource = 'error.fallback';
        }

        // Validate position
        if (currentStep < 0 || isNaN(currentStep) || !isFinite(currentStep)) {
            MIDILog.warn(`Invalid step position: ${currentStep}`);
            currentStep = 0;
        }

        // Apply quantization
        const quantizedStep = this.quantizeStep(currentStep, this.state.quantizeStrength);

        // Log sync check (compare AudioContext-based position with transport for verification)
        MIDILog.sync({
            calculated: currentStep,
            actual: transportStep,
            diff: transportStep !== null ? Math.abs(currentStep - transportStep) : null,
            rawDiff: null,
            source: positionSource,
            bpm: this.state.recordingBPM,
            wrapped: 0,
            patternLen: 0
        });

        if (type === 'noteOn' && velocity > 0) {
            this.handleNoteOn(note, velocity, quantizedStep, timestamp);
        } else {
            this.handleNoteOff(note, quantizedStep, timestamp);
        }
    }

    /**
     * Handle Note On event
     */
    handleNoteOn(pitch, velocity, step, timestamp) {
        const noteId = `recorded_${Date.now()}_${pitch}_${Math.random().toString(36).substr(2, 9)}`;

        // Validate step
        if (step < 0 || isNaN(step) || !isFinite(step)) {
            MIDILog.warn(`Invalid step in handleNoteOn: ${step}`);
            step = 0;
        }
        // CRITICAL: Piano roll expects startTime in STEPS, not beats!
        const startTimeSteps = step;

        // Get AudioContext time for accurate duration calculation
        const actualAudioTime = this.state.audioContext?.currentTime || timestamp;

        // Get actual playhead for comparison
        let actualPlayhead = null;
        try {
            const audioEngine = AudioEngineGlobal.get();
            if (audioEngine?.playbackManager) {
                actualPlayhead = audioEngine.playbackManager.currentPosition;
            }
        } catch (e) { }

        // Store in pending notes (waiting for Note Off)
        // CRITICAL: startTime must be in STEPS (piano roll coordinate system)
        this.state.pendingNotes.set(pitch, {
            noteId,
            pitch,
            velocity,
            startTime: startTimeSteps,  // In STEPS (not beats!)
            startTimeSteps: step,
            startTimestamp: timestamp,
            startKeyboardTime: actualAudioTime,
            startActualPlayhead: actualPlayhead
        });

        // Log note on event
        MIDILog.note('ON', {
            pitch,
            pitchName: this.pitchToName(pitch),
            step,
            beats: step / STEPS_PER_BEAT,  // Calculate beats for logging only
            velocity
        });

        // ✅ LIVE DRAWING: Add note to pattern immediately with minimum length
        // This allows the user to see the note as they press the key
        this.addLiveNote(noteId, pitch, velocity, startTimeSteps);

        // ✅ AUDIO PREVIEW: Play the note sound while recording
        this.previewNoteOn(pitch, velocity);
    }

    /**
     * Play note preview sound (called on Note On during recording)
     */
    previewNoteOn(pitch, velocity) {
        try {
            // Get active instrument ID
            let activeInstrumentId = this.activeInstrumentId;
            if (!activeInstrumentId) {
                if (typeof window !== 'undefined' && window.usePanelsStore) {
                    const panelsStore = window.usePanelsStore.getState();
                    activeInstrumentId = panelsStore.pianoRollInstrumentId;
                }
            }
            if (!activeInstrumentId) {
                const freshState = useArrangementStore.getState();
                const instruments = freshState.instruments || [];
                if (instruments.length > 0) {
                    activeInstrumentId = instruments[0].id;
                }
            }

            if (activeInstrumentId) {
                // Convert velocity (0-127) to normalized (0-1)
                const normalizedVelocity = velocity / 127;
                InstrumentService.auditionNoteOn(activeInstrumentId, pitch, normalizedVelocity);
            }
        } catch (e) {
            // Preview is optional, don't fail recording if preview fails
        }
    }

    /**
     * Stop note preview sound (called on Note Off during recording)
     */
    previewNoteOff(pitch) {
        try {
            // Get active instrument ID
            let activeInstrumentId = this.activeInstrumentId;
            if (!activeInstrumentId) {
                if (typeof window !== 'undefined' && window.usePanelsStore) {
                    const panelsStore = window.usePanelsStore.getState();
                    activeInstrumentId = panelsStore.pianoRollInstrumentId;
                }
            }
            if (!activeInstrumentId) {
                const freshState = useArrangementStore.getState();
                const instruments = freshState.instruments || [];
                if (instruments.length > 0) {
                    activeInstrumentId = instruments[0].id;
                }
            }

            if (activeInstrumentId) {
                AudioContextService.auditionNoteOff(activeInstrumentId, pitch);
            }
        } catch (e) {
            // Preview is optional, don't fail recording if preview fails
        }
    }

    /**
     * Add a note to the pattern for live drawing (called on Note On)
     * The note will be updated with correct duration on Note Off
     */
    addLiveNote(noteId, pitch, velocity, startTimeSteps) {
        const pitchToString = (midiPitch) => {
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const octave = Math.floor(midiPitch / 12) - 1;
            const noteName = noteNames[midiPitch % 12];
            return `${noteName}${octave}`;
        };

        // Create note with minimum length (will be updated on Note Off)
        const note = {
            id: noteId,
            time: startTimeSteps,  // In STEPS
            pitch: pitchToString(pitch),
            velocity: velocity,
            duration: '16n',  // Minimum duration
            length: 1,  // 1 step minimum (will be updated)
            visualLength: 1,
            isMuted: false,
            isLive: true  // Mark as live note (being recorded)
        };

        // Add to arrangement store
        const freshState = useArrangementStore.getState();
        const activePatternId = freshState.activePatternId;

        let activeInstrumentId = this.activeInstrumentId;
        if (!activeInstrumentId) {
            if (typeof window !== 'undefined' && window.usePanelsStore) {
                const panelsStore = window.usePanelsStore.getState();
                activeInstrumentId = panelsStore.pianoRollInstrumentId;
            }
        }
        if (!activeInstrumentId) {
            const instruments = freshState.instruments || [];
            if (instruments.length > 0) {
                activeInstrumentId = instruments[0].id;
            }
        }

        if (activePatternId && activeInstrumentId) {
            const freshStore = useArrangementStore.getState();
            const pattern = freshStore.patterns[activePatternId];
            if (pattern) {
                const existingNotes = pattern?.data?.[activeInstrumentId] || [];
                const updatedNotes = [...existingNotes, note];
                freshStore.updatePatternNotes(activePatternId, activeInstrumentId, updatedNotes);
            }
        }

        // Start live note update loop if not already running
        this.startLiveNoteUpdateLoop();
    }

    /**
     * Start the live note update loop
     * Updates pending notes' lengths in real-time as keys are held
     */
    startLiveNoteUpdateLoop() {
        // Don't start if already running
        if (this.state.liveUpdateInterval) return;

        // Update every ~50ms (20 FPS) for smooth visual feedback without performance issues
        this.state.liveUpdateInterval = setInterval(() => {
            this.updateLiveNotes();
        }, 50);
    }

    /**
     * Stop the live note update loop
     */
    stopLiveNoteUpdateLoop() {
        if (this.state.liveUpdateInterval) {
            clearInterval(this.state.liveUpdateInterval);
            this.state.liveUpdateInterval = null;
        }
    }

    /**
     * Update all pending notes' lengths based on current playback position
     * This creates the "growing note" effect while keys are held
     */
    updateLiveNotes() {
        if (!this.state.isRecording || this.state.pendingNotes.size === 0) {
            return;
        }

        // Calculate current position using AudioContext timing
        let currentStep = 0;
        try {
            const currentAudioTime = this.state.audioContext?.currentTime;
            const recordStartAudioTime = this.state.recordStartAudioTime;
            const recordStartStep = this.state.recordStartStep || 0;
            const bpm = this.state.recordingBPM || 120;

            if (currentAudioTime && recordStartAudioTime) {
                const elapsedSeconds = currentAudioTime - recordStartAudioTime;
                const elapsedBeats = (elapsedSeconds * bpm) / 60;
                const elapsedSteps = elapsedBeats * STEPS_PER_BEAT;
                currentStep = recordStartStep + elapsedSteps;
            }
        } catch (e) {
            return; // Skip this update if we can't get position
        }

        // Get active pattern and instrument
        const freshState = useArrangementStore.getState();
        const activePatternId = freshState.activePatternId;
        let activeInstrumentId = this.activeInstrumentId;

        if (!activeInstrumentId) {
            if (typeof window !== 'undefined' && window.usePanelsStore) {
                const panelsStore = window.usePanelsStore.getState();
                activeInstrumentId = panelsStore.pianoRollInstrumentId;
            }
        }
        if (!activeInstrumentId) {
            const instruments = freshState.instruments || [];
            if (instruments.length > 0) {
                activeInstrumentId = instruments[0].id;
            }
        }

        if (!activePatternId || !activeInstrumentId) return;

        const pattern = freshState.patterns[activePatternId];
        if (!pattern) return;

        let existingNotes = pattern?.data?.[activeInstrumentId] || [];
        let notesUpdated = false;

        // Update each pending note's length
        this.state.pendingNotes.forEach((pendingNote) => {
            const noteId = pendingNote.noteId;
            const startStep = pendingNote.startTimeSteps;
            const newLength = Math.max(1, currentStep - startStep);

            // Find and update the note in existingNotes
            existingNotes = existingNotes.map(note => {
                if (note.id === noteId) {
                    notesUpdated = true;
                    return {
                        ...note,
                        length: newLength,
                        visualLength: newLength
                    };
                }
                return note;
            });
        });

        // Only update store if notes were actually changed
        if (notesUpdated) {
            const freshStore = useArrangementStore.getState();
            freshStore.updatePatternNotes(activePatternId, activeInstrumentId, existingNotes);
        }
    }

    /**
     * Handle Note Off event
     */
    handleNoteOff(pitch, step, timestamp) {
        const pendingNote = this.state.pendingNotes.get(pitch);

        if (!pendingNote) {
            // This is expected if the key was pressed before recording started
            // Just ignore silently - no need to warn
            return;
        }

        // Calculate duration from actual key press time (AudioContext)
        const currentAudioTime = this.state.audioContext?.currentTime || timestamp;

        let actualDurationSteps = null;

        if (pendingNote.startKeyboardTime !== undefined && currentAudioTime !== undefined) {
            const durationSeconds = currentAudioTime - pendingNote.startKeyboardTime;
            // ✅ FIX: Use BPM captured at recording start (consistent)
            const bpm = this.state.recordingBPM || 120;
            const durationBeats = (durationSeconds * bpm / 60);
            actualDurationSteps = durationBeats * STEPS_PER_BEAT;

            // Minimum duration: 1 step (1/16 note)
            actualDurationSteps = Math.max(1, actualDurationSteps);
        }

        // Fallback: Calculate step-based length
        const endTimeSteps = step;
        const lengthSteps = Math.max(1, endTimeSteps - pendingNote.startTimeSteps);

        // Use actual duration if available, otherwise fallback to step-based
        // CRITICAL: Piano roll expects length in STEPS (not beats!)
        const finalDurationSteps = actualDurationSteps !== null ? actualDurationSteps : lengthSteps;

        // Create complete note - match PianoRollAddNoteCommand format
        const pitchToString = (midiPitch) => {
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const octave = Math.floor(midiPitch / 12) - 1;
            const noteName = noteNames[midiPitch % 12];
            return `${noteName}${octave}`;
        };

        // Convert steps to Tone.js duration string
        const lengthToDuration = (lengthSteps) => {
            // 1 beat = 4 steps, so:
            // 1n = whole note = 4 beats = 16 steps
            // 2n = half note = 2 beats = 8 steps
            // 4n = quarter note = 1 beat = 4 steps
            // 8n = eighth note = 0.5 beat = 2 steps
            // 16n = sixteenth note = 0.25 beat = 1 step
            if (lengthSteps >= 16) return '1n';
            if (lengthSteps >= 8) return '2n';
            if (lengthSteps >= 4) return '4n';
            if (lengthSteps >= 2) return '8n';
            return '16n';
        };

        const note = {
            id: pendingNote.noteId,
            time: pendingNote.startTime,  // In STEPS
            pitch: pitchToString(pendingNote.pitch),
            velocity: pendingNote.velocity,
            duration: lengthToDuration(finalDurationSteps),
            length: finalDurationSteps,  // In STEPS (not beats!)
            visualLength: finalDurationSteps,  // In STEPS
            isMuted: false
        };

        // Log note off event (show duration in beats for readability)
        MIDILog.note('OFF', {
            pitch: pendingNote.pitch,
            pitchName: this.pitchToName(pendingNote.pitch),
            step: endTimeSteps,
            beats: pendingNote.startTime / STEPS_PER_BEAT,  // Convert steps to beats for logging
            duration: finalDurationSteps / STEPS_PER_BEAT  // Show duration in beats
        });

        // Add to recorded notes
        this.state.recordedNotes.set(note.id, note);

        // ✅ AUDIO PREVIEW: Stop the note sound
        this.previewNoteOff(pendingNote.pitch);

        // Remove from pending
        this.state.pendingNotes.delete(pitch);

        // Stop live update loop if no more pending notes
        if (this.state.pendingNotes.size === 0) {
            this.stopLiveNoteUpdateLoop();
        }

        // Add to arrangement store
        const freshState = useArrangementStore.getState();
        const activePatternId = freshState.activePatternId;

        let activeInstrumentId = this.activeInstrumentId;

        if (!activeInstrumentId) {
            if (typeof window !== 'undefined' && window.usePanelsStore) {
                const panelsStore = window.usePanelsStore.getState();
                activeInstrumentId = panelsStore.pianoRollInstrumentId;
            }
        }

        if (!activeInstrumentId) {
            const instruments = freshState.instruments || [];
            if (instruments.length > 0) {
                activeInstrumentId = instruments[0].id;
            }
        }

        if (activePatternId && activeInstrumentId) {
            const freshStore = useArrangementStore.getState();
            const pattern = freshStore.patterns[activePatternId];
            if (!pattern) {
                MIDILog.warn('Pattern not found', { activePatternId });
                return;
            }

            let existingNotes = pattern?.data?.[activeInstrumentId] || [];

            // In REPLACE mode, clear notes in the recording region before adding first note
            if (this.state.recordMode === RECORD_MODE.REPLACE && this.state.recordedNotes.size === 0) {
                existingNotes = this.clearNotesInRegionForReplace(existingNotes);
            }

            // Filter out notes with same ID to prevent duplicates
            const filteredNotes = existingNotes.filter(n => n.id !== note.id);
            const updatedNotes = [...filteredNotes, note];

            freshStore.updatePatternNotes(activePatternId, activeInstrumentId, updatedNotes);
        } else {
            MIDILog.warn('Cannot record: missing pattern or instrument', { activePatternId, activeInstrumentId });
        }
    }

    /**
     * Finalize pending notes (notes without Note Off)
     */
    finalizePendingNotes() {
        if (this.state.pendingNotes.size === 0) return;

        // Use AudioContext.currentTime for accurate position calculation
        let currentStep;
        const bpm = this.state.recordingBPM || 120;

        if (this.state.audioContext && this.state.recordStartAudioTime !== undefined) {
            const currentAudioTime = this.state.audioContext.currentTime;
            const elapsedAudioTime = currentAudioTime - this.state.recordStartAudioTime;
            const elapsedSteps = (elapsedAudioTime * bpm / 60) * STEPS_PER_BEAT;
            currentStep = this.state.recordStartStep + elapsedSteps;
        } else {
            const now = performance.now();
            const elapsedMs = now - this.state.recordStartTime;
            currentStep = this.state.recordStartStep + this.msToSteps(elapsedMs);
        }

        MIDILog.warn(`Finalizing ${this.state.pendingNotes.size} pending notes (no Note Off received)`);

        for (const [pitch, pendingNote] of this.state.pendingNotes) {
            const lengthSteps = Math.max(1, currentStep - (pendingNote.startTimeSteps || pendingNote.startTime * STEPS_PER_BEAT));
            const lengthBeats = lengthSteps / STEPS_PER_BEAT;
            const minLengthBeats = 0.25 / STEPS_PER_BEAT;
            const length = Math.max(minLengthBeats, lengthBeats);

            const pitchToString = (midiPitch) => {
                const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                const octave = Math.floor(midiPitch / 12) - 1;
                const noteName = noteNames[midiPitch % 12];
                return `${noteName}${octave}`;
            };

            const lengthToDuration = (lengthBeats) => {
                if (lengthBeats >= 4) return '1n';
                if (lengthBeats >= 2) return '2n';
                if (lengthBeats >= 1) return '4n';
                if (lengthBeats >= 0.5) return '8n';
                return '16n';
            };

            const note = {
                id: pendingNote.noteId,
                time: pendingNote.startTime,
                pitch: pitchToString(pendingNote.pitch),
                velocity: pendingNote.velocity,
                duration: lengthToDuration(length),
                length,
                visualLength: length,
                isMuted: false
            };

            this.state.recordedNotes.set(note.id, note);

            const freshStore = useArrangementStore.getState();
            const activePatternId = freshStore.activePatternId;

            let activeInstrumentId = this.activeInstrumentId;

            if (!activeInstrumentId) {
                if (typeof window !== 'undefined' && window.usePanelsStore) {
                    const panelsStore = window.usePanelsStore.getState();
                    activeInstrumentId = panelsStore.pianoRollInstrumentId;
                }
            }

            if (!activeInstrumentId) {
                const instruments = freshStore.instruments || [];
                if (instruments.length > 0) {
                    activeInstrumentId = instruments[0].id;
                }
            }

            if (activePatternId && activeInstrumentId) {
                const pattern = freshStore.patterns[activePatternId];
                if (!pattern) {
                    MIDILog.warn('Pattern not found for finalization', { activePatternId });
                    continue;
                }

                const existingNotes = pattern?.data?.[activeInstrumentId] || [];
                const filteredNotes = existingNotes.filter(n => n.id !== note.id);
                const updatedNotes = [...filteredNotes, note];

                freshStore.updatePatternNotes(activePatternId, activeInstrumentId, updatedNotes);
            }
        }

        this.state.pendingNotes.clear();
    }

    // ═══════════════════════════════════════════════════════════
    // QUANTIZATION
    // ═══════════════════════════════════════════════════════════

    /**
     * Quantize step position
     */
    quantizeStep(step, strength) {
        if (strength <= 0) return step;

        const snapValue = this.arrangementStore.getSnapValue?.() || 1;
        const quantized = Math.round(step / snapValue) * snapValue;

        // Apply strength (interpolate between original and quantized)
        return step + (quantized - step) * strength;
    }

    // ═══════════════════════════════════════════════════════════
    // TIME CONVERSION
    // ═══════════════════════════════════════════════════════════

    /**
     * Convert milliseconds to steps
     */
    msToSteps(ms) {
        const bpm = this.timelineStore.getTempoAt(this.playbackStore.currentStep);
        const stepsPerSecond = (bpm / 60) * 4; // 4 steps per beat (16th note)
        return (ms / 1000) * stepsPerSecond;
    }

    /**
     * Convert steps to milliseconds
     */
    stepsToMs(steps) {
        const bpm = this.timelineStore.getTempoAt(this.playbackStore.currentStep);
        const stepsPerSecond = (bpm / 60) * 4;
        return (steps / stepsPerSecond) * 1000;
    }

    // ═══════════════════════════════════════════════════════════
    // UTILITIES
    // ═══════════════════════════════════════════════════════════

    /**
     * Clear notes in region for REPLACE mode (called when first note is recorded)
     * Returns filtered notes array without modifying store
     */
    clearNotesInRegionForReplace(existingNotes) {
        if (!existingNotes || existingNotes.length === 0) return existingNotes;

        const regionStartSteps = this.state.recordStartStep;
        const regionStartBeats = regionStartSteps / STEPS_PER_BEAT;

        const currentStep = this.playbackStore.currentStep || regionStartSteps;
        const regionEndSteps = currentStep + 64;
        const regionEndBeats = regionEndSteps / STEPS_PER_BEAT;

        const filteredNotes = existingNotes.filter(note => {
            const noteStart = note.startTime;
            const noteEnd = note.startTime + (note.visualLength !== undefined ? note.visualLength : note.length);
            return !(noteStart < regionEndBeats && noteEnd > regionStartBeats);
        });

        const clearedCount = existingNotes.length - filteredNotes.length;
        if (clearedCount > 0) {
            MIDILog.session('REPLACE_CLEAR', { clearedNotes: clearedCount, regionStart: regionStartBeats.toFixed(1), regionEnd: regionEndBeats.toFixed(1) });
        }
        return filteredNotes;
    }

    /**
     * Clear notes in recording region (for replace mode) - OLD METHOD
     */
    clearNotesInRegion() {
        const activePatternId = this.arrangementStore.activePatternId;

        let activeInstrumentId = this.activeInstrumentId;

        if (!activeInstrumentId) {
            if (typeof window !== 'undefined' && window.usePanelsStore) {
                const panelsStore = window.usePanelsStore.getState();
                activeInstrumentId = panelsStore.pianoRollInstrumentId;
            }
        }

        if (!activeInstrumentId) {
            const instruments = this.arrangementStore.instruments || [];
            if (instruments.length > 0) {
                activeInstrumentId = instruments[0].id;
            }
        }

        if (!activePatternId || !activeInstrumentId) {
            MIDILog.warn('No active pattern or instrument for clearing notes');
            return;
        }

        const pattern = this.arrangementStore.patterns[activePatternId];
        if (!pattern) {
            MIDILog.warn('Pattern not found', { activePatternId });
            return;
        }

        const existingNotes = pattern.data?.[activeInstrumentId] || [];

        let regionStart = this.state.recordStartStep;
        let regionEnd = null;

        if (this.loopRegion && this.loopRegion.start !== undefined && this.loopRegion.end !== undefined) {
            regionStart = this.loopRegion.start;
            regionEnd = this.loopRegion.end;
        } else {
            regionEnd = Infinity;
        }

        const filteredNotes = existingNotes.filter(note => {
            const noteStart = note.startTime;
            const noteEnd = note.startTime + (note.visualLength !== undefined ? note.visualLength : note.length);
            return !(noteStart < regionEnd && noteEnd > regionStart);
        });

        this.arrangementStore.updatePatternNotes(activePatternId, activeInstrumentId, filteredNotes);

        const clearedCount = existingNotes.length - filteredNotes.length;
        if (clearedCount > 0) {
            MIDILog.session('REPLACE_CLEAR', { clearedNotes: clearedCount });
        }
    }

    /**
     * Convert MIDI pitch to note name
     */
    pitchToName(pitch) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(pitch / 12) - 1;
        const note = noteNames[pitch % 12];
        return `${note}${octave}`;
    }

    /**
     * Get recording state
     */
    getState() {
        return {
            isRecording: this.state.isRecording,
            isCountingIn: this.state.isCountingIn,
            recordMode: this.state.recordMode,
            quantizeStrength: this.state.quantizeStrength,
            notesRecorded: this.state.recordedNotes.size,
            pendingNotes: this.state.pendingNotes.size
        };
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }

    // ═══════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════

    /**
     * Cleanup
     */
    destroy() {
        if (this.state.isRecording) {
            this.stopRecording();
        }

        this.state.recordedNotes.clear();
        this.state.pendingNotes.clear();
    }
}

export default MIDIRecorder;
