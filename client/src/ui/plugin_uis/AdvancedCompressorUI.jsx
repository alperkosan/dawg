import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { GainReductionMeter } from '../meters/GainReductionMeter';
import { useMixerStore } from '../../store/useMixerStore';
import { Link } from 'lucide-react';

// Anlık değeri yumuşatan yardımcı fonksiyon
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
      setDisplayedGainReduction(prev => lerp(prev, targetGainReduction.current, 0.15));
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    };
    animationFrameRef.current = requestAnimationFrame(animationLoop);

    return () => {
      MeteringService.unsubscribe(meterId, handleDataUpdate);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [trackId, effect.id]);

  const handleMixChange = (uiValue) => onChange('wet', uiValue / 100);
  const handleSidechainChange = (e) => onChange({ ...effect.settings, sidechainSource: e.target.value === 'none' ? null : e.target.value });
  const isSidechainCompressor = definition.type === 'SidechainCompressor';

  return (
    <div className="compressor-ui">
      <div className="compressor-ui__controls">
        <div className="compressor-ui__main-knob">
            <ProfessionalKnob label="Threshold" value={effect.settings.threshold} onChange={(val) => onChange('threshold', val)} min={-60} max={0} defaultValue={-24} unit=" dB" precision={1} size={110} />
        </div>
        <ProfessionalKnob label="Ratio" value={effect.settings.ratio} onChange={(val) => onChange('ratio', val)} min={1} max={20} defaultValue={4} unit=":1" precision={1} size={72} />
        <ProfessionalKnob label="Attack" value={effect.settings.attack * 1000} onChange={(val) => onChange('attack', val / 1000)} min={1} max={500} defaultValue={10} unit=" ms" precision={1} size={72} logarithmic />
        <ProfessionalKnob label="Release" value={effect.settings.release * 1000} onChange={(val) => onChange('release', val / 1000)} min={10} max={1000} defaultValue={100} unit=" ms" precision={0} size={72} logarithmic />
        <ProfessionalKnob label="Knee" value={effect.settings.knee} onChange={(val) => onChange('knee', val)} min={0} max={30} defaultValue={10} unit=" dB" precision={1} size={60} />
        <ProfessionalKnob label="Mix" value={effect.settings.wet * 100} onChange={handleMixChange} min={0} max={100} defaultValue={100} unit="%" precision={0} size={60} />
        {isSidechainCompressor && (
         <select value={effect.settings.sidechainSource || 'none'} onChange={handleSidechainChange} className="compressor-ui__sidechain-select">
            <option value="none">Sidechain: Yok</option>
            {sidechainSources.map(track => <option key={track.id} value={track.id}>{track.name}</option>)}
         </select>
      )}
      </div>
      <GainReductionMeter dbValue={displayedGainReduction} />
    </div>
  );
};
