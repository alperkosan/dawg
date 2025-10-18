# ADSR Envelope Naming Conflict Fix

## Problem

**Error**: `TypeError: this.filterEnvelope.release is not a function`

**User Report**: "notalar duration sonlarında çalmayı durdurmuyor" (notes not stopping at end of duration)

## Root Cause

JavaScript **instance properties shadow prototype methods**!

In `ADSREnvelope.js`, there was a critical naming conflict:

```javascript
export class ADSREnvelope {
    constructor(audioContext) {
        // ...
        this.release = 0.3;   // ❌ PROPERTY (instance)
    }

    release(param, releaseTime, currentValue) {  // ❌ METHOD (prototype)
        // ...
    }
}
```

**What happened**:
1. Constructor creates instance property: `this.release = 0.3`
2. Class defines method: `release(param, releaseTime, currentValue)`
3. **Instance properties shadow prototype methods in JavaScript!**
4. When accessing `envelope.release`, you get the **number 0.3**, not the **method**!

```javascript
const env = new ADSREnvelope(ctx);
console.log(env.release);        // 0.3 (the property!)
console.log(typeof env.release); // "number" (not "function"!)
env.release(param, time);        // ❌ TypeError: release is not a function
```

## Solution

Renamed the instance property from `release` to `releaseTime` to avoid shadowing the method:

```javascript
export class ADSREnvelope {
    constructor(audioContext) {
        this.attack = 0.01;
        this.decay = 0.1;
        this.sustain = 0.7;
        this.releaseTime = 0.3;  // ✅ RENAMED - no conflict!
        this.velocitySensitivity = 0.5;
    }

    release(param, releaseTime, currentValue) {  // ✅ METHOD - accessible now!
        const releaseEnd = releaseStart + this.releaseTime;  // ✅ Use property
        // ...
    }
}
```

## Files Changed

### 1. `ADSREnvelope.js`
- ✅ Renamed `this.release` → `this.releaseTime` in constructor
- ✅ Updated all internal references to use `this.releaseTime`
- ✅ `setParams()` still accepts `release` parameter (for preset compatibility)
- ✅ `getParams()` returns `release` property (for preset compatibility)

**Preset compatibility maintained**:
```javascript
// Presets still use 'release' key
const preset = {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.5  // ✅ Still works! Mapped to releaseTime internally
};

envelope.setParams(preset);  // ✅ Maps preset.release → this.releaseTime
```

### 2. `VASynthInstrument.js` (Old architecture)
Updated property access in timeout calculations:

```javascript
// OLD:
const releaseTime = voice.amplitudeEnvelope?.release || 0.5;

// NEW:
const releaseTime = voice.amplitudeEnvelope?.releaseTime || 0.5;
```

Changed in 3 locations (lines 165, 186, 226).

## Why This Bug Was Hard to Spot

1. **Subtle JavaScript Behavior**: Property shadowing is a gotcha
2. **No TypeScript Errors**: Would have caught this with strict typing
3. **Worked in Constructor**: `this.release = 0.3` was valid
4. **Method Exists**: `release()` method was defined correctly
5. **Runtime-Only Error**: Only failed when actually calling the method

## Impact

- ✅ Fixed "notes not stopping at duration end" bug
- ✅ VASynth voices now properly release envelopes
- ✅ Voice pool cleanup works correctly
- ✅ Preset loading still compatible (release → releaseTime mapping)

## Lessons Learned

1. **Avoid naming conflicts** between properties and methods
2. **Use descriptive names**: `releaseTime` is clearer than `release` anyway
3. **TypeScript would prevent this**: Consider migrating to TypeScript
4. **Test edge cases**: Always test full note lifecycle (on → duration → off)

## Testing

To verify fix:
1. Load VASynth instrument (any preset)
2. Write notes with duration in piano roll
3. Play pattern
4. **Expected**: Notes stop cleanly at end of duration
5. **Before fix**: Notes kept playing, error in console
6. **After fix**: Notes release properly, no errors

---

**Fixed**: 2025-10-19
**Bug severity**: Critical (broke note release)
**Affected systems**: VASynth, VASynthVoice, all instruments using ADSREnvelope
