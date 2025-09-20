import React, { useMemo, useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { pluginRegistry } from '../../../config/pluginConfig';

export const EffectBrowser = ({ onSelect, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const categorizedPlugins = useMemo(() => {
    const categories = {};
    Object.values(pluginRegistry).forEach(plugin => {
      // Arama filtresi
      if (searchTerm && !plugin.type.toLowerCase().includes(searchTerm.toLowerCase())) {
        return;
      }
      const category = plugin.category || 'Diğer';
      if (!categories[category]) categories[category] = [];
      categories[category].push(plugin);
    });
    return Object.entries(categories);
  }, [searchTerm]);

  return (
    <div className="effect-browser">
      <header className="effect-browser__header">
        <button onClick={onBack} className="effect-browser__back-btn" title="Geri">
          <ChevronLeft size={18} />
        </button>
        <Search size={16} className="text-gray-500" />
        <input
          type="text"
          placeholder="Efekt ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="effect-browser__search-input"
          autoFocus
        />
      </header>
      <div className="effect-browser__list">
        {categorizedPlugins.map(([category, plugins]) => (
          <div key={category}>
            <h4 className="effect-browser__category-title">{category}</h4>
            {plugins.map(plugin => (
              <button
                key={plugin.type}
                onClick={() => onSelect(plugin.type)}
                className="effect-browser__item"
              >
                {plugin.type}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};