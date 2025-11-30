import React, { useState, useRef, useEffect } from 'react';
import { MousePointer, Edit3, Eraser, Scissors, Music, Zap, Guitar, Shuffle, FlipHorizontal2, Piano, Settings, Sliders, Link2, ChevronDown, Circle } from 'lucide-react';
import { getToolManager, TOOL_TYPES } from '@/lib/piano-roll-tools';
import { SCALES, NOTE_NAMES } from '@/lib/music/ScaleSystem';
import './Toolbar.css';

const regularSnapOptions = {
    "Bar": 16,
    "1/2": 8,
    "1/4 (Beat)": 4,
    "1/8": 2,
    "1/16": 1,
    "1/32": 0.5
};

const tripletSnapOptions = {
    "1/4T": "2.67T", // Triplet quarter
    "1/8T": "1.33T", // Triplet eighth
    "1/16T": "0.67T" // Triplet sixteenth
};

const tools = [
    { id: TOOL_TYPES.SELECT, label: 'Select', icon: MousePointer, hotkey: 'V' },
    { id: TOOL_TYPES.PAINT_BRUSH, label: 'Paint', icon: Edit3, hotkey: 'B' },
    { id: TOOL_TYPES.ERASER, label: 'Eraser', icon: Eraser, hotkey: 'E' },
    { id: TOOL_TYPES.SLIDE, label: 'Slide', icon: Link2, hotkey: 'G' },
    { id: TOOL_TYPES.CHOPPER, label: 'Chopper', icon: Scissors, hotkey: 'C', requiresSelection: true },
    { id: TOOL_TYPES.STRUMIZER, label: 'Strum', icon: Guitar, hotkey: 'S', requiresSelection: true },
    { id: TOOL_TYPES.ARPEGGIATOR, label: 'Arpeggio', icon: Music, hotkey: 'A', requiresSelection: true },
    { id: TOOL_TYPES.FLAM, label: 'Flam', icon: Zap, hotkey: 'F', requiresSelection: true },
    { id: TOOL_TYPES.RANDOMIZER, label: 'Randomize', icon: Shuffle, hotkey: 'R', requiresSelection: true },
    { id: TOOL_TYPES.FLIP, label: 'Flip', icon: FlipHorizontal2, hotkey: 'L', requiresSelection: true }
];

