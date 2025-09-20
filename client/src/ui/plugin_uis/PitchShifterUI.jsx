import React from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';

export const PitchShifterUI = ({ trackId, effect, onChange, definition }) => {
  
  // YENİ: Akıllı arayüz mantığı
  // Bu fonksiyon, UI'dan gelen 0-100 aralığındaki değeri,
  // ses motorunun beklediği 0-1 aralığına çevirir.
  const handleMixChange = (uiValue) => {
    const audioEngineValue = uiValue / 100;
    onChange('wet', audioEngineValue);
  };

  return (
    <div className="flex items-center justify-center h-full gap-8">
      <ProfessionalKnob
        label="Pitch"
        value={effect.settings.pitch}
        onChange={(val) => onChange('pitch', val)}
        min={-12} max={12} defaultValue={0}
        size={80}
        unit=" st"
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
      {/* DÜZELTİLMİŞ KULLANIM */}
      <ProfessionalKnob
        label="Mix"
        // Değeri UI için 100 ile çarpıyoruz.
        value={effect.settings.wet * 100} 
        // Değişiklik olduğunda kendi çevrim fonksiyonumuzu çağırıyoruz.
        onChange={handleMixChange} 
        min={0} max={100} defaultValue={100}
        size={60}
        unit="%"
        precision={0}
      />
    </div>
  );
};