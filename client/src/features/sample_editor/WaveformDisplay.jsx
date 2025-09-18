import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';

const WaveformDisplay = React.memo(function WaveformDisplay({ buffer, className, smpStart = 0, smpLength = 1 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  // --- LOGLAMA ---
  // Bu bileşene gelen 'buffer' prop'unun ne olduğunu kontrol edelim.
  // Eğer burada 'undefined' veya 'null' görüyorsak, sorun bu bileşene veri gönderen
  // üst bileşendedir (InstrumentEditor gibi).
  useEffect(() => {
    console.log("WaveformDisplay'e gelen buffer verisi:", buffer);
  }, [buffer]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Eğer buffer yoksa veya boyutlar sıfırsa, hiçbir şey çizme.
    if (!buffer || !canvasRef.current || dims.width === 0 || dims.height === 0) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.width * dpr;
    canvas.height = dims.height * dpr;
    context.scale(dpr, dpr);

    const data = buffer.getChannelData(0);
    const width = dims.width;
    const height = dims.height;
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    context.clearRect(0, 0, width, height);

    // Dalga formunu çiz
    context.lineWidth = 2;
    context.strokeStyle = '#38bdf8'; // cyan-400
    context.beginPath();
    context.moveTo(0, amp);
    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      const start = i * step;
      const end = Math.min(start + step, data.length);
      for (let j = start; j < end; j++) {
        const datum = data[j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      context.lineTo(i, (1 + min) * amp);
      context.lineTo(i, (1 + max) * amp);
    }
    context.stroke();
    
    /* Kesilmiş alanı göster
    context.fillStyle = 'rgba(17, 24, 39, 0.7)';
    const startPixel = smpStart * width;
    if (startPixel > 0) {
      context.fillRect(0, 0, startPixel, height);
    }
    const endPixel = (smpStart + smpLength) * width;
    if (endPixel < width) {
      context.fillRect(endPixel, 0, width - endPixel, height);
    }
    
    context.fillStyle = 'rgba(255, 255, 255, 0.7)';
    if (smpStart > 0) {
        context.fillRect(startPixel, 0, 1, height);
    }
    if (smpLength < 1) {
        context.fillRect(endPixel, 0, 1, height);
    }*/

  }, [buffer, dims]);

  return (
    <div ref={containerRef} className={className}>
      <canvas 
        ref={canvasRef} 
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
});

export default WaveformDisplay;
