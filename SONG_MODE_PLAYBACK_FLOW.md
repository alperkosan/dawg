# 🎵 SONG MODE PLAYBACK FLOW - Detaylı İşlem Şeması

## 📋 Genel Bakış

Song mode, arrangement timeline'daki clip'leri sırayla çalma modudur. Her clip bir pattern veya audio sample referansı içerir ve timeline'da belirli bir pozisyonda (beat cinsinden) başlar.

---

## 🔄 1. MODE SWITCHING (Pattern → Song)

### Kullanıcı Aksiyonu
```
PlaybackControls → "Song" button click
```

### İşlem Akışı
```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PlaybackControls.jsx (Line 168)                              │
│    onClick={() => setPlaybackMode(PLAYBACK_MODES.SONG)}         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. usePlaybackStoreV2.js::setPlaybackMode() (Line 179)          │
│    - Stop current playback if playing                           │
│    - Call playbackManager.setPlaybackMode('song')               │
│    - Update store state: playbackMode = 'song'                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PlaybackManager.js::setPlaybackMode() (Line 338)             │
│    - Set this.currentMode = 'song'                              │
│    - Call _updateLoopSettings()                                 │
│    - If playing: reschedule content for new mode                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. PlaybackManager.js::_updateLoopSettings() (Line 380)         │
│    - Call _calculateSongLoop()                                  │
│    - Update transport loop points                               │
└─────────────────────────────────────────────────────────────────┘
```

### Kod Referansları
- **PlaybackControls**: `client/src/components/playback/PlaybackControls.jsx:168`
- **setPlaybackMode (Store)**: `client/src/store/usePlaybackStoreV2.js:179-211`
- **setPlaybackMode (Manager)**: `client/src/lib/core/PlaybackManager.js:338-349`

---

## ▶️ 2. PLAY BUTTON PRESS (Song Mode'da)

### Kullanıcı Aksiyonu
```
PlaybackControls → Play/Pause button click (Song mode aktif)
```

### İşlem Akışı
```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User clicks Play button                                      │
│    → togglePlayPause() called                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. PlaybackManager::play() (Line 478)                           │
│    ┌───────────────────────────────────────────────────────┐   │
│    │ a. Check if already playing                            │   │
│    │ b. Get start time from AudioContext                    │   │
│    │ c. Set currentPosition = 0 (or loop start)             │   │
│    │ d. Sync transport position                             │   │
│    │ e. Update loop settings                                │   │
│    │ f. Schedule content → _scheduleContent()               │   │
│    │ g. Start transport                                     │   │
│    │ h. Set isPlaying = true                                │   │
│    └───────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PlaybackManager::_scheduleContent() (Line 701)               │
│    ┌───────────────────────────────────────────────────────┐   │
│    │ • Check currentMode                                    │   │
│    │ • If mode === 'song':                                  │   │
│    │   → Call _scheduleSongContent(baseTime)               │   │
│    │ • If mode === 'pattern':                               │   │
│    │   → Call _schedulePatternContent(baseTime)            │   │
│    └───────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. PlaybackManager::_scheduleSongContent() (Line 764)           │
│    ┌───────────────────────────────────────────────────────┐   │
│    │ STEP 1: Get arrangement data                           │   │
│    │   - workspaceStore.getActiveArrangement()             │   │
│    │   - Extract clips, tracks, patterns                   │   │
│    │                                                         │   │
│    │ STEP 2: Check track mute/solo states                  │   │
│    │   - Filter clips by track mute                        │   │
│    │   - Apply solo logic                                  │   │
│    │                                                         │   │
│    │ STEP 3: Iterate through clips                         │   │
│    │   For each clip:                                       │   │
│    │     if (clip.type === 'audio'):                       │   │
│    │       → _scheduleAudioClip(clip, baseTime)           │   │
│    │     else: // pattern clip                             │   │
│    │       → Schedule pattern notes with offset            │   │
│    └───────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Pattern Clip Scheduling (Line 812-852)                       │
│    ┌───────────────────────────────────────────────────────┐   │
│    │ a. Get pattern from patterns[clip.patternId]          │   │
│    │ b. Calculate clip timing:                              │   │
│    │    - clipStartStep = clip.startTime * 4               │   │
│    │    - clipDurationSteps = clip.duration * 4            │   │
│    │                                                         │   │
│    │ c. For each instrument in pattern.data:               │   │
│    │    - Filter notes within clip duration                │   │
│    │    - Offset note times: note.time + clipStartStep    │   │
│    │    - Call _scheduleInstrumentNotes()                 │   │
│    └───────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. PlaybackManager::_scheduleInstrumentNotes() (Line 1027)      │
│    ┌───────────────────────────────────────────────────────┐   │
│    │ For each note:                                         │   │
│    │   a. Calculate absolute time:                          │   │
│    │      time = baseTime + (note.time * stepDuration)     │   │
│    │                                                         │   │
│    │   b. Check if within loop bounds                       │   │
│    │                                                         │   │
│    │   c. Schedule to Web Audio API:                        │   │
│    │      instrument.playNote({                            │   │
│    │        note: note.note,                               │   │
│    │        velocity: note.velocity,                       │   │
│    │        time: absoluteTime,                            │   │
│    │        duration: note.duration                        │   │
│    │      })                                               │   │
│    └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎹 3. NOTE SCHEDULING DETAILS

### Timing Calculation

```javascript
// STEP 1: Clip timing
const clipStartStep = Math.floor((clip.startTime || 0) * 4);  // beats → steps
const clipDurationSteps = (clip.duration || 4) * 4;           // beats → steps

