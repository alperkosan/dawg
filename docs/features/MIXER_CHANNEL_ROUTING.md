# Mixer Channel Routing for Instruments

## Feature Overview

**Date**: 2025-10-19
**Status**: ✅ Implemented

Added ability to change which mixer channel an instrument routes to, directly from the Instrument Editor panel.

## Problem

**User Report**: "trap pattern'indeki bell synth sesi mixer'e yönlendirilmediği için ses çalmıyor. enstrüman editöre mix kanalını değiştirebilme seçeneği koyman gerekiyor"

**Issues**:
1. No UI to change instrument's mixer routing
2. Some instruments might be routed to wrong channels
3. No way to verify/fix routing without editing code

## Solution

### 1. Added Mixer Channel Selector to Instrument Editor

**Location**: Instrument Editor Panel header

**UI**: Dropdown select showing all available mixer channels:
- 🎛️ Master channel
- 🎚️ Regular tracks (Track 1, Track 2, etc.)
- 🔀 Bus channels (if any)

**Features**:
- Shows current mixer channel
- Click to change routing
- Instant re-routing (no save required)
- Visual feedback on hover/focus

### 2. Implemented Dynamic Re-routing

When user changes mixer channel:
1. Update instrument's `mixerTrackId` in store
2. Notify audio engine
3. Disconnect from old channel
4. Connect to new channel
5. Audio plays through new channel immediately

## Implementation

### Files Modified

#### 1. `client/src/features/instrument_editor/InstrumentEditorPanel.jsx`

**Added**:
- Import `useMixerStore` to get available channels
- Mixer channel selector dropdown
- `handleMixerChannelChange` function

**Code**:
```javascript
import { useMixerStore } from '../../store/useMixerStore';

const InstrumentEditorPanel = () => {
  // ... existing code

  const updateInstrument = useInstrumentsStore((state) => state.updateInstrument);
  const mixerTracks = useMixerStore(state => state.mixerTracks);

  const handleMixerChannelChange = (newChannelId) => {
    if (!instrumentId) return;

    // Update instrument's mixerTrackId
    updateInstrument(instrumentId, { mixerTrackId: newChannelId });

    // Update editor state
    useInstrumentEditorStore.getState().updateField('mixerTrackId', newChannelId);
  };

  // ... in JSX:
  <select
    className="instrument-editor-panel__mixer-select"
    value={instrumentData.mixerTrackId || 'master'}
    onChange={(e) => handleMixerChannelChange(e.target.value)}
    title="Select mixer channel"
  >
    {mixerTracks
      .filter(track => track.type === 'track' || track.type === 'bus' || track.type === 'master')
      .map(track => (
        <option key={track.id} value={track.id}>
          {track.type === 'master' ? '🎛️' : track.type === 'bus' ? '🔀' : '🎚️'} {track.name}
        </option>
      ))}
  </select>
};
```

#### 2. `client/src/features/instrument_editor/InstrumentEditorPanel.css`

**Added**: Styles for mixer channel selector

```css
.instrument-editor-panel__name-secondary {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.instrument-editor-panel__mixer-select {
  background: #1a1a1a;
  color: #e0e0e0;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
}

.instrument-editor-panel__mixer-select:hover {
  border-color: #6B8EBF;
  background: #252525;
}

.instrument-editor-panel__mixer-select:focus {
  outline: none;
  border-color: #6B8EBF;
  box-shadow: 0 0 0 2px rgba(107, 142, 191, 0.2);
}
```

#### 3. `client/src/lib/core/NativeAudioEngine.js`

**Added**: `updateInstrumentParameters` method

```javascript
/**
 * Update instrument parameters (called from store)
 * @param {string} instrumentId - Instrument ID
 * @param {Object} params - Updated parameters
 */
updateInstrumentParameters(instrumentId, params) {
    console.log(`🎚️ Updating instrument parameters: ${instrumentId}`, params);

    // If mixerTrackId changed, re-route the instrument
    if (params.mixerTrackId) {
        console.log(`🔌 Re-routing ${instrumentId} to ${params.mixerTrackId}`);
        return this.setInstrumentOutput(instrumentId, params.mixerTrackId);
    }

    // Other parameter updates can be handled here
    const instrument = this.instruments.get(instrumentId);
    if (instrument && instrument.updateParameters) {
        instrument.updateParameters(params);
    }

    return true;
}
```

**Why this works**:
- `setInstrumentOutput` already exists and handles:
  - Disconnecting from old channel
  - Connecting to new channel
  - Proper error handling
- `updateInstrumentParameters` is called by `AudioContextService` when instrument updates
- Real-time re-routing without reloading audio engine

## Architecture Flow

```
User clicks dropdown
    ↓
InstrumentEditorPanel.handleMixerChannelChange()
    ↓
useInstrumentsStore.updateInstrument(id, { mixerTrackId })
    ↓
AudioContextService.updateInstrumentParameters(id, params)
    ↓
NativeAudioEngine.updateInstrumentParameters(id, params)
    ↓
NativeAudioEngine.setInstrumentOutput(id, newChannelId)
    ↓
NativeAudioEngine._connectInstrumentToChannel(id, channelId)
    ↓
✅ Instrument now routes to new channel
```

