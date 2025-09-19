import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { GainReductionMeter } from '../meters/GainReductionMeter';
import { useMixerStore } from '../../store/useMixerStore';
import { Link } from 'lucide-react';

const lerp = (start, end, amount) => start * (1 - amount) + end * amount;

export const AdvancedCompressorUI = ({ trackId, effect, onChange, definition }) => {
  const [displayedGainReduction, setDisplayedGainReduction] = useState(0);
  const targetGainReduction = useRef(0);
  const animationFrameRef = useRef(null);

  const allTracks = useMixerStore(state => state.mixerTracks);
  // Sidechain kaynağı olarak kendisi ve master kanalı hariç tüm kanalları listele
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
      const current = displayedGainReduction;
      const target = targetGainReduction.current;
      if (Math.abs(current - target) > 0.01) {
        setDisplayedGainReduction(lerp(current, target, 0.1));
      }
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    };
    animationFrameRef.current = requestAnimationFrame(animationLoop);

    return () => {
      MeteringService.unsubscribe(meterId, handleDataUpdate);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [trackId, effect.id, displayedGainReduction]);

  const handleMixChange = (uiValue) => {
    onChange('wet', uiValue / 100);
  };
  
  // YENİ: Sidechain kaynağı seçildiğinde çağrılacak fonksiyon
  const handleSidechainChange = (e) => {
    const sourceId = e.target.value === 'none' ? null : e.target.value;
    // Hem ayarı hem de sidechainSource'u güncelle
    onChange({
        ...effect.settings,
        sidechainSource: sourceId
    });
  };

  const isSidechainCompressor = definition.type === 'SidechainCompressor';

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between h-full gap-4">
        <div className="grid grid-cols-3 gap-x-4 gap-y-6">
          <ProfessionalKnob label="Threshold" value={effect.settings.threshold} onChange={(val) => onChange('threshold', val)} min={-60} max={0} defaultValue={-24} unit=" dB" precision={1} size={72} />
          <ProfessionalKnob label="Ratio" value={effect.settings.ratio} onChange={(val) => onChange('ratio', val)} min={1} max={20} defaultValue={4} unit=":1" precision={1} size={72} />
          <ProfessionalKnob label="Knee" value={effect.settings.knee} onChange={(val) => onChange('knee', val)} min={0} max={30} defaultValue={10} unit=" dB" precision={1} size={72} />
          <ProfessionalKnob label="Attack" value={effect.settings.attack * 1000} onChange={(val) => onChange('attack', val / 1000)} min={1} max={500} defaultValue={10} unit=" ms" precision={1} size={60} logarithmic />
          <ProfessionalKnob label="Release" value={effect.settings.release * 1000} onChange={(val) => onChange('release', val / 1000)} min={10} max={1000} defaultValue={100} unit=" ms" precision={0} size={60} logarithmic />
          <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={handleMixChange} min={0} max={100} defaultValue={100} unit="%" precision={0} size={60} />
        </div>
        <div className="flex items-center justify-center h-full gap-4">
          <div className="w-[1px] h-4/5 bg-white/10" />
          <GainReductionMeter dbValue={displayedGainReduction} />
        </div>
      </div>
      {/* YENİ: Sidechain Seçim Menüsü */}
      {isSidechainCompressor && (
         <div className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg mt-auto">
            <Link size={16} className="text-cyan-400"/>
            <label className="text-xs font-bold text-gray-400">SIDECHAIN:</label>
            <select
                value={effect.settings.sidechainSource || 'none'}
                onChange={handleSidechainChange}
                className="flex-grow bg-gray-700 text-white rounded px-2 py-1 text-xs border border-gray-600 focus:outline-none focus:border-cyan-500"
            >
                <option value="none">None</option>
                {sidechainSources.map(track => (
                    <option key={track.id} value={track.id}>{track.name}</option>
                ))}
            </select>
         </div>
      )}
    </div>
  );
};
