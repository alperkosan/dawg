// src/layout/WorkspacePanel.jsx

import React, { Suspense } from 'react';
import DraggableWindow from '@/components/layout/DraggableWindow';
import FileBrowserPanel from '@/features/file_browser/FileBrowserPanel';
import { usePanelsStore } from '@/store/usePanelsStore';
import { useInstrumentsStore } from '@/store/useInstrumentsStore';
import { useMixerStore } from '@/store/useMixerStore';
import { useThemeStore } from '@/store/useThemeStore';
import { panelRegistry, panelDefinitions } from '@/config/panelConfig';
import { pluginRegistry } from '@/config/pluginConfig';
import PluginContainer from '@/components/plugins/container/PluginContainer';
import { AudioContextService } from '@/lib/services/AudioContextService';

// Atmospheric effects
import MatrixRain from '@/components/effects/MatrixRain';
import CyberpunkScanlines from '@/components/effects/CyberpunkScanlines';
import OceanBubbles from '@/components/effects/OceanBubbles';
import RetroMiamiGrid from '@/components/effects/RetroMiamiGrid';
import ParticlesEffect from '@/components/effects/ParticlesEffect';

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

  // Get active theme for atmospheric effects
  const activeTheme = useThemeStore(state => {
    const { themes, activeThemeId } = state;
    return themes.find(t => t.id === activeThemeId);
  });
  const themeName = activeTheme?.name || '';

  const baseZIndex = 10;

  // Render appropriate effect based on theme
  const renderThemeEffect = () => {
    switch (themeName) {
      case 'Matrix Code':
        return <MatrixRain opacity={0.15} fontSize={14} speed={0.4} />;

      case 'Cyberpunk Neon':
        return <CyberpunkScanlines opacity={0.15} speed={0.8} />;

      case 'Ocean Deep':
        return <OceanBubbles opacity={0.18} count={12} />;

      case 'Retro Miami':
        return <RetroMiamiGrid opacity={0.12} speed={0.5} />;

      case '8-Bit Night':
        return (
          <ParticlesEffect
            type="stars"
            count={40}
            color="#4ade80"
            opacity={0.2}
            speed={0.3}
            size={{ min: 1, max: 2 }}
          />
        );

      case 'Midnight Purple':
        return (
          <ParticlesEffect
            type="stars"
            count={60}
            color="#C77DFF"
            secondaryColor="#9D4EDD"
            opacity={0.25}
            speed={0.2}
            size={{ min: 1, max: 3 }}
          />
        );

      case 'Arctic Minimal':
        return (
          <ParticlesEffect
            type="snow"
            count={30}
            color="#E0F7FF"
            opacity={0.15}
            speed={0.6}
            size={{ min: 2, max: 4 }}
          />
        );

      case 'Lavender Dreams':
        return (
          <ParticlesEffect
            type="petals"
            count={20}
            color="#E6B8FF"
            secondaryColor="#D4A5FF"
            opacity={0.2}
            speed={0.4}
            size={{ min: 2, max: 5 }}
          />
        );

      case 'Anime Vibes':
        return (
          <ParticlesEffect
            type="petals"
            count={25}
            color="#FF1744"
            secondaryColor="#E040FB"
            opacity={0.18}
            speed={0.5}
            size={{ min: 2, max: 4 }}
          />
        );

      case 'Forest Twilight':
        return (
          <ParticlesEffect
            type="fireflies"
            count={15}
            color="#32CD32"
            opacity={0.3}
            speed={0.25}
            size={{ min: 1.5, max: 3 }}
          />
        );

      case 'Sunset Vibes':
        return (
          <ParticlesEffect
            type="sparkles"
            count={20}
            color="#FF6B35"
            secondaryColor="#F7931E"
            opacity={0.15}
            speed={0.3}
            size={{ min: 1, max: 2 }}
          />
        );

      case 'Desert Heat':
        return (
          <ParticlesEffect
            type="sparkles"
            count={15}
            color="#FFB627"
            opacity={0.12}
            speed={0.2}
            size={{ min: 1, max: 2 }}
          />
        );

      default:
        return null; // No effect for other themes
    }
  };

  return (
    // 'workspace' sınıfı artık display: flex kullanıyor.
    <div className="workspace">
      <FileBrowserPanel />
      {/* 'workspace__main-content' flex-grow: 1 ile geri kalan alanı kaplayacak */}
      <div className="workspace__main-content">
        {/* Atmospheric effects based on active theme */}
        {renderThemeEffect()} 
        {Object.values(panels).map(panel => {
          const isMaximized = fullscreenPanel === panel.id;

          if (fullscreenPanel && fullscreenPanel !== panel.id) return null;
          if (!panel.isOpen || panel.isMinimized) return null;

          let PanelContent;
          let panelDef = panelDefinitions[panel.id];
          const componentProps = { key: panel.id };

          if (panel.type === 'plugin') {
            const track = mixerTracks.find(t => t.id === panel.trackId);
            const effect = track?.insertEffects?.find(fx => fx.id === panel.effectId) || track?.effects?.find(fx => fx.id === panel.effectId);

            if (!track || !effect) {
              // Auto-close the orphaned panel
              setTimeout(() => togglePanel(panel.id), 100);
              return null;
            }

            const definition = pluginRegistry[effect.type];
            const PluginUIComponent = definition?.uiComponent;

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

            // 🔍 DEBUG: Log effect node lookup
            console.log('🔍 [WorkspacePanel] Effect node lookup:', {
              effectType: effect.type,
              effectId: effect.id,
              trackId: track.id,
              effectNode,
              hasPort: !!effectNode?.port,
              nodeType: effectNode?.constructor?.name
            });

            // Check if plugin uses v2.0 (has its own PluginContainerV2)
            const usesV2Container = ['MultiBandEQ', 'ModernDelay', 'OTT', 'ModernReverb', 'Compressor', 'Saturator', 'TidalFilter', 'StardustChorus', 'VortexPhaser', 'OrbitPanner', 'ArcadeCrusher', 'PitchShifter', 'BassEnhancer808', 'TransientDesigner', 'HalfTime', 'Limiter', 'Clipper', 'RhythmFX', 'Maximizer', 'Imager'].includes(effect.type);

            PanelContent = usesV2Container ? (
              // v2.0: Plugin has its own container
              <Suspense fallback={<div className="p-4">Loading UI...</div>}>
                <PluginUIComponent
                  trackId={track.id}
                  effect={effect}
                  effectNode={effectNode}
                  onChange={handlePluginChange}
                  definition={definition}
                />
              </Suspense>
            ) : (
              // v1.0: Wrap with PluginContainer
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

            // Sample Editor: Pass editingInstrument (can be null for audio clip mode)
            if (panel.id === 'sample-editor') {
              componentProps.instrument = editingInstrument;
              console.log('🎨 Rendering Sample Editor:', {
                panelId: panel.id,
                isOpen: panel.isOpen,
                editingInstrument: editingInstrument?.name,
                zIndex: baseZIndex + panelStack.indexOf(panel.id)
              });
            }

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
              onContextMenu={(e) => e.preventDefault()}
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