/**
 * Projects Management Page
 * User can view, edit, delete, and share their projects
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { projectService } from '../services/projectService';
import { apiClient } from '../services/api.js';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { 
  FolderOpen, 
  Edit, 
  Trash2, 
  Share2, 
  Eye, 
  EyeOff, 
  Search, 
  Music,
  Calendar,
  Loader2,
  Copy,
  Check,
  Upload,
  X
} from 'lucide-react';
import './ProjectsPage.css';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isGuest } = useAuthStore();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedProjects, setSelectedProjects] = useState(new Set()); // ✅ Multi-select
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishProgress, setPublishProgress] = useState({ progress: 0, status: '', error: null });
  const [copiedShareUrl, setCopiedShareUrl] = useState(null);
  
  // ✅ Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    onConfirm: null,
  });

  useEffect(() => {
    if (isAuthenticated && !isGuest) {
      loadProjects();
    } else {
      navigate('/auth');
    }
  }, [isAuthenticated, isGuest, navigate]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const response = await projectService.listProjects({
        limit: 100,
        sortBy: 'updated_at',
        sortOrder: 'desc',
      });
      setProjects(response.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
      apiClient.showToast(`Failed to load projects: ${error.message}`, 'error', 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (project) => {
    setSelectedProject(project);
    setShowEditModal(true);
  };

  const handleDelete = (project) => {
    setSelectedProject(project);
    setShowDeleteModal(true);
  };

  const handleShare = (project) => {
    setSelectedProject(project);
    setShowShareModal(true);
  };

  const handleSaveEdit = async (updates) => {
    try {
      await apiClient.updateProject(selectedProject.id, updates);
      await loadProjects();
      setShowEditModal(false);
      setSelectedProject(null);
      apiClient.showToast('Project updated successfully!', 'success', 3000);
    } catch (error) {
      console.error('Failed to update project:', error);
      // ✅ Error toast will be shown automatically by API client
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await projectService.deleteProject(selectedProject.id);
      await loadProjects();
      setShowDeleteModal(false);
      setSelectedProject(null);
      apiClient.showToast('Project deleted successfully!', 'success', 3000);
    } catch (error) {
      console.error('Failed to delete project:', error);
      // ✅ Error toast will be shown automatically by API client
    }
  };
  
  // ✅ Multi-select handlers
  const handleToggleProjectSelection = (projectId) => {
    const newSelection = new Set(selectedProjects);
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId);
    } else {
      newSelection.add(projectId);
    }
    setSelectedProjects(newSelection);
  };

  const handleSelectAllProjects = () => {
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set()); // Deselect all
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id))); // Select all
    }
  };

  const handleDeleteSelectedProjects = async () => {
    if (selectedProjects.size === 0) return;
    
    const count = selectedProjects.size;
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Projects',
      message: `Are you sure you want to delete ${count} project(s)? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal({ ...confirmationModal, isOpen: false });
        try {
          // Delete all selected projects in parallel
          await Promise.all(Array.from(selectedProjects).map(projectId => 
            projectService.deleteProject(projectId)
          ));
          setSelectedProjects(new Set()); // Clear selection
          await loadProjects();
          apiClient.showToast(`Successfully deleted ${count} project(s)`, 'success', 3000);
        } catch (error) {
          console.error('Delete failed:', error);
          // ✅ Error toast will be shown automatically by API client
        }
      },
    });
  };

  const handleTogglePublic = async (project) => {
    try {
      const wasPublic = project.isPublic;
      console.log(`📤 [PUBLISH] Toggling public status for project ${project.id}: ${wasPublic} → ${!wasPublic}`);
      
      if (!wasPublic) {
        // Project is becoming public - open publish modal to render audio
        setSelectedProject(project);
        setShowPublishModal(true);
        setPublishProgress({ progress: 0, status: 'Starting...', error: null });
      } else {
        // Project is being unpublished - do it directly
        await apiClient.updateProject(project.id, {
          isPublic: false,
        });
        await loadProjects();
        console.log(`📤 [PUBLISH] Project ${project.id} unpublished`);
        apiClient.showToast('Project unpublished successfully!', 'success', 3000);
      }
    } catch (error) {
      console.error(`❌ [PUBLISH] Failed to update project ${project.id}:`, error);
      apiClient.showToast(`Failed to update project: ${error.message}`, 'error', 5000);
    }
  };

  const handleCopyShareUrl = (project) => {
    const shareUrl = `${window.location.origin}/media/project/${project.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareUrl(project.id);
    setTimeout(() => setCopiedShareUrl(null), 2000);
  };

  const handleOpenProject = async (projectId) => {
    // Navigate to DAW with project ID in URL
    navigate(`/daw?project=${projectId}`);
    // The DAW component will detect the project parameter and load it
  };

  const handlePublishWithRender = React.useCallback(async (project) => {
    try {
      setPublishProgress({ progress: 0, status: 'Loading project...', error: null });
      
      // Import render dependencies
      const { NativeAudioEngine } = await import('@/lib/core/NativeAudioEngine');
      const { AudioContextService } = await import('@/lib/services/AudioContextService');
      const { ProjectSerializer } = await import('@/lib/project/ProjectSerializer');
      const { exportManager } = await import('@/lib/audio/ExportManager');
      const { useArrangementStore } = await import('@/store/useArrangementStore');
      const { usePlaybackStore } = await import('@/store/usePlaybackStore');
      
      // 1. Load project data
      setPublishProgress({ progress: 10, status: 'Loading project data...', error: null });
      const projectResponse = await apiClient.getProject(project.id);
      const projectData = projectResponse.project;
      
      if (!projectData || !projectData.projectData) {
        throw new Error('Project data not found');
      }
      
      // 2. Initialize audio engine
      setPublishProgress({ progress: 20, status: 'Initializing audio engine...', error: null });
      const audioEngine = new NativeAudioEngine();
      await audioEngine.initialize();
      await AudioContextService.setAudioEngine(audioEngine);
      await audioEngine.resumeAudioContext();
      
      // 3. Load project into engine
      setPublishProgress({ progress: 30, status: 'Loading project into audio engine...', error: null });
      await ProjectSerializer.deserialize(projectData.projectData, audioEngine);
      
      // Wait for samples to load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 4. Calculate duration
      setPublishProgress({ progress: 40, status: 'Calculating arrangement duration...', error: null });
      const arrangementStore = useArrangementStore.getState();
      const playbackStore = usePlaybackStore.getState();
      const bpm = playbackStore.bpm || projectData.bpm || 120;
      
      const clips = arrangementStore.arrangementClips || [];
      let maxEndTime = 0;
      clips.forEach(clip => {
        const clipEndTime = (clip.startTime || 0) + (clip.duration || 0);
        maxEndTime = Math.max(maxEndTime, clipEndTime);
      });
      const durationBeats = maxEndTime > 0 ? maxEndTime : 16;
      
      // 5. Export master channel
      // ✅ FIX: Use DEMO quality (22.05kHz) for publish to reduce file size
      // This ensures the base64 encoded audio stays under the 4.5MB upload limit
      setPublishProgress({ progress: 50, status: 'Rendering audio (optimized for upload)...', error: null });
      const exportResult = await exportManager.exportChannels(
        ['master'],
        {
          format: 'wav',
          quality: 'DEMO', // ✅ Use DEMO quality (22.05kHz) instead of STANDARD (44.1kHz) to reduce file size
          mode: 'OFFLINE',
          includeEffects: true,
          normalize: true,
          fadeOut: true,
          fadeOutDuration: 0.1,
          stereo: true,
          startTime: 0,
          endTime: durationBeats,
          download: false, // ✅ Don't auto-download, we'll upload to backend
        },
        (channelId, progress, status) => {
          // Map export progress (50-90%)
          const mappedProgress = 50 + (progress * 0.4);
          setPublishProgress({ 
            progress: Math.round(mappedProgress), 
            status: status || 'Rendering...', 
            error: null 
          });
        }
      );
      
      if (!exportResult || exportResult.length === 0 || !exportResult[0]?.file) {
        throw new Error('Export failed - no result');
      }
      
      // 6. Upload to backend
      setPublishProgress({ progress: 90, status: 'Uploading audio preview...', error: null });
      // exportResult[0].file is an object with { file: Blob, blob: Blob, ... }
      const exportData = exportResult[0].file;
      const audioBlob = exportData?.file || exportData?.blob;
      if (!audioBlob || typeof audioBlob.arrayBuffer !== 'function') {
        console.error('❌ [PUBLISH] Export result structure:', exportData);
        throw new Error('Export result missing valid Blob (file/blob property)');
      }
      // ✅ FIX: Use multipart/form-data upload instead of base64
      // This eliminates base64 encoding overhead (~33% size reduction)
      // and allows larger files (up to Vercel's 4.5MB limit, but without base64 overhead)
      const fileSizeMB = audioBlob.size / (1024 * 1024);
      console.log(`📊 [PUBLISH] Audio file size: ${fileSizeMB.toFixed(2)}MB`);
      
      // ✅ Check file size (multipart is smaller than base64, so we can allow slightly larger files)
      // Vercel's 4.5MB limit applies to the request body, but multipart has some overhead
      // So we'll use a conservative limit of 4MB for the actual file
      if (fileSizeMB > 4.0) {
        throw new Error(`Audio file too large (${fileSizeMB.toFixed(2)}MB). Maximum size is 4MB for upload. Please reduce the project duration or use a shorter arrangement.`);
      }
      
      // Upload via API using multipart/form-data
      const durationSeconds = (durationBeats / 4) * (60 / bpm);
      console.log(`📤 [PUBLISH] Starting multipart upload: ${fileSizeMB.toFixed(2)}MB, duration: ${durationSeconds.toFixed(2)}s`);
      const uploadStartTime = Date.now();
      await apiClient.renderProjectPreview(project.id, {
        audioFile: audioBlob, // ✅ Pass Blob directly instead of base64
        duration: durationSeconds,
      });
      const uploadTime = Date.now() - uploadStartTime;
      console.log(`✅ [PUBLISH] Upload completed in ${uploadTime}ms`);
      
      // 7. Update project to public
      setPublishProgress({ progress: 95, status: 'Publishing project...', error: null });
      await apiClient.updateProject(project.id, {
        isPublic: true,
      });
      
      // 8. Complete
      setPublishProgress({ progress: 100, status: 'Complete!', error: null });
      await loadProjects();
      
      setTimeout(() => {
        setShowPublishModal(false);
        setSelectedProject(null);
        apiClient.showToast('Project published successfully!', 'success', 3000);
      }, 1000);
      
    } catch (error) {
      console.error('❌ [PUBLISH] Render failed:', error);
      setPublishProgress({ 
        progress: 0, 
        status: 'Failed', 
        error: error.message || 'Render failed' 
      });
      apiClient.showToast(`Failed to publish: ${error.message}`, 'error', 5000);
    }
  }, []); // ✅ FIX: Empty deps - function is stable, project is passed as parameter

  const filteredProjects = projects.filter(project =>
    project.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAuthenticated || isGuest) {
    return null;
  }

  return (
    <div className="projects-page">
      <header className="projects-page__header">
        <div className="projects-page__header-content">
          <h1 className="projects-page__title">
            <FolderOpen size={28} />
            My Projects
          </h1>
          <div className="projects-page__stats">
            <span>{projects.length} {projects.length === 1 ? 'project' : 'projects'}</span>
          </div>
        </div>
      </header>

      <div className="projects-page__content">
        <div className="projects-page__toolbar">
          <div className="projects-page__search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* ✅ Multi-select controls */}
          {filteredProjects.length > 0 && (
            <div className="projects-page__toolbar-actions">
              <button
                className="projects-page__button"
                onClick={handleSelectAllProjects}
                title={selectedProjects.size === filteredProjects.length ? 'Deselect All' : 'Select All'}
              >
                <Check size={16} />
                {selectedProjects.size === filteredProjects.length ? 'Deselect All' : 'Select All'}
              </button>
              {selectedProjects.size > 0 && (
                <button
                  className="projects-page__button projects-page__button--danger"
                  onClick={handleDeleteSelectedProjects}
                  title={`Delete ${selectedProjects.size} project(s)`}
                >
                  <Trash2 size={16} />
                  Delete Selected ({selectedProjects.size})
                </button>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="projects-page__loading">
            <Loader2 size={32} className="spinner" />
            <span>Loading projects...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="projects-page__empty">
            {searchQuery ? (
              <>
                <Search size={48} />
                <h3>No projects found</h3>
                <p>Try adjusting your search query</p>
              </>
            ) : (
              <>
                <Music size={48} />
                <h3>No projects yet</h3>
                <p>Create your first project in the DAW</p>
                <button
                  className="projects-page__button projects-page__button--primary"
                  onClick={() => navigate('/daw')}
                >
                  Go to DAW
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="projects-page__grid">
            {filteredProjects.map((project) => (
              <div 
                key={project.id} 
                className={`projects-page__card ${selectedProjects.has(project.id) ? 'projects-page__card--selected' : ''}`}
              >
                {/* ✅ Multi-select checkbox */}
                <div className="projects-page__card-checkbox">
                  <label className="projects-page__checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={() => handleToggleProjectSelection(project.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="projects-page__checkbox-input"
                    />
                    <span className="projects-page__checkbox-custom"></span>
                  </label>
                </div>
                <div className="projects-page__card-header">
                  <div className="projects-page__card-title">
                    <Music size={20} />
                    <span>{project.title || 'Untitled Project'}</span>
                  </div>
                  <div className="projects-page__card-badges">
                    {project.isPublic && (
                      <span className="projects-page__badge projects-page__badge--public">
                        <Eye size={14} />
                        Public
                      </span>
                    )}
                    {project.isUnlisted && (
                      <span className="projects-page__badge projects-page__badge--unlisted">
                        Unlisted
                      </span>
                    )}
                    {project.previewAudioStatus && project.isPublic && (
                      <span className={`projects-page__badge projects-page__badge--render projects-page__badge--render-${project.previewAudioStatus}`}>
                        {project.previewAudioStatus === 'rendering' && '🎵 Rendering...'}
                        {project.previewAudioStatus === 'ready' && '✅ Preview Ready'}
                        {project.previewAudioStatus === 'failed' && '❌ Render Failed'}
                        {project.previewAudioStatus === 'pending' && '⏳ Pending'}
                      </span>
                    )}
                  </div>
                </div>

                {project.description && (
                  <p className="projects-page__card-description">{project.description}</p>
                )}

                <div className="projects-page__card-meta">
                  {project.bpm && (
                    <span className="projects-page__meta-item">
                      <Music size={14} />
                      {project.bpm} BPM
                    </span>
                  )}
                  {project.keySignature && (
                    <span className="projects-page__meta-item">
                      {project.keySignature}
                    </span>
                  )}
                  {project.updatedAt && (
                    <span className="projects-page__meta-item">
                      <Calendar size={14} />
                      {new Date(project.updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>

                <div className="projects-page__card-stats">
                  {project.playCount > 0 && (
                    <span>{project.playCount} plays</span>
                  )}
                  {project.likeCount > 0 && (
                    <span>{project.likeCount} likes</span>
                  )}
                </div>

                <div className="projects-page__card-actions">
                  <button
                    className="projects-page__action-btn"
                    onClick={() => handleOpenProject(project.id)}
                    title="Open in DAW"
                  >
                    <FolderOpen size={16} />
                    Open
                  </button>
                  <button
                    className="projects-page__action-btn"
                    onClick={() => handleEdit(project)}
                    title="Edit"
                  >
                    <Edit size={16} />
                    Edit
                  </button>
                  <button
                    className="projects-page__action-btn"
                    onClick={() => handleShare(project)}
                    title="Share"
                  >
                    <Share2 size={16} />
                    Share
                  </button>
                  <button
                    className={`projects-page__action-btn ${project.isPublic ? 'projects-page__action-btn--active' : ''}`}
                    onClick={() => handleTogglePublic(project)}
                    title={project.isPublic ? 'Unpublish' : 'Publish to Media'}
                  >
                    {project.isPublic ? <EyeOff size={16} /> : <Eye size={16} />}
                    {project.isPublic ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    className="projects-page__action-btn projects-page__action-btn--danger"
                    onClick={() => handleDelete(project)}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedProject && (
        <EditProjectModal
          project={selectedProject}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProject(null);
          }}
          onSave={handleSaveEdit}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedProject && (
        <DeleteProjectModal
          project={selectedProject}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedProject(null);
          }}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* Share Modal */}
        {showShareModal && selectedProject && (
          <ShareProjectModal
            project={selectedProject}
            onClose={() => {
              setShowShareModal(false);
              setSelectedProject(null);
            }}
            onCopyUrl={handleCopyShareUrl}
            onTogglePublic={handleTogglePublic}
            copiedShareUrl={copiedShareUrl}
          />
        )}
        
        {showPublishModal && selectedProject && (
          <PublishModal
            project={selectedProject}
            progress={publishProgress}
            onClose={() => {
              setShowPublishModal(false);
              setSelectedProject(null);
              setPublishProgress({ progress: 0, status: '', error: null });
            }}
            onPublish={handlePublishWithRender}
          />
        )}
      
      {/* ✅ Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        confirmText={confirmationModal.confirmText}
        cancelText={confirmationModal.cancelText}
        variant={confirmationModal.variant}
        onConfirm={() => {
          if (confirmationModal.onConfirm) {
            confirmationModal.onConfirm();
          }
          setConfirmationModal({ ...confirmationModal, isOpen: false });
        }}
        onCancel={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
      />
    </div>
  );
}

// Edit Project Modal
function EditProjectModal({ project, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: project.title || '',
    description: project.description || '',
    bpm: project.bpm || '',
    keySignature: project.keySignature || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      apiClient.showToast('Title is required', 'warning', 3000);
      return;
    }

    onSave({
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      bpm: formData.bpm ? parseInt(formData.bpm) : undefined,
      keySignature: formData.keySignature.trim() || undefined,
    });
  };

  return (
    <div className="projects-modal-overlay" onClick={onClose}>
      <div className="projects-modal" onClick={(e) => e.stopPropagation()}>
        <div className="projects-modal__header">
          <h2>Edit Project</h2>
          <button className="projects-modal__close" onClick={onClose}>×</button>
        </div>
        <form className="projects-modal__form" onSubmit={handleSubmit}>
          <div className="projects-modal__field">
            <label>Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              maxLength={255}
            />
          </div>
          <div className="projects-modal__field">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              maxLength={5000}
            />
          </div>
          <div className="projects-modal__row">
            <div className="projects-modal__field">
              <label>BPM</label>
              <input
                type="number"
                min="1"
                max="300"
                value={formData.bpm}
                onChange={(e) => setFormData({ ...formData, bpm: e.target.value })}
              />
            </div>
            <div className="projects-modal__field">
              <label>Key Signature</label>
              <input
                type="text"
                value={formData.keySignature}
                onChange={(e) => setFormData({ ...formData, keySignature: e.target.value })}
                placeholder="e.g., C, Am, F#m"
              />
            </div>
          </div>
          <div className="projects-modal__actions">
            <button type="button" className="projects-page__button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="projects-page__button projects-page__button--primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Project Modal
function DeleteProjectModal({ project, onClose, onConfirm }) {
  return (
    <div className="projects-modal-overlay" onClick={onClose}>
      <div className="projects-modal" onClick={(e) => e.stopPropagation()}>
        <div className="projects-modal__header">
          <h2>Delete Project</h2>
          <button className="projects-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="projects-modal__body">
          <p>Are you sure you want to delete <strong>"{project.title || 'Untitled Project'}"</strong>?</p>
          <p className="projects-modal__warning">This action cannot be undone.</p>
        </div>
        <div className="projects-modal__actions">
          <button type="button" className="projects-page__button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="projects-page__button projects-page__button--danger"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Publish Modal with Render Progress
function PublishModal({ project, progress, onClose, onPublish }) {
  const hasStartedRef = React.useRef(false);
  const projectIdRef = React.useRef(null);
  
  React.useEffect(() => {
    // ✅ FIX: Only run once per project ID to prevent infinite loop
    // Use refs to track state without causing re-renders
    if (!hasStartedRef.current || projectIdRef.current !== project.id) {
      hasStartedRef.current = true;
      projectIdRef.current = project.id;
      onPublish(project);
    }
    // ✅ FIX: Only depend on project.id, not the entire project object or onPublish function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]); // Only re-run if project ID changes
  
  const isComplete = progress.progress === 100;
  const hasError = progress.error !== null;
  
  return (
    <div className="projects-modal-overlay" onClick={isComplete || hasError ? onClose : undefined}>
      <div className="projects-modal" onClick={(e) => e.stopPropagation()}>
        <div className="projects-modal__header">
          <h2>Publishing Project</h2>
          {(isComplete || hasError) && (
            <button className="projects-modal__close" onClick={onClose}>×</button>
          )}
        </div>
        <div className="projects-modal__body">
          <div className="projects-publish-progress">
            <div className="projects-publish-progress__bar">
              <div 
                className="projects-publish-progress__fill"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <div className="projects-publish-progress__status">
              {hasError ? (
                <span style={{ color: 'var(--zenith-color-red-500)' }}>
                  ❌ {progress.error}
                </span>
              ) : isComplete ? (
                <span style={{ color: 'var(--zenith-color-green-500)' }}>
                  ✅ {progress.status}
                </span>
              ) : (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px', display: 'inline-block' }} />
                  {progress.status}
                </>
              )}
            </div>
            <div className="projects-publish-progress__steps">
              <div className={progress.progress >= 10 ? 'completed' : ''}>1. Load Project</div>
              <div className={progress.progress >= 20 ? 'completed' : ''}>2. Initialize Audio</div>
              <div className={progress.progress >= 30 ? 'completed' : ''}>3. Load Project Data</div>
              <div className={progress.progress >= 50 ? 'completed' : ''}>4. Render Audio</div>
              <div className={progress.progress >= 90 ? 'completed' : ''}>5. Upload</div>
              <div className={progress.progress >= 100 ? 'completed' : ''}>6. Publish</div>
            </div>
          </div>
        </div>
        {(isComplete || hasError) && (
          <div className="projects-modal__actions">
            <button type="button" className="projects-page__button" onClick={onClose}>
              {hasError ? 'Close' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Share Project Modal
function ShareProjectModal({ project, onClose, onCopyUrl, onTogglePublic, copiedShareUrl }) {
  const shareUrl = `${window.location.origin}/media/project/${project.id}`;
  
  const handleToggleUnlisted = async () => {
    try {
      await apiClient.updateProject(project.id, {
        isUnlisted: !project.isUnlisted,
      });
      onClose();
      // Reload projects to reflect changes
      window.location.reload();
    } catch (error) {
      // ✅ Error toast will be shown automatically by API client
    }
  };

  return (
    <div className="projects-modal-overlay" onClick={onClose}>
      <div className="projects-modal" onClick={(e) => e.stopPropagation()}>
        <div className="projects-modal__header">
          <h2>Share Project</h2>
          <button className="projects-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="projects-modal__body">
          <div className="projects-modal__share-url">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="projects-modal__url-input"
            />
            <button
              className="projects-page__button projects-page__button--small"
              onClick={() => onCopyUrl(project)}
              title="Copy URL"
            >
              {copiedShareUrl === project.id ? (
                <>
                  <Check size={16} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="projects-modal__share-options">
            <label className="projects-modal__checkbox">
              <input
                type="checkbox"
                checked={project.isPublic}
                onChange={async () => {
                  await onTogglePublic(project);
                  // Reload projects to show updated status
                  window.location.reload();
                }}
              />
              <div>
                <strong>Publish to Media</strong>
                <p>Make this project visible in the Media section for others to discover</p>
                {project.isPublic && project.previewAudioStatus && (
                  <p style={{ fontSize: '11px', marginTop: '4px', color: 'var(--zenith-text-tertiary)' }}>
                    {project.previewAudioStatus === 'rendering' && '🎵 Audio preview is being generated...'}
                    {project.previewAudioStatus === 'ready' && '✅ Audio preview ready'}
                    {project.previewAudioStatus === 'failed' && '❌ Audio preview generation failed'}
                    {project.previewAudioStatus === 'pending' && '⏳ Audio preview pending'}
                  </p>
                )}
              </div>
            </label>
            <label className="projects-modal__checkbox">
              <input
                type="checkbox"
                checked={project.isUnlisted}
                onChange={handleToggleUnlisted}
              />
              <div>
                <strong>Unlisted</strong>
                <p>Project is accessible via direct link but won't appear in public listings</p>
              </div>
            </label>
          </div>
        </div>
        <div className="projects-modal__actions">
          <button type="button" className="projects-page__button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

