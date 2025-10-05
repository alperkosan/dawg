import React, { useState, useEffect, useRef } from 'react';
import { ProfessionalKnob } from '../container/PluginControls';
import { SignalVisualizer } from '../../common/SignalVisualizer';


// 3D Acoustic Space Visualizer
const AcousticSpaceVisualizer = ({ decay, preDelay, wet, trackId }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    // Particle system
    class ReverbParticle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.life = 1;
        this.size = Math.random() * 3 + 1;
        this.decay = 0.99 + (decay * 0.008); // Decay affects particle lifetime
        this.color = `hsl(${180 + Math.random() * 60}, 70%, ${50 + Math.random() * 30}%)`;
      }
      
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life *= this.decay;
        this.vx *= 0.995;
        this.vy *= 0.995;
        
        // Add some acoustic reflection simulation
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const distance = Math.hypot(this.x - centerX, this.y - centerY);
        const maxDistance = Math.min(canvas.width, canvas.height) / 2;
        
        if (distance > maxDistance * 0.8) {
          // Simulate wall reflection
          this.vx *= -0.6;
          this.vy *= -0.6;
        }
      }
      
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life * wet;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.size * 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    
    const animate = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Clear with trail effect
      ctx.fillStyle = `rgba(10, 15, 25, ${0.1 + (1 - decay) * 0.05})`;
      ctx.fillRect(0, 0, width, height);
      
      // Draw room boundaries
      ctx.strokeStyle = 'rgba(100, 150, 200, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
      ctx.setLineDash([]);
      
      // Spawn particles based on pre-delay
      if (Math.random() < 0.3) {
        const delay = preDelay * 1000; // Convert to ms
        setTimeout(() => {
          particlesRef.current.push(new ReverbParticle(
            width * 0.5 + (Math.random() - 0.5) * 50,
            height * 0.5 + (Math.random() - 0.5) * 50
          ));
        }, Math.min(delay, 100));
      }
      
      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.update();
        particle.draw(ctx);
        return particle.life > 0.01;
      });
      
      // Limit particle count
      if (particlesRef.current.length > 100) {
        particlesRef.current = particlesRef.current.slice(-100);
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [decay, preDelay, wet]);
  
  const handleMouseMove = (e) => {
    const rect = e.target.getBoundingClientRect();
    mouseRef.current.x = e.clientX - rect.left;
    mouseRef.current.y = e.clientY - rect.top;
  };
  
  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full cursor-pointer" 
      onMouseMove={handleMouseMove}
    />
  );
};

// Impulse Response Display
const ImpulseResponseDisplay = ({ decay, preDelay }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw impulse response
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#60a5fa';
    ctx.shadowBlur = 4;
    
    ctx.beginPath();
    const samples = width;
    const preDelaySamples = preDelay * width * 0.1;
    
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      let amplitude = 0;
      
      if (i > preDelaySamples) {
        // Exponential decay after pre-delay
        const decayTime = (i - preDelaySamples) / samples;
        amplitude = Math.exp(-decayTime * (10 / decay)) * Math.random() * 0.3;
        
        // Add some early reflections
        if (decayTime < 0.1) {
          amplitude += Math.exp(-decayTime * 50) * 0.2 * Math.sin(decayTime * 100);
        }
      }
      
      const x = i;
      const y = height/2 - amplitude * height * 0.4;
      
      if (i === 0) ctx.moveTo(x, height/2);
      else ctx.lineTo(x, y);
    }
    
    ctx.stroke();
    ctx.shadowBlur = 0;
    
  }, [decay, preDelay]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export const ReverbUI = ({ trackId, effect, onChange }) => {
  const [roomSize, setRoomSize] = useState('Cathedral');
  
  const roomTypes = [
    { name: 'Chamber', decay: 1.2, color: '#fbbf24' },
    { name: 'Hall', decay: 2.5, color: '#60a5fa' },
    { name: 'Cathedral', decay: 6.0, color: '#a78bfa' },
    { name: 'Cave', decay: 8.0, color: '#34d399' }
  ];

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 p-6">
      {/* Header with Room Type */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Space Cathedral</h2>
          <p className="text-xs text-blue-300">Algorithmic Reverb Engine</p>
        </div>
        
        <div className="flex gap-2">
          {roomTypes.map(room => (
            <button
              key={room.name}
              onClick={() => {
                setRoomSize(room.name);
                onChange('decay', room.decay);
              }}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${
                Math.abs(effect.settings.decay - room.decay) < 0.5
                  ? 'border-white text-white'
                  : 'border-white/30 text-white/60 hover:border-white/60'
              }`}
              style={{ backgroundColor: effect.settings.decay === room.decay ? room.color + '40' : 'transparent' }}
            >
              {room.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Main Visualizer */}
      <div className="bg-black/20 rounded-xl p-4 mb-6 h-64 border border-white/10">
        <div className="text-xs text-blue-300 mb-2">Acoustic Space Simulation</div>
        <AcousticSpaceVisualizer 
          decay={effect.settings.decay} 
          preDelay={effect.settings.preDelay} 
          wet={effect.settings.wet}
          trackId={trackId}
        />
      </div>
      
      {/* Controls and Analysis */}
      <div className="grid grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <ProfessionalKnob 
            label="Decay Time" 
            value={effect.settings.decay} 
            onChange={(v) => onChange('decay', v)} 
            min={0.1} max={15} defaultValue={2.5} 
            unit="s" precision={2} size={80}
          />
          <ProfessionalKnob 
            label="Pre-Delay" 
            value={effect.settings.preDelay * 1000} 
            onChange={(v) => onChange('preDelay', v / 1000)} 
            min={0} max={200} defaultValue={10} 
            unit="ms" precision={1} size={80}
          />
        </div>
        
        {/* Impulse Response */}
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
          <div className="text-xs text-blue-300 mb-2">Impulse Response</div>
          <ImpulseResponseDisplay 
            decay={effect.settings.decay} 
            preDelay={effect.settings.preDelay}
          />
        </div>
        
        {/* Mix and Output */}
        <div className="space-y-4">
          <ProfessionalKnob 
            label="Mix" 
            value={effect.settings.wet * 100} 
            onChange={(v) => onChange('wet', v / 100)} 
            min={0} max={100} defaultValue={40} 
            unit="%" precision={0} size={80}
          />
          
          {/* Output Spectrum */}
          <div className="bg-black/20 rounded-lg p-3 border border-white/10 h-24">
            <div className="text-xs text-blue-300 mb-2">Output Spectrum</div>
            <SignalVisualizer 
              meterId={`${trackId}-fft`}
              type="spectrum"
              color="#60a5fa"
              config={{ showGrid: false }}
            />
          </div>
        </div>
      </div>
      
      {/* Info Footer */}
      <div className="mt-4 text-center text-xs text-white/40">
        RT60: {(effect.settings.decay * 0.16).toFixed(2)}s • 
        Early Reflections: {(effect.settings.preDelay * 1000).toFixed(0)}ms • 
        Wet/Dry: {(effect.settings.wet * 100).toFixed(0)}%
      </div>
    </div>
  );
};