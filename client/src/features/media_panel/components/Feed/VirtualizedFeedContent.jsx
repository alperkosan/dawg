/**
 * Virtualized Feed Content - Performance optimized feed with virtual scrolling
 * 
 * Uses react-window for efficient rendering of large lists
 * Falls back to regular list if react-window is not available
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import ProjectCard from './ProjectCard';
import ProjectCardSkeleton from './ProjectCardSkeleton';
import './FeedContent.css';

// Try to import react-window (optional dependency)
let FixedSizeList = null;
try {
  const reactWindow = require('react-window');
  FixedSizeList = reactWindow.FixedSizeList;
} catch (e) {
  // react-window not installed, will use fallback
  console.log('react-window not available, using fallback rendering');
}

// Estimated card height (will be measured dynamically)
const ESTIMATED_CARD_HEIGHT = 400;
const OVERSCAN = 5; // Render 5 extra items outside viewport

export default function VirtualizedFeedContent({
  projects,
  isLoading,
  error,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRefresh,
  containerHeight = 600, // Default container height
}) {
  const scrollContainerRef = useRef(null);
  const observerRef = useRef(null);
  const [itemHeight, setItemHeight] = useState(ESTIMATED_CARD_HEIGHT);
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: containerHeight,
  });

  // Measure actual card height
  useEffect(() => {
    if (projects.length > 0 && scrollContainerRef.current) {
      const firstCard = scrollContainerRef.current.querySelector('.project-card');
      if (firstCard) {
        const height = firstCard.getBoundingClientRect().height;
        if (height > 0) {
          setItemHeight(height + 16); // Add gap
        }
      }
    }
  }, [projects.length]);

  // Handle container resize
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerDimensions({ width, height });
    });

    observer.observe(scrollContainerRef.current);

    return () => observer.disconnect();
  }, []);

  // Infinite scroll: Observe last element
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !FixedSizeList) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    // Observe a sentinel element at the bottom
    const sentinel = document.querySelector('.feed-content__sentinel');
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  // Render item for virtual list
  const renderItem = ({ index, style }) => {
    const project = projects[index];
    if (!project) return null;

    return (
      <div style={style}>
        <ProjectCard project={project} />
      </div>
    );
  };

  // Error state
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

  // Loading state
  if (isLoading && projects.length === 0) {
    return (
      <div className="feed-content" ref={scrollContainerRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
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

  // Use virtual list if available and container has dimensions
  if (FixedSizeList && containerDimensions.width > 0 && containerDimensions.height > 0) {
    return (
      <div className="feed-content feed-content--virtualized" ref={scrollContainerRef}>
        <FixedSizeList
          height={containerDimensions.height}
          width={containerDimensions.width}
          itemCount={projects.length}
          itemSize={itemHeight}
          overscanCount={OVERSCAN}
        >
          {renderItem}
        </FixedSizeList>
        
        {/* Sentinel for infinite scroll */}
        {hasNextPage && (
          <div className="feed-content__sentinel" />
        )}
        
        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <div className="feed-content__loading">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    );
  }

  // Fallback: Regular list (no virtualization)
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

