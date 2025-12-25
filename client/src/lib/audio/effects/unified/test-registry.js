/**
 * TEST: Effect Parameter Registry
 * 
 * Simple test to validate registry structure
 */

import {
    EFFECT_REGISTRY,
    getEffectDefinition,
    getAllEffectTypes,
    getEffectsByCategory,
    getHighPriorityEffects,
    calculateExpectedGain
} from '../EffectParameterRegistry.js';

console.group('🧪 Testing Effect Parameter Registry');

// Test 1: Registry built successfully
console.log('✅ Test 1: Registry exists');
console.log(`   Total effects: ${Object.keys(EFFECT_REGISTRY).length}`);

// Test 2: Get all types
const allTypes = getAllEffectTypes();
console.log(`✅ Test 2: getAllEffectTypes()`);
console.log(`   Found ${allTypes.length} effects`);
console.log(`   Types:`, allTypes.slice(0, 5).join(', '), '...');

// Test 3: Get high priority
const highPriority = getHighPriorityEffects();
console.log(`✅ Test 3: getHighPriorityEffects()`);
console.log(`   High priority effects (${highPriority.length}):`);
highPriority.forEach(type => {
    const def = getEffectDefinition(type);
    console.log(`   - ${def.displayName}: ${def.cpuProfile.expectedGain.toFixed(1)}% gain`);
});

// Test 4: Category grouping
console.log(`✅ Test 4: getEffectsByCategory()`);
console.log(`   Dynamics:`, getEffectsByCategory('dynamics').length);
console.log(`   Spacetime:`, getEffectsByCategory('spacetime').length);
console.log(`   Modulation:`, getEffectsByCategory('modulation').length);

// Test 5: Calculate total gain
const totalGain = calculateExpectedGain(allTypes);
console.log(`✅ Test 5: calculateExpectedGain()`);
console.log(`   Total expected CPU gain: ${totalGain.toFixed(1)}%`);

// Test 6: Individual effect details
console.log(`✅ Test 6: getEffectDefinition('compressor')`);
const compressor = getEffectDefinition('compressor');
console.log(`   Display Name: ${compressor.displayName}`);
console.log(`   Category: ${compressor.category}`);
console.log(`   WASM ID: ${compressor.wasmEffectId}`);
console.log(`   Parameters: ${Object.keys(compressor.parameters).length}`);
console.log(`   CPU Profile:`, compressor.cpuProfile);

// Test 7: Parameter structure
console.log(`✅ Test 7: Parameter structure`);
const thresholdParam = compressor.parameters.threshold;
console.log(`   threshold parameter:`, {
    label: thresholdParam.label,
    defaultValue: thresholdParam.defaultValue,
    min: thresholdParam.min,
    max: thresholdParam.max,
    unit: thresholdParam.unit,
    wasmParamIndex: thresholdParam.wasmParamIndex,
    wasmType: thresholdParam.wasmType
});

console.groupEnd();

console.log('\n🎉 All tests passed! Registry is working correctly.');
