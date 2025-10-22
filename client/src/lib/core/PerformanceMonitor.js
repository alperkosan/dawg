/**
 * PerformanceMonitor - Real-time Performance Tracking
 *
 * Tracks and analyzes DAW performance metrics:
 * - CPU usage estimation
 * - Memory usage
 * - Active voices (instruments)
 * - Grain count (granular synthesis)
 * - Audio dropouts
 * - Latency
 *
 * Provides actionable warnings and optimization tips.
 */

import EventBus from './EventBus.js';
import { realCPUMonitor } from '../utils/RealCPUMonitor.js';

export class PerformanceMonitor {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.audioContext = audioEngine.audioContext;

        // Metrics state
        this.metrics = {
            // CPU & Processing
            cpuUsage: 0,              // 0-100%
            cpuPeak: 0,
            cpuAverage: 0,

            // Memory
            memoryUsed: 0,            // MB
            memoryTotal: 0,           // MB
            memoryPercent: 0,         // 0-100%

            // Audio
            audioLatency: 0,          // ms
            sampleRate: 48000,
            bufferSize: 256,
            dropouts: 0,

            // Voices & Activity
            activeVoices: 0,
            maxVoices: 0,
            activeGrains: 0,
            maxGrains: 1000,

            // Instruments & Effects
            activeInstruments: 0,
            activeEffects: 0,
            bypassedEffects: 0,

            // Scheduling
            scheduledEvents: 0,

            // Session
            sessionDuration: 0,       // seconds
            sessionStartTime: Date.now()
        };

        // Performance history for averaging
        this.history = {
            cpu: [],
            memory: [],
            maxHistoryLength: 60  // Keep last 60 samples (1 minute at 1Hz)
        };

        // Monitoring state
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.updateRate = 1000; // Update every 1 second

        // Warning thresholds
        this.thresholds = {
            cpuWarning: 70,      // %
            cpuCritical: 85,
            memoryWarning: 70,   // %
            memoryCritical: 85,
            voiceWarning: 0.8,   // 80% of max
            grainWarning: 0.8
        };

        // Performance warnings
        this.warnings = [];

