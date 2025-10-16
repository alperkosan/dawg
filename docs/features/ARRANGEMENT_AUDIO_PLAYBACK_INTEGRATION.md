# 🎵 Arrangement V2 - Audio Clip Playback & Mixer Routing Integration

**Date:** 2025-10-12
**Status:** 🟡 Mixer Routing UI Complete - Audio Playback Not Implemented
**Priority:** High

---

## 📊 Current Status

### ✅ Completed Features
1. ✅ Audio clip double-click opens Sample Editor V3
2. ✅ Mixer channel routing UI in Sample Editor
3. ✅ Reactive mixer channel selection
4. ✅ Audio clip `mixerChannelId` stored in state
5. ✅ ToneAudioBuffer → Web Audio API AudioBuffer conversion
6. ✅ Waveform rendering with cache

### 🔴 Missing Feature: Audio Playback Integration

**Problem:**
Audio clips in Arrangement V2 **do NOT play audio** when transport is playing. The clips are visual-only.

**Evidence:**
```javascript
// useArrangementV2Store.js has audio engine reference
_audioEngine: AudioContextService.getAudioEngine()

// But NO playback implementation for audio clips
// No scheduleClip(), playClip(), or audio source creation
```

**User Report:**
> "Aranje panelinde çaldığım audio clipler mixerdeki efektleri kullanmıyor"

**Root Cause:**
Arrangement V2 does not have audio clip playback implementation yet. It only:
- Renders clips visually ✅
- Manages clip data (position, duration, etc.) ✅
- Has mixer routing metadata ✅
- **Does NOT play audio** ❌

---

## 🎯 Implementation Plan

### Phase 1: Basic Audio Clip Playback (Core Feature)

#### Step 1.1: Add Audio Clip Scheduling System

**File:** `client/src/store/useArrangementV2Store.js`

**Add to store:**
```javascript
export const useArrangementV2Store = create((set, get) => ({
  // ... existing state

  // NEW: Audio clip playback state
  _activeAudioSources: new Map(), // clipId -> { source, gainNode, startTime }
  _scheduledClips: new Set(), // clipIds scheduled for next play cycle

  // NEW: Schedule audio clips for playback
  scheduleAudioClips: (startBeat, endBeat) => {
    const clips = get().clips.filter(c => c.type === 'audio');
    const audioEngine = get()._audioEngine;
    const bpm = get().bpm;

    if (!audioEngine) return;

    const secondsPerBeat = 60 / bpm;
    const audioContext = audioEngine.audioContext;
    const currentTime = audioContext.currentTime;

    clips.forEach(clip => {
      // Check if clip should play in this range
      if (clip.startTime >= startBeat && clip.startTime < endBeat) {
        get()._scheduleAudioClip(clip, currentTime, secondsPerBeat);
      }
    });
  },

  // NEW: Schedule single audio clip
  _scheduleAudioClip: (clip, audioContextTime, secondsPerBeat) => {
    const audioEngine = get()._audioEngine;
    const audioAssetManager = window.audioAssetManager; // Global reference

    if (!audioEngine || !audioAssetManager) return;

    // Get audio buffer
    const asset = audioAssetManager.assets.get(clip.assetId);
    if (!asset?.buffer) {
      console.warn('Audio buffer not found for clip:', clip.id);
      return;
    }

    // Convert ToneAudioBuffer to Web Audio API AudioBuffer
    const webAudioBuffer = asset.buffer.get ? asset.buffer.get() : asset.buffer;

    // Determine mixer routing
    const track = get().tracks.find(t => t.id === clip.trackId);
    const mixerChannelId = clip.mixerChannelId || track?.mixerChannelId;

    if (!mixerChannelId) {
      console.warn('No mixer channel for clip:', clip.id);
      return;
    }

    const mixerChannel = audioEngine.mixerChannels.get(mixerChannelId);
    if (!mixerChannel) {
      console.warn('Mixer channel not found:', mixerChannelId);
      return;
    }

    // Create audio source
    const source = audioEngine.audioContext.createBufferSource();
    source.buffer = webAudioBuffer;

    // Apply clip parameters
    const gainNode = audioEngine.audioContext.createGain();
    const linearGain = Math.pow(10, clip.gain / 20); // dB to linear
    gainNode.gain.value = linearGain;

    // Apply playback rate
    source.playbackRate.value = clip.playbackRate || 1.0;

    // Connect: source → gain → mixer channel
    source.connect(gainNode);
    gainNode.connect(mixerChannel.input);

    // Calculate timing
    const clipDurationSeconds = clip.duration * secondsPerBeat;
    const offset = clip.sampleOffset || 0;

    // Schedule playback
    source.start(audioContextTime, offset, clipDurationSeconds);

    // Store reference
    get()._activeAudioSources.set(clip.id, {
      source,
      gainNode,
      startTime: audioContextTime
    });

    // Auto-cleanup when clip ends
    source.onended = () => {
      gainNode.disconnect();
      get()._activeAudioSources.delete(clip.id);
    };

    console.log(`🎵 Scheduled clip: ${clip.name} → ${mixerChannelId}`);
  },

  // NEW: Stop all active audio clips
  stopAllAudioClips: () => {
    const activeSources = get()._activeAudioSources;

    activeSources.forEach((sourceData, clipId) => {
      try {
        sourceData.source.stop();
        sourceData.gainNode.disconnect();
      } catch (e) {
        // Already stopped
      }
    });

    activeSources.clear();
    console.log('🛑 Stopped all audio clips');
  },

  // NEW: Stop specific audio clip
  stopAudioClip: (clipId) => {
    const sourceData = get()._activeAudioSources.get(clipId);

    if (sourceData) {
      try {
        sourceData.source.stop();
        sourceData.gainNode.disconnect();
      } catch (e) {
        // Already stopped
      }

      get()._activeAudioSources.delete(clipId);
      console.log(`🛑 Stopped clip: ${clipId}`);
    }
  }
}));
```

