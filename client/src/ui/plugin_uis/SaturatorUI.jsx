import React from 'react';
// YENİ: Profesyonel sistem bileşenlerini import ediyoruz
import PluginContainer from '../plugin_system/PluginContainer';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

// GÜNCELLENDİ: Component artık trackId ve effect gibi tüm gerekli bilgileri alıyor
export const SaturatorUI = ({ trackId, effect, onChange, definition }) => {
  
  // Arayüz artık PluginContainer ile sarmalanıyor.
  // Bypass, preset yönetimi gibi özellikler artık buradan geliyor.
  return (
    <PluginContainer
      trackId={trackId}
      effect={effect}
      definition={definition}
    >
      <div className="flex items-center justify-center h-full gap-8">
        {/* Mevcut VolumeKnob'lar, ProfessionalKnob ile değiştirildi */}
        <ProfessionalKnob 
          label="Drive"
          value={effect.settings.distortion}
          onChange={(val) => onChange('distortion', val)}
          min={0} max={1} defaultValue={0.4}
          size={80} // Daha büyük bir ana kontrol
        />
        <ProfessionalKnob 
          label="Mix"
          value={effect.settings.wet}
          onChange={(val) => onChange('wet', val)}
          min={0} max={1} defaultValue={1.0}
          size={60}
          unit="%"
          precision={0} // Yüzde için ondalık gösterme
        />
      </div>
    </PluginContainer>
  );
};