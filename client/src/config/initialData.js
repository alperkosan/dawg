import { INSTRUMENT_TYPES, MIXER_TRACK_TYPES } from './constants';

// =========================================================================
// 🎵 140 BPM HIP-HOP PROJECT - Multiple Sub-Genres
// =========================================================================

// Helper function to create notes
const note = (time, pitch = 'C4', velocity = 100, duration = '16n') => ({
  id: `note_${time}_${pitch}_${Math.random().toString(36).substring(7)}`,
  time,
  pitch,
  velocity,
  duration
});

// =========================================================================
// 🔥 PATTERN 1: TRAP (140 BPM)
// Aggressive hi-hats, 808 bass, hard-hitting
// =========================================================================
const trapPattern = {
  kick: [0, 6, 10, 16, 22, 26, 32, 38, 42, 48, 54, 58].map(t => note(t, 'C4', 100)),
  snare: [8, 24, 40, 56].map(t => note(t, 'C4', 95)),
  clap: [8, 24, 40, 56].map(t => note(t, 'C4', 80)), // Layered with snare
  'hi-hat': [
    // Fast triplet hi-hats (classic trap)
    ...Array.from({ length: 64 }).map((_, i) => {
      const velocity = i % 3 === 0 ? 80 : (i % 3 === 1 ? 45 : 60);
      return note(i, 'F#4', velocity, '32n');
    })
  ],
  openhat: [15, 31, 47, 63].map(t => note(t, 'G#4', 70, '8n')),
  '808': [
    // Hard-hitting 808 sub bass
    { t: 0, p: 'C1', d: '4n' }, { t: 6, p: 'C1', d: '16n' }, { t: 10, p: 'G0', d: '16n' },
    { t: 16, p: 'A#0', d: '4n' }, { t: 22, p: 'A#0', d: '16n' }, { t: 26, p: 'F0', d: '16n' },
    { t: 32, p: 'G#0', d: '4n' }, { t: 38, p: 'G#0', d: '16n' }, { t: 42, p: 'D#0', d: '16n' },
    { t: 48, p: 'A#0', d: '2n' }, { t: 56, p: 'C1', d: '8n' },
  ].map(n => note(n.t, n.p, 100, n.d)),
  perc: [4, 12, 20, 28, 36, 44, 52, 60].map(t => note(t, 'C4', 65)), // Texture
  '808bass': [
    { t: 0, p: 'C2', d: '2n' }, { t: 8, p: 'C2', d: '16n' }, { t: 10, p: 'G1', d: '16n' },
    { t: 16, p: 'A#1', d: '2n' }, { t: 24, p: 'A#1', d: '16n' }, { t: 26, p: 'F1', d: '16n' },
    { t: 32, p: 'G#1', d: '2n' }, { t: 40, p: 'G#1', d: '16n' }, { t: 42, p: 'D#1', d: '16n' },
    { t: 48, p: 'A#1', d: '4n' }, { t: 52, p: 'C2', d: '8n' }, { t: 56, p: 'D2', d: '8n' },
  ].map(n => note(n.t, n.p, 100, n.d)),
  'bellsynth': [
    { t: 2, p: 'C5', d: '8n' }, { t: 6, p: 'G4', d: '8n' }, { t: 10, p: 'D#5', d: '8n' },
    { t: 18, p: 'A#4', d: '8n' }, { t: 22, p: 'F4', d: '8n' }, { t: 26, p: 'C5', d: '8n' },
    { t: 34, p: 'G#4', d: '8n' }, { t: 38, p: 'D#4', d: '8n' }, { t: 42, p: 'A#4', d: '8n' },
    { t: 50, p: 'A#4', d: '4n' }, { t: 56, p: 'C5', d: '8n' },
  ].map(n => note(n.t, n.p, 75, n.d))
};

