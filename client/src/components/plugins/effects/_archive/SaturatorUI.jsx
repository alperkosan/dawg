import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TubeGlowVisualizer } from '@/lib/visualization/plugin-visualizers';
import { ProfessionalKnob } from '../container/PluginControls';
import { PluginCanvas } from '../common/PluginCanvas';
import { SATURATOR_MODES, getModeParameters, MODE_CATEGORIES } from '@/config/presets/saturatorPresets';
import { useAudioPlugin } from '@/hooks/useAudioPlugin';

/**
 * SATURATOR UI V3.0 - MODE-BASED DESIGN
 * "One Knob, Infinite Possibilities"
 *
 * Simplified workflow:
 * 1. Pick a mode (Vocal Warmth, Bass Power, etc.)
 * 2. Adjust Amount (0-100%)
 * 3. Done! (Advanced controls available if needed)
 */

// Drive Meter
const DriveMeter = ({ distortion }) => {
  const normalizedDrive = Math.min(distortion / 1.5, 1);
  const colorStops = [
    { pos: 0, color: '#10b981' },
    { pos: 0.6, color: '#f59e0b' },
    { pos: 0.85, color: '#ef4444' }
  ];

  const getColor = (value) => {
    if (value < 0.6) return colorStops[0].color;
    if (value < 0.85) return colorStops[1].color;
    return colorStops[2].color;
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="text-[10px] text-white/40 mb-2">DRIVE</div>
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 100 100" className="transform -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={getColor(normalizedDrive)}
            strokeWidth="8"
            strokeDasharray={`${normalizedDrive * 251.2} 251.2`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white">{Math.round(normalizedDrive * 100)}</span>
        </div>
      </div>
    </div>
  );
};

// Mode Selector (v3.0 - Zenith Premium Design)
const ModeSelector = ({ currentMode, onModeChange }) => {
  const modes = Object.values(SATURATOR_MODES);

  // Group by category
  const categorized = modes.reduce((acc, mode) => {
    if (!acc[mode.category]) acc[mode.category] = [];
    acc[mode.category].push(mode);
    return acc;
  }, {});

  const getColorGlow = (color) => {
    const glows = {
      amber: 'shadow-amber-500/50',
      red: 'shadow-red-500/50',
      orange: 'shadow-orange-500/50',
      yellow: 'shadow-yellow-500/50',
      cyan: 'shadow-cyan-500/50',
      purple: 'shadow-purple-500/50'
    };
    return glows[color] || 'shadow-amber-500/50';
  };

  const getColorBorder = (color) => {
    const borders = {
      amber: 'border-amber-500/60',
      red: 'border-red-500/60',
      orange: 'border-orange-500/60',
      yellow: 'border-yellow-500/60',
      cyan: 'border-cyan-500/60',
      purple: 'border-purple-500/60'
    };
    return borders[color] || 'border-amber-500/60';
  };

  const getColorBg = (color) => {
    const bgs = {
      amber: 'bg-amber-500/15',
      red: 'bg-red-500/15',
      orange: 'bg-orange-500/15',
      yellow: 'bg-yellow-500/15',
      cyan: 'bg-cyan-500/15',
      purple: 'bg-purple-500/15'
    };
    return bgs[color] || 'bg-amber-500/15';
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs text-amber-300/90 font-semibold tracking-wide uppercase border-b border-white/10 pb-2">
        Preset Modes
      </div>

      {Object.entries(categorized).map(([category, categoryModes]) => (
        <div key={category} className="flex flex-col gap-2">
          <div className="text-[10px] text-white/50 uppercase tracking-wider font-medium px-1">
            {MODE_CATEGORIES[category]?.name || category}
          </div>
          <div className="flex flex-col gap-1.5">
            {categoryModes.map((mode) => {
              const isActive = currentMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => onModeChange(mode.id)}
                  className={`
                    group relative p-3 rounded-lg border transition-all duration-200
                    ${isActive
                      ? `${getColorBorder(mode.color)} ${getColorBg(mode.color)} shadow-lg ${getColorGlow(mode.color)}`
                      : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xl transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                      {mode.icon}
                    </span>
                    <div className="flex-1 text-left">
                      <div className={`text-[11px] font-semibold transition-colors ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
                        {mode.name}
                      </div>
                      <div className={`text-[9px] transition-colors ${isActive ? 'text-white/60' : 'text-white/40 group-hover:text-white/50'}`}>
                        {mode.description}
                      </div>
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// Advanced Controls Panel (Collapsible - Zenith)
const AdvancedControls = ({
  lowCutFreq,
  highCutFreq,
  tone,
  headroom,
  autoGain,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gradient-to-br from-black/30 to-black/20 rounded-xl border border-white/10 overflow-hidden shadow-lg backdrop-blur-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-white/70 hover:text-white/90 transition-all duration-200 hover:bg-white/5"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-wider uppercase">Advanced</span>
          <span className="text-[9px] text-white/40 italic">(optional)</span>
        </div>
        <span className={`text-xs transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="p-3 pt-0 flex flex-col gap-3 border-t border-white/5">
          {/* Filter Controls */}
          <div>
            <div className="text-[9px] text-amber-300/60 mb-2">FILTERS</div>
            <div className="flex flex-col gap-2">
              {/* Low Cut */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[8px] text-white/60">Low Cut</label>
                  <span className="text-[9px] font-mono text-amber-400">
                    {lowCutFreq === 0 ? 'OFF' : `${lowCutFreq}Hz`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={500}
                  step={10}
                  value={lowCutFreq}
                  onChange={(e) => onChange('lowCutFreq', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded cursor-pointer"
                  style={{
                    background: lowCutFreq > 0
                      ? `linear-gradient(to right, #f59e0b ${(lowCutFreq / 500) * 100}%, rgba(255,255,255,0.1) ${(lowCutFreq / 500) * 100}%)`
                      : 'rgba(255,255,255,0.1)'
                  }}
                />
              </div>

              {/* High Cut */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[8px] text-white/60">High Cut</label>
                  <span className="text-[9px] font-mono text-amber-400">
                    {highCutFreq >= 19000 ? 'OFF' : `${(highCutFreq / 1000).toFixed(1)}kHz`}
                  </span>
                </div>
                <input
                  type="range"
                  min={2000}
                  max={20000}
                  step={100}
                  value={highCutFreq}
                  onChange={(e) => onChange('highCutFreq', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded cursor-pointer"
                  style={{
                    background: highCutFreq < 19000
                      ? `linear-gradient(to right, #ef4444 ${((highCutFreq - 2000) / 18000) * 100}%, rgba(255,255,255,0.1) ${((highCutFreq - 2000) / 18000) * 100}%)`
                      : 'rgba(255,255,255,0.1)'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tone & Headroom */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8px] text-white/60 mb-1 block">Tone</label>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={tone}
                onChange={(e) => onChange('tone', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded cursor-pointer"
              />
              <div className="text-[7px] text-white/40 mt-0.5 text-center">
                {tone < -0.5 ? '↓ Dark' : tone > 0.5 ? '↑ Bright' : 'Neutral'}
              </div>
            </div>
            <div>
              <label className="text-[8px] text-white/60 mb-1 block">Headroom</label>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={headroom}
                onChange={(e) => onChange('headroom', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded cursor-pointer"
              />
              <div className="text-[7px] text-white/40 mt-0.5 text-center">
                {headroom < -0.5 ? 'Soft' : headroom > 0.5 ? 'Loud' : 'Normal'}
              </div>
            </div>
          </div>

          {/* Auto Gain Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoGain > 0.5}
              onChange={(e) => onChange('autoGain', e.target.checked ? 1 : 0)}
              className="w-3 h-3 cursor-pointer accent-amber-500"
            />
            <span className="text-[9px] text-amber-300">Auto Gain Compensation</span>
          </label>
        </div>
      )}
    </div>
  );
};

// === MAIN SATURATOR UI V3.0 - MODE-BASED ===
export const SaturatorUI = ({ trackId, effect, onChange }) => {
  const {
    distortion = 0.4,
    wet = 1.0,
    autoGain = 1,
    lowCutFreq = 0,
    highCutFreq = 20000,
    tone = 0,
    headroom = 0
  } = effect.settings;

  // Mode-based state
  const [selectedMode, setSelectedMode] = useState('vocal-warmth');
  const [amount, setAmount] = useState(50); // 0-100%

  // Store onChange in ref to avoid including it in dependencies
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Plugin ID for visualizers
  const pluginId = effect.id || `saturator-${trackId}`;

  // 🎵 Use standardized audio plugin hook
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false // Visualizer handles its own metrics
  });

  // Get worklet node for PluginCanvas visualizer
  // VisualizationEngine expects actual AudioNode, not the wrapper object
  const audioNode = plugin?.audioNode?.workletNode;

  // Apply mode + amount to all parameters (only when mode or amount changes)
  useEffect(() => {
    const mode = SATURATOR_MODES[selectedMode];
    if (!mode) return;

    const params = getModeParameters(selectedMode, amount);

    // Batch update all parameters via ref (prevents loop)
    Object.entries({
      distortion: params.distortion,
      wet: params.wet,
      tone: params.tone,
      autoGain: params.autoGain,
      headroom: params.headroom,
      lowCutFreq: params.lowCutFreq,
      highCutFreq: params.highCutFreq
    }).forEach(([key, value]) => {
      onChangeRef.current(key, value);
    });

    // Send mode messages to worklet
    if (audioNode?.workletNode?.port) {
      audioNode.workletNode.port.postMessage({ type: 'setSaturationMode', data: { mode: params.saturationMode } });
      audioNode.workletNode.port.postMessage({ type: 'setFrequencyMode', data: { mode: params.frequencyMode } });
    }
  }, [selectedMode, amount, audioNode]); // onChange NOT in dependencies

  // Handle mode selection
  const handleModeChange = (modeId) => {
    setSelectedMode(modeId);
  };

  // Get current mode for visual feedback
  const currentMode = SATURATOR_MODES[selectedMode];
  const currentSaturationMode = currentMode?.baseParams?.saturationMode || 'toasty';

  // Memoize visualizer params
  const tubeGlowParams = useMemo(() => ({
    drive: distortion * 100,
    mix: wet,
    tone: tone,
    mode: currentSaturationMode
  }), [distortion, wet, tone, currentSaturationMode]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-3 sm:p-5 flex gap-3 sm:gap-5 overflow-hidden">

      {/* LEFT: MODE SELECTOR */}
      <div className="w-[280px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        <ModeSelector currentMode={selectedMode} onModeChange={handleModeChange} />
      </div>

      {/* CENTER: TUBE GLOW HERO + CONTROLS */}
      <div className="flex-1 flex flex-col gap-3 sm:gap-5 min-w-0">
        {/* Current Mode Badge */}
        <div className="relative bg-gradient-to-r from-amber-950/40 to-orange-950/40 rounded-lg px-4 py-3 border border-amber-500/20 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{currentMode?.icon}</div>
            <div className="flex-1">
              <div className="text-xs font-bold text-amber-200 tracking-wide uppercase">{currentMode?.name}</div>
              <div className="text-[9px] text-amber-300/60">{currentMode?.description}</div>
            </div>
            <div className="text-xs text-white/40 font-mono">{amount}%</div>
          </div>
        </div>

        {/* HERO: Tube Glow Visualizer - Like Diablo's Magma */}
        <div className="relative flex-grow min-h-0 rounded-2xl overflow-hidden">
          {/* Dark vignette frame */}
          <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_60px_rgba(0,0,0,0.8)] pointer-events-none z-10" />

          {/* Tube Glow Canvas */}
          <div className="absolute inset-0 bg-black rounded-2xl">
            <PluginCanvas
              pluginId={`${pluginId}-tube-glow`}
              visualizerClass={TubeGlowVisualizer}
              priority="normal"
              params={tubeGlowParams}
              audioNode={audioNode}
            />
          </div>

          {/* Corner Labels */}
          <div className="absolute top-4 left-4 z-20">
            <div className="text-[10px] text-amber-400/60 font-mono tracking-wider">PUNCH</div>
          </div>
          <div className="absolute top-4 right-4 z-20">
            <div className="text-[10px] text-amber-400/60 font-mono tracking-wider">CLIP</div>
          </div>

          {/* Bottom Controls Strip */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/95 to-transparent p-6 z-20">
            <div className="flex items-center justify-center gap-8">
              {/* Left Knob - Punch (Distortion) */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-[9px] text-amber-400/60 font-mono tracking-wider uppercase">Punch</div>
                <div className="relative">
                  <ProfessionalKnob
                    label=""
                    value={distortion * 100}
                    onChange={(val) => onChangeRef.current('distortion', val / 100)}
                    min={0}
                    max={150}
                    defaultValue={40}
                    precision={0}
                    size={70}
                  />
                </div>
              </div>

              {/* Center - Amount (Hero Knob) */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-[11px] text-amber-300 font-bold tracking-widest uppercase">Amount</div>
                <div className="relative">
                  <ProfessionalKnob
                    label=""
                    value={amount}
                    onChange={setAmount}
                    min={0}
                    max={100}
                    defaultValue={50}
                    unit="%"
                    precision={0}
                    size={120}
                  />
                  {/* Subtle glow */}
                  <div className="absolute inset-0 rounded-full blur-2xl bg-amber-500/20 -z-10" />
                </div>
                <div className="text-2xl font-bold text-white">{amount}%</div>
              </div>

              {/* Right Knob - Clip (Wet) */}
              <div className="flex flex-col items-center gap-2">
                <div className="text-[9px] text-amber-400/60 font-mono tracking-wider uppercase">Clip</div>
                <div className="relative">
                  <ProfessionalKnob
                    label=""
                    value={wet * 100}
                    onChange={(val) => onChangeRef.current('wet', val / 100)}
                    min={0}
                    max={100}
                    defaultValue={100}
                    precision={0}
                    size={70}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Controls (Collapsible) */}
        <AdvancedControls
          lowCutFreq={lowCutFreq}
          highCutFreq={highCutFreq}
          tone={tone}
          headroom={headroom}
          autoGain={autoGain}
          onChange={onChange}
        />
      </div>

      {/* RIGHT: METERS */}
      <div className="w-[200px] flex-shrink-0 flex flex-col gap-3 sm:gap-4">
        {/* Drive Meter */}
        <div className="bg-gradient-to-br from-neutral-900/80 to-black/60 rounded-xl p-3 sm:p-4 border border-white/5 shadow-lg">
          <DriveMeter distortion={distortion} />
        </div>

        {/* Output Level Info */}
        <div className="bg-gradient-to-br from-neutral-900/80 to-black/60 rounded-xl p-3 sm:p-4 border border-white/5 shadow-lg">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Output</div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Auto Gain</span>
              <span className={autoGain > 0.5 ? 'text-green-400' : 'text-white/30'}>
                {autoGain > 0.5 ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Headroom</span>
              <span className="text-amber-400 font-mono">{headroom > 0 ? '+' : ''}{headroom.toFixed(1)}dB</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/50">Tone</span>
              <span className="text-amber-400 font-mono">{tone > 0 ? '+' : ''}{tone.toFixed(1)}dB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaturatorUI;
