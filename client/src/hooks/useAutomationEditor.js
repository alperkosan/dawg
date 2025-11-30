/**
 * 🎚️ USE AUTOMATION EDITOR - Ortak Automation Hook
 *
 * Merkezi automation editing logic'i
 * Piano Roll ve Arrangement panel'de ortak kullanım için
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { getAutomationManager } from '@/lib/automation/AutomationManager';
import { AutomationLane } from '@/features/piano_roll_v7/types/AutomationLane';
import { STEPS_PER_BEAT } from '@/lib/audio/audioRenderConfig';

/**
 * useAutomationEditor - Ortak automation editing hook
 * 
 * @param {Object} options
 * @param {string} options.patternId - Pattern ID
 * @param {string} options.instrumentId - Instrument/Track ID
 * @param {string} options.timeUnit - 'steps' (Piano Roll) or 'beats' (Arrangement)
 * @param {Function} options.onLanesChange - Callback when lanes change
 * @returns {Object} Automation editor state and handlers
 */
export function useAutomationEditor({
    patternId,
    instrumentId,
    timeUnit = 'steps',
    onLanesChange = null
}) {
    const [lanes, setLanes] = useState([]);
    const [selectedLaneIndex, setSelectedLaneIndex] = useState(0);
    const automationManager = getAutomationManager();
    const lanesRef = useRef([]);

    // Store onLanesChange in ref to avoid dependency issues
    const onLanesChangeRef = useRef(onLanesChange);
    useEffect(() => {
        onLanesChangeRef.current = onLanesChange;
    }, [onLanesChange]);

    // Initialize lanes
    useEffect(() => {
        if (!patternId || !instrumentId) {
            setLanes([]);
            lanesRef.current = [];
            return;
        }

        // Get lanes from AutomationManager
        let currentLanes = automationManager.getLanes(patternId, instrumentId) || [];
        console.log('🎚️ useAutomationEditor: Initializing lanes', { patternId, instrumentId, currentLanesLength: currentLanes.length });

        // If no lanes exist, initialize default lanes
        if (currentLanes.length === 0) {
            console.log('🎚️ useAutomationEditor: No lanes found, initializing defaults');
            currentLanes = automationManager.initializeLanes(patternId, instrumentId);
            console.log('🎚️ useAutomationEditor: Default lanes initialized', { lanesLength: currentLanes.length });
        }

        console.log('🎚️ useAutomationEditor: Setting lanes state', { lanesLength: currentLanes.length });
        setLanes(currentLanes);
        lanesRef.current = currentLanes;

        // Subscribe to automation manager changes
        const unsubscribe = automationManager.subscribe((event) => {
            const eventKey = automationManager.getLaneKey(patternId, instrumentId);
            const currentKey = automationManager.getLaneKey(event.patternId || patternId, event.instrumentId || instrumentId);

            if (eventKey === currentKey) {
                const updatedLanes = automationManager.getLanes(patternId, instrumentId) || [];
                
                // Only update if lanes actually changed
                const currentLanesStr = JSON.stringify(lanesRef.current.map(l => ({ id: l.id, ccNumber: l.ccNumber })));
                const updatedLanesStr = JSON.stringify(updatedLanes.map(l => ({ id: l.id, ccNumber: l.ccNumber })));
                
                if (currentLanesStr !== updatedLanesStr) {
                    setLanes(updatedLanes);
                    lanesRef.current = updatedLanes;

                    // ✅ FIX: Use queueMicrotask to avoid React render-phase state updates
                    queueMicrotask(() => {
                        if (onLanesChangeRef.current) {
                            onLanesChangeRef.current(updatedLanes);
                        }
                    });
                }
            }
        });

        return () => {
            unsubscribe();
        };
    }, [patternId, instrumentId]); // ✅ FIX: Removed automationManager and onLanesChange from dependencies

    // ✅ FIX: Get selected lane - use useMemo to ensure it updates when lanes change
    const selectedLane = useMemo(() => {
        return lanes[selectedLaneIndex] || null;
    }, [lanes, selectedLaneIndex]);

    /**
     * Convert time from display units to steps (AutomationLane uses steps)
     */
    const toSteps = useCallback((time) => {
        return timeUnit === 'beats' ? time * STEPS_PER_BEAT : time;
    }, [timeUnit]);

    /**
     * Convert time from steps to display units
     */
    const fromSteps = useCallback((steps) => {
        return timeUnit === 'beats' ? steps / STEPS_PER_BEAT : steps;
    }, [timeUnit]);

    /**
     * Handle point add
     */
    const handlePointAdd = useCallback((time, value) => {
        console.log('🎚️ useAutomationEditor: handlePointAdd called', { time, value, hasSelectedLane: !!selectedLane, patternId, instrumentId, lanesLength: lanes.length });
        
        if (!selectedLane || !patternId || !instrumentId) {
            console.warn('🎚️ useAutomationEditor: handlePointAdd skipped', { hasSelectedLane: !!selectedLane, patternId, instrumentId });
            return;
        }

        // Convert time to steps
        const timeInSteps = toSteps(time);
        console.log('🎚️ useAutomationEditor: Time converted', { time, timeInSteps, timeUnit });

        // ✅ FIX: Clone the lane before mutating to ensure React detects the change
        const laneIndex = selectedLaneIndex;
        const currentLane = lanes[laneIndex];
        if (!currentLane) return;

        // Use the built-in clone method
        const clonedLane = currentLane.clone();

        // Add point to cloned lane
        clonedLane.addPoint(timeInSteps, value);

        // Update lanes array with new lane instance
        const updatedLanes = [...lanes];
        updatedLanes[laneIndex] = clonedLane;
        
        // ✅ DEBUG: Log point addition
        console.log('🎚️ useAutomationEditor: Adding point', { 
            timeInSteps, 
            value, 
            laneIndex, 
            pointsBefore: currentLane.getPoints().length, 
            pointsAfter: clonedLane.getPoints().length,
            updatedLanesLength: updatedLanes.length,
            selectedLaneIndex
        });
        
        automationManager.setLanes(patternId, instrumentId, updatedLanes);

        // Update local state
        console.log('🎚️ useAutomationEditor: Updating lanes state', { lanesLength: lanes.length, updatedLanesLength: updatedLanes.length });
        setLanes(updatedLanes);
        lanesRef.current = updatedLanes;
        
        // ✅ DEBUG: Verify selectedLane will update
        const newSelectedLane = updatedLanes[selectedLaneIndex];
        console.log('🎚️ useAutomationEditor: New selectedLane', { 
            hasLane: !!newSelectedLane, 
            pointsCount: newSelectedLane?.getPoints().length,
            laneId: newSelectedLane?.id,
            ccNumber: newSelectedLane?.ccNumber
        });

        // ✅ FIX: Use queueMicrotask to avoid React render-phase state updates
        queueMicrotask(() => {
            if (onLanesChangeRef.current) {
                onLanesChangeRef.current(updatedLanes);
            }
        });
    }, [selectedLane, selectedLaneIndex, patternId, instrumentId, lanes, timeUnit, toSteps]);

    /**
     * Handle point update
     */
    const handlePointUpdate = useCallback((pointIndex, updates) => {
        if (!selectedLane || !patternId || !instrumentId) return;

        // Convert time to steps if provided
        const updatesInSteps = { ...updates };
        if (updatesInSteps.time !== undefined) {
            updatesInSteps.time = toSteps(updatesInSteps.time);
        }

        // Update point in lane
        selectedLane.updatePoint(pointIndex, updatesInSteps);

        // Update lanes in AutomationManager
        const updatedLanes = [...lanes];
        automationManager.setLanes(patternId, instrumentId, updatedLanes);

        // Update local state
        setLanes(updatedLanes);
        lanesRef.current = updatedLanes;

        // ✅ FIX: Use queueMicrotask to avoid React render-phase state updates
        queueMicrotask(() => {
            if (onLanesChangeRef.current) {
                onLanesChangeRef.current(updatedLanes);
            }
        });
    }, [selectedLane, patternId, instrumentId, lanes, timeUnit, toSteps]);

    /**
     * Handle point remove
     */
    const handlePointRemove = useCallback((pointIndex) => {
        if (!selectedLane || !patternId || !instrumentId) return;

        // ✅ FIX: Clone the lane before mutating
        const laneIndex = selectedLaneIndex;
        const currentLane = lanes[laneIndex];
        if (!currentLane) return;

        // Use the built-in clone method
        const clonedLane = currentLane.clone();

        // Remove point from cloned lane
        clonedLane.removePoint(pointIndex);

        // Update lanes array with new lane instance
        const updatedLanes = [...lanes];
        updatedLanes[laneIndex] = clonedLane;
        
        automationManager.setLanes(patternId, instrumentId, updatedLanes);

        // Update local state
        setLanes(updatedLanes);
        lanesRef.current = updatedLanes;

        // ✅ FIX: Use queueMicrotask to avoid React render-phase state updates
        queueMicrotask(() => {
            if (onLanesChangeRef.current) {
                onLanesChangeRef.current(updatedLanes);
            }
        });
    }, [selectedLane, selectedLaneIndex, patternId, instrumentId, lanes]);

    /**
     * Add new lane
     */
    const addLane = useCallback((ccNumber, name = null) => {
        if (!patternId || !instrumentId) return null;

        const newLane = new AutomationLane(ccNumber, name);
        const updatedLanes = [...lanes, newLane];

        automationManager.setLanes(patternId, instrumentId, updatedLanes);
        setLanes(updatedLanes);
        lanesRef.current = updatedLanes;
        setSelectedLaneIndex(updatedLanes.length - 1);

        // ✅ FIX: Use queueMicrotask to avoid React render-phase state updates
        queueMicrotask(() => {
            if (onLanesChangeRef.current) {
                onLanesChangeRef.current(updatedLanes);
            }
        });

        return newLane;
    }, [patternId, instrumentId, lanes]);

    /**
     * Remove lane
     */
    const removeLane = useCallback((laneIndex) => {
        if (!patternId || !instrumentId || laneIndex < 0 || laneIndex >= lanes.length) return;

        const updatedLanes = lanes.filter((_, index) => index !== laneIndex);
        automationManager.setLanes(patternId, instrumentId, updatedLanes);
        setLanes(updatedLanes);
        lanesRef.current = updatedLanes;

        // Adjust selected index
        if (selectedLaneIndex >= updatedLanes.length) {
            setSelectedLaneIndex(Math.max(0, updatedLanes.length - 1));
        }

        // ✅ FIX: Use queueMicrotask to avoid React render-phase state updates
        queueMicrotask(() => {
            if (onLanesChangeRef.current) {
                onLanesChangeRef.current(updatedLanes);
            }
        });
    }, [patternId, instrumentId, lanes, selectedLaneIndex]);

    /**
     * Update lane properties
     */
    const updateLane = useCallback((laneIndex, updates) => {
        if (!patternId || !instrumentId || laneIndex < 0 || laneIndex >= lanes.length) return;

        const lane = lanes[laneIndex];
        if (!lane) return;

        // Update lane properties
        if (updates.name !== undefined) lane.name = updates.name;
        if (updates.visible !== undefined) lane.visible = updates.visible;
        if (updates.height !== undefined) lane.setHeight(updates.height);
        if (updates.color !== undefined) lane.color = updates.color;

        const updatedLanes = [...lanes];
        automationManager.setLanes(patternId, instrumentId, updatedLanes);
        setLanes(updatedLanes);
        lanesRef.current = updatedLanes;

        // ✅ FIX: Use queueMicrotask to avoid React render-phase state updates
        queueMicrotask(() => {
            if (onLanesChangeRef.current) {
                onLanesChangeRef.current(updatedLanes);
            }
        });
    }, [patternId, instrumentId, lanes]);

    return {
        // State
        lanes,
        selectedLane,
        selectedLaneIndex,
        
        // Actions
        setSelectedLaneIndex,
        handlePointAdd,
        handlePointUpdate,
        handlePointRemove,
        addLane,
        removeLane,
        updateLane,
        
        // Utilities
        toSteps,
        fromSteps
    };
}

export default useAutomationEditor;

