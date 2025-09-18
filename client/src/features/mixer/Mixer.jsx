import React, { useMemo, useState, useRef } from 'react';
import MixerChannel from './MixerChannel';
import { useMixerStore } from '../../store/useMixerStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import { SlidersHorizontal, Plus, Trash2, Power, ArrowDownUp } from 'lucide-react';
import { AddEffectMenu } from '../../ui/AddEffectMenu';
import ChannelContextMenu from '../../components/ChannelContextMenu'; // Context Menu'yü import et

// YENİ: Native HTML Drag-Drop API'si ile çalışan, sürükle-bırak özellikli Insert Paneli
const InsertPanel = ({ activeTrack }) => {
    const { handleMixerEffectAdd, handleMixerEffectRemove, handleMixerEffectChange, reorderEffect } = useMixerStore.getState();
    const { togglePluginPanel } = usePanelsStore.getState();
    const [addEffectMenu, setAddEffectMenu] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const draggedItemIndex = useRef(null);

    const onDragStart = (e, index) => {
        draggedItemIndex.current = index;
        e.dataTransfer.effectAllowed = 'move';
    };
    const onDragEnd = () => {
        draggedItemIndex.current = null;
        setDragOverIndex(null);
    };
    const onDrop = (dropIndex) => {
        const sourceIndex = draggedItemIndex.current;
        if (sourceIndex !== null && sourceIndex !== dropIndex) {
            reorderEffect(activeTrack.id, sourceIndex, dropIndex);
        }
    };
    
    if (!activeTrack) {
        return (
            <aside className="w-64 bg-gray-800/50 p-4 flex flex-col items-center justify-center text-center text-gray-500 shrink-0">
                <SlidersHorizontal size={32} className="mb-2"/>
                <p className="text-sm">Select a channel to see its effects.</p>
            </aside>
        );
    }
    
    return (
        <aside className="w-64 shrink-0 bg-gray-800/50 border-l-2 border-gray-700/50 p-2 flex flex-col">
            <h3 className="text-sm font-bold text-cyan-400 p-2 mb-2 truncate shrink-0">
                Inserts: <span className="text-white font-normal">{activeTrack.name}</span>
            </h3>
            <div className="flex-grow min-h-0 overflow-y-auto space-y-1 pr-1" onDragOver={(e) => e.preventDefault()}>
                {activeTrack.insertEffects.map((effect, index) => (
                    <div key={effect.id}>
                        {dragOverIndex === index && <div className="h-1 bg-blue-500 rounded-full my-1" />}
                        <div
                            draggable
                            onDragStart={(e) => onDragStart(e, index)}
                            onDragEnter={() => setDragOverIndex(index)}
                            onDragEnd={onDragEnd}
                            onDrop={() => onDrop(index)}
                            onClick={() => togglePluginPanel(effect, activeTrack)}
                            className={`group flex items-center justify-between p-2 rounded-md cursor-grab active:cursor-grabbing transition-all
                                ${effect.bypass ? 'bg-gray-700/50' : 'bg-gray-700 hover:bg-gray-600/80'}`
                            }
                            title={`Slot ${index + 1}: ${effect.type}\n(Click to open, Drag to reorder)`}
                        >
                            <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); handleMixerEffectChange(activeTrack.id, effect.id, 'bypass', !effect.bypass);}} title={effect.bypass ? 'Enable' : 'Bypass'}>
                                    <Power size={14} className={effect.bypass ? 'text-gray-500' : 'text-green-400'}/>
                                </button>
                                <span className={`text-xs font-semibold truncate ${effect.bypass ? 'text-gray-500' : 'text-gray-200'}`}>
                                    {index + 1}. {effect.type}
                                </span>
                            </div>
                            <div className="flex items-center">
                                <button onClick={(e) => { e.stopPropagation(); handleMixerEffectRemove(activeTrack.id, effect.id);}} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove effect">
                                    <Trash2 size={14}/>
                                </button>
                                <ArrowDownUp size={12} className="text-gray-500 ml-1 opacity-20 group-hover:opacity-50" />
                            </div>
                        </div>
                    </div>
                ))}
                <div onDragEnter={() => setDragOverIndex(activeTrack.insertEffects.length)} onDrop={() => onDrop(activeTrack.insertEffects.length)} className="h-full"/>
                {dragOverIndex === activeTrack.insertEffects.length && <div className="h-1 bg-blue-500 rounded-full my-1" />}
            </div>
            <div className="mt-2 shrink-0">
                <button onClick={(e) => setAddEffectMenu({x: e.clientX, y: e.clientY})} className="w-full flex items-center justify-center gap-2 p-2 text-xs bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/40 rounded transition-colors">
                    <Plus size={14}/> Add Effect
                </button>
                {addEffectMenu && <AddEffectMenu x={addEffectMenu.x} y={addEffectMenu.y} onClose={()=>setAddEffectMenu(null)} onSelect={(type) => { handleMixerEffectAdd(activeTrack.id, type); setAddEffectMenu(null); }}/>}
            </div>
        </aside>
    );
};

