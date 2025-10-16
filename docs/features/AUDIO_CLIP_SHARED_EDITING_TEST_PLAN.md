# Audio Clip Shared Editing - Test Plan

## System Status: ✅ IMPLEMENTATION COMPLETE

All core components have been implemented:
- ✅ AudioAssetManager metadata system with reference counting
- ✅ Clip structure with `isUnique` and `uniqueMetadata` flags
- ✅ Sample Editor UI with shared/unique banner and toggle
- ✅ PlaybackManager inheritance-based routing
- ✅ Global audioAssetManager access for PlaybackManager

---

## Test Scenarios

### 1. Basic Shared Editing Flow

**Objective**: Verify that multiple clips from the same audio file share mixer routing settings

**Steps**:
1. Open the arrangement panel
2. Drag an audio file into the arrangement (or create an audio clip)
3. Duplicate the clip 2-3 times (Ctrl+D or copy-paste)
4. Double-click one of the clips to open Sample Editor

**Expected Results**:
- ✅ Sample Editor opens with audio clip visible
- ✅ Banner shows: "🔗 Shared (N clips)" in green
- ✅ Subtitle shows: "Changes affect all N clips using this audio"
- ✅ Mixer channel dropdown shows current routing
- ✅ Helper text indicates: "affects N clips"

---

### 2. Changing Shared Mixer Routing

**Objective**: Verify that changing mixer channel affects all sibling clips

**Steps**:
1. With Sample Editor open for a shared clip
2. Change the mixer channel dropdown to a different channel (e.g., "Drums")
3. Close Sample Editor
4. Double-click a different clip that uses the same audio

**Expected Results**:
- ✅ All clips using this audio now route to the selected mixer channel
- ✅ Console shows: `🎛️ Updating SHARED asset mixer channel (N clips): [channelId]`
- ✅ Second clip's Sample Editor shows the same mixer channel
- ✅ During playback, effects from the selected mixer channel are applied

---

### 3. Make Unique Functionality

**Objective**: Verify that "Make Unique" creates an independent clip

**Steps**:
1. Open Sample Editor for a shared clip
2. Note the current sibling count (e.g., "Shared (3 clips)")
3. Click the "✂️ Make Unique" button
4. Change the mixer channel to a different channel

**Expected Results**:
- ✅ Banner changes to: "✂️ Unique Clip" in orange
- ✅ Subtitle changes to: "Changes affect only this clip"
- ✅ Mixer channel dropdown no longer shows "(affects N clips)"
- ✅ Console shows: `✂️ Made clip unique: [clipId]`
- ✅ Changing mixer channel only affects this clip
- ✅ Other clips remain routed to original channel

---

### 4. Make Shared Functionality

**Objective**: Verify that "Make Shared" reverts a unique clip to shared mode

**Steps**:
1. With a unique clip selected (orange banner)
2. Click the "🔗 Make Shared" button
3. Observe the banner change

**Expected Results**:
- ✅ Banner changes to: "🔗 Shared (N clips)" in green
- ✅ Subtitle shows sibling count
- ✅ Console shows: `🔗 Made clip shared: [clipId]`
- ✅ Mixer channel settings now affect all sibling clips
- ✅ Changes apply to asset metadata (not clip-specific)

---

### 5. Playback with Mixer Effects

**Objective**: Verify that audio clips correctly route through mixer channels during playback

**Steps**:
1. Create multiple audio clips (shared)
2. Assign them to a mixer channel with effects (e.g., reverb, EQ)
3. Start playback in arrangement panel
4. Listen for effects being applied

**Expected Results**:
- ✅ Audio clips play with effects from assigned mixer channel
- ✅ Console shows: `🎛️ Audio clip routed to mixer channel: [channelId] (shared)`
- ✅ Unique clips show: `🎛️ Audio clip routed to mixer channel: [channelId] (unique)`
- ✅ Clips with `inherit` routing show: `🎛️ Audio clip routed to mixer channel: [trackId] (track)`

