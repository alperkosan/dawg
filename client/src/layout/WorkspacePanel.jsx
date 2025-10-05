// src/layout/WorkspacePanel.jsx

import React, { Suspense } from 'react';
import DraggableWindow from '../ui/DraggableWindow';
import FileBrowserPanel from '@/features/file_browser/FileBrowserPanel';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { panelRegistry, panelDefinitions } from '@/config/panelConfig';
import { pluginRegistry } from '@/config/pluginConfig';
import PluginContainer from '@/components/plugins/container/PluginContainer';
import { AudioContextService } from '@/lib/services/AudioContextService';

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
          const isMaximized = fullscreenPanel === panel.id;

          if (fullscreenPanel && fullscreenPanel !== panel.id) return null;
          if (!panel.isOpen || panel.isMinimized) return null;

          let PanelContent;
          let panelDef = panelDefinitions[panel.id];
          const componentProps = { key: panel.id };

          if (panel.type === 'plugin') {
            console.log('🔌 Rendering plugin panel:', panel);
            const track = mixerTracks.find(t => t.id === panel.trackId);
            const effect = track?.insertEffects.find(fx => fx.id === panel.effectId);

            console.log('🔌 Track found:', track);
            console.log('🔌 Effect found:', effect);

            if (!track || !effect) {
              console.warn('⚠️ Track or effect not found for plugin panel:', panel);
              // Auto-close the orphaned panel
              setTimeout(() => {
                console.log('🗑️ Auto-closing orphaned plugin panel:', panel.id);
                togglePanel(panel.id);
              }, 100);
              return null;
            }

            const definition = pluginRegistry[effect.type];
            const PluginUIComponent = definition?.uiComponent;

            console.log('🔌 Plugin definition:', definition);
            console.log('🔌 UI Component:', PluginUIComponent);

            if (!PluginUIComponent) {
              console.warn('⚠️ Plugin UI component not found for:', effect.type);
              return <div>Plugin UI for {effect.type} not found.</div>;
            }

            const handlePluginChange = (param, value) => {
              handleMixerEffectChange(track.id, effect.id, param, value);
            };

            panelDef = {
              minSize: definition.minSize || { width: 350, height: 200 },
              initialSize: definition.initialSize || { width: 450, height: 300 }
            };

            // Get the effect node for visualization
            const effectNode = AudioContextService.getEffectNode(track.id, effect.id);

            PanelContent = (
              <PluginContainer trackId={track.id} effect={effect} definition={definition}>
                <Suspense fallback={<div className="p-4">Loading UI...</div>}>
                  <PluginUIComponent
                    trackId={track.id}
                    effect={effect}
                    effectNode={effectNode}
                    onChange={handlePluginChange}
                    definition={definition}
                  />
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
            
            // ======================================================
            // === EKLENECEK KOD BURASI ===
            // Bu blok, synth editörüne doğru enstrümanı gönderir.
            // ======================================================
            if (panel.id === 'instrument-editor-forgesynth') {
              componentProps.instrument = editingInstrument;
            }
            // ======================================================
            
            PanelContent = <PanelComponent {...componentProps} />;
          }

          return (
            <DraggableWindow
              key={panel.id}
              id={panel.id}
              title={panel.title}
              position={panel.position}
              zIndex={baseZIndex + panelStack.indexOf(panel.id)}
              onPositionChange={(newPos) => updatePanelState(panel.id, { position: newPos })}
              onSizeChange={(newSize) => updatePanelState(panel.id, { size: newSize })}
              onFocus={() => bringPanelToFront(panel.id)}
              onClose={() => togglePanel(panel.id)}
              onMinimize={() => handleMinimize(panel.id, panel.title)}
              onMaximize={() => handleMaximize(panel.id)}
              isMaximized={isMaximized}
              size={isMaximized ? { width: '100%', height: '100%' } : (panel.size || panelDef.initialSize)}
              minSize={panelDef?.minSize}
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