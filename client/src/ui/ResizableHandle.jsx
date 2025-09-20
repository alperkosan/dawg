import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Save, Trash2, GitCompareArrows } from 'lucide-react';
import ReactDOM from 'react-dom';

/**
 * Bir plugin için fabrika ve kullanıcı preset'lerini yöneten, A/B karşılaştırması
 * ve kullanıcı preseti silme gibi özellikler içeren gelişmiş arayüz.
 * @param {string} pluginType - Mevcut plugin'in türü (örn: 'Compressor').
 * @param {object} effect - Mevcut efektin tüm verisi (ayarlar ve abState dahil).
 * @param {Array<object>} factoryPresets - pluginConfig'den gelen fabrika ayarları.
 * @param {Function} onChange - Değişiklikleri ana state'e bildiren fonksiyon.
 */
export const PresetManager = ({ pluginType, effect, factoryPresets = [], onChange }) => {
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

  // Mevcut ayarlar bir presete uyuyor mu diye kontrol et
  useEffect(() => {
    const allPresets = [...factoryPresets, ...userPresets];
    // A/B durumundayken, A state'ine göre isim bul
    const currentSettings = effect.abState?.isB ? effect.abState.a : effect.settings;
    const matchingPreset = allPresets.find(p => 
        JSON.stringify(p.settings) === JSON.stringify(currentSettings)
    );
    setActivePresetName(matchingPreset ? matchingPreset.name : 'Custom*');
  }, [effect.settings, effect.abState, factoryPresets, userPresets]);
  
  // Menü dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target) && !menuRef.current.parentElement.contains(event.target)) {
            setIsMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const handlePresetSelect = (presetSettings) => {
    onChange(presetSettings); // Preset ayarlarını uygula
    setIsMenuOpen(false);
  };

  const handleSave = () => {
    const name = prompt("Preset için bir isim girin:");
    if (name && name.trim()) {
      const newPreset = { name: name.trim(), settings: { ...effect.settings } };
      const updatedPresets = [...userPresets, newPreset];
      setUserPresets(updatedPresets);
      window.localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
    }
  };

  const handleDelete = (presetNameToDelete) => {
    if (window.confirm(`'${presetNameToDelete}' preseti silinecek. Emin misiniz?`)) {
        const updatedPresets = userPresets.filter(p => p.name !== presetNameToDelete);
        setUserPresets(updatedPresets);
        window.localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
    }
  };

  // A/B Karşılaştırma Mantığı
  const handleToggleAB = () => onChange('__toggle_ab_state', null);
  const handleCopyToB = () => onChange('__copy_a_to_b', null);

  return (
    <div className="absolute top-0 left-0 right-0 h-10 bg-gray-900/50 flex items-center justify-between px-3 z-10 border-b border-black/20" ref={menuRef}>
      {/* Sol Taraf: Preset Seçimi */}
      <div className="relative">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
          className="flex items-center gap-2 text-white text-xs font-bold px-3 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 rounded-md transition-colors"
        >
          <span className="max-w-[120px] truncate">{activePresetName}</span>
          <ChevronDown size={14} className={`transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {isMenuOpen && (
            <div className="absolute top-full mt-1 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-2xl p-1 max-h-60 overflow-y-auto">
                {factoryPresets.length > 0 && (
                    <>
                        <h4 className="text-xs text-gray-500 font-bold px-2 py-1">Fabrika</h4>
                        {factoryPresets.map(p => 
                            <button key={p.name} onClick={() => handlePresetSelect(p.settings)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-cyan-700">{p.name}</button>
                        )}
                    </>
                )}
                 {userPresets.length > 0 && (
                    <>
                        <h4 className="text-xs text-gray-500 font-bold px-2 py-1 mt-2">Kullanıcı</h4>
                        {userPresets.map(p => 
                            <div key={p.name} className="group flex items-center justify-between w-full text-left text-sm rounded hover:bg-cyan-700">
                                <button onClick={() => handlePresetSelect(p.settings)} className="flex-grow text-left px-2 py-1.5">{p.name}</button>
                                <button onClick={() => handleDelete(p.name)} className="p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-500">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        )}
      </div>

      {/* Sağ Taraf: A/B ve Kaydet */}
      <div className="flex items-center gap-2">
        <button onClick={handleSave} className="p-1.5 bg-gray-700/80 hover:bg-cyan-600/80 rounded-md transition-colors" title="Mevcut Ayarları Yeni Preset Olarak Kaydet">
          <Save size={14} />
        </button>
        <div className="flex items-center gap-1 bg-gray-800 rounded-md p-0.5">
            <button 
                onClick={handleToggleAB}
                className={`px-2 py-0.5 text-xs font-bold rounded ${!effect.abState?.isB ? 'bg-amber-500 text-gray-900' : 'bg-gray-600'}`}
            >A</button>
             <button 
                onClick={handleToggleAB}
                className={`px-2 py-0.5 text-xs font-bold rounded ${effect.abState?.isB ? 'bg-amber-500 text-gray-900' : 'bg-gray-600'}`}
            >B</button>
        </div>
         <button onClick={handleCopyToB} className="p-1.5 bg-gray-700/80 hover:bg-gray-600/80 rounded-md transition-colors" title="A Ayarlarını B'ye Kopyala">
            <GitCompareArrows size={14} />
        </button>
      </div>
    </div>
  );
};