// client/src/lib/core/scheduling/ContinuousScheduler.js
// Continuous Lookahead Scheduler - Professional DAW Architecture
// State-driven, no reactive reschedule, zero race conditions

/**
 * ContinuousScheduler
 *
 * Professional DAW scheduling architecture:
 * - State-driven (not event-driven)
 * - Continuous lookahead (150ms sliding window)
 * - Incremental scheduling (no cancelAll nuke)
 * - Loop-aware computation
 * - Garbage collection for past events only
 *
 * Key principles:
 * 1. Scheduler ticks every 25ms (40fps)
 * 2. Reads current position from Transport
 * 3. Computes what SHOULD be in [now, now+150ms] window
 * 4. Schedules only MISSING notes (incremental)
 * 5. GC's past events (< currentTime - 100ms)
 * 6. Never touches events within safety window (currentTime + 10ms)
 *
 * Benefits:
 * - Zero race conditions (atomic tick)
 * - No note drops (no cancelAll)
 * - Predictable latency (max 25ms)
 * - Loop restart is natural (just position change)
 */
export class ContinuousScheduler {
    /**
     * @param {Object} transport - Transport instance (for position, timing)
     * @param {Object} patternStore - Pattern store (for note data)
     * @param {AudioContext} audioContext - Web Audio context
     * @param {Object} audioEngine - Audio engine (for instrument scheduling)
     * @param {SchedulerService} schedulerService - Scheduler service (single source of truth)
     */
    constructor(transport, patternStore, audioContext, audioEngine, schedulerService) {
        this.transport = transport;
        this.patternStore = patternStore;
        this.audioContext = audioContext;
        this.audioEngine = audioEngine;
        this.schedulerService = schedulerService;  // ✅ Direct reference - single source of truth

        // ===== SCHEDULING PARAMETERS =====
        this.lookaheadTime = 0.150; // 150ms lookahead window
        this.tickInterval = 25; // 25ms per tick (40fps)
        this.scheduleAheadBuffer = 0.020; // 20ms safety buffer
        this.safetyWindow = 0.010; // 10ms - don't touch events within this window

        // ===== STATE =====
        // Scheduled events - Map<eventId, ScheduledEvent>
        this.scheduledEvents = new Map();

        // Dirty patterns - Set of pattern IDs needing refresh
        this.dirtyPatterns = new Set();

        // Last scheduled tick position
        this.lastScheduledTick = -1;

        // Ticker handle
        this.tickerHandle = null;
        this.isRunning = false;

        // ===== STATS (for monitoring) =====
        this.stats = {
            tickCount: 0,
            eventsScheduled: 0,
            eventsExecuted: 0,
            eventsGCd: 0,
            lastTickDuration: 0,
            avgTickDuration: 0
        };

        console.log('✨ [ContinuousScheduler] Initialized:', {
            lookaheadTime: this.lookaheadTime,
            tickInterval: this.tickInterval,
            safetyWindow: this.safetyWindow
        });
    }

    // =================== PUBLIC API ===================

    /**
     * Start continuous scheduler ticker
     */
    start() {
        if (this.isRunning) {
            console.warn('⚠️ [ContinuousScheduler] Already running');
            return;
        }

        this.isRunning = true;
        this.lastScheduledTick = -1; // Reset on start

        // 🔍 DEBUG: Log pattern store state on start
        const activePatternId = this._getActivePatternId();
        const pattern = this.patternStore.patterns?.[activePatternId];
        console.log('▶️ [ContinuousScheduler] Started', {
            activePatternId,
            patternExists: !!pattern,
            patternHasData: !!pattern?.data,
            availablePatterns: Object.keys(this.patternStore.patterns || {}),
            transport: {
                currentTick: this.transport.currentTick,
                isPlaying: this.transport.isPlaying,
                bpm: this.transport.bpm,
                loop: this.transport.loop
            }
        });

        if (pattern?.data) {
            Object.entries(pattern.data).forEach(([instId, notes]) => {
                console.log(`  📋 ${instId}: ${notes?.length || 0} notes`);
                if (notes && notes.length > 0 && notes.length <= 5) {
                    notes.forEach((note, idx) => {
                        console.log(`    Note ${idx+1}:`, {
                            time: note.time,
                            step: note.step,
                            pitch: note.pitch
                        });
                    });
                }
            });
        }

        this._startTicker();
    }

