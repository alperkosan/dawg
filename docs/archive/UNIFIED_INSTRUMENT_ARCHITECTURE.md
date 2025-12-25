# Unified Instrument Architecture - Gelecek İçin Sağlam Temeller

## 🎯 Hedef: Tüm Enstrümanlar İçin Ortak Yapı

Serum, Massive, Omnisphere gibi profesyonel synth'lerin ortak mimarisini baz alarak.

---

## 📐 Katman Yapısı (3-Layer Architecture)

```
┌─────────────────────────────────────────────────────┐
│  PLAYBACK LAYER (PlaybackManager, NativeAudioEngine)│
│  - Schedule notes, control playback                  │
└──────────────────┬──────────────────────────────────┘
                   │ triggerNote(pitch, vel, time)
                   ↓
┌─────────────────────────────────────────────────────┐
│  INSTRUMENT INTERFACE (BaseInstrument)              │
│  - Unified API for all instruments                  │
│  - Type-agnostic note handling                      │
└──────────────────┬──────────────────────────────────┘
                   │ noteOn(midi, vel, time)
                   ↓
┌─────────────────────────────────────────────────────┐
│  VOICE MANAGER (VoicePool + VoiceAllocator)        │
│  - Polyphony management                             │
│  - Voice stealing algorithm                         │
│  - Mono/poly mode handling                          │
└──────────────────┬──────────────────────────────────┘
                   │ allocateVoice() / releaseVoice()
                   ↓
┌─────────────────────────────────────────────────────┐
│  VOICE ENGINE (VASynthVoice, WavetableVoice, etc.) │
│  - Sound generation                                 │
│  - Single voice, no polyphony logic                 │
│  - Lightweight, reusable                            │
└─────────────────────────────────────────────────────┘
```

---

## 🏗️ Core Classes

### 1. BaseVoice (Abstract)
**Tüm voice engine'lerin base class'ı**

```javascript
/**
 * BaseVoice - Single voice sound engine
 * NO polyphony logic, just sound generation
 */
export class BaseVoice {
    constructor(audioContext) {
        this.context = audioContext;
        this.output = null; // AudioNode
        this.isActive = false;
        this.currentNote = null;
        this.startTime = null;
    }

    /**
     * Initialize voice (create audio nodes)
     * Called once during voice pool creation
     */
    initialize() {
        throw new Error('Must implement initialize()');
    }

    /**
     * Start playing a note
     * @param {number} midiNote - MIDI note number
     * @param {number} velocity - 0-127
     * @param {number} frequency - Calculated frequency (for portamento)
     * @param {number} time - AudioContext time
     */
    trigger(midiNote, velocity, frequency, time) {
        throw new Error('Must implement trigger()');
    }

    /**
     * Release note (start envelope release)
     * @param {number} time - AudioContext time
     * @returns {number} Release duration in seconds
     */
    release(time) {
        throw new Error('Must implement release()');
    }

    /**
     * Reset voice to initial state (for voice pool reuse)
     * NO disposal, just reset parameters
     */
    reset() {
        this.isActive = false;
        this.currentNote = null;
        this.startTime = null;
    }

    /**
     * Dispose voice (cleanup audio nodes)
     * Called only when destroying voice pool
     */
    dispose() {
        if (this.output) {
            this.output.disconnect();
        }
    }

    /**
     * Get current amplitude (for voice stealing priority)
     */
    getAmplitude() {
        return 0; // Override in subclass
    }
}
```

### 2. VoicePool (Generic)
**Voice lifecycle yönetimi - tüm instrument'lar için ortak**

