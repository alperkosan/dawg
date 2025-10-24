import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Knob, ModeSelector, ExpandablePanel } from '@/components/controls';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';

/**
 * RHYTHM FX - The Groove Sculptor
 *
 * "The Rhythm Forge" - Infinite rhythmic possibilities
 *
 * Features:
 * - 16-32 step sequencer with visual pattern editor
 * - 6 effect modes (Gate, Stutter, Repeat, Reverse, Glitch, Tape Stop)
 * - Euclidean pattern generator
 * - Host BPM sync
 * - Probability per step
 */

// Effect modes
const RHYTHM_MODES = {
  GATE: {
    id: 'gate',
    name: 'GATE',
    icon: '🚪',
    description: 'Rhythmic gating - mute/unmute',
    settings: { mode: 0, intensity: 100, fadeTime: 10 }
  },
  STUTTER: {
    id: 'stutter',
    name: 'STUTTER',
    icon: '🔁',
    description: 'Repeat tiny buffer slices',
    settings: { mode: 1, intensity: 100, bufferSize: 100 }
  },
  REPEAT: {
    id: 'repeat',
    name: 'REPEAT',
    icon: '🔄',
    description: 'Loop larger sections',
    settings: { mode: 2, intensity: 100, bufferSize: 500 }
  },
  REVERSE: {
    id: 'reverse',
    name: 'REVERSE',
    icon: '⏪',
    description: 'Play backwards',
    settings: { mode: 3, intensity: 100, bufferSize: 250 }
  },
  GLITCH: {
    id: 'glitch',
    name: 'GLITCH',
    icon: '🎭',
    description: 'Random slice rearrangement',
    settings: { mode: 4, intensity: 100, glitchAmount: 80 }
  },
  TAPESTOP: {
    id: 'tapestop',
    name: 'TAPE STOP',
    icon: '⏹️',
    description: 'Vinyl/tape slowdown',
    settings: { mode: 5, intensity: 100, tapeSpeed: 50 }
  }
};

