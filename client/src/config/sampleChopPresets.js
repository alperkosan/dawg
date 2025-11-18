const createSlice = (id, startStep, endStep, overrides = {}) => ({
  id,
  startStep,
  endStep,
  startOffset: 0,
  endOffset: 1,
  pitch: 0,
  gain: 1,
  reverse: false,
  loop: false,
  ...overrides,
});

export const SAMPLE_CHOP_PRESETS = [
  {
    id: 'quarter-grid',
    name: 'Quarter Grid',
    emoji: '🪓',
    description: 'Divide the bar into four big chops that sweep through the sample.',
    pattern: {
      length: 16,
      snap: '1/4',
      tempo: 140,
      loopEnabled: true,
      slices: [
        createSlice('quarter-1', 0, 4, { startOffset: 0, endOffset: 0.25, gain: 1 }),
        createSlice('quarter-2', 4, 8, { startOffset: 0.25, endOffset: 0.5, pitch: -3, gain: 0.95 }),
        createSlice('quarter-3', 8, 12, { startOffset: 0.5, endOffset: 0.75, pitch: 5, gain: 1.05 }),
        createSlice('quarter-4', 12, 16, { startOffset: 0.75, endOffset: 1, pitch: -7 }),
      ],
    },
  },
  {
    id: 'pitch-stairs',
    name: 'Pitch Stairs',
    emoji: '🪜',
    description: 'Eight short slices climb in pitch for melodic gated rhythms.',
    pattern: {
      length: 16,
      snap: '1/8',
      tempo: 140,
      loopEnabled: true,
      slices: Array.from({ length: 8 }).map((_, index) => {
        const startStep = index * 2;
        const endStep = startStep + 2;
        const startOffset = index * 0.1;
        const endOffset = Math.min(1, startOffset + 0.12);
        return createSlice(`stairs-${index + 1}`, startStep, endStep, {
          startOffset,
          endOffset,
          pitch: index * 2,
          gain: index >= 4 ? 0.95 : 1,
        });
      }),
    },
  },
  {
    id: 'reverse-tails',
    name: 'Reverse Tails',
    emoji: '↩️',
    description: 'Forward chops lead into a reversed tail for instant risers.',
    pattern: {
      length: 16,
      snap: '1/8',
      tempo: 140,
      loopEnabled: true,
      slices: [
        createSlice('rev-1', 0, 4, { startOffset: 0, endOffset: 0.2, gain: 0.95 }),
        createSlice('rev-2', 4, 8, { startOffset: 0.2, endOffset: 0.45, pitch: -2 }),
        createSlice('rev-3', 8, 12, { startOffset: 0.45, endOffset: 0.7, pitch: 2 }),
        createSlice('rev-4', 12, 16, {
          startOffset: 0.7,
          endOffset: 0.95,
          reverse: true,
          pitch: 7,
          gain: 1.1,
        }),
      ],
    },
  },
  {
    id: 'micro-loop',
    name: 'Micro Loop',
    emoji: '♾️',
    description: 'One looping slice at the tail for glitchy sustained notes.',
    pattern: {
      length: 16,
      snap: '1/16',
      tempo: 140,
      loopEnabled: true,
      slices: [
        createSlice('micro-1', 0, 8, { startOffset: 0, endOffset: 0.4, gain: 0.9 }),
        createSlice('micro-loop', 8, 16, {
          startOffset: 0.45,
          endOffset: 0.6,
          loop: true,
          pitch: 12,
          gain: 1.1,
        }),
      ],
    },
  },
  {
    id: 'triplet-hype',
    name: 'Triplet Hype',
    emoji: '💥',
    description: 'Triplet stabs with alternating pitch bends for fills.',
    pattern: {
      length: 16,
      snap: '1/16',
      tempo: 140,
      loopEnabled: true,
      slices: [
        createSlice('tri-1', 0, 4, { startOffset: 0.05, endOffset: 0.25, pitch: 3 }),
        createSlice('tri-2', 5, 9, { startOffset: 0.3, endOffset: 0.45, pitch: -5 }),
        createSlice('tri-3', 10, 13, { startOffset: 0.45, endOffset: 0.6, pitch: 7 }),
        createSlice('tri-4', 13, 16, { startOffset: 0.6, endOffset: 0.85, pitch: -12, loop: true }),
      ],
    },
  },
];

export const getSampleChopPresetById = (presetId) =>
  SAMPLE_CHOP_PRESETS.find((preset) => preset.id === presetId) || null;

