/**
 * PerformanceService - Extracted from NativeAudioEngine
 * 
 * Handles all performance monitoring:
 * - CPU usage tracking
 * - Voice count monitoring
 * - Latency measurement
 * - Engine statistics collection
 * 
 * @module lib/core/services/PerformanceService
 */

import { logger, NAMESPACES } from '../../utils/debugLogger.js';

export class PerformanceService {
    /**
     * @param {NativeAudioEngine} engine - Parent audio engine
     */
    constructor(engine) {
        this.engine = engine;
        this.metrics = {
            instrumentsCreated: 0,
            channelsCreated: 0,
            effectsCreated: 0,
            activeVoices: 0,
            cpuUsage: 0,
            audioLatency: 0,
            dropouts: 0,
            lastUpdateTime: 0
        };
        this.monitoringInterval = null;
        this.isMonitoring = false;
    }

    /**
     * Get audio context from parent engine
     */
    get audioContext() {
        return this.engine.audioContext;
    }

    /**
     * Start performance monitoring
     * @param {number} intervalMs - Update interval in milliseconds
     */
    start(intervalMs = 1000) {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.updateMetrics();
        }, intervalMs);

        logger.debug(NAMESPACES.PERFORMANCE, 'Performance monitoring started');
    }

    /**
     * Stop performance monitoring
     */
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;

        logger.debug(NAMESPACES.PERFORMANCE, 'Performance monitoring stopped');
    }

    /**
     * Update all performance metrics
     */
    updateMetrics() {
        const now = performance.now();

        this.metrics = {
            ...this.metrics,
            activeVoices: this.countActiveVoices(),
            audioLatency: this.getAudioLatency(),
            lastUpdateTime: now
        };
    }

    /**
     * Count active voices across all instruments
     * @returns {number}
     */
    countActiveVoices() {
        let total = 0;
        const instruments = this.engine.instruments || this.engine.instrumentService?.instruments;

        if (instruments) {
            instruments.forEach(instrument => {
                if (typeof instrument.getActiveVoiceCount === 'function') {
                    total += instrument.getActiveVoiceCount();
                }
            });
        }

        return total;
    }

    /**
     * Get current audio latency in milliseconds
     * @returns {number}
     */
    getAudioLatency() {
        if (!this.audioContext) return 0;

        const baseLatency = this.audioContext.baseLatency || 0;
        const outputLatency = this.audioContext.outputLatency || 0;

        return (baseLatency + outputLatency) * 1000;
    }

    /**
     * Get comprehensive engine statistics
     * @returns {Object}
     */
    getEngineStats() {
        const instruments = this.engine.instruments || this.engine.instrumentService?.instruments;
        const mixerInserts = this.engine.mixerInserts || this.engine.mixerService?.mixerInserts;

        return {
            performance: this.metrics,
            audioContext: this.audioContext ? {
                state: this.audioContext.state,
                sampleRate: this.audioContext.sampleRate,
                currentTime: this.audioContext.currentTime?.toFixed(3),
                baseLatency: this.audioContext.baseLatency?.toFixed(6) || 'unknown',
                outputLatency: this.audioContext.outputLatency?.toFixed(6) || 'unknown',
                totalLatency: this.getAudioLatency().toFixed(2) + 'ms'
            } : null,
            instruments: {
                total: instruments?.size || 0,
                byType: this.getInstrumentsByType()
            },
            mixerSystem: {
                type: 'MixerInsert',
                activeInserts: mixerInserts?.size || 0,
                description: 'Dynamic routing, unlimited channels'
            },
            workletManager: this.engine.workletManager?.getDetailedStats(),
            transport: this.engine.transport?.getStats(),
            playback: this.engine.playbackManager?.getPlaybackStatus()
        };
    }

    /**
     * Get instruments grouped by type
     * @returns {Object}
     */
    getInstrumentsByType() {
        const types = {};
        const instruments = this.engine.instruments || this.engine.instrumentService?.instruments;

        if (instruments) {
            instruments.forEach(instrument => {
                const type = instrument.type || 'unknown';
                types[type] = (types[type] || 0) + 1;
            });
        }

        return types;
    }

    /**
     * Get current metrics
     * @returns {Object}
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            instrumentsCreated: 0,
            channelsCreated: 0,
            effectsCreated: 0,
            activeVoices: 0,
            cpuUsage: 0,
            audioLatency: 0,
            dropouts: 0,
            lastUpdateTime: 0
        };
    }

    /**
     * Increment a metric counter
     * @param {string} metricName 
     * @param {number} amount 
     */
    incrementMetric(metricName, amount = 1) {
        if (this.metrics[metricName] !== undefined) {
            this.metrics[metricName] += amount;
        }
    }

    /**
     * Dispose the performance service
     */
    dispose() {
        this.stop();
        this.resetMetrics();
        logger.info(NAMESPACES.PERFORMANCE, 'PerformanceService disposed');
    }
}
