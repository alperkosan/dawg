// Piano Keyboard Component - Professional DAW Style
// 88 keys (A0-C8) with proper black/white key layout
import React, { useState, useCallback, useMemo } from 'react';

const PianoKeyboard = ({
    onKeyClick,
    onKeyHover,
    activeNotes = new Set(),
    highlightedKeys = new Set(),
    baseKeyHeight = 20,  // Base height for zoom = 1 (matches grid cellHeight)
    baseWhiteKeyWidth = 12,
    baseBlackKeyWidth = 8,
    zoom = 1,           // Zoom level from canvas
    showLabels = true,
    viewportY = 0,      // Y scroll offset from grid engine
    className = ""
}) => {
    // Calculate responsive dimensions - width stays fixed, only height scales with zoom
    const keyHeight = Math.max(4, baseKeyHeight * zoom); // Scale height with zoom
    const whiteKeyWidth = baseWhiteKeyWidth; // Fixed width regardless of zoom
    const blackKeyWidth = baseBlackKeyWidth; // Fixed width regardless of zoom

    // Adaptive label visibility and sizing
    const shouldShowLabels = showLabels && zoom > 0.3;  // Hide labels when too zoomed out
    const labelFontSize = Math.max(6, Math.floor(8 * Math.sqrt(zoom)));
    const blackLabelFontSize = Math.max(4, Math.floor(6 * Math.sqrt(zoom)));
    const [hoveredKey, setHoveredKey] = useState(null);

    // MIDI note mapping (A0 = 21, C8 = 108)
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const BLACK_KEY_PATTERN = [false, true, false, true, false, false, true, false, true, false, true, false];

    // Generate 88 keys from A0 (MIDI 21) to C8 (MIDI 108)
    const keys = useMemo(() => {
        const keyList = [];

        // Start from A0 (MIDI note 21)
        for (let midi = 21; midi <= 108; midi++) {
            const noteIndex = (midi - 12) % 12; // Adjust for A0 start
            const octave = Math.floor((midi - 12) / 12);
            const noteName = NOTE_NAMES[noteIndex];
            const isBlack = BLACK_KEY_PATTERN[noteIndex];

            // Calculate position
            const whiteKeysBefore = keyList.filter(k => !k.isBlack).length;
            const position = whiteKeysBefore * whiteKeyWidth;

            keyList.push({
                midi,
                noteName,
                octave,
                isBlack,
                displayName: `${noteName}${octave}`,
                position,
                id: `key_${midi}`
            });
        }

        return keyList;
    }, []);

    const handleKeyClick = useCallback((key, event) => {
        event.preventDefault();
        onKeyClick?.(key);
    }, [onKeyClick]);

    const handleKeyHover = useCallback((key) => {
        setHoveredKey(key);
        onKeyHover?.(key);
    }, [onKeyHover]);

    const handleKeyLeave = useCallback(() => {
        setHoveredKey(null);
        onKeyHover?.(null);
    }, [onKeyHover]);

    // Separate white and black keys for proper layering
    const whiteKeys = keys.filter(key => !key.isBlack);
    const blackKeys = keys.filter(key => key.isBlack);

    const totalWidth = whiteKeys.length * whiteKeyWidth;

    return (
        <div className={`piano-keyboard ${className}`} style={{
            position: 'relative',
            width: `${whiteKeyWidth}px`, // Fixed width
            height: '100%',
            overflow: 'hidden',
            backgroundColor: '#2a2a2a'
        }}>
            <svg
                width={whiteKeyWidth}
                height={88 * keyHeight} // 88 piano keys total, scales with zoom
                style={{
                    display: 'block',
                    // Offset SVG by viewport Y to sync with grid scrolling
                    transform: `translateY(${-viewportY}px)`
                }}
                onMouseLeave={handleKeyLeave}
            >
                {/* Render white keys first */}
                {whiteKeys.map((key, index) => {
                    const isActive = activeNotes.has(key.midi);
                    const isHighlighted = highlightedKeys.has(key.midi);
                    const isHovered = hoveredKey?.midi === key.midi;

                    // Grid coordinate system: A0 (MIDI 21) = Y position 0
                    const gridY = key.midi - 21;
                    const yPos = gridY * keyHeight;

                    return (
                        <g key={key.id}>
                            {/* White key background - Grid-aligned positioning */}
                            <rect
                                x={0}
                                y={yPos}
                                width={whiteKeyWidth - 0.5}
                                height={keyHeight - 0.5}
                                fill={isActive ? '#4CAF50' : isHighlighted ? '#2196F3' : isHovered ? '#f5f5f5' : '#ffffff'}
                                stroke="#ccc"
                                strokeWidth={0.5}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => handleKeyClick(key, e)}
                                onMouseEnter={() => handleKeyHover(key)}
                            />

                            {/* Key label - Adaptive sizing */}
                            {shouldShowLabels && keyHeight >= 8 && (
                                <text
                                    x={whiteKeyWidth/2}
                                    y={yPos + keyHeight/2 + 2}
                                    textAnchor="middle"
                                    fontSize={labelFontSize}
                                    fill="#666"
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    {keyHeight >= 15 ? key.displayName : key.noteName}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Render black keys on top */}
                {blackKeys.map((key) => {
                    const isActive = activeNotes.has(key.midi);
                    const isHighlighted = highlightedKeys.has(key.midi);
                    const isHovered = hoveredKey?.midi === key.midi;

                    // Grid coordinate system: A0 (MIDI 21) = Y position 0
                    const gridY = key.midi - 21;
                    const yPos = gridY * keyHeight;

                    return (
                        <g key={key.id}>
                            {/* Black key background - Grid-aligned positioning */}
                            <rect
                                x={whiteKeyWidth - blackKeyWidth}
                                y={yPos}
                                width={blackKeyWidth}
                                height={keyHeight * 0.6}
                                fill={isActive ? '#4CAF50' : isHighlighted ? '#2196F3' : isHovered ? '#555' : '#333'}
                                stroke="#000"
                                strokeWidth={0.5}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => handleKeyClick(key, e)}
                                onMouseEnter={() => handleKeyHover(key)}
                            />

                            {/* Key label for black keys - Adaptive sizing */}
                            {shouldShowLabels && keyHeight >= 10 && blackKeyWidth >= 25 && (
                                <text
                                    x={whiteKeyWidth - blackKeyWidth/2}
                                    y={yPos + keyHeight * 0.3}
                                    textAnchor="middle"
                                    fontSize={blackLabelFontSize}
                                    fill="#fff"
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    {keyHeight >= 20 ? key.displayName : key.noteName}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Optional style injection for better UX */}
            <style>{`
                .piano-keyboard {
                    user-select: none;
                    background: #f8f8f8;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .piano-keyboard svg {
                    background: #fafafa;
                }
            `}</style>
        </div>
    );
};

export default PianoKeyboard;