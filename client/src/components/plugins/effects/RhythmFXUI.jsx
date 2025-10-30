/**
 * RHYTHM FX V2.0 - The Groove Sculptor
 *
 * "The Rhythm Forge" - Professional rhythm effects engine
 * Inspired by: Gross Beat, Effectrix, dBlue Glitch, Gross Beat
 *
 * Features:
 * - 16-32 step visual pattern editor
 * - 6 effect modes (Gate, Stutter, Repeat, Reverse, Glitch, Tape Stop)
 * - Euclidean pattern generator
 * - Real-time pattern visualization
 * - Host BPM sync
 * - Probability per step
 * - Category theming ('rhythm-forge' - green palette)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Knob, ModeSelector, ExpandablePanel } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

// ============================================================================
// RHYTHM FX MODES
// ============================================================================

const RHYTHM_MODES = {
  gate: {
    id: 'gate',
    name: 'Gate',
    icon: '🚪',
    description: 'Rhythmic gating - mute/unmute steps',
    category: 'rhythmic',
    baseParams: { mode: 0, intensity: 100, fadeTime: 10 }
  },
  stutter: {
    id: 'stutter',
    name: 'Stutter',
    icon: '🔁',
    description: 'Repeat tiny buffer slices (Gross Beat style)',
    category: 'rhythmic',
    baseParams: { mode: 1, intensity: 100, bufferSize: 100 }
  },
  repeat: {
    id: 'repeat',
    name: 'Repeat',
    icon: '🔄',
    description: 'Loop larger sections with feedback',
    category: 'rhythmic',
    baseParams: { mode: 2, intensity: 100, bufferSize: 500 }
  },
  reverse: {
    id: 'reverse',
    name: 'Reverse',
    icon: '⏪',
    description: 'Play backwards (scratch effect)',
    category: 'creative',
    baseParams: { mode: 3, intensity: 100, bufferSize: 250 }
  },
  glitch: {
    id: 'glitch',
    name: 'Glitch',
    icon: '🎭',
    description: 'Random slice rearrangement (dBlue Glitch style)',
    category: 'creative',
    baseParams: { mode: 4, intensity: 100, glitchAmount: 80 }
  },
  tapestop: {
    id: 'tapestop',
    name: 'Tape Stop',
    icon: '⏹️',
    description: 'Vinyl/tape slowdown effect',
    category: 'creative',
    baseParams: { mode: 5, intensity: 100, tapeSpeed: 50 }
  }
};

// ============================================================================
// PATTERN EDITOR VISUALIZER
// ============================================================================

const PatternEditorVisualizer = ({ pattern, currentStep, mode, intensity, division }) => {
  const drawPattern = useCallback((ctx, width, height) => {
    // 🎨 THEME: "The Rhythm Forge" - Green palette
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(15, 25, 20, 0.95)');
    bgGradient.addColorStop(1, 'rgba(10, 15, 12, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const steps = pattern.length;
    const stepWidth = width / steps;
    const stepHeight = height;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(46, 204, 113, 0.1)'; // Green
    ctx.lineWidth = 1;
    for (let i = 0; i <= steps; i++) {
      const x = i * stepWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, stepHeight);
      ctx.stroke();
    }

    // Draw pattern steps
    pattern.forEach((value, index) => {
      const x = index * stepWidth;
      const isActive = value > 0;
      const isCurrent = index === currentStep;
      const opacity = isActive ? (0.3 + value * 0.7) : 0.05;

      if (isActive) {
        // Active step - green gradient
        const gradient = ctx.createLinearGradient(x, 0, x + stepWidth, 0);
        gradient.addColorStop(0, `rgba(46, 204, 113, ${opacity * 0.8})`);
        gradient.addColorStop(0.5, `rgba(39, 174, 96, ${opacity})`);
        gradient.addColorStop(1, `rgba(46, 204, 113, ${opacity * 0.8})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, 0, stepWidth, stepHeight);

        // Glow effect for active steps
        if (isCurrent) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'rgba(46, 204, 113, 0.8)';
          ctx.strokeStyle = 'rgba(46, 204, 113, 1)';
          ctx.lineWidth = 3;
        } else {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)';
          ctx.lineWidth = 1.5;
        }
        ctx.beginPath();
        ctx.rect(x, 0, stepWidth, stepHeight);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Step number
      ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.3)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${(index + 1) % 10}`,
        x + stepWidth / 2,
        stepHeight - 4
      );
    });

    // Current step indicator (pulsing)
    if (currentStep >= 0 && currentStep < steps) {
      const x = currentStep * stepWidth;
      const pulse = (Date.now() % 1000) / 1000;
      const pulseSize = 8 + pulse * 4;

      ctx.fillStyle = `rgba(46, 204, 113, ${0.6 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(x + stepWidth / 2, stepHeight / 2, pulseSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mode indicator
    ctx.fillStyle = 'rgba(46, 204, 113, 0.9)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`DIVISION: 1/${division}`, 8, 16);
    ctx.fillText(`ACTIVE: ${pattern.filter(v => v > 0).length}/${steps}`, 8, 30);
  }, [pattern, currentStep, mode, intensity, division]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawPattern,
    [pattern, currentStep, mode, intensity, division],
    { noLoop: false }
  );

  return (
    <div ref={containerRef} className="w-full h-full bg-black/50 rounded-xl border border-[#2ECC71]/20 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// STEP SEQUENCER GRID
// ============================================================================

const StepSequencer = ({ pattern, onPatternChange, currentStep, steps = 16, mode }) => {
  const handleStepClick = useCallback((index) => {
    const newPattern = [...pattern];
    newPattern[index] = newPattern[index] > 0 ? 0 : 1;
    onPatternChange(newPattern);
  }, [pattern, onPatternChange]);

  const handleStepDrag = useCallback((index, value) => {
    const newPattern = [...pattern];
    newPattern[index] = Math.max(0, Math.min(1, value));
    onPatternChange(newPattern);
  }, [pattern, onPatternChange]);

  return (
    <div className="bg-gradient-to-br from-[#0F1914] to-[#0A0F0C] rounded-xl p-4 border border-[#2ECC71]/30">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] text-[#2ECC71]/80 font-bold uppercase tracking-wider">
          Pattern Editor
        </div>
        <div className="text-[9px] text-white/40 font-mono">
          Step {currentStep + 1}/{steps}
        </div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps}, 1fr)` }}>
        {pattern.slice(0, steps).map((value, index) => {
          const isActive = value > 0;
          const isCurrent = index === currentStep;
          
          return (
            <button
              key={index}
              onClick={() => handleStepClick(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleStepClick(index);
              }}
              className={`
                aspect-square rounded transition-all relative overflow-hidden
                ${isActive
                  ? 'bg-gradient-to-br from-[#2ECC71] to-[#27AE60] shadow-lg shadow-[#2ECC71]/50'
                  : 'bg-black/50 border border-white/10'
                }
                ${isCurrent ? 'ring-2 ring-[#2ECC71] ring-offset-2 ring-offset-black scale-105' : ''}
                hover:scale-110 active:scale-95
              `}
              title={`Step ${index + 1} - Click to toggle`}
              style={{
                opacity: isActive ? (0.6 + value * 0.4) : 0.3
              }}
            >
              {isCurrent && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#2ECC71] animate-pulse shadow-lg shadow-[#2ECC71]/80" />
                </div>
              )}
              
              {/* Value indicator */}
              {isActive && (
                <div
                  className="absolute bottom-0 left-0 right-0 bg-[#2ECC71]/60"
                  style={{ height: `${value * 100}%` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Pattern controls */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onPatternChange(new Array(steps).fill(1))}
          className="flex-1 px-3 py-1.5 bg-[#2ECC71]/20 border border-[#2ECC71]/40 text-[#2ECC71] text-xs rounded hover:bg-[#2ECC71]/30 transition-colors"
        >
          Fill All
        </button>
        <button
          onClick={() => onPatternChange(new Array(steps).fill(0))}
          className="flex-1 px-3 py-1.5 bg-black/50 border border-white/10 text-white/60 text-xs rounded hover:bg-black/70 transition-colors"
        >
          Clear All
        </button>
        <button
          onClick={() => {
            const random = new Array(steps).fill(0).map(() => Math.random() > 0.5 ? 1 : 0);
            onPatternChange(random);
          }}
          className="flex-1 px-3 py-1.5 bg-[#2ECC71]/20 border border-[#2ECC71]/40 text-[#2ECC71] text-xs rounded hover:bg-[#2ECC71]/30 transition-colors"
        >
          Random
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// EUCLIDEAN PATTERN GENERATOR
// ============================================================================

const EuclideanGenerator = ({ onGenerate, steps }) => {
  const [pulses, setPulses] = useState(7);
  const [rotation, setRotation] = useState(0);

  const handleGenerate = useCallback(() => {
    onGenerate({
      type: 'euclidean',
      steps,
      pulses: Math.max(1, Math.min(pulses, steps)),
      rotation: Math.max(0, Math.min(rotation, steps - 1))
    });
  }, [steps, pulses, rotation, onGenerate]);

  return (
    <ExpandablePanel
      title="Euclidean Generator"
      icon="⚡"
      category="rhythm-forge"
      defaultExpanded={false}
    >
      <div className="p-4 space-y-4">
        <div>
          <label className="text-[10px] text-[#2ECC71]/70 uppercase mb-2 block">
            Pulses: {pulses}/{steps}
          </label>
          <input
            type="range"
            min="1"
            max={steps}
            value={pulses}
            onChange={(e) => setPulses(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#2ECC71]/70 uppercase mb-2 block">
            Rotation: {rotation}
          </label>
          <input
            type="range"
            min="0"
            max={steps - 1}
            value={rotation}
            onChange={(e) => setRotation(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
        <button
          onClick={handleGenerate}
          className="w-full px-4 py-2 bg-gradient-to-r from-[#2ECC71] to-[#27AE60] text-white text-xs rounded font-semibold hover:opacity-90 transition-opacity"
        >
          Generate Euclidean
        </button>
      </div>
    </ExpandablePanel>
  );
};

// ============================================================================
// MAIN RHYTHM FX UI COMPONENT
// ============================================================================

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
  } = effect.settings || {};

  const [selectedMode, setSelectedMode] = useState('gate');
  const [pattern, setPattern] = useState(new Array(16).fill(1));
  const [currentStep, setCurrentStep] = useState(0);

  // Ghost values for smooth visual feedback
  const ghostIntensity = useGhostValue(intensity, 400);
  const ghostSwing = useGhostValue(swing, 400);
  const ghostBuffer = useGhostValue(bufferSize, 400);

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
      if (e.data?.type === 'currentStep') {
        setCurrentStep(e.data.step || 0);
      } else if (e.data?.type === 'patternGenerated') {
        setPattern(e.data.pattern || pattern);
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
    const modeConfig = RHYTHM_MODES[modeId];
    if (modeConfig && onChange) {
      Object.entries(modeConfig.baseParams).forEach(([key, value]) => {
        onChange(key, value);
      });
    }
  }, [onChange]);

  // Pattern change handler
  const handlePatternChange = useCallback((newPattern) => {
    setPattern(newPattern);
    const audioNode = plugin?.audioNode?.workletNode;
    if (audioNode?.port) {
      audioNode.port.postMessage({
        type: 'setPattern',
        data: { pattern: newPattern }
      });
    }
  }, [plugin]);

  // Euclidean generator handler
  const handleEuclideanGenerate = useCallback((config) => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    audioNode.port.postMessage({
      type: 'generateEuclidean',
      data: {
        steps: config.steps,
        pulses: config.pulses,
        rotation: config.rotation
      }
    });
  }, [plugin]);

  // Prepare modes for ModeSelector
  const modes = Object.values(RHYTHM_MODES).map(m => ({
    id: m.id,
    label: m.name,
    icon: m.icon,
    description: m.description
  }));

  const currentMode = RHYTHM_MODES[selectedMode] || RHYTHM_MODES.gate;

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-[#0A0F0C] to-black p-4 flex gap-4 overflow-hidden">
      
      {/* LEFT PANEL: Mode Selection + Info */}
      <div className="w-[240px] flex-shrink-0 flex flex-col gap-4">
        
        {/* Category Badge */}
        <div className="bg-gradient-to-r from-[#0F1914] to-[#1A1F1C] rounded-xl px-4 py-3 border border-[#2ECC71]/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentMode?.icon || '🎵'}</div>
            <div className="flex-1">
              <div className="text-[9px] text-[#2ECC71]/70 font-semibold uppercase tracking-wider">The Rhythm Forge</div>
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

        {/* Mode Info */}
        <div className="bg-gradient-to-br from-[#0F1914]/50 to-black/50 rounded-xl p-3 border border-[#2ECC71]/10">
          <div className="text-[9px] text-[#2ECC71]/70 font-bold uppercase tracking-wider mb-2">
            {currentMode?.name}
          </div>
          <div className="text-[10px] text-white/60 leading-relaxed">
            {currentMode?.description || 'Select a mode above'}
          </div>
        </div>
      </div>

      {/* CENTER PANEL: Pattern Editor + Controls */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-2">
        
        {/* Pattern Visualization */}
        <div className="h-[120px] bg-black/50 rounded-xl overflow-hidden border border-[#2ECC71]/20">
          <PatternEditorVisualizer
            pattern={pattern}
            currentStep={currentStep}
            mode={mode}
            intensity={intensity}
            division={division}
          />
        </div>

        {/* Step Sequencer */}
        <StepSequencer
          pattern={pattern}
          onPatternChange={handlePatternChange}
          currentStep={currentStep}
          steps={division}
          mode={mode}
        />

        {/* Main Controls */}
        <div className="bg-gradient-to-br from-black/50 to-[#0F1914]/30 rounded-xl p-6 border border-[#2ECC71]/20">
          <div className="grid grid-cols-4 gap-8">
            
            {/* Division */}
            <Knob
              label="DIVISION"
              value={division}
              onChange={(val) => onChange('division', Math.round(val))}
              min={1}
              max={64}
              defaultValue={16}
              sizeVariant="medium"
              category="rhythm-forge"
              valueFormatter={(v) => {
                const div = Math.round(v);
                if (div <= 4) return '1/4';
                if (div <= 8) return '1/8';
                if (div <= 16) return '1/16';
                if (div <= 32) return '1/32';
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
              valueFormatter={(v) => `${Math.round(v)}%`}
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
              valueFormatter={(v) => `${Math.round(v)}%`}
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
              valueFormatter={(v) => `${Math.round(v)}%`}
            />
          </div>
        </div>

        {/* Advanced Controls */}
        <ExpandablePanel
          title="Advanced Parameters"
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
              valueFormatter={(v) => `${Math.round(v)}ms`}
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
              valueFormatter={(v) => `${Math.round(v)}ms`}
            />

            {/* Glitch Amount */}
            {mode === 4 && (
              <Knob
                label="GLITCH"
                value={glitchAmount}
                onChange={(val) => onChange('glitchAmount', val)}
                min={0}
                max={100}
                defaultValue={50}
                sizeVariant="medium"
                category="rhythm-forge"
                valueFormatter={(v) => `${Math.round(v)}%`}
              />
            )}

            {/* Tape Speed */}
            {mode === 5 && (
              <Knob
                label="SPEED"
                value={tapeSpeed}
                onChange={(val) => onChange('tapeSpeed', val)}
                min={0}
                max={200}
                defaultValue={100}
                sizeVariant="medium"
                category="rhythm-forge"
                valueFormatter={(v) => `${Math.round(v)}%`}
              />
            )}

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
              valueFormatter={(v) => `${Math.round(v)}`}
            />
          </div>
        </ExpandablePanel>

        {/* Euclidean Generator */}
        <EuclideanGenerator
          onGenerate={handleEuclideanGenerate}
          steps={division}
        />
      </div>

      {/* RIGHT PANEL: Stats + Info */}
      <div className="w-[280px] flex-shrink-0 flex flex-col gap-4">
        
        {/* Processing Stats */}
        <div className="bg-gradient-to-br from-black/50 to-[#0F1914]/30 rounded-xl p-4 border border-[#2ECC71]/10">
          <div className="text-[9px] text-[#2ECC71]/70 uppercase tracking-wider mb-3 font-bold">
            Processing
          </div>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-white/50">Mode</span>
              <span className="text-[#2ECC71] font-mono font-bold">
                {currentMode?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Division</span>
              <span className="text-[#2ECC71] font-mono font-bold">
                1/{Math.round(division)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Active Steps</span>
              <span className="text-[#2ECC71] font-mono font-bold">
                {pattern.filter(v => v > 0).length}/{pattern.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Intensity</span>
              <span className="text-[#2ECC71] font-mono font-bold">
                {Math.round(intensity)}%
              </span>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="flex-1 bg-gradient-to-br from-[#0F1914]/20 to-black/50 rounded-xl p-4 border border-[#2ECC71]/10">
          <div className="text-[9px] text-[#2ECC71]/70 font-bold uppercase tracking-wider mb-3">
            How It Works
          </div>
          <div className="space-y-2 text-[10px] text-white/50 leading-relaxed">
            <p>
              <span className="text-[#2ECC71] font-bold">Pattern:</span> Click steps to toggle on/off
            </p>
            <p>
              <span className="text-[#2ECC71] font-bold">Division:</span> Note timing (1/4, 1/8, 1/16...)
            </p>
            <p>
              <span className="text-[#2ECC71] font-bold">Chance:</span> Step probability (0-100%)
            </p>
            <p>
              <span className="text-[#2ECC71] font-bold">Intensity:</span> Effect depth
            </p>
            <p>
              <span className="text-[#2ECC71] font-bold">Swing:</span> Groove timing offset
            </p>
            <p className="pt-2 border-t border-[#2ECC71]/10 text-[9px]">
              Generate patterns with Euclidean algorithm or randomize for creative results.
            </p>
          </div>
        </div>

        {/* Category Badge */}
        <div className="bg-gradient-to-r from-[#0F1914] to-[#1A1F1C] rounded-lg px-3 py-2 border border-[#2ECC71]/20 text-center">
          <div className="text-[8px] text-[#2ECC71]/50 uppercase tracking-wider">Category</div>
          <div className="text-[10px] text-[#2ECC71] font-bold">The Rhythm Forge</div>
        </div>
      </div>
    </div>
  );
};

export default RhythmFXUI;
