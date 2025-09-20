import React, { useState } from 'react';
import { ImageOff, RotateCcw, Waves, ArrowLeftRight } from 'lucide-react';
import { WaveformV3 } from './WaveformV3';
import { WaveformToolbar } from './WaveformToolbar';
import { useInstrumentsStore } from '../../../store/useInstrumentsStore'; // store'u import ediyoruz

// Dikey araç çubuğu için buton bileşeni
const WorkbenchAction = ({ label, icon: Icon, isActive, onClick }) => (
  <button onClick={onClick} className={`workbench-action ${isActive ? 'active' : ''}`} title={label}>
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

export const WaveformWorkbench = ({ instrument, buffer }) => {
  const [activeTool, setActiveTool] = useState('select');
  const [selection, setSelection] = useState(null); // { start, end } in seconds
  const precomputed = instrument.precomputed || {};
  
  // onPrecomputedChange'i doğrudan store'dan alarak oluşturuyoruz
  const { updateInstrument } = useInstrumentsStore.getState();
  const onPrecomputedChange = (param, value) => {
    const newPrecomputed = { ...instrument.precomputed, [param]: value };
    updateInstrument(instrument.id, { precomputed: newPrecomputed }, true);
  };

  const handleToolbarAction = (action) => {
    console.log(`Toolbar eylemi: ${action}, Seçili Alan:`, selection);
    // Gelecekte Trim, Delete gibi işlemleri burada yöneteceğiz
  };

  return (
    <div className="waveform-workbench">
      {/* SOL DİKEY ARAÇ ÇUBUĞU */}
      <div className="waveform-workbench__toolbar">
        <WorkbenchAction label="Reverse" icon={RotateCcw} isActive={!!precomputed.reverse} onClick={() => onPrecomputedChange('reverse', !precomputed.reverse)} />
        <WorkbenchAction label="Normalize" icon={Waves} isActive={!!precomputed.normalize} onClick={() => onPrecomputedChange('normalize', !precomputed.normalize)} />
        <WorkbenchAction label="Invert" icon={ArrowLeftRight} isActive={!!precomputed.reversePolarity} onClick={() => onPrecomputedChange('reversePolarity', !precomputed.reversePolarity)} />
      </div>

      {/* SAĞ ANA BÖLÜM (YATAY TOOLBAR + WAVEFORM) */}
      <div className="waveform-workbench__main">
        <WaveformToolbar 
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onAction={handleToolbarAction}
        />
        <div className="waveform-workbench__canvas">
          {buffer ? (
            <WaveformV3
              buffer={buffer}
              tools={{ select: activeTool === 'select', slice: activeTool === 'slice' }}
            />
          ) : (
            <div className="waveform-workbench__placeholder">
              <ImageOff size={48} />
              <p>Ses Verisi Görüntülenemiyor</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};