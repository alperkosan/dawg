# DAWG Quick Reference

> Fast lookup for common tasks and file locations

**Last Updated:** 2025-10-16

## 🚨 Critical Paths

### Bug Tracking
- **Bug list:** `docs/bugs/BUG_TRACKER.md`
- **User reports:** `client/kullanım notlarım`
- **Fix docs:** `docs/bugs/[BUG_NAME]_FIX.md`

### Audio Engine
- **Main engine:** `client/src/lib/core/NativeAudioEngine.js`
- **Service layer:** `client/src/lib/services/AudioContextService.js`
- **Worklet processors:** `client/public/worklets/`
  - Effects: `client/public/worklets/effects/`
  - Mixer: `client/public/worklets/mixer-processor.js`
  - Instruments: `client/public/worklets/instrument-processor.js`

### Effect System
- **Registry:** `client/src/lib/audio/EffectRegistry.js`
- **Factory:** `client/src/lib/audio/effects/EffectFactory.js`
- **UI Components:** `client/src/components/effects/`
- **Processors:** `client/public/worklets/effects/`

## 🔍 Common Tasks

### Adding a New Effect

1. Create worklet processor: `client/public/worklets/effects/my-effect-processor.js`
2. Register in EffectRegistry: `client/src/lib/audio/EffectRegistry.js`
3. Add to EffectFactory: `client/src/lib/audio/effects/EffectFactory.js`
4. Create UI component (optional): `client/src/components/effects/MyEffect.jsx`

**Checklist:**
- [ ] Parameters match in all 3 places
- [ ] parameterDescriptors() defined
- [ ] Safety checks for NaN/Infinity
- [ ] Bypass mode works

See: `docs/dsp/AUDIOWORKLET_BEST_PRACTICES.md`

### Fixing an AudioWorklet Bug

1. Mark as 🚧 in `docs/bugs/BUG_TRACKER.md`
2. Test with bypass mode (`FORCE_BYPASS = true`)
3. Add debug logging
4. Fix and test
5. Create `docs/bugs/[BUG]_FIX.md`
6. Update `client/kullanım notlarım` with ✅
7. Mark as ✅ in BUG_TRACKER

Example: `docs/bugs/VORTEX_PHASER_FIX.md`

### Debugging Audio Issues

```javascript
// In worklet processor
if (this.processCallCount < 5) {
  console.log('Process call:', {
    inputMax: Math.max(...input[0]),
    outputMax: Math.max(...output[0]),
    parameters: {
      // Log all params
    }
  });
}
```

**Common issues:**
- Missing parameters in EffectFactory
- Parameter index bug (use index 0!)
- NaN/Infinity in DSP
- State variable overflow
- Feedback > 1.0

## 📂 File Locations

### Documentation
```
docs/
├── README.md                 # Main index
├── QUICK_REFERENCE.md        # This file
├── bugs/
│   ├── BUG_TRACKER.md       # All bugs
│   └── *_FIX.md             # Fix documentation
├── dsp/
│   └── AUDIOWORKLET_BEST_PRACTICES.md
├── architecture/            # System design
├── performance/             # Optimization reports
└── features/                # Feature specs
```

### Source Code
```
client/src/
├── lib/
│   ├── audio/              # Audio system
│   │   ├── EffectRegistry.js
│   │   └── effects/EffectFactory.js
│   ├── core/               # Core engine
│   │   └── NativeAudioEngine.js
│   └── services/           # Service layer
│       └── AudioContextService.js
├── components/
│   ├── effects/            # Effect UI
│   ├── mixer/              # Mixer UI
│   ├── piano_roll/         # Piano roll
│   └── arrangement/        # Arrangement
└── stores/                 # Zustand stores
```

## 🎯 Priority Issues

### Sprint 1: Critical (Current)
1. ✅ VortexPhaser audio crash
2. Master channel routing
3. Frozen patterns visibility
4. Channel Rack drag-and-drop

### Next Up
- Transient Designer UI crash
- Effect chain reordering
- Piano roll velocity editing

See: `docs/bugs/BUG_TRACKER.md` for full list

## 🛠️ Common Fixes

### Parameter Mismatch
```javascript
// Add missing param to EffectFactory
'effect-name': {
  params: {
    missingParam: { label: 'Label', defaultValue: 0.5, min: 0, max: 1, unit: '' }
  }
}
```

### Unstable DSP
```javascript
// Add safety checks
if (!isFinite(output) || Math.abs(output) > 10) {
  state.reset();
  return 0;
}
```

### Index Bug
```javascript
// ❌ Wrong
const param = parameters.rate[sampleIndex];

// ✅ Correct
const param = parameters.rate[0];
```

## 📊 Performance Targets

- **Audio callback:** < 5ms (< 50% CPU at 128 samples)
- **Canvas rendering:** 60 FPS
- **UI interactions:** < 16ms response
- **Memory:** No leaks during long sessions

## 🔗 Key Links

- [Bug Tracker](./bugs/BUG_TRACKER.md)
- [AudioWorklet Guide](./dsp/AUDIOWORKLET_BEST_PRACTICES.md)
- [VortexPhaser Fix](./bugs/VORTEX_PHASER_FIX.md)
- [User Feedback](../client/kullanım%20notlarım)

## 💡 Tips

1. **Always test with bypass mode first**
2. **Log early, log often (but limit output)**
3. **Check parameter consistency across all files**
4. **Clamp feedback to < 1.0**
5. **Validate all DSP inputs/outputs**
6. **Reset state on NaN/Infinity**
7. **Use Math.abs(value) > threshold for overflow detection**

## 🆘 Emergency Procedures

### Audio Engine Crashed
1. Check console for errors
2. Look for NaN/Infinity in logs
3. Test each effect in isolation
4. Enable bypass mode on suspect effect
5. Check for parameter mismatches

### Plugin Won't Load
1. Check EffectRegistry registration
2. Verify worklet file exists
3. Check parameter definitions match
4. Look for syntax errors (node --check)
5. Check browser console for load errors

### Performance Issues
1. Profile with browser DevTools
2. Check canvas rendering (throttle to 30fps if needed)
3. Verify AudioWorklet CPU usage
4. Look for memory leaks
5. Check for excessive state updates

---

**Need more detail?** See full documentation in `docs/README.md`
