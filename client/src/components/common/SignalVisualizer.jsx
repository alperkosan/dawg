import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MeteringService } from '@/lib/core/MeteringService';

// Gelişmiş çizim fonksiyonları
const drawingModes = {
  scope: (ctx, data, config) => {
    const { width, height, color, lineWidth = 2 } = config;
    const centerY = height / 2;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = color;
    ctx.shadowBlur = lineWidth * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    data.data.forEach((val, i) => {
      const x = (i / data.data.length) * width;
      const y = centerY + val * centerY * 0.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;
  },

  spectrum: (ctx, data, config) => {
    const { width, height, color } = config;
    const barWidth = width / data.data.length;
    
    // 🔧 CSS Variable desteği için hex renge çevir
    const resolvedColor = color.startsWith('#') ? color : '#00E5B5';
    
    // Gradient oluştur - hex renk kullan
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, resolvedColor + '80');
    gradient.addColorStop(0.5, resolvedColor + 'CC');
    gradient.addColorStop(1, resolvedColor);
    
    ctx.fillStyle = gradient;
    
    data.data.forEach((val, i) => {
      const db = Math.max(-100, val);
      const percent = (db + 100) / 100;
      const barHeight = height * percent;
      
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    });
  },

  circular: (ctx, data, config) => {
    const { width, height, color } = config;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    
    ctx.beginPath();
    data.data.forEach((val, i) => {
      const angle = (i / data.data.length) * Math.PI * 2;
      const r = radius + val * radius * 0.5;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
  },

  bars: (ctx, data, config) => {
    const { width, height, color } = config;
    const barCount = Math.min(32, data.data.length);
    const barWidth = width / barCount;
    const samplesPerBar = Math.floor(data.data.length / barCount);
    
    for (let i = 0; i < barCount; i++) {
      let barValue = 0;
      for (let j = 0; j < samplesPerBar; j++) {
        barValue += Math.abs(data.data[i * samplesPerBar + j]);
      }
      barValue /= samplesPerBar;
      
      const barHeight = barValue * height;
      const hue = (i / barCount) * 60; // 0-60 (kırmızıdan sarıya)
      
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
    }
  }
};

export const SignalVisualizer = ({ 
  meterId, 
  type = 'scope', 
  color = '#00E5B5',
  className = '',
  style = {},
  config = {}
}) => {
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const [isVisible, setIsVisible] = useState(true);
  const [debugInfo, setDebugInfo] = useState(null);
  const [resolvedColor, setResolvedColor] = useState(color);
  
  // Performance monitoring
  const performanceRef = useRef({
    frameCount: 0,
    lastFpsUpdate: 0,
    fps: 0
  });

  // 🔧 CSS Variable'ı gerçek renge çevir
  const resolveColor = useCallback((colorValue) => {
    if (typeof colorValue !== 'string') {
      return '#00E5B5'; // Fallback
    }

    if (colorValue.startsWith('var(')) {
      try {
        // CSS variable'ı parse et: var(--color-primary) -> --color-primary
        const varName = colorValue.slice(4, -1).trim();
        const computedStyle = getComputedStyle(document.documentElement);
        const resolvedValue = computedStyle.getPropertyValue(varName).trim();
        
        if (resolvedValue) {
          // RGB değerini hex'e çevir
          if (resolvedValue.startsWith('rgb')) {
            const rgb = resolvedValue.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
              const hex = '#' + rgb.slice(0, 3).map(x => {
                const hex = parseInt(x).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
              }).join('');
              return hex;
            }
          }
          return resolvedValue.startsWith('#') ? resolvedValue : '#00E5B5';
        }
      } catch (error) {
        console.warn('CSS variable çözümlenemiyor:', colorValue, error);
      }
      return '#00E5B5'; // Fallback
    }
    
    return colorValue; // Zaten geçerli bir renk
  }, []);

  // Renk değiştiğinde çözümle
  useEffect(() => {
    const resolved = resolveColor(color);
    setResolvedColor(resolved);
  }, [color, resolveColor]);

  const drawFrame = useCallback((visualData) => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Canvas boyutunu ayarla
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }

    // Temizle
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    // Arka plan
    if (config.showBackground !== false) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, rect.width, rect.height);
    }

    // Grid çiz (opsiyonel)
    if (config.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      
      // Yatay çizgiler
      for (let i = 1; i < 4; i++) {
        const pos = (i / 4) * rect.height;
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(rect.width, pos);
        ctx.stroke();
      }
      
      // Dikey çizgiler
      for (let i = 1; i < 4; i++) {
        const pos = (i / 4) * rect.width;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, rect.height);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }

    // Ana çizim
    const drawConfig = {
      width: rect.width,
      height: rect.height,
      color: resolvedColor, // 🔧 Çözümlenmiş rengi kullan
      ...config
    };

    if (drawingModes[type]) {
      try {
        drawingModes[type](ctx, visualData, drawConfig);
      } catch (error) {
        console.error('SignalVisualizer çizim hatası:', error);
        // Fallback - basit çizgi çiz
        ctx.strokeStyle = resolvedColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, rect.height / 2);
        ctx.lineTo(rect.width, rect.height / 2);
        ctx.stroke();
      }
    }

    // Peak indicator
    if (config.showPeak && visualData.peak && visualData.peak > 0.1) {
      const peakY = rect.height * (1 - visualData.peak);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, peakY);
      ctx.lineTo(rect.width, peakY);
      ctx.stroke();
    }

    // FPS hesaplama
    performanceRef.current.frameCount++;
    const now = performance.now();
    if (now - performanceRef.current.lastFpsUpdate > 1000) {
      performanceRef.current.fps = performanceRef.current.frameCount;
      performanceRef.current.frameCount = 0;
      performanceRef.current.lastFpsUpdate = now;
      
      if (config.showDebug) {
        setDebugInfo({
          fps: performanceRef.current.fps,
          dataLength: visualData.data ? visualData.data.length : 0,
          peak: visualData.peak ? visualData.peak.toFixed(3) : '0.000'
        });
      }
    }
  }, [type, resolvedColor, config, isVisible]);

  // ⚡ Store drawFrame in ref to avoid re-subscription
  const drawFrameRef = useRef(drawFrame);
  useEffect(() => {
    drawFrameRef.current = drawFrame;
  }, [drawFrame]);

  useEffect(() => {
    if (!meterId) return;

    const handleData = (visualData) => {
      // Veri format kontrolü
      if (!visualData || typeof visualData !== 'object') {
        return;
      }

      // Veri yapısını normalize et
      const normalizedData = {
        data: visualData.data || visualData || [],
        peak: visualData.peak || 0,
        timestamp: visualData.timestamp || Date.now(),
        type: visualData.type || type
      };

      // Use ref to get latest drawFrame without re-subscribing
      drawFrameRef.current(normalizedData);
    };

    const unsubscribe = MeteringService.subscribe(meterId, handleData, {
      type: type === 'spectrum' ? 'spectrum' : 'waveform',
      smooth: config.smooth !== false,
      smoothingFactor: config.smoothingFactor || 0.15
    });

    return unsubscribe;
  }, [meterId, type, config.smooth, config.smoothingFactor]);

  // Visibility observer for performance
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );

    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <div className={`signal-visualizer-container ${className}`} style={style}>
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {config.showDebug && debugInfo && (
        <div style={{
          position: 'absolute',
          top: 4,
          right: 4,
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '4px 8px',
          fontSize: '10px',
          borderRadius: '4px',
          fontFamily: 'monospace'
        }}>
          FPS: {debugInfo.fps} | Peak: {debugInfo.peak} | Len: {debugInfo.dataLength}
        </div>
      )}
    </div>
  );
};