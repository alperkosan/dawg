// Timeline Component - Professional DAW Bar:Beat:Tick Display
import React, { useMemo } from 'react';

const Timeline = ({
    viewportX = 0,
    viewportWidth = 1200,
    zoom = 1,
    ticksPerQuarter = 480,  // Standard MIDI PPQ
    beatsPerBar = 4,
    snapMode = '1/16',
    onTimeClick,
    onSnapChange,
    className = ""
}) => {
    // Convert pixels to musical time
    const pixelsPerTick = zoom * (16 / 60); // 16px per 1/32 note = 60 ticks
    const pixelsPerBeat = ticksPerQuarter * pixelsPerTick;
    const pixelsPerBar = beatsPerBar * pixelsPerBeat;

    // Calculate visible time range
    const startTick = Math.floor(viewportX / pixelsPerTick);
    const endTick = Math.ceil((viewportX + viewportWidth) / pixelsPerTick);
    const startBar = Math.floor(startTick / (ticksPerQuarter * beatsPerBar));
    const endBar = Math.ceil(endTick / (ticksPerQuarter * beatsPerBar));

    // Snap mode options
    const snapModes = [
        { name: '1/1', ticks: ticksPerQuarter * 4, label: 'Whole' },
        { name: '1/2', ticks: ticksPerQuarter * 2, label: 'Half' },
        { name: '1/4', ticks: ticksPerQuarter, label: 'Quarter' },
        { name: '1/8', ticks: ticksPerQuarter / 2, label: '8th' },
        { name: '1/16', ticks: ticksPerQuarter / 4, label: '16th' },
        { name: '1/32', ticks: ticksPerQuarter / 8, label: '32nd' },
        { name: 'tick', ticks: 1, label: 'Tick' }
    ];

    // Generate timeline markers
    const markers = useMemo(() => {
        const markerList = [];

        // Bar markers (major)
        for (let bar = startBar - 1; bar <= endBar + 1; bar++) {
            const barTick = bar * ticksPerQuarter * beatsPerBar;
            const x = barTick * pixelsPerTick - viewportX;

            if (x >= -100 && x <= viewportWidth + 100) {
                markerList.push({
                    type: 'bar',
                    x,
                    label: `${bar + 1}`,
                    tick: barTick,
                    bar: bar + 1,
                    beat: 1,
                    tickInBeat: 0
                });
            }
        }

        // Beat markers (minor)
        for (let bar = startBar - 1; bar <= endBar + 1; bar++) {
            for (let beat = 1; beat <= beatsPerBar; beat++) {
                if (beat === 1) continue; // Skip first beat (already marked as bar)

                const beatTick = (bar * ticksPerQuarter * beatsPerBar) + ((beat - 1) * ticksPerQuarter);
                const x = beatTick * pixelsPerTick - viewportX;

                if (x >= -50 && x <= viewportWidth + 50) {
                    markerList.push({
                        type: 'beat',
                        x,
                        label: `${beat}`,
                        tick: beatTick,
                        bar: bar + 1,
                        beat,
                        tickInBeat: 0
                    });
                }
            }
        }

        return markerList;
    }, [viewportX, viewportWidth, zoom, startBar, endBar, pixelsPerTick, ticksPerQuarter, beatsPerBar]);

    // Convert tick to Bar:Beat:Tick format
    const formatTime = (tick) => {
        const totalBeats = Math.floor(tick / ticksPerQuarter);
        const bar = Math.floor(totalBeats / beatsPerBar) + 1;
        const beat = (totalBeats % beatsPerBar) + 1;
        const tickInBeat = tick % ticksPerQuarter;

        return `${bar}:${beat}:${String(tickInBeat).padStart(3, '0')}`;
    };

    const handleTimelineClick = (e) => {
        if (!onTimeClick) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const worldX = clickX + viewportX;
        const clickTick = Math.round(worldX / pixelsPerTick);

        // Snap to current snap mode
        const currentSnapMode = snapModes.find(mode => mode.name === snapMode);
        const snappedTick = Math.round(clickTick / currentSnapMode.ticks) * currentSnapMode.ticks;

        onTimeClick({
            tick: snappedTick,
            time: formatTime(snappedTick),
            bar: Math.floor(snappedTick / (ticksPerQuarter * beatsPerBar)) + 1,
            beat: Math.floor((snappedTick % (ticksPerQuarter * beatsPerBar)) / ticksPerQuarter) + 1,
            tickInBeat: snappedTick % ticksPerQuarter
        });
    };

    return (
        <div className={`timeline ${className}`}>
            {/* Timeline Header with Controls */}
            <div className="timeline-header">
                <div className="time-display">
                    <span className="current-time">
                        {formatTime(Math.round(viewportX / pixelsPerTick))}
                    </span>
                </div>

                <div className="snap-controls">
                    <label>Snap:</label>
                    <select
                        value={snapMode}
                        onChange={(e) => onSnapChange?.(e.target.value)}
                        className="snap-selector"
                    >
                        {snapModes.map(mode => (
                            <option key={mode.name} value={mode.name}>
                                {mode.label} ({mode.name})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="timeline-info">
                    <span>PPQ: {ticksPerQuarter}</span>
                    <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
                </div>
            </div>

            {/* Timeline SVG */}
            <svg
                width={viewportWidth}
                height={60}
                className="timeline-svg"
                onClick={handleTimelineClick}
                style={{ cursor: 'pointer' }}
            >
                {/* Background */}
                <rect width="100%" height="100%" fill="#2a2a2a" />

                {/* Timeline markers */}
                {markers.map((marker, index) => (
                    <g key={`${marker.type}_${marker.bar}_${marker.beat}_${index}`}>
                        {/* Marker line */}
                        <line
                            x1={marker.x}
                            y1={marker.type === 'bar' ? 10 : 20}
                            x2={marker.x}
                            y2={50}
                            stroke={marker.type === 'bar' ? '#4CAF50' : '#666'}
                            strokeWidth={marker.type === 'bar' ? 2 : 1}
                        />

                        {/* Marker label */}
                        <text
                            x={marker.x + 3}
                            y={marker.type === 'bar' ? 25 : 35}
                            fontSize="10"
                            fill={marker.type === 'bar' ? '#4CAF50' : '#999'}
                            style={{ pointerEvents: 'none' }}
                        >
                            {marker.type === 'bar' ? `Bar ${marker.label}` : `Beat ${marker.label}`}
                        </text>
                    </g>
                ))}

                {/* Current snap grid preview */}
                {zoom > 0.5 && (() => {
                    const currentSnapMode = snapModes.find(mode => mode.name === snapMode);
                    const snapPixels = currentSnapMode.ticks * pixelsPerTick;
                    const startSnapIndex = Math.floor(viewportX / snapPixels);
                    const endSnapIndex = Math.ceil((viewportX + viewportWidth) / snapPixels);

                    const snapLines = [];
                    for (let i = startSnapIndex; i <= endSnapIndex; i++) {
                        const x = (i * snapPixels) - viewportX;
                        if (x >= 0 && x <= viewportWidth) {
                            snapLines.push(
                                <line
                                    key={`snap_${i}`}
                                    x1={x}
                                    y1={45}
                                    x2={x}
                                    y2={50}
                                    stroke="#FFD700"
                                    strokeWidth={0.5}
                                    opacity={0.6}
                                />
                            );
                        }
                    }
                    return snapLines;
                })()}
            </svg>

            <style>{`
                .timeline {
                    background: #333;
                    border-bottom: 1px solid #555;
                    user-select: none;
                }

                .timeline-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 6px 12px;
                    background: #2a2a2a;
                    border-bottom: 1px solid #555;
                    font-size: 11px;
                    color: #ccc;
                }

                .time-display {
                    font-family: 'Courier New', monospace;
                    font-weight: bold;
                    color: #4CAF50;
                }

                .snap-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .snap-selector {
                    background: #444;
                    color: #ccc;
                    border: 1px solid #666;
                    border-radius: 3px;
                    padding: 2px 6px;
                    font-size: 10px;
                }

                .timeline-info {
                    display: flex;
                    gap: 12px;
                    font-size: 10px;
                    color: #888;
                }

                .timeline-svg {
                    display: block;
                    background: #2a2a2a;
                }
            `}</style>
        </div>
    );
};

export default Timeline;