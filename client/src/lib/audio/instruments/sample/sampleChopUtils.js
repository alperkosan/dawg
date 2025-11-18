export const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));

export const createDefaultSampleChopPattern = () => ({
  id: 'sample-chop-default',
  name: 'Init Chop',
  length: 16,
  snap: '1/16',
  tempo: 140,
  loopEnabled: false,
  slices: [],
});

