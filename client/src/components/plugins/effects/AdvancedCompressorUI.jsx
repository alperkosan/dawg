import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '@/lib/core/MeteringService';
import { ProfessionalKnob } from '../container/PluginControls';
import { useMixerStore } from '@/store/useMixerStore';
import { SignalVisualizer } from '../../common/SignalVisualizer';

// CompressionCurve bileşeni, esnek alanda doğru çalışması için güncellendi.
const CompressionCurve = ({ threshold, ratio, knee }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    const drawCurve = (ctx, width, height) => {
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const pos = (i / 4) * width;
            ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, height); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(width, pos); ctx.stroke();
        }
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const dbToPixel = (db) => width - ((db + 60) / 60) * width;
        const outputDbToPixel = (db) => height - ((db + 60) / 60) * height;
        for (let inputDb = -60; inputDb <= 0; inputDb += 0.5) {
            const inputOverThreshold = inputDb - threshold;
            let outputDb = inputDb;
            if (inputOverThreshold > knee / 2) {
                outputDb = threshold + inputOverThreshold / ratio;
            } else if (inputOverThreshold > -knee / 2) {
                const x = inputOverThreshold + knee / 2;
                outputDb = inputDb - ((ratio - 1) * Math.pow(x, 2) / (2 * knee * ratio));
            }
            const x = dbToPixel(inputDb);
            const y = outputDbToPixel(outputDb);
            if (inputDb === -60) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = '#ef4444';
        ctx.setLineDash([3, 3]);
        const thresholdX = dbToPixel(threshold);
        ctx.beginPath(); ctx.moveTo(thresholdX, 0); ctx.lineTo(thresholdX, height); ctx.stroke();
        ctx.setLineDash([]);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            if (width > 0 && height > 0) {
                canvas.width = width;
                canvas.height = height;
                drawCurve(canvas.getContext('2d'), width, height);
            }
        });
        observer.observe(container);

        // İlk render'da çizimi yap
        const { width, height } = container.getBoundingClientRect();
        if (width > 0 && height > 0) {
            canvas.width = width;
            canvas.height = height;
            drawCurve(canvas.getContext('2d'), width, height);
        }
        
        return () => observer.disconnect();
    }, []);

    // threshold, ratio, knee her değiştiğinde yeniden çiz
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            drawCurve(canvas.getContext('2d'), canvas.width, canvas.height);
        }
    }, [threshold, ratio, knee]);

    return (
        <div ref={containerRef} className="w-full h-full relative">
            <canvas ref={canvasRef} className="absolute top-0 left-0" />
        </div>
    );
};

// Vintage GR Meter (Değişiklik yok)
const VintageGRMeter = ({ gainReduction }) => {
  const needleAngle = (Math.abs(gainReduction) / 24) * 180;
  return (
    <div className="relative w-24 h-12 bg-black rounded-t-full border-2 border-amber-600 overflow-hidden shrink-0">
      <div className="absolute inset-0">
        {[0, -3, -6, -12, -20].map((db) => {
          const angle = (Math.abs(db) / 24) * 180;
          return ( <div key={db} className="absolute w-px h-3 bg-amber-300 origin-bottom" style={{ left: '50%', bottom: 0, transform: `translateX(-50%) rotate(${angle - 90}deg) translateY(-12px)`}} /> );
        })}
      </div>
      <div className="compressor-needle absolute w-px h-10 bg-red-500 origin-bottom" style={{ left: '50%', bottom: 0, transform: `translateX(-50%) rotate(${Math.min(180, needleAngle) - 90}deg)` }} />
      <div className="absolute w-2 h-2 bg-red-500 rounded-full bottom-0 left-1/2 transform -translate-x-1/2" />
      <div className="absolute bottom-0 left-0 text-[8px] text-amber-300 transform -rotate-45 origin-bottom-left">0</div>
      <div className="absolute bottom-0 right-0 text-[8px] text-amber-300 transform rotate-45 origin-bottom-right">-20</div>
    </div>
  );
};

