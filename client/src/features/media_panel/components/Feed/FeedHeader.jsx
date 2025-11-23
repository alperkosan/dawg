/**
 * Feed Header - Filters and sorting controls
 */

import React from 'react';
import { Filter, TrendingUp, Clock, Star, Users } from 'lucide-react';
import './FeedHeader.css';

export default function FeedHeader({ filters, onFilterChange }) {
  const handleSortChange = (sort) => {
    onFilterChange({ sort });
  };

  const handleFilterChange = (filter) => {
    onFilterChange({ filter });
  };

  return (
    <div className="feed-header">
      {/* Filter Tabs */}
      <div className="feed-header__filters">
        <button
          className={`feed-header__filter-btn ${filters.filter === 'all' ? 'active' : ''}`}
          onClick={() => handleFilterChange('all')}
        >
          <Filter size={16} />
          <span>All</span>
        </button>
        <button
          className={`feed-header__filter-btn ${filters.filter === 'following' ? 'active' : ''}`}
          onClick={() => handleFilterChange('following')}
        >
          <Users size={16} />
          <span>Following</span>
        </button>
        <button
          className={`feed-header__filter-btn ${filters.filter === 'trending' ? 'active' : ''}`}
          onClick={() => handleFilterChange('trending')}
        >
          <TrendingUp size={16} />
          <span>Trending</span>
        </button>
      </div>

      {/* Sort Options */}
      <div className="feed-header__sort">
        <button
          className={`feed-header__sort-btn ${filters.sort === 'recent' ? 'active' : ''}`}
          onClick={() => handleSortChange('recent')}
          title="Most Recent"
        >
          <Clock size={16} />
        </button>
        <button
          className={`feed-header__sort-btn ${filters.sort === 'popular' ? 'active' : ''}`}
          onClick={() => handleSortChange('popular')}
          title="Most Popular"
        >
          <Star size={16} />
        </button>
        <button
          className={`feed-header__sort-btn ${filters.sort === 'trending' ? 'active' : ''}`}
          onClick={() => handleSortChange('trending')}
          title="Trending Now"
        >
          <TrendingUp size={16} />
        </button>
      </div>
    </div>
  );
}

