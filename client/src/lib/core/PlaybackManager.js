// lib/core/PlaybackManager.js
// DAWG - Enhanced Playback System with Song/Pattern Modes

import { NativeTimeUtils } from '../utils/NativeTimeUtils.js';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useArrangementWorkspaceStore } from '@/store/useArrangementWorkspaceStore';
// ✅ PHASE 1: Store Consolidation - useArrangementV2Store removed, use useArrangementStore instead
import EventBus from './EventBus.js';
import { PositionTracker } from './PositionTracker.js';
import { idleDetector } from '../utils/IdleDetector.js';
import { AutomationLane } from '@/features/piano_roll_v7/types/AutomationLane';
import { getAutomationManager } from '@/lib/automation/AutomationManager';

// ✅ NEW: Modular scheduler system
import {
    NoteScheduler,
    AutomationScheduler,
    AudioClipScheduler
} from './playback/index.js';
import { SampleAccurateTime } from './utils/SampleAccurateTime.js'; // ✅ NEW: For overlap detection timing

// ✅ PERFORMANCE: Debug logging flags - set to false in production
// This eliminates 81+ console.log calls during playback, saving ~2-5ms per frame
const DEBUG_PLAYBACK = false; // Set to true only for debugging playback issues
const DEBUG_LOOP = false;     // Set to true only for debugging loop restart issues
const DEBUG_SCHEDULING = false; // Set to true only for debugging note scheduling

// ✅ PERFORMANCE: Conditional logging helpers (no-op when disabled)
const logPlayback = DEBUG_PLAYBACK ? (...args) => console.log('🎵', ...args) : () => { };
const logLoop = DEBUG_LOOP ? (...args) => console.log('🔄', ...args) : () => { };
const logScheduling = DEBUG_SCHEDULING ? (...args) => console.log('📅', ...args) : () => { };

/**
 * ⚡ PERFORMANCE OPTIMIZATION: Debounced Scheduling System
 * Prevents excessive rescheduling when multiple notes are added/removed rapidly
 */
class SchedulingOptimizer {
    constructor() {
        this.pendingSchedule = null;
        // ✅ FAZ 1: Optimized debounce time for better real-time responsiveness
        this.scheduleDebounceTime = 16; // 16ms (60fps) - reduced from 50ms
        this.lastScheduleReason = '';
        this.scheduleCount = 0;
        this.priorityDelays = {
            idle: 16,    // ✅ FAZ 1: Reduced from 50ms to 16ms (60fps)
            realtime: 4, // ✅ FAZ 1: Reduced from 12ms to 4ms (250Hz)
            burst: 0
        };
        this.isPlaybackActive = false;
    }

    setPlaybackActivity(isActive) {
        this.isPlaybackActive = Boolean(isActive);
    }

    requestSchedule(callback, reason = 'unknown', priority = 'auto') {
        // Cancel any pending schedule
        if (this.pendingSchedule) {
            clearTimeout(this.pendingSchedule);
        }

        this.lastScheduleReason = reason;
        this.scheduleCount++;

        const resolvedPriority = this._resolvePriority(priority);
        const delay = this._getDelayForPriority(resolvedPriority);

        if (delay <= 0) {
            callback();
            this.pendingSchedule = null;
            return;
        }

        // Schedule new callback with debounce
        this.pendingSchedule = setTimeout(() => {
            callback();
            this.pendingSchedule = null;
        }, delay);
    }

    forceExecute(callback) {
        if (this.pendingSchedule) {
            clearTimeout(this.pendingSchedule);
            this.pendingSchedule = null;
        }
        callback();
    }

    isSchedulePending() {
        return this.pendingSchedule !== null;
    }

    getStats() {
        return {
            pending: this.pendingSchedule ? 1 : 0,
            scheduleCount: this.scheduleCount
        };
    }

    _resolvePriority(priority) {
        if (priority === 'auto') {
            return this.isPlaybackActive ? 'realtime' : 'idle';
        }
        return priority;
    }

    _getDelayForPriority(priority) {
        if (priority && typeof this.priorityDelays[priority] === 'number') {
            return this.priorityDelays[priority];
        }
        return this.scheduleDebounceTime;
    }
}

