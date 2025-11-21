/**
 * Performance Monitoring Utility for Channel Rack
 * Add this to ChannelRack.jsx to measure actual performance
 */

import { useEffect, useRef } from 'react';

export function usePerformanceMonitor(componentName = 'Component') {
    const renderCount = useRef(0);
    const lastRenderTime = useRef(performance.now());
    const fpsHistory = useRef([]);

    useEffect(() => {
        renderCount.current++;
        const now = performance.now();
        const timeSinceLastRender = now - lastRenderTime.current;
        const fps = 1000 / timeSinceLastRender;

        fpsHistory.current.push(fps);
        if (fpsHistory.current.length > 60) {
            fpsHistory.current.shift();
        }

        lastRenderTime.current = now;

        // Log every 60 renders
        if (renderCount.current % 60 === 0) {
            const avgFps = fpsHistory.current.reduce((a, b) => a + b, 0) / fpsHistory.current.length;
            console.log(`[${componentName}] Renders: ${renderCount.current}, Avg FPS: ${avgFps.toFixed(1)}`);
        }
    });

    return renderCount.current;
}

// Usage in ChannelRack.jsx:
// const renderCount = usePerformanceMonitor('ChannelRack');
