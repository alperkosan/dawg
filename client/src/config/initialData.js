import { INSTRUMENT_TYPES, MIXER_TRACK_TYPES } from './constants';
import { createDefaultSampleChopPattern } from '@/lib/audio/instruments/sample/sampleChopUtils';

// =========================================================================
// 🎵 140 BPM HIP-HOP PROJECT - Multiple Sub-Genres
// =========================================================================

// Helper function to create notes
// ✅ DRUM NOTES: Oval (visualLength: 1) - extends to pattern end but shows as 1 step
// ✅ VASYNTH NOTES: Rectangular (visualLength = length) - shows actual duration
const note = (time, pitch = 'C4', velocity = 100, duration = '16n', patternLength = 64, isDrum = false) => {
  // Convert duration string to steps (e.g., '1n' = 16 steps, '2n' = 8 steps, '4n' = 4 steps, '8n' = 2 steps, '16n' = 1 step)
  const durationToSteps = (dur) => {
    if (typeof dur === 'number') return dur;
    // ✅ FIX: Check longer patterns first to avoid false matches (e.g., '16n' contains '1n')
    if (dur.includes('16n')) return 1;
    if (dur.includes('8n')) return 2;
    if (dur.includes('4n')) return 4;
    if (dur.includes('2n')) return 8;
    if (dur.includes('1n')) return 16;
    if (dur.includes('32n')) return 0.5; // Half step (not common but supported)
    // Default to 1 step if pattern not recognized
    return 1;
  };

  const durationSteps = durationToSteps(duration);
  const audioLengthInSteps = isDrum
    ? Math.max(1, patternLength - time) // Drums extend to pattern end
    : durationSteps; // VASynth uses actual duration

  return {
    id: `note_${time}_${pitch}_${Math.random().toString(36).substring(7)}`,
    time,
    pitch,
    velocity,
    duration, // Legacy format for compatibility
    length: audioLengthInSteps, // Audio length in steps
    ...(isDrum ? { visualLength: 1 } : {}) // ✅ DRUMS: Oval (visualLength: 1), VASYNTH: Rectangular (no visualLength)
  };
};

// =========================================================================
// 🔥 PATTERN 1: TRAP (140 BPM)
// Aggressive hi-hats, 808 bass, hard-hitting
// =========================================================================
const TRAP_PATTERN_LENGTH = 64;
const trapPattern = {
  // ✅ DRUMS: All oval (visualLength: 1)
  kick: [0, 6, 10, 16, 22, 26, 32, 38, 42, 48, 54, 58].map(t => note(t, 'C4', 100, '16n', TRAP_PATTERN_LENGTH, true)),
  snare: [8, 24, 40, 56].map(t => note(t, 'C4', 95, '16n', TRAP_PATTERN_LENGTH, true)),
  clap: [8, 24, 40, 56].map(t => note(t, 'C4', 80, '16n', TRAP_PATTERN_LENGTH, true)), // Layered with snare
  'hi-hat': [
    // Fast triplet hi-hats (classic trap)
    ...Array.from({ length: 64 }).map((_, i) => {
      const velocity = i % 3 === 0 ? 80 : (i % 3 === 1 ? 45 : 60);
      return note(i, 'F#4', velocity, '32n', TRAP_PATTERN_LENGTH, true);
    })
  ],
  openhat: [15, 31, 47, 63].map(t => note(t, 'G#4', 70, '8n', TRAP_PATTERN_LENGTH, true)),
  '808': [
    // Hard-hitting 808 sub bass
    { t: 0, p: 'C1', d: '4n' }, { t: 6, p: 'C1', d: '16n' }, { t: 10, p: 'G0', d: '16n' },
    { t: 16, p: 'A#0', d: '4n' }, { t: 22, p: 'A#0', d: '16n' }, { t: 26, p: 'F0', d: '16n' },
    { t: 32, p: 'G#0', d: '4n' }, { t: 38, p: 'G#0', d: '16n' }, { t: 42, p: 'D#0', d: '16n' },
    { t: 48, p: 'A#0', d: '2n' }, { t: 56, p: 'C1', d: '8n' },
  ].map(n => note(n.t, n.p, 100, n.d, TRAP_PATTERN_LENGTH, true)),
  perc: [4, 12, 20, 28, 36, 44, 52, 60].map(t => note(t, 'C4', 65, '16n', TRAP_PATTERN_LENGTH, true)), // Texture
  // ✅ VASYNTH: Rectangular notes (no visualLength, actual duration)
  '808bass': [
    { t: 0, p: 'C2', d: '8n' }, { t: 8, p: 'C2', d: '4n' }, { t: 10, p: 'G1', d: '2n' },
    { t: 16, p: 'A#1', d: '8n' }, { t: 24, p: 'A#1', d: '4n' }, { t: 26, p: 'F1', d: '2n' },
    { t: 32, p: 'G#1', d: '8n' }, { t: 40, p: 'G#1', d: '4n' }, { t: 42, p: 'D#1', d: '2n' },
    { t: 48, p: 'A#1', d: '8n' }, { t: 52, p: 'C2', d: '4n' }, { t: 56, p: 'D2', d: '8n' },
  ].map(n => note(n.t, n.p, 100, n.d, TRAP_PATTERN_LENGTH, false)),
  'bellsynth': [
    { t: 0, p: 'C5', d: '4n' }, { t: 4, p: 'G4', d: '8n' }, { t: 6, p: 'D#5', d: '8n' },
    { t: 12, p: 'A#4', d: '4n' }, { t: 16, p: 'F4', d: '8n' }, { t: 18, p: 'C5', d: '8n' },
    { t: 24, p: 'G#4', d: '4n' }, { t: 28, p: 'D#4', d: '8n' }, { t: 30, p: 'A#4', d: '8n' },
    { t: 36, p: 'A#4', d: '2n' }, { t: 44, p: 'C5', d: '4n' }, { t: 48, p: 'G5', d: '8n' }, { t: 52, p: 'D#5', d: '8n' },
  ].map(n => note(n.t, n.p, 75, n.d, TRAP_PATTERN_LENGTH, false))
};

