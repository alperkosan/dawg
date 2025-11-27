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

export class NoteScheduler {
    constructor(transport, audioEngine) {
        this.transport = transport;
        this.audioEngine = audioEngine;
    }

    /**
     * Schedule instrument notes from a pattern/clip
     *
     * @param {Object} instrument - Instrument instance
     * @param {Array} notes - Notes to schedule
     * @param {string} instrumentId - Instrument ID
     * @param {number} baseTime - Base time for scheduling
     * @param {string} clipId - Clip ID (for song mode)
     * @returns {Object} Scheduling statistics
     */
    scheduleInstrumentNotes(instrument, notes, instrumentId, baseTime, clipId = null) {
        if (!instrument || !notes || notes.length === 0) {
            return { notesScheduled: 0, eventsScheduled: 0 };
        }

        let notesScheduled = 0;
        let eventsScheduled = 0;

        notes.forEach(note => {
            // Calculate absolute time
            const noteTimeInSteps = note.startTime || note.time || 0;
            const noteTimeInSeconds = this.transport.stepsToSeconds(noteTimeInSteps);
        const absoluteTime = baseTime + noteTimeInSeconds;

            // Calculate duration
            let noteDuration;
            if (typeof note.length === 'number' && note.length > 0) {
                // NEW FORMAT: length in steps
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

            // ✅ PHASE 2: Extract extended parameters from note
            const extendedParams = {};
            if (note.pan !== undefined) extendedParams.pan = note.pan;
            if (note.modWheel !== undefined) extendedParams.modWheel = note.modWheel;
            if (note.aftertouch !== undefined) extendedParams.aftertouch = note.aftertouch;
            if (note.pitchBend && Array.isArray(note.pitchBend)) extendedParams.pitchBend = note.pitchBend;
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

        const currentTime = this.transport.audioContext.currentTime;
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
                const scheduleTime = currentTime + deltaSeconds;

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
