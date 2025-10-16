# 🎵 Audio Clip Shared Editing & Make Unique Design

**Date:** 2025-10-12
**Status:** 🟡 Design Phase
**Priority:** High - UX Critical

---

## 📊 Problem Statement

### Current Behavior (Problematic)
```
Audio File: "kick.wav"
    ↓ Drag to arrangement 3 times
    ↓
Clip 1: mixerChannelId = null
Clip 2: mixerChannelId = null
Clip 3: mixerChannelId = null

User opens Sample Editor for Clip 1:
  - Selects "Bass" mixer channel
  - Result: ONLY Clip 1 → Bass ❌

User has to:
  - Open Sample Editor for Clip 2 → Select Bass
  - Open Sample Editor for Clip 3 → Select Bass
  - Repetitive and tedious! ❌
```

### Desired Behavior (Non-Destructive Editing)
```
Audio File: "kick.wav"
    ↓ Creates AudioAsset (shared)
    ↓
AudioAsset: {
  id: "asset-kick-wav"
  mixerChannelId: "bass-channel"  ← Shared setting
  precomputed: { normalize: true } ← Shared setting
}
    ↓ Referenced by multiple clips
    ↓
Clip 1: { assetId, mixerChannelId: null } → inherits from asset
Clip 2: { assetId, mixerChannelId: null } → inherits from asset
Clip 3: { assetId, mixerChannelId: null } → inherits from asset

User opens Sample Editor for ANY clip:
  - Selects "Bass" mixer channel
  - Result: ALL 3 clips → Bass ✅

User wants Clip 3 to be different:
  - Right-click Clip 3 → "Make Unique"
  - Clip 3 becomes independent
  - Now Clip 3 can have its own routing ✅
```

---

## 🎯 Solution Architecture

### 1. Data Model: Asset-Based Inheritance

```javascript
// AudioAssetManager enhancement
class AudioAssetManager {
  assets = new Map(); // assetId → asset data

  // NEW: Asset metadata (shared across clips)
  assetMetadata = new Map(); // assetId → metadata
}

// Asset Metadata Structure
const assetMetadata = {
  assetId: "asset-kick-wav",

  // Shared settings (affect all clips referencing this asset)
  mixerChannelId: "bass-channel",

  // Shared precomputed settings
  precomputed: {
    normalize: false,
    reverse: false,
    reversePolarity: false
  },

  // Reference count (for cleanup)
  refCount: 3 // 3 clips using this asset
};

// Audio Clip Structure (enhanced)
const audioClip = {
  id: "clip-abc123",
  type: "audio",
  assetId: "asset-kick-wav", // ← Reference to shared asset

  // Clip-specific settings (always individual)
  trackId: "track-1",
  startTime: 0,
  duration: 4,
  sampleOffset: 0,
  playbackRate: 1.0,
  fadeIn: 0,
  fadeOut: 0,
  gain: 0,

  // NEW: Unique flag
  isUnique: false, // false = inherit from asset, true = independent

  // NEW: Unique metadata (only used if isUnique = true)
  uniqueMetadata: null // { mixerChannelId, precomputed }
};
```

### 2. Inheritance Logic

```javascript
// Get effective mixer channel for a clip
function getEffectiveMixerChannel(clip) {
  if (clip.isUnique && clip.uniqueMetadata?.mixerChannelId) {
    return clip.uniqueMetadata.mixerChannelId; // Unique routing
  }

  const assetMeta = audioAssetManager.getAssetMetadata(clip.assetId);
  return assetMeta?.mixerChannelId || null; // Inherited or null
}

// Get effective precomputed settings
function getEffectivePrecomputed(clip) {
  if (clip.isUnique && clip.uniqueMetadata?.precomputed) {
    return clip.uniqueMetadata.precomputed; // Unique settings
  }

  const assetMeta = audioAssetManager.getAssetMetadata(clip.assetId);
  return assetMeta?.precomputed || {}; // Inherited or default
}
```

