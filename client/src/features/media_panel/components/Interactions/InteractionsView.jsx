/**
 * Interactions View - User's interactions (Likes, Comments, Shares, Remixes)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share2, GitBranch, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/services/api.js';
import ProjectCard from '../Feed/ProjectCard';
import ProjectCardSkeleton from '../Feed/ProjectCardSkeleton';
import './InteractionsView.css';

const TABS = {
  LIKES: 'likes',
  COMMENTS: 'comments',
  SHARES: 'shares',
  REMIXES: 'remixes',
};

export default function InteractionsView() {
  const [activeTab, setActiveTab] = useState(TABS.LIKES);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);

  const loadInteractions = useCallback(async (tab, page = 1, append = false) => {
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
      if (tab === TABS.LIKES) {
        // Get projects that user has liked
        // We'll need to filter by isLiked=true in the feed
        response = await apiClient.getFeed({
          page,
          limit: 20,
          sort: 'recent',
          filter: 'all',
        });
        // Filter to only show liked projects
        response.projects = response.projects.filter(p => p.isLiked);
      } else if (tab === TABS.COMMENTS) {
        // Get projects where user has commented
        response = await apiClient.getFeed({
          page,
          limit: 20,
          sort: 'recent',
          filter: 'all',
        });
        // TODO: Filter by projects with user's comments
        // For now, show all projects (will be filtered when backend endpoint is ready)
      } else if (tab === TABS.SHARES) {
        // Get projects that user has shared
        response = await apiClient.getFeed({
          page,
          limit: 20,
          sort: 'recent',
          filter: 'all',
        });
        // TODO: Filter by projects user has shared
      } else if (tab === TABS.REMIXES) {
        // Get remix projects
        response = await apiClient.getFeed({
          page,
          limit: 20,
          sort: 'recent',
          filter: 'all',
        });
        // TODO: Filter by remix projects
      }

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
        apiClient.showToast(`Failed to load ${activeTab}`, 'error');
      }, 0);
    } finally {
      setIsLoading(false);
      setIsFetchingNextPage(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
    setProjects([]);
    loadInteractions(activeTab, 1, false);
  }, [activeTab, loadInteractions]);

  const handleLoadMore = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      loadInteractions(activeTab, currentPage + 1, true);
    }
  }, [activeTab, currentPage, hasNextPage, isFetchingNextPage, loadInteractions]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const scrollContainerRef = React.useRef(null);
  const observerRef = React.useRef(null);

  // Infinite scroll
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    const lastCard = scrollContainerRef.current?.lastElementChild;
    if (lastCard) {
      observer.observe(lastCard);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasNextPage, isFetchingNextPage, handleLoadMore, projects.length]);

  const getTabIcon = (tab) => {
    switch (tab) {
      case TABS.LIKES:
        return <Heart size={18} />;
      case TABS.COMMENTS:
        return <MessageCircle size={18} />;
      case TABS.SHARES:
        return <Share2 size={18} />;
      case TABS.REMIXES:
        return <GitBranch size={18} />;
      default:
        return null;
    }
  };

  const getTabLabel = (tab) => {
    switch (tab) {
      case TABS.LIKES:
        return 'Liked Projects';
      case TABS.COMMENTS:
        return 'Commented';
      case TABS.SHARES:
        return 'Shared';
      case TABS.REMIXES:
        return 'Remixes';
      default:
        return '';
    }
  };

  if (error) {
    return (
      <div className="interactions-view">
        <div className="interactions-view__error">
          <AlertCircle size={24} />
          <p>Failed to load interactions</p>
          <button 
            onClick={() => loadInteractions(activeTab, 1, false)} 
            className="interactions-view__retry-btn"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="interactions-view">
      {/* Tab Navigation */}
      <div className="interactions-view__tabs">
        {Object.values(TABS).map((tab) => (
          <button
            key={tab}
            className={`interactions-view__tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {getTabIcon(tab)}
            <span>{getTabLabel(tab)}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="interactions-view__content" ref={scrollContainerRef}>
        {isLoading && projects.length === 0 ? (
          <div className="interactions-view__loading">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="interactions-view__empty">
            <p>No {getTabLabel(activeTab).toLowerCase()} found</p>
          </div>
        ) : (
          <>
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {isFetchingNextPage && (
              <div className="interactions-view__loading-more">
                <Loader2 size={20} className="animate-spin" />
                <span>Loading more...</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
