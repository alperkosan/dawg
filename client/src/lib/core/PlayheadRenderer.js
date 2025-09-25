// lib/core/PlayheadRenderer.js
export class PlayheadRenderer {
    constructor(playheadElement, stepWidth) {
        this.element = playheadElement;
        this.stepWidth = stepWidth;
        this.isAnimating = false;
        this.rafId = null;
        this.lastPosition = -1;
        if (this.element) this.element.style.willChange = 'transform';
    }

    updatePosition(stepPosition) {
        if (!this.element) return;
        const pixelPosition = stepPosition * this.stepWidth;
        if (Math.abs(pixelPosition - this.lastPosition) < 0.1) return; // Sub-pixel güncellemelerini atla
        this.element.style.transform = `translate3d(${pixelPosition}px, 0, 0)`;
        this.lastPosition = pixelPosition;
    }

    startAnimation(getPositionCallback) {
        if (this.isAnimating) return;
        this.isAnimating = true;
        const animate = () => {
            if (!this.isAnimating) return;
            this.updatePosition(getPositionCallback());
            this.rafId = requestAnimationFrame(animate);
        };
        this.rafId = requestAnimationFrame(animate);
    }

    stopAnimation() {
        this.isAnimating = false;
        if (this.rafId) cancelAnimationFrame(this.rafId);
    }
    
    reset() {
        this.setPosition(0);
    }
    
    setPosition(step) {
        this.updatePosition(step);
    }

    updateStepWidth(newStepWidth) {
        this.stepWidth = newStepWidth;
    }

    dispose() {
        this.stopAnimation();
        this.element = null;
    }
}