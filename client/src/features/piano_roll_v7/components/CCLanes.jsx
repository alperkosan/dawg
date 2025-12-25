/**
 * CC Lanes Component - Refactored to use shared AutomationLaneEditor
 * 
 * ✅ NEW: Uses shared AutomationLaneEditor component and useAutomationEditor hook
 * This ensures consistency across Piano Roll and Arrangement panel
 */

import React, { useState, useCallback, useEffect } from 'react';
import { AutomationLaneEditor } from '@/components/automation/AutomationLaneEditor';
import { useAutomationEditor } from '@/hooks/useAutomationEditor';
import { useArrangementStore } from '@/store/useArrangementStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import './CCLanes.css';

const CC_LANE_HEIGHT = 80;
const KEYBOARD_WIDTH = 80;

/**
 * CC Lanes Component
 * Wrapper around shared AutomationLaneEditor for Piano Roll
 * ✅ NEW: Uses shared useAutomationEditor hook
 */
function CCLanes({
    lanes = [], // Array of AutomationLane instances (legacy prop - will be replaced by hook)
    selectedNoteIds = [],
    onLaneChange, // (laneId, lane) => void (legacy - will be replaced by hook)
    onPointAdd, // (laneId, time, value) => void (legacy - will be replaced by hook)
    onPointRemove, // (laneId, pointIndex) => void (legacy - will be replaced by hook)
    onPointUpdate, // (laneId, pointIndex, updates) => void (legacy - will be replaced by hook)
    onScroll, // (deltaX, deltaY) => void - Scroll callback to sync with Piano Roll
    dimensions,
    viewport,
    activeTool = 'select',
    snapValue = 1,
    instrumentId = null // ✅ NEW: Accept instrumentId as prop (from PianoRoll)
}) {
    // Get active pattern and instrument
    const activePatternId = useArrangementStore(state => state.activePatternId);
    // ✅ FIX: Use prop instrumentId if provided, otherwise fall back to store
    const currentInstrumentFromStore = useInstrumentsStore(state => state.currentInstrument);
    const currentInstrument = instrumentId 
        ? useInstrumentsStore(state => state.instruments.find(inst => inst.id === instrumentId))
        : currentInstrumentFromStore;

    // ✅ NEW: Use shared automation editor hook
    // ✅ FIX: Memoize onLanesChange callback to prevent infinite loops
    // ✅ FIX: Use queueMicrotask to avoid React render-phase state updates
    const handleLanesChange = useCallback((updatedLanes) => {
        // Sync with legacy onLaneChange callback if provided
        // Use queueMicrotask to ensure this runs after render
        queueMicrotask(() => {
            if (onLaneChange && updatedLanes.length > 0) {
                updatedLanes.forEach(lane => {
                    onLaneChange(lane.id || lane.ccNumber, lane);
                });
            }
        });
    }, [onLaneChange]);

    const {
        lanes: hookLanes,
        selectedLane,
        selectedLaneIndex,
        setSelectedLaneIndex,
        handlePointAdd: hookHandlePointAdd,
        handlePointUpdate: hookHandlePointUpdate,
        handlePointRemove: hookHandlePointRemove
    } = useAutomationEditor({
        patternId: activePatternId,
        instrumentId: currentInstrument?.id,
        timeUnit: 'steps', // Piano Roll uses steps
        onLanesChange: handleLanesChange
    });

    // Use hook lanes if available, otherwise fall back to prop lanes (backward compatibility)
    const effectiveLanes = hookLanes.length > 0 ? hookLanes : lanes;
    const effectiveSelectedLane = selectedLane || effectiveLanes[selectedLaneIndex] || null;
    
    // ✅ DEBUG: Log lane state
    useEffect(() => {
        console.log('🎚️ CCLanes: Lane state', { 
            hookLanesLength: hookLanes.length, 
            propLanesLength: lanes.length,
            effectiveLanesLength: effectiveLanes.length,
            selectedLaneIndex,
            hasSelectedLane: !!selectedLane,
            hasEffectiveSelectedLane: !!effectiveSelectedLane,
            selectedLanePoints: selectedLane?.getPoints().length,
            effectiveSelectedLanePoints: effectiveSelectedLane?.getPoints().length
        });
    }, [hookLanes, lanes, effectiveLanes, selectedLaneIndex, selectedLane, effectiveSelectedLane]);

    // ✅ FIX: Always use hook handlers when available (hook manages state internally)
    // Legacy callbacks are only used as fallback for backward compatibility
    const handlePointAdd = useCallback((time, value) => {
        console.log('🎚️ CCLanes: handlePointAdd called', { 
            hasHookHandlePointAdd: !!hookHandlePointAdd, 
            activePatternId, 
            instrumentId: currentInstrument?.id,
            hasEffectiveSelectedLane: !!effectiveSelectedLane,
            hasOnPointAdd: !!onPointAdd,
            effectiveSelectedLaneId: effectiveSelectedLane?.id,
            effectiveSelectedLaneCCNumber: effectiveSelectedLane?.ccNumber
        });
        
        // ✅ FIX: If hook is available and instrumentId exists, use hook
        // Otherwise, use legacy callback with effectiveSelectedLane
        if (hookHandlePointAdd && activePatternId && currentInstrument?.id) {
            // Use hook handler (manages state internally, no render-phase updates)
            console.log('🎚️ CCLanes: Using hook handler');
            hookHandlePointAdd(time, value);
        } else if (effectiveSelectedLane && onPointAdd) {
            // Fall back to legacy callback (wrap in queueMicrotask to avoid render-phase updates)
            console.log('🎚️ CCLanes: Using legacy callback', { 
                laneId: effectiveSelectedLane.id, 
                ccNumber: effectiveSelectedLane.ccNumber 
            });
            queueMicrotask(() => {
                onPointAdd(effectiveSelectedLane.id || effectiveSelectedLane.ccNumber, time, value);
            });
        } else {
            console.warn('🎚️ CCLanes: No handler available for point add');
        }
    }, [hookHandlePointAdd, effectiveSelectedLane, onPointAdd, activePatternId, currentInstrument]);

    const handlePointUpdate = useCallback((pointIndex, updates) => {
        if (hookHandlePointUpdate && activePatternId && currentInstrument?.id) {
            // Use hook handler (manages state internally, no render-phase updates)
            hookHandlePointUpdate(pointIndex, updates);
        } else if (effectiveSelectedLane && onPointUpdate) {
            // Fall back to legacy callback (wrap in queueMicrotask to avoid render-phase updates)
            queueMicrotask(() => {
                onPointUpdate(effectiveSelectedLane.id || effectiveSelectedLane.ccNumber, pointIndex, updates);
            });
        }
    }, [hookHandlePointUpdate, effectiveSelectedLane, onPointUpdate, activePatternId, currentInstrument]);

    const handlePointRemove = useCallback((pointIndex) => {
        if (hookHandlePointRemove && activePatternId && currentInstrument?.id) {
            // Use hook handler (manages state internally, no render-phase updates)
            hookHandlePointRemove(pointIndex);
        } else if (effectiveSelectedLane && onPointRemove) {
            // Fall back to legacy callback (wrap in queueMicrotask to avoid render-phase updates)
            queueMicrotask(() => {
                onPointRemove(effectiveSelectedLane.id || effectiveSelectedLane.ccNumber, pointIndex);
            });
        }
    }, [hookHandlePointRemove, effectiveSelectedLane, onPointRemove, activePatternId, currentInstrument]);

    // Handle scroll (pass to parent)
    const handleScroll = useCallback((e) => {
        if (onScroll) {
            onScroll(e.deltaX, e.deltaY);
        }
    }, [onScroll]);

    return (
        <div className="cc-lanes">
            <div className="cc-lanes-header">
                <div className="cc-lanes-label">
                    <span>Automation</span>
                </div>
                <div className="cc-lanes-selector">
                    <select
                        value={selectedLaneIndex}
                        onChange={(e) => setSelectedLaneIndex(parseInt(e.target.value))}
                        className="cc-lane-select"
                    >
                        {effectiveLanes.map((lane, index) => (
                            <option key={index} value={index}>
                                {lane.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {/* ✅ NEW: Use shared AutomationLaneEditor component */}
            {effectiveSelectedLane ? (
                <div 
                    className="cc-lanes-editor-container"
                    style={{ height: CC_LANE_HEIGHT, width: '100%' }}
                    onWheel={handleScroll}
                >
                    <AutomationLaneEditor
                        lane={effectiveSelectedLane}
                        dimensions={dimensions}
                        viewport={viewport}
                        onPointAdd={handlePointAdd}
                        onPointUpdate={handlePointUpdate}
                        onPointRemove={handlePointRemove}
                        keyboardWidth={KEYBOARD_WIDTH}
                        showGrid={true}
                        snapValue={snapValue}
                        activeTool={activeTool}
                        timeUnit="steps" // Piano Roll uses steps
                        className="cc-lanes-editor"
                    />
                </div>
            ) : (
                <div className="cc-lanes-empty" style={{ height: CC_LANE_HEIGHT }}>
                    <span>No automation lanes available</span>
                </div>
            )}
        </div>
    );
}

export default React.memo(CCLanes);
