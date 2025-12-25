// WaveformV3.jsx - Orantılı Dalga Formu Düzeltmesi
import React, { useRef, useEffect, useState, useCallback } from 'react';

export const WaveformV3 = ({ 
  buffer, 
  onSliceCreate, 
  onEnvelopeChange, 
  onSelectionChange,
  onRegionChange,
  regionControls = null,
  playPosition = 0,
  isPlaying = false,
  selectedRegion = null,
  tools = { slice: false, envelope: false, select: true, loop: false },
  isReadOnly = false
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 200 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selection, setSelection] = useState(selectedRegion);
  const [sliceMarkers, setSliceMarkers] = useState([]);
  const [dragMode, setDragMode] = useState(null); // 'selection' | 'start' | 'end' | 'loopStart' | 'loopEnd'
  const [dragValue, setDragValue] = useState(null);
  const [hoverHandle, setHoverHandle] = useState(null);

  useEffect(() => {
    if (!selectedRegion) {
      setSelection(null);
      return;
    }
    setSelection(selectedRegion);
  }, [selectedRegion?.start, selectedRegion?.end, selectedRegion?.type]);

  const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const dragLabels = {
    start: 'Start',
    end: 'End',
    loopStart: 'Loop Start',
    loopEnd: 'Loop End'
  };
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '0.00s';
    if (seconds >= 1) return `${seconds.toFixed(2)}s`;
    return `${Math.round(seconds * 1000)}ms`;
  };
  const detectHandleAtPosition = useCallback((position) => {
    if (!regionControls) return null;
    const threshold = 0.01;
    const handles = [];
    const push = (value, label) => {
      if (typeof value === 'number') {
        handles.push({ value: clamp01(value), label });
      }
    };
    push(regionControls.start, 'start');
    push(regionControls.end, 'end');
    push(regionControls.loopStart, 'loopStart');
    push(regionControls.loopEnd, 'loopEnd');

    const match = handles.find(entry => Math.abs(position - entry.value) <= threshold);
    return match?.label || null;
  }, [regionControls]);


  // Performans optimizasyonu: Waveform data cache
  const waveformDataRef = useRef(null);

  // Container boyutlarını takip et
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height }); // Math.max kaldırıldı
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Waveform data preprocessing (sadece buffer değiştiğinde)
  useEffect(() => {
    if (!buffer) {
      waveformDataRef.current = null;
      return;
    }

    const audioBuffer = buffer.get ? buffer.get() : buffer;
    if (!(audioBuffer instanceof AudioBuffer)) return;

    console.log('📊 Waveform data preprocessing...');
    const startTime = performance.now();
    
    // ÖNEMLİ: Fixed resolution - sample uzunluğuna bağlı değil
    const channelData = audioBuffer.getChannelData(0);
    const targetWidth = Math.max(dimensions.width * 4, 4096); // Yüksek çözünürlük
    const samplesPerPixel = Math.ceil(channelData.length / targetWidth);
    
    const waveformData = [];
    for (let i = 0; i < targetWidth; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);
      
      if (start >= channelData.length) {
        // Sample bitti, geri kalan kısım sessizlik
        waveformData.push({ min: 0, max: 0, rms: 0 });
        continue;
      }
      
      let min = 1, max = -1, sum = 0;
      for (let j = start; j < end; j++) {
        const sample = channelData[j];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
        sum += Math.abs(sample);
      }
      
      waveformData.push({
        min,
        max,
        rms: sum / (end - start)
      });
    }
    
    waveformDataRef.current = {
      data: waveformData,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      length: audioBuffer.length,
      // YENİ: Gerçek sample uzunluğu oranı
      actualSampleRatio: channelData.length / (targetWidth * samplesPerPixel)
    };
    
    console.log(`✅ Preprocessing tamamlandı (${(performance.now() - startTime).toFixed(2)}ms)`);
    console.log(`📏 Sample ratio: ${waveformDataRef.current.actualSampleRatio.toFixed(3)}`);
  }, [buffer, dimensions.width]);

  // Ana rendering fonksiyonu - ORANTILI GÖSTERIM
  const renderWaveform = useCallback(() => {
    if (!canvasRef.current || !waveformDataRef.current || dimensions.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    
    // High DPI desteği
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    // Temadan renkleri al
    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primary').trim() || '#FFD700';
    const backgroundColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-background').trim() || '#1a1a1a';
    const surfaceColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-surface').trim() || '#242424';

    // Arkaplanı temizle
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const waveformData = waveformDataRef.current.data;
    const { actualSampleRatio } = waveformDataRef.current;

    // ÖNEMLİ: Gerçek sample uzunluğuna göre render genişliği
    const actualSampleWidth = width * actualSampleRatio * zoom;
    const visibleStart = Math.floor(offset * waveformData.length);
    const visibleEnd = Math.min(
      Math.ceil(visibleStart + (waveformData.length * actualSampleRatio / zoom)), 
      waveformData.length
    );

    // Grid çiz (tam canvas genişliğinde)
    renderGrid(ctx, width, height, surfaceColor);

    // Waveform çiz (sadece sample uzunluğu kadar)
    if (actualSampleWidth > 0) {
      renderWaveformPath(ctx, waveformData, visibleStart, visibleEnd, actualSampleWidth, height, primaryColor, actualSampleRatio);
      
      // RMS envelope çiz (opsiyonel)
      if (tools.envelope) {
        renderRMSEnvelope(ctx, waveformData, visibleStart, visibleEnd, actualSampleWidth, height, primaryColor, actualSampleRatio);
      }
    }

    // Boş alan gösterimi (sample sonrasındaki alan)
    if (actualSampleWidth < width) {
      ctx.fillStyle = 'rgba(64, 64, 64, 0.3)';
      ctx.fillRect(actualSampleWidth, 0, width - actualSampleWidth, height);
      
      // "Sample bitti" çizgisi
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(actualSampleWidth, 0);
      ctx.lineTo(actualSampleWidth, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Trim ve loop overlay çizimleri
    const interactiveHandle = ['start', 'end', 'loopStart', 'loopEnd'].includes(dragMode)
      ? dragMode
      : hoverHandle;
    const trimHandleFocus = interactiveHandle && (interactiveHandle === 'start' || interactiveHandle === 'end')
      ? interactiveHandle
      : null;
    const loopHandleFocus = interactiveHandle && (interactiveHandle === 'loopStart' || interactiveHandle === 'loopEnd')
      ? interactiveHandle
      : null;

    if (regionControls) {
      const trimRegion = {
        start: clamp01(regionControls.start ?? 0),
        end: clamp01(regionControls.end ?? 1),
        type: 'trim'
      };
      renderSelection(ctx, trimRegion, width, height, actualSampleRatio, trimHandleFocus);

      if (regionControls.loopEnabled) {
        const loopRegion = {
          start: clamp01(regionControls.loopStart ?? trimRegion.start),
          end: clamp01(regionControls.loopEnd ?? trimRegion.end),
          type: 'loop'
        };
        renderSelection(ctx, loopRegion, width, height, actualSampleRatio, loopHandleFocus);
      }
    }

    // Kullanıcı seçimi
    if (selection) {
      renderSelection(ctx, selection, width, height, actualSampleRatio, null);
    }
    
    // Slice markers çiz
    renderSliceMarkers(ctx, sliceMarkers, width, height, offset, zoom, actualSampleRatio);
    
    // Playhead çiz
    if (isPlaying && playPosition >= 0) {
      renderPlayhead(ctx, playPosition, width, height, offset, zoom, actualSampleRatio);
    }

    // Tools overlay çiz
    renderToolsOverlay(ctx, width, height, tools);

  }, [dimensions, zoom, offset, selection, sliceMarkers, playPosition, isPlaying, tools, regionControls, dragMode, hoverHandle]);

  // Waveform path rendering (orantılı genişlik ile)
  const renderWaveformPath = (ctx, data, start, end, renderWidth, height, color, sampleRatio) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    // DÜZELTME: Amplitude'ü küçültüyoruz (0.4 -> 0.25)
    const amp = height * 0.45; // Önceden 0.4 idi, şimdi 0.25
    const centerY = height / 2;
    const step = (end - start) / renderWidth;

    for (let x = 0; x < renderWidth; x++) {
        const dataIndex = Math.floor(start + x * step);
        if (dataIndex >= data.length) break;
        
        const { min, max } = data[dataIndex];
        const yMin = centerY - (min * amp);
        const yMax = centerY - (max * amp);

        if (x === 0) {
        ctx.moveTo(x, yMax);
        } else {
        ctx.lineTo(x, yMax);
        }
        
        if (Math.abs(yMax - yMin) > 1) {
        ctx.lineTo(x, yMin);
        ctx.lineTo(x, yMax);
        }
    }
    ctx.stroke();
  };

  const renderRMSEnvelope = (ctx, data, start, end, renderWidth, height, color, sampleRatio) => {
  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();

  // DÜZELTME: RMS envelope'i de küçültüyoruz (0.3 -> 0.2)
  const amp = height * 0.2; // Önceden 0.3 idi, şimdi 0.2
  const centerY = height / 2;
  const step = (end - start) / renderWidth;

  for (let x = 0; x < renderWidth; x++) {
      const dataIndex = Math.floor(start + x * step);
      if (dataIndex >= data.length) break;
      
      const rms = data[dataIndex].rms;
      const y = centerY - (rms * amp);

      if (x === 0) {
      ctx.moveTo(x, y);
      } else {
      ctx.lineTo(x, y);
      }
  }
  ctx.stroke();
  };

  // Grid rendering - zaman işaretleri ile
  const renderGrid = (ctx, width, height, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([1, 3]);

    // Center line
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Quarter lines
    ctx.beginPath();
    ctx.moveTo(0, height / 4);
    ctx.lineTo(width, height / 4);
    ctx.moveTo(0, (3 * height) / 4);
    ctx.lineTo(width, (3 * height) / 4);
    ctx.stroke();

    // Zaman işaretleri (her saniye için)
    if (waveformDataRef.current) {
      const duration = waveformDataRef.current.duration;
      const secondsPerPixel = duration / width;
      
      ctx.strokeStyle = color;
      ctx.font = '10px monospace';
      ctx.fillStyle = color;
      
      for (let sec = 0; sec <= Math.ceil(duration); sec++) {
        const x = (sec / duration) * width;
        if (x < width) {
          ctx.beginPath();
          ctx.moveTo(x, height - 20);
          ctx.lineTo(x, height);
          ctx.stroke();
          
          // Zaman etiketi
          ctx.fillText(`${sec}s`, x + 2, height - 5);
        }
      }
    }

    ctx.setLineDash([]);
  };

  // Selection rendering (orantılı)
  const renderRegionHandle = (ctx, x, height, label, color, options = {}) => {
    const { isActive = false } = options;
    ctx.save();
    if (isActive) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = color;
    ctx.fillRect(x - 1, 0, 2, height);
    ctx.beginPath();
    ctx.moveTo(x - 6, height - 18);
    ctx.lineTo(x + 6, height - 18);
    ctx.lineTo(x, height - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = isActive ? '#000' : '#0b0b0b';
    ctx.font = '10px monospace';
    ctx.fillText(label, x - 18, height - 24);
    ctx.restore();
  };

  const selectionThemes = {
    trim: {
      fill: 'rgba(56, 255, 168, 0.24)',
      stroke: '#00FF88',
      labels: { start: 'Start', end: 'End' },
      handleKeys: { start: 'start', end: 'end' },
      showHandles: true,
      dash: []
    },
    loop: {
      fill: 'rgba(255, 181, 74, 0.22)',
      stroke: '#FF9900',
      labels: { start: 'Loop In', end: 'Loop Out' },
      handleKeys: { start: 'loopStart', end: 'loopEnd' },
      showHandles: true,
      dash: [6, 4]
    },
    selection: {
      fill: 'rgba(77, 172, 255, 0.18)',
      stroke: '#4DACFF',
      labels: { start: 'A', end: 'B' },
      showHandles: false,
      dash: [4, 4]
    }
  };

  const renderSelection = (ctx, selection, width, height, sampleRatio, activeHandle) => {
    if (!selection) return;
    const { start, end, type = 'selection' } = selection;
    const theme = selectionThemes[type] || selectionThemes.selection;
    const actualWidth = width * sampleRatio;
    const a = clamp01(start);
    const b = clamp01(end);
    const normalizedStart = Math.min(a, b);
    const normalizedEnd = Math.max(a, b);
    ctx.fillStyle = theme.fill;
    ctx.fillRect(normalizedStart * actualWidth, 0, (normalizedEnd - normalizedStart) * actualWidth, height);
    
    ctx.strokeStyle = theme.stroke;
    ctx.lineWidth = 1;
    if (theme.dash?.length) {
      ctx.setLineDash(theme.dash);
    }
    ctx.beginPath();
    ctx.moveTo(normalizedStart * actualWidth, 0);
    ctx.lineTo(normalizedStart * actualWidth, height);
    ctx.moveTo(normalizedEnd * actualWidth, 0);
    ctx.lineTo(normalizedEnd * actualWidth, height);
    ctx.stroke();
    ctx.setLineDash([]);

    if (theme.showHandles) {
      const handleKeys = theme.handleKeys || { start: 'start', end: 'end' };
      renderRegionHandle(
        ctx,
        normalizedStart * actualWidth,
        height,
        theme.labels.start,
        theme.stroke,
        { isActive: activeHandle === handleKeys.start }
      );
      renderRegionHandle(
        ctx,
        normalizedEnd * actualWidth,
        height,
        theme.labels.end,
        theme.stroke,
        { isActive: activeHandle === handleKeys.end }
      );
    }
  };

  // Slice markers rendering (orantılı)
  const renderSliceMarkers = (ctx, markers, width, height, offset, zoom, sampleRatio) => {
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2;
    
    const actualWidth = width * sampleRatio;
    
    markers.forEach(marker => {
      const x = ((marker.position - offset) * zoom) * actualWidth;
      if (x >= 0 && x <= actualWidth) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    });
  };

  // Playhead rendering (orantılı)
  const renderPlayhead = (ctx, position, width, height, offset, zoom, sampleRatio) => {
    const actualWidth = width * sampleRatio;
    const x = ((position - offset) * zoom) * actualWidth;
    
    if (x >= 0 && x <= actualWidth) {
      ctx.strokeStyle = '#00FF88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Playhead triangle
      ctx.fillStyle = '#00FF88';
      ctx.beginPath();
      ctx.moveTo(x - 6, 0);
      ctx.lineTo(x + 6, 0);
      ctx.lineTo(x, 12);
      ctx.closePath();
      ctx.fill();
    }
  };

  // Tools overlay rendering
  const renderToolsOverlay = (ctx, width, height, tools) => {
    if (tools.slice) {
      ctx.fillStyle = 'rgba(255, 68, 68, 0.1)';
      ctx.fillRect(0, 0, width, 20);
      ctx.fillStyle = '#FF4444';
      ctx.font = '12px monospace';
      ctx.fillText('SLICE MODE', 8, 15);
    }
  };

  // Mouse event handlers (orantılı hesaplama ile)
  const handlePointerDown = (e) => {
    if (!waveformDataRef.current || isReadOnly) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const xNorm = (e.clientX - rect.left) / dimensions.width;
    const { actualSampleRatio } = waveformDataRef.current;
    if (xNorm > actualSampleRatio) return;
    const position = (offset + (xNorm / zoom)) / actualSampleRatio;
    canvasRef.current?.setPointerCapture?.(e.pointerId);

    const handle = detectHandleAtPosition(position);
    if (handle) {
      const clamped = clamp01(position);
      setDragMode(handle);
      setHoverHandle(handle);
      setIsDragging(true);
      setDragValue(clamped);
      onRegionChange?.({ [handle]: clamped });
      return;
    }

    if (tools.slice) {
      setSliceMarkers(prev => [...prev, { 
        id: Date.now(), 
        position: position,
        time: position * waveformDataRef.current.duration 
      }]);
      onSliceCreate?.(position);
    } else if (tools.select) {
      const baseSelection = { start: position, end: position, type: 'selection' };
      setSelection(baseSelection);
      onSelectionChange?.(baseSelection);
      setIsDragging(true);
      setDragMode('selection');
    } else if (tools.loop) {
      const loopSelection = { start: position, end: position, type: 'loop' };
      setSelection(loopSelection);
      onSelectionChange?.(loopSelection);
      setIsDragging(true);
      setDragMode('loopSelection');
    }
  };

  const handlePointerMove = (e) => {
    if (!waveformDataRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const xNorm = (e.clientX - rect.left) / dimensions.width;
    const { actualSampleRatio } = waveformDataRef.current;
    const rawPosition = (offset + (xNorm / zoom)) / actualSampleRatio;
    if (xNorm > actualSampleRatio && !isDragging) {
      if (hoverHandle) {
        setHoverHandle(null);
      }
      return;
    }
    const position = rawPosition;

    if (!isDragging) {
      const nextHandle = detectHandleAtPosition(position);
      if (nextHandle !== hoverHandle) {
        setHoverHandle(nextHandle);
      }
      return;
    }

    if (dragMode === 'selection' || dragMode === 'loopSelection') {
      setSelection(prev => {
        if (!prev) return prev;
        const next = { ...prev, end: position, type: dragMode === 'loopSelection' ? 'loop' : 'selection' };
        onSelectionChange?.(next);
        return next;
      });
    } else if (dragMode && regionControls) {
      const nextValue = clamp01(position);
      setDragValue(nextValue);
      setHoverHandle(dragMode);
      onRegionChange?.({ [dragMode]: nextValue });
    }
  };

  const handlePointerUp = (e) => {
    if (e?.pointerId !== undefined) {
      canvasRef.current?.releasePointerCapture?.(e.pointerId);
    }
    setIsDragging(false);
    setDragMode(null);
    setDragValue(null);
    setHoverHandle(null);
  };

  const handleWheel = useCallback((e) => {
    e.preventDefault(); // Artık bu satır hata vermeyecek
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(1, Math.min(20, prev * zoomFactor)));
  }, []);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    // Olay dinleyicisini manuel olarak ve `passive: false` seçeneğiyle ekliyoruz
    canvasElement.addEventListener('wheel', handleWheel, { passive: false });

    // Component kaldırıldığında olay dinleyicisini temizliyoruz
    return () => {
      canvasElement.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]); // handleWheel değiştiğinde (aslında hiç değişmiyor) effect'i yeniden kur

  // Rendering trigger
  useEffect(() => {
    renderWaveform();
  }, [renderWaveform]);

  // Animation loop for smooth playhead
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        renderWaveform();
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, renderWaveform]);

  const waveformDuration = waveformDataRef.current?.duration || 0;
  const handleNames = ['start', 'end', 'loopStart', 'loopEnd'];
  const isHandleDrag = handleNames.includes(dragMode);
  const activeHandleLabel = isHandleDrag ? dragLabels[dragMode] : null;
  const activeHandleValue = isHandleDrag
    ? formatTime((dragValue ?? clamp01(regionControls?.[dragMode])) * waveformDuration)
    : null;
  const playbackWindowSeconds = regionControls
    ? (clamp01(regionControls.end ?? 1) - clamp01(regionControls.start ?? 0)) * waveformDuration
    : waveformDuration;
  let cursorStyle = 'text';
  if (isDragging) {
    if (isHandleDrag) {
      cursorStyle = 'ew-resize';
    } else if (dragMode === 'selection' || dragMode === 'loopSelection') {
      cursorStyle = 'grabbing';
    }
  } else if (hoverHandle && handleNames.includes(hoverHandle)) {
    cursorStyle = 'ew-resize';
  } else if (tools.slice) {
    cursorStyle = 'crosshair';
  } else if (tools.loop) {
    cursorStyle = 'alias';
  }

  return (
    <div className="waveform-v3-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="waveform-v3-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ 
          cursor: cursorStyle,
          display: 'block',
          maxWidth: '100%'
        }}
      />

      {isHandleDrag && (
        <div className="waveform-drag-hud">
          <span>{activeHandleLabel}</span>
          <strong>{activeHandleValue}</strong>
        </div>
      )}
      
      {waveformDataRef.current && (
        <div className="waveform-meta-overlay">
          <span>{waveformDuration.toFixed(2)}s total</span>
          <span>Window {formatTime(playbackWindowSeconds)}</span>
          <span>Zoom {zoom.toFixed(1)}x</span>
          <span>Slices {sliceMarkers.length}</span>
        </div>
      )}
      
      {!buffer && (
        <div className="waveform-loading">
          Dalga formu yükleniyor...
        </div>
      )}
    </div>
  );
};