function Toolbar({
    snapValue,
    onSnapChange,
    activeTool = 'select',
    onToolChange,
    zoom = 1.0,
    onZoomChange,
    selectedCount = 0,
    keyboardPianoMode = false,
    onKeyboardPianoModeChange,
    keyboardPianoSettings = { baseOctave: 4, scale: 'chromatic' },
    onKeyboardPianoSettingsChange,
    // ✅ PHASE 2: CC Lanes & Note Properties
    showCCLanes = false,
    onShowCCLanesChange,
    showNoteProperties = false,
    onShowNotePropertiesChange,
    // ✅ IMPROVED: Scale Highlighting - always enabled, but can be changed
    scaleHighlight = null,
    onScaleChange = null,
    // ✅ MIDI Recording
    isRecording = false,
    onRecordToggle = null
}) {
    const [showQuantizeMenu, setShowQuantizeMenu] = useState(false);
    const [showPianoSettings, setShowPianoSettings] = useState(false);
    const [showScaleMenu, setShowScaleMenu] = useState(false);
    const pianoButtonRef = useRef(null);
    const scaleButtonRef = useRef(null);

    // Close dropdowns on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            // Piano settings dropdown
            if (showPianoSettings && pianoButtonRef.current && !pianoButtonRef.current.contains(e.target)) {
                const dropdown = document.querySelector('.prv7-piano-settings-menu');
                if (!dropdown || !dropdown.contains(e.target)) {
                    setShowPianoSettings(false);
                }
            }
            // Scale menu dropdown
            if (showScaleMenu && scaleButtonRef.current && !scaleButtonRef.current.contains(e.target)) {
                const dropdown = document.querySelector('.prv7-scale-menu');
                if (!dropdown || !dropdown.contains(e.target)) {
                    setShowScaleMenu(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPianoSettings, showScaleMenu]);

    return (
        <div className="prv7-toolbar">
            {/* Sol Grup - Sadece Essential Tools */}
            <div className="prv7-toolbar-group">
                <div className="prv7-brand">
                    <span className="prv7-brand-text">Piano Roll</span>
                </div>

                {/* All tools */}
                <div className="prv7-tool-group">
                    {tools.map(tool => {
                        const Icon = tool.icon;
                        const isDisabled = tool.requiresSelection && selectedCount === 0;

                        return (
                            <button
                                key={tool.id}
                                className={`prv7-tool-btn ${activeTool === tool.id ? 'prv7-tool-btn--active' : ''} ${isDisabled ? 'prv7-tool-btn--disabled' : ''}`}
                                onClick={() => {
                                    if (!isDisabled) {
                                        const toolManager = getToolManager();
                                        toolManager.setActiveTool(tool.id);
                                    }
                                }}
                                title={`${tool.label} (Alt+${tool.hotkey})${tool.requiresSelection ? '\nRequires selection' : ''}`}
                                disabled={isDisabled}
                            >
                                <Icon size={18} />
                            </button>
                        );
                    })}
                </div>
            </div>


            {/* Orta Grup - Selection Info */}
            <div className="prv7-toolbar-group prv7-toolbar-center">
                {/* Selection Info */}
                {selectedCount > 0 && (
                    <div className="prv7-selection-info">
                        <span className="prv7-selection-count">
                            {selectedCount} note{selectedCount !== 1 ? 's' : ''} selected
                        </span>
                    </div>
                )}
            </div>

            {/* Sağ Grup - Sadece Essential Settings */}
            <div className="prv7-toolbar-group">
                {/* ✅ MIDI Recording Button */}
                {onRecordToggle && (
                    <button
                        className={`prv7-tool-btn prv7-record-btn ${isRecording ? 'prv7-record-btn--recording' : ''}`}
                        onClick={onRecordToggle}
                        title={`${isRecording ? 'Stop Recording' : 'Start Recording'} (R)`}
                        style={{ marginRight: '8px' }}
                    >
                        <Circle 
                            size={18} 
                            fill={isRecording ? 'currentColor' : 'none'}
                            className={isRecording ? 'prv7-record-pulse' : ''}
                        />
                    </button>
                )}

                {/* ✅ PHASE 2: CC Lanes Toggle */}
                <button
                    className={`prv7-tool-btn ${showCCLanes ? 'prv7-tool-btn--active' : ''}`}
                    onClick={() => onShowCCLanesChange?.(!showCCLanes)}
                    title="Toggle CC Lanes (Automation)"
                    style={{ marginRight: '8px' }}
                >
                    <Sliders size={18} />
                </button>

                {/* ✅ PHASE 2: Note Properties Toggle */}
                <button
                    className={`prv7-tool-btn ${showNoteProperties ? 'prv7-tool-btn--active' : ''}`}
                    onClick={() => onShowNotePropertiesChange?.(!showNoteProperties)}
                    title="Toggle Note Properties Panel"
                    style={{ marginRight: '8px' }}
                >
                    <Settings size={18} />
                </button>

                {/* ✅ IMPROVED: Scale Selector - Compact dropdown */}
                <div style={{ position: 'relative', marginRight: '8px' }}>
                    <button
                        ref={scaleButtonRef}
                        className="prv7-tool-btn"
                        onClick={() => setShowScaleMenu(!showScaleMenu)}
                        title="Change Scale"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            fontWeight: 500
                        }}
                    >
                        {scaleHighlight?.getScaleInfo() ? (
                            <>
                                <span style={{
                                    color: scaleHighlight.getScaleInfo().color,
                                    fontWeight: 600
                                }}>
                                    {scaleHighlight.getScaleInfo().name}
                                </span>
                                <ChevronDown size={14} />
                            </>
                        ) : (
                            <>
                                <span>C Major</span>
                                <ChevronDown size={14} />
                            </>
                        )}
                    </button>

                    {/* Scale Menu Dropdown */}
                    {showScaleMenu && (
                        <div
                            className="prv7-scale-menu"
                            style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                background: 'var(--zenith-bg-primary, #0A0E1A)',
                                border: '1px solid var(--zenith-border-medium, rgba(255, 255, 255, 0.1))',
                                borderRadius: '8px',
                                padding: '8px',
                                minWidth: '280px',
                                maxHeight: '400px',
                                overflowY: 'auto',
                                zIndex: 1000,
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                            }}
                        >
                            {/* Root Note Selection */}
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{
                                    fontSize: '11px',
                                    color: 'var(--zenith-text-secondary, rgba(255, 255, 255, 0.7))',
                                    marginBottom: '6px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Root Note
                                </div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(6, 1fr)',
                                    gap: '4px'
                                }}>
                                    {NOTE_NAMES.map((note, index) => {
                                        const currentScale = scaleHighlight?.getScale();
                                        const isSelected = currentScale?.root === index;
                                        const scaleColor = scaleHighlight?.getScaleInfo()?.color || '#3b82f6';
                                        const colorRgb = scaleColor.replace('#', '').match(/.{1,2}/g)?.map(x => parseInt(x, 16)).join(', ') || '59, 130, 246';
                                        return (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    if (onScaleChange && currentScale) {
                                                        onScaleChange(index, currentScale.scaleType);
                                                        setShowScaleMenu(false);
                                                    }
                                                }}
                                                style={{
                                                    padding: '6px 8px',
                                                    fontSize: '11px',
                                                    background: isSelected
                                                        ? `rgba(${colorRgb}, 0.2)`
                                                        : 'var(--zenith-bg-tertiary, rgba(255, 255, 255, 0.05))',
                                                    border: `1px solid ${isSelected ? scaleColor : 'var(--zenith-border-subtle, rgba(255, 255, 255, 0.08))'}`,
                                                    borderRadius: '4px',
                                                    color: isSelected ? scaleColor : 'var(--zenith-text-primary, #FFFFFF)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                    fontWeight: isSelected ? 600 : 400
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isSelected) {
                                                        e.target.style.background = 'var(--zenith-bg-hover, rgba(255, 255, 255, 0.08))';
                                                        e.target.style.borderColor = 'var(--zenith-border-medium, rgba(255, 255, 255, 0.15))';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isSelected) {
                                                        e.target.style.background = 'var(--zenith-bg-tertiary, rgba(255, 255, 255, 0.05))';
                                                        e.target.style.borderColor = 'var(--zenith-border-subtle, rgba(255, 255, 255, 0.08))';
                                                    }
                                                }}
                                            >
                                                {note}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Scale Type Selection */}
                            <div>
                                <div style={{
                                    fontSize: '11px',
                                    color: 'var(--zenith-text-secondary, rgba(255, 255, 255, 0.7))',
                                    marginBottom: '6px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Scale Type
                                </div>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    maxHeight: '240px',
                                    overflowY: 'auto'
                                }}>
                                    {Object.entries(SCALES).map(([key, scale]) => {
                                        const currentScale = scaleHighlight?.getScale();
                                        const isSelected = currentScale?.scaleType === key;
                                        const scaleColorRgb = scale.color.replace('#', '').match(/.{1,2}/g)?.map(x => parseInt(x, 16)).join(', ') || '59, 130, 246';
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    if (onScaleChange && currentScale) {
                                                        onScaleChange(currentScale.root, key);
                                                        setShowScaleMenu(false);
                                                    }
                                                }}
                                                style={{
                                                    padding: '8px 12px',
                                                    fontSize: '12px',
                                                    textAlign: 'left',
                                                    background: isSelected
                                                        ? `rgba(${scaleColorRgb}, 0.15)`
                                                        : 'var(--zenith-bg-tertiary, rgba(255, 255, 255, 0.05))',
                                                    border: `1px solid ${isSelected ? scale.color : 'var(--zenith-border-subtle, rgba(255, 255, 255, 0.08))'}`,
                                                    borderLeft: `3px solid ${scale.color}`,
                                                    borderRadius: '4px',
                                                    color: 'var(--zenith-text-primary, #FFFFFF)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isSelected) {
                                                        e.target.style.background = 'var(--zenith-bg-hover, rgba(255, 255, 255, 0.08))';
                                                        e.target.style.borderColor = scale.color;
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isSelected) {
                                                        e.target.style.background = 'var(--zenith-bg-tertiary, rgba(255, 255, 255, 0.05))';
                                                        e.target.style.borderColor = 'var(--zenith-border-subtle, rgba(255, 255, 255, 0.08))';
                                                    }
                                                }}
                                            >
                                                <div>
                                                    <div style={{ fontWeight: isSelected ? 600 : 500 }}>
                                                        {scale.name}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '10px',
                                                        color: 'var(--zenith-text-tertiary, #6B7280)',
                                                        marginTop: '2px'
                                                    }}>
                                                        {scale.description}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Keyboard Piano Mode Toggle */}
                <div style={{ position: 'relative', marginRight: '12px' }}>
                    <button
                        ref={pianoButtonRef}
                        className={`prv7-tool-btn ${keyboardPianoMode ? 'prv7-tool-btn--active' : ''}`}
                        onClick={() => onKeyboardPianoModeChange?.(!keyboardPianoMode)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setShowPianoSettings(!showPianoSettings);
                        }}
                        title={`Left: Toggle Piano Mode | Right: Settings\nBase: C${keyboardPianoSettings.baseOctave} | Scale: ${keyboardPianoSettings.scale}`}
                    >
                        <Piano size={18} />
                    </button>

                    {/* Piano Settings Dropdown */}
                    {showPianoSettings && (
                        <div
                            className="prv7-piano-settings-menu"
                            style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '4px',
                                background: 'var(--zenith-bg-elevated, #2a2a2a)',
                                border: '1px solid var(--zenith-border, #444)',
                                borderRadius: '6px',
                                padding: '12px',
                                minWidth: '200px',
                                zIndex: 1000,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--zenith-text-secondary, #aaa)' }}>
                                    Base Octave
                                </label>
                                <select
                                    value={keyboardPianoSettings.baseOctave}
                                    onChange={(e) => onKeyboardPianoSettingsChange?.({ ...keyboardPianoSettings, baseOctave: parseInt(e.target.value) })}
                                    className="prv7-select"
                                    style={{ width: '100%' }}
                                >
                                    <option value="2">C2 (Low)</option>
                                    <option value="3">C3</option>
                                    <option value="4">C4 (Middle C)</option>
                                    <option value="5">C5</option>
                                    <option value="6">C6 (High)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--zenith-text-secondary, #aaa)' }}>
                                    Scale
                                </label>
                                <select
                                    value={keyboardPianoSettings.scale}
                                    onChange={(e) => onKeyboardPianoSettingsChange?.({ ...keyboardPianoSettings, scale: e.target.value })}
                                    className="prv7-select"
                                    style={{ width: '100%' }}
                                >
                                    <option value="chromatic">Chromatic (All notes)</option>
                                    <option value="major">Major Scale</option>
                                    <option value="minor">Natural Minor</option>
                                    <option value="pentatonic">Pentatonic</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Snap Ayarları - Only essential setting */}
                <div className="prv7-setting-item">
                    <label htmlFor="snap-select" className="prv7-setting-label">Snap:</label>
                    <select
                        id="snap-select"
                        value={snapValue}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value.endsWith('T')) {
                                onSnapChange?.(value); // Triplet string value
                            } else {
                                onSnapChange?.(parseFloat(value)); // Regular numeric value
                            }
                        }}
                        className="prv7-select"
                    >
                        <optgroup label="Regular">
                            {Object.entries(regularSnapOptions).map(([label, value]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Triplets">
                            {Object.entries(tripletSnapOptions).map(([label, value]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>
            </div>
        </div>
    );
}

export default Toolbar;