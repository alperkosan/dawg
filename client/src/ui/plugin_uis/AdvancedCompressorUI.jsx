import React, { useState, useEffect, useRef } from 'react';
import { MeteringService } from '../../lib/core/MeteringService';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { GainReductionMeter } from '../meters/GainReductionMeter';
import { useMixerStore } from '../../store/useMixerStore';
import { Link } from 'lucide-react';
import { PluginTypography, PluginSpacing } from '../plugin_system/PluginDesignSystem';

// Sönümlemeli (lerp) geçiş için yardımcı fonksiyon
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

  return (
    <div className="flex items-center justify-between h-full gap-8">
      <div className="grid grid-cols-3 gap-x-6 gap-y-8">
        <ProfessionalKnob
          label="Threshold"
          value={effect.settings.threshold}
          onChange={(val) => onChange('threshold', val)}
          min={-60} max={0} defaultValue={-24}
          unit=" dB" precision={1} size={72}
        />
        <ProfessionalKnob
          label="Ratio"
          value={effect.settings.ratio}
          onChange={(val) => onChange('ratio', val)}
          min={1} max={20} defaultValue={4}
          unit=":1" precision={1} size={72}
        />
        <ProfessionalKnob
          label="Knee"
          value={effect.settings.knee}
          onChange={(val) => onChange('knee', val)}
          min={0} max={30} defaultValue={10}
          unit=" dB" precision={1} size={72}
        />
        <ProfessionalKnob
          label="Attack"
          value={effect.settings.attack * 1000} // saniye'yi ms'ye çevir
          onChange={(val) => onChange('attack', val / 1000)} // ms'yi saniye'ye çevir
          min={1} max={500} defaultValue={10}
          unit=" ms" precision={1} size={60} logarithmic
        />
        <ProfessionalKnob
          label="Release"
          value={effect.settings.release * 1000} // saniye'yi ms'ye çevir
          onChange={(val) => onChange('release', val / 1000)} // ms'yi saniye'ye çevir
          min={10} max={1000} defaultValue={100}
          unit=" ms" precision={0} size={60} logarithmic
        />
        <ProfessionalKnob
          label="Mix"
          value={effect.settings.wet * 100}
          onChange={handleMixChange}
          min={0} max={100} defaultValue={100}
          unit="%" precision={0} size={60}
        />
      </div>

      <div className="flex items-center justify-center h-full gap-4">
          <div className="w-[1px] h-4/5 bg-white/10" />
          <GainReductionMeter dbValue={displayedGainReduction} />
      </div>
    </div>
  );
};