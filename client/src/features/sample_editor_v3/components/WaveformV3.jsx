// WaveformV3.jsx - Orantılı Dalga Formu Düzeltmesi
import React, { useRef, useEffect, useState, useCallback } from 'react';

export const WaveformV3 = ({ 
  buffer, 
  onSliceCreate, 
  onEnvelopeChange, 
  playPosition = 0,
  isPlaying = false,
  selectedRegion = null,
  tools = { slice: false, envelope: false, select: true }
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  
  const [dimensions, setDimensions] = useState({ width: 0, height: 200 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [selection, setSelection] = useState(null);
  const [sliceMarkers, setSliceMarkers] = useState([]);

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
    
    // Selection çiz
    if (selection) {
      renderSelection(ctx, selection, width, height, actualSampleRatio);
    }
    
    // Slice markers çiz
    renderSliceMarkers(ctx, sliceMarkers, width, height, offset, zoom, actualSampleRatio);
    
    // Playhead çiz
    if (isPlaying && playPosition >= 0) {
      renderPlayhead(ctx, playPosition, width, height, offset, zoom, actualSampleRatio);
    }

    // Tools overlay çiz
    renderToolsOverlay(ctx, width, height, tools);

  }, [dimensions, zoom, offset, selection, sliceMarkers, playPosition, isPlaying, tools]);

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
  const renderSelection = (ctx, selection, width, height, sampleRatio) => {
    const { start, end } = selection;
    const actualWidth = width * sampleRatio;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(start * actualWidth, 0, (end - start) * actualWidth, height);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(start * actualWidth, 0);
    ctx.lineTo(start * actualWidth, height);
    ctx.moveTo(end * actualWidth, 0);
    ctx.lineTo(end * actualWidth, height);
    ctx.stroke();
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
  const handleMouseDown = (e) => {
    if (!waveformDataRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / dimensions.width;
    const { actualSampleRatio } = waveformDataRef.current;
    
    // Sadece sample alanı içinde tıklama kabul et
    if (x > actualSampleRatio) return;
    
    const position = (offset + (x / zoom)) / actualSampleRatio;
    
    setIsDragging(true);
    setDragStart({ x, position });

    if (tools.slice) {
      setSliceMarkers(prev => [...prev, { 
        id: Date.now(), 
        position: position,
        time: position * waveformDataRef.current.duration 
      }]);
      onSliceCreate?.(position);
    } else if (tools.select) {
      setSelection({ start: position, end: position });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart || !waveformDataRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / dimensions.width;
    const { actualSampleRatio } = waveformDataRef.current;
    const position = (offset + (x / zoom)) / actualSampleRatio;
    
    if (tools.select && selection) {
      setSelection(prev => ({
        ...prev,
        end: position
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
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

  return (
    <div className="waveform-v3-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="waveform-v3-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Eğer mouse dışarı çıkarsa sürüklemeyi bitir
        style={{ 
          cursor: tools.slice ? 'crosshair' : tools.select ? 'text' : 'pointer',
          display: 'block',
          maxWidth: '100%'
        }}
      />
      
      {/* Debug/Info panel */}
      {waveformDataRef.current && (
        <div style={{ 
          position: 'absolute', 
          top: '8px', 
          right: '8px', 
          background: 'rgba(0,0,0,0.8)', 
          color: 'white', 
          padding: '4px 8px', 
          borderRadius: '4px',
          fontSize: '11px',
          fontFamily: 'monospace'
        }}>
          {waveformDataRef.current.duration.toFixed(2)}s | 
          Zoom: {zoom.toFixed(1)}x |
          Ratio: {waveformDataRef.current.actualSampleRatio.toFixed(3)} |
          Slices: {sliceMarkers.length}
        </div>
      )}
      
      {!buffer && (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          color: '#888888'
        }}>
          Dalga formu yükleniyor...
        </div>
      )}
    </div>
  );
};