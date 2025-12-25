/**
 * WASM EFFECT TEST DEMO
 * 
 * Quick validation of WASM backend integration
 * Run in browser console to test
 */

import { UnifiedEffect } from '../effects/unified/UnifiedEffect.js';
import { getEffectDefinition, getHighPriorityEffects } from '../effects/unified/EffectParameterRegistry.js';

console.group('🧪 WASM Effect Integration Test');

/**
 * Test 1: Create WASM Effects
 */
async function testWasmEffectCreation() {
    console.log('\n📝 Test 1: WASM Effect Creation');

    const audioContext = new AudioContext();

    // Attach mock WASM service (will be real in production)
    if (!audioContext.__wasmService) {
        console.log('⚠️ No WASM service found, attaching mock...');

        // Import actual WasmService
        const { WasmService } = await import('../../core/services/WasmService.js');
        const wasmService = new WasmService({ audioContext });

        // Initialize (will try to load WASM)
        const initialized = await wasmService.initialize();

        if (initialized) {
            audioContext.__wasmService = wasmService;
            console.log('✅ WasmService initialized and attached');
        } else {
            console.warn('⚠️ WasmService failed to initialize (WASM module may not be built)');
            console.log('Creating mock service for testing...');

            // Mock service for testing without WASM
            audioContext.__wasmService = {
                isInitialized: true,
                createEffect: (typeId) => {
                    console.log(`Mock: Creating effect type ${typeId}`);
                    return Math.floor(Math.random() * 1000);
                },
                setEffectParameter: (id, idx, val) => {
                    console.log(`Mock: Set effect ${id} param ${idx} = ${val}`);
                },
                getEffectParameter: () => 0,
                destroyEffect: (id) => {
                    console.log(`Mock: Destroy effect ${id}`);
                }
            };
            console.log('✅ Mock service created');
        }
    }

    // Test effect creation
    try {
        console.log('\n🎛️ Creating modern-reverb with UnifiedEffect...');
        const reverb = UnifiedEffect.create(audioContext, 'modern-reverb');

        console.log('✅ Effect created:');
        console.log(`   Type: ${reverb.type}`);
        console.log(`   Implementation: ${reverb.perfStats.implementation}`);
        console.log(`   Metadata:`, reverb.getMetadata());

        // Set some parameters
        console.log('\n🎚️ Setting parameters...');
        reverb.setParameter('size', 0.8);
        reverb.setParameter('decay', 3.5);
        reverb.setParameter('wet', 0.4);

        console.log('✅ Parameters set');
        console.log(`   size: ${reverb.getParameter('size')}`);
        console.log(`   decay: ${reverb.getParameter('decay')}`);
        console.log(`   wet: ${reverb.getParameter('wet')}`);

        // Get performance stats
        const stats = reverb.getPerfStats();
        console.log('\n📊 Performance stats:', stats);

        // Cleanup
        reverb.dispose();
        console.log('\n✅ Effect disposed');

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

/**
 * Test 2: Parameter Batch Update
 */
async function testParameterBatch() {
    console.log('\n📝 Test 2: Batch Parameter Update');

    const audioContext = new AudioContext();

    if (!audioContext.__wasmService) {
        console.warn('⚠️ Run Test 1 first to initialize WASM service');
        return false;
    }

    try {
        const delay = UnifiedEffect.create(audioContext, 'modern-delay');

        console.log('✅ Delay effect created');

        // Batch parameter update
        const params = {
            timeLeft: 0.5,
            timeRight: 0.375,
            feedbackLeft: 0.6,
            feedbackRight: 0.5,
            wet: 0.4
        };

        console.log('🎚️ Setting batch parameters:', params);
        delay.setParametersState(params);

        console.log('✅ Batch update complete');

        // Verify
        const state = delay.getParametersState();
        console.log('📋 Current state:', state);

        delay.dispose();
        console.log('✅ Disposed');

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

/**
 * Test 3: Serialize/Deserialize
 */
async function testSerialization() {
    console.log('\n📝 Test 3: Serialization');

    const audioContext = new AudioContext();

    if (!audioContext.__wasmService) {
        console.warn('⚠️ Run Test 1 first');
        return false;
    }

    try {
        const effect = UnifiedEffect.create(audioContext, 'modern-reverb');

        // Set parameters
        effect.setParametersState({
            size: 0.9,
            decay: 5.0,
            damping: 0.7,
            wet: 0.5
        });

        // Serialize
        const serialized = effect.serialize();
        console.log('📦 Serialized:', serialized);

        // Create new effect with same state
        const restored = UnifiedEffect.create(audioContext, serialized.type);
        restored.setParametersState(serialized.parameters);

        console.log('✅ Restored effect');
        console.log('📋 Restored parameters:', restored.getParametersState());

        // Cleanup
        effect.dispose();
        restored.dispose();

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error);
        return false;
    }
}

/**
 * Test 4: High Priority Effects
 */
async function testHighPriorityEffects() {
    console.log('\n📝 Test 4: High Priority Effects');

    const highPriority = getHighPriorityEffects();
    console.log(`🎯 High priority effects (${highPriority.length}):`, highPriority);

    const audioContext = new AudioContext();

    if (!audioContext.__wasmService) {
        console.warn('⚠️ Run Test 1 first');
        return false;
    }

    const effects = [];

    try {
        // Create all high-priority effects
        for (const type of highPriority) {
            const effect = UnifiedEffect.create(audioContext, type);
            const metadata = effect.getMetadata();

            console.log(`✅ ${metadata.displayName}:`);
            console.log(`   Implementation: ${metadata.implementation}`);
            console.log(`   WASM Supported: ${metadata.wasmSupported}`);
            console.log(`   CPU Profile:`, metadata.cpuProfile);

            effects.push(effect);
        }

        console.log(`\n✅ Created ${effects.length} effects`);

        // Cleanup
        effects.forEach(fx => fx.dispose());
        console.log('✅ All effects disposed');

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error);

        // Cleanup on error
        effects.forEach(fx => {
            try { fx.dispose(); } catch (e) { }
        });

        return false;
    }
}

/**
 * Run all tests
 */
export async function runWasmTests() {
    console.log('🚀 Running WASM Integration Tests...\n');

    const results = {
        test1: await testWasmEffectCreation(),
        test2: await testParameterBatch(),
        test3: await testSerialization(),
        test4: await testHighPriorityEffects()
    };

    console.log('\n📊 Test Results:');
    console.table(results);

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    console.log(`\n${passed}/${total} tests passed`);

    if (passed === total) {
        console.log('✅ All tests passed!');
    } else {
        console.warn('⚠️ Some tests failed. Check logs above.');
    }

    console.groupEnd();

    return results;
}

// Export for browser console
if (typeof window !== 'undefined') {
    window.runWasmTests = runWasmTests;
    console.log('📝 Tests loaded. Run: window.runWasmTests()');
}
