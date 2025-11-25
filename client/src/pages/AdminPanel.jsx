/**
 * Admin Panel
 * System assets management interface
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { apiClient, setToastHandler } from '../services/api';
import { Upload, Edit, Trash2, Plus, Search, Filter, Music, Folder, Tag, Settings, FileText, Eye, EyeOff, Globe, Lock } from 'lucide-react';
import ConfirmationModal from '../components/common/ConfirmationModal';
import './AdminPanel.css';

export default function AdminPanel() {
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState('assets'); // 'assets', 'packs', 'categories', 'projects'
  const [assets, setAssets] = useState([]);
  const [packs, setPacks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedPack, setSelectedPack] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPacks, setSelectedPacks] = useState(new Set()); // For multi-select
  const [selectedProjects, setSelectedProjects] = useState(new Set()); // For multi-select
  const [selectedProject, setSelectedProject] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [showPackEditModal, setShowPackEditModal] = useState(false);
  const [showCategoryEditModal, setShowCategoryEditModal] = useState(false);
  
  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    onConfirm: null,
  });
  
  // ✅ Toast notifications - use API client's built-in toast system
  // Toast'lar API client tarafından otomatik gösterilecek

  // ✅ Load categories and packs on mount (needed for pack/asset modals)
  // Only load if default tab is 'assets' to avoid duplicate requests
  // If default tab is 'packs' or 'categories', loadData will load them anyway
  useEffect(() => {
    if (isAuthenticated && activeTab === 'assets') {
      loadCategories();
      loadPacks(); // Always load packs for asset upload modal
    }
  }, [isAuthenticated]); // Only run on mount/auth change, not on tab change

  // Load data based on active tab
  // Only loads the data for the active tab, doesn't reload categories/packs
  useEffect(() => {
    if (isAuthenticated) {
      console.log(`🔄 Loading data for tab: ${activeTab}`);
      loadData();
    } else {
      console.log('⚠️ Not authenticated, skipping data load');
    }
  }, [isAuthenticated, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Load categories separately (always needed for modals)
  const loadCategories = async () => {
    try {
      const response = await apiClient.listSystemCategories();
      setCategories(response.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  // ✅ Load packs separately (always needed for asset upload modal)
  const loadPacks = async () => {
    try {
      const response = await apiClient.listSystemPacks({ limit: 100 });
      setPacks(response.packs || []);
    } catch (error) {
      console.error('Failed to load packs:', error);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'assets') {
        console.log('📦 Loading system assets...');
        console.log('🔐 Auth token:', useAuthStore.getState().accessToken ? 'Present' : 'Missing');
        // ✅ FIX: Don't pass isActive - backend will show all assets for authenticated users
        const response = await apiClient.listSystemAssets({ limit: 1000 });
        console.log('📦 System assets response:', response);
        console.log('📦 Response keys:', Object.keys(response));
        console.log('📦 Assets count:', response.assets?.length || 0);
        console.log('📦 Total:', response.total);
        setAssets(response.assets || []);
      } else if (activeTab === 'packs') {
        // ✅ FIX: Reload packs when packs tab is active (for fresh data)
        // Mount'ta yüklenen packs modal'lar için, burada yüklenen packs tab için
        const response = await apiClient.listSystemPacks({ limit: 100 });
        console.log('📦 Packs response:', response);
        setPacks(response.packs || []);
        console.log('📦 Packs state updated:', response.packs?.length || 0, 'packs');
      } else if (activeTab === 'categories') {
        // ✅ FIX: Reload categories when categories tab is active (for fresh data)
        // Mount'ta yüklenen categories modal'lar için, burada yüklenen categories tab için
        const response = await apiClient.listSystemCategories();
        setCategories(response.categories || []);
      } else if (activeTab === 'projects') {
        const response = await apiClient.getProjects({ limit: 1000 });
        setProjects(response.projects || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      // ✅ Toast will be shown automatically by API client
      // No need to show alert - API client handles it
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (file, metadata) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // ✅ Use unified upload service
      const { uploadFile: uploadFileService, UploadType } = await import('@/lib/services/uploadService.js');
      
      const asset = await uploadFileService(file, {
        type: UploadType.SYSTEM_ASSET,
        metadata: {
          ...metadata,
          filename: file.name,
        },
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
      });
      
      // Show success toast
      apiClient.showToast(`✅ Asset "${asset.name}" uploaded successfully`, 'success', 3000);
      
      await loadData();
      setShowUploadModal(false);
      setUploadProgress(0);
    } catch (error) {
      console.error('Upload failed:', error);
      apiClient.showToast(`❌ Upload failed: ${error.message}`, 'error', 5000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteAsset = async (assetId) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Asset',
      message: 'Are you sure you want to delete this asset?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal({ ...confirmationModal, isOpen: false });
        try {
          await apiClient.deleteSystemAsset(assetId);
          await loadData();
          // ✅ Success/error toasts will be shown automatically by API client
        } catch (error) {
          console.error('Delete failed:', error);
          // ✅ Error toast will be shown automatically by API client
        }
      },
    });
  };

  const handleDeletePack = async (packId) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Pack',
      message: 'Are you sure you want to delete this pack? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal({ ...confirmationModal, isOpen: false });
        try {
          await apiClient.deleteSystemPack(packId);
          await loadData();
          // ✅ Success/error toasts will be shown automatically by API client
        } catch (error) {
          console.error('Delete failed:', error);
          // ✅ Error toast will be shown automatically by API client
        }
      },
    });
  };

  const handleDeleteSelectedPacks = async () => {
    if (selectedPacks.size === 0) return;
    
    const count = selectedPacks.size;
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Packs',
      message: `Are you sure you want to delete ${count} pack(s)? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal({ ...confirmationModal, isOpen: false });
        try {
          // Delete all selected packs in parallel
          await Promise.all(Array.from(selectedPacks).map(packId => apiClient.deleteSystemPack(packId)));
          setSelectedPacks(new Set()); // Clear selection
          await loadData();
          // ✅ Success/error toasts will be shown automatically by API client
        } catch (error) {
          console.error('Delete failed:', error);
          // ✅ Error toast will be shown automatically by API client
        }
      },
    });
  };

  const handleTogglePackSelection = (packId) => {
    const newSelection = new Set(selectedPacks);
    if (newSelection.has(packId)) {
      newSelection.delete(packId);
    } else {
      newSelection.add(packId);
    }
    setSelectedPacks(newSelection);
  };

  const handleSelectAllPacks = () => {
    if (selectedPacks.size === packs.length) {
      setSelectedPacks(new Set()); // Deselect all
    } else {
      setSelectedPacks(new Set(packs.map(p => p.id))); // Select all
    }
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="admin-panel">
        <div className="admin-panel__error">
          <h2>Access Denied</h2>
          <p>Please log in to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <header className="admin-panel__header">
        <h1 className="admin-panel__title">
          <Settings size={24} />
          Admin Panel
        </h1>
        <div className="admin-panel__tabs">
          <button
            className={`admin-panel__tab ${activeTab === 'assets' ? 'active' : ''}`}
            onClick={() => setActiveTab('assets')}
          >
            <Music size={18} />
            Assets
          </button>
          <button
            className={`admin-panel__tab ${activeTab === 'packs' ? 'active' : ''}`}
            onClick={() => setActiveTab('packs')}
          >
            <Folder size={18} />
            Packs
          </button>
          <button
            className={`admin-panel__tab ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            <Tag size={18} />
            Categories
          </button>
          <button
            className={`admin-panel__tab ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <FileText size={18} />
            Projects
          </button>
        </div>
      </header>

      <div className="admin-panel__content">
        {activeTab === 'assets' && (
          <div className="admin-panel__section">
            <div className="admin-panel__toolbar">
              <div className="admin-panel__search">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                className="admin-panel__button admin-panel__button--primary"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload size={18} />
                Upload Asset
              </button>
            </div>

            {isLoading ? (
              <div className="admin-panel__loading">Loading...</div>
            ) : (
              <div className="admin-panel__table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Pack</th>
                      <th>BPM</th>
                      <th>Key</th>
                      <th>Size</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map((asset) => (
                      <tr key={asset.id}>
                        <td>
                          <div className="admin-panel__asset-name">
                            {asset.name}
                            {asset.isPremium && <span className="admin-panel__badge premium">Premium</span>}
                            {asset.isFeatured && <span className="admin-panel__badge featured">Featured</span>}
                          </div>
                          {asset.description && (
                            <div className="admin-panel__asset-description">{asset.description}</div>
                          )}
                        </td>
                        <td>{asset.categoryId || '-'}</td>
                        <td>{asset.packName || '-'}</td>
                        <td>{asset.bpm || '-'}</td>
                        <td>{asset.keySignature || '-'}</td>
                        <td>{(asset.fileSize / 1024 / 1024).toFixed(2)} MB</td>
                        <td>
                          <span className={`admin-panel__status ${asset.isActive ? 'active' : 'inactive'}`}>
                            {asset.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="admin-panel__actions">
                            <button
                              className="admin-panel__action-btn"
                              onClick={() => {
                                setSelectedAsset(asset);
                                setShowEditModal(true);
                              }}
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              className="admin-panel__action-btn admin-panel__action-btn--danger"
                              onClick={() => handleDeleteAsset(asset.id)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredAssets.length === 0 && (
                  <div className="admin-panel__empty">
                    {searchQuery ? 'No assets found matching your search' : 'No assets yet. Upload your first asset!'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'packs' && (
          <div className="admin-panel__section">
            <div className="admin-panel__toolbar">
              <button
                className="admin-panel__button admin-panel__button--primary"
                onClick={() => setShowPackModal(true)}
              >
                <Plus size={18} />
                Create Pack
              </button>
              {selectedPacks.size > 0 && (
                <>
                  <button
                    className="admin-panel__button admin-panel__button--danger"
                    onClick={handleDeleteSelectedPacks}
                  >
                    <Trash2 size={18} />
                    Delete Selected ({selectedPacks.size})
                  </button>
                  <button
                    className="admin-panel__button"
                    onClick={() => setSelectedPacks(new Set())}
                  >
                    Clear Selection
                  </button>
                </>
              )}
              {packs.length > 0 && (
                <button
                  className="admin-panel__button"
                  onClick={handleSelectAllPacks}
                >
                  {selectedPacks.size === packs.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="admin-panel__loading">Loading...</div>
            ) : (
              <div className="admin-panel__packs-grid">
                {packs.map((pack) => (
                  <div 
                    key={pack.id} 
                    className={`admin-panel__pack-card ${!pack.isActive ? 'admin-panel__pack-card--inactive' : ''} ${selectedPacks.has(pack.id) ? 'admin-panel__pack-card--selected' : ''}`}
                  >
                    <div className="admin-panel__pack-checkbox">
                      <label className="admin-panel__checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedPacks.has(pack.id)}
                          onChange={() => handleTogglePackSelection(pack.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="admin-panel__checkbox-input"
                        />
                        <span className="admin-panel__checkbox-custom"></span>
                      </label>
                    </div>
                    <div className="admin-panel__pack-header">
                      <h3>{pack.name}</h3>
                      <div className="admin-panel__pack-badges">
                        {!pack.isActive && <span className="admin-panel__badge inactive">Inactive</span>}
                        {pack.isFeatured && <span className="admin-panel__badge featured">Featured</span>}
                      </div>
                    </div>
                    <p className="admin-panel__pack-description">{pack.description || 'No description'}</p>
                    <div className="admin-panel__pack-stats">
                      <span>{pack.assetCount} assets</span>
                      <span>{pack.isFree ? 'Free' : `$${pack.price}`}</span>
                    </div>
                    <div className="admin-panel__pack-actions">
                      <button 
                        className="admin-panel__button admin-panel__button--small"
                        onClick={() => {
                          setSelectedPack(pack);
                          setShowPackEditModal(true);
                        }}
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                      <button 
                        className="admin-panel__button admin-panel__button--small admin-panel__button--danger"
                        onClick={() => handleDeletePack(pack.id)}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {packs.length === 0 && (
                  <div className="admin-panel__empty">No packs yet. Create your first pack!</div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="admin-panel__section">
            <div className="admin-panel__categories-list">
              {categories.map((category) => (
                <div key={category.id} className="admin-panel__category-item">
                  <div className="admin-panel__category-info">
                    <h3>{category.name}</h3>
                    <p>{category.description || 'No description'}</p>
                  </div>
                  <div className="admin-panel__category-actions">
                    <button 
                      className="admin-panel__button admin-panel__button--small"
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowCategoryEditModal(true);
                      }}
                    >
                      <Edit size={16} />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="admin-panel__section">
            <div className="admin-panel__toolbar">
              <div className="admin-panel__search">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="admin-panel__toolbar-actions">
                {selectedProjects.size > 0 && (
                  <button
                    className="admin-panel__button admin-panel__button--danger"
                    onClick={() => {
                      setConfirmationModal({
                        isOpen: true,
                        title: 'Delete Selected Projects',
                        message: `Are you sure you want to delete ${selectedProjects.size} project(s)? This action cannot be undone.`,
                        confirmText: 'Delete',
                        cancelText: 'Cancel',
                        variant: 'danger',
                        onConfirm: async () => {
                          try {
                            for (const projectId of selectedProjects) {
                              await apiClient.deleteProject(projectId);
                            }
                            setSelectedProjects(new Set());
                            await loadData();
                            setConfirmationModal({ ...confirmationModal, isOpen: false });
                          } catch (error) {
                            console.error('Failed to delete projects:', error);
                          }
                        },
                      });
                    }}
                  >
                    <Trash2 size={18} />
                    Delete Selected ({selectedProjects.size})
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="admin-panel__loading">Loading projects...</div>
            ) : (
              <div className="admin-panel__table">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={selectedProjects.size === projects.length && projects.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProjects(new Set(projects.map(p => p.id)));
                            } else {
                              setSelectedProjects(new Set());
                            }
                          }}
                        />
                      </th>
                      <th>Title</th>
                      <th>Author</th>
                      <th>BPM</th>
                      <th>Visibility</th>
                      <th>Stats</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects
                      .filter(project => 
                        !searchQuery || 
                        project.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        project.description?.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((project) => (
                        <tr key={project.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedProjects.has(project.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedProjects);
                                if (e.target.checked) {
                                  newSelected.add(project.id);
                                } else {
                                  newSelected.delete(project.id);
                                }
                                setSelectedProjects(newSelected);
                              }}
                            />
                          </td>
                          <td>
                            <div className="admin-panel__project-name">
                              {project.title || 'Untitled Project'}
                              {project.isUnlisted && (
                                <span className="admin-panel__badge" style={{ background: '#666' }}>Unlisted</span>
                              )}
                            </div>
                            {project.description && (
                              <div className="admin-panel__project-description">
                                {project.description.substring(0, 100)}
                                {project.description.length > 100 ? '...' : ''}
                              </div>
                            )}
                          </td>
                          <td>{project.userId || '-'}</td>
                          <td>{project.bpm || '-'}</td>
                          <td>
                            <div className="admin-panel__visibility">
                              {project.isPublic ? (
                                <span className="admin-panel__status active">
                                  <Globe size={14} />
                                  Public
                                </span>
                              ) : (
                                <span className="admin-panel__status inactive">
                                  <Lock size={14} />
                                  Private
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="admin-panel__project-stats">
                              <span title="Views">{project.playCount || 0} 👁️</span>
                              <span title="Likes">{project.likeCount || 0} ❤️</span>
                              <span title="Remixes">{project.remixCount || 0} 🔄</span>
                            </div>
                          </td>
                          <td>
                            {project.createdAt 
                              ? new Date(project.createdAt).toLocaleDateString()
                              : '-'
                            }
                          </td>
                          <td>
                            <div className="admin-panel__actions">
                              <button
                                className="admin-panel__action-btn"
                                onClick={() => {
                                  setSelectedProject(project);
                                  // Toggle public/private
                                  apiClient.updateProject(project.id, {
                                    isPublic: !project.isPublic
                                  }).then(() => {
                                    loadData();
                                  }).catch(err => {
                                    console.error('Failed to update project:', err);
                                  });
                                }}
                                title={project.isPublic ? 'Make Private' : 'Make Public'}
                              >
                                {project.isPublic ? <Lock size={16} /> : <Globe size={16} />}
                              </button>
                              <button
                                className="admin-panel__action-btn"
                                onClick={() => {
                                  setSelectedProject(project);
                                  // TODO: Open edit modal
                                  apiClient.showToast('Edit project feature coming soon', 'info');
                                }}
                                title="Edit"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                className="admin-panel__action-btn admin-panel__action-btn--danger"
                                onClick={() => {
                                  setConfirmationModal({
                                    isOpen: true,
                                    title: 'Delete Project',
                                    message: `Are you sure you want to delete "${project.title || 'Untitled Project'}"? This action cannot be undone.`,
                                    confirmText: 'Delete',
                                    cancelText: 'Cancel',
                                    variant: 'danger',
                                    onConfirm: async () => {
                                      try {
                                        await apiClient.deleteProject(project.id);
                                        await loadData();
                                        setConfirmationModal({ ...confirmationModal, isOpen: false });
                                      } catch (error) {
                                        console.error('Failed to delete project:', error);
                                      }
                                    },
                                  });
                                }}
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {projects.length === 0 && (
                  <div className="admin-panel__empty">
                    {searchQuery ? 'No projects found matching your search' : 'No projects yet.'}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <AssetUploadModal
          categories={categories}
          packs={packs}
          onClose={() => {
            setShowUploadModal(false);
            setUploadProgress(0);
            setIsUploading(false);
          }}
          onUpload={handleUpload}
          uploadProgress={uploadProgress}
          isUploading={isUploading}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAsset && (
        <AssetEditModal
          asset={selectedAsset}
          categories={categories}
          packs={packs}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAsset(null);
          }}
          onSave={async (updates) => {
            try {
              await apiClient.updateSystemAsset(selectedAsset.id, updates);
              await loadData();
              setShowEditModal(false);
              setSelectedAsset(null);
              // ✅ Success/error toasts will be shown automatically by API client
            } catch (error) {
              // ✅ Error toast will be shown automatically by API client
            }
          }}
        />
      )}

      {/* Pack Create Modal */}
      {showPackModal && (
        <PackModal
          categories={categories}
          onClose={() => setShowPackModal(false)}
          onSave={async (packData) => {
            try {
              const newPack = await apiClient.createSystemPack(packData);
              console.log('✅ Pack created:', newPack);
              console.log('📦 Pack isActive:', newPack.isActive);
              
              setShowPackModal(false);
              
              // ✅ FIX: Reload packs data after creation (with a delay to ensure DB is updated)
              // Wait for database transaction to commit before reloading
              setTimeout(async () => {
                console.log('📦 Reloading packs data from server...');
                await loadData();
              }, 1000); // ✅ FIX: Delay to ensure DB transaction is committed
              // ✅ Success/error toasts will be shown automatically by API client
            } catch (error) {
              console.error('❌ Pack creation failed:', error);
              // ✅ Error toast will be shown automatically by API client
            }
          }}
        />
      )}

      {/* Pack Edit Modal */}
      {showPackEditModal && selectedPack && (
        <PackEditModal
          pack={selectedPack}
          categories={categories}
          onClose={() => {
            setShowPackEditModal(false);
            setSelectedPack(null);
          }}
          onSave={async (packData) => {
            try {
              await apiClient.updateSystemPack(selectedPack.id, packData);
              await loadData();
              setShowPackEditModal(false);
              setSelectedPack(null);
              // ✅ Success/error toasts will be shown automatically by API client
            } catch (error) {
              // ✅ Error toast will be shown automatically by API client
            }
          }}
        />
      )}

      {/* Category Edit Modal */}
      {showCategoryEditModal && selectedCategory && (
        <CategoryEditModal
          category={selectedCategory}
          onClose={() => {
            setShowCategoryEditModal(false);
            setSelectedCategory(null);
          }}
          onSave={async (categoryData) => {
            try {
              await apiClient.updateSystemCategory(selectedCategory.id, categoryData);
              await loadData();
              setShowCategoryEditModal(false);
              setSelectedCategory(null);
              // ✅ Success/error toasts will be shown automatically by API client
            } catch (error) {
              // ✅ Error toast will be shown automatically by API client
            }
          }}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        confirmText={confirmationModal.confirmText}
        cancelText={confirmationModal.cancelText}
        variant={confirmationModal.variant}
        onConfirm={confirmationModal.onConfirm}
        onCancel={() => setConfirmationModal({ ...confirmationModal, isOpen: false })}
      />
    </div>
  );
}

