import React, { Suspense } from 'react';
import DraggableWindow from '../ui/DraggableWindow';
import FileBrowserPanel from '../features/file_browser/FileBrowserPanel';
import { usePanelsStore } from '../store/usePanelsStore';
import { useInstrumentsStore } from '../store/useInstrumentsStore';
import { useMixerStore } from '../store/useMixerStore';
import { panelRegistry, panelDefinitions } from '../config/panelConfig';
import { pluginRegistry } from '../config/pluginConfig';
import PluginContainer from '../ui/plugin_system/PluginContainer';

function WorkspacePanel() {
  const {
    panels, panelStack, fullscreenPanel, pianoRollInstrumentId, editingInstrumentId,
    bringPanelToFront, togglePanel, handleMinimize, handleMaximize, updatePanelState
  } = usePanelsStore();

  const instruments = useInstrumentsStore(state => state.instruments);
  const mixerTracks = useMixerStore(state => state.mixerTracks);
  const { handleMixerEffectChange } = useMixerStore.getState();
  const pianoRollInstrument = instruments.find(i => i.id === pianoRollInstrumentId);
  const editingInstrument = instruments.find(i => i.id === editingInstrumentId);
  
  const baseZIndex = 10;

  return (
    // 'workspace' sınıfı artık display: flex kullanıyor.
    <div className="workspace"> 
      <FileBrowserPanel />
      {/* 'workspace__main-content' flex-grow: 1 ile geri kalan alanı kaplayacak */}
      <div className="workspace__main-content"> 
        {Object.values(panels).map(panel => {
          if (fullscreenPanel && fullscreenPanel !== panel.id) return null;
          if (!panel.isOpen || panel.isMinimized) return null;

          let PanelContent;
          let panelDef = panelDefinitions[panel.id];
          const componentProps = { key: panel.id };

          if (panel.type === 'plugin') {
            const track = mixerTracks.find(t => t.id === panel.trackId);
            const effect = track?.insertEffects.find(fx => fx.id === panel.effectId);
            
            if (!track || !effect) return null; 

            const definition = pluginRegistry[effect.type];
            const PluginUIComponent = definition?.uiComponent;

            if (!PluginUIComponent) return <div>Plugin UI for {effect.type} not found.</div>;

            const handlePluginChange = (param, value) => {
              handleMixerEffectChange(track.id, effect.id, param, value);
            };
            
            panelDef = { minSize: { width: 350, height: 200 }, ...panelDef };

            PanelContent = (
              <PluginContainer effect={effect} definition={definition} onChange={handlePluginChange}>
                <Suspense fallback={<div className="p-4">Loading UI...</div>}>
                  <PluginUIComponent trackId={track.id} effect={effect} onChange={handlePluginChange} definition={definition} />
                </Suspense>
              </PluginContainer>
            );

          } else {
            const PanelComponent = panelRegistry[panel.id];
            if (!panelDef || !PanelComponent) return null;
            
            if (panel.id === 'sample-editor') componentProps.instrument = editingInstrument;
            if (panel.id === 'piano-roll') {
              componentProps.instrument = pianoRollInstrument;
            }
            
            PanelContent = <PanelComponent {...componentProps} />;
          }

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

