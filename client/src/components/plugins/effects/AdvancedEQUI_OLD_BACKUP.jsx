import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { EQCalculations } from '@/lib/audio/EQCalculations';
import { SignalVisualizer } from '../../common/SignalVisualizer';
import { ProfessionalKnob } from '../container/PluginControls';
import { Plus, Minus, RotateCcw, Settings } from 'lucide-react';

// ⚡ Throttle utility for parameter updates
const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Constants
const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_DB = -18;
const MAX_DB = 18;
const NODE_HIT_RADIUS = 15;

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

// ⚡ EQ Band Control Component - Memoized for performance
const EQBandControl = React.memo(({ band, index, onChange, onRemove, isActive, onActivate }) => {
  const typeColors = {
    lowshelf: '#ef4444',
    peaking: '#3b82f6',
    highshelf: '#10b981'
  };

  const typeIcons = {
    lowshelf: '⤋',
    peaking: '⬢',
    highshelf: '⤴'
  };

  return (
    <div 
      className={`bg-black/40 rounded-xl p-4 border-2 transition-all cursor-pointer hover:bg-black/60 ${
        isActive ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-400/20' : 'border-white/20'
      }`}
      onClick={onActivate}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ backgroundColor: typeColors[band.type] || '#6b7280' }}
          >
            {typeIcons[band.type] || '◊'}
          </div>
          <span className="text-sm font-bold text-white">Band {index + 1}</span>
          <div className={`w-2 h-2 rounded-full ${band.active ? 'bg-green-400' : 'bg-gray-600'}`} />
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onChange(index, 'active', !band.active);
            }}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              band.active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
            }`}
            title={band.active ? 'Deaktif Et' : 'Aktif Et'}
          >
            {band.active ? 'ON' : 'OFF'}
          </button>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            className="text-red-400 hover:text-red-300 text-lg w-6 h-6 flex items-center justify-center"
            title="Band'i Sil"
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Quick Controls */}
      <div className="grid grid-cols-2 gap-3">
        {/* Type & Frequency */}
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-gray-400 block font-bold">TYPE</label>
            <select 
              value={band.type} 
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onChange(index, 'type', e.target.value)}
              className="w-full bg-black/60 border border-white/30 rounded text-xs text-white p-1.5 focus:border-cyan-400 focus:outline-none"
            >
              <option value="lowshelf">Low Shelf</option>
              <option value="peaking">Peaking</option>
              <option value="highshelf">High Shelf</option>
            </select>
          </div>
          
          <div>
            <label className="text-[10px] text-gray-400 block font-bold">FREQ (Hz)</label>
            <input 
              type="number" 
              value={Math.round(band.frequency)} 
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onChange(index, 'frequency', parseFloat(e.target.value) || 20)}
              className="w-full bg-black/60 border border-white/30 rounded text-xs text-white p-1.5 focus:border-cyan-400 focus:outline-none"
              min="20" max="20000"
            />
          </div>
        </div>
        
        {/* Gain & Q */}
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-gray-400 block font-bold">GAIN (dB)</label>
            <input 
              type="number" 
              value={band.gain.toFixed(1)} 
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onChange(index, 'gain', parseFloat(e.target.value) || 0)}
              className="w-full bg-black/60 border border-white/30 rounded text-xs text-white p-1.5 focus:border-cyan-400 focus:outline-none"
              min="-18" max="18" step="0.1"
            />
          </div>
          
          <div>
            <label className="text-[10px] text-gray-400 block font-bold">Q</label>
            <input 
              type="number" 
              value={band.q.toFixed(2)} 
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onChange(index, 'q', parseFloat(e.target.value) || 0.71)}
              className="w-full bg-black/60 border border-white/30 rounded text-xs text-white p-1.5 focus:border-cyan-400 focus:outline-none"
              min="0.1" max="18" step="0.01"
            />
          </div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChange(index, 'gain', 0);
          }}
          className="flex-1 text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          title="Reset Gain"
        >
          RESET
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Bypass this band
            onChange(index, 'active', !band.active);
          }}
          className={`flex-1 text-[10px] px-2 py-1 rounded transition-colors ${
            band.active 
              ? 'bg-yellow-600 hover:bg-yellow-500 text-white' 
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
          title="Bypass Band"
        >
          BYP
        </button>
      </div>
    </div>
  );
});

