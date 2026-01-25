// client/src/lib/core/services/PlaybackServiceAdapter.js
// Adapter to integrate ContinuousScheduler with existing PlaybackService
// Minimal changes to existing code, acts as bridge

import { ContinuousScheduler } from '../scheduling/ContinuousScheduler.js';
import EventBus from '../EventBus.js';

/**
 * PlaybackServiceAdapter
 *
 * Integrates ContinuousScheduler into PlaybackService with minimal code changes
 *
 * Migration strategy:
 * 1. Constructor: Initialize ContinuousScheduler
 * 2. play(): Start ContinuousScheduler
 * 3. stop(): Stop ContinuousScheduler
 * 4. Note handlers: Call markDirty() instead of reschedule
 * 5. Loop restart: Simplified (no reschedule needed)
 */
export class PlaybackServiceAdapter {
    /**
     * Initialize adapter
     * @param {Object} playbackService - Existing PlaybackService instance
     */
    constructor(playbackService) {
        this.playbackService = playbackService;
        this.engine = playbackService.engine;

        // ===== INITIALIZE CONTINUOUS SCHEDULER =====
        // ✅ FIX: Pass schedulerService directly to ensure single source of truth
        const schedulerService = this.playbackService.schedulerService;

        // 🔍 DEBUG: Verify we're using the right SchedulerService instance
        console.log('🔌 [PlaybackServiceAdapter] SchedulerService check:', {
            hasSchedulerService: !!schedulerService,
            fromPlaybackService: !!this.playbackService._schedulerService,
            fromEngine: !!this.engine.schedulerService,
            scheduledEventsMapSize: schedulerService?.scheduledEvents?.size || 0
        });

        this.continuousScheduler = new ContinuousScheduler(
            this.engine.transport,
            this._getPatternStore(), // Pattern store wrapper
            this.engine.audioContext,
            this.engine,
            schedulerService  // Pass schedulerService directly
        );

        // ===== FEATURE FLAG: Enable/disable new scheduler =====
        // ✅ ENABLED: Store access fixed via window.__stores
        this.useContinuousScheduler = true; // Set to false to fallback to old behavior

        console.log('🔌 [PlaybackServiceAdapter] Initialized', {
            useContinuousScheduler: this.useContinuousScheduler
        });

        // Bind to store changes for dirty flagging
        this._bindStoreEvents();
    }

    // =================== PATTERN STORE WRAPPER ===================

    /**
     * Get pattern store wrapper
     * Wraps Zustand store for compatibility with ContinuousScheduler
     * Defers to actual implementation which uses async import
     */
    _getPatternStore() {
        const self = this;

        return {
            get activePatternId() {
                // Defer to PlaybackService which has async access to store
                // ContinuousScheduler will call this during tick, after boot
                return self._getActivePatternIdSync();
            },
            get patterns() {
                return self._getPatternsSync();
            }
        };
    }

    /**
     * Get active pattern ID synchronously
     * Returns null during boot, actual value after boot complete
     */
    _getActivePatternIdSync() {
        try {
            // Read from global store (exposed by useArrangementStore.js)
            if (typeof window !== 'undefined' && window.__stores?.useArrangementStore) {
                return window.__stores.useArrangementStore.getState().activePatternId;
            }

            // Fallback: Try to get from PlaybackService state
            return this.playbackService?.activePatternId || null;
        } catch (e) {
            console.warn('[PlaybackServiceAdapter] Failed to get active pattern ID:', e);
            return null;
        }
    }

    /**
     * Get patterns synchronously
     * Returns empty object during boot, actual patterns after boot
     */
    _getPatternsSync() {
        try {
            // Read from global store (exposed by useArrangementStore.js)
            if (typeof window !== 'undefined' && window.__stores?.useArrangementStore) {
                return window.__stores.useArrangementStore.getState().patterns || {};
            }

            return {};
        } catch (e) {
            console.warn('[PlaybackServiceAdapter] Failed to get patterns:', e);
            return {};
        }
    }

    // =================== PLAYBACK LIFECYCLE HOOKS ===================

    /**
     * Hook: Called when playback starts
     * Starts ContinuousScheduler
     */
    onPlayStart() {
        if (!this.useContinuousScheduler) return;

        console.log('▶️ [PlaybackServiceAdapter] Starting ContinuousScheduler');

        // ✅ KEEP SchedulerService ticker running!
        // ContinuousScheduler schedules via SchedulerService, which needs its ticker to execute events
        // We DON'T stop it, but ContinuousScheduler controls WHAT gets scheduled
        if (this.playbackService?.schedulerService) {
            // Make sure SchedulerService ticker is running
            this.playbackService.schedulerService.start();
            console.log('▶️ [PlaybackServiceAdapter] SchedulerService ticker running (for event execution)');
        }

        this.continuousScheduler.start();
    }

