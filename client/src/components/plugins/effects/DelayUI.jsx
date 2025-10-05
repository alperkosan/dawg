import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '@/lib/core/MeteringService';
import { ProfessionalKnob } from '../container/PluginControls';
import { useMixerStore } from '@/store/useMixerStore';
import { SignalVisualizer } from '../../common/SignalVisualizer';

// Time Division Options
const timeOptions = [
  { value: '1n', label: '1/1', ms: null },
  { value: '2n', label: '1/2', ms: null }, 
  { value: '4n', label: '1/4', ms: null },
  { value: '8n', label: '1/8', ms: null },
  { value: '16n', label: '1/16', ms: null },
  { value: '32n', label: '1/32', ms: null },
  { value: '2t', label: '1/2T', ms: null },
  { value: '4t', label: '1/4T', ms: null }, 
  { value: '8t', label: '1/8T', ms: null },
  { value: '4n.', label: '1/4D', ms: null },
  { value: '8n.', label: '1/8D', ms: null },
  { value: 0.125, label: '125ms', ms: 125 },
  { value: 0.25, label: '250ms', ms: 250 },
  { value: 0.5, label: '500ms', ms: 500 }
];

// Animated Echo Visualization
const EchoVisualization = ({ delayTime, feedback, wet, trackId }) => {
  const canvasRef = useRef(null);
  const echoesRef = useRef([]);
  const [inputLevel, setInputLevel] = useState(-60);
  
  useEffect(() => {
    const meterId = `${trackId}-input`;
    const handleLevel = (data) => setInputLevel(data.peak || -60);
    const unsubscribe = MeteringService.subscribe(meterId, handleLevel);
    return unsubscribe;
  }, [trackId]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let lastTrigger = 0;
    
    const delayMs = typeof delayTime === 'string' 
      ? Tone.Time(delayTime).toMilliseconds() 
      : delayTime * 1000;
    
    class EchoRipple {
      constructor(x, y, delay, amplitude) {
        this.x = x;
        this.y = y;
        this.delay = delay;
        this.amplitude = amplitude;
        this.age = 0;
        this.radius = 0;
        this.opacity = 1;
        this.born = false;
      }
      
      update(dt) {
        this.age += dt;
        
        if (this.age >= this.delay && !this.born) {
          this.born = true;
        }
        
        if (this.born) {
          this.radius += dt * 100; // Expansion speed
          this.opacity = this.amplitude * Math.exp(-this.radius * 0.01);
        }
      }
      
      draw(ctx) {
        if (!this.born || this.opacity < 0.01) return;
        
        ctx.save();
        ctx.globalAlpha = this.opacity * wet;
        ctx.strokeStyle = `hsl(${200 + this.delay * 0.1}, 70%, 60%)`;
        ctx.lineWidth = 2 + this.amplitude * 3;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    
    const animate = (timestamp) => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Clear with trail
      ctx.fillStyle = 'rgba(10, 15, 30, 0.1)';
      ctx.fillRect(0, 0, width, height);
      
      const dt = 16; // ~60fps
      const normalizedInput = (Math.max(-60, inputLevel) + 60) / 60;
      
      // Trigger new echoes based on input level
      if (normalizedInput > 0.1 && timestamp - lastTrigger > 200) {
        const centerX = width * 0.2;
        const centerY = height * 0.5;
        
        // Create echo chain
        let currentDelay = 0;
        let currentAmplitude = normalizedInput;
        
        for (let i = 0; i < 8 && currentAmplitude > 0.05; i++) {
          echoesRef.current.push(new EchoRipple(
            centerX + i * (width * 0.1),
            centerY + (Math.random() - 0.5) * 100,
            currentDelay,
            currentAmplitude
          ));
          
          currentDelay += delayMs;
          currentAmplitude *= feedback;
        }
        
        lastTrigger = timestamp;
      }
      
      // Update and draw echoes
      echoesRef.current = echoesRef.current.filter(echo => {
        echo.update(dt);
        echo.draw(ctx);
        return echo.opacity > 0.01;
      });
      
      // Draw delay time indicator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.setLineDash([5, 5]);
      const delayX = width * 0.2 + (delayMs / 1000) * (width * 0.6);
      ctx.beginPath();
      ctx.moveTo(delayX, 0);
      ctx.lineTo(delayX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Delay time label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px monospace';
      ctx.fillText(`${delayMs.toFixed(0)}ms`, delayX + 5, 20);
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate(0);
    return () => cancelAnimationFrame(animationFrameId);
  }, [delayTime, feedback, wet, inputLevel]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// Tap Tempo Component
const TapTempo = ({ onTempoSet }) => {
  const [taps, setTaps] = useState([]);
  const [averageTempo, setAverageTempo] = useState(null);
  
  const handleTap = () => {
    const now = Date.now();
    const newTaps = [...taps, now].slice(-4); // Keep last 4 taps
    setTaps(newTaps);
    
    if (newTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      const tempo = Math.round(60000 / avgInterval);
      
      if (tempo >= 60 && tempo <= 200) {
        setAverageTempo(tempo);
        const quarterNote = avgInterval / 1000;
        onTempoSet(quarterNote); // Set to quarter note timing
      }
    }
    
    // Reset if no tap for 3 seconds
    setTimeout(() => {
      setTaps(current => current.filter(tap => now - tap < 3000));
    }, 3000);
  };
  
  return (
    <div className="text-center">
      <button
        onClick={handleTap}
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-colors active:scale-95"
      >
        TAP
      </button>
      {averageTempo && (
        <div className="mt-2 text-xs text-blue-300">
          {averageTempo} BPM
        </div>
      )}
    </div>
  );
};

// Stereo Ping Pong Visualizer
const PingPongVisualizer = ({ delayTime, feedback, isPingPong }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!isPingPong) return;
    
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
      
      ctx.clearRect(0, 0, width, height);
      
      const delayMs = typeof delayTime === 'string' 
        ? Tone.Time(delayTime).toMilliseconds() 
        : delayTime * 1000;
      
      // Draw stereo channels
      const leftY = height * 0.3;
      const rightY = height * 0.7;
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, leftY);
      ctx.lineTo(width, leftY);
      ctx.moveTo(0, rightY);
      ctx.lineTo(width, rightY);
      ctx.stroke();
      
      // Animate ping pong ball
      const period = delayMs * 2; // Full left-right cycle
      const phase = (time % period) / period;
      
      let ballX, ballY;
      if (phase < 0.5) {
        // Left to right
        ballX = (phase * 2) * width;
        ballY = leftY;
      } else {
        // Right to left  
        ballX = (2 - phase * 2) * width;
        ballY = rightY;
      }
      
      // Draw ball
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(ballX, ballY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      time += 16;
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [delayTime, feedback, isPingPong]);
  
  if (!isPingPong) return null;
  
  return (
    <div className="bg-black/20 rounded-lg p-3 border border-white/10">
      <div className="text-xs text-cyan-300 mb-2">Stereo Ping Pong</div>
      <canvas ref={canvasRef} className="w-full h-16" />
    </div>
  );
};

export const DelayUI = ({ trackId, effect, onChange, definition }) => {
  const { feedback, delayTime, wet } = effect.settings;
  const isPingPong = definition.type === 'PingPongDelay';
  
  const [isSync, setIsSync] = useState(typeof delayTime === 'string');
  
  const handleTimeChange = (newTime) => {
    onChange('delayTime', newTime);
    setIsSync(typeof newTime === 'string');
  };
  
  const handleTapTempo = (quarterNoteTime) => {
    onChange('delayTime', quarterNoteTime);
    setIsSync(false);
  };
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Echo Chamber</h2>
          <p className="text-xs text-purple-300">
            {isPingPong ? 'Stereo Ping Pong Delay' : 'Feedback Delay'}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Sync Toggle */}
          <button
            onClick={() => setIsSync(!isSync)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              isSync 
                ? 'border-purple-400 text-purple-300 bg-purple-500/20' 
                : 'border-white/30 text-white/60'
            }`}
          >
            {isSync ? 'SYNC' : 'FREE'}
          </button>
          
          {/* Tap Tempo */}
          {!isSync && <TapTempo onTempoSet={handleTapTempo} />}
        </div>
      </div>
      
      {/* Main Visualization */}
      <div className="bg-black/30 rounded-xl p-4 mb-6 h-48 border border-white/10">
        <EchoVisualization 
          delayTime={delayTime} 
          feedback={feedback} 
          wet={wet}
          trackId={trackId}
        />
      </div>
      
      {/* Controls Grid */}
      <div className="grid grid-cols-3 gap-6 mb-4">
        {/* Time Control */}
        <div className="space-y-4">
          <div className="text-center">
            <label className="block text-sm font-medium text-white mb-2">Delay Time</label>
            {isSync ? (
              <select 
                value={delayTime} 
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full bg-black/50 border border-purple-400 rounded-lg p-2 text-white text-center"
              >
                {timeOptions.filter(opt => typeof opt.value === 'string').map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-gray-800">
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="range"
                min="0.001"
                max="2"
                step="0.001"
                value={typeof delayTime === 'string' ? 0.25 : delayTime}
                onChange={(e) => handleTimeChange(parseFloat(e.target.value))}
                className="w-full"
              />
            )}
            <div className="text-xs text-purple-300 mt-1">
              {typeof delayTime === 'string' 
                ? Tone.Time(delayTime).toMilliseconds().toFixed(0) + 'ms'
                : (delayTime * 1000).toFixed(0) + 'ms'
              }
            </div>
          </div>
        </div>
        
        {/* Feedback */}
        <div className="flex justify-center">
          <ProfessionalKnob 
            label="Feedback" 
            value={feedback * 100} 
            onChange={(val) => onChange('feedback', val / 100)} 
            min={0} max={95} defaultValue={30} 
            unit="%" precision={0} size={80}
          />
        </div>
        
        {/* Mix */}
        <div className="flex justify-center">
          <ProfessionalKnob 
            label="Mix" 
            value={wet * 100} 
            onChange={(val) => onChange('wet', val / 100)} 
            min={0} max={100} defaultValue={35} 
            unit="%" precision={0} size={80}
          />
        </div>
      </div>
      
      {/* Additional Visualizations */}
      <div className="grid grid-cols-2 gap-4">
        {/* Input/Output Spectrum */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
          <div className="text-xs text-purple-300 mb-2">Output Spectrum</div>
          <SignalVisualizer 
            meterId={`${trackId}-fft`}
            type="spectrum"
            color="#a855f7"
            config={{ showGrid: false, smooth: true }}
          />
        </div>
        
        {/* Ping Pong Visualizer */}
        <PingPongVisualizer 
          delayTime={delayTime} 
          feedback={feedback} 
          isPingPong={isPingPong}
        />
      </div>
      
      {/* Info Footer */}
      <div className="mt-4 text-center text-xs text-white/40">
        {isPingPong ? 'Stereo Width: 100%' : 'Mono Delay'} • 
        Feedback: {(feedback * 100).toFixed(0)}% • 
        Time: {typeof delayTime === 'string' 
          ? Tone.Time(delayTime).toMilliseconds().toFixed(0) + 'ms'
          : (delayTime * 1000).toFixed(0) + 'ms'
        }
      </div>
    </div>
  );
};