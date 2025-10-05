/**
 * Performance Monitor Utility
 * Tracks FPS, frame time, and performance metrics
 */

class PerformanceMonitor {
    constructor() {
        this.fps = 60;
        this.frameTime = 0;
        this.frameTimes = [];
        this.maxSamples = 60; // Last 60 frames
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.isRunning = false;

        // Performance marks
        this.marks = new Map();

        // Metrics
        this.metrics = {
            minFps: Infinity,
            maxFps: 0,
            avgFps: 60,
            p95FrameTime: 0,
            p99FrameTime: 0,
            droppedFrames: 0
        };
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.update();
    }

    stop() {
        this.isRunning = false;
    }

    update() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const delta = currentTime - this.lastTime;

        // Calculate FPS
        this.frameTime = delta;
        this.frameTimes.push(delta);

        // Keep only last N samples
        if (this.frameTimes.length > this.maxSamples) {
            this.frameTimes.shift();
        }

        // Calculate average FPS
        const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.fps = 1000 / avgFrameTime;

        // Update metrics
        this.metrics.minFps = Math.min(this.metrics.minFps, this.fps);
        this.metrics.maxFps = Math.max(this.metrics.maxFps, this.fps);
        this.metrics.avgFps = this.fps;

        // Calculate percentiles
        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        const p99Index = Math.floor(sorted.length * 0.99);
        this.metrics.p95FrameTime = sorted[p95Index] || 0;
        this.metrics.p99FrameTime = sorted[p99Index] || 0;

        // Detect dropped frames (>33ms = <30fps)
        if (delta > 33) {
            this.metrics.droppedFrames++;
        }

        this.lastTime = currentTime;
        this.frameCount++;

        requestAnimationFrame(() => this.update());
    }

    mark(name) {
        this.marks.set(name, performance.now());
    }

    measure(name, startMark) {
        const start = this.marks.get(startMark);
        if (!start) {
            console.warn(`Performance mark "${startMark}" not found`);
            return 0;
        }

        const duration = performance.now() - start;
        this.marks.delete(startMark);

        return duration;
    }

    getMetrics() {
        return {
            ...this.metrics,
            currentFps: Math.round(this.fps),
            currentFrameTime: Math.round(this.frameTime * 100) / 100,
            samples: this.frameTimes.length
        };
    }

    reset() {
        this.frameTimes = [];
        this.metrics = {
            minFps: Infinity,
            maxFps: 0,
            avgFps: 60,
            p95FrameTime: 0,
            p99FrameTime: 0,
            droppedFrames: 0
        };
    }

    logReport() {
        const metrics = this.getMetrics();
        console.log('📊 Performance Report:');
        console.log(`  Current FPS: ${metrics.currentFps}`);
        console.log(`  Min FPS: ${Math.round(metrics.minFps)}`);
        console.log(`  Max FPS: ${Math.round(metrics.maxFps)}`);
        console.log(`  Avg Frame Time: ${metrics.currentFrameTime}ms`);
        console.log(`  P95 Frame Time: ${Math.round(metrics.p95FrameTime)}ms`);
        console.log(`  P99 Frame Time: ${Math.round(metrics.p99FrameTime)}ms`);
        console.log(`  Dropped Frames: ${metrics.droppedFrames}`);
    }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Start automatically in development
if (import.meta.env.DEV) {
    performanceMonitor.start();

    // Log report every 10 seconds
    setInterval(() => {
        if (window.DEBUG_PERFORMANCE) {
            performanceMonitor.logReport();
        }
    }, 10000);
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window.performanceMonitor = performanceMonitor;
}
