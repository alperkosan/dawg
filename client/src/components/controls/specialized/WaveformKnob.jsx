/**
 * WAVEFORM KNOB
 *
 * Knob with waveform display showing saturation/distortion
 */

import React from 'react';
import { Knob } from '../base/Knob';

export const WaveformKnob = ({
  transferFunction, // (input) => output
  ...knobProps
}) => {
  const size = knobProps.size || 60;

  // Generate waveform path
  const generatePath = () => {
    if (!transferFunction) return '';

    const points = 50;
    let path = '';

    for (let i = 0; i <= points; i++) {
      const x = (i / points) * size;
      const input = (i / points) * 2 - 1; // -1 to 1
      const output = transferFunction(input);
      const y = (size / 2) - (output * size / 2);

      path += `${i === 0 ? 'M' : 'L'} ${x},${y} `;
    }

    return path;
  };

  return (
    <div className="relative inline-block">
      <Knob {...knobProps} />
      {transferFunction && (
        <svg
          width={size}
          height={size}
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.3 }}
        >
          <path
            d={generatePath()}
            fill="none"
            stroke={knobProps.variant === 'accent' ? '#fb923c' : '#FFD700'}
            strokeWidth="2"
          />
        </svg>
      )}
    </div>
  );
};