// =========================================================================
// 💎 PATTERN 2: BOOM BAP (90 BPM) - 16 BARS SHOWCASE
// Classic 90s NY style: dusty drums, jazzy loops, minimal arrangement
// Think: Pete Rock, DJ Premier, J Dilla vibes
// =========================================================================
const boomBapPattern = {
  // === DRUMS (16 bars) - Classic 90s breakbeat style ===
  kick: [
    // Bar 1-8: Classic boom bap pattern (heavy kick on 1 and 3)
    0, 16, 32, 48, 64, 80, 96, 112,
    // Bar 9-16: Variation with occasional doubles
    128, 140, 144, 160, 176, 188, 192, 208, 224, 236, 240
  ].map(t => note(t, 'C4', 100, '8n')),

  snare: [
    // Bar 1-16: Classic backbeat (always on 2 and 4)
    8, 24, 40, 56, 72, 88, 104, 120,
    136, 152, 168, 184, 200, 216, 232, 248
  ].map(t => note(t, 'C4', 90, '8n')),

  rim: [
    // Bar 1-8: Ghost notes (subtle)
    6, 14, 22, 30, 38, 46, 54, 62,
    70, 78, 86, 94, 102, 110, 118, 126,
    // Bar 9-16: Slightly more active but still sparse
    134, 142, 150, 158, 166, 174, 182, 190,
    198, 206, 214, 222, 230, 238, 246, 254
  ].map(t => note(t, 'C4', 50, '32n')), // Quiet ghost notes

  'hi-hat': [
    // Bar 1-8: Sparse, open hi-hats only (90s minimal style)
    4, 12, 20, 28, 36, 44, 52, 60,
    68, 76, 84, 92, 100, 108, 116, 124,
    // Bar 9-16: Slightly more closed hats
    132, 136, 140, 144, 148, 152, 156, 160,
    164, 168, 172, 176, 180, 184, 188, 192,
    196, 200, 204, 208, 212, 216, 220, 224,
    228, 232, 236, 240, 244, 248, 252
  ].map((t, i) => note(t, i < 16 ? 'G#4' : 'F#4', i < 16 ? 60 : 45, '8n')),

  perc: [
    // Minimal shaker/texture (very sparse, 90s lofi style)
    15, 31, 47, 63, 79, 95, 111, 127,
    143, 159, 175, 191, 207, 223, 239, 255
  ].map(t => note(t, 'C4', 40)),

  // === PIANO SAMPLED (Jazzy loop - 16 bars, 90s style) ===
  'piano(sampled)': [
    // Bar 1-4: Simple 2-bar loop (like a sampled vinyl)
    { t: 0, p: 'C3', d: '2n' }, { t: 0, p: 'E3', d: '2n' }, { t: 0, p: 'G3', d: '2n' },
    { t: 8, p: 'E3', d: '4n' }, { t: 12, p: 'G3', d: '4n' },
    { t: 16, p: 'A2', d: '2n' }, { t: 16, p: 'C3', d: '2n' }, { t: 16, p: 'E3', d: '2n' },
    { t: 24, p: 'C3', d: '4n' }, { t: 28, p: 'E3', d: '4n' },

    { t: 32, p: 'F2', d: '2n' }, { t: 32, p: 'A2', d: '2n' }, { t: 32, p: 'C3', d: '2n' },
    { t: 40, p: 'A2', d: '4n' }, { t: 44, p: 'C3', d: '4n' },
    { t: 48, p: 'G2', d: '2n' }, { t: 48, p: 'B2', d: '2n' }, { t: 48, p: 'D3', d: '2n' },
    { t: 56, p: 'B2', d: '4n' }, { t: 60, p: 'D3', d: '4n' },

    // Bar 5-8: Exact same loop (like looped sample)
    { t: 64, p: 'C3', d: '2n' }, { t: 64, p: 'E3', d: '2n' }, { t: 64, p: 'G3', d: '2n' },
    { t: 72, p: 'E3', d: '4n' }, { t: 76, p: 'G3', d: '4n' },
    { t: 80, p: 'A2', d: '2n' }, { t: 80, p: 'C3', d: '2n' }, { t: 80, p: 'E3', d: '2n' },
    { t: 88, p: 'C3', d: '4n' }, { t: 92, p: 'E3', d: '4n' },

    { t: 96, p: 'F2', d: '2n' }, { t: 96, p: 'A2', d: '2n' }, { t: 96, p: 'C3', d: '2n' },
    { t: 104, p: 'A2', d: '4n' }, { t: 108, p: 'C3', d: '4n' },
    { t: 112, p: 'G2', d: '2n' }, { t: 112, p: 'B2', d: '2n' }, { t: 112, p: 'D3', d: '2n' },
    { t: 120, p: 'B2', d: '4n' }, { t: 124, p: 'D3', d: '4n' },

    // Bar 9-12: Loop again (repetitive, hypnotic)
    { t: 128, p: 'C3', d: '2n' }, { t: 128, p: 'E3', d: '2n' }, { t: 128, p: 'G3', d: '2n' },
    { t: 136, p: 'E3', d: '4n' }, { t: 140, p: 'G3', d: '4n' },
    { t: 144, p: 'A2', d: '2n' }, { t: 144, p: 'C3', d: '2n' }, { t: 144, p: 'E3', d: '2n' },
    { t: 152, p: 'C3', d: '4n' }, { t: 156, p: 'E3', d: '4n' },

    { t: 160, p: 'F2', d: '2n' }, { t: 160, p: 'A2', d: '2n' }, { t: 160, p: 'C3', d: '2n' },
    { t: 168, p: 'A2', d: '4n' }, { t: 172, p: 'C3', d: '4n' },
    { t: 176, p: 'G2', d: '2n' }, { t: 176, p: 'B2', d: '2n' }, { t: 176, p: 'D3', d: '2n' },
    { t: 184, p: 'B2', d: '4n' }, { t: 188, p: 'D3', d: '4n' },

    // Bar 13-16: Final loop with slight variation (fade out vibe)
    { t: 192, p: 'C3', d: '2n' }, { t: 192, p: 'E3', d: '2n' }, { t: 192, p: 'G3', d: '2n' },
    { t: 200, p: 'E3', d: '4n' },
    { t: 208, p: 'A2', d: '2n' }, { t: 208, p: 'C3', d: '2n' }, { t: 208, p: 'E3', d: '2n' },
    { t: 216, p: 'C3', d: '4n' },
    { t: 224, p: 'F2', d: '2n' }, { t: 224, p: 'A2', d: '2n' }, { t: 224, p: 'C3', d: '2n' },
    { t: 232, p: 'A2', d: '4n' },
    { t: 240, p: 'G2', d: '1n' }, { t: 240, p: 'B2', d: '1n' }, { t: 240, p: 'D3', d: '1n' }
  ].map(n => note(n.t, n.p, 70, n.d)), // Lower velocity for lofi vibe

  // === WARM PAD (Subtle atmospheric - 16 bars) ===
  warmpad: [
    // Bar 1-8: C major (long sustain, barely there)
    { t: 0, p: 'C3', d: '1n' }, { t: 0, p: 'E3', d: '1n' }, { t: 0, p: 'G3', d: '1n' },
    { t: 64, p: 'C3', d: '1n' }, { t: 64, p: 'E3', d: '1n' }, { t: 64, p: 'G3', d: '1n' },
    // Bar 9-16: A minor (subtle shift)
    { t: 128, p: 'A3', d: '1n' }, { t: 128, p: 'C4', d: '1n' }, { t: 128, p: 'E4', d: '1n' },
    { t: 192, p: 'A3', d: '1n' }, { t: 192, p: 'C4', d: '1n' }, { t: 192, p: 'E4', d: '1n' }
  ].map(n => note(n.t, n.p, 30, n.d)), // Very quiet, just atmosphere
};