---

## 🔧 Implementation Plan

### Phase 1: Asset Metadata System

#### Step 1.1: Extend AudioAssetManager

**File:** `client/src/lib/audio/AudioAssetManager.js`

```javascript
class AudioAssetManager {
  constructor() {
    this.assets = new Map();
    this.assetMetadata = new Map(); // NEW
  }

  // NEW: Get or create asset metadata
  getAssetMetadata(assetId) {
    if (!this.assetMetadata.has(assetId)) {
      this.assetMetadata.set(assetId, {
        assetId,
        mixerChannelId: null,
        precomputed: {
          normalize: false,
          reverse: false,
          reversePolarity: false
        },
        refCount: 0
      });
    }
    return this.assetMetadata.get(assetId);
  }

  // NEW: Update asset metadata
  updateAssetMetadata(assetId, updates) {
    const metadata = this.getAssetMetadata(assetId);
    Object.assign(metadata, updates);
    console.log('📝 Updated asset metadata:', assetId, updates);
  }

  // NEW: Increment reference count
  addAssetReference(assetId) {
    const metadata = this.getAssetMetadata(assetId);
    metadata.refCount++;
  }

  // NEW: Decrement reference count
  removeAssetReference(assetId) {
    const metadata = this.getAssetMetadata(assetId);
    metadata.refCount = Math.max(0, metadata.refCount - 1);

    // Cleanup if no references
    if (metadata.refCount === 0) {
      this.assetMetadata.delete(assetId);
      console.log('🗑️ Removed unused asset metadata:', assetId);
    }
  }
}
```

#### Step 1.2: Update Clip Creation

**File:** `client/src/store/useArrangementV2Store.js`

```javascript
const createAudioClip = (trackId, startTime, assetId, duration, name) => {
  // Increment asset reference count
  if (assetId) {
    audioAssetManager.addAssetReference(assetId);
  }

  return {
    id: `clip-${nanoid(8)}`,
    type: 'audio',
    trackId,
    startTime,
    duration,
    assetId,
    sampleOffset: 0,
    playbackRate: 1.0,
    fadeIn: 0,
    fadeOut: 0,
    gain: 0,
    name: name || 'Audio Clip',
    color: '#8b5cf6',
    muted: false,
    locked: false,

    // NEW: Unique flag (default: shared)
    isUnique: false,
    uniqueMetadata: null
  };
};

// Update removeClip to decrement refCount
removeClip: (clipId) => {
  const clip = get().clips.find(c => c.id === clipId);

  if (clip?.assetId) {
    audioAssetManager.removeAssetReference(clip.assetId);
  }

  set({ clips: get().clips.filter(c => c.id !== clipId) });
  get().pushHistory({ type: 'REMOVE_CLIP', clip });
}
```

### Phase 2: Sample Editor Integration

#### Step 2.1: Update AudioClipControls for Shared Editing

**File:** `client/src/features/sample_editor_v3/SampleEditorV3.jsx`

