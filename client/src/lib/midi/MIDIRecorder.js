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
    constructor(playbackStore, arrangementStore, timelineStore, loopRegion = null) {
        this.playbackStore = playbackStore;
        this.arrangementStore = arrangementStore;
        this.timelineStore = timelineStore;
        this.midiDeviceManager = getMIDIDeviceManager();
        this.loopRegion = loopRegion; // { start: step, end: step } or null

        this.state = {
            isRecording: false,
            recordMode: RECORD_MODE.REPLACE,
            quantizeStrength: 0, // 0 = no quantize, 1 = full quantize
            countInBars: 0, // Bars of count-in before recording

            // Recording session state
            recordedNotes: new Map(), // noteId -> { pitch, velocity, startTime, endTime }
            recordStartTime: null,    // performance.now() when recording started
            recordStartStep: null,    // Step position when recording started
            pendingNotes: new Map(),  // pitch -> { noteId, startTime, velocity }

            // Count-in state
            isCountingIn: false,
            countInStartTime: null,
            countInCallback: null
        };

        // Unsubscribe function
        this.unsubscribeMIDI = null;

        // Performance tracking
        this.stats = {
            notesRecorded: 0,
            recordingDuration: 0
        };
    }

    // ═══════════════════════════════════════════════════════════
    // RECORDING CONTROL
    // ═══════════════════════════════════════════════════════════

    /**
     * Start recording
     */
    startRecording(options = {}) {
        if (this.state.isRecording) {
            console.warn('🎙 Already recording');
            return false;
        }

        // Update options
        this.state.recordMode = options.mode || RECORD_MODE.REPLACE;
        this.state.quantizeStrength = options.quantizeStrength ?? 0;
        this.state.countInBars = options.countInBars ?? 0;

        console.log('🎙 Starting recording...', {
            mode: this.state.recordMode,
            quantize: `${Math.round(this.state.quantizeStrength * 100)}%`,
            countIn: this.state.countInBars
        });

        // Count-in handling
        if (this.state.countInBars > 0) {
            this.startCountIn(() => {
                this.beginRecording();
            });
        } else {
            this.beginRecording();
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

        const bpm = this.timelineStore.getTempoAt(this.playbackStore.currentStep);
        const msPerBar = (60000 / bpm) * 4; // 4 beats per bar
        const countInDuration = msPerBar * this.state.countInBars;

        console.log(`🎵 Count-in: ${this.state.countInBars} bars (${Math.round(countInDuration)}ms)`);

        // Start metronome clicks (optional - could emit events for UI feedback)
        // For now, just wait
        setTimeout(() => {
            this.state.isCountingIn = false;
            if (this.state.countInCallback) {
                this.state.countInCallback();
                this.state.countInCallback = null;
            }
        }, countInDuration);
    }

    /**
     * Begin actual recording (after count-in)
     */
    beginRecording() {
        this.state.isRecording = true;
        this.state.recordStartTime = performance.now();
        this.state.recordStartStep = this.playbackStore.currentStep;
        this.state.recordedNotes.clear();
        this.state.pendingNotes.clear();

        // Subscribe to MIDI events
        this.unsubscribeMIDI = this.midiDeviceManager.subscribe((midiEvent) => {
            this.handleMIDIEvent(midiEvent);
        });

        // Clear existing notes in replace mode
        if (this.state.recordMode === RECORD_MODE.REPLACE) {
            this.clearNotesInRegion();
        }

        console.log('🔴 Recording started at step', this.state.recordStartStep);
    }

    /**
     * Stop recording
     */
    stopRecording() {
        if (!this.state.isRecording) {
            console.warn('🎙 Not recording');
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

        console.log('⏹ Recording stopped', {
            notes: this.stats.notesRecorded,
            duration: `${Math.round(this.stats.recordingDuration / 1000)}s`
        });

        // Clear state
        this.state.recordStartTime = null;
        this.state.recordStartStep = null;
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

        // Calculate step position
        const elapsedMs = timestamp - this.state.recordStartTime;
        let currentStep = this.state.recordStartStep + this.msToSteps(elapsedMs);

        // Loop mode: Wrap step position within loop region
        if (this.state.recordMode === RECORD_MODE.LOOP && this.loopRegion) {
            const loopStart = this.loopRegion.start;
            const loopEnd = this.loopRegion.end;
            const loopLength = loopEnd - loopStart;
            
            if (loopLength > 0) {
                // Calculate position relative to loop start
                const relativeStep = currentStep - loopStart;
                // Wrap within loop region
                currentStep = loopStart + (relativeStep % loopLength);
            }
        }

        // Apply quantization
        const quantizedStep = this.quantizeStep(currentStep, this.state.quantizeStrength);

        if (type === 'noteOn' && velocity > 0) {
            // Note On
            this.handleNoteOn(note, velocity, quantizedStep, timestamp);
        } else {
            // Note Off (or Note On with velocity 0)
            this.handleNoteOff(note, quantizedStep, timestamp);
        }
    }

    /**
     * Handle Note On event
     */
    handleNoteOn(pitch, velocity, step, timestamp) {
        const noteId = `recorded_${Date.now()}_${pitch}`;

        // Store in pending notes (waiting for Note Off)
        this.state.pendingNotes.set(pitch, {
            noteId,
            pitch,
            velocity,
            startTime: step,
            startTimestamp: timestamp
        });

        console.log(`🎹 Note On: ${this.pitchToName(pitch)} (${pitch}) vel=${velocity} step=${Math.round(step)}`);
    }

    /**
     * Handle Note Off event
     */
    handleNoteOff(pitch, step, timestamp) {
        const pendingNote = this.state.pendingNotes.get(pitch);

        if (!pendingNote) {
            console.warn(`🎹 Note Off without Note On: ${pitch}`);
            return;
        }

        // Calculate note length
        const length = Math.max(0.25, step - pendingNote.startTime); // Min 1/16 note

        // Create complete note
        const note = {
            id: pendingNote.noteId,
            pitch: pendingNote.pitch,
            velocity: pendingNote.velocity,
            startTime: pendingNote.startTime,
            length,
            visualLength: length,
            isMuted: false
        };

        // Add to recorded notes
        this.state.recordedNotes.set(note.id, note);

        // Remove from pending
        this.state.pendingNotes.delete(pitch);

        // Add to arrangement store
        const activePatternId = this.arrangementStore.activePatternId;
        const activeInstrumentId = this.arrangementStore.activeInstrumentId;

        if (activePatternId && activeInstrumentId) {
            // Get existing notes and add new note
            const pattern = this.arrangementStore.patterns[activePatternId];
            const existingNotes = pattern?.data?.[activeInstrumentId] || [];
            const updatedNotes = [...existingNotes, note];
            
            this.arrangementStore.updatePatternNotes(activePatternId, activeInstrumentId, updatedNotes);
            console.log(`✅ Recorded: ${this.pitchToName(pitch)} len=${length.toFixed(2)}`);
        }
    }

    /**
     * Finalize pending notes (notes without Note Off)
     */
    finalizePendingNotes() {
        const currentStep = this.playbackStore.currentStep;

        for (const [pitch, pendingNote] of this.state.pendingNotes) {
            const length = Math.max(0.25, currentStep - pendingNote.startTime);

            const note = {
                id: pendingNote.noteId,
                pitch: pendingNote.pitch,
                velocity: pendingNote.velocity,
                startTime: pendingNote.startTime,
                length,
                visualLength: length,
                isMuted: false
            };

            this.state.recordedNotes.set(note.id, note);

            // Add to arrangement store
            const activePatternId = this.arrangementStore.activePatternId;
            const activeInstrumentId = this.arrangementStore.activeInstrumentId;

            if (activePatternId && activeInstrumentId) {
                // Get existing notes and add new note
                const pattern = this.arrangementStore.patterns[activePatternId];
                const existingNotes = pattern?.data?.[activeInstrumentId] || [];
                const updatedNotes = [...existingNotes, note];
                
                this.arrangementStore.updatePatternNotes(activePatternId, activeInstrumentId, updatedNotes);
                console.log(`✅ Finalized: ${this.pitchToName(pitch)} (no Note Off)`);
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
     * Clear notes in recording region (for replace mode)
     */
    clearNotesInRegion() {
        const activePatternId = this.arrangementStore.activePatternId;
        const activeInstrumentId = this.arrangementStore.activeInstrumentId;

        if (!activePatternId || !activeInstrumentId) {
            console.warn('⚠️ No active pattern or instrument for clearing notes');
            return;
        }

        const pattern = this.arrangementStore.patterns[activePatternId];
        if (!pattern) {
            console.warn('⚠️ Pattern not found:', activePatternId);
            return;
        }

        const existingNotes = pattern.data?.[activeInstrumentId] || [];
        
        // Determine recording region
        let regionStart = this.state.recordStartStep;
        let regionEnd = null;

        if (this.loopRegion && this.loopRegion.start !== undefined && this.loopRegion.end !== undefined) {
            // Use loop region if available
            regionStart = this.loopRegion.start;
            regionEnd = this.loopRegion.end;
        } else {
            // If no loop region, clear from record start to end of pattern (or a reasonable default)
            // For now, we'll clear from record start to a large number (pattern end)
            regionEnd = Infinity; // Will be limited by existing notes
        }

        // Filter out notes that overlap with the recording region
        const filteredNotes = existingNotes.filter(note => {
            const noteStart = note.startTime;
            const noteEnd = note.startTime + (note.visualLength !== undefined ? note.visualLength : note.length);
            
            // Remove note if it overlaps with recording region
            return !(noteStart < regionEnd && noteEnd > regionStart);
        });

        // Update pattern notes
        this.arrangementStore.updatePatternNotes(activePatternId, activeInstrumentId, filteredNotes);
        console.log(`🧹 Replace mode: Cleared ${existingNotes.length - filteredNotes.length} notes in region`);
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

        console.log('🎙 MIDI Recorder destroyed');
    }
}

export default MIDIRecorder;
