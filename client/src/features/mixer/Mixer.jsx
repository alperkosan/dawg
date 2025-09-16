// src/features/mixer/Mixer.jsx - GÜNCELLENMİŞ VE HATASI GİDERİLMİŞ VERSİYON

import React, { useRef, useMemo, useEffect, useState } from 'react';
import MixerChannel from './MixerChannel';
import { useMixerStore } from '../../store/useMixerStore';
import { MeteringService } from '../../lib/core/MeteringService';
import { Settings, Plus, Save, FolderOpen } from 'lucide-react';

// --- SendCables Bileşeni Düzeltmesi ---
// Artık 'sends' prop'una ihtiyacı yok, çünkü bu bilgi 'mixerTracks' içinde mevcut.
const SendCables = React.memo(({ containerRef, mixerTracks, activeChannelId }) => {
  const [cablePositions, setCablePositions] = useState([]);

  const calculateCablePositions = () => {
    if (!containerRef.current || !activeChannelId) return [];
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const activeTrack = mixerTracks.find(t => t.id === activeChannelId);
    if (!activeTrack?.sends?.length) return [];

    return activeTrack.sends.map(send => {
      const fromElement = container.querySelector(`[data-track-id="${activeChannelId}"]`);
      const toElement = container.querySelector(`[data-track-id="${send.busId}"]`);
      if (!fromElement || !toElement) return null;
      
      const fromRect = fromElement.getBoundingClientRect();
      const toRect = toElement.getBoundingClientRect();
      
      return {
        id: `${activeChannelId}->${send.busId}`,
        x1: fromRect.left - containerRect.left + fromRect.width / 2,
        y1: fromRect.bottom - containerRect.top,
        x2: toRect.left - containerRect.left + toRect.width / 2,
        y2: toRect.top - containerRect.top,
        level: send.level,
        active: send.level > -60
      };
    }).filter(Boolean);
  };

  useEffect(() => {
    const updateCables = () => setCablePositions(calculateCablePositions());
    updateCables();
    window.addEventListener('resize', updateCables);
    return () => window.removeEventListener('resize', updateCables);
    // DÜZELTME: Bağımlılıklardan kaldırılan 'sends' prop'u çıkarıldı.
  }, [activeChannelId, mixerTracks]);

  if (!cablePositions.length) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {cablePositions.map(cable => {
        if (!cable.active) return null;
        const controlOffset = Math.abs(cable.y2 - cable.y1) * 0.5;
        const path = `M ${cable.x1} ${cable.y1} C ${cable.x1} ${cable.y1 + controlOffset}, ${cable.x2} ${cable.y2 - controlOffset}, ${cable.x2} ${cable.y2}`;
        const opacity = Math.max(0.3, (cable.level + 60) / 60);
        const strokeWidth = Math.max(1, (cable.level + 60) / 30);
        
        return (
          <g key={cable.id}>
            <path d={path} stroke="rgba(56, 189, 248, 0.3)" strokeWidth={strokeWidth + 2} fill="none" className="animate-pulse" />
            <path d={path} stroke="rgb(56, 189, 248)" strokeWidth={strokeWidth} fill="none" opacity={opacity} strokeDasharray={cable.level < -40 ? "4 4" : "none"} />
          </g>
        );
      })}
    </svg>
  );
});

