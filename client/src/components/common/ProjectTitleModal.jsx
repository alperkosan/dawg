/**
 * Project Title Modal
 * Allows user to edit project title
 */

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import './ProjectTitleModal.css';

export default function ProjectTitleModal({ isOpen, onClose, currentTitle, onSave }) {
  const [title, setTitle] = useState(currentTitle || '');

  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle || '');
      console.log('📝 ProjectTitleModal opened, title set to:', currentTitle);
    }
  }, [isOpen, currentTitle]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(title.trim());
      onClose();
    }
  };

  // ✅ FIX: Use early return but ensure React can batch the state update properly
  if (!isOpen) {
    return null;
  }

  return (
    <div className="project-title-modal-overlay" onClick={onClose}>
      <div className="project-title-modal" onClick={(e) => e.stopPropagation()}>
        <div className="project-title-modal__header">
          <h2>Edit Project Title</h2>
          <button className="project-title-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="project-title-modal__form">
          <div className="project-title-modal__field">
            <label htmlFor="project-title">Project Title</label>
            <input
              id="project-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter project title..."
              maxLength={255}
              autoFocus
              required
            />
          </div>
          <div className="project-title-modal__actions">
            <button type="button" className="project-title-modal__button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="project-title-modal__button project-title-modal__button--primary">
              <Save size={16} />
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
