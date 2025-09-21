import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { MeteringService } from '../../lib/core/MeteringService';
import { SignalVisualizer } from '../SignalVisualizer';

// === 808 HARMONIK ANALİZÖRÜ ===
const HarmonicAnalyzer808 = ({ saturation, compression, subBoost }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    // 808 Harmonik Karakteristiği
    const fundamentals = [60, 80, 120]; // Tipik 808 frekansları
    const harmonics = [];
    
    fundamentals.forEach(freq => {
      for (let h = 1; h <= 8; h++) {
        let amplitude = 1 / Math.pow(h, 1.5); // Doğal harmonik düşüş
        
        if (h === 1) amplitude *= (1 + subBoost * 0.8); // Sub boost
        if (h <= 3) amplitude *= (1 + saturation * 0.6); // Düşük harmonikler
        if (h >= 2) amplitude *= (1 + saturation * h * 0.1); // Üst harmonikler
        
        harmonics.push({ freq: freq * h, amplitude, source: freq });
      }
    });
    
    // Çizim
    const maxFreq = 2000;
    harmonics.forEach(harmonic => {
      if (harmonic.freq > maxFreq) return;
      
      const x = (harmonic.freq / maxFreq) * width;
      const barHeight = harmonic.amplitude * height * 0.7;
      const y = height - barHeight;
      
      // Renk kodlaması - frekansa göre
      let hue = 0;
      if (harmonic.freq < 100) hue = 350; // Kırmızı (sub)
      else if (harmonic.freq < 300) hue = 30; // Turuncu (mid-bass)
      else hue = 60; // Sarı (upper harmonics)
      
      const saturationColor = Math.min(100, 70 + saturation * 30);
      const lightness = 50 + harmonic.amplitude * 30;
      
      ctx.fillStyle = `hsl(${hue}, ${saturationColor}%, ${lightness}%)`;
      ctx.fillRect(x - 2, y, 4, barHeight);
      
      // Glow effect
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = harmonic.amplitude * 10;
      ctx.fillRect(x - 2, y, 4, barHeight);
      ctx.shadowBlur = 0;
    });
    
    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    [100, 200, 500, 1000].forEach(freq => {
      const x = (freq / maxFreq) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    });
    
  }, [saturation, compression, subBoost]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// === REAL-TIME SPECTRUM ANALYZER ===
const SpectrumAnalyzer808 = ({ trackId, subBoost, punch }) => {
  const canvasRef = useRef(null);
  const [spectrumData, setSpectrumData] = useState(null);
  
  useEffect(() => {
    const meterId = `${trackId}-fft`;
    const handleSpectrum = (data) => {
      // MeteringService'ten gelen veriyi kontrol et
      if (data && typeof data === 'object') {
        if (Array.isArray(data)) {
          setSpectrumData(data);
        } else if (data.data && Array.isArray(data.data)) {
          setSpectrumData(data.data);
        } else if (Array.isArray(data.spectrum)) {
          setSpectrumData(data.spectrum);
        } else {
          // Float32Array veya benzer array-like obje ise normal array'e çevir
          try {
            setSpectrumData(Array.from(data));
          } catch (e) {
            console.warn('Spectrum data format not recognized:', data);
            setSpectrumData(null);
          }
        }
      }
    };
    
    const unsubscribe = MeteringService.subscribe(meterId, handleSpectrum);
    return unsubscribe;
  }, [trackId]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spectrumData || !Array.isArray(spectrumData) || spectrumData.length === 0) {
      return;
    }
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw spectrum with 808-specific frequency highlighting
    const barWidth = width / spectrumData.length;
    
    spectrumData.forEach((magnitude, index) => {
      const frequency = (index / spectrumData.length) * 22050;
      const normalizedMag = Math.max(0, Math.min(1, (magnitude + 100) / 100)); // Clamp between 0-1
      const barHeight = normalizedMag * height * 0.8;
      
      // Color coding for different frequency ranges
      let color = '#3b82f6'; // Default blue
      
      if (frequency < 100) {
        // Sub frequencies - emphasize with subBoost
        color = `hsl(0, ${70 + subBoost * 30}%, ${50 + subBoost * 30}%)`;
      } else if (frequency < 300) {
        // Punch frequencies
        color = `hsl(30, ${60 + punch * 30}%, ${50 + punch * 20}%)`;
      } else if (frequency < 1000) {
        // Mid frequencies
        color = '#10b981';
      }
      
      ctx.fillStyle = color;
      ctx.fillRect(index * barWidth, height - barHeight, barWidth - 1, barHeight);
      
      // Add glow for enhanced frequencies
      if ((frequency < 100 && subBoost > 0.3) || (frequency < 300 && punch > 0.3)) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 5;
        ctx.fillRect(index * barWidth, height - barHeight, barWidth - 1, barHeight);
        ctx.shadowBlur = 0;
      }
    });
    
  }, [spectrumData, subBoost, punch]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// === DYNAMIC WAVEFORM WITH 808 CHARACTERISTICS ===