#### Step 1.2: Integrate with Transport Manager

**File:** `client/src/store/useArrangementV2Store.js`

**Modify `initializeTransport`:**
```javascript
initializeTransport: async () => {
  // ... existing code

  // Subscribe to transport events
  const unsubscribe = transportManager.subscribe((event) => {
    if (event.type === 'position-update') {
      const positionInBeats = event.position / 4;
      set({ cursorPosition: positionInBeats });

      // NEW: Schedule audio clips as cursor moves
      if (get().isPlaying) {
        const lookAheadBeats = 2; // Schedule 2 beats ahead
        get().scheduleAudioClips(positionInBeats, positionInBeats + lookAheadBeats);
      }
    } else if (event.type === 'state-change') {
      // ... existing code

      // NEW: Handle transport stop
      if (!event.state.isPlaying) {
        get().stopAllAudioClips();
      }
    }
  });

  // ... rest of code
}
```

#### Step 1.3: Hook into Play/Stop Actions

**File:** `client/src/store/useArrangementV2Store.js`

**Modify play/stop methods:**
```javascript
play: async () => {
  const transportManager = get()._transportManager;
  if (!transportManager) {
    await get().initializeTransport();
  }

  const tm = get()._transportManager;
  if (tm) {
    await tm.play();

    // NEW: Schedule clips from current position
    const currentBeat = get().cursorPosition;
    const lookAheadBeats = 4;
    get().scheduleAudioClips(currentBeat, currentBeat + lookAheadBeats);
  }
},

stop: async () => {
  const transportManager = get()._transportManager;
  if (transportManager) {
    await transportManager.stop();
  }

  // NEW: Stop all audio clips
  get().stopAllAudioClips();

  set({ isPlaying: false, cursorPosition: 0 });
}
```

---

### Phase 2: Advanced Features (Optional Enhancements)

#### 2.1: Real-time Parameter Updates

```javascript
// Update clip gain while playing
updateClipGain: (clipId, newGainDB) => {
  const clip = get().clips.find(c => c.id === clipId);
  if (!clip) return;

  // Update store
  get().updateClip(clipId, { gain: newGainDB });

  // Update live audio source
  const sourceData = get()._activeAudioSources.get(clipId);
  if (sourceData) {
    const linearGain = Math.pow(10, newGainDB / 20);
    const audioContext = get()._audioEngine.audioContext;
    sourceData.gainNode.gain.setTargetAtTime(
      linearGain,
      audioContext.currentTime,
      0.01 // 10ms ramp
    );
  }
}
```

#### 2.2: Fade In/Out Implementation

```javascript
_scheduleAudioClip: (clip, audioContextTime, secondsPerBeat) => {
  // ... existing code

  // Apply fade in
  if (clip.fadeIn > 0) {
    const fadeInSeconds = clip.fadeIn * secondsPerBeat;
    gainNode.gain.setValueAtTime(0, audioContextTime);
    gainNode.gain.linearRampToValueAtTime(linearGain, audioContextTime + fadeInSeconds);
  } else {
    gainNode.gain.setValueAtTime(linearGain, audioContextTime);
  }

  // Apply fade out
  if (clip.fadeOut > 0) {
    const fadeOutSeconds = clip.fadeOut * secondsPerBeat;
    const fadeOutStartTime = audioContextTime + clipDurationSeconds - fadeOutSeconds;
    gainNode.gain.setValueAtTime(linearGain, fadeOutStartTime);
    gainNode.gain.linearRampToValueAtTime(0, fadeOutStartTime + fadeOutSeconds);
  }

  // ... rest of code
}
```

