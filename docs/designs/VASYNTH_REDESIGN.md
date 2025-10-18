# VASynth Professional Redesign

## Current Issues

### Architecture Problems
1. **No Voice Pooling**: Creates new oscillators for every note
2. **Inefficient Cleanup**: Uses setTimeout which causes timing issues
3. **No Monophonic Mode**: Can't do leads/bass properly
4. **No Portamento/Glide**: Essential for expressive playing
5. **Primitive Voice Stealing**: Only kills oldest voice

### Missing DAW-Standard Features
1. **Unison**: Multiple detuned voices per note for thickness
2. **Voice Spread**: Stereo width control
3. **Phase Control**: Phase randomization/reset
4. **Legato Mode**: Retrigger behavior
5. **Proper Modulation Matrix**: Any source to any destination

## Proposed Architecture

### 1. Voice Pool System
```javascript
class VoicePool {
  constructor(audioContext, voiceClass, maxVoices = 16) {
    this.voices = [];
    this.activeVoices = new Map(); // midiNote -> Voice[]
    this.freeVoices = [];

    // Pre-allocate voices
    for (let i = 0; i < maxVoices; i++) {
      const voice = new voiceClass(audioContext);
      this.voices.push(voice);
      this.freeVoices.push(voice);
    }
  }

  allocate(midiNote) {
    if (this.freeVoices.length === 0) {
      // Voice stealing: find lowest priority voice
      const stolen = this.findStealableVoice();
      this.release(stolen);
    }

    const voice = this.freeVoices.pop();
    if (!this.activeVoices.has(midiNote)) {
      this.activeVoices.set(midiNote, []);
    }
    this.activeVoices.get(midiNote).push(voice);
    return voice;
  }

  release(voice) {
    voice.reset();
    this.freeVoices.push(voice);
  }
}
```

### 2. Monophonic Mode with Portamento
```javascript
class MonophonicVoice {
  constructor(audioContext) {
    this.glideTime = 0.1; // seconds
    this.legato = false;
    this.currentFreq = null;
  }

  noteOn(freq, velocity, time, retrigger = true) {
    if (this.currentFreq && !retrigger) {
      // Legato: glide to new note without retriggering envelopes
      this.glide(this.currentFreq, freq, time);
    } else {
      // Normal: trigger envelopes
      this.trigger(freq, velocity, time);
    }
    this.currentFreq = freq;
  }

  glide(fromFreq, toFreq, startTime) {
    this.oscillators.forEach(osc => {
      osc.frequency.cancelScheduledValues(startTime);
      osc.frequency.setValueAtTime(fromFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(
        toFreq,
        startTime + this.glideTime
      );
    });
  }
}
```

### 3. Unison System
```javascript
class UnisonVoice {
  constructor(audioContext, unisonCount = 1) {
    this.unisonCount = unisonCount;
    this.detuneAmount = 10; // cents
    this.spread = 0.5; // stereo spread 0-1
    this.oscillatorSets = [];

    // Create multiple oscillator sets
    for (let i = 0; i < unisonCount; i++) {
      this.oscillatorSets.push({
        oscillators: [],
        panner: audioContext.createStereoPanner(),
        detune: this.calculateDetune(i, unisonCount)
      });
    }
  }

  calculateDetune(index, total) {
    if (total === 1) return 0;

    // Spread voices symmetrically around center
    const spread = index / (total - 1) - 0.5; // -0.5 to +0.5
    return spread * this.detuneAmount * 2;
  }

  calculatePan(index, total) {
    if (total === 1) return 0;

    const spread = index / (total - 1) - 0.5;
    return spread * this.spread * 2; // -spread to +spread
  }
}
```

### 4. Smart Voice Stealing
```javascript
findStealableVoice() {
  let candidate = null;
  let lowestPriority = Infinity;

  this.activeVoices.forEach(voice => {
    const priority = this.calculatePriority(voice);
    if (priority < lowestPriority) {
      lowestPriority = priority;
      candidate = voice;
    }
  });

  return candidate;
}

calculatePriority(voice) {
  // Higher priority = less likely to be stolen
  let priority = 0;

  // Playing notes have higher priority than releasing
  if (voice.state === 'release') priority -= 100;

  // Louder notes have higher priority
  priority += voice.currentAmplitude * 50;

  // Recent notes have higher priority
  const age = this.context.currentTime - voice.startTime;
  priority -= age * 10;

  // Lower velocity = lower priority
  priority += voice.velocity * 0.5;

  return priority;
}
```

### 5. Modulation Matrix
```javascript
class ModulationMatrix {
  constructor() {
    this.sources = new Map(); // 'lfo1', 'env1', 'velocity', etc.
    this.destinations = new Map(); // 'filter-cutoff', 'osc1-detune', etc.
    this.routings = []; // [{source, dest, amount}, ...]
  }

  route(sourceName, destName, amount) {
    this.routings.push({
      source: sourceName,
      destination: destName,
      amount: amount // -1 to +1
    });
  }

  update(time) {
    // Read all source values
    const sourceValues = new Map();
    this.sources.forEach((source, name) => {
      sourceValues.set(name, source.getValue(time));
    });

    // Apply to destinations
    this.routings.forEach(route => {
      const sourceValue = sourceValues.get(route.source) || 0;
      const dest = this.destinations.get(route.destination);
      const modAmount = sourceValue * route.amount;

      dest.applyModulation(modAmount, time);
    });
  }
}
```

## Implementation Priority

1. **High Priority** (Affects playability):
   - Voice pooling (performance)
   - Monophonic mode + portamento (essential for leads/bass)
   - Proper voice stealing (prevents note stealing artifacts)

2. **Medium Priority** (Quality improvements):
   - Unison (sound thickness)
   - Phase control (sound consistency)
   - Legato mode (expressiveness)

3. **Low Priority** (Nice to have):
   - Modulation matrix (flexibility)
   - Additional filter types
   - Ring/sync modulation

## Performance Targets

- **Voice Pool**: Pre-allocate all voices at initialization
- **Zero GC**: No object creation during playback
- **Scheduling**: Use AudioParam automation instead of setTimeout
- **CPU**: <5% per 8 voices on modern hardware
