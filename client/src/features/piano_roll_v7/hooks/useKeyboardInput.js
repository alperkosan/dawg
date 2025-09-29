// Piano Roll v7 Keyboard Input Hook
// Maps computer keyboard to piano keys for real-time preview

import { useEffect, useCallback, useRef } from 'react';
import { samplePreview } from '../utils/samplePreview';

// Piano key mapping (QWERTY keyboard layout)
const KEY_TO_PITCH_MAP = {
    // Lower octave (white keys)
    'a': 60, // C4
    's': 62, // D4
    'd': 64, // E4
    'f': 65, // F4
    'g': 67, // G4
    'h': 69, // A4
    'j': 71, // B4
    'k': 72, // C5
    'l': 74, // D5
    ';': 76, // E5

    // Lower octave (black keys)
    'w': 61, // C#4
    'e': 63, // D#4
    't': 66, // F#4
    'y': 68, // G#4
    'u': 70, // A#4
    'o': 73, // C#5
    'p': 75, // D#5

    // Upper octave (white keys) - shifted up one octave
    'z': 48, // C3
    'x': 50, // D3
    'c': 52, // E3
    'v': 53, // F3
    'b': 55, // G3
    'n': 57, // A3
    'm': 59, // B3

    // Upper octave (black keys)
    'q': 49, // C#3
    '2': 51, // D#3
    '4': 54, // F#3
    '5': 56, // G#3
    '6': 58, // A#3
};

// Reverse mapping for getting key from pitch
const PITCH_TO_KEY_MAP = Object.fromEntries(
    Object.entries(KEY_TO_PITCH_MAP).map(([key, pitch]) => [pitch, key])
);

export function useKeyboardInput(enabled = true, octaveOffset = 0) {
    const pressedKeys = useRef(new Set());
    const keyRepeatTimeouts = useRef(new Map());

    // Handle key down
    const handleKeyDown = useCallback((event) => {
        if (!enabled) return;

        const key = event.key.toLowerCase();
        const pitch = KEY_TO_PITCH_MAP[key];

        if (!pitch) return;

        // Prevent browser shortcuts and defaults
        event.preventDefault();
        event.stopPropagation();

        // Apply octave offset
        const adjustedPitch = pitch + (octaveOffset * 12);

        // Prevent key repeat
        if (pressedKeys.current.has(key)) return;

        // Add to pressed keys
        pressedKeys.current.add(key);

        // Clear any existing repeat timeout
        if (keyRepeatTimeouts.current.has(key)) {
            clearTimeout(keyRepeatTimeouts.current.get(key));
        }

        // Play the note - this will be handled by the parent component's instrument logic
        const velocity = 100; // Could be made configurable
        samplePreview.playKeyboardNote(key, adjustedPitch, velocity);

        console.log(`🎹 Key pressed: ${key} -> pitch ${adjustedPitch}`);

    }, [enabled, octaveOffset]);

    // Handle key up
    const handleKeyUp = useCallback((event) => {
        if (!enabled) return;

        const key = event.key.toLowerCase();
        const pitch = KEY_TO_PITCH_MAP[key];

        if (!pitch) return;

        // Prevent browser defaults
        event.preventDefault();
        event.stopPropagation();

        // Remove from pressed keys
        pressedKeys.current.delete(key);

        // Clear repeat timeout
        if (keyRepeatTimeouts.current.has(key)) {
            clearTimeout(keyRepeatTimeouts.current.get(key));
            keyRepeatTimeouts.current.delete(key);
        }

        // Stop the note
        samplePreview.stopKeyboardNote(key);

        console.log(`🎹 Key released: ${key}`);

    }, [enabled]);

    // Handle window blur (stop all notes)
    const handleWindowBlur = useCallback(() => {
        if (!enabled) return;

        console.log('🎹 Window blur - stopping all keyboard notes');

        // Stop all playing notes
        for (const key of pressedKeys.current) {
            samplePreview.stopKeyboardNote(key);
        }

        // Clear all tracking
        pressedKeys.current.clear();
        keyRepeatTimeouts.current.clear();

    }, [enabled]);

    // Setup event listeners
    useEffect(() => {
        if (!enabled) return;

        // Add event listeners
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleWindowBlur);

        // Cleanup function
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleWindowBlur);

            // Stop all notes on cleanup
            handleWindowBlur();
        };
    }, [enabled, handleKeyDown, handleKeyUp, handleWindowBlur]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Stop all keyboard notes
            for (const key of pressedKeys.current) {
                samplePreview.stopKeyboardNote(key);
            }
            pressedKeys.current.clear();

            // Clear all timeouts
            for (const timeout of keyRepeatTimeouts.current.values()) {
                clearTimeout(timeout);
            }
            keyRepeatTimeouts.current.clear();
        };
    }, []);

    // Return utility functions
    return {
        // Get currently pressed keys
        getPressedKeys: () => Array.from(pressedKeys.current),

        // Check if specific key is pressed
        isKeyPressed: (key) => pressedKeys.current.has(key.toLowerCase()),

        // Get pitch for key
        getKeyPitch: (key) => {
            const basePitch = KEY_TO_PITCH_MAP[key.toLowerCase()];
            return basePitch ? basePitch + (octaveOffset * 12) : null;
        },

        // Get key for pitch
        getPitchKey: (pitch) => {
            const basePitch = pitch - (octaveOffset * 12);
            return PITCH_TO_KEY_MAP[basePitch] || null;
        },

        // Force stop all keys
        stopAllKeys: () => {
            handleWindowBlur();
        },

        // Get the key mapping
        getKeyMapping: () => ({ ...KEY_TO_PITCH_MAP }),

        // Get available pitch range
        getPitchRange: () => {
            const pitches = Object.values(KEY_TO_PITCH_MAP)
                .map(p => p + (octaveOffset * 12))
                .sort((a, b) => a - b);
            return {
                min: pitches[0],
                max: pitches[pitches.length - 1],
                count: pitches.length
            };
        }
    };
}

// Export key mappings for reference
export { KEY_TO_PITCH_MAP, PITCH_TO_KEY_MAP };