/**
 * SchedulerService - Extracted from PlaybackManager
 * 
 * Handles audio event scheduling:
 * - Note scheduling with look-ahead
 * - Pattern scheduling
 * - Event cancellation
 * - Timing compensation
 * 
 * @module lib/core/services/SchedulerService
 */

import { logger, NAMESPACES } from '../../utils/debugLogger.js';

/**
 * Scheduled event types
 */
export const ScheduledEventType = {
    NOTE_ON: 'noteOn',
    NOTE_OFF: 'noteOff',
    PARAM_CHANGE: 'paramChange',
    PATTERN_START: 'patternStart',
    PATTERN_END: 'patternEnd'
};

/**
 * Scheduled event structure
 */
class ScheduledEvent {
    constructor(type, time, data) {
        this.id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.type = type;
        this.time = time;
        this.data = data;
        this.executed = false;
        this.cancelled = false;
    }
}

export class SchedulerService {
    /**
     * @param {NativeAudioEngine} engine - Parent audio engine
     */
    constructor(engine) {
        this.engine = engine;

        // Scheduling settings
        this.lookAheadTime = 0.1;    // 100ms look-ahead
        this.scheduleAhead = 0.15;   // Schedule 150ms ahead
        this.tickInterval = 25;      // Check every 25ms

        // Scheduled events
        this.scheduledEvents = new Map(); // eventId -> ScheduledEvent
        this.scheduledNotes = new Map();  // instrumentId -> Map(noteId -> eventId)

        // Optimization
        this.pendingSchedule = false;
        this.scheduleDebounceMs = 10;
        this._scheduleTimeout = null;

        // Stats
        this.stats = {
            eventsScheduled: 0,
            eventsCancelled: 0,
            eventsExecuted: 0
        };

        // Scheduler loop
        this._tickInterval = null;
    }

    /**
     * Get audio context from parent engine
     */
    get audioContext() {
        return this.engine.audioContext;
    }

    /**
     * Get transport from parent engine
     */
    get transport() {
        return this.engine.transport;
    }

    /**
     * Get instruments from parent engine
     */
    get instruments() {
        return this.engine.instruments || this.engine.instrumentService?.instruments;
    }

    /**
     * Start the scheduler loop
     */
    start() {
        if (this._tickInterval) {
            return;
        }

        this._tickInterval = setInterval(() => {
            this._tick();
        }, this.tickInterval);

        logger.debug(NAMESPACES.AUDIO, 'Scheduler started');
    }

    /**
     * Stop the scheduler loop
     */
    stop() {
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = null;
        }

        // Cancel all pending events
        this.cancelAll();

