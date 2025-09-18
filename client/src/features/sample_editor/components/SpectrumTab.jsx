import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, Activity, Play, Pause } from 'lucide-react';
import { SpectrumAnalyzer } from '../../../lib/audio/SpectrumAnalyzer';
import { useRealtimeEffects } from '../hooks/useRealtimeEffects';
import { AudioMath } from '../../../lib/utils/AudioMath';

const SpectrumTab = ({ instrument, instrumentBuffer }) => {
  const { engine, isPlaying, togglePlayback } = useRealtimeEffects(instrumentBuffer);
  const [analyzer, setAnalyzer] = useState(null);
  const [spectrum, setSpectrum] = useState(null);
  const [waveform, setWaveform] = useState(null);
  const [features, setFeatures] = useState(null);
  const canvasRef = useRef(null);
  const waveformCanvasRef = useRef(null);

  // Initialize analyzer when engine is ready
  useEffect(() => {
    if (!engine) return;

    const spectrumAnalyzer = new SpectrumAnalyzer(engine.outputGain);
    
    spectrumAnalyzer
      .onSpectrum(setSpectrum)
      .onWaveform(setWaveform)
      .onFeatures(setFeatures);

    setAnalyzer(spectrumAnalyzer);

    return () => {
      spectrumAnalyzer.dispose();
    };
  }, [engine]);

  // Start/stop analyzer with playback
  useEffect(() => {
    if (!analyzer) return;

    if (isPlaying) {
      analyzer.start();
    } else {
      analyzer.stop();
    }
  }, [analyzer, isPlaying]);

  // Draw spectrum
  useEffect(() => {
    if (!spectrum || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw spectrum bars
    const barWidth = width / spectrum.length;
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(0.5, '#10b981');
    gradient.addColorStop(1, '#f59e0b');

    ctx.fillStyle = gradient;

    spectrum.forEach((value, index) => {
      // Convert dB to height (assuming range -100 to 0 dB)
      const normalizedValue = Math.max(0, (value + 100) / 100);
      const barHeight = normalizedValue * height;
      
      ctx.fillRect(
        index * barWidth,
        height - barHeight,
        barWidth - 1,
        barHeight
      );
    });

    // Draw frequency labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    const frequencies = [100, 1000, 5000, 10000, 20000];
    frequencies.forEach(freq => {
      const x = (freq / 22050) * width;
      ctx.fillText(`${freq >= 1000 ? freq / 1000 + 'k' : freq}`, x, height - 5);
    });

  }, [spectrum]);

  // Draw waveform
  useEffect(() => {
    if (!waveform || !waveformCanvasRef.current) return;

    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const centerY = height / 2;
    const amplitude = height / 4;

    waveform.forEach((value, index) => {
      const x = (index / waveform.length) * width;
      const y = centerY + (value * amplitude);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw center line
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

  }, [waveform]);

  return (
    <div className="w-full h-full flex" style={{ padding: 'var(--padding-container)', gap: 'var(--padding-container)', backgroundColor: 'var(--color-surface)' }}>
      {/* Sol Panel - Controls & Info */}
      <div className="w-64 shrink-0 flex flex-col" style={{ backgroundColor: 'var(--color-background)', borderRadius: 'var(--border-radius)', padding: 'var(--padding-container)', gap: 'var(--gap-container)' }}>
        
        {/* Playback Control */}
        <div className="text-center">
          <button
            onClick={togglePlayback}
            disabled={!instrumentBuffer}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded font-bold disabled:opacity-50"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? 'Stop Analysis' : 'Start Analysis'}</span>
          </button>
        </div>

        {/* Real-time Features */}
        {features && (
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-sm mb-3" style={{ color: 'var(--color-primary)' }}>
                Real-time Features
              </h4>
              
              <div className="space-y-3">
                {/* RMS Level */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>RMS Level</span>
                    <span>{AudioMath.linearToDb(features.rms).toFixed(1)}dB</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${Math.max(0, (AudioMath.linearToDb(features.rms) + 60) / 60 * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Peak Level */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Peak Level</span>
                    <span>{AudioMath.linearToDb(features.peak).toFixed(1)}dB</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${Math.max(0, (AudioMath.linearToDb(features.peak) + 60) / 60 * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Spectral Centroid */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Brightness</span>
                    <span>{(features.centroid / 1000).toFixed(1)}kHz</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${Math.min(100, (features.centroid / 10000) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Spectral Rolloff */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Rolloff</span>
                    <span>{(features.rolloff / 1000).toFixed(1)}kHz</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-100"
                      style={{ width: `${Math.min(100, (features.rolloff / 20000) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Numeric Display */}
            <div>
              <h4 className="font-bold text-sm mb-2">Precise Values</h4>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span>RMS:</span>
                  <span>{features.rms.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Peak:</span>
                  <span>{features.peak.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Centroid:</span>
                  <span>{features.centroid.toFixed(0)}Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Rolloff:</span>
                  <span>{features.rolloff.toFixed(0)}Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Flux:</span>
                  <span>{features.flux.toFixed(4)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isPlaying && (
          <div className="text-center text-gray-500 mt-auto">
            <Activity size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Start playback to see live analysis</p>
          </div>
        )}
      </div>

      {/* Sağ Panel - Visualizations */}
      <div className="flex-grow rounded-lg p-4" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="h-full flex flex-col">
          <h3 className="text-lg font-bold mb-4">Spectrum Analysis</h3>
          
          <div className="flex-grow space-y-4">
            {/* Frequency Spectrum */}
            <div className="h-1/2">
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                <BarChart3 size={16} />
                Frequency Spectrum
              </h4>
              <div className="h-full bg-gray-900 rounded border border-gray-700 p-2">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={200}
                  className="w-full h-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>

            {/* Waveform */}
            <div className="h-1/2">
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                <Activity size={16} />
                Real-time Waveform
              </h4>
              <div className="h-full bg-gray-900 rounded border border-gray-700 p-2">
                <canvas
                  ref={waveformCanvasRef}
                  width={800}
                  height={150}
                  className="w-full h-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpectrumTab;