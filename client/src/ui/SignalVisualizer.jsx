import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MeteringService } from '../lib/core/MeteringService';

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
    
    // Gradient oluştur
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, color + '80');
    gradient.addColorStop(0.5, color + 'CC');
    gradient.addColorStop(1, color);
    
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
  
  // Performance monitoring
  const performanceRef = useRef({
    frameCount: 0,
    lastFpsUpdate: 0,
    fps: 0
  });

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
        const y = (i / 4) * rect.height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }
      
      ctx.setLineDash([]);
    }

    // Ana çizim
    const drawConfig = {
      width: rect.width,
      height: rect.height,
      color,
      ...config
    };

    if (drawingModes[type]) {
      drawingModes[type](ctx, visualData, drawConfig);
    }

    // Peak indicator
    if (config.showPeak && visualData.peak > 0.1) {
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
          dataLength: visualData.data.length,
          peak: visualData.peak.toFixed(3)
        });
      }
    }
  }, [type, color, config, isVisible]);

  useEffect(() => {
    if (!meterId) return;

    const handleData = (visualData) => {
      drawFrame(visualData);
    };

    const unsubscribe = MeteringService.subscribe(meterId, handleData, {
      type: type === 'spectrum' ? 'spectrum' : 'waveform',
      smooth: config.smooth !== false,
      smoothingFactor: config.smoothingFactor || 0.15
    });

    return unsubscribe;
  }, [meterId, drawFrame, type, config.smooth, config.smoothingFactor]);

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
          borderRadius: '4px'
        }}>
          FPS: {debugInfo.fps} | Peak: {debugInfo.peak}
        </div>
      )}
    </div>
  );
};