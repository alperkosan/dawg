/**
 * Feed Header - Filters and sorting controls
 */

import React, { useState } from 'react';
import { Filter, TrendingUp, Clock, Star, Users, Search } from 'lucide-react';
import './FeedHeader.css';

export default function FeedHeader({ filters, onFilterChange }) {
  const [showReposts, setShowReposts] = useState(true);

  const handleSortChange = (sort) => {
    onFilterChange({ sort });
  };

  const handleFilterChange = (filter) => {
    onFilterChange({ filter });
  };

  return (
    <div className="feed-header">
      <div className="feed-header__hero">
        <div>
          <p className="feed-header__eyebrow">Your feed</p>
          <h1>Hear the latest posts from the people you&apos;re following</h1>
          <p className="feed-header__subtitle">
            Follow more artists to make this page even more personal.
          </p>
        </div>
        <div className="feed-header__search">
          <Search size={16} />
          <input type="text" placeholder="Search tracks or artists" />
          <button type="button">Upload</button>
        </div>
      </div>

      <div className="feed-header__controls">
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

        <div className="feed-header__sort">
          <div className="feed-header__toggle">
            <span>Reposts</span>
            <button
              type="button"
              className={`feed-header__toggle-btn ${showReposts ? 'is-on' : ''}`}
              onClick={() => setShowReposts((prev) => !prev)}
              aria-pressed={showReposts}
            >
              <span className="feed-header__toggle-knob" />
            </button>
          </div>
          <div className="feed-header__sort-buttons">
            <button
              className={`feed-header__sort-btn ${filters.sort === 'recent' ? 'active' : ''}`}
              onClick={() => handleSortChange('recent')}
              title="Most Recent"
            >
              <Clock size={16} />
              <span>Recent</span>
            </button>
            <button
              className={`feed-header__sort-btn ${filters.sort === 'popular' ? 'active' : ''}`}
              onClick={() => handleSortChange('popular')}
              title="Most Popular"
            >
              <Star size={16} />
              <span>Popular</span>
            </button>
            <button
              className={`feed-header__sort-btn ${filters.sort === 'trending' ? 'active' : ''}`}
              onClick={() => handleSortChange('trending')}
              title="Trending Now"
            >
              <TrendingUp size={16} />
              <span>Trending</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