    /**
     * Hook: Called when playback stops
     * Stops ContinuousScheduler
     */
    onPlayStop() {
        if (!this.useContinuousScheduler) return;

        console.log('⏹️ [PlaybackServiceAdapter] Stopping ContinuousScheduler');
        this.continuousScheduler.stop();
        this.continuousScheduler.clearAll();
    }

    /**
     * Hook: Called when playback pauses
     */
    onPlayPause() {
        if (!this.useContinuousScheduler) return;

        console.log('⏸️ [PlaybackServiceAdapter] Pausing ContinuousScheduler');
        this.continuousScheduler.stop();
    }

    /**
     * Hook: Called when playback resumes from pause
     */
    onPlayResume() {
        if (!this.useContinuousScheduler) return;

        console.log('▶️ [PlaybackServiceAdapter] Resuming ContinuousScheduler');
        this.continuousScheduler.start();
    }

    // =================== NOTE CHANGE HANDLERS ===================

    /**
     * Hook: Called when notes are added
     * Marks pattern as dirty instead of immediate reschedule
     */
    onNotesAdded(patternId, notes) {
        if (!this.useContinuousScheduler) return;

        console.log(`➕ [PlaybackServiceAdapter] Notes added to ${patternId}: ${notes.length} notes`);
        this.continuousScheduler.markDirty(patternId);
    }

    /**
     * Hook: Called when notes are removed
     */
    onNotesRemoved(patternId, noteIds) {
        if (!this.useContinuousScheduler) return;

        console.log(`➖ [PlaybackServiceAdapter] Notes removed from ${patternId}: ${noteIds.length} notes`);
        this.continuousScheduler.markDirty(patternId);
    }

    /**
     * Hook: Called when notes are modified
     */
    onNotesModified(patternId, notes) {
        if (!this.useContinuousScheduler) return;

        console.log(`✏️ [PlaybackServiceAdapter] Notes modified in ${patternId}: ${notes.length} notes`);
        this.continuousScheduler.markDirty(patternId);
    }

    /**
     * Hook: Called when pattern structure changes
     */
    onPatternChange(patternId) {
        if (!this.useContinuousScheduler) return;

        console.log(`🔄 [PlaybackServiceAdapter] Pattern changed: ${patternId}`);
        this.continuousScheduler.markDirty(patternId);
    }

    // =================== LOOP RESTART HANDLER ===================

    /**
     * Hook: Called on loop restart
     * With ContinuousScheduler, loop restart is NATURAL - no special handling needed!
     * Scheduler detects position jump automatically and adapts
     */
    onLoopRestart(event) {
        if (!this.useContinuousScheduler) return;

        console.log(`🔄 [PlaybackServiceAdapter] Loop restart (natural handling)`);
        // Nothing to do! ContinuousScheduler.tick() will detect position jump
        // and schedule ahead from new position automatically
    }

    // =================== STORE EVENT BINDING ===================

    /**
     * Bind to Zustand store changes for dirty flagging
     */
    _bindStoreEvents() {
        // Listen to pattern change events
        // ✅ CRITICAL: Listen to BOTH event formats for backward compatibility

        // Format 1: "pattern:notes-added" (newer format)
        EventBus.on('pattern:notes-added', (data) => {
            this.onNotesAdded(data.patternId, data.notes || [data.note]);
        });

        // Format 2: "NOTE_ADDED" (current format from AddNoteCommand)
        EventBus.on('NOTE_ADDED', (data) => {
            this.onNotesAdded(data.patternId, data.notes || [data.note]);
        });

        // Format 1: "pattern:notes-removed" (newer format)
        EventBus.on('pattern:notes-removed', (data) => {
            this.onNotesRemoved(data.patternId, data.noteIds || [data.noteId]);
        });

        // Format 2: "NOTE_REMOVED" (current format from RemoveNoteCommand)
        EventBus.on('NOTE_REMOVED', (data) => {
            this.onNotesRemoved(data.patternId, data.noteIds || [data.noteId]);
        });

        EventBus.on('pattern:notes-modified', (data) => {
            this.onNotesModified(data.patternId, data.notes || [data.note]);
        });

        EventBus.on('pattern:changed', (data) => {
            this.onPatternChange(data.patternId);
        });

        console.log('📡 [PlaybackServiceAdapter] Bound to EventBus for pattern changes (NOTE_ADDED, NOTE_REMOVED)');
    }

    // =================== STATS ===================

    /**
     * Get scheduler stats for monitoring
     */
    getStats() {
        if (!this.useContinuousScheduler) {
            return { enabled: false };
        }

        return {
            enabled: true,
            ...this.continuousScheduler.getStats()
        };
    }
}
