/**
 * @file PluginContainer.jsx
 * @description "Complete Plugin System Overhaul Guide" dokümanında belirtilen,
 * her eklenti için standart bir "çerçeve" görevi gören ana bileşen.
 * Bypass, başlık, preset yönetimi gibi ortak elemanları barındırır.
 */
import React, { useState, useRef, useEffect } from 'react';
import { PluginColorPalette, PluginSpacing, PluginTypography, PluginAnimations } from './PluginDesignSystem';
import { Power, Info, Save, ChevronDown, Trash2 } from 'lucide-react';
import { useMixerStore } from '../../store/useMixerStore'; // State'i güncellemek için

const PluginContainer = ({
  trackId,
  effect,
  definition,
  children,
}) => {
  const { handleMixerEffectChange } = useMixerStore.getState();
  
  const [showInfo, setShowInfo] = useState(false);
  const { type: pluginType, story: description, category, presets: factoryPresets = [] } = definition;
  
  // Bypass fonksiyonu artık doğrudan store'u güncelliyor
  const onBypass = () => {
    handleMixerEffectChange(trackId, effect.id, 'bypass', !effect.bypass);
  };

  // --- Preset Yönetimi ---
  const storageKey = `soundforge-user-presets-${pluginType}`;
  const [userPresets, setUserPresets] = useState(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Kullanıcı preset'leri yüklenemedi:", error);
      return [];
    }
  });
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [activePresetName, setActivePresetName] = useState('Default');

  useEffect(() => {
    const allPresets = [...factoryPresets, ...userPresets];
    const matchingPreset = allPresets.find(p => JSON.stringify(p.settings) === JSON.stringify(effect.settings));
    setActivePresetName(matchingPreset ? matchingPreset.name : 'Custom*');
  }, [effect.settings, factoryPresets, userPresets]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePresetSelect = (presetSettings) => {
    handleMixerEffectChange(trackId, effect.id, presetSettings);
    setIsMenuOpen(false);
  };
  
  const handleSavePreset = () => {
    const name = prompt("Preset için bir isim girin:");
    if (name && name.trim()) {
      const newPreset = { name: name.trim(), settings: { ...effect.settings } };
      const updatedPresets = [...userPresets, newPreset];
      setUserPresets(updatedPresets);
      window.localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
    }
  };
  
  const handleDeletePreset = (presetName) => {
    if (window.confirm(`'${presetName}' preseti silinecek. Emin misiniz?`)) {
      const updatedPresets = userPresets.filter(p => p.name !== presetName);
      setUserPresets(updatedPresets);
      window.localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
    }
  };

  const containerStyle = {
    background: PluginColorPalette.backgrounds.primary,
    borderRadius: '12px',
    border: `1px solid rgba(255, 255, 255, 0.1)`,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    transition: `all ${PluginAnimations.normal}`,
    opacity: effect.bypass ? 0.6 : 1,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle = {
    background: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    padding: PluginSpacing.sm,
  };

  return (
    <div style={containerStyle} className="plugin-container">
      {/* Header */}
      <div style={headerStyle} className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBypass}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 ${
              effect.bypass ? 'bg-gray-700 text-gray-400' : `bg-gradient-to-br text-white shadow-lg from-blue-500 to-blue-600 shadow-blue-500/25`
            }`}
            title={effect.bypass ? 'Plugin Bypassed' : 'Plugin Active'}
          >
            <Power size={14} />
          </button>
          <div>
            <h3 style={PluginTypography.title} className="text-white">{pluginType}</h3>
            {category && <div style={PluginTypography.label} className="text-blue-400 opacity-80">{category}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowInfo(!showInfo)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all" title="Plugin Information">
            <Info size={14} />
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-colors">
                <span className="max-w-[100px] truncate">{activePresetName}</span>
                <ChevronDown size={14} className={`transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {isMenuOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-gray-900 border border-gray-700 rounded-md shadow-2xl p-1 max-h-60 overflow-y-auto z-50">
                    <button onClick={handleSavePreset} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-blue-600 flex items-center gap-2"><Save size={14}/> Yeni Preset Kaydet</button>
                    <div className="my-1 h-[1px] bg-gray-700"/>
                    {factoryPresets.map(p => <button key={p.name} onClick={() => handlePresetSelect(p.settings)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-gray-700">{p.name}</button>)}
                    {userPresets.length > 0 && <div className="my-1 h-[1px] bg-gray-700"/>}
                    {userPresets.map(p => 
                        <div key={p.name} className="group flex items-center justify-between w-full text-left text-sm rounded hover:bg-gray-700">
                            <button onClick={() => handlePresetSelect(p.settings)} className="flex-grow text-left px-2 py-1.5">{p.name}</button>
                            <button onClick={() => handleDeletePreset(p.name)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-500"><Trash2 size={12} /></button>
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && description && (
        <div className="px-4 py-3 bg-black/20 border-b border-white/10 text-white" style={PluginTypography.description}>
          {description}
        </div>
      )}

      {/* Plugin Content */}
      <div className="p-4 flex-grow relative">{children}</div>
    </div>
  );
};

export default PluginContainer;
