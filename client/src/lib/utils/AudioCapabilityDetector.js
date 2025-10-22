/**
 * Audio Capability Detector
 * Detects device audio processing capabilities and recommends settings
 */

export class AudioCapabilityDetector {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.capabilities = null;
        this.benchmark = null;
    }

    /**
     * Detect basic audio context capabilities
     */
    async detectCapabilities() {
        const ctx = this.audioContext;

        this.capabilities = {
            // Sample rate capabilities
            sampleRate: ctx.sampleRate,
            maxSampleRate: this.getMaxSampleRate(),

            // Latency measurements
            baseLatency: ctx.baseLatency,
            outputLatency: ctx.outputLatency,

            // Hardware info (if available)
            audioWorklet: typeof AudioWorkletNode !== 'undefined',

            // Browser info
            browser: this.detectBrowser(),

            // Estimated max channels
            estimatedMaxChannels: await this.estimateMaxChannels(),
        };

        return this.capabilities;
    }

    /**
     * Get maximum supported sample rate
     */
    getMaxSampleRate() {
        // Most browsers support up to 96kHz
        // Some support 192kHz
        const testRates = [192000, 96000, 48000, 44100];

        for (const rate of testRates) {
            try {
                // Try creating context with this rate
                const testCtx = new AudioContext({ sampleRate: rate });
                const maxRate = testCtx.sampleRate;
                testCtx.close();
                return maxRate;
            } catch (e) {
                continue;
            }
        }

        return 48000; // Fallback
    }

    /**
     * Detect browser
     */
    detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'chrome';
        if (ua.includes('Firefox')) return 'firefox';
        if (ua.includes('Safari')) return 'safari';
        if (ua.includes('Edge')) return 'edge';
        return 'unknown';
    }

    /**
     * Benchmark actual audio processing capability
     */
    async benchmarkProcessing() {
        const ctx = this.audioContext;
        const sampleRate = ctx.sampleRate;

        console.log('🔬 Starting audio processing benchmark...');

        // Create test worklet that does heavy processing
        const benchmarkCode = `
class BenchmarkProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.processCount = 0;
        this.totalTime = 0;
        this.maxTime = 0;
    }

    process(inputs, outputs, parameters) {
        const startTime = currentTime;

        // Simulate heavy EQ processing
        const output = outputs[0];
        const input = inputs[0];

        if (input && input[0]) {
            for (let channel = 0; channel < output.length; channel++) {
                const inputChannel = input[channel];
                const outputChannel = output[channel];

                // Simulate 3-band EQ (biquad filters)
                for (let i = 0; i < inputChannel.length; i++) {
                    let sample = inputChannel[i];

                    // Simulate filter calculations
                    sample = sample * 0.5 + sample * 0.3 + sample * 0.2;
                    sample = sample * 0.4 + sample * 0.6;
                    sample = sample * 0.7 + sample * 0.3;

                    outputChannel[i] = sample;
                }
            }
        }

        const duration = currentTime - startTime;
        this.totalTime += duration;
        this.maxTime = Math.max(this.maxTime, duration);
        this.processCount++;

        // Report every 100 blocks
        if (this.processCount % 100 === 0) {
            this.port.postMessage({
                avgTime: this.totalTime / this.processCount,
                maxTime: this.maxTime,
                processCount: this.processCount
            });
        }

        return true;
    }
}

registerProcessor('benchmark-processor', BenchmarkProcessor);
        `;

        // Create blob URL for worklet
        const blob = new Blob([benchmarkCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);

        try {
            // Check if processor already registered (prevents error on reload)
            try {
                await ctx.audioWorklet.addModule(url);
            } catch (error) {
                // Processor already registered, continue
                if (!error.message.includes('already registered')) {
                    throw error;
                }
            }

            // Create benchmark node
            const benchmarkNode = new AudioWorkletNode(ctx, 'benchmark-processor');

            // Connect to destination (but muted)
            const gainNode = ctx.createGain();
            gainNode.gain.value = 0; // Mute
            benchmarkNode.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Collect benchmark data
            const benchmarkData = await new Promise((resolve) => {
                let lastReport = null;

                benchmarkNode.port.onmessage = (e) => {
                    lastReport = e.data;

                    // Stop after 500 blocks (~1.5 seconds at 48kHz)
                    if (e.data.processCount >= 500) {
                        benchmarkNode.disconnect();
                        gainNode.disconnect();
                        resolve(lastReport);
                    }
                };
            });

            URL.revokeObjectURL(url);

            // Calculate results
            const blockSize = 128;
            const idealBlockTime = (blockSize / sampleRate) * 1000; // ms

            this.benchmark = {
                avgProcessTime: benchmarkData.avgTime,
                maxProcessTime: benchmarkData.maxTime,
                idealBlockTime: idealBlockTime,
                avgCPUUsage: (benchmarkData.avgTime / idealBlockTime) * 100,
                maxCPUUsage: (benchmarkData.maxTime / idealBlockTime) * 100,
                blocksProcessed: benchmarkData.processCount
            };

            console.log('✅ Benchmark complete:', this.benchmark);
            return this.benchmark;

        } catch (error) {
            console.error('❌ Benchmark failed:', error);
            return null;
        }
    }

    /**
     * Estimate maximum simultaneous channels
     */
    async estimateMaxChannels() {
        if (!this.benchmark) {
            await this.benchmarkProcessing();
        }

        if (!this.benchmark) {
            return 16; // Conservative fallback
        }

        // Each channel should use < 30% CPU to be safe
        const safetyMargin = 0.3; // 30%
        const maxCPUPerChannel = this.benchmark.avgCPUUsage;

        // Calculate max channels
        const maxChannels = Math.floor((100 * safetyMargin) / maxCPUPerChannel);

        return Math.max(8, Math.min(maxChannels, 64)); // Clamp between 8-64
    }

    /**
     * Get recommended settings based on capabilities
     */
    getRecommendedSettings() {
        if (!this.capabilities || !this.benchmark) {
            return null;
        }

        const settings = {
            // Sample rate recommendation
            sampleRate: this.capabilities.sampleRate,

            // Latency hint
            latencyHint: this.benchmark.avgCPUUsage < 20 ? 'interactive' : 'balanced',

            // Max mixer channels
            maxMixerChannels: this.capabilities.estimatedMaxChannels,

            // Quality settings
            quality: {
                eq: this.benchmark.avgCPUUsage < 30 ? 'high' : 'normal',
                compression: this.benchmark.avgCPUUsage < 30 ? 'high' : 'normal',
                vuMeterRate: this.benchmark.avgCPUUsage < 20 ? 10 : 6, // Hz
            },

            // UI settings
            ui: {
                playheadFPS: this.benchmark.avgCPUUsage < 40 ? 60 : 30,
                vuMeterFPS: this.benchmark.avgCPUUsage < 30 ? 30 : 15,
            }
        };

        return settings;
    }

    /**
     * Get full capability report
     */
    async getFullReport() {
        await this.detectCapabilities();
        await this.benchmarkProcessing();

        const report = {
            capabilities: this.capabilities,
            benchmark: this.benchmark,
            recommended: this.getRecommendedSettings(),

            // Performance rating
            rating: this.getPerformanceRating(),
        };

        return report;
    }

    /**
     * Get performance rating (A-F)
     */
    getPerformanceRating() {
        if (!this.benchmark) return 'Unknown';

        const cpu = this.benchmark.avgCPUUsage;

        if (cpu < 10) return 'A+ (Excellent)';
        if (cpu < 20) return 'A (Very Good)';
        if (cpu < 30) return 'B (Good)';
        if (cpu < 50) return 'C (Average)';
        if (cpu < 70) return 'D (Below Average)';
        return 'F (Poor)';
    }
}

// Global capability detector instance
export let audioCapabilityDetector = null;

/**
 * Initialize capability detector
 */
export async function initAudioCapabilityDetector(audioContext) {
    audioCapabilityDetector = new AudioCapabilityDetector(audioContext);

    // Run detection
    const report = await audioCapabilityDetector.getFullReport();

    console.log('🎵 AUDIO CAPABILITY REPORT:', JSON.stringify(report, null, 2));

    // Store in window for debugging
    if (typeof window !== 'undefined') {
        window.getAudioCapabilities = () => report;
        console.log('💡 Use window.getAudioCapabilities() to see full audio capability report');
    }

    return report;
}
