/**
 * WaveformDisplay - Simplified interactive audio waveform renderer
 * Features: Pan/zoom, loop markers with mode toolbar
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Move, Repeat } from 'lucide-react';
import { globalStyleCache } from '../../../lib/rendering/StyleCache';
import './WaveformDisplay.css';

const WaveformDisplay = ({
  audioBuffer,
  currentTime = 0,
  isPlaying = false,
  onSeek,
  height = 120,
  // Loop features
  onLoopChange,
  loopStart = 0,
  loopEnd = 1,
  showRMS = false,
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [themeVersion, setThemeVersion] = useState(0);

  // Interaction mode: 'pan' or 'loop'
  const [mode, setMode] = useState('pan');

  // Loop marker dragging
  const [draggingMarker, setDraggingMarker] = useState(null); // 'loopStart' | 'loopEnd'

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [lastMouseX, setLastMouseX] = useState(0);

  // ===== UTILITY FUNCTIONS =====

  // Convert mouse X position to normalized audio position (0-1)
  const mouseXToNormalized = useCallback((mouseX, canvasWidth) => {
    if (!audioBuffer) return 0;

    const totalSamples = audioBuffer.getChannelData(0).length;
    const viewStart = Math.floor(offsetX * totalSamples);
    const viewSamples = totalSamples / zoom;
    const mousePosition = (mouseX / canvasWidth) * viewSamples + viewStart;
    return Math.max(0, Math.min(1, mousePosition / totalSamples));
  }, [audioBuffer, zoom, offsetX]);

  // Convert normalized position (0-1) to canvas X coordinate
  const normalizedToCanvasX = useCallback((normalized, canvasWidth) => {
    if (!audioBuffer) return 0;

    const totalSamples = audioBuffer.getChannelData(0).length;
    const viewStart = Math.floor(offsetX * totalSamples);
    const viewSamples = totalSamples / zoom;
    const position = normalized * totalSamples;
    return ((position - viewStart) / viewSamples) * canvasWidth;
  }, [audioBuffer, zoom, offsetX]);

  // Get mouse position relative to canvas with sub-pixel accuracy
  const getMousePosition = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };

    const rect = canvas.getBoundingClientRect();

    // High-precision mouse position
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    return {
      x,
      y,
      width: rect.width,
      height: rect.height
    };
  }, []);

  // Check if mouse is near a loop marker (returns marker type or null)
  const getMarkerAtPosition = useCallback((mouseX, canvasWidth, threshold = 12) => {
    if (!audioBuffer || mode !== 'loop') return null;

    const markers = [
      { type: 'loopStart', pos: loopStart },
      { type: 'loopEnd', pos: loopEnd },
    ];

    // Check in priority order (closest first)
    let closestMarker = null;
    let closestDistance = threshold;

    for (const marker of markers) {
      const markerX = normalizedToCanvasX(marker.pos, canvasWidth);
      const distance = Math.abs(mouseX - markerX);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestMarker = marker.type;
      }
    }

    return closestMarker;
  }, [audioBuffer, mode, loopStart, loopEnd, normalizedToCanvasX]);

  // Theme change listener
  useEffect(() => {
    const handleThemeChange = () => {
      setThemeVersion(v => v + 1);
    };

    window.addEventListener('themeChanged', handleThemeChange);
    return () => window.removeEventListener('themeChanged', handleThemeChange);
  }, []);

  // Advanced waveform rendering with RMS, peaks, and regions
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get theme colors
    const bgColor = globalStyleCache.get('--zenith-bg-tertiary') || '#252525';
    const waveColor = globalStyleCache.get('--zenith-accent-cool') || '#6B8EBF';
    const centerLineColor = globalStyleCache.get('--zenith-border-subtle') || '#3a3a3a';
    const playheadColor = globalStyleCache.get('--zenith-accent-warm') || '#FFB74D';
    const loopColor = globalStyleCache.get('--zenith-accent-warm') || '#FFB74D';

    // Get RGB values for gradient
    let accentCoolRgb = globalStyleCache.get('--zenith-accent-cool-rgb') || '107, 142, 191';
    let accentWarmRgb = globalStyleCache.get('--zenith-accent-warm-rgb') || '255, 183, 77';

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Get audio data
    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;
    const viewStart = Math.floor(offsetX * totalSamples);
    const viewEnd = Math.min(viewStart + totalSamples / zoom, totalSamples);
    const viewSamples = viewEnd - viewStart;
    const samplesPerPixel = Math.max(1, Math.floor(viewSamples / width));

    // Calculate loop marker positions
    const loopStartX = ((loopStart * totalSamples - viewStart) / viewSamples) * width;
    const loopEndX = ((loopEnd * totalSamples - viewStart) / viewSamples) * width;

    // Draw loop region background (only in loop mode)
    if (mode === 'loop') {
      ctx.fillStyle = `rgba(${accentWarmRgb}, 0.1)`;
      ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, height);
    }

    // Center line
    ctx.strokeStyle = centerLineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const amp = height / 2;

    // Calculate waveform data (peaks and RMS)
    const peaksData = [];
    const rmsData = [];

    for (let i = 0; i < width; i++) {
      const start = viewStart + Math.floor((i / width) * viewSamples);
      const end = Math.min(start + samplesPerPixel, viewEnd);

      let min = 1.0;
      let max = -1.0;
      let sumSquares = 0;
      let count = 0;

      for (let j = start; j < end; j++) {
        if (j >= totalSamples) break;
        const sample = channelData[j];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
        sumSquares += sample * sample;
        count++;
      }

      peaksData.push({ min, max });

      if (showRMS && count > 0) {
        const rms = Math.sqrt(sumSquares / count);
        rmsData.push(rms);
      }
    }

    // Draw RMS envelope (if enabled)
    if (showRMS && rmsData.length > 0) {
      ctx.fillStyle = `rgba(${accentCoolRgb}, 0.2)`;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);

      for (let i = 0; i < width; i++) {
        const rms = rmsData[i] || 0;
        const y = height / 2 - (rms * amp);
        if (i === 0) {
          ctx.moveTo(i, y);
        } else {
          ctx.lineTo(i, y);
        }
      }

      for (let i = width - 1; i >= 0; i--) {
        const rms = rmsData[i] || 0;
        const y = height / 2 + (rms * amp);
        ctx.lineTo(i, y);
      }

      ctx.closePath();
      ctx.fill();
    }

    // Draw peaks waveform
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${accentCoolRgb}, 0.6)`);
    gradient.addColorStop(0.5, `rgba(${accentCoolRgb}, 0.3)`);
    gradient.addColorStop(1, `rgba(${accentCoolRgb}, 0.6)`);

    ctx.fillStyle = gradient;
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, height / 2);

    // Top envelope
    for (let i = 0; i < peaksData.length; i++) {
      const yMax = (1 + peaksData[i].max) * amp;
      if (i === 0) {
        ctx.moveTo(i, yMax);
      } else {
        ctx.lineTo(i, yMax);
      }
    }

    // Bottom envelope
    for (let i = peaksData.length - 1; i >= 0; i--) {
      const yMin = (1 + peaksData[i].min) * amp;
      ctx.lineTo(i, yMin);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw loop markers (only in loop mode for clarity)
    if (mode === 'loop') {
      if (loopStartX >= 0 && loopStartX <= width) {
        ctx.strokeStyle = loopColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(loopStartX, 0);
        ctx.lineTo(loopStartX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Loop start handle
        ctx.fillStyle = loopColor;
        ctx.fillRect(loopStartX - 4, 0, 8, 20);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('L', loopStartX - 3, 12);
      }

      if (loopEndX >= 0 && loopEndX <= width) {
        ctx.strokeStyle = loopColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(loopEndX, 0);
        ctx.lineTo(loopEndX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Loop end handle
        ctx.fillStyle = loopColor;
        ctx.fillRect(loopEndX - 4, 0, 8, 20);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('R', loopEndX - 3, 12);
      }
    }

    // Draw playhead
    if (audioBuffer.duration > 0) {
      const playheadX = ((currentTime / audioBuffer.duration) * totalSamples - viewStart) / viewSamples * width;

      if (playheadX >= 0 && playheadX <= width) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = playheadColor;
        ctx.strokeStyle = playheadColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

  }, [audioBuffer, currentTime, zoom, offsetX, themeVersion, loopStart, loopEnd, showRMS, mode]);

  // Handle canvas resize
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const resize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      setThemeVersion(v => v + 1); // Trigger redraw
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [height]);

  // Mouse interaction handlers
  const handleMouseDown = useCallback((e) => {
    if (!audioBuffer) return;

    const { x, width } = getMousePosition(e);
    setLastMouseX(x);

    if (mode === 'loop') {
      // Check if clicking on loop marker
      const markerType = getMarkerAtPosition(x, width);
      if (markerType) {
        setDraggingMarker(markerType);
        return;
      }
    } else if (mode === 'pan') {
      // Start panning
      setIsPanning(true);
      setPanStartX(x);
    }
  }, [audioBuffer, mode, getMousePosition, getMarkerAtPosition]);

  const handleMouseMove = useCallback((e) => {
    if (!audioBuffer) return;

    const { x, width } = getMousePosition(e);
    const mouseNormalized = mouseXToNormalized(x, width);

    // Handle dragging loop markers
    if (draggingMarker && mode === 'loop') {
      const clampedPosition = Math.max(0, Math.min(1, mouseNormalized));

      if (draggingMarker === 'loopStart' && onLoopChange) {
        onLoopChange(clampedPosition, loopEnd);
      } else if (draggingMarker === 'loopEnd' && onLoopChange) {
        onLoopChange(loopStart, clampedPosition);
      }
    }
    // Handle panning
    else if (isPanning && mode === 'pan') {
      const delta = (x - panStartX) / width;
      const newOffset = Math.max(0, Math.min(1 - 1/zoom, offsetX - delta / zoom));
      setOffsetX(newOffset);
      setPanStartX(x);
    }

    // Update cursor based on mode and position
    const canvas = canvasRef.current;

    if (mode === 'loop') {
      const markerType = getMarkerAtPosition(x, width);
      canvas.style.cursor = markerType ? 'ew-resize' : 'default';
    } else if (mode === 'pan') {
      canvas.style.cursor = isPanning ? 'grabbing' : 'grab';
    }

    setLastMouseX(x);
  }, [audioBuffer, mode, zoom, offsetX, draggingMarker, isPanning, panStartX, loopStart, loopEnd, getMousePosition, mouseXToNormalized, getMarkerAtPosition, onLoopChange]);

  const handleMouseUp = useCallback(() => {
    if (draggingMarker) {
      setDraggingMarker(null);
    }
    if (isPanning) {
      setIsPanning(false);
    }
  }, [draggingMarker, isPanning]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    if (!audioBuffer) return;
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(100, zoom * delta));

    // Zoom towards mouse position
    const { x, width } = getMousePosition(e);
    const mousePos = x / width;
    const oldViewWidth = 1 / zoom;
    const newViewWidth = 1 / newZoom;
    const centerPos = offsetX + mousePos * oldViewWidth;
    const newOffset = Math.max(0, Math.min(1 - newViewWidth, centerPos - mousePos * newViewWidth));

    setZoom(newZoom);
    setOffsetX(newOffset);
  }, [audioBuffer, zoom, offsetX, getMousePosition]);

  // Mouse event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleWheel]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const newZoom = Math.max(prev / 1.5, 1);
      if (newZoom === 1) {
        setOffsetX(0); // Reset pan when fully zoomed out
      }
      return newZoom;
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setOffsetX(0);
  };

  if (!audioBuffer) {
    return (
      <div className="waveform-display waveform-display--empty">
        <div className="waveform-display__empty-message">
          No audio loaded
        </div>
      </div>
    );
  }

  const duration = audioBuffer.duration;
  const formatTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="waveform-display">
      {/* Toolbar */}
      <div className="waveform-display__toolbar">
        <div className="waveform-display__mode-buttons">
          <button
            className={`waveform-display__mode-btn ${mode === 'pan' ? 'waveform-display__mode-btn--active' : ''}`}
            onClick={() => setMode('pan')}
            title="Pan/Zoom Mode - Drag to pan, wheel to zoom"
          >
            <Move size={16} />
            <span>Pan/Zoom</span>
          </button>
          <button
            className={`waveform-display__mode-btn ${mode === 'loop' ? 'waveform-display__mode-btn--active' : ''}`}
            onClick={() => setMode('loop')}
            title="Loop Edit Mode - Drag L/R markers to set loop points"
          >
            <Repeat size={16} />
            <span>Loop Edit</span>
          </button>
        </div>

        <div className="waveform-display__info">
          <span className="waveform-display__zoom-level">
            Zoom: {Math.round(zoom * 100)}%
          </span>
          <span className="waveform-display__details">
            {audioBuffer.numberOfChannels}ch • {audioBuffer.sampleRate}Hz
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="waveform-display__canvas-container">
        <canvas
          ref={canvasRef}
          className="waveform-display__canvas"
        />
        <div className="waveform-display__mode-indicator">
          {mode === 'pan' && '🖱️ Drag to pan • Wheel to zoom'}
          {mode === 'loop' && '🔁 Drag L/R markers to set loop points'}
        </div>
      </div>

      {/* Footer */}
      <div className="waveform-display__footer">
        <div className="waveform-display__footer-hint">
          <span className="waveform-display__time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        {zoom > 1 && (
          <button className="waveform-display__reset-btn" onClick={handleResetView}>
            Reset View
          </button>
        )}
      </div>
    </div>
  );
};

export default WaveformDisplay;
