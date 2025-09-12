import React from 'react';
import DraggableWindow from '../ui/DraggableWindow';
import FileBrowserPanel from '../features/file_browser/FileBrowserPanel';

import { usePanelsStore } from '../store/usePanelsStore';
import { useInstrumentsStore } from '../store/useInstrumentsStore';
import { panelRegistry, panelDefinitions } from '../config/panelConfig';

function WorkspacePanel({ audioEngineRef }) {
  // --- STATE'İ DOĞRUDAN STORE'DAN ALIYORUZ ---
  const {
    panels, panelStack, fullscreenPanel,
    bringPanelToFront, togglePanel, handleMinimize, handleMaximize,
    updatePanelState // Yeni action'ı alıyoruz
  } = usePanelsStore();

  const { instruments } = useInstrumentsStore();
  const editingInstrument = useInstrumentsStore(state => state.instruments.find(i => i.id === usePanelsStore.getState().editingInstrumentId));
  const pianoRollInstrument = useInstrumentsStore(state => state.instruments.find(i => i.id === usePanelsStore.getState().pianoRollInstrumentId));
  
  const baseZIndex = 10;

  return (
    <div className="w-full h-full bg-gray-900 relative overflow-hidden flex">
      <FileBrowserPanel />
      <div className="flex-grow relative">
        {Object.values(panels).map(panel => {
          if (fullscreenPanel && fullscreenPanel !== panel.id) return null;
          if (!panel.isOpen || panel.isMinimized) return null;

          const definition = panelDefinitions[panel.id];
          const PanelComponent = panelRegistry[panel.id];

          if (!definition || !PanelComponent) return null;

          const componentProps = {
            'sample-editor': { instrument: editingInstrument, audioEngineRef },
            'piano-roll': { instrument: pianoRollInstrument, audioEngineRef },
            'channel-rack': { audioEngineRef },
            'mixer': { audioEngineRef }
          };

          return (
            <DraggableWindow
              key={panel.id}
              id={panel.id}
              title={panel.title} // State'ten gelen dinamik başlık
              
              // --- YENİ: State'i prop olarak iletiyoruz ---
              position={panel.position}
              size={panel.size}
              
              minSize={definition.minSize}
              disableResizing={definition.disableResizing}
              zIndex={baseZIndex + panelStack.indexOf(panel.id)}
              
              // --- YENİ: Değişiklikleri store'a bildiren handler'lar ---
              onPositionChange={(newPos) => updatePanelState(panel.id, { position: newPos })}
              onSizeChange={(newSize) => updatePanelState(panel.id, { size: newSize })}

              onFocus={() => bringPanelToFront(panel.id)}
              onClose={() => togglePanel(panel.id)}
              onMinimize={() => handleMinimize(panel.id, definition.title)}
              onMaximize={() => handleMaximize(panel.id)}
              isMaximized={fullscreenPanel === panel.id}
            >
              <PanelComponent {...componentProps[panel.id]} />
            </DraggableWindow>
          );
        })}
      </div>
    </div>
  );
}

export default WorkspacePanel;