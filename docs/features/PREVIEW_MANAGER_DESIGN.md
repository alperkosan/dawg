# Preview Manager - Unified Preview System Design

## Overview

Centralized preview system that handles all instrument preview scenarios across the application. Replaces fragmented preview systems (samplePreview, synthPreview, pitchPreview) with a single, unified manager.

## Current State (Fragmented)

### Existing Preview Systems
```
1. samplePreview.js         → Piano Roll keyboard preview (sample-based only)
2. synthPreview.js          → Piano Roll keyboard preview (synth-based only)
3. pitchPreview.js          → Unknown usage
4. FileBrowserPreview.jsx   → File browser sample preview
5. usePreviewPlayerStore.js → Store for preview state
```

### Problems
- ❌ Duplicate code across preview systems
- ❌ No support for multi-sampled instruments
- ❌ No support for VASynth instruments
- ❌ Inconsistent API across contexts
- ❌ No unified state management
- ❌ Sample cache not shared with playback

## New Architecture (Unified)

### Preview Manager Design
```
┌─────────────────────────────────────────────────────────────┐
│                      PreviewManager                          │
│  Singleton managing all preview contexts                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ InstrumentFactory Integration                      │    │
│  │ - Uses same factory as playback                    │    │
│  │ - Shares sample cache (SampleLoader)               │    │
│  │ - Supports all instrument types                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Preview Contexts                                   │    │
│  │ - Piano Roll: Note hover/click preview             │    │
│  │ - File Browser: Sample drag/hover preview          │    │
│  │ - Instrument Editor: Keyboard preview               │    │
│  │ - Channel Rack: Instrument test preview            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Voice Management                                   │    │
│  │ - Single preview voice (monophonic)                │    │
│  │ - Automatic stop on new preview                    │    │
│  │ - Velocity control                                 │    │
│  │ - Duration control (sustain/trigger)               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## API Design

### Core Interface
```javascript
class PreviewManager {
    /**
     * Initialize preview manager
     */
    async initialize(audioContext);

    /**
     * Set current instrument for preview
     * @param {Object} instrumentData - Instrument configuration
     */
    async setInstrument(instrumentData);

    /**
     * Preview a note
     * @param {string|number} pitch - MIDI note or pitch string
     * @param {number} velocity - 0-127
     * @param {number} duration - Duration in seconds (null = sustain)
     */
    previewNote(pitch, velocity = 100, duration = null);

    /**
     * Stop current preview
     */
    stopPreview();

    /**
     * Preview a file (for FileBrowser)
     * @param {string} url - Audio file URL
     */
    async previewFile(url);

    /**
     * Cleanup and dispose
     */
    dispose();
}
```

## Implementation Plan

### Phase 1: Create PreviewManager Core
```javascript
// /lib/audio/preview/PreviewManager.js
import { InstrumentFactory } from '../instruments/index.js';

export class PreviewManager {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.currentInstrument = null;
        this.previewInstrument = null; // BaseInstrument instance
        this.isPlaying = false;
        this.currentNote = null;

        // Output routing
        this.output = this.audioContext.createGain();
        this.output.gain.value = 0.7; // Preview volume
        this.output.connect(this.audioContext.destination);
    }

    async setInstrument(instrumentData) {
        // Stop current preview
        this.stopPreview();

        // Dispose old instrument
        if (this.previewInstrument) {
            this.previewInstrument.dispose();
        }

        // Create new preview instrument using factory
        this.previewInstrument = await InstrumentFactory.createPlaybackInstrument(
            instrumentData,
            this.audioContext,
            { useCache: true } // Share cache with playback
        );

        // Connect to output
        if (this.previewInstrument) {
            this.previewInstrument.connect(this.output);
            this.currentInstrument = instrumentData;
        }
    }

    previewNote(pitch, velocity = 100, duration = null) {
        if (!this.previewInstrument) {
            console.warn('PreviewManager: No instrument loaded');
            return;
        }

        // Stop previous preview
        this.stopPreview();

        // Convert pitch to MIDI if string
        const midiNote = typeof pitch === 'string'
            ? this.previewInstrument.pitchToMidi(pitch)
            : pitch;

        // Start note
        this.previewInstrument.noteOn(midiNote, velocity);
        this.isPlaying = true;
        this.currentNote = midiNote;

        // Auto-stop if duration specified
        if (duration !== null) {
            setTimeout(() => {
                this.stopPreview();
            }, duration * 1000);
        }
    }

    stopPreview() {
        if (!this.isPlaying || !this.previewInstrument) return;

        if (this.currentNote !== null) {
            this.previewInstrument.noteOff(this.currentNote);
        }

        this.isPlaying = false;
        this.currentNote = null;
    }

    async previewFile(url) {
        // For FileBrowser - load and play audio file
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // Stop current preview
            this.stopPreview();

            // Create and play buffer source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.output);
            source.start();

            this.isPlaying = true;

            // Auto-stop when finished
            source.onended = () => {
                this.isPlaying = false;
            };

        } catch (error) {
            console.error('PreviewManager: Failed to preview file:', error);
        }
    }

    setVolume(volume) {
        this.output.gain.value = volume;
    }

    dispose() {
        this.stopPreview();

        if (this.previewInstrument) {
            this.previewInstrument.dispose();
            this.previewInstrument = null;
        }

        this.output.disconnect();
    }
}

