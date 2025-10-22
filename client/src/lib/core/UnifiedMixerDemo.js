/**
 * UnifiedMixer Demo & Testing Utilities
 *
 * Test and benchmark the WASM MegaMixer before full integration
 */

import { UnifiedMixerNode } from './UnifiedMixerNode.js';

class UnifiedMixerDemo {
    constructor() {
        this.audioContext = null;
        this.unifiedMixer = null;
        this.testOscillators = [];
    }

    /**
     * Initialize demo environment
     */
    async initialize() {
        console.log('🚀 Initializing UnifiedMixer demo...');

        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
        });

        // Resume context (required by some browsers)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // Create unified mixer
        this.unifiedMixer = new UnifiedMixerNode(this.audioContext, 32);
        await this.unifiedMixer.initialize();

        // Connect to output
        this.unifiedMixer.connect(this.audioContext.destination);

        console.log('✅ UnifiedMixer demo initialized');
    }

    /**
     * Test 1: Single channel with sine wave
     */
    async testSingleChannel() {
        console.log('\n🧪 Test 1: Single channel with sine wave');

        if (!this.unifiedMixer) {
            console.error('❌ Initialize first!');
            return;
        }

        // Create oscillator
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.frequency.value = 440; // A4
        gain.gain.value = 0.3;

        osc.connect(gain);

        // Connect to channel 0
        this.unifiedMixer.connectToChannel(gain, 0);

        // Set channel params
        this.unifiedMixer.setChannelParams(0, {
            gain: 0.8,
            pan: 0.0,
            mute: false,
            solo: false,
            eqActive: false,
            compActive: false
        });

        // Start
        osc.start();
        this.testOscillators.push({ osc, gain });

        console.log('✅ Playing 440Hz sine on channel 0');
        console.log('💡 Run demo.stopAll() to stop');
    }

    /**
     * Test 2: Multiple channels with different frequencies
     */
    async testMultipleChannels(numChannels = 8) {
        console.log(`\n🧪 Test 2: ${numChannels} channels with different frequencies`);

        if (!this.unifiedMixer) {
            console.error('❌ Initialize first!');
            return;
        }

        // Create chord (C major: C, E, G, C)
        const frequencies = [
            261.63, // C4
            329.63, // E4
            392.00, // G4
            523.25, // C5
            659.25, // E5
            783.99, // G5
            1046.50, // C6
            1318.51  // E6
        ];

        for (let i = 0; i < numChannels; i++) {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.frequency.value = frequencies[i % frequencies.length];
            osc.type = 'sine';
            gain.gain.value = 0.15; // Quieter for multiple channels

            osc.connect(gain);

            // Connect to channel
            this.unifiedMixer.connectToChannel(gain, i);

            // Set channel params with panning
            const pan = (i / (numChannels - 1)) * 2 - 1; // -1 to +1
            this.unifiedMixer.setChannelParams(i, {
                gain: 0.8,
                pan: pan,
                mute: false,
                solo: false,
                eqActive: false,
                compActive: false
            });

            // Start
            osc.start();
            this.testOscillators.push({ osc, gain });
        }

        console.log(`✅ Playing ${numChannels} channels (C major chord with panning)`);
        console.log('💡 Run demo.stopAll() to stop');
    }

    /**
     * Test 3: EQ on specific channel
     */
    async testChannelEQ() {
        console.log('\n🧪 Test 3: Testing EQ on channel 0');

        if (this.testOscillators.length === 0) {
            console.warn('⚠️ No oscillators playing. Run testSingleChannel() first');
            return;
        }

        // Boost low, cut high
        this.unifiedMixer.setChannelEQ(
            0,
            6.0,  // lowGain: +6dB
            0.0,  // midGain: 0dB
            -6.0, // highGain: -6dB
            250,  // lowFreq
            4000  // highFreq
        );

        this.unifiedMixer.setChannelParams(0, {
            eqActive: true
        });

        console.log('✅ EQ applied to channel 0: Low +6dB, High -6dB');
    }

    /**
     * Test 4: Solo/Mute functionality
     */
    async testSoloMute() {
        console.log('\n🧪 Test 4: Testing solo/mute');

        if (this.testOscillators.length < 2) {
            console.warn('⚠️ Need at least 2 channels. Run testMultipleChannels() first');
            return;
        }

        console.log('Muting channel 0...');
        this.unifiedMixer.setChannelParams(0, { mute: true });

        setTimeout(() => {
            console.log('Unmuting channel 0, soloing channel 1...');
            this.unifiedMixer.setChannelParams(0, { mute: false });
            this.unifiedMixer.setChannelParams(1, { solo: true });
        }, 2000);

        setTimeout(() => {
            console.log('Removing solo...');
            this.unifiedMixer.setChannelParams(1, { solo: false });
        }, 4000);

        console.log('✅ Running solo/mute test (6 seconds)');
    }

    /**
     * Test 5: Performance benchmark
     */
    async benchmark(numChannels = 32, duration = 5000) {
        console.log(`\n🏁 Benchmark: ${numChannels} channels for ${duration}ms`);

        if (!this.unifiedMixer) {
            console.error('❌ Initialize first!');
            return;
        }

        // Stop existing oscillators
        this.stopAll();

        // Create maximum channels
        for (let i = 0; i < numChannels; i++) {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();

            osc.frequency.value = 440 * (i + 1) / numChannels;
            osc.type = 'sine';
            gain.gain.value = 0.05; // Very quiet for 32 channels

            osc.connect(gain);
            this.unifiedMixer.connectToChannel(gain, i);

            this.unifiedMixer.setChannelParams(i, {
                gain: 0.8,
                pan: Math.random() * 2 - 1,
                mute: false,
                solo: false,
                eqActive: true,
                compActive: true
            });

            // Random EQ
            this.unifiedMixer.setChannelEQ(
                i,
                Math.random() * 12 - 6,
                Math.random() * 12 - 6,
                Math.random() * 12 - 6
            );

            osc.start();
            this.testOscillators.push({ osc, gain });
        }

        console.log(`✅ Playing ${numChannels} channels with EQ and compression...`);

        // Wait for duration
        await new Promise(resolve => setTimeout(resolve, duration));

        // Get stats
        const stats = await this.unifiedMixer.getStats();

        console.log('\n📊 Benchmark Results:');
        console.table({
            'Samples Processed': stats.samplesProcessed,
            'Average Time (ms)': stats.averageTime.toFixed(6),
            'Peak Time (ms)': stats.peakTime.toFixed(6),
            'Process Count': stats.processCount,
            'Channels': numChannels
        });

        const idealTime = (128 / 48000) * 1000; // 2.67ms for 128 samples @ 48kHz
        const cpuUsage = (stats.averageTime / idealTime) * 100;

        console.log(`\n💡 CPU Usage: ${cpuUsage.toFixed(2)}%`);
        console.log(`💡 Efficiency: ${(100 - cpuUsage).toFixed(2)}% headroom`);

        if (cpuUsage < 15) {
            console.log('🚀 EXCELLENT: Graph overhead < 15% (target achieved!)');
        } else if (cpuUsage < 50) {
            console.log('✅ GOOD: Low overhead');
        } else {
            console.log('⚠️ WARNING: High overhead detected');
        }

        this.stopAll();
    }

    /**
     * Stop all test oscillators
     */
    stopAll() {
        console.log('🛑 Stopping all test oscillators...');

        for (const { osc, gain } of this.testOscillators) {
            try {
                // Stop oscillator
                osc.stop();

                // Disconnect from graph
                osc.disconnect();
                gain.disconnect();
            } catch (e) {
                // Already stopped or disconnected
            }
        }

        this.testOscillators = [];
        console.log('✅ All stopped');
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.stopAll();

        if (this.unifiedMixer) {
            this.unifiedMixer.cleanup();
            this.unifiedMixer = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        console.log('✅ Demo cleaned up');
    }

    /**
     * Get help
     */
    help() {
        console.log('\n📚 UnifiedMixer Demo Commands:\n');
        console.log('demo.initialize()                    - Initialize demo environment');
        console.log('demo.testSingleChannel()             - Test single channel');
        console.log('demo.testMultipleChannels(8)         - Test multiple channels');
        console.log('demo.testChannelEQ()                 - Test EQ on channel 0');
        console.log('demo.testSoloMute()                  - Test solo/mute functionality');
        console.log('demo.benchmark(32, 5000)             - Benchmark performance');
        console.log('demo.stopAll()                       - Stop all test signals');
        console.log('demo.cleanup()                       - Cleanup resources');
        console.log('demo.help()                          - Show this help\n');
    }
}

// Create global instance
const unifiedMixerDemo = new UnifiedMixerDemo();

// Expose to window
if (typeof window !== 'undefined') {
    window.unifiedMixerDemo = unifiedMixerDemo;
    window.demo = unifiedMixerDemo; // Short alias

    console.log('\n🎛️ UnifiedMixer Demo loaded!');
    console.log('💡 Try: demo.help()');
}

export default unifiedMixerDemo;
