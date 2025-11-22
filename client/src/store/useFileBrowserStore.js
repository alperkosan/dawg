// src/store/useFileBrowserStore.js - Dynamic audio manifest loading + Backend integration
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { FILE_SYSTEM_TYPES } from '@/config/constants';
import { apiClient } from '@/services/api.js';

/**
 * ✅ FIX: Normalize asset URL to use API endpoint instead of MinIO/CDN
 * Converts MinIO/CDN URLs to API endpoint format
 * System assets use /api/assets/system/:assetId/file endpoint to avoid CORS issues
 */
function normalizeAssetUrl(storageUrl, assetId, isSystemAsset = false) {
  // ✅ FIX: Check if it's a system asset by URL pattern
  const isSystemAssetByUrl = storageUrl && (
    storageUrl.includes('dawg.b-cdn.net/system-assets') ||
    storageUrl.includes('system-assets/')
  );
  
  const isSystem = isSystemAsset || isSystemAssetByUrl;
  
  if (!storageUrl) {
    // If no storage_url, construct API endpoint from assetId
    return isSystem 
      ? `${apiClient.baseURL}/assets/system/${assetId}/file`
      : `${apiClient.baseURL}/assets/${assetId}/file`;
  }
  
  // If already an API endpoint, return as is
  if (storageUrl.startsWith('/api/') || storageUrl.includes('/api/assets/')) {
    // Make it absolute if it's relative
    if (storageUrl.startsWith('/api/')) {
      return `${apiClient.baseURL}${storageUrl}`;
    }
    return storageUrl;
  }
  
  // ✅ FIX: System assets from CDN -> use backend proxy endpoint
  if (isSystem) {
    return `${apiClient.baseURL}/assets/system/${assetId}/file`;
  }
  
  // If it's a MinIO/CDN URL (e.g., http://localhost:9000/dawg-audio/...), convert to API endpoint
  if (storageUrl.includes('localhost:9000') || storageUrl.includes('dawg-audio')) {
    return `${apiClient.baseURL}/assets/${assetId}/file`;
  }
  
  // Otherwise, assume it's already correct or return API endpoint as fallback
  return storageUrl.startsWith('http') ? storageUrl : `${apiClient.baseURL}/assets/${assetId}/file`;
}

// Bir düğümü ağaç yapısı içinde ID'sine göre bulan yardımcı fonksiyon.
const findNode = (node, nodeId) => {
    if (node.id === nodeId) return node;
    if (node.children) {
        for (const child of node.children) {
            const found = findNode(child, nodeId);
            if (found) return found;
        }
    }
    return null;
};

// Bir düğümü ağaçtan kaldıran yardımcı fonksiyon.
const removeNode = (parent, nodeId) => {
    if (!parent.children) return parent;
    parent.children = parent.children.filter(child => child.id !== nodeId);
    parent.children.forEach(child => removeNode(child, nodeId));
    return parent;
};

/**
 * ✅ DYNAMIC: Load audio manifest
 * This function loads the manifest.json generated at build time
 */
async function loadAudioManifest() {
  try {
    const response = await fetch('/audio-manifest.json');
    if (!response.ok) {
      console.warn('⚠️ Audio manifest not found, using empty structure');
      return null;
    }
    const manifest = await response.json();
    return manifest;
  } catch (error) {
    console.warn('⚠️ Failed to load audio manifest:', error);
    return null;
  }
}

/**
 * ✅ DYNAMIC: Build file tree from manifest, user assets, and system assets
 */