// =========================================================================
// 💎 PATTERN 2: BOOM BAP (90 BPM) - 16 BARS SHOWCASE
// Classic 90s NY style: dusty drums, jazzy loops, minimal arrangement
// Think: Pete Rock, DJ Premier, J Dilla vibes
// =========================================================================
const BOOM_BAP_PATTERN_LENGTH = 256; // 16 bars (16 * 16 steps)
const boomBapPattern = {
  // === DRUMS (16 bars) - Classic 90s breakbeat style - ✅ OVAL
  kick: [
    // Bar 1-8: Classic boom bap pattern (heavy kick on 1 and 3)
    0, 16, 32, 48, 64, 80, 96, 112,
    // Bar 9-16: Variation with occasional doubles
    128, 140, 144, 160, 176, 188, 192, 208, 224, 236, 240
  ].map(t => note(t, 'C4', 100, '8n', BOOM_BAP_PATTERN_LENGTH, true)),

  snare: [
    // Bar 1-16: Classic backbeat (always on 2 and 4)
    8, 24, 40, 56, 72, 88, 104, 120,
    136, 152, 168, 184, 200, 216, 232, 248
  ].map(t => note(t, 'C4', 90, '8n', BOOM_BAP_PATTERN_LENGTH, true)),

  rim: [
    // Bar 1-8: Ghost notes (subtle)
    6, 14, 22, 30, 38, 46, 54, 62,
    70, 78, 86, 94, 102, 110, 118, 126,
    // Bar 9-16: Slightly more active but still sparse
    134, 142, 150, 158, 166, 174, 182, 190,
    198, 206, 214, 222, 230, 238, 246, 254
  ].map(t => note(t, 'C4', 50, '32n', BOOM_BAP_PATTERN_LENGTH, true)), // Quiet ghost notes

  'hi-hat': [
    // Bar 1-8: Sparse, open hi-hats only (90s minimal style)
    4, 12, 20, 28, 36, 44, 52, 60,
    68, 76, 84, 92, 100, 108, 116, 124,
    // Bar 9-16: Slightly more closed hats
    132, 136, 140, 144, 148, 152, 156, 160,
    164, 168, 172, 176, 180, 184, 188, 192,
    196, 200, 204, 208, 212, 216, 220, 224,
    228, 232, 236, 240, 244, 248, 252
  ].map((t, i) => note(t, i < 16 ? 'G#4' : 'F#4', i < 16 ? 60 : 45, '8n', BOOM_BAP_PATTERN_LENGTH, true)),

  perc: [
    // Minimal shaker/texture (very sparse, 90s lofi style)
    15, 31, 47, 63, 79, 95, 111, 127,
    143, 159, 175, 191, 207, 223, 239, 255
  ].map(t => note(t, 'C4', 40, '16n', BOOM_BAP_PATTERN_LENGTH, true)),

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
  ].map(n => note(n.t, n.p, 70, n.d, BOOM_BAP_PATTERN_LENGTH, false)), // ✅ Sample-based, rectangular notes (no visualLength)

  // === VASYNTH: Rectangular notes with actual durations ===
  // ✅ WARM PAD: Long sustained chords (rectangular, shows full duration)
  warmpad: [
    // Bar 1-4: C major (long sustain)
    { t: 0, p: 'C3', d: '2n' }, { t: 0, p: 'E3', d: '2n' }, { t: 0, p: 'G3', d: '2n' },
    // Bar 5-8: Repeat with variation
    { t: 32, p: 'C3', d: '2n' }, { t: 32, p: 'E3', d: '2n' }, { t: 32, p: 'G3', d: '2n' },
    { t: 64, p: 'A2', d: '2n' }, { t: 64, p: 'C3', d: '2n' }, { t: 64, p: 'E3', d: '2n' },
    // Bar 9-12: A minor progression
    { t: 96, p: 'A3', d: '4n' }, { t: 96, p: 'C4', d: '4n' }, { t: 96, p: 'E4', d: '4n' },
    { t: 112, p: 'A3', d: '4n' }, { t: 112, p: 'C4', d: '4n' }, { t: 112, p: 'E4', d: '4n' },
    { t: 128, p: 'F2', d: '2n' }, { t: 128, p: 'A2', d: '2n' }, { t: 128, p: 'C3', d: '2n' },
    { t: 160, p: 'G2', d: '2n' }, { t: 160, p: 'B2', d: '2n' }, { t: 160, p: 'D3', d: '2n' },
    // Bar 13-16: Final chords
    { t: 192, p: 'C3', d: '4n' }, { t: 192, p: 'E3', d: '4n' }, { t: 192, p: 'G3', d: '4n' },
    { t: 208, p: 'A3', d: '4n' }, { t: 208, p: 'C4', d: '4n' }, { t: 208, p: 'E4', d: '4n' },
    { t: 224, p: 'F2', d: '4n' }, { t: 224, p: 'A2', d: '4n' }, { t: 224, p: 'C3', d: '4n' },
    { t: 240, p: 'G2', d: '4n' }, { t: 240, p: 'B2', d: '4n' }, { t: 240, p: 'D3', d: '4n' }
  ].map(n => note(n.t, n.p, 30, n.d, BOOM_BAP_PATTERN_LENGTH, false)), // Very quiet, just atmosphere

  // ✅ BASS: Rhythmic bassline with varied durations
  bass: [
    // Bar 1-4: Root notes with rhythm
    { t: 0, p: 'C2', d: '4n' }, { t: 4, p: 'C2', d: '8n' }, { t: 6, p: 'E2', d: '8n' },
    { t: 16, p: 'A1', d: '4n' }, { t: 20, p: 'A1', d: '8n' }, { t: 22, p: 'C2', d: '8n' },
    { t: 32, p: 'F1', d: '4n' }, { t: 36, p: 'F1', d: '8n' }, { t: 38, p: 'A1', d: '8n' },
    { t: 48, p: 'G1', d: '2n' },
    // Bar 5-8: Variation
    { t: 64, p: 'C2', d: '8n' }, { t: 68, p: 'E2', d: '8n' }, { t: 72, p: 'G2', d: '4n' },
    { t: 80, p: 'A1', d: '8n' }, { t: 84, p: 'C2', d: '8n' }, { t: 88, p: 'E2', d: '4n' },
    { t: 96, p: 'F1', d: '8n' }, { t: 100, p: 'A1', d: '8n' }, { t: 104, p: 'C2', d: '4n' },
    { t: 112, p: 'G1', d: '8n' }, { t: 116, p: 'B1', d: '8n' }, { t: 120, p: 'D2', d: '4n' },
  ].map(n => note(n.t, n.p, 75, n.d, BOOM_BAP_PATTERN_LENGTH, false))
};

