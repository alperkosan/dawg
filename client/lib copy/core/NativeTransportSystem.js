// lib/core/NativeTransportSystem.js
// DAWG - Native Transport System - ToneJS'siz tam native implementasyon

export class NativeTransportSystem {
    constructor(audioContext) {
        this.audioContext = audioContext;

        // Transport durumu
        this.isPlaying = false;
        this.position = 0; // bar-beat-sixteenth formatında
        this.bpm = 120;
        this.timeSignature = [4, 4]; // 4/4 time signature

        // Zamanlama
        this.ppq = 96; // pulses per quarter note (MIDI standart)
        this.currentTick = 0;
        this.nextTickTime = 0;
        this.lookAhead = 25.0; // 25ms lookahead
        this.scheduleAheadTime = 0.1; // 100ms scheduling window

        // Event callbacks
        this.callbacks = new Map();
        this.scheduledEvents = new Map(); // time -> events

        // Timer
        this.timerWorker = null;
        this.schedulerRunning = false;

        // Pattern scheduling
        this.patterns = new Map();
        this.activePatterns = new Set();
        this.nextPatternEventTime = Infinity;

        // Swing ve groove
        this.swingFactor = 0; // 0-1, 0 = straight, 1 = full swing
        this.groove = null;

        this.scheduledEvents = new Map(); // Bu satırın altına ekleyin

        // YENİ: Döngü (Loop) Özellikleri
        this.loop = true;
        this.loopStart = 0; // Saniye cinsinden
        this.loopEnd = 4;   // Saniye cinsinden (varsayılan)

        this.initializeWorkerTimer();

        console.log('🎵 NativeTransportSystem initialized');
    }

    // =================== TIMER INITIALIZATION ===================

