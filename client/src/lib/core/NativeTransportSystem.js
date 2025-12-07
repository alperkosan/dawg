// lib/core/NativeTransportSystem.js
// DAWG - Native Transport System - ToneJS'siz tam native implementasyon
import EventBus from './EventBus'; // YENİ: EventBus'ı import ediyoruz.
import { SampleAccurateTime } from './utils/SampleAccurateTime.js'; // ✅ NEW: Sample-accurate timing
import { LookaheadScheduler } from './utils/LookaheadScheduler.js'; // ✅ NEW: Advanced lookahead scheduling
import { EventBatcher } from './utils/EventBatcher.js'; // ✅ NEW: Event batching for performance

export class NativeTransportSystem {
    constructor(audioContext) {
        this.audioContext = audioContext;

        // State management
        this.isPlaying = false;
        this.isPaused = false; // ✅ ADD: Track pause state explicitly
        this.bpm = 120;
        this.timeSignature = [4, 4];

        // ✅ Timing constants - STEPS vs TICKS vs SECONDS clarification
        this.ppq = 96; // pulses per quarter note (ticks)
        this.stepsPerBar = 16; // 16th note steps per bar (4/4 time)
        this.ticksPerStep = this.ppq / 4; // 24 ticks per step (16th note)
        this.ticksPerBar = this.ppq * this.timeSignature[0]; // 384 ticks per bar

        // ✅ Position tracking - ALL IN TICKS
        this.currentTick = 0;
        this.nextTickTime = 0;

        // ✅ NEW: Advanced lookahead scheduler (adaptive, 100-200ms range)
        this.lookaheadScheduler = new LookaheadScheduler(audioContext, {
            baseLookahead: 0.12, // 120ms base (optimal)
            minLookahead: 0.05,  // 50ms minimum
            maxLookahead: 0.2     // 200ms maximum
        });

        // ⚡ CRITICAL: Tighter scheduling window for better timing accuracy
        // ✅ NEW: Use adaptive lookahead from LookaheadScheduler
        this.lookAhead = this.lookaheadScheduler.getLookahead() * 1000; // Convert to ms

        // ✅ FAZ 1: Adaptive schedule ahead time based on BPM
        // ✅ NEW: Now uses LookaheadScheduler for more sophisticated calculation
        // Yüksek BPM (140+): 100ms, Orta BPM (100-140): 120ms, Düşük BPM (<100): 150ms
        this.scheduleAheadTime = this._calculateAdaptiveScheduleAhead();

        // ✅ CRITICAL: Loop system - ALL IN TICKS
        this.loop = true;
        this.loopStartTick = 0;
        this.loopEndTick = 64 * this.ticksPerStep; // 64 steps = 1536 ticks

        // Bar tracking
        this.currentBar = 0;

        this.callbacks = new Map();
        this.scheduledEvents = new Map();
        this.patterns = new Map(); // EKLENDİ
        this.activePatterns = new Set(); // EKLENDİ

        // ✅ NEW: Event batcher for performance optimization
        this.eventBatcher = new EventBatcher({
            batchSize: 32, // Process 32 events at once
            maxBatchTime: 0.001 // 1ms max batch processing time
        });

        // UI update throttling
        this.lastUIUpdate = 0;

        // ⚡ OPTIMIZATION: Loop calculation caching
        this.loopCache = {
            lastBpm: null,
            lastLoopStart: null,
            lastLoopEnd: null,
            lastTimeSignature: null,
            cachedLoopSeconds: null,
            cachedLoopTicks: null,
            cacheValid: false
        };

        // ✅ Initialize worker timer (LEGACY - replaced by SAB Sync)
        // this.initializeWorkerTimer();

        // ✅ NEW: Shared Memory initialization
        this._initSharedMemory();

        this._setupEventListeners();
    }

    _initSharedMemory() {
        try {
            // 32 floats/ints = 128 bytes
            this.sharedAudioState = new SharedArrayBuffer(128);
            this.sharedInt = new Int32Array(this.sharedAudioState);
            this.sharedFloat = new Float32Array(this.sharedAudioState);

            // Indices (Must match Rust SharedAudioState)
            this.SAB_IDX_PLAY_STATE = 0;
            this.SAB_IDX_MSG_COUNTER = 1;
            this.SAB_IDX_BPM = 16;
            this.SAB_IDX_POS_SAMPLES = 17;
            this.SAB_IDX_POS_TICKS = 18;
            this.SAB_IDX_SAMPLE_RATE = 19;

            console.log("✅ NativeTransportSystem: SharedArrayBuffer initialized");
        } catch (e) {
            console.error("❌ SharedArrayBuffer support missing! Fallback needed.", e);
        }
    }

