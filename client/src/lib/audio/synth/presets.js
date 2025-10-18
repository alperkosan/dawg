/**
 * VASynth Presets
 * Collection of synth presets for different instruments and sounds
 */

export const SYNTH_PRESETS = {
    // Classic Piano Sound
    'Piano': {
        oscillators: [
            {
                enabled: true,
                waveform: 'triangle',
                detune: 0,
                octave: 0,
                level: 0.5,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sine',
                detune: -3,
                octave: 0,
                level: 0.35,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'triangle',
                detune: 3,
                octave: 1,  // Brightness
                level: 0.2,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 4000,
            resonance: 0.5,
            envelopeAmount: 3000,
            velocitySensitivity: 0.8
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.5,
            sustain: 0.2,
            release: 0.6,
            velocitySensitivity: 0.7
        },
        amplitudeEnvelope: {
            attack: 0.001,
            decay: 0.7,
            sustain: 0.3,
            release: 1.0,
            velocitySensitivity: 0.9
        },
        lfo: {
            frequency: 0,
            depth: 0,
            waveform: 'sine'
        },
        masterVolume: 0.7
    },

    // Electric Piano
    'E. Piano': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.5,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'triangle',
                detune: 7,
                octave: 1,
                level: 0.25,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sine',
                detune: -5,
                octave: 2,  // Bell-like overtone
                level: 0.12,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 2800,
            resonance: 1.5,
            envelopeAmount: 2000,
            velocitySensitivity: 0.8
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.3,
            sustain: 0.2,
            release: 0.5,
            velocitySensitivity: 0.7
        },
        amplitudeEnvelope: {
            attack: 0.001,
            decay: 0.5,
            sustain: 0.3,
            release: 0.8,
            velocitySensitivity: 0.9
        },
        lfo: {
            frequency: 0,
            depth: 0,
            waveform: 'sine'
        },
        masterVolume: 0.7
    },

    // Warm Pad
    'Warm Pad': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.4,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -8,
                octave: 0,
                level: 0.4,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 12,
                octave: 0,
                level: 0.3,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 500,
            resonance: 2.5,
            envelopeAmount: 1800,
            velocitySensitivity: 0.25
        },
        filterEnvelope: {
            attack: 1.2,
            decay: 0.6,
            sustain: 0.5,
            release: 2.0,
            velocitySensitivity: 0.2
        },
        amplitudeEnvelope: {
            attack: 1.5,
            decay: 0.7,
            sustain: 0.75,
            release: 2.5,
            velocitySensitivity: 0.3
        },
        lfo: {
            frequency: 0.3,
            depth: 0.2,
            waveform: 'sine'
        },
        masterVolume: 0.6
    },

    // Classic Lead
    'Classic Lead': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.6,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -7,
                octave: 0,
                level: 0.6,
                pulseWidth: 0.5
            },
            {
                enabled: false,
                waveform: 'square',
                detune: 0,
                octave: -1,
                level: 0.3,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 800,
            resonance: 4.0,
            envelopeAmount: 4500,
            velocitySensitivity: 0.7
        },
        filterEnvelope: {
            attack: 0.08,
            decay: 0.4,
            sustain: 0.3,
            release: 0.3,
            velocitySensitivity: 0.6
        },
        amplitudeEnvelope: {
            attack: 0.01,
            decay: 0.25,
            sustain: 0.65,
            release: 0.4,
            velocitySensitivity: 0.7
        },
        lfo: {
            frequency: 5,
            depth: 0.15,
            waveform: 'sine'
        },
        // ✅ Monophonic with portamento for expressive leads
        voiceMode: 'mono',
        portamento: 0.05,
        legato: false,
        masterVolume: 0.65
    },

    // Bass
    'Bass': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.6,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 0,
                octave: -1,  // Sub bass
                level: 0.8,
                pulseWidth: 0.5
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.3,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 300,
            resonance: 3.5,
            envelopeAmount: 1200,
            velocitySensitivity: 0.6
        },
        filterEnvelope: {
            attack: 0.005,
            decay: 0.2,
            sustain: 0.15,
            release: 0.25,
            velocitySensitivity: 0.5
        },
        amplitudeEnvelope: {
            attack: 0.003,
            decay: 0.15,
            sustain: 0.7,
            release: 0.2,
            velocitySensitivity: 0.7
        },
        lfo: {
            frequency: 0,
            depth: 0,
            waveform: 'sine'
        },
        // ✅ Monophonic with legato for smooth bass lines
        voiceMode: 'mono',
        portamento: 0.02,
        legato: true,
        masterVolume: 0.85
    },

    // Pluck
    'Pluck': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.7,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 12,
                octave: 1,
                level: 0.4,
                pulseWidth: 0.5
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.3,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 1200,
            resonance: 2.0,
            envelopeAmount: 6000,
            velocitySensitivity: 0.95
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.35,
            sustain: 0.0,
            release: 0.4,
            velocitySensitivity: 0.9
        },
        amplitudeEnvelope: {
            attack: 0.001,
            decay: 0.4,
            sustain: 0.0,
            release: 0.5,
            velocitySensitivity: 0.95
        },
        lfo: {
            frequency: 0,
            depth: 0,
            waveform: 'sine'
        },
        masterVolume: 0.7
    },

    // Organ
    'Organ': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.4,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sine',
                detune: 0,
                octave: 1,  // Octave up
                level: 0.3,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sine',
                detune: 0,
                octave: 2,  // Two octaves up
                level: 0.15,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 5000,
            resonance: 0.5,
            envelopeAmount: 0,
            velocitySensitivity: 0.2
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.1,
            sustain: 1.0,
            release: 0.05,
            velocitySensitivity: 0.1
        },
        amplitudeEnvelope: {
            attack: 0.005,
            decay: 0.1,
            sustain: 1.0,
            release: 0.05,
            velocitySensitivity: 0.3
        },
        lfo: {
            frequency: 6,
            depth: 0.05,
            waveform: 'sine'
        },
        masterVolume: 0.7
    },

    // Strings
    'Strings': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.35,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -10,
                octave: 0,
                level: 0.35,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 10,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 1200,
            resonance: 1.0,
            envelopeAmount: 800,
            velocitySensitivity: 0.4
        },
        filterEnvelope: {
            attack: 1.0,
            decay: 0.6,
            sustain: 0.7,
            release: 1.8,
            velocitySensitivity: 0.3
        },
        amplitudeEnvelope: {
            attack: 1.2,
            decay: 0.4,
            sustain: 0.9,
            release: 2.0,
            velocitySensitivity: 0.4
        },
        lfo: {
            frequency: 0.5,
            depth: 0.1,
            waveform: 'sine'
        },
        masterVolume: 0.65
    },

    '808 Bass': {
        oscillator: {
            type: 'sine'
        },
        envelope: {
            attack: 0.001,
            decay: 0.5,
            sustain: 0.3,
            release: 0.4
        },
        filter: {
            type: 'lowpass',
            frequency: 500,
            Q: 2,
            rolloff: -24
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.3,
            sustain: 0.2,
            release: 0.2,
            baseFrequency: 500,
            octaves: 1
        },
        lfo: {
            frequency: 0.1,
            depth: 0.05,
            waveform: 'sine'
        },
        masterVolume: 0.9
    },

    'Bell Synth': {
        oscillator: {
            type: 'sine'
        },
        envelope: {
            attack: 0.01,
            decay: 0.8,
            sustain: 0.2,
            release: 0.6
        },
        filter: {
            type: 'lowpass',
            frequency: 3000,
            Q: 1,
            rolloff: -12
        },
        filterEnvelope: {
            attack: 0.01,
            decay: 0.6,
            sustain: 0.1,
            release: 0.4,
            baseFrequency: 3000,
            octaves: 2
        },
        lfo: {
            frequency: 0.2,
            depth: 0.1,
            waveform: 'sine'
        },
        masterVolume: 0.7
    }
};

/**
 * Get list of preset names
 */
export function getPresetNames() {
    return Object.keys(SYNTH_PRESETS);
}

/**
 * Get preset by name
 */
export function getPreset(name) {
    return SYNTH_PRESETS[name] || null;
}

/**
 * Check if preset exists
 */
export function hasPreset(name) {
    return name in SYNTH_PRESETS;
}
