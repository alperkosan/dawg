// lib/core/PlayheadRenderer.js
import { uiUpdateManager, UPDATE_PRIORITIES, UPDATE_FREQUENCIES } from './UIUpdateManager.js';
import { createLogger, NAMESPACES } from '../utils/DebugLogger.js';

const log = createLogger(NAMESPACES.RENDER);

export class PlayheadRenderer {
    constructor(playheadElement, stepWidth) {
        this.element = playheadElement;
        this.stepWidth = stepWidth;
        this.isAnimating = false;
        this.subscriptionId = null;
        this.lastPosition = -1;
        this.getPositionCallback = null;
        if (this.element) this.element.style.willChange = 'transform';
    }

    updatePosition(stepPosition) {
        if (!this.element) {
            log.warn('updatePosition: element not found!');
            return;
        }
        const pixelPosition = stepPosition * this.stepWidth;
        if (Math.abs(pixelPosition - this.lastPosition) < 0.1) {
            log.trace(`updatePosition: skipping sub-pixel update (${pixelPosition} vs ${this.lastPosition})`);
            return; // Sub-pixel güncellemelerini atla
        }
        log.debug(`updatePosition: moving from ${this.lastPosition}px to ${pixelPosition}px (step: ${stepPosition})`);
        this.element.style.transform = `translate3d(${pixelPosition}px, 0, 0)`;
        this.lastPosition = pixelPosition;
    }

    startAnimation(getPositionCallback) {
        if (this.isAnimating) return;

        this.isAnimating = true;
        this.getPositionCallback = getPositionCallback;

        log.info('Starting UIUpdateManager-based animation');

        // Subscribe to UIUpdateManager with CRITICAL priority for smooth playhead
        // ⚡ ULTRA-SMOOTH: 60fps with adaptive frame budget protection
        this.subscriptionId = uiUpdateManager.subscribe(
            `playhead-${Date.now()}`, // Unique ID for this playhead
            (currentTime, frameTime) => {
                if (this.isAnimating && this.getPositionCallback) {
                    this.updatePosition(this.getPositionCallback());
                }
            },
            UPDATE_PRIORITIES.CRITICAL, // Highest priority - always runs
            UPDATE_FREQUENCIES.REALTIME // 60fps - frame budget will protect us
        );
    }

    stopAnimation() {
        this.isAnimating = false;

        if (this.subscriptionId) {
            this.subscriptionId(); // Call unsubscribe function
            this.subscriptionId = null;
            log.info('Stopped UIUpdateManager-based animation');
        }

        this.getPositionCallback = null;
    }
    
    reset() {
        this.setPosition(0);
    }
    
    setPosition(step) {
        console.log(`🎯 PlayheadRenderer.setPosition(${step}) - will move to pixel: ${step * this.stepWidth}`);
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