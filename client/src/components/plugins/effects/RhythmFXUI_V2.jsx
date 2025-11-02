/**
 * RHYTHM FX UI V2.0 - UNIFIED DESIGN
 *
 * Professional rhythm effects engine
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout (unified design)
 * ✅ PresetManager integration (NO ModeSelector)
 * ✅ Parameter Batching
 * ✅ Category-based theming (rhythm-forge)
 *
 * Modes (via 'mode' parameter):
 * 0 = Gate, 1 = Stutter, 2 = Repeat, 3 = Reverse, 4 = Glitch, 5 = Tape Stop
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, Select } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useMixerStore } from '@/store/useMixerStore';
import { useGhostValue } from '@/hooks/useAudioPlugin';

// Mode options for Select dropdown
const MODE_OPTIONS = [
  { value: 0, label: 'Gate 🚪' },
  { value: 1, label: 'Stutter 🔁' },
  { value: 2, label: 'Repeat 🔄' },
  { value: 3, label: 'Reverse ⏪' },
  { value: 4, label: 'Glitch 🎭' },
  { value: 5, label: 'Tape Stop ⏹️' }
];

const RhythmFXUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    division = 16,
    chance = 100,
    intensity = 100,
    swing = 50,
    bufferSize = 500,
    fadeTime = 10,
    glitchAmount = 50,
    tapeSpeed = 100,
    mode = 0,
    bpm = 128
  } = effect.settings || {};

  // Local state
  const [localDivision, setLocalDivision] = useState(division);
  const [localChance, setLocalChance] = useState(chance);
  const [localIntensity, setLocalIntensity] = useState(intensity);
  const [localSwing, setLocalSwing] = useState(swing);
  const [localBufferSize, setLocalBufferSize] = useState(bufferSize);
  const [localFadeTime, setLocalFadeTime] = useState(fadeTime);
  const [localGlitchAmount, setLocalGlitchAmount] = useState(glitchAmount);
  const [localTapeSpeed, setLocalTapeSpeed] = useState(tapeSpeed);
  const [localMode, setLocalMode] = useState(mode);
  const [localBpm, setLocalBpm] = useState(bpm);

  const categoryColors = useMemo(() => getCategoryColors('rhythm-forge'), []);
  const { setParam } = useParameterBatcher(effectNode);
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Ghost values
  const ghostIntensity = useGhostValue(localIntensity, 400);
  const ghostChance = useGhostValue(localChance, 400);
  const ghostSwing = useGhostValue(localSwing, 400);
  const ghostDivision = useGhostValue(localDivision, 400);

  // Sync with presets
  useEffect(() => {
    console.log('[RhythmFX] Preset loaded:', effect.settings);
    if (effect.settings.division !== undefined) setLocalDivision(effect.settings.division);
    if (effect.settings.chance !== undefined) setLocalChance(effect.settings.chance);
    if (effect.settings.intensity !== undefined) setLocalIntensity(effect.settings.intensity);
    if (effect.settings.swing !== undefined) setLocalSwing(effect.settings.swing);
    if (effect.settings.bufferSize !== undefined) setLocalBufferSize(effect.settings.bufferSize);
    if (effect.settings.fadeTime !== undefined) setLocalFadeTime(effect.settings.fadeTime);
    if (effect.settings.glitchAmount !== undefined) setLocalGlitchAmount(effect.settings.glitchAmount);
    if (effect.settings.tapeSpeed !== undefined) setLocalTapeSpeed(effect.settings.tapeSpeed);
    if (effect.settings.mode !== undefined) setLocalMode(effect.settings.mode);
    if (effect.settings.bpm !== undefined) setLocalBpm(effect.settings.bpm);
  }, [effect.settings]);

  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });

    switch(key) {
      case 'division': setLocalDivision(value); break;
      case 'chance': setLocalChance(value); break;
      case 'intensity': setLocalIntensity(value); break;
      case 'swing': setLocalSwing(value); break;
      case 'bufferSize': setLocalBufferSize(value); break;
      case 'fadeTime': setLocalFadeTime(value); break;
      case 'glitchAmount': setLocalGlitchAmount(value); break;
      case 'tapeSpeed': setLocalTapeSpeed(value); break;
      case 'mode': setLocalMode(value); break;
      case 'bpm': setLocalBpm(value); break;
    }
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="rhythm-forge"
    >
      <TwoPanelLayout
        category="rhythm-forge"

        mainPanel={
          <>
            {/* Mode Selection */}
            <div className="bg-gradient-to-br from-pink-950/20 to-black rounded-xl p-4 border border-pink-500/20 mb-4">
              <div className="text-xs font-bold text-pink-400 mb-3 uppercase tracking-wider">Effect Mode</div>
              <Select
                value={localMode}
                onChange={(val) => handleParamChange('mode', val)}
                options={MODE_OPTIONS}
                category="rhythm-forge"
              />
            </div>

            {/* Main Controls */}
            <div className="bg-gradient-to-br from-black/50 to-pink-950/30 rounded-xl p-6 border border-pink-500/20 mb-4">
              <div className="text-xs font-bold text-pink-400 mb-4 uppercase tracking-wider">Rhythm Parameters</div>
              <div className="grid grid-cols-5 gap-4">
                <Knob
                  label="DIVISION"
                  value={localDivision}
                  ghostValue={ghostDivision}
                  onChange={(val) => handleParamChange('division', Math.round(val))}
                  min={1}
                  max={64}
                  defaultValue={16}
                  sizeVariant="medium"
                  category="rhythm-forge"
                  valueFormatter={(v) => `1/${Math.round(v)}`}
                />

                <Knob
                  label="INTENSITY"
                  value={localIntensity}
                  ghostValue={ghostIntensity}
                  onChange={(val) => handleParamChange('intensity', val)}
                  min={0}
                  max={100}
                  defaultValue={100}
                  sizeVariant="medium"
                  category="rhythm-forge"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />

                <Knob
                  label="CHANCE"
                  value={localChance}
                  ghostValue={ghostChance}
                  onChange={(val) => handleParamChange('chance', val)}
                  min={0}
                  max={100}
                  defaultValue={100}
                  sizeVariant="medium"
                  category="rhythm-forge"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />

                <Knob
                  label="SWING"
                  value={localSwing}
                  ghostValue={ghostSwing}
                  onChange={(val) => handleParamChange('swing', val)}
                  min={0}
                  max={100}
                  defaultValue={50}
                  sizeVariant="medium"
                  category="rhythm-forge"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />

                <Knob
                  label="BPM"
                  value={localBpm}
                  onChange={(val) => handleParamChange('bpm', Math.round(val))}
                  min={60}
                  max={200}
                  defaultValue={128}
                  sizeVariant="medium"
                  category="rhythm-forge"
                  valueFormatter={(v) => `${Math.round(v)}`}
                />
              </div>
            </div>

            {/* Mode-Specific Controls */}
            <div className="bg-gradient-to-br from-[#1a0b2e]/50 to-black/50 rounded-xl p-6 border border-pink-500/10">
              <div className="text-xs font-bold text-pink-400 mb-4 uppercase tracking-wider">Character</div>
              <div className="grid grid-cols-4 gap-4">
                <Knob
                  label="BUFFER SIZE"
                  value={localBufferSize}
                  onChange={(val) => handleParamChange('bufferSize', val)}
                  min={10}
                  max={1000}
                  defaultValue={500}
                  sizeVariant="small"
                  category="rhythm-forge"
                  valueFormatter={(v) => `${v.toFixed(0)} ms`}
                />

                <Knob
                  label="FADE TIME"
                  value={localFadeTime}
                  onChange={(val) => handleParamChange('fadeTime', val)}
                  min={0}
                  max={100}
                  defaultValue={10}
                  sizeVariant="small"
                  category="rhythm-forge"
                  valueFormatter={(v) => `${v.toFixed(0)} ms`}
                />

                <Knob
                  label="GLITCH AMT"
                  value={localGlitchAmount}
                  onChange={(val) => handleParamChange('glitchAmount', val)}
                  min={0}
                  max={100}
                  defaultValue={50}
                  sizeVariant="small"
                  category="rhythm-forge"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />

                <Knob
                  label="TAPE SPEED"
                  value={localTapeSpeed}
                  onChange={(val) => handleParamChange('tapeSpeed', val)}
                  min={0}
                  max={200}
                  defaultValue={100}
                  sizeVariant="small"
                  category="rhythm-forge"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
              </div>
            </div>
          </>
        }

        sidePanel={
          <div className="h-full flex items-center justify-center">
            <div className="text-center p-8">
              <div className="text-pink-400 text-6xl mb-4">🎭</div>
              <div className="text-sm text-pink-500 font-bold mb-2">Rhythm FX</div>
              <div className="text-xs text-white/40 leading-relaxed">
                Infinite rhythmic possibilities - gate, stutter, glitch, repeat, reverse.
              </div>
              <div className="mt-4 text-xs text-white/30">
                Current: {MODE_OPTIONS.find(m => m.value === localMode)?.label || 'Gate'}
              </div>
            </div>
          </div>
        }
      />
    </PluginContainerV2>
  );
};

export default RhythmFXUI_V2;
