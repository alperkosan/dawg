// lib/core/NativeTransportSystem.js
// DAWG - Native Transport System - ToneJS'siz tam native implementasyon

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
        this.lookAhead = 25.0;
        this.scheduleAheadTime = 0.1;

        // ✅ CRITICAL: Loop system - ALL IN TICKS
        this.loop = true;
        this.loopStartTick = 0;
        this.loopEndTick = 64 * this.ticksPerStep; // 64 steps = 1536 ticks
        
        // Bar tracking
        this.currentBar = 0;
        
        this.callbacks = new Map();
        this.scheduledEvents = new Map();
        
        // ✅ Initialize worker timer
        this.initializeWorkerTimer();
        
        console.log('🎵 NativeTransportSystem initialized:');
        console.log(`   PPQ: ${this.ppq} ticks/quarter`);
        console.log(`   Steps per bar: ${this.stepsPerBar}`);
        console.log(`   Ticks per step: ${this.ticksPerStep}`);
        console.log(`   Loop: ${this.loopStartTick} → ${this.loopEndTick} ticks`);
        console.log(`   Loop: ${this.loopStartTick / this.ticksPerStep} → ${this.loopEndTick / this.ticksPerStep} steps`);
    }

    // =================== TIMER INITIALIZATION ===================

    initializeWorkerTimer() {
        const workerScript = `
            let timerID = null;
            let interval = 25;

            self.onmessage = function(e) {
                if (e.data === 'start') {
                    timerID = setInterval(() => {
                        postMessage('tick');
                    }, interval);
                } else if (e.data === 'stop') {
                    clearInterval(timerID);
                }
            };
        `;

        const blob = new Blob([workerScript], { type: 'application/javascript' });
        this.timerWorker = new Worker(URL.createObjectURL(blob));

        this.timerWorker.onmessage = () => {
            if (this.isPlaying) {
                this.scheduler();
            }
        };
        
        console.log('⏱️ Worker timer initialized');
    }

    // =================== BASIC TRANSPORT CONTROLS ===================

    // ✅ Start/Stop methods remain the same
    start(when = null) {
        if (this.isPlaying) return;

        const startTime = when || this.audioContext.currentTime;
        this.isPlaying = true;
        
        // ✅ CRITICAL FIX: Always start from loop beginning unless explicitly paused
        if (!this.isPaused) {
            this.currentTick = this.loopStartTick;
            this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);
        }
        
        // ✅ CRITICAL FIX: Set nextTickTime to current audio time, not relative to position
        this.nextTickTime = startTime;

        console.log(`▶️ Transport starting at tick ${this.currentTick} (${this.formatPosition(this.currentTick)}), time ${startTime.toFixed(3)}s`);
        console.log(`🔁 Loop: ${this.loopStartTick} → ${this.loopEndTick} ticks (${this.loop ? 'enabled' : 'disabled'})`);

        this.timerWorker.postMessage('start');
        this.triggerCallback('start', { time: startTime, position: this.currentTick });
        
        return this;
    }

    stop(when = null) {
        if (!this.isPlaying && !this.isPaused) return this;

        const stopTime = when || this.audioContext.currentTime;
        this.isPlaying = false;
        this.isPaused = false; // ✅ CLEAR: Clear pause state on stop

        this.timerWorker.postMessage('stop');

        // ✅ CRITICAL FIX: Always reset to loop start on stop
        this.currentTick = this.loopStartTick;
        this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);
        this.nextTickTime = stopTime; // Will be overridden on next start

        this.clearScheduledEvents();
        this.triggerCallback('stop', { time: stopTime, position: this.currentTick });
        
        console.log(`⏹️ Transport stopped, reset to tick ${this.currentTick} (${this.formatPosition(this.currentTick)})`);
        return this;
    }

    // ✅ CLEANUP: Dispose method
    // ✅ CRITICAL FIX: Pause state management
    pause(when = null) {
        if (!this.isPlaying) return this;

        const pauseTime = when || this.audioContext.currentTime;
        this.isPlaying = false;
        this.isPaused = true; // ✅ ADD: Track pause state

        this.timerWorker.postMessage('stop');
        
        // Keep current position, don't reset
        this.triggerCallback('pause', { time: pauseTime, position: this.currentTick });
        console.log(`⏸️ Transport paused at position ${this.formatPosition(this.currentTick)}`);
        return this;
    }

    // =================== POSITION & TIMING ===================

    getPosition() {
        if (!this.isPlaying) return this.position;

        const elapsed = this.audioContext.currentTime - this.nextTickTime + this.getSecondsPerTick();
        const ticksElapsed = Math.floor(elapsed / this.getSecondsPerTick());
        return this.position + ticksElapsed;
    }

    setPosition(step) {
        const targetTick = this.stepsToTicks(step);
        this.currentTick = targetTick;
        this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);

        if (this.isPlaying) {
            this.nextTickTime = this.audioContext.currentTime;
        }

        this.triggerCallback('position', { position: this.currentTick, step: step });
        console.log(`🎯 Position set to ${this.formatPosition(this.currentTick)} (step ${step})`);
        return this;
    }

    setLoopPoints(startStep, endStep) {
        // Convert steps to ticks (1 step = 24 ticks at PPQ=96)
        this.loopStartTick = startStep * this.ticksPerStep;
        this.loopEndTick = endStep * this.ticksPerStep;
        
        console.log(`🔁 Loop points set:`);
        console.log(`   Steps: ${startStep} → ${endStep} (${endStep - startStep} steps = ${(endStep - startStep)/16} bars)`);
        console.log(`   Ticks: ${this.loopStartTick} → ${this.loopEndTick} (${this.loopEndTick - this.loopStartTick} ticks)`);
        console.log(`   Seconds: ${(this.loopStartTick * this.getSecondsPerTick()).toFixed(2)} → ${(this.loopEndTick * this.getSecondsPerTick()).toFixed(2)}`);
        
        // Reset position if outside loop
        if (this.currentTick >= this.loopEndTick) {
            console.warn('[Transport] Current position beyond loop end, resetting to start');
            this.currentTick = this.loopStartTick;
            this.nextTickTime = this.audioContext.currentTime;
        }
    }

    setLoopEnabled(enabled) {
        this.loop = enabled;
    }

    setBPM(bpm) {
        if (bpm < 60 || bpm > 200) {
            console.warn('⚠️ BPM out of reasonable range (60-200)');
        }

        this.bpm = bpm;
        this.triggerCallback('bpm', { bpm: this.bpm });
        console.log(`🎼 BPM set to ${bpm}`);
        return this;
    }

    setTimeSignature(numerator, denominator = 4) {
        this.timeSignature = [numerator, denominator];
        console.log(`🎼 Time signature set to ${numerator}/${denominator}`);
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
        
        console.log(`📐 Pattern length calculated: ${calculatedLength} steps (${calculatedLength/16} bars) from max step ${maxStep}`);
        return calculatedLength;
    }    

    // =================== SCHEDULING CORE ===================
    scheduler() {
        const scheduleUntil = this.audioContext.currentTime + this.scheduleAheadTime;

        while (this.nextTickTime < scheduleUntil) {
            // 1. UI callbacks with position info
            this.scheduleCurrentTick(this.nextTickTime);
            
            // 2. ✅ FIXED: Process scheduled events at current time
            this.processScheduledEvents(this.nextTickTime);
            
            this.advanceToNextTick();
        }
    }

    advanceToNextTick() {
        const secondsPerTick = this.getSecondsPerTick();
        this.currentTick++;
        
        if (this.loop && this.currentTick >= this.loopEndTick) {
            const previousTick = this.currentTick;
            this.currentTick = this.loopStartTick;
            this.nextTickTime = this.audioContext.currentTime;
            
            // ✅ SADECE EVENT TETİKLE
            console.log(`🔁 Loop trigger: ${previousTick} -> ${this.currentTick}`);
            
            // Scheduled events'leri temizle
            this.clearScheduledEvents();
            
            // Loop event'ini tetikle (PlaybackManager'da dinlenecek)
            this.triggerCallback('loop', { 
                time: this.nextTickTime,
                nextLoopStartTime: this.nextTickTime,
                fromTick: previousTick - 1, 
                toTick: this.loopStartTick,
                needsReschedule: true // ✅ Yeniden schedule gerektiğini belirt
            });
        } else {
            this.nextTickTime += secondsPerTick;
        }
        
        // Bar tracking (existing code)
        const newBar = Math.floor(this.currentTick / this.ticksPerBar);
        if (newBar !== this.currentBar) {
            this.currentBar = newBar;
            console.log(`🎼 Bar ${this.currentBar}`);
            
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
        console.log('🧹 Scheduled events cleared');
    }

    scheduleCurrentTick(time) {
        this.triggerCallback('tick', {
            time: time,
            position: this.currentTick,
            formatted: this.formatPosition(this.currentTick),
            bar: this.currentBar,
            step: this.ticksToSteps(this.currentTick)
        });

        // Beat callback
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
    scheduleEvent(timeInSeconds, callback, data = {}) {
        const eventId = `event_${Date.now()}_${Math.random()}`;

        if (!this.scheduledEvents.has(timeInSeconds)) {
            this.scheduledEvents.set(timeInSeconds, []);
        }

        this.scheduledEvents.get(timeInSeconds).push({
            id: eventId,
            callback,
            data
        });

        return eventId;
    }

    processScheduledEvents(currentTime) {
        // Process events at or before current time
        for (const [scheduledTime, events] of this.scheduledEvents.entries()) {
            if (scheduledTime <= currentTime) {
                events.forEach(event => {
                    try {
                        event.callback(scheduledTime, event.data);
                    } catch (error) {
                        console.error('❌ Scheduled event error:', error);
                    }
                });
                this.scheduledEvents.delete(scheduledTime);
            }
        }
    }

    advanceToNextTick() {
        const secondsPerTick = this.getSecondsPerTick();
        
        this.currentTick++;
        this.position = this.currentTick;
        
        const shouldLoop = this.loop && this.currentTick >= this.loopEnd;
        
        if (shouldLoop) {
            const loopTime = this.nextTickTime;
            
            // ✅ KRİTİK DÜZELTME:
            // PlaybackManager'ın beklediği `nextLoopStartTime` alanını veri paketine ekliyoruz.
            // Değeri, bir sonraki döngünün başlayacağı zamandır (şu anki zaman).
            this.triggerCallback('loop', { 
                time: loopTime, 
                nextLoopStartTime: loopTime, // <<< BU SATIRI EKLE
                fromTick: this.loopEnd - 1, 
                toTick: this.loopStart 
            });

            console.log(`🔁 Loop trigger at ${loopTime.toFixed(3)}s. Signaling for reschedule.`);
            
            this.currentTick = this.loopStart;
            this.position = this.currentTick;
            
            // Bar takibini loop'tan sonraya taşıyarak sıfırıncı barın doğru loglanmasını sağlayalım
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
        
        this.nextTickTime += secondsPerTick;
        
        // Bar takibini loop dışına taşıyalım ki her tick'te kontrol edilsin
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


    getSecondsPerTick() {
        const secondsPerBeat = 60.0 / this.bpm;
        return secondsPerBeat / this.ppq;
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
        console.log(`📋 Pattern scheduled: ${patternId} at ${startTime.toFixed(3)}s`);

        return this;
    }

    stopPattern(patternId, when = null) {
        const stopTime = when || this.audioContext.currentTime;

        if (this.patterns.has(patternId)) {
            this.patterns.delete(patternId);
            this.activePatterns.delete(patternId);

            this.triggerCallback('patternStop', { patternId, time: stopTime });
            console.log(`⏹️ Pattern stopped: ${patternId}`);
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
            pattern.forEach((note, index) => {
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

        if (type === 't') duration *= 2/3; // Triplet
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
                    console.error(`❌ Transport callback error (${event}):`, error);
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

    dispose() {
        console.log('🗑️ Disposing NativeTransportSystem...');

        this.stop();

        if (this.timerWorker) {
            this.timerWorker.terminate();
        }

        this.callbacks.clear();
        this.scheduledEvents.clear();

        console.log('✅ NativeTransportSystem disposed');
    }
}