// MasterSection ve GlobalSettingsPanel bileşenlerinde değişiklik yok.
const MasterSection = React.memo(({ masterTrack, audioEngineRef }) => {
  const { handleMixerParamChange } = useMixerStore.getState();
  const [masterLevel, setMasterLevel] = useState(-60);
  const [isLimiting, setIsLimiting] = useState(false);

  useEffect(() => {
    const meterId = `${masterTrack.id}-output`;
    const handleMasterLevel = (level) => {
      const dbLevel = typeof level === 'number' ? (level > 0 ? 20 * Math.log10(level) : -60) : -60;
      setMasterLevel(Math.max(-60, Math.min(6, dbLevel)));
      setIsLimiting(dbLevel > -0.5);
    };
    MeteringService.subscribe(meterId, handleMasterLevel);
    return () => MeteringService.unsubscribe(meterId, handleMasterLevel);
  }, [masterTrack.id]);

  const handleMasterVolumeChange = (value) => {
    handleMixerParamChange(masterTrack.id, 'volume', value, audioEngineRef.current);
  };

  return (
    <div className="master-section bg-gradient-to-b from-gray-800 to-gray-900 border-l-2 border-cyan-500 p-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-cyan-400">MASTER</h3>
        {isLimiting && (<div className="text-xs text-red-400 animate-pulse">LIMITING</div>)}
      </div>
      <div className="flex justify-center gap-2 mb-4">
        <div className="master-meter w-8 h-32 bg-gray-900 rounded-lg relative overflow-hidden">
          <div className={`absolute bottom-0 left-0 right-0 transition-all duration-75 ${masterLevel > 0 ? 'bg-red-500' : masterLevel > -6 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ height: `${Math.max(0, ((masterLevel + 60) / 66) * 100)}%` }} />
          {[0, -6, -12, -18, -24].map(db => (<div key={db} className="absolute left-0 right-0 h-px bg-gray-600" style={{ bottom: `${((db + 60) / 66) * 100}%` }} />))}
          <div className="absolute -right-6 top-0 text-[10px] text-gray-400">0</div>
          <div className="absolute -right-8 bottom-0 text-[10px] text-gray-400">-60</div>
        </div>
        <div className="flex flex-col justify-between text-xs font-mono">
          <div className={`p-1 rounded ${masterLevel > -0.5 ? 'bg-red-900 text-red-400' : 'bg-gray-800 text-gray-400'}`}>{masterLevel > -59 ? masterLevel.toFixed(1) : '---'}dB</div>
          <div className="text-gray-500">PEAK</div>
        </div>
      </div>
      <div className="flex justify-center mb-4">
        <div className="relative">
          <input type="range" min={-60} max={6} step={0.1} value={masterTrack.volume} onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))} className="master-fader h-32 w-8 bg-gray-700 rounded-lg appearance-none cursor-pointer" orient="vertical" style={{ background: `linear-gradient(to top, #ef4444 0%, #eab308 15%, #22c55e 30%, #1f2937 ${((masterTrack.volume + 60) / 66) * 100}%, #1f2937 100%)` }} />
          <div className="absolute -bottom-6 left-0 right-0 text-center text-xs text-gray-400">{masterTrack.volume.toFixed(1)}dB</div>
        </div>
      </div>
      <div className="space-y-2">
        <button className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded transition-colors">PANIC</button>
        <button className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors">Reset All</button>
      </div>
    </div>
  );
});

const GlobalSettingsPanel = React.memo(({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute top-12 right-4 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50 p-4">
        {/* İçerik aynı kalabilir */}
    </div>
  );
});


// Ana Mixer Bileşeni
function Mixer({ audioEngineRef }) {
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  const activeChannelId = useMixerStore(state => state.activeChannelId);
  // DÜZELTME: Bu satırı kaldırıyoruz, çünkü 'sends' artık burada değil.
  // const sends = useMixerStore(state => state.sends);
  
  const containerRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);

  const { masterTracks, trackChannels, busChannels } = useMemo(() => {
    return {
      masterTracks: mixerTracks.filter(t => t.type === 'master'),
      trackChannels: mixerTracks.filter(t => t.type === 'track'),
      busChannels: mixerTracks.filter(t => t.type === 'bus'),
    };
  }, [mixerTracks]);
  
  // DÜZELTME: Aktif send'lerin sayısını 'mixerTracks' üzerinden hesaplıyoruz.
  const activeSendsCount = useMemo(() => {
    return mixerTracks.reduce((acc, track) => acc + (track.sends?.length || 0), 0);
  }, [mixerTracks]);


  return (
    <div className="enhanced-mixer w-full h-full flex flex-col">
      <div className="mixer-toolbar bg-gray-800 border-b border-gray-700 p-2 flex justify-between items-center">
        {/* Toolbar içeriği aynı kalabilir */}
      </div>

      <div className="mixer-main flex-grow flex relative overflow-x-auto">
        <div 
          ref={containerRef}
          className="mixer-channels flex h-full"
          style={{ backgroundColor: 'var(--color-background)', padding: 'var(--padding-container)', gap: 'var(--gap-container)', minWidth: 'fit-content' }}
        >
          {/* DÜZELTME: SendCables bileşenine artık 'sends' prop'unu geçmiyoruz. */}
          <SendCables 
            containerRef={containerRef}
            mixerTracks={mixerTracks}
            activeChannelId={activeChannelId}
          />
          {masterTracks.map(master => (<div key={master.id} data-track-id={master.id} className="master-wrapper"><MasterSection masterTrack={master} audioEngineRef={audioEngineRef}/></div>))}
          {masterTracks.length > 0 && (<div style={{ borderLeft: '2px solid var(--color-border)', height: '100%', margin: '0 0.5rem' }} />)}
          {busChannels.map(bus => (<div key={bus.id} data-track-id={bus.id} className="channel-wrapper"><MixerChannel trackId={bus.id} audioEngineRef={audioEngineRef} /></div>))}
          {busChannels.length > 0 && (<div style={{ borderLeft: '2px solid var(--color-border)', height: '100%', margin: '0 0.5rem' }} />)}

          {trackChannels.map(track => (<div key={track.id} data-track-id={track.id} className="channel-wrapper"><MixerChannel trackId={track.id} audioEngineRef={audioEngineRef} /></div>))}
        </div>
        <GlobalSettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
      </div>

      {/* Mixer Status Bar */}
      <div className="mixer-status bg-gray-900 border-t border-gray-700 p-2 flex justify-between items-center text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>Tracks: {trackChannels.length}</span>
          <span>Buses: {busChannels.length}</span>
          {/* DÜZELTME: Sayıyı yeni hesaplanan 'activeSendsCount' değişkeninden alıyoruz. */}
          <span>Active Sends: {activeSendsCount}</span>
        </div>
        <div className="flex items-center gap-4">
            {/* Sağ taraf aynı kalabilir */}
        </div>
      </div>
    </div>
  );
}

export default Mixer;