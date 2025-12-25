/**
 * 🎚️ AUTOMATION LANES - Arrangement Panel Automation
 *
 * Displays automation lanes for tracks in Arrangement panel
 * Uses shared AutomationLaneEditor component
 */

import React, { useState } from 'react';
import { AutomationLaneEditor } from '@/components/automation/AutomationLaneEditor';
import { useAutomationEditor } from '@/hooks/useAutomationEditor';
import { useArrangementStore } from '@/store/useArrangementStore';
import './AutomationLanes.css';

const AUTOMATION_LANE_HEIGHT = 60;

/**
 * AutomationLanes component for Arrangement panel
 * ✅ NEW: Uses shared useAutomationEditor hook
 */
export function AutomationLanes({
    trackId,
    trackIndex,
    viewport,
    dimensions,
    snapValue = 0.25,
    activeTool = 'select',
    onScroll
}) {
    // Get active arrangement and pattern
    const activePatternId = useArrangementStore(state => state.activePatternId);
    
    // ✅ NEW: Use shared automation editor hook
    const {
        lanes,
        selectedLane,
        selectedLaneIndex,
        setSelectedLaneIndex,
        handlePointAdd,
        handlePointUpdate,
        handlePointRemove
    } = useAutomationEditor({
        patternId: activePatternId,
        instrumentId: trackId, // TODO: Map track to instrument properly
        timeUnit: 'beats', // Arrangement uses beats
        onLanesChange: null // Optional callback
    });

    // If no lanes, show empty state
    if (lanes.length === 0) {
        return (
            <div className="arr-v2-automation-lanes-empty" style={{ height: AUTOMATION_LANE_HEIGHT }}>
                <span>No automation lanes available</span>
            </div>
        );
    }

    return (
        <div className="arr-v2-automation-lanes">
            <div className="arr-v2-automation-lanes-header">
                <span className="arr-v2-automation-toggle-label">🎚️ Automation</span>
                {lanes.length > 0 && (
                    <select
                        value={selectedLaneIndex}
                        onChange={(e) => setSelectedLaneIndex(parseInt(e.target.value))}
                        className="arr-v2-automation-lane-select"
                    >
                        {lanes.map((lane, index) => (
                            <option key={index} value={index}>
                                {lane.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            {selectedLane ? (
                <div 
                    className="arr-v2-automation-lane-container"
                    style={{ height: AUTOMATION_LANE_HEIGHT }}
                    onWheel={onScroll}
                >
                    <AutomationLaneEditor
                        lane={selectedLane}
                        dimensions={dimensions}
                        viewport={viewport}
                        onPointAdd={handlePointAdd}
                        onPointUpdate={handlePointUpdate}
                        onPointRemove={handlePointRemove}
                        keyboardWidth={0} // Arrangement doesn't have keyboard
                        showGrid={true}
                        snapValue={snapValue}
                        activeTool={activeTool}
                        timeUnit="beats" // ✅ NEW: Arrangement uses beats, not steps
                        className="arr-v2-automation-lane-editor"
                    />
                </div>
            ) : (
                <div className="arr-v2-automation-lanes-empty" style={{ height: AUTOMATION_LANE_HEIGHT }}>
                    <span>No automation lanes available</span>
                </div>
            )}
        </div>
    );
}

export default AutomationLanes;

