/**
 * Zenith Synth Presets
 * Premium synthesizer presets for Zenith Synth
 */

export const ZENITH_PRESETS = {
    // ===== BASS =====
    'Deep Sub Bass': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.9,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'triangle',
                detune: 0,
                octave: 1,
                level: 0.3,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 150,
            resonance: 2.0,
            envelopeAmount: 500,
            velocitySensitivity: 0.4,
            keyTracking: 0,
            drive: 0
        },
        filterEnvelope: {
            delay: 0,
            attack: 0.001,
            hold: 0,
            decay: 0.15,
            sustain: 0.1,
            release: 0.2,
            velocitySensitivity: 0.3
        },
        amplitudeEnvelope: {
            delay: 0,
            attack: 0.001,
            hold: 0,
            decay: 0.2,
            sustain: 0.8,
            release: 0.3,
            velocitySensitivity: 0.6
        },
        lfos: [
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
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
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -15,
                octave: 0,
                level: 0.5,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 12,
                octave: -1,
                level: 0.4,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 250,
            resonance: 5.0,
            envelopeAmount: 1500,
            velocitySensitivity: 0.7,
            keyTracking: 0,
            drive: 0.2
        },
        filterEnvelope: {
            delay: 0,
            attack: 0.01,
            hold: 0,
            decay: 0.25,
            sustain: 0.2,
            release: 0.3,
            velocitySensitivity: 0.6
        },
        amplitudeEnvelope: {
            delay: 0,
            attack: 0.005,
            hold: 0,
            decay: 0.18,
            sustain: 0.75,
            release: 0.25,
            velocitySensitivity: 0.7
        },
        lfos: [
            { frequency: 0.15, depth: 0.3, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'mono',
        portamento: 0.02,
        legato: true,
        masterVolume: 0.8
    },

    // ===== LEAD =====
    'Supersaw Lead': {
        oscillators: [
            {
                enabled: true,
                waveform: 'supersaw',
                detune: 0,
                octave: 0,
                level: 0.6,
                pulseWidth: 0.5,
                unisonVoices: 7,
                unisonDetune: 50,
                unisonSpread: 50
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -7,
                octave: 0,
                level: 0.3,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'square',
                detune: 0,
                octave: -1,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 1200,
            resonance: 6.0,
            envelopeAmount: 5000,
            velocitySensitivity: 0.8,
            keyTracking: 0.3,
            drive: 0.1
        },
        filterEnvelope: {
            delay: 0,
            attack: 0.05,
            hold: 0,
            decay: 0.35,
            sustain: 0.35,
            release: 0.3,
            velocitySensitivity: 0.7
        },
        amplitudeEnvelope: {
            delay: 0,
            attack: 0.008,
            hold: 0,
            decay: 0.2,
            sustain: 0.7,
            release: 0.4,
            velocitySensitivity: 0.8
        },
        lfos: [
            { frequency: 6.5, depth: 0.18, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'mono',
        portamento: 0.04,
        legato: false,
        masterVolume: 0.6
    },

    'Pluck Lead': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.7,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 12,
                octave: 1,
                level: 0.4,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 1200,
            resonance: 2.0,
            envelopeAmount: 6000,
            velocitySensitivity: 0.95,
            keyTracking: 0.5,
            drive: 0
        },
        filterEnvelope: {
            delay: 0,
            attack: 0.001,
            hold: 0,
            decay: 0.35,
            sustain: 0.0,
            release: 0.4,
            velocitySensitivity: 0.9
        },
        amplitudeEnvelope: {
            delay: 0,
            attack: 0.001,
            hold: 0,
            decay: 0.4,
            sustain: 0.0,
            release: 0.5,
            velocitySensitivity: 0.95
        },
        lfos: [
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.7
    },

    // ===== PAD =====
    'Warm Pad': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.4,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -8,
                octave: 0,
                level: 0.4,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 12,
                octave: 0,
                level: 0.3,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 500,
            resonance: 2.5,
            envelopeAmount: 1800,
            velocitySensitivity: 0.25,
            keyTracking: 0,
            drive: 0
        },
        filterEnvelope: {
            delay: 0,
            attack: 1.2,
            hold: 0,
            decay: 0.6,
            sustain: 0.5,
            release: 2.0,
            velocitySensitivity: 0.2
        },
        amplitudeEnvelope: {
            delay: 0,
            attack: 1.5,
            hold: 0,
            decay: 0.7,
            sustain: 0.75,
            release: 2.5,
            velocitySensitivity: 0.3
        },
        lfos: [
            { frequency: 0.3, depth: 0.2, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.6
    },

    'Dream Pad': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.35,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: -10,
                octave: 0,
                level: 0.35,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'square',
                detune: 10,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'triangle',
                detune: 0,
                octave: 1,
                level: 0.2,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 1200,
            resonance: 1.0,
            envelopeAmount: 800,
            velocitySensitivity: 0.4,
            keyTracking: 0,
            drive: 0
        },
        filterEnvelope: {
            delay: 0,
            attack: 1.0,
            hold: 0,
            decay: 0.6,
            sustain: 0.7,
            release: 1.8,
            velocitySensitivity: 0.3
        },
        amplitudeEnvelope: {
            delay: 0,
            attack: 1.2,
            hold: 0,
            decay: 0.4,
            sustain: 0.9,
            release: 2.0,
            velocitySensitivity: 0.4
        },
        lfos: [
            { frequency: 0.5, depth: 0.1, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0.3, depth: 0.15, waveform: 'triangle', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.65
    },

    // ===== FX =====
    'Riser': {
        oscillators: [
            {
                enabled: true,
                waveform: 'noise',
                detune: 0,
                octave: 0,
                level: 0.6,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'sawtooth',
                detune: 0,
                octave: 0,
                level: 0.4,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            }
        ],
        filter: {
            type: 'highpass',
            cutoff: 100,
            resonance: 1.0,
            envelopeAmount: 8000,
            velocitySensitivity: 0.5,
            keyTracking: 0,
            drive: 0
        },
        filterEnvelope: {
            delay: 0,
            attack: 2.0,
            hold: 0,
            decay: 0.5,
            sustain: 1.0,
            release: 0.5,
            velocitySensitivity: 0.3
        },
        amplitudeEnvelope: {
            delay: 0,
            attack: 2.0,
            hold: 0,
            decay: 0.3,
            sustain: 1.0,
            release: 0.5,
            velocitySensitivity: 0.5
        },
        lfos: [
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.7
    },

    // ===== KEYS =====
    'E.Piano': {
        oscillators: [
            {
                enabled: true,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.5,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'triangle',
                detune: 7,
                octave: 1,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: true,
                waveform: 'sine',
                detune: -5,
                octave: 2,
                level: 0.12,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            },
            {
                enabled: false,
                waveform: 'sine',
                detune: 0,
                octave: 0,
                level: 0.25,
                pulseWidth: 0.5,
                unisonVoices: 1,
                unisonDetune: 0,
                unisonSpread: 0
            }
        ],
        filter: {
            type: 'lowpass',
            cutoff: 2800,
            resonance: 1.5,
            envelopeAmount: 2000,
            velocitySensitivity: 0.8,
            keyTracking: 0.2,
            drive: 0
        },
        filterEnvelope: {
            delay: 0,
            attack: 0.001,
            hold: 0,
            decay: 0.3,
            sustain: 0.2,
            release: 0.5,
            velocitySensitivity: 0.7
        },
        amplitudeEnvelope: {
            delay: 0,
            attack: 0.001,
            hold: 0,
            decay: 0.5,
            sustain: 0.3,
            release: 0.8,
            velocitySensitivity: 0.9
        },
        lfos: [
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.7
    }
};

/**
 * Get preset by name
 */
export function getZenithPreset(presetName) {
    return ZENITH_PRESETS[presetName] || null;
}

/**
 * Get all preset names
 */
export function getZenithPresetNames() {
    return Object.keys(ZENITH_PRESETS);
}

/**
 * Get presets by category
 */
export function getZenithPresetsByCategory() {
    return {
        Bass: ['Deep Sub Bass', 'Reese Bass'],
        Lead: ['Supersaw Lead', 'Pluck Lead'],
        Pad: ['Warm Pad', 'Dream Pad'],
        FX: ['Riser'],
        Keys: ['E.Piano']
    };
}
