import React from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const ArcadeCrusherUI = ({ trackId, effect, onChange, definition }) => {
  
  const handleMixChange = (uiValue) => {
    onChange('wet', uiValue / 100);
  };

  return (
    <div className="flex items-center justify-center h-full gap-12">
      <ProfessionalKnob
        label="Bits"
        value={effect.settings.bits}
        onChange={(val) => onChange('bits', val)}
        min={1} max={16} defaultValue={4}
        precision={0} size={80}
      />
      <ProfessionalKnob
        label="Mix"
        value={effect.settings.wet * 100}
        onChange={handleMixChange}
        min={0} max={100} defaultValue={100}
        unit="%" precision={0} size={60}
      />
    </div>
  );
};