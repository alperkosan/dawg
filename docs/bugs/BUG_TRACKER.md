# DAWG Bug Tracker

**Last Updated:** 2025-10-16

## Status Legend
- 🔴 **Critical** - Blocks core functionality
- 🟡 **High** - Significantly impacts UX
- 🟢 **Medium** - Minor inconvenience
- 🔵 **Low** - Enhancement request
- ✅ **Fixed** - Issue resolved
- 🚧 **In Progress** - Currently being worked on

---

## Plugin Bugs

### ✅ VortexPhaser - Audio Engine Crash
- **Status:** Fixed (2025-10-16)
- **Severity:** 🔴 Critical
- **Description:** Adding VortexPhaser killed all audio, even after removal
- **Root Cause:** Missing parameters in EffectFactory + unstable all-pass filter
- **Fix Details:** [VORTEX_PHASER_FIX.md](./VORTEX_PHASER_FIX.md)
- **Files Modified:**
  - `client/src/lib/audio/effects/EffectFactory.js`
  - `client/public/worklets/effects/vortex-phaser-processor.js`

### 🔴 Transient Designer - UI Crash
- **Status:** 🚧 Not Started
- **Severity:** 🔴 Critical
- **Description:** "transient designer arayüzü patlıyor"
- **File:** `client/src/components/effects/TransientDesigner.jsx`
- **Investigation Needed:**
  - Check for React rendering errors
  - Verify canvas initialization
  - Check parameter bounds

### 🟡 Stardust Chorus - Effect Not Integrated
- **Status:** 🚧 Not Started
- **Severity:** 🟡 High
- **Description:** "stardust chorus canvası var, efekt entegre değil sanırım"
- **Files:**
  - `client/public/worklets/effects/stardust-chorus-processor.js` (exists)
  - Check if registered in EffectRegistry
  - Check if listed in EffectFactory

### 🟡 Arcade Crusher - Performance Issue at 16-bit
- **Status:** 🚧 Not Started
- **Severity:** 🟡 High
- **Description:** "arcade crusher, 16 bit depth seçildiğinde çok kasıyor. canvas rendering i problemli sanırım"
- **File:** `client/src/components/effects/ArcadeCrusher.jsx`
- **Investigation Needed:**
  - Profile canvas rendering performance
  - Check bit depth calculation efficiency
  - Consider debouncing visualization updates

### 🟢 Orbit Panner - Confusing Stereo Position Slider
- **Status:** 🚧 Not Started
- **Severity:** 🟢 Medium
- **Description:** "orbit panner, stereo position slider'ı anlamsız"
- **File:** `client/src/components/effects/OrbitPanner.jsx`
- **Investigation Needed:**
  - Review parameter mapping
  - Check if label/range is misleading
  - Consider UX improvements

---

## Mixer Bugs

### ✅ Master Channel Routing
- **Status:** Fixed (2025-10-16)
- **Severity:** 🔴 Critical
- **Description:**
  - Master channel not routing properly
  - Effects on master don't affect all tracks
  - Bus channels need to be visible and active
- **Root Cause:** Tracks bypassed master channel and connected directly to masterMixer worklet
- **Fix Details:** [MASTER_CHANNEL_ROUTING_FIX.md](./MASTER_CHANNEL_ROUTING_FIX.md)
- **Files Modified:**
  - `client/src/lib/core/NativeAudioEngine.js:548-566`
- **Result:** All tracks now route through master channel, enabling full mastering workflow

### ✅ Send/Insert System
- **Status:** Fixed (2025-10-17)
- **Severity:** 🟡 High
- **Description:**
  - Implemented FL Studio-inspired jack bar system
  - Visual send routing with color-coded plugs
  - Insert routing for serial signal chains
  - Complete audio engine integration
- **Implementation:**
  - JackBar component with hover menus
  - Store actions (addSend, removeSend, updateSendLevel, setTrackOutput)
  - Audio engine routing (createSend, removeSend, updateSendLevel, setTrackOutput)
  - NativeMixerChannel send management
- **Fix Details:** [SEND_INSERT_ROUTING.md](../features/SEND_INSERT_ROUTING.md)
- **Files Modified:**
  - `client/src/store/useMixerStore.js`
  - `client/src/lib/core/NativeAudioEngine.js`
  - `client/src/features/mixer/components/JackBar.jsx` (NEW)
  - `client/src/features/mixer/components/JackBar.css` (NEW)
  - `client/src/features/mixer/components/MixerChannel.jsx`

