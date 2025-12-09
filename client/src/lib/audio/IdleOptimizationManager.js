import { idleDetector } from '../utils/IdleDetector.js';

/**
 * Handles Audio Context suspension/resumption based on user activity and route.
 * Improves battery life and performance when the DAW is in the background.
 */
export class IdleOptimizationManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.cleanupFns = [];
        this.isOnDawRoute = window.location.pathname.startsWith('/daw');

        this._init();
    }

    _init() {
        const checkRoute = () => {
            this.isOnDawRoute = window.location.pathname.startsWith('/daw');
        };

        window.addEventListener('popstate', checkRoute);
        // Clean up later
        this.cleanupFns.push(() => window.removeEventListener('popstate', checkRoute));

        // Periodically check route (fallback)
        const interval = setInterval(checkRoute, 1000);
        this.cleanupFns.push(() => clearInterval(interval));

        // Idle Detector Hooks
        idleDetector.onIdle(async () => {
            if (!this.isOnDawRoute) return;

            const context = this.audioEngine?.audioContext;
            const isPlaying = this.audioEngine?.transport?.state === 'started';

            if (!isPlaying && context?.state === 'running') {
                try {
                    await context.suspend();
                    console.log('😴 AudioContext suspended (idle)');
                } catch (e) {
                    console.warn('Failed to suspend:', e);
                }
            }
        });

        idleDetector.onActive(async () => {
            const context = this.audioEngine?.audioContext;
            if (context?.state === 'suspended') {
                try {
                    await context.resume();
                    console.log('👁️ AudioContext resumed (active)');
                } catch (e) {
                    console.warn('Failed to resume:', e);
                }
            }
        });
    }

    dispose() {
        this.cleanupFns.forEach(fn => fn());
        this.cleanupFns = [];
    }
}
