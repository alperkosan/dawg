import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { FILE_SYSTEM_TYPES } from '../config/constants'; // GÜNCELLENDİ

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

const removeNode = (parent, nodeId) => {
    if (!parent.children) return parent;
    parent.children = parent.children.filter(child => child.id !== nodeId);
    parent.children.forEach(child => removeNode(child, nodeId));
    return parent;
};

const initialFileTree = {
    id: 'root',
    name: 'Kullanıcı Dosyaları',
    type: FILE_SYSTEM_TYPES.FOLDER, // GÜNCELLENDİ
    children: [
        {
            id: 'folder-1',
            name: 'Samples',
            type: FILE_SYSTEM_TYPES.FOLDER, // GÜNCELLENDİ
            children: [
                { id: 'file-1', type: FILE_SYSTEM_TYPES.FILE, name: 'kick.wav', url: '/audio/kick.wav' }, // GÜNCELLENDİ
                { id: 'file-2', type: FILE_SYSTEM_TYPES.FILE, name: 'snare.wav', url: '/audio/snare.wav' }, // GÜNCELLENDİ
            ],
        },
    ],
};

const ALLOWED_FILE_TYPES = ['audio/', 'video/midi', 'audio/midi'];

export const useFileBrowserStore = create((set) => ({
  fileTree: initialFileTree,
  selectedNode: null,
  
  setSelectedNode: (node) => set({ selectedNode: node }),

  createFolder: (parentId = 'root') => {
    set(state => {
      const newTree = JSON.parse(JSON.stringify(state.fileTree));
      const parentNode = findNode(newTree, parentId);

      if (parentNode && parentNode.type === FILE_SYSTEM_TYPES.FOLDER) { // GÜNCELLENDİ
        let newName = 'Yeni Klasör';
        let counter = 2;
        while (parentNode.children.some(child => child.name === newName)) {
          newName = `Yeni Klasör (${counter++})`;
        }
        parentNode.children.push({
          id: uuidv4(),
          name: newName,
          type: FILE_SYSTEM_TYPES.FOLDER, // GÜNCELLENDİ
          children: [],
        });
      }
      return { fileTree: newTree };
    });
  },

  deleteNode: (nodeId) => {
    if (nodeId === 'root') return;
    set(state => {
      let newTree = JSON.parse(JSON.stringify(state.fileTree));
      newTree = removeNode(newTree, nodeId);
      return { fileTree: newTree };
    });
  },

  renameNode: (nodeId, newName) => {
    if (nodeId === 'root' || !newName?.trim()) return;
    set(state => {
      const newTree = JSON.parse(JSON.stringify(state.fileTree));
      const nodeToRename = findNode(newTree, nodeId);
      if (nodeToRename) {
        nodeToRename.name = newName.trim();
      }
      return { fileTree: newTree };
    });
  },

  uploadFiles: (parentId, files) => {
    const validFiles = Array.from(files).filter(file =>
      ALLOWED_FILE_TYPES.some(type => file.type.startsWith(type))
    );
    if (validFiles.length === 0) return;

    set(state => {
      const newTree = JSON.parse(JSON.stringify(state.fileTree));
      const parentNode = findNode(newTree, parentId);

      if (parentNode && parentNode.type === FILE_SYSTEM_TYPES.FOLDER) { // GÜNCELLENDİ
        validFiles.forEach(file => {
          parentNode.children.push({
            id: uuidv4(),
            name: file.name,
            type: FILE_SYSTEM_TYPES.FILE, // GÜNCELLENDİ
            url: URL.createObjectURL(file),
          });
        });
      }
      return { fileTree: newTree };
    });
  },
}));
