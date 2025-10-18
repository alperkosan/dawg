# 🎚️ Mixer Send/Insert System - FL Studio Inspired Design

**Date**: 2025-10-17
**Status**: 📝 DESIGN PHASE
**Reference**: FL Studio Mixer Routing

---

## Current Problems

### ❌ Existing Toolbar Issues
1. **Redundant Title**: "Mixer" yazıyor ama window title'da zaten yazdı
2. **Non-functional Buttons**: Insert, Send Matrix butonları çalışmıyor
3. **Wasted Space**: Toolbar boş alan kaplayıp işlevsiz
4. **No Jack Routing**: Visual routing sistemi yok

### ❌ Missing Features
1. **Send Routing**: Kanallar arası send yok
2. **Insert Chains**: Channel'lar arası insert bağlantısı yok
3. **Visual Feedback**: Hangi kanal nereye bağlı görünmüyor
4. **Quick Access**: Send/Insert seviyelerine hızlı erişim yok

---

## New Design: FL Studio Jack System

### 🎯 Design Philosophy

**FL Studio'nun güçlü yönleri**:
- **Jack Routing**: Her kanalın altında mini jack bar
- **Visual Clarity**: Bir bakışta tüm routing görülebilir
- **Quick Editing**: Jack üzerine click → route selection
- **Color Coding**: Farklı renklerle routing tipleri

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  MIXER WINDOW                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [Compact Toolbar]                                         │  │
│  │ • View Mode Toggle (Mixer/FX/Sends)                       │  │
│  │ • Master Volume Meter                                     │  │
│  │ • Preset Load/Save                                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              CHANNEL STRIPS AREA                         │   │
│  │  ┌────────┬────────┬────────┬────────┬────────┐         │   │
│  │  │ Track1 │ Track2 │ Track3 │ Bus1   │ Master │  ←──┐   │   │
│  │  │        │        │        │        │        │     │   │   │
│  │  │ [Peak] │ [Peak] │ [Peak] │ [Peak] │ [Peak] │     │   │   │
│  │  │        │        │        │        │        │     │   │   │
│  │  │ [Fader]│ [Fader]│ [Fader]│ [Fader]│ [Fader]│     │   │   │
│  │  │        │        │        │        │        │     │   │   │
│  │  │ [Pan]  │ [Pan]  │ [Pan]  │ [Pan]  │        │     │   │   │
│  │  │        │        │        │        │        │     │   │   │
│  │  │ ┌────┐ │ ┌────┐ │ ┌────┐ │ ┌────┐ │        │     │   │   │
│  │  │ │SEND│ │ │SEND│ │ │SEND│ │ │SEND│ │        │     │   │   │
│  │  │ │Mini│ │ │Mini│ │ │Mini│ │ │Mini│ │        │     │   │   │
│  │  │ │Bar │ │ │Bar │ │ │Bar │ │ │Bar │ │        │     │   │   │
│  │  │ └────┘ │ └────┘ │ └────┘ │ └────┘ │        │     │   │   │
│  │  │        │        │        │        │        │     │   │   │
│  │  │ ╔════╗ │ ╔════╗ │ ╔════╗ │ ╔════╗ │        │     │   │   │
│  │  │ ║JACK║ │ ║JACK║ │ ║JACK║ │ ║JACK║ │        │ ←── │   │   │
│  │  │ ║BAR ║ │ ║BAR ║ │ ║BAR ║ │ ║BAR ║ │        │  JACK│   │
│  │  │ ╚════╝ │ ╚════╝ │ ╚════╝ │ ╚════╝ │        │  BARS│   │
│  │  │  🔌🔌  │  🔌🔌  │  🔌🔌  │  🔌🔌  │        │     │   │   │
│  │  │        │        │        │        │        │     │   │   │
│  │  │ Kick   │ Snare  │ HiHat  │ Reverb │ Master │     │   │   │
│  │  └────────┴────────┴────────┴────────┴────────┘     │   │   │
│  └─────────────────────────────────────────────────────┘   │   │
│                                                              │   │
│  [When track selected → Right panel shows detailed routing] │   │
│  ┌──────────────────────────────────────────────────────┐   │   │
│  │  ROUTING PANEL (Right Side)                          │   │   │
│  │  ┌────────────────────────────────────────────────┐  │   │   │
│  │  │ Selected: Track 1 (Kick)                       │  │   │   │
│  │  ├────────────────────────────────────────────────┤  │   │   │
│  │  │ ▸ SEND DESTINATIONS                            │  │   │   │
│  │  │   ┌──────────────────────────────────────┐     │  │   │   │
│  │  │   │ → Bus 1 (Reverb)    [▓▓▓▓▓░░░] 60%  │     │  │   │   │
│  │  │   │ → Bus 2 (Delay)     [▓▓░░░░░░] 30%  │     │  │   │   │
│  │  │   └──────────────────────────────────────┘     │  │   │   │
│  │  │                                                 │  │   │   │
│  │  │ ▸ INSERT CHAINS                                │  │   │   │
│  │  │   ┌──────────────────────────────────────┐     │  │   │   │
│  │  │   │ Input → Track 1 → Track 3 → Master   │     │  │   │   │
│  │  │   │         ↓                            │     │  │   │   │
│  │  │   │      Track 5                         │     │  │   │   │
│  │  │   └──────────────────────────────────────┘     │  │   │   │
│  │  │                                                 │  │   │   │
│  │  │ ▸ EFFECTS RACK                                 │  │   │   │
│  │  │   (Existing effect list)                       │  │   │   │
│  │  └────────────────────────────────────────────────┘  │   │   │
│  └──────────────────────────────────────────────────────┘   │   │
└──────────────────────────────────────────────────────────────┘   │
```

---

## Component Breakdown

### 1. Compact Toolbar (Yeni Tasarım)

```jsx
<div className="mixer-toolbar">
  {/* View Mode Toggle */}
  <div className="mixer-toolbar__view-modes">
    <button className={viewMode === 'mixer' ? 'active' : ''}>
      <Sliders size={14} />
      Mixer
    </button>
    <button className={viewMode === 'fx' ? 'active' : ''}>
      <Zap size={14} />
      FX
    </button>
    <button className={viewMode === 'sends' ? 'active' : ''}>
      <Route size={14} />
      Sends
    </button>
  </div>

  {/* Master Volume Meter */}
  <div className="mixer-toolbar__master-meter">
    <span className="label">Master</span>
    <VUMeter value={masterLevel} />
    <span className="value">{masterLevel.toFixed(1)} dB</span>
  </div>

  {/* Preset Management */}
  <div className="mixer-toolbar__presets">
    <button><FolderOpen size={14} /> Load</button>
    <button><Save size={14} /> Save</button>
  </div>

  {/* Right Panel Toggle */}
  <button
    className="mixer-toolbar__panel-toggle"
    onClick={() => setShowRightPanel(!showRightPanel)}
  >
    <ChevronRight size={16} />
  </button>
