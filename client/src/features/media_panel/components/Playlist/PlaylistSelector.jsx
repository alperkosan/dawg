/**
 * PlaylistSelector - Modal for selecting/creating playlists
 * 
 * Features:
 * - List user playlists
 * - Create new playlist
 * - Add/remove project from playlists
 * - Search playlists
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Search, Check, Loader2 } from 'lucide-react';
import { playlistService } from '../../services/playlistService';
import { apiClient } from '@/services/api.js';
import './PlaylistSelector.css';

export default function PlaylistSelector({ 
  projectId, 
  isOpen, 
  onClose,
  onPlaylistChange,
}) {
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [projectPlaylists, setProjectPlaylists] = useState(new Set());

  // Load playlists
  const loadPlaylists = useCallback(async () => {
    if (!isOpen) return;
    
    setIsLoading(true);
    try {
      const response = await playlistService.getUserPlaylists(1, 50);
      setPlaylists(response.playlists || []);
      
      // Load which playlists contain this project
      if (projectId) {
        const projectPlaylistsResponse = await playlistService.getPlaylistsForProject(projectId);
        const playlistIds = (projectPlaylistsResponse.playlists || []).map(p => p.id);
        setProjectPlaylists(new Set(playlistIds));
      }
    } catch (error) {
      console.error('Failed to load playlists:', error);
      apiClient.showToast('Failed to load playlists', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, projectId]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  // Filter playlists by search
  const filteredPlaylists = playlists.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle project in playlist
  const handleTogglePlaylist = useCallback(async (playlistId) => {
    const isInPlaylist = projectPlaylists.has(playlistId);
    
    try {
      if (isInPlaylist) {
        await playlistService.removeProjectFromPlaylist(playlistId, projectId);
        setProjectPlaylists(prev => {
          const next = new Set(prev);
          next.delete(playlistId);
          return next;
        });
        apiClient.showToast('Removed from playlist', 'success');
      } else {
        await playlistService.addProjectToPlaylist(playlistId, projectId);
        setProjectPlaylists(prev => new Set([...prev, playlistId]));
        apiClient.showToast('Added to playlist', 'success');
      }
      
      onPlaylistChange?.(playlistId, !isInPlaylist);
    } catch (error) {
      console.error('Failed to toggle playlist:', error);
      apiClient.showToast('Failed to update playlist', 'error');
    }
  }, [projectId, projectPlaylists, onPlaylistChange]);

  // Create new playlist
  const handleCreatePlaylist = useCallback(async (e) => {
    e.preventDefault();
    
    if (!newPlaylistName.trim()) return;
    
    setIsCreating(true);
    try {
      const response = await playlistService.createPlaylist(newPlaylistName.trim());
      const newPlaylist = response.playlist;
      
      setPlaylists(prev => [newPlaylist, ...prev]);
      setNewPlaylistName('');
      
      // Automatically add project to new playlist
      if (projectId) {
        await playlistService.addProjectToPlaylist(newPlaylist.id, projectId);
        setProjectPlaylists(prev => new Set([...prev, newPlaylist.id]));
        apiClient.showToast('Playlist created and project added', 'success');
      } else {
        apiClient.showToast('Playlist created', 'success');
      }
      
      onPlaylistChange?.(newPlaylist.id, true);
    } catch (error) {
      console.error('Failed to create playlist:', error);
      apiClient.showToast('Failed to create playlist', 'error');
    } finally {
      setIsCreating(false);
    }
  }, [newPlaylistName, projectId, onPlaylistChange]);

  if (!isOpen) return null;

  return (
    <div className="playlist-selector-overlay" onClick={onClose}>
      <div className="playlist-selector" onClick={(e) => e.stopPropagation()}>
        <div className="playlist-selector__header">
          <h3>Add to Playlist</h3>
          <button 
            className="playlist-selector__close"
            onClick={onClose}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Create new playlist */}
        <form 
          className="playlist-selector__create"
          onSubmit={handleCreatePlaylist}
        >
          <input
            type="text"
            placeholder="Create new playlist..."
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            disabled={isCreating}
            className="playlist-selector__create-input"
          />
          <button
            type="submit"
            className="playlist-selector__create-btn"
            disabled={!newPlaylistName.trim() || isCreating}
          >
            {isCreating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
          </button>
        </form>

        {/* Search */}
        <div className="playlist-selector__search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search playlists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="playlist-selector__search-input"
          />
        </div>

        {/* Playlist list */}
        <div className="playlist-selector__list">
          {isLoading ? (
            <div className="playlist-selector__loading">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading playlists...</span>
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="playlist-selector__empty">
              {searchQuery ? 'No playlists found' : 'No playlists yet'}
            </div>
          ) : (
            filteredPlaylists.map((playlist) => {
              const isInPlaylist = projectPlaylists.has(playlist.id);
              
              return (
                <button
                  key={playlist.id}
                  className={`playlist-selector__item ${isInPlaylist ? 'active' : ''}`}
                  onClick={() => handleTogglePlaylist(playlist.id)}
                >
                  <div className="playlist-selector__item-info">
                    <span className="playlist-selector__item-name">{playlist.name}</span>
                    <span className="playlist-selector__item-count">
                      {playlist.projectCount || 0} projects
                    </span>
                  </div>
                  {isInPlaylist && (
                    <Check size={18} className="playlist-selector__item-check" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

