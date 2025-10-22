/**
 * Real CPU Monitor - Actual browser CPU measurement
 * Uses performance.now() to measure actual execution time
 */

export class RealCPUMonitor {
    constructor() {
        this.measurements = [];
        this.windowSize = 60; // 1 second at 60fps
        this.lastMeasurementTime = 0;
        this.totalCPUTime = 0;
        this.frameCount = 0;

        // Track specific operations
        this.operationTimes = new Map();

        this.isEnabled = true;
    }

    /**
     * Start measuring an operation
     */
    startMeasure(operationName) {
        if (!this.isEnabled) return null;

        return {
            name: operationName,
            startTime: performance.now()
        };
    }

    /**
     * End measurement and record
     */
    endMeasure(measurement) {
        if (!this.isEnabled || !measurement) return;

        const duration = performance.now() - measurement.startTime;

        if (!this.operationTimes.has(measurement.name)) {
            this.operationTimes.set(measurement.name, {
                total: 0,
                count: 0,
                max: 0,
                avg: 0
            });
        }

        const stats = this.operationTimes.get(measurement.name);
        stats.total += duration;
        stats.count++;
        stats.max = Math.max(stats.max, duration);
        stats.avg = stats.total / stats.count;
    }

    /**
     * Measure frame and calculate CPU usage
     */
    measureFrame(frameStartTime) {
        if (!this.isEnabled) return 0;

        const frameDuration = performance.now() - frameStartTime;
        const idealFrameTime = 16.67; // 60fps

        // CPU usage = (actual time / ideal time) * 100
        const cpuUsage = (frameDuration / idealFrameTime) * 100;

        this.measurements.push(cpuUsage);

        // Keep sliding window
        if (this.measurements.length > this.windowSize) {
            this.measurements.shift();
        }

        this.totalCPUTime += frameDuration;
        this.frameCount++;

        return cpuUsage;
    }

    /**
     * Get current CPU usage (averaged)
     */
    getCPUUsage() {
        if (this.measurements.length === 0) return 0;

        const sum = this.measurements.reduce((a, b) => a + b, 0);
        return sum / this.measurements.length;
    }

    /**
     * Get peak CPU usage
     */
    getPeakCPU() {
        if (this.measurements.length === 0) return 0;
        return Math.max(...this.measurements);
    }

    /**
     * Get operation statistics
     */
    getOperationStats() {
        const stats = {};
        for (const [name, data] of this.operationTimes.entries()) {
            stats[name] = {
                avg: data.avg.toFixed(2) + 'ms',
                max: data.max.toFixed(2) + 'ms',
                count: data.count,
                total: data.total.toFixed(2) + 'ms'
            };
        }
        return stats;
    }

    /**
     * Get detailed report
     */
    getReport() {
        return {
            cpuUsage: this.getCPUUsage().toFixed(1) + '%',
            peakCPU: this.getPeakCPU().toFixed(1) + '%',
            avgFrameTime: (this.totalCPUTime / this.frameCount).toFixed(2) + 'ms',
            fps: (1000 / (this.totalCPUTime / this.frameCount)).toFixed(1),
            operations: this.getOperationStats()
        };
    }

    /**
     * Reset all measurements
     */
    reset() {
        this.measurements = [];
        this.operationTimes.clear();
        this.totalCPUTime = 0;
        this.frameCount = 0;
    }

    /**
     * Enable/disable monitoring
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }
}

// Singleton instance
export const realCPUMonitor = new RealCPUMonitor();

// ⚡ DEVELOPMENT: Global access for debugging
if (typeof window !== 'undefined') {
    window.getCPUReport = () => {
        const report = realCPUMonitor.getReport();
        console.log('🔥 REAL CPU REPORT:', JSON.stringify(report, null, 2));
        return report;
    };

    window.resetCPUMonitor = () => {
        realCPUMonitor.reset();
        console.log('✅ CPU Monitor reset');
    };

    console.log('💡 Use window.getCPUReport() to see real CPU usage');
}
