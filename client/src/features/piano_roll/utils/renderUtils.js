import { GRID_COLORS } from './constants';

export const renderGrid = (ctx, options) => {
  const { width, height, stepWidth, keyHeight, scale, snapSettings } = options;
  
  ctx.clearRect(0, 0, width, height);
  
  // Scale highlighting
  if (scale.showHighlighting) {
    const scaleNotes = scale.getScaleNotes();
    ctx.fillStyle = GRID_COLORS.scaleHighlight;
    
    const totalKeys = Math.floor(height / keyHeight);
    for (let i = 0; i < totalKeys; i++) {
      const noteIndex = (totalKeys - 1 - i) % 12;
      if (!scaleNotes.has(noteIndex)) {
        ctx.fillRect(0, i * keyHeight, width, keyHeight);
      }
    }
  }
  
  // Vertical grid lines
  const barWidth = stepWidth * 16;
  const beatWidth = stepWidth * 4;
  const totalBars = Math.ceil(width / barWidth);
  
  for (let bar = 0; bar < totalBars; bar++) {
    // Bar lines
    ctx.strokeStyle = GRID_COLORS.bar;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bar * barWidth, 0);
    ctx.lineTo(bar * barWidth, height);
    ctx.stroke();
    
    // Beat lines
    for (let beat = 1; beat < 4; beat++) {
      ctx.strokeStyle = GRID_COLORS.beat;
      ctx.beginPath();
      ctx.moveTo(bar * barWidth + beat * beatWidth, 0);
      ctx.lineTo(bar * barWidth + beat * beatWidth, height);
      ctx.stroke();
    }
    
    // Subdivision lines (if zoomed in enough)
    if (stepWidth > 20) {
      for (let step = 1; step < 16; step++) {
        if (step % 4 !== 0) { // Skip beat lines
          ctx.strokeStyle = GRID_COLORS.subdivision;
          ctx.beginPath();
          ctx.moveTo(bar * barWidth + step * stepWidth, 0);
          ctx.lineTo(bar * barWidth + step * stepWidth, height);
          ctx.stroke();
        }
      }
    }
  }
  
  // Horizontal lines (piano keys)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= Math.floor(height / keyHeight); i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * keyHeight);
    ctx.lineTo(width, i * keyHeight);
    ctx.stroke();
  }
};

export const renderPlayhead = (ctx, position, height) => {
  ctx.strokeStyle = '#00bcd4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(position, 0);
  ctx.lineTo(position, height);
  ctx.stroke();
};

export const renderVelocityBars = (ctx, notes, viewport, selectedNotes, height) => {
  notes.forEach(note => {
    const x = viewport.timeToX(note.time);
    const barHeight = Math.max(2, note.velocity * height);
    const isSelected = selectedNotes.has(note.id);
    
    ctx.fillStyle = isSelected ? '#00bcd4' : '#3b82f6';
    ctx.globalAlpha = isSelected ? 1 : 0.7;
    
    const barWidth = viewport.stepWidth * 0.6;
    const barX = x + viewport.stepWidth * 0.2;
    
    ctx.fillRect(barX, height - barHeight, barWidth, barHeight);
  });
  
  ctx.globalAlpha = 1;
};