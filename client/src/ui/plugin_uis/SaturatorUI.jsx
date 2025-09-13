import React from 'react';
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager';

export const SaturatorUI = ({ effect, onChange, definition }) => {
  return (
    <div 
        className="relative w-full h-full flex flex-col items-center justify-between"
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
            <h3 className="font-bold" style={{ fontSize: 'var(--font-size-header)', color: 'var(--color-accent)' }}>{definition.type}</h3>
            <p className="max-w-xs px-2" style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-muted)' }}>{definition.story}</p>
        </div>
        <div className="flex items-end justify-around w-full mt-4" style={{ gap: 'var(--gap-controls)'}}>
            <VolumeKnob 
                label="Drive"
                value={effect.settings.distortion}
                onChange={(val) => onChange('distortion', val)}
                min={0} max={40} defaultValue={10}
            />
            <VolumeKnob 
                label="Mix"
                value={effect.settings.wet}
                onChange={(val) => onChange('wet', val)}
                min={0} max={1} defaultValue={1.0}
            />
        </div>
    </div>
  );
};