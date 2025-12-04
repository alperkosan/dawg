/**
 * Piano Roll Shortcuts Panel
 *
 * Comprehensive keyboard shortcuts and features guide
 * - Categorized shortcuts
 * - Toggle with ? or H key
 * - Zenith theme styling
 * - Searchable (future enhancement)
 */

import React, { useState, useEffect } from 'react';
import './ShortcutsPanel.css';

const SHORTCUTS_DATA = {
    'Tools': [
        { keys: ['Alt', 'V'], description: 'Select Tool - Click and drag notes' },
        { keys: ['Alt', 'B'], description: 'Paint Brush - Draw notes by clicking/dragging' },
        { keys: ['Alt', 'E'], description: 'Eraser - Delete notes by clicking/dragging' },
        { keys: ['Alt', 'C'], description: 'Chopper - Slice notes into pieces' },
        { keys: ['Alt', 'S'], description: 'Strumizer - Create strumming patterns' },
        { keys: ['Alt', 'A'], description: 'Arpeggiator - Generate arpeggios' },
        { keys: ['Alt', 'F'], description: 'Flam - Create quick note repetitions' },
        { keys: ['Alt', 'R'], description: 'Randomizer - Randomize note properties' },
        { keys: ['Alt', 'L'], description: 'Flip - Mirror notes horizontally/vertically' },
        { keys: ['Alt', 'G'], description: 'Slide - Create slide connections (portamento)' },
    ],
    'Note Editing': [
        { keys: ['Click & Drag'], description: 'Create/draw notes continuously (Paint Brush)' },
        { keys: ['Right Click & Drag'], description: 'Erase notes continuously (Eraser)' },
        { keys: ['Hover + Wheel'], description: 'Change velocity (no selection needed)' },
        { keys: ['Shift', 'Wheel'], description: 'Change duration (1/16 step precision)' },
        { keys: ['Drag Handle'], description: 'Resize note length' },
        { keys: ['Drag Note'], description: 'Move note position' },
    ],
    'Selection': [
        { keys: ['Click'], description: 'Select single note' },
        { keys: ['Ctrl/Cmd', 'Click'], description: 'Multi-select (add to selection)' },
        { keys: ['Drag Empty Area'], description: 'Rectangle selection' },
        { keys: ['Alt', 'Drag Empty Area'], description: 'Lasso selection (freehand)' },
        { keys: ['Shift', 'Timeline Drag'], description: 'Time-range selection (all notes in range)' },
        { keys: ['Ctrl/Cmd', 'A'], description: 'Select all notes' },
        { keys: ['Ctrl/Cmd', 'I'], description: 'Invert selection' },
        { keys: ['Escape'], description: 'Deselect all / Clear loop region' },
    ],
    'Copy & Duplicate': [
        { keys: ['Ctrl/Cmd', 'D'], description: 'Duplicate notes (loop region aware)' },
        { keys: ['Ctrl/Cmd', 'B'], description: 'Sequential duplicate (pattern memory)' },
        { keys: ['Shift', 'Drag'], description: 'Copy while dragging (keeps originals)' },
        { keys: ['Ctrl/Cmd', 'C'], description: 'Copy selected notes to clipboard' },
        { keys: ['Ctrl/Cmd', 'X'], description: 'Cut selected notes to clipboard' },
        { keys: ['Ctrl/Cmd', 'V'], description: 'Paste notes from clipboard' },
    ],
    'Loop Region': [
        { keys: ['Timeline Drag'], description: 'Select loop region (bar-snapped)' },
        { keys: ['Shift', 'Timeline Drag'], description: 'Free selection (no snap)' },
        { keys: ['Alt', 'Click Bar'], description: 'Quick bar selection' },
        { keys: ['Ctrl/Cmd', 'L'], description: 'Link notes: Extend each note to next note of same pitch (or pattern end)' },
        { keys: ['Escape'], description: 'Clear loop region' },
    ],
    'Keyboard Piano': [
        { keys: ['Piano Icon (Toolbar)'], description: 'Toggle keyboard piano mode ON/OFF' },
        { keys: ['ZXCVBNM...'], description: 'Play notes (C4 octave) - MODE MUST BE ON' },
        { keys: ['QWERTYUI...'], description: 'Play notes (C5 octave) - MODE MUST BE ON' },
        { keys: ['2,3,5,6,7,9,0'], description: 'Black keys (sharps/flats) - MODE MUST BE ON' },
        { keys: [''], description: 'When OFF: Keys work as shortcuts (Ctrl+D, etc.)' },
    ],
    'Delete': [
        { keys: ['Delete / Backspace'], description: 'Delete selected notes' },
        { keys: ['Right Click'], description: 'Delete note instantly' },
        { keys: ['Right Click', 'Drag'], description: 'Delete multiple notes continuously' },
        { keys: ['Eraser Tool', 'Click'], description: 'Delete single note' },
        { keys: ['Eraser Tool', 'Drag'], description: 'Delete multiple notes continuously' },
    ],
    'Snap & Grid': [
        { keys: ['1-9 (Toolbar)'], description: 'Change snap value (1/16 to 1 bar)' },
        { keys: ['Grid Lines'], description: 'Visual guide for snapping' },
    ],
    'View': [
        { keys: ['Scroll Wheel'], description: 'Vertical scroll (pitch)' },
        { keys: ['Shift', 'Scroll'], description: 'Horizontal scroll (time)' },
        { keys: ['Ctrl/Cmd', 'Scroll'], description: 'Zoom in/out' },
    ],
    'Transpose & Move': [
        { keys: ['Arrow Keys'], description: 'Move selected notes (time/pitch)' },
        { keys: ['Ctrl/Cmd', '↑/↓'], description: 'Transpose ±1 semitone' },
        { keys: ['Ctrl/Cmd', 'Alt', '↑/↓'], description: 'Transpose ±1 octave (12 semitones)' },
    ],
    'Undo & Redo': [
        { keys: ['Ctrl/Cmd', 'Z'], description: 'Undo last action' },
        { keys: ['Ctrl/Cmd', 'Y'], description: 'Redo (or Ctrl/Cmd+Shift+Z)' },
    ],
    'Ghost Notes': [
        { keys: ['M'], description: 'Toggle mute on selected notes (ghost notes)' },
        { keys: [''], description: 'Muted notes are grayed out and won\'t play' },
    ],
};