// Upload Modal Component
function AssetUploadModal({ categories, packs, onClose, onUpload, uploadProgress = 0, isUploading = false }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    packId: '',
    bpm: '',
    keySignature: '',
    tags: '',
    isPremium: false,
    isFeatured: false,
    isActive: true, // ✅ FIX: Add isActive field (default: true)
  });
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFileSelect = (selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    handleFileSelect(selectedFile);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    const droppedFile = event.dataTransfer.files?.[0];
    handleFileSelect(droppedFile);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      apiClient.showToast('Please select a file', 'warning', 3000);
      return;
    }
    if (!formData.name) {
      apiClient.showToast('Please enter a name', 'warning', 3000);
      return;
    }

    const tags = formData.tags
      ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    onUpload(file, {
      ...formData,
      bpm: formData.bpm ? parseInt(formData.bpm) : undefined,
      tags,
    });
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h2>Upload System Asset</h2>
          <button className="admin-modal__close" onClick={onClose}>×</button>
        </div>
        <form className="admin-modal__form" onSubmit={handleSubmit}>
          <div 
            className={`admin-modal__dropzone ${isDragOver ? 'admin-modal__dropzone--active' : ''} ${file ? 'admin-modal__dropzone--filled' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              accept="audio/*"
              ref={fileInputRef}
              className="admin-modal__dropzone-input"
              onChange={handleFileChange}
            />
            <div className="admin-modal__dropzone-content">
              <div className="admin-modal__dropzone-icon">
                <Upload size={32} />
              </div>
              {file ? (
                <div className="admin-modal__dropzone-details">
                  <p className="admin-modal__dropzone-filename">{file.name}</p>
                  <span className="admin-modal__dropzone-meta">
                    {formatFileSize(file.size)} · {file.type || 'audio/wav'}
                  </span>
                </div>
              ) : (
                <div className="admin-modal__dropzone-details">
                  <p className="admin-modal__dropzone-title">Drag & drop your asset</p>
                  <span className="admin-modal__dropzone-meta">or click to browse files</span>
                  <small className="admin-modal__dropzone-hint">WAV, MP3, OGG up to 1GB</small>
                </div>
              )}
            </div>
          </div>
          <div className="admin-modal__field">
            <label>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="admin-modal__field">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="admin-modal__row">
            <div className="admin-modal__field">
              <label>Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">None</option>
                {categories && categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>Loading categories...</option>
                )}
              </select>
            </div>
            <div className="admin-modal__field">
              <label>Pack</label>
              <select
                value={formData.packId}
                onChange={(e) => setFormData({ ...formData, packId: e.target.value })}
              >
                <option value="">None</option>
                {packs && packs.length > 0 ? (
                  packs.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>Loading packs...</option>
                )}
              </select>
            </div>
          </div>
          <div className="admin-modal__row">
            <div className="admin-modal__field">
              <label>BPM</label>
              <input
                type="number"
                value={formData.bpm}
                onChange={(e) => setFormData({ ...formData, bpm: e.target.value })}
              />
            </div>
            <div className="admin-modal__field">
              <label>Key Signature</label>
              <input
                type="text"
                value={formData.keySignature}
                onChange={(e) => setFormData({ ...formData, keySignature: e.target.value })}
                placeholder="e.g., C, Am, F#m"
              />
            </div>
          </div>
          <div className="admin-modal__field">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="drum, trap, 808"
            />
          </div>
          <div className="admin-modal__row">
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isPremium}
                onChange={(e) => setFormData({ ...formData, isPremium: e.target.checked })}
              />
              Premium
            </label>
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
              />
              Featured
            </label>
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>
          
          {/* Upload Progress */}
          {isUploading && (
            <div className="admin-modal__progress">
              <div className="admin-modal__progress-bar">
                <div 
                  className="admin-modal__progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="admin-modal__progress-text">
                {Math.round(uploadProgress)}% - Uploading to CDN...
              </span>
            </div>
          )}

          <div className="admin-modal__actions">
            <button 
              type="button" 
              className="admin-panel__button" 
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="admin-panel__button admin-panel__button--primary"
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Modal Component
function AssetEditModal({ asset, categories, packs, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: asset.name,
    description: asset.description || '',
    categoryId: asset.categoryId || '',
    packId: asset.packId || '',
    bpm: asset.bpm || '',
    keySignature: asset.keySignature || '',
    tags: asset.tags?.join(', ') || '',
    isActive: asset.isActive,
    isPremium: asset.isPremium,
    isFeatured: asset.isFeatured,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const tags = formData.tags
      ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    onSave({
      name: formData.name,
      description: formData.description,
      categoryId: formData.categoryId || undefined,
      packId: formData.packId || undefined,
      bpm: formData.bpm ? parseInt(formData.bpm) : undefined,
      keySignature: formData.keySignature || undefined,
      tags,
      isActive: formData.isActive,
      isPremium: formData.isPremium,
      isFeatured: formData.isFeatured,
    });
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h2>Edit Asset</h2>
          <button className="admin-modal__close" onClick={onClose}>×</button>
        </div>
        <form className="admin-modal__form" onSubmit={handleSubmit}>
          <div className="admin-modal__field">
            <label>Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="admin-modal__field">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="admin-modal__row">
            <div className="admin-modal__field">
              <label>Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">None</option>
                {categories && categories.length > 0 ? (
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>Loading categories...</option>
                )}
              </select>
            </div>
            <div className="admin-modal__field">
              <label>Pack</label>
              <select
                value={formData.packId}
                onChange={(e) => setFormData({ ...formData, packId: e.target.value })}
              >
                <option value="">None</option>
                {packs && packs.length > 0 ? (
                  packs.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.name}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>Loading packs...</option>
                )}
              </select>
            </div>
          </div>
          <div className="admin-modal__row">
            <div className="admin-modal__field">
              <label>BPM</label>
              <input
                type="number"
                value={formData.bpm}
                onChange={(e) => setFormData({ ...formData, bpm: e.target.value })}
              />
            </div>
            <div className="admin-modal__field">
              <label>Key Signature</label>
              <input
                type="text"
                value={formData.keySignature}
                onChange={(e) => setFormData({ ...formData, keySignature: e.target.value })}
              />
            </div>
          </div>
          <div className="admin-modal__field">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
          </div>
          <div className="admin-modal__row">
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Active
            </label>
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isPremium}
                onChange={(e) => setFormData({ ...formData, isPremium: e.target.checked })}
              />
              Premium
            </label>
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
              />
              Featured
            </label>
          </div>
          <div className="admin-modal__actions">
            <button type="button" className="admin-panel__button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-panel__button admin-panel__button--primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Pack Modal Component
function PackModal({ categories, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isFree: true,
    price: '',
    categoryId: '',
    tags: '',
    isFeatured: false,
    isActive: true, // ✅ FIX: Add isActive field (default: true)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) {
      apiClient.showToast('Please enter name and slug', 'warning', 3000);
      return;
    }

    const tags = formData.tags
      ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    onSave({
      ...formData,
      price: formData.price ? parseFloat(formData.price) : undefined,
      tags,
    });
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h2>Create Pack</h2>
          <button className="admin-modal__close" onClick={onClose}>×</button>
        </div>
        <form className="admin-modal__form" onSubmit={handleSubmit}>
          <div className="admin-modal__row">
            <div className="admin-modal__field">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="admin-modal__field">
              <label>Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                required
              />
            </div>
          </div>
          <div className="admin-modal__field">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="admin-modal__row">
            <div className="admin-modal__field">
              <label>Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">None</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-modal__field">
              <label>Tags (comma-separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              />
            </div>
          </div>
          <div className="admin-modal__row">
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isFree}
                onChange={(e) => setFormData({ ...formData, isFree: e.target.checked })}
              />
              Free
            </label>
            {!formData.isFree && (
              <div className="admin-modal__field">
                <label>Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
            )}
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
              />
              Featured
            </label>
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>
          <div className="admin-modal__actions">
            <button type="button" className="admin-panel__button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-panel__button admin-panel__button--primary">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Pack Edit Modal Component
function PackEditModal({ pack, categories, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: pack.name || '',
    slug: pack.slug || '',
    description: pack.description || '',
    isFree: pack.isFree !== undefined ? pack.isFree : true,
    price: pack.price || '',
    categoryId: pack.categoryId || '',
    tags: pack.tags?.join(', ') || '',
    isFeatured: pack.isFeatured || false,
    isActive: pack.isActive !== undefined ? pack.isActive : true, // ✅ FIX: Add isActive field
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) {
      apiClient.showToast('Please enter name and slug', 'warning', 3000);
      return;
    }

    const tags = formData.tags
      ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    onSave({
      ...formData,
      price: formData.price ? parseFloat(formData.price) : undefined,
      tags,
    });
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h2>Edit Pack</h2>
          <button className="admin-modal__close" onClick={onClose}>×</button>
        </div>
        <form className="admin-modal__form" onSubmit={handleSubmit}>
          <div className="admin-modal__row">
            <div className="admin-modal__field">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="admin-modal__field">
              <label>Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="admin-modal__field">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="admin-modal__row">
            <div className="admin-modal__field">
              <label>Category</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">None</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-modal__field">
              <label>Tags (comma-separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>
          <div className="admin-modal__row">
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isFree}
                onChange={(e) => setFormData({ ...formData, isFree: e.target.checked })}
              />
              Free
            </label>
            {!formData.isFree && (
              <div className="admin-modal__field">
                <label>Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                />
              </div>
            )}
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
              />
              Featured
            </label>
            <label className="admin-modal__checkbox">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Active
            </label>
          </div>
          <div className="admin-modal__actions">
            <button type="button" className="admin-panel__button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-panel__button admin-panel__button--primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Category Edit Modal Component
function CategoryEditModal({ category, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: category.name || '',
    slug: category.slug || '',
    description: category.description || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) {
      apiClient.showToast('Please enter name and slug', 'warning', 3000);
      return;
    }

    onSave(formData);
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal__header">
          <h2>Edit Category</h2>
          <button className="admin-modal__close" onClick={onClose}>×</button>
        </div>
        <form className="admin-modal__form" onSubmit={handleSubmit}>
          <div className="admin-modal__row">
            <div className="admin-modal__field">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="admin-modal__field">
              <label>Slug *</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="admin-modal__field">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="admin-modal__actions">
            <button type="button" className="admin-panel__button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-panel__button admin-panel__button--primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

