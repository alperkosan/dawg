/**
 * NoteScheduler - Pattern and Song Note Scheduling
 *
 * Responsibilities:
 * - Schedule note on/off events for instruments
 * - Handle note duration and timing
 * - Manage scheduled event cleanup
 *
 * Extracted from PlaybackManager for better modularity
 */

import { NativeTimeUtils } from '../../utils/NativeTimeUtils.js';
import { SampleAccurateTime } from '../utils/SampleAccurateTime.js'; // ✅ NEW: Sample-accurate timing
import { getAutomationManager } from '@/lib/automation/AutomationManager';
import { useArrangementStore } from '@/store/useArrangementStore';

export class NoteScheduler {
    constructor(transport, audioEngine) {
        this.transport = transport;
        this.audioEngine = audioEngine;

        // ✅ FIX 1: Instance-level active notes tracking for cross-batch overlap detection
        // Map: instrumentId -> Map<pitch, { startTime, endTime, note }>
        this.activeNotesByInstrument = new Map();
    }

    /**
     * Clear active notes for an instrument (called on loop restart or stop)
     * @param {string} instrumentId - Instrument ID (optional, clears all if not provided)
     */
    clearActiveNotes(instrumentId = null) {
        if (instrumentId) {
            this.activeNotesByInstrument.delete(instrumentId);
        } else {
            this.activeNotesByInstrument.clear();
        }
    }

    /**
     * Get active notes map for an instrument
     * @param {string} instrumentId - Instrument ID
     * @returns {Map} Active notes by pitch
     */
    getActiveNotes(instrumentId) {
        if (!this.activeNotesByInstrument.has(instrumentId)) {
            this.activeNotesByInstrument.set(instrumentId, new Map());
        }
        return this.activeNotesByInstrument.get(instrumentId);
    }

