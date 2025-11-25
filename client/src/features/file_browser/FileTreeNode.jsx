import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { Folder, FileAudio, ChevronRight, Loader2, Play, Pause } from 'lucide-react';
import { usePreviewPlayerStore } from '@/store/usePreviewPlayerStore';
import { useFileBrowserStore } from '@/store/useFileBrowserStore';
import { DND_TYPES, FILE_SYSTEM_TYPES } from '@/config/constants'; // GÜNCELLENDİ

const DraggableFileNode = ({ node, onContextMenu, children }) => {
    const [isDragging, setIsDragging] = React.useState(false);

    // Use native HTML5 drag for compatibility with both React DND and native drop zones
    const handleDragStart = (e) => {
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'copy'; // ✅ FIX: Use 'copy' for dragging to channel rack (read-only files can be copied)
        e.dataTransfer.setData('application/x-dawg-file-node', JSON.stringify({
            nodeId: node.id,
            nodeType: node.type,
            name: node.name,
            url: node.url,
            assetId: node.assetId, // ✅ Include assetId for system assets
            readOnly: node.readOnly // ✅ Include readOnly flag
        }));
        // Also set text/plain for backward compatibility (channel rack uses this)
        e.dataTransfer.setData('text/plain', JSON.stringify({
            name: node.name,
            url: node.url,
            assetId: node.assetId, // ✅ Include assetId for system assets
            readOnly: node.readOnly // ✅ Include readOnly flag
        }));
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    // ✅ FIX: Allow dragging all files (including system assets) to channel rack
    // readOnly only prevents moving files within file browser, not dragging to channel rack
    const isDraggable = node.type === FILE_SYSTEM_TYPES.FILE; // All files can be dragged

    return (
        <div
            onContextMenu={(e) => onContextMenu(e, node)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            draggable={isDraggable} // ✅ FIX: Allow dragging all files (system assets too)
            style={{ opacity: isDragging ? 0.5 : 1, cursor: isDraggable ? 'grab' : 'default' }}
        >
            {children}
        </div>
    );
};

export function FileTreeNode({ node, onContextMenu, onNodeClick, selectedNode, depth = 0 }) {
    const [isOpen, setIsOpen] = useState(true);
    const [isDragOver, setIsDragOver] = useState(false);
    const isSelected = selectedNode?.id === node.id;

    // ✅ FIX: Get player state for UI feedback (individual selectors to avoid infinite loop)
    const playPreview = usePreviewPlayerStore(state => state.playPreview);
    const loadingUrl = usePreviewPlayerStore(state => state.loadingUrl);
    const playingUrl = usePreviewPlayerStore(state => state.playingUrl);
    const isPlaying = usePreviewPlayerStore(state => state.isPlaying);

    const moveNode = useFileBrowserStore(state => state.moveNode);

    const isLoading = loadingUrl === node.url;
    const isPlayingNode = isPlaying && playingUrl === node.url;

    const handleNodeClick = (e) => {
        e.stopPropagation();
        onNodeClick(node);
        if (node.type === FILE_SYSTEM_TYPES.FOLDER) { // GÜNCELLENDİ
            setIsOpen(!isOpen);
        } else if (node.type === FILE_SYSTEM_TYPES.FILE) { // GÜNCELLENDİ
            playPreview(node.url);
        }
    };

    // ✅ NEW: Handle drag over for drop zones
    const handleDragOver = (e) => {
        if (node.type === FILE_SYSTEM_TYPES.FOLDER &&
            !node.readOnly &&
            node.id !== 'folder-dawg-library' &&
            !node.id?.startsWith('folder-dawg-') &&
            node.id !== 'folder-user-samples') {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsDragOver(false);
        }
    };

    // ✅ NEW: Handle drop
    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        try {
            const dragData = e.dataTransfer.getData('application/x-dawg-file-node');
            if (!dragData) return;

            const draggedNode = JSON.parse(dragData);

            // Don't allow dropping on itself
            if (draggedNode.nodeId === node.id) return;

            // Only allow dropping files into folders
            if (node.type === FILE_SYSTEM_TYPES.FOLDER &&
                !node.readOnly &&
                node.id !== 'folder-dawg-library' &&
                !node.id?.startsWith('folder-dawg-') &&
                node.id !== 'folder-user-samples') {
                await moveNode(draggedNode.nodeId, node.id);
            }
        } catch (error) {
            console.error('Failed to move file:', error);
            const { apiClient } = await import('@/services/api.js');
            apiClient.showToast(`Failed to move file: ${error.message}`, 'error', 5000);
        }
    };

    const isFolder = node.type === FILE_SYSTEM_TYPES.FOLDER; // GÜNCELLENDİ
    const isFile = node.type === FILE_SYSTEM_TYPES.FILE; // GÜNCELLENDİ
    const indentStyle = { paddingLeft: `${depth * 16}px` };

    // ✅ Check if folder can accept drops (user-created folders only)
    const canAcceptDrop = isFolder &&
        !node.readOnly &&
        node.id !== 'folder-dawg-library' &&
        !node.id?.startsWith('folder-dawg-') &&
        node.id !== 'folder-user-samples';

    const nodeClasses = `file-node ${isSelected ? 'file-node--selected' : ''} ${isDragOver ? 'file-node--drag-over' : ''} ${canAcceptDrop ? 'file-node--drop-zone' : ''}`;
    const togglerClasses = `file-node__toggler ${isOpen ? 'file-node__toggler--open' : ''}`;
    const iconClass = isFolder ? 'file-node__icon--folder' : 'file-node__icon--file';

    const nodeContent = (
        <div
            style={indentStyle}
            className={nodeClasses}
            onClick={handleNodeClick}
            onContextMenu={(e) => onContextMenu(e, node)}
            onDragOver={canAcceptDrop ? handleDragOver : undefined}
            onDragLeave={canAcceptDrop ? handleDragLeave : undefined}
            onDrop={canAcceptDrop ? handleDrop : undefined}
        >
            <div className={togglerClasses}>
                {isFolder && <ChevronRight size={16} />}
            </div>
            <div className={`file-node__icon ${iconClass}`}>
                {isFolder ? (
                    <Folder size={16} />
                ) : (
                    isLoading ? (
                        <Loader2 size={16} className="animate-spin text-blue-500" />
                    ) : isPlayingNode ? (
                        <Pause size={16} className="text-green-500" />
                    ) : (
                        <FileAudio size={16} />
                    )
                )}
            </div>
            <span className={`file-node__name ${isPlayingNode ? 'text-green-500 font-medium' : ''} ${isLoading ? 'text-blue-500' : ''}`}>
                {node.name}
                {isLoading && <span className="ml-2 text-xs opacity-70">(Yükleniyor...)</span>}
            </span>
        </div>
    );

    if (isFolder) {
        return (
            <div>
                {nodeContent}
                {isOpen && node.children && (
                    <div className="file-node__children">
                        {node.children.map(child => (
                            <FileTreeNode
                                key={child.id}
                                node={child}
                                onContextMenu={onContextMenu}
                                onNodeClick={onNodeClick}
                                selectedNode={selectedNode}
                                depth={depth + 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return isFile ? <DraggableFileNode node={node} onContextMenu={onContextMenu}>{nodeContent}</DraggableFileNode> : nodeContent;
}