// =========================================================================
// ☁️ PATTERN 3: CLOUD RAP (140 BPM)
// Ethereal, spacey, ambient vibes
// =========================================================================
const cloudRapPattern = {
  kick: [0, 16, 32, 48].map(t => note(t, 'C4', 85, '4n')),
  snare: [8, 24, 40, 56].map(t => note(t, 'C4', 70, '8n')),
  'hi-hat': [
    ...Array.from({ length: 16 }).map((_, i) => {
      return note(i * 4, 'F#4', 50, '8n');
    })
  ],
  openhat: [6, 14, 22, 30, 38, 46, 54, 62].map(t => note(t, 'G#4', 60, '4n')),
  warmpad: [
    { t: 0, p: 'C4', d: '1n' }, { t: 0, p: 'E4', d: '1n' }, { t: 0, p: 'G4', d: '1n' },
    { t: 32, p: 'A3', d: '1n' }, { t: 32, p: 'C4', d: '1n' }, { t: 32, p: 'E4', d: '1n' },
  ].map(n => note(n.t, n.p, 60, n.d)),
  'e.piano': [
    { t: 2, p: 'C5', d: '2n' }, { t: 8, p: 'E5', d: '4n' }, { t: 14, p: 'G5', d: '8n' },
    { t: 18, p: 'A4', d: '2n' }, { t: 24, p: 'C5', d: '4n' }, { t: 30, p: 'E5', d: '8n' },
    { t: 34, p: 'F4', d: '2n' }, { t: 40, p: 'A4', d: '4n' }, { t: 46, p: 'C5', d: '8n' },
    { t: 50, p: 'G4', d: '1n' },
  ].map(n => note(n.t, n.p, 70, n.d)),
  bass: [
    { t: 0, p: 'C4', d: '1n' },
    { t: 16, p: 'A3', d: '1n' },
    { t: 32, p: 'F3', d: '1n' },
    { t: 48, p: 'G3', d: '1n' },
  ].map(n => note(n.t, n.p, 75, n.d))
};

