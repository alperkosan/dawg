import * as Tone from 'tone';

export const quantizeTime = (time, snapValue = '16n') => {
  try {
    const snapSteps = Tone.Time(snapValue).toSeconds() / Tone.Time('16n').toSeconds();
    return Math.round(time / snapSteps) * snapSteps;
  } catch (error) {
    console.warn('Invalid snap value:', snapValue);
    return Math.round(time);
  }
};

export const quantizeNotes = (notes, snapValue = '16n') => {
  return notes.map(note => ({
    ...note,
    time: quantizeTime(note.time, snapValue)
  }));
};

export const humanizeNotes = (notes, options = {}) => {
  const {
    timingAmount = 0.1,     // ±0.05 steps timing variation
    velocityAmount = 0.1,   // ±0.05 velocity variation
    preserveGroove = true   // Keep downbeats precise
  } = options;
  
  return notes.map(note => {
    // Less humanization on downbeats if preserveGroove is true
    const isDownbeat = preserveGroove && note.time % 4 === 0;
    const timingFactor = isDownbeat ? 0.3 : 1.0;
    const velocityFactor = isDownbeat ? 0.5 : 1.0;
    
    const timingVariation = (Math.random() - 0.5) * timingAmount * timingFactor;
    const velocityVariation = (Math.random() - 0.5) * velocityAmount * velocityFactor;
    
    return {
      ...note,
      time: Math.max(0, note.time + timingVariation),
      velocity: Math.max(0.1, Math.min(1, note.velocity + velocityVariation))
    };
  });
};

export const swingQuantize = (notes, swingAmount = 0.67, snapValue = '8n') => {
  return notes.map(note => {
    const quantizedTime = quantizeTime(note.time, snapValue);
    const beatPosition = quantizedTime % 2; // Position within a beat
    
    if (beatPosition === 1) {
      // Apply swing to off-beats
      const swingOffset = (swingAmount - 0.5) * 0.5; // Convert to offset
      return {
        ...note,
        time: quantizedTime + swingOffset
      };
    }
    
    return {
      ...note,
      time: quantizedTime
    };
  });
};