```javascript
const AudioClipControls = ({ editorClipData }) => {
  const clips = useArrangementV2Store(state => state.clips);
  const updateClip = useArrangementV2Store(state => state.updateClip);

  // Get live clip
  const liveClip = clips.find(c => c.id === editorClipData.clipId);

  // Determine if this is shared or unique
  const isUnique = liveClip?.isUnique;

  // Get all sibling clips (same asset, not unique)
  const siblingClips = clips.filter(c =>
    c.assetId === editorClipData.assetId &&
    !c.isUnique &&
    c.type === 'audio'
  );

  const siblingCount = siblingClips.length;

  // Get effective mixer channel
  const effectiveMixerChannel = isUnique
    ? (liveClip.uniqueMetadata?.mixerChannelId || 'inherit')
    : (audioAssetManager.getAssetMetadata(editorClipData.assetId)?.mixerChannelId || 'inherit');

  const handleMixerChannelChange = (newChannelId) => {
    if (isUnique) {
      // Update only this clip's unique metadata
      updateClip(editorClipData.clipId, {
        uniqueMetadata: {
          ...liveClip.uniqueMetadata,
          mixerChannelId: newChannelId || null
        }
      });
      console.log('🎛️ Updated UNIQUE clip mixer channel:', newChannelId);
    } else {
      // Update asset metadata (affects all sibling clips)
      audioAssetManager.updateAssetMetadata(editorClipData.assetId, {
        mixerChannelId: newChannelId || null
      });
      console.log(`🎛️ Updated SHARED asset mixer channel (${siblingCount} clips):`, newChannelId);

      // Force re-render by updating all sibling clips (trigger state change)
      siblingClips.forEach(clip => {
        updateClip(clip.id, {}); // Empty update to trigger re-render
      });
    }
  };

  const handleMakeUnique = () => {
    // Copy current asset metadata to clip's unique metadata
    const assetMeta = audioAssetManager.getAssetMetadata(editorClipData.assetId);

    updateClip(editorClipData.clipId, {
      isUnique: true,
      uniqueMetadata: {
        mixerChannelId: assetMeta.mixerChannelId,
        precomputed: { ...assetMeta.precomputed }
      }
    });

    console.log('✂️ Made clip unique:', editorClipData.clipId);
  };

  const handleMakeShared = () => {
    updateClip(editorClipData.clipId, {
      isUnique: false,
      uniqueMetadata: null
    });

    console.log('🔗 Made clip shared:', editorClipData.clipId);
  };

  return (
    <div className="audio-clip-controls">
      {/* Shared/Unique Status Banner */}
      <div style={{
        padding: '8px 12px',
        background: isUnique ? 'rgba(251, 146, 60, 0.1)' : 'rgba(34, 197, 94, 0.1)',
        borderRadius: '6px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: '12px' }}>
          {isUnique ? (
            <>
              <span style={{ color: '#fb923c' }}>✂️ Unique Clip</span>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                Changes affect only this clip
              </div>
            </>
          ) : (
            <>
              <span style={{ color: '#22c55e' }}>🔗 Shared ({siblingCount} clips)</span>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                Changes affect all {siblingCount} clips using this audio
              </div>
            </>
          )}
        </div>

        <button
          onClick={isUnique ? handleMakeShared : handleMakeUnique}
          style={{
            padding: '4px 12px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            color: 'white',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          {isUnique ? '🔗 Make Shared' : '✂️ Make Unique'}
        </button>
      </div>

      {/* Rest of controls... */}
      <div className="font-bold mb-3 text-gray-300">{editorClipData.name}</div>

      {/* Mixer Channel Selector */}
      <div className="mt-4">
        <label className="block text-xs text-gray-400 mb-2">
          Mixer Channel Routing
          {!isUnique && <span style={{ color: '#22c55e', marginLeft: '8px' }}>({siblingCount} clips)</span>}
        </label>
        <select
          value={effectiveMixerChannel}
          onChange={(e) => handleMixerChannelChange(e.target.value === 'inherit' ? null : e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: 'white',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          <option value="inherit">🔗 Inherit from Track</option>
          {mixerTracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
```

### Phase 3: Context Menu Integration

#### Step 3.1: Add "Make Unique" to Clip Context Menu

**File:** `client/src/features/arrangement_v2/components/ClipContextMenu.jsx`