// ⚡ Enhanced EQ Canvas - Optimized with throttling
const EQCanvas = ({ bands, onBandChange, activeBandIndex, setActiveBandIndex, onAddBand }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, freq: 0, db: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBand, setDraggedBand] = useState(null);
  const [isMouseOverCanvas, setIsMouseOverCanvas] = useState(false);
  const drawDataRef = useRef({ bands: [], responseCurve: [], activeBandIndex: -1 });
  
  // Throttle tooltip updates for better performance
  const tooltipUpdateRef = useRef(null);

  useEffect(() => {
    drawDataRef.current.bands = bands;
    drawDataRef.current.responseCurve = EQCalculations.generateResponseCurve(bands, 44100, 200);
    drawDataRef.current.activeBandIndex = activeBandIndex;
  }, [bands, activeBandIndex]);

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

  // Enhanced draw loop with smooth animations
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
      const { bands, responseCurve, activeBandIndex } = drawDataRef.current;
      const { width, height } = canvasDims;

      // Clear and setup background
      ctx.clearRect(0, 0, width, height);
      
      // Premium gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
      bgGradient.addColorStop(0.5, 'rgba(30, 41, 59, 0.8)');
      bgGradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);
      
      // Enhanced grid system
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = 1;
      
      // Major frequency lines
      [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach(freq => {
        const x = freqToX(freq, width);
        ctx.setLineDash(freq === 1000 ? [] : [2, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Frequency labels with better positioning
        ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        const label = freq >= 1000 ? `${freq/1000}k` : freq.toString();
        ctx.fillText(label, x, height - 8);
      });
      
      // Major dB lines
      [-12, -6, 0, 6, 12].forEach(db => {
        const y = dbToY(db, height);
        ctx.strokeStyle = db === 0 ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.15)';
        ctx.lineWidth = db === 0 ? 2 : 1;
        ctx.setLineDash(db === 0 ? [] : [2, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // dB labels
        ctx.fillStyle = db === 0 ? 'rgba(148, 163, 184, 1)' : 'rgba(148, 163, 184, 0.7)';
        ctx.font = db === 0 ? 'bold 11px system-ui' : '10px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(`${db > 0 ? '+' : ''}${db}`, 8, y - 4);
      });
      
      ctx.setLineDash([]);
      
      // Enhanced response curve with glow effect
      if (responseCurve && responseCurve.length > 0) {
        // Glow effect
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 12;
        
        ctx.beginPath();
        responseCurve.forEach((point, index) => {
          const x = freqToX(point.frequency, width);
          const y = dbToY(point.magnitudeDB, height);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // Main curve
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
        ctx.stroke();
        
        // Fill area under curve
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#60a5fa';
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      // Enhanced EQ band nodes
      if (bands) {
        bands.forEach((band, index) => {
          if (!band || !band.active) return;
          
          const x = freqToX(band.frequency, width);
          const y = dbToY(band.gain, height);
          const isActive = index === activeBandIndex;
          const isDraggedBand = draggedBand && draggedBand.index === index;
          
          // Band influence visualization
          if (isActive || isDraggedBand) {
            const influenceRadius = 100 / band.q;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, influenceRadius);
            gradient.addColorStop(0, 'rgba(96, 165, 250, 0.2)');
            gradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - influenceRadius, y - influenceRadius, influenceRadius * 2, influenceRadius * 2);
          }
          
          // Enhanced node styling
          const typeColors = {
            lowshelf: '#ef4444',
            peaking: '#3b82f6', 
            highshelf: '#10b981'
          };
          
          const nodeColor = typeColors[band.type] || '#6b7280';
          const nodeSize = isActive || isDraggedBand ? 12 : 10;
          
          // Node shadow/glow
          ctx.shadowColor = nodeColor;
          ctx.shadowBlur = isActive ? 15 : 8;
          
          // Node background
          ctx.beginPath();
          ctx.arc(x, y, nodeSize + 2, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.fill();
          
          // Main node
          ctx.beginPath();
          ctx.arc(x, y, nodeSize, 0, 2 * Math.PI);
          ctx.fillStyle = nodeColor;
          ctx.fill();
          
          // Node border
          ctx.strokeStyle = isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = isActive ? 3 : 2;
          ctx.shadowBlur = 0;
          ctx.stroke();
          
          // Band number
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px system-ui';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 3;
          ctx.fillText((index + 1).toString(), x, y + 4);
          ctx.shadowBlur = 0;
        });
      }
      
      animationFrameId = requestAnimationFrame(drawLoop);
    };

    drawLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [canvasDims, activeBandIndex, draggedBand]);

  // Enhanced mouse interactions
  const findBandAtPosition = useCallback((mouseX, mouseY) => {
    return drawDataRef.current.bands.findIndex(band => {
      if (!band || !band.active) return false;
      const bandX = freqToX(band.frequency, canvasDims.width);
      const bandY = dbToY(band.gain, canvasDims.height);
      return Math.hypot(mouseX - bandX, mouseY - bandY) < NODE_HIT_RADIUS;
    });
  }, [canvasDims]);

  const handleMouseDown = useCallback((e) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const hitIndex = findBandAtPosition(mouseX, mouseY);
    
    if (hitIndex !== -1) {
      setIsDragging(true);
      setDraggedBand({ index: hitIndex, startX: mouseX, startY: mouseY });
      setActiveBandIndex(hitIndex);
    }
  }, [findBandAtPosition, setActiveBandIndex]);

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const freq = xToFreq(mouseX, rect.width);
    const db = yToDb(mouseY, rect.height);
    
    setTooltip({ visible: true, x: mouseX, y: mouseY, freq, db });
    
    if (isDragging && draggedBand) {
      const bandIndex = draggedBand.index;
      const band = bands[bandIndex];
      if (band) {
        const newFreq = Math.max(20, Math.min(20000, freq));
        const newGain = Math.max(-18, Math.min(18, db));
        
        // Real-time update during drag
        const newBands = bands.map((b, i) => 
          i === bandIndex ? { ...b, frequency: newFreq, gain: newGain } : b
        );
        onBandChange(newBands);
      }
    } else {
      const activeIndex = findBandAtPosition(mouseX, mouseY);
      setActiveBandIndex(activeIndex);
    }
  }, [isDragging, draggedBand, bands, onBandChange, findBandAtPosition, setActiveBandIndex]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedBand(null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(t => ({ ...t, visible: false }));
    setActiveBandIndex(-1);
    setIsDragging(false);
    setDraggedBand(null);
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
      setActiveBandIndex(-1);
    } else {
      // Add new band
      onAddBand(mouseX, mouseY);
    }
  }, [bands, findBandAtPosition, onBandChange, setActiveBandIndex, onAddBand]);

  // Mouse event listeners with optimized performance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Event handler wrapper functions
    const handleMouseDownWrapper = (e) => handleMouseDown(e);
    const handleMouseEnterWrapper = () => setIsMouseOverCanvas(true);
    const handleMouseLeaveWrapper = () => {
      setIsMouseOverCanvas(false);
      setTooltip(t => ({ ...t, visible: false }));
      setActiveBandIndex(-1);
      setIsDragging(false);
      setDraggedBand(null);
      
      // Clear any pending tooltip updates
      if (tooltipUpdateRef.current) {
        clearTimeout(tooltipUpdateRef.current);
        tooltipUpdateRef.current = null;
      }
    };
    const handleMouseMoveWrapper = (e) => handleMouseMove(e);
    const handleMouseUpWrapper = () => handleMouseUp();

    // Passive event listeners for better performance
    const options = { passive: true };
    
    container.addEventListener('mousedown', handleMouseDownWrapper);
    container.addEventListener('mouseenter', handleMouseEnterWrapper, options);
    container.addEventListener('mouseleave', handleMouseLeaveWrapper, options);
    container.addEventListener('mousemove', handleMouseMoveWrapper, options);
    window.addEventListener('mouseup', handleMouseUpWrapper, options);
    
    return () => {
      container.removeEventListener('mousedown', handleMouseDownWrapper);
      container.removeEventListener('mouseenter', handleMouseEnterWrapper);
      container.removeEventListener('mouseleave', handleMouseLeaveWrapper);
      container.removeEventListener('mousemove', handleMouseMoveWrapper);
      window.removeEventListener('mouseup', handleMouseUpWrapper);
      
      // Cleanup tooltip timer
      if (tooltipUpdateRef.current) {
        clearTimeout(tooltipUpdateRef.current);
      }
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, setActiveBandIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tooltipUpdateRef.current) {
        clearTimeout(tooltipUpdateRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-full cursor-crosshair select-none overflow-hidden"
      onDoubleClick={handleDoubleClick}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      
      {/* Optimized Tooltip - Sadece canvas içindeyken ve gerektiğinde */}
      {tooltip.visible && isMouseOverCanvas && (
        <div
          className="absolute pointer-events-none z-10 transform -translate-x-1/2"
          style={{ 
            left: tooltip.x, 
            top: Math.max(10, tooltip.y - 60),
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            padding: '6px 10px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            fontSize: '11px',
            fontFamily: 'system-ui, monospace',
            transition: 'opacity 150ms ease-out',
            opacity: tooltip.visible ? 1 : 0
          }}
        >
          <div style={{ 
            color: 'var(--color-primary)', 
            fontWeight: 'bold',
            marginBottom: '2px'
          }}>
            {Math.round(tooltip.freq)} Hz
          </div>
          <div style={{ 
            color: 'var(--color-text)',
            fontSize: '10px'
          }}>
            {tooltip.db.toFixed(1)} dB
          </div>
          {tooltip.isOverBand && (
            <div style={{ 
              color: 'var(--color-muted)', 
              fontSize: '9px',
              marginTop: '2px'
            }}>
              {isDragging ? 'Sürükleniyor' : 'Çift tıkla: Sil'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main Enhanced EQ UI Component
export const AdvancedEQUI = ({ trackId, effect, onChange }) => {
  const { bands } = effect.settings;
  const [activeBandIndex, setActiveBandIndex] = useState(-1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 🔧 CSS Variable'ı gerçek renge çevir
  const [primaryColor, setPrimaryColor] = useState('#00a8ff');
  
  useEffect(() => {
    // CSS variable'ı gerçek renge çevir
    const computedStyle = getComputedStyle(document.documentElement);
    const resolvedColor = computedStyle.getPropertyValue('--color-primary').trim();
    if (resolvedColor) {
      setPrimaryColor(resolvedColor);
    }
  }, []);

  // ⚡ Throttled onChange for real-time updates (16ms = 60fps)
  const throttledOnChange = useMemo(
    () => throttle((param, value) => onChange(param, value), 16),
    [onChange]
  );

  // 🔧 Ana band değişiklik fonksiyonu - throttled
  const handleBandChange = useCallback((newBands) => {
    throttledOnChange('bands', newBands);
  }, [throttledOnChange]);

  // ⚡ Optimized band parameter change - tek parametre gönder
  const handleBandParamChange = useCallback((index, param, value) => {
    const newBands = [...bands];
    if (!newBands[index]) return;

    newBands[index] = { ...newBands[index], [param]: value };
    throttledOnChange('bands', newBands);
  }, [bands, throttledOnChange]);

  // ⚡ Band ekleme - memoized
  const handleAddBand = useCallback((mouseX, mouseY) => {
    if (bands.length >= 8) {
      alert('Maksimum 8 band ekleyebilirsiniz.');
      return;
    }

    const rect = document.querySelector('[data-eq-canvas]')?.getBoundingClientRect();
    if (!rect) return;

    const newFreq = xToFreq(mouseX, rect.width);
    const newGain = yToDb(mouseY, rect.height);
    
    const newBand = {
      id: `band-${Date.now()}`,
      type: 'peaking',
      frequency: Math.round(newFreq),
      gain: Math.round(newGain * 10) / 10,
      q: 1.5,
      active: true
    };
    
    handleBandChange([...bands, newBand]);
    setActiveBandIndex(bands.length);
  }, [bands, handleBandChange]);

  // ⚡ Band silme - memoized
  const handleRemoveBand = useCallback((index) => {
    if (bands.length <= 1) {
      alert('En az bir band olmalıdır.');
      return;
    }

    const newBands = bands.filter((_, i) => i !== index);
    handleBandChange(newBands);
    setActiveBandIndex(-1);
  }, [bands, handleBandChange]);

  // ⚡ Preset fonksiyonları - memoized
  const applyPreset = useCallback((presetName) => {
    const presets = {
      'Vocal Clarity': [
        { id: 'band-1', type: 'highshelf', frequency: 8000, gain: 2, q: 0.7, active: true },
        { id: 'band-2', type: 'peaking', frequency: 3000, gain: 1.5, q: 2, active: true },
        { id: 'band-3', type: 'peaking', frequency: 200, gain: -1, q: 1, active: true }
      ],
      'Bass Boost': [
        { id: 'band-1', type: 'lowshelf', frequency: 100, gain: 3, q: 0.7, active: true },
        { id: 'band-2', type: 'peaking', frequency: 60, gain: 2, q: 1.2, active: true }
      ],
      'Flat Response': [
        { id: 'band-1', type: 'peaking', frequency: 1000, gain: 0, q: 1, active: true }
      ]
    };

    if (presets[presetName]) {
      handleBandChange(presets[presetName]);
    }
  }, [handleBandChange]);

  // ⚡ Reset all bands - memoized
  const resetAllBands = useCallback(() => {
    const resetBands = bands.map(band => ({ ...band, gain: 0 }));
    handleBandChange(resetBands);
  }, [bands, handleBandChange]);

  return (
    <div 
      className="w-full h-full flex flex-col"
      style={{ 
        background: 'var(--color-background)',
        color: 'var(--color-text)'
      }}
    >
      {/* Enhanced Header - Fixed Height */}
      <div 
        className="flex items-center justify-between p-6 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div>
          <h2 
            className="text-2xl font-bold mb-1"
            style={{ color: 'var(--color-text)' }}
          >
            Quantum EQ
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '14px' }}>
            Professional Multi-Band Equalizer
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Preset Quick Actions */}
          <div className="flex gap-2">
            {['Vocal Clarity', 'Bass Boost', 'Flat Response'].map(preset => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-muted)',
                  border: '1px solid var(--color-border)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'var(--color-surface2)';
                  e.target.style.color = 'var(--color-text)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'var(--color-surface)';
                  e.target.style.color = 'var(--color-muted)';
                }}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Control Buttons */}
          <div className="flex gap-2">
            <button
              onClick={resetAllBands}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-muted)',
                border: '1px solid var(--color-border)'
              }}
              title="Reset All Gains"
              onMouseEnter={(e) => {
                e.target.style.background = 'var(--color-surface2)';
                e.target.style.color = 'var(--color-text)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'var(--color-surface)';
                e.target.style.color = 'var(--color-muted)';
              }}
            >
              <RotateCcw size={16} />
            </button>
            
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: showAdvanced ? 'var(--color-primary)' : 'var(--color-surface)',
                color: showAdvanced ? 'white' : 'var(--color-muted)',
                border: `1px solid ${showAdvanced ? 'var(--color-primary)' : 'var(--color-border)'}`
              }}
              title="Advanced Controls"
            >
              <Settings size={16} />
            </button>
          </div>
          
          {/* Band Counter */}
          <div 
            className="text-xs px-3 py-2 rounded-lg"
            style={{
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)'
            }}
          >
            <div className="font-bold">Bands: {bands.length}/8</div>
            <div style={{ color: 'var(--color-muted)' }}>
              Active: {bands.filter(b => b.active).length}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content - Flexible Height */}
      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="grid grid-cols-4 gap-6 h-full">
          {/* EQ Curve Visualization - 3 columns */}
          <div 
            className="col-span-3 rounded-2xl p-4 flex flex-col min-h-0"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)'
            }}
          >
            {/* Canvas Header - Fixed */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <span 
                  className="text-lg font-medium"
                  style={{ color: 'var(--color-text)' }}
                >
                  Frequency Response
                </span>
                <div 
                  className="text-xs mt-1"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Çift tıkla: Band ekle/sil • Sürükle: Ayarla • {activeBandIndex >= 0 ? `Band ${activeBandIndex + 1} aktif` : 'Band seç'}
                </div>
              </div>
              
              {/* Real-time Analyzer Toggle */}
              <div 
                className="rounded-lg p-2 h-16 w-32 flex-shrink-0"
                style={{
                  background: 'var(--color-background)',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div 
                  className="text-[10px] mb-1"
                  style={{ color: 'var(--color-muted)' }}
                >
                  INPUT SPECTRUM
                </div>
                <div className="h-10">
                  <SignalVisualizer 
                    meterId={`${trackId}-fft`}
                    type="spectrum"
                    color={primaryColor}
                    config={{ showGrid: false, smooth: true }}
                  />
                </div>
              </div>
            </div>
            
            {/* Canvas Container - Flexible */}
            <div className="flex-1 min-h-0" data-eq-canvas>
              <EQCanvas 
                bands={bands}
                onBandChange={handleBandChange}
                activeBandIndex={activeBandIndex}
                setActiveBandIndex={setActiveBandIndex}
                onAddBand={handleAddBand}
              />
            </div>
          </div>
          
          {/* Band Controls Sidebar - 1 column, Fixed Width */}
          <div className="flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Quick Add Band */}
              <div 
                className="rounded-xl p-4 flex-shrink-0"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div 
                  className="text-sm font-medium mb-3"
                  style={{ color: 'var(--color-text)' }}
                >
                  Quick Add
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'lowshelf', freq: 100, icon: '⤋', color: '#ef4444' },
                    { type: 'peaking', freq: 1000, icon: '⬢', color: '#3b82f6' },
                    { type: 'highshelf', freq: 8000, icon: '⤴', color: '#10b981' }
                  ].map(preset => (
                    <button
                      key={preset.type}
                      onClick={() => {
                        const newBand = {
                          id: `band-${Date.now()}`,
                          type: preset.type,
                          frequency: preset.freq,
                          gain: 0,
                          q: preset.type === 'peaking' ? 1.5 : 0.7,
                          active: true
                        };
                        handleBandChange([...bands, newBand]);
                      }}
                      className="p-3 rounded-lg transition-colors text-center"
                      style={{
                        background: 'var(--color-surface2)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'var(--color-primary)';
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'var(--color-surface2)';
                        e.target.style.color = 'var(--color-text)';
                      }}
                      disabled={bands.length >= 8}
                    >
                      <div 
                        className="text-xl mb-1"
                        style={{ color: preset.color }}
                      >
                        {preset.icon}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                        {preset.type.replace('shelf', '').toUpperCase()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Band Detail Control */}
              {activeBandIndex >= 0 && bands[activeBandIndex] && (
                <div 
                  className="rounded-xl p-4 flex-shrink-0"
                  style={{
                    background: 'var(--color-surface)',
                    border: '2px solid var(--color-primary)',
                    boxShadow: `0 0 20px ${getComputedStyle(document.documentElement).getPropertyValue('--color-primary')}20`
                  }}
                >
                  <div 
                    className="text-sm font-bold mb-3 flex items-center gap-2"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <span>Band {activeBandIndex + 1} - Precision Control</span>
                    <div 
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ background: 'var(--color-primary)' }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <ProfessionalKnob
                      label="Frequency"
                      value={bands[activeBandIndex].frequency}
                      onChange={(val) => handleBandParamChange(activeBandIndex, 'frequency', val)}
                      min={20} max={20000} defaultValue={1000}
                      unit="Hz" precision={0} size={60} logarithmic
                    />
                    
                    <ProfessionalKnob
                      label="Gain"
                      value={bands[activeBandIndex].gain}
                      onChange={(val) => handleBandParamChange(activeBandIndex, 'gain', val)}
                      min={-18} max={18} defaultValue={0}
                      unit="dB" precision={1} size={60}
                    />
                    
                    <ProfessionalKnob
                      label="Q Factor"
                      value={bands[activeBandIndex].q}
                      onChange={(val) => handleBandParamChange(activeBandIndex, 'q', val)}
                      min={0.1} max={18} defaultValue={1.5}
                      precision={2} size={60} logarithmic
                    />
                    
                    <div className="space-y-2">
                      <label className="text-[10px] text-cyan-400 block font-bold">TYPE</label>
                      <select 
                        value={bands[activeBandIndex].type} 
                        onChange={(e) => handleBandParamChange(activeBandIndex, 'type', e.target.value)}
                        className="w-full bg-black/60 border border-cyan-400 rounded text-xs text-white p-2 focus:outline-none"
                      >
                        <option value="lowshelf">Low Shelf</option>
                        <option value="peaking">Peaking</option>
                        <option value="highshelf">High Shelf</option>
                      </select>
                      
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleBandParamChange(activeBandIndex, 'active', !bands[activeBandIndex].active)}
                          className={`flex-1 text-[10px] px-2 py-1.5 rounded transition-colors ${
                            bands[activeBandIndex].active 
                              ? 'bg-green-600 text-white' 
                              : 'bg-gray-600 text-gray-300'
                          }`}
                        >
                          {bands[activeBandIndex].active ? 'ACTIVE' : 'BYPASS'}
                        </button>
                        
                        <button
                          onClick={() => handleRemoveBand(activeBandIndex)}
                          className="flex-1 text-[10px] px-2 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
                        >
                          DELETE
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* All Bands List */}
              <div className="flex-1 min-h-0">
                <div className="text-sm font-medium text-white mb-3">All Bands</div>
                
                {bands.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-8 bg-black/20 rounded-xl border border-white/10">
                    <Plus size={32} className="mx-auto mb-2 opacity-50" />
                    <div>No EQ bands</div>
                    <div className="text-xs mt-1">Double-click on curve to add</div>
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto max-h-full">
                    {bands.map((band, index) => (
                      <EQBandControl
                        key={band.id || index}
                        band={band}
                        index={index}
                        onChange={handleBandParamChange}
                        onRemove={handleRemoveBand}
                        isActive={index === activeBandIndex}
                        onActivate={() => setActiveBandIndex(index)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Advanced Controls */}
              {showAdvanced && (
                <div className="bg-black/20 rounded-xl border border-white/10 p-4 flex-shrink-0">
                  <div className="text-sm font-medium text-white mb-3">Advanced</div>
                  
                  <div className="space-y-3">
                    {/* Global Controls */}
                    <div>
                      <label className="text-[10px] text-gray-400 block font-bold mb-2">GLOBAL GAIN</label>
                      <ProfessionalKnob
                        label="Output"
                        value={0} // Bu değer effect.settings.globalGain olabilir
                        onChange={(val) => onChange('globalGain', val)}
                        min={-12} max={12} defaultValue={0}
                        unit="dB" precision={1} size={50}
                      />
                    </div>
                    
                    {/* Analysis Settings */}
                    <div>
                      <label className="text-[10px] text-gray-400 block font-bold mb-2">ANALYSIS</label>
                      <div className="space-y-2">
                        <button className="w-full text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded transition-colors">
                          Auto-Match Target Curve
                        </button>
                        <button className="w-full text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded transition-colors">
                          Reset All Bands
                        </button>
                      </div>
                    </div>

                    {/* Band Templates */}
                    <div>
                      <label className="text-[10px] text-gray-400 block font-bold mb-2">TEMPLATES</label>
                      <div className="grid grid-cols-1 gap-2">
                        {['Vocal', 'Drum', 'Bass', 'Master'].map(template => (
                          <button
                            key={template}
                            onClick={() => applyPreset(`${template} Template`)}
                            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded transition-colors"
                          >
                            {template}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Status Bar - Fixed Height */}
      <div className="px-6 pb-6 flex-shrink-0">
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <div className="flex gap-6">
              <span>Active Bands: {bands.filter(b => b.active).length}/{bands.length}</span>
              <span>Total Gain: {bands.reduce((sum, b) => sum + (b.active ? b.gain : 0), 0).toFixed(1)}dB</span>
              <span>CPU: Low</span>
            </div>
            
            <div className="flex gap-4">
              <span>Sample Rate: 44.1kHz</span>
              <span>Latency: 0.1ms</span>
              <span className={activeBandIndex >= 0 ? 'text-cyan-400' : ''}>
                {activeBandIndex >= 0 ? `Editing Band ${activeBandIndex + 1}` : 'Ready'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};