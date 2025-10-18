import React, { useState, useRef, useEffect } from 'react';
import { MousePointer, Edit3, Eraser, Scissors, Music, Zap, Guitar, Shuffle, FlipHorizontal2, Piano } from 'lucide-react';
import { getToolManager, TOOL_TYPES } from '@/lib/piano-roll-tools';
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
    onKeyboardPianoSettingsChange
}) {
    const [showQuantizeMenu, setShowQuantizeMenu] = useState(false);
    const [showPianoSettings, setShowPianoSettings] = useState(false);
    const pianoButtonRef = useRef(null);

    // Close settings dropdown on click outside
    useEffect(() => {
        if (!showPianoSettings) return;

        const handleClickOutside = (e) => {
            if (pianoButtonRef.current && !pianoButtonRef.current.contains(e.target)) {
                // Check if click is inside the dropdown
                const dropdown = document.querySelector('.prv7-piano-settings-menu');
                if (!dropdown || !dropdown.contains(e.target)) {
                    setShowPianoSettings(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPianoSettings]);

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