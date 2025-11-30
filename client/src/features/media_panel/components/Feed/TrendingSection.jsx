/**
 * Trending Section - Shows trending projects
 * 
 * Features:
 * - Timeframe filters (24h, 7d, 30d, all-time)
 * - Category filters (all, genre-specific)
 * - Rank display
 * - Trending indicators
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Clock, Award, Loader2 } from 'lucide-react';
import { apiClient } from '@/services/api.js';
import ProjectCard from './ProjectCard';
import ProjectCardSkeleton from './ProjectCardSkeleton';
import './TrendingSection.css';

const TIMEFRAMES = {
  '24h': { label: '24 Hours', value: '24h' },
  '7d': { label: '7 Days', value: '7d' },
  '30d': { label: '30 Days', value: '30d' },
  'all': { label: 'All Time', value: 'all' },
};

export default function TrendingSection({ 
  onProjectClick,
  limit = 20,
}) {
  const [timeframe, setTimeframe] = useState('24h');
  const [category, setCategory] = useState('all');
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTrending = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try dedicated trending endpoint
      if (apiClient.getTrending) {
        const response = await apiClient.getTrending({
          timeframe,
          category: category !== 'all' ? category : undefined,
          limit,
        });
        setProjects(response.projects || []);
      } else {
        // Fallback: Use feed with trending sort
        const response = await apiClient.getFeed({
          sort: 'trending',
          filter: category !== 'all' ? category : 'all',
          limit,
        });
        setProjects(response.projects || []);
      }
    } catch (err) {
      setError(err);
      console.error('Failed to load trending:', err);
      apiClient.showToast('Failed to load trending projects', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [timeframe, category, limit]);

  useEffect(() => {
    loadTrending();
  }, [loadTrending]);

  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
  };

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
  };

  return (
    <div className="trending-section">
      <div className="trending-section__header">
        <div className="trending-section__title">
          <TrendingUp size={20} />
          <h2>Trending Now</h2>
        </div>
        
        {/* Timeframe filters */}
        <div className="trending-section__timeframes">
          {Object.values(TIMEFRAMES).map((tf) => (
            <button
              key={tf.value}
              className={`trending-section__timeframe-btn ${timeframe === tf.value ? 'active' : ''}`}
              onClick={() => handleTimeframeChange(tf.value)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="trending-section__loading">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="trending-section__error">
          <p>Failed to load trending projects</p>
          <button onClick={loadTrending}>Retry</button>
        </div>
      ) : projects.length === 0 ? (
        <div className="trending-section__empty">
          <TrendingUp size={48} />
          <p>No trending projects found</p>
        </div>
      ) : (
        <div className="trending-section__grid">
          {projects.map((project, index) => (
            <div key={project.id} className="trending-section__item">
              <div className="trending-section__rank">
                {index < 3 ? (
                  <Award 
                    size={20} 
                    className={`trending-section__rank-icon trending-section__rank-icon--${index + 1}`}
                  />
                ) : (
                  <span className="trending-section__rank-number">#{index + 1}</span>
                )}
              </div>
              <ProjectCard 
                project={project} 
                onClick={() => onProjectClick?.(project)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