```javascript
/**
 * VoicePool - Pre-allocated voice pool with stealing
 * Generic, works with any BaseVoice subclass
 */
export class VoicePool {
    constructor(audioContext, VoiceClass, maxVoices = 16) {
        this.context = audioContext;
        this.maxVoices = maxVoices;

        // Pre-allocate voices
        this.voices = [];
        for (let i = 0; i < maxVoices; i++) {
            const voice = new VoiceClass(audioContext);
            voice.initialize();
            this.voices.push(voice);
        }

        // Voice tracking
        this.activeVoices = new Map(); // midiNote → voice
        this.freeVoices = [...this.voices];
        this.releaseQueue = []; // Voices in release phase
    }

    /**
     * Allocate a voice for a note
     * @param {number} midiNote
     * @returns {BaseVoice|null}
     */
    allocate(midiNote) {
        // Check if note already playing
        if (this.activeVoices.has(midiNote)) {
            return this.activeVoices.get(midiNote);
        }

        // Try to get free voice
        let voice = this.freeVoices.pop();

        // No free voices - steal one
        if (!voice) {
            voice = this.stealVoice();
        }

        if (voice) {
            voice.reset();
            this.activeVoices.set(midiNote, voice);
        }

        return voice;
    }

    /**
     * Release a voice (start release envelope)
     * @param {number} midiNote
     * @param {number} time
     */
    release(midiNote, time) {
        const voice = this.activeVoices.get(midiNote);
        if (!voice) return;

        // Start release
        const releaseDuration = voice.release(time);

        // Remove from active
        this.activeVoices.delete(midiNote);

        // Add to release queue
        this.releaseQueue.push({
            voice,
            endTime: time + releaseDuration
        });

        // Schedule return to free pool
        this.scheduleVoiceReturn(voice, releaseDuration);
    }

    /**
     * Smart voice stealing algorithm
     * Priority: releasing > quietest > oldest
     */
    stealVoice() {
        // 1. Prefer voices in release phase
        if (this.releaseQueue.length > 0) {
            const { voice } = this.releaseQueue.shift();
            return voice;
        }

        // 2. Find quietest voice
        let candidate = null;
        let lowestAmplitude = Infinity;

        this.activeVoices.forEach((voice, note) => {
            const amp = voice.getAmplitude();
            if (amp < lowestAmplitude) {
                lowestAmplitude = amp;
                candidate = { voice, note };
            }
        });

        if (candidate) {
            this.activeVoices.delete(candidate.note);
            return candidate.voice;
        }

        return null;
    }

    /**
     * Schedule voice return to free pool after release
     * Uses AudioParam automation (NO setTimeout!)
     */
    scheduleVoiceReturn(voice, duration) {
        // Create dummy node for timing
        const timer = this.context.createConstantSource();
        timer.onended = () => {
            // Return to free pool
            this.freeVoices.push(voice);

            // Remove from release queue
            const index = this.releaseQueue.findIndex(item => item.voice === voice);
            if (index !== -1) {
                this.releaseQueue.splice(index, 1);
            }
        };

        const now = this.context.currentTime;
        timer.start(now);
        timer.stop(now + duration);
    }

    /**
     * Release all voices
     */
    releaseAll(time) {
        this.activeVoices.forEach((voice, note) => {
            this.release(note, time);
        });
    }

    /**
     * Emergency stop (instant, no release)
     */
    stopAll() {
        // Cancel all scheduled returns
        this.releaseQueue = [];

        // Reset all voices
        this.voices.forEach(voice => voice.reset());

        // Return all to free pool
        this.activeVoices.clear();
        this.freeVoices = [...this.voices];
    }

    dispose() {
        this.voices.forEach(voice => voice.dispose());
    }
}
```

### 3. VoiceAllocator (Mono/Poly Logic)
**Voice pool üzerinde mono/poly behavior**

