import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { Folder, FileAudio, ChevronRight, ChevronDown } from 'lucide-react';
// **** GEREKLİ STORE'U IMPORT EDİYORUZ ****
import { usePreviewPlayerStore } from '../../store/usePreviewPlayerStore';

const ItemTypes = { SOUND_SOURCE: 'soundSource' };

// Sürüklenebilir dosya öğesi
const DraggableFileNode = ({ node, onContextMenu, children }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.SOUND_SOURCE,
        item: { name: node.name, url: node.url },
        collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
    }), [node.name, node.url]);

    return (
        <div ref={drag} onContextMenu={(e) => onContextMenu(e, node)} style={{ opacity: isDragging ? 0.5 : 1, cursor: 'grab' }}>
            {children}
        </div>
    );
};

// Ana ağaç düğümü bileşeni
export function FileTreeNode({ node, onContextMenu, onNodeClick, isSelected, depth = 0 }) {
    const [isOpen, setIsOpen] = useState(true);
    const [isHovered, setIsHovered] = useState(false);
    
    // **** ÖNİZLEME FONKSİYONUNU STORE'DAN ÇEKİYORUZ ****
    const playPreview = usePreviewPlayerStore(state => state.playPreview);

    const handleNodeClick = (e, targetNode) => {
        e.stopPropagation();
        onNodeClick(targetNode); // Paneli güncellemek için ana fonksiyona iletiyoruz
        
        // **** İŞTE KRİTİK DEĞİŞİKLİK BURADA ****
        // Eğer tıklanan bir klasör ise, aç/kapat
        if (targetNode.type === 'folder') {
            setIsOpen(!isOpen);
        } 
        // Eğer tıklanan bir ses dosyası ise, önizlemeyi başlat
        else if (isAudio) {
            playPreview(targetNode.url);
        }
    };

    const isAudio = node.type === 'file' && (node.name.match(/\.(wav|mp3|ogg|flac)$/i) || node.url.startsWith('blob:'));

    // Stil objeleri, artık tamamen CSS değişkenlerinden besleniyor
    const baseStyle = {
        display: 'flex',
        alignItems: 'center',
        padding: 'var(--padding-controls)',
        borderRadius: 'var(--border-radius)',
        marginLeft: `${depth * 1}rem`, // Hiyerarşik girinti
        cursor: 'pointer',
        transition: 'background-color 150ms ease-out',
        fontSize: 'var(--font-size-body)',
        color: isSelected ? '#ffffff' : 'var(--color-text)',
        backgroundColor: isSelected ? 'var(--color-primary)' : isHovered ? 'var(--color-surface2)' : 'transparent',
    };

    const iconStyle = {
        color: node.type === 'folder' ? 'var(--color-primary)' : 'var(--color-muted)',
        width: '16px',
        height: '16px',
    };

    const nodeContent = (
        <div 
            style={baseStyle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => handleNodeClick(e, node)}
            onContextMenu={(e) => onContextMenu(e, node)}
        >
            {node.type === 'folder' ? (
                isOpen ? <ChevronDown style={iconStyle} /> : <ChevronRight style={iconStyle} />
            ) : (
                <div style={{ width: '16px' }} /> // Dosyalar için girinti boşluğu
            )}
            
            {node.type === 'folder' 
                ? <Folder style={iconStyle} /> 
                : <FileAudio style={{ ...iconStyle, color: 'var(--color-muted)'}} />
            }
            <span className="truncate select-none" style={{ marginLeft: 'var(--gap-controls)' }}>
                {node.name}
            </span>
        </div>
    );

    if (node.type === 'folder') {
        return (
            <div>
                {nodeContent}
                {isOpen && node.children && (
                    <div style={{ marginTop: 'var(--gap-controls)' }}>
                        {node.children.map(child => (
                            <FileTreeNode 
                                key={child.id} 
                                node={child} 
                                onContextMenu={onContextMenu}
                                onNodeClick={onNodeClick}
                                isSelected={isSelected && child.id === isSelected.id}
                                depth={depth + 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }
    
    // Ses dosyaları sürüklenebilir
    return isAudio ? <DraggableFileNode node={node} onContextMenu={onContextMenu}>{nodeContent}</DraggableFileNode> : nodeContent;
}