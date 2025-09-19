import React, { useRef, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { FileTreeNode } from './FileTreeNode';
import ChannelContextMenu from '../../components/ChannelContextMenu';
import { FileBrowserPreview } from './FileBrowserPreview';
import { useFileBrowserStore } from '../../store/useFileBrowserStore';

export default function FileBrowserPanel() {
    const { 
        fileTree, 
        selectedNode, 
        setSelectedNode, 
        createFolder, 
        deleteNode, 
        renameNode, 
        uploadFiles 
    } = useFileBrowserStore();
    
    const [contextMenu, setContextMenu] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false); // Sürükleme efekti için state
    const fileInputRef = useRef(null);

    const handleContextMenu = (event, node) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedNode(node);
        setContextMenu({ x: event.clientX, y: event.clientY, node });
    };

    const handleFileUpload = (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            const parentId = selectedNode?.type === 'folder' ? selectedNode.id : 'root';
            uploadFiles(parentId, files);
        }
        event.target.value = null; // Aynı dosyayı tekrar yükleyebilmek için
    };

    const triggerFileUpload = () => fileInputRef.current?.click();

    // --- Sürükle-Bırak Fonksiyonları ---
    const handleDragOver = (e) => {
        e.preventDefault(); // Bırakma işlemine izin vermek için gerekli
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        setIsDragOver(true);
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
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const parentId = selectedNode?.type === 'folder' ? selectedNode.id : 'root';
            uploadFiles(parentId, files);
        }
    };

    const getContextMenuOptions = () => {
        if (!contextMenu?.node) return [];
        const { node } = contextMenu;
        let options = [];

        if (node.type === 'folder') {
            options.push({ label: 'New Folder', action: () => createFolder(node.id) });
            options.push({ label: 'Upload File(s)', action: triggerFileUpload });
        }

        if (node.id !== 'root') {
            options.push({ type: 'separator' });
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
                    <Upload size={48} className="text-cyan-400" />
                    <p className="mt-4 text-lg font-semibold text-white">Dosyaları yüklemek için buraya bırakın</p>
                </div>
            )}
            <header className="file-browser__header">
                <h2 className="file-browser__title">Library</h2>
                <div className="file-browser__actions">
                    <button onClick={() => createFolder(selectedNode?.type === 'folder' ? selectedNode.id : 'root')} title="New Folder" className="file-browser__action-btn">
                        <Plus size={16} />
                    </button>
                    <button onClick={triggerFileUpload} title="Upload Files" className="file-browser__action-btn">
                        <Upload size={16} />
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

