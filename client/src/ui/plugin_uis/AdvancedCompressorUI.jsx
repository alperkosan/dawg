import React, { useState, useEffect, useRef } from 'react';
import VolumeKnob from '../VolumeKnob';
import { GainReductionMeter } from '../meters/GainReductionMeter';
import { MeteringService } from '../../lib/core/MeteringService';
import { PresetManager } from '../PresetManager';
import { useMixerStore } from '../../store/useMixerStore';
import { Link } from 'lucide-react';

const lerp = (start, end, amount) => start * (1 - amount) + end * amount;

export const AdvancedCompressorUI = ({ effect, onChange, trackId, definition }) => {
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

  return (
    <div 
      className="relative w-full h-full flex items-center"
      style={{
        backgroundColor: 'var(--color-surface)',
        padding: 'var(--padding-container)',
        gap: 'var(--gap-container)',
        borderRadius: 'var(--border-radius)'
      }}
    >
      <PresetManager 
        pluginType={definition.type} 
        effect={effect}
        factoryPresets={definition.presets} 
        onChange={onChange}
      />
      <div className="flex flex-col justify-between h-full w-full">
        <div>
            <h3 className="font-bold" style={{ fontSize: 'var(--font-size-header)', color: 'var(--color-accent)' }}>{definition.type}</h3>
            <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-muted)' }}>{definition.story}</p>
        </div>
        <div className="grid grid-cols-5 items-end" style={{ gap: 'var(--gap-controls)', paddingTop: 'var(--padding-container)' }}>
            <VolumeKnob label="Threshold" value={effect.settings.threshold} onChange={(val) => onChange('threshold', val)} min={-60} max={0} defaultValue={-24} />
            <VolumeKnob label="Ratio" value={effect.settings.ratio} onChange={(val) => onChange('ratio', val)} min={1} max={20} defaultValue={4} />
            <VolumeKnob label="Knee" value={effect.settings.knee} onChange={(val) => onChange('knee', val)} min={0} max={30} defaultValue={10} />
            <VolumeKnob label="Mix" value={effect.settings.wet} onChange={(val) => onChange('wet', val)} min={0} max={1} defaultValue={1.0} />
            <div className="flex flex-col items-center" style={{ gap: 'var(--gap-controls)' }}>
                <label className="font-bold flex items-center" style={{ fontSize: 'var(--font-size-label)', color: 'var(--color-muted)', gap: '4px' }}><Link size={12} /> Sidechain</label>
                <select 
                    value={effect.settings.sidechainSource || ''}
                    onChange={(e) => onChange('sidechainSource', e.target.value || null)}
                    className="w-full focus:outline-none"
                    style={{
                        backgroundColor: 'var(--color-background)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--border-radius)',
                        padding: 'var(--padding-controls)',
                        fontSize: 'var(--font-size-label)'
                    }}
                >
                    <option value="">Kapalı</option>
                    {sidechainSources.map(track => (
                        <option key={track.id} value={track.id}>{track.name}</option>
                    ))}
                </select>
            </div>
        </div>
      </div>
      
      <div className="flex items-center justify-center h-full" style={{ gap: 'var(--gap-container)' }}>
        <div className="flex flex-col justify-around items-center h-full">
            <VolumeKnob label="Attack" value={effect.settings.attack} onChange={(val) => onChange('attack', val)} min={0.001} max={0.5} defaultValue={0.01} />
            <VolumeKnob label="Release" value={effect.settings.release} onChange={(val) => onChange('release', val)} min={0.01} max={1} defaultValue={0.1} />
        </div>
        <div className="w-[1px] h-4/5" style={{ backgroundColor: 'var(--color-border)' }} />
        <GainReductionMeter dbValue={displayedGainReduction} />
      </div>
    </div>
  );
};