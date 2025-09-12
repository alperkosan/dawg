/**
 * @file useFileBrowserStore.js
 * @description Bu store, Dosya Tarayıcısı (File Browser) panelindeki tüm dosya ve
 * klasör yapısını yönetir. Klasör oluşturma, dosya/klasör silme, yeniden adlandırma
 * ve dosya yükleme gibi dosya sistemi işlemlerini içerir.
 * Ana AudioEngine ile bir bağlantısı yoktur.
 */
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

// --- Yardımcı Fonksiyonlar ---
// Bu fonksiyonlar state'e doğrudan erişmediği için store dışında tanımlanabilir.

/**
 * Ağaç yapısı içindeki belirli bir düğümü (node) ID'sine göre bulur.
 * @param {object} node - Aramanın başlayacağı kök düğüm.
 * @param {string} nodeId - Aranan düğümün ID'si.
 * @returns {object|null} - Bulunan düğüm veya bulunamazsa null.
 */
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

/**
 * Ağaç yapısından bir düğümü ID'sine göre kaldırır (özyineli olarak).
 * @param {object} parent - Düğümün aranacağı üst düğüm.
 * @param {string} nodeId - Kaldırılacak düğümün ID'si.
 * @returns {object} - Düğüm kaldırılmış yeni üst düğüm.
 */
const removeNode = (parent, nodeId) => {
    if (!parent.children) return parent;
    parent.children = parent.children.filter(child => child.id !== nodeId);
    parent.children.forEach(child => removeNode(child, nodeId));
    return parent;
};

// Dosya ağacının başlangıçtaki varsayılan yapısı.
const initialFileTree = {
    id: 'root',
    name: 'Kullanıcı Dosyaları',
    type: 'folder',
    children: [
        {
            id: 'folder-1',
            name: 'Samples',
            type: 'folder',
            children: [
                { id: 'file-1', type: 'file', name: 'kick.wav', url: '/audio/kick.wav' },
                { id: 'file-2', type: 'file', name: 'snare.wav', url: '/audio/snare.wav' },
            ],
        },
    ],
};

// Yüklenmesine izin verilen dosya türleri.
const ALLOWED_FILE_TYPES = ['audio/', 'video/midi', 'audio/midi'];

export const useFileBrowserStore = create((set) => ({
  // --- STATE ---
  
  /** @type {object} - Dosya ve klasörlerin hiyerarşik yapısını tutan nesne. */
  fileTree: initialFileTree,
  
  /** @type {object|null} - Dosya tarayıcısında o an seçili olan dosya veya klasör. */
  selectedNode: null,


  // --- ACTIONS ---
  
  /** Seçili olan düğümü ayarlar. */
  setSelectedNode: (node) => set({ selectedNode: node }),

  /**
   * Yeni bir klasör oluşturur.
   * @param {string} [parentId='root'] - Yeni klasörün oluşturulacağı üst klasörün ID'si.
   */
  createFolder: (parentId = 'root') => {
    set(state => {
      // State'in değişmezliğini (immutability) korumak için ağacın derin bir kopyasını oluştur.
      const newTree = JSON.parse(JSON.stringify(state.fileTree));
      const parentNode = findNode(newTree, parentId);

      if (parentNode && parentNode.type === 'folder') {
        let newName = 'Yeni Klasör';
        let counter = 2;
        // Aynı isimde başka bir klasör varsa, ismin sonuna bir sayı ekle.
        while (parentNode.children.some(child => child.name === newName)) {
          newName = `Yeni Klasör (${counter++})`;
        }
        parentNode.children.push({
          id: uuidv4(),
          name: newName,
          type: 'folder',
          children: [],
        });
      }
      return { fileTree: newTree };
    });
  },

  /**
   * Bir dosya veya klasörü siler.
   * @param {string} nodeId - Silinecek düğümün ID'si.
   */
  deleteNode: (nodeId) => {
    if (nodeId === 'root') return; // Ana klasör silinemez.
    set(state => {
      let newTree = JSON.parse(JSON.stringify(state.fileTree));
      newTree = removeNode(newTree, nodeId);
      return { fileTree: newTree };
    });
  },

  /**
   * Bir dosya veya klasörü yeniden adlandırır.
   * @param {string} nodeId - Yeniden adlandırılacak düğümün ID'si.
   * @param {string} newName - Yeni ad.
   */
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

  /**
   * Kullanıcının bilgisayarından seçtiği dosyaları belirtilen klasöre yükler.
   * @param {string} parentId - Dosyaların yükleneceği klasörün ID'si.
   * @param {FileList} files - Yüklenecek dosyaların listesi.
   */
  uploadFiles: (parentId, files) => {
    // Sadece izin verilen dosya türlerini filtrele.
    const validFiles = Array.from(files).filter(file =>
      ALLOWED_FILE_TYPES.some(type => file.type.startsWith(type))
    );
    if (validFiles.length === 0) return;

    set(state => {
      const newTree = JSON.parse(JSON.stringify(state.fileTree));
      const parentNode = findNode(newTree, parentId);

      if (parentNode && parentNode.type === 'folder') {
        validFiles.forEach(file => {
          parentNode.children.push({
            id: uuidv4(),
            name: file.name,
            type: 'file',
            // Yüklenen dosya için tarayıcıda geçici bir URL oluştur.
            url: URL.createObjectURL(file),
          });
        });
      }
      return { fileTree: newTree };
    });
  },
}));
