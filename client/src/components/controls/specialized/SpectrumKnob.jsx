/**
 * SPECTRUM KNOB
 *
 * Knob with integrated mini spectrum analyzer
 * Perfect for filter frequency controls
 */

import React, { useRef, useEffect } from 'react';
import { Knob } from '../base/Knob';

export const SpectrumKnob = ({
  analyserNode,
  ...knobProps
}) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyserNode.getByteFrequencyData(dataArray);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = width / 16;
      for (let i = 0; i < 16; i++) {
        const value = dataArray[i] / 255;
        const barHeight = value * height;

        const hue = 120 - (value * 60); // Green to yellow
        ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [analyserNode]);

  return (
    <div className="relative inline-block">
      <Knob {...knobProps} />
      {analyserNode && (
        <canvas
          ref={canvasRef}
          width={knobProps.size || 60}
          height={20}
          className="absolute -bottom-6 left-0"
          style={{ opacity: 0.6 }}
        />
      )}
    </div>
  );
};
