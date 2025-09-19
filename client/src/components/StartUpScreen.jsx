import React from 'react';
import { Wind, PlayCircle } from 'lucide-react';

function StartupScreen({ onStart }) {
  return (
    <div className="startup-screen">
      <div className="startup-screen__content">
        <div className="startup-screen__logo">
          <Wind size={64} strokeWidth={1} />
          <h1 className="startup-screen__title">SoundForge</h1>
        </div>
        <p className="startup-screen__subtitle">
          Minimalist. Zeki. "Cool". Yaratıcılığınıza odaklanın.
        </p>
        <button onClick={onStart} className="startup-screen__button">
          <PlayCircle size={24} />
          <span>Stüdyoya Gir</span>
        </button>
      </div>
    </div>
  );
}

export default StartupScreen;
