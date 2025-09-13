import React from 'react';
// YENİ: Profesyonel sistem bileşenlerini import ediyoruz
import PluginContainer from '../plugin_system/PluginContainer';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const ReverbUI = ({ trackId, effect, onChange, definition }) => {
  return (
    // Arayüz artık PluginContainer ile sarmalanıyor.
    // Bypass, preset yönetimi gibi özellikler artık buradan geliyor.
    <PluginContainer
      trackId={trackId}
      effect={effect}
      definition={definition}
    >
      <div className="flex items-center justify-center h-full gap-8">
        {/* Mevcut VolumeKnob'lar, ProfessionalKnob ile değiştirildi */}
        <ProfessionalKnob
          label="Decay"
          value={effect.settings.decay}
          onChange={(val) => onChange('decay', val)}
          min={0.1} max={15} defaultValue={2.5}
          size={80} // Ana kontrol olduğu için daha büyük
          logarithmic={true} // Decay algısal olarak logaritmiktir
          unit="s"
          precision={2}
        />
        <ProfessionalKnob
          label="Pre-Delay"
          value={effect.settings.preDelay}
          onChange={(val) => onChange('preDelay', val)}
          min={0} max={0.2} defaultValue={0.01}
          size={60}
          unit="s"
          precision={3}
        />
        <ProfessionalKnob
          label="Mix"
          value={effect.settings.wet}
          onChange={(val) => onChange('wet', val)}
          min={0} max={1} defaultValue={0.4}
          size={60}
          unit="%"
          precision={0} // Yüzde için ondalık göstermiyoruz
        />
      </div>
    </PluginContainer>
  );
};