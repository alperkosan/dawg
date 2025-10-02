import React, { useState } from 'react';
import { MousePointer, Edit3, Eraser, Scissors } from 'lucide-react';
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
    { id: 'select', label: 'Select', icon: MousePointer, hotkey: 'V' },
    { id: 'pencil', label: 'Pencil', icon: Edit3, hotkey: 'B' },
    { id: 'eraser', label: 'Eraser', icon: Eraser, hotkey: 'E' },
    { id: 'slice', label: 'Slice', icon: Scissors, hotkey: 'C' }
];

function Toolbar({
    snapValue,
    onSnapChange,
    activeTool = 'select',
    onToolChange,
    zoom = 1.0,
    onZoomChange,
    selectedCount = 0
}) {
    const [showQuantizeMenu, setShowQuantizeMenu] = useState(false);

    return (
        <div className="prv7-toolbar">
            {/* Sol Grup - Sadece Essential Tools */}
            <div className="prv7-toolbar-group">
                <div className="prv7-brand">
                    <span className="prv7-brand-text">Piano Roll</span>
                </div>

                {/* Essential tools - Select, Pencil, Eraser, Slice */}
                <div className="prv7-tool-group">
                    <button
                        className={`prv7-tool-btn ${activeTool === 'select' ? 'prv7-tool-btn--active' : ''}`}
                        onClick={() => onToolChange?.('select')}
                        title="Select (V)"
                    >
                        <MousePointer size={18} />
                    </button>
                    <button
                        className={`prv7-tool-btn ${activeTool === 'pencil' ? 'prv7-tool-btn--active' : ''}`}
                        onClick={() => onToolChange?.('pencil')}
                        title="Pencil (B)"
                    >
                        <Edit3 size={18} />
                    </button>
                    <button
                        className={`prv7-tool-btn ${activeTool === 'eraser' ? 'prv7-tool-btn--active' : ''}`}
                        onClick={() => onToolChange?.('eraser')}
                        title="Eraser (E)"
                    >
                        <Eraser size={18} />
                    </button>
                    <button
                        className={`prv7-tool-btn ${activeTool === 'slice' ? 'prv7-tool-btn--active' : ''}`}
                        onClick={() => onToolChange?.('slice')}
                        title="Slice (C)"
                    >
                        <Scissors size={18} />
                    </button>
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