function buildFileTreeFromManifest(manifest, userAssets = [], systemAssets = [], systemPacks = []) {
  const dawgLibraryChildren = [];

  // ✅ FIX: Add static assets from manifest (build-time)
  if (manifest && manifest.directories) {
    for (const dir of manifest.directories) {
      // Create folder for each directory in manifest
      const folderId = `folder-dawg-${dir.path.replace(/\//g, '-')}`;
      // Use directory name, or format path nicely (e.g., "drums", "instruments/piano" -> "Piano")
      let folderName = dir.name;
      if (dir.path.includes('/')) {
        // For nested paths like "instruments/piano", use the last part
        folderName = dir.path.split('/').pop();
        // Capitalize first letter
        folderName = folderName.charAt(0).toUpperCase() + folderName.slice(1);
      } else {
        // Capitalize first letter for single-level directories
        folderName = folderName.charAt(0).toUpperCase() + folderName.slice(1);
      }

      const folderChildren = dir.files.map(file => ({
        id: `file-${file.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
        type: FILE_SYSTEM_TYPES.FILE,
        name: file.name,
        url: file.url,
        readOnly: true
      }));

      dawgLibraryChildren.push({
        id: folderId,
        name: folderName,
        type: FILE_SYSTEM_TYPES.FOLDER,
        children: folderChildren
      });
    }
  }

  // ✅ NEW: Add dynamic system assets from database
  // Use systemPacks to organize assets by pack
  if (systemPacks && systemPacks.length > 0) {
    // Create a map of packId -> pack for quick lookup
    const packMap = new Map();
    systemPacks.forEach(pack => {
      packMap.set(pack.id, pack);
    });

    // Group system assets by pack
    const assetsByPack = {};
    const assetsWithoutPack = [];
    
    if (systemAssets && systemAssets.length > 0) {
      systemAssets.forEach(asset => {
        if (asset.packId && packMap.has(asset.packId)) {
          if (!assetsByPack[asset.packId]) {
            const pack = packMap.get(asset.packId);
            assetsByPack[asset.packId] = {
              packId: asset.packId,
              packName: pack.name || asset.packName,
              assets: []
            };
          }
          assetsByPack[asset.packId].assets.push(asset);
        } else {
          assetsWithoutPack.push(asset);
        }
      });
    }

    // Create folders for packs (in the order they appear in systemPacks)
    systemPacks.forEach(pack => {
      const packAssets = assetsByPack[pack.id]?.assets || [];
      // Only show packs that have assets or are explicitly marked to show
      if (packAssets.length > 0 || pack.isActive) {
        const packFolderId = `folder-pack-${pack.id}`;
        const packFolder = {
          id: packFolderId,
          name: pack.name,
          type: FILE_SYSTEM_TYPES.FOLDER,
          readOnly: true,
          children: packAssets.map(asset => ({
            id: asset.id,
            type: FILE_SYSTEM_TYPES.FILE,
            name: asset.name,
            url: normalizeAssetUrl(asset.storageUrl, asset.id),
            readOnly: true,
            assetId: asset.id,
            bpm: asset.bpm,
            keySignature: asset.keySignature,
            tags: asset.tags,
            isPremium: asset.isPremium
          }))
        };
        dawgLibraryChildren.push(packFolder);
      }
    });

    // Add assets without pack to a default folder
    if (assetsWithoutPack.length > 0) {
      const defaultFolder = {
        id: 'folder-system-default',
        name: 'System Assets',
        type: FILE_SYSTEM_TYPES.FOLDER,
        readOnly: true,
        children: assetsWithoutPack.map(asset => ({
          id: asset.id,
          type: FILE_SYSTEM_TYPES.FILE,
          name: asset.name,
          url: normalizeAssetUrl(asset.storageUrl, asset.id),
          readOnly: true,
          assetId: asset.id,
          bpm: asset.bpm,
          keySignature: asset.keySignature,
          tags: asset.tags,
          isPremium: asset.isPremium
        }))
      };
      dawgLibraryChildren.push(defaultFolder);
    }
  } else if (systemAssets && systemAssets.length > 0) {
    // Fallback: If no packs but we have assets, group by packId from assets
    const assetsByPack = {};
    const assetsWithoutPack = [];
    
    systemAssets.forEach(asset => {
      if (asset.packId && asset.packName) {
        if (!assetsByPack[asset.packId]) {
          assetsByPack[asset.packId] = {
            packId: asset.packId,
            packName: asset.packName,
            assets: []
          };
        }
        assetsByPack[asset.packId].assets.push(asset);
      } else {
        assetsWithoutPack.push(asset);
      }
    });

    // Create folders for packs
    Object.values(assetsByPack).forEach(packData => {
      const packFolderId = `folder-pack-${packData.packId}`;
      const packFolder = {
        id: packFolderId,
        name: packData.packName,
        type: FILE_SYSTEM_TYPES.FOLDER,
        readOnly: true,
        children: packData.assets.map(asset => ({
          id: asset.id,
          type: FILE_SYSTEM_TYPES.FILE,
          name: asset.name,
          url: normalizeAssetUrl(asset.storageUrl, asset.id),
          readOnly: true,
          assetId: asset.id,
          bpm: asset.bpm,
          keySignature: asset.keySignature,
          tags: asset.tags,
          isPremium: asset.isPremium
        }))
      };
      dawgLibraryChildren.push(packFolder);
    });

    // Add assets without pack to a default folder
    if (assetsWithoutPack.length > 0) {
      const defaultFolder = {
        id: 'folder-system-default',
        name: 'System Assets',
        type: FILE_SYSTEM_TYPES.FOLDER,
        readOnly: true,
        children: assetsWithoutPack.map(asset => ({
          id: asset.id,
          type: FILE_SYSTEM_TYPES.FILE,
          name: asset.name,
          url: normalizeAssetUrl(asset.storageUrl, asset.id),
          readOnly: true,
          assetId: asset.id,
          bpm: asset.bpm,
          keySignature: asset.keySignature,
          tags: asset.tags,
          isPremium: asset.isPremium
        }))
      };
      dawgLibraryChildren.push(defaultFolder);
    }
  }

  // ✅ DYNAMIC: Separate folders and files from user assets
  const userFoldersFromDB = userAssets.filter(asset => asset.mime_type === 'folder');
  const userFiles = userAssets.filter(asset => asset.mime_type !== 'folder');
  
  // ✅ DYNAMIC: Organize user files by parent_folder_id
  const filesByParentId = {};
  const rootFiles = [];
  
  userFiles.forEach(asset => {
    if (asset.parent_folder_id) {
      if (!filesByParentId[asset.parent_folder_id]) {
        filesByParentId[asset.parent_folder_id] = [];
      }
      filesByParentId[asset.parent_folder_id].push({
        id: asset.id,
        type: FILE_SYSTEM_TYPES.FILE,
        name: asset.filename,
        url: normalizeAssetUrl(asset.storage_url, asset.id), // ✅ FIX: Normalize URL
        readOnly: false,
        assetId: asset.id,
        folderPath: asset.folder_path,
        parentFolderId: asset.parent_folder_id
      });
    } else {
      // Root level files (no parent folder)
      rootFiles.push({
        id: asset.id,
        type: FILE_SYSTEM_TYPES.FILE,
        name: asset.filename,
        url: normalizeAssetUrl(asset.storage_url, asset.id), // ✅ FIX: Normalize URL
        readOnly: false,
        assetId: asset.id,
        folderPath: asset.folder_path || '/',
        parentFolderId: null
      });
    }
  });

  // ✅ DYNAMIC: Build folder tree structure from DB folders
  const folderMap = new Map(); // id -> folder node
  const rootFolders = [];
  
  // First pass: Create folder nodes
  userFoldersFromDB.forEach(folder => {
    const folderNode = {
      id: folder.id, // ✅ FIX: Use DB ID instead of generated ID
      name: folder.filename,
      type: FILE_SYSTEM_TYPES.FOLDER,
      folderPath: folder.folder_path || '/',
      parentFolderId: folder.parent_folder_id,
      children: filesByParentId[folder.id] || [] // Add files that belong to this folder
    };
    folderMap.set(folder.id, folderNode);
  });
  
  // Second pass: Build hierarchy
  userFoldersFromDB.forEach(folder => {
    const folderNode = folderMap.get(folder.id);
    if (folder.parent_folder_id) {
      // Add to parent folder's children
      const parentFolder = folderMap.get(folder.parent_folder_id);
      if (parentFolder) {
        if (!parentFolder.children) {
          parentFolder.children = [];
        }
        parentFolder.children.push(folderNode);
      } else {
        // Parent not found, add to root
        rootFolders.push(folderNode);
      }
    } else {
      // Root level folder
      rootFolders.push(folderNode);
    }
  });
  
  // ✅ DYNAMIC: Combine root folders and root files
  const userFolderChildren = [...rootFolders, ...rootFiles];

  // ✅ DYNAMIC: Build root children - only add "DAWG Library" if there's content
  const rootChildren = [];
  
  // Only add "DAWG Library" folder if there's actual content (manifest files, packs, or system assets)
  if (dawgLibraryChildren.length > 0 || (manifest && manifest.directories && manifest.directories.length > 0)) {
    rootChildren.push({
      id: 'folder-dawg-library',
      name: 'DAWG Library',
      type: FILE_SYSTEM_TYPES.FOLDER,
      children: dawgLibraryChildren.length > 0 
        ? dawgLibraryChildren 
        : []
    });
  }

  // ✅ FIX: Add user-created root folders (folders with no parent or parent not in DB)
  // These are folders created at root level
  const rootUserFolders = userFolderChildren.filter(item => 
    item.type === FILE_SYSTEM_TYPES.FOLDER && (!item.parentFolderId || item.parentFolderId === null)
  );
  
  // ✅ FIX: Add root user folders to root level (same level as DAWG Library)
  rootChildren.push(...rootUserFolders);

  // ✅ DYNAMIC: Only add "My Samples" folder if there are user files or folders with parent
  const userFilesAndNestedFolders = userFolderChildren.filter(item => 
    item.type === FILE_SYSTEM_TYPES.FILE || 
    (item.type === FILE_SYSTEM_TYPES.FOLDER && item.parentFolderId)
  );
  
  if (userFilesAndNestedFolders.length > 0) {
    rootChildren.push({
      id: 'folder-user-samples',
      name: 'My Samples',
      type: FILE_SYSTEM_TYPES.FOLDER,
      children: userFilesAndNestedFolders
    });
  }

  // ✅ DYNAMIC: "Loops" folder will be added when patterns are exported
  // For now, we don't create it unless there are exported loops

  return {
    id: 'root',
    name: 'Kullanıcı Dosyaları',
    type: FILE_SYSTEM_TYPES.FOLDER,
    children: rootChildren
  };
}

// ✅ DYNAMIC: Initialize with empty tree, will be populated after manifest, user assets, and system assets load
const initialFileTree = buildFileTreeFromManifest(null, [], [], []);

// Sadece ses dosyalarına ve MIDI dosyalarına izin ver.
const ALLOWED_FILE_TYPES = ['audio/', 'video/midi', 'audio/midi'];

export const useFileBrowserStore = create((set, get) => ({
  fileTree: initialFileTree,
  selectedNode: null,
  manifestLoaded: false,
  quota: null,
  userAssetsLoaded: false,
  userAssets: [], // Store user assets for tree building
  
  setSelectedNode: (node) => set({ selectedNode: node }),

  // ✅ DYNAMIC: Load audio manifest and rebuild file tree
  loadAudioManifest: async () => {
    const manifest = await loadAudioManifest();
    const currentUserAssets = get().userAssets || [];
    const currentSystemAssets = get().systemAssets || [];
    const currentSystemPacks = get().systemPacks || [];
    
    // Rebuild tree with manifest, user assets, and system assets
    const newTree = buildFileTreeFromManifest(manifest, currentUserAssets, currentSystemAssets, currentSystemPacks);
    set({ fileTree: newTree, manifestLoaded: true });
    
    if (manifest) {
      console.log('✅ Audio manifest loaded:', manifest.totalFiles, 'files in', manifest.directories.length, 'directories');
    }
  },

  // ✅ NEW: Load system assets from database
  loadSystemAssets: async () => {
    try {
      const response = await apiClient.listSystemAssets({ 
        isActive: true,
        limit: 1000 // Get all active assets
      });
      const assets = response.assets || [];
      
      // Also load packs for organization
      const packsResponse = await apiClient.listSystemPacks({ 
        isActive: true,
        limit: 100 
      });
      const packs = packsResponse.packs || [];
      
      set({ 
        systemAssets: assets,
        systemPacks: packs,
        systemAssetsLoaded: true 
      });
      
      // ✅ DYNAMIC: Rebuild file tree with system assets
      const manifest = await loadAudioManifest().catch(() => null);
      const currentUserAssets = get().userAssets || [];
      const newTree = buildFileTreeFromManifest(manifest, currentUserAssets, assets, packs);
      set({ fileTree: newTree });
      
      console.log(`✅ System assets loaded: ${assets.length} assets, ${packs.length} packs`);
      return { assets, packs };
    } catch (error) {
      // Silently fail if backend is not available
      if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
        console.log('⚠️ Backend not available, skipping system assets load');
        set({ 
          systemAssets: [],
          systemPacks: [],
          systemAssetsLoaded: true 
        });
        return { assets: [], packs: [] };
      }
      console.error('Failed to load system assets:', error);
      return { assets: [], packs: [] };
    }
  },

  // ✅ BACKEND: Load user storage quota
  loadStorageQuota: async () => {
    try {
      const quota = await apiClient.getStorageQuota();
      set({ quota });
      return quota;
    } catch (error) {
      // Silently fail if backend is not available (guest mode or server not running)
      if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
        console.log('⚠️ Backend not available, skipping quota load');
        return null;
      }
      console.error('Failed to load storage quota:', error);
      return null;
    }
  },

  // ✅ BACKEND: Load user assets from server
  loadUserAssets: async (folderPath = '/', parentFolderId = null) => {
    try {
      // Load ALL user assets (not filtered by folder) to build complete tree
      const response = await apiClient.listAssets({ limit: 1000 }); // Get all assets
      const assets = response.assets || [];
      
      set({ 
        userAssets: assets,
        userAssetsLoaded: true 
      });
      
      // ✅ DYNAMIC: Rebuild file tree with user assets, system assets, and manifest
      const manifest = await loadAudioManifest().catch(() => null);
      const currentSystemAssets = get().systemAssets || [];
      const currentSystemPacks = get().systemPacks || [];
      const newTree = buildFileTreeFromManifest(manifest, assets, currentSystemAssets, currentSystemPacks);
      set({ fileTree: newTree });
      
      return assets;
    } catch (error) {
      // Silently fail if backend is not available (guest mode or server not running)
      if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
        console.log('⚠️ Backend not available, skipping user assets load');
        set({ 
          userAssets: [],
          userAssetsLoaded: true 
        }); // Mark as loaded to prevent retries
        return [];
      }
      console.error('Failed to load user assets:', error);
      return [];
    }
  },

  // ✅ BACKEND: Upload file to server
  uploadFile: async (file, folderPath = '/', parentFolderId = null, onProgress = null) => {
    try {
      // Check if user is authenticated
      const { useAuthStore } = await import('@/store/useAuthStore.js');
      const authState = useAuthStore.getState();
      
      if (!authState.isAuthenticated || authState.isGuest) {
        throw new Error('Please log in to upload files');
      }

      // Request upload
      // ✅ FIX: Ensure mimeType is set (fallback to 'audio/wav' if not provided)
      const mimeType = file.type || 'audio/wav';
      if (!mimeType.startsWith('audio/')) {
        console.warn(`⚠️ File ${file.name} has non-audio mime type: ${mimeType}, using 'audio/wav'`);
      }
      
      const uploadRequest = await apiClient.requestUpload({
        filename: file.name,
        size: file.size,
        mimeType: mimeType.startsWith('audio/') ? mimeType : 'audio/wav',
        folderPath,
        parentFolderId: parentFolderId || null, // ✅ FIX: Explicitly set to null if not provided
      });

      // ✅ FIX: Upload file to backend
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResponse = await fetch(`${apiClient.baseURL}/assets/upload/${uploadRequest.assetId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiClient.getToken()}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      // ✅ FIX: Upload endpoint already calls completeUpload, so we just get the result
      const asset = await uploadResponse.json();

      // Reload ALL user assets to rebuild tree
      await get().loadUserAssets();
      
      // Update quota
      await get().loadStorageQuota();

      return asset;
    } catch (error) {
      if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
        throw new Error('Backend server is not available. Please start the server or check your connection.');
      }
      console.error('Failed to upload file:', error);
      throw error;
    }
  },

  // ✅ BACKEND: Delete user asset
  deleteUserAsset: async (assetId) => {
    try {
      await apiClient.deleteAsset(assetId);
      
      // Reload ALL user assets to rebuild tree
      await get().loadUserAssets();
      
      // Update quota
      await get().loadStorageQuota();
    } catch (error) {
      console.error('Failed to delete asset:', error);
      throw error;
    }
  },

  // ✅ BACKEND: Rename user asset
  renameUserAsset: async (assetId, newName) => {
    try {
      await apiClient.renameAsset(assetId, newName);
      
      // Reload ALL user assets to rebuild tree
      await get().loadUserAssets();
    } catch (error) {
      console.error('Failed to rename asset:', error);
      throw error;
    }
  },

  // ✅ BACKEND: Create folder in database
  createFolder: async (parentId = 'root') => {
    try {
      // Check if user is authenticated
      const { useAuthStore } = await import('@/store/useAuthStore.js');
      const authState = useAuthStore.getState();
      
      if (!authState.isAuthenticated || authState.isGuest) {
        throw new Error('Please log in to create folders');
      }

      // ✅ FIX: System folders that should not be used as parent (always add to root level)
      const systemFolders = ['folder-dawg-library', 'folder-user-samples', 'folder-dawg-'];
      const isSystemFolder = systemFolders.some(sysFolder => 
        parentId === sysFolder || parentId.startsWith('folder-dawg-')
      );

      // Determine parent folder ID for backend (null for root/system folders)
      const backendParentId = (parentId === 'root' || isSystemFolder) ? null : parentId;
      
      // Generate unique name
      const state = get();
      const newTree = JSON.parse(JSON.stringify(state.fileTree));
      const rootNode = newTree;
      let newName = 'Yeni Klasör';
      let counter = 2;
      while (rootNode.children.some(child => child.name === newName)) {
        newName = `Yeni Klasör (${counter++})`;
      }

      // ✅ FIX: Create folder in backend
      const folder = await apiClient.createFolder(newName, backendParentId);
      
      // ✅ FIX: Add folder to local tree
      if (parentId === 'root' || isSystemFolder) {
        rootNode.children.push({
          id: folder.id,
          name: folder.name,
          type: FILE_SYSTEM_TYPES.FOLDER,
          children: [],
          folderPath: '/',
          parentFolderId: null,
        });
        console.log(`✅ Created folder "${folder.name}" at root level (DB ID: ${folder.id})`);
      } else {
        // For other parent IDs (user-created folders), find the parent node and add to its children
        const parentNode = findNode(newTree, parentId);
        if (parentNode && parentNode.type === FILE_SYSTEM_TYPES.FOLDER) {
          parentNode.children.push({
            id: folder.id,
            name: folder.name,
            type: FILE_SYSTEM_TYPES.FOLDER,
            children: [],
            folderPath: `/${folder.name}`,
            parentFolderId: folder.parentFolderId,
          });
          console.log(`✅ Created folder "${folder.name}" inside "${parentNode.name}" (DB ID: ${folder.id})`);
        } else {
          console.warn(`⚠️ Parent node not found: ${parentId}, adding to root instead`);
          // Fallback: add to root if parent not found
          rootNode.children.push({
            id: folder.id,
            name: folder.name,
            type: FILE_SYSTEM_TYPES.FOLDER,
            children: [],
            folderPath: '/',
            parentFolderId: null,
          });
        }
      }
      
      set({ fileTree: newTree });
      
      // ✅ FIX: Reload user assets to sync with backend
      await get().loadUserAssets();
      
      return folder;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  },

  deleteNode: async (nodeId) => {
    // ✅ Prevent deletion of root, DAWG Library, and its contents (dynamic check)
    if (nodeId === 'root' || nodeId === 'folder-dawg-library' || nodeId?.startsWith('folder-dawg-')) {
      console.warn('⚠️ Cannot delete DAWG Library or its contents');
      return;
    }
    
    try {
      const nodeToDelete = findNode(get().fileTree, nodeId);
      if (!nodeToDelete) {
        console.warn('⚠️ Node not found:', nodeId);
        return;
      }
      
      // ✅ FIX: Check if it's a read-only system file
      if (nodeToDelete.readOnly) {
        console.warn('⚠️ Cannot delete read-only file');
        return;
      }
      
      // ✅ FIX: Delete from backend based on node type
      if (nodeToDelete.type === FILE_SYSTEM_TYPES.FILE) {
        // Delete file from backend
        await apiClient.deleteAsset(nodeId);
        console.log(`✅ Deleted file: ${nodeToDelete.name}`);
      } else if (nodeToDelete.type === FILE_SYSTEM_TYPES.FOLDER) {
        // Check if folder is empty
        if (nodeToDelete.children && nodeToDelete.children.length > 0) {
          // Check if folder has any non-read-only files
          const hasUserFiles = nodeToDelete.children.some(child => !child.readOnly);
          if (hasUserFiles) {
            throw new Error('Klasör boş değil. Önce içindeki dosyaları silin.');
          }
        }
        
        // Delete folder from backend
        await apiClient.deleteFolder(nodeId);
        console.log(`✅ Deleted folder: ${nodeToDelete.name}`);
      }
      
      // ✅ FIX: Reload user assets to sync with backend
      await get().loadUserAssets();
      
      // ✅ FIX: Update quota after deletion
      await get().loadStorageQuota();
    } catch (error) {
      console.error('Failed to delete node:', error);
      alert(`Silme işlemi başarısız: ${error.message}`);
      throw error;
    }
  },

  renameNode: (nodeId, newName) => {
    // ✅ Prevent renaming of root, DAWG Library, and its contents (dynamic check)
    if (nodeId === 'root' || nodeId === 'folder-dawg-library' || nodeId?.startsWith('folder-dawg-') || !newName?.trim()) {
      console.warn('⚠️ Cannot rename DAWG Library or its contents');
      return;
    }
    set(state => {
      const newTree = JSON.parse(JSON.stringify(state.fileTree));
      const nodeToRename = findNode(newTree, nodeId);
      if (nodeToRename) {
        nodeToRename.name = newName.trim();
      }
      return { fileTree: newTree };
    });
  },

  // ✅ NEW: Move file or folder to another folder
  moveNode: async (nodeId, targetFolderId) => {
    try {
      // Check if user is authenticated
      const { useAuthStore } = await import('@/store/useAuthStore.js');
      const authState = useAuthStore.getState();
      
      if (!authState.isAuthenticated || authState.isGuest) {
        throw new Error('Please log in to move files');
      }

      const state = get();
      const nodeToMove = findNode(state.fileTree, nodeId);
      if (!nodeToMove) {
        throw new Error('Node not found');
      }

      // ✅ Prevent moving system files/folders
      if (nodeToMove.readOnly || 
          nodeId === 'root' || 
          nodeId === 'folder-dawg-library' || 
          nodeId?.startsWith('folder-dawg-') ||
          nodeId === 'folder-user-samples') {
        throw new Error('Cannot move system files or folders');
      }

      // ✅ Prevent moving to system folders
      if (targetFolderId === 'folder-dawg-library' || 
          targetFolderId?.startsWith('folder-dawg-') ||
          targetFolderId === 'folder-user-samples') {
        throw new Error('Cannot move files to system folders');
      }

      // ✅ Prevent moving folder into itself or its children
      if (nodeToMove.type === FILE_SYSTEM_TYPES.FOLDER) {
        const isDescendant = (parentId, childId) => {
          const parent = findNode(state.fileTree, parentId);
          if (!parent || !parent.children) return false;
          for (const child of parent.children) {
            if (child.id === childId) return true;
            if (child.type === FILE_SYSTEM_TYPES.FOLDER && isDescendant(child.id, childId)) {
              return true;
            }
          }
          return false;
        };
        if (targetFolderId === nodeId || isDescendant(nodeId, targetFolderId)) {
          throw new Error('Cannot move folder into itself or its children');
        }
      }

      // Determine target folder path and parent ID
      let targetFolderPath = '/';
      let targetParentFolderId = null;

      if (targetFolderId === 'root') {
        targetFolderPath = '/';
        targetParentFolderId = null;
      } else {
        const targetFolder = findNode(state.fileTree, targetFolderId);
        if (!targetFolder || targetFolder.type !== FILE_SYSTEM_TYPES.FOLDER) {
          throw new Error('Target must be a folder');
        }
        targetFolderPath = targetFolder.folderPath || '/';
        // If target is a user-created folder (has UUID), use its ID as parent
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(targetFolderId)) {
          targetParentFolderId = targetFolderId;
        }
      }

      // Move file or folder via backend
      if (nodeToMove.type === FILE_SYSTEM_TYPES.FILE) {
        // Move file
        await apiClient.moveAsset(nodeId, targetFolderPath, targetParentFolderId);
        console.log(`✅ Moved file "${nodeToMove.name}" to folder`);
      } else if (nodeToMove.type === FILE_SYSTEM_TYPES.FOLDER) {
        // For folders, we need to move all files inside
        // For now, we'll just update the folder's parent in the tree
        // Backend should handle folder moves if we add that endpoint
        throw new Error('Moving folders is not yet supported. Please move files individually.');
      }

      // ✅ Reload user assets to sync with backend
      await get().loadUserAssets();

      return true;
    } catch (error) {
      console.error('Failed to move node:', error);
      throw error;
    }
  },

  uploadFiles: (parentId, files) => {
    const validFiles = Array.from(files).filter(file =>
      ALLOWED_FILE_TYPES.some(type => file.type.startsWith(type))
    );
    if (validFiles.length === 0) return;

    set(state => {
      const newTree = JSON.parse(JSON.stringify(state.fileTree));
      const parentNode = findNode(newTree, parentId);

      if (parentNode && parentNode.type === FILE_SYSTEM_TYPES.FOLDER) {
        validFiles.forEach(file => {
          // Aynı isimde bir dosya zaten var mı diye kontrol et.
          if (!parentNode.children.some(child => child.name === file.name)) {
            parentNode.children.push({
              id: uuidv4(),
              name: file.name,
              type: FILE_SYSTEM_TYPES.FILE,
              // Tarayıcının hafızasında geçici bir URL oluştur.
              url: URL.createObjectURL(file),
            });
          }
        });
      }
      return { fileTree: newTree };
    });
  },

  // ✅ NEW: Add frozen/bounced samples to File Browser
  addFrozenSample: (sampleData) => {
    set(state => {
      const newTree = JSON.parse(JSON.stringify(state.fileTree));

      // Find or create "Loops" folder
      let loopsFolder = findNode(newTree, 'folder-loops');

      if (!loopsFolder) {
        // If Loops folder doesn't exist, create it
        newTree.children.push({
          id: 'folder-loops',
          name: 'Loops',
          type: FILE_SYSTEM_TYPES.FOLDER,
          children: []
        });
        loopsFolder = newTree.children[newTree.children.length - 1];
      }

      // Check if sample already exists
      if (!loopsFolder.children.some(child => child.id === sampleData.id)) {
        loopsFolder.children.push({
          id: sampleData.id,
          name: sampleData.name,
          type: FILE_SYSTEM_TYPES.FILE,
          url: sampleData.url,
          frozen: true,
          originalPattern: sampleData.originalPattern
        });
        console.log(`📁 Added frozen sample to Loops: ${sampleData.name}`);
      }

      return { fileTree: newTree };
    });
  },
}));
