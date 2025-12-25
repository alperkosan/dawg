/**
 * Playlist Service
 * 
 * Handles playlist operations:
 * - Create, update, delete playlists
 * - Add/remove projects from playlists
 * - Get user playlists
 * - Get playlist details
 */

import { apiClient } from '@/services/api.js';

class PlaylistService {
  /**
   * Get all playlists for current user
   */
  async getUserPlaylists(page = 1, limit = 20) {
    try {
      if (apiClient.getPlaylists) {
        return await apiClient.getPlaylists({ page, limit });
      }
      
      // Fallback: Return empty
      return {
        playlists: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
      };
    } catch (error) {
      console.error('Failed to get playlists:', error);
      throw error;
    }
  }

  /**
   * Get playlist by ID
   */
  async getPlaylist(playlistId) {
    try {
      if (apiClient.getPlaylist) {
        return await apiClient.getPlaylist(playlistId);
      }
      
      throw new Error('Get playlist endpoint not available');
    } catch (error) {
      console.error('Failed to get playlist:', error);
      throw error;
    }
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(name, description = null, isPublic = false) {
    try {
      if (apiClient.createPlaylist) {
        return await apiClient.createPlaylist({ name, description, isPublic });
      }
      
      // Fallback: Return mock playlist
      return {
        playlist: {
          id: `playlist-${Date.now()}`,
          name,
          description,
          isPublic,
          projectCount: 0,
          createdAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Failed to create playlist:', error);
      throw error;
    }
  }

  /**
   * Update playlist
   */
  async updatePlaylist(playlistId, updates) {
    try {
      if (apiClient.updatePlaylist) {
        return await apiClient.updatePlaylist(playlistId, updates);
      }
      
      throw new Error('Update playlist endpoint not available');
    } catch (error) {
      console.error('Failed to update playlist:', error);
      throw error;
    }
  }

  /**
   * Delete playlist
   */
  async deletePlaylist(playlistId) {
    try {
      if (apiClient.deletePlaylist) {
        return await apiClient.deletePlaylist(playlistId);
      }
      
      throw new Error('Delete playlist endpoint not available');
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      throw error;
    }
  }

  /**
   * Add project to playlist
   */
  async addProjectToPlaylist(playlistId, projectId) {
    try {
      if (apiClient.addProjectToPlaylist) {
        return await apiClient.addProjectToPlaylist(playlistId, projectId);
      }
      
      // Fallback: Return success
      return { success: true };
    } catch (error) {
      console.error('Failed to add project to playlist:', error);
      throw error;
    }
  }

  /**
   * Remove project from playlist
   */
  async removeProjectFromPlaylist(playlistId, projectId) {
    try {
      if (apiClient.removeProjectFromPlaylist) {
        return await apiClient.removeProjectFromPlaylist(playlistId, projectId);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to remove project from playlist:', error);
      throw error;
    }
  }

  /**
   * Reorder projects in playlist
   */
  async reorderPlaylistProjects(playlistId, projectIds) {
    try {
      if (apiClient.reorderPlaylistProjects) {
        return await apiClient.reorderPlaylistProjects(playlistId, projectIds);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to reorder playlist:', error);
      throw error;
    }
  }

  /**
   * Get playlists that contain a specific project
   */
  async getPlaylistsForProject(projectId) {
    try {
      if (apiClient.getPlaylistsForProject) {
        return await apiClient.getPlaylistsForProject(projectId);
      }
      
      return { playlists: [] };
    } catch (error) {
      console.error('Failed to get playlists for project:', error);
      throw error;
    }
  }
}

export const playlistService = new PlaylistService();
export default playlistService;

