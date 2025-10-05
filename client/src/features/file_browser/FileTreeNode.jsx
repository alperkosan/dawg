import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { Folder, FileAudio, ChevronRight } from 'lucide-react';
import { usePreviewPlayerStore } from '@/store/usePreviewPlayerStore';
import { DND_TYPES, FILE_SYSTEM_TYPES } from '@/config/constants'; // GÜNCELLENDİ

const DraggableFileNode = ({ node, onContextMenu, children }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: DND_TYPES.SOUND_SOURCE, // GÜNCELLENDİ
        item: { name: node.name, url: node.url },
        collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
    }), [node.name, node.url]);

    return (
        <div ref={drag} onContextMenu={(e) => onContextMenu(e, node)} style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}>
            {children}
        </div>
    );
};

export function FileTreeNode({ node, onContextMenu, onNodeClick, selectedNode, depth = 0 }) {
    const [isOpen, setIsOpen] = useState(true);
    const isSelected = selectedNode?.id === node.id;
    const playPreview = usePreviewPlayerStore(state => state.playPreview);

    const handleNodeClick = (e) => {
        e.stopPropagation();
        onNodeClick(node);
        if (node.type === FILE_SYSTEM_TYPES.FOLDER) { // GÜNCELLENDİ
            setIsOpen(!isOpen);
        } else if (node.type === FILE_SYSTEM_TYPES.FILE) { // GÜNCELLENDİ
            playPreview(node.url);
        }
    };
    
    const isFolder = node.type === FILE_SYSTEM_TYPES.FOLDER; // GÜNCELLENDİ
    const isFile = node.type === FILE_SYSTEM_TYPES.FILE; // GÜNCELLENDİ
    const indentStyle = { paddingLeft: `${depth * 16}px` };

    const nodeClasses = `file-node ${isSelected ? 'file-node--selected' : ''}`;
    const togglerClasses = `file-node__toggler ${isOpen ? 'file-node__toggler--open' : ''}`;
    const iconClass = isFolder ? 'file-node__icon--folder' : 'file-node__icon--file';

    const nodeContent = (
        <div style={indentStyle} className={nodeClasses} onClick={handleNodeClick} onContextMenu={(e) => onContextMenu(e, node)}>
            <div className={togglerClasses}>
                {isFolder && <ChevronRight size={16} />}
            </div>
            <div className={`file-node__icon ${iconClass}`}>
                {isFolder ? <Folder size={16} /> : <FileAudio size={16} />}
            </div>
            <span className="file-node__name">{node.name}</span>
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
