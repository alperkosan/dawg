/**
 * FollowButton - Follow/Unfollow user button
 * 
 * Features:
 * - Toggle follow state
 * - Optimistic updates
 * - Loading state
 * - Error handling
 */

import React, { useState, useCallback } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { interactionService } from '../../services/interactionService';
import { apiClient } from '@/services/api.js';
import './FollowButton.css';

export default function FollowButton({ 
  userId, 
  initialIsFollowing = false,
  onFollowChange,
  variant = 'default', // 'default' | 'compact' | 'icon'
  showCount = false,
  followerCount,
}) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const [count, setCount] = useState(followerCount || 0);

  const handleToggleFollow = useCallback(async (e) => {
    e.stopPropagation();
    
    if (isLoading) return;

    // Optimistic update
    const previousState = isFollowing;
    const previousCount = count;
    
    setIsFollowing(!isFollowing);
    if (showCount) {
      setCount(prev => previousState ? prev - 1 : prev + 1);
    }
    setIsLoading(true);

    try {
      const response = await interactionService.toggleFollow(userId);
      
      // Update with server response
      setIsFollowing(response.isFollowing);
      if (showCount && response.followerCount !== undefined) {
        setCount(response.followerCount);
      }
      
      onFollowChange?.(response.isFollowing, response);
    } catch (error) {
      // Revert on error
      setIsFollowing(previousState);
      if (showCount) {
        setCount(previousCount);
      }
      
      console.error('Failed to toggle follow:', error);
      apiClient.showToast('Failed to update follow status', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [userId, isFollowing, isLoading, count, showCount, onFollowChange]);

  // Update state when prop changes
  React.useEffect(() => {
    setIsFollowing(initialIsFollowing);
  }, [initialIsFollowing]);

  React.useEffect(() => {
    if (followerCount !== undefined) {
      setCount(followerCount);
    }
  }, [followerCount]);

  const buttonClass = `follow-button follow-button--${variant} ${isFollowing ? 'following' : ''} ${isLoading ? 'loading' : ''}`;

  if (variant === 'icon') {
    return (
      <button
        className={buttonClass}
        onClick={handleToggleFollow}
        title={isFollowing ? 'Unfollow' : 'Follow'}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isFollowing ? (
          <UserCheck size={16} />
        ) : (
          <UserPlus size={16} />
        )}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        className={buttonClass}
        onClick={handleToggleFollow}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isFollowing ? (
          <UserCheck size={14} />
        ) : (
          <UserPlus size={14} />
        )}
        <span>{isFollowing ? 'Following' : 'Follow'}</span>
      </button>
    );
  }

  return (
    <button
      className={buttonClass}
      onClick={handleToggleFollow}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span>Loading...</span>
        </>
      ) : isFollowing ? (
        <>
          <UserCheck size={16} />
          <span>Following</span>
        </>
      ) : (
        <>
          <UserPlus size={16} />
          <span>Follow</span>
        </>
      )}
      {showCount && count > 0 && (
        <span className="follow-button__count">{count}</span>
      )}
    </button>
  );
}

