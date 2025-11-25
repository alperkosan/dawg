/**
 * Feed View - Main feed component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api.js';
import FeedHeader from './FeedHeader';
import FeedContent from './FeedContent';
import FeedSidebar from './FeedSidebar';
import './FeedView.css';

export default function FeedView() {
  const [filters, setFilters] = useState({
    sort: 'recent', // 'recent' | 'popular' | 'trending'
    filter: 'all', // 'all' | 'following' | 'genre'
    genre: null,
  });

  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const loadFeed = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsFetchingNextPage(true);
      }

      const response = await apiClient.getFeed({
        page,
        limit: 20,
        ...filters,
      });

      if (append) {
        setProjects((prev) => [...prev, ...response.projects]);
      } else {
        setProjects(response.projects);
      }

      setHasNextPage(response.pagination.hasMore);
      setCurrentPage(page);
    } catch (err) {
      setError(err);
      // ✅ FIX: Defer toast to avoid flushSync warning during render
      setTimeout(() => {
        apiClient.showToast('Failed to load feed', 'error');
      }, 0);
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFeed(1, false);
  }, [filters]);

  const handleFilterChange = useCallback((newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
    setProjects([]);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      loadFeed(currentPage + 1, true);
    }
  }, [currentPage, hasNextPage, isFetchingNextPage, loadFeed]);

  const handleRefresh = useCallback(() => {
    loadFeed(1, false);
  }, [loadFeed]);

  return (
    <div className="feed-view">
      <FeedHeader filters={filters} onFilterChange={handleFilterChange} />
      <div className="feed-view__body">
        <div className="feed-view__content">
          <FeedContent
            projects={projects}
            isLoading={isLoading}
            error={error}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={handleLoadMore}
            onRefresh={handleRefresh}
          />
        </div>
        <FeedSidebar projects={projects} />
      </div>
    </div>
  );
}

