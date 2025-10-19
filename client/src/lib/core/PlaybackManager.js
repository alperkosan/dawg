// lib/core/PlaybackManager.js
// DAWG - Enhanced Playback System with Song/Pattern Modes

import { NativeTimeUtils } from '../utils/NativeTimeUtils.js';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useArrangementWorkspaceStore } from '@/store/useArrangementWorkspaceStore';
import { useArrangementV2Store } from '@/store/useArrangementV2Store';
import EventBus from './EventBus.js';
import { PositionTracker } from './PositionTracker.js';
import { audioAssetManager } from '@/lib/audio/AudioAssetManager';

// ✅ NEW: Modular scheduler system
import {
    NoteScheduler,
    AutomationScheduler,
    AudioClipScheduler
} from './playback/index.js';

/**
 * ⚡ PERFORMANCE OPTIMIZATION: Debounced Scheduling System
 * Prevents excessive rescheduling when multiple notes are added/removed rapidly
 */
class SchedulingOptimizer {
    constructor() {
        this.pendingSchedule = null;
        this.scheduleDebounceTime = 50; // ✅ OPTIMIZATION: Increased from 16ms to 50ms for better debouncing
        this.lastScheduleReason = '';
        this.scheduleCount = 0;
    }

    requestSchedule(callback, reason = 'unknown') {
        // Cancel any pending schedule
        if (this.pendingSchedule) {
            clearTimeout(this.pendingSchedule);
        }

        this.lastScheduleReason = reason;
        this.scheduleCount++;

        // Schedule new callback with debounce
        this.pendingSchedule = setTimeout(() => {
            callback();
            this.pendingSchedule = null;
        }, this.scheduleDebounceTime);
    }

    forceExecute(callback, reason = 'force') {
        if (this.pendingSchedule) {
            clearTimeout(this.pendingSchedule);
            this.pendingSchedule = null;
        }
        callback();
    }

    isSchedulePending() {
        return this.pendingSchedule !== null;
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

        // Playback state
        this.currentMode = 'pattern'; // 'pattern' | 'song'
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPosition = 0; // in steps
        
        // Loop settings
        this.loopEnabled = true;
        this.loopStart = 0; // in steps
        this.loopEnd = 64; // in steps
        this.isAutoLoop = true; // Auto calculate loop points
        
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

    }