// Step Sequencer Grid
const StepSequencer = ({ pattern, onPatternChange, currentStep, steps = 16 }) => {
  const handleStepClick = useCallback((index) => {
    const newPattern = [...pattern];
    newPattern[index] = newPattern[index] > 0 ? 0 : 1;
    onPatternChange(newPattern);
  }, [pattern, onPatternChange]);

  return (
    <div className="bg-gradient-to-br from-[#1E1B4B] to-[#1F2937] rounded-xl p-4 border border-[#8B5CF6]/30">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-[#06B6D4]/70 font-bold uppercase tracking-wider">
          Step Sequencer
        </div>
        <div className="text-[9px] text-white/40">
          Step {currentStep + 1}/{steps}
        </div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps}, 1fr)` }}>
        {pattern.slice(0, steps).map((value, index) => (
          <button
            key={index}
            onClick={() => handleStepClick(index)}
            className={`
              aspect-square rounded transition-all
              ${value > 0
                ? 'bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] shadow-lg shadow-[#8B5CF6]/50'
                : 'bg-black/50 border border-white/10'
              }
              ${index === currentStep ? 'ring-2 ring-[#10B981] scale-110' : ''}
              hover:scale-105 active:scale-95
            `}
            title={`Step ${index + 1}`}
          >
            {index === currentStep && (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// Pattern Generator Panel
const PatternGenerator = ({ onGenerate }) => {
  const [euclideanSteps, setEuclideanSteps] = useState(16);
  const [euclideanPulses, setEuclideanPulses] = useState(7);
  const [euclideanRotation, setEuclideanRotation] = useState(0);

  const handleGenerateEuclidean = useCallback(() => {
    onGenerate({
      type: 'euclidean',
      steps: euclideanSteps,
      pulses: euclideanPulses,
      rotation: euclideanRotation
    });
  }, [euclideanSteps, euclideanPulses, euclideanRotation, onGenerate]);

  const handleGenerateRandom = useCallback(() => {
    onGenerate({ type: 'random', density: 50 });
  }, [onGenerate]);

  const handleClear = useCallback(() => {
    onGenerate({ type: 'clear' });
  }, [onGenerate]);

  const handleFill = useCallback(() => {
    onGenerate({ type: 'fill' });
  }, [onGenerate]);

  return (
    <div className="bg-gradient-to-br from-black/50 to-[#1E1B4B]/30 rounded-xl p-4 border border-[#8B5CF6]/10">
      <div className="text-[9px] text-[#06B6D4]/70 font-bold uppercase tracking-wider mb-3">
        Pattern Generator
      </div>

      {/* Euclidean */}
      <div className="mb-3 pb-3 border-b border-[#8B5CF6]/10">
        <div className="text-[10px] text-white/60 mb-2">Euclidean Rhythm</div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <label className="text-[8px] text-white/40">Steps</label>
            <input
              type="number"
              min="1"
              max="32"
              value={euclideanSteps}
              onChange={(e) => setEuclideanSteps(parseInt(e.target.value))}
              className="w-full px-2 py-1 text-xs bg-black/50 border border-[#8B5CF6]/30 rounded text-white"
            />
          </div>
          <div>
            <label className="text-[8px] text-white/40">Pulses</label>
            <input
              type="number"
              min="1"
              max="32"
              value={euclideanPulses}
              onChange={(e) => setEuclideanPulses(parseInt(e.target.value))}
              className="w-full px-2 py-1 text-xs bg-black/50 border border-[#8B5CF6]/30 rounded text-white"
            />
          </div>
          <div>
            <label className="text-[8px] text-white/40">Rotate</label>
            <input
              type="number"
              min="0"
              max="31"
              value={euclideanRotation}
              onChange={(e) => setEuclideanRotation(parseInt(e.target.value))}
              className="w-full px-2 py-1 text-xs bg-black/50 border border-[#8B5CF6]/30 rounded text-white"
            />
          </div>
        </div>
        <button
          onClick={handleGenerateEuclidean}
          className="w-full px-3 py-1.5 bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-xs rounded font-semibold hover:opacity-90"
        >
          Generate Euclidean
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleGenerateRandom}
          className="px-2 py-1.5 bg-[#1E1B4B] border border-[#8B5CF6]/30 text-white text-xs rounded hover:bg-[#8B5CF6]/20"
        >
          Random
        </button>
        <button
          onClick={handleFill}
          className="px-2 py-1.5 bg-[#1E1B4B] border border-[#8B5CF6]/30 text-white text-xs rounded hover:bg-[#8B5CF6]/20"
        >
          Fill All
        </button>
        <button
          onClick={handleClear}
          className="px-2 py-1.5 bg-[#1E1B4B] border border-[#EF4444]/30 text-white text-xs rounded hover:bg-[#EF4444]/20"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

// Main RhythmFX UI
export const RhythmFXUI = ({ trackId, effect, onChange }) => {
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
  } = effect.settings;

  const [selectedMode, setSelectedMode] = useState('gate');
  const [pattern, setPattern] = useState(new Array(16).fill(1));
  const [currentStep, setCurrentStep] = useState(0);

  // Ghost values
  const ghostIntensity = useGhostValue(intensity, 400);
  const ghostSwing = useGhostValue(swing, 400);
  const ghostBuffer = useGhostValue(bufferSize, 400);

  // Prepare modes
  const modes = Object.values(RHYTHM_MODES).map(m => ({
    id: m.id,
    label: m.name,
    icon: m.icon,
    description: m.description
  }));

  const currentMode = RHYTHM_MODES[selectedMode.toUpperCase()] || RHYTHM_MODES.GATE;

  // Audio plugin hook
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Send pattern to worklet
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    audioNode.port.postMessage({
      type: 'setPattern',
      data: { pattern }
    });
  }, [pattern, plugin]);

  // Listen for current step from worklet
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (e) => {
      if (e.data.type === 'currentStep') {
        setCurrentStep(e.data.step);
      } else if (e.data.type === 'patternGenerated') {
        setPattern(e.data.pattern);
      }
    };

    audioNode.port.onmessage = handleMessage;
    return () => {
      if (audioNode?.port) {
        audioNode.port.onmessage = null;
      }
    };
  }, [plugin]);

  // Mode change handler
  const handleModeChange = useCallback((modeId) => {
    setSelectedMode(modeId);
    const modeConfig = RHYTHM_MODES[modeId.toUpperCase()];
    if (modeConfig) {
      Object.entries(modeConfig.settings).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  }, [onChange]);

  // Pattern change handler
  const handlePatternChange = useCallback((newPattern) => {
    setPattern(newPattern);
  }, []);

  // Pattern generator handler
  const handleGenerate = useCallback((config) => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    if (config.type === 'euclidean') {
      audioNode.port.postMessage({
        type: 'generateEuclidean',
        data: {
          steps: config.steps,
          pulses: config.pulses,
          rotation: config.rotation
        }
      });
    } else if (config.type === 'random') {
      const randomPattern = new Array(16).fill(0).map(() => Math.random() > 0.5 ? 1 : 0);
      setPattern(randomPattern);
    } else if (config.type === 'clear') {
      setPattern(new Array(16).fill(0));
    } else if (config.type === 'fill') {
      setPattern(new Array(16).fill(1));
    }
  }, [plugin]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-neutral-950 to-black p-4 flex gap-4 overflow-hidden">

      {/* LEFT PANEL: Mode Selection */}
      <div className="w-[240px] flex-shrink-0 flex flex-col gap-4">

        {/* Plugin Header */}
        <div className="bg-gradient-to-r from-[#1E1B4B] to-[#1F2937] rounded-xl px-4 py-3 border border-[#8B5CF6]/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentMode?.icon || '🎵'}</div>
            <div className="flex-1">
              <div className="text-sm font-black text-[#8B5CF6] tracking-wider uppercase">
                Rhythm FX
              </div>
              <div className="text-[9px] text-[#06B6D4]/70">The Rhythm Forge</div>
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <ModeSelector
          modes={modes}
          activeMode={selectedMode}
          onChange={handleModeChange}
          orientation="vertical"
          category="rhythm-forge"
          className="flex-1"
        />

        {/* Quick Info */}
        <div className="bg-gradient-to-br from-[#1E1B4B]/50 to-black/50 rounded-xl p-3 border border-[#8B5CF6]/10">
          <div className="text-[9px] text-[#06B6D4]/70 font-bold uppercase tracking-wider mb-2">
            Current Mode
          </div>
          <div className="text-[10px] text-white/60 leading-relaxed">
            {currentMode?.description || 'Select a mode above'}
          </div>
        </div>
      </div>

      {/* CENTER PANEL: Sequencer + Controls */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-2">

        {/* Step Sequencer */}
        <StepSequencer
          pattern={pattern}
          onPatternChange={handlePatternChange}
          currentStep={currentStep}
          steps={16}
        />

        {/* Main Controls */}
        <div className="bg-gradient-to-br from-black/50 to-[#1E1B4B]/30 rounded-xl p-6 border border-[#8B5CF6]/20">
          <div className="grid grid-cols-4 gap-8">

            {/* Division */}
            <Knob
              label="DIVISION"
              value={division}
              onChange={(val) => onChange('division', val)}
              min={1}
              max={64}
              defaultValue={16}
              sizeVariant="medium"
              category="rhythm-forge"
              valueFormatter={(v) => {
                if (v <= 4) return '1/4';
                if (v <= 8) return '1/8';
                if (v <= 16) return '1/16';
                if (v <= 32) return '1/32';
                return '1/64';
              }}
            />

            {/* Chance */}
            <Knob
              label="CHANCE"
              value={chance}
              onChange={(val) => onChange('chance', val)}
              min={0}
              max={100}
              defaultValue={100}
              sizeVariant="medium"
              category="rhythm-forge"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* Intensity */}
            <Knob
              label="INTENSITY"
              value={intensity}
              ghostValue={ghostIntensity}
              onChange={(val) => onChange('intensity', val)}
              min={0}
              max={100}
              defaultValue={100}
              sizeVariant="medium"
              category="rhythm-forge"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* Swing */}
            <Knob
              label="SWING"
              value={swing}
              ghostValue={ghostSwing}
              onChange={(val) => onChange('swing', val)}
              min={0}
              max={100}
              defaultValue={50}
              centerDetent={true}
              sizeVariant="medium"
              category="rhythm-forge"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />
          </div>
        </div>

        {/* Advanced Controls */}
        <ExpandablePanel
          title="Advanced"
          icon="⚙️"
          category="rhythm-forge"
          defaultExpanded={false}
        >
          <div className="grid grid-cols-4 gap-6 p-4">

            {/* Buffer Size */}
            <Knob
              label="BUFFER"
              value={bufferSize}
              ghostValue={ghostBuffer}
              onChange={(val) => onChange('bufferSize', val)}
              min={10}
              max={2000}
              defaultValue={500}
              sizeVariant="medium"
              category="rhythm-forge"
              valueFormatter={(v) => `${v.toFixed(0)}ms`}
            />

            {/* Fade Time */}
            <Knob
              label="FADE"
              value={fadeTime}
              onChange={(val) => onChange('fadeTime', val)}
              min={1}
              max={50}
              defaultValue={10}
              sizeVariant="medium"
              category="rhythm-forge"
              valueFormatter={(v) => `${v.toFixed(0)}ms`}
            />

            {/* Glitch Amount */}
            <Knob
              label="GLITCH"
              value={glitchAmount}
              onChange={(val) => onChange('glitchAmount', val)}
              min={0}
              max={100}
              defaultValue={50}
              sizeVariant="medium"
              category="rhythm-forge"
              valueFormatter={(v) => `${v.toFixed(0)}%`}
            />

            {/* BPM */}
            <Knob
              label="BPM"
              value={bpm}
              onChange={(val) => onChange('bpm', val)}
              min={60}
              max={200}
              defaultValue={128}
              sizeVariant="medium"
              category="rhythm-forge"
              valueFormatter={(v) => `${v.toFixed(0)}`}
            />
          </div>
        </ExpandablePanel>
      </div>

      {/* RIGHT PANEL: Pattern Generator + Stats */}
      <div className="w-[280px] flex-shrink-0 flex flex-col gap-4">

        {/* Pattern Generator */}
        <PatternGenerator onGenerate={handleGenerate} />

        {/* Stats */}
        <div className="bg-gradient-to-br from-black/50 to-[#1E1B4B]/30 rounded-xl p-4 border border-[#8B5CF6]/10">
          <div className="text-[9px] text-[#06B6D4]/70 uppercase tracking-wider mb-3 font-bold">
            Processing
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-white/50">Mode</span>
              <span className="text-[#8B5CF6] font-mono font-bold">
                {currentMode?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Division</span>
              <span className="text-[#8B5CF6] font-mono font-bold">
                1/{Math.floor(division)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Active Steps</span>
              <span className="text-[#8B5CF6] font-mono font-bold">
                {pattern.filter(v => v > 0).length}/{pattern.length}
              </span>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="flex-1 bg-gradient-to-br from-[#1E1B4B]/20 to-black/50 rounded-xl p-4 border border-[#8B5CF6]/10">
          <div className="text-[9px] text-[#06B6D4]/70 font-bold uppercase tracking-wider mb-3">
            How It Works
          </div>
          <div className="space-y-2 text-[10px] text-white/50 leading-relaxed">
            <p>
              <span className="text-[#8B5CF6] font-bold">Division:</span> Note timing
            </p>
            <p>
              <span className="text-[#8B5CF6] font-bold">Chance:</span> Step probability
            </p>
            <p>
              <span className="text-[#8B5CF6] font-bold">Intensity:</span> Effect depth
            </p>
            <p className="pt-2 border-t border-[#8B5CF6]/10 text-[9px]">
              Click steps to toggle. Use generator for instant patterns.
            </p>
          </div>
        </div>

        {/* Category Badge */}
        <div className="bg-gradient-to-r from-[#1E1B4B] to-[#1F2937] rounded-lg px-3 py-2 border border-[#8B5CF6]/20 text-center">
          <div className="text-[8px] text-[#06B6D4]/50 uppercase tracking-wider">Category</div>
          <div className="text-[10px] text-[#8B5CF6] font-bold">The Rhythm Forge</div>
        </div>
      </div>

    </div>
  );
};

export default RhythmFXUI;
