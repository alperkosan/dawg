// src/features/piano_roll_v5/usePianoRollEngine.js
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// --- SABİTLER VE LİMİTLER ---
const RULER_HEIGHT = 30;
const KEYBOARD_WIDTH = 80;
const TOTAL_KEYS = 128;
const STEPS_PER_BAR = 16;
const TOTAL_BARS = 1000;

const MIN_ZOOM_X = 0.05;
const MAX_ZOOM_X = 20.0;
const MIN_ZOOM_Y = 0.5;
const MAX_ZOOM_Y = 5.0;

export function usePianoRollEngine(containerRef) {
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const [viewport, setViewport] = useState({
        scrollX: 0,
        scrollY: 0,
        zoomX: 1.0,
        zoomY: 1.0,
    });
    const isPanningRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });

    // Konteyner boyutunu dinle
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setViewportSize({ width, height });
        });

        resizeObserver.observe(container);
        // İlk boyutları ayarla
        setViewportSize({ width: container.clientWidth, height: container.clientHeight });

        return () => resizeObserver.disconnect();
    }, [containerRef]);

    // Boyutlar ve hesaplamalar (Memoized)
    const dimensions = useMemo(() => {
        const baseStepWidth = 40;
        const baseKeyHeight = 20;

        return {
            keyHeight: baseKeyHeight * viewport.zoomY,
            stepWidth: baseStepWidth * viewport.zoomX,
            totalKeys: TOTAL_KEYS,
            totalSteps: TOTAL_BARS * STEPS_PER_BAR,
            totalWidth: TOTAL_BARS * STEPS_PER_BAR * (baseStepWidth * viewport.zoomX),
            totalHeight: TOTAL_KEYS * (baseKeyHeight * viewport.zoomY),
        };
    }, [viewport.zoomX, viewport.zoomY]);

    const lod = useMemo(() => {
        if (viewport.zoomX < 0.2) return 3; // Sadece bar'lar
        if (viewport.zoomX < 0.8) return 2; // Bar ve beat'ler
        if (viewport.zoomX < 2.5) return 1; // 16'lıklar
        return 0; // Tüm detaylar
    }, [viewport.zoomX]);

    const visibleSteps = useMemo(() => {
        const buffer = 5; // Ekstra çizim alanı
        const start = Math.floor(viewport.scrollX / dimensions.stepWidth) - buffer;
        const end = Math.ceil((viewport.scrollX + viewportSize.width) / dimensions.stepWidth) + buffer;
        return {
            startStep: Math.max(0, start),
            endStep: Math.min(dimensions.totalSteps, end),
        };
    }, [viewport.scrollX, viewportSize.width, dimensions.stepWidth, dimensions.totalSteps]);

    const visibleKeys = useMemo(() => {
        const buffer = 5;
        const start = Math.floor(viewport.scrollY / dimensions.keyHeight) - buffer;
        const end = Math.ceil((viewport.scrollY + viewportSize.height) / dimensions.keyHeight) + buffer;
        return {
            startKey: Math.max(0, start),
            endKey: Math.min(dimensions.totalKeys - 1, end),
        };
    }, [viewport.scrollY, viewportSize.height, dimensions.keyHeight, dimensions.totalKeys]);

    // Olay Yöneticileri (Event Handlers)
    // --- YENİ VE GÜNCELLENMİŞ OLAY YÖNETİCİLERİ ---

    // handleWheel fonksiyonu artık dimensions ve viewportSize'ı doğrudan argüman olarak alabilir
    // ya da state'e erişim için bir ref kullanabiliriz. Şimdilik state'e erişim için
    // state'i güncelleyen fonksiyonları useCallback içine alacağız.
    const handleWheel = useCallback((e) => {
        // e.preventDefault() burada güvenle çağrılabilir çünkü listener'ı {passive: false} ile ekleyeceğiz.
        e.preventDefault();
        const { deltaX, deltaY, ctrlKey } = e;

        setViewport(prev => {
            if (ctrlKey) { // ZOOM
                const zoomFactor = 1 - deltaY * 0.005; // Hassasiyeti biraz azalttık
                const newZoomX = Math.max(MIN_ZOOM_X, Math.min(MAX_ZOOM_X, prev.zoomX * zoomFactor));
                const newZoomY = Math.max(MIN_ZOOM_Y, Math.min(MAX_ZOOM_Y, prev.zoomY * zoomFactor));
                return { ...prev, zoomX: newZoomX, zoomY: newZoomY };
            } else { // PAN
                // dimensions ve viewportSize'ın güncel değerlerine ihtiyacımız var.
                // Bu değerler hook'un dışında değiştiği için, onları setViewport içinde tekrar hesaplamalıyız.
                const currentStepWidth = 40 * prev.zoomX;
                const currentKeyHeight = 20 * prev.zoomY;
                const totalWidth = TOTAL_BARS * STEPS_PER_BAR * currentStepWidth;
                const totalHeight = TOTAL_KEYS * currentKeyHeight;
                const maxScrollX = Math.max(0, totalWidth - viewportSize.width);
                const maxScrollY = Math.max(0, totalHeight - viewportSize.height);

                const newScrollX = Math.max(0, Math.min(maxScrollX, prev.scrollX + deltaX));
                const newScrollY = Math.max(0, Math.min(maxScrollY, prev.scrollY + deltaY));
                return { ...prev, scrollX: newScrollX, scrollY: newScrollY };
            }
        });
    }, [viewportSize.width, viewportSize.height]);

    // Wheel event listener'ını manuel olarak eklemek için useEffect
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (container) {
                container.removeEventListener('wheel', handleWheel);
            }
        };
    }, [containerRef, handleWheel]);


    // Mouse pan işlemleri için olan fonksiyonlarda değişiklik yok
    const handleMouseDown = useCallback((e) => {
        if (e.button === 1) {
            isPanningRef.current = true;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
            e.target.style.cursor = 'grabbing';
        }
    }, []);
    
    const handleMouseMove = useCallback((e) => {
        if (!isPanningRef.current) return;
        const deltaX = e.clientX - lastMousePosRef.current.x;
        const deltaY = e.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    
        setViewport(prev => {
            const maxScrollX = Math.max(0, dimensions.totalWidth - viewportSize.width);
            const maxScrollY = Math.max(0, dimensions.totalHeight - viewportSize.height);
            const newScrollX = Math.max(0, Math.min(maxScrollX, prev.scrollX - deltaX));
            const newScrollY = Math.max(0, Math.min(maxScrollY, prev.scrollY - deltaY));
            return { ...prev, scrollX: newScrollX, scrollY: newScrollY };
        });
    }, [dimensions, viewportSize]); // dimensions ve viewportSize'a bağımlı
    
    const handleMouseUp = useCallback((e) => {
        if (e.button === 1) {
            isPanningRef.current = false;
            e.target.style.cursor = 'grab';
        }
    }, []);

    return {
        viewport: {
            ...viewport,
            width: viewportSize.width,
            height: viewportSize.height,
            visibleSteps,
            visibleKeys,
        },
        dimensions,
        lod,
        eventHandlers: {
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseUp,
        }
    };

}