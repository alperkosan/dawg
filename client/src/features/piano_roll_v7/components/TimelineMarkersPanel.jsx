/**
 * TimelineMarkersPanel - Marker Management UI
 *
 * Allows users to:
 * - Add/remove markers
 * - Edit marker names and colors
 * - Navigate to markers
 * - Manage loop regions
 */

import React, { useState } from 'react';
import { useTimelineStore, MarkerType } from '@/store/TimelineStore';
import './TimelineMarkersPanel.css';

const MARKER_COLORS = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Orange
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#84cc16'  // Lime
];

export const TimelineMarkersPanel = ({ onSeek, currentStep }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [editingMarkerId, setEditingMarkerId] = useState(null);
    const [newMarkerName, setNewMarkerName] = useState('');

    const timelineStore = useTimelineStore();
    const markers = timelineStore.markers;
    const loopRegions = timelineStore.loopRegions;

    const handleAddMarker = () => {
        const name = newMarkerName.trim() || `Marker ${markers.length + 1}`;
        const position = currentStep || 0;

        timelineStore.addMarker(position, name, {
            color: MARKER_COLORS[markers.length % MARKER_COLORS.length],
            type: MarkerType.BOOKMARK
        });

        setNewMarkerName('');
    };

    const handleDeleteMarker = (id) => {
        timelineStore.removeMarker(id);
    };

    const handleEditMarker = (id, updates) => {
        timelineStore.updateMarker(id, updates);
        setEditingMarkerId(null);
    };

    const handleSeekToMarker = (position) => {
        if (onSeek) {
            onSeek(position);
        }
    };

    const formatPosition = (step) => {
        const bar = Math.floor(step / 16) + 1;
        const beat = Math.floor((step % 16) / 4) + 1;
        const subdivision = (step % 4) + 1;
        return `${bar}:${beat}:${subdivision}`;
    };

    if (!isExpanded) {
        return (
            <div className="timeline-markers-panel collapsed">
                <button
                    className="expand-button"
                    onClick={() => setIsExpanded(true)}
                    title="Show Timeline Markers"
                >
                    🏁 Markers ({markers.length})
                </button>
            </div>
        );
    }

    return (
        <div className="timeline-markers-panel expanded">
            <div className="panel-header">
                <h3>Timeline Markers</h3>
                <button
                    className="collapse-button"
                    onClick={() => setIsExpanded(false)}
                >
                    ✕
                </button>
            </div>

            {/* Add Marker */}
            <div className="add-marker-section">
                <input
                    type="text"
                    placeholder="Marker name..."
                    value={newMarkerName}
                    onChange={(e) => setNewMarkerName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleAddMarker();
                        }
                    }}
                />
                <button onClick={handleAddMarker}>
                    + Add at {formatPosition(currentStep || 0)}
                </button>
            </div>

            {/* Markers List */}
            <div className="markers-list">
                {markers.length === 0 ? (
                    <div className="empty-state">
                        No markers yet. Add one above!
                    </div>
                ) : (
                    markers.map((marker) => (
                        <div
                            key={marker.id}
                            className="marker-item"
                            style={{ borderLeftColor: marker.color }}
                        >
                            {editingMarkerId === marker.id ? (
                                <input
                                    type="text"
                                    defaultValue={marker.name}
                                    autoFocus
                                    onBlur={(e) => {
                                        handleEditMarker(marker.id, { name: e.target.value });
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleEditMarker(marker.id, { name: e.target.value });
                                        } else if (e.key === 'Escape') {
                                            setEditingMarkerId(null);
                                        }
                                    }}
                                />
                            ) : (
                                <>
                                    <div className="marker-info">
                                        <span className="marker-name">
                                            {marker.name}
                                        </span>
                                        <span className="marker-position">
                                            {formatPosition(marker.position)}
                                        </span>
                                    </div>
                                    <div className="marker-actions">
                                        <button
                                            onClick={() => handleSeekToMarker(marker.position)}
                                            title="Go to marker"
                                        >
                                            →
                                        </button>
                                        <button
                                            onClick={() => setEditingMarkerId(marker.id)}
                                            title="Rename"
                                        >
                                            ✎
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMarker(marker.id)}
                                            title="Delete"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Loop Regions Section */}
            <div className="loop-regions-section">
                <h4>Loop Regions ({loopRegions.length})</h4>
                <div className="loop-regions-list">
                    {loopRegions.map((loop) => (
                        <div
                            key={loop.id}
                            className={`loop-region-item ${loop.isActive ? 'active' : ''}`}
                            style={{ borderLeftColor: loop.color }}
                        >
                            <div className="loop-info">
                                <span className="loop-name">{loop.name}</span>
                                <span className="loop-range">
                                    {formatPosition(loop.start)} - {formatPosition(loop.end)}
                                </span>
                            </div>
                            <div className="loop-actions">
                                <button
                                    onClick={() => timelineStore.setActiveLoopRegion(loop.isActive ? null : loop.id)}
                                    className={loop.isActive ? 'active' : ''}
                                >
                                    {loop.isActive ? '✓' : '○'}
                                </button>
                                <button
                                    onClick={() => handleSeekToMarker(loop.start)}
                                >
                                    →
                                </button>
                                <button
                                    onClick={() => timelineStore.removeLoopRegion(loop.id)}
                                >
                                    🗑
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="shortcuts-hint">
                <small>
                    <kbd>M</kbd> Add marker at playhead
                    <br />
                    <kbd>Shift</kbd>+<kbd>M</kbd> Next marker
                </small>
            </div>
        </div>
    );
};

export default TimelineMarkersPanel;
