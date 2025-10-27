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
    },

    // 🔥 MODERN BASS PRESETS
    'Sub Bass': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.9,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sine',
                detune: 0,
                octave: 1,
                level: 0.3,
                pulseWidth: 0.5
            },
            {
                enabled: false,
                waveform: 'square',
                detune: 0,
                octave: 0,
                level: 0.2,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 150,
            resonance: 2.0,
            envelopeAmount: 500,
            velocitySensitivity: 0.4
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.15,
            sustain: 0.1,
            release: 0.2,
            velocitySensitivity: 0.3
        },
        amplitudeEnvelope: {
            attack: 0.001,
            decay: 0.2,
            sustain: 0.8,
            release: 0.3,
            velocitySensitivity: 0.6
        },
        lfo: {
            frequency: 0,
            depth: 0,
            waveform: 'sine'
        },
        voiceMode: 'mono',
        portamento: 0.03,
        legato: true,
        masterVolume: 0.95
    },

    'Reese Bass': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.5,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -15,
                octave: 0,
                level: 0.5,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 12,
                octave: -1,
                level: 0.4,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 250,
            resonance: 5.0,
            envelopeAmount: 1500,
            velocitySensitivity: 0.7
        },
        filterEnvelope: {
            attack: 0.01,
            decay: 0.25,
            sustain: 0.2,
            release: 0.3,
            velocitySensitivity: 0.6
        },
        amplitudeEnvelope: {
            attack: 0.005,
            decay: 0.18,
            sustain: 0.75,
            release: 0.25,
            velocitySensitivity: 0.7
        },
        lfo: {
            frequency: 0.15,
            depth: 0.3,
            waveform: 'sine'
        },
        voiceMode: 'mono',
        portamento: 0.02,
        legato: true,
        masterVolume: 0.8
    },

    // 🎸 MODERN LEAD PRESETS
    'Supersaw Lead': {
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
                detune: -12,
                octave: 0,
                level: 0.35,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 12,
                octave: 0,
                level: 0.35,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 1200,
            resonance: 6.0,
            envelopeAmount: 5000,
            velocitySensitivity: 0.8
        },
        filterEnvelope: {
            attack: 0.05,
            decay: 0.35,
            sustain: 0.35,
            release: 0.3,
            velocitySensitivity: 0.7
        },
        amplitudeEnvelope: {
            attack: 0.008,
            decay: 0.2,
            sustain: 0.7,
            release: 0.4,
            velocitySensitivity: 0.8
        },
        lfo: {
            frequency: 6.5,
            depth: 0.18,
            waveform: 'sine'
        },
        voiceMode: 'mono',
        portamento: 0.04,
        legato: false,
        masterVolume: 0.6
    },

    'Acid Lead': {
        oscillators: [
            {
                enabled: true,
                waveform: 'square',
                detune: 0,
                octave: 0,
                level: 0.7,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -5,
                octave: 0,
                level: 0.5,
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
            cutoff: 400,
            resonance: 8.0,
            envelopeAmount: 7000,
            velocitySensitivity: 0.9
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.25,
            sustain: 0.15,
            release: 0.2,
            velocitySensitivity: 0.85
        },
        amplitudeEnvelope: {
            attack: 0.001,
            decay: 0.15,
            sustain: 0.6,
            release: 0.15,
            velocitySensitivity: 0.8
        },
        lfo: {
            frequency: 0,
            depth: 0,
            waveform: 'sine'
        },
        voiceMode: 'mono',
        portamento: 0.01,
        legato: true,
        masterVolume: 0.7
    },

    // 🌊 MODERN PAD PRESETS
    'Lush Pad': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.3,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -20,
                octave: 0,
                level: 0.3,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 15,
                octave: 1,
                level: 0.25,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 800,
            resonance: 3.5,
            envelopeAmount: 2500,
            velocitySensitivity: 0.3
        },
        filterEnvelope: {
            attack: 2.0,
            decay: 1.0,
            sustain: 0.6,
            release: 3.0,
            velocitySensitivity: 0.2
        },
        amplitudeEnvelope: {
            attack: 2.5,
            decay: 0.8,
            sustain: 0.85,
            release: 3.5,
            velocitySensitivity: 0.25
        },
        lfo: {
            frequency: 0.25,
            depth: 0.25,
            waveform: 'sine'
        },
        masterVolume: 0.55
    },

    'Analog Pad': {
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
                waveform: 'triangle',
                detune: 5,
                octave: -1,
                level: 0.3,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 1000,
            resonance: 2.0,
            envelopeAmount: 1200,
            velocitySensitivity: 0.35
        },
        filterEnvelope: {
            attack: 1.5,
            decay: 0.8,
            sustain: 0.65,
            release: 2.2,
            velocitySensitivity: 0.25
        },
        amplitudeEnvelope: {
            attack: 1.8,
            decay: 0.6,
            sustain: 0.8,
            release: 2.5,
            velocitySensitivity: 0.3
        },
        lfo: {
            frequency: 0.4,
            depth: 0.15,
            waveform: 'sine'
        },
        masterVolume: 0.6
    },

    // 🔥 VASYNTH V2 SHOWCASE PRESETS
    // These presets demonstrate unison, modulation, and effects features

    'Hyper Saw': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.4,
                pulseWidth: 0.5,
                // ✨ UNISON: 7 voices for ultra-wide stereo
                unisonVoices: 7,
                unisonDetune: 25,
                unisonPan: 0.8
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 7,
                octave: 0,
                level: 0.3,
                pulseWidth: 0.5,
                unisonVoices: 5,
                unisonDetune: 18,
                unisonPan: 0.6
            },
            {
                enabled: true,
                waveform: 'square',
                detune: -5,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 2500,
            resonance: 4.5,
            envelopeAmount: 4000,
            velocitySensitivity: 0.75
        },
        filterEnvelope: {
            attack: 0.02,
            decay: 0.4,
            sustain: 0.4,
            release: 0.35,
            velocitySensitivity: 0.7
        },
        amplitudeEnvelope: {
            attack: 0.01,
            decay: 0.3,
            sustain: 0.7,
            release: 0.5,
            velocitySensitivity: 0.8
        },
        lfo: {
            frequency: 5.5,
            depth: 0.12,
            waveform: 'sine',
            // 🎛️ MODULATION: LFO to filter cutoff for movement
            target: 'filterCutoff'
        },
        effects: [
            {
                type: 'chorus',
                bypass: false,
                settings: {
                    rate: 0.5,
                    depth: 0.6,
                    feedback: 0.3,
                    mix: 0.35
                }
            },
            {
                type: 'reverb',
                bypass: false,
                settings: {
                    roomSize: 0.6,
                    damping: 0.5,
                    mix: 0.2
                }
            }
        ],
        voiceMode: 'poly',
        masterVolume: 0.55
    },

    'Trance Pluck': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.6,
                pulseWidth: 0.5,
                // ✨ UNISON: 4 voices for thick pluck
                unisonVoices: 4,
                unisonDetune: 15,
                unisonPan: 0.5
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 12,
                octave: 1,
                level: 0.35,
                pulseWidth: 0.5
            },
            {
                enabled: false,
                waveform: 'triangle',
                detune: 0,
                octave: 0,
                level: 0.3,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 1800,
            resonance: 3.5,
            envelopeAmount: 5500,
            velocitySensitivity: 0.95
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.3,
            sustain: 0.0,
            release: 0.35,
            velocitySensitivity: 0.9
        },
        amplitudeEnvelope: {
            attack: 0.001,
            decay: 0.35,
            sustain: 0.0,
            release: 0.4,
            velocitySensitivity: 0.95
        },
        lfo: {
            frequency: 0,
            depth: 0,
            waveform: 'sine'
        },
        effects: [
            {
                type: 'delay',
                bypass: false,
                settings: {
                    time: 0.375,  // Dotted eighth note
                    feedback: 0.4,
                    mix: 0.3
                }
            },
            {
                type: 'reverb',
                bypass: false,
                settings: {
                    roomSize: 0.5,
                    damping: 0.6,
                    mix: 0.15
                }
            }
        ],
        voiceMode: 'poly',
        masterVolume: 0.65
    },

    'Dream Pad': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.3,
                pulseWidth: 0.5,
                // ✨ UNISON: 6 voices for lush texture
                unisonVoices: 6,
                unisonDetune: 20,
                unisonPan: 0.9
            },
            {
                enabled: true,
                waveform: 'triangle',
                detune: -8,
                octave: 0,
                level: 0.35,
                pulseWidth: 0.5,
                unisonVoices: 4,
                unisonDetune: 12,
                unisonPan: 0.7
            },
            {
                enabled: true,
                waveform: 'sine',
                detune: 5,
                octave: 1,
                level: 0.2,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 600,
            resonance: 2.5,
            envelopeAmount: 2000,
            velocitySensitivity: 0.25
        },
        filterEnvelope: {
            attack: 2.5,
            decay: 1.2,
            sustain: 0.6,
            release: 3.5,
            velocitySensitivity: 0.2
        },
        amplitudeEnvelope: {
            attack: 3.0,
            decay: 0.8,
            sustain: 0.85,
            release: 4.0,
            velocitySensitivity: 0.25
        },
        lfo: {
            frequency: 0.18,
            depth: 0.3,
            waveform: 'sine',
            // 🎛️ MODULATION: Slow LFO for shimmer
            target: 'filterCutoff'
        },
        effects: [
            {
                type: 'chorus',
                bypass: false,
                settings: {
                    rate: 0.3,
                    depth: 0.8,
                    feedback: 0.4,
                    mix: 0.5
                }
            },
            {
                type: 'reverb',
                bypass: false,
                settings: {
                    roomSize: 0.85,
                    damping: 0.3,
                    mix: 0.45
                }
            }
        ],
        voiceMode: 'poly',
        masterVolume: 0.5
    },

    'Wobble Bass': {
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
                detune: -7,
                octave: 0,
                level: 0.5,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 0,
                octave: -1,
                level: 0.7,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 200,
            resonance: 7.5,
            envelopeAmount: 800,
            velocitySensitivity: 0.5
        },
        filterEnvelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.3,
            release: 0.25,
            velocitySensitivity: 0.4
        },
        amplitudeEnvelope: {
            attack: 0.005,
            decay: 0.15,
            sustain: 0.85,
            release: 0.2,
            velocitySensitivity: 0.7
        },
        lfo: {
            frequency: 4,
            depth: 0.75,
            waveform: 'sine',
            // 🎛️ MODULATION: Fast LFO for wobble effect
            target: 'filterCutoff'
        },
        effects: [
            {
                type: 'distortion',
                bypass: false,
                settings: {
                    drive: 0.5,
                    mix: 0.6
                }
            }
        ],
        voiceMode: 'mono',
        portamento: 0.02,
        legato: true,
        masterVolume: 0.75
    },

    'Arp Lead': {
        oscillators: [
            {
                enabled: true,
                waveform: 'square',
                detune: 0,
                octave: 0,
                level: 0.5,
                pulseWidth: 0.5,
                unisonVoices: 3,
                unisonDetune: 10,
                unisonPan: 0.4
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 12,
                octave: 0,
                level: 0.4,
                pulseWidth: 0.5
            },
            {
                enabled: false,
                waveform: 'triangle',
                detune: 0,
                octave: 1,
                level: 0.25,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 1500,
            resonance: 5.0,
            envelopeAmount: 3500,
            velocitySensitivity: 0.8
        },
        filterEnvelope: {
            attack: 0.001,
            decay: 0.12,
            sustain: 0.2,
            release: 0.1,
            velocitySensitivity: 0.75
        },
        amplitudeEnvelope: {
            attack: 0.001,
            decay: 0.15,
            sustain: 0.3,
            release: 0.12,
            velocitySensitivity: 0.85
        },
        lfo: {
            frequency: 0,
            depth: 0,
            waveform: 'sine'
        },
        effects: [
            {
                type: 'delay',
                bypass: false,
                settings: {
                    time: 0.25,  // Sixteenth note
                    feedback: 0.5,
                    mix: 0.4
                }
            },
            {
                type: 'reverb',
                bypass: false,
                settings: {
                    roomSize: 0.4,
                    damping: 0.7,
                    mix: 0.2
                }
            }
        ],
        voiceMode: 'poly',
        masterVolume: 0.7
    },

    'Fat Bass': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.5,
                pulseWidth: 0.5,
                // ✨ UNISON: 5 voices for fat bass
                unisonVoices: 5,
                unisonDetune: 12,
                unisonPan: 0.3
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 0,
                octave: -1,
                level: 0.7,
                pulseWidth: 0.5,
                unisonVoices: 3,
                unisonDetune: 8,
                unisonPan: 0.2
            },
            {
                enabled: true,
                waveform: 'triangle',
                detune: -5,
                octave: 0,
                level: 0.4,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 350,
            resonance: 4.0,
            envelopeAmount: 1500,
            velocitySensitivity: 0.6
        },
        filterEnvelope: {
            attack: 0.008,
            decay: 0.18,
            sustain: 0.2,
            release: 0.22,
            velocitySensitivity: 0.5
        },
        amplitudeEnvelope: {
            attack: 0.005,
            decay: 0.2,
            sustain: 0.75,
            release: 0.25,
            velocitySensitivity: 0.7
        },
        lfo: {
            frequency: 0,
            depth: 0,
            waveform: 'sine'
        },
        effects: [
            {
                type: 'distortion',
                bypass: false,
                settings: {
                    drive: 0.35,
                    mix: 0.4
                }
            }
        ],
        voiceMode: 'mono',
        portamento: 0.025,
        legato: true,
        masterVolume: 0.8
    },

    'Vocal Synth': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.45,
                pulseWidth: 0.5,
                unisonVoices: 4,
                unisonDetune: 8,
                unisonPan: 0.5
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 1,  // Formant 1
                level: 0.3,
                pulseWidth: 0.5
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 0,
                octave: 2,  // Formant 2
                level: 0.2,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'bandpass',
            cutoff: 1200,
            resonance: 6.0,
            envelopeAmount: 2000,
            velocitySensitivity: 0.4
        },
        filterEnvelope: {
            attack: 0.15,
            decay: 0.4,
            sustain: 0.5,
            release: 0.8,
            velocitySensitivity: 0.3
        },
        amplitudeEnvelope: {
            attack: 0.08,
            decay: 0.3,
            sustain: 0.7,
            release: 0.6,
            velocitySensitivity: 0.5
        },
        lfo: {
            frequency: 4.5,
            depth: 0.2,
            waveform: 'sine',
            // 🎛️ MODULATION: Vibrato
            target: 'pitch'
        },
        effects: [
            {
                type: 'chorus',
                bypass: false,
                settings: {
                    rate: 0.4,
                    depth: 0.5,
                    feedback: 0.3,
                    mix: 0.3
                }
            },
            {
                type: 'reverb',
                bypass: false,
                settings: {
                    roomSize: 0.7,
                    damping: 0.4,
                    mix: 0.25
                }
            }
        ],
        voiceMode: 'poly',
        masterVolume: 0.6
    },

    'Sidechain Lead': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.5,
                pulseWidth: 0.5,
                unisonVoices: 6,
                unisonDetune: 18,
                unisonPan: 0.75
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 7,
                octave: 0,
                level: 0.4,
                pulseWidth: 0.5,
                unisonVoices: 4,
                unisonDetune: 15,
                unisonPan: 0.6
            },
            {
                enabled: false,
                waveform: 'triangle',
                detune: 0,
                octave: 1,
                level: 0.25,
                pulseWidth: 0.5
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 2000,
            resonance: 5.5,
            envelopeAmount: 3500,
            velocitySensitivity: 0.7
        },
        filterEnvelope: {
            attack: 0.03,
            decay: 0.3,
            sustain: 0.4,
            release: 0.3,
            velocitySensitivity: 0.65
        },
        amplitudeEnvelope: {
            attack: 0.02,
            decay: 0.25,
            sustain: 0.65,
            release: 0.35,
            velocitySensitivity: 0.75
        },
        lfo: {
            frequency: 8,
            depth: 0.5,
            waveform: 'saw',
            // 🎛️ MODULATION: Pumping effect
            target: 'volume'
        },
        effects: [
            {
                type: 'delay',
                bypass: false,
                settings: {
                    time: 0.5,
                    feedback: 0.35,
                    mix: 0.25
                }
            },
            {
                type: 'reverb',
                bypass: false,
                settings: {
                    roomSize: 0.6,
                    damping: 0.5,
                    mix: 0.2
                }
            }
        ],
        voiceMode: 'poly',
        masterVolume: 0.6
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
