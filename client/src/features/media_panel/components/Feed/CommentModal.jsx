/**
 * Comment Modal - Modal for viewing and adding comments
 */

import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Send, Heart, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { apiClient } from '@/services/api.js';
import './CommentModal.css';

export default function CommentModal({ projectId, isOpen, onClose, initialCommentCount = 0, onCommentCountChange }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef(null);
  const replyTextareaRef = useRef(null);

  // Load comments when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      loadComments();
    }
  }, [isOpen, projectId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newComment, replyText, editText]);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getComments(projectId, 1, 100);
      setComments(response.comments || []);
      setCommentCount(response.pagination?.total || response.comments?.length || 0);
    } catch (error) {
      console.error('Failed to load comments:', error);
      apiClient.showToast('Failed to load comments', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.addComment(projectId, newComment.trim());
      setComments(prev => [response.comment, ...prev]);
      const newCount = commentCount + 1;
      setCommentCount(newCount);
      onCommentCountChange?.(newCount);
      setNewComment('');
      apiClient.showToast('Comment added', 'success');
    } catch (error) {
      console.error('Failed to add comment:', error);
      apiClient.showToast('Failed to add comment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId) => {
    if (!replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.addComment(projectId, replyText.trim(), parentId);
      // Add reply to the parent comment's replies
      setComments(prev => prev.map(comment => {
        if (comment.id === parentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), response.comment]
          };
        }
        return comment;
      }));
      const newCount = commentCount + 1;
      setCommentCount(newCount);
      onCommentCountChange?.(newCount);
      setReplyText('');
      setReplyingTo(null);
      apiClient.showToast('Reply added', 'success');
    } catch (error) {
      console.error('Failed to add reply:', error);
      apiClient.showToast('Failed to add reply', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (comment) => {
    setEditingComment(comment.id);
    setEditText(comment.text);
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
    setEditText('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editText.trim()) return;

    try {
      // TODO: Implement edit comment API endpoint
      // For now, just update locally
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return { ...comment, text: editText.trim() };
        }
        return comment;
      }));
      setEditingComment(null);
      setEditText('');
      apiClient.showToast('Comment updated', 'success');
    } catch (error) {
      console.error('Failed to update comment:', error);
      apiClient.showToast('Failed to update comment', 'error');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      // TODO: Implement delete comment API endpoint
      // For now, just remove locally
      setComments(prev => prev.filter(comment => comment.id !== commentId));
      const newCount = Math.max(0, commentCount - 1);
      setCommentCount(newCount);
      onCommentCountChange?.(newCount);
      apiClient.showToast('Comment deleted', 'success');
    } catch (error) {
      console.error('Failed to delete comment:', error);
      apiClient.showToast('Failed to delete comment', 'error');
    }
  };

  // Build nested comment tree
  const buildCommentTree = (comments) => {
    const commentMap = new Map();
    const rootComments = [];

    // First pass: create map of all comments
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: build tree
    comments.forEach(comment => {
      const commentNode = commentMap.get(comment.id);
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(commentNode);
        }
      } else {
        rootComments.push(commentNode);
      }
    });

    return rootComments;
  };

  const commentTree = buildCommentTree(comments);

  if (!isOpen) return null;

  const modalContent = (
    <div className="comment-modal-overlay" onClick={onClose}>
      <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="comment-modal__header">
          <h2>Comments ({commentCount})</h2>
          <button className="comment-modal__close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Comments List */}
        <div className="comment-modal__content">
          {isLoading ? (
            <div className="comment-modal__loading">Loading comments...</div>
          ) : commentTree.length === 0 ? (
            <div className="comment-modal__empty">No comments yet. Be the first to comment!</div>
          ) : (
            <div className="comment-modal__comments">
              {commentTree.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  onReply={handleSubmitReply}
                  editingComment={editingComment}
                  editText={editText}
                  setEditText={setEditText}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  onDelete={handleDeleteComment}
                  replyTextareaRef={replyTextareaRef}
                />
              ))}
            </div>
          )}
        </div>

        {/* New Comment Input */}
        <div className="comment-modal__input">
          <textarea
            ref={textareaRef}
            className="comment-modal__textarea"
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmitComment();
              }
            }}
            rows={1}
          />
          <button
            className="comment-modal__submit"
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || isSubmitting}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  // Render modal using portal to document.body
  return ReactDOM.createPortal(modalContent, document.body);
}

function CommentItem({
  comment,
  replyingTo,
  setReplyingTo,
  replyText,
  setReplyText,
  onReply,
  editingComment,
  editText,
  setEditText,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  replyTextareaRef,
}) {
  // TODO: Get current user ID from auth context/store
  const isOwnComment = false; // Placeholder - will be implemented with auth context
  const isEditing = editingComment === comment.id;

  return (
    <div className="comment-item">
      <div className="comment-item__avatar">
        {comment.author?.avatarUrl ? (
          <img src={comment.author.avatarUrl} alt={comment.author.username} />
        ) : (
          <div className="comment-item__avatar-placeholder">
            {comment.author?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
      </div>

      <div className="comment-item__content">
        <div className="comment-item__header">
          <span className="comment-item__author">{comment.author?.username || 'Unknown'}</span>
          <span className="comment-item__time">
            {new Date(comment.createdAt).toLocaleDateString()}
          </span>
        </div>

        {isEditing ? (
          <div className="comment-item__edit">
            <textarea
              className="comment-item__edit-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
            />
            <div className="comment-item__edit-actions">
              <button onClick={() => onSaveEdit(comment.id)}>Save</button>
              <button onClick={onCancelEdit}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="comment-item__text">{comment.text}</div>
        )}

        <div className="comment-item__actions">
          <button
            className="comment-item__action"
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
          >
            Reply
          </button>
          {isOwnComment && (
            <>
              <button className="comment-item__action" onClick={() => onStartEdit(comment)}>
                <Edit2 size={14} />
              </button>
              <button className="comment-item__action" onClick={() => onDelete(comment.id)}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>

        {/* Reply Input */}
        {replyingTo === comment.id && (
          <div className="comment-item__reply-input">
            <textarea
              ref={replyTextareaRef}
              className="comment-item__reply-textarea"
              placeholder="Write a reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  onReply(comment.id);
                }
              }}
              rows={2}
            />
            <div className="comment-item__reply-actions">
              <button onClick={() => onReply(comment.id)} disabled={!replyText.trim()}>
                Reply
              </button>
              <button onClick={() => setReplyingTo(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="comment-item__replies">
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                replyText={replyText}
                setReplyText={setReplyText}
                onReply={onReply}
                editingComment={editingComment}
                editText={editText}
                setEditText={setEditText}
                onStartEdit={onStartEdit}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                onDelete={onDelete}
                replyTextareaRef={replyTextareaRef}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