---

### 6. Reference Counting

**Objective**: Verify that asset metadata is cleaned up when all clips are deleted

**Steps**:
1. Create 3 audio clips from the same audio file
2. Open browser console and run: `window.audioAssetManager.getAssetMetadata('[assetId]').refCount`
3. Delete one clip at a time
4. Check refCount after each deletion

**Expected Results**:
- ✅ Initial refCount: 3
- ✅ After deleting 1 clip: refCount = 2
- ✅ After deleting 2 clips: refCount = 1
- ✅ After deleting all clips: metadata removed entirely
- ✅ Console shows: `🗑️ Removed unused asset metadata: [assetId]`

---

### 7. Multiple Audio Sources

**Objective**: Verify that different audio files have independent metadata

**Steps**:
1. Create 2 clips from audio file A
2. Create 2 clips from audio file B
3. Assign audio A clips to "Drums" mixer channel
4. Assign audio B clips to "Bass" mixer channel
5. Verify each group is independent

**Expected Results**:
- ✅ Audio A clips all route to "Drums"
- ✅ Audio B clips all route to "Bass"
- ✅ Changing audio A routing does NOT affect audio B
- ✅ Each asset has its own metadata entry

---

### 8. Mixed Shared and Unique Clips

**Objective**: Verify that shared and unique clips coexist correctly

**Steps**:
1. Create 4 clips from the same audio file
2. Make 2 of them unique
3. Assign shared clips to "Channel A"
4. Assign unique clips to "Channel B" and "Channel C"
5. Start playback

**Expected Results**:
- ✅ 2 shared clips route to "Channel A"
- ✅ Unique clip 1 routes to "Channel B"
- ✅ Unique clip 2 routes to "Channel C"
- ✅ Sample Editor correctly shows shared/unique status for each
- ✅ sibling count only includes shared clips

---

## Debugging Tools

### Console Commands

Check asset metadata:
```javascript
window.audioAssetManager.getAllAssets()
window.audioAssetManager.getAssetMetadata('asset-id')
```

Check reference counts:
```javascript
// List all assets with refCounts
Array.from(window.audioAssetManager.assetMetadata.entries()).map(([id, meta]) => ({
  id,
  refCount: meta.refCount,
  mixerChannelId: meta.mixerChannelId
}))
```

Check clip structure:
```javascript
// From arrangement store
useArrangementV2Store.getState().clips.filter(c => c.type === 'audio')
```

---

## Known Logs to Expect

### Creating Audio Clips:
```
🔗 Asset reference added: [assetId] (refCount: N)
```

### Changing Shared Mixer Channel:
```
🎛️ Updating SHARED asset mixer channel (N clips): [channelId]
📝 Updated asset metadata: [assetId] { mixerChannelId: [channelId] }
```

### Changing Unique Mixer Channel:
```
🎛️ Updating UNIQUE clip mixer channel: [channelId]
```

### Making Clip Unique:
```
✂️ Made clip unique: [clipId]
```

### Making Clip Shared:
```
🔗 Made clip shared: [clipId]
```

### Deleting Clips:
```
🔗 Asset reference removed: [assetId] (refCount: N)
🗑️ Removed unused asset metadata: [assetId]  // when refCount reaches 0
```

### Playback Routing:
```
🎛️ Audio clip routed to mixer channel: [channelId] (shared|unique|track)
```

---

## Performance Verification

### Expected Behavior:
- ✅ No re-renders when sibling clips are updated (uses empty update trick)
- ✅ Asset metadata changes trigger minimal re-renders
- ✅ Waveform cache is shared across duplicate clips
- ✅ No duplicate audio buffers in memory

### Performance Tests:
1. Create 20 clips from the same audio file
2. Change shared mixer channel
3. Observe that all clips update instantly without lag

---

## Edge Cases to Test