export const AdvancedCompressorUI = ({ trackId, effect, onChange, definition }) => {
  const [gainReduction, setGainReduction] = useState(0);
  const allTracks = useMixerStore(state => state.mixerTracks);
  const sidechainSources = allTracks.filter(t => t.id !== trackId && t.type !== 'master');
  
  // === DÜZELTME 2: Metering Service'ten gelen veri doğru şekilde işleniyor ===
  useEffect(() => {
    const grMeterId = `${trackId}-${effect.id}`;
    
    // Gelen veri artık bir obje değil, doğrudan bir sayı (dbValue)
    const handleGR = (dbValue) => {
        if (typeof dbValue === 'number' && isFinite(dbValue)) {
            setGainReduction(dbValue);
        }
    };
    
    // Subscribe olurken artık `{ type: 'level' }` gibi bir config'e gerek yok.
    const unsubGR = MeteringService.subscribe(grMeterId, handleGR);
    
    return () => unsubGR();
  }, [trackId, effect.id]);

  const isSidechain = definition.type === 'SidechainCompressor';

  return (
    // === DÜZELTME 1: Ana kapsayıcıya Flexbox eklendi ===
    <div className="w-full h-full p-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col gap-4">
      
      {/* Header: Bu bölümün boyutu sabit kalmalı */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <VintageGRMeter gainReduction={gainReduction} />
          <div>
            <div className="text-lg font-bold text-white">{definition.type}</div>
            <div className="text-xs text-amber-400 font-mono">
              GR: {gainReduction.toFixed(1)}dB
            </div>
          </div>
        </div>
        {isSidechain && (
          <select 
            value={effect.settings.sidechainSource || 'none'} 
            onChange={(e) => onChange('sidechainSource', e.target.value === 'none' ? null : e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm text-white"
          >
            <option value="none">No Sidechain</option>
            {sidechainSources.map(track => 
              <option key={track.id} value={track.id}>{track.name}</option>
            )}
          </select>
        )}
      </div>
      
      {/* Main Controls: Bu bölümün de boyutu sabit kalmalı */}
      <div className="grid grid-cols-5 gap-6 flex-shrink-0">
        <ProfessionalKnob label="Threshold" value={effect.settings.threshold} onChange={(v) => onChange('threshold', v)} min={-60} max={0} defaultValue={-24} unit="dB" precision={1} size={70} />
        <ProfessionalKnob label="Ratio" value={effect.settings.ratio} onChange={(v) => onChange('ratio', v)} min={1} max={20} defaultValue={4} unit=":1" precision={1} size={70} />
        <ProfessionalKnob label="Attack" value={effect.settings.attack * 1000} onChange={(v) => onChange('attack', v / 1000)} min={0.1} max={100} defaultValue={10} unit="ms" precision={1} size={70} logarithmic />
        <ProfessionalKnob label="Release" value={effect.settings.release * 1000} onChange={(v) => onChange('release', v / 1000)} min={10} max={1000} defaultValue={100} unit="ms" precision={0} size={70} logarithmic />
        <ProfessionalKnob label="Knee" value={effect.settings.knee} onChange={(v) => onChange('knee', v)} min={0} max={30} defaultValue={10} unit="dB" precision={1} size={70} />
      </div>
      
      {/* Visual Analysis: Bu bölüm artık esnek ve kalan alanı dolduruyor */}
      <div className="grid grid-cols-2 gap-4 flex-grow min-h-0">
        <div className="bg-black/20 rounded-lg p-3 border border-white/10 flex flex-col">
          <div className="text-xs text-gray-400 mb-2 flex-shrink-0">Compression Curve</div>
          <div className="flex-grow min-h-0">
            <CompressionCurve threshold={effect.settings.threshold} ratio={effect.settings.ratio} knee={effect.settings.knee} />
          </div>
        </div>
        <div className="bg-black/20 rounded-lg p-3 border border-white/10 flex flex-col">
          <div className="text-xs text-gray-400 mb-2 flex-shrink-0">Input Signal</div>
          <div className="flex-grow min-h-0">
             <SignalVisualizer meterId={`${trackId}-input`} type="scope" color="#22c55e" config={{ showPeak: true, smooth: true }} />
          </div>
        </div>
      </div>
      
      {/* Mix Control: Bu bölüm de sabit boyutlu */}
      <div className="flex justify-center flex-shrink-0">
        <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(v) => onChange('wet', v/100)} min={0} max={100} defaultValue={100} unit="%" precision={0} size={60} />
      </div>
    </div>
  );
};