import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Save, Trash2, GitCompareArrows } from 'lucide-react';

// Portal'da render edilecek alt menü bileşeni
const PresetMenu = ({ isOpen, onClose, anchorEl, factoryPresets, userPresets, onSelect, onDelete }) => {
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
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div ref={menuRef} className="preset-manager__menu" style={{ top: position.top, left: position.left }}>
      {factoryPresets.length > 0 && (
        <>
          <h4 className="preset-manager__menu-category">Fabrika</h4>
          {factoryPresets.map(p => <button key={p.name} onClick={() => onSelect(p.settings)} className="preset-manager__menu-item">{p.name}</button>)}
        </>
      )}
      {userPresets.length > 0 && (
        <>
          <h4 className="preset-manager__menu-category">Kullanıcı</h4>
          {userPresets.map(p =>
            <div key={p.name} className="preset-manager__user-item">
              <button onClick={() => onSelect(p.settings)} className="preset-manager__user-item-button">{p.name}</button>
              <button onClick={() => onDelete(p.name)} className="preset-manager__delete-btn" title="Bu preseti sil"><Trash2 size={14} /></button>
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  );
};

export const PresetManager = ({ pluginType, effect, factoryPresets = [], onChange }) => {
  const storageKey = `soundforge-user-presets-${pluginType}`;
  const [userPresets, setUserPresets] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    } catch { return []; }
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const buttonRef = useRef(null);
  const [activePresetName, setActivePresetName] = useState('Custom*');

  useEffect(() => {
    const allPresets = [...factoryPresets, ...userPresets];
    const currentSettings = effect.abState?.isB ? effect.abState.b : effect.settings;
    const matchingPreset = allPresets.find(p => JSON.stringify(p.settings) === JSON.stringify(currentSettings));
    setActivePresetName(matchingPreset ? matchingPreset.name : 'Custom*');
  }, [effect.settings, effect.abState, factoryPresets, userPresets]);

  const handlePresetSelect = (settings) => {
    onChange(settings);
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
  
  const handleToggleAB = () => onChange('__toggle_ab_state', null);
  const handleCopyToB = () => onChange('__copy_a_to_b', null);

  return (
    <div className="preset-controls">
        <div className="preset-manager__selector">
            <button ref={buttonRef} onClick={(e) => { e.stopPropagation(); setIsMenuOpen(true); }} className={`preset-button ${isMenuOpen ? 'preset-button--open' : ''}`}>
                <span className="preset-button__name">{activePresetName}</span>
                <ChevronDown size={16} className="preset-button__chevron" />
            </button>
            <PresetMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} anchorEl={buttonRef.current} factoryPresets={factoryPresets} userPresets={userPresets} onSelect={handlePresetSelect} onDelete={handleDelete} />
        </div>
        
        <div className="ab-toggle">
            <button onClick={handleToggleAB} className={`ab-button ${!effect.abState?.isB ? 'ab-button--active' : ''}`}>A</button>
            <button onClick={handleToggleAB} className={`ab-button ${effect.abState?.isB ? 'ab-button--active' : ''}`}>B</button>
        </div>
        
        <button onClick={handleCopyToB} className="preset-action-btn" title="A'yı B'ye Kopyala"><GitCompareArrows size={16} /></button>
        <button onClick={handleSave} className="preset-action-btn" title="Preset'i Kaydet"><Save size={16} /></button>
    </div>
  );
};