// =========================================================================
// 🔪 PATTERN 4: DRILL (140 BPM)
// Dark, sliding 808s, aggressive
// =========================================================================
const drillPattern = {
  kick: [0, 6, 12, 16, 22, 28, 32, 38, 44, 48, 54, 60].map(t => note(t, 'C4', 100)),
  snare: [8, 24, 40, 56].map(t => note(t, 'C4', 90)),
  clap: [8, 24, 40, 56].map(t => note(t, 'C4', 75)), // UK Drill clap layer
  'hi-hat': [
    ...Array.from({ length: 64 }).map((_, i) => {
      const velocity = i % 4 === 0 ? 70 : (i % 4 === 2 ? 80 : 35);
      return note(i, 'F#4', velocity, '16n');
    })
  ],
  openhat: [15, 31, 47].map(t => note(t, 'G#4', 65, '4n')),
  rim: [2, 10, 18, 26, 34, 42, 50, 58].map(t => note(t, 'C4', 60, '32n')), // Drill rolls
  '808': [
    // Deep 808 slides (UK Drill style)
    { t: 0, p: 'C0', d: '8n' }, { t: 2, p: 'C#0', d: '16n' }, { t: 4, p: 'D0', d: '8n' },
    { t: 8, p: 'A#-1', d: '4n' }, { t: 14, p: 'A-1', d: '16n' },
    { t: 16, p: 'G#-1', d: '8n' }, { t: 18, p: 'A-1', d: '16n' }, { t: 20, p: 'A#-1', d: '8n' },
    { t: 24, p: 'F-1', d: '4n' }, { t: 30, p: 'F#-1', d: '16n' },
    { t: 32, p: 'D#-1', d: '8n' }, { t: 34, p: 'E-1', d: '16n' }, { t: 36, p: 'F-1', d: '8n' },
    { t: 40, p: 'G#-1', d: '4n' }, { t: 46, p: 'A-1', d: '16n' },
    { t: 48, p: 'C0', d: '2n' }, { t: 56, p: 'A#-1', d: '8n' },
  ].map(n => note(n.t, n.p, 100, n.d)),
  '808bass': [
    // Sliding 808s (drill signature)
    { t: 0, p: 'C2', d: '8n' }, { t: 2, p: 'C#2', d: '16n' }, { t: 4, p: 'D2', d: '8n' },
    { t: 8, p: 'A#1', d: '4n' }, { t: 14, p: 'A1', d: '16n' },
    { t: 16, p: 'G#1', d: '8n' }, { t: 18, p: 'A1', d: '16n' }, { t: 20, p: 'A#1', d: '8n' },
    { t: 24, p: 'F1', d: '4n' }, { t: 30, p: 'F#1', d: '16n' },
    { t: 32, p: 'D#1', d: '8n' }, { t: 34, p: 'E1', d: '16n' }, { t: 36, p: 'F1', d: '8n' },
    { t: 40, p: 'G#1', d: '4n' }, { t: 46, p: 'A1', d: '16n' },
    { t: 48, p: 'C2', d: '2n' }, { t: 56, p: 'A#1', d: '8n' },
  ].map(n => note(n.t, n.p, 100, n.d)),
  pluck: [
    { t: 0, p: 'C5', d: '16n' }, { t: 4, p: 'D#5', d: '16n' }, { t: 8, p: 'G5', d: '16n' },
    { t: 16, p: 'A#4', d: '16n' }, { t: 20, p: 'D5', d: '16n' }, { t: 24, p: 'F5', d: '16n' },
    { t: 32, p: 'G#4', d: '16n' }, { t: 36, p: 'C5', d: '16n' }, { t: 40, p: 'D#5', d: '16n' },
    { t: 48, p: 'C5', d: '8n' }, { t: 52, p: 'D#5', d: '8n' }, { t: 56, p: 'G5', d: '8n' },
  ].map(n => note(n.t, n.p, 70, n.d))
};

