import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';

// Hex renk kodunu RGBA formatına çeviren yardımcı fonksiyon
const hexToRgba = (hex, alpha) => {
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      return `rgba(59, 130, 246, ${alpha})`; // Geçersiz hex için varsayılan renk
  }
  let c = hex.substring(1).split('');
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  c = '0x' + c.join('');
  return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')},${alpha})`;
};

const WaveEnvelopeEditor = ({ buffer, envelope, onEnvelopeChange }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [draggedPoint, setDraggedPoint] = useState(null);
  const [hoverPoint, setHoverPoint] = useState(null);
  const animationFrameId = useRef(null);

  // Konteyner boyutunu izleyerek canvas'ı responsive yap
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const envelopeToPoints = useCallback(() => {
    const { width, height } = dims;
    if (width === 0 || height === 0) return null;
    
    const padding = 25;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;
    // Sustain için 1 saniyelik sanal bir süre ekleyerek daha dengeli bir zarf çizimi sağlıyoruz
    const totalTime = Math.max(1, envelope.attack + envelope.decay + 1 + envelope.release);
    
    const attackX = padding + (envelope.attack / totalTime) * graphWidth;
    const decayX = attackX + (envelope.decay / totalTime) * graphWidth;
    const sustainX = decayX + (1 / totalTime) * graphWidth;
    const releaseX = width - padding;

    return {
      points: {
        start: { x: padding, y: height - padding },
        attack: { x: attackX, y: padding },
        decay: { x: decayX, y: padding + (1 - envelope.sustain) * graphHeight },
        sustain: { x: sustainX, y: padding + (1 - envelope.sustain) * graphHeight },
        release: { x: releaseX, y: height - padding },
      },
      meta: { totalTime, padding, graphWidth, graphHeight }
    };
  }, [dims, envelope]);
  
  const pointsToEnvelope = useCallback((points, meta) => {
    const { totalTime, padding, graphWidth, graphHeight } = meta;
    
    const attackTime = ((points.attack.x - padding) / graphWidth) * totalTime;
    const decayTime = ((points.decay.x - points.attack.x) / graphWidth) * totalTime;
    const sustainLevel = 1 - ((points.decay.y - padding) / graphHeight);
    const releaseTime = ((points.release.x - points.sustain.x) / graphWidth) * totalTime;

    return {
      attack: Math.max(0.001, attackTime),
      decay: Math.max(0.001, decayTime),
      sustain: Math.max(0, Math.min(1, sustainLevel)),
      release: Math.max(0.001, releaseTime)
    };
  }, []);

  useEffect(() => {
    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas || !buffer || dims.width === 0) return;
        const { width, height } = dims;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const themePrimaryColor = getComputedStyle(canvas).getPropertyValue('--color-primary').trim();
        
        ctx.fillStyle = 'var(--color-background)';
        ctx.fillRect(0, 0, width, height);
        
        const audioData = buffer.getChannelData(0);
        const step = Math.ceil(audioData.length / width);
        const amp = height / 2;
        
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'var(--color-muted)';
        ctx.beginPath();
        for (let i = 0; i < width; i++) {
            let min = 1.0, max = -1.0;
            for (let j = 0; j < step; j++) {
            const datum = audioData[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
            }
            ctx.moveTo(i, (1 + min) * amp);
            ctx.lineTo(i, (1 + max) * amp);
        }
        ctx.stroke();

        const pointsData = envelopeToPoints();
        if (!pointsData) return;
        const { points } = pointsData;

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, hexToRgba(themePrimaryColor, 0.3));
        gradient.addColorStop(1, hexToRgba(themePrimaryColor, 0.0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        Object.values(points).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'var(--color-primary)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        Object.values(points).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();

        Object.entries(points).forEach(([key, p]) => {
            if (key === 'start' || key === 'release') return;
            ctx.beginPath();
            ctx.arc(p.x, p.y, draggedPoint === key || hoverPoint === key ? 10 : 8, 0, Math.PI * 2);
            ctx.fillStyle = draggedPoint === key ? 'var(--color-accent)' : 'var(--color-primary)';
            ctx.shadowColor = draggedPoint === key ? 'var(--color-accent)' : 'var(--color-primary)';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'var(--color-background)';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    };
    
    animationFrameId.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [buffer, envelope, dims, draggedPoint, hoverPoint, envelopeToPoints]);
  
  const getPointAtPosition = useCallback((x, y) => {
    const pointsData = envelopeToPoints();
    if (!pointsData) return null;
    const { points } = pointsData;
    let closestPoint = null;
    let minDistance = 20;

    Object.entries(points).forEach(([key, p]) => {
      if (key === 'start' || key === 'release') return;
      const distance = Math.hypot(x - p.x, y - p.y);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = key;
      }
    });
    return closestPoint;
  }, [envelopeToPoints]);

  const handleInteraction = useCallback((clientX, clientY, type) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (type === 'start') {
      const point = getPointAtPosition(x, y);
      if (point) {
          setDraggedPoint(point);
          canvas.style.cursor = 'grabbing';
      }
    } else if (type === 'move') {
      const pointsData = envelopeToPoints();
      if (!pointsData) return;
      
      if (draggedPoint) {
        let { points, meta } = pointsData;
        let newX = Math.max(meta.padding, Math.min(dims.width - meta.padding, x));
        let newY = Math.max(meta.padding, Math.min(dims.height - meta.padding, y));

        if (draggedPoint === 'attack') {
            points.attack.x = Math.min(newX, points.decay.x - 1);
        } else if (draggedPoint === 'decay') {
            points.decay.x = Math.max(points.attack.x + 1, newX);
            points.decay.y = newY;
            points.sustain.y = newY;
        } else if (draggedPoint === 'sustain') {
            points.sustain.x = Math.max(points.decay.x + 1, newX);
        }
        
        onEnvelopeChange(pointsToEnvelope(points, meta));
      } else {
        const point = getPointAtPosition(x, y);
        setHoverPoint(point);
        canvas.style.cursor = point ? 'grab' : 'default';
      }
    } else if (type === 'end') {
      setDraggedPoint(null);
      canvas.style.cursor = 'default';
    }
  }, [dims, draggedPoint, getPointAtPosition, envelopeToPoints, pointsToEnvelope, onEnvelopeChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const handleMove = e => handleInteraction(e.clientX, e.clientY, 'move');
    const handleEnd = () => handleInteraction(null, null, 'end');
    const handleTouchMove = e => { e.preventDefault(); handleInteraction(e.touches[0].clientX, e.touches[0].clientY, 'move'); };
    
    if (draggedPoint) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    }
  }, [draggedPoint, handleInteraction]);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={e => { e.preventDefault(); handleInteraction(e.clientX, e.clientY, 'start'); }}
        onMouseMove={e => handleInteraction(e.clientX, e.clientY, 'move')}
        onTouchStart={e => { e.preventDefault(); handleInteraction(e.touches[0].clientX, e.touches[0].clientY, 'start'); }}
      />
    </div>
  );
};

export default WaveEnvelopeEditor;