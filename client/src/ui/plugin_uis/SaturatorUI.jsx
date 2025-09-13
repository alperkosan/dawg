import React from 'react';
import { ProfessionalKnob } from '../../ui/plugin_system/PluginControls';

// Bu bileşen artık sadece kendine özgü kontrolleri render ediyor.
// Çerçeve (Container), Presetler ve Bypass mantığı bir üst katmanda (EffectsTab) yönetiliyor.
export const SaturatorUI = ({ effect, onChange, definition }) => {
  return (
    <div className="flex items-center justify-around w-full h-full">
      <ProfessionalKnob
        label="Drive"
        value={effect.settings.distortion}
        onChange={(val) => onChange('distortion', val)}
        min={0} max={40} defaultValue={10}
        unit="dB"
      />
      <ProfessionalKnob
        label="Mix"
        value={effect.settings.wet * 100}
        onChange={(val) => onChange('wet', val / 100)}
        min={0} max={100} defaultValue={100}
        unit="%"
        precision={0}
      />
    </div>
  );
};