// =========================================================================
// 🎹 VASYNTH PRESETS
// =========================================================================
const vaSynthPresets = {
  'Piano': {
    oscillators: [
      { type: 'sine', detune: 0, gain: 0.6, octave: 0 },
      { type: 'triangle', detune: 5, gain: 0.3, octave: 1 },
      { type: 'triangle', detune: -5, gain: 0.1, octave: 2 }
    ],
    filter: { type: 'lowpass', frequency: 2000, Q: 1, enabled: true },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.5 },
    filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.3, amount: 800 }
  },
  'E. Piano': {
    oscillators: [
      { type: 'sine', detune: 0, gain: 0.5, octave: 0 },
      { type: 'triangle', detune: 3, gain: 0.3, octave: 0 },
      { type: 'square', detune: -3, gain: 0.2, octave: 1 }
    ],
    filter: { type: 'lowpass', frequency: 1500, Q: 2, enabled: true },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.4 },
    filterEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.2, amount: 600 }
  },
  'Organ': {
    oscillators: [
      { type: 'sine', detune: 0, gain: 0.4, octave: 0 },
      { type: 'sine', detune: 0, gain: 0.3, octave: 1 },
      { type: 'sine', detune: 0, gain: 0.3, octave: -1 }
    ],
    filter: { type: 'lowpass', frequency: 3000, Q: 0.5, enabled: true },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.1 },
    filterEnvelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.1, amount: 400 }
  },
  'Bass': {
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.6, octave: 0 },
      { type: 'square', detune: -12, gain: 0.4, octave: 0 },
      { type: 'sine', detune: 0, gain: 0.0, octave: 0 }
    ],
    filter: { type: 'lowpass', frequency: 800, Q: 3, enabled: true },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.2 },
    filterEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.1, amount: 400 }
  },
  '808 Bass': {
    oscillators: [
      { type: 'sine', detune: 0, gain: 0.8, octave: 0 },
      { type: 'sine', detune: 0, gain: 0.2, octave: -1 },
      { type: 'triangle', detune: 0, gain: 0.0, octave: 0 }
    ],
    filter: { type: 'lowpass', frequency: 500, Q: 2, enabled: true },
    envelope: { attack: 0.001, decay: 0.5, sustain: 0.3, release: 0.4 },
    filterEnvelope: { attack: 0.001, decay: 0.3, sustain: 0.2, release: 0.2, amount: 300 }
  },
  'Classic Lead': {
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.5, octave: 0 },
      { type: 'sawtooth', detune: 7, gain: 0.5, octave: 0 },
      { type: 'square', detune: -7, gain: 0.0, octave: 0 }
    ],
    filter: { type: 'lowpass', frequency: 1200, Q: 2, enabled: true },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.3 },
    filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.2, amount: 1000 }
  },
  'Pluck': {
    oscillators: [
      { type: 'triangle', detune: 0, gain: 0.6, octave: 0 },
      { type: 'square', detune: 5, gain: 0.4, octave: 1 },
      { type: 'sine', detune: 0, gain: 0.0, octave: 0 }
    ],
    filter: { type: 'lowpass', frequency: 2500, Q: 1.5, enabled: true },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0.0, release: 0.2 },
    filterEnvelope: { attack: 0.001, decay: 0.2, sustain: 0.0, release: 0.1, amount: 1500 }
  },
  'Warm Pad': {
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.4, octave: 0 },
      { type: 'sawtooth', detune: 5, gain: 0.3, octave: 0 },
      { type: 'triangle', detune: -5, gain: 0.3, octave: 0 }
    ],
    filter: { type: 'lowpass', frequency: 1000, Q: 1, enabled: true },
    envelope: { attack: 1.0, decay: 0.5, sustain: 0.8, release: 1.5 },
    filterEnvelope: { attack: 1.2, decay: 0.6, sustain: 0.7, release: 1.0, amount: 600 }
  },
  'Strings': {
    oscillators: [
      { type: 'sawtooth', detune: 0, gain: 0.4, octave: 0 },
      { type: 'sawtooth', detune: 3, gain: 0.3, octave: 0 },
      { type: 'sawtooth', detune: -3, gain: 0.3, octave: 0 }
    ],
    filter: { type: 'lowpass', frequency: 1500, Q: 0.7, enabled: true },
    envelope: { attack: 0.8, decay: 0.3, sustain: 0.9, release: 0.8 },
    filterEnvelope: { attack: 0.9, decay: 0.4, sustain: 0.8, release: 0.6, amount: 500 }
  },
  'Bell Synth': {
    oscillators: [
      { type: 'sine', detune: 0, gain: 0.5, octave: 0 },
      { type: 'sine', detune: 0, gain: 0.3, octave: 2 },
      { type: 'sine', detune: 0, gain: 0.2, octave: 3 }
    ],
    filter: { type: 'lowpass', frequency: 3000, Q: 1, enabled: true },
    envelope: { attack: 0.01, decay: 0.8, sustain: 0.2, release: 0.6 },
    filterEnvelope: { attack: 0.01, decay: 0.6, sustain: 0.1, release: 0.4, amount: 1000 }
  }
};

