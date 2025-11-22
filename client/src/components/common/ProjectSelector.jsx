/**
 * Project Selector Component
 * Lists user projects and allows switching between them
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { projectService } from '../../services/projectService';
import { FolderOpen, Plus, Loader2, X, Search } from 'lucide-react';
import './ProjectSelector.css';

export default function ProjectSelector({ currentProjectId, onProjectSelect, onNewProject }) {
  const { isAuthenticated, isGuest } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  // ✅ FIX: Memoize loadProjects to avoid unnecessary re-renders
  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await projectService.listProjects({
        limit: 50,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      });
      
      const loadedProjects = response.projects || [];
      setProjects(loadedProjects);
      console.log(`✅ Loaded ${loadedProjects.length} projects`);
      
      // ✅ FIX: If currentProjectId is set but not in loaded projects, it might be a new project
      // This is handled by the parent component, so we just log it
      if (currentProjectId && !loadedProjects.find(p => p.id === currentProjectId)) {
        console.log(`⚠️ Current project ${currentProjectId} not found in loaded projects`);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Projeler yüklenemedi');
      setProjects([]); // ✅ FIX: Clear projects on error
    } finally {
      setIsLoading(false);
    }
  }, []); // ✅ FIX: No dependencies to avoid infinite loops

  // ✅ FIX: Load projects immediately when authenticated (for initial load)
  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      loadProjects();
    }
  }, [isAuthenticated, isGuest, loadProjects]);

  // ✅ FIX: When currentProjectId is set but project not in list, reload projects
  useEffect(() => {
    if (currentProjectId && isAuthenticated && !isGuest && projects.length > 0) {
      const projectExists = projects.find(p => p.id === currentProjectId);
      if (!projectExists) {
        console.log(`🔄 Current project ${currentProjectId} not in list, reloading projects...`);
        loadProjects();
      }
    }
  }, [currentProjectId, projects, isAuthenticated, isGuest, loadProjects]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleProjectClick = async (projectId) => {
    if (projectId === currentProjectId) {
      setIsOpen(false);
      return;
    }

    try {
      setIsLoading(true);
      await onProjectSelect(projectId);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to load project:', err);
      setError('Proje yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewProject = () => {
    setIsOpen(false);
    if (onNewProject) {
      onNewProject();
    }
  };

  const filteredProjects = projects.filter(project =>
    project.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ✅ FIX: Find current project, or if currentProjectId is set but not in projects yet, 
  // show a loading state or the project ID
  const currentProject = projects.find(p => p.id === currentProjectId);
  
  // ✅ FIX: If currentProjectId is set but project not loaded yet, show it as "Loading..."
  const displayText = currentProject 
    ? currentProject.title 
    : currentProjectId 
      ? (isLoading ? 'Yükleniyor...' : 'Proje Seç...') 
      : 'Proje Seç...';

  if (isGuest || !isAuthenticated) {
    return null;
  }

  return (
    <div className="project-selector" ref={dropdownRef}>
      <button
        className="project-selector__trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Projeleri Görüntüle"
      >
        <FolderOpen size={18} />
        <span className="project-selector__current">
          {displayText}
        </span>
      </button>

      {isOpen && (
        <div className="project-selector__dropdown">
          <div className="project-selector__header">
            <h3 className="project-selector__title">Projelerim</h3>
            <button
              className="project-selector__close"
              onClick={() => setIsOpen(false)}
              aria-label="Kapat"
            >
              <X size={18} />
            </button>
          </div>

          <div className="project-selector__search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Proje ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="project-selector__search-input"
            />
          </div>

          {error && (
            <div className="project-selector__error">
              {error}
            </div>
          )}

          <div className="project-selector__list">
            {isLoading && projects.length === 0 ? (
              <div className="project-selector__loading">
                <Loader2 size={20} className="spinner" />
                <span>Yükleniyor...</span>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="project-selector__empty">
                {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz proje yok'}
              </div>
            ) : (
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  className={`project-selector__item ${
                    project.id === currentProjectId ? 'project-selector__item--active' : ''
                  }`}
                  onClick={() => handleProjectClick(project.id)}
                >
                  <div className="project-selector__item-info">
                    <div className="project-selector__item-title">{project.title || 'Untitled'}</div>
                    {project.description && (
                      <div className="project-selector__item-description">{project.description}</div>
                    )}
                    <div className="project-selector__item-meta">
                      {project.bpm && <span>{project.bpm} BPM</span>}
                      {project.updatedAt && (
                        <span>
                          {new Date(project.updatedAt).toLocaleDateString('tr-TR', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="project-selector__footer">
            <button
              className="project-selector__new-btn"
              onClick={handleNewProject}
            >
              <Plus size={18} />
              <span>Yeni Proje</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