// =========================================================================
// ☁️ PATTERN 3: CLOUD RAP (140 BPM)
// Ethereal, spacey, ambient vibes
// =========================================================================
const CLOUD_RAP_PATTERN_LENGTH = 64;
const cloudRapPattern = {
  // ✅ DRUMS: Oval notes
  kick: [0, 16, 32, 48].map(t => note(t, 'C4', 85, '4n', CLOUD_RAP_PATTERN_LENGTH, true)),
  snare: [8, 24, 40, 56].map(t => note(t, 'C4', 70, '8n', CLOUD_RAP_PATTERN_LENGTH, true)),
  'hi-hat': [
    ...Array.from({ length: 16 }).map((_, i) => {
      return note(i * 4, 'F#4', 50, '8n', CLOUD_RAP_PATTERN_LENGTH, true);
    })
  ],
  openhat: [6, 14, 22, 30, 38, 46, 54, 62].map(t => note(t, 'G#4', 60, '4n', CLOUD_RAP_PATTERN_LENGTH, true)),
  // ✅ VASYNTH: Rectangular notes with varied durations
  warmpad: [
    { t: 0, p: 'C4', d: '2n' }, { t: 0, p: 'E4', d: '2n' }, { t: 0, p: 'G4', d: '2n' },
    { t: 16, p: 'C4', d: '2n' }, { t: 16, p: 'E4', d: '2n' }, { t: 16, p: 'G4', d: '2n' },
    { t: 32, p: 'A3', d: '2n' }, { t: 32, p: 'C4', d: '2n' }, { t: 32, p: 'E4', d: '2n' },
    { t: 48, p: 'A3', d: '2n' }, { t: 48, p: 'C4', d: '2n' }, { t: 48, p: 'E4', d: '2n' },
  ].map(n => note(n.t, n.p, 60, n.d, CLOUD_RAP_PATTERN_LENGTH, false)),
  'e.piano': [
    // Melodic pattern with varied note lengths
    { t: 0, p: 'C5', d: '4n' }, { t: 4, p: 'E5', d: '8n' }, { t: 6, p: 'G5', d: '8n' },
    { t: 8, p: 'A4', d: '4n' }, { t: 12, p: 'C5', d: '8n' }, { t: 14, p: 'E5', d: '8n' },
    { t: 16, p: 'F4', d: '4n' }, { t: 20, p: 'A4', d: '8n' }, { t: 22, p: 'C5', d: '8n' },
    { t: 24, p: 'G4', d: '2n' },
    { t: 32, p: 'C5', d: '8n' }, { t: 34, p: 'E5', d: '8n' }, { t: 36, p: 'G5', d: '4n' },
    { t: 40, p: 'A4', d: '8n' }, { t: 42, p: 'C5', d: '8n' }, { t: 44, p: 'E5', d: '4n' },
    { t: 48, p: 'F4', d: '8n' }, { t: 50, p: 'A4', d: '8n' }, { t: 52, p: 'C5', d: '4n' },
    { t: 56, p: 'G4', d: '8n' },
  ].map(n => note(n.t, n.p, 70, n.d, CLOUD_RAP_PATTERN_LENGTH, false)),
  bass: [
    // Rhythmic bass with different durations
    { t: 0, p: 'C3', d: '4n' }, { t: 4, p: 'C3', d: '8n' }, { t: 6, p: 'E3', d: '8n' },
    { t: 16, p: 'A2', d: '4n' }, { t: 20, p: 'A2', d: '8n' }, { t: 22, p: 'C3', d: '8n' },
    { t: 32, p: 'F2', d: '4n' }, { t: 36, p: 'F2', d: '8n' }, { t: 38, p: 'A2', d: '8n' },
    { t: 48, p: 'G2', d: '8n' }, { t: 52, p: 'B2', d: '8n' }, { t: 56, p: 'D3', d: '8n' },
  ].map(n => note(n.t, n.p, 75, n.d, CLOUD_RAP_PATTERN_LENGTH, false))
};

