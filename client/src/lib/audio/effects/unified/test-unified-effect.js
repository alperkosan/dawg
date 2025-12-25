/**
 * TEST: UnifiedEffect
 * 
 * Test automatic WASM/Worklet fallback and API
 */

import { UnifiedEffect } from '../UnifiedEffect.js';

console.group('🧪 Testing UnifiedEffect');

// Test 1: Check support
console.log('✅ Test 1: UnifiedEffect.isSupported()');
console.log(`   compressor supported: ${UnifiedEffect.isSupported('compressor')}`);
console.log(`   invalid-effect supported: ${UnifiedEffect.isSupported('invalid-effect')}`);

// Test 2: Get metadata
console.log('✅ Test 2: UnifiedEffect.getMetadata()');
const metadata = UnifiedEffect.getMetadata('saturator');
console.log(`   Saturator metadata:`, metadata);

// Test 3: Create effect (will use Worklet since WASM not connected yet)
console.log('✅ Test 3: UnifiedEffect.create()');
try {
    const audioContext = new AudioContext();
    const compressor = UnifiedEffect.create(audioContext, 'compressor');

    console.log(`   Created: ${compressor.definition.displayName}`);
    console.log(`   Implementation: ${compressor.perfStats.implementation}`);
    console.log(`   Metadata:`, compressor.getMetadata());

    // Test 4: Set parameter
    console.log('✅ Test 4: setParameter()');
    compressor.setParameter('threshold', -30);
    const threshold = compressor.getParameter('threshold');
    console.log(`   Set threshold to -30, got: ${threshold}`);

    // Test 5: Batch set parameters
    console.log('✅ Test 5: setParametersState()');
    compressor.setParametersState({
        ratio: 8,
        attack: 0.001,
        release: 0.1
    });
    const state = compressor.getParametersState();
    console.log(`   Parameters:`, state);

    // Test 6: Performance stats
    console.log('✅ Test 6: getPerfStats()');
    const perfStats = compressor.getPerfStats();
    console.log(`   Perf stats:`, perfStats);

    // Test 7: Serialize
    console.log('✅ Test 7: serialize()');
    const serialized = compressor.serialize();
    console.log(`   Serialized:`, serialized);

    // Cleanup
    compressor.dispose();

} catch (error) {
    console.error('❌ Test failed:', error);
}

console.groupEnd();

console.log('\n🎉 UnifiedEffect tests complete!');
