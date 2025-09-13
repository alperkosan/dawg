import React from 'react';
import PluginContainer from '../plugin_system/PluginContainer';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const OrbitPannerUI = ({ trackId, effect, onChange, definition }) => {

  const handleDepthChange = (uiValue) => {
    onChange('depth', uiValue / 100);
  };
  
  const handleMixChange = (uiValue) => {
    onChange('wet', uiValue / 100);
  };

  return (
    <div className="flex items-center justify-center h-full gap-8">
      <ProfessionalKnob
        label="Rate"
        value={effect.settings.frequency}
        onChange={(val) => onChange('frequency', val)}
        min={0.1} max={10} defaultValue={2}
        unit=" Hz" precision={2} size={80}
      />
      <ProfessionalKnob
        label="Depth"
        value={effect.settings.depth * 100}
        onChange={handleDepthChange}
        min={0} max={100} defaultValue={100}
        unit="%" precision={0} size={60}
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