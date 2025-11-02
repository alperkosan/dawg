/**
 * RHYTHM FX UI V2.0
 *
 * Professional rhythm effects engine
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (rhythm-forge)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, ModeSelector } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useMixerStore } from '@/store/useMixerStore';
import { useGhostValue } from '@/hooks/useAudioPlugin';

// Rhythm FX Modes
const RHYTHM_MODES = {
  gate: {
    id: 'gate',
    name: 'Gate',
    icon: '🚪',
    description: 'Rhythmic gating - mute/unmute steps',
    baseParams: { mode: 0, intensity: 100, fadeTime: 10 }
  },
  stutter: {
    id: 'stutter',
    name: 'Stutter',
    icon: '🔁',
    description: 'Repeat tiny buffer slices',
    baseParams: { mode: 1, intensity: 100, bufferSize: 100 }
  },
  repeat: {
    id: 'repeat',
    name: 'Repeat',
    icon: '🔄',
    description: 'Loop larger sections with feedback',
    baseParams: { mode: 2, intensity: 100, bufferSize: 500 }
  },
  reverse: {
    id: 'reverse',
    name: 'Reverse',
    icon: '⏪',
    description: 'Play backwards (scratch effect)',
    baseParams: { mode: 3, intensity: 100, bufferSize: 250 }
  },
  glitch: {
    id: 'glitch',
    name: 'Glitch',
    icon: '🎭',
    description: 'Random slice rearrangement',
    baseParams: { mode: 4, intensity: 100, glitchAmount: 80 }
  },
  tapestop: {
    id: 'tapestop',
    name: 'Tape Stop',
    icon: '⏹️',
    description: 'Vinyl/tape slowdown effect',
    baseParams: { mode: 5, intensity: 100, tapeSpeed: 50 }
  }
};

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
  const [selectedModeId, setSelectedModeId] = useState('gate');

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('rhythm-forge'), []);

  // Use ParameterBatcher
  const { setParam, setParams } = useParameterBatcher(effectNode);

  // Mixer store
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Ghost values
  const ghostIntensity = useGhostValue(localIntensity, 400);
  const ghostSwing = useGhostValue(localSwing, 400);
  const ghostChance = useGhostValue(localChance, 400);

  // Sync with effect.settings
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.division !== undefined) {
      setLocalDivision(effect.settings.division);
      updates.division = effect.settings.division;
    }
    if (effect.settings.chance !== undefined) {
      setLocalChance(effect.settings.chance);
      updates.chance = effect.settings.chance;
    }
    if (effect.settings.intensity !== undefined) {
      setLocalIntensity(effect.settings.intensity);
      updates.intensity = effect.settings.intensity;
    }
    if (effect.settings.swing !== undefined) {
      setLocalSwing(effect.settings.swing);
      updates.swing = effect.settings.swing;
    }
    if (effect.settings.bufferSize !== undefined) {
      setLocalBufferSize(effect.settings.bufferSize);
      updates.bufferSize = effect.settings.bufferSize;
    }
    if (effect.settings.fadeTime !== undefined) {
      setLocalFadeTime(effect.settings.fadeTime);
      updates.fadeTime = effect.settings.fadeTime;
    }
    if (effect.settings.glitchAmount !== undefined) {
      setLocalGlitchAmount(effect.settings.glitchAmount);
      updates.glitchAmount = effect.settings.glitchAmount;
    }
    if (effect.settings.tapeSpeed !== undefined) {
      setLocalTapeSpeed(effect.settings.tapeSpeed);
      updates.tapeSpeed = effect.settings.tapeSpeed;
    }
    if (effect.settings.mode !== undefined) {
      setLocalMode(effect.settings.mode);
      // Find mode ID from mode number
      const modeEntry = Object.entries(RHYTHM_MODES).find(([_, config]) => config.baseParams.mode === effect.settings.mode);
      if (modeEntry) setSelectedModeId(modeEntry[0]);
      updates.mode = effect.settings.mode;
    }
    if (effect.settings.bpm !== undefined) {
      setLocalBpm(effect.settings.bpm);
      updates.bpm = effect.settings.bpm;
    }

    if (Object.keys(updates).length > 0) {
      setParams(updates, { immediate: true });
    }
  }, [effect.settings, effectNode, setParams]);

  // Handle parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });

    const stateMap = {
      division: setLocalDivision,
      chance: setLocalChance,
      intensity: setLocalIntensity,
      swing: setLocalSwing,
      bufferSize: setLocalBufferSize,
      fadeTime: setLocalFadeTime,
      glitchAmount: setLocalGlitchAmount,
      tapeSpeed: setLocalTapeSpeed,
      mode: setLocalMode,
      bpm: setLocalBpm
    };
    if (stateMap[key]) stateMap[key](value);
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  // Handle mode change
  const handleModeChange = useCallback((modeId) => {
    setSelectedModeId(modeId);
    const modeConfig = RHYTHM_MODES[modeId];
    if (modeConfig) {
      handleParamChange('mode', modeConfig.baseParams.mode);
      if (modeConfig.baseParams.intensity !== undefined) {
        handleParamChange('intensity', modeConfig.baseParams.intensity);
      }
      if (modeConfig.baseParams.fadeTime !== undefined) {
        handleParamChange('fadeTime', modeConfig.baseParams.fadeTime);
      }
      if (modeConfig.baseParams.bufferSize !== undefined) {
        handleParamChange('bufferSize', modeConfig.baseParams.bufferSize);
      }
      if (modeConfig.baseParams.glitchAmount !== undefined) {
        handleParamChange('glitchAmount', modeConfig.baseParams.glitchAmount);
      }
      if (modeConfig.baseParams.tapeSpeed !== undefined) {
        handleParamChange('tapeSpeed', modeConfig.baseParams.tapeSpeed);
      }
    }
  }, [handleParamChange]);

  // Prepare modes for ModeSelector
  const modes = Object.values(RHYTHM_MODES).map(m => ({
    id: m.id,
    label: m.name,
    icon: m.icon,
    description: m.description
  }));

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
            {/* Mode Selector */}
            <div className="p-6">
              <ModeSelector
                modes={modes}
                activeMode={selectedModeId}
                onChange={handleModeChange}
                orientation="horizontal"
                category="rhythm-forge"
              />
            </div>

            {/* Main Controls */}
            <div className="grid grid-cols-5 gap-4 p-6">
              <Knob
                label="DIVISION"
                value={localDivision}
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

            {/* Secondary Controls */}
            <div className="grid grid-cols-4 gap-4 p-6">
              <Knob
                label="BUFFER SIZE"
                value={localBufferSize}
                onChange={(val) => handleParamChange('bufferSize', Math.round(val))}
                min={10}
                max={2000}
                defaultValue={500}
                sizeVariant="medium"
                category="rhythm-forge"
                valueFormatter={(v) => `${Math.round(v)}ms`}
              />

              <Knob
                label="FADE TIME"
                value={localFadeTime}
                onChange={(val) => handleParamChange('fadeTime', Math.round(val))}
                min={1}
                max={50}
                defaultValue={10}
                sizeVariant="medium"
                category="rhythm-forge"
                valueFormatter={(v) => `${Math.round(v)}ms`}
              />

              <Knob
                label="GLITCH AMOUNT"
                value={localGlitchAmount}
                onChange={(val) => handleParamChange('glitchAmount', val)}
                min={0}
                max={100}
                defaultValue={50}
                sizeVariant="medium"
                category="rhythm-forge"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />

              <Knob
                label="TAPE SPEED"
                value={localTapeSpeed}
                onChange={(val) => handleParamChange('tapeSpeed', val)}
                min={-200}
                max={200}
                defaultValue={100}
                sizeVariant="medium"
                category="rhythm-forge"
                valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
              />
            </div>
          </>
        }

        sidePanel={
          <>
            {/* Stats Display */}
            <div 
              className="rounded-xl p-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}1A`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                Processing Info
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Mode</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {RHYTHM_MODES[selectedModeId]?.name || 'Gate'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Division</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    1/{localDivision}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Intensity</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localIntensity.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Chance</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localChance.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Swing</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localSwing.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">BPM</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localBpm}
                  </span>
                </div>
              </div>
            </div>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default RhythmFXUI_V2;

