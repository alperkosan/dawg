import React, { useRef, useEffect, useState } from 'react';
import { ProfessionalKnob } from '../plugin_system/PluginControls';
import { MeteringService } from '../../lib/core/MeteringService';

const LfoPulsar = ({ rate, depth, gain }) => {
  // Gelen gain değerini 0-1 arasına normalize et
  const normalizedGain = (Math.max(-60, gain) + 60) / 66;
  
  const pulsarStyle = {
    '--pulsar-duration': `${1 / rate}s`,
    '--pulsar-size': `${50 + depth * 50}%`,
    // Sinyal gücüne göre opaklık ve parlaklığı ayarla
    '--pulsar-opacity': `${0.3 + normalizedGain * 0.7}`,
    '--pulsar-brightness': `${1 + normalizedGain * 0.5}`,
  };
  return <div className="lfo-pulsar" style={pulsarStyle} />;
};

export const StardustChorusUI = ({ trackId, effect, onChange }) => {
  const { frequency, depth, wet } = effect.settings;
  const [inputLevel, setInputLevel] = useState(-60);

  // MeteringService'e abone ol
  useEffect(() => {
    const meterId = `${trackId}-input`;
    const handleLevel = (db) => setInputLevel(db);
    MeteringService.subscribe(meterId, handleLevel);
    return () => MeteringService.unsubscribe(meterId, handleLevel);
  }, [trackId]);

  return (
    <div className="chorus-ui-v2 plugin-content-layout">
      <ProfessionalKnob label="Depth" value={depth * 100} onChange={(val) => onChange('depth', val / 100)} min={0} max={100} defaultValue={70} unit="%" precision={0} size={80} />
      <div className="chorus-ui-v2__main-control">
        <LfoPulsar rate={frequency} depth={depth} gain={inputLevel} />
        <ProfessionalKnob label="Rate" value={frequency} onChange={(val) => onChange('frequency', val)} min={0.1} max={10} defaultValue={1.5} unit=" Hz" precision={2} size={110} />
      </div>
      <ProfessionalKnob label="Mix" value={wet * 100} onChange={(val) => onChange('wet', val / 100)} min={0} max={100} defaultValue={50} unit="%" precision={0} size={80} />
    </div>
  );
};