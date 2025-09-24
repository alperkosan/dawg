// lib/core/PlaybackManager.js
// DAWG - Enhanced Playback System with Song/Pattern Modes

import { NativeTimeUtils } from '../utils/NativeTimeUtils.js';
import { usePlaybackStore } from '../../store/usePlaybackStore';
import { useArrangementStore } from '../../store/useArrangementStore';
import EventBus from './EventBus.js';

/**
 * ⚡ PERFORMANCE OPTIMIZATION: Debounced Scheduling System
 * Prevents excessive rescheduling when multiple notes are added/removed rapidly
 */
class SchedulingOptimizer {
    constructor() {
        this.pendingSchedule = null;
        this.scheduleDebounceTime = 16; // ~60fps (16ms)
        this.lastScheduleReason = '';
        this.scheduleCount = 0;
    }

    requestSchedule(callback, reason = 'unknown') {
        // Cancel any pending schedule
        if (this.pendingSchedule) {
            clearTimeout(this.pendingSchedule);
            console.log(`🔄 Debounced schedule request: ${this.lastScheduleReason} → ${reason}`);
        }

        this.lastScheduleReason = reason;
        this.scheduleCount++;

        // Schedule new callback with debounce
        this.pendingSchedule = setTimeout(() => {
            console.log(`⚡ Executing debounced schedule #${this.scheduleCount}: ${reason}`);
            callback();
            this.pendingSchedule = null;
        }, this.scheduleDebounceTime);
    }

