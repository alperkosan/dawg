/**
 * LIMITER UI V2.0
 *
 * Professional mastering-grade limiter with true peak detection
 *
 * v2.0 Changes:
 * ✅ Integrated with PluginContainerV2
 * ✅ Uses TwoPanelLayout
 * ✅ CanvasRenderManager for visualization (reuses LimiterVisualizer)
 * ✅ Parameter Batching
 * ✅ Preset Manager integration
 * ✅ Category-based theming (dynamics-forge)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, Toggle } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useMixerStore } from '@/store/useMixerStore';
import { useGhostValue, useAudioPlugin, useCanvasVisualization } from '@/hooks/useAudioPlugin';
import { useRef } from 'react';

// Reuse LimiterVisualizer from old UI
const LimiterVisualizer = ({ trackId, effectId, ceiling, knee, truePeak, categoryColors }) => {
  const { isPlaying, getTimeDomainData } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true
  });

  const signalBufferRef = useRef([]);
  const maxBufferSize = 300;

  const drawVisualization = useCallback((ctx, width, height) => {
    const curveHeight = height * 0.6;
    const waveformHeight = height * 0.4;
    const waveformTop = curveHeight;

    ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = `${categoryColors.primary}14`;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const pos = (i / 4) * width;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, curveHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i / 4) * curveHeight);
      ctx.lineTo(width, (i / 4) * curveHeight);
      ctx.stroke();
    }

    // Transfer curve
    const dbToPixel = (db) => width - ((db + 60) / 60) * width;
    const outputDbToPixel = (db) => curveHeight - ((db + 60) / 60) * curveHeight;

    ctx.strokeStyle = `${categoryColors.accent}E6`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let inputDb = -60; inputDb <= 0; inputDb += 0.5) {
      let outputDb = inputDb;
      if (inputDb > ceiling) {
        if (knee > 0 && inputDb < ceiling + knee) {
          const kneeRange = inputDb - ceiling;
          const kneeAmount = (kneeRange / knee) * (1 - knee);
          outputDb = ceiling + kneeAmount;
        } else {
          outputDb = ceiling;
        }
      }

      const x = dbToPixel(inputDb);
      const y = outputDbToPixel(outputDb);
      if (inputDb === -60) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Ceiling line
    const ceilingY = outputDbToPixel(ceiling);
    ctx.strokeStyle = '#E74C3C';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, ceilingY);
    ctx.lineTo(width, ceilingY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#E74C3C';
    ctx.textAlign = 'left';
    ctx.fillText(`CEILING: ${ceiling.toFixed(1)}dB`, 8, ceilingY - 5);

    // Waveform area
    if (isPlaying) {
      const timeData = getTimeDomainData();
      if (timeData && timeData.length > 0) {
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          sumSq += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        const inputDb = rms > 0 ? 20 * Math.log10(rms) : -60;
        const clampedInputDb = Math.max(-60, Math.min(0, inputDb));

        let outputDb = clampedInputDb;
        if (clampedInputDb > ceiling) {
          if (knee > 0 && clampedInputDb < ceiling + knee) {
            const kneeRange = clampedInputDb - ceiling;
            const kneeAmount = (kneeRange / knee) * (1 - knee);
            outputDb = ceiling + kneeAmount;
          } else {
            outputDb = ceiling;
          }
        }

        signalBufferRef.current.push({
          inputDb: clampedInputDb,
          outputDb,
          timestamp: performance.now()
        });

        if (signalBufferRef.current.length > maxBufferSize) {
          signalBufferRef.current.shift();
        }

        const buffer = signalBufferRef.current;
        if (buffer.length > 10) {
          const pointsPerPixel = Math.max(1, Math.floor(buffer.length / width));

          ctx.fillStyle = `${categoryColors.secondary}66`;
          ctx.beginPath();
          for (let x = 0; x < width; x++) {
            const bufferIdx = Math.min(buffer.length - 1, Math.floor(x * pointsPerPixel));
            const point = buffer[bufferIdx];
            const inputDbNorm = (point.inputDb + 60) / 60;
            const y = waveformTop + waveformHeight - (inputDbNorm * waveformHeight * 0.7);
            if (x === 0) {
              ctx.moveTo(x, waveformTop + waveformHeight);
              ctx.lineTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.lineTo(width, waveformTop + waveformHeight);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = `${categoryColors.accent}99`;
          ctx.beginPath();
          for (let x = 0; x < width; x++) {
            const bufferIdx = Math.min(buffer.length - 1, Math.floor(x * pointsPerPixel));
            const point = buffer[bufferIdx];
            const outputDbNorm = (point.outputDb + 60) / 60;
            const y = waveformTop + waveformHeight - (outputDbNorm * waveformHeight * 0.7);
            if (x === 0) {
              ctx.moveTo(x, waveformTop + waveformHeight);
              ctx.lineTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.lineTo(width, waveformTop + waveformHeight);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else {
      ctx.strokeStyle = `${categoryColors.primary}33`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, waveformTop + waveformHeight / 2);
      ctx.lineTo(width, waveformTop + waveformHeight / 2);
      ctx.stroke();
    }
  }, [ceiling, knee, isPlaying, getTimeDomainData, categoryColors]);

  const { containerRef, canvasRef } = useCanvasVisualization(drawVisualization, [ceiling, knee, isPlaying]);

  return (
    <div ref={containerRef} className="w-full h-[300px] rounded-xl overflow-hidden" style={{
      background: 'rgba(0, 0, 0, 0.5)',
      borderColor: `${categoryColors.primary}33`,
    }}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

const LimiterUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    ceiling = -0.1,
    release = 100,
    attack = 0.1,
    lookahead = 5,
    knee = 0,
    stereoLink = 100,
    autoGain = 0,
    mode = 0,
    truePeak = 1,
    oversample = 4
  } = effect.settings || {};

  // Local state
  const [localCeiling, setLocalCeiling] = useState(ceiling);
  const [localRelease, setLocalRelease] = useState(release);
  const [localAttack, setLocalAttack] = useState(attack);
  const [localLookahead, setLocalLookahead] = useState(lookahead);
  const [localKnee, setLocalKnee] = useState(knee);
  const [localStereoLink, setLocalStereoLink] = useState(stereoLink);
  const [localAutoGain, setLocalAutoGain] = useState(autoGain);
  const [localMode, setLocalMode] = useState(mode);
  const [localTruePeak, setLocalTruePeak] = useState(truePeak);
  const [localOversample, setLocalOversample] = useState(oversample);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('dynamics-forge'), []);

  // Use ParameterBatcher
  const { setParam, setParams } = useParameterBatcher(effectNode);

  // Mixer store
  const { handleMixerEffectChange } = useMixerStore.getState();

  // Metering state
  const [gainReduction, setGainReduction] = useState(0);
  const [lufs, setLufs] = useState(-144);
  const [lra, setLra] = useState(0);
  const [peak, setPeak] = useState(-144);
  const grHistoryRef = useRef([]);
  const maxHistorySize = 400;

  // Audio plugin for metering
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Listen to worklet messages for metering
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (event) => {
      const { type, data } = event.data;
      if (type === 'metering' && data) {
        if (typeof data.grPeak === 'number' && isFinite(data.grPeak)) {
          const gr = Math.max(0, Math.min(60, -data.grPeak)); // Convert to positive dB
          setGainReduction(gr);
          
          // Add to GR history
          grHistoryRef.current.push({
            gr: gr,
            timestamp: performance.now()
          });
          
          // Trim history
          if (grHistoryRef.current.length > maxHistorySize) {
            grHistoryRef.current.shift();
          }
        }
        
        if (typeof data.lufs === 'number' && isFinite(data.lufs)) {
          setLufs(data.lufs);
        }
        
        if (typeof data.lra === 'number' && isFinite(data.lra)) {
          setLra(data.lra);
        }
        
        if (typeof data.peak === 'number' && isFinite(data.peak)) {
          setPeak(data.peak);
        }
      }
    };

    audioNode.port.onmessage = handleMessage;

    return () => {
      if (audioNode?.port) {
        audioNode.port.onmessage = null;
      }
    };
  }, [plugin]);

  // Ghost values
  const ghostCeiling = useGhostValue(localCeiling, 400);
  const ghostRelease = useGhostValue(localRelease, 400);
  const ghostLookahead = useGhostValue(localLookahead, 400);

  // Sync with effect.settings
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.ceiling !== undefined) {
      setLocalCeiling(effect.settings.ceiling);
      updates.ceiling = effect.settings.ceiling;
    }
    if (effect.settings.release !== undefined) {
      setLocalRelease(effect.settings.release);
      updates.release = effect.settings.release;
    }
    if (effect.settings.attack !== undefined) {
      setLocalAttack(effect.settings.attack);
      updates.attack = effect.settings.attack;
    }
    if (effect.settings.lookahead !== undefined) {
      setLocalLookahead(effect.settings.lookahead);
      updates.lookahead = effect.settings.lookahead;
    }
    if (effect.settings.knee !== undefined) {
      setLocalKnee(effect.settings.knee);
      updates.knee = effect.settings.knee;
    }
    if (effect.settings.stereoLink !== undefined) {
      setLocalStereoLink(effect.settings.stereoLink);
      updates.stereoLink = effect.settings.stereoLink;
    }
    if (effect.settings.autoGain !== undefined) {
      setLocalAutoGain(effect.settings.autoGain);
      updates.autoGain = effect.settings.autoGain;
    }
    if (effect.settings.mode !== undefined) {
      setLocalMode(effect.settings.mode);
      updates.mode = effect.settings.mode;
    }
    if (effect.settings.truePeak !== undefined) {
      setLocalTruePeak(effect.settings.truePeak);
      updates.truePeak = effect.settings.truePeak;
    }
    if (effect.settings.oversample !== undefined) {
      setLocalOversample(effect.settings.oversample);
      updates.oversample = effect.settings.oversample;
    }

    // Send all parameter updates to worklet immediately
    // Note: Don't call handleMixerEffectChange here - it's already called by PresetManager
    if (Object.keys(updates).length > 0) {
      setParams(updates, { immediate: true });
    }
  }, [effect.settings, effectNode, setParams]);

  // Handle parameter changes
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });

    // Update local state
    const stateMap = {
      ceiling: setLocalCeiling,
      release: setLocalRelease,
      attack: setLocalAttack,
      lookahead: setLocalLookahead,
      knee: setLocalKnee,
      stereoLink: setLocalStereoLink,
      autoGain: setLocalAutoGain,
      mode: setLocalMode,
      truePeak: setLocalTruePeak,
      oversample: setLocalOversample
    };
    if (stateMap[key]) stateMap[key](value);
  }, [setParam, handleMixerEffectChange, trackId, effect.id]);

  return (
    <PluginContainerV2
      trackId={trackId}
      effect={effect}
      definition={definition}
      category="dynamics-forge"
    >
      <TwoPanelLayout
        category="dynamics-forge"

        mainPanel={
          <>
            {/* Visualizer */}
            <LimiterVisualizer
              trackId={trackId}
              effectId={effect.id}
              ceiling={localCeiling}
              knee={localKnee}
              truePeak={localTruePeak}
              categoryColors={categoryColors}
            />

            {/* Main Controls */}
            <div className="grid grid-cols-5 gap-4 p-6">
              <Knob
                label="CEILING"
                value={localCeiling}
                ghostValue={ghostCeiling}
                onChange={(val) => handleParamChange('ceiling', val)}
                min={-10}
                max={0}
                defaultValue={-0.1}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${v.toFixed(1)}dB`}
              />

              <Knob
                label="RELEASE"
                value={localRelease}
                ghostValue={ghostRelease}
                onChange={(val) => handleParamChange('release', val)}
                min={10}
                max={1000}
                defaultValue={100}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${v.toFixed(0)}ms`}
              />

              <Knob
                label="ATTACK"
                value={localAttack}
                onChange={(val) => handleParamChange('attack', val)}
                min={0.01}
                max={10}
                defaultValue={0.1}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${v.toFixed(2)}ms`}
              />

              <Knob
                label="LOOKAHEAD"
                value={localLookahead}
                ghostValue={ghostLookahead}
                onChange={(val) => handleParamChange('lookahead', val)}
                min={0}
                max={10}
                defaultValue={5}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${v.toFixed(1)}ms`}
              />

              <Knob
                label="KNEE"
                value={localKnee}
                onChange={(val) => handleParamChange('knee', val)}
                min={0}
                max={1}
                defaultValue={0}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
            </div>

            {/* Secondary Controls */}
            <div className="grid grid-cols-4 gap-4 p-6">
              <Knob
                label="STEREO LINK"
                value={localStereoLink}
                onChange={(val) => handleParamChange('stereoLink', val)}
                min={0}
                max={100}
                defaultValue={100}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${v.toFixed(0)}%`}
              />

              <Knob
                label="OVERSAMPLE"
                value={localOversample}
                onChange={(val) => {
                  if (val <= 0) return;
                  const logVal = Math.log2(Math.max(1, val));
                  const rounded = Math.round(logVal);
                  const result = Math.pow(2, Math.max(0, Math.min(3, rounded)));
                  handleParamChange('oversample', result);
                }}
                min={1}
                max={8}
                defaultValue={4}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${v}x`}
              />

              <Toggle
                label="AUTO GAIN"
                value={localAutoGain === 1}
                onChange={(val) => handleParamChange('autoGain', val ? 1 : 0)}
                category="dynamics-forge"
              />

              <Toggle
                label="TRUE PEAK"
                value={localTruePeak === 1}
                onChange={(val) => handleParamChange('truePeak', val ? 1 : 0)}
                category="dynamics-forge"
              />
            </div>
          </>
        }

        sidePanel={
          <>
            {/* GR Meter */}
            <div 
              className="rounded-xl p-4 mb-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}1A`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                Gain Reduction
              </div>
              <div className="relative h-32 mb-2">
                {/* GR Meter Background */}
                <div className="absolute inset-0 rounded" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                  {/* Grid lines */}
                  {[0, 10, 20, 30, 40, 50, 60].map((db) => (
                    <div
                      key={db}
                      className="absolute w-full border-t"
                      style={{
                        top: `${100 - (db / 60) * 100}%`,
                        borderColor: `${categoryColors.primary}20`
                      }}
                    />
                  ))}
                  
                  {/* GR Bar */}
                  <div
                    className="absolute bottom-0 left-0 rounded transition-all duration-75"
                    style={{
                      width: '100%',
                      height: `${Math.min(100, (gainReduction / 60) * 100)}%`,
                      background: gainReduction > 30 
                        ? `linear-gradient(to top, ${categoryColors.accent}, #E74C3C)`
                        : `linear-gradient(to top, ${categoryColors.primary}, ${categoryColors.accent})`,
                      boxShadow: `0 0 10px ${categoryColors.primary}40`
                    }}
                  />
                  
                  {/* GR History Graph */}
                  {grHistoryRef.current.length > 10 && (
                    <canvas
                      ref={(canvas) => {
                        if (canvas && grHistoryRef.current.length > 0) {
                          const ctx = canvas.getContext('2d');
                          const width = canvas.width = canvas.offsetWidth;
                          const height = canvas.height = canvas.offsetHeight;
                          
                          ctx.clearRect(0, 0, width, height);
                          ctx.strokeStyle = categoryColors.accent;
                          ctx.lineWidth = 2;
                          ctx.beginPath();
                          
                          const history = grHistoryRef.current;
                          const pointsPerPixel = Math.max(1, Math.floor(history.length / width));
                          
                          for (let x = 0; x < width; x++) {
                            const idx = Math.min(history.length - 1, Math.floor(x * pointsPerPixel));
                            const gr = history[idx].gr;
                            const y = height - (gr / 60) * height;
                            
                            if (x === 0) ctx.moveTo(x, y);
                            else ctx.lineTo(x, y);
                          }
                          
                          ctx.stroke();
                        }
                      }}
                      className="absolute inset-0 w-full h-full"
                    />
                  )}
                  
                  {/* GR Value Display */}
                  <div className="absolute top-2 left-2">
                    <div className="text-2xl font-bold font-mono" style={{ color: categoryColors.primary }}>
                      {gainReduction.toFixed(1)}
                    </div>
                    <div className="text-[8px] text-white/50">dB</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Loudness Metering */}
            <div 
              className="rounded-xl p-4 mb-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}1A`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                Loudness Metering
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-white/60">LUFS</span>
                    <span className="text-lg font-bold font-mono" style={{ color: categoryColors.primary }}>
                      {lufs > -144 ? lufs.toFixed(1) : '---'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                    <div
                      className="h-full transition-all duration-100"
                      style={{
                        width: `${Math.min(100, Math.max(0, ((lufs + 60) / 60) * 100))}%`,
                        background: lufs > -14 
                          ? `linear-gradient(to right, ${categoryColors.primary}, #E74C3C)`
                          : lufs > -23
                          ? `linear-gradient(to right, ${categoryColors.accent}, ${categoryColors.primary})`
                          : categoryColors.accent
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">LRA</span>
                  <span className="text-[12px] font-mono" style={{ color: categoryColors.primary }}>
                    {lra > 0 ? lra.toFixed(1) : '---'} LU
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Peak</span>
                  <span className="text-[12px] font-mono" style={{ color: categoryColors.primary }}>
                    {peak > -144 ? peak.toFixed(1) : '---'} LUFS
                  </span>
                </div>
              </div>
            </div>

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
                  <span className="text-[10px] text-white/60">Ceiling</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localCeiling.toFixed(1)}dB
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Release</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localRelease.toFixed(0)}ms
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Attack</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localAttack.toFixed(2)}ms
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Lookahead</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localLookahead.toFixed(1)}ms
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Knee</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {(localKnee * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">Oversample</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localOversample}x
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/60">True Peak</span>
                  <span className="text-[10px] font-mono" style={{ color: categoryColors.primary }}>
                    {localTruePeak ? 'ON' : 'OFF'}
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

export default LimiterUI_V2;

