/**
 * MULTIBAND IMAGER V3.0 - Professional Multiband Stereo Field Sculptor
 *
 * Industry-leading multiband stereo imaging
 * Inspired by: Ozone Imager 2, Waves S1, bx_stereomaker
 *
 * Features:
 * - 4-band frequency-specific stereo width control
 * - Real-time frequency spectrum analyzer
 * - Per-band solo/mute
 * - Stereoize (mono-to-stereo conversion)
 * - Advanced vectorscope visualization
 * - Band crossover frequency control
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Knob, ModeSelector, ExpandablePanel } from '@/components/controls';
import { useAudioPlugin, useGhostValue, useCanvasVisualization } from '@/hooks/useAudioPlugin';

// ============================================================================
// BAND CONFIGURATION
// ============================================================================

const DEFAULT_BANDS = [
  { id: 'low', name: 'Low', freq: 100, color: '#EF4444', minFreq: 20, maxFreq: 200 },
  { id: 'lowMid', name: 'Low Mid', freq: 600, color: '#F59E0B', minFreq: 200, maxFreq: 1000 },
  { id: 'highMid', name: 'High Mid', freq: 3000, color: '#10B981', minFreq: 1000, maxFreq: 6000 },
  { id: 'high', name: 'High', freq: 6000, color: '#3B82F6', minFreq: 3000, maxFreq: 20000 }
];

// ============================================================================
// FREQUENCY SPECTRUM ANALYZER
// ============================================================================

const FrequencySpectrumAnalyzer = React.memo(({ trackId, effectId, bands, bandWidths }) => {
  const { isPlaying, getFrequencyData } = useAudioPlugin(trackId, effectId, {
    fftSize: 2048,
    updateMetrics: false
  });

  const drawSpectrum = useCallback((ctx, width, height) => {
    // Background
    ctx.fillStyle = 'rgba(15, 15, 20, 0.95)';
    ctx.fillRect(0, 0, width, height);

    if (!isPlaying) {
      ctx.fillStyle = 'rgba(155, 89, 182, 0.3)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Audio Stopped', width / 2, height / 2);
      return;
    }

    const freqData = getFrequencyData();
    if (!freqData || freqData.length === 0) return;

    const sampleRate = 48000;
    const nyquist = sampleRate / 2;
    const binWidth = nyquist / freqData.length;

    // Frequency scale (logarithmic)
    const freqToX = (freq) => {
      const minFreq = 20;
      const maxFreq = 20000;
      const logMin = Math.log10(minFreq);
      const logMax = Math.log10(maxFreq);
      const logFreq = Math.log10(freq);
      return ((logFreq - logMin) / (logMax - logMin)) * width;
    };

    // Draw frequency markers
    ctx.strokeStyle = 'rgba(155, 89, 182, 0.2)';
    ctx.lineWidth = 1;
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(155, 89, 182, 0.6)';
    ctx.textAlign = 'center';

    [60, 100, 300, 600, 1000, 3000, 6000].forEach(freq => {
      const x = freqToX(freq);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      const label = freq >= 1000 ? `${freq / 1000}k` : freq.toString();
      ctx.fillText(label, x, height - 5);
    });

    // Draw spectrum
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let firstPoint = true;
    for (let i = 1; i < freqData.length; i++) {
      const freq = i * binWidth;
      if (freq < 20 || freq > 20000) continue;

      const x = freqToX(freq);
      const dbValue = freqData[i];
      const normalized = Math.max(0, Math.min(1, (dbValue + 100) / 100));
      const y = height - normalized * height * 0.8;

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw band dividers and controls
    bands.forEach((band, index) => {
      const x = freqToX(band.freq);
      const widthValue = bandWidths[band.id] || 0;
      const isActive = Math.abs(widthValue) > 0.1;

      // Band divider line
      ctx.strokeStyle = isActive ? band.color : 'rgba(155, 89, 182, 0.3)';
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.setLineDash(isActive ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Band label
      ctx.fillStyle = isActive ? band.color : 'rgba(155, 89, 182, 0.5)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(band.name, x, 15);
      
      // Width value
      ctx.fillText(`${widthValue > 0 ? '+' : ''}${widthValue.toFixed(0)}`, x, 28);
    });

    // Highlight selected band region
    const activeBand = bands.find(b => Math.abs(bandWidths[b.id] || 0) > 0.1);
    if (activeBand) {
      const bandIndex = bands.indexOf(activeBand);
      const startX = bandIndex > 0 ? freqToX(bands[bandIndex - 1].freq) : 0;
      const endX = freqToX(activeBand.freq);
      
      ctx.fillStyle = `${activeBand.color}15`;
      ctx.fillRect(startX, 0, endX - startX, height);
    }
  }, [isPlaying, getFrequencyData, bands, bandWidths]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawSpectrum,
    [bands, bandWidths, isPlaying],
    { throttleMs: 50 } // ~20fps for spectrum
  );

  return (
    <div ref={containerRef} className="w-full h-[180px] bg-black/50 rounded-xl border border-[#9B59B6]/20 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
});

FrequencySpectrumAnalyzer.displayName = 'FrequencySpectrumAnalyzer';

// ============================================================================
// VECTORSCOPE VISUALIZER
// ============================================================================

const VectorscopeVisualizer = React.memo(({ trackId, effectId, correlation }) => {
  const { isPlaying, getTimeDomainData } = useAudioPlugin(trackId, effectId, {
    fftSize: 1024,
    updateMetrics: false
  });

  const historyRef = useRef([]);
  const maxHistory = 100;

  const drawVectorscope = useCallback((ctx, width, height) => {
    // Background
    const bgGradient = ctx.createRadialGradient(
      width / 2, height, 0,
      width / 2, height, Math.max(width, height)
    );
    bgGradient.addColorStop(0, 'rgba(20, 10, 25, 0.95)');
    bgGradient.addColorStop(1, 'rgba(15, 8, 18, 0.95)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height;
    const maxRadius = Math.min(width, height * 0.9);

    // Grid
    ctx.strokeStyle = 'rgba(155, 89, 182, 0.15)';
    ctx.lineWidth = 1;
    
    // Center line
    ctx.beginPath();
    ctx.moveTo(centerX - maxRadius, centerY);
    ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();

    // Semi-circular grid
    for (let r = 0.25; r <= 1; r += 0.25) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * r, Math.PI, 0, false); // Semi-circle (top)
      ctx.stroke();
    }

    if (!isPlaying) {
      ctx.fillStyle = 'rgba(155, 89, 182, 0.3)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Audio Stopped', centerX, centerY - maxRadius / 2);
      return;
    }

    const timeData = getTimeDomainData();
    if (!timeData || timeData.length < 4) return;

    // Process samples
    const sampleCount = Math.min(Math.floor(timeData.length / 2 / 4), 150);
    
    if (historyRef.current.length > maxHistory) {
      historyRef.current = historyRef.current.slice(-maxHistory);
    }

    // Add new points
    for (let i = 0; i < sampleCount; i++) {
      const idx = (i * 4) * 2;
      const L = timeData[idx] || 0;
      const R = timeData[idx + 1] || 0;
      
      const X = (L + R) * 0.5; // Mid
      const Y = (L - R) * 0.5; // Side
      
      historyRef.current.push({
        x: X,
        y: Y,
        life: 1.0
      });
    }

    // Draw history
    ctx.save();
    const alivePoints = historyRef.current.filter(p => p.life > 0);
    
    alivePoints.forEach(point => {
      point.life -= 0.01;

      const angle = Math.atan2(point.y, point.x); // Polar angle
      const radius = Math.sqrt(point.x * point.x + point.y * point.y); // Polar radius

      const x = centerX + Math.cos(angle) * radius * maxRadius;
      const y = centerY - Math.sin(angle) * radius * maxRadius;

      const hue = 270 + (correlation * 60);
      const alpha = point.life * 0.6;
      
      ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    historyRef.current = historyRef.current.filter(p => p.life > 0);
    ctx.restore();

    // Labels
    ctx.fillStyle = 'rgba(155, 89, 182, 0.8)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('L', centerX - maxRadius * 0.7, centerY + 15);
    ctx.fillText('R', centerX + maxRadius * 0.7, centerY + 15);
    ctx.fillText('M', centerX, centerY - maxRadius * 0.9);
  }, [isPlaying, getTimeDomainData, correlation]);

  const { containerRef, canvasRef } = useCanvasVisualization(
    drawVectorscope,
    [correlation, isPlaying],
    { throttleMs: 33 }
  );

  return (
    <div ref={containerRef} className="w-full h-[200px] bg-black/50 rounded-xl border border-[#9B59B6]/20 overflow-hidden">
      <div className="p-2">
        <div className="text-[9px] text-[#9B59B6]/70 font-bold uppercase">Vectorscope</div>
      </div>
      <canvas ref={canvasRef} className="w-full h-[180px]" />
    </div>
  );
});

VectorscopeVisualizer.displayName = 'VectorscopeVisualizer';

// ============================================================================
// MAIN MULTIBAND IMAGER UI
// ============================================================================

export function ImagerUI({ trackId, effect, onUpdate = () => {} }) {
  const [bands, setBands] = useState(() => {
    const savedBands = effect.settings?.bands;
    return savedBands || DEFAULT_BANDS.map(b => ({ ...b }));
  });

  const [bandWidths, setBandWidths] = useState(() => {
    const saved = effect.settings?.bandWidths || {};
    return {
      low: saved.low ?? 0,
      lowMid: saved.lowMid ?? 0,
      highMid: saved.highMid ?? 0,
      high: saved.high ?? 0
    };
  });

  const [bandMutes, setBandMutes] = useState(() => {
    const saved = effect.settings?.bandMutes || {};
    return {
      low: saved.low ?? 0,
      lowMid: saved.lowMid ?? 0,
      highMid: saved.highMid ?? 0,
      high: saved.high ?? 0
    };
  });

  const [bandSolos, setBandSolos] = useState(() => {
    const saved = effect.settings?.bandSolos || {};
    return {
      low: saved.low ?? 0,
      lowMid: saved.lowMid ?? 0,
      highMid: saved.highMid ?? 0,
      high: saved.high ?? 0
    };
  });

  // Debug: Log state changes
  useEffect(() => {
    console.log('🎛️ Imager State:', { bandMutes, bandSolos });
  }, [bandMutes, bandSolos]);

  const [stereoize, setStereoize] = useState(effect.settings?.stereoize ?? 0);
  const [globalWidth, setGlobalWidth] = useState(effect.settings?.globalWidth ?? 1.0);
  const [correlation, setCorrelation] = useState(1);
  const [mode, setMode] = useState('polar'); // 'polar' or 'level'

  // Audio plugin
  const { plugin } = useAudioPlugin(trackId, effect.id, {
    fftSize: 2048,
    updateMetrics: false
  });

  // Listen for correlation
  useEffect(() => {
    const port = plugin?.audioNode?.workletNode?.port;
    if (!port) return;
    
    const onMsg = (e) => {
      if (e.data?.type === 'corr' && typeof e.data.value === 'number') {
        setCorrelation(Math.max(-1, Math.min(1, e.data.value)));
      }
    };
    
    port.addEventListener('message', onMsg);
    return () => port.removeEventListener('message', onMsg);
  }, [plugin]);

  // Update effect parameters
  const updateParams = useCallback(() => {
    const audioNode = plugin?.audioNode?.workletNode;
    if (!audioNode?.port) return;

    // Prepare parameters
    const params = {
      band1Freq: bands[0]?.freq || 100,
      band2Freq: bands[1]?.freq || 600,
      band3Freq: bands[2]?.freq || 3000,
      band4Freq: bands[3]?.freq || 6000,
      band1Width: bandWidths.low || 0,
      band2Width: bandWidths.lowMid || 0,
      band3Width: bandWidths.highMid || 0,
      band4Width: bandWidths.high || 0,
      band1Mute: (bandMutes.low || 0) >= 0.5 ? 1 : 0,
      band2Mute: (bandMutes.lowMid || 0) >= 0.5 ? 1 : 0,
      band3Mute: (bandMutes.highMid || 0) >= 0.5 ? 1 : 0,
      band4Mute: (bandMutes.high || 0) >= 0.5 ? 1 : 0,
      band1Solo: (bandSolos.low || 0) >= 0.5 ? 1 : 0,
      band2Solo: (bandSolos.lowMid || 0) >= 0.5 ? 1 : 0,
      band3Solo: (bandSolos.highMid || 0) >= 0.5 ? 1 : 0,
      band4Solo: (bandSolos.high || 0) >= 0.5 ? 1 : 0,
      stereoize: stereoize >= 0.5 ? 1 : 0,
      globalWidth,
      wet: 1.0
    };

    console.log('📤 Sending Imager params:', params);

    // Send parameters to worklet
    audioNode.port.postMessage({
      type: 'setParameters',
      data: params
    });

    if (typeof onUpdate === 'function') {
      onUpdate({
        ...effect,
        settings: {
          bands,
          bandWidths,
          bandMutes,
          bandSolos,
          stereoize,
          globalWidth
        }
      });
    }
  }, [bands, bandWidths, bandMutes, bandSolos, stereoize, globalWidth, plugin, onUpdate, effect]);

  useEffect(() => {
    const timer = setTimeout(updateParams, 50);
    return () => clearTimeout(timer);
  }, [updateParams]);

  // Handlers
  const handleBandWidthChange = useCallback((bandId, value) => {
    setBandWidths(prev => ({ ...prev, [bandId]: value }));
  }, []);

  const handleBandFreqChange = useCallback((bandId, freq) => {
    setBands(prev => prev.map(b => b.id === bandId ? { ...b, freq } : b));
  }, []);

  const handleBandMute = useCallback((bandId) => {
    setBandMutes(prev => ({ ...prev, [bandId]: prev[bandId] ? 0 : 1 }));
  }, []);

  const handleBandSolo = useCallback((bandId) => {
    setBandSolos(prev => {
      const newSolos = { ...prev };
      // If clicking solo when already solo, turn off
      if (prev[bandId]) {
        newSolos[bandId] = 0;
      } else {
        // Turn off all others, turn on this one
        Object.keys(newSolos).forEach(id => {
          newSolos[id] = id === bandId ? 1 : 0;
        });
      }
      return newSolos;
    });
  }, []);

  // Correlation display
  const correlationDisplay = useMemo(() => {
    const corr = correlation;
    if (corr > 0.95) return { text: 'Mono', color: '#34D399' };
    if (corr > 0.5) return { text: 'Strong', color: '#60A5FA' };
    if (corr > 0) return { text: 'Good', color: '#9CA3AF' };
    if (corr > -0.5) return { text: 'Warning', color: '#F59E0B' };
    return { text: 'Phase Issue', color: '#EF4444' };
  }, [correlation]);

  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-[#0F0813] to-black p-6 flex flex-col gap-4 overflow-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#9B59B6]/70 font-semibold uppercase tracking-wider">The Master Chain</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode(mode === 'polar' ? 'level' : 'polar')}
            className={`px-3 py-1.5 text-xs rounded transition-colors ${
              mode === 'polar'
                ? 'bg-[#9B59B6]/30 border border-[#9B59B6]/50 text-[#9B59B6]'
                : 'bg-[#9B59B6]/20 border border-[#9B59B6]/30 text-[#9B59B6]/70'
            }`}
          >
            {mode === 'polar' ? 'Polar Sample' : 'Polar Level'}
          </button>
        </div>
      </div>

      {/* Frequency Spectrum Analyzer */}
      <FrequencySpectrumAnalyzer
        trackId={trackId}
        effectId={effect.id}
        bands={bands}
        bandWidths={bandWidths}
      />

      {/* Main Controls */}
      <div className="grid grid-cols-5 gap-4">
        {/* Left: Stereo Width Band Controls */}
        <div className="col-span-3 flex flex-col gap-3">
          <div className="text-sm font-bold text-[#9B59B6] uppercase tracking-wider mb-2">
            Stereo Width
          </div>

          {/* Band Faders */}
          {bands.map((band) => {
            const width = bandWidths[band.id] || 0;
            const isMuted = bandMutes[band.id] || 0;
            const isSolo = bandSolos[band.id] || 0;
            const isActive = Math.abs(width) > 0.1;

            return (
              <div key={band.id} className="flex items-center gap-3">
                {/* Band Info */}
                <div className="w-20 flex flex-col">
                  <div className="text-[10px] font-bold" style={{ color: band.color }}>
                    {band.name}
                  </div>
                  <div className="text-[8px] text-white/50">
                    {band.freq >= 1000 ? `${band.freq / 1000}k` : band.freq} Hz
                  </div>
                </div>

                {/* Width Fader */}
                <div className="flex-1 relative">
                  <div className="h-12 bg-black/40 rounded border border-[#9B59B6]/20 relative overflow-hidden">
                    <div
                      className="absolute bottom-0 w-full transition-all duration-100"
                      style={{
                        height: `${Math.abs(width)}%`,
                        background: width > 0
                          ? `linear-gradient(to top, ${band.color}, ${band.color}80)`
                          : `linear-gradient(to top, #9CA3AF, #9CA3AF80)`,
                        opacity: isMuted ? 0.3 : 1
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-xs font-mono ${isActive ? 'text-white' : 'text-white/30'}`}>
                        {width > 0 ? '+' : ''}{width.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="0.5"
                    value={width}
                    onChange={(e) => handleBandWidthChange(band.id, parseFloat(e.target.value))}
                    className="w-full h-2 mt-1"
                    style={{ opacity: isMuted ? 0.5 : 1 }}
                  />
                </div>

                {/* Solo/Mute Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBandSolo(band.id)}
                    className={`w-8 h-8 rounded text-[10px] font-bold transition-all ${
                      isSolo
                        ? 'bg-[#9B59B6] text-white'
                        : 'bg-black/40 text-white/40 border border-[#9B59B6]/20'
                    }`}
                  >
                    S
                  </button>
                  <button
                    onClick={() => handleBandMute(band.id)}
                    className={`w-8 h-8 rounded text-[10px] font-bold transition-all ${
                      isMuted
                        ? 'bg-red-500 text-white'
                        : 'bg-black/40 text-white/40 border border-[#9B59B6]/20'
                    }`}
                  >
                    M
                  </button>
                </div>
              </div>
            );
          })}

          {/* Stereoize Toggle */}
          <div className="flex items-center gap-3 mt-2">
            <label className="text-[10px] text-white/70 w-20">Stereoize</label>
            <div className="flex-1 relative">
              <button
                onClick={() => setStereoize(stereoize ? 0 : 1)}
                className={`w-full h-8 rounded transition-all ${
                  stereoize
                    ? 'bg-[#9B59B6] text-white'
                    : 'bg-black/40 text-white/40 border border-[#9B59B6]/20'
                }`}
              >
                {stereoize ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Vectorscope & Correlation */}
        <div className="col-span-2 flex flex-col gap-4">
          <VectorscopeVisualizer
            trackId={trackId}
            effectId={effect.id}
            correlation={correlation}
          />

          {/* Correlation Meter */}
          <div className="bg-black/40 rounded-lg p-3 border border-[#9B59B6]/20">
            <div className="text-[9px] text-[#9B59B6]/70 uppercase mb-2 font-bold">Correlation</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${Math.round((correlation + 1) * 50)}%`,
                    background: correlationDisplay.color
                  }}
                />
              </div>
              <div className="text-xs font-mono w-20 text-right" style={{ color: correlationDisplay.color }}>
                {correlationDisplay.text}
              </div>
            </div>
            <div className="text-[8px] text-white/40 mt-1 text-center">
              {correlation.toFixed(2)}
            </div>
          </div>

          {/* Global Width */}
          <div className="bg-black/40 rounded-lg p-3 border border-[#9B59B6]/20">
            <div className="text-[9px] text-[#9B59B6]/70 uppercase mb-2 font-bold">Global Width</div>
            <Knob
              label=""
              value={globalWidth}
              onChange={setGlobalWidth}
              min={0}
              max={2}
              defaultValue={1.0}
              sizeVariant="medium"
              category="master-chain"
              valueFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImagerUI;
