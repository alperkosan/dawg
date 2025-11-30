/**
 * Project Card - Individual project card in feed
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Heart, MessageCircle, Share2, GitBranch, Eye } from 'lucide-react';
import { apiClient } from '@/services/api.js';
import CommentModal from './CommentModal';
import QuickActions from './QuickActions';
import FollowButton from '../User/FollowButton';
import { AudioPreview } from '@/components/audio/AudioPreview';
import './ProjectCard.css';

export default function ProjectCard({ project }) {
  const [isLiked, setIsLiked] = useState(project.isLiked || false);
  const [likeCount, setLikeCount] = useState(project.stats?.likes || 0);
  const [commentCount, setCommentCount] = useState(project.stats?.comments || 0);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const previewUrlRaw = project.previewAudioUrl || project.preview_audio_url;

  // ✅ FIX: Update state when project prop changes (e.g., after feed refresh)
  useEffect(() => {
    // Use project.id as key to ensure we update when project changes
    setIsLiked(Boolean(project.isLiked));
    setLikeCount(project.stats?.likes || 0);
  }, [project.id, project.isLiked, project.stats?.likes]);

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

  const resolvedPreviewUrl = useMemo(() => {
    if (!previewUrlRaw) return '';
    const clean = previewUrlRaw.replace(/[\n\r\t\s]+/g, '').trim();
    if (!clean) return '';
    if (clean.startsWith('/api/')) {
      return `${apiClient.baseURL}${clean}`;
    }
    return clean;
  }, [previewUrlRaw]);

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

  const hasPreview = Boolean(resolvedPreviewUrl);

  return (
    <div className="project-card project-card--audio">
      <div className="project-card__glass">
        <div className="project-card__hero">
          <div className="project-card__preview-area">
            {hasPreview ? (
              <AudioPreview
                url={resolvedPreviewUrl}
                title={project.title}
                className="project-card__audio-preview"
                variant="default"
              />
            ) : (
              <div className="project-card__preview-placeholder">
                Preview audio not available
              </div>
            )}
          </div>

          <div className="project-card__info">
            <div className="project-card__author-row">
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
                <div>
                  <p className="project-card__author-name">{project.author?.username || 'Unknown'}</p>
                  <p className="project-card__timestamp">
                    {project.updated_at
                      ? new Date(project.updated_at).toLocaleDateString()
                      : ''}
                  </p>
                </div>
              </div>
              <div className="project-card__author-actions">
                {project.author?.id && (
                  <FollowButton
                    userId={project.author.id}
                    initialIsFollowing={project.author.isFollowing}
                    variant="compact"
                  />
                )}
                <div className="project-card__meta-chips">
                  {project.bpm && <span className="project-card__chip">{project.bpm} BPM</span>}
                  {project.keySignature && <span className="project-card__chip">{project.keySignature}</span>}
                  {project.genre && <span className="project-card__chip">{project.genre}</span>}
                </div>
              </div>
            </div>

            <h3 className="project-card__title">{project.title}</h3>
            {project.description && (
              <p className="project-card__description">{project.description}</p>
            )}

            <div className="project-card__stats-row">
              <div className="project-card__stat">
                <Eye size={16} />
                <span>{project.stats?.views || 0} plays</span>
              </div>
              <div className="project-card__stat">
                <GitBranch size={16} />
                <span>{project.stats?.remixes || 0} remixes</span>
              </div>
            </div>
          </div>
        </div>

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
          
          {/* Quick Actions Menu */}
          <QuickActions project={project} />
        </div>
      </div>

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