    initializeWorkerTimer() {
        // Web Worker kullanarak daha stabil timing
        const workerScript = `
            let timerID = null;
            let interval = 25; // 25ms default

            self.onmessage = function(e) {
                if (e.data === 'start') {
                    timerID = setInterval(() => {
                        postMessage('tick');
                    }, interval);
                } else if (e.data === 'stop') {
                    clearInterval(timerID);
                } else if (e.data.interval) {
                    interval = e.data.interval;
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
    }

    // =================== BASIC TRANSPORT CONTROLS ===================

    start(when = null) {
        if (this.isPlaying) return;

        const startTime = when || this.audioContext.currentTime;
        this.isPlaying = true;
        this.nextTickTime = startTime;
        this.schedulerRunning = true;

        this.timerWorker.postMessage('start');

        this.triggerCallback('start', { time: startTime, position: this.position });
        console.log(`▶️ Transport started at ${startTime.toFixed(3)}s`);

        return this;
    }

    stop(when = null) {
        if (!this.isPlaying) return this;

        const stopTime = when || this.audioContext.currentTime;
        this.isPlaying = false;
        this.schedulerRunning = false;

        this.timerWorker.postMessage('stop');

        // --- DÜZELTME BAŞLANGICI ---
        // Zamanı ve pozisyonu başa sar. Bu, bir sonraki 'play' komutunun
        // doğru yerden başlamasını garantiler.
        this.position = this._secondsToTicks(this.loopStart);
        this.currentTick = this.position;
        this.nextTickTime = this.loopStart; // Scheduler'ı da sıfırla.
        // --- DÜZELTME SONU ---

        this.activePatterns.forEach(patternId => {
            this.stopPattern(patternId, stopTime);
        });

        this.triggerCallback('stop', { time: stopTime, position: this.position });
        console.log(`⏹️ Transport stopped at ${stopTime.toFixed(3)}s`);

        return this;
    }

    pause(when = null) {
        const pauseTime = when || this.audioContext.currentTime;
        this.stop(pauseTime);
        this.triggerCallback('pause', { time: pauseTime, position: this.position });
        console.log(`⏸️ Transport paused at position ${this.formatPosition(this.position)}`);
        return this;
    }

    // =================== POSITION & TIMING ===================

    getPosition() {
        if (!this.isPlaying) return this.position;

        const elapsed = this.audioContext.currentTime - this.nextTickTime + this.getSecondsPerTick();
        const ticksElapsed = Math.floor(elapsed / this.getSecondsPerTick());
        return this.position + ticksElapsed;
    }

    setPosition(position) {
        this.position = position;
        this.currentTick = position;

        if (this.isPlaying) {
            this.nextTickTime = this.audioContext.currentTime;
        }

        this.triggerCallback('position', { position: this.position });
        console.log(`🎯 Position set to ${this.formatPosition(position)}`);
        return this;
    }

    setLoopPoints(startTime, endTime) {
        this.loopStart = startTime;
        this.loopEnd = endTime;
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

    // =================== SCHEDULING CORE ===================

    scheduler() {
        // Ses motorunun mevcut zamanının biraz ilerisine kadar olan olayları planla
        const scheduleUntil = this.audioContext.currentTime + this.scheduleAheadTime;

        while (this.nextTickTime < scheduleUntil) {
            // 1. UI ve pozisyon güncellemeleri için tick olayını tetikle
            this.scheduleCurrentTick(this.nextTickTime);

            // 2. ANA DÜZELTME: Zamanlanmış nota olaylarını işle
            this.processScheduledEvents(this.nextTickTime);
            
            // 3. Bir sonraki tick'e ilerle
            this.nextTick();
        }
    }

    scheduleCurrentTick(time) {
        // Bu fonksiyon artık sadece UI güncellemelerinden sorumlu
        this.triggerCallback('tick', {
            time: time,
            position: this.currentTick,
            formatted: this.formatPosition(this.currentTick)
        });

        if (this.currentTick % this.ppq === 0) {
            const beat = Math.floor(this.currentTick / this.ppq) % this.timeSignature[0];
            this.triggerCallback('beat', { time, beat });
            if (beat === 0) {
                const bar = Math.floor(this.currentTick / (this.ppq * this.timeSignature[0]));
                this.triggerCallback('bar', { time, bar });
            }
        }
    }

    // --- YENİ EKLENECEK FONKSİYON ---
    /**
     * Dışarıdan bir olayı belirli bir zamanda çalınmak üzere sıraya alır.
     * @param {number} time - Olayın saniye cinsinden çalınacağı zaman.
     * @param {Function} callback - Zamanı geldiğinde çalıştırılacak fonksiyon.
     * @param {object} data - Callback'e gönderilecek ek veri.
     * @returns {string} - Zamanlanmış olayın benzersiz ID'si.
     */
    scheduleEvent(time, callback, data = {}) {
        const eventId = `event_${Date.now()}_${Math.random()}`;

        // Eğer bu zaman için daha önce bir olay planlanmadıysa, yeni bir liste oluştur.
        if (!this.scheduledEvents.has(time)) {
            this.scheduledEvents.set(time, []);
        }

        // Yeni olayı listeye ekle.
        this.scheduledEvents.get(time).push({
            id: eventId,
            callback,
            data
        });

        return eventId;
    }
    // --- YENİ FONKSİYON SONU ---

    processScheduledEvents(tickTime) {
        // O anki tick zamanına denk gelen veya geçmiş tüm notaları bul
        for (const [scheduledTime, events] of this.scheduledEvents.entries()) {
            // Zamanı gelen notaları işle
            if (scheduledTime <= tickTime) {
                events.forEach(event => {
                    try {
                        // Callback'i, olması gereken hassas zamanla ve datayla çağır
                        event.callback(scheduledTime, event.data);
                    } catch (error) {
                        console.error('❌ Scheduled event error:', error);
                    }
                });
                // İşlenen notaları listeden sil ki tekrar çalınmasınlar
                this.scheduledEvents.delete(scheduledTime);
            }
        }
    }
    nextTick() {
        const secondsPerTick = this.getSecondsPerTick();
        
        // 1. Bir sonraki tick'in zamanını HESAPLA ama henüz atama.
        const nextTickTimeCandidate = this.nextTickTime + secondsPerTick;

        // 2. Döngü sonuna gelip gelmediğimizi kontrol et.
        if (this.loop && nextTickTimeCandidate >= this.loopEnd) {
            this.triggerCallback('loop', { time: this.loopEnd });
            const loopDuration = this.loopEnd - this.loopStart;
            
            if (loopDuration > 0) {
                // 3. Zamanı döngünün başına, taşan kısmı da ekleyerek ayarla.
                const overflow = nextTickTimeCandidate - this.loopEnd;
                this.nextTickTime = this.loopStart + (overflow % loopDuration);
                this.currentTick = this._secondsToTicks(this.loopStart) + this._secondsToTicks(overflow % loopDuration);
            } else {
                // Döngü süresi 0 ise, sadece başa dön.
                this.nextTickTime = this.loopStart;
                this.currentTick = this._secondsToTicks(this.loopStart);
            }
        } else {
            // 4. Döngüde değilsek, normal şekilde ilerle.
            this.nextTickTime = nextTickTimeCandidate;
            this.currentTick++;
        }
        
        // 5. Son olarak, pozisyonu güncelle.
        this.position = this.currentTick;
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
        this.patterns.clear();
        this.activePatterns.clear();

        console.log('✅ NativeTransportSystem disposed');
    }
}