</div>
```

**Özellikler**:
- ✅ No redundant "Mixer" title
- ✅ Functional view modes
- ✅ Master level always visible
- ✅ Preset load/save quick access

---

### 2. Jack Bar Component (FL Studio Style)

```jsx
const JackBar = ({ track, allTracks }) => {
  const [showRouteMenu, setShowRouteMenu] = useState(false);
  const { addSendRoute, addInsertRoute } = useMixerStore();

  return (
    <div className="jack-bar">
      {/* Send Jacks */}
      <div className="jack-bar__sends">
        <div
          className="jack-bar__label"
          onMouseEnter={() => setShowRouteMenu('sends')}
        >
          <ArrowUpRight size={10} />
          SENDS
        </div>
        <div className="jack-bar__plugs">
          {track.sends?.map(send => (
            <div
              key={send.busId}
              className="jack-plug jack-plug--active jack-plug--send"
              style={{
                backgroundColor: allTracks.find(t => t.id === send.busId)?.color,
                width: `${send.level * 100}%`
              }}
              title={`Send to ${allTracks.find(t => t.id === send.busId)?.name}`}
            />
          ))}
          {/* Empty jack slots */}
          <div className="jack-plug jack-plug--empty" />
          <div className="jack-plug jack-plug--empty" />
        </div>
      </div>

      {/* Insert Jack (Output routing) */}
      <div className="jack-bar__insert">
        <div
          className="jack-bar__label"
          onMouseEnter={() => setShowRouteMenu('insert')}
        >
          <Link2 size={10} />
          OUT
        </div>
        <div className="jack-bar__plug-single">
          <div
            className={`jack-plug jack-plug--insert ${track.output ? 'jack-plug--active' : 'jack-plug--empty'}`}
            style={{
              backgroundColor: track.output
                ? allTracks.find(t => t.id === track.output)?.color
                : undefined
            }}
            title={track.output
              ? `Routed to ${allTracks.find(t => t.id === track.output)?.name}`
              : 'Click to route'
            }
          />
        </div>
      </div>

      {/* Route Menu Popup */}
      {showRouteMenu && (
        <div className="jack-bar__route-menu">
          <div className="jack-bar__route-menu-header">
            {showRouteMenu === 'sends' ? 'Add Send To:' : 'Route Output To:'}
          </div>
          {allTracks
            .filter(t => t.type === 'bus' || t.type === 'master')
            .map(bus => (
              <button
                key={bus.id}
                className="jack-bar__route-option"
                onClick={() => {
                  if (showRouteMenu === 'sends') {
                    addSendRoute(track.id, bus.id, 0.5);
                  } else {
                    addInsertRoute(track.id, bus.id);
                  }
                  setShowRouteMenu(false);
                }}
              >
                <div
                  className="jack-bar__route-color"
                  style={{ backgroundColor: bus.color }}
                />
                {bus.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
```

**Visual Design**:
```css
.jack-bar {
  width: 100%;
  background: var(--zenith-bg-tertiary);
  border-radius: 4px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  border: 1px solid var(--zenith-border-subtle);
}

.jack-bar__label {
  font-size: 9px;
  font-weight: 600;
  color: var(--zenith-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  transition: color 0.15s;
}

.jack-bar__label:hover {
  color: var(--zenith-accent);
}

.jack-bar__plugs {
  display: flex;
  gap: 2px;
  height: 16px;
}

.jack-plug {
  flex: 1;
  border-radius: 2px;
  transition: all 0.2s;
  cursor: pointer;
  position: relative;
}

.jack-plug--empty {
  background: var(--zenith-bg-secondary);
  border: 1px dashed var(--zenith-border-subtle);
}

.jack-plug--empty:hover {
  border-color: var(--zenith-accent);
  border-style: solid;
}

.jack-plug--active {
  box-shadow: 0 0 4px currentColor;
  border: 1px solid currentColor;
}

.jack-plug--send {
  /* Width represents send level */
  min-width: 12px;
}

.jack-plug--insert {
  /* Single jack for output routing */
  width: 100%;
  height: 16px;
}

/* Route Menu */
.jack-bar__route-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  background: var(--zenith-bg-elevated);
  border: 1px solid var(--zenith-border-medium);
  border-radius: 6px;
  padding: 8px;
  box-shadow: var(--zenith-shadow-lg);
  z-index: 1000;
  min-width: 150px;
  margin-bottom: 4px;
}

.jack-bar__route-menu-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--zenith-text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.jack-bar__route-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--zenith-text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.jack-bar__route-option:hover {
  background: var(--zenith-bg-secondary);
}

.jack-bar__route-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}
```

---

### 3. Send Mini Bar (Above Jack Bar)

```jsx
const SendMiniBar = ({ track, allTracks }) => {
  const { updateSendLevel } = useMixerStore();

  return (
    <div className="send-mini-bar">
      {track.sends?.map(send => {
        const busTrack = allTracks.find(t => t.id === send.busId);
        return (
          <div key={send.busId} className="send-mini-bar__item">
            <div
              className="send-mini-bar__indicator"
              style={{
                backgroundColor: busTrack?.color,
                height: `${send.level * 100}%`
              }}
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={send.level}
              onChange={(e) => updateSendLevel(track.id, send.busId, parseFloat(e.target.value))}
              className="send-mini-bar__slider"
              title={`${busTrack?.name}: ${Math.round(send.level * 100)}%`}
            />
          </div>
        );
      })}
    </div>
  );
};
```

**Visual**:
```css
.send-mini-bar {
  display: flex;
  gap: 4px;
  height: 32px;
  padding: 4px;
  background: var(--zenith-bg-secondary);
  border-radius: 4px;
  margin-bottom: 4px;
}

.send-mini-bar__item {
  flex: 1;
  position: relative;
  min-width: 20px;
}

.send-mini-bar__indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 2px;
  pointer-events: none;
  transition: height 0.15s;
}

.send-mini-bar__slider {
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.send-mini-bar__slider:hover + .send-mini-bar__indicator {
  box-shadow: 0 0 6px currentColor;
}
```

---

### 4. Right Panel - Detailed Routing

```jsx
const RoutingPanel = ({ track, allTracks }) => {
  const [expandedSection, setExpandedSection] = useState('sends');

  return (
    <div className="routing-panel">
      {/* Header */}
      <div className="routing-panel__header">
        <div
          className="routing-panel__color"
          style={{ backgroundColor: track.color }}
        />
        <div className="routing-panel__info">
          <h3>{track.name}</h3>
          <span className="routing-panel__type">{track.type}</span>
        </div>
      </div>

      {/* Send Section */}
      <div className="routing-panel__section">
        <button
          className="routing-panel__section-header"
          onClick={() => setExpandedSection(expandedSection === 'sends' ? null : 'sends')}
        >
          <ChevronDown
            size={14}
            style={{
              transform: expandedSection === 'sends' ? 'rotate(0deg)' : 'rotate(-90deg)'
            }}
          />
          <ArrowUpRight size={14} />
          SEND DESTINATIONS
          <span className="routing-panel__badge">{track.sends?.length || 0}</span>
        </button>

        {expandedSection === 'sends' && (
          <div className="routing-panel__section-content">
            {track.sends?.map(send => {
              const busTrack = allTracks.find(t => t.id === send.busId);
              return (
                <div key={send.busId} className="routing-panel__send-item">
                  <div className="routing-panel__send-header">
                    <div
                      className="routing-panel__send-color"
                      style={{ backgroundColor: busTrack?.color }}
                    />
                    <span className="routing-panel__send-name">{busTrack?.name}</span>
                    <button
                      className="routing-panel__send-remove"
                      onClick={() => removeSend(track.id, send.busId)}
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="routing-panel__send-controls">
                    {/* Level Slider */}
                    <div className="routing-panel__control">
                      <label>Level</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={send.level}
                        onChange={(e) => updateSendLevel(track.id, send.busId, parseFloat(e.target.value))}
                      />
                      <span className="routing-panel__control-value">
                        {Math.round(send.level * 100)}%
                      </span>
                    </div>

                    {/* Pre/Post Fader Toggle */}
                    <div className="routing-panel__control">
                      <label>Mode</label>
                      <div className="routing-panel__toggle-group">
                        <button
                          className={!send.preFader ? 'active' : ''}
                          onClick={() => updateSendMode(track.id, send.busId, false)}
                        >
                          Post
                        </button>
                        <button
                          className={send.preFader ? 'active' : ''}
                          onClick={() => updateSendMode(track.id, send.busId, true)}
                        >
                          Pre
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Visual Route Line */}
                  <div className="routing-panel__route-line">
                    <div className="routing-panel__route-dot" />
                    <div
                      className="routing-panel__route-arrow"
                      style={{ width: `${send.level * 100}%` }}
                    />
                    <div className="routing-panel__route-dot" />
                  </div>
                </div>
              );
            })}

            {/* Add Send Button */}
            <button className="routing-panel__add-send">
              <Plus size={14} />
              Add Send
            </button>
          </div>
        )}
      </div>

      {/* Insert Chain Section */}
      <div className="routing-panel__section">
        <button
          className="routing-panel__section-header"
          onClick={() => setExpandedSection(expandedSection === 'insert' ? null : 'insert')}
        >
          <ChevronDown
            size={14}
            style={{
              transform: expandedSection === 'insert' ? 'rotate(0deg)' : 'rotate(-90deg)'
            }}
          />
          <Link2 size={14} />
          INSERT CHAIN
        </button>

        {expandedSection === 'insert' && (
          <div className="routing-panel__section-content">
            <div className="routing-panel__insert-chain">
              {/* Visual chain */}
              <div className="routing-panel__chain-node">
                <Disc size={16} />
                <span>Input</span>
              </div>
              <div className="routing-panel__chain-arrow">↓</div>
              <div className="routing-panel__chain-node active">
                <div
                  className="routing-panel__chain-color"
                  style={{ backgroundColor: track.color }}
                />
                <span>{track.name}</span>
              </div>
              {track.insertChain?.map((insertId, index) => {
                const insertTrack = allTracks.find(t => t.id === insertId);
                return (
                  <React.Fragment key={insertId}>
                    <div className="routing-panel__chain-arrow">↓</div>
                    <div className="routing-panel__chain-node">
                      <div
                        className="routing-panel__chain-color"
                        style={{ backgroundColor: insertTrack?.color }}
                      />
                      <span>{insertTrack?.name}</span>
                      <button
                        className="routing-panel__chain-remove"
                        onClick={() => removeInsert(track.id, index)}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </React.Fragment>
                );
              })}
              <div className="routing-panel__chain-arrow">↓</div>
              <div className="routing-panel__chain-node">
                <Volume2 size={16} />
                <span>{track.output || 'Master'}</span>
              </div>
            </div>

            {/* Add Insert Button */}
            <button className="routing-panel__add-insert">
              <Plus size={14} />
              Insert Track
            </button>
          </div>
        )}
      </div>

      {/* Effects Rack Section */}
      <div className="routing-panel__section">
        <button
          className="routing-panel__section-header"
          onClick={() => setExpandedSection(expandedSection === 'effects' ? null : 'effects')}
        >
          <ChevronDown
            size={14}
            style={{
              transform: expandedSection === 'effects' ? 'rotate(0deg)' : 'rotate(-90deg)'
            }}
          />
          <Zap size={14} />
          EFFECTS RACK
          <span className="routing-panel__badge">{track.insertEffects?.length || 0}</span>
        </button>

        {expandedSection === 'effects' && (
          <div className="routing-panel__section-content">
            <EffectsRack track={track} />
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## Implementation Priority

### Phase 1: Jack Bar System (2-3 hours)
1. ✅ Create JackBar component
2. ✅ Add to MixerChannel
3. ✅ Implement route menu popup
4. ✅ Visual feedback for connections

### Phase 2: Send System (2-3 hours)
1. ✅ Add send state to useMixerStore
2. ✅ Implement send audio routing in NativeAudioEngine
3. ✅ SendMiniBar component
4. ✅ Pre/Post fader toggle

### Phase 3: Insert System (2-3 hours)
1. ✅ Add insert chain state
2. ✅ Implement insert routing in audio engine
3. ✅ Visual chain display in RoutingPanel
4. ✅ Drag-to-reorder insert chain

### Phase 4: Routing Panel (2 hours)
1. ✅ Replace old effects-only panel
2. ✅ Tabbed sections (Sends/Inserts/Effects)
3. ✅ Detailed controls
4. ✅ Visual route lines

### Phase 5: Toolbar Redesign (1 hour)
1. ✅ Remove redundant "Mixer" title
2. ✅ View mode toggle
3. ✅ Master meter
4. ✅ Preset management

---

## Visual Examples

### Jack Bar States

**Empty (No routing)**:
```
┌──────────────────────┐
│ ↗ SENDS              │
│ [░][░][░][░]         │
│                      │
│ 🔗 OUT               │
│ [░]                  │
└──────────────────────┘
```

**With Sends** (2 active sends):
```
┌──────────────────────┐
│ ↗ SENDS              │
│ [█][█][░][░]         │
│  ▓  ▓                │ (colored by bus)
│                      │
│ 🔗 OUT               │
│ [█] → Master         │
└──────────────────────┘
```

**Hover State** (route menu):
```
┌──────────────────────────┐
│ Add Send To:             │
├──────────────────────────┤
│ [█] Bus 1 (Reverb)       │
│ [█] Bus 2 (Delay)        │
│ [█] Master               │
└──────────────────────────┘
      ▼
┌──────────────────────┐
│ ↗ SENDS              │
│ [░][░][░][░]         │
└──────────────────────┘
```

---

## User Interaction Flow

### Send Creation
1. **Hover** over "SENDS" label in jack bar
2. **Route menu** appears above
3. **Click** bus to send to
4. **Jack lights up** with bus color
5. **Send level** defaults to 50%
6. **Mini bar** appears for quick level adjustment

### Insert Routing
1. **Hover** over "OUT" jack
2. **Route menu** shows available tracks
3. **Click** track to insert
4. **Jack shows** connection color
5. **Audio routes** through selected track
6. **Chain visible** in routing panel

### Quick Level Adjustment
1. **Hover** over send mini bar
2. **Drag** to adjust level
3. **Visual feedback** (bar height)
4. **Audio updates** in real-time

---

## Success Criteria

### Visual
- ✅ Jack bar visible on all channels
- ✅ Color-coded routing connections
- ✅ Hover states clear and responsive
- ✅ Route menu intuitive

### Functional
- ✅ Send routing works (audio flows correctly)
- ✅ Insert routing works (signal chain correct)
- ✅ Pre/Post fader modes work
- ✅ Level adjustments smooth (no clicks)

### Performance
- ✅ 60fps jack bar animations
- ✅ <50ms audio routing update
- ✅ No glitches during route changes

---

## Next Steps

1. **Review this design** - Feedback önemli!
2. **Create JackBar component** - Önce visual mockup
3. **Implement send routing** - Audio engine first
4. **Add insert system** - Signal chain manipulation
5. **Redesign toolbar** - Remove clutter

**Başlayalım mı?** 🚀