    // Called by AudioContextService or AudioEngine
    linkAudioEngine(audioEngine) {
        this.audioEngine = audioEngine;
        let workletNode = null;

        // Handle both NativeAudioEngine (wrapper) and direct WorkletNode access
        if (audioEngine.unifiedMixer && audioEngine.unifiedMixer.workletNode) {
            workletNode = audioEngine.unifiedMixer.workletNode;
        } else if (audioEngine.unifiedMixerWorkletNode) {
            workletNode = audioEngine.unifiedMixerWorkletNode;
        }

        if (workletNode) {
            workletNode.port.postMessage({
                type: 'set-shared-state',
                sharedState: this.sharedAudioState
            });
            console.log("🔗 Transport linked to AudioEngine (SAB passed)");
        } else {
            console.warn("⚠️ Transport could not find UnifiedMixerWorkletNode to link!");
        }
    }

    /**
     * ✅ FAZ 1: Calculate adaptive schedule ahead time based on BPM
     * Yüksek BPM (140+): 120ms (optimized for better timing consistency)
     * Orta BPM (100-140): 120ms (optimal)
     * Düşük BPM (<100): 150ms (daha uzun, çünkü notalar daha yavaş)
     * @returns {number} Schedule ahead time in seconds
     */
    _calculateAdaptiveScheduleAhead() {
        if (this.bpm >= 140) {
            return 0.12; // ✅ OPTIMIZED: 120ms for high BPM
        } else if (this.bpm >= 100) {
            return 0.12; // 120ms for medium BPM
        } else {
            return 0.15; // 150ms for low BPM
        }
    }

    /**
     * Update schedule ahead time when BPM changes
     * ✅ NEW: Also updates LookaheadScheduler
     */
    _updateScheduleAheadTime() {
        this.scheduleAheadTime = this._calculateAdaptiveScheduleAhead();

        // ✅ NEW: Update lookahead scheduler with new BPM
        if (this.lookaheadScheduler) {
            const eventCount = this.scheduledEvents.size;
            this.lookaheadScheduler.updateLookahead(this.bpm, eventCount);
            this.lookAhead = this.lookaheadScheduler.getLookahead() * 1000;
        }
    }

    // YENİ: Tüm olay dinleyicilerini tek bir yerden yönetelim.
    _setupEventListeners() {
        EventBus.on('PLAY_REQUESTED', () => this.play());
        EventBus.on('STOP_REQUESTED', () => this.stop());
        EventBus.on('TEMPO_CHANGED', (payload) => {
            this.setBPM(payload.tempo); // ✅ FAZ 1: Use setBPM which updates schedule ahead time
        });
        // Gelecekte eklenebilecek diğer dinleyiciler:
        // EventBus.on('SEEK_REQUESTED', (payload) => this.seek(payload.tick));
    }

    // ✅ FAZ 1: Alias for setBPM (for compatibility)
    setTempo(tempo) {
        return this.setBPM(tempo);
    }

    // =================== BASIC TRANSPORT CONTROLS ===================

    start(when = null) {
        if (this.isPlaying) return;

        const startTime = when || this.audioContext.currentTime;
        this.isPlaying = true;

        // Logic for resume vs start from beginning handled by Rust/SAB mostly
        // But we write state to SAB
        if (!this.isPaused && (this.currentTick === this.loopStartTick || this.currentTick === 0)) {
            this.currentTick = this.loopStartTick;
        } else {
            this.isPaused = false;
        }

        const minDelay = SampleAccurateTime.getMinimumSafeOffset(this.audioContext, 64);
        const rawNextTickTime = Math.max(startTime + minDelay, this.audioContext.currentTime + minDelay);
        this.nextTickTime = SampleAccurateTime.toSampleAccurate(this.audioContext, rawNextTickTime);

        // ✅ COMMAND: PLAY (1)
        Atomics.store(this.sharedInt, this.SAB_IDX_PLAY_STATE, 1);
        // Note: Atomics cannot be used on Float32Array
        this.sharedFloat[this.SAB_IDX_BPM] = this.bpm;

        // Start Sync Loop
        this._startSyncLoop();

        this.triggerCallback('start', { time: startTime, position: this.currentTick });
        return this;
    }

