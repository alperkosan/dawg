// lib/core/PlayheadRenderer.js
// High-Performance Playhead Renderer - Direct DOM manipulation, no transitions

export class PlayheadRenderer {
    constructor(playheadElement, stepWidth) {
        this.element = playheadElement;
        this.stepWidth = stepWidth;

        // Performance optimization
        this.lastPosition = -1;
        this.isAnimating = false;
        this.rafId = null;

        // Setup element for optimal rendering
        this._setupElement();

    }

    /**
     * Setup element for optimal performance
     */
    _setupElement() {
        if (!this.element) return;

        // ULTRA AGGRESSIVE: Composite-only setup
        const style = this.element.style;
        style.contain = 'strict';
        style.willChange = 'transform';
        style.transform = 'translate3d(0, 0, 0)'; // Force GPU layer
        style.backfaceVisibility = 'hidden';
        style.perspective = '1000px';

        // Disable any CSS transitions
        style.transition = 'none';
        style.transitionProperty = 'none';
        style.transitionDuration = '0s';

        // Prevent any paint/layout triggers
        style.isolation = 'isolate';
    }

    /**
     * Update playhead position (called on every frame during playback)
     * @param {number} stepPosition - Current position in steps (float)
     */
    updatePosition(stepPosition) {
        if (!this.element) return;

        // ULTRA AGGRESSIVE: Skip update if position hasn't changed enough for Piano Roll performance
        const pixelPosition = stepPosition * this.stepWidth;
        if (Math.abs(pixelPosition - this.lastPosition) < 5) {
            return; // Skip updates smaller than 5px - critical for Piano Roll performance
        }

        // Direct transform without transitions
        this.element.style.transform = `translate3d(${pixelPosition}px, 0, 0)`;
        this.lastPosition = pixelPosition;
    }

    /**
     * Set position immediately (for stop/jump operations)
     * @param {number} stepPosition - Target position in steps
     */
    setPosition(stepPosition) {
        if (!this.element) return;

        const pixelPosition = stepPosition * this.stepWidth;
        this.element.style.transform = `translate3d(${pixelPosition}px, 0, 0)`;
        this.lastPosition = pixelPosition;

    }

    /**
     * Start smooth animation loop (for playback)
     * @param {Function} getPositionCallback - Function that returns current step position
     */
    startAnimation(getPositionCallback) {
        if (this.isAnimating) return;

        this.isAnimating = true;

        const animate = () => {
            if (!this.isAnimating) return;

            const currentPosition = getPositionCallback();
            this.updatePosition(currentPosition);

            this.rafId = requestAnimationFrame(animate);
        };

        this.rafId = requestAnimationFrame(animate);
    }

    /**
     * Stop animation loop
     */
    stopAnimation() {
        this.isAnimating = false;

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

    }

    /**
     * Update step width (when grid resizes)
     * @param {number} newStepWidth - New step width in pixels
     */
    updateStepWidth(newStepWidth) {
        this.stepWidth = newStepWidth;

        // Recalculate current position with new step width
        const currentStepPosition = this.lastPosition / this.stepWidth;
        this.setPosition(currentStepPosition);

        console.log(`🎯 Step width updated: ${newStepWidth}px`);
    }

    /**
     * Reset playhead to start position
     */
    reset() {
        this.setPosition(0);
    }

    /**
     * Cleanup resources
     */
    dispose() {
        this.stopAnimation();
        this.element = null;
    }
}