// =========================================================================
// 🔪 PATTERN 4: DRILL (140 BPM)
// Dark, sliding 808s, aggressive
// =========================================================================
const DRILL_PATTERN_LENGTH = 64;
const drillPattern = {
  // ✅ DRUMS: Oval notes
  kick: [0, 6, 12, 16, 22, 28, 32, 38, 44, 48, 54, 60].map(t => note(t, 'C4', 100, '16n', DRILL_PATTERN_LENGTH, true)),
  snare: [8, 24, 40, 56].map(t => note(t, 'C4', 90, '16n', DRILL_PATTERN_LENGTH, true)),
  clap: [8, 24, 40, 56].map(t => note(t, 'C4', 75, '16n', DRILL_PATTERN_LENGTH, true)), // UK Drill clap layer
  'hi-hat': [
    ...Array.from({ length: 64 }).map((_, i) => {
      const velocity = i % 4 === 0 ? 70 : (i % 4 === 2 ? 80 : 35);
      return note(i, 'F#4', velocity, '16n', DRILL_PATTERN_LENGTH, true);
    })
  ],
  openhat: [15, 31, 47].map(t => note(t, 'G#4', 65, '4n', DRILL_PATTERN_LENGTH, true)),
  rim: [2, 10, 18, 26, 34, 42, 50, 58].map(t => note(t, 'C4', 60, '32n', DRILL_PATTERN_LENGTH, true)), // Drill rolls
  '808': [
    // Deep 808 slides (UK Drill style)
    { t: 0, p: 'C0', d: '8n' }, { t: 2, p: 'C#0', d: '16n' }, { t: 4, p: 'D0', d: '8n' },
    { t: 8, p: 'A#-1', d: '4n' }, { t: 14, p: 'A-1', d: '16n' },
    { t: 16, p: 'G#-1', d: '8n' }, { t: 18, p: 'A-1', d: '16n' }, { t: 20, p: 'A#-1', d: '8n' },
    { t: 24, p: 'F-1', d: '4n' }, { t: 30, p: 'F#-1', d: '16n' },
    { t: 32, p: 'D#-1', d: '8n' }, { t: 34, p: 'E-1', d: '16n' }, { t: 36, p: 'F-1', d: '8n' },
    { t: 40, p: 'G#-1', d: '4n' }, { t: 46, p: 'A-1', d: '16n' },
    { t: 48, p: 'C0', d: '2n' }, { t: 56, p: 'A#-1', d: '8n' },
  ].map(n => note(n.t, n.p, 100, n.d, DRILL_PATTERN_LENGTH, true)),
  // ✅ VASYNTH: Rectangular notes with actual durations
  '808bass': [
    // Sliding 808s with varied durations for rhythm
    { t: 0, p: 'C2', d: '4n' }, { t: 4, p: 'C#2', d: '8n' }, { t: 6, p: 'D2', d: '8n' },
    { t: 8, p: 'A#1', d: '4n' }, { t: 12, p: 'A1', d: '8n' }, { t: 14, p: 'A#1', d: '8n' },
    { t: 16, p: 'G#1', d: '4n' }, { t: 20, p: 'A1', d: '8n' }, { t: 22, p: 'A#1', d: '8n' },
    { t: 24, p: 'F1', d: '4n' }, { t: 28, p: 'F#1', d: '8n' }, { t: 30, p: 'G1', d: '8n' },
    { t: 32, p: 'D#1', d: '4n' }, { t: 36, p: 'E1', d: '8n' }, { t: 38, p: 'F1', d: '8n' },
    { t: 40, p: 'G#1', d: '4n' }, { t: 44, p: 'A1', d: '8n' }, { t: 46, p: 'A#1', d: '8n' },
    { t: 48, p: 'C2', d: '2n' }, { t: 56, p: 'A#1', d: '4n' },
  ].map(n => note(n.t, n.p, 100, n.d, DRILL_PATTERN_LENGTH, false)),
  pluck: [
    // Melodic pluck pattern with varied note lengths
    { t: 0, p: 'C5', d: '8n' }, { t: 2, p: 'D#5', d: '8n' }, { t: 4, p: 'G5', d: '4n' },
    { t: 8, p: 'A#4', d: '8n' }, { t: 10, p: 'D5', d: '8n' }, { t: 12, p: 'F5', d: '4n' },
    { t: 16, p: 'G#4', d: '8n' }, { t: 18, p: 'C5', d: '8n' }, { t: 20, p: 'D#5', d: '4n' },
    { t: 24, p: 'C5', d: '8n' }, { t: 26, p: 'E5', d: '8n' }, { t: 28, p: 'G5', d: '4n' },
    { t: 32, p: 'A#4', d: '8n' }, { t: 34, p: 'D5', d: '8n' }, { t: 36, p: 'F5', d: '4n' },
    { t: 40, p: 'G#4', d: '8n' }, { t: 42, p: 'C5', d: '8n' }, { t: 44, p: 'D#5', d: '4n' },
    { t: 48, p: 'C5', d: '2n' }, { t: 56, p: 'G5', d: '8n' },
  ].map(n => note(n.t, n.p, 70, n.d, DRILL_PATTERN_LENGTH, false))
};

