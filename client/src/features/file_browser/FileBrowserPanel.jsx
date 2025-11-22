import React, { useRef, useState, useEffect } from 'react';
import { Plus, Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { FileTreeNode } from './FileTreeNode';
import ChannelContextMenu from '@/components/ChannelContextMenu';
import { FileBrowserPreview } from './FileBrowserPreview';
import { useFileBrowserStore } from '@/store/useFileBrowserStore';
import { useAuthStore } from '@/store/useAuthStore'; // ✅ FIX: Import useAuthStore to react to login changes
import { FILE_SYSTEM_TYPES } from '@/config/constants';
import { apiClient } from '@/services/api';

// Helper function to format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default function FileBrowserPanel() {
    const { 
        fileTree, 
        selectedNode, 
        setSelectedNode, 
        createFolder, 
        deleteNode, 
        renameNode,
        moveNode,
        uploadFiles,
        loadAudioManifest,
        manifestLoaded,
        loadStorageQuota,
        loadUserAssets,
        uploadFile,
        quota,
        userAssetsLoaded
    } = useFileBrowserStore();
    
    // ✅ DYNAMIC: Load audio manifest on mount
    useEffect(() => {
        if (!manifestLoaded) {
            loadAudioManifest();
        }
    }, [manifestLoaded, loadAudioManifest]);

    // ✅ FIX: Get auth state to react to login changes
    const { isAuthenticated, isGuest } = useAuthStore();
    
    // ✅ FIX: Load storage quota, user assets, and system assets when authenticated (on mount and when auth state changes)
    useEffect(() => {
        const loadBackendData = async () => {
            // Load system assets for all users (including guests)
            try {
                const { loadSystemAssets } = useFileBrowserStore.getState();
                await loadSystemAssets();
            } catch (error) {
                console.log('⚠️ Failed to load system assets:', error);
            }
            
            // Only load user-specific data if authenticated (not guest)
            if (isAuthenticated && !isGuest) {
                try {
                    console.log('🔄 Loading user data after login...');
                    await loadStorageQuota();
                    await loadUserAssets();
                    console.log('✅ User data loaded successfully');
                } catch (error) {
                    // Silently handle backend connection errors
                    console.log('⚠️ Backend not available, continuing in offline mode');
                }
            } else {
                // ✅ FIX: Clear user data when logged out or in guest mode
                useFileBrowserStore.setState({ 
                    userAssets: [], 
                    userAssetsLoaded: false,
                    quota: null 
                });
            }
        };
        loadBackendData();
    }, [loadStorageQuota, loadUserAssets, isAuthenticated, isGuest]); // ✅ FIX: Add isAuthenticated and isGuest as dependencies
    
    const [contextMenu, setContextMenu] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false); // Sürükleme efekti için state
    const [uploadingFiles, setUploadingFiles] = useState(new Map()); // Map<filename, { status: 'uploading' | 'success' | 'error', progress?: number }>
    const fileInputRef = useRef(null);

    const handleContextMenu = (event, node) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedNode(node);
        setContextMenu({ x: event.clientX, y: event.clientY, node });
    };

    const handleFileUpload = async (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            // ✅ BACKEND: Upload to server instead of local storage
            const folderPath = selectedNode?.type === 'folder' ? selectedNode.folderPath || '/' : '/';
            // ✅ FIX: Only use parentFolderId if it's a valid UUID (user-created folders have UUIDs)
            let parentFolderId = null;
            if (selectedNode?.type === 'folder' && selectedNode.id && selectedNode.id !== 'root' && 
                selectedNode.id !== 'folder-dawg-library' && selectedNode.id !== 'folder-user-samples' &&
                !selectedNode.id.startsWith('folder-dawg-')) {
                // Only use parentFolderId for user-created folders (they have UUIDs)
                // Check if it's a valid UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (uuidRegex.test(selectedNode.id)) {
                    parentFolderId = selectedNode.id;
                }
            }
            
            // Initialize upload states
            const newUploadingFiles = new Map();
            Array.from(files).forEach(file => {
                newUploadingFiles.set(file.name, { status: 'uploading', progress: 0 });
            });
            setUploadingFiles(newUploadingFiles);
            
            // Show info toast for multiple files
            if (files.length > 1) {
                apiClient.showToast(`Uploading ${files.length} files...`, 'info', 2000);
            }
            
            // Upload files sequentially
            for (const file of Array.from(files)) {
                try {
                    // ✅ FIX: Ensure mimeType is set (fallback to 'audio/wav' if not provided)
                    const mimeType = file.type || 'audio/wav';
                    if (!mimeType.startsWith('audio/')) {
                        console.warn(`⚠️ File ${file.name} has non-audio mime type: ${mimeType}, using 'audio/wav'`);
                    }
                    
                    // Update status to uploading
                    setUploadingFiles(prev => {
                        const newMap = new Map(prev);
                        newMap.set(file.name, { status: 'uploading', progress: 50 });
                        return newMap;
                    });
                    
                    await uploadFile(file, folderPath, parentFolderId);
                    
                    // Update status to success
                    setUploadingFiles(prev => {
                        const newMap = new Map(prev);
                        newMap.set(file.name, { status: 'success', progress: 100 });
                        return newMap;
                    });
                    
                    // Show success toast
                    apiClient.showToast(`✅ ${file.name} uploaded successfully`, 'success', 3000);
                    
                    // Remove from uploading list after 2 seconds
                    setTimeout(() => {
                        setUploadingFiles(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(file.name);
                            return newMap;
                        });
                    }, 2000);
                } catch (error) {
                    console.error(`❌ Failed to upload ${file.name}:`, error);
                    
                    // Update status to error
                    setUploadingFiles(prev => {
                        const newMap = new Map(prev);
                        newMap.set(file.name, { status: 'error', progress: 0 });
                        return newMap;
                    });
                    
                    // Show error toast
                    apiClient.showToast(`❌ Failed to upload ${file.name}: ${error.message}`, 'error', 5000);
                    
                    // Remove from uploading list after 5 seconds
                    setTimeout(() => {
                        setUploadingFiles(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(file.name);
                            return newMap;
                        });
                    }, 5000);
                }
            }
        }
        event.target.value = null; // Aynı dosyayı tekrar yükleyebilmek için
    };

    const triggerFileUpload = () => fileInputRef.current?.click();

    // --- Sürükle-Bırak Fonksiyonları ---
    const handleDragOver = (e) => {
        // Only allow drop if it's an external file (not from file browser)
        const isInternalDrag = e.dataTransfer.types.includes('application/x-dawg-file-node');
        if (!isInternalDrag) {
            e.preventDefault(); // Bırakma işlemine izin vermek için gerekli
        }
    };

    const handleDragEnter = (e) => {
        // Only show upload area for external files (not from file browser)
        const isInternalDrag = e.dataTransfer.types.includes('application/x-dawg-file-node');
        if (!isInternalDrag) {
            e.preventDefault();
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        // Child elementler üzerinde gezerken titremeyi önle
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        
        // Only handle external file drops (not internal file browser drags)
        const isInternalDrag = e.dataTransfer.types.includes('application/x-dawg-file-node');
        if (!isInternalDrag) {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const parentId = selectedNode?.type === 'folder' ? selectedNode.id : 'root';
                uploadFiles(parentId, files);
            }
        }
    };

    const getContextMenuOptions = () => {
        if (!contextMenu?.node) return [];
        const { node } = contextMenu;
        let options = [];

        // ✅ DYNAMIC: Check if node is part of DAWG Library (read-only)
        const isDAWGLibrary = node.id === 'folder-dawg-library' || 
                              node.id?.startsWith('folder-dawg-') ||
                              (node.id?.startsWith('file-') && node.readOnly === true);

        if (node.type === 'folder' && !isDAWGLibrary) {
            // ✅ FIX: Check if it's a system folder (DAWG Library, My Samples, etc.)
            const isSystemFolder = node.id === 'folder-dawg-library' || 
                                  node.id === 'folder-user-samples' ||
                                  node.id?.startsWith('folder-dawg-');
            // ✅ FIX: Always create folder at root level, not inside system folders
            options.push({ 
                label: 'New Folder', 
                action: async () => {
                    try {
                        await createFolder(isSystemFolder ? 'root' : node.id);
                    } catch (error) {
                        console.error('Failed to create folder:', error);
                        alert(`Klasör oluşturulamadı: ${error.message}`);
                    }
                }
            });
            options.push({ label: 'Upload File(s)', action: triggerFileUpload });
        }

        if (node.id !== 'root' && !isDAWGLibrary) {
            options.push({ type: 'separator' });
            
            // ✅ NEW: Move option (only for files, not folders)
            if (node.type === FILE_SYSTEM_TYPES.FILE && !node.readOnly) {
                options.push({
                    label: 'Move to Folder...',
                    action: () => {
                        // Show folder selection dialog
                        const targetFolderId = prompt('Enter target folder ID (or "root" for root level):');
                        if (targetFolderId) {
                            moveNode(node.id, targetFolderId.trim()).catch(error => {
                                console.error('Failed to move file:', error);
                                alert(`Failed to move file: ${error.message}`);
                            });
                        }
                    }
                });
            }
            
            options.push({ 
                label: 'Rename', 
                action: () => {
                    const newName = prompt(`'${node.name}' için yeni isim girin:`, node.name);
                    if (newName && newName.trim()) {
                        renameNode(node.id, newName.trim());
                    }
                } 
            });
            options.push({ 
                label: 'Delete', 
                action: () => {
                    // ÖNEMLİ: Gerçek bir uygulamada burada özel bir onay penceresi kullanılmalıdır.
                    // Proje kuralları gereği window.confirm'den kaçınılmıştır.
                    deleteNode(node.id);
                }
            });
        }
        return options;
    };
    
    // Sürükleme durumuna göre dinamik sınıf
    const asideClasses = `file-browser ${isDragOver ? 'file-browser--drag-over' : ''}`;

    return (
        <aside 
            className={asideClasses}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {isDragOver && (
                <div className="file-browser__drop-overlay">
                    <Upload size={48} className="text-[var(--zenith-accent-cool)]" />
                    <p className="mt-4 text-lg font-semibold text-[var(--zenith-text-primary)]">Dosyaları yüklemek için buraya bırakın</p>
                </div>
            )}
            <header className="file-browser__header">
                <div className="file-browser__header-top">
                    <h2 className="file-browser__title">Library</h2>
                    {quota && (
                        <div className="file-browser__quota">
                            <span className="file-browser__quota-text">
                                {formatBytes(quota.used_bytes)} / {formatBytes(quota.quota_bytes)}
                            </span>
                            <div className="file-browser__quota-bar">
                                <div 
                                    className="file-browser__quota-fill"
                                    style={{ width: `${Math.min((quota.used_bytes / quota.quota_bytes) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className="file-browser__actions">
                    <button onClick={async () => {
                        try {
                            // ✅ FIX: Always create folder at root level, not inside system folders
                            const isSystemFolder = selectedNode?.id === 'folder-dawg-library' || 
                                                  selectedNode?.id === 'folder-user-samples' ||
                                                  selectedNode?.id?.startsWith('folder-dawg-');
                            const parentId = (selectedNode?.type === 'folder' && !isSystemFolder) ? selectedNode.id : 'root';
                            await createFolder(parentId);
                        } catch (error) {
                            console.error('Failed to create folder:', error);
                            alert(`Klasör oluşturulamadı: ${error.message}`);
                        }
                    }} title="New Folder" className="file-browser__action-btn">
                        <Plus size={14} /> {/* ✅ FIX: Smaller icon */}
                    </button>
                    <button onClick={triggerFileUpload} title="Upload Files" className="file-browser__action-btn">
                        <Upload size={14} /> {/* ✅ FIX: Smaller icon */}
                    </button>
                    <input type="file" multiple ref={fileInputRef} className="file-browser__upload-input" onChange={handleFileUpload} accept="audio/*,.mid,.midi" />
                </div>
            </header>

            <div className="file-browser__tree-container">
                {fileTree.children.map(node => (
                    <FileTreeNode
                        key={node.id}
                        node={node}
                        onContextMenu={handleContextMenu}
                        onNodeClick={setSelectedNode}
                        selectedNode={selectedNode}
                    />
                ))}
            </div>

            {/* Upload Progress Indicator */}
            {uploadingFiles.size > 0 && (
                <div className="file-browser__upload-progress">
                    <div className="file-browser__upload-progress-header">
                        <Upload size={16} />
                        <span>Uploading {uploadingFiles.size} file{uploadingFiles.size > 1 ? 's' : ''}</span>
                    </div>
                    <div className="file-browser__upload-progress-list">
                        {Array.from(uploadingFiles.entries()).map(([filename, fileState]) => (
                            <div key={filename} className={`file-browser__upload-item file-browser__upload-item--${fileState.status}`}>
                                <div className="file-browser__upload-item-icon">
                                    {fileState.status === 'uploading' && <Loader2 size={14} className="spinning" />}
                                    {fileState.status === 'success' && <CheckCircle2 size={14} />}
                                    {fileState.status === 'error' && <XCircle size={14} />}
                                </div>
                                <div className="file-browser__upload-item-content">
                                    <div className="file-browser__upload-item-name">{filename}</div>
                                    {fileState.status === 'uploading' && (
                                        <div className="file-browser__upload-item-progress">
                                            <div 
                                                className="file-browser__upload-item-progress-bar"
                                                style={{ width: `${fileState.progress || 0}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="file-browser__preview">
              <FileBrowserPreview fileNode={selectedNode} />
            </div>

            {contextMenu && (
                <ChannelContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    options={getContextMenuOptions()}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </aside>
    );
}

