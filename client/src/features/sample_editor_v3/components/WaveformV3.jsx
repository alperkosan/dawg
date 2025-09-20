import React, { useRef } from 'react';
import { useWavesurfer } from '../hooks/useWavesurfer';

export const WaveformV3 = ({ buffer }) => {
  const containerRef = useRef(null);
  const wavesurferInstance = useWavesurfer(containerRef, buffer);

  return (
    <div className="waveform-v3-container">
      <div ref={containerRef} className="waveform-v3-canvas" />
    </div>
  );
};