    stop(when = null) {
        if (!this.isPlaying && !this.isPaused) return this;

        const stopTime = when || this.audioContext.currentTime;
        this.isPlaying = false;
        this.isPaused = false;

        // ✅ COMMAND: STOP (0)
        Atomics.store(this.sharedInt, this.SAB_IDX_PLAY_STATE, 0);

        this.currentTick = this.loopStartTick;
        this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);
        this.nextTickTime = stopTime;

        this.clearScheduledEvents();
        this._stopSyncLoop();

        this.triggerCallback('stop', { time: stopTime, position: this.currentTick });
        return this;
    }

    pause(when = null) {
        if (!this.isPlaying) return this;

        const pauseTime = when || this.audioContext.currentTime;
        this.isPlaying = false;
        this.isPaused = true;

        // ✅ COMMAND: PAUSE (2)
        Atomics.store(this.sharedInt, this.SAB_IDX_PLAY_STATE, 2);

        this._stopSyncLoop();

        this.triggerCallback('pause', { time: pauseTime, position: this.currentTick });
        return this;
    }

    _startSyncLoop() {
        if (this.syncAnimationFrame) cancelAnimationFrame(this.syncAnimationFrame);

        const loop = () => {
            if (!this.isPlaying) return;

            // 1. Read Position from Wasm
            // Float doesn't support Atomics.load. Direct read is atomic enough for aligned float32. 
            // SharedFloat is TypedArray, standard read is atomic enough for single writer.
            // Or use DataView for consistent endianness? 
            // For now, volatile read:
            const currentWasmTick = this.sharedFloat[this.SAB_IDX_POS_TICKS];

            // 2. Sync JS State (Visuals)
            // Only update if changed significantly? 
            // Actually, we use this to drive the scheduler
            if (currentWasmTick > this.currentTick) {
                // Determine delta
                this.currentTick = currentWasmTick;
                this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);

                // Trigger Visual Updates (Throttled)
                const now = performance.now();
                if (now - this.lastUIUpdate > 16.67) {
                    this.triggerCallback('tick', {
                        time: this.audioContext.currentTime,
                        position: this.currentTick,
                        formatted: this.formatPosition(this.currentTick),
                        bar: this.currentBar,
                        step: this.ticksToSteps(this.currentTick)
                    });
                    this.lastUIUpdate = now;
                }
            }

            // 3. Scheduler Call (Still needed for JS-side events)
            // But scheduler() iterates using nextTickTime. 
            // We should trust Wasm time.
            // For now, let's keep scheduler running to process queued events based on TIME.
            this.scheduler();

            this.syncAnimationFrame = requestAnimationFrame(loop);
        };
        this.syncAnimationFrame = requestAnimationFrame(loop);
    }

    _stopSyncLoop() {
        if (this.syncAnimationFrame) cancelAnimationFrame(this.syncAnimationFrame);
    }


    // =================== POSITION & TIMING ===================

    getPosition() {
        if (!this.isPlaying) return this.position;

        const elapsed = this.audioContext.currentTime - this.nextTickTime + this.getSecondsPerTick();
        const ticksElapsed = Math.floor(elapsed / this.getSecondsPerTick());
        return this.position + ticksElapsed;
    }

    /**
     * ✅ Get current position in steps (for AutomationScheduler compatibility)
     * Converts current tick position to steps with sub-step precision during playback
     */
    getCurrentStep() {
        if (!this.isPlaying) {
            return this.ticksToSteps(this.currentTick);
        }

        // Sub-step precision during playback
        const elapsed = this.audioContext.currentTime - this.nextTickTime + this.getSecondsPerTick();
        const ticksElapsed = Math.floor(elapsed / this.getSecondsPerTick());
        return this.ticksToSteps(this.currentTick + ticksElapsed);
    }

    setPosition(step) {
        const targetTick = this.stepsToTicks(step);
        this.currentTick = targetTick;
        this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);

        if (this.isPlaying) {
            this.nextTickTime = this.audioContext.currentTime;
        }

        this.triggerCallback('position', { position: this.currentTick, step: step });
        return this;
    }


    setLoopPoints(startStep, endStep) {

        // ⚡ OPTIMIZATION: Check cache validity first
        if (this._isLoopCacheValid(startStep, endStep)) {
            return;
        }

        // Convert steps to ticks (1 step = 24 ticks at PPQ=96)
        this.loopStartTick = startStep * this.ticksPerStep;
        // ✅ CRITICAL FIX: loopEnd is exclusive, so loopEndTick should be the first tick AFTER the last step
        // But we want the last step to complete, so we add one more tick to allow the last step's final tick
        // Example: if loopEnd = 16 steps, we want steps 0-15 to play fully
        // Step 15 is ticks 360-383, so loopEndTick should be 384 (start of step 16)
        // But we need to allow step 15 to complete, so we check when currentTick > loopEndTick
        // Actually, the issue is that we're checking >=, which triggers at the start of the next step
        // We should check > to allow the last step to complete
        this.loopEndTick = endStep * this.ticksPerStep;

        // ✅ FIX: Also set the tick-based properties for the duplicate loop logic
        this.loopStart = this.loopStartTick;
        this.loopEnd = this.loopEndTick;


        // ⚡ OPTIMIZATION: Update cache
        this._updateLoopCache(startStep, endStep);


        // Reset position if outside loop
        if (this.currentTick >= this.loopEndTick) {
            this.currentTick = this.loopStartTick;
            this.nextTickTime = this.audioContext.currentTime;
        }
    }

    setLoopEnabled(enabled) {
        this.loop = enabled;
    }

    setBPM(bpm) {
        // ✅ FIX: Remove BPM restrictions - only ensure positive value
        if (bpm <= 0 || isNaN(bpm)) {
            console.warn('Invalid BPM value:', bpm);
            return this;
        }

        // Store old BPM for timing adjustment
        const oldBpm = this.bpm;
        const wasPlaying = this.isPlaying;

        // ⚡ OPTIMIZATION: Invalidate loop cache when BPM changes
        if (this.bpm !== bpm) {
            this._invalidateLoopCache();
        }

        this.bpm = bpm;

        // ✅ FAZ 1: Update schedule ahead time when BPM changes
        this._updateScheduleAheadTime();

        // 🎯 CRITICAL: Adjust timing if playing to maintain smooth playback
        if (wasPlaying && oldBpm !== bpm) {
            // Recalibrate nextTickTime based on new BPM
            // Current position should remain the same, but timing intervals change
            const currentTime = this.audioContext.currentTime;
            this.nextTickTime = currentTime;

        }

        this.triggerCallback('bpm', { bpm: this.bpm, oldBpm, wasPlaying });
        return this;
    }

    setTimeSignature(numerator, denominator = 4) {
        // ⚡ OPTIMIZATION: Invalidate loop cache when time signature changes
        if (JSON.stringify(this.timeSignature) !== JSON.stringify([numerator, denominator])) {
            this._invalidateLoopCache();
        }

        this.timeSignature = [numerator, denominator];
        return this;
    }

    _calculatePatternLengthFromData(patternData) {
        let maxStep = 0;

        Object.values(patternData).forEach(notes => {
            if (Array.isArray(notes)) {
                notes.forEach(note => {
                    const noteTime = note.time || 0;
                    const noteDuration = 1; // Default 1 step
                    maxStep = Math.max(maxStep, noteTime + noteDuration);
                });
            }
        });

        // En az 64 step (4 bar), 16'nın katlarına yuvarla
        const calculatedLength = Math.max(64, Math.ceil(maxStep / 16) * 16);

        return calculatedLength;
    }

    // =================== SCHEDULING CORE ===================
    scheduler() {
        // ✅ NEW: Use sample-accurate time for scheduling window
        const currentTime = SampleAccurateTime.getCurrentSampleAccurateTime(this.audioContext);

        // ✅ NEW: Update lookahead based on current conditions
        let scheduleUntil;
        if (this.lookaheadScheduler) {
            const eventCount = this.scheduledEvents.size;
            this.lookaheadScheduler.updateLookahead(this.bpm, eventCount);
            this.lookAhead = this.lookaheadScheduler.getLookahead() * 1000; // Update lookahead in ms

            // ✅ NEW: Use adaptive schedule ahead time from LookaheadScheduler
            const adaptiveScheduleAhead = this.lookaheadScheduler.getLookahead();
            scheduleUntil = SampleAccurateTime.toSampleAccurate(
                this.audioContext,
                currentTime + adaptiveScheduleAhead
            );
        } else {
            // Fallback to original schedule ahead time if lookaheadScheduler not initialized
            scheduleUntil = SampleAccurateTime.toSampleAccurate(
                this.audioContext,
                currentTime + this.scheduleAheadTime
            );
        }

        while (this.nextTickTime < scheduleUntil) {
            // ✅ NEW: Ensure nextTickTime is sample-accurate
            const sampleAccurateTickTime = SampleAccurateTime.toSampleAccurate(
                this.audioContext,
                this.nextTickTime
            );

            // 1. UI callbacks with position info
            this.scheduleCurrentTick(sampleAccurateTickTime);

            // 2. ✅ FIXED: Process scheduled events at current time (sample-accurate)
            this.processScheduledEvents(sampleAccurateTickTime);

            this.advanceToNextTick();
        }
    }

    advanceToNextTick() {
        const secondsPerTick = this.getSecondsPerTick();
        const currentTime = this.audioContext.currentTime;
        const oldTick = this.currentTick;
        const oldNextTickTime = this.nextTickTime;

        // ✅ First: Always increment currentTick
        this.currentTick++;

        // ✅ Then: Check if we've reached or passed the loop boundary
        // loopEndTick is exclusive (e.g., for 16 steps, loopEndTick = 384)
        // When currentTick reaches 384, we should restart to 0
        if (this.loop && this.currentTick >= this.loopEndTick) {
            const previousTick = this.currentTick;

            // ✅ Reset to 0 (beginning) on loop restart
            this.currentTick = 0;

            // ✅ CRITICAL: nextTickTime is NOT updated - already correct from previous tick
            // This ensures perfect loop length consistency
            const step0StartTime = this.nextTickTime;

            // Clear scheduled events and trigger loop callback
            this.clearScheduledEvents();
            this.triggerCallback('loop', {
                time: step0StartTime,
                nextLoopStartTime: step0StartTime,
                fromTick: previousTick - 1,
                toTick: 0,
                needsReschedule: true
            });
        } else {
            // ✅ Normal tick: calculate next tick time (sample-accurate)
            this.nextTickTime = SampleAccurateTime.toSampleAccurate(
                this.audioContext,
                this.nextTickTime + secondsPerTick
            );
        }

        // Bar tracking (existing code)
        const newBar = Math.floor(this.currentTick / this.ticksPerBar);
        if (newBar !== this.currentBar) {
            this.currentBar = newBar;

            this.triggerCallback('bar', {
                time: this.nextTickTime,
                bar: this.currentBar,
                tick: this.currentTick
            });
        }
    }

    // ✅ YENİ EKLENEN: Event temizleme
    clearScheduledEvents() {
        this.scheduledEvents.clear();
    }

    // lib/core/NativeTransportSystem.js içinde scheduleCurrentTick metodunu güncelle
    scheduleCurrentTick(time) {
        // ⚡ PERFORMANS: Throttled UI updates - 60fps for smooth playhead
        const now = performance.now();
        if (now - this.lastUIUpdate > 16.67) { // 60fps for smooth UI
            this.triggerCallback('tick', {
                time: time,
                position: this.currentTick,
                formatted: this.formatPosition(this.currentTick),
                bar: this.currentBar,
                step: this.ticksToSteps(this.currentTick)
            });
            this.lastUIUpdate = now;
        }

        // Beat callback (her zaman trigger et - önemli)
        if (this.currentTick % this.ppq === 0) {
            const beat = Math.floor(this.currentTick / this.ppq) % this.timeSignature[0];
            this.triggerCallback('beat', { time, beat, tick: this.currentTick });
        }
    }

    /**
     * Dışarıdan bir olayı belirli bir zamanda çalınmak üzere sıraya alır.
     * @param {number} time - Olayın saniye cinsinden çalınacağı zaman.
     * @param {Function} callback - Zamanı geldiğinde çalıştırılacak fonksiyon.
     * @param {object} data - Callback'e gönderilecek ek veri.
     * @returns {string} - Zamanlanmış olayın benzersiz ID'si.
     */
    // ✅ CRITICAL FIX: Event scheduling with proper time conversion
    // ✅ NEW: Sample-accurate timing for professional precision
    scheduleEvent(timeInSeconds, callback, data = {}) {
        // ✅ NEW: Convert to sample-accurate time before scheduling
        const sampleAccurateTime = SampleAccurateTime.toSampleAccurate(
            this.audioContext,
            timeInSeconds
        );

        // ✅ NEW: Ensure time is in the future (avoid past-time errors)
        const safeTime = SampleAccurateTime.ensureFutureTime(
            this.audioContext,
            sampleAccurateTime
        );

        const eventId = `event_${Date.now()}_${Math.random()}`;

        // ✅ NEW: Use sample-accurate time as key for event storage
        if (!this.scheduledEvents.has(safeTime)) {
            this.scheduledEvents.set(safeTime, []);
        }

        this.scheduledEvents.get(safeTime).push({
            id: eventId,
            callback,
            data,
            originalTime: timeInSeconds, // Store original for debugging
            sampleAccurateTime: safeTime // Store sample-accurate time
        });

        return eventId;
    }

    processScheduledEvents(currentTime) {
        // ✅ NEW: Use event batching for better performance
        // Collect all due events first
        const dueEvents = [];
        for (const [scheduledTime, events] of this.scheduledEvents.entries()) {
            if (scheduledTime <= currentTime) {
                // Add events to batch queue with priority
                events.forEach(event => {
                    const priority = this._getEventPriority(event.data);
                    this.eventBatcher.addEvent(
                        event.callback,
                        scheduledTime,
                        event.data,
                        priority
                    );
                });
                dueEvents.push(scheduledTime);
            }
        }

        // Process batch
        const processedCount = this.eventBatcher.processDueEvents(currentTime);

        if (processedCount > 0 && import.meta.env.DEV) {
            console.log(`⏰ Processed ${processedCount} events in batch (currentTime: ${currentTime.toFixed(4)}s)`);
        }

        // Remove processed events from scheduled events map
        dueEvents.forEach(scheduledTime => {
            this.scheduledEvents.delete(scheduledTime);
        });

        // ✅ LEAK FIX: Clean stale events (older than 5 seconds)
        // This prevents unbounded growth due to timing precision issues
        const staleThreshold = currentTime - 5.0;
        for (const [scheduledTime] of this.scheduledEvents.entries()) {
            if (scheduledTime < staleThreshold) {
                this.scheduledEvents.delete(scheduledTime);
            }
        }
    }

    /**
     * ✅ NEW: Get event priority for batching
     * Higher priority events are processed first
     * 
     * @param {Object} eventData - Event data
     * @returns {number} Priority (higher = more important)
     */
    _getEventPriority(eventData) {
        // Priority levels:
        // 100: Critical (note on/off, transport events)
        // 50: High (automation, effects)
        // 0: Normal (UI updates, callbacks)

        if (!eventData || !eventData.type) {
            return 0;
        }

        switch (eventData.type) {
            case 'noteOn':
            case 'noteOff':
            case 'loop':
            case 'start':
            case 'stop':
                return 100; // Critical priority
            case 'automation':
            case 'effect':
                return 50; // High priority
            case 'tick':
            case 'beat':
            case 'bar':
                return 10; // Medium priority (UI updates)
            default:
                return 0; // Normal priority
        }
    }

    // ✅ LEAK FIX: Add method to clear scheduled events
    clearScheduledEvents(predicate = null) {
        if (predicate) {
            // Remove events matching predicate
            for (const [time, events] of this.scheduledEvents.entries()) {
                const filtered = events.filter(e => !predicate(e.data));
                if (filtered.length === 0) {
                    this.scheduledEvents.delete(time);
                } else {
                    this.scheduledEvents.set(time, filtered);
                }
            }
        } else {
            this.scheduledEvents.clear();
        }
    }

    _secondsToTicks(seconds) {
        const secondsPerTick = this.getSecondsPerTick();
        if (secondsPerTick === 0) return 0;
        return Math.round(seconds / secondsPerTick);
    }

    // =================== PATTERN SCHEDULING ===================

    schedulePattern(patternId, pattern, startTime = null) {
        startTime = startTime || this.audioContext.currentTime;

        const processedPattern = this.preprocessPattern(pattern);
        this.patterns.set(patternId, {
            ...processedPattern,
            startTime,
            originalPattern: pattern
        });

        this.activePatterns.add(patternId);

        return this;
    }

    stopPattern(patternId, when = null) {
        const stopTime = when || this.audioContext.currentTime;

        if (this.patterns.has(patternId)) {
            this.patterns.delete(patternId);
            this.activePatterns.delete(patternId);

            this.triggerCallback('patternStop', { patternId, time: stopTime });
        }

        return this;
    }

    schedulePatternEvents(currentTime) {
        this.activePatterns.forEach(patternId => {
            const pattern = this.patterns.get(patternId);
            if (!pattern) return;

            pattern.events.forEach(event => {
                const eventTime = pattern.startTime + event.time;

                if (Math.abs(eventTime - currentTime) < 0.001) { // 1ms tolerance
                    this.triggerCallback('patternEvent', {
                        patternId,
                        event,
                        time: currentTime
                    });
                }
            });
        });
    }

    preprocessPattern(pattern) {
        // Pattern'ı schedule edilebilir events'lere çevir
        const events = [];

        if (Array.isArray(pattern)) {
            pattern.forEach((note) => {
                if (note && note.time !== undefined) {
                    events.push({
                        type: 'note',
                        time: this.parseTime(note.time),
                        data: note
                    });
                }
            });
        }

        return { events, duration: this.calculatePatternDuration(events) };
    }

    // =================== TIME UTILITIES ===================

    /**
     * Adımları (steps) tick'lere çevirir.
     * Varsayılan olarak 1 step = 1/16'lık nota = 24 tick (eğer ppq=96 ise).
     * @param {number} steps - Adım sayısı.
     * @returns {number} Tick cinsinden değer.
     */
    stepsToTicks(steps) {
        return steps * this.ticksPerStep;
    }
    /**
     * Tick'leri adımlara (steps) çevirir.
     * @param {number} ticks - Tick sayısı.
     * @returns {number} Adım cinsinden değer.
     */
    ticksToSteps(ticks) {
        return ticks / this.ticksPerStep;
    }

    /**
     * Adımları (steps) saniyeye çevirir.
     * @param {number} steps - Adım sayısı.
     * @returns {number} Saniye cinsinden değer.
     */
    stepsToSeconds(steps) {
        const ticks = this.stepsToTicks(steps);
        return ticks * this.getSecondsPerTick();
    }

    /**
     * Saniyeyi adımlara (steps) çevirir. Bu fonksiyon hatanın ana nedenidir.
     * @param {number} seconds - Saniye değeri.
     * @returns {number} Adım cinsinden en yakın değer.
     */
    secondsToSteps(seconds) {
        const ticks = seconds / this.getSecondsPerTick();
        return this.ticksToSteps(ticks);
    }
    parseTime(timeValue) {
        if (typeof timeValue === 'number') {
            return timeValue; // Assume seconds
        }

        if (typeof timeValue === 'string') {
            // Parse formats like "1:2:0" (bar:beat:sixteenth)
            if (timeValue.includes(':')) {
                const parts = timeValue.split(':').map(Number);
                const [bar = 0, beat = 0, sixteenth = 0] = parts;

                return this.barBeatSixteenthToSeconds(bar, beat, sixteenth);
            }

            // Parse note durations like "4n", "8n", "16n"
            if (timeValue.match(/\d+[ndt]/)) {
                return this.noteDurationToSeconds(timeValue);
            }
        }

        return 0;
    }

    barBeatSixteenthToSeconds(bar, beat, sixteenth) {
        const totalSixteenths = (bar * this.timeSignature[0] * 4) + (beat * 4) + sixteenth;
        const sixteenthDuration = (60 / this.bpm) / 4; // Duration of one sixteenth note
        return totalSixteenths * sixteenthDuration;
    }

    noteDurationToSeconds(notation) {
        // "4n" = quarter note, "8n" = eighth note, etc.
        const matches = notation.match(/(\d+)([ndt])/);
        if (!matches) return 0;

        const [, noteValue, type] = matches;
        let duration = (60 / this.bpm) * (4 / parseInt(noteValue));

        if (type === 't') duration *= 2 / 3; // Triplet
        if (type === 'd') duration *= 1.5; // Dotted

        return duration;
    }

    // ✅ Position formatting
    formatPosition(ticks) {
        const bar = Math.floor(ticks / this.ticksPerBar);
        const beat = Math.floor((ticks % this.ticksPerBar) / this.ppq);
        const sixteenth = Math.floor((ticks % this.ppq) / (this.ppq / 4));
        return `${bar}:${beat}:${sixteenth}`;
    }

    // ✅ DÜZELTME: getCurrentTime
    getCurrentTime() {
        return this.audioContext.currentTime;
    }

    // ✅ DÜZELTME: Tick to seconds conversion
    getSecondsPerTick() {
        const secondsPerBeat = 60.0 / this.bpm;
        return secondsPerBeat / this.ppq;
    }

    // =================== EVENT SYSTEM ===================

    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, new Set());
        }
        this.callbacks.get(event).add(callback);
        return this;
    }

    off(event, callback) {
        if (this.callbacks.has(event)) {
            this.callbacks.get(event).delete(callback);
        }
        return this;
    }

    triggerCallback(event, data = {}) {
        if (this.callbacks.has(event)) {
            this.callbacks.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                }
            });
        }
    }

    // =================== UTILITY METHODS ===================

    calculatePatternDuration(events) {
        if (events.length === 0) return 0;
        return Math.max(...events.map(event => event.time + (event.data.duration || 0)));
    }

    applySwing(time, position) {
        if (this.swingFactor === 0) return time;

        const sixteenthPosition = position % (this.ppq / 4);
        if (sixteenthPosition === this.ppq / 8) { // Off-beat sixteenth
            const swingDelay = (this.getSecondsPerTick() * 2) * this.swingFactor * 0.3;
            return time + swingDelay;
        }

        return time;
    }

    getStats() {
        return {
            isPlaying: this.isPlaying,
            bpm: this.bpm,
            position: this.getPosition(),
            formattedPosition: this.formatPosition(this.getPosition()),
            timeSignature: this.timeSignature,
            activePatterns: this.activePatterns.size,
            scheduledEvents: this.scheduledEvents.size,
            audioLatency: this.audioContext.baseLatency || 'unknown',
            audioContextState: this.audioContext.state
        };
    }

    // ⚡ OPTIMIZATION: Loop cache helper methods
    _isLoopCacheValid(startStep, endStep) {
        const cache = this.loopCache;
        return cache.cacheValid &&
            cache.lastBpm === this.bpm &&
            cache.lastLoopStart === startStep &&
            cache.lastLoopEnd === endStep &&
            JSON.stringify(cache.lastTimeSignature) === JSON.stringify(this.timeSignature);
    }

    _updateLoopCache(startStep, endStep) {
        const cache = this.loopCache;
        cache.lastBpm = this.bpm;
        cache.lastLoopStart = startStep;
        cache.lastLoopEnd = endStep;
        cache.lastTimeSignature = [...this.timeSignature];
        cache.cachedLoopTicks = this.loopEndTick - this.loopStartTick;
        cache.cachedLoopSeconds = cache.cachedLoopTicks * this.getSecondsPerTick();
        cache.cacheValid = true;

    }

    _invalidateLoopCache() {
        this.loopCache.cacheValid = false;
    }

    dispose() {
        // ✅ LEAK FIX: Comprehensive cleanup
        this.stop();

        // Cleanup worker timer
        if (this.timerWorker) {
            this.timerWorker.postMessage('stop'); // Stop internal timer first
            this.timerWorker.terminate();
            this.timerWorker = null;
        }

        // ✅ LEAK FIX: Revoke blob URL
        if (this.workerBlobUrl) {
            URL.revokeObjectURL(this.workerBlobUrl);
            this.workerBlobUrl = null;
        }

        // Clear data structures
        this.callbacks.clear();
        this.scheduledEvents.clear();

        // Nullify references
        this.audioContext = null;

        console.log('🗑️ NativeTransportSystem disposed');
    }
}