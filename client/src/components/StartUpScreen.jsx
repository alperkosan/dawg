import React from 'react';
import { Wind, PlayCircle } from 'lucide-react';

function StartupScreen({ onStart }) {
  return (
    <div className="bg-gray-900 text-white h-screen flex flex-col items-center justify-center font-sans">
      <div className="text-center flex flex-col items-center">
        <div className="flex items-center justify-center space-x-4 text-cyan-400 mb-4">
          <Wind size={64} strokeWidth={1.5} />
          <h1 className="font-bold text-6xl">DAW Projesi</h1>
        </div>
        <p className="text-gray-400 mb-12">Tarayıcı tabanlı modern müzik prodüksiyonu.</p>
        <button
          onClick={onStart}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-4 px-8 rounded-lg text-xl flex items-center justify-center gap-3 transition-all duration-200 transform hover:scale-105 shadow-[0_0_20px_0px_rgba(56,189,248,0.4)]"
        >
          <PlayCircle size={28} />
          <span>Stüdyoya Gir</span>
        </button>
      </div>
    </div>
  );
}

export default StartupScreen;
