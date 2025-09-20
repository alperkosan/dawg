// src/features/piano_roll/components/ui/KeyboardShortcutsPanel.jsx
import React, { useState } from 'react';
import { Keyboard, X, Search, Filter } from 'lucide-react';
import '../../styles/components/KeyboardShortcutsPanel.css';

export const KeyboardShortcutsPanel = ({ isOpen, onClose, shortcuts }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', name: 'All', color: 'bg-gray-600' },
    { id: 'tools', name: 'Tools', color: 'bg-blue-600' },
    { id: 'selection', name: 'Selection', color: 'bg-indigo-600' },
    { id: 'editing', name: 'Edit', color: 'bg-green-600' },
    { id: 'transport', name: 'Playback', color: 'bg-purple-600' },
    { id: 'view', name: 'View', color: 'bg-orange-600' },
    { id: 'navigation', name: 'Navigation', color: 'bg-yellow-600' },
    { id: 'velocity', name: 'Velocity', color: 'bg-red-600' },
    { id: 'transposition', name: 'Transpose', color: 'bg-pink-600' },
    { id: 'quantization', name: 'Timing', color: 'bg-cyan-600' }
  ];

  const filteredShortcuts = Object.entries(shortcuts).filter(([category]) => 
    activeCategory === 'all' || category === activeCategory
  ).filter(([category, shortcuts]) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return Object.entries(shortcuts).some(([shortcut, description]) =>
      shortcut.toLowerCase().includes(searchLower) ||
      description.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="keyboard-shortcuts-panel">
      <div className="shortcuts-panel__content">
        {/* Header */}
        <div className="shortcuts-panel__header">
          <div className="shortcuts-panel__title">
            <Keyboard size={24} />
            <h2>Piano Roll Shortcuts</h2>
          </div>
          <button onClick={onClose} className="shortcuts-panel__close">
            <X size={20} />
          </button>
        </div>

        {/* Search and Filter */}
        <div className="shortcuts-panel__filters">
          <div className="shortcuts-panel__search">
            <Search size={16} className="shortcuts-panel__search-icon" />
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="shortcuts-panel__search-input"
            />
          </div>

          <div className="shortcuts-panel__category-filters">
            <div className="shortcuts-panel__filter-label">
              <Filter size={16} />
              <span>Filter:</span>
            </div>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shortcuts-panel__category-btn ${
                  activeCategory === cat.id ? 'shortcuts-panel__category-btn--active' : ''
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="shortcuts-panel__body">
          <div className="shortcuts-panel__grid">
            {filteredShortcuts.map(([category, categoryShortcuts]) => (
              <div key={category} className="shortcuts-category">
                <h3 className="shortcuts-category__title">
                  {category.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
                <div className="shortcuts-category__items">
                  {Object.entries(categoryShortcuts)
                    .filter(([shortcut, description]) => {
                      if (!searchTerm) return true;
                      const searchLower = searchTerm.toLowerCase();
                      return shortcut.toLowerCase().includes(searchLower) ||
                             description.toLowerCase().includes(searchLower);
                    })
                    .map(([shortcut, description]) => (
                    <div key={shortcut} className="shortcut-item">
                      <span className="shortcut-item__description">{description}</span>
                      <div className="shortcut-item__keys">
                        {shortcut.split(' / ').map((key, index) => (
                          <React.Fragment key={index}>
                            {index > 0 && <span className="shortcut-item__separator">or</span>}
                            <kbd className="shortcut-item__key">{key}</kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="shortcuts-panel__footer">
          <div className="shortcuts-panel__help-text">
            Press <kbd>F1</kbd> or click the help button anytime
          </div>
          <div className="shortcuts-panel__stats">
            {Object.values(shortcuts).reduce((acc, cat) => acc + Object.keys(cat).length, 0)} shortcuts available
          </div>
        </div>
      </div>
    </div>
  );
};