    /**
     * Stop scheduler ticker
     */
    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;

        if (this.tickerHandle) {
            clearTimeout(this.tickerHandle);
            this.tickerHandle = null;
        }

        console.log('⏹️ [ContinuousScheduler] Stopped', this.stats);
    }

    /**
     * Mark pattern as dirty - will be refreshed on next tick
     * This is called from UI thread when notes added/removed/modified
     *
     * @param {string} patternId - Pattern ID to mark dirty
     */
    markDirty(patternId) {
        this.dirtyPatterns.add(patternId);
        console.log(`🏷️ [ContinuousScheduler] Marked pattern ${patternId} dirty`);
        // No immediate reschedule! Wait for next tick (max 25ms latency)
    }

    /**
     * Clear all scheduled events (used on stop)
     */
    clearAll() {
        this.scheduledEvents.clear();
        this.dirtyPatterns.clear();
        this.lastScheduledTick = -1;
        console.log('🧹 [ContinuousScheduler] Cleared all');
    }

    // =================== CORE SCHEDULING LOGIC ===================

    /**
     * Main scheduler tick - runs every 25ms
     * This is the ONLY place scheduling happens
     */
    tick() {
        if (!this.isRunning) return;
        if (!this.transport?.isPlaying) return;

        const tickStartTime = performance.now();
        const audioTime = this.audioContext.currentTime;
        const currentTick = this.transport.currentTick;

        // 1. Calculate schedule window
        // ✅ CRITICAL FIX: Use currentTick as base, not audioTime!
        // Transport.timeToTick() uses timing anchor which can be out of sync
        // We need window relative to current playback position
        let windowStartTick = this.transport.currentTick;

        // Convert lookahead duration (seconds) to ticks
        const bpm = this.transport.bpm || 120;
        const ppq = this.transport.ppq || 96;
        const ticksPerSecond = (bpm / 60) * ppq;
        const lookaheadTicks = this.lookaheadTime * ticksPerSecond;

        let windowEndTick = windowStartTick + lookaheadTicks;

        // ✅ CRITICAL FIX: Clip lookahead at loop boundary to prevent "sarkma"
        // Never schedule beyond loop end to avoid notes playing after loop restart
        if (this.transport.loop) {
            const loopEndTick = this.transport.loopEndTick;
            if (windowEndTick > loopEndTick) {
                windowEndTick = loopEndTick;
            }
        }

        // 🔍 DEBUG: Log every 50 ticks for monitoring
        if (this.stats.tickCount % 50 === 0) {
            const activePatternId = this._getActivePatternId();
            const pattern = this.patternStore.patterns?.[activePatternId];
            console.log(`🔍 [ContinuousScheduler] Tick #${this.stats.tickCount}:`, {
                audioTime: audioTime.toFixed(3),
                currentTick: this.transport.currentTick,
                windowStartTick: windowStartTick.toFixed(1),
                windowEndTick: windowEndTick.toFixed(1),
                lastScheduledTick: this.lastScheduledTick.toFixed(1),
                activePatternId,
                patternExists: !!pattern,
                patternHasData: !!pattern?.data,
                scheduledEventsCount: this.scheduledEvents.size,
                dirtyPatternsCount: this.dirtyPatterns.size
            });
        }

        // 2. Garbage collect past events
        this._garbageCollectPastEvents(audioTime);

        // 3. Check for position jump (loop restart, seek)
        const positionJumped = this._detectPositionJump(windowStartTick);
        if (positionJumped) {
            console.log(`🔄 [ContinuousScheduler] Position jump detected: ${this.lastScheduledTick.toFixed(1)} → ${windowStartTick.toFixed(1)}`);

            // ✅ CRITICAL FIX: Cancel ALL events in SchedulerService (including imminent ones)
            // This prevents old notes from continuing to play after loop restart
            const ssEventsBefore = this.schedulerService.scheduledEvents.size;
            this.schedulerService.cancelAll(true, true); // (forceRelease=true, ignoreSafeThreshold=true)
            console.log(`🗑️ [ContinuousScheduler] Cancelled ${ssEventsBefore} events in SchedulerService (including imminent)`);

            // ✅ Clear local event tracking on position jump
            // Event IDs are tick-based, so same ticks after loop will have same IDs
            // We must clear the Map so events can be rescheduled
            const eventsCleared = this.scheduledEvents.size;
            this.scheduledEvents.clear();
            console.log(`🗑️ [ContinuousScheduler] Cleared ${eventsCleared} events from local Map`);

            // ✅ CRITICAL FIX: Force loop restart window from tick 0
            // PROBLEM: Transport calculates currentTick from elapsed time after loop restart
            //   After 25ms: currentTick = 0 + (0.025 * 192) ≈ 4.8 ticks
            //   Window = [4.8, 154.8] → SKIPS notes at tick 0-4.8!
            // SOLUTION: On ANY position jump in loop mode, force window from loop start
            if (this.transport.loop) {
                const loopStartTick = this.transport.loopStartTick || 0;
                const loopEndTick = this.transport.loopEndTick;

                // If we jumped AND we're in loop mode, assume loop restart
                // Force window from loop start to catch tick 0 notes
                console.log(`🔁 [ContinuousScheduler] Loop restart - forcing window: ${windowStartTick.toFixed(1)} → ${loopStartTick}`);
                windowStartTick = loopStartTick;
                windowEndTick = loopStartTick + lookaheadTicks;

                // Re-apply loop boundary clipping for new window
                if (windowEndTick > loopEndTick) {
                    windowEndTick = loopEndTick;
                }
            }

            this.lastScheduledTick = windowStartTick - 1; // -1 to ensure fill starts from windowStartTick
        }

        // 4. Handle dirty patterns (notes added/removed)
        const activePatternId = this._getActivePatternId();
        if (this.dirtyPatterns.has(activePatternId)) {
            console.log(`🔄 [ContinuousScheduler] Refreshing dirty pattern: ${activePatternId}`);
            this._refreshPatternSchedule(activePatternId, windowStartTick, windowEndTick, audioTime);
            this.dirtyPatterns.delete(activePatternId);
        }

        // 5. Incremental scheduling - fill gaps in window
        this._fillScheduleWindow(windowStartTick, windowEndTick);

        // 6. Update last scheduled position
        this.lastScheduledTick = windowEndTick;

        // Stats
        const tickDuration = performance.now() - tickStartTime;
        this.stats.tickCount++;
        this.stats.lastTickDuration = tickDuration;
        this.stats.avgTickDuration = (this.stats.avgTickDuration * 0.9) + (tickDuration * 0.1);

        if (this.stats.tickCount % 100 === 0) {
            console.log(`📊 [ContinuousScheduler] Stats:`, {
                ticks: this.stats.tickCount,
                scheduled: this.stats.eventsScheduled,
                avgDuration: this.stats.avgTickDuration.toFixed(2) + 'ms',
                eventsInMap: this.scheduledEvents.size
            });
        }
    }

    /**
     * Refresh schedule for dirty pattern
     * Only affects FUTURE events (not past/executing)
     */
    _refreshPatternSchedule(patternId, windowStartTick, windowEndTick, audioTime) {
        const pattern = this.patternStore.patterns?.[patternId];
        if (!pattern) {
            console.warn(`⚠️ [ContinuousScheduler] Pattern not found: ${patternId}`);
            return;
        }

        // 1. Remove FUTURE events for this pattern (not past/executing)
        this._removeFutureEvents(patternId, audioTime);

        // 2. Compute what SHOULD be in window
        const notesInWindow = this._computeNotesInWindow(
            pattern,
            windowStartTick,
            windowEndTick
        );

        console.log(`🎵 [ContinuousScheduler] Computed ${notesInWindow.length} notes in window [${windowStartTick.toFixed(1)}, ${windowEndTick.toFixed(1)}]`);

        // 3. Schedule missing notes
        notesInWindow.forEach(noteData => {
            const eventId = this._generateEventId(noteData);
            if (!this.scheduledEvents.has(eventId)) {
                this._scheduleNote(noteData);
            }
        });
    }

    /**
     * Fill schedule window incrementally
     * Schedule any notes between lastScheduledTick and windowEndTick
     */
    _fillScheduleWindow(windowStartTick, windowEndTick) {
        // If this is first tick or position jumped
        if (this.lastScheduledTick < 0) {
            // Fresh schedule needed
            this.lastScheduledTick = windowStartTick;
        }

        // Calculate fill range
        const fillStart = Math.max(windowStartTick, this.lastScheduledTick);
        let fillEnd = windowEndTick;

        // ✅ CRITICAL FIX: Clip window to loop boundary to prevent "sarkma"
        // If loop is enabled and window crosses loop end, stop at loop end
        if (this.transport.loop) {
            const loopEndTick = this.transport.loopEndTick;
            if (fillStart < loopEndTick && fillEnd > loopEndTick) {
                fillEnd = loopEndTick;
                console.log(`⚠️ [ContinuousScheduler] Clipping window at loop boundary: [${fillStart.toFixed(1)}, ${windowEndTick.toFixed(1)}] → [${fillStart.toFixed(1)}, ${fillEnd.toFixed(1)}]`);
            }
        }

        // If nothing to fill, return
        if (fillEnd <= fillStart) return;

        const activePatternId = this._getActivePatternId();
        const pattern = this.patternStore.patterns?.[activePatternId];

        if (!pattern) {
            // 🔍 DEBUG: Pattern not found
            if (this.stats.tickCount % 100 === 0) {
                console.warn(`⚠️ [ContinuousScheduler] No pattern found for ID: ${activePatternId}`, {
                    availablePatterns: Object.keys(this.patternStore.patterns || {})
                });
            }
            return;
        }

        if (!pattern.data) {
            // 🔍 DEBUG: Pattern has no data
            if (this.stats.tickCount % 100 === 0) {
                console.warn(`⚠️ [ContinuousScheduler] Pattern ${activePatternId} has no data:`, pattern);
            }
            return;
        }

        // Compute notes in fill range
        const notesToFill = this._computeNotesInWindow(pattern, fillStart, fillEnd);

        // Schedule missing notes
        let scheduledCount = 0;
        notesToFill.forEach(noteData => {
            const eventId = this._generateEventId(noteData);
            if (!this.scheduledEvents.has(eventId)) {
                this._scheduleNote(noteData);
                scheduledCount++;
            }
        });

        if (scheduledCount > 0) {
            console.log(`➕ [ContinuousScheduler] Filled window: scheduled ${scheduledCount} notes in [${fillStart.toFixed(1)}, ${fillEnd.toFixed(1)}]`);
        }
    }

    /**
     * Compute notes that should be in tick window (state-driven)
     * This is the PURE FUNCTION - reads pattern state, computes expected notes
     *
     * Loop-aware: handles loop boundaries correctly
     */
    _computeNotesInWindow(pattern, startTick, endTick) {
        const notes = [];
        const loopEnabled = this.transport.loop ?? true;
        const loopStartTick = this.transport.loopStartTick ?? 0;
        const loopEndTick = this.transport.loopEndTick ?? (64 * this.transport.ticksPerStep);
        const loopLength = loopEndTick - loopStartTick;

        if (!pattern.data) return notes;

        // 🔍 DEBUG: Log pattern data structure (once every 100 calls)
        if (this.stats.tickCount % 100 === 0) {
            const instrumentCount = Object.keys(pattern.data).length;
            const totalNotes = Object.values(pattern.data).reduce((sum, notes) =>
                sum + (Array.isArray(notes) ? notes.length : 0), 0
            );
            console.log(`🔍 [ContinuousScheduler] Pattern data:`, {
                patternId: pattern.id,
                instruments: instrumentCount,
                totalNotes,
                window: `[${startTick.toFixed(1)}, ${endTick.toFixed(1)}]`,
                loopEnabled,
                loopRange: `[${loopStartTick}, ${loopEndTick}]`
            });
        }

        // Iterate through instruments
        Object.entries(pattern.data).forEach(([instrumentId, instrumentNotes]) => {
            if (!instrumentNotes || !Array.isArray(instrumentNotes)) {
                console.warn(`⚠️ [ContinuousScheduler] Invalid notes for ${instrumentId}:`, instrumentNotes);
                return;
            }

            // Iterate through notes
            instrumentNotes.forEach(note => {
                if (!note) return;

                // Get note step position (time = step position)
                const noteStep = note.time ?? note.step ?? 0;
                const noteStepTick = noteStep * this.transport.ticksPerStep;

                // Compute all occurrences of this note in window
                const occurrences = loopEnabled
                    ? this._computeNoteOccurrencesLooping(noteStepTick, startTick, endTick, loopStartTick, loopLength)
                    : this._computeNoteOccurrencesLinear(noteStepTick, startTick, endTick);

                // Add to results
                occurrences.forEach(occurrenceTick => {
                    // ✅ CRITICAL FIX: Calculate absolute audio time, not relative pattern time
                    // We need to schedule relative to NOW, not relative to tick 0
                    const currentTick = this.transport.currentTick;
                    const tickOffset = occurrenceTick - currentTick;
                    const bpm = this.transport.bpm || 120;
                    const ppq = this.transport.ppq || 96;
                    const secondsPerTick = 60 / (bpm * ppq);
                    const timeOffset = tickOffset * secondsPerTick;
                    const absoluteTime = this.audioContext.currentTime + timeOffset;

                    notes.push({
                        tick: occurrenceTick,
                        time: absoluteTime,
                        instrumentId,
                        patternId: pattern.id,
                        pitch: note.pitch,
                        velocity: note.velocity ?? 100,
                        duration: note.length ?? 1, // Oval nota: length includes sample tail (visualLength = gate)
                        noteId: note.id
                    });
                });
            });
        });

        return notes;
    }

    /**
     * Compute note occurrences with looping
     */
    _computeNoteOccurrencesLooping(noteStepTick, startTick, endTick, loopStartTick, loopLength) {
        const occurrences = [];

        // Find first loop iteration that could contain our note
        const firstLoopIteration = Math.floor((startTick - loopStartTick) / loopLength);
        const lastLoopIteration = Math.ceil((endTick - loopStartTick) / loopLength);

        // Check each loop iteration
        for (let iteration = firstLoopIteration; iteration <= lastLoopIteration; iteration++) {
            const candidateTick = loopStartTick + (iteration * loopLength) + (noteStepTick - loopStartTick);

            if (candidateTick >= startTick && candidateTick < endTick) {
                occurrences.push(candidateTick);
            }
        }

        return occurrences;
    }

    /**
     * Compute note occurrences without looping (linear playback)
     */
    _computeNoteOccurrencesLinear(noteStepTick, startTick, endTick) {
        if (noteStepTick >= startTick && noteStepTick < endTick) {
            return [noteStepTick];
        }
        return [];
    }

    /**
     * Garbage collect events that are in the past
     * Keep executed events for a short time (audit trail)
     */
    _garbageCollectPastEvents(audioTime) {
        const gcThreshold = audioTime - 0.100; // Keep 100ms history
        let gcCount = 0;

        this.scheduledEvents.forEach((event, eventId) => {
            if (event.time < gcThreshold && event.executed) {
                this.scheduledEvents.delete(eventId);
                gcCount++;
            }
        });

        if (gcCount > 0) {
            this.stats.eventsGCd += gcCount;
        }
    }

    /**
     * Remove FUTURE events for pattern (not past/executing)
     * Used when pattern becomes dirty
     *
     * ✅ CRITICAL FIX: Also cancel events in SchedulerService to prevent duplicates
     */
    _removeFutureEvents(patternId, audioTime) {
        const safeThreshold = audioTime + this.safetyWindow;
        let removedCount = 0;

        // 1. Remove from local tracking Map
        this.scheduledEvents.forEach((event, eventId) => {
            if (event.patternId === patternId &&
                event.time > safeThreshold &&
                !event.executed) {
                this.scheduledEvents.delete(eventId);
                removedCount++;
            }
        });

        // 2. ✅ CRITICAL: Cancel future events in SchedulerService too!
        // Without this, SchedulerService keeps old events → DUPLICATES on spam add/remove
        const ssEventsToDelete = [];
        this.schedulerService.scheduledEvents.forEach((event, eventId) => {
            if (event.time > safeThreshold && !event.executed && !event.cancelled) {
                // Mark cancelled for ticker to skip
                event.cancelled = true;
                this.schedulerService.stats.eventsCancelled++;
                // Delete immediately to prevent Map bloat during spam
                ssEventsToDelete.push(eventId);
            }
        });

        // Immediate cleanup to prevent Map bloat
        ssEventsToDelete.forEach(id => this.schedulerService.scheduledEvents.delete(id));

        if (removedCount > 0 || ssEventsToDelete.length > 0) {
            console.log(`🗑️ [ContinuousScheduler] Removed ${removedCount} local + ${ssEventsToDelete.length} SchedulerService events for pattern ${patternId}`);
        }
    }

    /**
     * Clear all future events (used on position jump)
     * OLD METHOD: Uses safetyWindow to avoid cutting off imminent events
     */
    _clearFutureEvents(audioTime) {
        const safeThreshold = audioTime + this.safetyWindow;
        let clearedCount = 0;

        this.scheduledEvents.forEach((event, eventId) => {
            if (event.time > safeThreshold && !event.executed) {
                this.scheduledEvents.delete(eventId);
                clearedCount++;
            }
        });

        if (clearedCount > 0) {
            console.log(`🗑️ [ContinuousScheduler] Cleared ${clearedCount} future events (safe threshold)`);
        }
    }

    /**
     * Clear ALL future events without safety window check
     * Used on position jump (loop restart) where we need a clean slate
     *
     * CRITICAL: On loop restart, lookahead window may have already scheduled
     * notes for tick 0-150. Without clearing ALL future events, those events
     * remain in the Map with same eventId, preventing re-scheduling.
     */
    _clearAllFutureEvents(audioTime) {
        let clearedCount = 0;

        this.scheduledEvents.forEach((event, eventId) => {
            // Clear ALL future events (even within safety window)
            // Only keep events that are currently executing or already past
            if (event.time >= audioTime && !event.executed) {
                this.scheduledEvents.delete(eventId);
                clearedCount++;
            }
        });

        if (clearedCount > 0) {
            console.log(`🗑️ [ContinuousScheduler] Cleared ${clearedCount} future events (position jump - all)`);
        }
    }

    /**
     * Schedule a single note (low-level)
     */
    _scheduleNote(noteData) {
        const eventId = this._generateEventId(noteData);

        // Create scheduled event record
        const scheduledEvent = {
            id: eventId,
            patternId: noteData.patternId,
            instrumentId: noteData.instrumentId,
            time: noteData.time,
            tick: noteData.tick,
            pitch: noteData.pitch,
            velocity: noteData.velocity,
            duration: noteData.duration,
            noteId: noteData.noteId,
            executed: false,
            cancelled: false,
            scheduledAt: performance.now()
        };

        this.scheduledEvents.set(eventId, scheduledEvent);
        this.stats.eventsScheduled++;

        // Delegate to audio engine for actual Web Audio scheduling
        this._scheduleAudioEvent(scheduledEvent);
    }

    /**
     * Schedule audio event via engine
     * Delegates to existing SchedulerService for actual Web Audio scheduling
     */
    _scheduleAudioEvent(event) {
        // ✅ SINGLE SOURCE OF TRUTH: Use directly injected schedulerService
        // No more audioEngine.schedulerService lookup - guaranteed same instance
        if (!this.schedulerService || typeof this.schedulerService.scheduleNote !== 'function') {
            console.error(`❌ [ContinuousScheduler] SchedulerService not available or invalid!`, {
                hasSchedulerService: !!this.schedulerService,
                hasScheduleNote: typeof this.schedulerService?.scheduleNote === 'function'
            });
            return;
        }

        // Calculate note duration in seconds
        const noteDurationSteps = event.duration;
        const noteDurationSeconds = noteDurationSteps * (this.transport.ticksPerStep / this.transport.ppq) * (60 / this.transport.bpm);

        // Create note object for SchedulerService
        const note = {
            id: event.noteId,
            pitch: event.pitch,
            velocity: event.velocity
        };

        // 🔍 DEBUG: Log first few scheduled notes to verify data
        if (this.stats.eventsScheduled < 3) {
            console.log(`🎵 [ContinuousScheduler] Scheduling note #${this.stats.eventsScheduled + 1}:`, {
                instrumentId: event.instrumentId,
                note,
                time: event.time.toFixed(3),
                duration: noteDurationSeconds.toFixed(3),
                audioContextTime: this.audioContext.currentTime.toFixed(3)
            });
        }

        try {
            // 🔍 DEBUG: Log SchedulerService state BEFORE calling scheduleNote
            const beforeSize = this.schedulerService.scheduledEvents?.size || 0;

            // Delegate to SchedulerService (which handles instrument access correctly)
            this.schedulerService.scheduleNote(
                event.instrumentId,
                note,
                event.time,
                noteDurationSeconds
            );

            // 🔍 DEBUG: Log SchedulerService state AFTER calling scheduleNote
            const afterSize = this.schedulerService.scheduledEvents?.size || 0;

            if (this.stats.eventsScheduled < 3) {
                console.log(`🔍 [ContinuousScheduler] scheduleNote() called:`, {
                    beforeMapSize: beforeSize,
                    afterMapSize: afterSize,
                    diff: afterSize - beforeSize,
                    hasScheduledEventsMap: !!this.schedulerService.scheduledEvents
                });
            }

            // ✅ FIX: Don't mark as executed here!
            // SchedulerService manages its own event lifecycle and will mark events as executed
            // when they're actually triggered. We just track that we scheduled it.
            this.stats.eventsScheduled++;
        } catch (error) {
            console.error(`❌ [ContinuousScheduler] Failed to schedule note:`, error);
        }
    }

    // =================== HELPER METHODS ===================

    /**
     * Detect position jump (loop restart, seek)
     *
     * ✅ IMPROVED: Loop-aware detection
     * - Standard backward jump: currentTick << lastScheduledTick
     * - Loop restart: currentTick near 0, lastScheduledTick near loopEnd
     * - Transport timing error: currentTick beyond loopEnd (e.g. tick 420)
     */
    _detectPositionJump(currentWindowStartTick) {
        if (this.lastScheduledTick < 0) return false;

        // Standard backward jump: current position way before last scheduled
        const jumpThreshold = 100; // ticks
        const expectedMinimum = this.lastScheduledTick - jumpThreshold;

        if (currentWindowStartTick < expectedMinimum) {
            return true; // Backward jump detected
        }

        // ✅ NEW: Loop restart detection (even if transport timing is wrong)
        // If we're near loop start AND last scheduled was near/past loop end
        if (this.transport.loop) {
            const loopEndTick = this.transport.loopEndTick;
            const loopStartTick = this.transport.loopStartTick || 0;
            const loopMargin = 50; // ticks from loop boundary

            // Current position near loop start (0-50 ticks)
            const nearLoopStart = currentWindowStartTick >= loopStartTick &&
                                  currentWindowStartTick < loopStartTick + loopMargin;

            // Last scheduled near or past loop end
            const nearOrPastLoopEnd = this.lastScheduledTick >= loopEndTick - loopMargin;

            if (nearLoopStart && nearOrPastLoopEnd) {
                return true; // Loop restart detected
            }

            // ✅ CRITICAL: Transport timing lag detection
            // If Transport hasn't reset currentTick yet after loop restart,
            // we'll be past loop end. Detect this to force loop restart.
            // Threshold: 20 ticks ≈ 100ms @ 120 BPM (covers 2-3 scheduler ticks)
            const lagThreshold = 20;
            const beyondLoopEnd = currentWindowStartTick > loopEndTick + lagThreshold;
            if (beyondLoopEnd && this.lastScheduledTick >= loopEndTick - loopMargin) {
                console.warn(`⚠️ [ContinuousScheduler] Transport tick beyond loop end: ${currentWindowStartTick.toFixed(1)} > ${loopEndTick} (loop restart lag)`);
                return true;
            }
        }

        return false; // No jump detected
    }

    /**
     * Get active pattern ID from store
     */
    _getActivePatternId() {
        // Try multiple paths for compatibility
        return this.patternStore?.activePatternId ||
               this.patternStore?.getState?.()?.activePatternId ||
               null;
    }

    /**
     * Generate unique event ID
     */
    _generateEventId(noteData) {
        return `${noteData.patternId}_${noteData.instrumentId}_${noteData.tick.toFixed(1)}_${noteData.pitch}`;
    }

    /**
     * Convert tick to time
     */
    _tickToTime(tick) {
        if (this.transport?.tickToTime) {
            return this.transport.tickToTime(tick);
        }

        // Fallback calculation
        const bpm = this.transport?.bpm || 120;
        const ppq = this.transport?.ppq || 96;
        const ticksPerBeat = ppq / 4;
        const beatsPerSecond = bpm / 60;
        const secondsPerTick = 1 / (ticksPerBeat * beatsPerSecond);

        return tick * secondsPerTick;
    }

    /**
     * Convert time to tick
     */
    _timeToTick(time) {
        if (this.transport?.timeToTick) {
            return this.transport.timeToTick(time);
        }

        // Fallback calculation
        const bpm = this.transport?.bpm || 120;
        const ppq = this.transport?.ppq || 96;
        const ticksPerBeat = ppq / 4;
        const beatsPerSecond = bpm / 60;
        const ticksPerSecond = ticksPerBeat * beatsPerSecond;

        return time * ticksPerSecond;
    }

    /**
     * Start ticker loop
     */
    _startTicker() {
        const tick = () => {
            if (!this.isRunning) return;

            this.tick();

            // Schedule next tick
            this.tickerHandle = setTimeout(tick, this.tickInterval);
        };

        // Start first tick
        tick();
    }

    /**
     * Get stats (for monitoring)
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            scheduledEventCount: this.scheduledEvents.size,
            dirtyPatternCount: this.dirtyPatterns.size
        };
    }
}