#### 2.3: Loop Playback Support

```javascript
_scheduleAudioClip: (clip, audioContextTime, secondsPerBeat) => {
  // ... existing code

  // Check if cursor is in loop region
  const loopRegions = get().loopRegions;
  const activeLoop = loopRegions.find(r =>
    clip.startTime >= r.startTime && clip.startTime < r.endTime
  );

  if (activeLoop && get().loopEnabled) {
    // Schedule clip to loop with loop region
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = clipDurationSeconds;
  }

  // ... rest of code
}
```

#### 2.4: Dynamic Mixer Routing Change

```javascript
// Change clip routing while playing
changeClipRouting: (clipId, newMixerChannelId) => {
  const sourceData = get()._activeAudioSources.get(clipId);
  if (!sourceData) {
    // Not playing, just update store
    get().updateClip(clipId, { mixerChannelId: newMixerChannelId });
    return;
  }

  const audioEngine = get()._audioEngine;
  const newChannel = audioEngine.mixerChannels.get(newMixerChannelId);

  if (!newChannel) {
    console.warn('Mixer channel not found:', newMixerChannelId);
    return;
  }

  // Crossfade to avoid clicks
  const fadeTime = 0.05; // 50ms
  const audioContext = audioEngine.audioContext;
  const now = audioContext.currentTime;

  // Fade out from old connection
  sourceData.gainNode.gain.setTargetAtTime(0, now, fadeTime / 3);

  // Reconnect after fade
  setTimeout(() => {
    sourceData.gainNode.disconnect();
    sourceData.gainNode.connect(newChannel.input);

    // Fade back in
    const linearGain = Math.pow(10, clip.gain / 20);
    sourceData.gainNode.gain.setTargetAtTime(linearGain, now + fadeTime, fadeTime / 3);
  }, fadeTime * 1000);

  // Update store
  get().updateClip(clipId, { mixerChannelId: newMixerChannelId });
}
```

---

## 🧪 Testing Plan

### Manual Testing Checklist

**Pre-requisites:**
- [ ] Arrangement V2 panel open
- [ ] Mixer panel open with effects loaded
- [ ] Audio clips added to arrangement

**Test Sequence:**

1. **Basic Playback**
   - [ ] Press play (spacebar)
   - [ ] Audio clips should play audio
   - [ ] Console shows: `🎵 Scheduled clip: {name} → {channelId}`
   - [ ] Audio stops when pressing stop

2. **Mixer Routing (Inherited)**
   - [ ] Audio clip with `mixerChannelId: null`
   - [ ] Clip plays through track's mixer channel
   - [ ] Track's effects apply to clip audio

3. **Mixer Routing (Dedicated)**
   - [ ] Open Sample Editor for clip
   - [ ] Select different mixer channel (e.g., "Bass")
   - [ ] Close Sample Editor
   - [ ] Press play
   - [ ] Clip plays through selected channel
   - [ ] Selected channel's effects apply

4. **Mixer Effects**
   - [ ] Add reverb to mixer channel
   - [ ] Route clip to that channel
   - [ ] Play clip
   - [ ] Audio has reverb effect ✅

5. **Multiple Clips**
   - [ ] Place 3 clips on different tracks
   - [ ] Route to different mixer channels
   - [ ] Play arrangement
   - [ ] All clips play simultaneously
   - [ ] Each respects its mixer routing

6. **Real-time Parameter Change**
   - [ ] While playing, open Sample Editor
   - [ ] Change mixer channel
   - [ ] Audio switches channel smoothly (with crossfade)

### Debug Console Commands

```javascript
// Check active audio sources
const state = useArrangementV2Store.getState();
console.log('Active sources:', state._activeAudioSources.size);
state._activeAudioSources.forEach((data, clipId) => {
  console.log(`  ${clipId}:`, data);
});

// Check mixer routing
state.clips.forEach(clip => {
  const track = state.tracks.find(t => t.id === clip.trackId);
  const channelId = clip.mixerChannelId || track?.mixerChannelId;
  console.log(`Clip "${clip.name}" → ${channelId}`);
});

// Check mixer channels
const audioEngine = state._audioEngine;
console.log('Mixer channels:', audioEngine.mixerChannels.size);
audioEngine.mixerChannels.forEach((channel, id) => {
  console.log(`  ${id}: ${channel.name}`);
});

// Manually schedule a clip
const clip = state.clips[0];
const currentTime = audioEngine.audioContext.currentTime;
state._scheduleAudioClip(clip, currentTime, 60 / state.bpm);
```

---

## 🚨 Known Issues & Solutions