```javascript
<ContextMenuItem
  icon={<Scissors size={14} />}
  label="Make Unique"
  onClick={() => {
    selectedClipIds.forEach(clipId => {
      const clip = clips.find(c => c.id === clipId);
      if (clip && clip.type === 'audio' && !clip.isUnique) {
        // Copy asset metadata to clip
        const assetMeta = audioAssetManager.getAssetMetadata(clip.assetId);

        updateClip(clipId, {
          isUnique: true,
          uniqueMetadata: {
            mixerChannelId: assetMeta.mixerChannelId,
            precomputed: { ...assetMeta.precomputed }
          }
        });
      }
    });
    onClose();
  }}
  disabled={!selectedClips.some(c => c.type === 'audio' && !c.isUnique)}
/>

<ContextMenuItem
  icon={<Link size={14} />}
  label="Make Shared"
  onClick={() => {
    selectedClipIds.forEach(clipId => {
      updateClip(clipId, {
        isUnique: false,
        uniqueMetadata: null
      });
    });
    onClose();
  }}
  disabled={!selectedClips.some(c => c.type === 'audio' && c.isUnique)}
/>
```

### Phase 4: Playback Integration

#### Step 4.1: Update PlaybackManager to Use Inheritance

**File:** `client/src/lib/core/PlaybackManager.js`

```javascript
_playAudioBuffer(audioBuffer, time, clip = {}, resumeOffset = 0) {
  // ... existing code

  // ✅ Use inheritance logic for mixer routing
  let mixerChannelId;

  if (clip.isUnique && clip.uniqueMetadata?.mixerChannelId) {
    // Unique clip: use its own routing
    mixerChannelId = clip.uniqueMetadata.mixerChannelId;
  } else if (clip.assetId) {
    // Shared clip: use asset routing
    const assetMeta = audioAssetManager.getAssetMetadata(clip.assetId);
    mixerChannelId = assetMeta?.mixerChannelId;
  }

  // Fallback to track routing
  if (!mixerChannelId && clip.trackId) {
    mixerChannelId = `arr-${clip.trackId}`;
  }

  const mixerChannel = this.audioEngine.mixerChannels.get(mixerChannelId);

  if (mixerChannel && mixerChannel.input) {
    destination = mixerChannel.input;
    console.log('🎵 ✅ Routing:', mixerChannelId, clip.isUnique ? '(unique)' : '(shared)');
  }

  // ... rest of code
}
```

---

## 🎨 User Experience Flow

### Workflow 1: Default Shared Editing

```
1. User drags "kick.wav" to arrangement 3 times
   → Creates 3 clips, all referencing same asset
   → All clips share mixer routing (default: inherit)

2. User double-clicks Clip 2
   → Sample Editor opens
   → Shows: "🔗 Shared (3 clips)"
   → User selects "Bass" mixer channel
   → All 3 clips now route to Bass ✅

3. User plays arrangement
   → All 3 kicks play through Bass channel
   → Bass channel's effects apply to all 3 ✅
```

### Workflow 2: Make Unique for Independence

```
1. User has 3 kick clips (all shared, routed to Bass)

2. User wants Clip 3 to be different:
   - Right-click Clip 3 → "Make Unique"
   - OR: Open Sample Editor → Click "✂️ Make Unique"

3. Clip 3 becomes independent:
   - Status changes to "✂️ Unique Clip"
   - Inherits current settings as starting point
   - Changes to Clip 3 no longer affect Clip 1 & 2

4. User changes Clip 3's mixer channel to "Drums"
   → Only Clip 3 routes to Drums
   → Clip 1 & 2 still route to Bass ✅
```

### Workflow 3: Revert to Shared

```
1. User has made Clip 3 unique
2. User decides they want it shared again
3. Click "🔗 Make Shared" in Sample Editor
4. Clip 3 rejoins the shared group
5. Changes to any sibling affect all again ✅
```

---

## 🧪 Testing Plan

### Test Case 1: Shared Editing

```
Setup:
- Drag "kick.wav" to arrangement 3 times
- Clips: A, B, C (all shared)

Steps:
1. Open Sample Editor for Clip A
2. Verify: "🔗 Shared (3 clips)"
3. Select "Bass" mixer channel
4. Close Sample Editor
5. Open Sample Editor for Clip B
6. Verify: Mixer channel shows "Bass"
7. Open Sample Editor for Clip C
8. Verify: Mixer channel shows "Bass"

Expected:
✅ All 3 clips show Bass channel
✅ Changing one affects all
```