export class PlaybackManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.transport = audioEngine.transport;

        // ⚡ OPTIMIZATION: Initialize scheduling optimizer
        this.schedulingOptimizer = new SchedulingOptimizer();

        // ✅ NEW: Initialize position tracker
        this.positionTracker = new PositionTracker(this.transport);

        // ✅ REFACTOR: Initialize modular schedulers
        this.noteScheduler = new NoteScheduler(this.transport, this.audioEngine);
        this.automationScheduler = new AutomationScheduler(this.transport, this.audioEngine);
        this.audioClipScheduler = new AudioClipScheduler(this.transport, this.audioEngine);

        // ✅ EKLENDİ: Transport'tan gelen olayları dinlemek için.
        this._bindTransportEvents();

        // ✅ NEW: Centralized event management via EventBus
        this._bindGlobalEvents();

        // ✅ NEW: Dirty state tracking for targeted scheduling
        this.dirtyState = {
            instruments: new Set(),
            automation: new Set(),
            clips: new Set(),
            global: true,
            reason: 'bootstrap'
        };

        // Playback state
        this.currentMode = 'pattern'; // 'pattern' | 'song'
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPosition = 0; // in steps
        this._isLoopRestarting = false; // ✅ FIX: Track loop restart state to prevent send/unsend during restart

        // Loop settings
        this.loopEnabled = true;
        this.loopStart = 0; // in steps
        this.loopEnd = 64; // in steps
        this.isAutoLoop = true; // Auto calculate loop points
        // ✅ REMOVED: Pre-roll system removed for DAW-standard loop behavior
        // Pre-roll caused timing inconsistencies and conflicts with loop restart
        // DAW-standard: Loop restart is immediate and seamless, no pre-roll needed

        // Pattern mode settings
        this.activePatternId = null;
        this.patternLength = 64;

        // Song mode settings
        this.songLength = 256; // in bars
        this.playbackCursor = 0; // Current playback position in song

        // Scheduling
        this.scheduledEvents = new Map();
        this.automationEvents = new Map();
        this.nextEventTime = Infinity;

        // ✅ REFACTOR: activeAudioSources moved to AudioClipScheduler
        // Access via: this.audioClipScheduler.getActiveSources()

        // ✅ FIX 1: Initialize active notes tracking (will be cleared on stop/loop restart)
        // Note: activeNotesByPitch is now managed by NoteScheduler instance-level

    }

    /**
     * @private
     * Transport'tan gelen temel olayları (döngü gibi) dinler ve
     * bunlara göre yeniden planlama yapar.
     */
    _bindTransportEvents() {
        // ✅ MERKEZI LOOP HANDLING - Transport loop event'ini yakala
        this.transport.on('loop', (data) => {
            const { nextLoopStartTime, time, fromTick, toTick } = data;

            if (DEBUG_LOOP) logLoop('[LOOP EVENT] Transport loop event received:', {
                nextLoopStartTime: nextLoopStartTime?.toFixed(3),
                time: time?.toFixed(3),
                fromTick,
                toTick
            });

            // ✅ MERKEZI RESTART HANDLING
            this._handleLoopRestart(nextLoopStartTime || time);
        });

        // ✅ BONUS: Diğer transport event'leri de merkezi olarak yönet
        this.transport.on('start', (data) => {
            this._emit('transportStart', data);
        });

        this.transport.on('stop', (data) => {

            // ✅ PHASE 4: Stop all real-time automations
            this.automationScheduler.stopAllRealtimeAutomations();

            // ✅ FIX: Reset position tracker and emit accurate position
            this.positionTracker.clearCache();
            this.currentPosition = 0;

            const position = this.positionTracker.jumpToStep(0);
            const positionData = {
                step: position.step,
                tick: position.tick,
                bbt: position.bbt,
                formatted: position.bbt
            };
            this._emit('positionUpdate', positionData);

            this._emit('transportStop', data);
        });

        this.transport.on('pause', (data) => {

            // ✅ PHASE 4: Stop all real-time automations on pause
            this.automationScheduler.stopAllRealtimeAutomations();

            // ✅ FIX: Get accurate position from PositionTracker and preserve it
            const position = this.positionTracker.getDisplayPosition();
            this.currentPosition = position.stepFloat;

            const positionData = {
                step: position.stepFloat,
                tick: position.tick,
                bbt: position.bbt,
                formatted: position.display
            };

            this._emit('positionUpdate', positionData);

            this._emit('transportPause', data);
        });

        this.transport.on('bar', (data) => {
            // Bar değişikliklerini UI'a bildir
            this._emit('barChange', data);
        });

        // ✅ BPM değişikliklerini dinle ve smooth transition sağla
        this.transport.on('bpm', (data) => {
            const { bpm, oldBpm, wasPlaying } = data;

            if (wasPlaying) {
                // BPM değişikliği sırasında playback devam ediyorsa,
                // yeniden scheduling YAP ama loop pozisyonunu KORUMA
                this._scheduleContent(null, 'bpm-change', true);
            }

            this._emit('bpmChange', { bpm, oldBpm, wasPlaying });
        });
    }

    /**
     * ✅ NEW: Centralized global event management
     * Handles all pattern/note changes through EventBus to prevent conflicts
     */
    _bindGlobalEvents() {
        // ✅ CRITICAL: Central pattern change handler
        EventBus.on('PATTERN_CHANGED', (data) => {
            this._handlePatternChange(data);
        });

        // ✅ CRITICAL: Central note events
        EventBus.on('NOTE_ADDED', (data) => {
            this._handleNoteAdded(data);
        });

        EventBus.on('NOTE_REMOVED', (data) => {
            this._handleNoteRemoved(data);
        });

        EventBus.on('NOTE_MODIFIED', (data) => {
            this._handleNoteModified(data);
        });

    }

    _markInstrumentDirty(instrumentId) {
        if (!instrumentId) return;
        this.dirtyState.instruments.add(instrumentId);
    }

    _markAllDirty(reason = 'manual') {
        this.dirtyState.global = true;
        this.dirtyState.reason = reason;
    }

    _resetDirtyState() {
        this.dirtyState.instruments.clear();
        this.dirtyState.automation.clear();
        this.dirtyState.clips.clear();
        this.dirtyState.global = false;
        this.dirtyState.reason = null;
    }

    _resolveInstrumentTargets(scope, explicitIds) {
        if (Array.isArray(explicitIds) && explicitIds.length) {
            return Array.from(new Set(explicitIds));
        }
        if (typeof explicitIds === 'string' && explicitIds) {
            return [explicitIds];
        }
        if (scope === 'notes') {
            return Array.from(this.dirtyState.instruments);
        }
        return null;
    }

    /**
     * ✅ NEW: Centralized pattern change handler
     * @param {Object} data - {patternId, changeType, ...}
     */
    _handlePatternChange(data) {
        const { patternId, changeType } = data;

        // Only handle active pattern changes
        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) {
            return;
        }

        this._markAllDirty(`pattern-${changeType || 'change'}`);

        // Pattern structure changes require full reschedule
        if (['structure-change', 'pattern-switch'].includes(changeType)) {
            this._scheduleContent(null, `pattern-${changeType}`, true);
        }
    }

    /**
     * ✅ NEW: Handle note addition with smart scheduling
     * @param {Object} data - {patternId, instrumentId, note}
     */
    _handleNoteAdded(data) {
        const { patternId, instrumentId, note } = data;

        console.log('🎵 PlaybackManager._handleNoteAdded:', {
            patternId,
            instrumentId,
            note,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused
        });

        // Only handle active pattern
        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) {
            console.log('⚠️ Note added to inactive pattern, ignoring');
            return;
        }

        if (instrumentId) {
            this._markInstrumentDirty(instrumentId);
        }

        // ✅ CRITICAL FIX: During active playback, only use immediate scheduling
        // Don't call _scheduleContent because it will clear and reschedule all notes,
        // which can cause timing issues and break scheduling
        // When paused or stopped, notes are added to pattern data and will play when resumed/started
        if (this.isPlaying) {
            if (this.isPaused) {
                console.log('⏸️ Paused - note added to pattern, will play when resumed');
                // When paused, schedule content will be called on resume
                this._scheduleContent(null, 'note-added', false, {
                    scope: 'notes',
                    instrumentIds: instrumentId ? [instrumentId] : null,
                    priority: 'auto'
                });
            } else {
                console.log('✅ Playback active - scheduling note immediately (skipping _scheduleContent to avoid conflicts)');
                // ✅ FIX: Only use immediate scheduling during active playback
                // _scheduleContent would clear and reschedule all notes, causing timing issues
                this._scheduleNewNotesImmediate([{ instrumentId, note }]);
                // Don't call _scheduleContent here - it would conflict with immediate scheduling
            }
        } else {
            console.log('⏹️ Stopped - note will play when playback starts');
            // When stopped, schedule content will be called on play
            this._scheduleContent(null, 'note-added', false, {
                scope: 'notes',
                instrumentIds: instrumentId ? [instrumentId] : null,
                priority: 'auto'
            });
        }
    }

    /**
     * ✅ SCHEDULE OPT: Handle note removal with immediate cancellation
     * @param {Object} data - {patternId, instrumentId, noteId, note}
     */
    _handleNoteRemoved(data) {
        const { patternId, instrumentId, noteId, note } = data;

        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;

        console.log('🎵 PlaybackManager._handleNoteRemoved:', {
            patternId,
            instrumentId,
            noteId,
            note,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused
        });

        // ✅ SCHEDULE OPT: If note is currently playing, stop it immediately
        if (this.isPlaying && !this.isPaused && note && instrumentId) {
            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (instrument && note.pitch) {
                try {
                    // Stop the note if it's currently playing
                    if (typeof instrument.releaseNote === 'function') {
                        instrument.releaseNote(note.pitch);
                    }
                } catch (e) {
                    console.error('Error stopping removed note:', e);
                }
            }
        }

        // ✅ CRITICAL FIX: During active playback, only cancel scheduled events
        // Don't call _scheduleContent because it will clear and reschedule all notes,
        // which can cause timing issues and break scheduling
        // When paused or stopped, notes are removed from pattern data and will not play when resumed/started
        if (this.isPlaying) {
            if (this.isPaused) {
                console.log('⏸️ Paused - note removed from pattern, will not play when resumed');
                // When paused, schedule content will be called on resume
                this._scheduleContent(null, 'note-removed', false, {
                    scope: 'notes',
                    instrumentIds: instrumentId ? [instrumentId] : null,
                    priority: 'auto'
                });
            } else {
                console.log('✅ Playback active - cancelling note immediately (skipping _scheduleContent to avoid conflicts)');

                // ✅ SCHEDULE OPT: Cancel future scheduled events for this note
                if (this.transport && this.transport.clearScheduledEvents) {
                    const noteIdToCancel = noteId || (note && note.id);
                    if (noteIdToCancel) {
                        console.log('🗑️ Cancelling scheduled events for note:', noteIdToCancel);

                        // Cancel scheduled events matching this note ID
                        this.transport.clearScheduledEvents((eventData) => {
                            // Check if event is for this note (noteId or note.id match)
                            if (!eventData) return false;
                            return eventData.noteId === noteIdToCancel ||
                                (eventData.note && eventData.note.id === noteIdToCancel);
                        });
                    }
                }

                // Don't call _scheduleContent here - it would conflict with immediate cancellation
            }
        } else {
            console.log('⏹️ Stopped - note will not play when playback starts');
            // When stopped, schedule content will be called on play
            this._scheduleContent(null, 'note-removed', false, {
                scope: 'notes',
                instrumentIds: instrumentId ? [instrumentId] : null,
                priority: 'auto'
            });
        }

        // Mark instrument as dirty for next scheduling cycle
        if (instrumentId) {
            this._markInstrumentDirty(instrumentId);
        }
    }

    /**
     * ✅ NEW: Handle note modification
     * @param {Object} data - {patternId, instrumentId, note, oldNote}
     */
    _handleNoteModified(data) {
        const { patternId, instrumentId, note, oldNote } = data;

        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;

        if (instrumentId) {
            this._markInstrumentDirty(instrumentId);
        }

        // ✅ CRITICAL FIX: If note is currently playing, stop it immediately
        // This prevents stuck notes when modifying a note during playback
        if (this.isPlaying && !this.isPaused && oldNote && instrumentId) {
            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (instrument && oldNote.pitch) {
                try {
                    // Stop the old note if it's currently playing
                    // Use releaseNote for graceful stop (respects ADSR release)
                    if (typeof instrument.releaseNote === 'function') {
                        instrument.releaseNote(oldNote.pitch);
                    } else if (typeof instrument.noteOff === 'function') {
                        // Fallback to noteOff if releaseNote not available
                        instrument.noteOff(oldNote.pitch);
                    }
                    if (import.meta.env.DEV) {
                        console.log('🛑 Stopping old note during modification:', {
                            instrumentId,
                            oldPitch: oldNote.pitch,
                            newPitch: note.pitch,
                            noteId: note.id
                        });
                    }
                } catch (e) {
                    console.error('Error stopping modified note:', e);
                }
            }

            // ✅ Cancel scheduled events for the old note
            if (this.transport && this.transport.clearScheduledEvents) {
                const noteIdToCancel = oldNote.id || note.id;
                if (noteIdToCancel) {
                    if (import.meta.env.DEV) {
                        console.log('🗑️ Cancelling scheduled events for modified note:', noteIdToCancel);
                    }

                    // Cancel scheduled events matching this note ID
                    this.transport.clearScheduledEvents((eventData) => {
                        if (!eventData) return false;
                        return eventData.noteId === noteIdToCancel ||
                            (eventData.note && eventData.note.id === noteIdToCancel);
                    });
                }
            }
        }

        // For note modifications, treat as remove + add
        if (this.isPlaying && !this.isPaused) {
            this._scheduleNewNotesImmediate([{ instrumentId, note }]);
        }

        this._scheduleContent(null, 'note-modified', false, {
            scope: 'notes',
            instrumentIds: instrumentId ? [instrumentId] : null,
            priority: this.isPlaying && !this.isPaused ? 'realtime' : 'auto'
        });
    }

    /**
     * ✅ SIMPLIFIED: Loop restart handler - minimal work, just stop notes and reset position
     * @param {number} nextStartTime - Bir sonraki loop'un başlangıç zamanı
     */
    _handleLoopRestart(nextStartTime = null) {
        if (!this.isPlaying) {
            return; // Silent skip - not playing
        }

        // ✅ CRITICAL FIX: Mark loop restart in progress to prevent send/unsend operations
        // This prevents vaSynth notes from getting stuck when send/unsend happens during loop restart
        this._isLoopRestarting = true;

        // ✅ Pre-roll system removed for DAW-standard loop behavior

        // ✅ STEP 2: Stop only notes outside loop boundaries (DAW-like behavior)
        // This allows notes in the last step and sustain/release notes to continue playing
        // ✅ FIX: Use longer fade-out (20ms) for long samples (like 808s) to prevent clicks
        this._stopNotesOutsideLoop(0.02); // 20ms fade-out for graceful stop

        // ✅ FIX: Don't clear all active notes tracking - only clear notes that were stopped
        // This preserves tracking for notes that continue playing (sustain/release)
        // Note: We'll update active notes tracking after stopping notes outside loop
        // The NoteScheduler will handle cleanup of stopped notes automatically

        // ✅ STEP 2: Reset position to 0 (beginning)
        this.currentPosition = 0;

        // ✅ CRITICAL FIX: Do NOT call transport.setPosition(0) on loop restart!
        // NativeTransportSystem already resets currentTick = 0 in advanceToNextTick()
        // Calling setPosition() here would reset nextTickTime to currentTime,
        // which shortens the loop by ~140ms (the lookahead time)
        // This was causing the "second loop too fast" bug
        // Only update our internal currentPosition, let transport handle its own timing

        // ✅ STEP 4: Clear only scheduled events outside loop boundaries (DAW-like behavior)
        // This preserves events in the last step and sustain/release events
        // Events inside the loop will be preserved and can continue playing
        this._clearEventsOutsideLoop();

        // ✅ STEP 5: ALWAYS reschedule on loop restart
        // Even if pattern hasn't changed, we need to reschedule because:
        // 1. Position was reset to loopStart
        // 2. Scheduled events were cleared
        // 3. Notes need to be scheduled from the new loop start position
        // ✅ CRITICAL FIX: For loop restart, step 0 should start exactly when loop ends
        // Loop end time is when step (loopEnd - 1) completes
        // Step 0 starts immediately after (seamless transition, no gap)
        // Use nextStartTime if provided (from transport), otherwise calculate from loop end
        // ✅ SIMPLIFIED: Use nextStartTime directly (already has lookahead from transport)
        let scheduledTarget = nextStartTime;
        if (!scheduledTarget || !Number.isFinite(scheduledTarget)) {
            scheduledTarget = this.transport.audioContext.currentTime;
        }

        // ✅ Schedule immediately - loop restart needs instant scheduling
        this._scheduleContent(scheduledTarget, 'loop-restart', true, {
            scope: 'all',
            priority: 'burst',
            force: true
        });

        // Emit event and clear flag
        this._emit('loopRestart', {
            time: scheduledTarget,
            tick: 0,
            step: 0,
            mode: this.currentMode,
            patternId: this.activePatternId
        });

        this._isLoopRestarting = false;
    }

    // =================== MODE MANAGEMENT ===================

    setPlaybackMode(mode) {
        if (this.currentMode === mode) return;


        this.currentMode = mode;
        this._updateLoopSettings();

        // ✅ FIX: If playing, reschedule content for new mode (don't stop/restart)
        if (this.isPlaying) {
            this._scheduleContent(null, `mode-change-${mode}`, true);
        }
    }

    getPlaybackMode() {
        return this.currentMode;
    }

    // ✅ Alias for convenience (used by PlaybackController)
    getCurrentMode() {
        return this.currentMode;
    }

    // =================== LOOP MANAGEMENT ===================

    setLoopPoints(startStep, endStep) {
        this.loopStart = Math.max(0, startStep);
        this.loopEnd = Math.max(this.loopStart + 1, endStep);
        this.isAutoLoop = false;

        // Update transport loop
        this._updateTransportLoop();

        // ⚡ OPTIMIZATION: Detailed loop logging only when needed (removed duplicate)
    }

    enableAutoLoop() {
        this.isAutoLoop = true;
        this._updateLoopSettings();
    }

    setLoopEnabled(enabled) {
        this.loopEnabled = enabled;
        this._updateTransportLoop();
    }

    setBPM(bpm) {
        if (this.transport && this.transport.setBPM) {
            this.transport.setBPM(bpm);
        }
    }

    _updateLoopSettings() {
        if (!this.isAutoLoop) return;

        // ⚡ OPTIMIZATION: Debounce loop settings update to prevent excessive calculations
        this.schedulingOptimizer.requestSchedule(() => {
            if (this.currentMode === 'pattern') {
                this._calculatePatternLoop();
            } else {
                this._calculateSongLoop();
            }

            this._updateTransportLoop();
        }, 'loop-settings-update');
    }

    _updateLoopSettingsImmediate() {
        if (!this.isAutoLoop) return;

        if (this.currentMode === 'pattern') {
            this._calculatePatternLoop();
        } else {
            this._calculateSongLoop();
        }

        this._updateTransportLoop();
    }

    _getLoopDurationSeconds() {
        if (!this.transport || typeof this.transport.stepsToSeconds !== 'function') {
            return 0;
        }
        const loopLengthSteps = Math.max(1, this.loopEnd - this.loopStart);
        return this.transport.stepsToSeconds(loopLengthSteps);
    }

    // ✅ REMOVED: Pre-roll system completely removed for DAW-standard loop behavior
    // Pre-roll caused timing inconsistencies and conflicts with loop restart
    // DAW-standard: Loop restart is immediate and seamless, no pre-roll needed

    _calculatePatternLoop() {
        const arrangementStore = useArrangementStore.getState();
        const activePatternId = arrangementStore.activePatternId;
        const activePattern = arrangementStore.patterns[activePatternId];

        if (!activePattern || !activePattern.data) {
            this.loopStart = 0;
            this.loopEnd = 64; // 4 bar * 16 step/bar
            this.patternLength = 64;
            return;
        }


        // Pattern içindeki en son notanın bittiği adımı (step) hesapla
        let maxStep = 0;
        const instrumentDetails = {};

        Object.entries(activePattern.data).forEach(([instrumentId, notes]) => {
            if (Array.isArray(notes) && notes.length > 0) {
                let instrumentMaxStep = 0;
                notes.forEach(note => {
                    const noteTime = this._getNoteStartStep(note);
                    const noteDuration = this._getNoteLengthInSteps(note);
                    const noteEnd = noteTime + noteDuration;
                    instrumentMaxStep = Math.max(instrumentMaxStep, noteEnd);
                });
                instrumentDetails[instrumentId] = {
                    noteCount: notes.length,
                    maxStep: instrumentMaxStep
                };
                maxStep = Math.max(maxStep, instrumentMaxStep);
            }
        });


        // ✅ FIX: Pattern uzunluğunu gerçek uzunluğa göre ayarla
        // En az 1 bar (16 step) olmalı, ama pattern'in gerçek uzunluğunu kullan
        // En yakın bar sayısına yukarı yuvarla (1 bar = 16 step)
        // ÖNCEKİ SORUN: Math.max(64, ...) her zaman en az 4 bar yapıyordu
        // YENİ: Pattern'in gerçek uzunluğunu kullan, minimum 1 bar (16 step)
        const calculatedLength = Math.ceil(maxStep / 16) * 16;
        this.patternLength = Math.max(16, calculatedLength); // Minimum 1 bar (16 step)
        this.loopStart = 0;
        this.loopEnd = this.patternLength;

        if (import.meta.env.DEV) {
            console.log(`🔄 Pattern loop calculated:`, {
                maxStep,
                calculatedLength,
                patternLength: this.patternLength,
                loopEnd: this.loopEnd,
                bars: this.patternLength / 16
            });
        }

    }

    _calculateSongLoop() {
        // ✅ PHASE 1: Store Consolidation - Use unified store
        const arrangementStore = useArrangementStore.getState();
        // Try arrangement clips first (new system), fallback to pattern clips (old system)
        const arrangementClips = arrangementStore.arrangementClips || [];

        let clips;
        if (arrangementClips.length > 0) {
            clips = arrangementClips;
        } else {
            clips = arrangementStore.clips || [];
        }

        if (clips.length === 0) {
            this.loopStart = 0;
            this.loopEnd = 256; // Default song length in steps
            return;
        }

        // Find the last clip end time
        let lastEnd = 0;
        clips.forEach(clip => {
            const clipEnd = (clip.startTime || 0) + (clip.duration || 4);
            lastEnd = Math.max(lastEnd, clipEnd);
        });

        // Convert bars to steps (assuming 4 beats per bar, 4 steps per beat)
        this.songLength = Math.max(16, Math.ceil(lastEnd / 4) * 4); // Round to bars
        this.loopStart = 0;
        this.loopEnd = this.songLength * 16; // Convert bars to steps

    }

    _updateTransportLoop() {
        if (this.transport) {
            // ✅ FIX: Always set loop start to 0 so transport resets to beginning
            console.log('🔄 [UPDATE LOOP] Updating transport loop points:', {
                loopStart: 0,
                loopEnd: this.loopEnd,
                loopEnabled: this.loopEnabled,
                transportLoopStartTick: this.transport.loopStartTick,
                transportLoopEndTick: this.transport.loopEndTick
            });
            this.transport.setLoopPoints(0, this.loopEnd);
            this.transport.setLoopEnabled(this.loopEnabled);
            console.log('🔄 [UPDATE LOOP] Transport loop points updated:', {
                transportLoopStartTick: this.transport.loopStartTick,
                transportLoopEndTick: this.transport.loopEndTick,
                transportLoopStartStep: this.transport.ticksToSteps(this.transport.loopStartTick).toFixed(2),
                transportLoopEndStep: this.transport.ticksToSteps(this.transport.loopEndTick).toFixed(2)
            });
        }
    }

    // =================== PLAYBACK CONTROLS ===================

    async play(startStep = null) {
        if (this.isPlaying && !this.isPaused) return;

        // ✅ CRITICAL FIX: If paused, always use resume() regardless of startStep
        // This ensures position is preserved even when position is explicitly passed
        if (this.isPaused) {
            console.log('🎵 PlaybackManager.play() called while paused, using resume() instead');
            return this.resume();
        }

        try {
            const startTime = this.audioEngine.audioContext.currentTime;

            // ✅ SIMPLIFIED POSITION LOGIC: Clear and predictable
            let playPosition = this.currentPosition; // Default to current position

            if (startStep !== null) {
                // EXPLICIT POSITION: Jump to requested position
                playPosition = startStep;
                this.jumpToStep(startStep);
            } else {
                // FRESH START: Use current position (may have been set by timeline click)
                playPosition = this.currentPosition;
            }

            this._updateLoopSettingsImmediate(); // Force immediate loop update for playback start

            console.log('🎵 PlaybackManager: Calling _scheduleContent()', { startTime, reason: 'playback-start' });
            this._scheduleContent(startTime, 'playback-start', true); // Force immediate scheduling for playback start
            console.log('✅ PlaybackManager: _scheduleContent() completed');

            // ⚡ IDLE OPTIMIZATION: Resume AudioContext if suspended
            // ✅ FIX: Add small delay after resume to prevent click at playback start
            if (this.audioEngine.audioContext.state === 'suspended') {
                await this.audioEngine.audioContext.resume();
                console.log('🎵 AudioContext resumed for playback');
                // ✅ FIX: Small delay after resume to let AudioContext stabilize (prevents click)
                await new Promise(resolve => setTimeout(resolve, 5)); // 5ms delay
            }

            // ✅ FIX: Add minimum delay before transport start to prevent click at bar start
            // This ensures AudioContext is fully ready and prevents timing issues
            const minStartDelay = 0.002; // 2ms minimum delay
            const adjustedStartTime = Math.max(startTime + minStartDelay, this.audioEngine.audioContext.currentTime + minStartDelay);

            console.log('🎵 PlaybackManager: Starting transport at', adjustedStartTime);
            this.transport.start(adjustedStartTime);
            console.log('✅ PlaybackManager: Transport started');

            // ✅ CRITICAL FIX: Set position AFTER start() to prevent transport from resetting it
            // start() will preserve the position if it was already set, but we need to ensure
            // it's set after start() to override any reset that might have happened
            if (this.transport.setPosition) {
                this.transport.setPosition(playPosition);
            }

            // ✅ Pre-roll system removed for DAW-standard loop behavior

            this.isPlaying = true;
            this.isPaused = false;
            this.schedulingOptimizer.setPlaybackActivity(true);

            // ⚡ IDLE OPTIMIZATION: Notify idle detector that we're playing
            idleDetector.setPlaying(true);

            // usePlaybackStore.getState().setPlaybackState('playing'); // ✅ Handled by PlaybackController
        } catch (error) {
            console.error('PlaybackManager.play failed:', error);
            this.stop();
        }
    }

    pause() {
        if (!this.isPlaying || this.isPaused) {
            return;
        }

        try {
            // ✅ FIX: Sync current position before pausing (keep current position, don't reset)
            this.currentPosition = this.transport.ticksToSteps(this.transport.currentTick);

            this.transport.pause();

            // ✅ REFACTOR: Stop all active audio sources via AudioClipScheduler
            this.audioClipScheduler.stopAll();

            this.isPaused = true;
            this.schedulingOptimizer.setPlaybackActivity(false);
            // ✅ Pre-roll system removed


            // Notify stores
            // usePlaybackStore.getState().setPlaybackState('paused'); // ✅ Handled by PlaybackController

        } catch (error) {
            console.error('PlaybackManager.pause failed:', error);
        }
    }

    resume() {
        if (!this.isPaused) {
            return;
        }

        try {
            const startTime = this.audioEngine.audioContext.currentTime;

            // ✅ CRITICAL FIX: Set transport position to currentPosition before starting
            // This ensures transport starts from the paused position, not from 0
            if (this.transport.setPosition) {
                this.transport.setPosition(this.currentPosition);
                console.log(`▶️ Resume: Set transport position to ${this.currentPosition} steps`);
            }

            // ✅ CRITICAL FIX: Transport start() will check isPaused and preserve position
            this.transport.start(startTime);

            this.isPlaying = true;
            this.isPaused = false;
            this.schedulingOptimizer.setPlaybackActivity(true);


            // ✅ CRITICAL FIX: Reschedule content from current position
            this._scheduleContent(startTime, 'resume', true);
            // ✅ Pre-roll system removed for DAW-standard loop behavior

            // Notify stores
            // usePlaybackStore.getState().setPlaybackState('playing'); // ✅ Handled by PlaybackController

        } catch (error) {
            console.error('PlaybackManager.resume failed:', error);
        }
    }

    stop() {
        if (!this.isPlaying && !this.isPaused) return;

        try {
            this.transport.stop();

            // ✅ OPTIMIZATION: Only stop instruments that are actually playing
            let stoppedCount = 0;
            let skippedCount = 0;

            this.audioEngine.instruments.forEach((instrument) => {
                try {
                    // Check if instrument is actually playing before stopping
                    const isPlaying = instrument.isPlaying ||
                        (instrument.activeSources && instrument.activeSources.size > 0) ||
                        (instrument.activeNotes && instrument.activeNotes.size > 0);

                    if (isPlaying && typeof instrument.stopAll === 'function') {
                        instrument.stopAll(); // VASynth, Sampler instant stop
                        stoppedCount++;
                    } else {
                        skippedCount++;
                    }
                } catch (e) {
                    console.error('Error stopping instrument:', e);
                }
            });
            console.log('PlaybackManager.stop summary:', { stoppedCount, skippedCount });


            // ✅ REFACTOR: Stop all active audio sources via AudioClipScheduler
            this.audioClipScheduler.stopAll();

            // ✅ FIX 1: Clear active notes tracking on stop
            this.noteScheduler.clearActiveNotes();

            // ✅ NEW: Flush all effect tails (delay, reverb, etc.)
            this._flushAllEffects();

            this._clearScheduledEvents();

            this.isPlaying = false;
            this.isPaused = false;
            this.schedulingOptimizer.setPlaybackActivity(false);

            // ⚡ IDLE OPTIMIZATION: Notify idle detector that we stopped
            idleDetector.setPlaying(false);

            // ✅ DAW STANDARD: Always reset to 0 on stop (expected behavior)
            this.currentPosition = 0;
            if (this.transport.setPosition) {
                this.transport.setPosition(0);
            }

            // Update UI position
            usePlaybackStore.setState({
                transportPosition: '1:1:0',
                transportStep: 0
            });

            // usePlaybackStore.getState().setPlaybackState('stopped'); // ✅ Handled by PlaybackController
        } catch (error) {
            console.error('PlaybackManager.stop failed:', error);
        }
    }

    // =================== POSITION MANAGEMENT ===================

    jumpToStep(step) {
        // ✅ SIMPLIFIED: Always immediate jump, regardless of state
        const targetStep = Math.max(0, Math.min(step, this.loopEnd - 1));


        // ALWAYS set position immediately
        this.currentPosition = targetStep;

        if (this.transport.setPosition) {
            this.transport.setPosition(targetStep);
        }

        // ✅ CRITICAL FIX: Stop all active instrument voices BEFORE clearing scheduled events
        // This prevents stuck notes from VASynth voices that are still releasing
        // Especially important for instruments with long release envelopes (e.g., warmpad)
        if (this.isPlaying) {
            this._stopAllActiveNotes();
        }

        // Clear any scheduled events to prevent conflicts
        this._clearScheduledEvents();

        // If playing, reschedule from new position
        if (this.isPlaying) {
            this._scheduleContent(null, 'position-jump', false);
        }

        // ✅ IMMEDIATE: Emit position update for UI sync
        const positionData = {
            step: targetStep,
            formatted: this._formatPosition(targetStep)
        };
        this._emit('positionUpdate', positionData);
    }

    // ✅ REMOVED: Smart jump complexity - now using simple immediate jump only

    jumpToBar(bar) {
        const targetStep = (bar - 1) * 16; // 16 steps per bar
        this.jumpToStep(targetStep);
    }

    /**
     * ⚠️ DEPRECATED: Use EventBus-based pattern change handlers instead
     * This method is kept for backward compatibility but should not be used
     * @deprecated Use EventBus.emit('NOTE_ADDED', data) instead
     */
    onPatternChanged() {

        // Only log for debugging, don't actually process
        // This prevents double-scheduling issues
    }

    /**
     * ⚡ OPTIMIZED: Handle active pattern switch with immediate scheduling
     * Called when switching between different patterns
     */
    onActivePatternChanged(newPatternId, reason = 'pattern-switch') {

        // Pattern switches need immediate scheduling to prevent audio gaps
        this._markAllDirty(`active-pattern-${reason}`);
        this._scheduleContent(null, `active-pattern-${reason}`, true);
    }

    jumpToTime(timeInSeconds) {
        const targetStep = this._secondsToSteps(timeInSeconds);
        this.jumpToStep(targetStep);
    }

    getCurrentPosition() {
        // ✅ OPTIMIZED: Simplified position calculation without logging
        const position = this.positionTracker.getCurrentPosition();

        // During active playback, ensure loop bounds
        if (this.isPlaying && !this.isPaused) {
            const loopLength = this.loopEnd - this.loopStart;
            if (loopLength > 0) {
                const relativeStep = (position.stepFloat - this.loopStart) % loopLength;
                return this.loopStart + Math.max(0, relativeStep);
            }
            return position.stepFloat;
        }

        // For stopped/paused states, use stored position
        return this.currentPosition;
    }
    // =================== CONTENT SCHEDULING ===================

    /**
     * Public API to force rescheduling of content
     * @param {string} reason - Reason for rescheduling
     * @param {boolean} force - Whether to force immediate scheduling without debounce
     */
    reschedule(reason = 'manual', force = false) {
        // Use null for startTime to default to AudioContext.currentTime inside _scheduleContent
        this._scheduleContent(null, reason, force);
    }

    /**
     * ⚡ OPTIMIZED: Debounced content scheduling to prevent excessive rescheduling
     * @param {number} startTime - İçeriğin planlanacağı başlangıç zamanı
     * @param {string} reason - Scheduling reason for debugging
     * @param {boolean} force - Force immediate execution without debouncing
     */
    _scheduleContent(startTime = null, reason = 'manual', force = false, options = {}) {
        const {
            scope = 'auto',
            instrumentIds = null,
            priority = 'auto',
            append = false
        } = options;

        let resolvedScope = scope;
        const appendMode = Boolean(append);
        const explicitInstrumentTargets = this._resolveInstrumentTargets('notes', instrumentIds);

        if (resolvedScope === 'auto') {
            resolvedScope = (explicitInstrumentTargets && explicitInstrumentTargets.length) || this.dirtyState.instruments.size > 0
                ? 'notes'
                : 'all';
        }

        if (appendMode) {
            resolvedScope = 'all';
        }

        if (this.dirtyState.global || this.currentMode === 'song' || force) {
            resolvedScope = 'all';
        }

        const instrumentTargets = resolvedScope === 'notes'
            ? (explicitInstrumentTargets && explicitInstrumentTargets.length
                ? explicitInstrumentTargets
                : this._resolveInstrumentTargets('notes'))
            : null;
        const targetSet = instrumentTargets && instrumentTargets.length ? new Set(instrumentTargets) : null;
        const shouldUseFilter = !appendMode && resolvedScope === 'notes' && targetSet && targetSet.size > 0;

        if (resolvedScope === 'notes' && !shouldUseFilter && !force) {
            // Nothing dirty to schedule
            return;
        }

        const scheduleCallback = async () => {
            // ✅ PERFORMANCE TRACKING: Start timing
            const scheduleStartTime = performance.now();

            const baseTime = startTime || this.transport.audioContext.currentTime;

            const clearFilter = shouldUseFilter
                ? (eventData) => targetSet.has(eventData?.instrumentId)
                : null;

            if (!appendMode) {
                this._clearScheduledEvents(false, clearFilter);
            }

            let scheduledNotes = 0;
            let scheduledInstruments = 0;

            if (this.currentMode === 'pattern') {
                const result = await this._schedulePatternContent(baseTime, {
                    instrumentFilterSet: shouldUseFilter ? targetSet : null,
                    reason: reason // ✅ FIX: Pass reason to detect resume scenario
                });
                scheduledNotes = result?.totalNotes || 0;
                scheduledInstruments = result?.instrumentCount || 0;
            } else {
                try {
                    const result = await this._scheduleSongContent(baseTime, { reason });
                    scheduledNotes = result?.totalNotes || 0;
                    scheduledInstruments = result?.instrumentCount || 0;
                } catch (error) {
                    console.error('🎵 ❌ Error in _scheduleSongContent:', error);
                }
            }

            // ✅ PERFORMANCE TRACKING: End timing
            const scheduleEndTime = performance.now();
            const scheduleDuration = scheduleEndTime - scheduleStartTime;

            const dirtyInstrumentCount = targetSet
                ? targetSet.size
                : (resolvedScope === 'all'
                    ? this.audioEngine?.instruments?.size || 0
                    : this.dirtyState.instruments.size);

            if (!appendMode) {
                if (shouldUseFilter) {
                    targetSet.forEach(id => this.dirtyState.instruments.delete(id));
                } else {
                    this._resetDirtyState();
                }
            }

            const schedulerStats = this.schedulingOptimizer.getStats ? this.schedulingOptimizer.getStats() : null;
            const queueSize = this.transport?.scheduledEvents?.size || 0;

            if (this.audioEngine?.performanceMonitor?.recordSchedulingSample) {
                this.audioEngine.performanceMonitor.recordSchedulingSample({
                    reason,
                    scope: resolvedScope,
                    priority: effectivePriority,
                    durationMs: scheduleDuration,
                    dirtyInstrumentCount,
                    scheduledNotes,
                    scheduledInstruments,
                    queueSize,
                    pendingRequests: schedulerStats?.pending || 0,
                    force: force || resolvedScope === 'all',
                    timestamp: Date.now()
                });
            }

            // ✅ Pre-roll system removed for DAW-standard loop behavior
        };

        const effectivePriority = appendMode
            ? 'burst'
            : (shouldUseFilter ? 'realtime' : priority);

        // Use debounced scheduling unless forced
        if (force || resolvedScope === 'all' || appendMode) {
            this.schedulingOptimizer.forceExecute(scheduleCallback);
        } else {
            this.schedulingOptimizer.requestSchedule(scheduleCallback, reason, effectivePriority);
        }
    }

    /**
     * ✅ DÜZELTME: Pattern content scheduling with base time
     * @param {number} baseTime - Base scheduling time
     */
    async _schedulePatternContent(baseTime, options = {}) {
        const { instrumentFilterSet = null, reason = 'manual' } = options;

        // ✅ OPTIMIZED: Simplified position handling without excessive logging
        const isResume = reason === 'resume';
        const isNoteModified = reason === 'note-modified';
        const isNoteAdded = reason === 'note-added';
        const shouldPreservePosition = isResume || isNoteModified || isNoteAdded;

        // Reset position during loop restart (not during resume/note modifications)
        if (this.loopEnabled && !shouldPreservePosition) {
            if (this.currentPosition >= this.loopEnd || (this._isLoopRestarting && this.currentPosition !== 0)) {
                this.currentPosition = 0;
            }
        } else if (shouldPreservePosition && this.loopEnabled && this.currentPosition >= this.loopEnd) {
            // Wrap position within loop bounds
            const loopLength = this.loopEnd - this.loopStart;
            const relativePosition = ((this.currentPosition - this.loopStart) % loopLength + loopLength) % loopLength;
            this.currentPosition = this.loopStart + relativePosition;
        }

        const arrangementStore = useArrangementStore.getState();
        const activePattern = arrangementStore.patterns[arrangementStore.activePatternId];

        if (!activePattern) {
            return { totalNotes: 0, instrumentCount: 0 };
        }

        // ✅ OPTIMIZED: Schedule notes without verbose logging
        const patternData = activePattern.data || {};
        const instrumentCount = Object.keys(patternData).length;
        let totalNotes = 0;

        Object.entries(patternData).forEach(([instrumentId, notes]) => {
            if (instrumentFilterSet && !instrumentFilterSet.has(instrumentId)) return;
            if (!Array.isArray(notes) || notes.length === 0) return;

            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (!instrument) return;

            totalNotes += notes.length;
            this._scheduleInstrumentNotes(instrument, notes, instrumentId, baseTime, null, options.reason);
        });

        // ✅ PHASE 4: Start real-time automation ONLY for instruments with actual automation data
        // ✅ PERFORMANCE: Only start automation if lanes have data points (not empty)
        try {
            const automationManager = getAutomationManager();

            Object.keys(activePattern.data).forEach((instrumentId) => {
                if (instrumentFilterSet && !instrumentFilterSet.has(instrumentId)) {
                    return;
                }

                const lanes = automationManager.getLanes(arrangementStore.activePatternId, instrumentId);

                // ✅ PERFORMANCE: Filter lanes to only include those with actual automation data
                if (!lanes || lanes.length === 0) {
                    // No lanes at all - skip automation for this instrument
                    return;
                }

                // Filter lanes to only those with data points
                const lanesWithData = lanes.filter(lane => {
                    const points = lane.getPoints();
                    return points && points.length > 0;
                });

                if (lanesWithData.length > 0) {
                    // ✅ DEBUG: Log which lanes are being used
                    const laneNames = lanesWithData.map(l => `${l.name} (CC${l.ccNumber})`).join(', ');
                    console.log(`🎚️ Starting automation for ${instrumentId}: ${laneNames}`);

                    this.automationScheduler.startRealtimeAutomation(
                        instrumentId,
                        arrangementStore.activePatternId,
                        lanesWithData
                    );
                }
                // If no lanes have data, skip automation entirely (performance optimization)
            });
        } catch (error) {
            console.warn('⚠️ Failed to start real-time automation:', error);
        }

        // ✅ Return metrics for performance tracking
        return { totalNotes, instrumentCount };
    }

    async _scheduleSongContent(baseTime, options = {}) {
        const { reason = 'manual' } = options;

        // ✅ PHASE 1: Store Consolidation - Use unified store
        const arrangementStore = useArrangementStore.getState();
        // Try arrangement clips/tracks first (new system), fallback to pattern clips (old system)
        const arrangementClips = arrangementStore.arrangementClips || [];
        const arrangementTracks = arrangementStore.arrangementTracks || [];

        let clips, tracks, patterns;

        if (arrangementClips.length > 0 || arrangementTracks.length > 0) {
            // Use Arrangement (new system)
            clips = arrangementClips;
            tracks = arrangementTracks;
            patterns = arrangementStore.patterns || {};
        } else {
            // Fallback to workspace store (old system)
            const workspaceStore = useArrangementWorkspaceStore.getState();
            const arrangement = workspaceStore.getActiveArrangement();


            if (!arrangement) {
                return { totalNotes: 0, instrumentCount: 0 };
            }

            clips = arrangement.clips || [];
            tracks = arrangement.tracks || [];
            patterns = arrangementStore.patterns || {};
        }

        // ✅ Check for solo tracks
        const soloTracks = tracks.filter(t => t.solo);
        const hasSolo = soloTracks.length > 0;


        if (clips.length === 0) {
            // Don't return - allow playback to continue silently so playhead still moves
        }

        // ✅ FIX: Use for...of instead of forEach to support async operations
        for (const clip of clips) {
            // ✅ Check track mute/solo state
            const track = tracks.find(t => t.id === clip.trackId);
            if (!track) {
                continue;
            }

            // Skip if track is muted
            if (track.muted) {
                continue;
            }

            // If any track is solo, only play clips on solo tracks
            if (hasSolo && !track.solo) {
                continue;
            }

            // ✅ Handle different clip types: 'pattern' or 'audio'
            if (clip.type === 'audio') {
                // Schedule audio sample clip
                this._scheduleAudioClip(clip, baseTime);
            } else {
                // Schedule pattern clip (default)
                const pattern = patterns[clip.patternId];
                if (!pattern) {
                    continue;
                }

                // Convert clip startTime and duration to steps (16th notes)
                // 1 beat = 4 sixteenth notes
                const clipStartStep = Math.floor((clip.startTime || 0) * 4);
                const clipDurationBeats = clip.duration || pattern.length || 4; // Use pattern length if available
                const clipDurationSteps = clipDurationBeats * 4;

                // ✅ FIX: Get patternOffset (number of steps to skip from pattern start)
                // This is set when a pattern clip is split, so the right clip plays from the split point
                const patternOffset = clip.patternOffset || 0; // In steps (16th notes)

                // ✅ FIX: Calculate pattern length in steps
                // Pattern length can be stored in pattern.length (in beats) or calculated from notes
                let patternLengthSteps = 64; // Default 4 bars
                if (pattern.length) {
                    // pattern.length is in beats, convert to steps
                    patternLengthSteps = pattern.length * 4;
                } else {
                    // Calculate from notes if length not available
                    let maxStep = 0;
                    Object.values(pattern.data || {}).forEach(notes => {
                        if (Array.isArray(notes)) {
                            notes.forEach(note => {
                                const noteTime = note.time || 0;
                                maxStep = Math.max(maxStep, noteTime);
                            });
                        }
                    });
                    if (maxStep > 0) {
                        // Round up to nearest bar (16 steps)
                        patternLengthSteps = Math.max(64, Math.ceil(maxStep / 16) * 16);
                    }
                }

                // ✅ DEBUG: Log clip scheduling info for debugging
                console.log(`🎵 Scheduling pattern clip:`, {
                    clipId: clip.id,
                    clipStartTime: clip.startTime,
                    clipStartStep,
                    clipDuration: clipDurationBeats,
                    clipDurationSteps,
                    patternOffset,
                    patternId: clip.patternId,
                    patternLength: pattern.length,
                    patternLengthSteps,
                    instrumentsInPattern: Object.keys(pattern.data || {}).length
                });

                // Schedule pattern notes with clip timing offset
                // ✅ FIX: Use for...of instead of forEach to support async operations
                for (const [instrumentId, notes] of Object.entries(pattern.data)) {
                    if (!Array.isArray(notes) || notes.length === 0) {
                        continue;
                    }

                    let instrument = this.audioEngine.instruments.get(instrumentId);
                    if (!instrument) {
                        // ✅ FIX: Try to load instrument from store if not in audio engine
                        console.warn(`🎵 ❌ Instrument ${instrumentId} not found in audio engine, attempting to load...`);

                        try {
                            // Get instrument from store
                            const { useInstrumentsStore } = await import('@/store/useInstrumentsStore');
                            const instrumentsStore = useInstrumentsStore.getState();
                            const instrumentData = instrumentsStore.instruments.find(inst => inst.id === instrumentId);

                            if (instrumentData) {
                                // Load instrument into audio engine
                                const { AudioContextService } = await import('@/lib/services/AudioContextService');
                                await AudioContextService._syncInstrumentsToMixerInserts();

                                // Try again after sync
                                instrument = this.audioEngine.instruments.get(instrumentId);
                                if (instrument) {
                                    console.log(`✅ Instrument ${instrumentId} loaded successfully`);
                                } else {
                                    console.error(`❌ Failed to load instrument ${instrumentId} after sync`);
                                    continue;
                                }
                            } else {
                                console.error(`❌ Instrument ${instrumentId} not found in store either`);
                                continue;
                            }
                        } catch (error) {
                            console.error(`❌ Error loading instrument ${instrumentId}:`, error);
                            continue;
                        }
                    }

                    // ✅ FIX: Pattern loop support - loop pattern notes across clip duration
                    // Pattern notes are in range [0, patternLengthSteps), we need to loop them
                    // to cover the entire clip duration (which may be longer than pattern length)
                    const offsetNotes = [];

                    // Calculate how many pattern loops we need to cover the clip duration
                    const effectivePatternStart = patternOffset % patternLengthSteps;
                    const effectivePatternEnd = effectivePatternStart + clipDurationSteps;
                    const numLoops = Math.ceil(effectivePatternEnd / patternLengthSteps);

                    for (let loopIndex = 0; loopIndex < numLoops; loopIndex++) {
                        const loopStartStep = loopIndex * patternLengthSteps;
                        const loopEndStep = (loopIndex + 1) * patternLengthSteps;

                        // Filter notes that fall within this loop iteration and clip range
                        notes.forEach(note => {
                            const noteTime = note.time || 0;
                            const noteTimeInLoop = noteTime + loopStartStep;

                            // Check if note falls within the effective pattern range (after patternOffset)
                            // and within the clip duration
                            if (noteTimeInLoop >= effectivePatternStart &&
                                noteTimeInLoop < effectivePatternEnd) {

                                // Calculate the final note time in arrangement timeline
                                // Subtract effectivePatternStart to get relative position from clip start
                                // Then add clipStartStep to position in arrangement
                                const relativeNoteTime = noteTimeInLoop - effectivePatternStart;
                                const finalNoteTime = relativeNoteTime + clipStartStep;

                                offsetNotes.push({
                                    ...note,
                                    time: finalNoteTime
                                });
                            }
                        });
                    }

                    // ✅ DEBUG: Log filtered notes for debugging (especially for piano)
                    if (instrumentId === 'piano' || offsetNotes.length !== notes.length || patternOffset > 0) {
                        console.log(`🎵 [${instrumentId}] Pattern clip ${clip.id} note filtering:`, {
                            instrumentId,
                            clipId: clip.id,
                            clipStartStep,
                            clipDurationSteps,
                            patternOffset,
                            patternLengthSteps,
                            numLoops,
                            effectivePatternStart,
                            effectivePatternEnd,
                            originalNoteCount: notes.length,
                            filteredNoteCount: offsetNotes.length,
                            noteTimeRange: notes.length > 0 ? {
                                min: Math.min(...notes.map(n => n.time || 0)),
                                max: Math.max(...notes.map(n => n.time || 0))
                            } : null,
                            filteredNoteTimeRange: offsetNotes.length > 0 ? {
                                min: Math.min(...offsetNotes.map(n => n.time || 0)),
                                max: Math.max(...offsetNotes.map(n => n.time || 0))
                            } : null,
                            filterRange: {
                                min: effectivePatternStart,
                                max: effectivePatternEnd
                            }
                        });
                    }


                    if (offsetNotes.length > 0) {
                        this._scheduleInstrumentNotes(instrument, offsetNotes, instrumentId, baseTime, clip.id, reason);
                    }
                }
            }
        }


        // ✅ Return basic metrics (song mode is complex, return clip count as approximation)
        return { totalNotes: clips.length * 10, instrumentCount: tracks.length };
    }

    /**
     * ✅ NEW: Reschedule events for a single clip.
     * This is a performance optimization to avoid rescheduling the entire song.
     * @param {Object} clip - The full clip object that has been updated.
     */
    rescheduleClipEvents(clip) {
        if (!clip || !clip.id) {
            console.warn('rescheduleClipEvents: Invalid clip provided.');
            return;
        }

        // Step 1: Clear all old events for this clip
        this._clearClipEvents(clip.id);

        // Step 2: If playing, schedule new events for this clip
        if (this.isPlaying && !this.isPaused) {
            const baseTime = this.audioEngine.audioContext.currentTime;

            // Re-use existing scheduling logic, but for a single clip
            if (clip.type === 'audio') {
                this._scheduleAudioClip(clip, baseTime);
            } else if (clip.type === 'pattern') {
                const arrangementStore = useArrangementStore.getState();
                const patterns = arrangementStore.patterns || {};
                const pattern = patterns[clip.patternId];

                if (pattern) {
                    const clipStartStep = Math.floor((clip.startTime || 0) * 4);
                    const clipDurationSteps = (clip.duration || 4) * 4;

                    // ✅ FIX: For split pattern clips, adjust note timing based on patternOffset
                    const patternOffset = clip.patternOffset || 0; // In steps (16th notes)

                    Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
                        if (!Array.isArray(notes) || notes.length === 0) return;
                        const instrument = this.audioEngine.instruments.get(instrumentId);
                        if (!instrument) return;

                        const offsetNotes = notes
                            .filter(note => {
                                const noteTime = note.time || 0;
                                // Only include notes that are at or after pattern offset and within clip duration
                                return noteTime >= patternOffset && noteTime < (patternOffset + clipDurationSteps);
                            })
                            .map(note => ({
                                ...note,
                                // Adjust note time: subtract patternOffset then add clipStartStep
                                time: (note.time || 0) - patternOffset + clipStartStep
                            }));

                        if (offsetNotes.length > 0) {
                            this._scheduleInstrumentNotes(instrument, offsetNotes, instrumentId, baseTime, clip.id);
                        }
                    });
                }
            }
        }
    }

    /**
     * ✅ NEW: Clear all scheduled events and active sources for a specific clipId.
     * @param {string} clipId
     */
    _clearClipEvents(clipId) {
        if (!this.transport || !clipId) return;

        // ✅ REFACTOR: Delegate to AudioClipScheduler
        this.audioClipScheduler.clearClipEvents(clipId);
    }

    /**
     * ✅ NEW: Schedule audio sample clip
     * @param {Object} clip - Audio clip with sample data
     * @param {number} baseTime - Base scheduling time
     */
    _scheduleAudioClip(clip, baseTime) {
        // ✅ REFACTOR: Delegate to AudioClipScheduler
        return this.audioClipScheduler.scheduleAudioClip(clip, baseTime);

        // LEGACY CODE (moved to AudioClipScheduler):
        /*

        // Get audio buffer from various sources
        let audioBuffer = null;

        // Priority 1: Check AudioAssetManager (modern system with assetId)
        if (clip.assetId) {
            const asset = audioAssetManager.getAsset(clip.assetId);
            audioBuffer = asset?.buffer;
        }

        // Priority 2: Direct audioBuffer (legacy)
        if (!audioBuffer && clip.audioBuffer) {
            audioBuffer = clip.audioBuffer;
        }

        // Priority 3: Try to get sample from instruments store (legacy)
        if (!audioBuffer && clip.sampleId) {
            const instrument = this.audioEngine.instruments.get(clip.sampleId);
            if (instrument) {
                // Check NativeSamplerNode for buffer
                audioBuffer = instrument.audioBuffer || instrument.buffer;
                    sampleId: clip.sampleId,
                    found: !!instrument,
                    hasAudioBuffer: !!instrument.audioBuffer,
                    hasBuffer: !!instrument.buffer,
                    finalBuffer: !!audioBuffer
                });
            } else {
            }
        }

        if (!audioBuffer) {
                assetId: clip.assetId,
                sampleId: clip.sampleId,
                hasDirectBuffer: !!clip.audioBuffer,
                availableInstruments: Array.from(this.audioEngine.instruments.keys())
            });
            return;
        }



        // Convert clip startTime (in beats) to seconds
        const clipStartBeats = clip.startTime || 0;
        const clipEndBeats = clipStartBeats + (clip.duration || 4);
        const clipStartSeconds = clipStartBeats * (60 / this.transport.bpm); // beats to seconds
        const clipEndSeconds = clipEndBeats * (60 / this.transport.bpm);

        // Calculate absolute time
        const currentStep = this.transport.ticksToSteps(this.transport.currentTick);
        const currentPositionBeats = currentStep / 4; // steps to beats
        const currentPositionInSeconds = currentStep * this.transport.stepsToSeconds(1);

        // ✅ FIX: Check if we're in the middle of the clip (resume scenario)
        const isWithinClip = currentPositionBeats >= clipStartBeats && currentPositionBeats < clipEndBeats;
        let absoluteTime;
        let offset = 0; // Audio buffer offset for resume

        if (isWithinClip) {
            // ✅ RESUME: Start clip immediately with offset
            absoluteTime = baseTime;
            offset = currentPositionInSeconds - clipStartSeconds; // How far into the clip we are
        } else {
            // ✅ NORMAL: Schedule clip at its start time
            const relativeTime = clipStartSeconds - currentPositionInSeconds;
            absoluteTime = baseTime + relativeTime;

            // Skip if in the past
            if (absoluteTime < baseTime) {
                return;
            }
        }

            clipStartBeats,
            clipEndBeats,
            currentPositionBeats,
            currentPositionInSeconds,
            baseTime,
            absoluteTime,
            offset,
            isWithinClip
        });

        // Schedule audio playback
        this.transport.scheduleEvent(
            absoluteTime,
            (scheduledTime) => {
                try {
                    this._playAudioBuffer(audioBuffer, scheduledTime, clip, offset);
                } catch (error) {
                }
            },
            { type: 'audioClip', clipId: clip.id, startTime: clipStartBeats, offset }
        );
        */
        // END LEGACY CODE - Now handled by AudioClipScheduler
    }

    /**
     * ✅ NEW: Play audio buffer at scheduled time
     * @param {AudioBuffer} audioBuffer - Audio buffer to play
     * @param {number} time - Scheduled time
     * @param {Object} clip - Clip data for volume/pan settings
     * @param {number} resumeOffset - Offset in seconds for resume (default 0)
     */
    _playAudioBuffer(audioBuffer, time, clip = {}, resumeOffset = 0) {

        const context = this.audioEngine.audioContext;
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.clipId = clip.id; // ✅ Associate source with clip for targeted clearing

        // Apply playback rate (time stretch)
        const playbackRate = clip.playbackRate || 1.0;
        source.playbackRate.value = playbackRate;

        // Create gain node for volume control
        const gainNode = context.createGain();

        // Apply gain (dB to linear conversion)
        const gainDb = clip.gain || 0;
        const gainLinear = Math.pow(10, gainDb / 20);
        const volumeLinear = clip.volume !== undefined ? clip.volume : 1.0;
        gainNode.gain.value = volumeLinear * gainLinear;


        // Apply fade in/out envelope
        const fadeIn = clip.fadeIn || 0; // in beats
        const fadeOut = clip.fadeOut || 0; // in beats
        const fadeInSeconds = fadeIn * (60 / this.transport.bpm);
        const fadeOutSeconds = fadeOut * (60 / this.transport.bpm);
        const clipDurationSeconds = clip.duration * (60 / this.transport.bpm);

        if (fadeInSeconds > 0) {
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(volumeLinear * gainLinear, time + fadeInSeconds);
        }

        if (fadeOutSeconds > 0 && clipDurationSeconds) {
            const fadeOutStartTime = time + clipDurationSeconds - fadeOutSeconds;
            gainNode.gain.setValueAtTime(volumeLinear * gainLinear, fadeOutStartTime);
            gainNode.gain.linearRampToValueAtTime(0, time + clipDurationSeconds);
        }

        // Create panner for stereo positioning (if needed)
        let outputNode = gainNode;
        let panNode = null; // ✅ LEAK FIX: Track panNode for cleanup
        if (clip.pan !== undefined && clip.pan !== 0) {
            panNode = context.createStereoPanner();
            panNode.pan.value = clip.pan;
            gainNode.connect(panNode);
            outputNode = panNode;
        }

        // 🎛️ DYNAMIC MIXER: Route to mixer insert with inheritance logic
        let destination = this.audioEngine.masterGain || context.destination;
        let mixerChannelId;

        // Determine mixer routing using inheritance
        if (clip.isUnique && clip.uniqueMetadata?.mixerChannelId) {
            // Unique clip: use its own routing
            mixerChannelId = clip.uniqueMetadata.mixerChannelId;
        } else if (!clip.isUnique && clip.assetId && window.audioAssetManager) {
            // Shared clip: use asset routing
            const assetMeta = window.audioAssetManager.getAssetMetadata(clip.assetId);
            mixerChannelId = assetMeta?.mixerChannelId;
        }

        // Fallback to track routing or deprecated clip.mixerChannelId
        if (!mixerChannelId && clip.trackId) {
            mixerChannelId = clip.mixerChannelId || `arr-${clip.trackId}`;
        }

        if (mixerChannelId) {
            // 🎛️ DYNAMIC MIXER: Try to get mixer insert first
            const mixerInsert = this.audioEngine.mixerInserts?.get(mixerChannelId);

            if (mixerInsert && mixerInsert.input) {
                destination = mixerInsert.input;
                const routeType = clip.isUnique ? 'unique' : (clip.assetId ? 'shared' : 'track');
                console.log(`🎛️ Audio clip routed to mixer insert ${mixerChannelId} (${routeType})`);
            } else {
                // ⚠️ REMOVED: mixerChannels fallback - Replaced by MixerInsert system
                console.warn(`⚠️ Mixer insert ${mixerChannelId} not found, routing to master`);
            }
        }

        source.connect(gainNode);
        outputNode.connect(destination);

        // Play with sample offset and duration
        // sampleOffset is already in seconds (set during split/resize)
        const sampleOffsetSeconds = clip.sampleOffset || 0;

        // ✅ FIX: Combine resume offset with clip's sample offset
        const totalOffset = resumeOffset + sampleOffsetSeconds;

        // Duration in seconds (accounting for playback rate and resume offset)
        let duration = clip.duration ? (clip.duration * 60 / this.transport.bpm) : undefined;
        if (duration && resumeOffset > 0) {
            // ✅ Reduce duration by resume offset (we're starting partway through)
            duration = Math.max(0, duration - resumeOffset);
        }

        source.start(time, totalOffset, duration);

        // ✅ LEAK FIX: Track all audio nodes for proper cleanup
        const audioNodeGroup = {
            source,
            gainNode,
            panNode,
            destination: outputNode,
            clipId: clip.id
        };
        this.activeAudioSources.push(audioNodeGroup);

        // ✅ LEAK FIX: Disconnect ALL nodes when source finishes
        source.onended = () => {
            try {
                source.disconnect();
                gainNode.disconnect();
                if (panNode) {
                    panNode.disconnect();
                }
            } catch (e) {
                console.warn('Audio node cleanup already handled:', e);
            }

            // Remove from tracking
            const index = this.activeAudioSources.findIndex(item => item.source === source);
            if (index > -1) {
                this.activeAudioSources.splice(index, 1);
            }
        };
    }

    /**
     * ✅ DÜZELTME: Instrument notes scheduling with base time and clipId for targeted rescheduling
     * @param {*} instrument - Instrument instance
     * @param {Array} notes - Notes array
     * @param {string} instrumentId - Instrument ID
     * @param {number} baseTime - Base scheduling time
     * @param {string | null} clipId - The ID of the parent clip for this note, for targeted clearing.
     */
    _scheduleInstrumentNotes(instrument, notes, instrumentId, baseTime, clipId = null, reason = 'manual') {
        // ✅ FIX 2 & 3: Delegate to NoteScheduler (includes overlap detection and loop-aware logic)
        // NoteScheduler now handles:
        // - Loop-aware position calculation
        // - Cross-batch overlap detection (instance-level activeNotesByPitch)
        // - Sample-accurate timing
        // - Latency compensation
        // - Extended parameters and CC lanes

        const schedulingOptions = {
            currentPosition: this.currentPosition,
            loopStart: this.loopStart,
            loopEnd: this.loopEnd,
            loopEnabled: this.loopEnabled,
            reason: reason,
            patternId: this.activePatternId // ✅ For CC lanes lookup
        };

        console.log('🎵 [SCHEDULE INSTRUMENT] Scheduling notes:', {
            instrumentId,
            reason,
            currentPosition: this.currentPosition,
            loopStart: this.loopStart,
            loopEnd: this.loopEnd,
            transportCurrentTick: this.transport.currentTick,
            transportCurrentStep: this.transport.ticksToSteps(this.transport.currentTick),
            getCurrentPosition: this.getCurrentPosition(),
            schedulingOptions
        });

        return this.noteScheduler.scheduleInstrumentNotes(
            instrument,
            notes,
            instrumentId,
            baseTime,
            clipId,
            schedulingOptions
        );

        sortedNotes.forEach(note => {
            // ✅ GHOST NOTES: Skip muted notes during playback
            if (note.isMuted) {
                return; // Skip this note
            }

            // Note timing calculation (support both startTime and time)
            const noteTimeInSteps = (note.startTime ?? note.time ?? 0);
            const noteTimeInTicks = noteTimeInSteps * this.transport.ticksPerStep;
            const noteTimeInSeconds = noteTimeInTicks * this.transport.getSecondsPerTick();

            // ✅ CRITICAL FIX: Calculate relative time from current position
            const relativeTime = noteTimeInSeconds - currentPositionInSeconds;
            let absoluteTime = baseTime + relativeTime;

            // ✅ DEBUG: Log timing calculations for VASynth debugging
            if (instrumentId === 'pluck' || instrument?.type === 'vasynth') {
                console.log(`🎵 VASynth note timing:`, {
                    instrumentId,
                    noteTimeInSteps,
                    noteTimeInSeconds: noteTimeInSeconds.toFixed(3),
                    currentPositionInSteps: currentStep,
                    currentPositionInSeconds: currentPositionInSeconds.toFixed(3),
                    relativeTime: relativeTime.toFixed(3),
                    baseTime: baseTime.toFixed(3),
                    absoluteTime: absoluteTime.toFixed(3),
                    now: this.transport.audioContext.currentTime.toFixed(3),
                    isPast: absoluteTime < baseTime
                });
            }

            // ✅ CRITICAL FIX: Handle loop-aware scheduling with proper current position handling
            // ✅ FIX: During resume, notes added during pause should be scheduled from current position
            // If note is in the past relative to baseTime but we're resuming, schedule it for next loop
            if (absoluteTime < baseTime) {
                // Note is in the past - schedule for next loop if looping is enabled
                // ✅ FIX: Use loopEnabled instead of loop (loop is transport property)
                if (this.loopEnabled) {
                    absoluteTime = baseTime + relativeTime + loopTimeInSeconds;

                    // If still in past after loop adjustment, skip it
                    if (absoluteTime < baseTime) {
                        if (instrumentId === 'pluck' || instrument?.type === 'vasynth') {
                            console.warn(`⚠️ VASynth note skipped (still in past after loop):`, {
                                instrumentId,
                                noteTimeInSteps,
                                absoluteTime: absoluteTime.toFixed(3),
                                baseTime: baseTime.toFixed(3)
                            });
                        }
                        return;
                    }
                } else {
                    // No looping - skip past notes
                    if (instrumentId === 'pluck' || instrument?.type === 'vasynth') {
                        console.warn(`⚠️ VASynth note skipped (in past, no loop):`, {
                            instrumentId,
                            noteTimeInSteps,
                            absoluteTime: absoluteTime.toFixed(3),
                            baseTime: baseTime.toFixed(3)
                        });
                    }
                    return;
                }
            }

            // ✅ FIX: Support both new format (length: number) and legacy format (duration: string)
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
                if (import.meta.env.DEV && (instrumentId === 'pluck' || instrument?.type === 'vasynth')) {
                    console.log(`🎵 Oval note detected: using length for audio duration`, {
                        noteId: note.id,
                        visualLength: note.visualLength,
                        length: note.length,
                        noteDuration: noteDuration.toFixed(3) + 's'
                    });
                }
            } else if (typeof note.length === 'number' && note.length > 0) {
                // NEW FORMAT: length in steps (number) - normal note
                noteDuration = this.transport.stepsToSeconds(note.length);
            } else if (note.visualLength === 1 && (typeof note.length !== 'number' || note.length <= 0)) {
                // ✅ LEGACY OVAL NOTES: visualLength: 1 but no valid length - extend to pattern end
                const arrangementStore = useArrangementStore.getState();
                const activePattern = arrangementStore.patterns[arrangementStore.activePatternId];
                if (activePattern) {
                    const patternLengthInSteps = activePattern.length || 64;
                    const noteStartStep = noteTimeInSteps;
                    const remainingSteps = Math.max(1, patternLengthInSteps - noteStartStep);
                    noteDuration = this.transport.stepsToSeconds(remainingSteps);
                    console.log(`🎵 Legacy oval note detected: extending to pattern end`, {
                        noteStartStep,
                        patternLengthInSteps,
                        remainingSteps,
                        noteDuration: noteDuration.toFixed(3) + 's'
                    });
                } else {
                    noteDuration = this.transport.stepsToSeconds(1);
                }
            } else if (note.duration) {
                // LEGACY FORMAT: duration as string ("4n", "8n", etc)
                if (note.duration === 'trigger') {
                    noteDuration = this.transport.stepsToSeconds(0.1);
                } else {
                    // ✅ FIX: Handle invalid duration formats (e.g., "4*16n")
                    // Try to parse, but fallback to length if available
                    try {
                        noteDuration = NativeTimeUtils.parseTime(note.duration, this.transport.bpm);
                    } catch (error) {
                        console.warn(`⚠️ Invalid duration format: "${note.duration}", falling back to length or default`, error);
                        // Fallback: try to extract number from invalid format (e.g., "4*16n" -> 4)
                        const match = String(note.duration).match(/(\d+)/);
                        if (match) {
                            const steps = parseFloat(match[1]);
                            noteDuration = this.transport.stepsToSeconds(steps);
                        } else if (typeof note.length === 'number') {
                            noteDuration = this.transport.stepsToSeconds(note.length);
                        } else {
                            noteDuration = this.transport.stepsToSeconds(1);
                        }
                    }
                }
            } else {
                // FALLBACK: Default to 1 step
                noteDuration = this.transport.stepsToSeconds(1);
            }

            // ✅ OVAL NOTE OVERLAP DETECTION: Check for overlapping notes of the same pitch
            const notePitch = note.pitch || 'C4';
            const noteEndTime = absoluteTime + noteDuration;

            // Check if there's an active note of the same pitch that overlaps
            const existingActiveNote = activeNotesByPitch.get(notePitch);
            if (existingActiveNote && existingActiveNote.endTime > absoluteTime) {
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
                                console.error(`PlaybackManager: Early release error:`, error);
                            }
                        },
                        { type: 'noteOff', instrumentId, note: existingActiveNote.note, earlyRelease: true, fadeOut: fadeOutDuration }
                    );

                    if (import.meta.env.DEV) {
                        console.log(`🔄 Oval note overlap detected (PlaybackManager):`, {
                            instrumentId,
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
            }

            // Update active notes map
            activeNotesByPitch.set(notePitch, {
                startTime: absoluteTime,
                endTime: noteEndTime,
                note: note,
                absoluteTime: absoluteTime
            });

            // ✅ PHASE 2: Extract extended parameters from note AND CC lanes
            const extendedParams = {};
            if (note.pan !== undefined) extendedParams.pan = note.pan;
            if (note.modWheel !== undefined) extendedParams.modWheel = note.modWheel;
            if (note.aftertouch !== undefined) extendedParams.aftertouch = note.aftertouch;
            if (note.pitchBend && Array.isArray(note.pitchBend)) extendedParams.pitchBend = note.pitchBend;

            // ✅ FL Studio-style slide logic
            // Slide is a property of the note itself: slideEnabled, slideDuration, slideTargetPitch
            if (note.slideEnabled === true) {
                // Validate slideTargetPitch
                let targetPitch = note.slideTargetPitch;
                if (targetPitch === undefined || targetPitch === null) {
                    // No target pitch - skip slide
                    console.warn('⚠️ Slide enabled but no targetPitch:', note.id);
                } else {
                    // Ensure targetPitch is a number (MIDI 0-127)
                    if (typeof targetPitch === 'string') {
                        // Convert string pitch (C4) to MIDI number
                        const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
                        const match = targetPitch.match(/([A-G]#?)(\d+)/);
                        if (match) {
                            const [, noteName, octave] = match;
                            targetPitch = (parseInt(octave) + 1) * 12 + (noteMap[noteName] || 0);
                        } else {
                            console.warn('⚠️ Invalid slideTargetPitch format:', targetPitch);
                            targetPitch = null;
                        }
                    }

                    if (targetPitch !== null && targetPitch >= 0 && targetPitch <= 127) {
                        const slideDurationSteps = note.slideDuration || 1;
                        const slideDurationSeconds = this.transport.stepsToSeconds(slideDurationSteps);

                        // ✅ FL Studio-style slide: Note glides from its own pitch to target pitch
                        // Slide starts immediately when note starts, glides over slideDuration
                        extendedParams.slideEnabled = true;
                        extendedParams.slideTargetPitch = targetPitch;
                        extendedParams.slideDuration = slideDurationSeconds;

                        // Extend note duration to include slide duration
                        noteDuration = noteDuration + slideDurationSeconds;

                        console.log('🎚️ Slide enabled:', {
                            noteId: note.id.substring(0, 12),
                            sourcePitch: note.pitch,
                            targetPitch: targetPitch,
                            slideDuration: slideDurationSeconds.toFixed(3) + 's',
                            slideDurationSteps
                        });
                    }
                }
            }

            // ✅ PHASE 4: Get CC lanes data from AutomationManager (per instrument)
            try {
                const automationManager = getAutomationManager();
                const { activePatternId } = useArrangementStore.getState();
                const patternId = activePatternId || this.activePatternId;

                // Get lanes for this specific pattern + instrument combination
                const lanes = automationManager.getLanes(patternId, instrumentId);

                if (lanes && lanes.length > 0) {
                    lanes.forEach(lane => {
                        const ccValue = lane.getValueAtTime(noteTimeInSteps, 'linear');

                        if (ccValue !== null) {
                            // ✅ MIXING CONTROLS
                            // ✅ FIX: Volume (CC7) should NOT be applied per-note to velocity
                            // Volume automation is handled by real-time AutomationScheduler
                            // which applies it to master gain via applyAutomation()
                            // Per-note volume would conflict with real-time automation
                            if (lane.ccNumber === 7) {
                                // Volume (CC7) - skip per-note application, handled by AutomationScheduler
                                // Do not set extendedParams.volume here
                            } else if (lane.ccNumber === 10) {
                                // Pan (CC10) - normalize from 0-127 to -1 to 1
                                extendedParams.pan = (ccValue - 64) / 64;
                            } else if (lane.ccNumber === 11) {
                                // Expression (CC11) - normalize from 0-127 to 0-1
                                // Expression can be applied per-note as it affects velocity
                                extendedParams.expression = ccValue / 127;
                            }

                            // ✅ MODULATION
                            else if (lane.ccNumber === 1) {
                                // Mod Wheel (CC1) - override note's modWheel if CC lane has value
                                extendedParams.modWheel = ccValue;
                            } else if (lane.ccNumber === 'pitchBend') {
                                // Pitch Bend - create automation points from CC lane
                                if (!extendedParams.pitchBend) extendedParams.pitchBend = [];
                                // Get all points in note's time range
                                const points = lane.getPoints();
                                const noteEndTime = noteTimeInSteps + (note.length || 1);
                                const relevantPoints = points.filter(p => p.time >= noteTimeInSteps && p.time <= noteEndTime);
                                if (relevantPoints.length > 0) {
                                    // Convert to relative time (0-1 normalized within note)
                                    relevantPoints.forEach(point => {
                                        const relativeTime = (point.time - noteTimeInSteps) / (note.length || 1);
                                        extendedParams.pitchBend.push({ time: relativeTime, value: point.value });
                                    });
                                } else {
                                    // Use single point at note start
                                    extendedParams.pitchBend.push({ time: 0, value: ccValue });
                                }
                            } else if (lane.ccNumber === 'aftertouch') {
                                // Aftertouch - override note's aftertouch if CC lane has value
                                extendedParams.aftertouch = ccValue;
                            }

                            // ✅ PERFORMANCE CONTROLS
                            else if (lane.ccNumber === 64) {
                                // Sustain Pedal (CC64) - boolean on/off (>63 = on)
                                extendedParams.sustain = ccValue > 63;
                            } else if (lane.ccNumber === 5) {
                                // Portamento Time (CC5) - normalize from 0-127 to 0-2 seconds
                                extendedParams.portamento = (ccValue / 127) * 2;
                            }

                            // ✅ FILTER CONTROLS (stored for instrument processing)
                            else if (lane.ccNumber === 74) {
                                // Filter Cutoff (CC74)
                                extendedParams.filterCutoff = ccValue;
                            } else if (lane.ccNumber === 71) {
                                // Filter Resonance (CC71)
                                extendedParams.filterResonance = ccValue;
                            }

                            // ✅ ENVELOPE CONTROLS (stored for instrument processing)
                            else if (lane.ccNumber === 73) {
                                // Attack Time (CC73) - normalize from 0-127 to 0-2 seconds
                                extendedParams.attackTime = (ccValue / 127) * 2;
                            } else if (lane.ccNumber === 72) {
                                // Release Time (CC72) - normalize from 0-127 to 0-5 seconds
                                extendedParams.releaseTime = (ccValue / 127) * 5;
                            }

                            // ✅ EFFECTS CONTROLS (stored for instrument processing)
                            else if (lane.ccNumber === 91) {
                                // Reverb Send (CC91) - normalize from 0-127 to 0-1
                                extendedParams.reverbSend = ccValue / 127;
                            } else if (lane.ccNumber === 93) {
                                // Chorus Send (CC93) - normalize from 0-127 to 0-1
                                extendedParams.chorusSend = ccValue / 127;
                            } else if (lane.ccNumber === 94) {
                                // Delay Send (CC94) - normalize from 0-127 to 0-1
                                extendedParams.delaySend = ccValue / 127;
                            }
                        }
                    });
                }
            } catch (error) {
                console.warn('⚠️ Failed to load automation lanes for note:', error);
            }

            const hasExtendedParams = Object.keys(extendedParams).length > 0;

            // ✅ SCHEDULE OPT: Note on event with noteId for cancellation tracking
            // ✅ DEBUG: Log scheduling for VASynth
            if (instrumentId === 'pluck' || instrument?.type === 'vasynth') {
                console.log(`📅 Scheduling VASynth note event:`, {
                    instrumentId,
                    pitch: note.pitch || 'C4',
                    absoluteTime: absoluteTime.toFixed(3),
                    noteDuration: noteDuration.toFixed(3),
                    now: this.transport.audioContext.currentTime.toFixed(3),
                    timeUntilNote: (absoluteTime - this.transport.audioContext.currentTime).toFixed(3) + 's'
                });
            }

            this.transport.scheduleEvent(
                absoluteTime,
                (scheduledTime) => {
                    try {
                        if (instrumentId === 'pluck' || instrument?.type === 'vasynth') {
                            console.log(`🔊 VASynth note event triggered:`, {
                                instrumentId,
                                pitch: note.pitch || 'C4',
                                scheduledTime: scheduledTime.toFixed(3),
                                actualTime: this.transport.audioContext.currentTime.toFixed(3),
                                delay: (scheduledTime - this.transport.audioContext.currentTime).toFixed(3) + 's'
                            });
                        }
                        instrument.triggerNote(
                            note.pitch || 'C4',
                            note.velocity || 1,
                            scheduledTime,
                            noteDuration,
                            hasExtendedParams ? extendedParams : null
                        );
                    } catch (error) {
                        console.error('Error triggering scheduled note:', error);
                    }
                },
                {
                    type: 'noteOn',
                    instrumentId,
                    note,
                    noteId: note.id, // ✅ SCHEDULE OPT: Store note ID for cancellation
                    step: noteTimeInSteps,
                    clipId
                }
            );

            // ✅ FIX: Note off event - check for both length and duration
            const shouldScheduleNoteOff = (typeof note.length === 'number' && note.length > 0) ||
                (note.duration && note.duration !== 'trigger');

            // ✅ FIX: Check if instrument supports release sustain (like NoteScheduler does)
            const instrumentHasRelease = typeof instrument?.hasReleaseSustain === 'function'
                ? instrument.hasReleaseSustain()
                : true;

            // ✅ DEBUG: Log noteOff scheduling decision for all instruments
            if (import.meta.env.DEV) {
                // Log for specific instruments or last step notes (pattern end issues)
                const isLastStep = noteTimeInSteps >= (this.patternLength - 1);
                const shouldLog = (instrumentId === '808bass' || instrument?.type === 'vasynth' || instrumentId === 'snare-1' || isLastStep);

                if (shouldLog) {
                    console.log(`🎵 NoteOff scheduling decision:`, {
                        instrumentId,
                        instrumentName: instrument?.name,
                        instrumentType: instrument?.type,
                        noteId: note.id,
                        noteTimeInSteps,
                        noteLength: note.length,
                        noteDuration: note.duration,
                        visualLength: note.visualLength,
                        calculatedNoteDuration: noteDuration.toFixed(3) + 's',
                        absoluteTime: absoluteTime.toFixed(3) + 's',
                        noteOffTime: (absoluteTime + noteDuration).toFixed(3) + 's',
                        shouldScheduleNoteOff,
                        instrumentHasRelease,
                        hasReleaseMethod: typeof instrument?.hasReleaseSustain === 'function',
                        willSchedule: shouldScheduleNoteOff && instrumentHasRelease,
                        isLastStep,
                        patternLength: this.patternLength
                    });
                }
            }

            if (shouldScheduleNoteOff && instrumentHasRelease) {
                // ✅ CRITICAL FIX: Store note metadata to prevent wrong noteOff
                const noteMetadata = {
                    type: 'noteOff',
                    instrumentId,
                    note,
                    clipId,
                    noteId: note.id, // ✅ Store note ID for identification
                    scheduledNoteOnTime: absoluteTime, // ✅ Store when this specific note started
                    pitch: note.pitch || 'C4'
                };


                // ✅ PHASE 2: Extract release velocity from note
                const releaseVelocity = note.releaseVelocity !== undefined ? note.releaseVelocity : null;

                this.transport.scheduleEvent(
                    absoluteTime + noteDuration,
                    (scheduledTime) => {
                        try {
                            // ✅ GUARD: Only release if this is still the right note instance
                            // Check if there's a newer note with same pitch that started after us
                            instrument.releaseNote(noteMetadata.pitch, scheduledTime, releaseVelocity);
                        } catch (error) {
                            console.error(`Error in noteOff for ${noteMetadata.pitch}:`, error);
                        }
                    },
                    noteMetadata
                );
            }
        });
    }

    _schedulePatternAutomation(pattern) {
        // ✅ REFACTOR: Delegate to AutomationScheduler
        this.automationScheduler.schedulePatternAutomation(pattern);
    }

    _scheduleSongAutomation() {
        // ✅ REFACTOR: Delegate to AutomationScheduler
        const arrangementStore = useArrangementStore.getState();
        this.automationScheduler.scheduleSongAutomation(arrangementStore);
    }

    _scheduleAutomationEvents(targetId, automationData) {
        if (!Array.isArray(automationData)) return;

        automationData.forEach(event => {
            const eventTime = this._stepsToSeconds(event.time || 0);

            this.transport.scheduleEvent(
                eventTime,
                () => {
                    this._applyAutomationEvent(targetId, event);
                },
                { type: 'automation', targetId, event }
            );
        });
    }

    _applyAutomationEvent(targetId, event) {
        // Apply automation event to target (mixer channel, instrument parameter, etc.)
        const [type, id, parameter] = targetId.split('.');

        switch (type) {
            case 'mixer':
                this._applyMixerAutomation(id, parameter, event.value);
                break;
            case 'instrument':
                this._applyInstrumentAutomation(id, parameter, event.value);
                break;
            case 'effect':
                this._applyEffectAutomation(id, parameter, event.value);
                break;
            default:
        }
    }

    _applyMixerAutomation(channelId, parameter, value) {
        // ⚠️ REMOVED: mixerChannels - Replaced by MixerInsert system
        const insert = this.audioEngine.mixerInserts?.get(channelId);
        if (!insert) return;

        switch (parameter) {
            case 'volume':
                insert.setGain(value);
                break;
            case 'pan':
                insert.setPan(value);
                break;
            default:
        }
    }

    _applyInstrumentAutomation(instrumentId, parameter, value) {
        const instrument = this.audioEngine.instruments.get(instrumentId);
        if (!instrument || !instrument.parameters) return;

        const param = instrument.parameters.get(parameter);
        if (param) {
            param.setTargetAtTime(value, this.audioEngine.audioContext.currentTime, 0.01);
        }
    }

    _applyEffectAutomation(effectId, parameter, value) {
        // ⚠️ REMOVED: mixerChannels - Replaced by MixerInsert system
        // Find effect across all mixer inserts
        this.audioEngine.mixerInserts?.forEach((insert, insertId) => {
            const effect = insert.getEffect(effectId);
            if (effect) {
                effect.updateParameter?.(parameter, value);
            }
        });
    }

    // =================== UTILITY METHODS ===================

    _stepsToSeconds(steps) {
        return this.transport.stepsToSeconds(steps);
    }

    _secondsToSteps(seconds) {
        return this.transport.secondsToSteps(seconds);
    }

    /**
     * ✅ NEW: Format position for UI display
     * @param {number} step - Position in steps
     * @returns {string} Formatted position string
     */
    _formatPosition(step) {
        const bar = Math.floor(step / 16) + 1;
        const beat = Math.floor((step % 16) / 4) + 1;
        const subBeat = (step % 4) + 1;
        return `${bar}:${beat}:${subBeat}`;
    }

    /**
     * ✅ NEW: Flush all effect tails when playback stops
     * Sends flush message to all worklet-based effects (delay, reverb, etc.)
     * @private
     */
    _flushAllEffects() {
        if (!this.audioEngine) return;

        let flushedCount = 0;

        // 🎛️ MODERN SYSTEM: Flush mixer inserts (NativeEffect system)
        if (this.audioEngine.mixerInserts) {
            this.audioEngine.mixerInserts.forEach((insert) => {
                // ⚠️ FIX: Use getEffects() method instead of effects property
                const effects = insert.getEffects?.() || [];
                if (effects.length === 0) return;

                // Flush each effect in the insert
                effects.forEach((effect, effectId) => {
                    try {
                        // NativeEffect uses effect.node.port
                        if (effect.node && effect.node.port) {
                            effect.node.port.postMessage({ type: 'flush' });
                            flushedCount++;
                        }
                        // WorkletEffect uses effect.workletNode.port
                        else if (effect.workletNode && effect.workletNode.port) {
                            effect.workletNode.port.postMessage({ type: 'flush' });
                            flushedCount++;
                        }
                        // Try direct reset method if available
                        else if (effect.reset && typeof effect.reset === 'function') {
                            effect.reset();
                            flushedCount++;
                        }
                    } catch (e) {
                        console.warn(`Failed to flush effect ${effectId}:`, e);
                    }
                });
            });
        }

        // ⚠️ REMOVED: mixerChannels fallback - Replaced by MixerInsert system

        console.log(`🧹 Flushed ${flushedCount} effects`);
    }

    /**
     * @private
     * "8n", "4n" gibi notasyonları step birimine çevirir.
     * @param {string} duration - Nota süresi gösterimi (örn: "16n").
     * @returns {number} Sürenin step cinsinden karşılığı.
     */
    _getDurationInSteps(duration) {
        if (!duration || typeof duration !== 'string') {
            return 1; // Varsayılan süre 1 step (16'lık nota)
        }

        const bpm = this.transport.bpm || 120;
        // NativeTimeUtils kullanarak süreyi saniyeye çevir
        const durationInSeconds = NativeTimeUtils.parseTime(duration, bpm);
        // Transport'taki yardımcı fonksiyonla saniyeyi step'e çevir
        return this.transport.secondsToSteps(durationInSeconds);
    }

    _getNoteStartStep(note) {
        if (!note) return 0;
        if (typeof note.startTime === 'number' && !Number.isNaN(note.startTime)) {
            return note.startTime;
        }
        if (typeof note.time === 'number' && !Number.isNaN(note.time)) {
            return note.time;
        }
        return 0;
    }

    _getNoteLengthInSteps(note) {
        if (!note) return 1;
        if (typeof note.length === 'number' && note.length > 0) {
            return note.length;
        }
        if (note.duration) {
            return this._getDurationInSteps(note.duration) || 1;
        }
        return 1;
    }

    /**
     * ✅ NEW: Schedule newly added notes immediately during playback
     * @param {Array} addedNotes - Array of newly added notes with their instrument IDs
     */
    _scheduleNewNotesImmediate(addedNotes) {
        console.log('🎼 _scheduleNewNotesImmediate called:', {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            addedNotes
        });

        if (!this.isPlaying || this.isPaused) {
            console.log('⚠️ Not playing or paused, skipping immediate schedule');
            return;
        }

        // ✅ CRITICAL FIX: Use accurate current position from PlaybackManager
        // This ensures we schedule from the actual playback position, not transport's internal tick
        const currentTime = this.transport.audioContext.currentTime;
        const currentPosition = this.getCurrentPosition(); // ✅ Use PlaybackManager's position tracker
        const currentStep = currentPosition;

        // ✅ CRITICAL FIX: Calculate transport's real start time accurately
        // Use nextTickTime as reference point for accurate timing
        // nextTickTime represents when the current tick will play
        const nextTickTime = this.transport.nextTickTime || currentTime;
        const currentTick = this.transport.currentTick;
        const secondsPerTick = this.transport.getSecondsPerTick();

        // ✅ Calculate the absolute time when current step (0) would play
        // This is the reference point for all step-to-time conversions
        const transportStartTime = nextTickTime - (currentTick * secondsPerTick);

        console.log('📍 Current position:', {
            currentTime: currentTime.toFixed(4),
            currentStep: currentStep.toFixed(4),
            currentTick,
            nextTickTime: nextTickTime.toFixed(4),
            transportStartTime: transportStartTime.toFixed(4),
            loopStart: this.loopStart,
            loopEnd: this.loopEnd
        });

        addedNotes.forEach(({ instrumentId, note }) => {
            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (!instrument) {
                return;
            }

            // Support both legacy `time` and new `startTime` fields
            const noteStep = (note.startTime ?? note.time ?? 0);

            // ✅ CRITICAL: Check if note should play in current loop iteration
            const loopLength = this.loopEnd - this.loopStart;
            // Normalize modulo into [0, loopLength) to avoid negative remainders
            const normalize = (v, m) => {
                if (!m || m <= 0) return v; // No loop, passthrough
                const r = v % m;
                return r < 0 ? r + m : r;
            };
            const relativeCurrentStep = normalize(currentStep - this.loopStart, loopLength);
            const relativeNoteStep = normalize(noteStep - this.loopStart, loopLength);

            // Calculate when note should play
            let nextPlayStep;
            if (relativeNoteStep > relativeCurrentStep) {
                // Note is later in current loop - schedule for current loop
                nextPlayStep = noteStep;
            } else {
                // Note is earlier in loop - schedule for next loop iteration
                nextPlayStep = noteStep + loopLength;
            }

            // ✅ CRITICAL FIX: Convert step to absolute time using accurate transport start time
            // This ensures notes are scheduled from the current playback position, not pattern start
            const noteTimeInSteps = nextPlayStep;
            const noteTimeInSeconds = noteTimeInSteps * this.transport.stepsToSeconds(1);
            let absoluteTime = transportStartTime + noteTimeInSeconds;

            console.log('🎯 Scheduling note:', {
                instrumentId,
                noteStep,
                nextPlayStep,
                relativeCurrentStep: relativeCurrentStep.toFixed(4),
                relativeNoteStep: relativeNoteStep.toFixed(4),
                absoluteTime: absoluteTime.toFixed(4),
                currentTime: currentTime.toFixed(4),
                transportStartTime: transportStartTime.toFixed(4),
                timeDelta: (absoluteTime - currentTime).toFixed(4),
                willSchedule: absoluteTime > currentTime
            });

            // Schedule the note (with small tolerance to avoid boundary misses)
            const timeDelta = absoluteTime - currentTime;
            if (timeDelta <= 0.003) {
                // If we're too close or slightly in the past due to float drift, nudge to the near future
                const nudge = 0.01; // 10ms
                console.log(`⏱️ Nudge scheduling forward by ${nudge}s (delta=${timeDelta.toFixed(4)}s)`);
                absoluteTime = currentTime + nudge;
            }

            if (absoluteTime > currentTime) {
                console.log('✅ Passed time check, scheduling note...');

                // ✅ SCHEDULE OPT: Check if note is already scheduled to prevent duplicates
                const noteId = note.id;
                if (noteId && this.transport && this.transport.scheduledEvents) {
                    let alreadyScheduled = false;
                    for (const [scheduledTime, events] of this.transport.scheduledEvents.entries()) {
                        if (scheduledTime >= currentTime) { // Only check future events
                            for (const event of events) {
                                if (event.data && (
                                    event.data.noteId === noteId ||
                                    (event.data.note && event.data.note.id === noteId)
                                )) {
                                    console.log('⚠️ Note already scheduled, skipping duplicate:', noteId);
                                    alreadyScheduled = true;
                                    break;
                                }
                            }
                            if (alreadyScheduled) break;
                        }
                    }
                    if (alreadyScheduled) {
                        return; // Skip scheduling duplicate
                    }
                }

                // ✅ FIX: Calculate note duration properly
                // ✅ FIX: Handle oval notes (visualLength < length) - use length for audio duration
                let noteDuration;
                // ✅ FIX: Use ?? instead of || to handle 0 values correctly (fill pattern notes may have time: 0)
                const noteTimeInSteps = note.startTime ?? note.time ?? 0;

                // ✅ FIX: Check for oval notes FIRST (visualLength < length means oval note)
                const isOvalNote = note.visualLength !== undefined &&
                    typeof note.length === 'number' &&
                    note.length > 0 &&
                    note.visualLength < note.length;

                if (isOvalNote) {
                    // ✅ OVAL NOTES: Use length for audio duration (not visualLength)
                    noteDuration = this.transport.stepsToSeconds(note.length);
                    if (import.meta.env.DEV && (instrumentId === 'pluck' || instrument?.type === 'vasynth')) {
                        console.log(`🎵 Oval note detected (immediate): using length for audio duration`, {
                            noteId: note.id,
                            visualLength: note.visualLength,
                            length: note.length,
                            noteDuration: noteDuration.toFixed(3) + 's'
                        });
                    }
                } else if (typeof note.length === 'number' && note.length > 0) {
                    // NEW FORMAT: length in steps - normal note
                    noteDuration = this.transport.stepsToSeconds(note.length);
                } else if (note.visualLength === 1 && (typeof note.length !== 'number' || note.length <= 0)) {
                    // ✅ LEGACY OVAL NOTES: visualLength: 1 but no valid length - extend to pattern end
                    const arrangementStore = useArrangementStore.getState();
                    const activePattern = arrangementStore.patterns[arrangementStore.activePatternId];
                    if (activePattern) {
                        const patternLengthInSteps = activePattern.length || 64;
                        const noteStartStep = noteTimeInSteps;
                        const remainingSteps = Math.max(1, patternLengthInSteps - noteStartStep);
                        noteDuration = this.transport.stepsToSeconds(remainingSteps);
                        console.log(`🎵 Legacy oval note detected (immediate): extending to pattern end`, {
                            noteStartStep,
                            patternLengthInSteps,
                            remainingSteps,
                            noteDuration: noteDuration.toFixed(3) + 's'
                        });
                    } else {
                        noteDuration = this.transport.stepsToSeconds(1);
                    }
                } else if (note.duration) {
                    // LEGACY FORMAT: duration as string
                    noteDuration = note.duration === 'trigger' ?
                        this.transport.stepsToSeconds(0.1) :
                        NativeTimeUtils.parseTime(note.duration, this.transport.bpm);
                } else {
                    // FALLBACK: Default to 1 step
                    noteDuration = this.transport.stepsToSeconds(1);
                }

                console.log('🎼 Scheduling with:', {
                    pitch: note.pitch || 'C4',
                    velocity: note.velocity || 1,
                    duration: noteDuration,
                    absoluteTime,
                    instrumentId,
                    noteId
                });

                // ✅ SCHEDULE OPT: Schedule noteOn with noteId for cancellation tracking
                this.transport.scheduleEvent(
                    absoluteTime,
                    (scheduledTime) => {
                        console.log('🔊 TRIGGERING NOTE NOW:', {
                            instrumentId,
                            pitch: note.pitch || 'C4',
                            scheduledTime,
                            actualTime: this.transport.audioContext.currentTime
                        });

                        try {
                            instrument.triggerNote(
                                note.pitch || 'C4',
                                note.velocity || 1,
                                scheduledTime,
                                noteDuration
                            );
                            console.log('✅ Note triggered successfully');
                        } catch (error) {
                            console.error('❌ Error in immediate noteOn:', error);
                        }
                    },
                    {
                        type: 'noteOn',
                        instrumentId,
                        note,
                        noteId: note.id, // ✅ SCHEDULE OPT: Store note ID for cancellation
                        step: nextPlayStep,
                        immediate: true
                    }
                );

                console.log('📝 scheduleEvent called');

                // ✅ SCHEDULE OPT: Schedule noteOff with noteId for cancellation tracking
                const shouldScheduleNoteOff = (typeof note.length === 'number' && note.length > 0) ||
                    (note.duration && note.duration !== 'trigger');

                if (shouldScheduleNoteOff) {
                    console.log(`📝 Scheduling noteOff at ${absoluteTime + noteDuration}s (now: ${currentTime}s, in ${(absoluteTime + noteDuration - currentTime).toFixed(2)}s)`);

                    this.transport.scheduleEvent(
                        absoluteTime + noteDuration,
                        (scheduledTime) => {
                            console.log(`🔕 EXECUTING noteOff callback for ${note.pitch || 'C4'} at ${scheduledTime}s`);
                            try {
                                instrument.releaseNote(note.pitch || 'C4', scheduledTime);
                                console.log(`✅ releaseNote called successfully`);
                            } catch (error) {
                                console.error('❌ Error in immediate noteOff:', error);
                            }
                        },
                        {
                            type: 'noteOff',
                            instrumentId,
                            note,
                            noteId: note.id, // ✅ SCHEDULE OPT: Store note ID for cancellation
                            step: nextPlayStep,
                            immediate: true
                        }
                    );
                }
            } else {
                console.log('⚠️ FAILED time check - note in past:', {
                    absoluteTime,
                    currentTime,
                    diff: absoluteTime - currentTime
                });
            }
        });
    }

    /**
     * ✅ NEW: Stop all currently playing notes across all instruments
     * This prevents stuck notes when loop restarts or playback stops
     * 
     * @param {boolean} immediate - If true, use stopAll() for immediate stop (emergency only).
     *                               If false, use allNotesOff() for graceful release (pause/loop restart).
     * @param {number} fadeTime - Fade-out time in seconds (default: 0.01 for pause, 0.005 for loop restart)
     */
    _stopAllActiveNotes(immediate = false, fadeTime = 0.01) {
        let stoppedCount = 0;
        const currentTime = this.transport.audioContext.currentTime;

        this.audioEngine.instruments.forEach((instrument, instrumentId) => {
            try {
                // Check if instrument has active notes
                // ✅ FIX: NativeSamplerNode uses activeSources Set, not isPlaying or activeNotes
                const hasActiveNotes = (instrument.isPlaying !== undefined && instrument.isPlaying) ||
                    (instrument.activeSources && instrument.activeSources.size > 0) ||
                    (instrument.activeNotes && instrument.activeNotes.size > 0);

                // ✅ DEBUG: Log active notes check for 808
                if (import.meta.env.DEV && instrumentId.includes('808')) {
                    console.log(`🔍 _stopAllActiveNotes check for ${instrumentId}:`, {
                        isPlaying: instrument.isPlaying,
                        activeSourcesSize: instrument.activeSources?.size || 0,
                        activeNotesSize: instrument.activeNotes?.size || 0,
                        hasActiveNotes
                    });
                }

                if (hasActiveNotes) {
                    if (immediate) {
                        // ✅ EMERGENCY STOP: Only for panic button - immediate stop, no fade
                        // Use stopAll() for instant cleanup - no release envelope
                        if (typeof instrument.stopAll === 'function') {
                            instrument.stopAll();
                            stoppedCount++;
                        } else if (typeof instrument.allNotesOff === 'function') {
                            // Fallback: allNotesOff with immediate time
                            instrument.allNotesOff(currentTime);
                            stoppedCount++;
                        }
                    } else {
                        // ✅ GRACEFUL STOP: Use fade-out to prevent clicks (loop restart & pause)
                        // Try to use fade-out methods first
                        if (typeof instrument.allNotesOff === 'function') {
                            // ✅ NEW: Pass fadeTime to allNotesOff if it supports it
                            // For instruments that support fadeTime, use it for smoother transitions
                            if (instrument.allNotesOff.length >= 2) {
                                // allNotesOff(time, fadeTime) signature
                                instrument.allNotesOff(currentTime, fadeTime);
                            } else {
                                // allNotesOff(time) signature (fallback)
                                instrument.allNotesOff(currentTime);
                            }
                            stoppedCount++;
                        } else if (typeof instrument.noteOff === 'function') {
                            // ✅ NEW: Pass fadeTime to noteOff if it supports it
                            // noteOff(null) = stop all notes with release envelope
                            if (instrument.noteOff.length >= 4) {
                                // noteOff(midiNote, stopTime, releaseVelocity, fadeTime) signature
                                instrument.noteOff(null, currentTime, null, fadeTime);
                            } else {
                                // noteOff(null, currentTime) signature (fallback)
                                instrument.noteOff(null, currentTime);
                            }
                            stoppedCount++;
                        } else if (typeof instrument.stopAll === 'function') {
                            // ✅ NEW: Pass fadeTime to stopAll if it supports it
                            if (instrument.stopAll.length >= 1) {
                                // stopAll(fadeTime) signature
                                instrument.stopAll(fadeTime);
                            } else {
                                // stopAll() signature (fallback - uses default release)
                                instrument.stopAll();
                            }
                            stoppedCount++;
                        }
                    }
                }
            } catch (e) {
                console.error(`Error stopping active notes for ${instrumentId}:`, e);
            }
        });

        if (import.meta.env.DEV) {
            console.log(`🛑 _stopAllActiveNotes: Stopped ${stoppedCount} instruments (${immediate ? 'immediate' : `graceful ${(fadeTime * 1000).toFixed(1)}ms`})`);
        }
    }

    _clearScheduledEvents(useFade = false, filterFn = null) {
        if (this.transport && this.transport.clearScheduledEvents) {
            if (typeof filterFn === 'function') {
                this.transport.clearScheduledEvents(filterFn);
            } else {
                this.transport.clearScheduledEvents();
            }
        }

        // ✅ REFACTOR: Delegate audio source cleanup to AudioClipScheduler
        // Partial scheduling should not stop every clip
        if (!filterFn) {
            this.audioClipScheduler.stopAll(useFade);
        }
    }

    // =================== LOOP RESTART HELPER FUNCTIONS ===================

    /**
     * ✅ NEW: Check if a note is outside the loop boundaries
     * @param {number} noteStartStep - Note start position in steps
     * @param {number} noteEndStep - Note end position in steps (optional)
     * @returns {boolean} True if note is outside loop and should be stopped
     */
    _isNoteOutsideLoop(noteStartStep, noteEndStep = null) {
        if (!this.loopEnabled) {
            return false; // No loop, don't stop anything
        }

        // Note starts before loop end - it's inside the loop
        if (noteStartStep < this.loopEnd) {
            return false;
        }

        // Note starts at or after loop end
        // If note has an end time and it extends beyond loop end (sustain/release),
        // we should let it continue playing
        if (noteEndStep !== null && noteEndStep > this.loopEnd) {
            // This is a sustain/release note that extends beyond loop boundary
            // Let it continue playing (overlap handling)
            return false;
        }

        // Note is completely outside the loop
        return true;
    }

    /**
     * ✅ NEW: Stop only notes that are outside the loop boundaries
     * This allows notes in the last step and sustain/release notes to continue playing
     * @param {number} fadeTime - Fade-out time in seconds (default: 0.02)
     */
    _stopNotesOutsideLoop(fadeTime = 0.02) {
        if (!this.loopEnabled) {
            return; // No loop, nothing to do
        }

        let stoppedCount = 0;
        let preservedCount = 0;
        const currentTime = this.transport.audioContext.currentTime;

        this.audioEngine.instruments.forEach((instrument, instrumentId) => {
            try {
                // Get active notes from NoteScheduler
                const activeNotes = this.noteScheduler.getActiveNotes(instrumentId);
                if (!activeNotes || activeNotes.size === 0) {
                    return; // No active notes for this instrument
                }

                // Check each active note
                const notesToStop = [];
                const notesToPreserve = [];

                activeNotes.forEach((noteData, pitch) => {
                    // Convert startTime to step
                    const noteStartTime = noteData.startTime;
                    const noteEndTime = noteData.endTime;

                    // Calculate step positions using helper function
                    const noteStartStep = this._secondsToSteps(noteStartTime);
                    const noteEndStep = noteEndTime ? this._secondsToSteps(noteEndTime) : null;

                    // Check if note is outside loop
                    if (this._isNoteOutsideLoop(noteStartStep, noteEndStep)) {
                        notesToStop.push({ pitch, noteData });
                    } else {
                        notesToPreserve.push({ pitch, noteData });
                    }
                });

                // Stop only notes outside loop
                if (notesToStop.length > 0) {
                    notesToStop.forEach(({ pitch, noteData }) => {
                        try {
                            // Stop individual note with fade-out
                            if (typeof instrument.releaseNote === 'function') {
                                instrument.releaseNote(pitch, currentTime);
                            } else if (typeof instrument.noteOff === 'function') {
                                if (instrument.noteOff.length >= 4) {
                                    instrument.noteOff(pitch, currentTime, null, fadeTime);
                                } else {
                                    instrument.noteOff(pitch, currentTime);
                                }
                            }
                            stoppedCount++;
                        } catch (e) {
                            console.error(`Error stopping note ${pitch} for ${instrumentId}:`, e);
                        }
                    });
                }

                preservedCount += notesToPreserve.length;
            } catch (e) {
                console.error(`Error processing notes for ${instrumentId}:`, e);
            }
        });

        console.log('🔄 [LOOP RESTART] Stopping notes outside loop:', {
            loopEnd: this.loopEnd,
            stoppedCount,
            preservedCount,
            fadeTime: (fadeTime * 1000).toFixed(1) + 'ms'
        });
    }

    /**
     * ✅ NEW: Clear only scheduled events that are outside the loop boundaries
     * This preserves events in the last step and sustain/release events
     * @returns {number} Number of events cleared
     */
    _clearEventsOutsideLoop() {
        if (!this.loopEnabled || !this.transport || !this.transport.clearScheduledEvents) {
            return 0;
        }

        const loopEndStep = this.loopEnd;
        const loopEndTime = this.transport.stepsToSeconds(this.loopEnd);
        let clearedCount = 0;
        let preservedCount = 0;

        // Create filter function to clear only events outside loop
        const filterFn = (eventData) => {
            // Get step information from event data
            const eventStep = eventData.step;
            const eventTime = eventData.originalTime || eventData.sampleAccurateTime;

            // If we have step information, use it
            if (eventStep !== undefined) {
                // Check if event is outside loop
                if (eventStep >= loopEndStep) {
                    // Check if this is a noteOff event for a sustain/release note
                    // If the note started before loop end, preserve the noteOff
                    if (eventData.type === 'noteOff' && eventData.scheduledNoteOnTime) {
                        const noteOnStep = this._secondsToSteps(eventData.scheduledNoteOnTime);
                        if (noteOnStep < loopEndStep) {
                            // This is a noteOff for a note that started inside the loop
                            // Preserve it (sustain/release handling)
                            preservedCount++;
                            return false; // Don't clear
                        }
                    }
                    clearedCount++;
                    return true; // Clear this event
                } else {
                    preservedCount++;
                    return false; // Preserve this event
                }
            }

            // If we only have time information, use it
            if (eventTime !== undefined) {
                if (eventTime >= loopEndTime) {
                    // Similar logic for time-based filtering
                    if (eventData.type === 'noteOff' && eventData.scheduledNoteOnTime) {
                        if (eventData.scheduledNoteOnTime < loopEndTime) {
                            preservedCount++;
                            return false;
                        }
                    }
                    clearedCount++;
                    return true;
                } else {
                    preservedCount++;
                    return false;
                }
            }

            // If we can't determine position, preserve the event (safe default)
            preservedCount++;
            return false;
        };

        // Apply filter to clear events
        this.transport.clearScheduledEvents(filterFn);

        console.log('🔄 [LOOP RESTART] Clearing events outside loop:', {
            loopEnd: loopEndStep,
            clearedCount,
            preservedCount
        });

        return clearedCount;
    }

    // =================== STATUS & DEBUG ===================

    getPlaybackStatus() {
        return {
            mode: this.currentMode,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentPosition: this.currentPosition,
            loopStart: this.loopStart,
            loopEnd: this.loopEnd,
            loopEnabled: this.loopEnabled,
            isAutoLoop: this.isAutoLoop,
            bpm: this.transport?.bpm || 120
        };
    }

    getLoopInfo() {
        return {
            start: this.loopStart,
            end: this.loopEnd,
            length: this.loopEnd - this.loopStart,
            enabled: this.loopEnabled,
            auto: this.isAutoLoop,
            lengthInSeconds: this._stepsToSeconds(this.loopEnd - this.loopStart)
        };
    }

    /**
     * ✅ BONUS: Playback manager stats'ları al
     */
    getStats() {
        return {
            mode: this.currentMode,
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentPosition: this.currentPosition,
            loopInfo: this.getLoopInfo(),
            loopStats: this.loopStats,
            activePatternId: this.activePatternId,
            scheduledEventsCount: this.transport?.scheduledEvents?.size || 0
        };
    }

    // =================== EVENTS ===================

    on(event, callback) {
        if (!this.eventListeners) {
            this.eventListeners = new Map();
        }

        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }

        this.eventListeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.eventListeners?.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }

    _emit(event, data) {
        if (this.eventListeners?.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`PlaybackManager listener error for event "${event}":`, error);
                }
            });
        }
    }
}