import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { useMixerStore } from '../../store/useMixerStore';

const lerp = (start, end, amount) => start * (1 - amount) + end * amount;

/**
 * Kompresörün çalışmasını görselleştiren ana Canvas bileşeni
 */
const DynamicVisualizer = ({ gainReductionDb, thresholdDb }) => {
    const canvasRef = useRef(null);
    const animationFrameId = useRef(null);
    const smoothGR = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        const draw = () => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0) {
                animationFrameId.current = requestAnimationFrame(draw);
                return;
            }
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            
            const { width, height } = rect;
            
            smoothGR.current = lerp(smoothGR.current, gainReductionDb, 0.2);

            const grRatio = Math.min(1, Math.abs(smoothGR.current) / 30); // Max 30dB GR için
            const thresholdRatio = 1 - (thresholdDb + 60) / 60;

            ctx.clearRect(0, 0, width, height);

            // Arka Plan
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, width, height);

            // GR Barı
            const barHeight = grRatio * height;
            ctx.fillStyle = '#f59e0b'; // Amber-500
            ctx.fillRect(0, height - barHeight, width, barHeight);

            // Threshold Çizgisi
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            const y = height * (1 - thresholdRatio);
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
            ctx.setLineDash([]);
            
            animationFrameId.current = requestAnimationFrame(draw);
        };
        
        draw();
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [gainReductionDb, thresholdDb]);

    return <canvas ref={canvasRef} className="compressor-v4__visualizer" />;
};


export const AdvancedCompressorUI = ({ trackId, effect, onChange, definition }) => {
  const [gainReduction, setGainReduction] = useState(0);
  const allTracks = useMixerStore(state => state.mixerTracks);
  const sidechainSources = allTracks.filter(t => t.id !== trackId && t.type !== 'master');
  
  useEffect(() => {
    const grMeterId = `${trackId}-${effect.id}`;
    const handleGR = (db) => setGainReduction(db);
    MeteringService.subscribe(grMeterId, handleGR);
    return () => MeteringService.unsubscribe(grMeterId, handleGR);
  }, [trackId, effect.id]);

  const isSidechain = definition.type === 'SidechainCompressor';

  return (
    <div className="compressor-ui-v4">
        <div className="compressor-ui-v4__main-panel">
            <div className="compressor-ui-v4__knob-grid">
                <ProfessionalKnob label="Threshold" value={effect.settings.threshold} onChange={(v) => onChange('threshold', v)} min={-60} max={0} defaultValue={-24} unit="dB" precision={1} size={80} />
                <ProfessionalKnob label="Ratio" value={effect.settings.ratio} onChange={(v) => onChange('ratio', v)} min={1} max={20} defaultValue={4} unit=":1" precision={1} size={64} />
                <ProfessionalKnob label="Attack" value={effect.settings.attack * 1000} onChange={(v) => onChange('attack', v / 1000)} min={1} max={500} defaultValue={10} unit="ms" precision={1} size={64} logarithmic />
                <ProfessionalKnob label="Release" value={effect.settings.release * 1000} onChange={(v) => onChange('release', v / 1000)} min={10} max={1000} defaultValue={100} unit="ms" precision={0} size={64} logarithmic />
                <ProfessionalKnob label="Knee" value={effect.settings.knee} onChange={(v) => onChange('knee', v)} min={0} max={30} defaultValue={10} unit="dB" precision={1} size={52} />
                <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={(v) => onChange('wet', v/100)} min={0} max={100} defaultValue={100} unit="%" precision={0} size={52} />
            </div>
            {isSidechain && (
              <select value={effect.settings.sidechainSource || 'none'} onChange={(e) => onChange('sidechainSource', e.target.value === 'none' ? null : e.target.value)} className="compressor-ui-v2__sidechain-select">
                <option value="none">Sidechain: Off</option>
                {sidechainSources.map(track => <option key={track.id} value={track.id}>{track.name}</option>)}
              </select>
            )}
        </div>
      
        <div className="compressor-ui-v4__visualizer-section">
            <DynamicVisualizer gainReductionDb={gainReduction} thresholdDb={effect.settings.threshold} />
            <div className="compressor-ui-v4__gr-label">
                {gainReduction.toFixed(1)} dB
            </div>
        </div>
    </div>
  );
};