    /**
     * Schedule instrument notes from a pattern/clip
     *
     * @param {Object} instrument - Instrument instance
     * @param {Array} notes - Notes to schedule
     * @param {string} instrumentId - Instrument ID
     * @param {number} baseTime - Base time for scheduling
     * @param {string} clipId - Clip ID (for song mode)
     * @param {Object} options - Scheduling options
     * @param {number} options.currentPosition - Current playback position in steps
     * @param {number} options.loopStart - Loop start position in steps
     * @param {number} options.loopEnd - Loop end position in steps
     * @param {boolean} options.loopEnabled - Whether looping is enabled
     * @param {string} options.reason - Scheduling reason ('manual', 'resume', 'loop-restart', etc.)
     * @returns {Object} Scheduling statistics
     */
    scheduleInstrumentNotes(instrument, notes, instrumentId, baseTime, clipId = null, options = {}) {
        if (!instrument || !notes || notes.length === 0) {
            return { notesScheduled: 0, eventsScheduled: 0 };
        }

        let notesScheduled = 0;
        let eventsScheduled = 0;

        // ✅ NEW: Sort notes by start time to detect overlaps
        const sortedNotes = [...notes].sort((a, b) => {
            const timeA = a.startTime || a.time || 0;
            const timeB = b.startTime || b.time || 0;
            return timeA - timeB;
        });

        // ✅ FIX 1: Use instance-level active notes map for cross-batch overlap detection
        const activeNotesByPitch = this.getActiveNotes(instrumentId);

        // ✅ FIX 3: Loop-aware position calculation
        const {
            currentPosition = 0,
            loopStart = 0,
            loopEnd = 64,
            loopEnabled = true,
            reason = 'manual'
        } = options;

        // ✅ FIX 3: Determine current step based on reason and loop state
        const isResume = reason === 'resume';
        const isPositionJump = reason === 'position-jump';
        const isPlaybackStart = reason === 'playback-start';
        const isNoteModified = reason === 'note-modified';
        const isNoteAdded = reason === 'note-added';
        const isLoopRestart = reason === 'loop-restart';
        const shouldPreservePosition = isResume || isPositionJump || isPlaybackStart || isNoteModified || isNoteAdded;

        const loopLength = loopEnd - loopStart;
        const isLikelyLoopRestart = !shouldPreservePosition && loopEnabled && currentPosition >= loopEnd;

        // ✅ FIX: For loop-restart reason, always use 0 as current step
        const currentStep = isLoopRestart ? 0 : (isLikelyLoopRestart ? loopStart : currentPosition);
        const currentPositionInSeconds = currentStep * this.transport.stepsToSeconds(1);
        const loopTimeInSeconds = loopEnabled ? loopLength * this.transport.stepsToSeconds(1) : 0;

        console.log('🎵 [NOTE SCHEDULER] Position calculation:', {
            reason,
            currentPosition,
            loopStart,
            loopEnd,
            isLoopRestart,
            isLikelyLoopRestart,
            shouldPreservePosition,
            calculatedCurrentStep: currentStep,
            currentPositionInSeconds: currentPositionInSeconds.toFixed(3),
            transportCurrentTick: this.transport.currentTick,
            transportCurrentStep: this.transport.ticksToSteps(this.transport.currentTick)
        });

        sortedNotes.forEach(note => {
            // ✅ GHOST NOTES: Skip muted notes during playback
            if (note.isMuted) {
                return;
            }

            // Note timing calculation (support both startTime and time)
            const noteTimeInSteps = note.startTime || note.time || 0;
            const noteTimeInTicks = noteTimeInSteps * this.transport.ticksPerStep;
            const noteTimeInSeconds = noteTimeInTicks * this.transport.getSecondsPerTick();

            // ✅ FIX 3: Calculate relative time from current position (loop-aware)
            const relativeTime = noteTimeInSeconds - currentPositionInSeconds;
            let absoluteTimeRaw = baseTime + relativeTime;

            // ✅ FIX 4: Loop boundary tolerance
            // When loop restarts, currentPosition might be slightly > 0 (jitter).
            // This makes notes at exactly 0 appear "in the past" relative to baseTime.
            // We add a tolerance (e.g. 100ms) to play these "slightly late" notes immediately
            // instead of pushing them to the next loop iteration.
            const LOOP_BOUNDARY_TOLERANCE = 0.1;

            // ✅ FIX 3: Handle loop-aware scheduling with proper current position handling
            if (absoluteTimeRaw < baseTime - LOOP_BOUNDARY_TOLERANCE) {
                // Note is truly in the past - schedule for next loop if looping is enabled
                if (loopEnabled) {
                    absoluteTimeRaw = baseTime + relativeTime + loopTimeInSeconds;

                    // If still in past after loop adjustment, skip it
                    if (absoluteTimeRaw < baseTime - LOOP_BOUNDARY_TOLERANCE) {
                        return;
                    }
                } else {
                    // No looping - skip past notes
                    return;
                }
            }

            // ✅ NEW: Convert to sample-accurate time for professional precision
            let absoluteTime = SampleAccurateTime.toSampleAccurate(
                this.transport.audioContext,
                absoluteTimeRaw
            );

            // ✅ NEW: Apply latency compensation if available
            // Schedule earlier to compensate for plugin latency
            if (this.audioEngine.latencyCompensator) {
                // Get instrument's mixer insert ID for latency compensation
                // Note: instrumentData is not available here, get from instrument if possible
                const mixerTrackId = instrument?.mixerTrackId || instrument?.data?.mixerTrackId;
                if (mixerTrackId) {
                    absoluteTime = this.audioEngine.latencyCompensator.compensateTime(
                        absoluteTime,
                        mixerTrackId
                    );
                }
            }

            // Calculate duration
            // ✅ FIX: Handle oval notes (visualLength < length) - use length for audio duration
            let noteDuration;

            // ✅ FIX: Check for oval notes FIRST (visualLength < length means oval note)
            const isOvalNote = note.visualLength !== undefined &&
                typeof note.length === 'number' &&
                note.length > 0 &&
                note.visualLength < note.length;

            if (isOvalNote) {
                // ✅ OVAL NOTES: Use length for audio duration (not visualLength)
                noteDuration = this.transport.stepsToSeconds(note.length);
            } else if (typeof note.length === 'number' && note.length > 0) {
                // NEW FORMAT: length in steps - normal note
                noteDuration = this.transport.stepsToSeconds(note.length);
            } else if (note.duration && typeof note.duration === 'string') {
                // LEGACY FORMAT: duration as string ("4n", "8n", etc)
                noteDuration = note.duration === 'trigger' ?
                    this.transport.stepsToSeconds(0.1) :
                    NativeTimeUtils.parseTime(note.duration, this.transport.bpm);
            } else {
                // FALLBACK: Default to 1 step
                noteDuration = this.transport.stepsToSeconds(1);
            }

            // ✅ OVAL NOTE OVERLAP DETECTION: Check for overlapping notes of the same pitch
            const notePitch = note.pitch || 'C4';
            const noteEndTime = absoluteTime + noteDuration;

            // ⚡ POLICY: Only choke overlaps if instrument explicitly wants cutItself
            const shouldHandleOverlap = instrument?.cutItself === true;

            // ✅ DEBUG: Log note scheduling for overlap detection
            if (import.meta.env.DEV && (instrumentId.includes('808') || notePitch === 'C4')) {
                console.log(`🎵 NoteScheduler: Scheduling note`, {
                    instrumentId,
                    pitch: notePitch,
                    step: noteTimeInSteps,
                    absoluteTime: absoluteTime.toFixed(3),
                    noteDuration: noteDuration.toFixed(3),
                    noteEndTime: noteEndTime.toFixed(3),
                    isOvalNote,
                    visualLength: note.visualLength,
                    length: note.length,
                    activeNotesByPitchSize: activeNotesByPitch.size,
                    existingNote: activeNotesByPitch.get(notePitch) ? {
                        startTime: activeNotesByPitch.get(notePitch).startTime.toFixed(3),
                        endTime: activeNotesByPitch.get(notePitch).endTime.toFixed(3)
                    } : null
                });
            }

            // Check if there's an active note of the same pitch that overlaps
            const existingActiveNote = activeNotesByPitch.get(notePitch);
            if (shouldHandleOverlap && existingActiveNote && existingActiveNote.endTime > absoluteTime) {
                // ✅ OVERLAP DETECTED: Schedule early release for the existing note
                // Calculate overlap duration and use 50% of it for fade-out (minimum 2ms)
                const overlapDuration = existingActiveNote.endTime - absoluteTime;
                const fadeOutDuration = Math.max(0.002, overlapDuration * 0.5); // 50% of overlap or 2ms minimum
                const earlyReleaseTime = absoluteTime - fadeOutDuration;

                if (earlyReleaseTime > this.transport.audioContext.currentTime) {
                    // Schedule early release with fade-out
                    this.transport.scheduleEvent(
                        SampleAccurateTime.toSampleAccurate(
                            this.transport.audioContext,
                            earlyReleaseTime
                        ),
                        (scheduledTime) => {
                            try {
                                instrument.releaseNote(notePitch, scheduledTime, null);
                            } catch (error) {
                                console.error(`NoteScheduler: Early release error:`, error);
                            }
                        },
                        { type: 'noteOff', instrumentId, note: existingActiveNote.note, earlyRelease: true, fadeOut: fadeOutDuration }
                    );

                    if (import.meta.env.DEV) {
                        console.log(`🔄 Oval note overlap detected (choke):`, {
                            pitch: notePitch,
                            existingStart: existingActiveNote.startTime.toFixed(3),
                            existingEnd: existingActiveNote.endTime.toFixed(3),
                            newStart: absoluteTime.toFixed(3),
                            overlap: (overlapDuration * 1000).toFixed(1) + 'ms',
                            earlyRelease: earlyReleaseTime.toFixed(3),
                            fadeOut: (fadeOutDuration * 1000).toFixed(1) + 'ms'
                        });
                    }
                }
            } else if (!shouldHandleOverlap && import.meta.env.DEV) {
                // Skip choke; allow full polyphony (important for reverb tails)
                if (existingActiveNote && existingActiveNote.endTime > absoluteTime) {
                    console.log('🧪 NoteScheduler: overlap ignored (cutItself=false)', {
                        instrumentId,
                        pitch: notePitch,
                        existingEnd: existingActiveNote.endTime.toFixed(3),
                        newStart: absoluteTime.toFixed(3),
                        mixerTrackId: instrument?.mixerTrackId,
                        cutItself: instrument?.cutItself
                    });
                }
            }

            // Update active notes map
            activeNotesByPitch.set(notePitch, {
                startTime: absoluteTime,
                endTime: noteEndTime,
                note: note
            });

            // ✅ PHASE 2: Extract extended parameters from note AND CC lanes
            const extendedParams = {};
            if (note.pan !== undefined) extendedParams.pan = note.pan;
            if (note.modWheel !== undefined) extendedParams.modWheel = note.modWheel;
            if (note.aftertouch !== undefined) extendedParams.aftertouch = note.aftertouch;
            if (note.pitchBend && Array.isArray(note.pitchBend)) extendedParams.pitchBend = note.pitchBend;

            // ✅ FL Studio-style slide logic
            if (note.slideEnabled === true) {
                let targetPitch = note.slideTargetPitch;
                if (targetPitch !== undefined && targetPitch !== null) {
                    if (typeof targetPitch === 'string') {
                        const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
                        const match = targetPitch.match(/([A-G]#?)(\d+)/);
                        if (match) {
                            const [, noteName, octave] = match;
                            targetPitch = (parseInt(octave) + 1) * 12 + (noteMap[noteName] || 0);
                        } else {
                            targetPitch = null;
                        }
                    }

                    if (targetPitch !== null && targetPitch >= 0 && targetPitch <= 127) {
                        const slideDurationSteps = note.slideDuration || 1;
                        const slideDurationSeconds = this.transport.stepsToSeconds(slideDurationSteps);
                        extendedParams.slideEnabled = true;
                        extendedParams.slideTargetPitch = targetPitch;
                        extendedParams.slideDuration = slideDurationSeconds;
                        noteDuration = noteDuration + slideDurationSeconds;
                    }
                }
            }

            // ✅ PHASE 4: Get CC lanes data from AutomationManager (per instrument)
            try {
                const automationManager = getAutomationManager();
                const { activePatternId } = useArrangementStore.getState();
                const patternId = options.patternId || activePatternId;

                if (patternId) {
                    const lanes = automationManager.getLanes(patternId, instrumentId);

                    if (lanes && lanes.length > 0) {
                        lanes.forEach(lane => {
                            const ccValue = lane.getValueAtTime(noteTimeInSteps, 'linear');

                            if (ccValue !== null) {
                                // ✅ MIXING CONTROLS
                                if (lane.ccNumber === 10) {
                                    extendedParams.pan = (ccValue - 64) / 64;
                                } else if (lane.ccNumber === 11) {
                                    extendedParams.expression = ccValue / 127;
                                }
                                // ✅ MODULATION
                                else if (lane.ccNumber === 1) {
                                    extendedParams.modWheel = ccValue;
                                } else if (lane.ccNumber === 'pitchBend') {
                                    if (!extendedParams.pitchBend) extendedParams.pitchBend = [];
                                    const points = lane.getPoints();
                                    const noteEndTime = noteTimeInSteps + (note.length || 1);
                                    const relevantPoints = points.filter(p => p.time >= noteTimeInSteps && p.time <= noteEndTime);
                                    if (relevantPoints.length > 0) {
                                        relevantPoints.forEach(point => {
                                            const relativeTime = (point.time - noteTimeInSteps) / (note.length || 1);
                                            extendedParams.pitchBend.push({ time: relativeTime, value: point.value });
                                        });
                                    } else {
                                        extendedParams.pitchBend.push({ time: 0, value: ccValue });
                                    }
                                } else if (lane.ccNumber === 'aftertouch') {
                                    extendedParams.aftertouch = ccValue;
                                }
                                // ✅ PERFORMANCE CONTROLS
                                else if (lane.ccNumber === 64) {
                                    extendedParams.sustain = ccValue > 63;
                                } else if (lane.ccNumber === 5) {
                                    extendedParams.portamento = (ccValue / 127) * 2;
                                }
                                // ✅ FILTER CONTROLS
                                else if (lane.ccNumber === 74) {
                                    extendedParams.filterCutoff = ccValue;
                                } else if (lane.ccNumber === 71) {
                                    extendedParams.filterResonance = ccValue;
                                }
                                // ✅ ENVELOPE CONTROLS
                                else if (lane.ccNumber === 73) {
                                    extendedParams.attackTime = (ccValue / 127) * 2;
                                } else if (lane.ccNumber === 72) {
                                    extendedParams.releaseTime = (ccValue / 127) * 5;
                                }
                                // ✅ EFFECTS CONTROLS
                                else if (lane.ccNumber === 91) {
                                    extendedParams.reverbSend = ccValue / 127;
                                } else if (lane.ccNumber === 93) {
                                    extendedParams.chorusSend = ccValue / 127;
                                } else if (lane.ccNumber === 94) {
                                    extendedParams.delaySend = ccValue / 127;
                                }
                            }
                        });
                    }
                }
            } catch (error) {
                console.warn('⚠️ Failed to load automation lanes for note:', error);
            }

            const hasExtendedParams = Object.keys(extendedParams).length > 0;

            // Schedule note on event
            this.transport.scheduleEvent(
                absoluteTime,
                (scheduledTime) => {
                    try {
                        instrument.triggerNote(
                            note.pitch || 'C4',
                            note.velocity || 1,
                            scheduledTime,
                            noteDuration,
                            hasExtendedParams ? extendedParams : null
                        );
                    } catch (error) {
                        console.error(`NoteScheduler: triggerNote error:`, error);
                    }
                },
                { type: 'noteOn', instrumentId, note, step: noteTimeInSteps, clipId }
            );

            eventsScheduled++;

            // Schedule note off event - check for both length and duration
            const shouldScheduleNoteOff =
                (typeof note.length === 'number' && note.length > 0) ||
                (note.duration && note.duration !== 'trigger');
            const instrumentHasRelease = typeof instrument?.hasReleaseSustain === 'function'
                ? instrument.hasReleaseSustain()
                : true;

            if (shouldScheduleNoteOff && instrumentHasRelease) {
                // Store note metadata to prevent wrong noteOff
                const noteMetadata = {
                    type: 'noteOff',
                    instrumentId,
                    note,
                    clipId,
                    noteId: note.id,
                    scheduledNoteOnTime: absoluteTime,
                    pitch: note.pitch || 'C4'
                };

                // ✅ PHASE 2: Extract release velocity from note
                const releaseVelocity = note.releaseVelocity !== undefined ? note.releaseVelocity : null;

                this.transport.scheduleEvent(
                    absoluteTime + noteDuration,
                    (scheduledTime) => {
                        try {
                            instrument.releaseNote(noteMetadata.pitch, scheduledTime, releaseVelocity);
                        } catch (error) {
                            console.error(`NoteScheduler: releaseNote error:`, error);
                        }
                    },
                    noteMetadata
                );

                eventsScheduled++;
            }

            notesScheduled++;
        });

        return { notesScheduled, eventsScheduled };
    }

    /**
     * Schedule new notes immediately during playback
     * Used when notes are added while playing
     *
     * @param {Array} addedNotes - Notes to schedule
     * @param {Object} options - Scheduling options
     */
    scheduleNewNotesImmediate(addedNotes, options = {}) {
        const { activePatternId, instrumentsMap } = options;

        if (!addedNotes || addedNotes.length === 0) {
            return;
        }

        // ✅ NEW: Use sample-accurate current time
        const currentTime = SampleAccurateTime.getCurrentSampleAccurateTime(
            this.transport.audioContext
        );
        const currentTick = this.transport.currentTick;
        const currentStepInPattern = currentTick % this.transport.ticksPerBar;

        addedNotes.forEach(noteData => {
            const { note, patternId, instrumentId } = noteData;

            // Only schedule notes for the active pattern
            if (patternId !== activePatternId) {
                return;
            }

            const instrument = instrumentsMap.get(instrumentId);
            if (!instrument) {
                console.warn(`NoteScheduler: Instrument ${instrumentId} not found for immediate scheduling`);
                return;
            }

            const noteStartStep = note.startTime || note.time || 0;

            // Only schedule if note is in the future
            if (noteStartStep > currentStepInPattern) {
                const deltaSteps = noteStartStep - currentStepInPattern;
                const deltaSeconds = this.transport.stepsToSeconds(deltaSteps);
                const scheduleTimeRaw = currentTime + deltaSeconds;

                // ✅ NEW: Convert to sample-accurate time and ensure it's in the future
                const scheduleTime = SampleAccurateTime.ensureFutureTime(
                    this.transport.audioContext,
                    SampleAccurateTime.toSampleAccurate(
                        this.transport.audioContext,
                        scheduleTimeRaw
                    )
                );

                // Calculate duration
                let noteDuration;
                if (typeof note.length === 'number' && note.length > 0) {
                    noteDuration = this.transport.stepsToSeconds(note.length);
                } else {
                    noteDuration = this.transport.stepsToSeconds(1);
                }

                const instrumentHasRelease = typeof instrument?.hasReleaseSustain === 'function'
                    ? instrument.hasReleaseSustain()
                    : true;

                // Schedule note on
                this.transport.scheduleEvent(
                    scheduleTime,
                    (scheduledTime) => {
                        try {
                            instrument.triggerNote(
                                note.pitch || 'C4',
                                note.velocity || 1,
                                scheduledTime,
                                noteDuration
                            );
                        } catch (error) {
                            console.error(`NoteScheduler: Immediate triggerNote error:`, error);
                        }
                    },
                    { type: 'noteOn', instrumentId, note, immediate: true }
                );

                // Schedule note off if needed
                if (noteDuration > 0 && instrumentHasRelease) {
                    this.transport.scheduleEvent(
                        scheduleTime + noteDuration,
                        (scheduledTime) => {
                            try {
                                instrument.releaseNote(note.pitch || 'C4', scheduledTime);
                            } catch (error) {
                                console.error(`NoteScheduler: Immediate releaseNote error:`, error);
                            }
                        },
                        { type: 'noteOff', instrumentId, note, immediate: true }
                    );
                }
            }
        });
    }

    /**
     * Get scheduling statistics
     */
    getStats() {
        return {
            scheduledEvents: this.transport?.scheduledEvents?.size || 0
        };
    }
}
