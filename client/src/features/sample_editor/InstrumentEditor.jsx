import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Sparkles, SlidersHorizontal, Bot, Settings } from 'lucide-react';
import { useMixerStore } from '../../store/useMixerStore';
import { usePanelsStore } from '../../store/usePanelsStore';
import TabButton from '../../ui/TabButton';
import './SampleEditor.css';

// --- YENİ VE OPTİMİZE EDİLMİŞ SEKME YAPISI ---
// Artık her sekme kendi özel görevine odaklanıyor.
const TABS_CONFIG = [
  // "Genesis" ana ses tasarım modülümüz
  { id: 'genesis', label: 'Genesis', icon: Sparkles, component: lazy(() => import('./components/GenesisTab')), supportedTypes: ['sample', 'synth'] },
  // Diğer uzmanlaşmış sekmeler
  { id: 'ai-analysis', label: 'AI Analysis', icon: Bot, component: lazy(() => import('./components/AIAnalysisTab')), supportedTypes: ['sample'] },
  { id: 'advanced', label: 'Advanced', icon: Settings, component: lazy(() => import('./components/AdvancedProcessingTab')), supportedTypes: ['sample'] },
  // Synth'ler için ayrı bir efekt sekmesi de düşünülebilir.
  { id: 'effects', label: 'Effects', icon: SlidersHorizontal, component: lazy(() => import('./components/EnhancedEffectsTab')), supportedTypes: ['synth'] },
];

const InstrumentEditor = ({ instrument, audioEngineRef }) => {
  const track = useMixerStore(state => state.mixerTracks.find(t => t.id === instrument?.mixerTrackId));
  const instrumentBuffer = usePanelsStore(state => state.editorBuffer);
  
  const availableTabs = TABS_CONFIG.filter(tab => tab.supportedTypes.includes(instrument.type));
  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || null);

  useEffect(() => {
    const defaultTab = availableTabs[0]?.id;
    if (!availableTabs.some(t => t.id === activeTab)) {
        setActiveTab(defaultTab);
    }
  }, [instrument, activeTab, availableTabs]);

  if (!instrument || !track) {
    return <div className="p-4 text-red-400">Enstrüman veya mikser kanalı bulunamadı.</div>;
  }

  const ActiveTabComponent = TABS_CONFIG.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="w-full h-full flex flex-col bg-[var(--color-background)]">
        <div className="tabs-container">
            <div className="tabs-wrapper">
                {availableTabs.map(tab => (
                    <TabButton 
                        key={tab.id}
                        label={tab.label} 
                        icon={tab.icon} 
                        isActive={activeTab === tab.id} 
                        onClick={() => setActiveTab(tab.id)} 
                    />
                ))}
            </div>
        </div>
        <div className="flex-grow min-h-0">
          <Suspense fallback={<div className="p-8 text-center text-[var(--color-muted)]">Modül Yükleniyor...</div>}>
            {ActiveTabComponent && (
              <ActiveTabComponent 
                instrument={instrument} 
                instrumentBuffer={instrumentBuffer}
                track={track}
                audioEngineRef={audioEngineRef} 
              />
            )}
          </Suspense>
        </div>
    </div>
  );
};

export default React.memo(InstrumentEditor);