const Dynamic808Waveform = ({ trackId, saturation, compression }) => {
  const canvasRef = useRef(null);
  const [waveformData, setWaveformData] = useState(null);
  
  useEffect(() => {
    const meterId = `${trackId}-waveform`;
    const handleWaveform = (data) => {
      // MeteringService'ten gelen veriyi kontrol et
      if (data && typeof data === 'object') {
        if (Array.isArray(data)) {
          setWaveformData(data);
        } else if (data.data && Array.isArray(data.data)) {
          setWaveformData(data.data);
        } else if (Array.isArray(data.waveform)) {
          setWaveformData(data.waveform);
        } else {
          // Float32Array veya benzer array-like obje ise normal array'e çevir
          try {
            setWaveformData(Array.from(data));
          } catch (e) {
            console.warn('Waveform data format not recognized:', data);
            setWaveformData(null);
          }
        }
      }
    };
    
    const unsubscribe = MeteringService.subscribe(meterId, handleWaveform);
    return unsubscribe;
  }, [trackId]);
  
  const draw808Waveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData || !Array.isArray(waveformData) || waveformData.length === 0) {
      return;
    }
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    
    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(139, 69, 19, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.1)');
    gradient.addColorStop(1, 'rgba(220, 20, 60, 0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    const centerY = height / 2;
    const sampleWidth = width / waveformData.length;
    
    // Main waveform
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2 + saturation * 2;
    ctx.shadowColor = '#ff6b35';
    ctx.shadowBlur = 5 + saturation * 10;
    
    ctx.beginPath();
    waveformData.forEach((sample, index) => {
      // Apply visual compression effect
      let visualSample = sample;
      if (compression > 0.1) {
        const threshold = 0.7 - compression * 0.3;
        if (Math.abs(sample) > threshold) {
          const ratio = 1 + compression * 3;
          const excess = Math.abs(sample) - threshold;
          const compressedExcess = excess / ratio;
          visualSample = Math.sign(sample) * (threshold + compressedExcess);
        }
      }
      
      const x = index * sampleWidth;
      const y = centerY - visualSample * (height * 0.4);
      
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Harmonic overlay for saturation visualization
    if (saturation > 0.2) {
      ctx.strokeStyle = `rgba(255, 255, 100, ${saturation * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      waveformData.forEach((sample, index) => {
        const harmonic = Math.sin(sample * Math.PI * 2) * saturation * 0.1;
        const x = index * sampleWidth;
        const y = centerY - (sample + harmonic) * (height * 0.4);
        
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    
  }, [waveformData, saturation, compression]);
  
  useEffect(() => {
    draw808Waveform();
  }, [draw808Waveform]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// === FALLBACK VISUALIZER (Eğer gerçek veri yoksa) ===
const FallbackVisualizer = ({ saturation, compression, subBoost, punch }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;
    
    const animate = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Clear with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(139, 69, 19, 0.2)');
      gradient.addColorStop(0.5, 'rgba(255, 140, 0, 0.05)');
      gradient.addColorStop(1, 'rgba(220, 20, 60, 0.2)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      const centerY = height / 2;
      const samples = 200;
      
      // Simulated 808 waveform
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2 + saturation * 2;
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 5 + saturation * 10;
      
      ctx.beginPath();
      for (let i = 0; i < samples; i++) {
        const x = (i / samples) * width;
        const phase = (i / samples) * Math.PI * 4 + time * 0.01;
        
        // Simulated 808 waveform
        let sample = Math.sin(phase) * 0.6;
        sample += Math.sin(phase * 0.5) * subBoost * 0.3; // Sub
        sample += Math.sin(phase * 2) * punch * 0.2; // Punch
        
        // Visual compression
        if (compression > 0.1) {
          sample = Math.tanh(sample * (1 + compression)) * 0.8;
        }
        
        const y = centerY - sample * (height * 0.3);
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      time += 1;
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [saturation, compression, subBoost, punch]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// === ENHANCED COMPRESSION VISUALIZER ===
const CompressionVisualizer = ({ gainReduction, inputLevel, compression }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;
    
    const animate = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Clear
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, width, height);
      
      // Draw compression curve
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      for (let x = 0; x < width; x++) {
        const inputDb = (x / width) * 60 - 60; // -60dB to 0dB
        const threshold = -20 + compression * 15;
        const ratio = 2 + compression * 6;
        
        let outputDb = inputDb;
        if (inputDb > threshold) {
          const excess = inputDb - threshold;
          outputDb = threshold + excess / ratio;
        }
        
        const y = height - ((outputDb + 60) / 60) * height;
        
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Current operating point
      const currentInputDb = -60 + inputLevel * 60;
      const currentX = ((currentInputDb + 60) / 60) * width;
      const currentOutputDb = currentInputDb + gainReduction;
      const currentY = height - ((currentOutputDb + 60) / 60) * height;
      
      // Operating point
      ctx.fillStyle = '#ff0000';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      time += 16;
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gainReduction, inputLevel, compression]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// === COMPRESSION METER ===
const CompressionMeter808 = ({ gainReduction, inputLevel }) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs font-bold text-orange-300">PUMP</div>
      <div className="relative w-8 h-32 bg-black/60 rounded-full border border-orange-500/30">
        {/* Gain Reduction Bars */}
        <div className="absolute bottom-2 left-1 right-1">
          {Array.from({ length: 12 }).map((_, i) => {
            const isActive = Math.abs(gainReduction) > (i * 2);
            const color = i < 6 ? '#10b981' : i < 9 ? '#f59e0b' : '#ef4444';
            return (
              <div
                key={i}
                className="h-1.5 mb-1 rounded-sm transition-all duration-100"
                style={{
                  backgroundColor: isActive ? color : 'rgba(255,255,255,0.1)',
                  boxShadow: isActive ? `0 0 6px ${color}` : 'none'
                }}
              />
            );
          })}
        </div>
        
        {/* Input Level Indicator */}
        <div 
          className="absolute right-0 w-1 bg-orange-400 rounded-r-full transition-all duration-100"
          style={{
            height: `${Math.max(4, inputLevel * 100)}%`,
            bottom: '8px',
            boxShadow: inputLevel > 0.5 ? '0 0 8px #fb923c' : 'none'
          }}
        />
      </div>
      
      <div className="text-[9px] text-orange-300 font-mono text-center">
        <div>{Math.abs(gainReduction).toFixed(1)}dB</div>
        <div className="text-orange-500">GR</div>
      </div>
    </div>
  );
};

// === ANA 808 BASS ENHANCER UI ===
export const BassEnhancer808UI = ({ trackId, effect, onChange, definition }) => {
  const { 
    saturation = 0.3, 
    compression = 0.4, 
    subBoost = 0.6, 
    punch = 0.5, 
    warmth = 0.3, 
    wet = 1.0 
  } = effect.settings;
  
  const [inputLevel, setInputLevel] = useState(0);
  const [gainReduction, setGainReduction] = useState(0);
  const [presetMode, setPresetMode] = useState('custom');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Metering
  useEffect(() => {
    const inputMeterId = `${trackId}-input`;
    const grMeterId = `${trackId}-${effect.id}`;
    
    const handleInputLevel = (data) => setInputLevel((data.peak + 60) / 60);
    const handleGainReduction = (data) => setGainReduction(typeof data === 'number' ? data : 0);
    
    const unsubInput = MeteringService.subscribe(inputMeterId, handleInputLevel);
    const unsubGR = MeteringService.subscribe(grMeterId, handleGainReduction);
    
    return () => {
      unsubInput();
      unsubGR();
    };
  }, [trackId, effect.id]);
  
  // Enhanced presets - Array format for compatibility
  const presets = [
    { name: 'Sub Monster', settings: { saturation: 0.2, compression: 0.6, subBoost: 0.9, punch: 0.7, warmth: 0.4 } },
    { name: 'Trap Knock', settings: { saturation: 0.5, compression: 0.8, subBoost: 0.5, punch: 0.9, warmth: 0.3 } },
    { name: 'Drill Bass', settings: { saturation: 0.7, compression: 0.5, subBoost: 0.4, punch: 0.8, warmth: 0.6 } },
    { name: 'Future Bass', settings: { saturation: 0.4, compression: 0.3, subBoost: 0.7, punch: 0.4, warmth: 0.8 } },
    { name: 'Phonk Heavy', settings: { saturation: 0.8, compression: 0.9, subBoost: 0.6, punch: 1.0, warmth: 0.2 } },
    { name: 'Lofi Warm', settings: { saturation: 0.6, compression: 0.3, subBoost: 0.5, punch: 0.2, warmth: 0.9 } },
    { name: 'UK Drill', settings: { saturation: 0.9, compression: 0.7, subBoost: 0.3, punch: 0.9, warmth: 0.1 } }
  ];
  
  const applyPreset = (presetObj) => {
    if (presetObj && presetObj.settings) {
      Object.entries(presetObj.settings).forEach(([param, value]) => {
        onChange(param, value);
      });
      setPresetMode(presetObj.name);
    }
  };
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-purple-950 via-orange-950 to-red-950 p-6">
      
      {/* === HEADER === */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
            808 BASS ENHANCER
          </h1>
          <p className="text-sm text-orange-300">Next-Generation Multiband Bass Processing</p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-3 py-2 text-xs rounded border transition-all ${
              showAdvanced 
                ? 'border-orange-400 bg-orange-500/20 text-orange-200' 
                : 'border-orange-600/50 text-orange-400'
            }`}
          >
            {showAdvanced ? 'SIMPLE' : 'ADVANCED'}
          </button>
        </div>
      </div>
      
      {/* === PRESET BAR === */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {presets.map(preset => (
          <button
            key={preset.name}
            onClick={() => applyPreset(preset)}
            className={`px-4 py-2 text-xs rounded-full border whitespace-nowrap transition-all ${
              presetMode === preset.name
                ? 'border-orange-400 bg-orange-500/20 text-orange-200'
                : 'border-orange-600/50 text-orange-400 hover:border-orange-400/70'
            }`}
          >
            {preset.name}
          </button>
        ))}
      </div>
      
      {/* === MAIN CONTENT === */}
      <div className="grid grid-cols-[2fr_1fr] gap-6 h-[calc(100%-180px)]">
        
        {/* === VISUALIZATIONS === */}
        <div className="space-y-4">
          
          {/* Dynamic Waveform */}
          <div className="bg-black/40 rounded-xl p-4 h-40 border border-orange-500/20">
            <div className="text-sm font-bold text-orange-300 mb-2 flex justify-between">
              <span>808 Waveform Analysis</span>
              <span className="text-xs text-orange-400">
                Input: {(inputLevel * 100).toFixed(0)}% | GR: -{Math.abs(gainReduction).toFixed(1)}dB
              </span>
            </div>
            <Dynamic808Waveform 
              trackId={trackId}
              saturation={saturation}
              compression={compression}
            />
          </div>
          
          {/* Spectrum Analyzer */}
          <div className="bg-black/40 rounded-xl p-4 flex-1 min-h-0 border border-red-500/20">
            <div className="text-sm font-bold text-red-300 mb-2">Real-Time Spectrum Analysis</div>
            <SpectrumAnalyzer808 
              trackId={trackId}
              subBoost={subBoost}
              punch={punch}
            />
          </div>
          
          {/* Fallback Visualizer - eğer gerçek veri yoksa */}
          {showAdvanced && (
            <div className="bg-black/40 rounded-xl p-4 h-32 border border-purple-500/20">
              <div className="text-sm font-bold text-purple-300 mb-2">
                Plugin Processing Simulation
                <span className="text-xs text-purple-400 ml-2">(Demo Mode)</span>
              </div>
              <FallbackVisualizer 
                saturation={saturation}
                compression={compression}
                subBoost={subBoost}
                punch={punch}
              />
            </div>
          )}
          
          {/* Advanced Compression Curve */}
          {showAdvanced && (
            <div className="bg-black/40 rounded-xl p-4 h-32 border border-blue-500/20">
              <div className="text-sm font-bold text-blue-300 mb-2">Compression Curve</div>
              <CompressionVisualizer 
                gainReduction={gainReduction}
                inputLevel={inputLevel}
                compression={compression}
              />
            </div>
          )}
        </div>
        
        {/* === CONTROLS === */}
        <div className="space-y-4">
          
          {/* Core Processing */}
          <div className="bg-black/30 rounded-xl p-4 border border-purple-500/20">
            <div className="text-sm font-bold text-purple-300 mb-4">Core Processing</div>
            <div className="grid grid-cols-2 gap-4">
              <ProfessionalKnob
                label="Sub Boost"
                value={subBoost * 100}
                onChange={(v) => onChange('subBoost', v / 100)}
                min={0} max={100} defaultValue={60}
                unit="%" precision={0} size={70}
              />
              <ProfessionalKnob
                label="Punch"
                value={punch * 100}
                onChange={(v) => onChange('punch', v / 100)}
                min={0} max={100} defaultValue={50}
                unit="%" precision={0} size={70}
              />
              <ProfessionalKnob
                label="Saturation"
                value={saturation * 100}
                onChange={(v) => onChange('saturation', v / 100)}
                min={0} max={100} defaultValue={30}
                unit="%" precision={0} size={70}
              />
              <ProfessionalKnob
                label="Compression"
                value={compression * 100}
                onChange={(v) => onChange('compression', v / 100)}
                min={0} max={100} defaultValue={40}
                unit="%" precision={0} size={70}
              />
            </div>
          </div>
          
          {/* Character & Mix */}
          <div className="bg-black/30 rounded-xl p-4 border border-orange-500/20">
            <div className="text-sm font-bold text-orange-300 mb-4">Character & Mix</div>
            <div className="space-y-4">
              <ProfessionalKnob
                label="Warmth"
                value={warmth * 100}
                onChange={(v) => onChange('warmth', v / 100)}
                min={0} max={100} defaultValue={30}
                unit="%" precision={0} size={75}
              />
              <ProfessionalKnob
                label="Mix"
                value={wet * 100}
                onChange={(v) => onChange('wet', v / 100)}
                min={0} max={100} defaultValue={100}
                unit="%" precision={0} size={75}
              />
            </div>
          </div>
          
          {/* Metering */}
          <div className="bg-black/30 rounded-xl p-4 border border-red-500/20 flex-1">
            <div className="text-sm font-bold text-red-300 mb-4">Dynamics</div>
            <div className="flex justify-center">
              <CompressionMeter808 
                gainReduction={gainReduction} 
                inputLevel={inputLevel}
              />
            </div>
          </div>
          
          {/* Advanced Controls */}
          {showAdvanced && (
            <div className="bg-black/30 rounded-xl p-4 border border-blue-500/20">
              <div className="text-sm font-bold text-blue-300 mb-4">Advanced</div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span>Sub Frequency:</span>
                  <span className="text-blue-300">80Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Punch Frequency:</span>
                  <span className="text-blue-300">{(180 + punch * 80).toFixed(0)}Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Comp Ratio:</span>
                  <span className="text-blue-300">{(2 + compression * 6).toFixed(1)}:1</span>
                </div>
                <div className="flex justify-between">
                  <span>Sat Drive:</span>
                  <span className="text-blue-300">{(1 + saturation * 4).toFixed(1)}x</span>
                </div>
                <div className="flex justify-between">
                  <span>Warmth Freq:</span>
                  <span className="text-blue-300">300Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing:</span>
                  <span className="text-green-400">Multiband</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Harmonic Content Analyzer */}
          {showAdvanced && (
            <div className="bg-black/30 rounded-xl p-4 border border-yellow-500/20">
              <div className="text-sm font-bold text-yellow-300 mb-4">Harmonic Content</div>
              <div className="h-24">
                <HarmonicAnalyzer808 
                  saturation={saturation} 
                  compression={compression} 
                  subBoost={subBoost}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* === STATUS BAR === */}
      <div className="mt-4 bg-black/20 rounded-lg p-3 border border-white/10">
        <div className="flex justify-between items-center text-xs text-orange-300">
          <span>Mode: {presetMode || 'Custom'}</span>
          <span>Processing: Multiband</span>
          <span>Sub: {(subBoost * 100).toFixed(0)}%</span>
          <span>Punch: {(punch * 100).toFixed(0)}%</span>
          <span>Sat: {(saturation * 100).toFixed(0)}%</span>
          <span>Comp: {(compression * 100).toFixed(0)}%</span>
          <span className="text-red-400">GR: -{Math.abs(gainReduction).toFixed(1)}dB</span>
          <span className="text-green-400">CPU: Normal</span>
        </div>
      </div>
    </div>
  );
};