// STEP 2: Note offset
const offsetNote = {
  ...note,
  time: (note.time || 0) + clipStartStep  // Add clip start offset
};

// STEP 3: Absolute time (Web Audio)
const stepDuration = this.transport.stepsToSeconds(1);
const absoluteTime = baseTime + (offsetNote.time * stepDuration);
```

### Example Timeline

```
Timeline (beats):  0────4────8────12───16
                   │    │    │    │    │
Clip 1 (Pattern A) [████████]           (startTime: 0, duration: 8)
Clip 2 (Pattern B)         [████████]   (startTime: 8, duration: 8)

Pattern A Notes:   [0, 4, 8, 12]  → Scheduled at: [0, 4, 8, 12] steps
Pattern B Notes:   [0, 4, 8, 12]  → Scheduled at: [32, 36, 40, 44] steps
                                                    (offset by 32 = 8 beats * 4)
```

---

## 🔁 4. LOOP RESTART

### Trigger
Transport reaches loop end → `_handleLoopRestart()` called

### İşlem Akışı
```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PlaybackManager::_handleLoopRestart() (Line 275)             │
│    - Reset currentPosition = 0                                  │
│    - Sync transport position to 0                               │
│    - Clear scheduled events                                     │
│    - Re-schedule content from loop start                        │
└─────────────────────────────────────────────────────────────────┘
```

**Sonuç**: Song mode'da loop sürekli tekrarlanır, her iterasyonda clip'ler yeniden schedule edilir.

---

## 🎛️ 5. TRACK MUTE/SOLO LOGIC

### Mute Kontrolü
```javascript
// Track muted ise clip'i skip et
if (track.muted) {
  return;  // Skip this clip
}
```

### Solo Kontrolü
```javascript
const soloTracks = tracks.filter(t => t.solo);
const hasSolo = soloTracks.length > 0;

// Eğer solo track varsa, sadece solo track'leri çal
if (hasSolo && !track.solo) {
  return;  // Skip this clip (not on solo track)
}
```

---

## 🎵 6. AUDIO CLIP SCHEDULING (vs Pattern Clip)

### Pattern Clip
- Pattern ID referansı içerir
- Pattern içindeki notalar instrument'lara schedule edilir
- Her note ayrı ayrı trigger edilir

### Audio Clip
- Audio asset ID referansı içerir
- AudioBufferSourceNode olarak schedule edilir
- Tek bir audio buffer playback olarak çalınır

```javascript
if (clip.type === 'audio') {
  this._scheduleAudioClip(clip, baseTime);
} else {
  // Pattern clip scheduling
  this._schedulePatternClip(clip, baseTime);
}
```

---

## 📊 7. DATA FLOW DIAGRAM

```
┌──────────────────┐
│  User Interface  │
│  (Play Button)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  usePlaybackStoreV2                  │
│  - togglePlayPause()                 │
│  - setPlaybackMode('song')           │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  PlaybackManager                     │
│  - play()                            │
│  - _scheduleContent()                │
│  - _scheduleSongContent()            │
└────────┬─────────────────────────────┘
         │
         ├──────────────────┬────────────────────┐
         │                  │                    │
         ▼                  ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Arrangement    │  │ Arrangement    │  │ Pattern        │