### 🟡 Pan Values Incorrect for Hi-Hat Channels
- **Status:** 🚧 Not Started
- **Severity:** 🟢 Medium
- **Description:** "hihat ve offbeat hat kanallarının pan değerleri bozuk biri L1500 diğeri R1000 gösteriyor"
- **File:** Check initial data/preset loading
- **Investigation:** Review default pan value normalization

### ✅ Effect Chain Ordering
- **Status:** Fixed (2025-10-17)
- **Severity:** 🟡 High
- **Description:** Implemented drag-and-drop effect reordering with @dnd-kit
- **Implementation:**
  - SortableEffectItem component with useSortable hook
  - DndContext and SortableContext in EffectsRack
  - Automatic signal chain rebuild on reorder
  - Visual feedback during drag
- **Fix Details:** [EFFECT_CHAIN_REORDERING.md](../features/EFFECT_CHAIN_REORDERING.md)
- **Files Modified:**
  - `client/src/features/mixer/components/EffectsRack.jsx`
  - `client/src/features/mixer/components/EffectsRack.css`

### 🟢 Missing Channel Features
- **Status:** 🚧 Not Started
- **Severity:** 🟢 Medium
- **Description:**
  - Can't rename channels
  - Can't change channel colors
  - Mute/Solo buttons don't work
  - Output value display incorrect
- **Files:**
  - `client/src/components/mixer/MixerChannel.jsx`
  - `client/src/stores/mixerStore.js`

### 🟢 Fader UX Issues
- **Status:** 🚧 Not Started
- **Severity:** 🟢 Medium
- **Description:** "fader ise çok hassas daha uzun ve daha yavaş hareket edebilir"
- **Requirements:**
  - Longer fader track
  - Smoother movement
  - Gain value input field
  - More realistic fader design

---

## Arrangement Panel Bugs

### 🟡 Theme Integration
- **Status:** 🚧 Not Started
- **Severity:** 🟡 High
- **Description:** "tema yapımızdan ayrı hardcoded csslerle çalışıyor"
- **File:** `client/src/components/arrangement/ArrangementPanel.jsx`
- **Requirements:**
  - Remove hardcoded CSS
  - Integrate with theme system
  - Ensure theme switching updates arrangement

### 🔴 Frozen Patterns Not Visible
- **Status:** 🚧 Not Started
- **Severity:** 🔴 Critical
- **Description:** "freezet pattern ile audio sample export ettiğimde onları göremiyorum kayboluyorlar"
- **Investigation Needed:**
  - Check audio sample storage/listing
  - Verify freeze/bounce workflow
  - Ensure audio clips appear in arrangement

### 🔴 Drag-and-Drop from Channel Rack Broken
- **Status:** 🚧 Not Started
- **Severity:** 🔴 Critical
- **Description:** "channel rack açık iken patterns içinden aranje canvasına sürükle bırak yapamıyorum"
- **File:** `client/src/components/channel_rack/ChannelRack.jsx`
- **Investigation:**
  - Z-index conflicts?
  - Event propagation issues?
  - Panel overlap detection

### 🟡 Quick Delete Mode
- **Status:** 🚧 Not Started
- **Severity:** 🟢 Medium (Enhancement)
- **Description:** Need quick pattern deletion:
  - Double-click + hold empty space = delete mode
  - Drag over patterns to delete
  - Left-click + hold in delete mode = delete on hover
- **Requirements:**
  - Implement delete mode toggle
  - Add visual feedback
  - Bulk deletion support

### 🟡 Waveform Rendering at High Zoom
- **Status:** 🚧 Not Started
- **Severity:** 🟡 High
- **Description:** "belirli zoom seviyesinden sonra waveform tamamen kayboluyor"
- **File:** Audio clip waveform renderer
- **Investigation:**
  - Check zoom level thresholds
  - Review LOD (Level of Detail) implementation
  - Verify render optimization isn't too aggressive

### 🔴 Playhead in Pattern Mode
- **Status:** 🚧 Not Started
- **Severity:** 🟡 High
- **Description:** "playhead pattern modunda iken de hareket ediyor"
- **Requirements:**
  - Playhead should only move in Song mode
  - Pattern mode playhead should be independent

### 🔴 Audio Clip Editing During Playback
- **Status:** 🚧 Not Started
- **Severity:** 🔴 Critical
- **Description:** "audio clip resize/move ettiğimde playhead akmaya devam ediyor fakat tüm sesler releaseAll() yapılıyor"
- **Requirements:**
  - Seamless re-scheduling when clips move
  - No audio dropout during editing
  - Smooth transition to new schedule

---

