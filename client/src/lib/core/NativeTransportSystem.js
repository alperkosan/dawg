// lib/core/NativeTransportSystem.js
// DAWG - Native Transport System - ToneJS'siz tam native implementasyon

export class NativeTransportSystem {
    constructor(audioContext) {
        this.audioContext = audioContext;

        // Transport durumu
        this.isPlaying = false;
        this.position = 0;
        this.bpm = 120;
        this.timeSignature = [4, 4];

        // Zamanlama
        this.ppq = 96; // pulses per quarter note
        this.currentTick = 0;
        this.nextTickTime = 0;
        this.lookAhead = 25.0; // 25ms lookahead
        this.scheduleAheadTime = 0.1; // 100ms scheduling window

        // Event callbacks
        this.callbacks = new Map();
        
        // ✅ EKLENDİ: Zamanlanmış olaylar için Map
        this.scheduledEvents = new Map(); // time -> events
        
        // Pattern scheduling
        this.patterns = new Map();
        this.activePatterns = new Set();

        // Swing ve groove
        this.swingFactor = 0;
        this.groove = null;

        // YENİ: Loop özellikleri
        this.loop = true;
        this.loopStart = 0; // Tick cinsinden, saniye değil!
        this.loopEnd = 64;  // Tick cinsinden, saniye değil!

        this.currentBar = 0;
        this.ticksPerBar = this.ppq * this.timeSignature[0]; // 96 * 4 = 384 tick/bar

        this.initializeWorkerTimer();
        console.log('🎵 NativeTransportSystem initialized - Loop:', this.loopStart, '->', this.loopEnd, 'ticks');
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

    start(when = null) {
        if (this.isPlaying) return;

        const startTime = when || this.audioContext.currentTime;
        this.isPlaying = true;
        
        // ✅ DÜZELTME: nextTickTime'ı doğru başlat
        this.nextTickTime = startTime;
        this.schedulerRunning = true;

        // ✅ EKLENEN: Başlangıç pozisyonu
        console.log(`▶️ Transport starting at tick ${this.currentTick}, time ${startTime.toFixed(3)}s`);
        console.log(`🔁 Loop: ${this.loopStart} -> ${this.loopEnd} ticks (${this.loop ? 'enabled' : 'disabled'})`);

        this.timerWorker.postMessage('start');
        this.triggerCallback('start', { time: startTime, position: this.position });
        
        return this;
    }

    stop(when = null) {
        if (!this.isPlaying) return this;

        const stopTime = when || this.audioContext.currentTime;
        this.isPlaying = false;
        this.schedulerRunning = false;

        this.timerWorker.postMessage('stop');

        // ✅ DÜZELTME: Stop'ta loop başına dön
        this.currentTick = this.loopStart;
        this.position = this.currentTick;
        this.currentBar = Math.floor(this.currentTick / this.ticksPerBar);
        this.nextTickTime = stopTime;

        // Scheduled events'leri temizle
        this.clearScheduledEvents();

        this.triggerCallback('stop', { time: stopTime, position: this.position });
        console.log(`⏹️ Transport stopped, reset to tick ${this.currentTick}`);
        return this;
    }

    pause(when = null) {
        if (!this.isPlaying) return this;

        const pauseTime = when || this.audioContext.currentTime;
        this.isPlaying = false;

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
        // ✅ DÜZELTME: Step'leri tick'lere çevir (1 step = 1 sixteenth note = ppq/4 tick)
        this.loopStart = startStep * (this.ppq / 4);
        this.loopEnd = endStep * (this.ppq / 4);
        
        // ✅ DEBUG: Loop bilgilerini göster
        console.log(`🔁 Loop points set:`);
        console.log(`   Steps: ${startStep} -> ${endStep} (${endStep - startStep} steps = ${(endStep - startStep)/16} bars)`);
        console.log(`   Ticks: ${this.loopStart} -> ${this.loopEnd} (${this.loopEnd - this.loopStart} ticks)`);
        console.log(`   Seconds: ${(this.loopStart * this.getSecondsPerTick()).toFixed(2)} -> ${(this.loopEnd * this.getSecondsPerTick()).toFixed(2)}`);
        
        // Eğer current position loop dışındaysa, loop başına al
        if (this.currentTick >= this.loopEnd) {
            console.warn('[Transport] Current position beyond loop end, resetting to start');
            this.currentTick = this.loopStart;
            this.position = this.currentTick;
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
            // 1. UI ve pozisyon güncellemeleri için tick olayını tetikle
            this.scheduleCurrentTick(this.nextTickTime);

            // 2. ❗ EKLENEN KISIM: Zamanlanmış nota olaylarını işle
            this.processScheduledEvents(this.nextTickTime);
            
            this.nextTick();
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
    scheduleEvent(time, callback, data = {}) {
        const eventId = `event_${Date.now()}_${Math.random()}`;

        if (!this.scheduledEvents.has(time)) {
            this.scheduledEvents.set(time, []);
        }

        this.scheduledEvents.get(time).push({
            id: eventId,
            callback,
            data
        });

        return eventId;
    }

    processScheduledEvents(tickTime) {
        // O anki tick zamanına denk gelen veya geçmiş tüm notaları bul
        for (const [scheduledTime, events] of this.scheduledEvents.entries()) {
            if (scheduledTime <= tickTime) {
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

    nextTick() {
        const secondsPerTick = this.getSecondsPerTick();
        
        // Önce tick'i ilerlet
        this.currentTick++;
        this.position = this.currentTick;
        
        // ✅ DEBUG: Loop kontrolü öncesi bilgi
        const shouldLoop = this.loop && this.currentTick >= this.loopEnd;
        
        if (shouldLoop) {
            console.log(`🔁 Loop trigger:`);
            console.log(`   Current tick: ${this.currentTick}, Loop end: ${this.loopEnd}`);
            console.log(`   Time: ${this.nextTickTime.toFixed(3)}s, Duration: ${((this.currentTick - this.loopStart) * secondsPerTick).toFixed(3)}s`);
            
            this.currentTick = this.loopStart;
            this.position = this.currentTick;
            
            this.triggerCallback('loop', { 
                time: this.nextTickTime, 
                fromTick: this.loopEnd - 1, 
                toTick: this.loopStart 
            });
        }
        
        // Zamanı güncelle
        this.nextTickTime += secondsPerTick;
        
        // Bar tracking - sadece bar değiştiğinde log
        const newBar = Math.floor(this.currentTick / this.ticksPerBar);
        if (newBar !== this.currentBar) {
            this.currentBar = newBar;
            console.log(`🎼 Bar ${this.currentBar} (tick ${this.currentTick})`);
            
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

    formatPosition(ticks) {
        const ticksPerBar = this.ppq * this.timeSignature[0];
        const bar = Math.floor(ticks / ticksPerBar);
        const beat = Math.floor((ticks % ticksPerBar) / this.ppq);
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
