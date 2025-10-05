// src/features/piano_roll_v5/usePianoRollEngine.js
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {usePlaybackStore} from '@/store/usePlaybackStore';
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from '@/lib/core/UIUpdateManager.js';

// --- SABİTLER VE LİMİTLER ---
const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;
const TOTAL_KEYS = 128;
const STEPS_PER_BAR = 16;
const TOTAL_BARS = 1000;
const BASE_STEP_WIDTH = 40;
const BASE_KEY_HEIGHT = 20;
const MIN_ZOOM_X = 0.05;
const MAX_ZOOM_X = 20.0;
const MIN_ZOOM_Y = 1.0;
const MAX_ZOOM_Y = 2.5;
const SMOOTHNESS = 0.2; // Yumuşaklık faktörü

export function usePianoRollEngine(containerRef) {
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const [snapValue, setSnapValue] = useState(1); // 1 = 1/16, 4 = 1/4 etc.

    const viewportRef = useRef({
        scrollX: 0, scrollY: 0, zoomX: 1.0, zoomY: 1.0,
        targetScrollX: 0, targetScrollY: 0, targetZoomX: 1.0, targetZoomY: 1.0
    });

    const hasSetInitialScrollRef = useRef(false);
    
    const [, setRenderTrigger] = useState(0);
    const isPanningRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const isSettingLoopRef = useRef(false);
    const loopStartPointRef = useRef(0);
    const { setLoopRegion } = usePlaybackStore.getState();

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const resizeObserver = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setViewportSize({ width, height });

            // Set initial scroll to C4 (MIDI note 60) on first load
            if (!hasSetInitialScrollRef.current && width > 0 && height > 0) {
                const C4_MIDI_NOTE = 60;
                const keyHeight = BASE_KEY_HEIGHT * viewportRef.current.zoomY;
                const totalHeight = TOTAL_KEYS * keyHeight;

                // Calculate Y position of C4 (piano keys are inverted: 127 at top, 0 at bottom)
                const c4YPosition = (127 - C4_MIDI_NOTE) * keyHeight;

                // Center C4 in viewport
                const initialScrollY = c4YPosition - ((height - RULER_HEIGHT) / 2);
                const maxScrollY = Math.max(0, totalHeight - (height - RULER_HEIGHT));
                const clampedScrollY = Math.max(0, Math.min(maxScrollY, initialScrollY));

                viewportRef.current.scrollY = clampedScrollY;
                viewportRef.current.targetScrollY = clampedScrollY;
                hasSetInitialScrollRef.current = true;

                setRenderTrigger(Date.now());
            }
        });
        resizeObserver.observe(container);
        setViewportSize({ width: container.clientWidth, height: container.clientHeight });
        return () => resizeObserver.disconnect();
    }, [containerRef]);

    useEffect(() => {
        console.log('🎹 PianoRoll: Starting UIUpdateManager-based viewport animation');

        // Subscribe to UIUpdateManager for smooth viewport animations
        const unsubscribe = uiUpdateManager.subscribe(
            'piano-roll-viewport-animation',
            (currentTime, frameTime) => {
                const vp = viewportRef.current;
                let needsRender = false;
                const dx = vp.targetScrollX - vp.scrollX;
                const dy = vp.targetScrollY - vp.scrollY;
                const dZoomX = vp.targetZoomX - vp.zoomX;
                const dZoomY = vp.targetZoomY - vp.zoomY;

                if (Math.abs(dx) > 0.1) { vp.scrollX += dx * SMOOTHNESS; needsRender = true; }
                else { vp.scrollX = vp.targetScrollX; }

                if (Math.abs(dy) > 0.1) { vp.scrollY += dy * SMOOTHNESS; needsRender = true; }
                else { vp.scrollY = vp.targetScrollY; }

                if (Math.abs(dZoomX) > 0.001) { vp.zoomX += dZoomX * SMOOTHNESS; needsRender = true; }
                else { vp.zoomX = vp.targetZoomX; }

                if (Math.abs(dZoomY) > 0.001) { vp.zoomY += dZoomY * SMOOTHNESS; needsRender = true; }
                else { vp.zoomY = vp.targetZoomY; }

                if (needsRender) {
                    setRenderTrigger(Date.now()); // Use timestamp to guarantee re-render
                }
            },
            UPDATE_PRIORITIES.NORMAL,
            UPDATE_FREQUENCIES.REALTIME
        );

        return () => {
            unsubscribe();
            console.log('🎹 PianoRoll: Stopped UIUpdateManager-based viewport animation');
        };
    }, []);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const { deltaX, deltaY, ctrlKey, offsetX, offsetY } = e;
        const vp = viewportRef.current;

        if (ctrlKey) {
            const zoomFactor = 1 - deltaY * 0.005;
            const newZoomX = Math.max(MIN_ZOOM_X, Math.min(MAX_ZOOM_X, vp.zoomX * zoomFactor));
            const newZoomY = Math.max(MIN_ZOOM_Y, Math.min(MAX_ZOOM_Y, vp.zoomY * zoomFactor));
            const mouseX = offsetX - KEYBOARD_WIDTH;
            const mouseY = offsetY - RULER_HEIGHT;

            // Mouse altındaki dünya koordinatını hesapla (current değerlerle)
            const worldX = (vp.scrollX + mouseX) / vp.zoomX;
            const worldY = (vp.scrollY + mouseY) / vp.zoomY;

            // Yeni scroll pozisyonunu hesapla
            const newScrollX = (worldX * newZoomX) - mouseX;
            const newScrollY = (worldY * newZoomY) - mouseY;

            // Animasyon yerine direkt değerleri güncelle (zoom sırasında smooth animation'ı devre dışı bırak)
            vp.scrollX = newScrollX;
            vp.scrollY = newScrollY;
            vp.zoomX = newZoomX;
            vp.zoomY = newZoomY;
            vp.targetScrollX = newScrollX;
            vp.targetScrollY = newScrollY;
            vp.targetZoomX = newZoomX;
            vp.targetZoomY = newZoomY;

            // Immediate render trigger for zoom changes
            setRenderTrigger(Date.now());
        } else {
            vp.targetScrollX += deltaX;
            vp.targetScrollY += deltaY;
        }

        const totalWidth = TOTAL_BARS * STEPS_PER_BAR * BASE_STEP_WIDTH * vp.targetZoomX;
        const totalHeight = TOTAL_KEYS * BASE_KEY_HEIGHT * vp.targetZoomY;
        const maxScrollX = Math.max(0, totalWidth - (viewportSize.width - KEYBOARD_WIDTH));
        const maxScrollY = Math.max(0, totalHeight - (viewportSize.height - RULER_HEIGHT));
        vp.targetScrollX = Math.max(0, Math.min(maxScrollX, vp.targetScrollX));
        vp.targetScrollY = Math.max(0, Math.min(maxScrollY, vp.targetScrollY));
    }, [viewportSize.width, viewportSize.height]);

    const handleMouseDown = useCallback((e) => {
        const { offsetY, offsetX, button } = e;
        const vp = viewportRef.current;
        if (offsetY <= RULER_HEIGHT && button === 0) {
            isSettingLoopRef.current = true;
            const mouseX = offsetX - KEYBOARD_WIDTH;
            const worldX = (vp.scrollX + mouseX) / vp.zoomX;
            const step = Math.floor(worldX / BASE_STEP_WIDTH);
            loopStartPointRef.current = step;
            setLoopRegion(step, step + 1);
            return;
        }
        if (button === 1) {
            isPanningRef.current = true;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            e.target.style.cursor = 'grabbing';
        }
    }, [setLoopRegion]);

    const handleMouseMove = useCallback((e) => {
        const vp = viewportRef.current;
        if (isSettingLoopRef.current) {
            const { offsetX } = e;
            const mouseX = offsetX - KEYBOARD_WIDTH;
            const worldX = (vp.scrollX + mouseX) / vp.zoomX;
            const currentStep = Math.floor(worldX / BASE_STEP_WIDTH);
            setLoopRegion(loopStartPointRef.current, currentStep);
            return;
        }
        if (isPanningRef.current) {
            const deltaX = e.clientX - lastMousePosRef.current.x;
            const deltaY = e.clientY - lastMousePosRef.current.y;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            vp.targetScrollX -= deltaX;
            vp.targetScrollY -= deltaY;
            const totalWidth = TOTAL_BARS * STEPS_PER_BAR * BASE_STEP_WIDTH * vp.targetZoomX;
            const totalHeight = TOTAL_KEYS * BASE_KEY_HEIGHT * vp.targetZoomY;
            const maxScrollX = Math.max(0, totalWidth - (viewportSize.width - KEYBOARD_WIDTH));
            const maxScrollY = Math.max(0, totalHeight - (viewportSize.height - RULER_HEIGHT));
            vp.targetScrollX = Math.max(0, Math.min(maxScrollX, vp.targetScrollX));
            vp.targetScrollY = Math.max(0, Math.min(maxScrollY, vp.targetScrollY));
        }
    }, [viewportSize.width, viewportSize.height, setLoopRegion]);

    const handleMouseUp = useCallback((e) => {
        if (isSettingLoopRef.current) isSettingLoopRef.current = false;
        if (e.button === 1) {
            isPanningRef.current = false;
            e.target.style.cursor = 'grab';
        }
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (container) container.addEventListener('wheel', handleWheel, { passive: false });
        return () => { if (container) container.removeEventListener('wheel', handleWheel); };
    }, [containerRef, handleWheel]);

    const viewportData = viewportRef.current;
    
    const dimensions = useMemo(() => {
        const stepWidth = BASE_STEP_WIDTH * viewportData.zoomX;
        const keyHeight = BASE_KEY_HEIGHT * viewportData.zoomY;
        const totalSteps = TOTAL_BARS * STEPS_PER_BAR;
        return {
            keyHeight, stepWidth,
            totalKeys: TOTAL_KEYS, totalSteps,
            totalWidth: totalSteps * stepWidth,
            totalHeight: TOTAL_KEYS * keyHeight,
        };
    }, [viewportData.zoomX, viewportData.zoomY]);
    
    const lod = useMemo(() => {
        const stepWidth = BASE_STEP_WIDTH * viewportData.zoomX;
        if (stepWidth < 0.2) return 4;
        if (stepWidth < 0.8) return 3;
        if (stepWidth < 2.5) return 2;
        if (stepWidth < 10) return 1;
        return 0;
    }, [viewportData.zoomX]);

    const visibleSteps = useMemo(() => {
        if (!dimensions.stepWidth) return { startStep: 0, endStep: 0 };
        // ⚡ PERFORMANCE: Minimal buffer (1 step each side) for edge cases only
        const buffer = 1;
        const start = Math.floor(viewportData.scrollX / dimensions.stepWidth) - buffer;
        const end = Math.ceil((viewportData.scrollX + viewportSize.width) / dimensions.stepWidth) + buffer;
        return {
            startStep: Math.max(0, start),
            endStep: Math.min(dimensions.totalSteps, end),
        };
    }, [viewportData.scrollX, viewportSize.width, dimensions.stepWidth, dimensions.totalSteps]);

    const visibleKeys = useMemo(() => {
        if (!dimensions.keyHeight) return { startKey: 0, endKey: 0 };
        // ⚡ PERFORMANCE: Minimal buffer (1 key each side) for edge cases only
        const buffer = 1;
        const start = Math.floor(viewportData.scrollY / dimensions.keyHeight) - buffer;
        const end = Math.ceil((viewportData.scrollY + viewportSize.height) / dimensions.keyHeight) + buffer;
        return {
            startKey: Math.max(0, start),
            endKey: Math.min(dimensions.totalKeys - 1, end),
        };
    }, [viewportData.scrollY, viewportSize.height, dimensions.keyHeight, dimensions.totalKeys]);

    return {
        viewport: { ...viewportData, width: viewportSize.width, height: viewportSize.height, visibleSteps, visibleKeys },
        dimensions,
        lod,
        snapValue,
        setSnapValue,
        eventHandlers: { onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp }
    };
}