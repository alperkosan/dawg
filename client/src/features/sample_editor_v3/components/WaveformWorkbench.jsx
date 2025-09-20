import React from 'react';
import { RotateCcw, Waves, ArrowLeftRight, ImageOff } from 'lucide-react';
import { WaveformV3 } from './WaveformV3';

const WorkbenchAction = ({ label, icon: Icon, isActive, onClick }) => (
  <button onClick={onClick} className={`workbench-action ${isActive ? 'workbench-action--active' : ''}`}>
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

export const WaveformWorkbench = ({ instrument, buffer, onPrecomputedChange }) => {
  const precomputed = instrument.precomputed || {};
  // --- LOG 5: Workbench render olduğunda buffer'ın durumunu kontrol edelim ---
  console.log('[LOG 5] WaveformWorkbench render oldu. Gelen buffer:', buffer ? `ToneAudioBuffer (Süre: ${buffer.duration.toFixed(2)}s)` : 'null veya undefined');

  return (
    <div className="waveform-workbench">
      <div className="waveform-workbench__toolbar">
        <WorkbenchAction label="Reverse" icon={RotateCcw} isActive={!!precomputed.reverse} onClick={() => onPrecomputedChange('reverse', !precomputed.reverse)} />
        <WorkbenchAction label="Normalize" icon={Waves} isActive={!!precomputed.normalize} onClick={() => onPrecomputedChange('normalize', !precomputed.normalize)} />
        <WorkbenchAction label="Invert" icon={ArrowLeftRight} isActive={!!precomputed.reversePolarity} onClick={() => onPrecomputedChange('reversePolarity', !precomputed.reversePolarity)} />
      </div>
      <div className="waveform-workbench__canvas">
        {buffer ? (
          <WaveformV3 buffer={buffer} />
        ) : (
          <div className="waveform-workbench__placeholder">
            <ImageOff size={48} />
            <p>Ses Verisi Görüntülenemiyor</p>
          </div>
        )}
      </div>
    </div>
  );
};