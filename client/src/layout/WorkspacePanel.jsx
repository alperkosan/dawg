import React, { Suspense } from 'react';
import DraggableWindow from '../ui/DraggableWindow';
import FileBrowserPanel from '../features/file_browser/FileBrowserPanel';

// Gerekli tüm store'ları ve konfigürasyonları import ediyoruz
import { usePanelsStore } from '../store/usePanelsStore';
import { useInstrumentsStore } from '../store/useInstrumentsStore';
import { useArrangementStore } from '../store/useArrangementStore';
import { usePlaybackStore } from '../store/usePlaybackStore';
import { useMixerStore } from '../store/useMixerStore';
import { panelRegistry, panelDefinitions } from '../config/panelConfig';
import { pluginRegistry } from '../config/pluginConfig';
import PluginContainer from '../ui/plugin_system/PluginContainer';

function WorkspacePanel() {
  // Gerekli state'leri ve eylemleri store'lardan çekiyoruz
  const {
    panels, panelStack, fullscreenPanel, pianoRollInstrumentId, editingInstrumentId,
    bringPanelToFront, togglePanel, handleMinimize, handleMaximize, updatePanelState
  } = usePanelsStore();

  const instruments = useInstrumentsStore(state => state.instruments);
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  const { handleMixerEffectChange } = useMixerStore.getState();
  const pianoRollInstrument = instruments.find(i => i.id === pianoRollInstrumentId);
  const editingInstrument = instruments.find(i => i.id === editingInstrumentId);
  const { patterns, activePatternId } = useArrangementStore();
  const { playbackState, transportPosition } = usePlaybackStore();
  const activePattern = patterns[activePatternId];
  const baseZIndex = 10;

  return (
    <div className="w-full h-full bg-gray-900 relative overflow-hidden flex">
      <FileBrowserPanel />
      <div className="flex-grow relative">
        {Object.values(panels).map(panel => {
          if (fullscreenPanel && fullscreenPanel !== panel.id) return null;
          if (!panel.isOpen || panel.isMinimized) return null;

          let PanelContent;
          let panelDef = panelDefinitions[panel.id]; // Statik tanımı al
          const componentProps = { key: panel.id };

          // === HATA DÜZELTMESİ BURADA BAŞLIYOR ===
          // Önce panelin 'plugin' tipinde olup olmadığını kontrol ediyoruz.
          if (panel.type === 'plugin') {
            const track = mixerTracks.find(t => t.id === panel.trackId);
            const effect = track?.insertEffects.find(fx => fx.id === panel.effectId);
            
            // Eğer bir sebepten ötürü efekt veya kanal bulunamazsa, pencereyi çizme.
            if (!track || !effect) return null; 

            const definition = pluginRegistry[effect.type];
            const PluginUIComponent = definition?.uiComponent;

            if (!PluginUIComponent) return <div>Plugin UI for {effect.type} not found.</div>;

            const handlePluginChange = (param, value) => {
              handleMixerEffectChange(track.id, effect.id, param, value);
            };
            
            // Plugin pencereleri için varsayılan bir minimum boyut tanımlıyoruz.
            panelDef = { minSize: { width: 350, height: 200 }, ...panelDef };

            PanelContent = (
              <PluginContainer effect={effect} definition={definition} onChange={handlePluginChange}>
                <Suspense fallback={<div className="text-center p-4">Loading UI...</div>}>
                  <PluginUIComponent trackId={track.id} effect={effect} onChange={handlePluginChange} definition={definition} />
                </Suspense>
              </PluginContainer>
            );

          } else {
            // Eğer panel statik ise (Mixer, Channel Rack vb.), registry'den bileşeni al.
            const PanelComponent = panelRegistry[panel.id];
            
            // Eğer registry'de veya tanımlamalarda yoksa, çizme.
            if (!panelDef || !PanelComponent) return null;
            
            // Her panele özel props'ları ata
            if (panel.id === 'sample-editor') componentProps.instrument = editingInstrument;
            if (panel.id === 'piano-roll') {
              componentProps.instrument = pianoRollInstrument;
              const instrumentNotes = activePattern?.data[pianoRollInstrumentId] || [];
              componentProps.pattern = { id: activePattern?.id, name: activePattern?.name, notes: instrumentNotes };
              componentProps.playbackState = { isPlaying: playbackState === 'playing', position: transportPosition || 0 };
            }
            
            PanelContent = <PanelComponent {...componentProps} />;
          }
          // === HATA DÜZELTMESİ BURADA BİTİYOR ===

          return (
            <DraggableWindow
              key={panel.id}
              id={panel.id}
              title={panel.title}
              position={panel.position}
              size={panel.size}
              minSize={panelDef?.minSize}
              zIndex={baseZIndex + panelStack.indexOf(panel.id)}
              onPositionChange={(newPos) => updatePanelState(panel.id, { position: newPos })}
              onSizeChange={(newSize) => updatePanelState(panel.id, { size: newSize })}
              onFocus={() => bringPanelToFront(panel.id)}
              onClose={() => togglePanel(panel.id)}
              onMinimize={() => handleMinimize(panel.id, panel.title)}
              onMaximize={() => handleMaximize(panel.id)}
              isMaximized={fullscreenPanel === panel.id}
            >
              {PanelContent}
            </DraggableWindow>
          );
        })}
      </div>
    </div>
  );
}

export default WorkspacePanel;

