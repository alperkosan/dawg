const LOWERCASE_ALIAS = {
  saturator: {
    drive: 'distortion',
    saturation: 'distortion',
    mix: 'wet',
    lowmix: 'lowMix',
    midmix: 'midMix',
    highmix: 'highMix',
  },
  stardustchorus: {
    frequency: 'rate',
    freq: 'rate',
    delay: 'delayTime',
    delaytime: 'delayTime',
  },
};

function normalizeKey(effectType, key) {
  if (!key) {
    return key;
  }
  const normalizedType = (effectType || '').toString().trim().toLowerCase();
  const aliasMap = LOWERCASE_ALIAS[normalizedType];
  if (!aliasMap) {
    return key;
  }

  const canonical = aliasMap[key.toString().trim().toLowerCase()];
  return canonical || key;
}

export function normalizeEffectSettings(effectType, settings = {}) {
  if (!settings || typeof settings !== 'object') {
    return {};
  }

  const normalized = {};
  Object.entries(settings).forEach(([key, value]) => {
    const canonicalKey = normalizeKey(effectType, key);
    normalized[canonicalKey] = value;
  });
  return normalized;
}

export function normalizeEffectParam(effectType, paramName) {
  return normalizeKey(effectType, paramName);
}

