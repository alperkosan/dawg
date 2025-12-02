import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Power, ChevronDown, Save, Trash2, GitCompareArrows } from 'lucide-react';
import { PluginColorPalette, PluginAnimations, PluginTypography, PluginSpacingHeader } from '../PluginDesignSystem';
import { useMixerStore } from '@/store/useMixerStore';

// Preset Menüsü (Portal) Bileşeni - Değişiklik Yok
const PresetMenu = ({ isOpen, onClose, anchorEl, factoryPresets, userPresets, onSelect, onDelete }) => {
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => { if (isOpen && anchorEl) { const rect = anchorEl.getBoundingClientRect(); setPosition({ top: rect.bottom + 5, left: rect.left }); } }, [isOpen, anchorEl]);
  useEffect(() => {
    const handleClickOutside = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) onClose(); };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div ref={menuRef} className="preset-manager__menu" style={{ top: position.top, left: position.left }}>
      {factoryPresets.length > 0 && ( <> <h4 className="preset-manager__menu-category">Fabrika</h4> {factoryPresets.map(p => <button key={p.name} onClick={() => onSelect(p.settings, p.name)} className="preset-manager__menu-item">{p.name}</button>)} </> )}
      {userPresets.length > 0 && ( <> <h4 className="preset-manager__menu-category">Kullanıcı</h4> {userPresets.map(p => <div key={p.name} className="preset-manager__user-item"> <button onClick={() => onSelect(p.settings, p.name)} className="preset-manager__user-item-button">{p.name}</button> <button onClick={() => onDelete(p.name)} className="preset-manager__delete-btn" title="Bu preseti sil"><Trash2 size={14} /></button> </div> )} </> )}
    </div>, document.body);
};

// Ana Plugin Container
const PluginContainer = ({ trackId, effect, definition, children }) => {
  const { type: title, category, presets = [] } = definition;
  const { handleMixerEffectChange } = useMixerStore.getState();
  const storageKey = `soundforge-user-presets-${title}`;
  const [userPresets, setUserPresets] = useState(() => { try { return JSON.parse(window.localStorage.getItem(storageKey) || '[]'); } catch { return []; } });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const buttonRef = useRef(null);
  const [activePresetName, setActivePresetName] = useState('Custom*');

  useEffect(() => {
    const allPresets = [...presets, ...userPresets];
    const currentSettings = effect.settings;
    const matchingPreset = allPresets.find(p => JSON.stringify(p.settings) === JSON.stringify(currentSettings));
    setActivePresetName(matchingPreset ? matchingPreset.name : 'Custom*');
  }, [effect.settings, presets, userPresets]);

  const handlePresetSelect = (settings, presetName) => {
    // ✅ FIX: Save preset name along with settings
    // Note: Old PluginContainer doesn't have preset IDs, only names
    handleMixerEffectChange(trackId, effect.id, settings, null, {
      presetName: presetName || 'Custom'
    });
    setIsMenuOpen(false);
  };
  const handleSave = () => {
    const name = prompt("Preset için bir isim girin:", activePresetName.replace('*', ''));
    if (name && name.trim()) {
      const newPreset = { name: name.trim(), settings: { ...effect.settings } };
      const updatedPresets = [...userPresets.filter(p => p.name !== name.trim()), newPreset];
      setUserPresets(updatedPresets);
      window.localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
    }
  };
  const handleDelete = (name) => {
    if (window.confirm(`'${name}' preseti silinecek. Emin misiniz?`)) {
      const updatedPresets = userPresets.filter(p => p.name !== name);
      setUserPresets(updatedPresets);
      window.localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
    }
  };
  
  const handleToggleAB = () => handleMixerEffectChange(trackId, effect.id, '__toggle_ab_state');
  const handleCopyToB = () => handleMixerEffectChange(trackId, effect.id, '__copy_a_to_b');
  const handleBypass = (e) => {
    e.stopPropagation();
    handleMixerEffectChange(trackId, effect.id, 'bypass', !effect.bypass);
  };

  const containerStyle = {
    background: PluginColorPalette.backgrounds.primary, borderRadius: '12px', border: `1px solid ${effect.bypass ? 'rgba(100, 116, 139, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)', overflow: 'hidden', transition: `all ${PluginAnimations.normal}`,
    opacity: effect.bypass ? 0.6 : 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
  };
  const headerStyle = {
    background: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    padding: `${PluginSpacingHeader.padding}`, height: '52px', flexShrink: 0,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle} className="plugin-header__controls">
        <div className="plugin-header__title-section">
          <button onClick={handleBypass} className="plugin-bypass-button" data-active={!effect.bypass} title={effect.bypass ? 'Bypass' : 'Aktif'}>
            <Power size={14} />
          </button>
          <div>
            <h1 style={PluginTypography.title}>{title}</h1>
            <h2 style={PluginTypography.label}>{category}</h2>
          </div>
        </div>
        <div className="preset-actions">
          <div className="preset-manager__selector">
            <button ref={buttonRef} onClick={(e) => { e.stopPropagation(); setIsMenuOpen(true); }} className={`preset-button ${isMenuOpen ? 'preset-button--open' : ''}`}>
              <span className="preset-button__name">{activePresetName}</span>
              <ChevronDown size={16} className="preset-button__chevron" />
            </button>
            <PresetMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} anchorEl={buttonRef.current} factoryPresets={presets} userPresets={userPresets} onSelect={handlePresetSelect} onDelete={handleDelete} />
          </div>
          <div className="ab-toggle">
            <button onClick={handleToggleAB} className={`ab-button ${!effect.abState?.isB ? 'ab-button--active' : ''}`}>A</button>
            <button onClick={handleToggleAB} className={`ab-button ${effect.abState?.isB ? 'ab-button--active' : ''}`}>B</button>
          </div>
          <button onClick={handleCopyToB} className="preset-action-btn" title="A'yı B'ye Kopyala"><GitCompareArrows size={16} /></button>
          <button onClick={handleSave} className="preset-action-btn" title="Preset'i Kaydet"><Save size={16} /></button>
        </div>
      </div>
      <div className="plugin-body">{children}</div>
    </div>
  );
};

export default PluginContainer;