export function ShortcutsPanel({ isOpen, onClose }) {
    const [activeCategory, setActiveCategory] = useState('Tools');

    // Handle keyboard shortcut to close panel
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === '?' || e.key === 'h' || e.key === 'H') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="shortcuts-panel-overlay" onClick={onClose}>
            <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="shortcuts-panel__header">
                    <h2>Piano Roll Shortcuts & Features</h2>
                    <button className="shortcuts-panel__close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="shortcuts-panel__content">
                    {/* Sidebar - Categories */}
                    <div className="shortcuts-panel__sidebar">
                        {Object.keys(SHORTCUTS_DATA).map(category => (
                            <button
                                key={category}
                                className={`shortcuts-panel__category ${activeCategory === category ? 'active' : ''}`}
                                onClick={() => setActiveCategory(category)}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    {/* Main - Shortcuts List */}
                    <div className="shortcuts-panel__main">
                        <h3>{activeCategory}</h3>
                        <div className="shortcuts-panel__list">
                            {SHORTCUTS_DATA[activeCategory].map((shortcut, index) => (
                                <div key={index} className="shortcut-item">
                                    <div className="shortcut-item__keys">
                                        {shortcut.keys.map((key, i) => (
                                            <React.Fragment key={i}>
                                                <kbd className="shortcut-key">{key}</kbd>
                                                {i < shortcut.keys.length - 1 && (
                                                    <span className="shortcut-plus">+</span>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    <div className="shortcut-item__description">
                                        {shortcut.description}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shortcuts-panel__footer">
                    <div className="shortcuts-panel__footer-hint">
                        Press <kbd>?</kbd> or <kbd>H</kbd> or <kbd>Escape</kbd> to close
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ShortcutsPanel;