function Mixer() {
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  const activeChannelId = useMixerStore(state => state.activeChannelId);
  const { setTrackColor, setTrackName, setTrackOutput, resetTrack } = useMixerStore.getState();
  const [contextMenu, setContextMenu] = useState(null);

  const activeTrack = useMemo(() => mixerTracks.find(t => t.id === activeChannelId), [mixerTracks, activeChannelId]);

  const { masterTracks, trackChannels, busChannels } = useMemo(() => ({
    masterTracks: mixerTracks.filter(t => t.type === 'master'),
    trackChannels: mixerTracks.filter(t => t.type === 'track'),
    busChannels: mixerTracks.filter(t => t.type === 'bus'),
  }), [mixerTracks]);
  
  const handleContextMenu = (e, track) => {
      e.preventDefault();
      e.stopPropagation();
      useMixerStore.getState().setActiveChannelId(track.id);
      setContextMenu({ x: e.clientX, y: e.clientY, track });
  };
  
  const getContextMenuOptions = () => {
      if (!contextMenu?.track) return [];
      const track = contextMenu.track;
      const availableOutputs = mixerTracks.filter(t => (t.type === 'bus' || t.type === 'master') && t.id !== track.id);
      const colorOptions = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'];

      return [
          { label: 'Rename', action: () => {
              const newName = prompt('Enter new name:', track.name);
              if (newName) setTrackName(track.id, newName);
          }},
          { label: 'Reset channel', action: () => resetTrack(track.id) },
          { type: 'separator' },
          { label: 'Change Color', children: colorOptions.map(color => ({
              label: <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />,
              action: () => setTrackColor(track.id, color)
          }))},
          { label: 'Route to', children: [
              ...availableOutputs.map(bus => ({
                  label: bus.name,
                  isActive: track.output === bus.id,
                  action: () => setTrackOutput(track.id, bus.id)
              })),
              { type: 'separator' },
              { label: 'Master', isActive: !track.output, action: () => setTrackOutput(track.id, null)}
          ]},
      ];
  };

  return (
    <div className="w-full h-full flex bg-gray-900 text-white" onClick={() => setContextMenu(null)}>
      <div className="flex-grow flex relative overflow-x-auto overflow-y-hidden">
        <div className="flex h-full p-4 gap-2" style={{ minWidth: 'fit-content' }}>
          {masterTracks.map(track => <MixerChannel key={track.id} trackId={track.id} onContextMenu={handleContextMenu}/>)}
          {busChannels.length > 0 && <div className="border-l-2 border-gray-700/50 h-full mx-2" />}
          {busChannels.map(track => <MixerChannel key={track.id} trackId={track.id} onContextMenu={handleContextMenu}/>)}
          {trackChannels.length > 0 && <div className="border-l-2 border-gray-700/50 h-full mx-2" />}
          {trackChannels.map(track => <MixerChannel key={track.id} trackId={track.id} onContextMenu={handleContextMenu}/>)}
        </div>
      </div>
      <InsertPanel activeTrack={activeTrack} />
      {contextMenu && <ChannelContextMenu x={contextMenu.x} y={contextMenu.y} options={getContextMenuOptions()} onClose={() => setContextMenu(null)} />}
    </div>
  );
}

export default Mixer;