│ Workspace      │  │ Store          │  │ Store          │
│ Store          │  │ (Tracks)       │  │ (Patterns)     │
│ (Clips)        │  │                │  │                │
└────────┬───────┘  └────────┬───────┘  └────────┬───────┘
         │                   │                    │
         └───────────────────┴────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │  _scheduleInstrument│
                    │  Notes()            │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │  Web Audio API     │
                    │  - Instrument.     │
                    │    playNote()      │
                    └────────────────────┘
```

---

## ✅ 8. VALIDATION CHECKLIST

### Song Mode Activation
- [x] Mode switch stops current playback
- [x] PlaybackManager.currentMode set to 'song'
- [x] Loop settings updated (song length calculation)
- [x] Store state synchronized

### Playback Start
- [x] Current position reset to 0
- [x] Transport synced with position
- [x] Content scheduled via _scheduleSongContent()
- [x] Transport started

### Content Scheduling
- [x] Active arrangement retrieved
- [x] Clips filtered by track mute/solo
- [x] Pattern clips → notes scheduled with offset
- [x] Audio clips → buffer sources scheduled
- [x] Notes within loop bounds

### Timing Accuracy
- [x] Clip startTime (beats) → steps conversion (×4)
- [x] Clip duration (beats) → steps conversion (×4)
- [x] Note offset: note.time + clipStartStep
- [x] Absolute time: baseTime + (step × stepDuration)
- [x] currentPosition uses accurate this.currentPosition (not lagged transport.currentTick)

### Loop Behavior
- [x] Loop restart clears old events
- [x] Content re-scheduled on loop
- [x] Position reset to 0 on loop

---

## 🐛 9. KNOWN ISSUES & FIXES

### ✅ FIXED: Direct Mode Assignment
**Problem**: `playbackManager.currentMode = mode` (Line 198)
**Impact**: Loop settings and scheduling not triggered
**Fix**: Use `playbackManager.setPlaybackMode(mode)`
**Location**: `client/src/store/usePlaybackStoreV2.js:198`

### ✅ FIXED: Timeline Re-registration Spam
**Problem**: `useEffect([engine])` causing 1000+ logs/sec
**Impact**: Performance degradation, console spam
**Fix**: `useEffect([])` with scope-based engine access
**Location**:
- `client/src/features/arrangement_workspace/ArrangementCanvas.jsx:154`
- `client/src/features/piano_roll_v7/PianoRoll.jsx:151`

### ✅ FIXED: Off-by-One Timing
**Problem**: Using `transport.currentTick` (lagged) for scheduling
**Impact**: Notes scheduled 1 step late
**Fix**: Use `this.currentPosition` for accurate scheduling
**Location**: `client/src/lib/core/PlaybackManager.js:1058`

### ✅ FIXED: 50% Note Loss on Jump
**Problem**: Fire-and-forget pause causing race condition
**Impact**: Notes not scheduled reliably
**Fix**: `await playbackManager.pause()` before jump
**Location**: `client/src/lib/core/TimelineController.js:395`

---

## 🎯 10. PERFORMANCE OPTIMIZATIONS

### Scheduling Optimizer
- Debounced scheduling to prevent excessive calculations
- Force mode for critical operations (play, loop restart)
- Request batching for non-critical updates

### Memory Management
- Scheduled events cleared on loop restart
- Active audio sources tracked and cleaned up
- Position tracker with efficient sync

### UI Update Strategy
- UIUpdateManager for high-frequency playhead updates
- Optimistic UI updates (0ms latency)
- Throttled motor position sync

---

## 📝 SUMMARY

Song mode playback akışı **5 ana aşamadan** oluşur:

1. **Mode Switch**: Pattern → Song geçişi, loop settings update
2. **Play Start**: Position reset, content scheduling, transport start
3. **Content Schedule**: Clips → Pattern notes → Web Audio scheduling
4. **Loop Restart**: Event clear, re-schedule, position reset
5. **Track Control**: Mute/solo filtering, clip skip logic

Tüm sistem **sample-accurate timing** ile çalışır ve **Web Audio API** üzerinden notalar schedule edilir.