        logger.debug(NAMESPACES.AUDIO, 'Scheduler stopped');
    }

    /**
     * Schedule a note to play
     * @param {string} instrumentId - Instrument ID
     * @param {Object} note - Note object {pitch, velocity, step, duration}
     * @param {number} startTime - Audio context time to start
     * @param {number} duration - Duration in seconds
     * @returns {string} Event ID
     */
    scheduleNote(instrumentId, note, startTime, duration) {
        const noteOnEvent = new ScheduledEvent(
            ScheduledEventType.NOTE_ON,
            startTime,
            { instrumentId, note }
        );

        const noteOffEvent = new ScheduledEvent(
            ScheduledEventType.NOTE_OFF,
            startTime + duration,
            { instrumentId, noteId: note.id, pitch: note.pitch }
        );

        // Store events
        this.scheduledEvents.set(noteOnEvent.id, noteOnEvent);
        this.scheduledEvents.set(noteOffEvent.id, noteOffEvent);

        // Track by instrument and note
        if (!this.scheduledNotes.has(instrumentId)) {
            this.scheduledNotes.set(instrumentId, new Map());
        }
        this.scheduledNotes.get(instrumentId).set(note.id, {
            noteOnId: noteOnEvent.id,
            noteOffId: noteOffEvent.id
        });

        this.stats.eventsScheduled += 2;

        return noteOnEvent.id;
    }

    /**
     * Schedule a pattern for playback
     * @param {string} patternId - Pattern ID
     * @param {Object} patternData - Pattern data with notes
     * @param {number} startTime - Audio context time to start
     * @param {number} bpm - Beats per minute
     * @param {number} [skipBeforeStep=0] - Skip notes before this step (for resume/jump)
     */
    schedulePattern(patternId, patternData, startTime, bpm, skipBeforeStep = 0) {
        if (!patternData || !patternData.data) {
            logger.warn(NAMESPACES.AUDIO, `No pattern data for ${patternId}`);
            return;
        }

        const stepDuration = 60 / bpm / 4; // 16th note duration

        // ✅ DEBUG: Log scheduling start
        logger.debug(NAMESPACES.AUDIO, `📅 Scheduling pattern ${patternId}:`, {
            startTime: startTime.toFixed(3),
            currentTime: this.audioContext?.currentTime.toFixed(3),
            bpm,
            stepDuration: stepDuration.toFixed(3),
            skipBeforeStep
        });

        // ✅ FIX: Filter notes to skip already-played steps (for resume/jump)
        let scheduledCount = 0;

        // Schedule notes for each instrument
        Object.entries(patternData.data).forEach(([instrumentId, notes]) => {
            if (!Array.isArray(notes)) return;

            notes.forEach(note => {
                // ✅ DEBUG: Log the actual note structure
                if (scheduledCount === 0) {
                    logger.debug(NAMESPACES.AUDIO, `📋 Note object structure:`, note);
                    logger.debug(NAMESPACES.AUDIO, `📋 Note keys:`, Object.keys(note));
                }

                // ✅ FIX: Pattern data uses `time` property for step position!
                const noteStep = parseFloat(note.time) || 0;

                // ✅ Skip notes before current position (for resume/jump)
                if (noteStep < skipBeforeStep) {
                    return;
                }

                // ✅ FIX: Adjust start time relative to the skipBeforeStep
                // If we are skipping to step 40, then step 40 should play at startTime (NOW)
                // So we subtract the skipped time from the calculation
                const relativeStep = noteStep - skipBeforeStep;
                const noteStartTime = startTime + (relativeStep * stepDuration);
                const noteDuration = (note.duration || 1) * stepDuration;

                // ✅ DEBUG: Log first few scheduled notes
                if (scheduledCount < 3) {
                    logger.debug(NAMESPACES.AUDIO, `  📝 Note ${scheduledCount + 1}:`, {
                        instrumentId,
                        step: noteStep,
                        pitch: note.pitch,
                        noteStartTime: noteStartTime.toFixed(3),
                        noteDuration: noteDuration.toFixed(3)
                    });
                }

                this.scheduleNote(instrumentId, note, noteStartTime, noteDuration);
                scheduledCount++;
            });
        });

        logger.debug(NAMESPACES.AUDIO, `Scheduled pattern ${patternId} (${scheduledCount} notes, from step ${skipBeforeStep})`);
    }

    /**
     * Cancel a specific note
     * @param {string} instrumentId - Instrument ID
     * @param {string} noteId - Note ID
     */
    cancelNote(instrumentId, noteId) {
        const instrumentNotes = this.scheduledNotes.get(instrumentId);
        if (!instrumentNotes) return;

        const eventIds = instrumentNotes.get(noteId);
        if (!eventIds) return;

        // Cancel both note on and off events
        if (eventIds.noteOnId) {
            const event = this.scheduledEvents.get(eventIds.noteOnId);
            if (event && !event.executed) {
                event.cancelled = true;
                this.stats.eventsCancelled++;
            }
        }

        if (eventIds.noteOffId) {
            const event = this.scheduledEvents.get(eventIds.noteOffId);
            if (event && !event.executed) {
                event.cancelled = true;
                this.stats.eventsCancelled++;
            }
        }

        instrumentNotes.delete(noteId);
    }

    /**
     * Cancel all notes for an instrument
     * @param {string} instrumentId - Instrument ID
     */
    cancelInstrumentNotes(instrumentId) {
        const instrumentNotes = this.scheduledNotes.get(instrumentId);
        if (!instrumentNotes) return;

        instrumentNotes.forEach((eventIds, noteId) => {
            this.cancelNote(instrumentId, noteId);
        });

        this.scheduledNotes.delete(instrumentId);
    }

    /**
     * Cancel all scheduled events
     */
    cancelAll() {
        this.scheduledEvents.forEach(event => {
            if (!event.executed) {
                event.cancelled = true;
                this.stats.eventsCancelled++;
            }
        });

        this.scheduledEvents.clear();
        this.scheduledNotes.clear();

        logger.debug(NAMESPACES.AUDIO, 'All scheduled events cancelled');
    }

    /**
     * Request rescheduling (debounced)
     * @param {Function} callback - Callback to execute
     * @param {string} reason - Reason for rescheduling
     */
    requestReschedule(callback, reason = 'unknown') {
        if (this._scheduleTimeout) {
            clearTimeout(this._scheduleTimeout);
        }

        this.pendingSchedule = true;

        this._scheduleTimeout = setTimeout(() => {
            this.pendingSchedule = false;
            callback();
        }, this.scheduleDebounceMs);
    }

    /**
     * Force immediate scheduling
     * @param {Function} callback - Callback to execute
     */
    forceSchedule(callback) {
        if (this._scheduleTimeout) {
            clearTimeout(this._scheduleTimeout);
        }

        this.pendingSchedule = false;
        callback();
    }

    /**
     * Get scheduler stats
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            pendingEvents: this.scheduledEvents.size,
            trackedInstruments: this.scheduledNotes.size
        };
    }

    // =================== PRIVATE METHODS ===================

    /**
     * Scheduler tick - process pending events
     * @private
     */
    _tick() {
        if (!this.audioContext) return;

        const currentTime = this.audioContext.currentTime;
        const lookAheadEnd = currentTime + this.lookAheadTime;

        // ✅ DEBUG: Log tick state
        /*
        const pendingEvents = Array.from(this.scheduledEvents.values()).filter(e => !e.cancelled && !e.executed);
        if (pendingEvents.length > 0) {
            logger.debug(NAMESPACES.AUDIO, `⏰ Scheduler tick:`, {
                currentTime: currentTime.toFixed(3),
                lookAheadEnd: lookAheadEnd.toFixed(3),
                pendingEvents: pendingEvents.length,
                nextEventTime: pendingEvents[0]?.time.toFixed(3),
                timeDiff: pendingEvents[0] ? (pendingEvents[0].time - currentTime).toFixed(3) : 'N/A'
            });
        }*/

        // Process events that should be triggered
        this.scheduledEvents.forEach((event, eventId) => {
            if (event.cancelled || event.executed) {
                return;
            }

            if (event.time <= lookAheadEnd) {
                this._executeEvent(event);
            }
        });

        // Cleanup old events
        this._cleanup(currentTime - 1); // Remove events older than 1 second
    }

    /**
     * Execute a scheduled event
     * @private
     */
    _executeEvent(event) {
        if (event.cancelled || event.executed) {
            return;
        }

        event.executed = true;
        this.stats.eventsExecuted++;

        const { instrumentId, note, noteId, pitch } = event.data;

        switch (event.type) {
            case ScheduledEventType.NOTE_ON: {
                // ✅ DEBUG: Log instrument lookup
                const availableInstruments = Array.from(this.instruments?.keys() || []);
                logger.debug(NAMESPACES.AUDIO, `🎵 Attempting to trigger note:`, {
                    instrumentId,
                    pitch: note.pitch,
                    velocity: note.velocity,
                    availableInstruments: availableInstruments.length,
                    instrumentIds: availableInstruments
                });

                const instrument = this.instruments?.get(instrumentId);

                if (!instrument) {
                    logger.warn(NAMESPACES.AUDIO, `❌ Instrument not found: ${instrumentId}`, {
                        availableInstruments
                    });
                    return;
                }

                if (typeof instrument.triggerNote !== 'function') {
                    logger.warn(NAMESPACES.AUDIO, `❌ Instrument ${instrumentId} has no triggerNote method`);
                    return;
                }

                logger.debug(NAMESPACES.AUDIO, `✅ Triggering note on ${instrumentId}: pitch=${note.pitch}, velocity=${note.velocity}`);
                instrument.triggerNote(note.pitch, note.velocity || 0.8, event.time);
                break;
            }

            case ScheduledEventType.NOTE_OFF: {
                const instrument = this.instruments?.get(instrumentId);
                if (instrument && typeof instrument.releaseNote === 'function') {
                    instrument.releaseNote(pitch, event.time);
                }
                break;
            }

            default:
                logger.warn(NAMESPACES.AUDIO, `Unknown event type: ${event.type}`);
        }
    }

    /**
     * Cleanup old events
     * @private
     */
    _cleanup(beforeTime) {
        const toDelete = [];

        this.scheduledEvents.forEach((event, eventId) => {
            if ((event.executed || event.cancelled) && event.time < beforeTime) {
                toDelete.push(eventId);
            }
        });

        toDelete.forEach(id => this.scheduledEvents.delete(id));
    }

    /**
     * Dispose the service
     */
    dispose() {
        this.stop();
        this.scheduledEvents.clear();
        this.scheduledNotes.clear();
        logger.info(NAMESPACES.AUDIO, 'SchedulerService disposed');
    }
}