    forceExecute(callback, reason = 'force') {
        if (this.pendingSchedule) {
            clearTimeout(this.pendingSchedule);
            this.pendingSchedule = null;
        }
        console.log(`🚀 Force executing schedule: ${reason}`);
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
        
        console.log('🎵 PlaybackManager initialized');
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
            
            console.log(`🧠 PlaybackManager received loop event:`);
            console.log(`   From tick: ${fromTick} → To tick: ${toTick}`);
            console.log(`   Next loop start: ${nextLoopStartTime?.toFixed(3) || time?.toFixed(3)}s`);
            
            // ✅ MERKEZI RESTART HANDLING
            this._handleLoopRestart(nextLoopStartTime || time);
        });

        // ✅ BONUS: Diğer transport event'leri de merkezi olarak yönet
        this.transport.on('start', (data) => {
            console.log('🧠 PlaybackManager: Transport started');
            this._emit('transportStart', data);
        });

        this.transport.on('stop', (data) => {
            console.log('🧠 PlaybackManager: Transport stopped');

            // ✅ FIX: Immediately update position to loop start on stop
            this.currentPosition = this.loopStart;
            this._emit('positionUpdate', {
                step: this.loopStart,
                formatted: this._formatPosition(this.loopStart)
            });

            this._emit('transportStop', data);
        });

        this.transport.on('pause', (data) => {
            console.log('🧠 PlaybackManager: Transport paused');

            // ✅ FIX: Update position on pause (keep current position)
            const currentStep = this.transport.ticksToSteps(this.transport.currentTick);
            this.currentPosition = currentStep;
            this._emit('positionUpdate', {
                step: currentStep,
                formatted: this._formatPosition(currentStep)
            });

            this._emit('transportPause', data);
        });

        this.transport.on('bar', (data) => {
            // Bar değişikliklerini UI'a bildir
            this._emit('barChange', data);
        });

        // ✅ BPM değişikliklerini dinle ve smooth transition sağla
        this.transport.on('bpm', (data) => {
            const { bpm, oldBpm, wasPlaying } = data;
            console.log(`🧠 PlaybackManager received BPM change: ${oldBpm} → ${bpm}`);

            if (wasPlaying) {
                // BPM değişikliği sırasında playback devam ediyorsa,
                // yeniden scheduling YAP ama loop pozisyonunu KORUMA
                console.log(`🎼 Rescheduling for BPM change during playback`);
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

        console.log('🔗 Global event listeners bound to PlaybackManager');
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
            console.log(`🎵 Pattern ${patternId} changed but not active, ignoring`);
            return;
        }

        console.log(`🎵 Central pattern change handler: ${patternId} - ${changeType}`);

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

        console.log(`🎵 Note added: ${instrumentId} at step ${note.time}`);

        // ✅ CRITICAL: Only immediate scheduling during playback, no full reschedule
        if (this.isPlaying && !this.isPaused) {
            console.log(`🚀 Immediate scheduling for new note during playback`);
            this._scheduleNewNotesImmediate([{ instrumentId, note }]);
        }
        // No else clause - we DON'T want full reschedule for single note additions
    }

    /**
     * ✅ NEW: Handle note removal
     * @param {Object} data - {patternId, instrumentId, noteId}
     */
    _handleNoteRemoved(data) {
        const { patternId } = data;

        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;

        console.log(`🎵 Note removed from pattern ${patternId}`);

        // Note removal requires minimal handling during playback
        // The note will simply not be scheduled in next loop iteration
    }

    /**
     * ✅ NEW: Handle note modification
     * @param {Object} data - {patternId, instrumentId, note}
     */
    _handleNoteModified(data) {
        const { patternId, instrumentId, note } = data;

        const arrangementStore = useArrangementStore.getState();
        if (patternId !== arrangementStore.activePatternId) return;

        console.log(`🎵 Note modified: ${instrumentId} at step ${note.time}`);

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
        console.log('🔄 Handling loop restart - immediate position sync');

        // ✅ CRITICAL: Immediately sync position to loop start for high BPM accuracy
        this.currentPosition = this.loopStart;

        // ✅ CRITICAL: Force transport position to loop start immediately
        if (this.transport.setPosition) {
            this.transport.setPosition(this.loopStart);
        }

        // Mevcut scheduled events'leri temizle
        this._clearScheduledEvents();

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

        console.log(`✅ Loop restart complete - position synced to step ${this.loopStart}`);
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
        console.log(`📊 Loop Stats: ${this.loopStats.totalLoops} total, avg interval: ${this.loopStats.averageLoopInterval.toFixed(1)}ms`);
    }

    // =================== MODE MANAGEMENT ===================

    setPlaybackMode(mode) {
        if (this.currentMode === mode) return;
        
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this.stop();
        }
        
        this.currentMode = mode;
        this._updateLoopSettings();
        
        console.log(`🔄 Playback mode changed to: ${mode}`);
        
        if (wasPlaying) {
            this.play();
        }
    }

    getPlaybackMode() {
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
        console.log(`📏 Loop points calculated: ${this.loopStart} -> ${this.loopEnd} steps`);
    }

    enableAutoLoop() {
        this.isAutoLoop = true;
        this._updateLoopSettings();
        console.log('🔄 Auto loop enabled');
    }

    setLoopEnabled(enabled) {
        this.loopEnabled = enabled;
        this._updateTransportLoop();
        console.log(`🔁 Loop ${enabled ? 'enabled' : 'disabled'}`);
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
            console.warn(`[PlaybackManager] No active pattern or pattern data found for ID: ${activePatternId}. Defaulting to 4 bars.`);
            this.loopStart = 0;
            this.loopEnd = 64; // 4 bar * 16 step/bar
            this.patternLength = 64;
            return;
        }
    
        console.log(`🔍 DEBUG: Calculating loop for pattern: ${activePatternId}`);
        console.log(`🔍 DEBUG: Pattern data keys:`, Object.keys(activePattern.data));

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

        console.log(`🔍 DEBUG: Instrument analysis:`, instrumentDetails);
        console.log(`🔍 DEBUG: Overall maxStep found: ${maxStep}`);
    
        // Uzunluğu en az 4 bar (64 step) yap ve en yakın bar sayısına yukarı yuvarla.
        // (1 bar = 16 step)
        this.patternLength = Math.max(64, Math.ceil(maxStep / 16) * 16);
        this.loopStart = 0;
        this.loopEnd = this.patternLength;
        
        console.log(`📏 Pattern loop calculated: 0 → ${this.loopEnd} steps (${this.loopEnd/16} bars)`);
        console.log(`   Max note end step found: ${maxStep} → rounded to ${this.patternLength} steps`);
    }

    _calculateSongLoop() {
        const arrangementStore = useArrangementStore.getState();
        const clips = arrangementStore.clips || [];
        
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
        
        console.log(`📏 Song loop calculated: ${this.songLength} bars (${this.loopEnd} steps)`);
    }

    _updateTransportLoop() {
        if (this.transport) {
            console.log(`🔍 DEBUG: Setting transport loop points: ${this.loopStart} -> ${this.loopEnd} steps`);
            console.log(`🔍 DEBUG: Transport loop enabled: ${this.loopEnabled}`);

            // ✅ DÜZELTME: Step'leri doğru şekilde transport'a gönder
            this.transport.setLoopPoints(this.loopStart, this.loopEnd);
            this.transport.setLoopEnabled(this.loopEnabled);

            // ⚡ OPTIMIZATION: Reduce duplicate logging - only log if loop points actually changed
            console.log(`🔁 Transport loop synced: ${this.loopStart} -> ${this.loopEnd} steps`);
        } else {
            console.warn(`🔍 DEBUG: No transport available to set loop points`);
        }
    }

    // =================== PLAYBACK CONTROLS ===================

    play(startStep = null) {
        if (this.isPlaying && !this.isPaused) return;

        // ✅ CRITICAL FIX: If resuming from pause, use resume() instead
        if (this.isPaused && startStep === null) {
            console.log(`🔄 Redirecting to resume() since already paused`);
            return this.resume();
        }

        try {
            const startTime = this.audioEngine.audioContext.currentTime;

            // ✅ FIX: Improved position handling - maintain current position unless explicitly changed
            if (startStep !== null) {
                // If explicitly requested to jump to a position
                this.jumpToStep(startStep);
            } else if (!this.isPaused && this.currentPosition === this.loopStart) {
                // Only reset to loop start if we're not paused AND we're already at the beginning
                // This prevents resetting when user has manually set position via jumpToStep
                if (this.transport.setPosition) {
                    this.transport.setPosition(this.loopStart);
                }
            }
            // Otherwise, keep current position (whether paused or manually set)

            console.log(`▶️ Starting playback from step ${this.currentPosition} at ${startTime.toFixed(3)}s`);

            this._updateLoopSettingsImmediate(); // Force immediate loop update for playback start
            this._scheduleContent(startTime, 'playback-start', true); // Force immediate scheduling for playback start
            this.transport.start(startTime);

            this.isPlaying = true;
            this.isPaused = false;
            usePlaybackStore.getState().setPlaybackState('playing');
        } catch (error) {
            console.error('❌ Playback start failed:', error);
            this.stop();
        }
    }

    pause() {
        if (!this.isPlaying || this.isPaused) {
            console.log('⚠️ Not playing or already paused');
            return;
        }

        try {
            // ✅ FIX: Sync current position before pausing (keep current position, don't reset)
            this.currentPosition = this.transport.ticksToSteps(this.transport.currentTick);

            this.transport.pause();
            this.isPaused = true;

            console.log(`⏸️ Playback paused at step ${this.currentPosition.toFixed(2)} (position preserved)`);

            // Notify stores
            usePlaybackStore.getState().setPlaybackState('paused');

        } catch (error) {
            console.error('❌ Pause failed:', error);
        }
    }

    resume() {
        if (!this.isPaused) {
            console.log('⚠️ Not paused');
            return;
        }

        try {
            const startTime = this.audioEngine.audioContext.currentTime;

            // ✅ CRITICAL FIX: Transport start() will check isPaused and preserve position
            this.transport.start(startTime);

            this.isPlaying = true;
            this.isPaused = false;

            console.log(`▶️ Playback resumed from step ${this.currentPosition.toFixed(2)}`);

            // ✅ CRITICAL FIX: Reschedule content from current position
            this._scheduleContent(startTime, 'resume', true);

            // Notify stores
            usePlaybackStore.getState().setPlaybackState('playing');

        } catch (error) {
            console.error('❌ Resume failed:', error);
        }
    }

    stop() {
        if (!this.isPlaying && !this.isPaused) return;

        try {
            this.transport.stop();
            this._clearScheduledEvents();

            this.isPlaying = false;
            this.isPaused = false;
            this.currentPosition = this.loopStart;

            // ✅ FIX: Reset transport position to loop start when stopping
            if (this.transport.setPosition) {
                this.transport.setPosition(this.loopStart);
            }

            console.log(`⏹️ Playback stopped and reset to step ${this.loopStart}`);
            usePlaybackStore.getState().setPlaybackState('stopped');
        } catch (error) {
            console.error('❌ Stop failed:', error);
        }
    }

    // =================== POSITION MANAGEMENT ===================

    jumpToStep(step) {
        const targetStep = Math.max(0, Math.min(step, this.loopEnd - 1));
        this.currentPosition = targetStep;

        // ✅ FIX: Always update transport position, whether playing or not
        if (this.transport.setPosition) {
            this.transport.setPosition(targetStep);
        }

        if (this.isPlaying) {
            // Reschedule from new position when playing
            this._clearScheduledEvents();
            this._scheduleContent(null, 'jump-to-step', false); // Allow debouncing for jump operations
        }

        // ✅ FIX: Emit position update for UI
        this._emit('positionUpdate', {
            step: targetStep,
            formatted: this._formatPosition(targetStep)
        });

        console.log(`🎯 Jumped to step ${targetStep} (playing: ${this.isPlaying})`);
    }

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
        console.warn(`⚠️ DEPRECATED: onPatternChanged called for pattern ${patternId} with reason: ${reason}. Use EventBus instead.`);
        if (addedNotes) {
            console.warn(`⚠️ ${addedNotes.length} notes were passed but ignored due to deprecation.`);
        }

        // Only log for debugging, don't actually process
        // This prevents double-scheduling issues
    }

    /**
     * ⚡ OPTIMIZED: Handle active pattern switch with immediate scheduling
     * Called when switching between different patterns
     */
    onActivePatternChanged(newPatternId, reason = 'pattern-switch') {
        console.log(`🎵 Active pattern switched to ${newPatternId}: ${reason}`);

        // Pattern switches need immediate scheduling to prevent audio gaps
        this._scheduleContent(null, `active-pattern-${reason}`, true);
    }

    jumpToTime(timeInSeconds) {
        const targetStep = this._secondsToSteps(timeInSeconds);
        this.jumpToStep(targetStep);
    }

    getCurrentPosition() {
        // ✅ FIX: Always use stored position unless actively playing
        if (this.isPlaying && !this.isPaused && this.transport) {
            // Get real-time position from transport during active playback
            const transportStep = this.transport.ticksToSteps?.(this.transport.currentTick);
            if (transportStep !== undefined) {
                // Keep position within loop bounds for accurate display
                const loopLength = this.loopEnd - this.loopStart;
                if (loopLength > 0) {
                    const relativeStep = (transportStep - this.loopStart) % loopLength;
                    const boundedPosition = this.loopStart + Math.max(0, relativeStep);
                    console.log(`🎯 Transport position: ${transportStep.toFixed(2)} -> bounded: ${boundedPosition.toFixed(2)}`);
                    return boundedPosition;
                }
                return transportStep;
            }
        }

        // ✅ CRITICAL: When stopped, paused, or no transport data, use stored position
        console.log(`🎯 Using stored position: ${this.currentPosition} (playing: ${this.isPlaying}, paused: ${this.isPaused})`);
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
            const baseTime = startTime || this.transport.audioContext.currentTime;

            console.log(`📋 Scheduling content from time: ${baseTime.toFixed(3)}s (reason: ${reason})`);

            // Önceki event'leri temizle (eğer daha önce temizlenmediyse)
            this._clearScheduledEvents();

            if (this.currentMode === 'pattern') {
                this._schedulePatternContent(baseTime);
            } else {
                this._scheduleSongContent(baseTime);
            }

            console.log('✅ Content scheduling complete');
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
            console.warn('⚠️ No active pattern to schedule');
            return;
        }

        console.log(`📋 Scheduling pattern: ${activePattern.name} from ${baseTime.toFixed(3)}s`);

        // Schedule notes for each instrument
        Object.entries(activePattern.data).forEach(([instrumentId, notes]) => {
            if (!Array.isArray(notes) || notes.length === 0) {
                return;
            }
            
            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (!instrument) {
                console.warn(`⚠️ Instrument not found: ${instrumentId}`);
                return;
            }

            console.log(`   ${instrumentId}: ${notes.length} notes`);
            this._scheduleInstrumentNotes(instrument, notes, instrumentId, baseTime);
        });
    }

    _scheduleSongContent() {
        const arrangementStore = useArrangementStore.getState();
        const clips = arrangementStore.clips || [];
        const patterns = arrangementStore.patterns || {};
        
        console.log(`🎬 Scheduling song: ${clips.length} clips`);

        clips.forEach(clip => {
            const pattern = patterns[clip.patternId];
            if (!pattern) return;

            const clipStartStep = (clip.startTime || 0) * 16; // Convert bars to steps

            // Schedule pattern notes with clip timing offset
            Object.entries(pattern.data).forEach(([instrumentId, notes]) => {
                if (!Array.isArray(notes) || notes.length === 0) return;
                
                const instrument = this.audioEngine.instruments.get(instrumentId);
                if (!instrument) return;

                // Offset notes by clip start time
                const offsetNotes = notes.map(note => ({
                    ...note,
                    time: (note.time || 0) + clipStartStep
                }));

                this._scheduleInstrumentNotes(instrument, offsetNotes, instrumentId);
            });
        });
    }

    /**
     * ✅ DÜZELTME: Instrument notes scheduling with base time
     * @param {*} instrument - Instrument instance
     * @param {Array} notes - Notes array
     * @param {string} instrumentId - Instrument ID
     * @param {number} baseTime - Base scheduling time
     */
    _scheduleInstrumentNotes(instrument, notes, instrumentId, baseTime) {
        // ✅ CRITICAL FIX: Get current transport position for relative scheduling
        const currentStep = this.transport.ticksToSteps(this.transport.currentTick);
        const currentPositionInSeconds = currentStep * this.transport.stepsToSeconds(1);

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
                    const loopLength = this.loopEnd - this.loopStart;
                    const loopTimeInSeconds = loopLength * this.transport.stepsToSeconds(1);
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

            const noteDuration = note.duration ?
                NativeTimeUtils.parseTime(note.duration, this.transport.bpm) :
                this.transport.stepsToSeconds(1);

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
                        console.log(`🎵 Note scheduled: ${instrumentId} - ${note.pitch} at step ${noteTimeInSteps} (${scheduledTime.toFixed(3)}s) [currentStep: ${currentStep.toFixed(2)}]`);
                    } catch (error) {
                        console.error(`❌ Note trigger failed: ${instrumentId}`, error);
                    }
                },
                { type: 'noteOn', instrumentId, note, step: noteTimeInSteps }
            );

            // Note off event (if needed)
            if (note.duration && note.duration !== 'trigger') {
                this.transport.scheduleEvent(
                    absoluteTime + noteDuration,
                    (scheduledTime) => {
                        try {
                            instrument.releaseNote(note.pitch || 'C4', scheduledTime);
                        } catch (error) {
                            console.error(`❌ Note release failed: ${instrumentId}`, error);
                        }
                    },
                    { type: 'noteOff', instrumentId, note }
                );
            }
        });
    }

    _schedulePatternAutomation(pattern) {
        // Schedule pattern-level automation
        // This would include things like pattern-specific mixer changes, effects automation, etc.
        if (pattern.automation) {
            Object.entries(pattern.automation).forEach(([targetId, automationData]) => {
                this._scheduleAutomationEvents(targetId, automationData);
            });
        }
    }

    _scheduleSongAutomation() {
        // Schedule song-level automation
        const arrangementStore = useArrangementStore.getState();
        if (arrangementStore.automation) {
            Object.entries(arrangementStore.automation).forEach(([targetId, automationData]) => {
                this._scheduleAutomationEvents(targetId, automationData);
            });
        }
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
                console.warn(`⚠️ Unknown automation target: ${targetId}`);
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
                console.warn(`⚠️ Unknown mixer parameter: ${parameter}`);
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

        console.log(`🚀 Immediate note scheduling - current step: ${currentStep.toFixed(2)}`);

        addedNotes.forEach(({ instrumentId, note }) => {
            const instrument = this.audioEngine.instruments.get(instrumentId);
            if (!instrument) {
                console.warn(`⚠️ Instrument not found for immediate scheduling: ${instrumentId}`);
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
                console.log(`📍 Note will play in current loop at step ${noteStep}`);
            } else {
                // Note is earlier in loop - schedule for next loop iteration
                nextPlayStep = noteStep + loopLength;
                console.log(`📍 Note will play in next loop at step ${nextPlayStep}`);
            }

            // Convert to absolute time
            const noteTimeInTicks = nextPlayStep * this.transport.ticksPerStep;
            const noteTimeInSeconds = noteTimeInTicks * this.transport.getSecondsPerTick();
            const loopStartTime = currentTime - (currentTick * this.transport.getSecondsPerTick());
            const absoluteTime = loopStartTime + noteTimeInSeconds;

            // Schedule the note
            if (absoluteTime > currentTime) {
                const noteDuration = note.duration ?
                    NativeTimeUtils.parseTime(note.duration, this.transport.bpm) :
                    this.transport.stepsToSeconds(1);

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
                            console.log(`🎵 Immediate note: ${instrumentId} - ${note.pitch} at ${scheduledTime.toFixed(3)}s`);
                        } catch (error) {
                            console.error(`❌ Immediate note trigger failed: ${instrumentId}`, error);
                        }
                    },
                    { type: 'noteOn', instrumentId, note, step: nextPlayStep, immediate: true }
                );

                console.log(`⚡ Scheduled immediate note: ${instrumentId} at step ${nextPlayStep} (${absoluteTime.toFixed(3)}s)`);
            } else {
                console.log(`⏰ Note time passed, will play next loop: ${instrumentId} at step ${nextPlayStep}`);
            }
        });
    }

    _clearScheduledEvents() {
        if (this.transport && this.transport.clearScheduledEvents) {
            this.transport.clearScheduledEvents();
        }

        console.log('🧹 Playback events cleared');
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
                    console.error(`❌ Event callback error (${event}):`, error);
                }
            });
        }
    }
}