### 1. Empty Sibling List
- Create 1 clip from audio file
- Make it unique
- Verify: sibling count = 0 (no other shared clips exist)

### 2. All Clips Unique
- Create 3 clips from audio file
- Make all 3 unique
- Verify: Each has independent routing, no shared clips

### 3. Switching Between Shared/Unique Multiple Times
- Create clip
- Make unique
- Make shared
- Make unique again
- Verify: Metadata is correctly copied/reset each time

### 4. "Inherit from Track" Option
- Set clip to "inherit from track"
- Verify: `mixerChannelId` is null
- During playback: routes to track's mixer channel

---

## Success Criteria

### Phase 1: Core System ✅
- [x] AudioAssetManager has `assetMetadata` Map
- [x] `getAssetMetadata()` returns or creates metadata
- [x] `updateAssetMetadata()` updates and notifies listeners
- [x] `addAssetReference()` increments refCount
- [x] `removeAssetReference()` decrements refCount and cleans up
- [x] Clip structure has `isUnique` and `uniqueMetadata` fields
- [x] `addClip()` and `removeClip()` call reference counting methods

### Phase 2: Sample Editor UI ✅
- [x] AudioClipControls component displays shared/unique banner
- [x] Green banner for shared clips with sibling count
- [x] Orange banner for unique clips
- [x] "Make Unique" / "Make Shared" toggle button works
- [x] Mixer channel dropdown uses inheritance logic
- [x] Helper text explains affect scope (N clips or single clip)

### Phase 3: Playback Integration ✅
- [x] PlaybackManager checks `clip.isUnique` flag
- [x] Unique clips use `clip.uniqueMetadata.mixerChannelId`
- [x] Shared clips use `audioAssetManager.getAssetMetadata(assetId).mixerChannelId`
- [x] Fallback to track routing if no clip-specific routing
- [x] Console logs show route type (shared/unique/track)

---

## Next Steps (Optional Enhancements)

### Phase 4: Precomputed Effects (Future)
- Extend shared editing to `precomputed` fields (normalize, reverse, reversePolarity)
- Update WaveformWorkbench to apply precomputed effects
- Add visual indicators for precomputed effects in Sample Editor

### Phase 5: Waveform Editing (Future)
- Slice points shared across clips
- Start/end offset shared across clips
- Envelope editing with shared/unique toggle

### Phase 6: Export/Import (Future)
- Include asset metadata in project export
- Restore metadata during project import
- Handle missing assets gracefully

---

## Testing Checklist

Before considering this feature complete, verify:

- [ ] All 8 test scenarios pass
- [ ] No console errors during normal operation
- [ ] Reference counting works correctly (no memory leaks)
- [ ] Playback applies mixer effects to audio clips
- [ ] Sample Editor UI is responsive and intuitive
- [ ] Shared/unique status is visually clear
- [ ] Multiple audio sources remain independent
- [ ] Edge cases are handled gracefully
- [ ] Performance is acceptable with 10+ clips

---

## Troubleshooting

### Issue: Sample Editor doesn't open
**Solution**: Check that `bringPanelToFront()` is called after `togglePanel()`

### Issue: Mixer effects not applied during playback
**Solution**: Verify PlaybackManager routing logic uses inheritance

### Issue: Changing shared mixer channel doesn't affect all clips
**Solution**: Check that `audioAssetManager.updateAssetMetadata()` is called
**Solution**: Verify sibling clips are force re-rendered with `updateClip(clip.id, {})`

### Issue: Reference count doesn't decrease
**Solution**: Verify `removeClip()` calls `audioAssetManager.removeAssetReference()`

### Issue: audioAssetManager is undefined in PlaybackManager
**Solution**: Verify `window.audioAssetManager` is set in AudioAssetManager.js

---

## Implementation Status: COMPLETE ✅

Date Completed: 2025-10-12
Developer: Claude Code
Feature: Audio Clip Shared Editing System
Status: Ready for Testing
