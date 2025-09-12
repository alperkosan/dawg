import React from 'react';
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager';

export const PitchShifterUI = ({ effect, onChange, definition }) => {
  return (
    <div className="relative w-full h-full p-4 bg-gray-800 rounded-lg flex flex-col items-center justify-between border border-gray-700
                    bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/40 to-gray-800">
    <PresetManager 
      pluginType={definition.type} 
      effect={effect}
      factoryPresets={definition.presets} 
      onChange={onChange}
    />
        <div>
            <h3 className="text-lg font-bold text-yellow-300">{definition.type}</h3>
            <p className="text-xs text-center text-gray-400 max-w-xs px-2 mt-1">{definition.story}</p>
        </div>
        <div className="flex items-end justify-around w-full mt-4 gap-6">
            <VolumeKnob 
                label="Pitch"
                value={effect.settings.pitch}
                onChange={(val) => onChange('pitch', Math.round(val))}
                min={-12} max={12} defaultValue={0} size={72}
            />
            {/* --- YENİ KONTROL: Window Size --- */}
            <VolumeKnob 
                label="Quality"
                value={effect.settings.windowSize}
                onChange={(val) => onChange('windowSize', val)}
                min={0.01} max={0.4} defaultValue={0.1} size={48}
            />
            <VolumeKnob 
                label="Mix"
                value={effect.settings.wet}
                onChange={(val) => onChange('wet', val)}
                min={0} max={1} defaultValue={1.0} size={54}
            />
        </div>
    </div>
  );
};