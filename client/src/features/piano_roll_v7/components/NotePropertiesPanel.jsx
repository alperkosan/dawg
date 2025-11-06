import React, { useState, useCallback, useEffect } from 'react';
import './NotePropertiesPanel.css';

// Helper: MIDI pitch to note name
function pitchToString(midiPitch) {
    if (typeof midiPitch !== 'number') return '--';
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiPitch / 12) - 1;
    const noteIndex = midiPitch % 12;
    return noteNames[noteIndex] + octave;
}

// Helper: Convert pitch string (C4) or number to MIDI number
function pitchToMidi(pitch) {
    if (typeof pitch === 'number') return Math.max(0, Math.min(127, Math.round(pitch)));
    if (typeof pitch !== 'string') return 60; // Default C4
    
    const noteNames = { 
        'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 
        'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 
    };
    
    const match = pitch.match(/([A-G]#?)(\d+)/);
    if (!match) return 60; // Default C4
    
    const noteName = match[1];
    const octave = parseInt(match[2]);
    
    return Math.max(0, Math.min(127, (octave + 1) * 12 + (noteNames[noteName] || 0)));
}

/**
 * ✅ FL Studio-style Slide Section
 * Clean, simple implementation
 */
function SlideSection({ selectedNote, onPropertyChange, allNotes }) {
    // ✅ State: Track slide properties
    const [enabled, setEnabled] = useState(false);
    const [duration, setDuration] = useState(1);
    const [targetPitch, setTargetPitch] = useState(60);

    // ✅ Find next note for auto-target pitch
    const findNextNotePitch = useCallback(() => {
        if (!selectedNote || !allNotes || allNotes.length === 0) return null;
        const nextNote = allNotes
            .filter(n => n.id !== selectedNote.id && n.startTime > selectedNote.startTime)
            .sort((a, b) => a.startTime - b.startTime)[0];
        return nextNote ? pitchToMidi(nextNote.pitch) : null;
    }, [selectedNote, allNotes]);

    // ✅ Sync state with selected note
    useEffect(() => {
        if (!selectedNote) return;
        
        const isEnabled = selectedNote.slideEnabled === true;
        const currentDuration = selectedNote.slideDuration ?? 1;
        const currentTargetPitch = selectedNote.slideTargetPitch;
        
        console.log('🔄 SlideSection sync:', { 
            noteId: selectedNote.id, 
            isEnabled, 
            currentDuration, 
            currentTargetPitch 
        });
        
        setEnabled(isEnabled);
        setDuration(currentDuration);
        
        if (currentTargetPitch !== undefined && currentTargetPitch !== null) {
            setTargetPitch(currentTargetPitch);
        } else if (isEnabled) {
            // Auto-detect target pitch from next note
            const nextPitch = findNextNotePitch();
            if (nextPitch !== null) {
                setTargetPitch(nextPitch);
            } else {
                // Default to same pitch (no effect)
                setTargetPitch(pitchToMidi(selectedNote.pitch));
            }
        }
    }, [selectedNote, findNextNotePitch]);

    // ✅ Handle slide toggle
    const handleToggle = useCallback((checked) => {
        console.log('🔘 Slide toggle:', checked, 'noteId:', selectedNote?.id);
        setEnabled(checked);
        onPropertyChange?.('slideEnabled', checked);
        
        // When enabling, set default target pitch if not set
        if (checked) {
            const currentTarget = selectedNote?.slideTargetPitch;
            if (!currentTarget) {
                const nextPitch = findNextNotePitch();
                const defaultPitch = nextPitch !== null ? nextPitch : pitchToMidi(selectedNote?.pitch || 'C4');
                setTargetPitch(defaultPitch);
                onPropertyChange?.('slideTargetPitch', defaultPitch);
            }
        }
    }, [onPropertyChange, selectedNote, findNextNotePitch]);

    // ✅ Handle duration change
    const handleDurationChange = useCallback((value) => {
        const newDuration = parseFloat(value);
        setDuration(newDuration);
        onPropertyChange?.('slideDuration', newDuration);
    }, [onPropertyChange]);

    // ✅ Handle target pitch change
    const handleTargetPitchChange = useCallback((value) => {
        const newPitch = parseInt(value);
        if (!isNaN(newPitch) && newPitch >= 0 && newPitch <= 127) {
            setTargetPitch(newPitch);
            onPropertyChange?.('slideTargetPitch', newPitch);
        }
    }, [onPropertyChange]);

    return (
        <div className="property-section">
            <div className="property-label">Slide</div>
            
            {/* Toggle */}
            <div className="property-control">
                <label className="property-label-small">Enabled:</label>
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => handleToggle(e.target.checked)}
                    className="property-checkbox"
                />
            </div>
            
            {/* Duration and Target Pitch (only shown when enabled) */}
            {enabled && (
                <>
                    <div className="property-control">
                        <label className="property-label-small">Duration (steps):</label>
                        <input
                            type="range"
                            min="0.25"
                            max="32"
                            step="0.25"
                            value={duration}
                            onChange={(e) => handleDurationChange(e.target.value)}
                            className="property-slider"
                        />
                        <span className="property-value">{duration.toFixed(2)}</span>
                    </div>
                    
                    <div className="property-control">
                        <label className="property-label-small">Target Pitch:</label>
                        <input
                            type="number"
                            min="0"
                            max="127"
                            step="1"
                            value={targetPitch}
                            onChange={(e) => handleTargetPitchChange(e.target.value)}
                            className="property-input"
                        />
                        <span className="property-value">({pitchToString(targetPitch)})</span>
                    </div>
                    
                    <div className="slide-hint">
                        <p className="hint-text">Note will glide from {pitchToString(pitchToMidi(selectedNote?.pitch || 'C4'))} to {pitchToString(targetPitch)} over {duration.toFixed(2)} steps</p>
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * Note Properties Panel Component
 * Phase 2: FIRST LAYER - UI & Basic Editing
 * Displays and allows editing of extended note properties
 */
function NotePropertiesPanel({
    selectedNote = null,
    onPropertyChange, // (property, value) => void
    onPitchBendChange, // (points) => void
    collapsed = false,
    onToggleCollapse,
    allNotes = [] // ✅ FL Studio: Need all notes to find next note for slide target
}) {
    const [localPan, setLocalPan] = useState(selectedNote?.pan || 0);
    const [localModWheel, setLocalModWheel] = useState(selectedNote?.modWheel ?? null);
    const [localAftertouch, setLocalAftertouch] = useState(selectedNote?.aftertouch ?? null);
    const [localReleaseVelocity, setLocalReleaseVelocity] = useState(selectedNote?.releaseVelocity ?? null);

    // Update local state when selected note changes
    useEffect(() => {
        if (selectedNote) {
            setLocalPan(selectedNote.pan || 0);
            setLocalModWheel(selectedNote.modWheel ?? null);
            setLocalAftertouch(selectedNote.aftertouch ?? null);
            setLocalReleaseVelocity(selectedNote.releaseVelocity ?? null);
        }
    }, [selectedNote?.id, selectedNote?.pan, selectedNote?.modWheel, selectedNote?.aftertouch, selectedNote?.releaseVelocity]);

    const handlePanChange = useCallback((value) => {
        setLocalPan(value);
        if (onPropertyChange) {
            onPropertyChange('pan', value);
        }
    }, [onPropertyChange]);

    const handleModWheelChange = useCallback((value) => {
        setLocalModWheel(value);
        if (onPropertyChange) {
            onPropertyChange('modWheel', value);
        }
    }, [onPropertyChange]);

    const handleAftertouchChange = useCallback((value) => {
        setLocalAftertouch(value);
        if (onPropertyChange) {
            onPropertyChange('aftertouch', value);
        }
    }, [onPropertyChange]);

    const handleReleaseVelocityChange = useCallback((value) => {
        setLocalReleaseVelocity(value);
        if (onPropertyChange) {
            onPropertyChange('releaseVelocity', value);
        }
    }, [onPropertyChange]);


    if (!selectedNote) {
        return (
            <div className="note-properties-panel empty">
                <div className="note-properties-header">
                    <span>Note Properties</span>
                </div>
                <div className="note-properties-content">
                    <p className="empty-message">No note selected</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`note-properties-panel ${collapsed ? 'collapsed' : ''}`}>
            <div className="note-properties-header" onClick={onToggleCollapse}>
                <span>Note Properties</span>
                <span className="collapse-icon">{collapsed ? '▼' : '▲'}</span>
            </div>
            
            {!collapsed && (
                <div className="note-properties-content">
                    {/* Basic Info */}
                    <div className="property-section">
                        <div className="property-label">Pitch</div>
                        <div className="property-value">{selectedNote.pitch}</div>
                    </div>
                    
                    <div className="property-section">
                        <div className="property-label">Velocity</div>
                        <div className="property-value">{selectedNote.velocity || 100}</div>
                    </div>

                    {/* Extended Properties */}
                    <div className="property-section">
                        <div className="property-label">Pan</div>
                        <div className="property-control">
                            <input
                                type="range"
                                min="-1"
                                max="1"
                                step="0.01"
                                value={localPan}
                                onChange={(e) => handlePanChange(parseFloat(e.target.value))}
                                className="property-slider"
                            />
                            <span className="property-value">{localPan.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="property-section">
                        <div className="property-label">Mod Wheel (CC1)</div>
                        <div className="property-control">
                            <input
                                type="range"
                                min="0"
                                max="127"
                                step="1"
                                value={localModWheel ?? 0}
                                onChange={(e) => handleModWheelChange(parseInt(e.target.value))}
                                className="property-slider"
                            />
                            <span className="property-value">{localModWheel ?? '--'}</span>
                        </div>
                    </div>

                    <div className="property-section">
                        <div className="property-label">Aftertouch</div>
                        <div className="property-control">
                            <input
                                type="range"
                                min="0"
                                max="127"
                                step="1"
                                value={localAftertouch ?? 0}
                                onChange={(e) => handleAftertouchChange(parseInt(e.target.value))}
                                className="property-slider"
                            />
                            <span className="property-value">{localAftertouch ?? '--'}</span>
                        </div>
                    </div>

                    <div className="property-section">
                        <div className="property-label">Release Velocity</div>
                        <div className="property-control">
                            <input
                                type="range"
                                min="0"
                                max="127"
                                step="1"
                                value={localReleaseVelocity ?? 0}
                                onChange={(e) => handleReleaseVelocityChange(parseInt(e.target.value))}
                                className="property-slider"
                            />
                            <span className="property-value">{localReleaseVelocity ?? '--'}</span>
                        </div>
                    </div>

                    {/* Pitch Bend Editor */}
                    {selectedNote.pitchBend && selectedNote.pitchBend.length > 0 && (
                        <div className="property-section">
                            <div className="property-label">Pitch Bend</div>
                            <div className="pitch-bend-info">
                                {selectedNote.pitchBend.length} point(s)
                            </div>
                        </div>
                    )}

                    {/* ✅ FL Studio-style Slide Section */}
                    <SlideSection 
                        selectedNote={selectedNote}
                        onPropertyChange={onPropertyChange}
                        allNotes={allNotes}
                    />
                </div>
            )}
        </div>
    );
}

export default React.memo(NotePropertiesPanel);

