import React from 'react';
import { useDrag } from 'react-dnd';
import { Folder, FileAudio, ChevronRight, ChevronDown } from 'lucide-react';
import { usePreviewPlayerStore } from '../../store/usePreviewPlayerStore'; // Preview store'u kullan

const ItemTypes = { SOUND_SOURCE: 'soundSource' };

const DraggableFileNode = ({ node, onContextMenu, children }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.SOUND_SOURCE,
        item: { name: node.name, url: node.url },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }), [node.name, node.url]);

    return (
        <div
            ref={drag}
            onContextMenu={(e) => onContextMenu(e, node)}
            className={`flex items-center gap-2 p-1 rounded hover:bg-gray-700 cursor-grab text-sm ${isDragging ? 'opacity-50' : ''}`}
        >
            {children}
        </div>
    );
};

export function FileTreeNode({ node, onContextMenu, onNodeClick, isSelected }) {
    const [isOpen, setIsOpen] = React.useState(true);
    // playPreview eylemini doğrudan store'dan alıyoruz
    const playPreview = usePreviewPlayerStore(state => state.playPreview);

    const handleFileClick = (event, fileNode) => {
        event.stopPropagation();
        onNodeClick(fileNode);
        const duration = event.altKey ? undefined : 1.5;
        playPreview(fileNode.url, duration);
    };

    if (node.type === 'folder') {
        // ... folder render mantığı aynı, değişiklik yok
        const folderClasses = `flex items-center gap-2 p-1 rounded cursor-pointer text-sm ${isSelected ? 'bg-cyan-800' : 'hover:bg-gray-700'}`;
        
        return (
            <div className="pl-4">
                <div 
                    onContextMenu={(e) => onContextMenu(e, node)}
                    onClick={(e) => { e.stopPropagation(); onNodeClick(node); setIsOpen(!isOpen); }}
                    className={folderClasses}
                >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <Folder className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold select-none">{node.name}</span>
                </div>
                {isOpen && node.children && (
                    <div>
                        {node.children.map(child => (
                            <FileTreeNode 
                                key={child.id} 
                                node={child} 
                                onContextMenu={onContextMenu}
                                onNodeClick={onNodeClick}
                                isSelected={isSelected && child.id === isSelected.id}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }
    
    // ... dosya render mantığı da büyük ölçüde aynı
    const fileClasses = `flex items-center gap-2 p-1 rounded text-sm ${isSelected ? 'bg-cyan-800' : 'hover:bg-gray-700'}`;
    const isAudio = node.name.match(/\.(wav|mp3|ogg|flac)$/i) || node.url.startsWith('blob:');

    if (isAudio) {
        return (
            <div className="pl-4">
                <DraggableFileNode node={node} onContextMenu={onContextMenu}>
                    <div className={fileClasses} onClick={(e) => handleFileClick(e, node)}>
                         <FileAudio className="w-4 h-4 text-gray-400 ml-4" />
                         <span className="select-none">{node.name}</span>
                    </div>
                </DraggableFileNode>
            </div>
        );
    }
    
    return (
        <div 
            onContextMenu={(e) => onContextMenu(e, node)}
            onClick={(e) => { e.stopPropagation(); onNodeClick(node); }}
            className={`cursor-pointer ${fileClasses} pl-4`}
        >
            <FileAudio className="w-4 h-4 text-gray-400 ml-4" /> 
            <span className="select-none">{node.name}</span>
        </div>
    );
}