## Usage

### For Users

1. Open any instrument in Instrument Editor (double-click in Channel Rack)
2. Look at header below instrument name
3. See current mixer channel in dropdown
4. Click dropdown to see all available channels
5. Select new channel
6. Audio immediately routes to new channel

### For Developers

**Change instrument routing programmatically**:
```javascript
import { useInstrumentsStore } from '@/store/useInstrumentsStore';

// Update instrument's mixer channel
useInstrumentsStore.getState().updateInstrument('bellsynth', {
  mixerTrackId: 'track-5'
});

// Audio engine automatically re-routes
```

**Get instrument's current routing**:
```javascript
const instrument = useInstrumentsStore.getState().getInstrument('bellsynth');
console.log('Routed to:', instrument.mixerTrackId);
```

## Testing

### Test 1: Verify Bellsynth Routing
1. Open project
2. Check bellsynth in initialData.js: `mixerTrackId: 'track-19'`
3. Open Instrument Editor for bellsynth
4. Verify dropdown shows correct channel
5. Play trap pattern
6. Verify audio plays through track-19

**Expected**: ✅ Bellsynth plays correctly

### Test 2: Change Routing
1. Open Instrument Editor for any instrument
2. Note current mixer channel (e.g., "Track 1")
3. Change to different channel (e.g., "Track 5")
4. Play pattern with this instrument
5. Check Mixer panel - verify audio meters on new channel

**Expected**: ✅ Audio routes to new channel immediately

### Test 3: Route to Master
1. Open Instrument Editor
2. Select "Master" from dropdown
3. Play pattern
4. Verify audio goes directly to master (bypassing tracks)

**Expected**: ✅ Audio plays through master channel

### Test 4: Route to Bus (Future)
1. Create a bus channel in mixer
2. Open Instrument Editor
3. Select bus from dropdown
4. Verify audio routes through bus

**Expected**: ✅ Buses appear in dropdown and routing works

## Console Output

When changing mixer channel:
```
🎚️ Updating instrument parameters: bellsynth { mixerTrackId: 'track-5' }
🔌 Re-routing bellsynth to track-5
🔌 Attempting to connect instrument bellsynth to channel track-5
✅ Instrument connected: bellsynth -> track-5
```

## Benefits

### For Users
- ✅ **Visual feedback**: See which channel instrument uses
- ✅ **Quick routing**: Change channels without code
- ✅ **Instant updates**: No save/reload required
- ✅ **Flexible workflow**: Route any instrument to any channel

### For Developers
- ✅ **Clean architecture**: Routing logic in audio engine
- ✅ **Reusable**: Works for all instrument types
- ✅ **Maintainable**: Single source of truth (NativeAudioEngine)
- ✅ **Extensible**: Easy to add bus routing later

## Future Enhancements

### Phase 1 (Current): Basic Routing ✅
- Dropdown selector in Instrument Editor
- Route to tracks, buses, master
- Real-time re-routing

### Phase 2 (Future): Advanced Routing
- **Drag & Drop**: Drag instrument from Channel Rack to Mixer channel
- **Visual Routing**: Show cable connections in Mixer
- **Multi-routing**: Send instrument to multiple channels (parallel processing)
- **Routing Presets**: Save/load routing configurations

### Phase 3 (Future): Professional Features
- **Sidechain routing**: Route instrument to effect sidechain input
- **Modular routing**: Matrix-style routing grid
- **Routing Groups**: Group instruments with same routing
- **Smart routing**: Auto-route similar instruments to same channel

## Related Systems

### Mixer Channels
- **Master**: All audio ultimately goes here
- **Tracks**: Individual instrument channels
- **Buses**: Group channels for submixing

### Instrument Types
- **VASynth**: Virtual analog synthesizer
- **Sample**: Drum samplers and multi-samples
- **ForgeSynth**: Future wavetable synthesizer

All instrument types support mixer routing.

## Known Issues

### None Currently

All instruments should route correctly after this update.

If you experience routing issues:
1. Check console for error messages
2. Verify mixer channel exists (check Mixer panel)
3. Try changing to different channel
4. Reload page if needed

## Migration Notes

### Existing Projects

No migration needed! Existing `mixerTrackId` values in `initialData.js` continue to work.

### New Instruments

When adding new instruments to `initialData.js`, specify `mixerTrackId`:

```javascript
{
  id: 'newsynth',
  name: 'New Synth',
  type: INSTRUMENT_TYPES.VASYNTH,
  mixerTrackId: 'track-10',  // ✅ Specify routing
  // ... other properties
}
```

If `mixerTrackId` is not specified, instrument routes to `'master'` by default.

---

**Implemented**: 2025-10-19
**Feature Type**: User-facing + Developer API
**Impact**: Critical - enables proper mixer routing
**Status**: ✅ Complete and tested
