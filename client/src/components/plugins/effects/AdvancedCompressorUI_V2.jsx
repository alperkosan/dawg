/**
 * ADVANCED COMPRESSOR UI V2.0 - REDESIGNED VISUAL FEEDBACK
 *
 * Professional compressor with clean, focused visual feedback
 * Inspired by: FabFilter Pro-C 2, Waves SSL Comp, Universal Audio
 *
 * Visual Design Philosophy:
 * - Large, prominent GR meter (oscilloscope style) - MAIN FOCUS
 * - Clean transfer curve (compact, side panel)
 * - Real-time sidechain visualization
 * - Minimal, focused information display
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, ExpandablePanel, Checkbox, Select, ModeSelector } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// COMPRESSION VISUALIZER - Redesigned: Clean & Focused
// ============================================================================

const CompressionVisualizer = ({ 
  trackId, 
  effectId, 
  threshold, 
  ratio, 
  knee, 
  attack,
  release,
  gainReduction = 0, 
  sidechainLevel = null, 
  scEnable = 0,
  compressorModel = 0,
  mix = 100,
  grHistoryRef,
  sidechainHistoryRef,
  categoryColors
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Helper to convert hex to rgba with opacity
  const hexToRgba = useCallback((hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }, []);

  const { isPlaying, getTimeDomainData, metricsDb } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: true,
    rmsSmoothing: 0.3,
    peakSmoothing: 0.2
  });

  const drawVisualizer = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.width / dpr;
    const displayHeight = canvas.height / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // ============================================================================
    // LAYOUT: Clean, focused design
    // Left 70%: GR Meter (oscilloscope style) - MAIN FOCUS
    // Right 30%: Transfer Curve (compact)
    // Bottom: Sidechain visualization (if enabled)
    // ============================================================================
    
    const grMeterWidth = displayWidth * 0.70;
    const transferWidth = displayWidth * 0.30;
    const sidechainHeight = scEnable ? displayHeight * 0.20 : 0;
    const grMeterHeight = displayHeight - sidechainHeight;
    const transferHeight = displayHeight - sidechainHeight;

    // Background
    ctx.fillStyle = 'rgba(5, 5, 10, 0.98)';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // ============================================================================
    // SECTION 1: GAIN REDUCTION METER (Left 70%) - MAIN FOCUS
    // ============================================================================
    
    const meterPadding = 20;
    const meterInnerWidth = grMeterWidth - meterPadding * 2;
    const meterInnerHeight = grMeterHeight - 60;
    const meterTop = 40;
    const meterLeft = meterPadding;

    // Background (dark, oscilloscope style)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(meterLeft, meterTop, meterInnerWidth, meterInnerHeight);
    
    // Border
    ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.3);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(meterLeft, meterTop, meterInnerWidth, meterInnerHeight);

    // Grid lines (horizontal, subtle)
    ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.1);
        ctx.lineWidth = 1;
    const grRanges = [0, 3, 6, 9, 12, 15, 18, 20];
    grRanges.forEach(grValue => {
      const y = meterTop + meterInnerHeight - (grValue / 20) * meterInnerHeight;
      ctx.beginPath();
      ctx.moveTo(meterLeft, y);
      ctx.lineTo(meterLeft + meterInnerWidth, y);
      ctx.stroke();
    });

    // Zero line (baseline)
    const zeroY = meterTop + meterInnerHeight;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(meterLeft, zeroY);
    ctx.lineTo(meterLeft + meterInnerWidth, zeroY);
    ctx.stroke();

    // GR scale labels (left side)
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    grRanges.forEach(grValue => {
      const y = meterTop + meterInnerHeight - (grValue / 20) * meterInnerHeight;
      ctx.fillText(`-${grValue}`, meterLeft - 8, y + 3);
    });

    // Draw GR history (oscilloscope style) - THE MAIN FEATURE
    if (isPlaying && grHistoryRef && grHistoryRef.current && grHistoryRef.current.length > 1) {
      const grHistory = grHistoryRef.current;
      const maxGR = 20;
      const timeWindow = 4000; // 4 seconds
      const now = performance.now();
      
      // Filter recent points
      const recentPoints = grHistory
        .map(point => ({
          ...point,
          age: now - point.timestamp
        }))
        .filter(point => point.age <= timeWindow && point.age >= 0)
        .sort((a, b) => a.timestamp - b.timestamp);
      
      if (recentPoints.length > 1) {
        // Draw GR waveform (oscilloscope style)
        ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.95);
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < recentPoints.length; i++) {
          const point = recentPoints[i];
          const x = meterLeft + meterInnerWidth - ((point.age / timeWindow) * meterInnerWidth);
          const grNormalized = Math.min(point.gr / maxGR, 1);
          const y = meterTop + meterInnerHeight - (grNormalized * meterInnerHeight);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Fill under curve with gradient
        if (recentPoints.length > 0) {
          const gradient = ctx.createLinearGradient(0, meterTop, 0, meterTop + meterInnerHeight);
          gradient.addColorStop(0, hexToRgba(categoryColors.primary, 0.25));
          gradient.addColorStop(0.5, hexToRgba(categoryColors.primary, 0.15));
          gradient.addColorStop(1, hexToRgba(categoryColors.primary, 0.05));
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(meterLeft + meterInnerWidth, zeroY);
          
          for (let i = recentPoints.length - 1; i >= 0; i--) {
            const point = recentPoints[i];
            const x = meterLeft + meterInnerWidth - ((point.age / timeWindow) * meterInnerWidth);
            const grNormalized = Math.min(point.gr / maxGR, 1);
            const y = meterTop + meterInnerHeight - (grNormalized * meterInnerHeight);
            ctx.lineTo(x, y);
          }
          
          if (recentPoints.length > 0) {
            const firstX = meterLeft + meterInnerWidth - ((recentPoints[0].age / timeWindow) * meterInnerWidth);
            ctx.lineTo(firstX, zeroY);
          }
          ctx.closePath();
          ctx.fill();
        }

        // Current GR indicator (right edge)
        if (recentPoints.length > 0) {
          const latest = recentPoints[recentPoints.length - 1];
          const grNormalized = Math.min(latest.gr / maxGR, 1);
          const currentY = meterTop + meterInnerHeight - (grNormalized * meterInnerHeight);
          
          // Vertical line (color-coded)
          const grColor = latest.gr > 12 
            ? '#ef4444' // Red (heavy compression)
            : latest.gr > 6 
            ? '#f59e0b' // Amber (moderate compression)
            : categoryColors.primary; // Category primary (gentle)
          ctx.strokeStyle = grColor;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(meterLeft + meterInnerWidth - 2, meterTop);
          ctx.lineTo(meterLeft + meterInnerWidth - 2, currentY);
          ctx.stroke();

          // Current GR value (large, prominent)
          ctx.font = 'bold 24px monospace';
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.fillRect(meterLeft + meterInnerWidth + 8, currentY - 18, 80, 28);
          ctx.fillStyle = grColor;
          ctx.fillText(`${latest.gr.toFixed(1)} dB`, meterLeft + meterInnerWidth + 12, currentY + 6);
        }
      }
    } else if (!isPlaying) {
      // Idle state
      ctx.font = '14px system-ui';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.textAlign = 'center';
      ctx.fillText('▶ Play to see gain reduction', meterLeft + meterInnerWidth / 2, meterTop + meterInnerHeight / 2);
    }

    // Title
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('GAIN REDUCTION', meterLeft, meterTop - 8);

          // ============================================================================
    // SECTION 2: TRANSFER CURVE (Right 30%) - Compact
          // ============================================================================
          
    const curveLeft = grMeterWidth + 10;
    const curvePadding = 15;
    const curveWidth = transferWidth - curvePadding * 2;
    const curveHeight = transferHeight - 50;
    const curveTop = 40;
    
    // Background
    ctx.fillStyle = 'rgba(8, 8, 12, 0.95)';
    ctx.fillRect(curveLeft, curveTop, transferWidth - 20, curveHeight);
    
    // Border
    ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.2);
                ctx.lineWidth = 1;
    ctx.strokeRect(curveLeft, curveTop, transferWidth - 20, curveHeight);

    // Helper functions
    const dbToX = (db) => curveLeft + curvePadding + ((db + 60) / 60) * curveWidth;
    const dbToY = (db) => curveTop + curveHeight - ((db + 60) / 60) * curveHeight;

    // Unity line (diagonal, 1:1 reference)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
                ctx.beginPath();
    ctx.moveTo(curveLeft + curvePadding, curveTop + curveHeight);
    ctx.lineTo(curveLeft + curvePadding + curveWidth, curveTop);
                ctx.stroke();
                ctx.setLineDash([]);
                
    // Get model color
    const modelColors = [
      categoryColors.primary, // Clean/VCA
      categoryColors.secondary, // Opto
      '#f59e0b' // FET
    ];
    const currentModelColor = modelColors[compressorModel] || categoryColors.primary;
    
    // Apply model-specific adjustments
    let effectiveKnee = knee;
    if (compressorModel === 1) effectiveKnee = knee * 1.2; // Opto: softer
    else if (compressorModel === 2) effectiveKnee = knee * 0.5; // FET: harder

    // Transfer curve
    ctx.strokeStyle = hexToRgba(currentModelColor, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();

    const limiterCeiling = -0.3;
    for (let inputDb = -60; inputDb <= 0; inputDb += 0.5) {
      const inputOverThreshold = inputDb - threshold;
      let outputDb = inputDb;

      if (inputOverThreshold > effectiveKnee / 2) {
        outputDb = threshold + inputOverThreshold / ratio;
      } else if (inputOverThreshold > -effectiveKnee / 2) {
        const x = inputOverThreshold + effectiveKnee / 2;
        outputDb = inputDb - ((ratio - 1) * Math.pow(x, 2) / (2 * effectiveKnee * ratio));
      }

      if (outputDb > limiterCeiling) {
        outputDb = limiterCeiling;
      }

      const x = dbToX(inputDb);
      const y = dbToY(outputDb);
      if (inputDb === -60) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Threshold line
    const thresholdY = dbToY(threshold);
    ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.6);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
                ctx.beginPath();
    ctx.moveTo(curveLeft + curvePadding, thresholdY);
    ctx.lineTo(curveLeft + curvePadding + curveWidth, thresholdY);
                ctx.stroke();
                ctx.setLineDash([]);
                
    // Threshold label
                  ctx.font = '9px monospace';
    ctx.fillStyle = categoryColors.primary;
    ctx.textAlign = 'left';
    ctx.fillText(`T: ${threshold.toFixed(1)}dB`, curveLeft + curvePadding + 4, thresholdY - 4);
    
    // Ratio label
    const ratioText = ratio === Infinity ? '∞:1' : `${ratio.toFixed(1)}:1`;
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                  ctx.textAlign = 'right';
    ctx.fillText(`R: ${ratioText}`, curveLeft + transferWidth - 24, curveTop + 12);

    // Real-time signal point
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

        const inputOverThreshold = clampedInputDb - threshold;
        let outputDb = clampedInputDb;
        
        if (inputOverThreshold > effectiveKnee / 2) {
          outputDb = threshold + inputOverThreshold / ratio;
        } else if (inputOverThreshold > -effectiveKnee / 2) {
          const x = inputOverThreshold + effectiveKnee / 2;
          outputDb = clampedInputDb - ((ratio - 1) * Math.pow(x, 2) / (2 * effectiveKnee * ratio));
        }

        if (outputDb > limiterCeiling) {
          outputDb = limiterCeiling;
        }

        const inputX = dbToX(clampedInputDb);
        const inputY = dbToY(clampedInputDb);
        const outputY = dbToY(outputDb);
        const isCompressing = outputDb < clampedInputDb - 0.5;

        // Current input point
        ctx.shadowBlur = 6;
        ctx.shadowColor = isCompressing ? 'rgba(239, 68, 68, 0.8)' : 'rgba(0, 255, 255, 0.8)';
        ctx.fillStyle = isCompressing ? '#ef4444' : '#00ffff';
        ctx.beginPath();
        ctx.arc(inputX, inputY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Compression arrow
        if (isCompressing) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(inputX, inputY);
          ctx.lineTo(inputX, outputY);
          ctx.stroke();
        }
      }
    }

    // Title
    ctx.font = 'bold 10px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'left';
    ctx.fillText('TRANSFER CURVE', curveLeft, curveTop - 8);

    // ============================================================================
    // SECTION 3: SIDECHAIN VISUALIZATION (Bottom, if enabled)
    // ============================================================================
    
    if (scEnable && sidechainHeight > 0) {
      const scTop = displayHeight - sidechainHeight;
      const scPadding = 20;
      const scWidth = displayWidth - scPadding * 2;
      const scInnerHeight = sidechainHeight - 40;
    
    // Background
    ctx.fillStyle = 'rgba(8, 8, 12, 0.9)';
      ctx.fillRect(scPadding, scTop, scWidth, scInnerHeight);
    
      // Border
      ctx.strokeStyle = hexToRgba(categoryColors.secondary, 0.3);
    ctx.lineWidth = 1;
      ctx.strokeRect(scPadding, scTop, scWidth, scInnerHeight);

      // Draw sidechain waveform
      if (isPlaying && sidechainHistoryRef && sidechainHistoryRef.current && sidechainHistoryRef.current.length > 1) {
        const scHistory = sidechainHistoryRef.current;
        const timeWindow = 4000;
        const now = performance.now();
        
        const recentPoints = scHistory
          .map(point => ({
            ...point,
            age: now - point.timestamp
          }))
          .filter(point => point.age <= timeWindow && point.age >= 0)
          .sort((a, b) => a.timestamp - b.timestamp);
        
        if (recentPoints.length > 1) {
          // Normalize sidechain level to 0-1 range (assuming -60dB to 0dB)
          const normalizeLevel = (db) => Math.max(0, Math.min(1, (db + 60) / 60));
          
          ctx.strokeStyle = hexToRgba(categoryColors.secondary, 0.8);
    ctx.lineWidth = 1.5;
          ctx.beginPath();
          
          for (let i = 0; i < recentPoints.length; i++) {
            const point = recentPoints[i];
            const x = scPadding + scWidth - ((point.age / timeWindow) * scWidth);
            const normalized = normalizeLevel(point.level);
            const y = scTop + scInnerHeight - (normalized * scInnerHeight);
            
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }
      }

      // Title
      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = hexToRgba(categoryColors.secondary, 0.8);
    ctx.textAlign = 'left';
      ctx.fillText('SIDECHAIN', scPadding, scTop - 8);
      
      // Current sidechain level
      if (sidechainLevel !== null && isFinite(sidechainLevel)) {
        ctx.font = '10px monospace';
        ctx.fillStyle = categoryColors.secondary;
        ctx.textAlign = 'right';
        ctx.fillText(`${sidechainLevel.toFixed(1)} dB`, scPadding + scWidth - 8, scTop - 8);
      }
    }
    
    // ============================================================================
    // INFO PANEL (Top right) - Minimal
    // ============================================================================
    
    const modelNames = ['Clean/VCA', 'Opto', 'FET'];
    const currentModelName = modelNames[compressorModel] || 'Clean/VCA';
    
        ctx.font = '9px system-ui';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'right';
    ctx.fillText(currentModelName, displayWidth - 8, 12);
    
    if (mix < 100) {
      ctx.fillText(`Mix: ${mix}%`, displayWidth - 8, 24);
    }

    ctx.restore();
  }, [threshold, ratio, knee, attack, release, isPlaying, getTimeDomainData, metricsDb, sidechainLevel, scEnable, compressorModel, mix, grHistoryRef, sidechainHistoryRef, categoryColors, hexToRgba]);

  // Canvas resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Use CanvasRenderManager
  useRenderer(drawVisualizer, 5, 16, [threshold, ratio, knee, attack, release, isPlaying, sidechainLevel, scEnable, compressorModel, mix, gainReduction]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[500px] rounded-xl overflow-hidden"
      style={{
        background: 'rgba(0, 0, 0, 0.3)',
        border: `1px solid ${categoryColors.primary}33`,
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

// ============================================================================
// GAIN REDUCTION METER (Circular) - Secondary display
// ============================================================================

const GainReductionMeter = ({ gainReduction, categoryColors }) => {
  const absGR = Math.abs(gainReduction);
  const percentage = Math.min((absGR / 20) * 100, 100);

  let color = categoryColors?.primary || '#00A8E8';
  if (absGR > 12) color = '#ef4444';
  else if (absGR > 6) color = '#f59e0b';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 100 100" className="transform -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={`${categoryColors?.primary || '#00A8E8'}1A`}
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${percentage * 2.639} 263.9`}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-5xl font-black text-white tabular-nums" style={{ color }}>
            {absGR.toFixed(1)}
          </div>
          <div className="text-xs text-white/50 uppercase tracking-wider font-bold mt-1">dB GR</div>
        </div>
      </div>
      <div className="flex justify-between w-full px-4 text-[9px] text-white/40 font-mono">
        <span>0</span>
        <span>-6</span>
        <span>-12</span>
        <span>-20</span>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AdvancedCompressorUI_V2 = ({ trackId, effect, effectNode, definition }) => {
  const {
    threshold = -24,
    ratio = 4,
    attack = 0.01,
    release = 0.1,
    knee = 12,
    autoMakeup = 1,
    scEnable = 0,
    scSourceId = '',
    scGain = 0,
    scFilterType = 1,
    scFreq = 150,
    scListen = 0,
    stereoLink = 100,
    lookahead = 3,
    detectionMode = 0,
    rmsWindow = 10,
    compressorModel = 0,
    mix = 100
  } = effect.settings || {};

  const [gainReduction, setGainReduction] = useState(0);
  const [sidechainLevel, setSidechainLevel] = useState(null);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('dynamics-forge'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam, setParams } = useParameterBatcher(effectNode);

  // Local state for UI
  const [localCompressorModel, setLocalCompressorModel] = useState(compressorModel);
  const [localMix, setLocalMix] = useState(mix);

  // Ghost values
  const ghostThreshold = useGhostValue(threshold, 400);
  const ghostRatio = useGhostValue(ratio, 400);
  const ghostAttack = useGhostValue(attack * 1000, 400);
  const ghostRelease = useGhostValue(release * 1000, 400);
  const ghostKnee = useGhostValue(knee, 400);
  const ghostMix = useGhostValue(localMix, 400);

  // Audio plugin for metering
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Mixer tracks for sidechain
  const mixerTracks = useMixerStore(state => state.mixerTracks);

  // Store refs for CompressionVisualizer to access worklet data
  const grHistoryRef = useRef([]);
  const sidechainHistoryRef = useRef([]);

  // Listen to worklet messages for GR, sidechain data
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (event) => {
      const { type, gr, scLevel } = event.data;
      if (type === 'metering') {
        if (typeof gr === 'number' && isFinite(gr)) {
          setGainReduction(gr);
          
          // Add to GR history
          grHistoryRef.current.push({
            gr: gr,
            timestamp: performance.now()
          });
          
          // Trim history
          if (grHistoryRef.current.length > 400) {
            grHistoryRef.current.shift();
          }
        }
        
        if (scLevel !== null && typeof scLevel === 'number' && isFinite(scLevel)) {
          setSidechainLevel(scLevel);
          
          // Add to sidechain history
          sidechainHistoryRef.current.push({
            level: scLevel,
            timestamp: performance.now()
          });
          
          // Trim history
          if (sidechainHistoryRef.current.length > 400) {
            sidechainHistoryRef.current.shift();
          }
        } else {
          setSidechainLevel(null);
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

  // Sync with effect.settings when presets are loaded
  useEffect(() => {
    if (!effectNode || !effect.settings) return;

    const updates = {};
    if (effect.settings.compressorModel !== undefined) {
      setLocalCompressorModel(effect.settings.compressorModel);
      updates.compressorModel = effect.settings.compressorModel;
    }
    if (effect.settings.mix !== undefined) {
      setLocalMix(effect.settings.mix);
      updates.mix = effect.settings.mix;
    }

    if (Object.keys(updates).length > 0) {
      setParams(updates, { immediate: true });
    }
  }, [effect.settings, effectNode, setParams]);

  // Handle parameter changes
  const { handleMixerEffectChange } = useMixerStore.getState();
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });
    
    // Update local state
    if (key === 'compressorModel') setLocalCompressorModel(value);
    if (key === 'mix') setLocalMix(value);
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
            {/* Compression Visualizer - Redesigned */}
            <CompressionVisualizer
              trackId={trackId}
              effectId={effect.id}
              threshold={threshold}
              ratio={ratio}
              knee={knee}
              attack={attack}
              release={release}
              gainReduction={gainReduction}
              sidechainLevel={sidechainLevel}
              scEnable={scEnable}
              compressorModel={localCompressorModel}
              mix={localMix}
              grHistoryRef={grHistoryRef}
              sidechainHistoryRef={sidechainHistoryRef}
              categoryColors={categoryColors}
            />

            {/* GR Meter - Secondary circular display */}
            <div 
              className="bg-gradient-to-br from-black/50 rounded-xl p-6 flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}30 100%)`,
                border: `1px solid ${categoryColors.primary}33`,
              }}
            >
              <GainReductionMeter gainReduction={gainReduction} categoryColors={categoryColors} />
            </div>

            {/* Compressor Model Selector */}
            <div 
              className="bg-gradient-to-br from-black/50 rounded-xl p-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}33`,
              }}
            >
              <div 
                className="text-[9px] uppercase tracking-wider mb-3 font-bold"
                style={{ color: `${categoryColors.secondary}B3` }}
              >
                Compressor Model
              </div>
              <ModeSelector
                modes={[
                  { 
                    id: 0, 
                    label: 'Clean/VCA', 
                    icon: '⚡',
                    description: 'Transparent, precise compression (VCA style)'
                  },
                  { 
                    id: 1, 
                    label: 'Opto', 
                    icon: '🎵',
                    description: 'Smooth, musical compression (LA-2A style)'
                  },
                  { 
                    id: 2, 
                    label: 'FET', 
                    icon: '🔥',
                    description: 'Aggressive, fast compression (1176 style)'
                  }
                ]}
                activeMode={localCompressorModel}
                onChange={(modeId) => handleParamChange('compressorModel', modeId)}
                category="dynamics-forge"
                orientation="horizontal"
              />
            </div>

            {/* Mix/Blend Control */}
            <div 
              className="bg-gradient-to-br from-black/50 rounded-xl p-4"
              style={{
                background: `linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, ${categoryColors.accent}20 100%)`,
                border: `1px solid ${categoryColors.primary}33`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div 
                  className="text-[9px] uppercase tracking-wider font-bold"
                  style={{ color: `${categoryColors.secondary}B3` }}
                >
                  Mix / Blend
                </div>
                <div 
                  className="text-[10px] font-mono"
                  style={{ color: categoryColors.primary }}
                >
                  {localMix}%
                </div>
              </div>
              <Knob
                label=""
                value={localMix}
                ghostValue={ghostMix}
                onChange={(val) => handleParamChange('mix', Math.round(val))}
                min={0}
                max={100}
                defaultValue={100}
                sizeVariant="medium"
                category="dynamics-forge"
                valueFormatter={(v) => `${Math.round(v)}%`}
              />
              <div 
                className="text-[9px] text-white/50 mt-2 text-center"
              >
                {localMix === 100 ? 'Full Compression' : localMix === 0 ? 'Dry (Parallel)' : `${localMix}% Compression`}
              </div>
            </div>
          </>
        }

        sidePanel={
          <>
            {/* Manual Controls */}
            <ExpandablePanel
              title="Manual Control"
              icon="⚙️"
              category="dynamics-forge"
              defaultExpanded={true}
            >
              <div className="grid grid-cols-2 gap-4 p-4">
                <Knob
                  label="THRESHOLD"
                  value={threshold}
                  ghostValue={ghostThreshold}
                  onChange={(val) => handleParamChange('threshold', val)}
                  min={-60}
                  max={0}
                  defaultValue={-24}
                  sizeVariant="medium"
                  category="dynamics-forge"
                  valueFormatter={(v) => `${v.toFixed(1)} dB`}
                />

                <Knob
                  label="RATIO"
                  value={ratio}
                  ghostValue={ghostRatio}
                  onChange={(val) => handleParamChange('ratio', val)}
                  min={1}
                  max={20}
                  defaultValue={4}
                  sizeVariant="medium"
                  category="dynamics-forge"
                  valueFormatter={(v) => `${v.toFixed(1)}:1`}
                />

                <Knob
                  label="ATTACK"
                  value={attack * 1000}
                  ghostValue={ghostAttack}
                  onChange={(val) => handleParamChange('attack', val / 1000)}
                  min={0.1}
                  max={100}
                  defaultValue={10}
                  sizeVariant="medium"
                  category="dynamics-forge"
                  valueFormatter={(v) => `${v.toFixed(1)} ms`}
                />

                <Knob
                  label="RELEASE"
                  value={release * 1000}
                  ghostValue={ghostRelease}
                  onChange={(val) => handleParamChange('release', val / 1000)}
                  min={10}
                  max={1000}
                  defaultValue={100}
                  sizeVariant="medium"
                  category="dynamics-forge"
                  valueFormatter={(v) => `${v.toFixed(0)} ms`}
                />

                <Knob
                  label="KNEE"
                  value={knee}
                  ghostValue={ghostKnee}
                  onChange={(val) => handleParamChange('knee', val)}
                  min={0}
                  max={30}
                  defaultValue={12}
                  sizeVariant="medium"
                  category="dynamics-forge"
                  valueFormatter={(v) => `${v.toFixed(1)} dB`}
                />
              </div>

              {/* Auto Makeup Toggle */}
              <div 
                className="px-4 pb-4 pt-2 border-t"
                style={{ borderColor: `${categoryColors.primary}1A` }}
              >
                <Checkbox
                  checked={autoMakeup === 1}
                  onChange={(checked) => handleParamChange('autoMakeup', checked ? 1 : 0)}
                  label="Auto Makeup Gain"
                  description="Automatically compensate for gain reduction"
                  category="dynamics-forge"
                />
              </div>
            </ExpandablePanel>

            {/* Sidechain Controls */}
            <ExpandablePanel
              title="Sidechain"
              icon="🔗"
              category="dynamics-forge"
              defaultExpanded={false}
            >
              <div className="p-4 space-y-4">
                <Checkbox
                  checked={scEnable === 1}
                  onChange={(checked) => handleParamChange('scEnable', checked ? 1 : 0)}
                  label="Enable Sidechain"
                  category="dynamics-forge"
                />

                {scEnable === 1 && (
                  <>
                    <Select
                      value={scSourceId}
                      onChange={(value) => handleParamChange('scSourceId', value)}
                      options={[
                        { value: '', label: 'None' },
                        ...mixerTracks.map(track => ({ value: track.id, label: track.name }))
                      ]}
                      label="Source"
                      category="dynamics-forge"
                    />

                    <Knob
                      label="SC GAIN"
                      value={scGain}
                      onChange={(val) => handleParamChange('scGain', val)}
                      min={-24}
                      max={24}
                      defaultValue={0}
                      sizeVariant="small"
                      category="dynamics-forge"
                      valueFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`}
                    />
                  </>
                )}
              </div>
            </ExpandablePanel>

            {/* Advanced Settings */}
            <ExpandablePanel
              title="Advanced"
              icon="⚙️"
              category="dynamics-forge"
              defaultExpanded={false}
            >
              <div className="p-4 space-y-4">
                <Knob
                  label="LOOKAHEAD"
                  value={lookahead}
                  onChange={(val) => handleParamChange('lookahead', val)}
                  min={0}
                  max={10}
                  defaultValue={3}
                  sizeVariant="small"
                  category="dynamics-forge"
                  valueFormatter={(v) => `${v.toFixed(0)} ms`}
                />

                <Knob
                  label="STEREO LINK"
                  value={stereoLink}
                  onChange={(val) => handleParamChange('stereoLink', val)}
                  min={0}
                  max={100}
                  defaultValue={100}
                  sizeVariant="small"
                  category="dynamics-forge"
                  valueFormatter={(v) => `${v.toFixed(0)}%`}
                />
              </div>
            </ExpandablePanel>
          </>
        }
      />
    </PluginContainerV2>
  );
};

export default AdvancedCompressorUI_V2;
