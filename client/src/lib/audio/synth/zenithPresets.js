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
    },

    // ===== MORE BASS =====
    '808 Sub': {
        oscillators: [
            { enabled: true, waveform: 'sine', detune: 0, octave: 0, level: 1.0, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'triangle', detune: 0, octave: 1, level: 0.15, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 120, resonance: 0.5, envelopeAmount: 300, velocitySensitivity: 0.3, keyTracking: 0, drive: 0.3 },
        filterEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 0.08, sustain: 0.0, release: 0.15, velocitySensitivity: 0.4 },
        amplitudeEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 0.12, sustain: 0.0, release: 0.2, velocitySensitivity: 0.7 },
        lfos: [
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'mono',
        portamento: 0.01,
        legato: false,
        masterVolume: 1.0
    },

    'Acid Bass': {
        oscillators: [
            { enabled: true, waveform: 'sawtooth', detune: 0, octave: 0, level: 0.8, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'square', detune: 0, octave: 0, level: 0.3, pulseWidth: 0.3, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 200, resonance: 8.0, envelopeAmount: 4000, velocitySensitivity: 0.9, keyTracking: 0.2, drive: 0.4 },
        filterEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 0.15, sustain: 0.0, release: 0.2, velocitySensitivity: 0.8 },
        amplitudeEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 0.18, sustain: 0.0, release: 0.25, velocitySensitivity: 0.8 },
        lfos: [
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'mono',
        portamento: 0.015,
        legato: true,
        masterVolume: 0.75
    },

    'Wobble Bass': {
        oscillators: [
            { enabled: true, waveform: 'sawtooth', detune: 0, octave: 0, level: 0.6, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sawtooth', detune: -12, octave: 0, level: 0.6, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 300, resonance: 7.0, envelopeAmount: 0, velocitySensitivity: 0.5, keyTracking: 0, drive: 0.5 },
        filterEnvelope: { delay: 0, attack: 0.01, hold: 0, decay: 0.2, sustain: 0.8, release: 0.3, velocitySensitivity: 0.5 },
        amplitudeEnvelope: { delay: 0, attack: 0.005, hold: 0, decay: 0.15, sustain: 0.9, release: 0.25, velocitySensitivity: 0.7 },
        lfos: [
            { frequency: 4.0, depth: 0.8, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'mono',
        portamento: 0.02,
        legato: true,
        masterVolume: 0.7
    },

    // ===== MORE LEAD =====
    'Sync Lead': {
        oscillators: [
            { enabled: true, waveform: 'sawtooth', detune: 0, octave: 0, level: 0.7, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'square', detune: 7, octave: 0, level: 0.4, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 1500, resonance: 4.0, envelopeAmount: 4500, velocitySensitivity: 0.85, keyTracking: 0.4, drive: 0.2 },
        filterEnvelope: { delay: 0, attack: 0.01, hold: 0, decay: 0.3, sustain: 0.4, release: 0.35, velocitySensitivity: 0.75 },
        amplitudeEnvelope: { delay: 0, attack: 0.005, hold: 0, decay: 0.25, sustain: 0.65, release: 0.4, velocitySensitivity: 0.8 },
        lfos: [
            { frequency: 5.5, depth: 0.12, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'mono',
        portamento: 0.035,
        legato: false,
        masterVolume: 0.65
    },

    'Arp Lead': {
        oscillators: [
            { enabled: true, waveform: 'square', detune: 0, octave: 0, level: 0.6, pulseWidth: 0.4, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'square', detune: 12, octave: 1, level: 0.35, pulseWidth: 0.6, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 1800, resonance: 3.0, envelopeAmount: 3500, velocitySensitivity: 0.9, keyTracking: 0.5, drive: 0.1 },
        filterEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 0.2, sustain: 0.1, release: 0.3, velocitySensitivity: 0.85 },
        amplitudeEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 0.25, sustain: 0.15, release: 0.35, velocitySensitivity: 0.9 },
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

    'Brass Lead': {
        oscillators: [
            { enabled: true, waveform: 'sawtooth', detune: 0, octave: 0, level: 0.5, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sawtooth', detune: -8, octave: 0, level: 0.5, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'square', detune: 5, octave: 0, level: 0.3, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 800, resonance: 3.5, envelopeAmount: 2500, velocitySensitivity: 0.75, keyTracking: 0.3, drive: 0.15 },
        filterEnvelope: { delay: 0, attack: 0.08, hold: 0, decay: 0.4, sustain: 0.5, release: 0.4, velocitySensitivity: 0.6 },
        amplitudeEnvelope: { delay: 0, attack: 0.1, hold: 0, decay: 0.3, sustain: 0.7, release: 0.5, velocitySensitivity: 0.7 },
        lfos: [
            { frequency: 4.5, depth: 0.08, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.65
    },

    // ===== MORE PAD =====
    'Strings': {
        oscillators: [
            { enabled: true, waveform: 'sawtooth', detune: 0, octave: 0, level: 0.35, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sawtooth', detune: -7, octave: 0, level: 0.35, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sawtooth', detune: 7, octave: 0, level: 0.35, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 900, resonance: 1.5, envelopeAmount: 1200, velocitySensitivity: 0.3, keyTracking: 0.1, drive: 0 },
        filterEnvelope: { delay: 0, attack: 0.8, hold: 0, decay: 0.5, sustain: 0.6, release: 1.5, velocitySensitivity: 0.25 },
        amplitudeEnvelope: { delay: 0, attack: 1.0, hold: 0, decay: 0.4, sustain: 0.8, release: 1.8, velocitySensitivity: 0.35 },
        lfos: [
            { frequency: 0.4, depth: 0.15, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.6
    },

    'Ambient Pad': {
        oscillators: [
            { enabled: true, waveform: 'triangle', detune: 0, octave: 0, level: 0.4, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sawtooth', detune: -12, octave: 0, level: 0.3, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'square', detune: 12, octave: 1, level: 0.2, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 600, resonance: 0.8, envelopeAmount: 1000, velocitySensitivity: 0.2, keyTracking: 0, drive: 0 },
        filterEnvelope: { delay: 0.2, attack: 1.5, hold: 0, decay: 0.8, sustain: 0.7, release: 2.5, velocitySensitivity: 0.15 },
        amplitudeEnvelope: { delay: 0.3, attack: 2.0, hold: 0, decay: 0.6, sustain: 0.85, release: 3.0, velocitySensitivity: 0.2 },
        lfos: [
            { frequency: 0.2, depth: 0.25, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0.35, depth: 0.18, waveform: 'triangle', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.55
    },

    // ===== MORE FX =====
    'Impact': {
        oscillators: [
            { enabled: true, waveform: 'noise', detune: 0, octave: 0, level: 0.7, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sine', detune: 0, octave: -2, level: 0.5, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 2000, resonance: 2.0, envelopeAmount: -1500, velocitySensitivity: 0.6, keyTracking: 0, drive: 0.3 },
        filterEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 0.8, sustain: 0.0, release: 0.5, velocitySensitivity: 0.7 },
        amplitudeEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 1.0, sustain: 0.0, release: 0.6, velocitySensitivity: 0.8 },
        lfos: [
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.8
    },

    'Sweep': {
        oscillators: [
            { enabled: true, waveform: 'sawtooth', detune: 0, octave: 0, level: 0.5, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'square', detune: -7, octave: 0, level: 0.4, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'bandpass', cutoff: 500, resonance: 6.0, envelopeAmount: 6000, velocitySensitivity: 0.5, keyTracking: 0, drive: 0.2 },
        filterEnvelope: { delay: 0, attack: 1.5, hold: 0, decay: 0.8, sustain: 0.5, release: 1.0, velocitySensitivity: 0.4 },
        amplitudeEnvelope: { delay: 0, attack: 1.5, hold: 0, decay: 0.6, sustain: 0.7, release: 1.2, velocitySensitivity: 0.5 },
        lfos: [
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.65
    },

    // ===== MORE KEYS =====
    'Organ': {
        oscillators: [
            { enabled: true, waveform: 'sine', detune: 0, octave: 0, level: 0.5, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sine', detune: 0, octave: 1, level: 0.35, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sine', detune: 0, octave: 2, level: 0.2, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sine', detune: 0, octave: -1, level: 0.15, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 3500, resonance: 0.5, envelopeAmount: 500, velocitySensitivity: 0.3, keyTracking: 0.1, drive: 0.1 },
        filterEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 0.1, sustain: 1.0, release: 0.2, velocitySensitivity: 0.2 },
        amplitudeEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 0.05, sustain: 1.0, release: 0.15, velocitySensitivity: 0.4 },
        lfos: [
            { frequency: 6.0, depth: 0.05, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.7
    },

    'Bell': {
        oscillators: [
            { enabled: true, waveform: 'sine', detune: 0, octave: 0, level: 0.6, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sine', detune: 7, octave: 2, level: 0.3, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: true, waveform: 'sine', detune: -5, octave: 3, level: 0.15, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 },
            { enabled: false, waveform: 'sine', detune: 0, octave: 0, level: 0.25, pulseWidth: 0.5, unisonVoices: 1, unisonDetune: 0, unisonSpread: 0 }
        ],
        filter: { type: 'lowpass', cutoff: 4000, resonance: 1.0, envelopeAmount: 1500, velocitySensitivity: 0.7, keyTracking: 0.3, drive: 0 },
        filterEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 0.8, sustain: 0.1, release: 1.2, velocitySensitivity: 0.6 },
        amplitudeEnvelope: { delay: 0, attack: 0.001, hold: 0, decay: 1.0, sustain: 0.15, release: 1.5, velocitySensitivity: 0.85 },
        lfos: [
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' },
            { frequency: 0, depth: 0, waveform: 'sine', tempoSync: false, tempoSyncRate: '1/4' }
        ],
        voiceMode: 'poly',
        portamento: 0,
        legato: false,
        masterVolume: 0.75
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
        Bass: ['Deep Sub Bass', 'Reese Bass', '808 Sub', 'Acid Bass', 'Wobble Bass'],
        Lead: ['Supersaw Lead', 'Pluck Lead', 'Sync Lead', 'Arp Lead', 'Brass Lead'],
        Pad: ['Warm Pad', 'Dream Pad', 'Strings', 'Ambient Pad'],
        FX: ['Riser', 'Impact', 'Sweep'],
        Keys: ['E.Piano', 'Organ', 'Bell']
    };
}
