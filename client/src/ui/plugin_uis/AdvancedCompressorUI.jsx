import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { useMixerStore } from '../../store/useMixerStore';
import { SignalVisualizer } from '../SignalVisualizer';

// Kompresör karakteristiği çizen bileşen
const CompressionCurve = ({ threshold, ratio, knee }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const pos = (i / 4) * width;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(width, pos);
      ctx.stroke();
    }
    
    // Kompresör eğrisi
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const dbToPixel = (db) => width - ((db + 60) / 60) * width;
    const outputDbToPixel = (db) => height - ((db + 60) / 60) * height;
    
    for (let inputDb = -60; inputDb <= 0; inputDb += 0.5) {
      const inputOverThreshold = inputDb - threshold;
      let outputDb = inputDb;
      
      if (inputOverThreshold > knee / 2) {
        // Hard compression
        outputDb = threshold + inputOverThreshold / ratio;
      } else if (inputOverThreshold > -knee / 2) {
        // Soft knee
        const x = inputOverThreshold + knee / 2;
        const reduction = (ratio - 1) * Math.pow(x, 2) / (2 * knee * ratio);
        outputDb = inputDb - reduction;
      }
      
      const x = dbToPixel(inputDb);
      const y = outputDbToPixel(outputDb);
      
      if (inputDb === -60) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    
    ctx.stroke();
    
    // Threshold çizgisi
    ctx.strokeStyle = '#ef4444';
    ctx.setLineDash([3, 3]);
    const thresholdX = dbToPixel(threshold);
    ctx.beginPath();
    ctx.moveTo(thresholdX, 0);
    ctx.lineTo(thresholdX, height);
    ctx.stroke();
    ctx.setLineDash([]);
    
  }, [threshold, ratio, knee]);
  
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// VU Metre stili gain reduction display
const VintageGRMeter = ({ gainReduction }) => {
  const needleAngle = (Math.abs(gainReduction) / 24) * 180; // 0-24dB için 180 derece
  
  return (
    <div className="relative w-24 h-12 bg-black rounded-t-full border-2 border-amber-600 overflow-hidden">
      {/* Scale markings */}
      <div className="absolute inset-0">
        {[0, -3, -6, -12, -20].map((db, i) => {
          const angle = (Math.abs(db) / 24) * 180;
          return (
            <div
              key={db}
              className="absolute w-px h-3 bg-amber-300 origin-bottom"
              style={{
                left: '50%',
                bottom: 0,
                transform: `translateX(-50%) rotate(${angle - 90}deg) translateY(-12px)`
              }}
            />
          );
        })}
      </div>
      
      {/* Needle */}
      <div
        className="absolute w-px h-10 bg-red-500 origin-bottom transition-transform duration-75 ease-out"
        style={{
          left: '50%',
          bottom: 0,
          transform: `translateX(-50%) rotate(${needleAngle - 90}deg)`
        }}
      />
      
      {/* Center dot */}
      <div className="absolute w-2 h-2 bg-red-500 rounded-full bottom-0 left-1/2 transform -translate-x-1/2" />
      
      {/* Labels */}
      <div className="absolute bottom-0 left-0 text-[8px] text-amber-300 transform -rotate-45 origin-bottom-left">0</div>
      <div className="absolute bottom-0 right-0 text-[8px] text-amber-300 transform rotate-45 origin-bottom-right">-20</div>
    </div>
  );
};

export const AdvancedCompressorUI = ({ trackId, effect, onChange, definition }) => {
  const [gainReduction, setGainReduction] = useState(0);
  const [inputLevel, setInputLevel] = useState(-60);
  const allTracks = useMixerStore(state => state.mixerTracks);
  const sidechainSources = allTracks.filter(t => t.id !== trackId && t.type !== 'master');
  
  useEffect(() => {
    const grMeterId = `${trackId}-${effect.id}`;
    const inputMeterId = `${trackId}-input`;
    
    const handleGR = (data) => setGainReduction(data.peak || 0);
    const handleInput = (data) => setInputLevel(data.peak || -60);
    
    const unsubGR = MeteringService.subscribe(grMeterId, handleGR);
    const unsubInput = MeteringService.subscribe(inputMeterId, handleInput);
    
    return () => {
      unsubGR();
      unsubInput();
    };
  }, [trackId, effect.id]);

  const isSidechain = definition.type === 'SidechainCompressor';

  return (
    <div className="w-full h-full p-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
      
      {/* Main Controls */}
      <div className="grid grid-cols-5 gap-6 mb-6">
        <ProfessionalKnob 
          label="Threshold" 
          value={effect.settings.threshold} 
          onChange={(v) => onChange('threshold', v)} 
          min={-60} max={0} defaultValue={-24} 
          unit="dB" precision={1} size={70}
        />
        <ProfessionalKnob 
          label="Ratio" 
          value={effect.settings.ratio} 
          onChange={(v) => onChange('ratio', v)} 
          min={1} max={20} defaultValue={4} 
          unit=":1" precision={1} size={70}
        />
        <ProfessionalKnob 
          label="Attack" 
          value={effect.settings.attack * 1000} 
          onChange={(v) => onChange('attack', v / 1000)} 
          min={0.1} max={100} defaultValue={10} 
          unit="ms" precision={1} size={70} logarithmic
        />
        <ProfessionalKnob 
          label="Release" 
          value={effect.settings.release * 1000} 
          onChange={(v) => onChange('release', v / 1000)} 
          min={10} max={1000} defaultValue={100} 
          unit="ms" precision={0} size={70} logarithmic
        />
        <ProfessionalKnob 
          label="Knee" 
          value={effect.settings.knee} 
          onChange={(v) => onChange('knee', v)} 
          min={0} max={30} defaultValue={10} 
          unit="dB" precision={1} size={70}
        />
      </div>
      
      {/* Visual Analysis */}
      <div className="grid grid-cols-2 gap-4 h-32">
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
          <div className="text-xs text-gray-400 mb-2">Compression Curve</div>
          <CompressionCurve 
            threshold={effect.settings.threshold} 
            ratio={effect.settings.ratio} 
            knee={effect.settings.knee}
          />
        </div>
        
        <div className="bg-black/20 rounded-lg p-3 border border-white/10">
          <div className="text-xs text-gray-400 mb-2">Input Signal</div>
          <SignalVisualizer 
            meterId={`${trackId}-input`}
            type="scope"
            color="#22c55e"
            config={{ showPeak: true, smooth: true }}
          />
        </div>
      </div>
      
      {/* Mix Control */}
      <div className="mt-6 flex justify-center">
        <ProfessionalKnob 
          label="Mix" 
          value={effect.settings.wet * 100} 
          onChange={(v) => onChange('wet', v/100)} 
          min={0} max={100} defaultValue={100} 
          unit="%" precision={0} size={60}
        />
      </div>
    </div>
  );
};