/**
 * useInteractions - Hook for managing user interactions
 * 
 * Provides data and actions for:
 * - Liked projects
 * - Commented projects
 * - Shared projects
 * - Remix projects
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { interactionService } from '../services/interactionService';
import { apiClient } from '@/services/api.js';

const INTERACTION_TYPES = {
  LIKES: 'likes',
  COMMENTS: 'comments',
  SHARES: 'shares',
  REMIXES: 'remixes',
};

export function useInteractions(tab = INTERACTION_TYPES.LIKES) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  const abortControllerRef = useRef(null);

  // Get the appropriate service method based on tab
  const getServiceMethod = useCallback((tab) => {
    switch (tab) {
      case INTERACTION_TYPES.LIKES:
        return interactionService.getLikedProjects.bind(interactionService);
      case INTERACTION_TYPES.COMMENTS:
        return interactionService.getCommentedProjects.bind(interactionService);
      case INTERACTION_TYPES.SHARES:
        return interactionService.getSharedProjects.bind(interactionService);
      case INTERACTION_TYPES.REMIXES:
        return interactionService.getRemixProjects.bind(interactionService);
      default:
        return interactionService.getLikedProjects.bind(interactionService);
    }
  }, []);

  const loadInteractions = useCallback(async (page = 1, append = false) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (page === 1) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsFetchingNextPage(true);
      }

      const serviceMethod = getServiceMethod(tab);
      const response = await serviceMethod(page, 20);

      if (append) {
        setProjects((prev) => [...prev, ...(response.projects || [])]);
      } else {
        setProjects(response.projects || []);
      }

      setHasNextPage(response.pagination?.hasMore || false);
      setTotalCount(response.pagination?.total || response.projects?.length || 0);
      setCurrentPage(page);
    } catch (err) {
      if (err.name === 'AbortError') {
        return; // Request was cancelled
      }
      setError(err);
      setTimeout(() => {
        apiClient.showToast(`Failed to load ${tab}`, 'error');
      }, 0);
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [tab, getServiceMethod]);

  // Load on tab change
  useEffect(() => {
    setCurrentPage(1);
    setProjects([]);
    loadInteractions(1, false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [tab, loadInteractions]);

  // Load more (pagination)
  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      loadInteractions(currentPage + 1, true);
    }
  }, [currentPage, hasNextPage, isFetchingNextPage, loadInteractions]);

  // Refresh data
  const refresh = useCallback(() => {
    loadInteractions(1, false);
  }, [loadInteractions]);

  // Update a single project in the list (for optimistic updates)
  const updateProject = useCallback((projectId, updates) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, ...updates } : p
      )
    );
  }, []);

  // Remove a project from the list
  const removeProject = useCallback((projectId) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setTotalCount((prev) => Math.max(0, prev - 1));
  }, []);

  return {
    projects,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    totalCount,
    loadMore,
    refresh,
    updateProject,
    removeProject,
  };
}

export { INTERACTION_TYPES };
export default useInteractions;
