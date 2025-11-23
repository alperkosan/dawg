/**
 * Feed Content - Scrollable list of project cards
 */

import React, { useEffect, useRef } from 'react';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import ProjectCard from './ProjectCard';
import ProjectCardSkeleton from './ProjectCardSkeleton';
import './FeedContent.css';

export default function FeedContent({
  projects,
  isLoading,
  error,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRefresh,
}) {
  const scrollContainerRef = useRef(null);
  const observerRef = useRef(null);

  // Infinite scroll: Observe last element
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
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
  }, [hasNextPage, isFetchingNextPage, onLoadMore, projects.length]);

  if (error) {
    return (
      <div className="feed-content__error">
        <AlertCircle size={24} />
        <p>Failed to load feed</p>
        <button onClick={onRefresh} className="feed-content__retry-btn">
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  if (isLoading && projects.length === 0) {
    return (
      <div className="feed-content" ref={scrollContainerRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="feed-content__empty">
        <p>No projects found</p>
        <button onClick={onRefresh} className="feed-content__retry-btn">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="feed-content" ref={scrollContainerRef}>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
      {isFetchingNextPage && (
        <div className="feed-content__loading">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading more...</span>
        </div>
      )}
    </div>
  );
}

