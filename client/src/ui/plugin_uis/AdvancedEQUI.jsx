import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EQCalculations } from '../../lib/audio/EQCalculations';
import { SignalVisualizer } from '../SignalVisualizer';

// Constants
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_DB = -18;
const MAX_DB = 18;
const NODE_HIT_RADIUS = 12;

// Utility functions
const freqToX = (freq, width) => {
  const logFreq = Math.log(freq);
  const logMin = Math.log(MIN_FREQ);
  const logMax = Math.log(MAX_FREQ);
  return ((logFreq - logMin) / (logMax - logMin)) * width;
};

const xToFreq = (x, width) => {
  const pos = x / width;
  const logMin = Math.log(MIN_FREQ);
  const logMax = Math.log(MAX_FREQ);
  return Math.exp(pos * (logMax - logMin) + logMin);
};

const dbToY = (db, height) => {
  const range = MAX_DB - MIN_DB;
  const percent = (db - MIN_DB) / range;
  return (1 - Math.max(0, Math.min(1, percent))) * height;
};

const yToDb = (y, height) => {
  const range = MAX_DB - MIN_DB;
  const percent = 1 - (y / height);
  return percent * range + MIN_DB;
};

// EQ Band Control Component
const EQBandControl = ({ band, index, onChange, onRemove, isActive }) => {
  const typeColors = {
    lowshelf: '#ef4444',    // red
    peaking: '#3b82f6',     // blue  
    highshelf: '#10b981'    // green
  };

  return (
    <div className={`bg-black/30 rounded-lg p-3 border transition-all ${
      isActive ? 'border-blue-400 bg-blue-500/10' : 'border-white/20'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: typeColors[band.type] || '#6b7280' }}
          />
          <span className="text-xs font-bold text-white">Band {index + 1}</span>
        </div>
        <button 
          onClick={() => onRemove(index)}
          className="text-red-400 hover:text-red-300 text-xs"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-gray-400 block">TYPE</label>
          <select 
            value={band.type} 
            onChange={(e) => onChange(index, 'type', e.target.value)}
            className="w-full bg-black/50 border border-white/20 rounded text-xs text-white p-1"
          >
            <option value="lowshelf">Low Shelf</option>
            <option value="peaking">Peaking</option>
            <option value="highshelf">High Shelf</option>
          </select>
        </div>
        
        <div>
          <label className="text-[10px] text-gray-400 block">FREQ</label>
          <input 
            type="number" 
            value={Math.round(band.frequency)} 
            onChange={(e) => onChange(index, 'frequency', parseFloat(e.target.value))}
            className="w-full bg-black/50 border border-white/20 rounded text-xs text-white p-1"
            min="20" max="20000"
          />
        </div>
        
        <div>
          <label className="text-[10px] text-gray-400 block">GAIN</label>
          <input 
            type="number" 
            value={band.gain.toFixed(1)} 
            onChange={(e) => onChange(index, 'gain', parseFloat(e.target.value))}
            className="w-full bg-black/50 border border-white/20 rounded text-xs text-white p-1"
            min="-18" max="18" step="0.1"
          />
        </div>
        
        <div>
          <label className="text-[10px] text-gray-400 block">Q</label>
          <input 
            type="number" 
            value={band.q.toFixed(2)} 
            onChange={(e) => onChange(index, 'q', parseFloat(e.target.value))}
            className="w-full bg-black/50 border border-white/20 rounded text-xs text-white p-1"
            min="0.1" max="18" step="0.01"
          />
        </div>
      </div>
    </div>
  );
};

// Main EQ Canvas Component  
const EQCanvas = ({ bands, onBandChange, activeBandIndex, setActiveBandIndex }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, freq: 0, db: 0 });
  const drawDataRef = useRef({ bands: [], responseCurve: [], activeBandIndex: -1, draggedBand: null });

  useEffect(() => {
    drawDataRef.current.bands = bands;
    drawDataRef.current.responseCurve = EQCalculations.generateResponseCurve(bands, 44100, 150);
  }, [bands]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCanvasDims({ width, height });
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasDims.width === 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDims.width * dpr;
    canvas.height = canvasDims.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    let animationFrameId;
    
    const drawLoop = () => {
      const { bands, responseCurve, activeBandIndex, draggedBand } = drawDataRef.current;
      const { width, height } = canvasDims;

      ctx.clearRect(0, 0, width, height);
      
      // Background gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.8)');
      bgGradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
      
      // Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      
      // Frequency grid
      [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(freq => {
        const x = freqToX(freq, width);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Frequency labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px monospace';
        ctx.fillText(freq >= 1000 ? `${freq/1000}k` : freq.toString(), x + 2, height - 5);
      });
      
      // dB grid
      [-12, -6, 0, 6, 12].forEach(db => {
        const y = dbToY(db, height);
        ctx.strokeStyle = db === 0 ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // dB labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 5, y - 2);
      });
      
      // Response curve
      if (responseCurve && responseCurve.length > 0) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
        responseCurve.forEach((point, index) => {
          const x = freqToX(point.frequency, width);
          const y = dbToY(point.magnitudeDB, height);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      
      // EQ Bands
      if (bands) {
        bands.forEach((band, index) => {
          if (!band || !band.active) return;
          
          const x = freqToX(band.frequency, width);
          const y = dbToY(band.gain, height);
          const isActive = index === activeBandIndex || index === draggedBand?.index;
          
          // Glow effect for active band
          if (isActive) {
            ctx.beginPath();
            ctx.arc(x, y, NODE_HIT_RADIUS + 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(96, 165, 250, 0.3)';
            ctx.fill();
          }
          
          // Band node
          const typeColors = {
            lowshelf: '#ef4444',
            peaking: '#3b82f6', 
            highshelf: '#10b981'
          };
          
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, 2 * Math.PI);
          ctx.fillStyle = typeColors[band.type] || '#6b7280';
          ctx.fill();
          
          // Band border
          ctx.strokeStyle = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Band number
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText((index + 1).toString(), x, y + 3);
        });
      }
      
      animationFrameId = requestAnimationFrame(drawLoop);
    };

    drawLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [canvasDims, activeBandIndex]);

  const findBandAtPosition = useCallback((mouseX, mouseY) => {
    return drawDataRef.current.bands.findIndex(band => {
      if (!band || !band.active) return false;
      const bandX = freqToX(band.frequency, canvasDims.width);
      const bandY = dbToY(band.gain, canvasDims.height);
      return Math.hypot(mouseX - bandX, mouseY - bandY) < NODE_HIT_RADIUS;
    });
  }, [canvasDims]);

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const freq = xToFreq(mouseX, rect.width);
    const db = yToDb(mouseY, rect.height);
    const activeIndex = findBandAtPosition(mouseX, mouseY);
    
    setTooltip({ visible: true, x: mouseX, y: mouseY, freq, db });
    setActiveBandIndex(activeIndex);
    drawDataRef.current.activeBandIndex = activeIndex;
  }, [findBandAtPosition, setActiveBandIndex]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(t => ({ ...t, visible: false }));
    setActiveBandIndex(-1);
    drawDataRef.current.activeBandIndex = -1;
  }, [setActiveBandIndex]);

  const handleDoubleClick = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hitIndex = findBandAtPosition(mouseX, mouseY);
    
    if (hitIndex !== -1) {
      // Remove band
      const newBands = bands.filter((_, i) => i !== hitIndex);
      onBandChange(newBands);
    } else {
      // Add new band
      const newFreq = xToFreq(mouseX, rect.width);
      const newGain = yToDb(mouseY, rect.height);
      const newBand = {
        id: `band-${Date.now()}`,
        type: 'peaking',
        frequency: newFreq,
        gain: newGain,
        q: 1.5,
        active: true
      };
      onBandChange([...bands, newBand]);
    }
  }, [bands, findBandAtPosition, onBandChange]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      
      {tooltip.visible && (
        <div
          className="absolute bg-black/90 text-white text-xs rounded p-2 pointer-events-none shadow-lg backdrop-blur-sm border border-white/20"
          style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}
        >
          <div className="font-bold">{Math.round(tooltip.freq)} Hz</div>
          <div className="text-blue-300">{tooltip.db.toFixed(1)} dB</div>
        </div>
      )}
    </div>
  );
};

export const AdvancedEQUI = ({ trackId, effect, onChange }) => {
  const { bands } = effect.settings;
  const [activeBandIndex, setActiveBandIndex] = useState(-1);

  const handleBandChange = (newBands) => {
    onChange('bands', newBands);
  };

  // --- DEĞİŞİKLİK BURADA ---
  // Bu fonksiyon artık tüm 'bands' dizisini göndermek yerine,
  // özel bir komut ve değiştirilen bandın bilgileriyle 'onChange'i çağırıyor.
  const handleBandParamChange = (index, param, value) => {
    const bandId = bands[index]?.id;
    if (!bandId) return; // Güvenlik kontrolü
    
    // Değişikliği daha verimli bir formatta gönderiyoruz
    onChange('__update_band_param', {
      bandId,
      param,
      value
    });
  };
  // --- DEĞİŞİKLİK SONU ---

  const handleRemoveBand = (index) => {
    const newBands = bands.filter((_, i) => i !== index);
    handleBandChange(newBands);
    setActiveBandIndex(-1);
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 via-gray-900 to-black p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Frequency Sculptor</h2>
          <p className="text-xs text-gray-400">Precision Multi-Band Equalizer</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-400">
            Bands: {bands.length}
          </div>
          
          {/* Analyzer Toggle */}
          <div className="bg-black/30 rounded-lg p-2 h-16 w-32 border border-white/10">
            <div className="text-[10px] text-gray-400 mb-1">INPUT</div>
            <SignalVisualizer 
              meterId={`${trackId}-fft`}
              type="spectrum"
              color="#34d399"
              config={{ showGrid: false, smooth: true }}
            />
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-4 gap-4 h-[calc(100%-80px)]">
        {/* EQ Curve - Takes 3 columns */}
        <div className="col-span-3 bg-black/20 rounded-xl border border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Response Curve</span>
            <div className="text-xs text-gray-400">
              Double-click to add/remove bands • Drag to adjust
            </div>
          </div>
          
          <div className="h-[calc(100%-40px)]">
            <EQCanvas 
              bands={bands}
              onBandChange={handleBandChange}
              activeBandIndex={activeBandIndex}
              setActiveBandIndex={setActiveBandIndex}
            />
          </div>
        </div>
        
        {/* Band Controls - Takes 1 column */}
        <div className="space-y-3 overflow-y-auto max-h-full">
          <div className="text-sm font-medium text-white mb-2">Band Controls</div>
          
          {bands.map((band, index) => (
            <EQBandControl
              key={band.id || index}
              band={band}
              index={index}
              onChange={handleBandParamChange}
              onRemove={handleRemoveBand}
              isActive={index === activeBandIndex}
            />
          ))}
          
          {bands.length === 0 && (
            <div className="text-center text-gray-500 text-sm py-8">
              Double-click on the curve to add your first EQ band
            </div>
          )}
        </div>
      </div>
    </div>
  );
};