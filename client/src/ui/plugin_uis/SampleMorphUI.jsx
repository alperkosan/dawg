import React, { useRef } from "react"; // useRef'i import ediyoruz
import { Sliders, Volume2, Zap, Rewind, Repeat } from "lucide-react";
import VolumeKnob from '../VolumeKnob';
import { PresetManager } from '../PresetManager';

const LaserSlider = ({ value, min, max, step, onChange, label }) => {
    const handleChange = (e) => {
      onChange(parseFloat(e.target.value));
    };

    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-2 text-center font-mono">{label}</label>
            <div className="relative flex items-center">
                <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={handleChange}
                    className="w-full h-1 bg-gray-950 rounded-lg appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, #818cf8 ${percentage}%, #374151 ${percentage}%)` }}
                />
            </div>
        </div>
    );
};

export const SampleMorphUI = ({ effect, onChange, definition }) => {
  const settings = effect.settings;
  const xyPadRef = useRef(null); // YENİ: XY Pad için bir referans oluşturuyoruz.

  const modes = [
    { id: "normal", icon: <Volume2 size={16} />, label: "Normal" },
    { id: "halftime", icon: <Zap size={16} />, label: "Half-Time" },
    { id: "reverse", icon: <Rewind size={16} />, label: "Reverse" },
    { id: "stutter", icon: <Repeat size={16} />, label: "Stutter" },
  ];

  // HATA DÜZELTİLDİ: Fonksiyon artık tam event objesi yerine sadece mouse koordinatlarını alıyor.
  const handleXYPadInteraction = (clientX, clientY) => {
      // Referans üzerinden div'in pozisyonunu ve boyutlarını alıyoruz.
      if (!xyPadRef.current) return;
      const rect = xyPadRef.current.getBoundingClientRect();

      // Değerleri sınırlar içinde tutmak için (0 ile 1 arası)
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));

      onChange("randomness", x);
      onChange("retrigger", y);
  };

  return (
    <div className="relative w-full h-full p-4 bg-gray-900 rounded-lg flex flex-col gap-4 border-2 border-gray-950
                    bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 to-gray-900 text-gray-200 font-mono">
      <PresetManager 
        pluginType={definition.type} 
        effect={effect}
        factoryPresets={definition.presets} 
        onChange={onChange}
      />

      <div className="w-full text-center pt-8">
        <h3 className="text-xl font-bold text-indigo-300" style={{ textShadow: '1px 1px #4f46e5' }}>{definition.type}</h3>
        <p className="text-xs text-center text-gray-500 max-w-xs px-2 mt-1 mx-auto">{definition.story}</p>
      </div>

      <div className="flex justify-around bg-gray-950/70 p-1 rounded-lg border border-indigo-900/50">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange("mode", m.id)}
            className={`flex items-center justify-center gap-2 w-full py-2 rounded-md text-xs font-bold transition-all duration-200 ${
              settings.mode === m.id
                ? "bg-indigo-600 text-white shadow-[0_0_10px_0px_rgba(129,140,248,0.5)]"
                : "hover:bg-slate-700 text-gray-400"
            }`}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-4">
        {/* YENİ: ref'i div'e ekliyoruz */}
        <div 
          ref={xyPadRef}
          className="bg-gray-950/70 rounded-lg w-48 h-48 relative cursor-crosshair border border-indigo-900/50"
          onMouseDown={(e) => {
              // HATA DÜZELTİLDİ: Fonksiyona event yerine sadece koordinatları geçiyoruz.
              handleXYPadInteraction(e.clientX, e.clientY);
              
              const moveHandler = (moveEvent) => {
                  handleXYPadInteraction(moveEvent.clientX, moveEvent.clientY);
              };

              window.addEventListener("mousemove", moveHandler);
              window.addEventListener("mouseup", () => {
                  window.removeEventListener("mousemove", moveHandler);
              }, { once: true });
          }}
        >
          <div
            className="absolute w-3 h-3 bg-indigo-400 rounded-full shadow-lg pointer-events-none"
            style={{
              left: `${settings.randomness * 100}%`,
              top: `${(1 - settings.retrigger) * 100}%`,
              transform: "translate(-50%, -50%)",
              boxShadow: '0 0 10px 2px #818cf8'
            }}
          />
          <div className="absolute bottom-1 right-2 text-[10px] text-gray-500">
            Randomness →
          </div>
          <div className="absolute top-1 left-2 text-[10px] text-gray-500 transform -rotate-90 origin-top-left">
            Retrigger →
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-around items-center">
          <VolumeKnob
            label="Grain Size"
            size={60}
            value={settings.grainSize}
            min={0.01} max={1} defaultValue={0.2}
            onChange={(v) => onChange("grainSize", v)}
          />
          <VolumeKnob
            label="Overlap"
            size={60}
            value={settings.overlap}
            min={0} max={1} defaultValue={0.1}
            onChange={(v) => onChange("overlap", v)}
          />
        </div>
      </div>
      
      <LaserSlider
        label="Slice Length"
        value={settings.sliceLength}
        min={0.05} max={1} step={0.01}
        onChange={(v) => onChange("sliceLength", v)}
      />
    </div>
  );
};