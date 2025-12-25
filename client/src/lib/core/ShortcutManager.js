import { usePlaybackStore } from '@/store/usePlaybackStore';

/**
 * ShortcutManager.js - Centralized Keyboard Handlers for the DAW
 * 
 * Implements a priority-based event loop:
 * 1. SYSTEM (Modals, Overlays)
 * 2. MUSICAL_TYPING (Intercepts piano keys regardless of focus)
 * 3. CONTEXTUAL (Piano Roll, Arrangement, Mixer - based on focus/visibility)
 * 4. GLOBAL (Transport, Save, Export)
 */

export const SHORTCUT_PRIORITY = {
    SYSTEM: 100,
    MUSICAL_TYPING: 80,
    CONTEXTUAL: 50,
    GLOBAL: 10
};

class ShortcutManager {
    constructor() {
        this.contexts = new Map(); // id -> { priority, handler, meta }
        this.isRecording = false; // Initial state, will be updated by store subscription
        this.keyboardPianoMode = false;
        this._initialized = false;

        // Auto-subscribe to playback state
        usePlaybackStore.subscribe((state) => {
            this.isRecording = state.isRecording;
            this.keyboardPianoMode = state.keyboardPianoMode;
        });
    }

    /**
     * Initialize global listeners
     */
    init() {
        if (this._initialized) return;

        window.addEventListener('keydown', this.handleKeyDown.bind(this), { capture: true });
        window.addEventListener('keyup', this.handleKeyUp.bind(this), { capture: true });

        this._initialized = true;
        console.log('🎹 ShortcutManager initialized');
    }

    /**
     * Register a context (e.g., 'PianoRoll', 'Mixer')
     * @param {string} id Unique identifier
     * @param {number} priority Priority level
     * @param {Object} handlers { onKeyDown, onKeyUp }
     */
    registerContext(id, priority, handlers) {
        this.contexts.set(id, { priority, ...handlers });
    }

    /**
     * Unregister a context
     */
    unregisterContext(id) {
        this.contexts.delete(id);
    }


    /**
     * Core Event Loop
     */
    handleKeyDown(e) {
        // 1. Always ignore if typing in input
        if (e.target.matches('input, textarea, [contenteditable="true"]')) {
            return;
        }

        // Sort context by priority (highest first)
        const sortedContexts = Array.from(this.contexts.values())
            .sort((a, b) => b.priority - a.priority);

        for (const ctx of sortedContexts) {
            if (ctx.onKeyDown) {
                const handled = ctx.onKeyDown(e);
                if (handled) {
                    e.stopPropagation();
                    // e.preventDefault(); // Individual handlers should call preventDefault if needed
                    return;
                }
            }
        }
    }

    handleKeyUp(e) {
        if (e.target.matches('input, textarea, [contenteditable="true"]')) {
            return;
        }

        const sortedContexts = Array.from(this.contexts.values())
            .sort((a, b) => b.priority - a.priority);

        for (const ctx of sortedContexts) {
            if (ctx.onKeyUp) {
                const handled = ctx.onKeyUp(e);
                if (handled) {
                    e.stopPropagation();
                    return;
                }
            }
        }
    }
}

// Singleton instances
const instance = new ShortcutManager();
export default instance;
