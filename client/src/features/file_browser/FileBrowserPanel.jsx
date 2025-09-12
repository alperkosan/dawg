import React, { useRef, useEffect } from 'react';
import { Plus, Upload } from 'lucide-react';
import { FileTreeNode } from './FileTreeNode';
import ChannelContextMenu from '../../components/ChannelContextMenu';
import { FileBrowserPreview } from './FileBrowserPreview';
import { useFileBrowserStore } from '../../store/useFileBrowserStore';
import { usePreviewPlayerStore } from '../../store/usePreviewPlayerStore'; // Önizleme store'unu da import et

export default function FileBrowserPanel() {
    const { fileTree, selectedNode, setSelectedNode, createFolder, deleteNode, renameNode, uploadFiles } = useFileBrowserStore();

    // --- YENİ MİMARİ: Eylemi buradan çağıracağız ---
    const selectFileForPreview = usePreviewPlayerStore(state => state.selectFileForPreview);

    const [contextMenu, setContextMenu] = React.useState(null);
    const fileInputRef = useRef(null);
    
    // --- YENİ MİMARİ: Sorumluluğu üstlenen useEffect ---
    // Bu paneldeki seçili dosya (selectedNode) değiştiğinde,
    // Preview Store'a "yeni bir dosya seçildi, dalga formunu yükle" komutunu gönder.
    useEffect(() => {
        if (selectedNode && selectedNode.type === 'file') {
            selectFileForPreview(selectedNode.url);
        } else {
            selectFileForPreview(null); // Klasör seçilirse önizlemeyi temizle
        }
    }, [selectedNode, selectFileForPreview]);


    const handleNodeClick = (node) => {
        setSelectedNode(node);
    };

    const handleContextMenu = (event, node) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedNode(node);
        setContextMenu({ x: event.clientX, y: event.clientY });
    };


    const handleCloseContextMenu = () => setContextMenu(null);

    const handleFileUpload = (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            const parentId = selectedNode?.type === 'folder' ? selectedNode.id : 'root';
            uploadFiles(parentId, files);
        }
        event.target.value = null;
    };

    const triggerFileUpload = () => fileInputRef.current?.click();

    const getContextMenuOptions = () => {
        if (!selectedNode) return [];
        const node = selectedNode;
        let options = [];

        if (node.type === 'folder') {
            options.push({ label: 'Yeni Klasör', action: () => createFolder(node.id) });
            options.push({ label: 'Dosya Yükle', action: triggerFileUpload });
        }

        if (node.id !== 'root') {
            options.push({
                label: 'Yeniden Adlandır',
                action: () => {
                    const newName = prompt('Yeni adı girin:', node.name);
                    if (newName) renameNode(node.id, newName);
                },
            });
            options.push({
                label: 'Sil',
                action: () => {
                    if (window.confirm(`'${node.name}' silinecek. Emin misiniz?`)) {
                        deleteNode(node.id);
                    }
                },
            });
        }
        return options;
    };

    return (
        <aside className="h-full w-64 bg-gray-800 border-r border-gray-700 p-2 shrink-0 flex flex-col">
            <div className="flex items-center justify-between px-2 mb-2">
                <h2 className="text-sm font-bold text-gray-400">Dosya Tarayıcı</h2>
                <div className="flex items-center gap-1">
                    <button onClick={() => createFolder(selectedNode?.type === 'folder' ? selectedNode.id : 'root')} className="p-1 hover:bg-gray-700 rounded" title="Yeni Klasör Ekle">
                        <Plus size={16} />
                    </button>
                    <button onClick={triggerFileUpload} className="p-1 hover:bg-gray-700 rounded" title="Dosya Yükle">
                        <Upload size={16} />
                    </button>
                    <input
                        type="file" multiple ref={fileInputRef} className="hidden"
                        onChange={handleFileUpload} accept="audio/*,.mid,.midi"
                    />
                </div>
            </div>

            <div className="flex-grow overflow-y-auto" onContextMenu={(e) => handleContextMenu(e, fileTree)}>
                {fileTree.children.map(node => (
                    <FileTreeNode
                        key={node.id}
                        node={node}
                        onContextMenu={handleContextMenu}
                        onNodeClick={handleNodeClick}
                        isSelected={selectedNode?.id === node.id}
                    />
                ))}
            </div>

            <FileBrowserPreview fileNode={selectedNode} />

            {contextMenu && (
                <ChannelContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    options={getContextMenuOptions()}
                    onClose={handleCloseContextMenu}
                />
            )}
        </aside>
    );
}