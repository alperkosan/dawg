// Audio Quality Testing Utility
// Tests and compares audio engine capabilities against standard DAW requirements

export class AudioQualityTester {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.testResults = {};
    }

    // Test the actual audio quality parameters
    async testAudioQualitySpecs() {
        const audioContext = this.audioEngine?.audioContext;
        if (!audioContext) {
            throw new Error('Audio engine not initialized');
        }

        console.log('🎵 Testing Audio Quality Specifications...');

        const specs = {
            // Sample Rate (DAW Standard: 44.1kHz - 192kHz)
            sampleRate: {
                value: audioContext.sampleRate,
                standard: 'Professional DAW: 44.1kHz - 192kHz',
                grade: this.gradeSampleRate(audioContext.sampleRate)
            },

            // Bit Depth (simulated - Web Audio API uses 32-bit float internally)
            bitDepth: {
                value: '32-bit float (Web Audio API)',
                standard: 'Professional DAW: 16-bit to 32-bit float',
                grade: 'A+'
            },

            // Buffer Size / Latency
            bufferSize: {
                value: audioContext.baseLatency * audioContext.sampleRate || 256,
                standard: 'Low Latency: 64-256 samples',
                grade: this.gradeLatency(audioContext.baseLatency || 0.005)
            },

            // Total Latency
            totalLatency: {
                value: ((audioContext.baseLatency || 0) + (audioContext.outputLatency || 0)) * 1000,
                standard: 'Professional: <5ms, Good: <15ms',
                grade: this.gradeTotalLatency(((audioContext.baseLatency || 0) + (audioContext.outputLatency || 0)) * 1000)
            },

            // Audio Context State
            contextState: {
                value: audioContext.state,
                standard: 'Should be "running"',
                grade: audioContext.state === 'running' ? 'A' : 'C'
            }
        };

        this.testResults.audioSpecs = specs;
        return specs;
    }

    // Test engine capabilities vs DAW standards
    async testEngineCapabilities() {
        console.log('⚙️ Testing Engine Capabilities...');

        const stats = this.audioEngine.getEngineStats();

        const capabilities = {
            // Polyphony
            maxPolyphony: {
                value: stats.instruments?.total || 0,
                tested: this.audioEngine.settings?.maxPolyphony || 32,
                standard: 'Professional DAW: 64+ voices',
                grade: this.gradePolyphony(this.audioEngine.settings?.maxPolyphony || 32)
            },

            // Instrument Support
            instrumentTypes: {
                value: Object.keys(stats.instruments?.byType || {}),
                standard: 'Sample playback, Synthesis, External instruments',
                grade: this.gradeInstrumentSupport()
            },

            // Real-time Processing
            workletSupport: {
                value: !!this.audioEngine.workletManager,
                standard: 'Audio Worklets for low-latency processing',
                grade: this.audioEngine.workletManager ? 'A+' : 'C'
            },

            // Mixer Channels
            mixerChannels: {
                value: stats.mixerChannels || 0,
                standard: 'Professional DAW: 64+ channels',
                grade: this.gradeMixerChannels(stats.mixerChannels || 0)
            },

            // Effects Processing
            effectsSupport: {
                value: this.hasEffectsSupport(),
                standard: 'Insert effects, Send effects, Real-time automation',
                grade: this.gradeEffectsSupport()
            }
        };

        this.testResults.capabilities = capabilities;
        return capabilities;
    }

    // Performance comparison with industry standards
    async testPerformanceAgainstDAWs() {
        console.log('📊 Performance Comparison with Standard DAWs...');

        const performance = this.audioEngine.getEngineStats().performance;

        const comparison = {
            // CPU Efficiency
            cpuEfficiency: {
                current: this.estimateCPUUsage(),
                flStudio: 'Medium-High CPU usage',
                ableton: 'Medium CPU usage',
                logic: 'Low-Medium CPU usage (optimized for Mac)',
                reaper: 'Very Low CPU usage (highly optimized)',
                grade: this.gradeCPUEfficiency()
            },

            // Memory Usage
            memoryFootprint: {
                current: this.estimateMemoryUsage(),
                comparison: 'Browser-based: Higher than native DAWs',
                grade: 'B-' // Browser limitation
            },

            // Audio Quality
            audioQuality: {
                current: '32-bit float processing, no dithering needed',
                comparison: 'Same as professional DAWs (32-bit float)',
                grade: 'A+'
            },

            // Latency Performance
            latencyComparison: {
                current: this.testResults.audioSpecs?.totalLatency?.value || 'Unknown',
                flStudio: '~10-15ms typical',
                ableton: '~8-12ms typical',
                logic: '~6-10ms typical',
                reaper: '~5-8ms typical',
                grade: this.gradeLatencyComparison()
            }
        };

        this.testResults.dawComparison = comparison;
        return comparison;
    }

    // Generate comprehensive report
    async generateQualityReport() {
        await this.testAudioQualitySpecs();
        await this.testEngineCapabilities();
        await this.testPerformanceAgainstDAWs();

        const overallGrade = this.calculateOverallGrade();

        const report = {
            timestamp: new Date().toISOString(),
            overallGrade,
            summary: this.generateSummary(overallGrade),
            audioSpecs: this.testResults.audioSpecs,
            capabilities: this.testResults.capabilities,
            dawComparison: this.testResults.dawComparison,
            recommendations: this.generateRecommendations()
        };

        console.log('📋 Audio Quality Report Generated:', report);
        return report;
    }

    // Grading Functions
    gradeSampleRate(sampleRate) {
        if (sampleRate >= 96000) return 'A+';
        if (sampleRate >= 48000) return 'A';
        if (sampleRate >= 44100) return 'B+';
        return 'C';
    }

    gradeLatency(latency) {
        const ms = latency * 1000;
        if (ms <= 5) return 'A+';
        if (ms <= 10) return 'A';
        if (ms <= 15) return 'B+';
        if (ms <= 25) return 'B';
        return 'C';
    }

    gradeTotalLatency(latencyMs) {
        if (latencyMs <= 5) return 'A+';
        if (latencyMs <= 10) return 'A';
        if (latencyMs <= 15) return 'B+';
        if (latencyMs <= 25) return 'B';
        return 'C';
    }

    gradePolyphony(maxPoly) {
        if (maxPoly >= 128) return 'A+';
        if (maxPoly >= 64) return 'A';
        if (maxPoly >= 32) return 'B+';
        if (maxPoly >= 16) return 'B';
        return 'C';
    }

    gradeMixerChannels(channels) {
        if (channels >= 64) return 'A+';
        if (channels >= 32) return 'A';
        if (channels >= 16) return 'B+';
        if (channels >= 8) return 'B';
        return 'C';
    }

    gradeInstrumentSupport() {
        const hasWorklets = !!this.audioEngine.workletManager;
        const hasSampleSupport = this.audioEngine.sampleBuffers?.size > 0;

        if (hasWorklets && hasSampleSupport) return 'A';
        if (hasWorklets || hasSampleSupport) return 'B+';
        return 'C';
    }

    gradeEffectsSupport() {
        const hasWorkletEffects = !!this.audioEngine.workletManager;
        const hasMixerEffects = this.audioEngine.mixerChannels?.size > 0;

        if (hasWorkletEffects && hasMixerEffects) return 'A';
        if (hasWorkletEffects || hasMixerEffects) return 'B';
        return 'C';
    }

    gradeCPUEfficiency() {
        const estimated = this.estimateCPUUsage();
        if (estimated < 10) return 'A+';
        if (estimated < 20) return 'A';
        if (estimated < 30) return 'B+';
        if (estimated < 50) return 'B';
        return 'C';
    }

    gradeLatencyComparison() {
        const current = this.testResults.audioSpecs?.totalLatency?.value || 20;
        if (current <= 8) return 'A+';
        if (current <= 12) return 'A';
        if (current <= 15) return 'B+';
        if (current <= 20) return 'B';
        return 'C';
    }

    // Utility Functions
    hasEffectsSupport() {
        return !!this.audioEngine.workletManager && this.audioEngine.mixerChannels?.size > 0;
    }

    estimateCPUUsage() {
        const stats = this.audioEngine.getEngineStats();
        return Math.min(100,
            (stats.performance?.activeVoices || 0) * 2 +
            (stats.instruments?.total || 0) * 1.5 +
            (stats.mixerChannels || 0) * 0.5 + 5
        );
    }

    estimateMemoryUsage() {
        const sampleBuffers = this.audioEngine.sampleBuffers?.size || 0;
        const instruments = this.audioEngine.instruments?.size || 0;
        return sampleBuffers * 5 + instruments * 2 + 50; // MB estimate
    }

    calculateOverallGrade() {
        const grades = {
            'A+': 4.0, 'A': 4.0, 'A-': 3.7,
            'B+': 3.3, 'B': 3.0, 'B-': 2.7,
            'C+': 2.3, 'C': 2.0, 'C-': 1.7,
            'D+': 1.3, 'D': 1.0, 'F': 0.0
        };

        const allGrades = [];

        // Collect all grades
        Object.values(this.testResults).forEach(category => {
            Object.values(category).forEach(test => {
                if (test.grade && grades[test.grade] !== undefined) {
                    allGrades.push(grades[test.grade]);
                }
            });
        });

        if (allGrades.length === 0) return 'N/A';

        const average = allGrades.reduce((sum, grade) => sum + grade, 0) / allGrades.length;

        if (average >= 3.8) return 'A+';
        if (average >= 3.5) return 'A';
        if (average >= 3.0) return 'B+';
        if (average >= 2.5) return 'B';
        if (average >= 2.0) return 'C+';
        if (average >= 1.5) return 'C';
        return 'D';
    }

    generateSummary(overallGrade) {
        const summaries = {
            'A+': 'Exceptional audio quality - rivals professional DAWs',
            'A': 'Professional-grade audio quality - suitable for production',
            'B+': 'High-quality audio - good for most production needs',
            'B': 'Good audio quality - suitable for home studio use',
            'C+': 'Acceptable quality - basic production capabilities',
            'C': 'Limited quality - suitable for sketching ideas',
            'D': 'Poor quality - needs significant improvements'
        };
        return summaries[overallGrade] || 'Quality assessment unavailable';
    }

    generateRecommendations() {
        const recommendations = [];
        const specs = this.testResults.audioSpecs;
        const caps = this.testResults.capabilities;

        if (specs?.sampleRate?.grade < 'B') {
            recommendations.push('Consider increasing sample rate to 48kHz or higher for better quality');
        }

        if (specs?.totalLatency?.value > 15) {
            recommendations.push('Reduce buffer size or optimize audio drivers to lower latency');
        }

        if (caps?.maxPolyphony?.tested < 32) {
            recommendations.push('Increase maximum polyphony for more complex arrangements');
        }

        if (!caps?.workletSupport?.value) {
            recommendations.push('Implement Audio Worklets for better real-time performance');
        }

        if ((caps?.mixerChannels?.value || 0) < 16) {
            recommendations.push('Add more mixer channels for complex mixing scenarios');
        }

        if (recommendations.length === 0) {
            recommendations.push('Audio engine is performing well - continue optimizing for edge cases');
        }

        return recommendations;
    }
}

// Export testing function
export async function testAudioQuality(audioEngine) {
    const tester = new AudioQualityTester(audioEngine);
    return await tester.generateQualityReport();
}