## Piano Roll Bugs

### 🟡 Mouse Note Input UX
- **Status:** 🚧 Not Started
- **Severity:** 🟡 High
- **Description:** "mouse ile nota yazımı ve silimi çok zor"
- **Requirements:**
  - Left-click + hold = write notes continuously
  - Right-click + hold = delete notes continuously
  - Middle-click = drag/pan
- **File:** `client/src/components/piano_roll/PianoRoll.jsx`

### 🟡 Keyboard Note Input
- **Status:** 🚧 Not Started
- **Severity:** 🟢 Medium (Enhancement)
- **Description:** Need keyboard-based note writing
- **Requirements:**
  - Map computer keyboard keys to piano keys
  - Play notes when keys pressed
  - Write notes at playhead/cursor position
  - MIDI input support (future)

### 🟡 Smart Note Duration
- **Status:** 🚧 Not Started
- **Severity:** 🟡 High
- **Description:** "yazılan her nota aynı duration değeriyle yazılıyor"
- **Requirements:**
  - Remember last note duration
  - Remember last resize operation
  - Use as default for next note

### 🔴 Velocity Editing UX
- **Status:** 🚧 Not Started
- **Severity:** 🔴 Critical (UX)
- **Description:** "velocity değerini mouse ile wheel yaparak değiştiremiyorum"
- **Requirements:**
  - Mouse wheel over note = change velocity
  - No need to select first
  - Visual velocity indicators
  - Velocity automation lanes

### 🟢 Duration Editing with Shift+Wheel
- **Status:** 🚧 Not Started
- **Severity:** 🟢 Medium (Enhancement)
- **Description:** "shift wheel ile selected notaların duration değerini hassas şekilde değiştirebilmeliyim"
- **Requirements:**
  - Shift + wheel = fine-tune duration
  - Apply to selected notes (or hovered note)
  - Show visual feedback

---

## Bug Priority Queue

### Sprint 1: Critical Audio/Mixer Issues
1. ✅ VortexPhaser audio crash - **COMPLETED (2025-10-16)**
2. ✅ Master channel routing - **COMPLETED (2025-10-16)**
3. ✅ Frozen patterns not visible - **COMPLETED (2025-10-16)**
4. ✅ Drag-and-drop from Channel Rack - **COMPLETED (2025-10-17)**
5. ✅ Audio clip editing during playback - **COMPLETED (2025-10-17)**
6. ✅ Waveform rendering at extreme zoom - **COMPLETED (2025-10-17)**
7. ✅ Playhead mode separation - **COMPLETED (2025-10-17)**
8. ✅ Quick delete mode - **COMPLETED (2025-10-17)**

### Sprint 2: High Priority UX Issues (Current)
1. ✅ Transient Designer UI crash - **COMPLETED (2025-10-17)**
2. ✅ Effect chain reordering - **COMPLETED (2025-10-17)**
3. ✅ Send/Insert system - **COMPLETED (2025-10-17)**
4. Piano roll velocity editing
5. Mouse note input UX

### Sprint 3: Medium Priority Improvements
1. Stardust Chorus integration
2. Arcade Crusher performance
3. Smart note duration
4. Theme integration for arrangement panel

### Sprint 4: Low Priority Enhancements
1. Orbit Panner slider clarity
2. Channel naming/coloring
3. Fader UX improvements
4. Quick delete mode
5. Keyboard note input

---

## Testing Checklist

### Audio Engine Tests
- [ ] All plugins load without errors
- [ ] Effects process audio correctly
- [ ] Master channel affects all tracks
- [ ] Send/Return routing works
- [ ] No audio dropouts during editing

### UI/UX Tests
- [ ] All panels work with all themes
- [ ] Drag-and-drop works across panels
- [ ] Mouse interactions are intuitive
- [ ] Keyboard shortcuts work
- [ ] No React rendering errors

### Performance Tests
- [ ] Canvas rendering at 60fps
- [ ] Audio processing stays below 50% CPU
- [ ] No memory leaks during long sessions
- [ ] Waveform rendering at all zoom levels
- [ ] Large projects load quickly

---

## Contributing

When fixing a bug:
1. Update status in this file to 🚧 In Progress
2. Create detailed fix documentation in `docs/bugs/[BUG_NAME]_FIX.md`
3. Update `kullanım notlarım` with ✅ status
4. Mark as ✅ Fixed in this tracker
5. Add testing notes

## Related Files
- User bug reports: `client/kullanım notlarım`
- Architecture docs: `docs/architecture/`
- Performance docs: `docs/performance/`
