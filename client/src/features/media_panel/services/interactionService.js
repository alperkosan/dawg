/**
 * Interaction Service for Media Panel
 * 
 * Handles all user interactions:
 * - Likes, Comments, Shares, Remixes
 * - Following users
 * - User interaction history
 * 
 * API Endpoints (current + planned):
 * - POST /api/projects/:id/like
 * - POST /api/projects/:id/comment
 * - POST /api/projects/:id/share
 * - POST /api/projects/:id/fork
 * - GET /api/interactions/liked
 * - GET /api/interactions/commented
 * - GET /api/interactions/shared
 * - GET /api/interactions/remixes
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
   * Delete a comment
   */
  async deleteComment(commentId) {
    try {
      return await apiClient.deleteComment(commentId);
    } catch (error) {
      console.error('Failed to delete comment:', error);
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
   * Fork/Remix a project
   */
  async forkProject(projectId) {
    try {
      // Use existing fork endpoint or create remix
      if (apiClient.forkProject) {
        return await apiClient.forkProject(projectId);
      }
      return await apiClient.createRemix(projectId);
    } catch (error) {
      console.error('Failed to fork project:', error);
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
   * Uses dedicated endpoint if available, fallback to feed filter
   */
  async getLikedProjects(page = 1, limit = 20) {
    try {
      // Try dedicated endpoint first
      if (apiClient.getInteractions) {
        return await apiClient.getInteractions('liked', { page, limit });
      }
      
      // Fallback: Filter from feed
      const response = await apiClient.getFeed({
        page,
        limit,
        sort: 'recent',
        filter: 'all',
      });
      
      return {
        projects: response.projects.filter(p => p.isLiked),
        pagination: {
          ...response.pagination,
          total: response.projects.filter(p => p.isLiked).length,
        },
      };
    } catch (error) {
      console.error('Failed to get liked projects:', error);
      throw error;
    }
  }

  /**
   * Get user's commented projects
   */
  async getCommentedProjects(page = 1, limit = 20) {
    try {
      // Try dedicated endpoint
      if (apiClient.getInteractions) {
        return await apiClient.getInteractions('commented', { page, limit });
      }
      
      // Fallback: Return empty (needs backend support)
      return {
        projects: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
        message: 'Commented projects endpoint not available',
      };
    } catch (error) {
      console.error('Failed to get commented projects:', error);
      throw error;
    }
  }

  /**
   * Get user's shared projects
   */
  async getSharedProjects(page = 1, limit = 20) {
    try {
      // Try dedicated endpoint
      if (apiClient.getInteractions) {
        return await apiClient.getInteractions('shared', { page, limit });
      }
      
      // Fallback: Return empty
      return {
        projects: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
        message: 'Shared projects endpoint not available',
      };
    } catch (error) {
      console.error('Failed to get shared projects:', error);
      throw error;
    }
  }

  /**
   * Get user's remix projects (projects they remixed)
   */
  async getRemixProjects(page = 1, limit = 20) {
    try {
      // Try dedicated endpoint
      if (apiClient.getInteractions) {
        return await apiClient.getInteractions('remixes', { page, limit });
      }
      
      // Fallback: Return empty
      return {
        projects: [],
        pagination: {
          page,
          limit,
          total: 0,
          hasMore: false,
        },
        message: 'Remix projects endpoint not available',
      };
    } catch (error) {
      console.error('Failed to get remix projects:', error);
      throw error;
    }
  }

  /**
   * Get all interaction types for a specific project
   */
  async getProjectInteractions(projectId) {
    try {
      if (apiClient.getProjectInteractions) {
        return await apiClient.getProjectInteractions(projectId);
      }
      
      // Fallback: Return basic stats
      return {
        likes: 0,
        comments: 0,
        shares: 0,
        remixes: 0,
        isLiked: false,
      };
    } catch (error) {
      console.error('Failed to get project interactions:', error);
      throw error;
    }
  }

  /**
   * Batch fetch interaction status for multiple projects
   * Useful for feed loading
   */
  async batchGetInteractionStatus(projectIds) {
    try {
      if (apiClient.batchGetInteractionStatus) {
        return await apiClient.batchGetInteractionStatus(projectIds);
      }
      
      // Fallback: Return empty map
      return projectIds.reduce((acc, id) => {
        acc[id] = { isLiked: false, commentCount: 0 };
        return acc;
      }, {});
    } catch (error) {
      console.error('Failed to batch get interaction status:', error);
      throw error;
    }
  }
}

export const interactionService = new InteractionService();
export default interactionService;
