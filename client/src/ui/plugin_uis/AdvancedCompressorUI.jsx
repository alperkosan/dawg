import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'lucide-react';

// YENİ: Profesyonel sistem bileşenlerini import ediyoruz
import PluginContainer from '../plugin_system/PluginContainer';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { MeteringService } from '../../lib/core/MeteringService';
import { useMixerStore } from '../../store/useMixerStore';
import { GainReductionMeter } from '../meters/GainReductionMeter';

const lerp = (start, end, amount) => start * (1 - amount) + end * amount;

export const AdvancedCompressorUI = ({ trackId, effect, onChange, definition }) => {
  const [displayedGainReduction, setDisplayedGainReduction] = useState(0);
  const targetGainReduction = useRef(0);
  const animationFrameRef = useRef(null);

  const allTracks = useMixerStore(state => state.mixerTracks);
  const sidechainSources = allTracks.filter(t => t.id !== trackId && t.type !== 'master');

  useEffect(() => {
    const meterId = `${trackId}-${effect.id}`;
    const handleDataUpdate = (dbValue) => {
      if (typeof dbValue === 'number' && !isNaN(dbValue)) {
        targetGainReduction.current = dbValue;
      }
    };
    MeteringService.subscribe(meterId, handleDataUpdate);
    const animationLoop = () => {
      setDisplayedGainReduction(current => lerp(current, targetGainReduction.current, 0.15));
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    };
    animationFrameRef.current = requestAnimationFrame(animationLoop);
    return () => {
      MeteringService.unsubscribe(meterId, handleDataUpdate);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [trackId, effect.id]);

  return (
    <PluginContainer
      trackId={trackId}
      effect={effect}
      definition={definition}
    >
      <div className="flex h-full w-full items-center justify-between gap-6">
        {/* Sol Taraf: Ana Kontroller */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          <ProfessionalKnob label="Threshold" value={effect.settings.threshold} onChange={(val) => onChange('threshold', val)} min={-60} max={0} defaultValue={-24} unit=" dB" precision={1}/>
          <ProfessionalKnob label="Ratio" value={effect.settings.ratio} onChange={(val) => onChange('ratio', val)} min={1} max={20} defaultValue={4} precision={1}/>
          <ProfessionalKnob label="Knee" value={effect.settings.knee} onChange={(val) => onChange('knee', val)} min={0} max={30} defaultValue={10} unit=" dB" precision={1}/>
          <ProfessionalKnob label="Attack" value={effect.settings.attack} onChange={(val) => onChange('attack', val)} min={0.001} max={0.5} defaultValue={0.01} logarithmic={true} unit="s" precision={3}/>
          <ProfessionalKnob label="Release" value={effect.settings.release} onChange={(val) => onChange('release', val)} min={0.01} max={1} defaultValue={0.1} logarithmic={true} unit="s" precision={2}/>
          <ProfessionalKnob label="Mix" value={effect.settings.wet} onChange={(val) => onChange('wet', val)} min={0} max={1} defaultValue={1.0}/>
        </div>
        
        {/* Sağ Taraf: Metre ve Sidechain */}
        <div className="flex flex-col items-center justify-between h-full gap-4">
          <div className="flex flex-col items-center gap-2">
            <label className="text-xs font-semibold text-white/90 uppercase tracking-wider flex items-center gap-1.5"><Link size={12} /> Sidechain</label>
            <select
              value={effect.settings.sidechainSource || ''}
              onChange={(e) => onChange('sidechainSource', e.target.value || null)}
              className="w-full bg-gray-800 border border-white/20 rounded-md px-2 py-1 text-xs text-white"
            >
              <option value="">Kapalı</option>
              {sidechainSources.map(track => (
                <option key={track.id} value={track.id}>{track.name}</option>
              ))}
            </select>
          </div>
          <GainReductionMeter dbValue={displayedGainReduction} />
        </div>
      </div>
    </PluginContainer>
  );
};