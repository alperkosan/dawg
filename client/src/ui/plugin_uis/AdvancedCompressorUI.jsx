import React, { useState, useEffect, useRef } from 'react';
import VolumeKnob from '../VolumeKnob';
import { GainReductionMeter } from '../meters/GainReductionMeter';
import { MeteringService } from '../../lib/core/MeteringService';
import { PresetManager } from '../PresetManager';
import { useMixerStore } from '../../store/useMixerStore';
import { Link } from 'lucide-react'; // İkon için

const lerp = (start, end, amount) => start * (1 - amount) + end * amount;

export const AdvancedCompressorUI = ({ effect, onChange, trackId, definition }) => {
  const handleChange = (paramId, value) => {
    onChange(trackId, effect.id, paramId, value);
  };
  
  const [displayedGainReduction, setDisplayedGainReduction] = useState(0);
  const targetGainReduction = useRef(0);
  const animationFrameRef = useRef(null);

  // --- YENİ: Diğer kanalları listede göstermek için state'i çekiyoruz ---
  const allTracks = useMixerStore(state => state.mixerTracks);
  // Mevcut kanal ve master hariç, sidechain kaynağı olabilecek kanalları filtrele.
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
        const smoothedValue = lerp(current, target, 0.1);
        setDisplayedGainReduction(smoothedValue);
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

  return (
    <div className="relative w-full h-full p-4 bg-gray-800 rounded-lg flex items-center gap-6 border border-gray-700">
      <PresetManager 
        pluginType={definition.type} 
        effect={effect}
        factoryPresets={definition.presets} 
        onChange={onChange}
      />
      <div className="flex flex-col justify-between h-full w-full">
        <div>
            <h3 className="text-lg font-bold text-amber-400">{definition.type}</h3>
            <p className="text-xs text-gray-400">{definition.story}</p>
        </div>
        {/* --- YENİ DÜZEN: Grid 5 sütunlu oldu --- */}
        <div className="grid grid-cols-5 gap-x-4 gap-y-4 pt-4 items-end">
            <VolumeKnob label="Threshold" value={effect.settings.threshold} onChange={(val) => onChange('threshold', val)} min={-60} max={0} defaultValue={-24} size={48}/>
            <VolumeKnob label="Ratio" value={effect.settings.ratio} onChange={(val) => onChange('ratio', val)} min={1} max={20} defaultValue={4} size={48}/>
            <VolumeKnob label="Knee" value={effect.settings.knee} onChange={(val) => onChange('knee', val)} min={0} max={30} defaultValue={10} size={48}/>
            <VolumeKnob label="Mix" value={effect.settings.wet} onChange={(val) => onChange('wet', val)} min={0} max={1} defaultValue={1.0} size={48}/>

            {/* --- YENİ: SIDECHAIN SEÇİM MENÜSÜ --- */}
            <div className="flex flex-col items-center gap-1">
                <label className="text-xs font-bold text-gray-400 flex items-center gap-1"><Link size={12} /> Sidechain</label>
                <select 
                    value={effect.settings.sidechainSource || ''}
                    onChange={(e) => onChange('sidechainSource', e.target.value || null)}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                    <option value="">Kapalı</option>
                    {sidechainSources.map(track => (
                        <option key={track.id} value={track.id}>{track.name}</option>
                    ))}
                </select>
            </div>
        </div>
      </div>
      
      <div className="flex items-center justify-center h-full gap-6">
        <div className="flex flex-col justify-around items-center h-full">
            <VolumeKnob 
                label="Attack" value={effect.settings.attack}
                onChange={(val) => handleChange('attack', val)} min={0.001} max={0.5} defaultValue={0.01} size={38}
            />
             <VolumeKnob 
                label="Release" value={effect.settings.release}
                onChange={(val) => handleChange('release', val)} min={0.01} max={1} defaultValue={0.1} size={38}
            />
        </div>
        <div className="w-[1px] h-4/5 bg-gray-700" />
        <GainReductionMeter dbValue={displayedGainReduction} />
      </div>
    </div>
  );
};