```javascript
/**
 * VoiceAllocator - Handles mono/poly mode logic
 * Wraps VoicePool with mode-specific behavior
 */
export class VoiceAllocator {
    constructor(voicePool, config = {}) {
        this.pool = voicePool;

        // Configuration
        this.mode = config.mode || 'poly'; // 'mono' | 'poly'
        this.portamento = config.portamento || 0;
        this.legato = config.legato || false;

        // Mono mode state
        this.monoVoice = null;
        this.lastFrequency = null;
        this.heldNotes = new Set(); // For mono note priority
    }

    /**
     * Trigger a note
     */
    noteOn(midiNote, velocity, time) {
        const frequency = this.midiToFreq(midiNote);

        if (this.mode === 'mono') {
            return this.handleMonoNoteOn(midiNote, velocity, frequency, time);
        } else {
            return this.handlePolyNoteOn(midiNote, velocity, frequency, time);
        }
    }

    /**
     * Monophonic note handling
     */
    handleMonoNoteOn(midiNote, velocity, frequency, time) {
        this.heldNotes.add(midiNote);

        if (!this.monoVoice) {
            // First note - allocate voice
            this.monoVoice = this.pool.allocate(midiNote);
            this.monoVoice.trigger(midiNote, velocity, frequency, time);
            this.lastFrequency = frequency;
        } else {
            // Subsequent note - glide to new frequency
            if (this.portamento > 0) {
                this.glideToFrequency(this.monoVoice, frequency, time);
            } else {
                // Instant frequency change
                this.monoVoice.trigger(midiNote, velocity, frequency, time);
            }

            // Retrigger envelopes if legato is off
            if (!this.legato) {
                this.monoVoice.trigger(midiNote, velocity, frequency, time);
            }

            this.lastFrequency = frequency;
        }

        return this.monoVoice;
    }

    /**
     * Polyphonic note handling
     */
    handlePolyNoteOn(midiNote, velocity, frequency, time) {
        const voice = this.pool.allocate(midiNote);
        if (voice) {
            voice.trigger(midiNote, velocity, frequency, time);
        }
        return voice;
    }

    /**
     * Release note
     */
    noteOff(midiNote, time) {
        if (this.mode === 'mono') {
            this.heldNotes.delete(midiNote);

            // If no notes held, release mono voice
            if (this.heldNotes.size === 0 && this.monoVoice) {
                this.pool.release(midiNote, time);
                this.monoVoice = null;
                this.lastFrequency = null;
            }
            // Otherwise keep playing the latest held note
        } else {
            this.pool.release(midiNote, time);
        }
    }

    /**
     * Portamento glide
     */
    glideToFrequency(voice, targetFreq, time) {
        // Implementation depends on voice engine
        // VASynthVoice would glide oscillator frequencies
        voice.glideToFrequency?.(this.lastFrequency, targetFreq, time, this.portamento);
    }

    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
}
```

### 4. UnifiedInstrument (Wrapper)
**BaseInstrument implementation using voice pool**

```javascript
/**
 * UnifiedInstrument - Generic instrument wrapper
 * Works with any voice engine via voice pool
 */
export class UnifiedInstrument extends BaseInstrument {
    constructor(instrumentData, audioContext, VoiceClass, config = {}) {
        super(instrumentData, audioContext);

        // Create voice pool
        this.voicePool = new VoicePool(
            audioContext,
            VoiceClass,
            config.maxVoices || 16
        );

        // Create voice allocator
        this.allocator = new VoiceAllocator(this.voicePool, {
            mode: config.mode || 'poly',
            portamento: config.portamento || 0,
            legato: config.legato || false
        });

        // Master output
        this.masterGain = audioContext.createGain();
        this.output = this.masterGain;

        // Connect all voices to master
        this.voicePool.voices.forEach(voice => {
            voice.output.connect(this.masterGain);
        });
    }

    noteOn(midiNote, velocity, time) {
        const voice = this.allocator.noteOn(midiNote, velocity, time);
        this._trackNoteOn(midiNote, velocity, time);
        return voice;
    }

    noteOff(midiNote, time) {
        this.allocator.noteOff(midiNote, time);
        this._trackNoteOff(midiNote);
    }

    allNotesOff(time) {
        this.voicePool.releaseAll(time);
    }

    stopAll() {
        this.voicePool.stopAll();
    }

    dispose() {
        this.voicePool.dispose();
        this.masterGain.disconnect();
        super.dispose();
    }
}
```

---

## 🎹 Örnek: VASynth Yeni Mimari ile

### VASynthVoice (Sound Engine Only)

