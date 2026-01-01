
// src/features/piano_roll_v5/usePianoRollEngine.js
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { AudioContextService } from '@/lib/services/AudioContextService';
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

export function usePianoRollEngine(containerRef, playbackControls = {}) {
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const [snapValue, setSnapValue] = useState(4); // default to 1/4 grid

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

    // Transport position setter from parent
    const { setTransportPosition } = playbackControls;

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
            UPDATE_PRIORITIES.LOW, // Can defer if frame budget exceeded
            UPDATE_FREQUENCIES.REALTIME // 60fps attempt - frame budget protects
        );

        return () => {
            unsubscribe();
            console.log('🎹 PianoRoll: Stopped UIUpdateManager-based viewport animation');
        };
    }, []);

    const handleWheel = useCallback((e) => {
        // ✅ UX FIX 1 & 5: Ctrl + wheel (zoom) has priority over Alt
        // This allows Ctrl + Alt + wheel to work for zoom
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const { deltaY, offsetX, offsetY } = e;
            const vp = viewportRef.current;

            const zoomFactor = 1 - deltaY * 0.005;
            const newZoomX = Math.max(MIN_ZOOM_X, Math.min(MAX_ZOOM_X, vp.zoomX * zoomFactor));
            const newZoomY = Math.max(MIN_ZOOM_Y, Math.min(MAX_ZOOM_Y, vp.zoomY * zoomFactor));
            const mouseX = offsetX - KEYBOARD_WIDTH;
            const mouseY = offsetY - RULER_HEIGHT;

            // ✅ FIX: scrollX is stored in screen coordinates
            // After translate(-scrollX), screen x=0 corresponds to world x=scrollX
            // Screen x=mouseX corresponds to world x=scrollX + mouseX
            // To keep the same world point under the mouse after zoom:
            // Current: worldX = scrollX + mouseX (scrollX in screen, mouseX in screen)
            // After zoom: stepWidth changes, but worldX should stay the same
            // newScrollX + mouseX = worldX = scrollX + mouseX
            // newScrollX = scrollX (scrollX stays in screen coordinates)
            // But wait, we need to account for zoom change in world coordinates
            // Current worldX = (scrollX + mouseX) / oldZoomX * BASE_STEP_WIDTH
            // New worldX should be same: (newScrollX + mouseX) / newZoomX * BASE_STEP_WIDTH
            // So: (scrollX + mouseX) / oldZoomX = (newScrollX + mouseX) / newZoomX
            // newScrollX = (scrollX + mouseX) * (newZoomX / oldZoomX) - mouseX
            const worldX = (vp.scrollX + mouseX) / vp.zoomX;
            const worldY = (vp.scrollY + mouseY) / vp.zoomY;

            // Keep the same world point under the mouse (convert back to screen coordinates)
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
            return;
        }

        // ✅ UX FIX: Don't scroll when Alt is pressed (used for velocity adjustment)
        // But only if Ctrl is not pressed (Ctrl has priority)
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        e.preventDefault();
        const { deltaX, deltaY } = e;
        const vp = viewportRef.current;

        // Normal scroll (no modifiers)
        {
            // ✅ FIX: scrollX is stored in screen coordinates for scroll operations
            // deltaX is screen pixels, so we can add directly
            // Renderer will convert to world coordinates when needed via translate
            vp.targetScrollX += deltaX;
            vp.targetScrollY += deltaY;
        }

        // ✅ FIX: maxScrollX should be in screen coordinates (same as scrollX)
        // totalWidth is in world coordinates (includes zoomX)
        // maxScrollX = totalWidth - viewportWidth (both in same units)
        // Since scrollX is in screen coordinates, maxScrollX should also be in screen coordinates
        // But totalWidth is world coordinates, so we need to convert
        // Actually, maxScrollX = totalWidth - viewportWidth, both should be in same units
        // If scrollX is screen, then maxScrollX should be screen too
        // But totalWidth is world, so: maxScrollX (screen) = totalWidth (world) - viewportWidth (screen)
        // This doesn't work! We need scrollX and maxScrollX in same units
        // Solution: Keep scrollX in screen coordinates, but maxScrollX calculation needs adjustment
        const totalWidth = TOTAL_BARS * STEPS_PER_BAR * BASE_STEP_WIDTH * vp.targetZoomX;
        const totalHeight = TOTAL_KEYS * BASE_KEY_HEIGHT * vp.targetZoomY;
        // scrollX is in screen coordinates, so maxScrollX should be screen coordinates too
        // totalWidth is world coordinates, viewportWidth is screen coordinates
        // maxScrollX (screen) = totalWidth (world) - viewportWidth (screen) doesn't work
        // We need to keep scrollX in screen coordinates, so maxScrollX = totalWidth - viewportWidth
        // But this only works if totalWidth and viewportWidth are in same units
        // Actually, scrollX represents the screen offset, so maxScrollX = totalWidth - viewportWidth
        // where both are in screen pixels (1:1 mapping after translate)
        const maxScrollX = Math.max(0, totalWidth - (viewportSize.width - KEYBOARD_WIDTH));
        const maxScrollY = Math.max(0, totalHeight - (viewportSize.height - RULER_HEIGHT));
        vp.targetScrollX = Math.max(0, Math.min(maxScrollX, vp.targetScrollX));
        vp.targetScrollY = Math.max(0, Math.min(maxScrollY, vp.targetScrollY));
    }, [viewportSize.width, viewportSize.height]);

    const handleMouseDown = useCallback((e) => {
        const { offsetY, offsetX, button } = e;
        const vp = viewportRef.current;
        if (offsetY <= RULER_HEIGHT && button === 0) {
            const mouseX = offsetX - KEYBOARD_WIDTH;
            // ✅ FIX: scrollX is in screen coordinates
            // After translate(-scrollX), screen x=mouseX corresponds to world x=scrollX + mouseX
            // But scrollX is screen, so worldX = scrollX + mouseX (both screen, but after translate they map to world)
            // Actually, after translate(-scrollX), screen x=0 maps to world x=scrollX
            // So screen x=mouseX maps to world x=scrollX + mouseX
            // But scrollX is screen pixels, so we need to convert to world: worldX = (scrollX + mouseX) / zoomX * BASE_STEP_WIDTH / BASE_STEP_WIDTH
            // Actually simpler: worldX = scrollX + mouseX (after translate, 1:1 mapping)
            // Then convert to step: step = worldX / stepWidth = (scrollX + mouseX) / (BASE_STEP_WIDTH * zoomX)
            const worldX = vp.scrollX + mouseX; // After translate, screen and world are 1:1
            const stepWidth = BASE_STEP_WIDTH * vp.zoomX;
            const step = Math.floor(worldX / stepWidth);

            // ✅ UNIFIED TIMELINE CONTROL: Use TransportController for consistent behavior
            try {
                // Use the new TransportController via AudioContextService
                const transportController = AudioContextService.getTransportController();
                transportController.jumpToStep(step, { updateUI: true });
            } catch (error) {
                console.warn('TransportController not available, using fallback:', error);

                // Fallback to legacy behavior
                if (setTransportPosition) {
                    const beatPosition = step / 4;
                    const bar = Math.floor(beatPosition / 4);
                    const beat = Math.floor(beatPosition % 4);
                    const tick = Math.floor((beatPosition % 1) * 480);
                    const transportPos = `${bar + 1}:${beat + 1}:${tick} `;
                    setTransportPosition(transportPos, step);
                } else {
                    isSettingLoopRef.current = true;
                    loopStartPointRef.current = step;
                    setLoopRegion(step, step + 1);
                }
            }
            return;
        }
        if (button === 1) {
            isPanningRef.current = true;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            // ✅ REMOVED: Cursor management now handled by PianoRollCursorManager
            // e.target.style.cursor = 'grabbing';
        }
    }, [setLoopRegion, setTransportPosition]);

    const handleMouseMove = useCallback((e) => {
        const vp = viewportRef.current;
        if (isSettingLoopRef.current) {
            const { offsetX } = e;
            const mouseX = offsetX - KEYBOARD_WIDTH;
            // ✅ FIX: scrollX is in screen coordinates
            // After translate(-scrollX), screen x=mouseX corresponds to world x=scrollX + mouseX
            const worldX = vp.scrollX + mouseX; // After translate, screen and world are 1:1
            const stepWidth = BASE_STEP_WIDTH * vp.zoomX;
            const currentStep = Math.floor(worldX / stepWidth);
            setLoopRegion(loopStartPointRef.current, currentStep);
            return;
        }
        if (isPanningRef.current) {
            const deltaX = e.clientX - lastMousePosRef.current.x;
            const deltaY = e.clientY - lastMousePosRef.current.y;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            // ✅ FIX: scrollX is in screen coordinates, pan by delta directly
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
            // ✅ REMOVED: Cursor management now handled by PianoRollCursorManager
            // e.target.style.cursor = 'grab';
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
        // Adjusted thresholds for earlier optimization
        if (stepWidth < 2) return 4;   // Ultra zoomed out
        if (stepWidth < 5) return 3;   // Very zoomed out
        if (stepWidth < 15) return 2;  // Zoomed out (Flat colors)
        if (stepWidth < 30) return 1;  // Normal/Slightly zoomed out (No shadows)
        return 0; // High detail
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

    // --- Touch handling for 2-finger zoom/pan ---
    const lastTouchRef = useRef({ dist: 0, x: 0, y: 0 });

    const handleTouchStart = useCallback((e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const cx = (t1.clientX + t2.clientX) / 2;
            const cy = (t1.clientY + t2.clientY) / 2;
            lastTouchRef.current = { dist, x: cx, y: cy };
        }
    }, []);

    const handleTouchMove = useCallback((e) => {
        // Prevent default scrolling for all touch events in canvas
        if (e.cancelable) e.preventDefault();

        if (e.touches.length === 2) {
            const vp = viewportRef.current;
            const t1 = e.touches[0];
            const t2 = e.touches[1];

            const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const cx = (t1.clientX + t2.clientX) / 2;
            const cy = (t1.clientY + t2.clientY) / 2;

            // Pan
            const dx = cx - lastTouchRef.current.x;
            const dy = cy - lastTouchRef.current.y;

            // Apply pan
            vp.targetScrollX -= dx;
            vp.targetScrollY -= dy;

            // Zoom
            if (lastTouchRef.current.dist > 0) {
                const scale = dist / lastTouchRef.current.dist;

                // Limit zoom speed
                const smoothedScale = 1 + (scale - 1) * 0.8;

                const newZoomX = Math.max(MIN_ZOOM_X, Math.min(MAX_ZOOM_X, vp.targetZoomX * smoothedScale));
                const newZoomY = Math.max(MIN_ZOOM_Y, Math.min(MAX_ZOOM_Y, vp.targetZoomY * smoothedScale));

                // TODO: Center zoom on touch midpoint (complex math, simplified here)
                vp.targetZoomX = newZoomX;
                vp.targetZoomY = newZoomY;
            }

            lastTouchRef.current = { dist, x: cx, y: cy };
            setRenderTrigger(Date.now());
        }
    }, []);

    const handleTouchEnd = useCallback((e) => {
        // Cleanup if needed
    }, []);

    // ✅ PHASE 1: Follow Playhead Mode - Programmatic viewport control
    const updateViewport = useCallback(({ scrollX, scrollY, smooth = true }) => {
        const vp = viewportRef.current;

        if (scrollX !== undefined) {
            const maxScrollX = Math.max(0, dimensions.totalWidth - viewportSize.width);
            const clampedScrollX = Math.max(0, Math.min(maxScrollX, scrollX));

            if (smooth) {
                // Smooth scroll: Only update target, let UIUpdateManager interpolate
                vp.targetScrollX = clampedScrollX;
            } else {
                // Instant scroll: Update both current and target
                vp.scrollX = clampedScrollX;
                vp.targetScrollX = clampedScrollX;
            }
        }
        if (scrollY !== undefined) {
            const maxScrollY = Math.max(0, dimensions.totalHeight - viewportSize.height);
            const clampedScrollY = Math.max(0, Math.min(maxScrollY, scrollY));

            if (smooth) {
                vp.targetScrollY = clampedScrollY;
            } else {
                vp.scrollY = clampedScrollY;
                vp.targetScrollY = clampedScrollY;
            }
        }
    }, [dimensions, viewportSize]);

    // Attach non-passive listeners for touch
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('touchstart', handleTouchStart, { passive: false });
            container.addEventListener('touchmove', handleTouchMove, { passive: false });
            container.addEventListener('touchend', handleTouchEnd);
            return () => {
                container.removeEventListener('touchstart', handleTouchStart);
                container.removeEventListener('touchmove', handleTouchMove);
                container.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

    return {
        viewport: { ...viewportData, width: viewportSize.width, height: viewportSize.height, visibleSteps, visibleKeys },
        dimensions,
        lod,
        snapValue,
        setSnapValue,
        eventHandlers: {
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseUp,
            // Touch events are attached via ref/effect, but we can expose them if needed 
            // via React props if we prefer that over addEventListener
            // But addEventListener { passive: false } is required for e.preventDefault()
            updateViewport
        }
    };
}