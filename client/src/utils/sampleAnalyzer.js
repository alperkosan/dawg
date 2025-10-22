// Sample Analyzer - Debug tool for checking sample quality

export function analyzeSample(audioBuffer) {
    const results = {
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        peaks: [],
        rms: [],
        clipping: {
            total: 0,
            perChannel: []
        },
        dcOffset: [],
        hasDistortion: false
    };

    // Analyze each channel
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const data = audioBuffer.getChannelData(ch);

        // Peak detection
        let peak = 0;
        let clippedCount = 0;
        let sum = 0;
        let dcSum = 0;

        for (let i = 0; i < data.length; i++) {
            const sample = data[i];
            peak = Math.max(peak, Math.abs(sample));

            // Count samples that are clipped (> 99%)
            if (Math.abs(sample) > 0.99) {
                clippedCount++;
            }

            // RMS calculation
            sum += sample * sample;

            // DC offset
            dcSum += sample;
        }

        const rms = Math.sqrt(sum / data.length);
        const dcOffset = dcSum / data.length;

        results.peaks.push(peak);
        results.rms.push(rms);
        results.clipping.perChannel.push(clippedCount);
        results.clipping.total += clippedCount;
        results.dcOffset.push(dcOffset);
    }

    // Check if sample has pre-existing distortion
    const avgPeak = results.peaks.reduce((a, b) => a + b, 0) / results.peaks.length;
    const avgRMS = results.rms.reduce((a, b) => a + b, 0) / results.rms.length;
    const crestFactor = avgPeak / avgRMS;

    // Low crest factor indicates compression/distortion
    results.crestFactor = crestFactor;
    results.hasDistortion = crestFactor < 3 || results.clipping.total > 0;

    return results;
}

export function printSampleAnalysis(audioBuffer, name = 'Sample') {
    const analysis = analyzeSample(audioBuffer);

    console.log(`\n📊 ${name} ANALYSIS:`);
    console.log('─'.repeat(50));
    console.log(`Channels: ${analysis.channels} ${analysis.channels === 1 ? '(MONO)' : '(STEREO)'}`);
    console.log(`Duration: ${analysis.duration.toFixed(2)}s @ ${analysis.sampleRate}Hz`);
    console.log('');

    analysis.peaks.forEach((peak, i) => {
        console.log(`Channel ${i}:`);
        console.log(`  Peak: ${(peak * 100).toFixed(1)}% (${(20 * Math.log10(peak)).toFixed(2)} dBFS)`);
        console.log(`  RMS:  ${(analysis.rms[i] * 100).toFixed(1)}% (${(20 * Math.log10(analysis.rms[i])).toFixed(2)} dBFS)`);
        console.log(`  DC Offset: ${(analysis.dcOffset[i] * 100).toFixed(3)}%`);
        console.log(`  Clipped samples: ${analysis.clipping.perChannel[i]}`);
    });

    console.log('');
    console.log(`Crest Factor: ${analysis.crestFactor.toFixed(2)} dB`);
    console.log(`Total clipped: ${analysis.clipping.total} samples (${(analysis.clipping.total / (audioBuffer.length * audioBuffer.numberOfChannels) * 100).toFixed(3)}%)`);

    if (analysis.hasDistortion) {
        console.error('🔥 WARNING: Sample appears to have pre-existing distortion!');
        if (analysis.clipping.total > 0) {
            console.error('   → Contains clipped samples');
        }
        if (analysis.crestFactor < 3) {
            console.error('   → Low crest factor (heavily compressed/limited)');
        }
    } else {
        console.log('✅ Sample appears clean');
    }

    console.log('─'.repeat(50));

    return analysis;
}

// Auto-analyze all samples in engine
export function analyzeAllSamples(audioEngine) {
    console.log('\n🔬 ANALYZING ALL SAMPLES...\n');

    const results = [];
    audioEngine.sampleBuffers.forEach((buffer, id) => {
        const instrument = Array.from(audioEngine.instruments.values())
            .find(i => i.id === id);

        const name = instrument?.name || `Sample ${id}`;
        const analysis = printSampleAnalysis(buffer, name);

        results.push({
            id,
            name,
            analysis,
            isDistorted: analysis.hasDistortion
        });
    });

    console.log('\n📋 SUMMARY:');
    const distorted = results.filter(r => r.isDistorted);
    const clean = results.filter(r => !r.isDistorted);

    console.log(`Total samples: ${results.length}`);
    console.log(`Clean: ${clean.length} ✅`);
    console.log(`Distorted: ${distorted.length} 🔥`);

    if (distorted.length > 0) {
        console.log('\n🔥 DISTORTED SAMPLES:');
        distorted.forEach(r => {
            console.log(`  - ${r.name} (Peak: ${(r.analysis.peaks[0] * 100).toFixed(1)}%)`);
        });
    }

    return results;
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.analyzeSample = analyzeSample;
    window.printSampleAnalysis = printSampleAnalysis;
    window.analyzeAllSamples = analyzeAllSamples;
}
