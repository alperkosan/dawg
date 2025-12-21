import { EffectFactory } from './EffectFactory';

/**
 * Central registry for AudioWorklet modules used by DAWG effects.
 * Ensures both live AudioContext and OfflineAudioContext instances
 * load the same processors before attempting to create effect nodes.
 */

const CORE_WORKLETS = [
  {
    processor: 'text-encoder-polyfill',
    path: '/worklets/text-encoder-polyfill.js',
    sequential: true
  },
  {
    processor: 'instrument-processor',
    path: '/worklets/instrument-processor.js'
  },
  {
    processor: 'mixer-processor',
    path: '/worklets/mixer-processor.js'
  },
  {
    processor: 'analysis-processor',
    path: '/worklets/analysis-processor.js'
  },
  {
    processor: 'wasm-sampler-processor',
    path: '/worklets/wasm-sampler-processor.js'
  },
  {
    processor: 'wasm-instrument-processor',
    path: '/worklets/wasm-instrument-processor.js'
  }
];

const EFFECT_WORKLET_PATHS = {
  'arcade-crusher-processor': '/worklets/effects/arcade-crusher-processor.js',
  'atmos-machine-processor': '/worklets/effects/atmos-machine-processor.js',
  'bass-enhancer-808-processor': '/worklets/effects/bass-enhancer-808-processor.js',
  'clipper-processor': '/worklets/effects/clipper-processor.js',
  'compressor-processor': '/worklets/effects/compressor-processor.js',
  'delay-processor': '/worklets/effects/delay-processor.js',
  'feedback-delay-processor': '/worklets/effects/feedback-delay-processor.js',
  'ghost-lfo-processor': '/worklets/effects/ghost-lfo-processor.js',
  'halftime-processor': '/worklets/effects/halftime-processor.js',
  'imager-processor': '/worklets/effects/imager-processor.js',
  'limiter-processor': '/worklets/effects/limiter-processor.js',
  'maximizer-processor': '/worklets/effects/maximizer-processor.js',
  'modern-delay-processor': '/worklets/effects/modern-delay-processor.js',
  'modern-reverb-processor': '/worklets/effects/modern-reverb-processor.js',
  'multiband-compressor-processor': '/worklets/effects/multiband-compressor-processor.js',
  'multiband-eq-processor': '/worklets/effects/multiband-eq-processor.js',
  'multiband-eq-processor-v2': '/worklets/effects/multiband-eq-processor-v2.js',
  'orbit-panner-processor': '/worklets/effects/orbit-panner-processor.js',
  'pitch-shifter-processor': '/worklets/effects/pitch-shifter-processor.js',
  'reverb-processor': '/worklets/effects/reverb-processor.js',
  'rhythm-fx-processor': '/worklets/effects/rhythm-fx-processor.js',
  'sample-morph-processor': '/worklets/effects/sample-morph-processor.js',
  'saturator-processor': '/worklets/effects/saturator-processor.js',
  'sidechain-compressor-processor': '/worklets/effects/sidechain-compressor-processor.js',
  'stardust-chorus-processor': '/worklets/effects/stardust-chorus-processor.js',
  'tidal-filter-processor': '/worklets/effects/tidal-filter-processor.js',
  'transient-designer-processor': '/worklets/effects/transient-designer-processor.js',
  'vortex-phaser-processor': '/worklets/effects/vortex-phaser-processor.js'
};

function getProcessorName(effectTypeOrName) {
  if (!effectTypeOrName) return null;

  const normalized = EffectFactory.normalizeType(effectTypeOrName);
  const def = EffectFactory.workletEffects[normalized];
  if (def?.workletName && EFFECT_WORKLET_PATHS[def.workletName]) {
    return def.workletName;
  }

  const rawLower = effectTypeOrName.toString().trim().toLowerCase();
  const maybeProcessor = rawLower.endsWith('-processor')
    ? rawLower
    : `${normalized}-processor`;

  return EFFECT_WORKLET_PATHS[maybeProcessor] ? maybeProcessor : null;
}

export function collectEffectTypesFromMixerTracks(mixerTracks = {}) {
  const effectTypes = new Set();
  const tracksArray = Array.isArray(mixerTracks)
    ? mixerTracks
    : Object.values(mixerTracks || {});

  tracksArray.forEach(track => {
    const effects = track?.insertEffects || track?.effects || [];
    effects.forEach(effect => {
      if (effect?.type) {
        effectTypes.add(effect.type);
      } else if (effect?.workletName) {
        effectTypes.add(effect.workletName);
      }
    });
  });

  return Array.from(effectTypes);
}

function resolveWorkletModules(effectTypes = []) {
  const modules = new Map();

  CORE_WORKLETS.forEach(def => {
    modules.set(def.processor, def);
  });

  const targetProcessors = new Set();

  if (effectTypes.length === 0) {
    Object.keys(EFFECT_WORKLET_PATHS).forEach(proc => targetProcessors.add(proc));
  } else {
    effectTypes.forEach(type => {
      const processor = getProcessorName(type);
      if (processor) {
        targetProcessors.add(processor);
      }
    });
  }

  targetProcessors.forEach(proc => {
    const path = EFFECT_WORKLET_PATHS[proc];
    if (path) {
      modules.set(proc, { processor: proc, path });
    }
  });

  return Array.from(modules.values());
}

export async function ensureEffectWorkletsLoaded(audioContext, effectTypes = []) {
  if (!audioContext?.audioWorklet) {
    throw new Error('AudioContext is missing audioWorklet support');
  }

  const registry = audioContext.__workletRegistry ||= {
    loaded: new Set()
  };

  const modules = resolveWorkletModules(effectTypes);

  for (const moduleDef of modules) {
    if (registry.loaded.has(moduleDef.processor)) {
      continue;
    }

    try {
      await audioContext.audioWorklet.addModule(moduleDef.path);
      registry.loaded.add(moduleDef.processor);
      if (moduleDef.sequential) {
        // ensure sequential modules finish before continuing
        continue;
      }
    } catch (error) {
      console.error(`❌ Failed to load worklet ${moduleDef.processor}:`, error);
    }
  }
}

