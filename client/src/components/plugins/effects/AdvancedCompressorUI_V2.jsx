/**
 * ADVANCED COMPRESSOR UI V2.0
 *
 * Professional compressor with redesigned visual feedback
 * Inspired by: FabFilter Pro-C, Waves SSL Comp, Universal Audio
 *
 * Visual Design Philosophy:
 * - Large, prominent GR meter (oscilloscope style)
 * - Clean transfer curve (compact but clear)
 * - Real-time envelope visualization
 * - Frequency-aware compression feedback
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PluginContainerV2 from '../container/PluginContainerV2';
import { TwoPanelLayout } from '../layout/TwoPanelLayout';
import { Knob, ExpandablePanel, Checkbox, Select } from '@/components/controls';
import { getCategoryColors } from '../PluginDesignSystem';
import { useParameterBatcher } from '@/services/ParameterBatcher';
import { useRenderer } from '@/services/CanvasRenderManager';
import { useAudioPlugin, useGhostValue } from '@/hooks/useAudioPlugin';
import { useMixerStore } from '@/store/useMixerStore';

// ============================================================================
// COMPRESSION VISUALIZER - Redesigned from scratch
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
  grHistoryRef,
  bandDataRef,
  categoryColors
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const signalBufferRef = useRef([]);
  const envelopeBufferRef = useRef([]); // For attack/release visualization
  const thresholdCrossingRef = useRef([]); // Track threshold crossings
  const maxBufferSize = 200;

  // Helper to convert hex to rgba with opacity
  const hexToRgba = useCallback((hex, opacity) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }, []);

  const { isPlaying, getTimeDomainData, getFrequencyData, metricsDb } = useAudioPlugin(trackId, effectId, {
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
    // LAYOUT: Reference design inspired by professional compressors
    // Top 40%: Transfer Curve (larger, more detailed)
    // Middle 40%: GR Meter (oscilloscope-style) - THE MAIN FOCUS
    // Bottom 20%: Attack/Release Envelope + Band Info
    // ============================================================================
    
    const transferHeight = displayHeight * 0.40;
    const grMeterHeight = displayHeight * 0.40;
    const envelopeHeight = displayHeight * 0.20;
    const transferTop = 0;
    const grMeterTop = transferHeight;
    const envelopeTop = transferHeight + grMeterHeight;

    // Background
    ctx.fillStyle = 'rgba(5, 5, 10, 0.98)';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // ============================================================================
    // SECTION 1: TRANSFER CURVE (Top 40%) - Enhanced visibility
    // ============================================================================
    
    const curvePadding = 40;
    const curveWidth = displayWidth - curvePadding * 2;
    const curveHeight = transferHeight - 30;
    const curveTop = transferTop + 15;
    
    // Background for transfer curve (darker for contrast)
    ctx.fillStyle = 'rgba(8, 8, 12, 0.95)';
    ctx.fillRect(curvePadding, curveTop, curveWidth, curveHeight);
    
    // Border for definition (using categoryColors)
    ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.15);
    ctx.lineWidth = 1;
    ctx.strokeRect(curvePadding, curveTop, curveWidth, curveHeight);
    
    // Enhanced grid (more visible)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    // Vertical grid (dB markers)
    for (let i = 0; i <= 6; i++) {
      const x = curvePadding + (i / 6) * curveWidth;
      ctx.beginPath();
      ctx.moveTo(x, curveTop);
      ctx.lineTo(x, curveTop + curveHeight);
      ctx.stroke();
    }
    // Horizontal grid
    for (let i = 0; i <= 6; i++) {
      const y = curveTop + (i / 6) * curveHeight;
      ctx.beginPath();
      ctx.moveTo(curvePadding, y);
      ctx.lineTo(curvePadding + curveWidth, y);
      ctx.stroke();
    }
    
    // dB markers on axes
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    const dbValues = [-60, -50, -40, -30, -20, -10, 0];
    dbValues.forEach((db, i) => {
      const x = curvePadding + (i / 6) * curveWidth;
      ctx.fillText(`${db}`, x, curveTop + curveHeight + 12);
    });
    
    ctx.textAlign = 'right';
    dbValues.forEach((db, i) => {
      const y = curveTop + curveHeight - (i / 6) * curveHeight;
      ctx.fillText(`${db}`, curvePadding - 6, y + 3);
    });

    // Helper functions
    const dbToX = (db) => curvePadding + ((db + 60) / 60) * curveWidth;
    const dbToY = (db) => curveTop + curveHeight - ((db + 60) / 60) * curveHeight;

    // Unity line (diagonal, 1:1 reference)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(curvePadding, curveTop + curveHeight);
    ctx.lineTo(curvePadding + curveWidth, curveTop);
    ctx.stroke();
    ctx.setLineDash([]);

    // Transfer curve (enhanced, more prominent)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();

    const limiterCeiling = -0.3;
    for (let inputDb = -60; inputDb <= 0; inputDb += 0.5) {
      const inputOverThreshold = inputDb - threshold;
      let outputDb = inputDb;

      if (inputOverThreshold > knee / 2) {
        outputDb = threshold + inputOverThreshold / ratio;
      } else if (inputOverThreshold > -knee / 2) {
        const x = inputOverThreshold + knee / 2;
        outputDb = inputDb - ((ratio - 1) * Math.pow(x, 2) / (2 * knee * ratio));
      }

      if (outputDb > limiterCeiling) {
        outputDb = limiterCeiling;
      }

      const x = dbToX(inputDb);
      const y = dbToY(outputDb);
      if (inputDb === -60) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Threshold line (more visible, like reference image)
    const thresholdY = dbToY(threshold);
    // Use categoryColors for threshold line
    const thresholdColor = categoryColors.primary;
    ctx.strokeStyle = `${thresholdColor}B3`; // 70% opacity
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(curvePadding, thresholdY);
    ctx.lineTo(curvePadding + curveWidth, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Threshold label (prominent) with compression info
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = `${thresholdColor}40`; // 25% opacity
    ctx.fillRect(curvePadding + 8, thresholdY - 18, 140, 16);
    ctx.fillStyle = thresholdColor;
    ctx.textAlign = 'left';
    ctx.fillText(`Threshold: ${threshold.toFixed(1)} dB`, curvePadding + 12, thresholdY - 5);
    
    // Ratio indicator (shows compression intensity)
    const ratioText = ratio === Infinity ? '∞:1' : `${ratio.toFixed(1)}:1`;
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`Ratio: ${ratioText}`, curvePadding + curveWidth - 100, thresholdY - 5);
    
    // Compression zone indicator (area where compression occurs)
    const compressionZoneTop = dbToY(threshold + 20); // +20dB above threshold
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fillRect(curvePadding, thresholdY, curveWidth, compressionZoneTop - thresholdY);
    
    // Ratio line visualization (shows compression curve slope)
    const ratioLineStartX = dbToX(threshold);
    const ratioLineStartY = thresholdY;
    const ratioLineEndX = dbToX(0); // At 0dB input
    const ratioLineEndY = dbToY(threshold + (0 - threshold) / ratio); // Output at 0dB input
    
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(ratioLineStartX, ratioLineStartY);
    ctx.lineTo(ratioLineEndX, ratioLineEndY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Ratio label on the line
    const ratioMidX = (ratioLineStartX + ratioLineEndX) / 2;
    const ratioMidY = (ratioLineStartY + ratioLineEndY) / 2;
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(`${ratioText}`, ratioMidX, ratioMidY - 5);

    // ============================================================================
    // REAL-TIME SIGNAL VISUALIZATION - Connected to Parameters
    // ============================================================================
    
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
        
        if (inputOverThreshold > knee / 2) {
          outputDb = threshold + inputOverThreshold / ratio;
        } else if (inputOverThreshold > -knee / 2) {
          const x = inputOverThreshold + knee / 2;
          outputDb = clampedInputDb - ((ratio - 1) * Math.pow(x, 2) / (2 * knee * ratio));
        }

        if (outputDb > limiterCeiling) {
          outputDb = limiterCeiling;
        }

        const inputX = dbToX(clampedInputDb);
        const inputY = dbToY(clampedInputDb);
        const outputY = dbToY(outputDb);
        const isCompressing = outputDb < clampedInputDb - 0.5;
        const isAboveThreshold = clampedInputDb > threshold;

        // Track threshold crossings
        const now = performance.now();
        const previousPoint = signalBufferRef.current[signalBufferRef.current.length - 1];
        if (previousPoint) {
          const wasAboveThreshold = previousPoint.inputDb > threshold;
          if (isAboveThreshold !== wasAboveThreshold) {
            // Threshold crossing detected
            thresholdCrossingRef.current.push({
              timestamp: now,
              crossingUp: isAboveThreshold
            });
          }
        }

        // Store signal point
        signalBufferRef.current.push({
          inputDb: clampedInputDb,
          outputDb,
          timestamp: now,
          isCompressing,
          isAboveThreshold,
          gainReduction: clampedInputDb - outputDb
        });

        // Trim buffers
        signalBufferRef.current = signalBufferRef.current.filter(point => now - point.timestamp < 1000);
        thresholdCrossingRef.current = thresholdCrossingRef.current.filter(cross => now - cross.timestamp < 2000);

        // ============================================================================
        // VISUALIZATION 1: Threshold Crossing Indicator
        // ============================================================================
        if (isAboveThreshold) {
          // Highlight threshold area when signal is above (using categoryColors)
          ctx.fillStyle = hexToRgba(categoryColors.primary, 0.15);
          ctx.fillRect(curvePadding, thresholdY - 5, curveWidth, 10);
          
          // Pulse effect when crossing
          const recentCrossing = thresholdCrossingRef.current[thresholdCrossingRef.current.length - 1];
          if (recentCrossing && now - recentCrossing.timestamp < 200) {
            const pulse = Math.sin(((now - recentCrossing.timestamp) / 200) * Math.PI);
            ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.7 + pulse * 0.3);
            ctx.lineWidth = 2.5;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(curvePadding, thresholdY);
            ctx.lineTo(curvePadding + curveWidth, thresholdY);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // ============================================================================
        // VISUALIZATION 2: Current Signal Point with Compression Info
        // ============================================================================
        
        // Vertical line showing input level position (using categoryColors)
        ctx.strokeStyle = isAboveThreshold ? hexToRgba(categoryColors.primary, 0.5) : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(inputX, curveTop);
        ctx.lineTo(inputX, curveTop + curveHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Current input point (always visible)
        const pointSize = isCompressing ? 5 : 4;
        ctx.shadowBlur = 8;
        ctx.shadowColor = isCompressing ? 'rgba(239, 68, 68, 0.9)' : 'rgba(0, 255, 255, 0.9)';
        ctx.fillStyle = isCompressing ? 'rgba(239, 68, 68, 1)' : 'rgba(0, 255, 255, 1)';
        ctx.beginPath();
        ctx.arc(inputX, inputY, pointSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Compression visualization
        if (isCompressing) {
          // Compression arrow (input → output)
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(inputX, inputY);
          ctx.lineTo(inputX, outputY);
          ctx.stroke();
          
          // Arrow head
          ctx.fillStyle = 'rgba(239, 68, 68, 1)';
          ctx.beginPath();
          ctx.moveTo(inputX, outputY);
          ctx.lineTo(inputX - 5, outputY - 4);
          ctx.lineTo(inputX + 5, outputY - 4);
          ctx.closePath();
          ctx.fill();
          
          // Output point
          ctx.shadowBlur = 6;
          ctx.shadowColor = 'rgba(239, 68, 68, 0.8)';
          ctx.fillStyle = 'rgba(239, 68, 68, 1)';
          ctx.beginPath();
          ctx.arc(inputX, outputY, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Compression amount label
          const grAmount = (clampedInputDb - outputDb).toFixed(1);
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = 'rgba(239, 68, 68, 1)';
          ctx.textAlign = 'left';
          ctx.fillText(`-${grAmount}dB`, inputX + 8, outputY - 2);
        }

        // Input level label (using categoryColors)
        ctx.font = '10px monospace';
        ctx.fillStyle = isAboveThreshold ? categoryColors.primary : 'rgba(255, 255, 255, 0.8)';
        ctx.textAlign = 'left';
        ctx.fillText(`${clampedInputDb.toFixed(1)}dB`, inputX + 8, inputY + 4);

        // ============================================================================
        // VISUALIZATION 3: Attack/Release Envelope on Transfer Curve
        // ============================================================================
        
        // Show compression envelope (how attack/release affects the curve)
        if (isCompressing && signalBufferRef.current.length > 5) {
          const envelopePoints = signalBufferRef.current.slice(-20); // Last 20 points
          
          // Draw envelope curve showing attack/release character (using categoryColors)
          ctx.strokeStyle = hexToRgba(categoryColors.secondary, 0.4);
          ctx.lineWidth = 1.5;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          
          envelopePoints.forEach((point, idx) => {
            const age = now - point.timestamp;
            const envelopeFactor = Math.exp(-age / (attack * 1000)); // Attack decay
            const releaseFactor = point.isCompressing ? 1 : Math.exp(-age / (release * 1000)); // Release decay
            
            const envelopeX = dbToX(point.inputDb);
            const envelopeOutput = point.outputDb + (point.inputDb - point.outputDb) * envelopeFactor * releaseFactor;
            const envelopeY = dbToY(envelopeOutput);
            
            if (idx === 0) ctx.moveTo(envelopeX, envelopeY);
            else ctx.lineTo(envelopeX, envelopeY);
          });
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Axis labels (larger, more visible)
    ctx.font = 'bold 10px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('Input Level (dB)', curvePadding + curveWidth / 2, transferTop + transferHeight - 6);
    ctx.save();
    ctx.translate(10, transferTop + transferHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output Level (dB)', 0, 0);
    ctx.restore();

    // ============================================================================
    // SECTION 2: GAIN REDUCTION METER (Middle 40%) - MAIN FOCUS
    // ============================================================================
    
    const meterPadding = 25;
    const meterWidth = displayWidth - meterPadding * 2;
    const meterInnerHeight = grMeterHeight - 50;
    const meterTop = grMeterTop + 25;
    
    // Background (darker for oscilloscope effect)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(meterPadding, meterTop, meterWidth, meterInnerHeight);
    
    // Border (more defined, using categoryColors)
    ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.4);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(meterPadding, meterTop, meterWidth, meterInnerHeight);

    // Grid lines (horizontal, more visible, using categoryColors)
    ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.15);
    ctx.lineWidth = 1;
    const grRanges = [0, 2, 4, 6, 8, 10, 12, 15, 18, 20];
    grRanges.forEach(grValue => {
      const y = meterTop + meterInnerHeight - (grValue / 20) * meterInnerHeight;
      ctx.beginPath();
      ctx.moveTo(meterPadding, y);
      ctx.lineTo(meterPadding + meterWidth, y);
      ctx.stroke();
    });

    // Zero line (very prominent, baseline)
    const zeroY = meterTop + meterInnerHeight;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(meterPadding, zeroY);
    ctx.lineTo(meterPadding + meterWidth, zeroY);
    ctx.stroke();

    // GR scale labels (left side, larger)
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'right';
    grRanges.forEach(grValue => {
      const y = meterTop + meterInnerHeight - (grValue / 20) * meterInnerHeight;
      ctx.fillText(`-${grValue}`, meterPadding - 10, y + 4);
    });

    // Draw GR history (oscilloscope style) - THE MAIN FEATURE
    if (isPlaying && grHistoryRef && grHistoryRef.current && grHistoryRef.current.length > 1) {
      const grHistory = grHistoryRef.current;
      const maxGR = 20;
      const timeWindow = 3000; // 3 seconds
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
        // Draw GR waveform (oscilloscope style, using categoryColors)
        ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.95);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        
        for (let i = 0; i < recentPoints.length; i++) {
          const point = recentPoints[i];
          const x = meterPadding + meterWidth - ((point.age / timeWindow) * meterWidth);
          const grNormalized = Math.min(point.gr / maxGR, 1);
          const y = meterTop + meterInnerHeight - (grNormalized * meterInnerHeight * 0.95);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Fill under curve with gradient (enhanced visibility, using categoryColors)
        if (recentPoints.length > 0) {
          const gradient = ctx.createLinearGradient(0, meterTop, 0, meterTop + meterInnerHeight);
          gradient.addColorStop(0, hexToRgba(categoryColors.primary, 0.3));
          gradient.addColorStop(0.5, hexToRgba(categoryColors.primary, 0.2));
          gradient.addColorStop(1, hexToRgba(categoryColors.primary, 0.05));
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(meterPadding + meterWidth, zeroY);
          
          for (let i = recentPoints.length - 1; i >= 0; i--) {
            const point = recentPoints[i];
            const x = meterPadding + meterWidth - ((point.age / timeWindow) * meterWidth);
            const grNormalized = Math.min(point.gr / maxGR, 1);
            const y = meterTop + meterInnerHeight - (grNormalized * meterInnerHeight * 0.95);
            ctx.lineTo(x, y);
          }
          
          if (recentPoints.length > 0) {
            const firstX = meterPadding + meterWidth - ((recentPoints[0].age / timeWindow) * meterWidth);
            ctx.lineTo(firstX, zeroY);
          }
          ctx.closePath();
          ctx.fill();
        }

        // Current GR indicator (right edge, very prominent)
        if (recentPoints.length > 0) {
          const latest = recentPoints[recentPoints.length - 1];
          const grNormalized = Math.min(latest.gr / maxGR, 1);
          const currentY = meterTop + meterInnerHeight - (grNormalized * meterInnerHeight * 0.95);
          
          // Vertical line (thicker, more visible, color-coded)
          const grColor = latest.gr > 12 
            ? '#ef4444' // Red (heavy compression)
            : latest.gr > 6 
            ? '#f59e0b' // Amber (moderate compression)
            : categoryColors.primary; // Category primary (gentle)
          ctx.strokeStyle = grColor;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(meterPadding + meterWidth - 3, meterTop);
          ctx.lineTo(meterPadding + meterWidth - 3, currentY);
          ctx.stroke();

          // Current GR value (large, very prominent, like reference)
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'left';
          // Background for readability
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(meterPadding + meterWidth + 6, currentY - 14, 95, 22);
          ctx.fillStyle = grColor;
          ctx.fillText(`${latest.gr.toFixed(1)} dB`, meterPadding + meterWidth + 10, currentY + 6);

          // ============================================================================
          // VISUALIZATION 4: Attack/Release Character on GR Meter
          // ============================================================================
          
          // Show attack/release timing on GR waveform
          if (recentPoints.length > 3) {
            // Find the latest peak (for attack visualization)
            let peakGR = 0;
            let peakAge = 0;
            for (let i = recentPoints.length - 1; i >= 0; i--) {
              if (recentPoints[i].gr > peakGR) {
                peakGR = recentPoints[i].gr;
                peakAge = recentPoints[i].age;
              }
            }

            if (peakGR > 1) {
              const peakX = meterPadding + meterWidth - ((peakAge / timeWindow) * meterWidth);
              const peakY = meterTop + meterInnerHeight - ((peakGR / maxGR) * meterInnerHeight * 0.95);
              
              // Attack marker (using categoryColors secondary)
              const attackDistance = (attack * 1000) / timeWindow * meterWidth;
              if (attackDistance < meterWidth * 0.3) {
                ctx.strokeStyle = hexToRgba(categoryColors.secondary, 0.6);
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 2]);
                ctx.beginPath();
                ctx.moveTo(peakX, peakY);
                ctx.lineTo(peakX + attackDistance, zeroY + (peakY - zeroY) * 0.5);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Attack label
                ctx.font = '9px monospace';
                ctx.fillStyle = categoryColors.secondary;
                ctx.fillText(`A: ${(attack * 1000).toFixed(1)}ms`, peakX + 5, peakY - 5);
              }

              // Release marker (yellow - standard) - from current point
              const releaseDistance = (release * 1000) / timeWindow * meterWidth;
              if (releaseDistance < meterWidth * 0.3) {
                const currentX = meterPadding + meterWidth - 2;
                ctx.strokeStyle = hexToRgba('#facc15', 0.6); // Standard yellow
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 2]);
                ctx.beginPath();
                ctx.moveTo(currentX, currentY);
                ctx.lineTo(Math.max(meterPadding, currentX - releaseDistance), zeroY);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Release label (if space)
                if (currentY > meterTop + 30) {
                  ctx.font = '9px monospace';
                  ctx.fillStyle = '#facc15'; // Standard yellow
                  ctx.textAlign = 'right';
                  ctx.fillText(`R: ${(release * 1000).toFixed(0)}ms`, currentX - 5, currentY - 5);
                }
              }
            }
          }
        }
      }
    } else if (!isPlaying) {
      // Idle state
      ctx.font = '13px system-ui';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.textAlign = 'center';
      ctx.fillText('▶ Play to see gain reduction', meterPadding + meterWidth / 2, meterTop + meterInnerHeight / 2);
    }

    // Title (larger, more visible)
    ctx.font = 'bold 12px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('GAIN REDUCTION', meterPadding, grMeterTop + 15);

    // ============================================================================
    // SECTION 3: ATTACK/RELEASE ENVELOPE + BAND INFO (Bottom 20%)
    // ============================================================================
    
    const envelopePadding = 15;
    const envelopeWidth = displayWidth - envelopePadding * 2;
    const envelopeInnerHeight = envelopeHeight - 25;
    const envelopeVisualTop = envelopeTop + 12;
    
    // Background
    ctx.fillStyle = 'rgba(8, 8, 12, 0.9)';
    ctx.fillRect(envelopePadding, envelopeVisualTop, envelopeWidth, envelopeInnerHeight);
    
    // Border (using categoryColors)
    ctx.strokeStyle = hexToRgba(categoryColors.primary, 0.2);
    ctx.lineWidth = 1;
    ctx.strokeRect(envelopePadding, envelopeVisualTop, envelopeWidth, envelopeInnerHeight);

    // ============================================================================
    // ATTACK/RELEASE VISUALIZATION - Connected to Signal Behavior
    // ============================================================================
    
    const centerX = envelopePadding + envelopeWidth / 2;
    const centerY = envelopeVisualTop + envelopeInnerHeight / 2;
    
    // Attack visualization (left side) - shows compression engagement speed
    const attackMs = attack * 1000;
    const maxAttackVisual = 50; // max 50ms for visualization
    const attackVisualWidth = Math.min((attackMs / maxAttackVisual) * (envelopeWidth / 3 - 10), envelopeWidth / 3 - 10);
    
    // Attack bar with label (using categoryColors secondary)
    ctx.fillStyle = hexToRgba(categoryColors.secondary, 0.7);
    ctx.fillRect(envelopePadding + 20, centerY - 8, attackVisualWidth, 16);
    ctx.strokeStyle = categoryColors.secondary;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(envelopePadding + 20, centerY - 8, attackVisualWidth, 16);
    
    // Attack time indicator (if signal is actively compressing, pulse)
    if (isPlaying && signalBufferRef.current.length > 0) {
      const latestSignal = signalBufferRef.current[signalBufferRef.current.length - 1];
      if (latestSignal && latestSignal.isCompressing) {
        const pulsePhase = (performance.now() / (attackMs || 1)) % 1;
        const pulseSize = 1 + Math.sin(pulsePhase * Math.PI * 2) * 0.2;
        ctx.fillStyle = hexToRgba(categoryColors.secondary, 0.9 + Math.sin(pulsePhase * Math.PI * 2) * 0.1);
        ctx.fillRect(envelopePadding + 20, centerY - 8, attackVisualWidth, 16);
      }
    }
    
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = categoryColors.secondary;
    ctx.textAlign = 'left';
    ctx.fillText(`A: ${attackMs.toFixed(1)}ms`, envelopePadding + 25, centerY - 12);
    
    // Attack description
    ctx.font = '9px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(attackMs < 5 ? 'Fast' : attackMs < 20 ? 'Medium' : 'Slow', envelopePadding + 25, centerY + 18);
    
    // Release visualization (right side) - shows recovery speed
    const releaseMs = release * 1000;
    const maxReleaseVisual = 500; // max 500ms for visualization
    const releaseVisualWidth = Math.min((releaseMs / maxReleaseVisual) * (envelopeWidth / 3 - 10), envelopeWidth / 3 - 10);
    
    // Release bar (standard yellow color)
    ctx.fillStyle = hexToRgba('#facc15', 0.7);
    ctx.fillRect(centerX + 10, centerY - 8, releaseVisualWidth, 16);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(centerX + 10, centerY - 8, releaseVisualWidth, 16);
    
    // Release time indicator (if signal is releasing, pulse)
    if (isPlaying && signalBufferRef.current.length > 0) {
      const latestSignal = signalBufferRef.current[signalBufferRef.current.length - 1];
      if (latestSignal && !latestSignal.isCompressing && latestSignal.inputDb < threshold) {
        const pulsePhase = (performance.now() / (releaseMs || 1)) % 1;
        ctx.fillStyle = hexToRgba('#facc15', 0.9 + Math.sin(pulsePhase * Math.PI * 2) * 0.1);
        ctx.fillRect(centerX + 10, centerY - 8, releaseVisualWidth, 16);
      }
    }
    
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    ctx.fillText(`R: ${releaseMs.toFixed(0)}ms`, centerX + 15, centerY - 12);
    
    // Release description
    ctx.font = '9px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(releaseMs < 100 ? 'Fast' : releaseMs < 300 ? 'Medium' : 'Slow', centerX + 15, centerY + 18);
    
    // ============================================================================
    // BAND-SPECIFIC COMPRESSION LEVELS - Shows frequency-dependent compression
    // ============================================================================
    
    if (bandDataRef && bandDataRef.current) {
      const bands = bandDataRef.current;
      const bandWidth = envelopeWidth / 6;
      const bandY = envelopeVisualTop + envelopeInnerHeight - 15;
      const bandMaxHeight = 30;
      
      ['low', 'mid', 'high'].forEach((bandName, index) => {
        const bandValue = bands[bandName] || 0;
        const x = envelopePadding + envelopeWidth - (3 - index) * bandWidth - 30;
        
        // Band compression level (normalized to 0-20dB GR range)
        const normalizedLevel = Math.min(Math.abs(bandValue) / 20, 1);
        const barHeight = normalizedLevel * bandMaxHeight;
        
        // Band colors - using categoryColors with variation
        const colors = [
          hexToRgba(categoryColors.secondary, 0.9), // Low - secondary color
          hexToRgba('#facc15', 0.9), // Mid - yellow (standard)
          hexToRgba(categoryColors.accent, 0.9)  // High - accent color
        ];
        
        // Bar background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(x, bandY - bandMaxHeight, 18, bandMaxHeight);
        
        // Compression level bar
        ctx.fillStyle = colors[index];
        ctx.fillRect(x + 1, bandY - barHeight, 16, barHeight);
        
        // Border
        ctx.strokeStyle = colors[index];
        ctx.lineWidth = 1;
        ctx.strokeRect(x, bandY - bandMaxHeight, 18, bandMaxHeight);
        
        // Band label
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(bandName.toUpperCase(), x + 9, bandY + 12);
        
        // Compression amount label (if compressing)
        if (normalizedLevel > 0.1) {
          ctx.font = '8px monospace';
          ctx.fillStyle = colors[index];
          ctx.fillText(`${Math.abs(bandValue).toFixed(1)}dB`, x + 9, bandY - bandMaxHeight - 3);
        }
      });
      
      // Band compression summary
      const totalCompression = Math.abs(bands.low || 0) + Math.abs(bands.mid || 0) + Math.abs(bands.high || 0);
      if (totalCompression > 0.5) {
        ctx.font = '9px system-ui';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.textAlign = 'left';
        ctx.fillText('Multi-band', envelopePadding + envelopeWidth - 80, envelopeVisualTop + 10);
      }
    }

    // Title
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'left';
    ctx.fillText('ATTACK / RELEASE', envelopePadding, envelopeVisualTop - 2);

    // Metrics (top right)
    if (metricsDb && isFinite(metricsDb.rmsDb)) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(displayWidth - 110, 8, 105, 28);
      
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.textAlign = 'right';
      ctx.fillText(`RMS: ${metricsDb.rmsDb.toFixed(1)} dB`, displayWidth - 8, 20);
      if (isFinite(metricsDb.peakDb)) {
        ctx.fillText(`PEAK: ${metricsDb.peakDb.toFixed(1)} dB`, displayWidth - 8, 32);
      }
    }

    ctx.restore();
  }, [threshold, ratio, knee, attack, release, isPlaying, getTimeDomainData, metricsDb, sidechainLevel, scEnable, grHistoryRef, bandDataRef, gainReduction, categoryColors, hexToRgba]);

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
  useRenderer(drawVisualizer, 5, 16, [threshold, ratio, knee, attack, release, isPlaying, sidechainLevel, scEnable, gainReduction]);

  // Container styling using categoryColors prop
  const containerStyle = {
    background: 'rgba(0, 0, 0, 0.5)',
    borderColor: `${categoryColors.primary}33`, // 20% opacity in hex
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[450px] rounded-xl overflow-hidden"
      style={containerStyle}
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

  // Dynamic colors based on GR amount and category
  let color = categoryColors?.primary || '#00A8E8'; // Default: category primary, fallback to blue
  if (absGR > 12) color = '#ef4444'; // Red (heavy compression)
  else if (absGR > 6) color = '#f59e0b'; // Amber (moderate compression)

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
    rmsWindow = 10
  } = effect.settings || {};

  const [gainReduction, setGainReduction] = useState(0);
  const [sidechainLevel, setSidechainLevel] = useState(null);

  // Get category colors
  const categoryColors = useMemo(() => getCategoryColors('dynamics-forge'), []);

  // Use ParameterBatcher for smooth parameter updates
  const { setParam } = useParameterBatcher(effectNode);

  // Ghost values
  const ghostThreshold = useGhostValue(threshold, 400);
  const ghostRatio = useGhostValue(ratio, 400);
  const ghostAttack = useGhostValue(attack * 1000, 400);
  const ghostRelease = useGhostValue(release * 1000, 400);
  const ghostKnee = useGhostValue(knee, 400);

  // Audio plugin for metering
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Mixer tracks for sidechain
  const mixerTracks = useMixerStore(state => state.mixerTracks);

  // Store refs for CompressionVisualizer to access worklet data
  const grHistoryRef = useRef([]);
  const bandDataRef = useRef({ low: 0, mid: 0, high: 0 });

  // Listen to worklet messages for GR, sidechain, and band data
  useEffect(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    const handleMessage = (event) => {
      const { type, gr, scLevel, bands } = event.data;
      if (type === 'metering') {
        if (typeof gr === 'number' && isFinite(gr)) {
          setGainReduction(gr);
          
          // Add to GR history for timeline visualization
          grHistoryRef.current.push({
            gr: gr,
            timestamp: performance.now()
          });
          
          // Trim history
          if (grHistoryRef.current.length > 300) {
            grHistoryRef.current.shift();
          }
        }
        
        if (scLevel !== null && typeof scLevel === 'number' && isFinite(scLevel)) {
          setSidechainLevel(scLevel);
        } else {
          setSidechainLevel(null);
        }
        
        // Store band data for visualization
        if (bands && typeof bands === 'object') {
          bandDataRef.current = {
            low: bands.low || 0,
            mid: bands.mid || 0,
            high: bands.high || 0
          };
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

  // Handle parameter changes
  const { handleMixerEffectChange } = useMixerStore.getState();
  const handleParamChange = useCallback((key, value) => {
    setParam(key, value);
    handleMixerEffectChange(trackId, effect.id, { [key]: value });
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
              grHistoryRef={grHistoryRef}
              bandDataRef={bandDataRef}
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

            {/* Manual Controls */}
            <ExpandablePanel
              title="Manual Control"
              icon="⚙️"
              category="dynamics-forge"
              defaultExpanded={true}
            >
              <div className="grid grid-cols-5 gap-6 p-4">
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
          </>
        }

        sidePanel={
          <>
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