    /**
     * @private
     * Transport'tan gelen temel olayları (döngü gibi) dinler ve
     * bunlara göre yeniden planlama yapar.
     */
    _bindTransportEvents() {
        // ✅ MERKEZI LOOP HANDLING - Transport loop event'ini yakala
        this.transport.on('loop', (data) => {
            const { nextLoopStartTime, fromTick, toTick, time } = data;
            
            
            // ✅ MERKEZI RESTART HANDLING
            this._handleLoopRestart(nextLoopStartTime || time);
        });

        // ✅ BONUS: Diğer transport event'leri de merkezi olarak yönet
        this.transport.on('start', (data) => {
            this._emit('transportStart', data);
        });

        this.transport.on('stop', (data) => {

            // ✅ FIX: Reset position tracker and emit accurate position
            this.positionTracker.clearCache();
            this.currentPosition = this.loopStart;

            const position = this.positionTracker.jumpToStep(this.loopStart);
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

        // Only handle active pattern
        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;


        // ✅ CRITICAL: Only immediate scheduling during playback, no full reschedule
        if (this.isPlaying && !this.isPaused) {
            this._scheduleNewNotesImmediate([{ instrumentId, note }]);
        }
        // No else clause - we DON'T want full reschedule for single note additions
    }

    /**
     * ✅ NEW: Handle note removal
     * @param {Object} data - {patternId, instrumentId, noteId, note}
     */
    _handleNoteRemoved(data) {
        const { patternId, instrumentId, note } = data;

        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;

        // ✅ CRITICAL FIX: If note is currently playing, stop it immediately
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

        // The note will not be scheduled in next loop iteration
    }

    /**
     * ✅ NEW: Handle note modification
     * @param {Object} data - {patternId, instrumentId, note}
     */
    _handleNoteModified(data) {
        const { patternId, instrumentId, note } = data;

        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;


        // For note modifications, treat as remove + add
        if (this.isPlaying && !this.isPaused) {
            this._scheduleNewNotesImmediate([{ instrumentId, note }]);
        }
    }

    /**
     * ✅ FIXED: Loop restart handler with immediate position sync
     * @param {number} nextStartTime - Bir sonraki loop'un başlangıç zamanı
     */
    _handleLoopRestart(nextStartTime = null) {
        // ✅ OPTIMIZATION: Prevent duplicate scheduling if already pending
        if (this.schedulingOptimizer.isSchedulePending()) {
            return;
        }

        // ✅ CONSISTENT: Reset to loopStart (not hardcoded 0)
        this.currentPosition = this.loopStart;

        // ✅ CONSISTENT: Force transport position to loopStart immediately
        if (this.transport.setPosition) {
            this.transport.setPosition(this.loopStart);
        }

        // ✅ OPTIMIZATION: DON'T clear here - Transport already cleared (line 303 NativeTransportSystem.js)
        // _clearScheduledEvents will be called inside _scheduleContent anyway
        // Removing this prevents DOUBLE clearing

        // ✅ CRITICAL FIX: Stop all active notes to prevent stuck notes on loop restart
        this._stopAllActiveNotes();

        // Content'i yeniden schedule et
        const startTime = nextStartTime || this.transport.audioContext.currentTime;
        this._scheduleContent(startTime, 'loop-restart', true); // Force immediate scheduling for loop restart

        // ✅ BONUS: Loop restart analytics
        this._trackLoopRestart();

        // UI'ı bilgilendir - use corrected position
        this._emit('loopRestart', {
            time: startTime,
            tick: this.loopStart * this.transport.ticksPerStep,
            step: this.loopStart,
            mode: this.currentMode,
            patternId: this.activePatternId
        });

    }

    /**
     * ✅ YENİ: Loop restart analytics/tracking
     * @private
     */
    _trackLoopRestart() {
        if (!this.loopStats) {
            this.loopStats = {
                totalLoops: 0,
                loopsInCurrentSession: 0,
                lastLoopTime: null,
                averageLoopInterval: 0
            };
        }
        
        const now = performance.now();
        
        if (this.loopStats.lastLoopTime) {
            const interval = now - this.loopStats.lastLoopTime;
            this.loopStats.averageLoopInterval = 
                (this.loopStats.averageLoopInterval + interval) / 2;
        }
        
        this.loopStats.totalLoops++;
        this.loopStats.loopsInCurrentSession++;
        this.loopStats.lastLoopTime = now;
        
        // Debug info
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
                    const noteTime = note.time || 0;
                    // Notanın süresini step cinsinden al, varsayılan olarak 1 step (16'lık nota)
                    const noteDuration = this._getDurationInSteps(note.duration) || 1;
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

    
        // Uzunluğu en az 4 bar (64 step) yap ve en yakın bar sayısına yukarı yuvarla.
        // (1 bar = 16 step)
        this.patternLength = Math.max(64, Math.ceil(maxStep / 16) * 16);
        this.loopStart = 0;
        this.loopEnd = this.patternLength;
        
    }

    _calculateSongLoop() {
        // ✅ Try ArrangementV2Store first (new system), fallback to old system
        const v2Store = useArrangementV2Store.getState();
        const v2Clips = v2Store.clips || [];

        let clips;
        if (v2Clips.length > 0) {
            clips = v2Clips;
        } else {
            const arrangementStore = useArrangementStore.getState();
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
            // ✅ DÜZELTME: Step'leri doğru şekilde transport'a gönder
            this.transport.setLoopPoints(this.loopStart, this.loopEnd);
            this.transport.setLoopEnabled(this.loopEnabled);
        } else {
        }
    }

    // =================== PLAYBACK CONTROLS ===================

    play(startStep = null) {
        if (this.isPlaying && !this.isPaused) return;

        // ✅ FIX: If paused, use resume() instead of restarting
        if (this.isPaused && startStep === null) {
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

            // ✅ CRITICAL: Always ensure transport position matches our intended position
            if (this.transport.setPosition) {
                this.transport.setPosition(playPosition);
            }

            this._updateLoopSettingsImmediate(); // Force immediate loop update for playback start
            this._scheduleContent(startTime, 'playback-start', true); // Force immediate scheduling for playback start
            this.transport.start(startTime);

            this.isPlaying = true;
            this.isPaused = false;
            // usePlaybackStore.getState().setPlaybackState('playing'); // ✅ Handled by PlaybackController
        } catch (error) {
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


            // Notify stores
            // usePlaybackStore.getState().setPlaybackState('paused'); // ✅ Handled by PlaybackController

        } catch (error) {
        }
    }

    resume() {
        if (!this.isPaused) {
            return;
        }

        try {
            const startTime = this.audioEngine.audioContext.currentTime;

            // ✅ CRITICAL FIX: Transport start() will check isPaused and preserve position
            this.transport.start(startTime);

            this.isPlaying = true;
            this.isPaused = false;


            // ✅ CRITICAL FIX: Reschedule content from current position
            this._scheduleContent(startTime, 'resume', true);

            // Notify stores
            // usePlaybackStore.getState().setPlaybackState('playing'); // ✅ Handled by PlaybackController

        } catch (error) {
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


            // ✅ REFACTOR: Stop all active audio sources via AudioClipScheduler
            this.audioClipScheduler.stopAll();

            // ✅ NEW: Flush all effect tails (delay, reverb, etc.)
            this._flushAllEffects();

            this._clearScheduledEvents();

            this.isPlaying = false;
            this.isPaused = false;

            // ✅ DAW STANDARD: Always reset to 0 on stop
            this.currentPosition = 0;
            if (this.transport.setPosition) {
                this.transport.setPosition(0);
            }


            // Update UI position
            const { usePlaybackStore } = require('../../store/usePlaybackStore');
            const playbackStore = usePlaybackStore.getState();
            playbackStore.set({ transportPosition: '1:1:0', transportStep: 0 });

            // usePlaybackStore.getState().setPlaybackState('stopped'); // ✅ Handled by PlaybackController
        } catch (error) {
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
    onPatternChanged(patternId, reason = 'pattern-edit', addedNotes = null) {

        // Only log for debugging, don't actually process
        // This prevents double-scheduling issues
    }

    /**
     * ⚡ OPTIMIZED: Handle active pattern switch with immediate scheduling
     * Called when switching between different patterns
     */
    onActivePatternChanged(newPatternId, reason = 'pattern-switch') {

        // Pattern switches need immediate scheduling to prevent audio gaps
        this._scheduleContent(null, `active-pattern-${reason}`, true);
    }

    jumpToTime(timeInSeconds) {
        const targetStep = this._secondsToSteps(timeInSeconds);
        this.jumpToStep(targetStep);
    }

    getCurrentPosition() {
        // ✅ NEW: Use PositionTracker for accurate position management
        const position = this.positionTracker.getCurrentPosition();

        // During active playback, ensure loop bounds
        if (this.isPlaying && !this.isPaused) {
            const loopLength = this.loopEnd - this.loopStart;
            if (loopLength > 0) {
                const relativeStep = (position.stepFloat - this.loopStart) % loopLength;
                const boundedStep = this.loopStart + Math.max(0, relativeStep);

                return boundedStep;
            }
            return position.stepFloat;
        }

        // For stopped/paused states, use stored position
        return this.currentPosition;
    }
    // =================== CONTENT SCHEDULING ===================

    /**
     * ⚡ OPTIMIZED: Debounced content scheduling to prevent excessive rescheduling
     * @param {number} startTime - İçeriğin planlanacağı başlangıç zamanı
     * @param {string} reason - Scheduling reason for debugging
     * @param {boolean} force - Force immediate execution without debouncing
     */
    _scheduleContent(startTime = null, reason = 'manual', force = false) {
        const scheduleCallback = () => {
            // ✅ PERFORMANCE TRACKING: Start timing
            const scheduleStartTime = performance.now();

            const baseTime = startTime || this.transport.audioContext.currentTime;

            // Önceki event'leri temizle (eğer daha önce temizlenmediyse)
            this._clearScheduledEvents();

            let scheduledNotes = 0;
            let scheduledInstruments = 0;

            if (this.currentMode === 'pattern') {
                const result = this._schedulePatternContent(baseTime);
                scheduledNotes = result?.totalNotes || 0;
                scheduledInstruments = result?.instrumentCount || 0;
            } else {
                try {
                    const result = this._scheduleSongContent(baseTime);
                    scheduledNotes = result?.totalNotes || 0;
                    scheduledInstruments = result?.instrumentCount || 0;
                } catch (error) {
                    console.error('🎵 ❌ Error in _scheduleSongContent:', error);
                }
            }

            // ✅ PERFORMANCE TRACKING: End timing
            const scheduleEndTime = performance.now();
            const scheduleDuration = (scheduleEndTime - scheduleStartTime).toFixed(2);

        };

        // Use debounced scheduling unless forced
        if (force) {
            this.schedulingOptimizer.forceExecute(scheduleCallback, reason);
        } else {
            this.schedulingOptimizer.requestSchedule(scheduleCallback, reason);
        }
    }

    /**
     * ✅ DÜZELTME: Pattern content scheduling with base time
     * @param {number} baseTime - Base scheduling time
     */
    _schedulePatternContent(baseTime) {
        const arrangementStore = useArrangementStore.getState();
        const activePattern = arrangementStore.patterns[arrangementStore.activePatternId];

        if (!activePattern) {
            return { totalNotes: 0, instrumentCount: 0 };
        }

        const instrumentCount = Object.keys(activePattern.data).length;
        const totalNotes = Object.values(activePattern.data).reduce((sum, notes) => sum + (notes?.length || 0), 0);

        // Schedule notes for each instrument
        Object.entries(activePattern.data).forEach(([instrumentId, notes]) => {
            if (!Array.isArray(notes) || notes.length === 0) {
                return;
            }

            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (!instrument) {
                return;
            }

            this._scheduleInstrumentNotes(instrument, notes, instrumentId, baseTime);
        });

        // ✅ Return metrics for performance tracking
        return { totalNotes, instrumentCount };
    }

    _scheduleSongContent(baseTime) {

        // ✅ Try ArrangementV2Store first (new system), fallback to workspace store (old system)
        const v2Store = useArrangementV2Store.getState();
        const v2Clips = v2Store.clips || [];
        const v2Tracks = v2Store.tracks || [];

        let clips, tracks, patterns;

        if (v2Clips.length > 0 || v2Tracks.length > 0) {
            // Use ArrangementV2 (new system)
            clips = v2Clips;
            tracks = v2Tracks;
            const arrangementStore = useArrangementStore.getState();
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
            const arrangementStore = useArrangementStore.getState();
            patterns = arrangementStore.patterns || {};
        }

        // ✅ Check for solo tracks
        const soloTracks = tracks.filter(t => t.solo);
        const hasSolo = soloTracks.length > 0;


        if (clips.length === 0) {
            // Don't return - allow playback to continue silently so playhead still moves
        }

        clips.forEach((clip, index) => {
            // ✅ Check track mute/solo state
            const track = tracks.find(t => t.id === clip.trackId);
            if (!track) {
                return;
            }

            // Skip if track is muted
            if (track.muted) {
                return;
            }

            // If any track is solo, only play clips on solo tracks
            if (hasSolo && !track.solo) {
                return;
            }

            // ✅ Handle different clip types: 'pattern' or 'audio'
            if (clip.type === 'audio') {
                // Schedule audio sample clip
                this._scheduleAudioClip(clip, baseTime);
            } else {
                // Schedule pattern clip (default)
                const pattern = patterns[clip.patternId];
                if (!pattern) {
                    return;
                }

                // Convert clip startTime and duration to steps (16th notes)
                // 1 beat = 4 sixteenth notes
                const clipStartStep = Math.floor((clip.startTime || 0) * 4);
                const clipDurationBeats = clip.duration || pattern.length || 4; // Use pattern length if available
                const clipDurationSteps = clipDurationBeats * 4;

                // Schedule pattern notes with clip timing offset
                Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
                    if (!Array.isArray(notes) || notes.length === 0) {
                        return;
                    }

                    const instrument = this.audioEngine.instruments.get(instrumentId);
                    if (!instrument) {
                        console.warn(`🎵 ❌ Instrument ${instrumentId} not found`);
                        return;
                    }


                    // Filter and offset notes by clip start time and duration
                    const offsetNotes = notes
                        .filter(note => {
                            // Only include notes within clip duration
                            const noteTime = note.time || 0;
                            return noteTime < clipDurationSteps;
                        })
                        .map(note => ({
                            ...note,
                            time: (note.time || 0) + clipStartStep
                        }));


                    if (offsetNotes.length > 0) {
                        this._scheduleInstrumentNotes(instrument, offsetNotes, instrumentId, baseTime, clip.id);
                    }
                });
            }
        });


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

                    Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
                        if (!Array.isArray(notes) || notes.length === 0) return;
                        const instrument = this.audioEngine.instruments.get(instrumentId);
                        if (!instrument) return;

                        const offsetNotes = notes
                            .filter(note => (note.time || 0) < clipDurationSteps)
                            .map(note => ({ ...note, time: (note.time || 0) + clipStartStep }));

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

        // 1. Clear scheduled transport events for this clip
        // This relies on the transport supporting a filter function for clearScheduledEvents
        // and that events were scheduled with a clipId property.
        if (this.transport.clearScheduledEvents) {
            this.transport.clearScheduledEvents(event => event.clipId === clipId);
        }

        // 2. Stop any currently playing audio sources for this clip
        const sourcesToStop = this.activeAudioSources.filter(source => source.clipId === clipId);
        sourcesToStop.forEach(source => {
            try {
                source.stop();
            } catch (e) { /* Already stopped */ }
        });
        this.activeAudioSources = this.activeAudioSources.filter(source => source.clipId !== clipId);

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
        if (clip.pan !== undefined && clip.pan !== 0) {
            const panNode = context.createStereoPanner();
            panNode.pan.value = clip.pan;
            gainNode.connect(panNode);
            outputNode = panNode;
        }

        // ✅ ArrangementV2: Route to mixer channel with inheritance logic
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
            const mixerChannel = this.audioEngine.mixerChannels.get(mixerChannelId);

            if (mixerChannel && mixerChannel.input) {
                destination = mixerChannel.input;
                const routeType = clip.isUnique ? 'unique' : (clip.assetId ? 'shared' : 'track');
            } else {
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

        // ✅ FIX: Track this source so it can be stopped later
        this.activeAudioSources.push(source);

        // ✅ FIX: Auto-cleanup when source finishes playing
        source.onended = () => {
            const index = this.activeAudioSources.indexOf(source);
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
    _scheduleInstrumentNotes(instrument, notes, instrumentId, baseTime, clipId = null) {
        // ✅ REFACTOR: Delegate to NoteScheduler for simple cases
        // Complex loop-aware scheduling still handled here for now (TODO: move to NoteScheduler)

        // ✅ FIX: Use PlaybackManager's currentPosition, not transport.currentTick
        // (transport may lag behind after jumpToStep)
        const currentStep = this.currentPosition; // ✅ Use our accurate position
        const currentPositionInSeconds = currentStep * this.transport.stepsToSeconds(1);

        // ✅ OPTIMIZATION: Cache loop calculations outside the loop (calculated once per instrument, not per note)
        const loopLength = this.loopEnd - this.loopStart;
        const loopTimeInSeconds = this.loop ? loopLength * this.transport.stepsToSeconds(1) : 0;

        notes.forEach(note => {
            // Note timing calculation
            const noteTimeInSteps = note.time || 0;
            const noteTimeInTicks = noteTimeInSteps * this.transport.ticksPerStep;
            const noteTimeInSeconds = noteTimeInTicks * this.transport.getSecondsPerTick();

            // ✅ CRITICAL FIX: Calculate relative time from current position
            const relativeTime = noteTimeInSeconds - currentPositionInSeconds;
            let absoluteTime = baseTime + relativeTime;

            // ✅ CRITICAL FIX: Handle loop-aware scheduling with proper current position handling
            if (absoluteTime < baseTime) {
                // Note is in the past - schedule for next loop if looping is enabled
                if (this.loop) {
                    absoluteTime = baseTime + relativeTime + loopTimeInSeconds;

                    // If still in past after loop adjustment, skip it
                    if (absoluteTime < baseTime) {
                        return;
                    }
                } else {
                    // No looping - skip past notes
                    return;
                }
            }

            // ✅ FIX: Support both new format (length: number) and legacy format (duration: string)
            let noteDuration;
            if (typeof note.length === 'number') {
                // NEW FORMAT: length in steps (number)
                noteDuration = this.transport.stepsToSeconds(note.length);
            } else if (note.duration) {
                // LEGACY FORMAT: duration as string ("4n", "8n", etc)
                noteDuration = note.duration === 'trigger' ?
                    this.transport.stepsToSeconds(0.1) :
                    NativeTimeUtils.parseTime(note.duration, this.transport.bpm);
            } else {
                // FALLBACK: Default to 1 step
                noteDuration = this.transport.stepsToSeconds(1);
            }

            // Note on event
            this.transport.scheduleEvent(
                absoluteTime,
                (scheduledTime) => {
                    try {
                        instrument.triggerNote(
                            note.pitch || 'C4',
                            note.velocity || 1,
                            scheduledTime,
                            noteDuration
                        );
                    } catch (error) {
                    }
                },
                { type: 'noteOn', instrumentId, note, step: noteTimeInSteps, clipId }
            );

            // ✅ FIX: Note off event - check for both length and duration
            const shouldScheduleNoteOff = (typeof note.length === 'number' && note.length > 0) ||
                                         (note.duration && note.duration !== 'trigger');

            if (shouldScheduleNoteOff) {
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


                this.transport.scheduleEvent(
                    absoluteTime + noteDuration,
                    (scheduledTime) => {
                        try {
                            // ✅ GUARD: Only release if this is still the right note instance
                            // Check if there's a newer note with same pitch that started after us
                            instrument.releaseNote(noteMetadata.pitch, scheduledTime);
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
        const channel = this.audioEngine.mixerChannels.get(channelId);
        if (!channel) return;

        switch (parameter) {
            case 'volume':
                channel.setVolume(value);
                break;
            case 'pan':
                channel.setPan(value);
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
        // Find effect across all mixer channels
        this.audioEngine.mixerChannels.forEach(channel => {
            const effect = channel.effects.get(effectId);
            if (effect) {
                effect.updateParameter(parameter, value);
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
        if (!this.audioEngine || !this.audioEngine.mixerChannels) return;

        // Iterate through all mixer channels
        this.audioEngine.mixerChannels.forEach((channel, channelId) => {
            if (!channel.effects) return;

            // Flush each effect in the channel
            channel.effects.forEach((effect, effectId) => {
                try {
                    // NativeEffect uses effect.node.port
                    if (effect.node && effect.node.port) {
                        effect.node.port.postMessage({ type: 'flush' });
                    }
                    // WorkletEffect uses effect.workletNode.port
                    else if (effect.workletNode && effect.workletNode.port) {
                        effect.workletNode.port.postMessage({ type: 'flush' });
                    }
                    // Try direct reset method if available
                    else if (effect.reset && typeof effect.reset === 'function') {
                        effect.reset();
                    }
                } catch (e) {
                    // Silent fail - effect may not support flushing
                }
            });
        });
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

    /**
     * ✅ NEW: Schedule newly added notes immediately during playback
     * @param {Array} addedNotes - Array of newly added notes with their instrument IDs
     */
    _scheduleNewNotesImmediate(addedNotes) {
        if (!this.isPlaying || this.isPaused) return;

        const currentTime = this.transport.audioContext.currentTime;
        const currentTick = this.transport.currentTick;
        const currentStep = this.transport.ticksToSteps(currentTick);


        addedNotes.forEach(({ instrumentId, note }) => {
            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (!instrument) {
                return;
            }

            const noteStep = note.time || 0;

            // ✅ CRITICAL: Check if note should play in current loop iteration
            const loopLength = this.loopEnd - this.loopStart;
            const relativeCurrentStep = (currentStep - this.loopStart) % loopLength;
            const relativeNoteStep = (noteStep - this.loopStart) % loopLength;

            // Calculate when note should play
            let nextPlayStep;
            if (relativeNoteStep > relativeCurrentStep) {
                // Note is later in current loop - schedule for current loop
                nextPlayStep = noteStep;
            } else {
                // Note is earlier in loop - schedule for next loop iteration
                nextPlayStep = noteStep + loopLength;
            }

            // Convert to absolute time
            const noteTimeInTicks = nextPlayStep * this.transport.ticksPerStep;
            const noteTimeInSeconds = noteTimeInTicks * this.transport.getSecondsPerTick();
            const loopStartTime = currentTime - (currentTick * this.transport.getSecondsPerTick());
            const absoluteTime = loopStartTime + noteTimeInSeconds;

            // Schedule the note
            if (absoluteTime > currentTime) {
                // ✅ FIX: Calculate note duration properly
                let noteDuration;
                if (typeof note.length === 'number') {
                    // NEW FORMAT: length in steps
                    noteDuration = this.transport.stepsToSeconds(note.length);
                } else if (note.duration) {
                    // LEGACY FORMAT: duration as string
                    noteDuration = note.duration === 'trigger' ?
                        this.transport.stepsToSeconds(0.1) :
                        NativeTimeUtils.parseTime(note.duration, this.transport.bpm);
                } else {
                    // FALLBACK: Default to 1 step
                    noteDuration = this.transport.stepsToSeconds(1);
                }

                // ✅ FIX: Schedule noteOn
                this.transport.scheduleEvent(
                    absoluteTime,
                    (scheduledTime) => {
                        try {
                            instrument.triggerNote(
                                note.pitch || 'C4',
                                note.velocity || 1,
                                scheduledTime,
                                noteDuration
                            );
                        } catch (error) {
                            console.error('Error in immediate noteOn:', error);
                        }
                    },
                    { type: 'noteOn', instrumentId, note, step: nextPlayStep, immediate: true }
                );

                // ✅ CRITICAL FIX: Schedule noteOff to prevent stuck notes!
                const shouldScheduleNoteOff = (typeof note.length === 'number' && note.length > 0) ||
                                             (note.duration && note.duration !== 'trigger');

                if (shouldScheduleNoteOff) {
                    this.transport.scheduleEvent(
                        absoluteTime + noteDuration,
                        (scheduledTime) => {
                            try {
                                instrument.releaseNote(note.pitch || 'C4', scheduledTime);
                            } catch (error) {
                                console.error('Error in immediate noteOff:', error);
                            }
                        },
                        { type: 'noteOff', instrumentId, note, step: nextPlayStep, immediate: true }
                    );
                }


            } else {
            }
        });
    }

    /**
     * ✅ NEW: Stop all currently playing notes across all instruments
     * This prevents stuck notes when loop restarts or playback stops
     */
    _stopAllActiveNotes() {
        let stoppedCount = 0;

        this.audioEngine.instruments.forEach((instrument, instrumentId) => {
            try {
                // Check if instrument has active notes
                const hasActiveNotes = instrument.isPlaying ||
                                      (instrument.activeSources && instrument.activeSources.size > 0) ||
                                      (instrument.activeNotes && instrument.activeNotes.size > 0);

                if (hasActiveNotes) {
                    // Use allNotesOff for graceful release, fallback to stopAll for immediate
                    if (typeof instrument.allNotesOff === 'function') {
                        instrument.allNotesOff();
                        stoppedCount++;
                    } else if (typeof instrument.stopAll === 'function') {
                        instrument.stopAll();
                        stoppedCount++;
                    }
                }
            } catch (e) {
                console.error(`Error stopping active notes for ${instrumentId}:`, e);
            }
        });

        if (stoppedCount > 0) {
        }
    }

    _clearScheduledEvents(useFade = false) {
        if (this.transport && this.transport.clearScheduledEvents) {
            this.transport.clearScheduledEvents();
        }

        // ✅ IMPROVED: Fade out active audio sources for smooth transitions
        if (this.activeAudioSources && this.activeAudioSources.length > 0) {
            const fadeTime = useFade ? 0.015 : 0; // 15ms fade - fast but smooth (optimized)
            const currentTime = this.transport?.audioContext?.currentTime || 0;


            this.activeAudioSources.forEach(source => {
                try {
                    // If source has a gain node, fade it out
                    if (useFade && source.gainNode && source.gainNode.gain) {
                        source.gainNode.gain.cancelScheduledValues(currentTime);
                        source.gainNode.gain.setValueAtTime(source.gainNode.gain.value, currentTime);
                        source.gainNode.gain.linearRampToValueAtTime(0, currentTime + fadeTime);

                        // Stop after fade completes
                        setTimeout(() => {
                            try {
                                source.stop();
                            } catch (e) {
                                // Already stopped
                            }
                        }, fadeTime * 1000 + 5); // +5ms buffer (reduced from 10ms)
                    } else {
                        // Immediate stop (no fade)
                        source.stop();
                    }
                } catch (e) {
                    // Source may already be stopped
                }
            });
            this.activeAudioSources = [];
        }
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
                }
            });
        }
    }
}