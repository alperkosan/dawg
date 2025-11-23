/**
 * Custom hook for managing user interactions
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api.js';

export function useInteractions(tab = 'likes') {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const loadInteractions = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsFetchingNextPage(true);
      }

      let response;
      
      // For now, we'll use the feed API with filters
      // TODO: Add dedicated endpoints for user interactions
      response = await apiClient.getFeed({
        page,
        limit: 20,
        sort: 'recent',
        filter: 'all',
      });

      // Filter based on tab
      if (tab === 'likes') {
        response.projects = response.projects.filter(p => p.isLiked);
      }
      // TODO: Add filtering for comments, shares, remixes when backend endpoints are ready

      if (append) {
        setProjects((prev) => [...prev, ...(response.projects || [])]);
      } else {
        setProjects(response.projects || []);
      }

      setHasNextPage(response.pagination?.hasMore || false);
      setCurrentPage(page);
    } catch (err) {
      setError(err);
      setTimeout(() => {
        apiClient.showToast(`Failed to load ${tab}`, 'error');
      }, 0);
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [tab]);

  useEffect(() => {
    setCurrentPage(1);
    setProjects([]);
    loadInteractions(1, false);
  }, [tab, loadInteractions]);

  const loadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      loadInteractions(currentPage + 1, true);
    }
  }, [currentPage, hasNextPage, isFetchingNextPage, loadInteractions]);

  const refresh = useCallback(() => {
    loadInteractions(1, false);
  }, [loadInteractions]);

  return {
    projects,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    loadMore,
    refresh,
  };
}

