/**
 * Project Card - Individual project card in feed
 */

import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, GitBranch, Eye, Play, Pause } from 'lucide-react';
import { apiClient } from '@/services/api.js';
import CommentModal from './CommentModal';
import ProjectPreviewPlayer from '../Media/ProjectPreviewPlayer';
import { useMediaPlayerStore } from '../../store/useMediaPlayerStore';
import './ProjectCard.css';

export default function ProjectCard({ project }) {
  const [isLiked, setIsLiked] = useState(project.isLiked || false);
  const [likeCount, setLikeCount] = useState(project.stats?.likes || 0);
  const [commentCount, setCommentCount] = useState(project.stats?.comments || 0);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  // Global media player state
  const {
    playingProjectId,
    isPlaying,
    setPlayingProject,
    play,
    pause,
    stop,
  } = useMediaPlayerStore();

  const isCurrentPlaying = playingProjectId === project.id;
  const hasPreview = project.previewAudioUrl || project.preview_audio_url;

  // ✅ FIX: Update state when project prop changes (e.g., after feed refresh)
  useEffect(() => {
    // Use project.id as key to ensure we update when project changes
    setIsLiked(Boolean(project.isLiked));
    setLikeCount(project.stats?.likes || 0);
  }, [project.id, project.isLiked, project.stats?.likes]);

  // ✅ FIX: Show player when this project becomes the current playing project
  useEffect(() => {
    if (isCurrentPlaying && hasPreview) {
      setShowPlayer(true);
    } else if (!isCurrentPlaying) {
      setShowPlayer(false);
    }
  }, [isCurrentPlaying, hasPreview]);

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
    console.log('🎵 handlePlay called:', { 
      projectId: project.id, 
      hasPreview, 
      isCurrentPlaying, 
      isPlaying,
      previewAudioUrl: project.previewAudioUrl,
      preview_audio_url: project.preview_audio_url
    });
    
    e.stopPropagation();
    
    if (!hasPreview) {
      console.warn('🎵 No preview available for project:', project.id);
      apiClient.showToast('No preview available for this project', 'info');
      return;
    }

    const audioUrl = project.previewAudioUrl || project.preview_audio_url;
    const duration = project.previewAudioDuration || project.preview_audio_duration;

    console.log('🎵 Playback state:', { 
      isCurrentPlaying, 
      isPlaying, 
      audioUrl, 
      duration 
    });

    if (isCurrentPlaying && isPlaying) {
      // Pause current playback
      console.log('🎵 Pausing playback');
      pause();
    } else if (isCurrentPlaying && !isPlaying) {
      // Resume current playback
      console.log('🎵 Resuming playback');
      play();
    } else {
      // Start new playback
      console.log('🎵 Starting new playback:', { projectId: project.id, audioUrl, duration });
      setPlayingProject(project.id, audioUrl, duration);
      setShowPlayer(true);
      // Small delay to ensure ProjectPreviewPlayer is mounted and ready
      setTimeout(() => {
        console.log('🎵 Calling play() after delay');
        play();
      }, 50);
    }
  };

  const handlePlayStateChange = (playing) => {
    if (playing) {
      play();
    } else {
      pause();
    }
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
    <div 
      className="project-card"
      onClick={(e) => {
        // ✅ DEBUG: Log when card is clicked to see if it's interfering
        console.log('🎵 ProjectCard clicked:', { target: e.target, currentTarget: e.currentTarget });
      }}
    >
      {/* Thumbnail */}
      <div className="project-card__thumbnail">
        {project.thumbnailUrl ? (
          <img src={project.thumbnailUrl} alt={project.title} />
        ) : (
          <div className="project-card__thumbnail-placeholder">
            <span>{project.title.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <button 
          className="project-card__play-btn" 
          onClick={(e) => {
            console.log('🎵 Play button clicked');
            handlePlay(e);
          }}
          onMouseDown={(e) => {
            console.log('🎵 Play button mousedown');
            e.stopPropagation();
          }}
          title={hasPreview ? (isCurrentPlaying && isPlaying ? 'Pause' : 'Play') : 'No preview available'}
        >
          {isCurrentPlaying && isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      {/* Audio Player */}
      {showPlayer && isCurrentPlaying && hasPreview && (
        <div className="project-card__player">
          <ProjectPreviewPlayer
            audioUrl={project.previewAudioUrl || project.preview_audio_url}
            duration={project.previewAudioDuration || project.preview_audio_duration}
            onPlayStateChange={handlePlayStateChange}
          />
        </div>
      )}

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
        <button 
          className="project-card__action-btn" 
          title="Comment"
          onClick={(e) => {
            e.stopPropagation();
            setIsCommentModalOpen(true);
          }}
        >
          <MessageCircle size={18} />
          <span>{commentCount}</span>
        </button>
        <button className="project-card__action-btn" onClick={handleShare} title="Share">
          <Share2 size={18} />
        </button>
      </div>

      {/* Comment Modal */}
      <CommentModal
        projectId={project.id}
        isOpen={isCommentModalOpen}
        onClose={() => setIsCommentModalOpen(false)}
        initialCommentCount={commentCount}
        onCommentCountChange={setCommentCount}
      />
    </div>
  );
}

