/**
 * Interaction service for media panel
 * Handles likes, comments, shares, remixes, and follows
 */

import { apiClient } from '@/services/api.js';

class InteractionService {
  /**
   * Toggle like on a project
   */
  async toggleLike(projectId) {
    try {
      return await apiClient.toggleLike(projectId);
    } catch (error) {
      console.error('Failed to toggle like:', error);
      throw error;
    }
  }

  /**
   * Add comment to a project
   */
  async addComment(projectId, content, parentId = null) {
    try {
      return await apiClient.addComment(projectId, content, parentId);
    } catch (error) {
      console.error('Failed to add comment:', error);
      throw error;
    }
  }

  /**
   * Get comments for a project
   */
  async getComments(projectId, page = 1, limit = 50) {
    try {
      return await apiClient.getComments(projectId, page, limit);
    } catch (error) {
      console.error('Failed to get comments:', error);
      throw error;
    }
  }

  /**
   * Share a project
   */
  async shareProject(projectId, platform = null) {
    try {
      return await apiClient.shareProject(projectId, platform);
    } catch (error) {
      console.error('Failed to share project:', error);
      throw error;
    }
  }

  /**
   * Create a remix of a project
   */
  async createRemix(projectId, changesSummary = null, credits = null) {
    try {
      return await apiClient.createRemix(projectId, changesSummary, credits);
    } catch (error) {
      console.error('Failed to create remix:', error);
      throw error;
    }
  }

  /**
   * Follow/unfollow a user
   */
  async toggleFollow(userId) {
    try {
      return await apiClient.toggleFollow(userId);
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      throw error;
    }
  }

  /**
   * Get user's liked projects
   * TODO: Implement when backend endpoint is ready
   */
  async getLikedProjects(page = 1, limit = 20) {
    try {
      const response = await apiClient.getFeed({
        page,
        limit,
        sort: 'recent',
        filter: 'all',
      });
      // Filter to only show liked projects
      return {
        ...response,
        projects: response.projects.filter(p => p.isLiked),
      };
    } catch (error) {
      console.error('Failed to get liked projects:', error);
      throw error;
    }
  }

  /**
   * Get user's commented projects
   * TODO: Implement when backend endpoint is ready
   */
  async getCommentedProjects(page = 1, limit = 20) {
    try {
      // Placeholder - will be implemented when backend endpoint is ready
      return {
        projects: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
      };
    } catch (error) {
      console.error('Failed to get commented projects:', error);
      throw error;
    }
  }

  /**
   * Get user's shared projects
   * TODO: Implement when backend endpoint is ready
   */
  async getSharedProjects(page = 1, limit = 20) {
    try {
      // Placeholder - will be implemented when backend endpoint is ready
      return {
        projects: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
      };
    } catch (error) {
      console.error('Failed to get shared projects:', error);
      throw error;
    }
  }

  /**
   * Get user's remix projects
   * TODO: Implement when backend endpoint is ready
   */
  async getRemixProjects(page = 1, limit = 20) {
    try {
      // Placeholder - will be implemented when backend endpoint is ready
      return {
        projects: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
      };
    } catch (error) {
      console.error('Failed to get remix projects:', error);
      throw error;
    }
  }
}

export const interactionService = new InteractionService();
export default interactionService;