        console.log('✅ PerformanceMonitor initialized');
    }

    /**
     * Start monitoring
     */
    start() {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        this.metrics.sessionStartTime = Date.now();

        // Start monitoring loop
        this.monitoringInterval = setInterval(() => {
            this.update();
        }, this.updateRate);

        console.log('🎯 Performance monitoring started');
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;

        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        console.log('🛑 Performance monitoring stopped');
    }

    /**
     * Update all metrics
     */
    update() {
        this.updateCPUMetrics();
        this.updateMemoryMetrics();
        this.updateAudioMetrics();
        this.updateVoiceMetrics();
        this.updateInstrumentMetrics();
        this.updateSessionMetrics();
        this.checkWarnings();

        // Emit update event
        EventBus.emit('PERFORMANCE_UPDATE', this.getMetrics());
    }

    /**
     * Update CPU metrics (REAL measurement + estimation)
     */
    updateCPUMetrics() {
        // ⚡ CRITICAL: Use REAL CPU measurement from RealCPUMonitor
        const realCPU = realCPUMonitor.getCPUUsage();

        if (realCPU > 0) {
            // Use real measurement
            this.metrics.cpuUsage = Math.min(100, realCPU);
            this.metrics.realCPU = realCPU; // Store real measurement separately
        } else {
            // Fallback to estimation if real measurement not available
            let estimatedCPU = 0;

            // Base load
            estimatedCPU += 5; // Base DAW overhead

            // Voices (instruments)
            const voiceLoad = (this.metrics.activeVoices / Math.max(this.metrics.maxVoices, 1)) * 20;
            estimatedCPU += voiceLoad;

            // Effects
            const effectLoad = this.metrics.activeEffects * 2; // ~2% per effect
            estimatedCPU += effectLoad;

            // Grains (granular synthesis)
            const grainLoad = (this.metrics.activeGrains / 100) * 5; // ~5% per 100 grains
            estimatedCPU += grainLoad;

            // Scheduled events overhead
            const schedulingLoad = Math.min(this.metrics.scheduledEvents / 100, 10); // Max 10%
            estimatedCPU += schedulingLoad;

            // Clamp to 0-100
            this.metrics.cpuUsage = Math.min(100, Math.max(0, estimatedCPU));
        }

        // Update peak
        if (this.metrics.cpuUsage > this.metrics.cpuPeak) {
            this.metrics.cpuPeak = this.metrics.cpuUsage;
        }

        // Update history and average
        this.history.cpu.push(this.metrics.cpuUsage);
        if (this.history.cpu.length > this.history.maxHistoryLength) {
            this.history.cpu.shift();
        }

        this.metrics.cpuAverage = this.history.cpu.reduce((a, b) => a + b, 0) / this.history.cpu.length;
    }

    /**
     * Update memory metrics
     */
    updateMemoryMetrics() {
        // Get memory info if available (Chrome/Edge)
        if (performance.memory) {
            this.metrics.memoryUsed = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024); // MB
            this.metrics.memoryTotal = Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024); // MB
            this.metrics.memoryPercent = Math.round((this.metrics.memoryUsed / this.metrics.memoryTotal) * 100);

            // Update history
            this.history.memory.push(this.metrics.memoryPercent);
            if (this.history.memory.length > this.history.maxHistoryLength) {
                this.history.memory.shift();
            }
        } else {
            // Estimate based on loaded samples, instruments, etc.
            let estimatedMemory = 10; // Base 10MB

            // Instruments
            estimatedMemory += this.audioEngine.instruments.size * 2; // ~2MB per instrument

            // Sample cache
            if (this.audioEngine.sampleCache) {
                estimatedMemory += this.audioEngine.sampleCache.size * 5; // ~5MB per sample
            }

            this.metrics.memoryUsed = estimatedMemory;
            this.metrics.memoryTotal = 100; // Assumed limit
            this.metrics.memoryPercent = Math.round((estimatedMemory / 100) * 100);
        }
    }

    /**
     * Update audio metrics
     */
    updateAudioMetrics() {
        if (this.audioContext) {
            this.metrics.sampleRate = this.audioContext.sampleRate;
            this.metrics.audioLatency = (this.audioContext.baseLatency || this.audioContext.outputLatency || 0) * 1000; // Convert to ms

            // Calculate buffer size from latency
            if (this.metrics.audioLatency > 0) {
                this.metrics.bufferSize = Math.round((this.metrics.audioLatency / 1000) * this.metrics.sampleRate);
            }
        }
    }

    /**
     * Update voice metrics
     */
    updateVoiceMetrics() {
        let totalActiveVoices = 0;
        let totalMaxVoices = 0;
        let totalActiveGrains = 0;

        // Count active voices across all instruments
        this.audioEngine.instruments.forEach(instrument => {
            if (instrument.activeNotes) {
                totalActiveVoices += instrument.activeNotes.size;
            }

            if (instrument.capabilities) {
                totalMaxVoices += instrument.capabilities.maxVoices || 16;
            }

            // Granular instruments
            if (instrument.type === 'granular' && instrument.grainPool) {
                const poolStats = instrument.grainPool.getStats();
                totalActiveGrains += poolStats.activeVoices || 0;
            }
        });

        this.metrics.activeVoices = totalActiveVoices;
        this.metrics.maxVoices = totalMaxVoices || 128;
        this.metrics.activeGrains = totalActiveGrains;
    }

    /**
     * Update instrument and effect metrics
     */
    updateInstrumentMetrics() {
        this.metrics.activeInstruments = this.audioEngine.instruments.size;

        let activeEffects = 0;
        let bypassedEffects = 0;

        // ✅ UPDATED: Count effects from mixer channels (new architecture)
        if (this.audioEngine.mixerChannels) {
            this.audioEngine.mixerChannels.forEach(channel => {
                if (channel.effects) {
                    channel.effects.forEach(effect => {
                        if (effect.bypass) {
                            bypassedEffects++;
                        } else {
                            activeEffects++;
                        }
                    });
                }
            });
        }
        // Fallback: Old effects Map (if exists)
        else if (this.audioEngine.effects) {
            this.audioEngine.effects.forEach(effect => {
                if (effect.bypass || (effect.wetLevel !== undefined && effect.wetLevel === 0)) {
                    bypassedEffects++;
                } else {
                    activeEffects++;
                }
            });
        }

        this.metrics.activeEffects = activeEffects;
        this.metrics.bypassedEffects = bypassedEffects;

        // Get scheduled events count
        if (this.audioEngine.transport && this.audioEngine.transport.scheduledEvents) {
            this.metrics.scheduledEvents = this.audioEngine.transport.scheduledEvents.size || 0;
        }
    }

    /**
     * Update session metrics
     */
    updateSessionMetrics() {
        this.metrics.sessionDuration = Math.floor((Date.now() - this.metrics.sessionStartTime) / 1000);
    }

    /**
     * Check for performance warnings
     */
    checkWarnings() {
        this.warnings = [];

        // CPU warnings
        if (this.metrics.cpuUsage >= this.thresholds.cpuCritical) {
            this.warnings.push({
                level: 'critical',
                type: 'cpu',
                message: `CPU usage is very high (${this.metrics.cpuUsage.toFixed(0)}%)`,
                tip: 'Reduce grain density, bypass unused effects, or decrease polyphony'
            });
        } else if (this.metrics.cpuUsage >= this.thresholds.cpuWarning) {
            this.warnings.push({
                level: 'warning',
                type: 'cpu',
                message: `CPU usage is high (${this.metrics.cpuUsage.toFixed(0)}%)`,
                tip: 'Consider bypassing unused effects or reducing grain density'
            });
        }

        // Memory warnings
        if (this.metrics.memoryPercent >= this.thresholds.memoryCritical) {
            this.warnings.push({
                level: 'critical',
                type: 'memory',
                message: `Memory usage is very high (${this.metrics.memoryPercent}%)`,
                tip: 'Unload unused samples or restart the browser'
            });
        } else if (this.metrics.memoryPercent >= this.thresholds.memoryWarning) {
            this.warnings.push({
                level: 'warning',
                type: 'memory',
                message: `Memory usage is high (${this.metrics.memoryPercent}%)`,
                tip: 'Consider unloading unused samples'
            });
        }

        // Voice warnings
        const voiceUsage = this.metrics.activeVoices / this.metrics.maxVoices;
        if (voiceUsage >= this.thresholds.voiceWarning) {
            this.warnings.push({
                level: 'warning',
                type: 'voices',
                message: `Voice usage is high (${this.metrics.activeVoices}/${this.metrics.maxVoices})`,
                tip: 'Some notes may be cut off. Reduce polyphony or note count.'
            });
        }

        // Grain warnings
        const grainUsage = this.metrics.activeGrains / this.metrics.maxGrains;
        if (grainUsage >= this.thresholds.grainWarning) {
            this.warnings.push({
                level: 'warning',
                type: 'grains',
                message: `Grain count is high (${this.metrics.activeGrains})`,
                tip: 'Reduce grain density or number of granular instruments playing'
            });
        }

        // Emit warnings if any
        if (this.warnings.length > 0) {
            EventBus.emit('PERFORMANCE_WARNING', this.warnings);
        }
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Get current warnings
     */
    getWarnings() {
        return [...this.warnings];
    }

    /**
     * Get performance summary
     */
    getSummary() {
        return {
            cpu: {
                current: this.metrics.cpuUsage,
                average: this.metrics.cpuAverage,
                peak: this.metrics.cpuPeak,
                status: this.getCPUStatus()
            },
            memory: {
                used: this.metrics.memoryUsed,
                total: this.metrics.memoryTotal,
                percent: this.metrics.memoryPercent,
                status: this.getMemoryStatus()
            },
            audio: {
                latency: this.metrics.audioLatency,
                sampleRate: this.metrics.sampleRate,
                bufferSize: this.metrics.bufferSize
            },
            activity: {
                voices: `${this.metrics.activeVoices}/${this.metrics.maxVoices}`,
                grains: this.metrics.activeGrains,
                instruments: this.metrics.activeInstruments,
                effects: `${this.metrics.activeEffects} active, ${this.metrics.bypassedEffects} bypassed`
            },
            session: {
                duration: this.formatDuration(this.metrics.sessionDuration)
            },
            warnings: this.warnings.length
        };
    }

    /**
     * Get CPU status
     */
    getCPUStatus() {
        if (this.metrics.cpuUsage >= this.thresholds.cpuCritical) return 'critical';
        if (this.metrics.cpuUsage >= this.thresholds.cpuWarning) return 'warning';
        return 'good';
    }

    /**
     * Get memory status
     */
    getMemoryStatus() {
        if (this.metrics.memoryPercent >= this.thresholds.memoryCritical) return 'critical';
        if (this.metrics.memoryPercent >= this.thresholds.memoryWarning) return 'warning';
        return 'good';
    }

    /**
     * Format duration (seconds -> mm:ss)
     */
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Reset metrics
     */
    reset() {
        this.metrics.cpuPeak = 0;
        this.metrics.dropouts = 0;
        this.history.cpu = [];
        this.history.memory = [];
        console.log('📊 Performance metrics reset');
    }

    /**
     * Dispose
     */
    dispose() {
        this.stop();
        console.log('🗑️ PerformanceMonitor disposed');
    }
}
