/**
 * Quick Actions - Dropdown menu for project actions
 * 
 * Actions:
 * - Open in DAW
 * - Fork Project
 * - Add to Playlist
 * - Download
 * - Copy Link
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  MoreHorizontal, 
  ExternalLink, 
  GitBranch, 
  ListPlus, 
  Download, 
  Link2,
  Flag,
  X
} from 'lucide-react';
import { apiClient } from '@/services/api.js';
import PlaylistSelector from '../Playlist/PlaylistSelector';
import './QuickActions.css';

export default function QuickActions({ project, onFork }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaylistSelectorOpen, setIsPlaylistSelectorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target) &&
        !buttonRef.current.contains(event.target)
      ) {
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

  // Close menu on escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleOpenInDAW = (e) => {
    e.stopPropagation();
    // Navigate to DAW with project loaded
    window.location.href = `/daw?project=${project.id}`;
    setIsOpen(false);
  };

  const handleFork = async (e) => {
    e.stopPropagation();
    setIsLoading(true);
    
    try {
      const response = await apiClient.forkProject(project.id);
      apiClient.showToast('Project forked successfully!', 'success');
      onFork?.(response.project);
      
      // Optionally navigate to the forked project
      if (response.project?.id) {
        window.location.href = `/daw?project=${response.project.id}`;
      }
    } catch (error) {
      console.error('Failed to fork project:', error);
      apiClient.showToast('Failed to fork project', 'error');
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleAddToPlaylist = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    setIsPlaylistSelectorOpen(true);
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    
    if (!project.previewAudioUrl && !project.preview_audio_url) {
      apiClient.showToast('No audio available for download', 'error');
      return;
    }

    try {
      const url = project.previewAudioUrl || project.preview_audio_url;
      const response = await fetch(url);
      const blob = await response.blob();
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${project.title || 'project'}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      apiClient.showToast('Download started', 'success');
    } catch (error) {
      console.error('Failed to download:', error);
      apiClient.showToast('Failed to download', 'error');
    }
    
    setIsOpen(false);
  };

  const handleCopyLink = async (e) => {
    e.stopPropagation();
    
    try {
      const url = `${window.location.origin}/project/${project.id}`;
      await navigator.clipboard.writeText(url);
      apiClient.showToast('Link copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy link:', error);
      apiClient.showToast('Failed to copy link', 'error');
    }
    
    setIsOpen(false);
  };

  const handleReport = (e) => {
    e.stopPropagation();
    // TODO: Open report modal
    apiClient.showToast('Report feature coming soon!', 'info');
    setIsOpen(false);
  };

  return (
    <div className="quick-actions">
      <button
        ref={buttonRef}
        className={`quick-actions__trigger ${isOpen ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="More actions"
      >
        <MoreHorizontal size={18} />
      </button>

      {isOpen && (
        <div ref={menuRef} className="quick-actions__menu">
          <div className="quick-actions__menu-header">
            <span>Actions</span>
            <button 
              className="quick-actions__close"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div className="quick-actions__menu-items">
            <button 
              className="quick-actions__item"
              onClick={handleOpenInDAW}
            >
              <ExternalLink size={16} />
              <span>Open in DAW</span>
            </button>

            <button 
              className="quick-actions__item"
              onClick={handleFork}
              disabled={isLoading}
            >
              <GitBranch size={16} />
              <span>{isLoading ? 'Forking...' : 'Fork Project'}</span>
            </button>

            <button 
              className="quick-actions__item"
              onClick={handleAddToPlaylist}
            >
              <ListPlus size={16} />
              <span>Add to Playlist</span>
            </button>

            <div className="quick-actions__divider" />

            <button 
              className="quick-actions__item"
              onClick={handleDownload}
            >
              <Download size={16} />
              <span>Download Audio</span>
            </button>

            <button 
              className="quick-actions__item"
              onClick={handleCopyLink}
            >
              <Link2 size={16} />
              <span>Copy Link</span>
            </button>

            <div className="quick-actions__divider" />

            <button 
              className="quick-actions__item quick-actions__item--danger"
              onClick={handleReport}
            >
              <Flag size={16} />
              <span>Report</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Playlist Selector Modal */}
      <PlaylistSelector
        projectId={project.id}
        isOpen={isPlaylistSelectorOpen}
        onClose={() => setIsPlaylistSelectorOpen(false)}
      />
    </div>
  );
}

