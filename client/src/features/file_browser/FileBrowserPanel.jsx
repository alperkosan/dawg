import React, { useRef, useEffect, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { FileTreeNode } from './FileTreeNode';
import ChannelContextMenu from '../../components/ChannelContextMenu';
import { FileBrowserPreview } from './FileBrowserPreview';
import { useFileBrowserStore } from '../../store/useFileBrowserStore';
import { usePreviewPlayerStore } from '../../store/usePreviewPlayerStore';

export default function FileBrowserPanel() {
    const { fileTree, selectedNode, setSelectedNode, createFolder, deleteNode, renameNode, uploadFiles } = useFileBrowserStore();
    const selectFileForPreview = usePreviewPlayerStore(state => state.selectFileForPreview);
    const [contextMenu, setContextMenu] = useState(null);
    const fileInputRef = useRef(null);
    
    useEffect(() => {
        if (selectedNode && selectedNode.type === 'file') {
            selectFileForPreview(selectedNode.url);
        } else {
            selectFileForPreview(null);
        }
    }, [selectedNode, selectFileForPreview]);

    const handleNodeClick = (node) => setSelectedNode(node);
    const handleContextMenu = (event, node) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedNode(node);
        setContextMenu({ x: event.clientX, y: event.clientY });
    };

    const handleFileUpload = (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            const parentId = selectedNode?.type === 'folder' ? selectedNode.id : 'root';
            uploadFiles(parentId, files);
        }
        event.target.value = null;
    };

    // Dinamik Stiller
    const panelStyle = {
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        padding: 'var(--padding-container)',
    };
    
    const headerStyle = {
        color: 'var(--color-muted)',
        fontSize: 'var(--font-size-label)',
        paddingBottom: 'var(--padding-container)',
        borderBottom: '1px solid var(--color-border)'
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
        <aside className="h-full w-64 shrink-0 flex flex-col" style={panelStyle}>
            <div className="flex items-center justify-between" style={headerStyle}>
                <h2 className="font-bold uppercase tracking-wider">Dosya Tarayıcı</h2>
                <div className="flex items-center" style={{ gap: 'var(--gap-controls)'}}>
                    <button onClick={() => createFolder(selectedNode?.type === 'folder' ? selectedNode.id : 'root')} title="Yeni Klasör Ekle">
                        <Plus size={16} />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} title="Dosya Yükle">
                        <Upload size={16} />
                    </button>
                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="audio/*,.mid,.midi" />
                </div>
            </div>

            <div className="flex-grow overflow-y-auto" style={{ marginBlock: 'var(--gap-container)'}}>
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
                    onClose={() => setContextMenu(null)}
                />
            )}
        </aside>
    );
}