### Test Case 2: Make Unique

```
Setup:
- 3 kick clips, all routed to Bass (shared)

Steps:
1. Right-click Clip C → "Make Unique"
2. Verify: Clip C status = "✂️ Unique Clip"
3. Change Clip C mixer channel to "Drums"
4. Open Sample Editor for Clip A
5. Verify: Still shows "Bass" (not affected)

Expected:
✅ Clip A & B: Bass (shared)
✅ Clip C: Drums (unique)
```

### Test Case 3: Playback Routing

```
Setup:
- Clip A, B: Bass (shared)
- Clip C: Drums (unique)
- Add reverb to Bass channel
- Add distortion to Drums channel

Steps:
1. Press Play
2. Listen to audio

Expected:
✅ Clip A & B have reverb (Bass effect)
✅ Clip C has distortion (Drums effect)
```

---

## 📊 Benefits

### For Users
✅ **Efficiency**: Edit once, apply to all similar clips
✅ **Flexibility**: Make unique when needed
✅ **Clarity**: Visual indicators (🔗 Shared / ✂️ Unique)
✅ **Undo-friendly**: Can revert unique to shared

### For Developers
✅ **Clean architecture**: Asset-based inheritance
✅ **Memory efficient**: Shared metadata
✅ **Easy to extend**: Add more shared properties later

---

## 🚀 Future Enhancements

### 1. Shared Precomputed Settings
```javascript
// Apply normalize to all instances
assetMetadata.precomputed = {
  normalize: true,
  reverse: false
};
```

### 2. Visual Indicators in Arrangement
```javascript
// Draw indicator on clip
if (!clip.isUnique) {
  // Draw "🔗" badge in corner
  ctx.fillText('🔗', x + width - 20, y + 12);
}
```

### 3. Batch Operations
```javascript
// "Make All Unique" action
selectedClips.forEach(clip => makeUnique(clip));
```

### 4. Asset Library Panel
```javascript
// Show all assets with their clip count
Audio Assets:
  - kick.wav (3 clips) → Bass channel
  - snare.wav (5 clips) → Drums channel
  - hihat.wav (8 clips) → Drums channel
```

---

## ✅ Implementation Checklist

### Phase 1: Core System
- [ ] Add `assetMetadata` Map to AudioAssetManager
- [ ] Implement `getAssetMetadata()`, `updateAssetMetadata()`
- [ ] Add `isUnique`, `uniqueMetadata` to clip structure
- [ ] Update `createAudioClip()` with refCount tracking
- [ ] Update `removeClip()` with refCount cleanup

### Phase 2: Sample Editor
- [ ] Add shared/unique status banner
- [ ] Implement "Make Unique" / "Make Shared" buttons
- [ ] Update mixer channel change handler for inheritance
- [ ] Show sibling count in UI

### Phase 3: Context Menu
- [ ] Add "Make Unique" menu item
- [ ] Add "Make Shared" menu item
- [ ] Enable/disable based on clip state

### Phase 4: Playback
- [ ] Update PlaybackManager routing logic
- [ ] Test shared routing
- [ ] Test unique routing
- [ ] Verify effects apply correctly

### Phase 5: Polish
- [ ] Add visual indicators in arrangement
- [ ] Add keyboard shortcut (Ctrl+U for unique?)
- [ ] Add undo/redo support
- [ ] Add tooltips and help text

---

**Next Step:** Implement Phase 1 (Core System) first, then iteratively add UI features.

**Estimated Time:**
- Phase 1: 2-3 hours
- Phase 2: 2-3 hours
- Phase 3: 1 hour
- Phase 4: 1 hour
- **Total: 6-8 hours**

---

**Document Version:** 1.0
**Last Updated:** 2025-10-12
**Owner:** Development Team
**Status:** 🟡 Design Complete - Ready for Implementation
