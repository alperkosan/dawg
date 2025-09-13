import React from 'react';
// YENİ: Profesyonel sistem bileşenlerini import ediyoruz
import PluginContainer from '../plugin_system/PluginContainer';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const PitchShifterUI = ({ trackId, effect, onChange, definition }) => {
  return (
    <PluginContainer
      trackId={trackId}
      effect={effect}
      definition={definition}
    >
      <div className="flex items-center justify-center h-full gap-8">
        <ProfessionalKnob
          label="Pitch"
          value={effect.settings.pitch}
          onChange={(val) => onChange('pitch', Math.round(val))} // Sadece tam sayı değerleri
          min={-12} max={12} defaultValue={0}
          size={80}
          unit=" st" // semitones
          precision={0}
        />
        <ProfessionalKnob
          label="Quality"
          value={effect.settings.windowSize}
          onChange={(val) => onChange('windowSize', val)}
          min={0.01} max={0.4} defaultValue={0.1}
          size={60}
          unit="s"
          precision={3}
        />
        {/* --- DÜZELTME BURADA --- */}
        {/* Yüzde gösterimi için `displayMultiplier` prop'unu ekliyoruz. */}
        {/* Bu prop, 0-1 aralığındaki değeri 0-100 aralığında gösterir. */}
        <ProfessionalKnob
          label="Mix"
          value={effect.settings.wet}
          onChange={(val) => onChange('wet', val)}
          min={0} max={1} defaultValue={1.0}
          size={60}
          unit="%"
          precision={0}
          displayMultiplier={100} 
        />
      </div>
    </PluginContainer>
  );
};