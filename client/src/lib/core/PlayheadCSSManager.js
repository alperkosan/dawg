// src/lib/core/PlayheadCSSManager.js
// ✅ Centralized Playhead Position Management via CSS Variables
// Single RAF loop updates CSS variables that all playhead consumers read from

/**
 * PlayheadCSSManager - Singleton
 * 
 * Updates CSS custom properties for playhead position:
 * - --playhead-step: Current step position (float)
 * - --playhead-pixel: Pixel position for DOM elements
 * - --playhead-playing: 1 if playing, 0 if stopped
 * 
 * Consumers:
 * - Channel Rack: Use CSS transform with var(--playhead-pixel)
 * - Piano Roll: Read --playhead-step for canvas render
 * - Arrangement: Read --playhead-step for canvas render
 */

class PlayheadCSSManager {
    constructor() {
        this.rafId = null;
        this.isRunning = false;
        this.controller = null;
        this.stepWidth = 16; // Default step width in pixels
        this.lastStep = -1;
        this.callbacks = new Set(); // For canvas-based consumers that need render call
    }

    /**
     * Initialize with TransportController
     */
    init(transportController) {
        this.controller = transportController;
        console.log('✅ PlayheadCSSManager initialized');
    }

    /**
     * Set step width for pixel calculations
     */
    setStepWidth(width) {
        this.stepWidth = width;
    }

    /**
     * Start the RAF update loop
     */
    start() {
        if (this.isRunning) return;
        if (!this.controller) {
            console.warn('PlayheadCSSManager: No controller set');
            return;
        }

        this.isRunning = true;
        // ✅ FIX: Use body instead of documentElement to avoid triggering StyleCache observer
        document.body.style.setProperty('--playhead-playing', '1');
        console.log('▶️ PlayheadCSSManager started');
        this._loop();
    }

    /**
     * Stop the RAF loop
     */
    stop() {
        this.isRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        document.body.style.setProperty('--playhead-playing', '0');
        console.log('⏹️ PlayheadCSSManager stopped');
    }

    /**
     * Update position (call when paused/stopped to show current position)
     */
    updatePosition(step) {
        this._setCSSVariables(step);
        this._notifyCallbacks(step);
    }

    /**
     * Subscribe to position updates (for canvas-based renderers)
     * @param {Function} callback - (step: number) => void
     * @returns {Function} unsubscribe function
     */
    subscribe(callback) {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    /**
     * Get current step from CSS variable
     */
    getCurrentStep() {
        // Read from body as we set it there
        const value = getComputedStyle(document.body)
            .getPropertyValue('--playhead-step');
        return parseFloat(value) || 0;
    }

    /**
     * Main animation loop - runs at 60fps
     */
    _loop = () => {
        if (!this.isRunning) return;

        const step = this.controller?.getCurrentStep?.() || 0;

        // Only update if position changed (avoid unnecessary DOM updates)
        if (Math.abs(step - this.lastStep) > 0.001) {
            this._setCSSVariables(step);
            this._notifyCallbacks(step);
            this.lastStep = step;
        }

        this.rafId = requestAnimationFrame(this._loop);
    }

    /**
     * Set CSS custom properties on document body
     */
    _setCSSVariables(step) {
        const pixelPos = step * this.stepWidth;
        // ✅ FIX: Use body to avoid StyleCache invalidation loop
        document.body.style.setProperty('--playhead-step', step.toFixed(4));
        document.body.style.setProperty('--playhead-pixel', `${pixelPos}px`);
    }

    /**
     * Notify canvas-based consumers
     */
    _notifyCallbacks(step) {
        for (const callback of this.callbacks) {
            try {
                callback(step);
            } catch (e) {
                console.error('PlayheadCSSManager callback error:', e);
            }
        }
    }

    /**
     * Dispose
     */
    dispose() {
        this.stop();
        this.callbacks.clear();
        this.controller = null;
    }
}

// Singleton export
export const playheadCSSManager = new PlayheadCSSManager();
export default playheadCSSManager;
