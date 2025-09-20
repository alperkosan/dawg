import React from 'react';
import WaveformDisplay from '../../sample_editor/WaveformDisplay';
import WaveEnvelopeEditor from '../../sample_editor/components/WaveEnvelopeEditor';
import { ImageOff, SlidersHorizontal } from 'lucide-react';

export const WaveformCanvas = ({ instrument, buffer, onEnvelopeChange }) => {
  return (
    <main className="waveform-canvas">
      <h2 className="panel-header">
        <SlidersHorizontal size={16}/> Waveform & Envelope
      </h2>
      <div className="waveform-canvas__content">
        {buffer ? (
          <div className="waveform-canvas__wrapper">
            <div className="waveform-canvas__display">
              <WaveformDisplay buffer={buffer} />
            </div>
            <div className="waveform-canvas__envelope">
              <WaveEnvelopeEditor
                buffer={buffer}
                envelope={instrument.envelope || {}}
                onEnvelopeChange={onEnvelopeChange}
              />
            </div>
          </div>
        ) : (
          <div className="waveform-canvas__placeholder">
            <ImageOff size={32} />
            <p>Ses verisi bulunamadı.</p>
            <p className="text-xs text-gray-500">Lütfen farklı bir sample seçin.</p>
          </div>
        )}
      </div>
    </main>
  );
};