import React from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

/**
 * Drive miktarını gösteren dikey, LED tarzı bir metre.
 */
const SaturationMeter = ({ drive }) => {
  const drivePercent = Math.min(100, (drive / 1.5) * 100);
  const segmentCount = 10;
  
  return (
    <div className="saturation-meter">
      {Array.from({ length: segmentCount }).map((_, i) => {
        const segmentActive = drivePercent > ((segmentCount - 1 - i) * 10);
        const style = {
          '--segment-color': `hsl(${Math.max(0, 60 - (drivePercent * 0.6))}, 100%, 50%)`,
          '--segment-opacity': segmentActive ? 1 : 0.2,
        };
        return <div key={i} className="saturation-meter__segment" style={style} />;
      })}
    </div>
  );
};

export const SaturatorUI = ({ effect, onChange }) => {
  const { distortion, wet } = effect.settings;

  return (
    <div className="saturator-ui-v3 plugin-content-layout">
      <SaturationMeter drive={distortion} />
      
      <ProfessionalKnob
        label="Drive"
        value={distortion}
        onChange={(val) => onChange('distortion', val)}
        min={0} max={1.5} defaultValue={0.4}
        size={110}
        precision={2}
      />

      <div className="saturator-ui-v3__side-controls">
        <ProfessionalKnob
          label="Mix"
          value={wet * 100}
          onChange={(val) => onChange('wet', val / 100)}
          min={0} max={100} defaultValue={100}
          unit="%" precision={0} size={64}
        />
      </div>
    </div>
  );
};