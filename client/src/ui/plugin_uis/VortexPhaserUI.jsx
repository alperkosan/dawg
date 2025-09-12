import React from 'react';
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager';

export const VortexPhaserUI = ({ effect, onChange, definition }) => {
  return (
    <div className="relative w-full h-full p-4 bg-gray-800 rounded-lg flex flex-col items-center justify-between border border-gray-700
                    bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/40 to-gray-800">
    <PresetManager 
      pluginType={definition.type} 
      effect={effect}
      factoryPresets={definition.presets} 
      onChange={onChange}
    />
        <div>
            <h3 className="text-lg font-bold text-green-300">{definition.type}</h3>
            <p className="text-xs text-center text-gray-400 max-w-xs px-2 mt-1">{definition.story}</p>
        </div>
        <div className="flex items-end justify-around w-full mt-4 gap-4">
            <VolumeKnob 
                label="Rate"
                value={effect.settings.frequency}
                onChange={(val) => onChange('frequency', val)}
                min={0.1} max={8} defaultValue={0.5} size={60}
            />
            <VolumeKnob 
                label="Depth"
                value={effect.settings.octaves}
                onChange={(val) => onChange('octaves', val)}
                min={1} max={8} defaultValue={3} size={60}
            />
            {/* --- YENİ KONTROL: Base Freq --- */}
            <VolumeKnob 
                label="Base Freq"
                value={effect.settings.baseFrequency}
                onChange={(val) => onChange('baseFrequency', val)}
                min={100} max={2000} defaultValue={350} size={48}
            />
            <VolumeKnob 
                label="Mix"
                value={effect.settings.wet}
                onChange={(val) => onChange('wet', val)}
                min={0} max={1} defaultValue={0.5} size={60}
            />
        </div>
    </div>
  );
};