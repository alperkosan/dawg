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

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, Select, ModeSelector, Checkbox } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useMixerStore } from '@/store/useMixerStore';
import { usePlaybackStore } from '@/store/usePlaybackStore';
import { selectBpm } from '@/store/selectors/playbackSelectors';
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
    bpm = 128,
    tempoSync = 0,
    noteDivision = 0.25
  } = effect.settings || {};

  // Get current BPM from playback store
  // ✅ PERFORMANCE FIX: Use selectBpm instead of entire store
  const currentBpm = usePlaybackStore(selectBpm);

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
  const [localTempoSync, setLocalTempoSync] = useState(tempoSync);
  const [localNoteDivision, setLocalNoteDivision] = useState(noteDivision);

  // Pattern state
  const [pattern, setPattern] = useState(() => {
    // Initialize pattern from settings or default to all active
    return effect.settings?.pattern || new Array(16).fill(1);
  });
  const [currentStep, setCurrentStep] = useState(0);

  const categoryColors = useMemo(() => getCategoryColors('rhythm-forge'), []);
  const { setParam, setParams } = useParameterBatcher(effectNode);
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Ref for processor message handling
  const processorPortRef = useRef(null);

  // Ghost values
  const ghostIntensity = useGhostValue(localIntensity, 400);
  const ghostChance = useGhostValue(localChance, 400);
  const ghostSwing = useGhostValue(localSwing, 400);
  const ghostDivision = useGhostValue(localDivision, 400);

  // Initialize processor port for pattern communication
  useEffect(() => {
    if (!effectNode) return;

    // Get the processor port
    if (effectNode.port) {
      processorPortRef.current = effectNode.port;

      // Set initial pattern
      effectNode.port.postMessage({
        type: 'setPattern',
        data: { pattern }
      });

      // Listen for current step updates
      const handleMessage = (e) => {
        if (e.data.type === 'currentStep') {
          setCurrentStep(e.data.step);
        } else if (e.data.type === 'patternGenerated') {
          setPattern(e.data.pattern);
        }
      };

      effectNode.port.onmessage = handleMessage;

      return () => {
        if (effectNode.port) {
          effectNode.port.onmessage = null;
        }
      };
    }
  }, [effectNode, pattern]);

  // Sync with presets and update processor
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
      updates.mode = effect.settings.mode;
    }
    if (effect.settings.tempoSync !== undefined) {
      setLocalTempoSync(effect.settings.tempoSync);
      updates.tempoSync = effect.settings.tempoSync;
    }
    if (effect.settings.noteDivision !== undefined) {
      setLocalNoteDivision(effect.settings.noteDivision);
      updates.noteDivision = effect.settings.noteDivision;
    }
    if (effect.settings.pattern) {
      setPattern(effect.settings.pattern);
    }

    // Update BPM: use current BPM if tempo sync is enabled, otherwise use saved BPM
    if (localTempoSync > 0.5 && currentBpm) {
      updates.bpm = currentBpm;
      setLocalBpm(currentBpm);
    } else if (effect.settings.bpm !== undefined) {
      setLocalBpm(effect.settings.bpm);
      updates.bpm = effect.settings.bpm;
    }

    // Batch update all parameters
    if (Object.keys(updates).length > 0) {
      setParams(updates);
    }
  }, [effect.settings, effectNode, setParams, currentBpm, localTempoSync]);

  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });

    switch (key) {
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
      case 'tempoSync': setLocalTempoSync(value); break;
      case 'noteDivision': setLocalNoteDivision(value); break;
    }
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  // Pattern step toggle
  const handleStepToggle = useCallback((stepIndex) => {
    const newPattern = [...pattern];
    newPattern[stepIndex] = newPattern[stepIndex] > 0 ? 0 : 1;
    setPattern(newPattern);

    // Send to processor
    if (processorPortRef.current) {
      processorPortRef.current.postMessage({
        type: 'setStep',
        data: { step: stepIndex, value: newPattern[stepIndex] }
      });
    }

    // Update settings
    handleMixerEffectChange(trackId, effect.id, { pattern: newPattern });
  }, [pattern, trackId, effect.id, handleMixerEffectChange]);

  // Euclidean pattern generator
  const handleGenerateEuclidean = useCallback((steps, pulses, rotation = 0) => {
    if (processorPortRef.current) {
      processorPortRef.current.postMessage({
        type: 'generateEuclidean',
        data: { steps, pulses, rotation }
      });
    }
  }, []);

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

            {/* Pattern Editor */}
            <div className="bg-gradient-to-br from-black/50 to-pink-950/30 rounded-xl p-6 border border-pink-500/20 mb-4">
              <div className="text-xs font-bold text-pink-400 mb-4 uppercase tracking-wider flex items-center justify-between">
                <span>Pattern Editor</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGenerateEuclidean(16, 4, 0)}
                    className="px-2 py-1 text-[9px] bg-pink-500/20 hover:bg-pink-500/30 rounded border border-pink-500/30"
                    style={{ color: categoryColors.secondary }}
                  >
                    Euclidean
                  </button>
                  <button
                    onClick={() => {
                      const allOn = new Array(16).fill(1);
                      setPattern(allOn);
                      if (processorPortRef.current) {
                        processorPortRef.current.postMessage({
                          type: 'setPattern',
                          data: { pattern: allOn }
                        });
                      }
                      handleMixerEffectChange(trackId, effect.id, { pattern: allOn });
                    }}
                    className="px-2 py-1 text-[9px] bg-pink-500/20 hover:bg-pink-500/30 rounded border border-pink-500/30"
                    style={{ color: categoryColors.secondary }}
                  >
                    All On
                  </button>
                  <button
                    onClick={() => {
                      const allOff = new Array(16).fill(0);
                      setPattern(allOff);
                      if (processorPortRef.current) {
                        processorPortRef.current.postMessage({
                          type: 'setPattern',
                          data: { pattern: allOff }
                        });
                      }
                      handleMixerEffectChange(trackId, effect.id, { pattern: allOff });
                    }}
                    className="px-2 py-1 text-[9px] bg-pink-500/20 hover:bg-pink-500/30 rounded border border-pink-500/30"
                    style={{ color: categoryColors.secondary }}
                  >
                    All Off
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-16 gap-1 mb-2">
                {pattern.map((step, index) => (
                  <button
                    key={index}
                    onClick={() => handleStepToggle(index)}
                    className={`
                      h-12 rounded border-2 transition-all
                      ${step > 0
                        ? 'bg-pink-500/40 border-pink-500/60'
                        : 'bg-black/30 border-pink-500/20'
                      }
                      ${currentStep === index
                        ? 'ring-2 ring-pink-400 ring-offset-1 ring-offset-black'
                        : ''
                      }
                      hover:bg-pink-500/50
                    `}
                    style={{
                      backgroundColor: step > 0
                        ? (currentStep === index ? categoryColors.primary : 'rgba(236, 72, 153, 0.4)')
                        : 'rgba(0, 0, 0, 0.3)',
                      borderColor: currentStep === index
                        ? categoryColors.primary
                        : (step > 0 ? 'rgba(236, 72, 153, 0.6)' : 'rgba(236, 72, 153, 0.2)')
                    }}
                  >
                    <div className="text-[8px] text-white/70 font-bold">
                      {index + 1}
                    </div>
                  </button>
                ))}
              </div>
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
                  valueFormatter={(v) => localTempoSync > 0.5 ? 'SYNC' : `1/${Math.round(v)}`}
                  disabled={localTempoSync > 0.5}
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
                  valueFormatter={(v) => localTempoSync > 0.5 ? `${Math.round(currentBpm || v)}` : `${Math.round(v)}`}
                  disabled={localTempoSync > 0.5}
                />
              </div>

              {/* Tempo Sync Controls */}
              <div className="mt-4 pt-4 border-t border-pink-500/20">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] font-bold tracking-wider uppercase flex items-center gap-2" style={{ color: categoryColors.secondary }}>
                    <span>TEMPO SYNC</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localTempoSync > 0.5}
                        onChange={(e) => handleParamChange('tempoSync', e.target.checked ? 1 : 0)}
                        className="w-4 h-4 rounded border-pink-500/30 bg-black/50"
                        style={{ accentColor: categoryColors.primary }}
                      />
                    </label>
                  </label>
                </div>
                {localTempoSync > 0.5 && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold tracking-wider uppercase text-center" style={{ color: categoryColors.secondary }}>
                      NOTE DIVISION
                    </label>
                    <ModeSelector
                      value={localNoteDivision.toString()}
                      onChange={(val) => handleParamChange('noteDivision', parseFloat(val))}
                      options={[
                        { id: '4', label: '1/32' }, { id: '2', label: '1/16' }, { id: '1', label: '1/8' },
                        { id: '0.5', label: '1/4' }, { id: '0.25', label: '1/2' }, { id: '0.125', label: '1/1' },
                        { id: '0.0833', label: '1/1 Triplet' }, { id: '0.1875', label: '1/4 Dotted' }
                      ]}
                      category="rhythm-forge"
                      compact={true}
                    />
                  </div>
                )}
              </div>
            </div>

          </>
        }

        sidePanel={
          <div className="h-full flex flex-col gap-4">
            {/* Character Panel */}
            <div className="bg-gradient-to-br from-[#1a0b2e]/50 to-black/50 rounded-xl p-6 border border-pink-500/10">
              <div className="text-xs font-bold text-pink-400 mb-4 uppercase tracking-wider">Character</div>
              <div className="grid grid-cols-2 gap-4">
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
                  disabled={localMode === 0} // Disabled for GATE mode
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
                  disabled={localMode !== 0} // Only enabled for GATE mode
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
                  disabled={localMode !== 4} // Only enabled for GLITCH mode
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
                  disabled={localMode !== 5} // Only enabled for TAPE STOP mode
                />
              </div>
              {/* Mode-specific hints */}
              <div className="mt-3 text-[8px] text-white/40 italic">
                {localMode === 0 && 'Fade Time controls gate envelope smoothness'}
                {localMode === 1 && 'Buffer Size controls stutter length'}
                {localMode === 2 && 'Buffer Size controls repeat length'}
                {localMode === 3 && 'Buffer Size controls reverse buffer length'}
                {localMode === 4 && 'Glitch Amount controls random slice probability'}
                {localMode === 5 && 'Tape Speed controls playback rate fade'}
              </div>
            </div>

            {/* Info Panel */}
            <div className="flex-1 flex items-center justify-center">
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
          </div>
        }
      />
    </PluginContainerV2>
  );
};

export default RhythmFXUI_V2;