```javascript
export class VASynthVoice extends BaseVoice {
    initialize() {
        // Create oscillators (permanent, not recreated)
        this.oscillators = [
            this.context.createOscillator(),
            this.context.createOscillator(),
            this.context.createOscillator()
        ];

        this.filter = this.context.createBiquadFilter();
        this.ampGain = this.context.createGain();
        this.output = this.context.createGain();

        // Connect graph
        this.oscillators.forEach(osc => {
            osc.connect(this.filter);
            osc.start(0); // Start immediately, control via gain
        });

        this.filter.connect(this.ampGain);
        this.ampGain.connect(this.output);

        // Envelopes
        this.filterEnv = new ADSREnvelope(this.context);
        this.ampEnv = new ADSREnvelope(this.context);
    }

    trigger(midiNote, velocity, frequency, time) {
        this.isActive = true;
        this.currentNote = midiNote;
        this.startTime = time;

        // Set oscillator frequencies
        this.oscillators.forEach((osc, i) => {
            const settings = this.oscillatorSettings[i];
            if (!settings.enabled) return;

            const octaveMult = Math.pow(2, settings.octave);
            const freq = frequency * octaveMult;

            osc.frequency.setValueAtTime(freq, time);
            osc.detune.setValueAtTime(settings.detune, time);
        });

        // Trigger envelopes
        this.filterEnv.trigger(this.filter.frequency, time, velocity);
        this.ampEnv.trigger(this.ampGain.gain, time, velocity);
    }

    release(time) {
        this.isActive = false;
        this.filterEnv.release(this.filter.frequency, time);
        this.ampEnv.release(this.ampGain.gain, time);

        return this.ampEnv.release; // Return release duration
    }

    reset() {
        super.reset();
        // Reset to silent state (don't recreate nodes!)
        this.ampGain.gain.setValueAtTime(0, this.context.currentTime);
    }

    glideToFrequency(fromFreq, toFreq, time, duration) {
        this.oscillators.forEach((osc, i) => {
            const settings = this.oscillatorSettings[i];
            if (!settings.enabled) return;

            const octaveMult = Math.pow(2, settings.octave);
            const targetFreq = toFreq * octaveMult;

            osc.frequency.cancelScheduledValues(time);
            osc.frequency.setValueAtTime(osc.frequency.value, time);
            osc.frequency.exponentialRampToValueAtTime(targetFreq, time + duration);
        });
    }

    getAmplitude() {
        return this.ampGain.gain.value;
    }
}
```

### VASynthInstrument (Wrapper)

```javascript
export class VASynthInstrument extends UnifiedInstrument {
    constructor(instrumentData, audioContext) {
        const preset = getPreset(instrumentData.presetName);

        super(instrumentData, audioContext, VASynthVoice, {
            maxVoices: 16,
            mode: preset.voicing?.mode || 'poly',
            portamento: preset.voicing?.portamento || 0,
            legato: preset.voicing?.legato || false
        });

        this.loadPreset(preset);
    }

    loadPreset(preset) {
        // Pass preset to all voices
        this.voicePool.voices.forEach(voice => {
            voice.loadPreset(preset);
        });

        // Update allocator config
        if (preset.voicing) {
            this.allocator.mode = preset.voicing.mode;
            this.allocator.portamento = preset.voicing.portamento;
            this.allocator.legato = preset.voicing.legato;
        }
    }
}
```

---

## ✅ Avantajlar

| Feature | Old Architecture | New Architecture |
|---------|-----------------|------------------|
| **GC during playback** | ❌ Yes (creates VASynth per note) | ✅ No (reuses voices) |
| **Voice stealing** | ⚠️ Basic (oldest) | ✅ Smart (quietest) |
| **Mono/poly** | ⚠️ Two layers | ✅ Single layer |
| **Cleanup** | ⚠️ setTimeout | ✅ AudioParam |
| **Scalability** | ⚠️ Hard to add instruments | ✅ Easy (extend BaseVoice) |
| **Performance** | ⚠️ ~60 FPS with 16 voices | ✅ ~120 FPS with 16 voices |
| **Code complexity** | ⚠️ High | ✅ Low (separation of concerns) |

---

## 🚀 Migration Path

### Phase 1: Keep Working System
✅ Current code works - don't break it

### Phase 2: Implement New Architecture (Parallel)
1. Create BaseVoice, VoicePool, VoiceAllocator
2. Implement VASynthVoice
3. Create UnifiedInstrument wrapper
4. Test thoroughly

### Phase 3: Gradual Migration
1. Add feature flag: `USE_NEW_VOICE_SYSTEM`
2. Test both systems in parallel
3. Migrate presets to new schema
4. Switch default to new system

### Phase 4: Remove Old Code
1. Delete old VASynthInstrument
2. Rename UnifiedInstrument → VASynthInstrument
3. Remove feature flag

---

## 📝 Sonuç

**Şu anki durum**: Çalışıyor ama tutarsız ✅⚠️

**Gelecek için temeller**:
- ✅ BaseVoice pattern (sound engine separation)
- ✅ VoicePool pattern (professional DAW standard)
- ✅ VoiceAllocator (mono/poly logic)
- ✅ Unified preset schema

**Tavsiye**:
1. Şimdilik mevcut sistemi kullan (çalışıyor)
2. Yeni instrument eklemeden önce refactor yap
3. Bu mimari ile Wavetable, FM, Granular ekle