// =========================================================================
// 🔥 PATTERN 5: VASYNTH V2 SHOWCASE (128 BPM)
// ✅ NEW: Redesigned with varied durations and creative rhythms
// Demonstrating unison, modulation, and effects features
// =========================================================================
const VASYNTH_SHOWCASE_PATTERN_LENGTH = 64;
const vaSynthShowcasePattern = {
  // ✅ DRUMS: Oval notes
  kick: [0, 16, 32, 48].map(t => note(t, 'C4', 100, '16n', VASYNTH_SHOWCASE_PATTERN_LENGTH, true)),
  snare: [8, 24, 40, 56].map(t => note(t, 'C4', 85, '16n', VASYNTH_SHOWCASE_PATTERN_LENGTH, true)),
  'hi-hat': [
    ...Array.from({ length: 32 }).map((_, i) => {
      const velocity = i % 2 === 0 ? 70 : 45;
      return note(i * 2, 'F#4', velocity, '8n', VASYNTH_SHOWCASE_PATTERN_LENGTH, true);
    })
  ],

  // ✅ VASYNTH: Rectangular notes with varied durations and new rhythms
  // 🎹 HYPER SAW: Melodic lead with dynamic note lengths
  hypersaw: [
    { t: 0, p: 'C4', d: '2n' }, { t: 8, p: 'D4', d: '8n' }, { t: 10, p: 'E4', d: '8n' },
    { t: 12, p: 'G4', d: '4n' }, { t: 16, p: 'C5', d: '8n' }, { t: 18, p: 'B4', d: '8n' },
    { t: 20, p: 'A4', d: '4n' }, { t: 24, p: 'G4', d: '8n' }, { t: 26, p: 'F4', d: '8n' },
    { t: 28, p: 'E4', d: '2n' }, { t: 36, p: 'D4', d: '8n' }, { t: 38, p: 'C4', d: '8n' },
    { t: 40, p: 'E4', d: '4n' }, { t: 44, p: 'G4', d: '4n' }, { t: 48, p: 'C5', d: '2n' },
    { t: 56, p: 'B4', d: '4n' }, { t: 60, p: 'A4', d: '4n' }
  ].map(n => note(n.t, n.p, 85, n.d, VASYNTH_SHOWCASE_PATTERN_LENGTH, false)),

  // 🎵 TRANCE PLUCK: Arpeggiated pattern with rhythmic variations
  trancepluck: [
    // Bar 1: Fast arpeggio
    { t: 0, p: 'C5', d: '8n' }, { t: 2, p: 'E5', d: '8n' }, { t: 4, p: 'G5', d: '8n' }, { t: 6, p: 'C6', d: '8n' },
    // Bar 2: Syncopated pattern
    { t: 8, p: 'B4', d: '4n' }, { t: 12, p: 'E5', d: '8n' }, { t: 14, p: 'G5', d: '8n' }, { t: 16, p: 'B5', d: '4n' },
    // Bar 3: Melodic line
    { t: 20, p: 'A4', d: '8n' }, { t: 22, p: 'E5', d: '8n' }, { t: 24, p: 'A5', d: '4n' }, { t: 28, p: 'C6', d: '4n' },
    // Bar 4: Chord progression
    { t: 32, p: 'G4', d: '8n' }, { t: 34, p: 'D5', d: '8n' }, { t: 36, p: 'G5', d: '4n' }, { t: 40, p: 'B5', d: '4n' },
    { t: 44, p: 'F4', d: '8n' }, { t: 46, p: 'A4', d: '8n' }, { t: 48, p: 'C5', d: '2n' },
    { t: 56, p: 'E5', d: '4n' }, { t: 60, p: 'G5', d: '4n' }
  ].map(n => note(n.t, n.p, 80, n.d, VASYNTH_SHOWCASE_PATTERN_LENGTH, false)),

  // ☁️ DREAM PAD: Evolving chord progressions with varied durations
  dreampad: [
    // Bar 1-2: C major (sustained then staccato)
    { t: 0, p: 'C3', d: '2n' }, { t: 0, p: 'E3', d: '2n' }, { t: 0, p: 'G3', d: '2n' }, { t: 0, p: 'C4', d: '2n' },
    { t: 8, p: 'C3', d: '4n' }, { t: 8, p: 'E3', d: '4n' }, { t: 8, p: 'G3', d: '4n' }, { t: 8, p: 'C4', d: '4n' },
    { t: 12, p: 'C3', d: '4n' }, { t: 12, p: 'E3', d: '4n' }, { t: 12, p: 'G3', d: '4n' }, { t: 12, p: 'C4', d: '4n' },
    // Bar 3-4: A minor (rhythmic)
    { t: 16, p: 'A2', d: '4n' }, { t: 16, p: 'C3', d: '4n' }, { t: 16, p: 'E3', d: '4n' }, { t: 16, p: 'A3', d: '4n' },
    { t: 20, p: 'A2', d: '4n' }, { t: 20, p: 'C3', d: '4n' }, { t: 20, p: 'E3', d: '4n' }, { t: 20, p: 'A3', d: '4n' },
    { t: 24, p: 'A2', d: '2n' }, { t: 24, p: 'C3', d: '2n' }, { t: 24, p: 'E3', d: '2n' }, { t: 24, p: 'A3', d: '2n' },
    // Bar 5-6: F major
    { t: 32, p: 'F2', d: '4n' }, { t: 32, p: 'A2', d: '4n' }, { t: 32, p: 'C3', d: '4n' }, { t: 32, p: 'F3', d: '4n' },
    { t: 36, p: 'F2', d: '8n' }, { t: 36, p: 'A2', d: '8n' }, { t: 36, p: 'C3', d: '8n' }, { t: 36, p: 'F3', d: '8n' },
    { t: 38, p: 'F2', d: '8n' }, { t: 38, p: 'A2', d: '8n' }, { t: 38, p: 'C3', d: '8n' }, { t: 38, p: 'F3', d: '8n' },
    { t: 40, p: 'F2', d: '2n' }, { t: 40, p: 'A2', d: '2n' }, { t: 40, p: 'C3', d: '2n' }, { t: 40, p: 'F3', d: '2n' },
    // Bar 7-8: G major (resolution)
    { t: 48, p: 'G2', d: '4n' }, { t: 48, p: 'B2', d: '4n' }, { t: 48, p: 'D3', d: '4n' }, { t: 48, p: 'G3', d: '4n' },
    { t: 52, p: 'G2', d: '4n' }, { t: 52, p: 'B2', d: '4n' }, { t: 52, p: 'D3', d: '4n' }, { t: 52, p: 'G3', d: '4n' },
    { t: 56, p: 'G2', d: '8n' }, { t: 56, p: 'B2', d: '8n' }, { t: 56, p: 'D3', d: '8n' }, { t: 56, p: 'G3', d: '8n' }
  ].map(n => note(n.t, n.p, 60, n.d, VASYNTH_SHOWCASE_PATTERN_LENGTH, false)),

  // 🎸 WOBBLE BASS: Rhythmic bassline with syncopation
  wobblebass: [
    { t: 0, p: 'C2', d: '4n' }, { t: 4, p: 'C2', d: '8n' }, { t: 6, p: 'D2', d: '8n' },
    { t: 8, p: 'E2', d: '4n' }, { t: 12, p: 'G2', d: '4n' },
    { t: 16, p: 'A1', d: '4n' }, { t: 20, p: 'A1', d: '8n' }, { t: 22, p: 'G1', d: '8n' },
    { t: 24, p: 'C2', d: '4n' }, { t: 28, p: 'E2', d: '4n' },
    { t: 32, p: 'F1', d: '8n' }, { t: 34, p: 'F1', d: '8n' }, { t: 36, p: 'E1', d: '8n' }, { t: 38, p: 'F1', d: '8n' },
    { t: 40, p: 'A1', d: '4n' }, { t: 44, p: 'C2', d: '4n' },
    { t: 48, p: 'G1', d: '2n' }, { t: 56, p: 'B1', d: '8n' }
  ].map(n => note(n.t, n.p, 90, n.d, VASYNTH_SHOWCASE_PATTERN_LENGTH, false)),

  // 🎹 ARP LEAD: Dynamic arpeggio with rhythmic breaks
  arplead: [
    // Bar 1: Fast ascending arpeggio
    { t: 0, p: 'C5', d: '8n' }, { t: 2, p: 'E5', d: '8n' }, { t: 4, p: 'G5', d: '8n' }, { t: 6, p: 'C6', d: '8n' },
    { t: 8, p: 'G5', d: '8n' }, { t: 10, p: 'E5', d: '8n' }, { t: 12, p: 'C5', d: '4n' },
    // Bar 2: Descending pattern
    { t: 16, p: 'A4', d: '8n' }, { t: 18, p: 'C5', d: '8n' }, { t: 20, p: 'E5', d: '8n' }, { t: 22, p: 'A5', d: '8n' },
    { t: 24, p: 'E5', d: '4n' }, { t: 28, p: 'C5', d: '4n' },
    // Bar 3: Syncopated arpeggio
    { t: 32, p: 'F4', d: '8n' }, { t: 34, p: 'A4', d: '8n' }, { t: 36, p: 'C5', d: '8n' }, { t: 38, p: 'F5', d: '8n' },
    { t: 40, p: 'C5', d: '4n' }, { t: 44, p: 'A4', d: '4n' },
    // Bar 4: Resolution
    { t: 48, p: 'G4', d: '8n' }, { t: 50, p: 'B4', d: '8n' }, { t: 52, p: 'D5', d: '8n' }, { t: 54, p: 'G5', d: '8n' },
    { t: 56, p: 'D5', d: '4n' }, { t: 60, p: 'B4', d: '4n' }
  ].map(n => note(n.t, n.p, 75, n.d, VASYNTH_SHOWCASE_PATTERN_LENGTH, false)),

  // 🔊 FAT BASS: Powerful bassline with varied rhythms
  fatbass: [
    { t: 0, p: 'C1', d: '8n' }, { t: 2, p: 'C1', d: '8n' }, { t: 4, p: 'D1', d: '8n' }, { t: 6, p: 'E1', d: '8n' },
    { t: 8, p: 'G1', d: '4n' }, { t: 12, p: 'E1', d: '4n' },
    { t: 16, p: 'A0', d: '8n' }, { t: 18, p: 'A0', d: '8n' }, { t: 20, p: 'G0', d: '8n' }, { t: 22, p: 'A0', d: '8n' },
    { t: 24, p: 'C1', d: '4n' }, { t: 28, p: 'E1', d: '4n' },
    { t: 32, p: 'F0', d: '8n' }, { t: 34, p: 'F0', d: '8n' }, { t: 36, p: 'E0', d: '8n' }, { t: 38, p: 'F0', d: '8n' },
    { t: 40, p: 'A0', d: '4n' }, { t: 44, p: 'C1', d: '4n' },
    { t: 48, p: 'G0', d: '2n' }, { t: 56, p: 'B0', d: '8n' }
  ].map(n => note(n.t, n.p, 85, n.d, VASYNTH_SHOWCASE_PATTERN_LENGTH, false)),

  // 🎤 VOCAL SYNTH: Melodic phrase with expressive timing
  vocalsynth: [
    { t: 0, p: 'C4', d: '4n' }, { t: 4, p: 'D4', d: '8n' }, { t: 6, p: 'E4', d: '8n' },
    { t: 8, p: 'G4', d: '2n' }, { t: 16, p: 'E4', d: '4n' }, { t: 20, p: 'D4', d: '8n' },
    { t: 22, p: 'C4', d: '8n' }, { t: 24, p: 'A3', d: '2n' },
    { t: 32, p: 'A3', d: '4n' }, { t: 36, p: 'C4', d: '8n' }, { t: 38, p: 'D4', d: '8n' },
    { t: 40, p: 'E4', d: '4n' }, { t: 44, p: 'G4', d: '4n' }, { t: 48, p: 'A3', d: '2n' },
    { t: 56, p: 'G3', d: '4n' }, { t: 60, p: 'F3', d: '4n' }
  ].map(n => note(n.t, n.p, 70, n.d, VASYNTH_SHOWCASE_PATTERN_LENGTH, false)),

  // 💫 SIDECHAIN LEAD: Chord progression with rhythmic variation
  sidechainlead: [
    // Bar 1: E minor
    { t: 0, p: 'E4', d: '2n' }, { t: 0, p: 'G4', d: '2n' }, { t: 0, p: 'C5', d: '2n' },
    { t: 8, p: 'E4', d: '4n' }, { t: 8, p: 'G4', d: '4n' }, { t: 8, p: 'C5', d: '4n' },
    { t: 12, p: 'E4', d: '4n' }, { t: 12, p: 'G4', d: '4n' }, { t: 12, p: 'C5', d: '4n' },
    // Bar 2: A minor
    { t: 16, p: 'C4', d: '4n' }, { t: 16, p: 'E4', d: '4n' }, { t: 16, p: 'A4', d: '4n' },
    { t: 20, p: 'C4', d: '4n' }, { t: 20, p: 'E4', d: '4n' }, { t: 20, p: 'A4', d: '4n' },
    { t: 24, p: 'C4', d: '2n' }, { t: 24, p: 'E4', d: '2n' }, { t: 24, p: 'A4', d: '2n' },
    // Bar 3: F major
    { t: 32, p: 'A3', d: '8n' }, { t: 32, p: 'C4', d: '8n' }, { t: 32, p: 'F4', d: '8n' },
    { t: 34, p: 'A3', d: '8n' }, { t: 34, p: 'C4', d: '8n' }, { t: 34, p: 'F4', d: '8n' },
    { t: 36, p: 'A3', d: '4n' }, { t: 36, p: 'C4', d: '4n' }, { t: 36, p: 'F4', d: '4n' },
    { t: 40, p: 'A3', d: '2n' }, { t: 40, p: 'C4', d: '2n' }, { t: 40, p: 'F4', d: '2n' },
    // Bar 4: G major (resolution)
    { t: 48, p: 'B3', d: '4n' }, { t: 48, p: 'D4', d: '4n' }, { t: 48, p: 'G4', d: '4n' },
    { t: 52, p: 'B3', d: '4n' }, { t: 52, p: 'D4', d: '4n' }, { t: 52, p: 'G4', d: '4n' },
    { t: 56, p: 'B3', d: '8n' }, { t: 56, p: 'D4', d: '8n' }, { t: 56, p: 'G4', d: '8n' }
  ].map(n => note(n.t, n.p, 75, n.d, VASYNTH_SHOWCASE_PATTERN_LENGTH, false))
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
const sampleInstrument = (instrument) => ({
  sampleChop: createDefaultSampleChopPattern(),
  sampleChopMode: 'standard',
  ...instrument,
});

export const initialInstruments = [
  // === DRUMS ===
  sampleInstrument({ id: 'kick', name: 'Kick', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/drums/kick.wav', color: '#FF6B6B', mixerTrackId: 'track-1' }),
  sampleInstrument({ id: 'snare', name: 'Snare', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/drums/snare.wav', color: '#4ECDC4', mixerTrackId: 'track-2' }),
  sampleInstrument({ id: 'hi-hat', name: 'Hi-Hat', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/drums/hihat.wav', color: '#95E1D3', mixerTrackId: 'track-3' }),
  sampleInstrument({ id: 'openhat', name: 'Open Hat', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/drums/openhat.wav', color: '#F38181', mixerTrackId: 'track-4' }),

  // === KXVI DRUMS ===
  sampleInstrument({ id: 'clap', name: 'Clap', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/kxvi/clap.wav', color: '#FFA07A', mixerTrackId: 'track-5' }),
  sampleInstrument({ id: '808', name: '808', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/kxvi/808.wav', color: '#8B4789', mixerTrackId: 'track-6' }),
  sampleInstrument({ id: 'rim', name: 'Rim', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/kxvi/rim.wav', color: '#CD853F', mixerTrackId: 'track-7' }),
  sampleInstrument({ id: 'perc', name: 'Perc', type: INSTRUMENT_TYPES.SAMPLE, url: '/audio/samples/kxvi/perc.wav', color: '#DAA520', mixerTrackId: 'track-8' }),

  // === PIANO (Multi-Sample) ===
  sampleInstrument({
    id: 'piano(sampled)',
    name: 'Piano (Sampled)',
    type: INSTRUMENT_TYPES.SAMPLE,
    color: '#FFD93D',
    mixerTrackId: 'track-9',
    multiSamples: [
      // Low register
      { url: '/audio/samples/instruments/piano/C1.ogg', note: 'C1', midiNote: 24 },
      { url: '/audio/samples/instruments/piano/C2.ogg', note: 'C2', midiNote: 36 },
      { url: '/audio/samples/instruments/piano/C3.ogg', note: 'C3', midiNote: 48 },

      // Mid register - FULL CHROMATIC SCALE (C4 octave)
      { url: '/audio/samples/instruments/piano/C4.ogg', note: 'C4', midiNote: 60 },
      { url: '/audio/samples/instruments/piano/Cs4.ogg', note: 'C#4', midiNote: 61 },
      { url: '/audio/samples/instruments/piano/D4.ogg', note: 'D4', midiNote: 62 },
      { url: '/audio/samples/instruments/piano/Ds4.ogg', note: 'D#4', midiNote: 63 },
      { url: '/audio/samples/instruments/piano/E4.ogg', note: 'E4', midiNote: 64 },
      { url: '/audio/samples/instruments/piano/F4.ogg', note: 'F4', midiNote: 65 },
      { url: '/audio/samples/instruments/piano/Fs4.ogg', note: 'F#4', midiNote: 66 },
      { url: '/audio/samples/instruments/piano/G4.ogg', note: 'G4', midiNote: 67 },
      { url: '/audio/samples/instruments/piano/Gs4.ogg', note: 'G#4', midiNote: 68 },
      { url: '/audio/samples/instruments/piano/A4.ogg', note: 'A4', midiNote: 69 },
      { url: '/audio/samples/instruments/piano/As4.ogg', note: 'A#4', midiNote: 70 },
      { url: '/audio/samples/instruments/piano/B4.ogg', note: 'B4', midiNote: 71 },

      // High register
      { url: '/audio/samples/instruments/piano/C5.ogg', note: 'C5', midiNote: 72 },
      { url: '/audio/samples/instruments/piano/C6.ogg', note: 'C6', midiNote: 84 },
      { url: '/audio/samples/instruments/piano/C7.ogg', note: 'C7', midiNote: 96 },
      { url: '/audio/samples/instruments/piano/C8.ogg', note: 'C8', midiNote: 108 }
    ]
  }),

  // === VASYNTH INSTRUMENTS (Classic) ===
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

  // === VASYNTH V2 INSTRUMENTS (Showcasing Unison, Modulation, Effects) ===
  { id: 'hypersaw', name: 'Hyper Saw', type: INSTRUMENT_TYPES.VASYNTH, color: '#FF1493', presetName: 'Hyper Saw', mixerTrackId: 'track-20' },
  { id: 'trancepluck', name: 'Trance Pluck', type: INSTRUMENT_TYPES.VASYNTH, color: '#00CED1', presetName: 'Trance Pluck', mixerTrackId: 'track-21' },
  { id: 'dreampad', name: 'Dream Pad', type: INSTRUMENT_TYPES.VASYNTH, color: '#9370DB', presetName: 'Dream Pad', mixerTrackId: 'track-22' },
  { id: 'wobblebass', name: 'Wobble Bass', type: INSTRUMENT_TYPES.VASYNTH, color: '#32CD32', presetName: 'Wobble Bass', mixerTrackId: 'track-23' },
  { id: 'arplead', name: 'Arp Lead', type: INSTRUMENT_TYPES.VASYNTH, color: '#FF6347', presetName: 'Arp Lead', mixerTrackId: 'track-24' },
  { id: 'fatbass', name: 'Fat Bass', type: INSTRUMENT_TYPES.VASYNTH, color: '#8B008B', presetName: 'Fat Bass', mixerTrackId: 'track-25' },
  { id: 'vocalsynth', name: 'Vocal Synth', type: INSTRUMENT_TYPES.VASYNTH, color: '#FFD700', presetName: 'Vocal Synth', mixerTrackId: 'track-26' },
  { id: 'sidechainlead', name: 'Sidechain Lead', type: INSTRUMENT_TYPES.VASYNTH, color: '#FF69B4', presetName: 'Sidechain Lead', mixerTrackId: 'track-27' },
  //     gain: 0.8               // master gain
  //   }
  // }
];

// =========================================================================
// 📊 PATTERNS
// =========================================================================
export const initialPatternOrder = ['pattern1', 'pattern2', 'pattern3', 'pattern4', 'pattern5'];

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
  },
  pattern5: {
    id: 'pattern5',
    name: 'VASynth V2 Showcase',
    length: 64,
    color: '#FF1493',
    data: {
      kick: vaSynthShowcasePattern.kick,
      snare: vaSynthShowcasePattern.snare,
      'hi-hat': vaSynthShowcasePattern['hi-hat'],
      hypersaw: vaSynthShowcasePattern.hypersaw,
      trancepluck: vaSynthShowcasePattern.trancepluck,
      dreampad: vaSynthShowcasePattern.dreampad,
      wobblebass: vaSynthShowcasePattern.wobblebass,
      arplead: vaSynthShowcasePattern.arplead,
      fatbass: vaSynthShowcasePattern.fatbass,
      vocalsynth: vaSynthShowcasePattern.vocalsynth,
      sidechainlead: vaSynthShowcasePattern.sidechainlead
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
  volume: 0,  // ✅ Unity gain (0dB) - professional DAW standard
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
  volume: 0,  // ✅ Unity gain (0dB) - professional DAW standard (all faders start at same level)
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
  { id: 'clip4', patternId: 'pattern4', trackIndex: 0, startTime: 12, duration: 4, color: '#F38181' },

  // VASynth V2 Showcase pattern (16-20 bars)
  { id: 'clip5', patternId: 'pattern5', trackIndex: 0, startTime: 16, duration: 4, color: '#FF1493' }
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