import React from 'react';
import * as Tone from 'tone';

const Note = React.memo(({ note, noteToY, stepToX, keyHeight, stepWidth }) => {
  // Nota süresini (örn: "4n", "8t") piksel genişliğine çevir
  const durationInSeconds = Tone.Time(note.duration).toSeconds();
  const secondsPerStep = Tone.Time('16n').toSeconds();
  const durationInSteps = durationInSeconds / secondsPerStep;
  const width = durationInSteps * stepWidth;
  
  const y = noteToY(note.pitch);
  const x = stepToX(note.time);

  // Velocity'e göre opaklık ayarı
  const opacity = 0.6 + (note.velocity * 0.4);

  return (
    <div
      className="absolute bg-cyan-500 border border-cyan-300 rounded hover:border-white cursor-pointer flex items-center justify-end pr-1"
      style={{
        left: x,
        top: y,
        height: keyHeight,
        width: width,
        opacity: opacity,
        boxShadow: `0 0 10px rgba(56, 189, 248, ${opacity * 0.5})`
      }}
    >
        {/* İleride velocity ayarı için bir handle eklenebilir */}
    </div>
  );
});

export default Note;