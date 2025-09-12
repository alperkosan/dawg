import React, { useRef, useMemo } from 'react'; // useRef ve useMemo eklendi
import MixerChannel from './MixerChannel';
import { useMixerStore } from '../../store/useMixerStore';

function Mixer({ audioEngineRef }) {
  const tracks = useMixerStore(state => state.mixerTracks);
  const activeChannelId = useMixerStore(state => state.activeChannelId);

  // Kanal pozisyonlarını tutmak için bir ref haritası oluşturuyoruz.
  const channelRefs = useRef(new Map());

  const masterTrack = tracks.find(t => t.type === 'master');
  const trackChannels = tracks.filter(t => t.type === 'track');
  const busChannels = tracks.filter(t => t.type === 'bus');

  // Aktif kanal ve bağlantıları hesaplamak için useMemo kullanarak performansı artırıyoruz.
  const activeConnections = useMemo(() => {
    if (!activeChannelId) return [];
    
    const activeTrack = tracks.find(t => t.id === activeChannelId);
    if (!activeTrack?.sends?.length) return [];

    return activeTrack.sends.map(send => ({
      fromId: activeTrack.id,
      toId: send.busId,
    })).filter(conn => channelRefs.current.has(conn.fromId) && channelRefs.current.has(conn.toId));

  }, [activeChannelId, tracks]);

  // Kabloları çizen fonksiyon
  const renderCables = () => {
    if (!activeConnections.length) return null;
    
    // Bağlantıların koordinatlarını dinamik olarak al
    const connectionsWithCoords = activeConnections.map(conn => {
        const fromRect = channelRefs.current.get(conn.fromId)?.getBoundingClientRect();
        const toRect = channelRefs.current.get(conn.toId)?.getBoundingClientRect();
        const containerRect = channelRefs.current.get('container')?.getBoundingClientRect();

        if (!fromRect || !toRect || !containerRect) return null;

        return {
            x1: fromRect.left - containerRect.left + fromRect.width / 2,
            y1: fromRect.bottom - containerRect.top,
            x2: toRect.left - containerRect.left + toRect.width / 2,
            y2: toRect.top - containerRect.top
        };
    }).filter(Boolean); // null olanları filtrele

    return (
      <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        {connectionsWithCoords.map((conn, idx) => {
          const d = `M ${conn.x1} ${conn.y1} C ${conn.x1} ${conn.y1 + 50}, ${conn.x2} ${conn.y2 - 50}, ${conn.x2} ${conn.y2}`;
          return (
            <path key={idx} d={d} stroke="#3b82f6" strokeWidth="2" fill="none" className="animate-pulse" opacity={0.7} />
          );
        })}
      </svg>
    );
  };
  
  return (
    // Ana container'a ref ekliyoruz
    <div ref={node => channelRefs.current.set('container', node)} className="relative w-full h-full flex bg-gray-800 p-4 gap-x-4 overflow-x-auto">
      {renderCables()}
      {masterTrack && (
        <div ref={node => channelRefs.current.set(masterTrack.id, node)}>
            <MixerChannel key={masterTrack.id} trackId={masterTrack.id} audioEngineRef={audioEngineRef} />
        </div>
      )}
      {(trackChannels.length > 0 || busChannels.length > 0) && <div className="border-l-2 border-gray-700 h-full mx-2"></div>}
      {trackChannels.map(track => (
         <div key={track.id} ref={node => channelRefs.current.set(track.id, node)}>
            <MixerChannel trackId={track.id} audioEngineRef={audioEngineRef} />
         </div>
      ))}
      {busChannels.length > 0 && <div className="border-l-2 border-gray-700 h-full mx-2"></div>}
      {busChannels.map(bus => (
         <div key={bus.id} ref={node => channelRefs.current.set(bus.id, node)}>
            <MixerChannel trackId={bus.id} audioEngineRef={audioEngineRef} />
         </div>
      ))}
    </div>
  );
}

export default Mixer;