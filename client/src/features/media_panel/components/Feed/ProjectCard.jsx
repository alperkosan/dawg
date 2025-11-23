/**
 * Project Card - Individual project card in feed
 */

import React, { useState } from 'react';
import { Heart, MessageCircle, Share2, GitBranch, Eye, Play, Pause } from 'lucide-react';
import { apiClient } from '@/services/api.js';
import './ProjectCard.css';

export default function ProjectCard({ project }) {
  const [isLiked, setIsLiked] = useState(project.isLiked || false);
  const [likeCount, setLikeCount] = useState(project.stats?.likes || 0);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleLike = async (e) => {
    e.stopPropagation();
    try {
      const response = await apiClient.toggleLike(project.id);
      setIsLiked(response.liked);
      setLikeCount(response.likeCount);
    } catch (error) {
      console.error('Failed to toggle like:', error);
      apiClient.showToast('Failed to like project', 'error');
    }
  };

  const handlePlay = (e) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
    // TODO: Implement audio playback
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    try {
      await apiClient.shareProject(project.id);
      apiClient.showToast('Project shared!', 'success');
    } catch (error) {
      console.error('Failed to share project:', error);
      apiClient.showToast('Failed to share project', 'error');
    }
  };

  return (
    <div className="project-card">
      {/* Thumbnail */}
      <div className="project-card__thumbnail">
        {project.thumbnailUrl ? (
          <img src={project.thumbnailUrl} alt={project.title} />
        ) : (
          <div className="project-card__thumbnail-placeholder">
            <span>{project.title.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <button className="project-card__play-btn" onClick={handlePlay}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      {/* Content */}
      <div className="project-card__content">
        <h3 className="project-card__title">{project.title}</h3>
        {project.description && (
          <p className="project-card__description">{project.description}</p>
        )}

        {/* Author */}
        <div className="project-card__author">
          {project.author?.avatarUrl ? (
            <img
              src={project.author.avatarUrl}
              alt={project.author.username}
              className="project-card__author-avatar"
            />
          ) : (
            <div className="project-card__author-avatar-placeholder">
              {project.author?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <span className="project-card__author-name">{project.author?.username || 'Unknown'}</span>
        </div>

        {/* Metadata */}
        <div className="project-card__metadata">
          {project.bpm && <span className="project-card__bpm">{project.bpm} BPM</span>}
          {project.keySignature && (
            <span className="project-card__key">{project.keySignature}</span>
          )}
        </div>

        {/* Stats */}
        <div className="project-card__stats">
          <div className="project-card__stat">
            <Eye size={14} />
            <span>{project.stats?.views || 0}</span>
          </div>
          <div className="project-card__stat">
            <GitBranch size={14} />
            <span>{project.stats?.remixes || 0}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="project-card__actions">
        <button
          className={`project-card__action-btn ${isLiked ? 'active' : ''}`}
          onClick={handleLike}
          title="Like"
        >
          <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
          <span>{likeCount}</span>
        </button>
        <button className="project-card__action-btn" title="Comment">
          <MessageCircle size={18} />
          <span>{project.stats?.comments || 0}</span>
        </button>
        <button className="project-card__action-btn" onClick={handleShare} title="Share">
          <Share2 size={18} />
        </button>
      </div>
    </div>
  );
}