// Singleton instance
let previewManagerInstance = null;

export const getPreviewManager = (audioContext) => {
    if (!previewManagerInstance && audioContext) {
        previewManagerInstance = new PreviewManager(audioContext);
    }
    return previewManagerInstance;
};
```

### Phase 2: Integration Points

#### Piano Roll Integration
```javascript
// In PianoRoll.jsx
import { getPreviewManager } from '@/lib/audio/preview/PreviewManager';

useEffect(() => {
    if (!currentInstrument) return;

    const audioEngine = AudioContextService.getAudioEngine();
    const previewManager = getPreviewManager(audioEngine.audioContext);

    // Set instrument for preview
    previewManager.setInstrument(currentInstrument);
}, [currentInstrument]);

// Note hover preview
const handleNoteHover = (pitch) => {
    const previewManager = getPreviewManager();
    previewManager.previewNote(pitch, 80, 0.5); // 80 velocity, 0.5s duration
};

// Note click preview
const handleNoteClick = (pitch) => {
    const previewManager = getPreviewManager();
    previewManager.previewNote(pitch, 100); // Sustain until stopped
};
```

#### File Browser Integration
```javascript
// In FileBrowserPreview.jsx
import { getPreviewManager } from '@/lib/audio/preview/PreviewManager';

const handleFilePreview = async (fileUrl) => {
    const audioEngine = AudioContextService.getAudioEngine();
    const previewManager = getPreviewManager(audioEngine.audioContext);

    await previewManager.previewFile(fileUrl);
};
```

#### Instrument Editor Integration
```javascript
// In VASynthEditor.jsx (Preview Keyboard)
import { getPreviewManager } from '@/lib/audio/preview/PreviewManager';

const handleKeyPress = (note) => {
    const previewManager = getPreviewManager();
    previewManager.previewNote(note + '4', 100); // e.g., "C4"
};

const handleKeyRelease = () => {
    const previewManager = getPreviewManager();
    previewManager.stopPreview();
};
```

#### Channel Rack Integration
```javascript
// In ChannelRackRow.jsx
import { getPreviewManager } from '@/lib/audio/preview/PreviewManager';

const handleInstrumentTest = () => {
    const previewManager = getPreviewManager();
    previewManager.setInstrument(instrument);
    previewManager.previewNote(60, 100, 1.0); // Middle C, 1 second
};
```

## Benefits

### For Users
- ✅ Consistent preview behavior everywhere
- ✅ All instrument types supported (Sample, MultiSample, VASynth, ForgeSynth)
- ✅ Better performance (shared cache)
- ✅ Preview volume control
- ✅ Faster preview loading (cached samples)

### For Developers
- ✅ Single API for all preview scenarios
- ✅ No duplicate code
- ✅ Easy to test
- ✅ Easy to extend
- ✅ Type-safe with JSDoc
- ✅ Automatic cleanup

## Migration Strategy

### Step 1: Create PreviewManager
- Implement core PreviewManager class
- Add singleton getter
- Add JSDoc documentation

### Step 2: Integrate with PianoRoll
- Replace samplePreview.js usage
- Replace synthPreview.js usage
- Test note hover/click preview

### Step 3: Integrate with FileBrowser
- Replace FileBrowserPreview logic
- Test file preview

### Step 4: Add to Instrument Editor
- Add preview keyboard to VASynthEditor
- Add preview keyboard to MultiSampleEditor
- Add preview keyboard to DrumSamplerEditor

### Step 5: Deprecate Old Systems
- Mark old preview files as deprecated
- Remove after migration complete

## Testing Checklist

- [ ] Preview single sample (Kick, Snare)
- [ ] Preview multi-sample (Piano Sampled)
- [ ] Preview VASynth (Piano Synth, Bass, Lead)
- [ ] Preview ForgeSynth (legacy synths)
- [ ] Preview from PianoRoll (hover)
- [ ] Preview from PianoRoll (click)
- [ ] Preview from FileBrowser (drag)
- [ ] Preview from Instrument Editor (keyboard)
- [ ] Preview from Channel Rack (test button)
- [ ] Volume control works
- [ ] Auto-stop on new preview
- [ ] Manual stop works
- [ ] No memory leaks
- [ ] Cache is shared with playback

## Future Enhancements

### Polyphonic Preview (Optional)
```javascript
previewChord([60, 64, 67], 100, 2.0); // C major chord
```

### Preview Effects
```javascript
previewNote(60, 100, null, {
    reverb: 0.3,
    delay: 0.2
});
```

### Preview Recording
```javascript
startRecording();
previewNote(60, 100, 1.0);
const recordedBuffer = stopRecording();
```

## File Structure
```
src/lib/audio/preview/
├── PreviewManager.js          # Core manager
├── PreviewVoice.js            # Individual preview voice (optional)
└── index.js                   # Exports

Migration:
src/features/piano_roll_v7/utils/
├── samplePreview.js           # → DEPRECATED
├── synthPreview.js            # → DEPRECATED
└── pitchPreview.js            # → DEPRECATED
```
