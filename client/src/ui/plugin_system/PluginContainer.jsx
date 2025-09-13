/**
 * @file PluginContainer.jsx
 * @description Tüm eklentiler için standart, profesyonel ve işlevsel bir
 * çerçeve (wrapper) bileşenidir. Bypass, preset yönetimi gibi ortak
 * işlevleri merkezileştirir.
 */
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { PluginColorPalette, PluginSpacing, PluginTypography, PluginAnimations } from './PluginDesignSystem';
import { Power, Info, ChevronDown, Trash2 } from 'lucide-react';

// *** YENİ: Portal'da render edilecek ayrı bir menü bileşeni ***
const PresetMenu = ({
  isOpen,
  onClose,
  anchorEl,
  factoryPresets,
  userPresets,
  onSelect,
  onDelete,
}) => {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setPosition({ top: rect.bottom + 5, left: rect.left });
    }
  }, [isOpen, anchorEl]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="fixed w-56 bg-gray-800 border border-gray-700 rounded-md shadow-2xl p-1 max-h-60 overflow-y-auto"
      style={{ top: position.top, left: position.left, zIndex: 1000 }} // Yüksek z-index
    >
      {factoryPresets.length > 0 && (
        <>
          <h4 className="text-xs text-gray-500 font-bold px-2 py-1">Fabrika</h4>
          {factoryPresets.map(p =>
            <button key={p.name} onClick={() => onSelect(p.settings)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-blue-600">{p.name}</button>
          )}
        </>
      )}
      {userPresets.length > 0 && (
        <>
          <h4 className="text-xs text-gray-500 font-bold px-2 py-1 mt-2">Kullanıcı</h4>
          {userPresets.map(p =>
            <div key={p.name} className="group flex items-center justify-between w-full text-left text-sm rounded hover:bg-blue-600">
              <button onClick={() => onSelect(p.settings)} className="flex-grow text-left px-2 py-1.5">{p.name}</button>
              <button onClick={() => onDelete(p.name)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-500">
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  );
};


const PresetManager = ({ effect, factoryPresets, onChange, storageKey }) => {
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
  const [activePresetName, setActivePresetName] = useState('Default');
  const buttonRef = useRef(null); // Butonun referansı

  useEffect(() => {
    const allPresets = [...factoryPresets, ...userPresets];
    const matchingPreset = allPresets.find(p =>
      JSON.stringify(p.settings) === JSON.stringify(effect.settings)
    );
    setActivePresetName(matchingPreset ? matchingPreset.name : 'Custom*');
  }, [effect.settings, factoryPresets, userPresets]);

  const handlePresetSelect = (presetSettings) => {
    onChange(presetSettings);
    setIsMenuOpen(false);
  };
  
  const handleDelete = (presetNameToDelete) => {
    if (window.confirm(`'${presetNameToDelete}' preseti silinecek. Emin misiniz?`)) {
      const updatedPresets = userPresets.filter(p => p.name !== presetNameToDelete);
      setUserPresets(updatedPresets);
      window.localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
      >
        <span className="max-w-[120px] truncate">{activePresetName}</span>
        <ChevronDown size={14} className={`transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
      </button>
      <PresetMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        anchorEl={buttonRef.current}
        factoryPresets={factoryPresets}
        userPresets={userPresets}
        onSelect={handlePresetSelect}
        onDelete={handleDelete}
      />
    </>
  );
};


const PluginContainer = ({ trackId, effect, definition, onChange, children }) => {
  const [showInfo, setShowInfo] = useState(false);
  const { type: title, story: description, category, presets = [] } = definition;

  const handleBypass = () => {
    onChange('bypass', !effect.bypass);
  };
  
  const containerStyle = {
    background: PluginColorPalette.backgrounds.primary,
    borderRadius: '12px',
    border: `1px solid ${effect.bypass ? 'rgba(100, 116, 139, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    transition: `all ${PluginAnimations.normal}`,
    opacity: effect.bypass ? 0.6 : 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
  };

  const headerStyle = {
    background: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    padding: PluginSpacing.md,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBypass}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${effect.bypass ? 'bg-gray-600 text-gray-400' : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'}`}
            title={effect.bypass ? 'Plugin Bypassed' : 'Plugin Active'}
          >
            <Power size={14} />
          </button>
          <div>
            <h3 style={PluginTypography.title} className="text-white">{title}</h3>
            {category && (<div style={PluginTypography.label} className="text-blue-400 opacity-80">{category}</div>)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInfo(!showInfo)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all" title="Plugin Information">
            <Info size={14} />
          </button>
          <PresetManager
            effect={effect}
            factoryPresets={presets}
            onChange={onChange}
            storageKey={`soundforge-user-presets-${title}`}
          />
        </div>
      </div>
      {showInfo && description && (
        <div className="px-4 py-3 bg-black/20 border-b border-white/10" style={{ ...PluginTypography.description, color: 'rgba(255, 255, 255, 0.8)' }}>
          {description}
        </div>
      )}
      <div className="p-6 flex-grow min-h-0">
        {children}
      </div>
    </div>
  );
};

export default PluginContainer;