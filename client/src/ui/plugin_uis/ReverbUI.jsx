import React from 'react';
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager';

export const ReverbUI = ({ effect, onChange, definition }) => {
  return (
    <div 
      className="relative w-full h-full flex flex-col items-center"
      style={{
        backgroundColor: 'var(--color-surface)',
        padding: 'var(--padding-container)',
        gap: 'var(--gap-container)',
        borderRadius: 'var(--border-radius)',
        border: '1px solid var(--color-border)'
      }}
    >
      <PresetManager 
        pluginType={definition.type} 
        effect={effect}
        factoryPresets={definition.presets} 
        onChange={onChange}
      />
      <div className="text-center">
        <h3 className="font-bold" style={{ fontSize: 'var(--font-size-header)', color: 'var(--color-primary)' }}>{definition.type}</h3>
        <p className="max-w-xs px-2" style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-muted)' }}>{definition.story}</p>
      </div>
      <div className="flex items-center justify-around w-full flex-grow" style={{ gap: 'var(--gap-controls)' }}>
          <VolumeKnob 
              label="Decay"
              value={effect.settings.decay}
              onChange={(val) => onChange('decay', val)}
              min={0.1} max={15} defaultValue={2.5}
          />
           <VolumeKnob 
              label="Pre-Delay"
              value={effect.settings.preDelay}
              onChange={(val) => onChange('preDelay', val)}
              min={0} max={0.2} defaultValue={0.01}
          />
          <VolumeKnob 
              label="Mix"
              value={effect.settings.wet}
              onChange={(val) => onChange('wet', val)}
              min={0} max={1} defaultValue={0.4}
          />
      </div>
    </div>
  );
};