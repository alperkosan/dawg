/**
 * BENCHMARK TEST RUNNER
 * 
 * Example usage and tests for EffectBenchmark
 */

import { EffectBenchmark, quickBenchmark, runFullBenchmark } from '../EffectBenchmark.js';

console.group('🎯 Effect Benchmark - Test Runner');

// ============================================================================
// Test 1: Quick Single Effect Benchmark
// ============================================================================

console.log('\n📊 Test 1: Quick Benchmark (Compressor)');
console.log('This will compare JS worklet vs WASM for compressor');
console.log('Running...\n');

quickBenchmark('compressor').then(result => {
    console.log('✅ Compressor benchmark complete!');
    console.log(`   CPU Improvement: ${result.renderTimeImprovement}%`);
    console.log(`   Speedup: ${result.speedup}x`);
    console.log(`   Memory Saved: ${result.memorySaved} MB`);
    console.log(`   Quality Match: ${result.qualityMatch}`);
    console.log(`   Worth Migrating: ${result.worthMigrating ? 'YES ✅' : 'NO ❌'}`);
});

// ============================================================================
// Test 2: Full Benchmark Suite
// ============================================================================

console.log('\n📊 Test 2: Full Benchmark Suite');
console.log('This will benchmark 5 high-priority effects');
console.log('Expected time: ~60 seconds');
console.log('Running...\n');

runFullBenchmark().then(({ results, report }) => {
    console.log('\n✅ Full benchmark complete!');
    console.log(`\nTested ${results.length} effects`);

    // Show best performer
    const best = results.reduce((max, r) =>
        r.renderTimeImprovement > max.renderTimeImprovement ? r : max
    );
    console.log(`\n🏆 Best Performer: ${best.effect}`);
    console.log(`   ${best.renderTimeImprovement.toFixed(1)}% faster with WASM!`);

    console.log('\n📄 Full report exported (see console for JSON)');
});

// ============================================================================
// Test 3: Manual Benchmark with Custom Settings
// ============================================================================

console.log('\n📊 Test 3: Manual Benchmark');

async function manualBenchmark() {
    const benchmark = new EffectBenchmark();

    // Benchmark saturator with aggressive settings
    console.log('Testing Saturator with aggressive drive...');
    const result = await benchmark.benchmarkEffect('saturator', 'worklet', {
        distortion: 1.5,  // Max drive
        wet: 1.0,
        multiband: 1      // Enable multiband
    });

    console.log(`\nSaturator @ Max Drive:`);
    console.log(`  Render Time: ${result.renderTime} ms`);
    console.log(`  CPU Efficiency: ${result.cpuEfficiency}%`);
    console.log(`  Real-Time Factor: ${result.realTimeFactor}x`);

    if (result.realTimeFactor > 1.0) {
        console.log(`  ⚠️ Cannot run in real-time! (needs ${result.realTimeFactor}x CPU)`);
    } else {
        console.log(`  ✅ Runs in real-time at ${(1 / result.realTimeFactor).toFixed(1)}x headroom`);
    }
}

manualBenchmark();

// ============================================================================
// Test 4: Batch Comparison
// ============================================================================

console.log('\n📊 Test 4: Batch Comparison (Dynamics Category)');

async function batchTest() {
    const benchmark = new EffectBenchmark();

    const dynamicsEffects = [
        'compressor',
        'saturator',
        'limiter',
        'clipper'
    ];

    console.log(`Testing ${dynamicsEffects.length} dynamics effects...`);
    const comparisons = await benchmark.benchmarkAll(dynamicsEffects, true);

    console.log('\n✅ Batch test complete!');

    // Calculate category average
    const avgGain = comparisons.reduce((sum, c) =>
        sum + c.renderTimeImprovement, 0) / comparisons.length;

    console.log(`\n📈 Average CPU gain for Dynamics: ${avgGain.toFixed(1)}%`);
}

batchTest();

// ============================================================================
// Expected Output Example
// ============================================================================

console.log('\n📝 Expected Output Format:');
console.log(`
🔬 Benchmarking: compressor (worklet)
┌─────────────────┬──────────┐
│      Metric     │  Value   │
├─────────────────┼──────────┤
│  Render Time    │  85.2 ms │
│  Audio Length   │ 10000 ms │
│  CPU Efficiency │  11730%  │
│  Real-Time Fact │  0.009x  │
│  Memory Delta   │  2.3 MB  │
│  RMS Level      │  0.1234  │
│  Peak Level     │  0.5678  │
└─────────────────┴──────────┘

🔬 Benchmarking: compressor (wasm)
┌─────────────────┬──────────┐
│      Metric     │  Value   │
├─────────────────┼──────────┤
│  Render Time    │  42.1 ms │  ⚡ 2x faster!
│  Audio Length   │ 10000 ms │
│  CPU Efficiency │  23750%  │
│  Real-Time Fact │  0.004x  │
│  Memory Delta   │  1.8 MB  │
│  RMS Level      │  0.1234  │
│  Peak Level     │  0.5678  │
└─────────────────┴──────────┘

⚖️  Comparing: compressor (JS vs WASM)
┌──────────────────┬──────────┐
│  Comparison      │  Value   │
├──────────────────┼──────────┤
│  JS Render Time  │  85.2 ms │
│  WASM Render     │  42.1 ms │
│  Improvement     │  50.6%   │  ✅
│  Speedup         │  2.02x   │
│  Memory Saved    │  0.5 MB  │
│  Quality Match   │  ✅ Identical
│  Verdict         │  ✅ WASM Faster
└──────────────────┴──────────┘

📊 BENCHMARK SUMMARY
✨ Average CPU Improvement: 48.3%
⚡ Average Speedup: 1.94x
💾 Total Memory Saved: 2.1 MB

🏆 Top 5 Performance Gains:
  1. modern-reverb: 56.2% (2.28x faster)
  2. saturator: 51.8% (2.07x faster)
  3. compressor: 50.6% (2.02x faster)
  4. modern-delay: 47.1% (1.89x faster)
  5. limiter: 43.5% (1.77x faster)

🎯 Migration Recommendations:
  5 of 5 effects show >10% improvement
  ✅ modern-reverb: 56.2% gain
  ✅ saturator: 51.8% gain
  ✅ compressor: 50.6% gain
  ✅ modern-delay: 47.1% gain
  ✅ limiter: 43.5% gain
`);

console.groupEnd();

console.log('\n🎉 Benchmark framework ready!');
console.log('Run any of the tests above to see real results.');
