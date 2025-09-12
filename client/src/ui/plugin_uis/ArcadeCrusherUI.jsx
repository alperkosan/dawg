import React from 'react';
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager'; // Preset yöneticisini import et

export const ArcadeCrusherUI = ({ effect, onChange, definition }) => {
  return (
    <div className="relative w-full h-full p-4 bg-gray-800 rounded-lg flex flex-col items-center justify-between border-4 border-gray-900
                    bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-900/40 to-gray-800 font-mono">
    <PresetManager 
      pluginType={definition.type} 
      effect={effect} // Efektin tüm verisini gönderiyoruz
      factoryPresets={definition.presets} 
      onChange={onChange}
    />
        <div>
            <h3 className="text-xl font-bold text-red-300" style={{ textShadow: '2px 2px #000' }}>{definition.type}</h3>
            <p className="text-xs text-center text-gray-400 max-w-xs px-2 mt-1">{definition.story}</p>
        </div>
        <div className="flex items-end justify-around w-full mt-4 gap-8">
            <VolumeKnob 
                label="BITS"
                value={effect.settings.bits}
                onChange={(val) => onChange('bits', Math.round(val))} // Sadece tam sayı değerleri
                min={1} max={16} defaultValue={4} size={72}
            />
            <VolumeKnob 
                label="MIX"
                value={effect.settings.wet}
                onChange={(val) => onChange('wet', val)}
                min={0} max={1} defaultValue={1.0} size={54}
            />
        </div>
    </div>
  );
};