// =========================================================================
// 🎛️ INSTRUMENTS
// =========================================================================
export const initialInstruments = [
  // === DRUMS ===
  { id: 'kick', name: 'Kick', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/drums/kick.wav', color: '#FF6B6B', mixerTrackId: 'track-1' },
  { id: 'snare', name: 'Snare', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/drums/snare.wav', color: '#4ECDC4', mixerTrackId: 'track-2' },
  { id: 'hi-hat', name: 'Hi-Hat', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/drums/hihat.wav', color: '#95E1D3', mixerTrackId: 'track-3' },
  { id: 'openhat', name: 'Open Hat', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/drums/openhat.wav', color: '#F38181', mixerTrackId: 'track-4' },

  // === KXVI DRUMS ===
  { id: 'clap', name: 'Clap', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/kxvi/clap.wav', color: '#FFA07A', mixerTrackId: 'track-5' },
  { id: '808', name: '808', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/kxvi/808.wav', color: '#8B4789', mixerTrackId: 'track-6' },
  { id: 'rim', name: 'Rim', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/kxvi/rim.wav', color: '#CD853F', mixerTrackId: 'track-7' },
  { id: 'perc', name: 'Perc', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/kxvi/perc.wav', color: '#DAA520', mixerTrackId: 'track-8' },

  // === PIANO (Multi-Sample) ===
  {
    id: 'piano(sampled)',
    name: 'Piano (Sampled)',
    type: INSTRUMENT_TYPES.SAMPLE,
    color: '#FFD93D',
    mixerTrackId: 'track-9',
    multiSamples: [
      { url: '/audio/samples/instruments/piano/C1.ogg', note: 'C1', midiNote: 24 },
      { url: '/audio/samples/instruments/piano/C2.ogg', note: 'C2', midiNote: 36 },
      { url: '/audio/samples/instruments/piano/C3.ogg', note: 'C3', midiNote: 48 },
      { url: '/audio/samples/instruments/piano/C4.ogg', note: 'C4', midiNote: 60 },
      { url: '/audio/samples/instruments/piano/C5.ogg', note: 'C5', midiNote: 72 },
      { url: '/audio/samples/instruments/piano/C6.ogg', note: 'C6', midiNote: 84 },
      { url: '/audio/samples/instruments/piano/C7.ogg', note: 'C7', midiNote: 96 },
      { url: '/audio/samples/instruments/piano/C8.ogg', note: 'C8', midiNote: 108 }
    ]
  },

  // === VASYNTH INSTRUMENTS ===
  { id: 'piano(synth)', name: 'Piano (Synth)', type: INSTRUMENT_TYPES.VASYNTH, color: '#A8E6CF', presetName: 'Piano', mixerTrackId: 'track-10' },
  { id: 'e.piano', name: 'E.Piano', type: INSTRUMENT_TYPES.VASYNTH, color: '#FFB6C1', presetName: 'E. Piano', mixerTrackId: 'track-11' },
  { id: 'organ', name: 'Organ', type: INSTRUMENT_TYPES.VASYNTH, color: '#FFDAB9', presetName: 'Organ', mixerTrackId: 'track-12' },
  { id: 'bass', name: 'Bass', type: INSTRUMENT_TYPES.VASYNTH, color: '#87CEEB', presetName: 'Bass', mixerTrackId: 'track-13' },
  { id: '808bass', name: '808 Bass', type: INSTRUMENT_TYPES.VASYNTH, color: '#9370DB', presetName: '808 Bass', mixerTrackId: 'track-14' },
  { id: 'classiclead', name: 'Classic Lead', type: INSTRUMENT_TYPES.VASYNTH, color: '#F08080', presetName: 'Classic Lead', mixerTrackId: 'track-15' },
  { id: 'pluck', name: 'Pluck', type: INSTRUMENT_TYPES.VASYNTH, color: '#DDA0DD', presetName: 'Pluck', mixerTrackId: 'track-16' },
  { id: 'warmpad', name: 'Warm Pad', type: INSTRUMENT_TYPES.VASYNTH, color: '#D8BFD8', presetName: 'Warm Pad', mixerTrackId: 'track-17' },
  { id: 'strings', name: 'Strings', type: INSTRUMENT_TYPES.VASYNTH, color: '#E6E6FA', presetName: 'Strings', mixerTrackId: 'track-18' },
  { id: 'bellsynth', name: 'Bell Synth', type: INSTRUMENT_TYPES.VASYNTH, color: '#B0E0E6', presetName: 'Bell Synth', mixerTrackId: 'track-19' },

  // === GRANULAR SAMPLER ===
  {
    id: 'solstice-grain',
    name: 'Solstice Grain',
    type: INSTRUMENT_TYPES.GRANULAR,
    color: '#FF6EC7',
    mixerTrackId: 'track-20',
    url: '/audio/samples/instruments/piano/C4.ogg', // Using piano sample for testing
    baseNote: 60, // C4
    params: {
      grainSize: 80,          // ms - smooth grain length
      grainDensity: 12,       // grains/second - ✅ REDUCED from 25 to 12 for performance
      samplePosition: 0.3,    // 0-1 - start position in sample
      positionRandom: 0.15,   // 0-1 - add movement
      pitch: 0,               // semitones
      pitchRandom: 2,         // semitones - subtle pitch variation
      grainEnvelope: 'hann',  // smooth envelope
      reverse: 0.1,           // 10% chance of reverse grains
      spread: 0.7,            // wide stereo spread
      mix: 1.0,               // 100% wet
      gain: 0.8               // master gain
    }
  }
];

// =========================================================================
// 📊 PATTERNS
// =========================================================================
export const initialPatternOrder = ['pattern1', 'pattern2', 'pattern3', 'pattern4'];

export const initialPatterns = {
  pattern1: {
    id: 'pattern1',
    name: 'Trap',
    length: 64,
    color: '#FF6B6B',
    data: {
      kick: trapPattern.kick,
      snare: trapPattern.snare,
      clap: trapPattern.clap,
      'hi-hat': trapPattern['hi-hat'],
      openhat: trapPattern.openhat,
      '808': trapPattern['808'],
      perc: trapPattern.perc,
      '808bass': trapPattern['808bass'],
      bellsynth: trapPattern.bellsynth
    }
  },
  pattern2: {
    id: 'pattern2',
    name: 'Boom Bap',
    length: 256, // ✅ 16 bars (16 * 16 steps)
    color: '#4ECDC4',
    data: {
      kick: boomBapPattern.kick,
      snare: boomBapPattern.snare,
      rim: boomBapPattern.rim,
      'hi-hat': boomBapPattern['hi-hat'],
      perc: boomBapPattern.perc,
      'piano(sampled)': boomBapPattern['piano(sampled)'],
      warmpad: boomBapPattern.warmpad,
      bass: boomBapPattern.bass
    }
  },
  pattern3: {
    id: 'pattern3',
    name: 'Cloud Rap',
    length: 64,
    color: '#95E1D3',
    data: {
      kick: cloudRapPattern.kick,
      snare: cloudRapPattern.snare,
      'hi-hat': cloudRapPattern['hi-hat'],
      openhat: cloudRapPattern.openhat,
      warmpad: cloudRapPattern.warmpad,
      'e.piano': cloudRapPattern['e.piano'],
      bass: cloudRapPattern.bass
    }
  },
  pattern4: {
    id: 'pattern4',
    name: 'Drill',
    length: 64,
    color: '#F38181',
    data: {
      kick: drillPattern.kick,
      snare: drillPattern.snare,
      clap: drillPattern.clap,
      'hi-hat': drillPattern['hi-hat'],
      openhat: drillPattern.openhat,
      rim: drillPattern.rim,
      '808': drillPattern['808'],
      '808bass': drillPattern['808bass'],
      pluck: drillPattern.pluck
    }
  }
};

// =========================================================================
// 🎚️ MIXER CONFIGURATION
// =========================================================================

// Master channel definition
const masterChannel = {
  id: 'master',
  name: 'Master',
  type: MIXER_TRACK_TYPES.MASTER,
  volume: -6,
  pan: 0,
  muted: false,
  solo: false,
  insertEffects: [],
  sends: [],
  output: null,
  eq: {
    enabled: false,
    lowGain: 0,
    midGain: 0,
    highGain: 0
  }
};

// Instrument tracks
const instrumentTracks = initialInstruments.map((inst, index) => ({
  id: inst.mixerTrackId,  // ✅ Use mixerTrackId (track-1, track-2, etc.)
  name: inst.name,
  type: MIXER_TRACK_TYPES.TRACK,  // ✅ FIX: Use TRACK instead of INSTRUMENT
  instrumentId: inst.id,  // Keep instrument ID for reference
  volume: inst.id.includes('bass') || inst.id === 'kick' || inst.id === '808' ? -3 :
          inst.id === 'hi-hat' ? -12 :
          inst.id.includes('pad') || inst.id === 'strings' ? -9 : -6,
  pan: 0,
  muted: false,
  solo: false,
  insertEffects: [],
  sends: [],
  output: 'master',
  eq: {
    enabled: false,
    lowGain: 0,
    midGain: 0,
    highGain: 0
  }
}));

// ✅ FIX: Include master channel in mixer tracks
export const initialMixerTracks = [
  masterChannel,
  ...instrumentTracks
];

export const initialMixer = {
  master: masterChannel,
  tracks: instrumentTracks
};

// =========================================================================
// 🎼 ARRANGEMENT (Timeline)
// =========================================================================
export const initialClips = [
  // Trap pattern (0-4 bars)
  { id: 'clip1', patternId: 'pattern1', trackIndex: 0, startTime: 0, duration: 4, color: '#FF6B6B' },

  // Boom Bap pattern (4-8 bars)
  { id: 'clip2', patternId: 'pattern2', trackIndex: 0, startTime: 4, duration: 4, color: '#4ECDC4' },

  // Cloud Rap pattern (8-12 bars)
  { id: 'clip3', patternId: 'pattern3', trackIndex: 0, startTime: 8, duration: 4, color: '#95E1D3' },

  // Drill pattern (12-16 bars)
  { id: 'clip4', patternId: 'pattern4', trackIndex: 0, startTime: 12, duration: 4, color: '#F38181' }
];

export const initialArrangement = {
  clips: initialClips
};

// =========================================================================
// ⚙️ PROJECT SETTINGS
// =========================================================================
export const initialSettings = {
  bpm: 90, // ✅ Classic 90s boom bap tempo
  timeSignature: { numerator: 4, denominator: 4 },
  swing: 0
};

// =========================================================================
// 🎹 VASYNTH PRESET LIBRARY
// =========================================================================
export const vaSynthPresetLibrary = vaSynthPresets;