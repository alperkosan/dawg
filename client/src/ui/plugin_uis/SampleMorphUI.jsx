
import React, { useRef } from "react";
import { ProfessionalKnob, ProfessionalButton } from '../plugin_system/PluginControls';
import { Volume2, Zap, Rewind, Repeat } from "lucide-react";

export const SampleMorphUI = ({ trackId, effect, onChange, definition }) => {
  const { settings } = effect;
  const xyPadRef = useRef(null);

  const modes = [
    { id: "normal", icon: <Volume2 size={14} />, label: "Normal" },
    { id: "halftime", icon: <Zap size={14} />, label: "Half-Time" },
    { id: "reverse", icon: <Rewind size={14} />, label: "Reverse" },
    { id: "stutter", icon: <Repeat size={14} />, label: "Stutter" },
  ];

  const handleXYPadInteraction = (clientX, clientY) => {
      if (!xyPadRef.current) return;
      const rect = xyPadRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      onChange("randomness", x);
      onChange("retrigger", y);
  };

  return (
    <div className="flex flex-col justify-between h-full gap-4">
      <div className="flex justify-around bg-black/20 p-1 rounded-lg border border-white/10">
        {modes.map((m) => (
          <ProfessionalButton
            key={m.id}
            onClick={() => onChange("mode", m.id)}
            active={settings.mode === m.id}
            label={<span className="flex items-center gap-2">{m.icon} {m.label}</span>}
            size="sm"
          />
        ))}
      </div>
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-2">
          <div
            ref={xyPadRef}
            className="bg-black/20 rounded-lg w-48 h-48 relative cursor-crosshair border border-white/10"
            onMouseDown={(e) => {
                handleXYPadInteraction(e.clientX, e.clientY);
                const moveHandler = (moveEvent) => handleXYPadInteraction(moveEvent.clientX, moveEvent.clientY);
                window.addEventListener("mousemove", moveHandler);
                window.addEventListener("mouseup", () => window.removeEventListener("mousemove", moveHandler), { once: true });
            }}
          >
            <div
              className="absolute w-3 h-3 bg-blue-400 rounded-full shadow-lg pointer-events-none"
              style={{
                left: `${settings.randomness * 100}%`,
                top: `${(1 - settings.retrigger) * 100}%`,
                transform: "translate(-50%, -50%)",
                boxShadow: '0 0 10px 2px #60a5fa'
              }}
            />
            <div className="absolute bottom-1 right-2 text-[10px] text-white/50">Random →</div>
            <div className="absolute top-1 left-2 text-[10px] text-white/50 transform -rotate-90 origin-top-left">Retrigger →</div>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4 place-items-center">
          <ProfessionalKnob
            label="Grain Size"
            value={settings.grainSize}
            onChange={(v) => onChange("grainSize", v)}
            min={0.01} max={1} defaultValue={0.2}
            unit="s" precision={2} size={72}
          />
          <ProfessionalKnob
            label="Overlap"
            value={settings.overlap}
            onChange={(v) => onChange("overlap", v)}
            min={0} max={1} defaultValue={0.1}
            unit="%" precision={0} displayMultiplier={100} size={72}
          />
          <ProfessionalKnob
            label="Slice Length"
            value={settings.sliceLength}
            onChange={(v) => onChange("sliceLength", v)}
            min={0.05} max={1} defaultValue={1.0}
            unit="%" precision={0} displayMultiplier={100} size={72}
          />
        </div>
      </div>
    </div>
  );
};
