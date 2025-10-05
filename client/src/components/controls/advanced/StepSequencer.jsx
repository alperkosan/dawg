/**
 * STEP SEQUENCER
 *
 * 16-step sequencer grid
 */

import React from 'react';
import { useControlTheme } from '../useControlTheme';

export const StepSequencer = ({
  steps = Array(16).fill(false),
  onStepChange,
  activeStep = -1,
  columns = 16,
  variant = 'default',
  disabled = false,
  className = '',
}) => {
  const { colors } = useControlTheme(variant);

  const toggleStep = (index) => {
    if (disabled) return;
    const newSteps = [...steps];
    newSteps[index] = !newSteps[index];
    onStepChange?.(newSteps, index);
  };

  return (
    <div className={`inline-flex gap-1 ${className}`}>
      {steps.map((active, index) => (
        <button
          key={index}
          onClick={() => toggleStep(index)}
          disabled={disabled}
          className={`
            w-8 h-12 rounded transition-all
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}
            ${index % 4 === 0 ? 'ml-1' : ''}
          `}
          style={{
            backgroundColor: active ? colors.fill : colors.background,
            border: `2px solid ${activeStep === index ? colors.indicator : colors.border}`,
            boxShadow: active ? `0 0 8px ${colors.fillGlow}` : 'none',
          }}
        />
      ))}
    </div>
  );
};