### Issue 1: Audio Pops/Clicks During Playback

**Cause:** Audio sources starting/stopping abruptly

**Solution:** Add short fade in/out envelopes
```javascript
gainNode.gain.setValueAtTime(0, startTime);
gainNode.gain.linearRampToValueAtTime(targetGain, startTime + 0.003); // 3ms attack
gainNode.gain.setValueAtTime(targetGain, endTime - 0.010);
gainNode.gain.linearRampToValueAtTime(0, endTime); // 10ms release
```

### Issue 2: Scheduling Drift Over Time

**Cause:** Imprecise scheduling with lookahead

**Solution:** Use precise audio context timing
```javascript
// Schedule based on audio context time, not Date.now()
const scheduleTime = audioContext.currentTime + lookAheadSeconds;
source.start(scheduleTime, offset, duration);
```

### Issue 3: Memory Leak from Undisposed Sources

**Cause:** Sources not disconnecting after playback

**Solution:** Always use `onended` callback
```javascript
source.onended = () => {
  gainNode.disconnect();
  source.disconnect();
  activeAudioSources.delete(clipId);
};
```

### Issue 4: Mixer Channel Not Found

**Cause:** Mixer channel deleted while clip is playing

**Solution:** Graceful fallback to master channel
```javascript
let mixerChannel = audioEngine.mixerChannels.get(mixerChannelId);
if (!mixerChannel) {
  console.warn(`Channel ${mixerChannelId} not found, using master`);
  mixerChannel = audioEngine.masterChannel;
}
```

---

## 📚 Related Files

### Files to Modify
1. `client/src/store/useArrangementV2Store.js` - Add playback methods
2. `client/src/lib/audio/AudioAssetManager.js` - Reference in store
3. `client/src/features/arrangement_v2/ArrangementPanelV2.jsx` - Import audioAssetManager

### Reference Implementation
Look at existing audio playback in:
- `client/src/lib/audio/AudioEngine.js` - Instrument playback
- `client/src/store/usePlaybackStore.js` - Pattern playback
- `client/src/lib/core/TimelineController.js` - Transport sync

---

## 🎯 Implementation Priority

| Priority | Task | Effort | Impact | Status |
|----------|------|--------|--------|--------|
| 🔴 P0 | Basic audio clip scheduling | 4-6 hours | Critical | **TODO** |
| 🔴 P0 | Mixer routing integration | 2 hours | Critical | **TODO** |
| 🟡 P1 | Transport sync (play/stop) | 2 hours | High | TODO |
| 🟡 P1 | Multiple clip playback | 1 hour | High | TODO |
| 🟢 P2 | Fade in/out implementation | 2 hours | Medium | Future |
| 🟢 P2 | Real-time routing change | 3 hours | Medium | Future |
| ⚪ P3 | Loop playback support | 2 hours | Low | Future |
| ⚪ P3 | Performance optimization | 4 hours | Low | Future |

---

## ✅ Acceptance Criteria

**Definition of Done:**
- [ ] Audio clips play audio when transport is playing
- [ ] Clips respect `mixerChannelId` routing
- [ ] Clips with `mixerChannelId: null` use track's channel (inherited)
- [ ] Clips with specific `mixerChannelId` use that channel
- [ ] Mixer effects apply to routed clips
- [ ] Multiple clips play simultaneously
- [ ] Audio stops when transport stops
- [ ] No audio pops/clicks during playback
- [ ] No memory leaks (sources disposed properly)
- [ ] Console logging for debugging
- [ ] Performance: 60fps maintained with 10+ clips

---

## 🎵 Example Usage (After Implementation)

```javascript
// User workflow:
1. Drag audio file to arrangement → creates audio clip
2. Double-click clip → opens Sample Editor
3. Select "Bass" mixer channel → clip.mixerChannelId = 'bass-channel'
4. Close Sample Editor
5. Press play (spacebar)
6. 🎵 Audio plays through Bass channel with its effects!

// Under the hood:
ArrangementV2Store.play()
  → scheduleAudioClips(currentBeat, currentBeat + 4)
    → _scheduleAudioClip(clip, audioContextTime, secondsPerBeat)
      → source = createBufferSource(webAudioBuffer)
      → gainNode.connect(mixerChannel.input)
      → source.start(audioContextTime)
      → 🎵 Audio plays with mixer effects!
```

---

**Next Steps:**
1. Implement `scheduleAudioClips` method
2. Hook into transport manager events
3. Test with single clip playback
4. Test with mixer routing
5. Test with multiple clips
6. Add fade in/out envelopes
7. Performance testing

---

**Document Version:** 1.0
**Last Updated:** 2025-10-12
**Owner:** Development Team
**Status:** 🟡 Planning Complete - Implementation Required
