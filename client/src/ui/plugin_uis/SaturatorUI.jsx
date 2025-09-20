import React from 'react';
import { ProfessionalKnob } from '../../ui/plugin_system/PluginControls';
import { PluginTypography } from '../../ui/plugin_system/PluginDesignSystem';

// Eklentinin ana işlevini görselleştiren yeni bileşenimiz
const DriveMeter = ({ drive, min, max }) => {
  const drivePercent = Math.max(0, Math.min(100, ((drive - min) / (max - min)) * 100));
  
  return (
    <div className="drive-meter">
      <div 
        className="drive-meter__bar"
        style={{ height: `${drivePercent}%` }}
      />
      <div className="drive-meter__ticks">
        <span className="drive-meter__tick">{max}</span>
        <span className="drive-meter__tick">{min}</span>
      </div>
    </div>
  );
};

// Saturator arayüzünün son hali
export const SaturatorUI = ({ effect, onChange }) => {
  const { distortion, wet } = effect.settings;

  // Knob'ların min/max değerleri
  const driveMin = 0;
  const driveMax = 1.5; // Daha geniş bir aralık
  const mixMin = 0;
  const mixMax = 100;

  return (
    <div className="saturator-ui">
      {/* İkincil Kontrol: Mix */}
      <ProfessionalKnob
        label="Mix"
        value={wet * 100}
        onChange={(val) => onChange('wet', val / 100)}
        min={mixMin}
        max={mixMax}
        defaultValue={100}
        unit="%"
        precision={0}
        size={80} // Daha küçük
      />

      {/* Ana Kontrol: Drive */}
      <ProfessionalKnob
        label="Drive"
        value={distortion}
        onChange={(val) => onChange('distortion', val)}
        min={driveMin}
        max={driveMax}
        defaultValue={0.4}
        size={120} // Ana kontrol olduğu için daha büyük
        precision={2}
      />

      {/* Görsel Geri Bildirim: Drive Meter */}
      <DriveMeter drive={distortion} min={driveMin} max={driveMax} />
    </div>
  );
};